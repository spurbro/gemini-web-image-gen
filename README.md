# Gemini Web Browser Image Generation Bridge (v2.0.0)

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg)]()
[![Gemini](https://img.shields.io/badge/channel-Google%20Gemini%20Web%20(Imagen%203)-orange.svg)]()

A standalone, pure browser automation bridge and execution channel for Google Gemini Web (Imagen 3) powered by Chrome DevTools Protocol (CDP). Designed as a universal, prompt-agnostic image generation channel for AI agents, test harnesses, and CLI tools.

[English Documentation](#-english) | [中文说明文档](#-中文)

---

<a name="-english"></a>
## 🇬🇧 English

### Overview
`gemini-web-image-gen` is an infrastructure-level browser automation bridge. It connects your code, AI agents, and test harnesses directly to Google Gemini Web (Imagen 3) using Chrome DevTools Protocol (CDP).

It operates as a **pure transparent channel**: it does not impose or modify prompt styles, allowing calling agents to freely define their own prompts while handling session persistence, file attachment integrity, and lossless image extraction.

### Key Features
- 🔌 **Pure Transparent Pass-Through**: Submits caller prompts exactly as received without alteration.
- 🛡️ **Dual-Gated Upload Integrity**:
  - **Gate 1 (Pre-Send)**: Asserts the image thumbnail card is mounted in the input area before text entry, preventing silent plain-text fallback.
  - **Gate 2 (Post-Send)**: Verifies the sent query bubble in DOM contains the image.
- 🧠 **Session Memory Retention**: Reuses conversation URLs (`--url`) across multi-turn workflows.
- 🖼️ **Lossless Canvas Extraction**: Extracts full-resolution PNG images directly from in-memory HTML5 Canvas, bypassing CORS and temporary Blob restrictions.
- 💻 **Zero Hardcoded Paths**: Fully portable across projects and operating systems.

### Quick Start (CLI)
```bash
# 1. Install dependencies
git clone https://github.com/spurbro/gemini-web-image-gen.git
cd gemini-web-image-gen
npm install

# 2. Launch Chrome Debugging Session (One-time login)
powershell -ExecutionPolicy Bypass -File scripts/launch_chrome.ps1

# 3. Text-to-Image (T2I)
node scripts/generate_single.js -p "Your custom prompt" -o "output/image.png"

# 4. Image-to-Image (I2I in Persistent Session)
node scripts/generate_single.js \
  -u "https://gemini.google.com/app/<session_id>" \
  -r "path/to/reference.png" \
  -p "Your continuation prompt" \
  -o "output/next.png"
```

### Programmatic Integration (Node.js)
```javascript
const { generateImage } = require('./scripts/gemini_bridge.js');

async function run() {
  const result = await generateImage('Your custom prompt', {
    referenceImagePath: './assets/ref.png',                  // Optional: for Img2Img
    targetUrl: 'https://gemini.google.com/app/your-chat-id', // Optional: keep same session
    outputPath: './output/result.png',
    timeoutMs: 90000
  });

  console.log('✓ Image saved at:', result.outputPath);
}

run();
```

---

<a name="-中文"></a>
## 🇨🇳 中文

### 概述
`gemini-web-image-gen` 是一个专为 AI Agent、自动化测试 Harness 与开发脚本打造的**纯生图通道驱动底座**。通过 Chrome DevTools Protocol (CDP) 驱动本地 Chrome 浏览器直接打通 Google Gemini Web (Imagen 3) 生图界面，提供免 API Key、高可靠的文生图与图生图通道。

本技能**定位为纯生图基础设施**，不绑定任何特定业务的提示词规则，由调用方自行把控提示词内容，底层专注于解决浏览器会话保持、上传门禁拦截以及无损图片提取等工程难题。

### 核心特性
- 🔌 **纯粹透明透传**：对调用方传入的提示词做 100% 原样提交，不做任何拼接或改写。
- 🛡️ **双重门禁质检 (Dual-Gated QA)**：
  - **Gate 1（发送前）**：硬性校验输入框内切实渲染出图片附件卡片，杜绝因上传未完成导致的“纯文本盲发降级”；
  - **Gate 2（发送后）**：审计 DOM 用户消息气泡，确保服务端切实接收到了参考图。
- 🧠 **会话上下文持久复用**：支持传入已有会话链接（`--url`），保持多轮交互画风与上下文连贯。
- 🖼️ **纯净 Canvas Base64 提取**：利用浏览器内存原生 Canvas 提取，彻底绕过跨域 Blob URL 限制与防盗链。
- 📦 **零写死路径**：完全动态解析用户环境，可在任何工作空间与项目中即插即用。

### 命令行快速调用 (CLI)
```bash
# 1. 基础文生图 (Text-to-Image)
node scripts/generate_single.js -p "你的任意提示词" -o "output/image.png"

# 2. 图生图（同一会话连续图生图）
node scripts/generate_single.js \
  -u "https://gemini.google.com/app/<session_id>" \
  -r "path/to/reference.png" \
  -p "你的接续提示词" \
  -o "output/next.png"
```

### 命令行参数详解

| 参数名 | 简写 | 说明 | 是否必填 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `--prompt` | `-p` | 生图描述提示词 | **必填** | - |
| `--out` | `-o` | 目标输出图片路径 (PNG) | **必填** | `output/generated_image.png` |
| `--ref` | `-r` | 图生图参考图片路径 | 选填 | `null` |
| `--url` | `-u` | 指定持久会话链接保持上下文 | 选填 | `null` (复用活跃/新建) |
| `--timeout`| `-t` | 生图超时毫秒数 | 选填 | `90000` (90秒) |

---

## 📁 目录结构

```
gemini-web-image-gen/
├── SKILL.md                         # 纯中文核心技能规范文档 (供 Agent 自动读取遵循)
├── README.md                        # 中英双语仓库指南 (Bilingual Documentation)
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

## 📄 许可证 (License)
MIT License.
