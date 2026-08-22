#!/usr/bin/env node
// ============================================================================
// launch_chrome.js - Cross-Platform Chrome Launcher for Gemini Web CDP
// Works on Windows, macOS, and Linux
// ============================================================================

const { ensureChrome, checkPort, CONFIG } = require('./gemini_bridge.js');

async function main() {
  const isRunning = await checkPort();
  if (isRunning) {
    console.log(`[CDP] ✓ Chrome is already running and listening on port ${CONFIG.DEBUG_PORT}`);
    process.exit(0);
  }

  console.log(`[CDP] Starting Chrome with remote debugging on port ${CONFIG.DEBUG_PORT}...`);
  await ensureChrome();
  console.log(`[CDP] ✓ Chrome started successfully!`);
}

main().catch((err) => {
  console.error(`[CDP] ❌ Error:`, err.message || err);
  process.exit(1);
});
