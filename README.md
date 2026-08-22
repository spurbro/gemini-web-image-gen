# Gemini Web Standalone Image Generation Engine (v2.0.0)

A 100% standalone, portable, and zero-API-cost AI image generation skill powered by Google Gemini Web (Imagen 3) and Chrome DevTools Protocol (CDP).

## Quick Start

### 1. Installation
```bash
cd gemini-web-image-gen
npm install
```

### 2. Generate Single Image
```bash
node scripts/generate_single.js -p "A majestic cyberpunk dragon over Tokyo neon skyline, 8k" -o "output/dragon.png"
```

### 3. Image-to-Image (Img2Img) with Session Persistence
```bash
node scripts/generate_single.js \
  -u "https://gemini.google.com/app/<session_id>" \
  -r "output/dragon.png" \
  -p "Based on the attached image, generate the dragon breathing blue cosmic flame" \
  -o "output/dragon_flame.png"
```

## Architecture & Features
- **Zero API Cost**: Uses Gemini Web Imagen 3 directly.
- **Dual-Gated Assertion**: Guaranteed image attachment checks (Gate 1 & Gate 2).
- **Session Memory**: Multi-turn conversation retention.
- **Lossless Canvas Extraction**: Extracts high-res PNG without CORS restrictions.
