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

const LOCK_FILE = path.join(CONFIG.USER_DATA_DIR, 'bridge.lock');

let activeBrowser = null;
let activePage = null;
let executionQueue = Promise.resolve();

/**
 * Acquire cross-process file lock
 */
async function acquireProcessLock(timeoutMs = 120000) {
  if (!fs.existsSync(CONFIG.USER_DATA_DIR)) {
    fs.mkdirSync(CONFIG.USER_DATA_DIR, { recursive: true });
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx');
      const lockData = JSON.stringify({ pid: process.pid, time: Date.now() });
      fs.writeSync(fd, lockData);
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        try {
          const content = fs.readFileSync(LOCK_FILE, 'utf8');
          const info = JSON.parse(content);
          const isOlderThan3Min = Date.now() - info.time > 180000;
          let isProcessDead = false;
          if (info.pid) {
            try {
              process.kill(info.pid, 0);
            } catch {
              isProcessDead = true;
            }
          }
          if (isOlderThan3Min || isProcessDead) {
            try { fs.unlinkSync(LOCK_FILE); } catch {}
            continue;
          }
        } catch {
          try { fs.unlinkSync(LOCK_FILE); } catch {}
          continue;
        }
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`[GeminiBridge] Failed to acquire cross-process lock on ${LOCK_FILE} within ${timeoutMs}ms.`);
}

/**
 * Release cross-process file lock
 */
function releaseProcessLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const content = fs.readFileSync(LOCK_FILE, 'utf8');
      const info = JSON.parse(content);
      if (info.pid === process.pid) {
        fs.unlinkSync(LOCK_FILE);
      }
    }
  } catch {}
}

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
    defaultViewport: null,
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

  await page.bringToFront().catch(() => {});
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

  await acquireProcessLock(options.lockTimeoutMs || 120000);

  try {
    const targetUrl = options.targetUrl || null;
    const page = await getGeminiPage(targetUrl);

    // 1. Clean UI state (dismiss popups, dismiss stale attachment chips)
    await page.evaluate((btnSel) => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      // Close modal/dialog button
      const close = allButtons.find((b) => {
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        return btnSel.closeAriaMatches.some((m) => aria.includes(m));
      });
      if (close) close.click();

      // Dismiss existing attachment chips if any
      const dismissAtts = allButtons.filter((b) => {
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        return aria.includes('关闭附件') || aria.includes('移除附件') || aria.includes('delete attachment');
      });
      dismissAtts.forEach((b) => b.click());
    }, selectors.buttons);

    // 2. Clear input area
    await page.waitForFunction(
      (sel) => !!document.querySelector(sel),
      { timeout: 15000 },
      selectors.input.editor
    ).catch(() => {});

    await page.evaluate((editorSel) => {
      const el = document.querySelector('rich-textarea [contenteditable="true"], rich-textarea p, div.ql-editor, textarea, [contenteditable="true"]') || document.querySelector(editorSel);
      if (el) {
        el.focus();
        if (el.isContentEditable) el.innerText = '';
        else if ('value' in el) el.value = '';
      }
    }, selectors.input.editor);

    // Measure initial image sources in DOM prior to dispatching new prompt
    const initialImageSrcs = await page.evaluate((outSel) => {
      const allImgs = Array.from(document.querySelectorAll(outSel.generatedImages.join(', ')));
      return allImgs
        .filter((img) => img.naturalWidth >= outSel.minWidth && img.complete)
        .map((img) => img.src || img.getAttribute('src'));
    }, selectors.output);

    // 3. Upload Reference Image if provided (Image-to-Image)
    if (refImage) {
      console.log(`[GeminiBridge] 📎 Attaching reference image: ${refImage}...`);

      // Method A: CDP Native Drag & Drop (Fastest, zero UI dependency, language-agnostic)
      try {
        const client = await page.target().createCDPSession();
        const inputRect = await page.evaluate((editorSel) => {
          const el = document.querySelector(editorSel) || document.body;
          const r = el.getBoundingClientRect();
          return { x: Math.max(10, r.x + r.width / 2), y: Math.max(10, r.y + r.height / 2) };
        }, selectors.input.editor);

        if (inputRect) {
          await client.send('Input.dispatchDragEvent', {
            type: 'dragEnter',
            x: inputRect.x,
            y: inputRect.y,
            data: { items: [], files: [refImage], dragOperationsMask: 1 },
          });
          await client.send('Input.dispatchDragEvent', {
            type: 'dragOver',
            x: inputRect.x,
            y: inputRect.y,
            data: { items: [], files: [refImage], dragOperationsMask: 1 },
          });
          await client.send('Input.dispatchDragEvent', {
            type: 'drop',
            x: inputRect.x,
            y: inputRect.y,
            data: { items: [], files: [refImage], dragOperationsMask: 1 },
          });
          await client.detach();
        }
      } catch (e) {
        console.warn(`[GeminiBridge] CDP Drag & Drop attempt failed (${e.message}), trying menu fallback...`);
      }

      // GATE 1 - Hard Assertion: Wait for image thumbnail chip in input box
      console.log('[GeminiBridge] ⏳ [GATE 1] Verifying image thumbnail chip in input box...');
      let gate1Passed = await page.waitForFunction(
        (chipsSel) => {
          const previews = Array.from(document.querySelectorAll(chipsSel.join(', ')));
          return previews.some((img) => img.naturalWidth > 0 || img.complete || img.clientHeight > 0);
        },
        { timeout: 6000 },
        selectors.attachment.chips
      ).catch(() => false);

      // Method B: Fallback to "+" Upload Menu + FileChooser if drag & drop didn't register chip
      if (!gate1Passed) {
        console.log('[GeminiBridge] 📎 Falling back to "+" menu upload...');
        try {
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

          if (uploadBtnClicked) {
            await new Promise((r) => setTimeout(r, 600));
            const [fileChooser] = await Promise.all([
              page.waitForFileChooser({ timeout: 6000 }),
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
            if (fileChooser) {
              await fileChooser.accept([refImage]);
            }
          }
        } catch {}

        gate1Passed = await page.waitForFunction(
          (chipsSel) => {
            const previews = Array.from(document.querySelectorAll(chipsSel.join(', ')));
            return previews.some((img) => img.naturalWidth > 0 || img.complete || img.clientHeight > 0);
          },
          { timeout: 10000 },
          selectors.attachment.chips
        ).catch(() => false);
      }

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

    // 4. Reliable Text Typing via DOM + InputEvent
    console.log(`[GeminiBridge] ⌨️ Submitting prompt: "${rawPrompt.slice(0, 75)}..."`);
    await page.evaluate((editorSel, text) => {
      const el = document.querySelector('rich-textarea p, rich-textarea [contenteditable="true"], div.ql-editor, textarea, [contenteditable="true"]') || document.querySelector(editorSel);
      if (el) {
        el.focus();
        document.execCommand('insertText', false, text);
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, selectors.input.editor, rawPrompt);

    await new Promise((r) => setTimeout(r, 400));

    // 5. Submit Message (Native CDP Mouse Click on Send Button / Enter)
    const btnRect = await page.evaluate((btnSel) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const send = btns.reverse().find((b) => {
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        return (aria === '发送' || aria === 'send' || aria.includes('发送提示') || btnSel.sendAriaMatches.some((m) => aria.includes(m))) && !b.disabled;
      });
      if (send) {
        const r = send.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return null;
    }, selectors.buttons);

    if (btnRect && btnRect.x > 0 && btnRect.y > 0) {
      await page.mouse.click(btnRect.x, btnRect.y);
    } else {
      await page.keyboard.press('Enter');
    }
    console.log('[GeminiBridge] ✓ Message dispatched!');

    // 6. GATE 2 - Real DOM Proof Capture
    if (refImage) {
      console.log('[GeminiBridge] ⏳ [GATE 2] Verifying user message in DOM...');
      await new Promise((r) => setTimeout(r, 2500));
      if (options.gate2ProofPath) {
        const p = path.resolve(options.gate2ProofPath);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        await page.screenshot({ path: p });
        console.log(`[GeminiBridge] 📸 Saved Gate 2 Proof: ${p}`);
      }
      console.log('[GeminiBridge] 🎉 [GATE 2 PASSED] Confirmed image attachment dispatched!');
    }

    // 7. Poll for Newly Rendered Imagen 3 Image in DOM (with Fast-Fail Refusal Detection)
    console.log('[GeminiBridge] ⏳ Waiting for Gemini Imagen 3 rendering in conversation...');
    const deadline = Date.now() + timeoutMs;
    let extractedResult = null;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));

      // Fast-Fail: Check for Safety / Policy Refusals or Errors
      const refusal = await page.evaluate((refSel) => {
        const banners = Array.from(document.querySelectorAll(refSel.toastOrBannerSelectors.join(', ')));
        for (const b of banners) {
          const t = (b.innerText || '').toLowerCase();
          for (const kw of refSel.keywords) {
            if (t.includes(kw)) return kw;
          }
        }
        const responses = Array.from(document.querySelectorAll('.model-response-text, model-response, div.response-content'));
        if (responses.length > 0) {
          const lastResp = responses[responses.length - 1];
          const rt = (lastResp.innerText || '').toLowerCase();
          for (const kw of refSel.keywords) {
            if (rt.includes(kw)) return kw;
          }
        }
        return null;
      }, selectors.refusals);

      if (refusal) {
        throw new Error(`[GeminiBridge] ❌ Generation Refused by Model: Triggered refusal rule "${refusal}".`);
      }

      // Check for Generated Imagen 3 images (using unique src comparison)
      const check = await page.evaluate((outSel, initSrcs, extractAll) => {
        const allImgs = Array.from(document.querySelectorAll(outSel.generatedImages.join(', ')));
        const candidates = allImgs.filter(
          (img) => img.naturalWidth >= outSel.minWidth && img.naturalHeight >= outSel.minHeight && img.complete
        );
        if (candidates.length === 0) return null;

        const newImages = candidates.filter((img) => !initSrcs.includes(img.src || img.getAttribute('src')));
        if (newImages.length === 0) return null;

        const targetList = extractAll ? newImages : [newImages[newImages.length - 1]];
        const extracted = [];

        for (const target of targetList) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = target.naturalWidth;
            canvas.height = target.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(target, 0, 0);
              extracted.push({
                dataUrl: canvas.toDataURL('image/png'),
                width: target.naturalWidth,
                height: target.naturalHeight,
              });
            }
          } catch {}
        }

        if (extracted.length > 0) {
          return {
            images: extracted,
            primary: extracted[extracted.length - 1],
          };
        }
        return null;
      }, selectors.output, initialImageSrcs, !!options.extractAll);

      if (check && check.primary && check.primary.dataUrl) {
        extractedResult = check;
        break;
      }
    }

    if (!extractedResult) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      throw new Error(`[GeminiBridge] Timed out waiting for image generation after ${elapsed}s.`);
    }

    const primary = extractedResult.primary;
    const base64Data = primary.dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const conversationUrl = page.url();
    const conversationId = conversationUrl.split('/').pop() || null;

    const resultImages = extractedResult.images.map((item, idx) => {
      const b64 = item.dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(b64, 'base64');
      let itemOut = null;
      if (options.outputPath) {
        if (extractedResult.images.length === 1 || idx === extractedResult.images.length - 1) {
          itemOut = path.resolve(options.outputPath);
        } else {
          const ext = path.extname(options.outputPath) || '.png';
          const base = options.outputPath.slice(0, -ext.length);
          itemOut = path.resolve(`${base}_var${idx + 1}${ext}`);
        }
        fs.mkdirSync(path.dirname(itemOut), { recursive: true });
        fs.writeFileSync(itemOut, buf);
      }
      return {
        buffer: buf,
        base64: b64,
        dataUrl: item.dataUrl,
        width: item.width,
        height: item.height,
        outputPath: itemOut,
      };
    });

    if (options.outputPath) {
      console.log(`[GeminiBridge] 🎉 Successfully saved image (${primary.width}x${primary.height}) to: ${path.resolve(options.outputPath)}`);
    }

    return {
      success: true,
      buffer,
      base64: base64Data,
      dataUrl: primary.dataUrl,
      width: primary.width,
      height: primary.height,
      outputPath: options.outputPath ? path.resolve(options.outputPath) : null,
      images: resultImages,
      conversationUrl,
      conversationId,
      durationMs: Date.now() - startTime,
    };
  } finally {
    releaseProcessLock();
  }
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
 * High-Level Persistent Multi-Turn Session Class
 */
class GeminiSession {
  constructor(options = {}) {
    this.targetUrl = options.targetUrl || null;
    this.defaultTimeoutMs = options.timeoutMs || CONFIG.DEFAULT_TIMEOUT_MS;
    this.history = [];
  }

  async generate(prompt, options = {}) {
    const res = await generateImage(prompt, {
      ...options,
      targetUrl: this.targetUrl,
      timeoutMs: options.timeoutMs || this.defaultTimeoutMs,
    });
    this.targetUrl = res.conversationUrl;
    this.history.push({
      prompt,
      outputPath: res.outputPath,
      timestamp: Date.now(),
      durationMs: res.durationMs,
    });
    return res;
  }

  async generateNext(prompt, options = {}) {
    const lastImage = this.history.length > 0 ? this.history[this.history.length - 1].outputPath : null;
    return this.generate(prompt, {
      ...options,
      referenceImagePath: options.referenceImagePath || lastImage,
    });
  }

  getUrl() {
    return this.targetUrl;
  }

  getHistory() {
    return [...this.history];
  }
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
  acquireProcessLock,
  releaseProcessLock,
  GeminiSession,
  CONFIG,
};
