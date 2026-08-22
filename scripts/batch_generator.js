#!/usr/bin/env node
// ============================================================================
// batch_generator.js - Batch Image Generator with Caching & Retry Loops
// Usage: node batch_generator.js --config tasks.json --output-dir ./output
// ============================================================================

import fs from 'fs/promises';
import path from 'path';
import { generateImage } from './gemini_bridge.js';

function parseArgs() {
  const args = process.argv.slice(2);
  let configFile = '';
  let outputDir = './output';
  let delayMs = 3000;
  let maxRetries = 2;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--config' || arg === '-c') {
      configFile = args[++i];
    } else if (arg === '--output-dir' || arg === '-o') {
      outputDir = args[++i];
    } else if (arg === '--delay' || arg === '-d') {
      delayMs = parseInt(args[++i], 10) || 3000;
    } else if (arg === '--retries' || arg === '-r') {
      maxRetries = parseInt(args[++i], 10) || 2;
    }
  }

  if (!configFile) {
    console.error('❌ Error: --config <tasks.json> is required.');
    console.log('Usage: node batch_generator.js --config tasks.json --output-dir "public/assets"');
    process.exit(1);
  }

  return {
    configFile: path.resolve(configFile),
    outputDir: path.resolve(outputDir),
    delayMs,
    maxRetries,
  };
}

async function fileExistsAndNotEmpty(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.size > 1000;
  } catch {
    return false;
  }
}

async function main() {
  const { configFile, outputDir, delayMs, maxRetries } = parseArgs();

  const rawConfig = await fs.readFile(configFile, 'utf8');
  const tasks = JSON.parse(rawConfig);

  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.error('❌ Config file must contain an array of tasks: [{ filename, prompt }]');
    process.exit(1);
  }

  await fs.mkdir(outputDir, { recursive: true });

  console.log('========================================================');
  console.log(`🚀 [Batch Image Gen] Starting ${tasks.length} tasks`);
  console.log(`📁 Output Directory: ${outputDir}`);
  console.log('========================================================');

  const results = [];

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const pendingTasks = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const targetFilename = task.filename || `task_${i + 1}.png`;
      const targetPath = path.join(outputDir, targetFilename);

      const exists = await fileExistsAndNotEmpty(targetPath);
      if (exists) {
        if (attempt === 1) {
          console.log(`[Batch] ⏭️ Skipping [${i + 1}/${tasks.length}] ${targetFilename} - Already exists`);
          results.push({ filename: targetFilename, success: true, cached: true });
        }
      } else {
        pendingTasks.push({ index: i, task, targetPath, targetFilename });
      }
    }

    if (pendingTasks.length === 0) {
      console.log(`\n🎉 All ${tasks.length} images are complete and verified on disk!`);
      break;
    }

    if (attempt > 1) {
      console.log(`\n🔁 [Batch] Starting Retry Round ${attempt - 1} for ${pendingTasks.length} pending items...`);
      await new Promise((r) => setTimeout(r, 4000));
    }

    for (let p = 0; p < pendingTasks.length; p++) {
      const { index, task, targetPath, targetFilename } = pendingTasks[p];
      console.log(`\n========================================================`);
      console.log(`🎨 [Batch] [${index + 1}/${tasks.length}] Generating: ${targetFilename}`);
      console.log(`📝 Prompt: ${task.prompt}`);
      console.log(`========================================================`);

      try {
        const genRes = await generateImage(task.prompt, { timeoutMs: task.timeout || 95000 });
        await fs.writeFile(targetPath, genRes.buffer);
        console.log(`✅ [Batch] Saved to: ${targetPath} (${Math.round(genRes.durationMs / 1000)}s)`);

        results.push({
          filename: targetFilename,
          success: true,
          path: targetPath,
          durationMs: genRes.durationMs,
        });
      } catch (err) {
        console.error(`❌ [Batch] Failed: ${err.message}`);
        results.push({
          filename: targetFilename,
          success: false,
          error: err.message,
        });
      }

      if (p < pendingTasks.length - 1) {
        console.log(`⏳ Cooling down ${delayMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  console.log('\n========================================================');
  console.log('📊 Batch Generation Summary:');
  console.log(JSON.stringify(results, null, 2));
  console.log('========================================================');
}

main().catch(console.error);
