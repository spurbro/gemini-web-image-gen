# Troubleshooting & Self-Healing Guide (故障自愈与排查指南)

## 常见问题与自动化自愈方案

### 1. Error: connect ECONNREFUSED 127.0.0.1:9222
- **原因**：Chrome 远程调试进程未启动或意外终止。
- **自愈机制**：`gemini_bridge.js` 内置 `ensureChrome()`，会在探针端口失败后自动拉起专属 Profile（`~/.chrome-gemini-bridge`）。
- **手动解决**：运行 `powershell -File scripts/launch_chrome.ps1`。

### 2. Gate 1 Failed: Image thumbnail chip was NOT detected
- **原因**：网络延迟或 Angular CDK 浮层菜单动画延迟导致文件选择器未在超时内就绪。
- **保护机制**：脚本会自动抛出异常并阻断，绝对不会降级盲发纯文本。
- **解决办法**：重新执行，脚本会自动关闭多余遮罩并重试上传。

### 3. Canvas Extraction Returns Blank Image
- **原因**：图片未在 DOM 中完全加载解码。
- **解决机制**：脚本会轮询 `img.complete` 并验证 `naturalWidth > 250 && naturalHeight > 250` 后才触发 Canvas 绘制。
