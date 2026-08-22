#!/usr/bin/env node
// ============================================================================
// generate_single.js - Single-image CLI tool supporting T2I and I2I
// ============================================================================

const fs = require('fs');
const path = require('path');
let minimist;
try { minimist = require('minimist'); } catch {}
if (!minimist) {
  try { minimist = require(path.join(__dirname, '../node_modules/minimist')); } catch {}
}
if (!minimist) {
  minimist = function(args, opts = {}) {
    const res = { _: [] };
    const aliases = opts.alias || {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          res[key] = next;
          i++;
        } else {
          res[key] = true;
        }
      } else if (arg.startsWith('-') && arg.length > 1) {
        const shortKey = arg.slice(1);
        const fullKey = Object.keys(aliases).find(k => aliases[k] === shortKey) || shortKey;
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          res[fullKey] = next;
          res[shortKey] = next;
          i++;
        } else {
          res[fullKey] = true;
          res[shortKey] = true;
        }
      } else {
        res._.push(arg);
      }
    }
    for (const [mainKey, aliasKey] of Object.entries(aliases)) {
      if (res[aliasKey] !== undefined && res[mainKey] === undefined) {
        res[mainKey] = res[aliasKey];
      } else if (res[mainKey] !== undefined && res[aliasKey] === undefined) {
        res[aliasKey] = res[mainKey];
      }
    }
    return res;
  };
}

const args = minimist(process.argv.slice(2), {
  string: ['prompt', 'out', 'ref', 'url', 'timeout'],
  boolean: ['all'],
  alias: { p: 'prompt', o: 'out', r: 'ref', u: 'url', t: 'timeout', a: 'all' },
});

const { generateImage } = require('./gemini_bridge.js');

const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
const outPath = args.out || 'output/generated_image.png';
const refImage = args.ref ? path.resolve(args.ref) : null;
const targetUrl = args.url || null;
const extractAll = !!args.all;

let timeoutMs = 90000;
if (args.timeout) {
  const parsed = parseInt(args.timeout, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(`❌ Error: --timeout must be a positive integer (got "${args.timeout}").`);
    process.exit(1);
  }
  timeoutMs = parsed;
}

if (!prompt) {
  console.log(`
Usage:
  node generate_single.js --prompt "<prompt>" --out "<output_path>" [options]

Options:
  --prompt, -p   Image generation prompt text (required)
  --out, -o      Output PNG file path (default: output/generated_image.png)
  --ref, -r      (Optional) Reference image path for Image-to-Image (Img2Img)
  --url, -u      (Optional) Persistent conversation URL to maintain session memory
  --all, -a      (Optional) Extract all candidate image variations if multiple are generated
  --timeout, -t  (Optional) Timeout in milliseconds (default: 90000)

Examples:
  # Text-to-Image (文生图)
  node generate_single.js -p "A cybernetic futuristic panther in neon rain, 8k" -o "output/panther.png"

  # Image-to-Image with persistent session (图生图并保持会话)
  node generate_single.js -u "https://gemini.google.com/app/3200b19c05615add" -r "assets/stage1.png" -p "Continue the action scene" -o "assets/stage2.png"
  `);
  process.exit(1);
}

if (refImage && !fs.existsSync(refImage)) {
  console.error(`❌ Error: Reference image file does not exist: "${refImage}"`);
  process.exit(1);
}

console.log('----------------------------------------------------');
console.log('🎨 Gemini Imagen CDP Bridge (CLI)');
console.log(`📝 Prompt:      ${prompt}`);
console.log(`📂 Output:      ${outPath}`);
if (refImage) console.log(`📎 Reference:   ${refImage}`);
if (targetUrl) console.log(`🌐 Session URL: ${targetUrl}`);
if (extractAll) console.log(`🖼️ Multi-Var:   Enabled (extracting all candidate variations)`);
console.log('----------------------------------------------------');

generateImage(prompt, {
  referenceImagePath: refImage,
  targetUrl: targetUrl,
  outputPath: outPath,
  extractAll: extractAll,
  timeoutMs: timeoutMs,
  gate1ProofPath: path.resolve('output/gate1_proof.png'),
  gate2ProofPath: path.resolve('output/gate2_proof.png')
}).then((res) => {
  console.log('----------------------------------------------------');
  console.log(`✨ Successfully completed in ${(res.durationMs / 1000).toFixed(1)}s!`);
  console.log(`🔗 Conversation URL: ${res.conversationUrl}`);
  if (res.images && res.images.length > 1) {
    console.log(`🖼️ Extracted ${res.images.length} image variations:`);
    res.images.forEach((img, i) => {
      console.log(`   [${i + 1}] (${img.width}x${img.height}) -> ${img.outputPath || 'in-memory'}`);
    });
  }
  process.exit(0);
}).catch((err) => {
  console.error('❌ Generation Error:', err.message || err);
  process.exit(1);
});
