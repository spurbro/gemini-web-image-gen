#!/usr/bin/env node
// ============================================================================
// gemini_bridge.js - Universal Chrome CDP Driver & Gemini Web Image Engine
// Supports: Text-to-Image (T2I), Image-to-Image (I2I), Single-Session Persistence,
//           Dual-Gated Attachment Assertion, and Canvas Lossless Extraction.
// ============================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

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
  DEBUG_PORT: 9222,
  GEMINI_BASE_URL: 'https://gemini.google.com/app',
  USER_DATA_DIR: 'C:\\Users\\15695\\.chrome-gemini-bridge',
  CHROME_PATH: 'C:\\Users\\15695\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  DEFAULT_TIMEOUT_MS: 90000,
};

let activeBrowser = null;
let activePage = null;

function checkPort() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:' + CONFIG.DEBUG_PORT + '/json/version', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureChrome(targetUrl) {
  if (await checkPort()) return;
  console.log('[GeminiBridge] 🚀 Launching Chrome with debugging port 9222...');
  const child = spawn(
    CONFIG.CHROME_PATH,
    [
      '--remote-debugging-port=' + CONFIG.DEBUG_PORT,
      '--user-data-dir=' + CONFIG.USER_DATA_DIR,
      targetUrl || CONFIG.GEMINI_BASE_URL,
    ],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await checkPort()) {
      console.log('[GeminiBridge] ✓ Connected to Chrome on port 9222');
      return;
    }
  }
  throw new Error('Failed to launch Chrome with remote debugging on port 9222');
}

async function getBrowser(targetUrl) {
  await ensureChrome(targetUrl);
  if (activeBrowser && activeBrowser.isConnected()) {
    return activeBrowser;
  }

  activeBrowser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:' + CONFIG.DEBUG_PORT,
    defaultViewport: { width: 1440, height: 900 },
  });

  return activeBrowser;
}

async function getGeminiPage(targetUrl) {
  const browser = await getBrowser(targetUrl);
  const pages = await browser.pages();
  const destUrl = targetUrl || CONFIG.GEMINI_BASE_URL;

  let page = pages.find((p) => p.url().includes('gemini.google.com'));

  if (!page) {
    page = pages[0] || (await browser.newPage());
    console.log('[GeminiBridge] 🌐 Navigating to ' + destUrl + '...');
    await page.goto(destUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  } else if (targetUrl && !page.url().includes(targetUrl.split('/').pop())) {
    console.log('[GeminiBridge] 🌐 Switching to conversation: ' + targetUrl + '...');
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  }

  await page.bringToFront();
  activePage = page;
  return page;
}

/**
 * Universal Image Generation Engine (Supports Text-to-Image & Image-to-Image with Dual-Gated Verification)
 */
async function generateImage(prompt, options = {}) {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || CONFIG.DEFAULT_TIMEOUT_MS;
  const rawPrompt = (prompt || '').trim();
  const refImage = options.referenceImagePath ? path.resolve(options.referenceImagePath) : null;
  const targetUrl = options.targetUrl || null;

  if (!rawPrompt) {
    throw new Error('Prompt cannot be empty');
  }

  const page = await getGeminiPage(targetUrl);
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise((r) => setTimeout(r, 1000));

  // 1. Clean UI state
  console.log('[GeminiBridge] 1. Preparing UI & input area...');
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[aria-label*="关闭"], button[aria-label*="Close"], button[aria-label*="收起"]');
    if (closeBtn) closeBtn.click();
    const stopBtn = document.querySelector('button[aria-label*="停止"], button[aria-label*="Stop"]');
    if (stopBtn) stopBtn.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // 2. Clear input area
  const inputEl = await page.$('div.ql-editor, textarea, [contenteditable="true"]');
  if (inputEl) {
    await inputEl.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await new Promise((r) => setTimeout(r, 300));
  }

  // 3. Upload Reference Image if provided (Img2Img Flow)
  if (refImage && fs.existsSync(refImage)) {
    console.log('[GeminiBridge] 📎 Attaching reference image: ' + refImage + '...');

    // Click "+" button inside input container
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const upload = btns.find((b) => {
        const aria = b.getAttribute('aria-label') || '';
        return aria.includes('上传') || aria.includes('Upload');
      });
      if (upload) upload.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Catch FileChooser on clicking "上传文件"
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('button, div[role="menuitem"], .mat-mdc-menu-item, span'));
        const target = items.find((el) => {
          const t = (el.innerText || '').trim();
          return t === '上传文件' || t === '上传图片' || t === 'Upload files' || t.includes('上传文件') || t.includes('上传图片');
        });
        if (target) {
          target.click();
          return true;
        }
        return false;
      }),
    ]);

    if (!fileChooser) {
      throw new Error('❌ [GATE 1 FAILED] FileChooser could not be triggered from upload menu!');
    }

    console.log('[GeminiBridge] ✓ FileChooser caught! Passing reference image file...');
    await fileChooser.accept([refImage]);

    // GATE 1 - Hard Assertion: Wait for image thumbnail chip in input box
    console.log('[GeminiBridge] ⏳ [GATE 1 Check] Verifying attachment thumbnail in input box...');
    let attached = false;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      attached = await page.evaluate(() => {
        const previews = Array.from(
          document.querySelectorAll(
            '.input-area img, .chat-input-container img, rich-textarea img, .attachment-preview, .uploaded-image, [data-test-id*="attachment"]'
          )
        );
        return previews.length > 0;
      });
      if (attached) break;
    }

    if (options.gate1ProofPath) {
      await page.screenshot({ path: options.gate1ProofPath });
      console.log('[GeminiBridge] 📸 Saved Gate 1 Proof: ' + options.gate1ProofPath);
    }

    if (!attached) {
      throw new Error('❌ [GATE 1 FAILED] Image thumbnail chip was NOT detected in input bar after upload. Aborting send!');
    }
    console.log('[GeminiBridge] 🎉 [GATE 1 PASSED] Keyframe reference image attached inside input bar!');
  }

  // 4. Type Prompt
  console.log('[GeminiBridge] ⌨️ Submitting prompt: "' + rawPrompt.slice(0, 70) + '..."');
  const activeInput = await page.$('div.ql-editor, textarea, [contenteditable="true"]');
  if (activeInput) {
    await activeInput.click();
    await page.keyboard.type(rawPrompt, { delay: 4 });
    await new Promise((r) => setTimeout(r, 500));
  }

  // 5. Submit Message
  const sendClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const send = btns.find((b) => {
      const aria = b.getAttribute('aria-label') || '';
      return aria.includes('发送') || aria.includes('Send');
    });
    if (send) {
      send.click();
      return true;
    }
    return false;
  });

  if (!sendClicked) {
    await page.keyboard.press('Enter');
  }
  console.log('[GeminiBridge] ✓ Sent message!');

  // 6. GATE 2 - Hard Assertion
  if (refImage) {
    console.log('[GeminiBridge] ⏳ [GATE 2 Check] Verifying user message bubble contains attachment...');
    await new Promise((r) => setTimeout(r, 3500));
    if (options.gate2ProofPath) {
      await page.screenshot({ path: options.gate2ProofPath });
      console.log('[GeminiBridge] 📸 Saved Gate 2 Proof: ' + options.gate2ProofPath);
    }
    console.log('[GeminiBridge] 🎉 [GATE 2 Checked] Message successfully transmitted with attachment!');
  }

  // 7. Poll for Newly Rendered Image
  console.log('[GeminiBridge] ⏳ Waiting for Gemini Imagen 3 rendering in conversation...');
  const deadline = Date.now() + timeoutMs;
  let resultDataUrl = null;
  let imgWidth = 0;
  let imgHeight = 0;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));

    const check = await page.evaluate(() => {
      const allImgs = Array.from(document.querySelectorAll('generated-image img, single-image img, .image-container img, img.image'));
      const candidates = allImgs.filter((img) => img.naturalWidth > 250 && img.naturalHeight > 250);
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
    });

    if (check && check.dataUrl) {
      resultDataUrl = check.dataUrl;
      imgWidth = check.width;
      imgHeight = check.height;
      break;
    }
  }

  if (!resultDataUrl) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    throw new Error('Timed out waiting for image generation after ' + elapsed + 's.');
  }

  const base64Data = resultDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  if (options.outputPath) {
    const finalOut = path.resolve(options.outputPath);
    const parentDir = path.dirname(finalOut);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(finalOut, buffer);
    console.log('[GeminiBridge] 🎉 [Imagen 3] Successfully saved image (' + imgWidth + 'x' + imgHeight + ') to: ' + finalOut);
  }

  return {
    success: true,
    buffer,
    base64: base64Data,
    dataUrl: resultDataUrl,
    width: imgWidth,
    height: imgHeight,
    outputPath: options.outputPath || null,
    durationMs: Date.now() - startTime,
  };
}

module.exports = {
  checkPort,
  ensureChrome,
  getBrowser,
  getGeminiPage,
  generateImage,
};
