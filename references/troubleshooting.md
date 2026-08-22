# Troubleshooting & Self-Healing Guide (通道故障排查与自愈手册)

本手册涵盖 `gemini-web-image-gen` 浏览器生图通道在各类操作系统与自动化环境中的常见问题、排查方案及内置自愈机制。

---

## 1. 端口与浏览器连接问题 (Connection & Port)

### 现象 1：`Error: connect ECONNREFUSED 127.0.0.1:9222`
- **原因**：Chrome 远程调试端口未开启或进程崩溃。
- **自动自愈**：`gemini_bridge.js` 内置 `ensureChrome()`，会在检测到端口未响应时自动拉起 Chrome 并挂载独立用户目录（`~/.chrome-gemini-bridge`）。
- **手动排查**：
  - Windows: 运行 `powershell -ExecutionPolicy Bypass -File scripts/launch_chrome.ps1` 或 `node scripts/launch_chrome.js`；
  - macOS / Linux: 运行 `bash scripts/launch_chrome.sh` 或 `node scripts/launch_chrome.js`；
  - 检查环境变量 `CHROME_PATH` 是否指向正确的 Chrome 可执行文件。

### 现象 2：端口冲突（9222 端口已被其他程序占用）
- **解决方案**：通过环境变量自定义端口与独立 Profile 目录：
  ```bash
  # Linux / macOS
  export GEMINI_DEBUG_PORT=9333
  export GEMINI_USER_DATA_DIR="$HOME/.gemini-bridge-custom"

  # Windows (PowerShell)
  $env:GEMINI_DEBUG_PORT = 9333
  $env:GEMINI_USER_DATA_DIR = "C:\Users\YourUser\.gemini-bridge-custom"
  ```

---

## 2. 门禁质检拦截 (Dual-Gated QA Assertions)

### 现象 1：`❌ [GATE 1 FAILED] Image thumbnail chip was NOT detected in input box`
- **原因**：传入的参考图片在上传后，网络延迟或 Angular CDK 浮层菜单响应较慢，输入框在 12 秒内未挂载完成图片预览卡片。
- **安全保护**：通道会**立即主动阻断并报错**，绝对杜绝静默降级为“纯文本文生图”。
- **排查与解决**：
  1. 确认参考图片文件格式为标准 `.png`、`.jpg` 或 `.webp`，且未损坏；
  2. 确认当前会话没有处于正在生成的“停止响应（⏹️）”锁定状态；
  3. 脚本重试时会自动清理页面浮层并重新打开上传窗口。

### 现象 2：`⚠️ [GATE 2 Warning] User message bubble did not register image element`
- **原因**：消息已发送，但在设定超时内 DOM 用户气泡结构未刷新出 `<img>` 标签。
- **排查**：检查 `output/gate2_proof.png` 截图确认实际发送状态。

---

## 3. 图片提取与 Canvas 机制 (Canvas Extraction)

### 现象：图片提取超时或生成的图片为纯黑/纯白
- **原因**：Gemini 生成的大图在 DOM 中尚未完成解码就尝试进行 Canvas 绘制。
- **内置保障**：
  - 脚本严格轮询 `img.complete === true`；
  - 校验图片尺寸 `naturalWidth >= 250 && naturalHeight >= 250`；
  - 使用独立 HTML5 内存 Canvas 执行 `ctx.drawImage`，彻底绕过临时 Blob URL 的跨域拦截。

---

## 4. 账号登录与隐私安全 (Account & Security)

- **专用隔离 Profile**：浏览器用户数据保存在独立目录 `~/.chrome-gemini-bridge`，**绝不会自动复制或窃取您默认 Chrome 浏览器的任何 Cookies 或密码数据**。
- **首次登录**：首次使用时，只需在弹出的浏览器窗口中登录一次 Google 账号，会话将永久安全保存在该隔离 Profile 中。
