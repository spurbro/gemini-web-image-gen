# Gemini Web Standalone Image Generation Engine (v2.0.0)

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg)]()
[![Gemini](https://img.shields.io/badge/powered%20by-Google%20Gemini%20Web%20(Imagen%203)-orange.svg)]()

A 100% standalone, portable, zero-cost AI image generation skill powered by Google Gemini Web (Imagen 3) and Chrome DevTools Protocol (CDP). Designed for direct invocation by any AI agent, test harness, or CLI workflow.

[Read Chinese Documentation (中文文档)](./README_ZH.md)

---

## 🌟 Key Highlights

- 💰 **Zero API Key & Zero Cost**: Direct interface with Gemini Web Imagen 3 via local session.
- 🎨 **Text-to-Image & Image-to-Image**: Full multi-modal generation with reference image uploads.
- 🛡️ **Dual-Gated Quality Assurance**:
  - **Gate 1 (Pre-Send)**: Asserts the image thumbnail card is mounted in the input area before text entry.
  - **Gate 2 (Post-Send)**: Verifies the sent query bubble in DOM contains the image.
- 🧠 **Persistent Single-Session Memory**: Reuse existing conversation URLs to maintain character, lighting, and style consistency.
- 🖼️ **Lossless Canvas Base64 Extraction**: Bypasses CORS and Blob URL restrictions to save full-resolution PNGs.
- 📦 **Zero Project Coupling**: No hardcoded paths; dynamically resolves user profiles and works across any project.

---

## 📁 Repository Structure

```
gemini-web-image-gen/
├── SKILL.md                         # Bilingual Master AI Agent Skill Specification
├── README.md                        # English Documentation & Quickstart
├── README_ZH.md                     # Chinese Documentation & Quickstart (中文指南)
├── package.json                     # Standalone Node.js dependencies
├── scripts/
│   ├── gemini_bridge.js             # Core CDP Image Engine (Node.js Module)
│   ├── generate_single.js           # Single Image CLI Entrypoint
│   ├── batch_generator.js           # Batch Workflow Generator with queue & resume
│   └── launch_chrome.ps1            # Remote debugging Chrome launcher (Port 9222)
├── examples/
│   ├── agent_integration.js         # Programmatic Agent integration sample
│   └── tasks_example.json           # Batch task configuration template
└── references/
    ├── prompt_guide.md              # Imagen 3 Prompt Engineering & Negative Prompting
    └── troubleshooting.md           # Error recovery & diagnostic guide
```

---

## 🚀 Quick Start

### 1. Installation
```bash
git clone https://github.com/spurbro/gemini-web-image-gen.git
cd gemini-web-image-gen
npm install
```

### 2. Launch Chrome with Debugging Port (One-time Setup)
```powershell
powershell -ExecutionPolicy Bypass -File scripts/launch_chrome.ps1
```
*Log in to your Google Account once in the opened window. Session data is permanently preserved in `~/.chrome-gemini-bridge`.*

### 3. Generate Single Image (CLI)
```bash
# Text-to-Image (T2I)
node scripts/generate_single.js -p "A majestic cyberpunk dragon over Tokyo neon skyline, 8k" -o "output/dragon.png"

# Image-to-Image (I2I in persistent session)
node scripts/generate_single.js \
  -u "https://gemini.google.com/app/<session_id>" \
  -r "output/dragon.png" \
  -p "Based on the attached image, generate the dragon breathing blue cosmic flame" \
  -o "output/dragon_flame.png"
```

### 4. CLI Parameters Reference

| Flag | Alias | Description | Required | Default |
| :--- | :--- | :--- | :--- | :--- |
| `--prompt` | `-p` | Prompt text describing image | **Yes** | - |
| `--out` | `-o` | Output image path (PNG) | **Yes** | `output/generated_image.png` |
| `--ref` | `-r` | Reference image path for Img2Img | No | `null` |
| `--url` | `-u` | Persistent conversation URL | No | `null` (opens new/active) |
| `--timeout`| `-t` | Timeout in milliseconds | No | `90000` (90s) |

---

## 🤖 Programmatic Integration for AI Agents

```javascript
const { generateImage } = require('./scripts/gemini_bridge.js');

async function main() {
  const res = await generateImage('A cute red panda wearing astronaut suit, 8k', {
    referenceImagePath: './assets/panda_base.png', // Optional
    targetUrl: 'https://gemini.google.com/app/your-chat-id', // Optional
    outputPath: './output/astronaut_panda.png',
    timeoutMs: 90000
  });
  console.log('✓ Image generated at:', res.outputPath);
}

main();
```

---

## 📄 License
MIT License. Free for personal, commercial, and research use.
