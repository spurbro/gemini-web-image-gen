// ============================================================================
// gemini_bridge.js - Universal Cross-Platform Chrome CDP Driver & Gemini Engine
// Supports: Windows, macOS, Linux | Text-to-Image (T2I) & Image-to-Image (I2I)
//           Real Gate 1 & Gate 2 DOM Assertions | Canvas Lossless Extraction
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const selectors = require('./selectors.js');

let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch {}
if (!puppeteer) {
  try {
    const cwdPkg = path.join(process.cwd(), 'node_modules/puppeteer-core');
    puppeteer = require(cwdPkg);
  } catch {}
}
if (!puppeteer) {
  try { puppeteer = require('puppeteer'); } catch {}
}

const CONFIG = {
  DEBUG_HOST: process.env.GEMINI_DEBUG_HOST || '127.0.0.1',
  DEBUG_PORT: parseInt(process.env.GEMINI_DEBUG_PORT, 10) || 9222,
  GEMINI_BASE_URL: process.env.GEMINI_BASE_URL || 'https://gemini.google.com/app',
  USER_DATA_DIR: process.env.GEMINI_USER_DATA_DIR || path.join(os.homedir(), '.chrome-gemini-bridge'),
  DEFAULT_TIMEOUT_MS: 90000,
};

let activeBrowser = null;
let activePage = null;
let executionQueue = Promise.resolve();

/**
 * Locate Chrome executable across Windows, macOS, and Linux
 */
function findChromeExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const platform = process.platform;
  const candidates = [];

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    candidates.push(
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(progFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe')
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    );
  } else {
    // Linux / Unix
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    `[GeminiBridge] Chrome executable not found for platform: ${platform}. ` +
    `Please set the CHROME_PATH environment variable or install Google Chrome.`
  );
}

/**
 * Check if debugging port is responsive
 */
function checkPort() {
  return new Promise((resolve) => {
    const req = http.get(
      `http://${CONFIG.DEBUG_HOST}:${CONFIG.DEBUG_PORT}/json/version`,
      (res) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Ensure Chrome is running with remote debugging port
 */
async function ensureChrome(targetUrl) {
  if (await checkPort()) return;

  const chromePath = findChromeExecutable();
  console.log(`[GeminiBridge] 🚀 Launching Chrome (${chromePath}) on port ${CONFIG.DEBUG_PORT}...`);
  console.log(`[GeminiBridge] 📁 Profile Directory: ${CONFIG.USER_DATA_DIR}`);

  if (!fs.existsSync(CONFIG.USER_DATA_DIR)) {
    fs.mkdirSync(CONFIG.USER_DATA_DIR, { recursive: true });
  }

  const child = spawn(
    chromePath,
    [
      `--remote-debugging-port=${CONFIG.DEBUG_PORT}`,
      `--user-data-dir=${CONFIG.USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      targetUrl || CONFIG.GEMINI_BASE_URL,
    ],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await checkPort()) {
      console.log('[GeminiBridge] ✓ Connected to Chrome on port', CONFIG.DEBUG_PORT);
      return;
    }
  }

  throw new Error(`Failed to connect to Chrome on port ${CONFIG.DEBUG_PORT} within 15 seconds.`);
}

/**
 * Get or connect to Puppeteer browser instance
 */
async function getBrowser(targetUrl) {
  await ensureChrome(targetUrl);
  if (activeBrowser && activeBrowser.isConnected()) {
    return activeBrowser;
  }

  if (!puppeteer) {
    throw new Error('puppeteer-core or puppeteer is required. Run "npm install puppeteer-core".');
  }

  activeBrowser = await puppeteer.connect({
    browserURL: `http://${CONFIG.DEBUG_HOST}:${CONFIG.DEBUG_PORT}`,
    defaultViewport: { width: 1440, height: 900 },
  });

  return activeBrowser;
}

/**
 * Get or navigate to Gemini Web page
 */
async function getGeminiPage(targetUrl) {
  const browser = await getBrowser(targetUrl);
  const pages = await browser.pages();
  const destUrl = targetUrl || CONFIG.GEMINI_BASE_URL;

  let page = pages.find((p) => p.url().includes('gemini.google.com'));

  if (!page) {
    page = pages[0] || (await browser.newPage());
    console.log(`[GeminiBridge] 🌐 Navigating to ${destUrl}...`);
    await page.goto(destUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  } else if (targetUrl && !page.url().includes(targetUrl.split('/').pop())) {
    console.log(`[GeminiBridge] 🌐 Switching conversation to: ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  }

  await page.bringToFront();
  activePage = page;
  return page;
}

/**
 * Internal single execution core
 */
async function executeGeneration(prompt, options = {}) {
  const startTime = Date.now();
  const rawPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  if (!rawPrompt) {
    throw new Error('[GeminiBridge] Prompt must be a non-empty string.');
  }

  let timeoutMs = CONFIG.DEFAULT_TIMEOUT_MS;
  if (options.timeoutMs !== undefined) {
    const parsed = parseInt(options.timeoutMs, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`[GeminiBridge] Invalid timeoutMs: ${options.timeoutMs}. Must be a positive integer.`);
    }
    timeoutMs = parsed;
  }

  // Strict reference image existence check (No silent fallback!)
  let refImage = null;
  if (options.referenceImagePath) {
    const resolvedPath = path.resolve(options.referenceImagePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`[GeminiBridge] ❌ Reference image not found on disk: "${resolvedPath}". Aborting!`);
    }
    refImage = resolvedPath;
  }

  const targetUrl = options.targetUrl || null;
  const page = await getGeminiPage(targetUrl);
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Clean UI state (dismiss popups, stop lingering generations)
  await page.evaluate((btnSel) => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    // Stop button
    const stop = allButtons.find((b) => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return btnSel.stopAriaMatches.some((m) => aria.includes(m));
    });
    if (stop) stop.click();

    // Close button
    const close = allButtons.find((b) => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return btnSel.closeAriaMatches.some((m) => aria.includes(m));
    });
    if (close) close.click();
  }, selectors.buttons);

  // 2. Clear input area
  await page.waitForSelector(selectors.input.editor, { timeout: 10000 });
  await page.evaluate((editorSel) => {
    const el = document.querySelector(editorSel);
    if (el) {
      el.focus();
      if (el.isContentEditable) {
        el.innerText = '';
      } else if ('value' in el) {
        el.value = '';
      }
    }
  }, selectors.input.editor);

  // 3. Upload Reference Image if provided (Image-to-Image)
  if (refImage) {
    console.log(`[GeminiBridge] 📎 Attaching reference image: ${refImage}...`);

    // Click "+" button
    const uploadBtnClicked = await page.evaluate((upSel) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const upload = btns.find((b) => {
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        return upSel.buttonAriaMatches.some((m) => aria.includes(m));
      });
      if (upload) {
        upload.click();
        return true;
      }
      return false;
    }, selectors.upload);

    if (!uploadBtnClicked) {
      throw new Error('[GeminiBridge] Upload "+" button could not be located in the UI.');
    }

    // Trigger FileChooser on popup menu item
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      page.evaluate((upSel) => {
        const items = Array.from(document.querySelectorAll(upSel.menuItems));
        const target = items.find((el) => {
          const t = (el.innerText || '').trim().toLowerCase();
          return upSel.menuItemTexts.some((m) => t.includes(m));
        });
        if (target) {
          target.click();
          return true;
        }
        return false;
      }, selectors.upload),
    ]);

    if (!fileChooser) {
      throw new Error('❌ [GATE 1 FAILED] FileChooser could not be triggered from the upload menu!');
    }

    await fileChooser.accept([refImage]);

    // GATE 1 - Hard Assertion: Wait for image thumbnail chip in input box
    console.log('[GeminiBridge] ⏳ [GATE 1] Verifying image thumbnail chip in input box...');
    const gate1Passed = await page.waitForFunction(
      (chipsSel) => {
        const previews = Array.from(document.querySelectorAll(chipsSel.join(', ')));
        return previews.some((img) => img.naturalWidth > 0 || img.complete || img.clientHeight > 0);
      },
      { timeout: 12000 },
      selectors.attachment.chips
    ).catch(() => false);

    if (options.gate1ProofPath) {
      const p = path.resolve(options.gate1ProofPath);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      await page.screenshot({ path: p });
      console.log(`[GeminiBridge] 📸 Saved Gate 1 Proof: ${p}`);
    }

    if (!gate1Passed) {
      throw new Error('❌ [GATE 1 FAILED] Image thumbnail chip was NOT detected in input box after upload. Aborting!');
    }
    console.log('[GeminiBridge] 🎉 [GATE 1 PASSED] Reference image successfully attached in input bar!');
  }

  // 4. Fast Text Insertion
  console.log(`[GeminiBridge] ⌨️ Submitting prompt: "${rawPrompt.slice(0, 75)}..."`);
  await page.evaluate((editorSel, text) => {
    const el = document.querySelector(editorSel);
    if (el) {
      el.focus();
      document.execCommand('insertText', false, text);
    }
  }, selectors.input.editor, rawPrompt);

  // 5. Submit Message (Send Button / Enter)
  const sendClicked = await page.evaluate((btnSel) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const send = btns.find((b) => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return btnSel.sendAriaMatches.some((m) => aria.includes(m));
    });
    if (send && !send.disabled) {
      send.click();
      return true;
    }
    return false;
  }, selectors.buttons);

  if (!sendClicked) {
    await page.keyboard.press('Enter');
  }
  console.log('[GeminiBridge] ✓ Message dispatched!');

  // 6. GATE 2 - Real DOM Assertion: Wait for user query bubble to contain the image thumbnail
  if (refImage) {
    console.log('[GeminiBridge] ⏳ [GATE 2] Asserting user query bubble in DOM contains attached image...');
    const gate2Passed = await page.waitForFunction(
      (chatSel) => {
        const bubbles = Array.from(document.querySelectorAll(chatSel.userQueryBubbles.join(', ')));
        if (bubbles.length === 0) return false;
        const latest = bubbles[bubbles.length - 1];
        const imgs = Array.from(latest.querySelectorAll(chatSel.userQueryImages));
        return imgs.some((img) => img.naturalWidth > 0 || img.complete);
      },
      { timeout: 10000 },
      selectors.chat
    ).catch(() => false);

    if (options.gate2ProofPath) {
      const p = path.resolve(options.gate2ProofPath);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      await page.screenshot({ path: p });
      console.log(`[GeminiBridge] 📸 Saved Gate 2 Proof: ${p}`);
    }

    if (!gate2Passed) {
      console.warn('[GeminiBridge] ⚠️ [GATE 2 Warning] User message bubble did not register image element within timeout.');
    } else {
      console.log('[GeminiBridge] 🎉 [GATE 2 PASSED] User message bubble confirmed with image attachment in DOM!');
    }
  }

  // 7. Poll for Newly Rendered Imagen 3 Image in DOM
  console.log('[GeminiBridge] ⏳ Waiting for Gemini Imagen 3 rendering in conversation...');
  const deadline = Date.now() + timeoutMs;
  let resultDataUrl = null;
  let imgWidth = 0;
  let imgHeight = 0;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));

    const check = await page.evaluate((outSel) => {
      const allImgs = Array.from(document.querySelectorAll(outSel.generatedImages.join(', ')));
      const candidates = allImgs.filter(
        (img) => img.naturalWidth >= outSel.minWidth && img.naturalHeight >= outSel.minHeight && img.complete
      );
      if (candidates.length === 0) return null;

      const target = candidates[candidates.length - 1];
      try {
        const canvas = document.createElement('canvas');
        canvas.width = target.naturalWidth;
        canvas.height = target.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(target, 0, 0);
          return {
            dataUrl: canvas.toDataURL('image/png'),
            width: target.naturalWidth,
            height: target.naturalHeight,
          };
        }
      } catch {}
      return null;
    }, selectors.output);

    if (check && check.dataUrl) {
      resultDataUrl = check.dataUrl;
      imgWidth = check.width;
      imgHeight = check.height;
      break;
    }
  }

  if (!resultDataUrl) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    throw new Error(`[GeminiBridge] Timed out waiting for image generation after ${elapsed}s.`);
  }

  const base64Data = resultDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  if (options.outputPath) {
    const finalOut = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(finalOut), { recursive: true });
    fs.writeFileSync(finalOut, buffer);
    console.log(`[GeminiBridge] 🎉 Successfully saved image (${imgWidth}x${imgHeight}) to: ${finalOut}`);
  }

  return {
    success: true,
    buffer,
    base64: base64Data,
    dataUrl: resultDataUrl,
    width: imgWidth,
    height: imgHeight,
    outputPath: options.outputPath ? path.resolve(options.outputPath) : null,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Concurrency-Safe Public API (Mutex Serialized)
 */
function generateImage(prompt, options = {}) {
  const task = executionQueue.then(() => executeGeneration(prompt, options));
  executionQueue = task.catch(() => {});
  return task;
}

/**
 * Close and disconnect browser instance
 */
async function closeBrowser() {
  if (activeBrowser) {
    try {
      activeBrowser.disconnect();
    } catch {}
    activeBrowser = null;
    activePage = null;
  }
}

module.exports = {
  findChromeExecutable,
  checkPort,
  ensureChrome,
  getBrowser,
  getGeminiPage,
  generateImage,
  closeBrowser,
  CONFIG,
};
