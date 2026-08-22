/**
 * Example: How other AI agents / custom harnesses can integrate this engine
 */
const { generateImage, ensureChrome, checkPort } = require('../scripts/gemini_bridge.js');

async function executeAgentImageTask() {
  console.log('🤖 Agent Task: Generating character concept...');

  // Step 1: Text-to-Image
  const stage1 = await generateImage(
    'A brave futuristic space pilot girl with pink helmet on solid magenta background, pixel art, 8k',
    { outputPath: './output/pilot_stage1.png' }
  );
  console.log('✓ Stage 1 Image ready:', stage1.outputPath);

  // Step 2: Image-to-Image in the same session
  const stage2 = await generateImage(
    'Based on the attached reference image, generate the pilot raising her blaster rifle in combat stance',
    {
      referenceImagePath: stage1.outputPath,
      outputPath: './output/pilot_stage2.png'
    }
  );
  console.log('✓ Stage 2 Img2Img ready:', stage2.outputPath);
}

if (require.main === module) {
  executeAgentImageTask().catch(console.error);
}

module.exports = { executeAgentImageTask };
