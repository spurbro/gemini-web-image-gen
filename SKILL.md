---
name: gemini-web-image-gen
description: >-
  Standalone automated AI image generation engine (Text-to-Image and Image-to-Image) via Google Gemini Web
  (gemini.google.com / Imagen 3) using Chrome DevTools Protocol (CDP). Features long-term login session
  persistence, single-conversation context memory, dual-gated reference image attachment verification,
  and lossless canvas extraction. Fully bilingual (English & Chinese) and designed for direct invocation
  by any AI agent or test harness without requiring external paid API keys.
---

# Gemini Web Image Generation Skill | Gemini Web 自动化生图技能

[English Documentation](#english-specification) | [中文说明文档](#chinese-specification)

---

<a name="english-specification"></a>
## 🇬🇧 English Specification

### Overview
`gemini-web-image-gen` is a production-grade, project-agnostic autonomous image generation engine. It drives a local Chrome instance via Chrome DevTools Protocol (CDP) to interface directly with Google Gemini Web (Imagen 3). It eliminates paid API key costs, guarantees 100% genuine reference image attachment for Image-to-Image (Img2Img), maintains multi-turn conversation memory, and extracts lossless full-resolution PNG images via in-memory HTML5 Canvas.

### Core Capabilities
1. **Text-to-Image (T2I) & Image-to-Image (I2I)**: High-resolution visual synthesis with optional reference image guidance.
2. **Persistent Single-Session Management**: Maintains conversation thread (`--url <chat_url>`) across multiple turns to preserve visual style and character consistency.
3. **Dual-Gated Attachment Assertion**:
   - **Gate 1 (Pre-Send Assertion)**: Verifies the image thumbnail card is mounted inside Angular's input container before submitting text. Aborts on failure to prevent plain-text degradation.
   - **Gate 2 (Post-Send Assertion)**: Audits the sent message bubble in DOM to confirm the reference image was received.
4. **Lossless Canvas Base64 Extraction**: Draws the rendered image onto an in-memory HTML5 Canvas to bypass CORS, authentication, and Blob URL security policies.

### Workflow Pipeline
```mermaid
graph TD
    A["Launch / Connect Chrome (Port 9222, ~/.chrome-gemini-bridge)"] --> B["Navigate to Conversation URL"]
    B --> C{"Reference Image Provided?"}
    C -->|Yes (Img2Img)| D["Trigger '+' Menu -> FileChooser -> Select Image"]
    D --> E{"Gate 1: Attachment Chip Visible in Input?"}
    E -->|No: Abort & Retry| D
    E -->|Yes: Gate 1 Passed| F["Type Generation Prompt"]
    C -->|No (Text-to-Image)| F
    F --> G["Submit Message via Enter / Click Send"]
    G --> H{"Gate 2: Sent Query Contains Image?"}
    H -->|Verified| I["Poll DOM for Imagen 3 Generated Image"]
    I --> J["Extract Full-Res PNG via Canvas.toDataURL()"]
    J --> K["Save to Output File & Deliver"]
```

### CLI Usage for AI Agents
```bash
# 1. Text-to-Image
node "<skill_dir>/scripts/generate_single.js" \
  --prompt "A cybernetic futuristic panther in neon rain, 8k resolution" \
  --out "output/panther.png"

# 2. Image-to-Image (Maintaining same conversation)
node "<skill_dir>/scripts/generate_single.js" \
  --url "https://gemini.google.com/app/<session_id>" \
  --ref "assets/initial_pose.png" \
  --prompt "Based on the attached reference image, generate the character leaping into combat" \
  --out "output/leap_pose.png"
```

### Programmatic API (Node.js)
```javascript
const { generateImage } = require('./scripts/gemini_bridge.js');

async function run() {
  const result = await generateImage('A neon cyberpunk cityscape at sunset, 8k', {
    referenceImagePath: './assets/base_layout.png', // Optional for Img2Img
    targetUrl: 'https://gemini.google.com/app/your-chat-id', // Optional for session reuse
    outputPath: './output/cyber_city.png',
    timeoutMs: 90000
  });

  console.log('✓ Image saved:', result.outputPath);
  console.log('✓ Dimensions:', result.width, 'x', result.height);
}
```

---

<a name="chinese-specification"></a>
## 🇨🇳 中文说明文档

### 概述
`gemini-web-image-gen` 是一个工业级、完全项目无关的自动化 AI 图像生成引擎。它通过 Chrome DevTools Protocol (CDP) 驱动本地 Chrome 浏览器直接调用已登录的 Google Gemini Web (Imagen 3)。零 API 费用、免 Key，彻底杜绝图生图过程中的“纯文本降级”，支持多轮会话画风连续性，并通过浏览器原生 Canvas 读取无损全分辨率 PNG 落盘。

### 核心特性与技术亮点
1. **文生图 (T2I) 与图生图 (I2I) 全面支持**：支持纯文本渲染，或传入一张/多张参考图引导连贯动作、姿态与画风继承。
2. **单一会话持久管理 (Persistent Single Session)**：支持传入已有会话链接（`--url <chat_url>`），全程在同一会话中交互，避免滥开新标签页并保持上下文画风一致。
3. **双重门禁质检机制 (Dual-Gated Assertion)**：
   - **Gate 1（发送前门禁）**：触发 CDK 菜单上传图片后，强制校验输入框内部是否切实渲染出图片附件卡片（Attachment Chip）。若未检测到附件，立即阻断抛错，**严禁盲发纯文本**！
   - **Gate 2（发送后门禁）**：消息发出后自动审计用户消息气泡，确保服务端切实接收到了图片。
4. **纯净 Canvas Base64 提取**：利用浏览器内存 `HTML5 Canvas.toDataURL('image/png')`，完美绕过 Google Cloud 临时 Blob URL 的跨域安全策略与防盗链限制。

### 命令行快速调用 (CLI)
```bash
# 1. 基础文生图
node "<skill_dir>/scripts/generate_single.js" \
  --prompt "A futuristic glowing crystal cybernetic heart on a dark studio backdrop, 8k" \
  --out "output/cyber_heart.png"

# 2. 同一会话连续图生图
node "<skill_dir>/scripts/generate_single.js" \
  --url "https://gemini.google.com/app/<session_id>" \
  --ref "assets/stage1_keyframe.png" \
  --prompt "Based on the attached reference image, generate the pilot stepping into the cockpit" \
  --out "output/stage2.png"
```

### 批量任务流 (Batch Mode)
创建配置文件 `tasks.json`：
```json
[
  {
    "filename": "icon_attack.png",
    "prompt": "Pixel art sword slashing with glowing golden energy trail, 128x128"
  },
  {
    "filename": "icon_defend.png",
    "referenceImage": "assets/shield_base.png",
    "prompt": "Based on the attached reference image, generate an illuminated energy barrier"
  }
]
```
运行批量生成：
```bash
node "<skill_dir>/scripts/batch_generator.js" --config tasks.json --output-dir "output/icons/"
```
