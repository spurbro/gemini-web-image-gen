// ============================================================================
// test_bridge.js - Unit and Smoke Tests for gemini-web-image-gen
// ============================================================================

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  findChromeExecutable,
  checkPort,
  generateImage,
  CONFIG
} = require('../scripts/gemini_bridge.js');
const selectors = require('../scripts/selectors.js');

async function runTests() {
  console.log('🧪 Starting gemini-web-image-gen test suite...\n');

  // Test 1: Selector Structure
  console.log('Test 1: Validating selectors structure...');
  assert(selectors.input && typeof selectors.input.editor === 'string', 'selectors.input.editor should exist');
  assert(selectors.upload && Array.isArray(selectors.upload.buttonAriaMatches), 'selectors.upload.buttonAriaMatches should be an array');
  assert(selectors.attachment && Array.isArray(selectors.attachment.chips), 'selectors.attachment.chips should be an array');
  assert(selectors.chat && Array.isArray(selectors.chat.userQueryBubbles), 'selectors.chat.userQueryBubbles should be an array');
  assert(selectors.output && Array.isArray(selectors.output.generatedImages), 'selectors.output.generatedImages should be an array');
  console.log('  ✓ Selectors structure is valid.');

  // Test 2: Chrome Detection
  console.log('Test 2: Detecting Chrome executable on current OS...');
  const chromePath = findChromeExecutable();
  assert(typeof chromePath === 'string' && chromePath.length > 0, 'Chrome path should be detected');
  console.log(`  ✓ Detected Chrome at: "${chromePath}"`);

  // Test 3: Parameter Validation - Empty Prompt
  console.log('Test 3: Validating empty prompt rejection...');
  await assert.rejects(
    async () => {
      await generateImage('');
    },
    /Prompt must be a non-empty string/,
    'Should throw error for empty prompt'
  );
  console.log('  ✓ Empty prompt correctly rejected.');

  // Test 4: Parameter Validation - Non-existent Reference Image
  console.log('Test 4: Validating non-existent reference image rejection...');
  await assert.rejects(
    async () => {
      await generateImage('test prompt', {
        referenceImagePath: './non_existent_image_12345.png'
      });
    },
    /Reference image not found on disk/,
    'Should throw error for missing reference image (no silent fallback)'
  );
  console.log('  ✓ Missing reference image correctly rejected.');

  // Test 5: Parameter Validation - Invalid Timeout
  console.log('Test 5: Validating invalid timeout rejection...');
  await assert.rejects(
    async () => {
      await generateImage('test prompt', {
        timeoutMs: -500
      });
    },
    /Invalid timeoutMs/,
    'Should throw error for invalid timeout'
  );
  console.log('  ✓ Invalid timeout correctly rejected.');

  console.log('\n🎉 ALL 5 UNIT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
