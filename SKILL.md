---
name: gemini-imagen-cdp-bridge
description: >-
  Google Gemini Web (Imagen 3) 浏览器自动化生图桥接驱动。基于 Chrome DevTools Protocol (CDP)，
  提供独立浏览器会话托管、透明提示词透传、双重门禁参考图附件上传校验、GeminiSession 多轮会话链式推理、跨进程文件锁 (bridge.lock)、
  Fast-Fail 安全拒答嗅探以及全分辨率多候选变体提取能力。专为各类 AI Agent、自动化测试 Harness 与开发脚本设计的通用生图基础设施。
---

# Gemini Imagen CDP Bridge (gemini-imagen-cdp-bridge)

本技能是一个**纯粹的浏览器自动化生图通道与底层驱动底座**。它通过 Chrome DevTools Protocol (CDP) 驱动本地 Chrome 浏览器直接打通 Google Gemini Web (Imagen 3) 生图界面，为各类 AI Agent、自动化测试 Harness 及开发脚本提供免 API Key、高可靠的文生图与图生图通道。

---

## 🎯 核心架构与设计原则

1. **纯粹透明透传（与业务提示词解耦）**：
   - 本技能**不包含任何特定业务的提示词工程**。不同项目、不同需求的提示词由调用方 Agent 自行把控，本技能仅作为高可靠的“执行通道”，对提示词做 100% 原样透明透传。
2. **跨平台自动探测与环境安全**：
   - 自动探测 Windows、macOS 及 Linux 系统下的 Chrome 安装路径（支持环境变量 `CHROME_PATH` 覆盖）；
   - 使用独立专属用户目录（`~/.chrome-gemini-bridge`），**绝不自动复制用户的默认 Cookie/密码数据**，兼顾长期免登与隐私安全。
3. **跨进程互斥文件锁 (Cross-Process Mutex Lock)**：
   - 引入 `~/.chrome-gemini-bridge/bridge.lock` 物理文件排他锁与自愈嗅探机制，跨 CLI 进程及多 Agent 实例并发调用时自动排队，杜绝输入流竞争与焦点错乱。
4. **双重门禁质检机制 (Dual-Gated Hard Assertion)**：
   - **Gate 1（发送前附件门禁）**：触发上传菜单后，硬性检测输入框内部是否切实渲染出图片附件缩略卡片（`.gem-attachment-style-img`）。若未检测到附件，立即阻断抛错，**绝对杜绝因上传延迟导致的“纯文本盲发降级”**；
   - **Gate 2（发送后消息门禁）**：消息发出后使用 DOM 轮询审计用户消息气泡，确保服务端切实接收到了图片。
5. **Fast-Fail 安全拒答实时嗅探 (Safety Refusal Sniffer)**：
   - 毫秒级监测模型输出气泡与系统 Toast，若触发 Gemini 敏感词策略拒答（如 policy violation / unable to generate），立即抛出结构化错误终止任务，无需无谓等待 90 秒超时。
6. **GeminiSession 多轮会话链式推理 (Multi-Turn Chaining)**：
   - 内置 `GeminiSession` 高阶类，自动追踪并维护会话 URL（`conversationUrl`）、历史上下文与多轮生图（`session.generateNext()`）。
7. **多候选变体提取与无损 Canvas/CDP 抓取**：
   - 支持 `--all` 参数同时提取 Gemini 返回的多张候选变体图片（`image_var1.png`, `image_var2.png`）；
   - 采用唯一 `src` 比对与内存 Canvas 提取，彻底规避 DOM 历史图数量混淆与跨域阻断。

---

## 🔄 通道执行流程图

```mermaid
graph TD
    A["调用方 Agent / CLI 传入 Prompt, 参考图?, 会话URL?, 输出路径"] --> B["获取跨进程排他锁 bridge.lock"]
    B --> C["探针 / 自动唤醒 Chrome (Port 9222, ~/.chrome-gemini-bridge)"]
    C --> D["导航至目标会话 URL / 保持同一对话"]
    D --> E{"是否传入参考图 (Img2Img)？"}
    E -->|是: 严格校验文件存在| F["触发 '+' 菜单 -> FileChooser 上传参考图"]
    F --> G{"Gate 1: 输入框是否出现图片卡片？"}
    G -->|否: 阻断抛错并重试| F
    G -->|是: 门禁通过| H["输入调用方传入的原样 Prompt"]
    E -->|否 (文生图)| H
    H --> I["CDP 坐标原生点击发送按钮 / 回车提交"]
    I --> J{"Gate 2: 用户消息气泡是否包含图片？"}
    J -->|DOM 校验通过| K["监听 DOM 生成状态 / Fast-Fail 安全拒答嗅探"]
    K -->|检测到拒答| X["快速抛错并释放锁"]
    K -->|检测到新图片| L["内存 Canvas 提取无损 PNG 数据"]
    L --> M["写入目标文件 / 变体文件并释放互斥锁"]
    M --> N["返回结果对象 (含 conversationUrl, images 列表)"]
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

### 3. 多候选变体提取 (Extract All Variations)
```bash
node "<skill_path>/scripts/generate_single.js" \
  --prompt "A pixel art wizard casting spells" \
  --out "output/wizard.png" \
  --all
```

### 📋 命令行参数清单

| 参数名 | 简写 | 说明 | 是否必填 | 默认值 |
| :--- | :--- | :--- | :--- | :--- |
| `--prompt` | `-p` | 调用方指定的生图提示词文本 | **必填** | - |
| `--out` | `-o` | 输出 PNG 图片文件路径（自动递归创建父目录） | **必填** | `output/generated_image.png` |
| `--ref` | `-r` | 图生图参考图片路径（严格校验存在性，触发双重门禁） | 选填 | `null` |
| `--url` | `-u` | 持久会话链接（保持多轮对话上下文） | 选填 | `null` (复用活跃/新建) |
| `--all` | `-a` | 提取所有生成的候选图片变体 | 选填 | `false` |
| `--timeout`| `-t` | 生图超时毫秒数（正整数） | 选填 | `90000` (90秒) |

---

## 🤖 编程式调用 (Node.js API)

### 1. 基础生图 (`generateImage`)
```javascript
const { generateImage, closeBrowser } = require('./scripts/gemini_bridge.js');

async function run() {
  try {
    const result = await generateImage('你的提示词文本', {
      referenceImagePath: './assets/ref.png',                  // 可选：图生图参考图
      targetUrl: 'https://gemini.google.com/app/your-chat-id', // 可选：指定会话保持上下文
      outputPath: './output/result.png',                       // 输出路径
      extractAll: true,                                        // 可选：提取全部变体
      timeoutMs: 90000                                         // 超时时间
    });

    console.log('✓ 生成成功，会话链接:', result.conversationUrl);
    console.log('✓ 提取图片数量:', result.images.length);
  } finally {
    await closeBrowser();
  }
}
run();
```

### 2. 多轮链式会话 (`GeminiSession`)
```javascript
const { GeminiSession } = require('./scripts/gemini_bridge.js');

async function runSession() {
  const session = new GeminiSession();

  // 第 1 轮：生成基础角色
  const turn1 = await session.generate('A cute pixel art golden retriever dog, 16 bit sprite', {
    outputPath: './output/turn1_dog.png',
  });

  // 第 2 轮：直接链式迭代该角色动作（自动保持同一会话上下文）
  const turn2 = await session.generateNext('Based on this dog, make it jump joyfully', {
    referenceImagePath: turn1.outputPath,
    outputPath: './output/turn2_dog_jump.png',
  });

  console.log('完整会话历史:', session.getHistory());
}
runSession();
```

---

## 🛡️ 异常处理与自愈机制

1. **端口连接自愈 (ECONNREFUSED 9222)**：
   - 驱动内置 `ensureChrome()`，探针失败后自动以独立 Profile 拉起 Chrome，无需人工干预。
2. **Gate 1 门禁拦截 (未检测到图片附件)**：
   - 上传超时或菜单异常时立即阻断，严禁降级为纯文本发送，保障图生图 100% 真实执行。
3. **Fast-Fail 拒答阻断**：
   - 实时监听模型响应气泡，遇到安全策略违规即刻退出，不占用调度锁资源。
4. **死锁自动清理**：
   - `acquireProcessLock()` 会定期检测持有锁的 PID 存活性，若进程已异常退出则自动清除过期锁文件。
