# Gemini Web Browser Image Generation Bridge (v2.0.0)

[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen.svg)]()
[![Gemini](https://img.shields.io/badge/channel-Google%20Gemini%20Web%20(Imagen%203)-orange.svg)]()

A standalone, pure browser automation bridge and execution channel for Google Gemini Web (Imagen 3) powered by Chrome DevTools Protocol (CDP). Designed as a universal, prompt-agnostic image generation channel for AI agents, test harnesses, and CLI tools.

[Read Chinese Documentation (中文文档)](./README_ZH.md)

---

## 🌟 What This Skill Does

This repository is **strictly an infrastructure bridge/channel** connecting your code to Gemini Web's image generation interface:
- 🔌 **Pure Pass-Through**: Accepts whatever prompt and reference images you provide without enforcing prompt styles.
- 🛡️ **Dual-Gated Upload Integrity**: Guarantees reference images are attached inside the input container before sending, preventing silent plain-text fallback.
- 🧠 **Session Memory Retention**: Direct support for reusing conversation URLs (`--url`) across multi-turn workflows.
- 🖼️ **Lossless Canvas Extraction**: Extracts full-resolution PNG images directly from in-memory HTML5 Canvas, bypassing CORS and temporary Blob restrictions.
- 💻 **Zero Hardcoded Paths**: Fully portable across projects and operating systems.

---

## 📁 Structure

```
gemini-web-image-gen/
├── SKILL.md                         # Bilingual Master AI Agent Bridge Specification
├── README.md                        # English Bridge Documentation & Quickstart
├── README_ZH.md                     # Chinese Bridge Documentation (中文指南)
├── package.json                     # Standalone Node.js dependencies
├── scripts/
│   ├── gemini_bridge.js             # Core CDP Browser Driver & Channel Module
│   ├── generate_single.js           # CLI Tool for Single Image Generation (T2I & I2I)
│   ├── batch_generator.js           # Batch Workflow Queue Generator
│   └── launch_chrome.ps1            # Chrome Debugging Instance Launcher (Port 9222)
├── examples/
│   ├── agent_integration.js         # How Agents / Test Harnesses call this programmatically
│   └── tasks_example.json           # Batch task configuration template
└── references/
    └── troubleshooting.md           # CDP connection, port collision & UI self-healing guide
```

---

## 🚀 Quick Start

### 1. Installation
```bash
git clone https://github.com/spurbro/gemini-web-image-gen.git
cd gemini-web-image-gen
npm install
```

### 2. Launch Chrome Debugging Session (One-time Setup)
```powershell
powershell -ExecutionPolicy Bypass -File scripts/launch_chrome.ps1
```
*Sign in to Google once. The profile is permanently stored in `~/.chrome-gemini-bridge`.*

### 3. Generate Image via CLI
```bash
# Text-to-Image
node scripts/generate_single.js -p "Your prompt text here" -o "output/image.png"

# Image-to-Image with Persistent Session
node scripts/generate_single.js \
  -u "https://gemini.google.com/app/<session_id>" \
  -r "path/to/ref.png" \
  -p "Your continuation prompt here" \
  -o "output/next.png"
```

---

## 🤖 Programmatic Integration

```javascript
const { generateImage } = require('./scripts/gemini_bridge.js');

async function run() {
  const result = await generateImage('Your custom prompt', {
    referenceImagePath: './assets/ref.png', // Optional: for Img2Img
    targetUrl: 'https://gemini.google.com/app/your-chat-id', // Optional: keep same session
    outputPath: './output/result.png',
    timeoutMs: 90000
  });

  console.log('✓ Image saved at:', result.outputPath);
}

run();
```

---

## 📄 License
MIT License.
