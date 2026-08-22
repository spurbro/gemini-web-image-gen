#!/usr/bin/env node
// ============================================================================
// generate_single.js - Single-image CLI tool supporting T2I and I2I
// ============================================================================

const path = require('path');
const minimist = require('minimist');
const { generateImage } = require('./gemini_bridge.js');

const args = minimist(process.argv.slice(2), {
  string: ['prompt', 'out', 'ref', 'url', 'timeout'],
  alias: { p: 'prompt', o: 'out', r: 'ref', u: 'url', t: 'timeout' },
});

const prompt = args.prompt;
const outPath = args.out || 'output/generated_image.png';
const refImage = args.ref || null;
const targetUrl = args.url || null;
const timeoutMs = args.timeout ? parseInt(args.timeout, 10) : 90000;

if (!prompt) {
  console.log(`
Usage:
  node generate_single.js --prompt "<prompt>" --out "<output_path>" [options]

Options:
  --prompt, -p   Image generation prompt (required)
  --out, -o      Output file path (default: output/generated_image.png)
  --ref, -r      (Optional) Reference image path for Image-to-Image (Img2Img)
  --url, -u      (Optional) Persistent chat URL to maintain same session memory
  --timeout, -t  (Optional) Generation timeout in ms (default: 90000)

Examples:
  # Text-to-Image (文生图)
  node generate_single.js -p "A cybernetic futuristic samurai in neon rain, 8k" -o "assets/samurai.png"

  # Image-to-Image in same session (图生图并保持会话)
  node generate_single.js -u "https://gemini.google.com/app/3200b19c05615add" -r "assets/stage1.png" -p "Continue the scene with open cockpit" -o "assets/stage2.png"
  `);
  process.exit(1);
}

console.log('----------------------------------------------------');
console.log('🎨 Gemini Web Image Generator');
console.log('📝 Prompt:    ' + prompt);
console.log('📂 Output:    ' + outPath);
if (refImage) console.log('📎 Reference: ' + refImage);
if (targetUrl) console.log('🌐 Session:   ' + targetUrl);
console.log('----------------------------------------------------');

generateImage(prompt, {
  referenceImagePath: refImage,
  targetUrl: targetUrl,
  outputPath: outPath,
  timeoutMs: timeoutMs,
  gate1ProofPath: path.resolve('output/gate1_proof.png'),
  gate2ProofPath: path.resolve('output/gate2_proof.png')
}).then((res) => {
  console.log('✨ Image generation completed successfully in ' + (res.durationMs / 1000).toFixed(1) + 's!');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Generation Error:', err.message || err);
  process.exit(1);
});
