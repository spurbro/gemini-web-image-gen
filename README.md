# Gemini Imagen CDP Bridge (v2.2.0)

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg)]()
[![Gemini](https://img.shields.io/badge/channel-Google%20Gemini%20Web%20(Imagen%203)-orange.svg)]()

A standalone, high-performance browser automation bridge and execution driver for Google Gemini Web (Imagen 3) powered by Chrome DevTools Protocol (CDP). Designed as a universal, prompt-agnostic image generation engine for AI agents, test harnesses, and CLI toolchains.

[English Documentation](#-english) | [中文说明文档](#-中文)

---

<a name="-english"></a>
## 🇬🇧 English

### Overview
`gemini-imagen-cdp-bridge` is an infrastructure-level browser automation bridge. It connects your code, AI agents, and CLI toolchains directly to Google Gemini Web (Imagen 3) using Chrome DevTools Protocol (CDP).

It operates as a **pure transparent channel**: it does not impose or alter prompt styles, allowing calling agents to freely define their own prompts while handling session persistence, multi-turn chaining, cross-process mutex locking, file attachment integrity, and lossless image extraction.

### Key Features
- 🔌 **Pure Transparent Pass-Through**: Submits caller prompts exactly as received without alteration.
- 🔒 **Cross-Process Mutex Lock**: Automatic file locking (`~/.chrome-gemini-bridge/bridge.lock`) with stale-PID recovery for concurrent CLI/agent safety.
- ⚡ **Fast-Fail Safety Refusal Sniffer**: Real-time sniffer detects model policy refusals instantly, terminating without waiting for full timeout.
- 🔗 **`GeminiSession` Multi-Turn Chaining**: High-level session class that automatically maintains conversation URLs and simplifies sequential generation (`session.generateNext()`).
- 🛡️ **Dual-Gated Upload Integrity**:
  - **Gate 1 (Pre-Send)**: Asserts the image thumbnail card is mounted in the input area before text entry, preventing silent plain-text fallback.
  - **Gate 2 (Post-Send)**: Verifies the sent query bubble in DOM contains the image attachment.
- 🖼️ **Multi-Variation & Lossless Extraction**: Supports extracting all image variations (`--all`), with 3-tier lossless extraction bypassing CORS and temporary Blob restrictions.
- 💻 **Zero Hardcoded Paths**: Fully portable across Windows, macOS, and Linux.

### Quick Start (CLI)
```bash
# 1. Install dependencies
git clone https://github.com/spurbro/gemini-web-image-gen.git
cd gemini-web-image-gen
npm install

# 2. Text-to-Image (T2I)
node scripts/generate_single.js -p "A cute pixel art cat wearing sunglasses" -o "output/cat.png"

# 3. Image-to-Image (I2I in Persistent Session)
node scripts/generate_single.js \
  -u "https://gemini.google.com/app/<session_id>" \
  -r "output/cat.png" \
  -p "Based on this cat, make it skateboard joyfully" \
  -o "output/cat_skateboard.png"

# 4. Extract All Candidate Variations
node scripts/generate_single.js -p "Pixel art wizard casting spells" -o "output/wizard.png" --all
```

### Programmatic Integration (Node.js)
```javascript
const { GeminiSession, generateImage } = require('./scripts/gemini_bridge.js');

// Multi-turn chaining example
async function run() {
  const session = new GeminiSession();

  // Turn 1
  const turn1 = await session.generate('A cute pixel art golden retriever dog, 16 bit sprite', {
    outputPath: './output/dog.png'
  });

  // Turn 2: Automatic session reuse and reference chaining
  const turn2 = await session.generateNext('Based on this dog, make it jump joyfully', {
    referenceImagePath: turn1.outputPath,
    outputPath: './output/dog_jump.png'
  });

  console.log('Session URL:', session.getUrl());
}
run();
```

---

<a name="-中文"></a>
## 🇨🇳 中文

### 概述
`gemini-imagen-cdp-bridge` 是一个专为 AI Agent、自动化测试 Harness 与开发脚本打造的**纯生图通道驱动底座**。通过 Chrome DevTools Protocol (CDP) 驱动本地 Chrome 浏览器直接打通 Google Gemini Web (Imagen 3) 生图界面，提供免 API Key、高可靠的文生图与图生图通道。

本驱动**定位为纯生图基础设施**，不绑定任何特定业务的提示词规则，由调用方自行把控提示词内容，底层专注于解决跨进程互斥锁、会话链式保持、上传门禁拦截、Fast-Fail 拒答嗅探以及无损图片提取等工程难题。

### 核心特性
- 🔌 **纯粹透明透传**：对调用方传入的提示词做 100% 原样提交，不做任何拼接或改写。
- 🔒 **跨进程互斥文件锁**：基于 `~/.chrome-gemini-bridge/bridge.lock` 物理排他锁与死锁自愈机制，支持多进程 / 多 Agent 安全排队调用。
- ⚡ **Fast-Fail 拒答即刻中断**：毫秒级嗅探模型安全策略拒答，遭遇 Policy Block 立即结构化退出，杜绝无谓超时等待。
- 🔗 **`GeminiSession` 多轮链式推理**：内置面向对象会话管理器，自动追踪 `conversationUrl` 与历史，无缝进行连续多轮生图（`session.generateNext()`）。
- 🛡️ **双重门禁质检 (Dual-Gated QA)**：
  - **Gate 1（发送前）**：硬性校验输入框内切实渲染出图片附件卡片，杜绝因上传未完成导致的“纯文本盲发降级”；
  - **Gate 2（发送后）**：审计 DOM 用户消息气泡，确保服务端切实接收到了参考图。
- 🖼️ **多候选变体提取与无损抓取**：支持 `--all` 提取全部候选图片变体，内存 Canvas / CDP 抓取完全规避 CORS 污染与防盗链。
- 📦 **零写死路径**：完全动态解析用户环境，在 Windows、macOS 与 Linux 上即插即用。

### 命令行参数详解

| 参数名 | 简写 | 说明 | 是否必填 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `--prompt` | `-p` | 生图描述提示词 | **必填** | - |
| `--out` | `-o` | 目标输出图片路径 (PNG) | **必填** | `output/generated_image.png` |
| `--ref` | `-r` | 图生图参考图片路径 | 选填 | `null` |
| `--url` | `-u` | 指定持久会话链接保持上下文 | 选填 | `null` (复用活跃/新建) |
| `--all` | `-a` | 提取所有生成的候选图片变体 | 选填 | `false` |
| `--timeout`| `-t` | 生图超时毫秒数 | 选填 | `90000` (90秒) |

---

## 📁 目录结构

```
gemini-imagen-cdp-bridge/
├── SKILL.md                         # 核心技能规范文档 (供 Agent 自动读取遵循)
├── README.md                        # 中英双语仓库指南 (Bilingual Documentation)
├── package.json                     # 独立 npm 依赖配置与 CLI 命令映射
├── scripts/
│   ├── gemini_bridge.js             # 核心 CDP 生图引擎 & GeminiSession 会话类
│   ├── selectors.js                 # 动态选择器与 Fast-Fail 拒答特征库
│   ├── generate_single.js           # 单图命令行生成工具 (T2I / I2I / --all)
│   ├── batch_generator.js           # 任务流批量生成工具 (支持链式会话与断点续传)
│   └── launch_chrome.ps1            # 远程调试端口 (9222) 独立 Chrome 实例拉起脚本
├── tests/
│   └── test_bridge.js               # 8 项全覆盖单元测试套件
├── examples/
│   ├── agent_integration.js         # 其他 Agent / Harness 编程调用范例
│   └── tasks_example.json           # 批量任务 JSON 配置范例
└── references/
    └── troubleshooting.md           # 常见问题排查与端口/UI自愈手册
```

---

## 📄 许可证 (License)
MIT License.

