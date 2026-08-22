---
name: gemini-web-image-gen
description: >-
  Google Gemini Web (Imagen 3) 浏览器自动化生图通道技能。基于 Chrome DevTools Protocol (CDP)，
  提供独立浏览器会话托管、透明提示词透传、双重门禁参考图附件上传校验、会话持久复用以及内存 Canvas
  无损图片提取能力。专为各类 AI Agent、自动化测试 Harness 与开发脚本设计的通用生图基础设施。
---

# Gemini Web 浏览器自动化生图通道技能 (gemini-web-image-gen)

本技能是一个**纯粹的浏览器自动化生图通道与底层驱动底座**。它通过 Chrome DevTools Protocol (CDP) 驱动本地 Chrome 浏览器直接打通 Google Gemini Web (Imagen 3) 生图界面，为各类 AI Agent、自动化测试 Harness 及开发脚本提供免 API Key、高可靠的文生图与图生图通道。

---

## 🎯 核心架构与设计原则

1. **纯粹透明透传（与业务提示词解耦）**：
   - 本技能**不包含任何特定业务的提示词工程**。不同项目、不同需求的提示词由调用方 Agent 自行把控，本技能仅作为高可靠的“执行通道”，对提示词做 100% 原样透明透传。
2. **跨平台自动探测与环境安全**：
   - 自动探测 Windows、macOS 及 Linux 系统下的 Chrome 安装路径（支持环境变量 `CHROME_PATH` 覆盖）；
   - 使用独立专属用户目录（`~/.chrome-gemini-bridge`），**绝不自动复制用户的默认 Cookie/密码数据**，兼顾长期免登与隐私安全。
3. **双重门禁质检机制 (Dual-Gated Hard Assertion)**：
   - **Gate 1（发送前附件门禁）**：触发上传菜单后，硬性检测输入框内部是否切实渲染出图片附件缩略卡片（Attachment Chip）。若未检测到附件，立即阻断抛错，**绝对杜绝因上传延迟导致的“纯文本盲发降级”**；
   - **Gate 2（发送后消息门禁）**：消息发出后使用 DOM 轮询审计用户消息气泡，确保服务端切实接收到了图片。
4. **严格参数校验 (Strict Parameter Validation)**：
   - 传入的参考图片路径若在磁盘中不存在，**立即抛出致命错误并终止流程**，严禁静默回退为文生图；
   - 对 `timeoutMs`、Prompt 格式等均进行严密校验。
5. **并发安全与互斥队列 (Mutex Serialized)**：
   - 内置异步任务排队队列，多任务并发调用时自动串行化执行，杜绝在同一浏览器页面中发生输入冲突。
6. **内存原生 Canvas Base64 无损提取**：
   - 绕过 Chrome 对临时 Blob URL 的跨域安全限制与防盗链机制，直接利用 `HTML5 Canvas.toDataURL('image/png')` 从 DOM 提取全分辨率原始 PNG 数据流落盘。

---

## 🔄 通道执行流程图

```mermaid
graph TD
    A["调用方 Agent 传入: Prompt, 参考图路径?, 会话URL?, 输出路径"] --> B["探针 / 自动唤醒 Chrome (Port 9222, ~/.chrome-gemini-bridge)"]
    B --> C["导航至目标会话 URL / 保持同一对话"]
    C --> D{"是否传入参考图 (Img2Img)？"}
    D -->|是: 严格校验文件存在| E["触发 '+' 菜单 -> FileChooser 上传参考图"]
    E --> F{"Gate 1: 输入框是否出现图片卡片？"}
    F -->|否: 阻断抛错并重试| E
    F -->|是: 门禁通过| G["输入调用方传入的原样 Prompt"]
    D -->|否 (文生图)| G
    G --> H["提交消息并触发发送 (Enter / Send Button)"]
    H --> I{"Gate 2: 用户消息气泡是否包含图片？"}
    I -->|DOM 校验通过| J["轮询 DOM 中新渲染的 Imagen 3 大图元素"]
    J --> K["通过内存 HTML5 Canvas 提取无损 PNG 数据"]
    K --> L["写入目标文件并返回结果对象给调用方"]
```

---

## 💻 命令行调用规范 (CLI)

### 1. 基础文生图 (Text-to-Image)
```bash
node "<skill_path>/scripts/generate_single.js" \
  --prompt "你的任意生图提示词" \
  --out "output/target_image.png"
```

### 2. 图生图（指定会话与参考图）
```bash
node "<skill_path>/scripts/generate_single.js" \
  --url "https://gemini.google.com/app/<session_id>" \
  --ref "path/to/reference_image.png" \
  --prompt "基于参考图的接续生图提示词" \
  --out "output/next_stage.png"
```

### 📋 命令行参数清单

| 参数名 | 简写 | 说明 | 是否必填 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `--prompt` | `-p` | 调用方指定的生图提示词文本 | **必填** | - |
| `--out` | `-o` | 输出 PNG 图片文件路径（自动递归创建父目录） | **必填** | `output/generated_image.png` |
| `--ref` | `-r` | 图生图参考图片路径（严格校验存在性，触发双重门禁） | 选填 | `null` |
| `--url` | `-u` | 持久会话链接（保持多轮对话上下文） | 选填 | `null` (复用活跃/新建) |
| `--timeout`| `-t` | 生图超时毫秒数（正整数） | 选填 | `90000` (90秒) |

---

## 🤖 编程式调用 (Node.js API)

任何 AI Agent、测试 Harness 或自动化脚本均可直接引入模块调用：

```javascript
const { generateImage, closeBrowser } = require('./scripts/gemini_bridge.js');

async function run() {
  try {
    const result = await generateImage('你的提示词文本', {
      referenceImagePath: './assets/ref.png',                  // 可选：图生图参考图
      targetUrl: 'https://gemini.google.com/app/your-chat-id', // 可选：指定会话保持上下文
      outputPath: './output/result.png',                       // 输出路径
      timeoutMs: 90000                                         // 超时时间
    });

    // 返回对象结构:
    // {
    //   success: true,
    //   buffer: Buffer,
    //   width: 1024,
    //   height: 1024,
    //   outputPath: './output/result.png',
    //   durationMs: 13500
    // }
    console.log('✓ 生成成功，尺寸:', result.width, 'x', result.height);
  } finally {
    // 可选：在任务结束时释放连接
    await closeBrowser();
  }
}

run();
```

---

## 🛡️ 异常处理与自愈机制

1. **端口连接被拒 (ECONNREFUSED 9222)**：
   - 驱动内置 `ensureChrome()`，探针失败后自动以独立 Profile 拉起 Chrome，无需人工干预。
2. **Gate 1 门禁拦截 (未检测到图片附件)**：
   - 上传超时或菜单异常时立即阻断，严禁降级为纯文本发送，保障图生图 100% 真实执行。
3. **Canvas 提取防空白保护**：
   - 严格等待 DOM 图片 `img.complete` 且 `naturalWidth >= 250 && naturalHeight >= 250` 校验通过后再执行绘制提取。
