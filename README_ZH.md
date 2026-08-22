# Gemini Web 浏览器自动化生图通道 (v2.0.0)

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg)]()
[![Gemini](https://img.shields.io/badge/channel-Google%20Gemini%20Web%20(Imagen%203)-orange.svg)]()

这是一个**完全独立、纯生图通道驱动底座**的开源技能包。通过 Chrome DevTools Protocol (CDP) 驱动本地 Chrome 浏览器直接打通 Google Gemini Web (Imagen 3) 生图界面，专为各类 AI Agent、测试框架（Test Harness）及脚本工具提供高可靠的生图通道。

[查看英文说明文档 (English Docs)](./README.md)

---

## 🌟 定位与核心原则

本仓库**定位为纯生图通道与浏览器自动化基础设施**，不绑定任何特定业务的提示词工程：
- 🔌 **纯粹透明透传**：调用方传入任何 Prompt 均原样提交，不掺杂任何特定业务提示词规则。
- 🛡️ **双重门禁质检 (Dual-Gated QA)**：
  - **Gate 1（发送前）**：硬性校验输入框内切实渲染出图片附件卡片，杜绝因上传未完成导致的“纯文本盲发降级”；
  - **Gate 2（发送后）**：审计 DOM 用户消息气泡，确保服务端切实接收到了参考图。
- 🧠 **会话上下文持久复用**：支持传入已有会话链接（`--url`），保持多轮交互画风与上下文连贯。
- 🖼️ **纯净 Canvas Base64 提取**：利用浏览器内存原生 Canvas 提取，彻底绕过跨域 Blob URL 限制与防盗链。
- 📦 **零写死路径**：完全动态解析用户环境，可在任何工作空间与项目中即插即用。

---

## 📁 目录结构

```
gemini-web-image-gen/
├── SKILL.md                         # 双语核心技能通道规范说明 (供 Agent 自动读取)
├── README.md                        # 英文通道使用指南
├── README_ZH.md                     # 中文通道使用指南
├── package.json                     # 独立 npm 依赖配置
├── scripts/
│   ├── gemini_bridge.js             # 核心 CDP 生图通道引擎 (Node.js 模块)
│   ├── generate_single.js           # 单图命令行生成工具 (T2I / I2I)
│   ├── batch_generator.js           # 任务流批量生成工具 (支持断点续传)
│   └── launch_chrome.ps1            # 远程调试端口 (9222) 独立 Chrome 实例拉起脚本
├── examples/
│   ├── agent_integration.js         # 其他 Agent / Harness 编程调用范例
│   └── tasks_example.json           # 批量任务 JSON 配置范例
└── references/
    └── troubleshooting.md           # 常见问题排查与端口/UI自愈手册
```

---

## 🚀 快速上手

### 1. 安装依赖
```bash
git clone https://github.com/spurbro/gemini-web-image-gen.git
cd gemini-web-image-gen
npm install
```

### 2. 启动 Chrome 调试实例（仅首次需要登录）
```powershell
powershell -ExecutionPolicy Bypass -File scripts/launch_chrome.ps1
```
*在打开的浏览器窗口中登录您的 Google 账号。登录态会自动永久保存在 `~/.chrome-gemini-bridge` 中。*

### 3. 命令行调用示例
```bash
# 基础文生图 (Text-to-Image)
node scripts/generate_single.js -p "你的任意提示词" -o "output/image.png"

# 图生图（同一会话连续图生图）
node scripts/generate_single.js \
  -u "https://gemini.google.com/app/<session_id>" \
  -r "path/to/reference.png" \
  -p "你的接续提示词" \
  -o "output/next.png"
```

---

## 🤖 编程集成 (Node.js)

```javascript
const { generateImage } = require('./scripts/gemini_bridge.js');

async function run() {
  const result = await generateImage('调用方自行决定的提示词', {
    referenceImagePath: './assets/ref.png', // 可选：图生图参考图
    targetUrl: 'https://gemini.google.com/app/your-chat-id', // 可选：会话 URL
    outputPath: './output/result.png',
    timeoutMs: 90000
  });

  console.log('✓ 生成完成:', result.outputPath);
}

run();
```

---

## 📄 许可证
MIT License。
