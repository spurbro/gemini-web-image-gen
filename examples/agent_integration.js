/**
 * Example: How other AI agents / test harnesses call gemini-web-image-gen programmatically
 */
const { generateImage, closeBrowser } = require('../scripts/gemini_bridge.js');

async function main() {
  console.log('🤖 Starting Agent Autonomous Image Task...');

  try {
    // 1. Text-to-Image (T2I)
    console.log('\n--- Step 1: Text-to-Image ---');
    const stage1 = await generateImage(
      'A majestic mechanical falcon perched on a cybernetic tree branch, neon glow, 8k',
      {
        outputPath: './output/falcon_stage1.png',
        timeoutMs: 90000,
      }
    );
    console.log('✓ Stage 1 completed:', stage1.outputPath);

    // 2. Image-to-Image (I2I in the same session)
    console.log('\n--- Step 2: Image-to-Image ---');
    const stage2 = await generateImage(
      'Based on the attached reference image, generate the falcon spreading its wings and taking off into the night sky',
      {
        referenceImagePath: stage1.outputPath,
        outputPath: './output/falcon_stage2.png',
        timeoutMs: 90000,
      }
    );
    console.log('✓ Stage 2 completed:', stage2.outputPath);
  } finally {
    await closeBrowser();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
