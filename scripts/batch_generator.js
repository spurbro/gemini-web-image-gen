#!/usr/bin/env node
// ============================================================================
// batch_generator.js - Batch Image Generator with Caching & Retry Loops
// Usage: node batch_generator.js --config tasks.json --output-dir ./output
// ============================================================================

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { generateImage } = require('./gemini_bridge.js');

const args = minimist(process.argv.slice(2), {
  string: ['config', 'output-dir', 'delay', 'retries'],
  alias: { c: 'config', o: 'output-dir', d: 'delay', r: 'retries' },
});

const configFile = args.config ? path.resolve(args.config) : '';
const outputDir = path.resolve(args['output-dir'] || './output');
const delayMs = parseInt(args.delay, 10) || 3000;
const maxRetries = parseInt(args.retries, 10) || 2;

if (!configFile) {
  console.error('❌ Error: --config <tasks.json> is required.');
  console.log('Usage: node batch_generator.js --config tasks.json --output-dir "output"');
  process.exit(1);
}

if (!fs.existsSync(configFile)) {
  console.error(`❌ Error: Config file does not exist: "${configFile}"`);
  process.exit(1);
}

function fileExistsAndNotEmpty(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.size > 1000;
  } catch {
    return false;
  }
}

async function main() {
  const rawConfig = fs.readFileSync(configFile, 'utf8');
  let tasks;
  try {
    tasks = JSON.parse(rawConfig);
  } catch (e) {
    console.error(`❌ Error parsing JSON config file: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(tasks) || tasks.length === 0) {
    console.error('❌ Config file must contain an array of tasks: [{ filename, prompt, referenceImage?, targetUrl? }]');
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('========================================================');
  console.log(`🚀 [Batch Image Gen] Starting ${tasks.length} tasks`);
  console.log(`📁 Output Directory: ${outputDir}`);
  console.log('========================================================');

  // Map to store latest status per filename (deduplicated)
  const resultMap = new Map();

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const pendingTasks = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const targetFilename = task.filename || `task_${i + 1}.png`;
      const targetPath = path.join(outputDir, targetFilename);

      if (fileExistsAndNotEmpty(targetPath)) {
        if (attempt === 1) {
          console.log(`[Batch] ⏭️ Skipping [${i + 1}/${tasks.length}] ${targetFilename} - Already exists on disk`);
          resultMap.set(targetFilename, { filename: targetFilename, success: true, cached: true });
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
      await new Promise((r) => setTimeout(r, 3000));
    }

    for (let p = 0; p < pendingTasks.length; p++) {
      const { index, task, targetPath, targetFilename } = pendingTasks[p];
      const refPath = task.referenceImage || task.referenceImagePath || task.ref || null;
      const targetUrl = task.targetUrl || task.url || null;

      console.log('\n========================================================');
      console.log(`🎨 [Batch] [${index + 1}/${tasks.length}] Generating: ${targetFilename}`);
      console.log(`📝 Prompt: ${task.prompt}`);
      if (refPath) console.log(`📎 Reference Image: ${refPath}`);
      if (targetUrl) console.log(`🌐 Session URL: ${targetUrl}`);
      console.log('========================================================');

      try {
        const genRes = await generateImage(task.prompt, {
          referenceImagePath: refPath ? path.resolve(path.dirname(configFile), refPath) : null,
          targetUrl: targetUrl,
          outputPath: targetPath,
          timeoutMs: task.timeout || 95000,
        });

        console.log(`✅ [Batch] Saved to: ${targetPath} (${Math.round(genRes.durationMs / 1000)}s)`);
        resultMap.set(targetFilename, {
          filename: targetFilename,
          success: true,
          path: targetPath,
          durationMs: genRes.durationMs,
        });
      } catch (err) {
        console.error(`❌ [Batch] Failed: ${err.message}`);
        resultMap.set(targetFilename, {
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

  const finalResults = Array.from(resultMap.values());
  const failedCount = finalResults.filter((r) => !r.success).length;

  console.log('\n========================================================');
  console.log(`📊 Batch Generation Summary (${finalResults.length - failedCount}/${finalResults.length} Succeeded):`);
  console.log(JSON.stringify(finalResults, null, 2));
  console.log('========================================================');

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal batch error:', err);
  process.exit(1);
});
