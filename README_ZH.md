# Gemini Web 通用生图引擎技能 (v2.0.0)

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg)]()
[![Gemini](https://img.shields.io/badge/powered%20by-Google%20Gemini%20Web%20(Imagen%203)-orange.svg)]()

这是一个 **100% 独立、跨平台、零 API 成本** 的自动化 AI 图像生成技能包。通过 Chrome DevTools Protocol (CDP) 驱动本地 Chrome 浏览器直接调用 Google Gemini Web (Imagen 3)，专为各类 AI Agent、自动化测试框架（Test Harness）及命令行脚本设计。

[查看英文说明文档 (English Docs)](./README.md)

---

## 🌟 核心优势与技术特色

- 💰 **零 API Key 费用**：直接复用本地 Gemini 网页端免登会话，零额外账单成本。
- 🎨 **文生图与图生图全能**：支持纯文字生图，以及传入一张或多张参考图的连续图生图。
- 🛡️ **双重门禁质检机制 (Dual-Gated QA)**：
  - **Gate 1（发送前）**：强制校验输入框内切实渲染出图片附件缩略卡片，杜绝因上传未完成导致的“纯文本盲发降级”；
  - **Gate 2（发送后）**：审计 DOM 用户气泡，确保服务端切实接收到参考图。
- 🧠 **单一会话持久上下文记忆**：支持指定已有的会话 URL（`--url`），保持多轮交互画风、光影与角色设定高度统一。
- 🖼️ **纯净 Canvas Base64 提取**：内存原生 Canvas 提取，彻底绕过跨域 Blob URL 限制与防盗链。
- 📦 **零项目耦合**：无任何写死路径，动态解析用户主目录，可在任何工作空间与项目中即插即用。

---

## 📁 目录结构说明

```
gemini-web-image-gen/
├── SKILL.md                         # 双语核心技能规范文档 (供 Agent 自动读取)
├── README.md                        # 英文开发者指南
├── README_ZH.md                     # 中文开发者指南
├── package.json                     # 独立 npm 依赖配置
├── scripts/
│   ├── gemini_bridge.js             # 核心 CDP 生图引擎驱动 (Node.js 模块)
│   ├── generate_single.js           # 单图命令行生成工具
│   ├── batch_generator.js           # 任务流批量生成工具 (支持断点续传)
│   └── launch_chrome.ps1            # 远程调试端口 (9222) Chrome 拉起脚本
├── examples/
│   ├── agent_integration.js         # 其他 Agent / Harness 编程调用范例
│   └── tasks_example.json           # 批量任务 JSON 配置范例
└── references/
    ├── prompt_guide.md              # Imagen 3 提示词工程与负面提示指南
    └── troubleshooting.md           # 常见问题排查与自愈手册
```

---

## 🚀 快速上手指南

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
*在打开的浏览器窗口中登录您的 Google 账号。登录态会自动永久保存在 `~/.chrome-gemini-bridge` 中，后续启动无需重复登录。*

### 3. 单张图片生成 (CLI)
```bash
# 基础文生图 (Text-to-Image)
node scripts/generate_single.js -p "A majestic cyberpunk dragon over Tokyo neon skyline, 8k" -o "output/dragon.png"

# 图生图（同一会话连续图生图）
node scripts/generate_single.js \
  -u "https://gemini.google.com/app/<session_id>" \
  -r "output/dragon.png" \
  -p "Based on the attached image, generate the dragon breathing blue cosmic flame" \
  -o "output/dragon_flame.png"
```

### 4. 命令行参数详解

| 参数名 | 简写 | 功能说明 | 是否必填 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `--prompt` | `-p` | 图像描述提示词（建议英文） | **必填** | - |
| `--out` | `-o` | 目标输出图片路径 (PNG) | **必填** | `output/generated_image.png` |
| `--ref` | `-r` | 图生图参考图片文件路径 | 选填 | `null` |
| `--url` | `-u` | 指定持久会话链接保持上下文 | 选填 | `null` (复用活跃/新建) |
| `--timeout`| `-t` | 生图超时时间 (毫秒) | 选填 | `90000` (90秒) |

---

## 🤖 在其他 Agent 或 Harness 中集成

```javascript
const { generateImage } = require('./scripts/gemini_bridge.js');

async function run() {
  const result = await generateImage('A cute red panda wearing astronaut suit, 8k', {
    referenceImagePath: './assets/panda_base.png', // 图生图参考图
    targetUrl: 'https://gemini.google.com/app/your-chat-id', // 会话 URL
    outputPath: './output/astronaut_panda.png',
    timeoutMs: 90000
  });

  console.log('✓ 生成成功，已保存至:', result.outputPath);
}

run();
```

---

## 📄 开源许可证
MIT License。允许自由用于个人、商业及科研项目。
