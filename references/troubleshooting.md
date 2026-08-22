# Troubleshooting & Self-Healing Guide (通道故障诊断与自愈手册)

## 常见问题与自动化处理机制

### 1. 端口连接被拒 (Error: connect ECONNREFUSED 127.0.0.1:9222)
- **原因**：Chrome 远程调试进程未启动或意外关闭。
- **通道自愈**：`gemini_bridge.js` 内置 `ensureChrome()`，会在探针端口失败后自动拉起专属 Profile（`~/.chrome-gemini-bridge`）。
- **手动启动**：执行 `powershell -File scripts/launch_chrome.ps1`。

### 2. Gate 1 门禁拦截 (Image thumbnail chip was NOT detected)
- **原因**：网络延迟或 Angular CDK 浮层菜单动画延迟导致文件选择器未在超时内就绪。
- **通道保护**：脚本会自动抛出异常并阻断，绝对不会降级盲发纯文本。
- **解决机制**：重试时脚本会自动清理页面残留弹层与输入框。

### 3. Canvas 提取空白图像 (Blank Image Prevention)
- **原因**：生成的图片在 DOM 中尚未完成解码。
- **通道保障**：脚本会轮询 `img.complete` 并验证 `naturalWidth > 250 && naturalHeight > 250` 后才触发 Canvas 绘制。
