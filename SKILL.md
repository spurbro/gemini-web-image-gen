---
name: gemini-web-image-gen
description: >-
  Standalone automated AI image generation engine (Text-to-Image and Image-to-Image) via Google Gemini Web
  (gemini.google.com / Imagen 3) using Chrome DevTools Protocol (CDP). Features long-term login session
  persistence, single-conversation context memory, dual-gated reference image attachment verification,
  and lossless canvas extraction. Completely portable and designed for direct invocation by any AI agent
  or test harness across any project without requiring external paid API keys.
---

# Gemini Web Standalone Image Generation Skill (通用独立生图技能)

本技能是一个 **100% 独立、可移植、跨 Agent 与跨测试框架（Test Harness）** 的自动化图像生成引擎。它通过 Chrome DevTools Protocol (CDP) 驱动本地 Chrome 浏览器调用 Google Gemini Web (Imagen 3)，实现零 API 成本、免 Key、工业级可靠的生图工作流。

---

## 🌟 核心特性与架构优势

1. **完全独立与零环境耦合**：
   - 零项目路径硬编码，所有路径均使用相对路径或环境变量动态解析；
   - 自包含脚本库与标准 CLI，任何 Agent 或 Harness 均可一键调用。
2. **全流程文生图 (T2I) 与图生图 (I2I)**：
   - 支持纯文本提示词生图；
   - 支持上传一张或多张参考图片（`--ref <path>`），引导模型进行连续动作、场景演进或画风继承。
3. **单一会话持久管理 (Persistent Single Session)**：
   - 支持通过 `--url <chat_url>` 复用指定会话，保持多轮交互上下文与角色特征连贯，避免滥开新标签页。
4. **双重门禁质检机制 (Dual-Gated Assertion)**：
   - **Gate 1（发送前附件门禁）**：强制校验输入框是否切实渲染出图片缩略图卡片（Attachment Chip），杜绝上传失败时的纯文本盲发降级；
   - **Gate 2（发送后消息门禁）**：强制审计用户消息气泡，确保服务端切实接收到了图片附件。
5. **纯净 Canvas Base64 提取**：
   - 绕过跨域 Blob URL 限制，从 DOM 原生提取全分辨率无损 PNG。

---

## 📁 目录结构

```
gemini-web-image-gen/
├── SKILL.md                         # 技能规范与 Agent 交互指南
├── README.md                        # 人类开发者与 Harness 快速指引
├── package.json                     # 独立依赖定义
├── scripts/
│   ├── gemini_bridge.js             # 核心 CDP 驱动与生图引擎 (Node.js Module)
│   ├── generate_single.js           # 单图生成 CLI 入口
│   ├── batch_generator.js           # 批量任务流生成器
│   └── launch_chrome.ps1            # Chrome 调试端口一键拉起脚本
└── examples/
    ├── tasks_example.json           # 批量配置示例
    ├── agent_integration.js         # 其他 Agent / Harness 编程调用示例
    └── bash_usage.sh                # Shell 常用命令配方
```

---

## 🚀 跨 Agent & Harness 调用规范

### 方式 1：通过 CLI 命令行调用（推荐任何 Agent 执行）

#### 1. 基础文生图 (Text-to-Image)
```bash
node "<path_to_skill>/scripts/generate_single.js" \
  --prompt "A cybernetic robotic tiger with glowing cyan stripes on dark studio background, 8k resolution" \
  --out "output/tiger.png"
```

#### 2. 图生图（Image-to-Image in Same Session）
```bash
node "<path_to_skill>/scripts/generate_single.js" \
  --url "https://gemini.google.com/app/<session_id>" \
  --ref "assets/initial_tiger.png" \
  --prompt "Based on the attached reference image, generate the tiger leaping forward in mid-air" \
  --out "assets/tiger_leap.png"
```

**参数清单**：
* `--prompt, -p`：生图提示词（必填，英文效果最佳）。
* `--out, -o`：目标输出图片路径（必填，自动递归创建父目录）。
* `--ref, -r`：（可选）参考图片文件路径，触发图生图流水线与双重门禁校验。
* `--url, -u`：（可选）指定已有的会话 URL，保持上下文记忆。
* `--timeout, -t`：（可选）超时毫秒数（默认 90000 即 90 秒）。

---

### 方式 2：作为 Node.js 模块在其他 Harness 中编程式调用

```javascript
const { generateImage } = require('./scripts/gemini_bridge.js');

async function run() {
  const result = await generateImage('A futuristic floating neon city, 8k', {
    referenceImagePath: './assets/reference.png', // 可选
    targetUrl: 'https://gemini.google.com/app/your-chat-id', // 可选
    outputPath: './output/neon_city.png',
    timeoutMs: 90000
  });

  console.log('Generated successfully:', result.outputPath);
  console.log('Image dimensions:', result.width, 'x', result.height);
}

run();
```

---

### 方式 3：批量任务流生成 (Batch Mode)

创建任务配置文件 `tasks.json`：
```json
[
  {
    "filename": "icon_attack.png",
    "prompt": "Pixel art sword slashing with golden trail on pure black background, 128x128"
  },
  {
    "filename": "icon_defend.png",
    "referenceImage": "assets/shield_base.png",
    "prompt": "Based on the attached reference, generate a glowing energy shield icon"
  }
]
```

执行批量运行：
```bash
node "<path_to_skill>/scripts/batch_generator.js" \
  --config tasks.json \
  --output-dir "output/icons/"
```

---

## 🔧 技术保障与自愈机制

1. **自动唤醒与端口守护**：
   - 脚本在执行任何生图前，会自动探针 `http://127.0.0.1:9222`；若浏览器未启动或崩溃，会自动通过本地安装的 Chrome 拉起独立 Profile（`~/.chrome-gemini-bridge`），实现永久免登。
2. **双重门禁质检 (Dual-Gated Hard Assertion)**：
   - **Gate 1**：在输入框内硬性断言图片附件 Chip 存在，彻底防止网络延迟或浮层未弹出导致的“纯文本盲发降级”；
   - **Gate 2**：在消息发出后审计用户气泡，确保服务端切实接收到了图片附件。
3. **原生 Canvas 高清 Base64 提取**：
   - 绕过 Chrome 对 Blob URL / CORS 的跨域拦截，直接利用 `canvas.getContext('2d').drawImage()` 提取全分辨率原始无损 PNG。
