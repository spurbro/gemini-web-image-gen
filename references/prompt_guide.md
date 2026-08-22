# Imagen 3 Prompt Engineering Guide (提示词工程指南)

## 🎯 Best Practices for Google Gemini Web (Imagen 3)

### 1. Core Structure (黄金提示词结构)
```
[Subject & Character Details] + [Action / Pose] + [Environment & Background] + [Lighting & Atmosphere] + [Art Style / Medium] + [Composition & Safety Rules]
```

### 2. Sequential Action / Continuity (连续多阶段图生图)
When generating subsequent frames or stages in the same session with an attached reference image:
```
Based on the attached reference image ([describe what is visible in the reference]), generate the NEXT sequential scene continuing directly from this moment:
- [Specify exact positional/movement changes]
- [Specify lighting or state alterations]
MANDATORY: Maintain exact visual consistency, character anatomy, colors, and art style with the attached reference image.
```

### 3. Absolute Negative Rules (严格负面约束)
Imagen 3 respects structured natural negative phrases:
- *Anti-Text*: `ABSOLUTE NEGATIVE RULES: DO NOT generate any text, letters, numbers, digits, frame numbers, labels, watermarks, symbols, or typography anywhere in the image.`
- *Anti-Crop*: `MANDATORY: Full body standing view visible from head to boots in every frame. No half-body crops, no close-ups.`
- *Flat Solid Background*: `Flat solid pure bright magenta #FF00FF background with no floor, no shadows, no gradients, no lighting reflections.`
