# Voice Generation - Quick Start Guide

**⏱️ 5 Minute Setup**

---

## 🚀 Quick Setup

### 1. Install Dependencies (Already Done)
```bash
# Dependencies already installed in the project
✅ Next.js
✅ React
✅ Replicate client
✅ Audio adapters
```

### 2. Configure API Keys

**Edit `.env.local`:**
```bash
# Required for Replicate (MiniMax, Bark)
REPLICATE_API_KEY="r8_your_key_here"

# Optional for ElevenLabs
ELEVENLABS_API_KEY="your_elevenlabs_key_here"
```

**Get Your Keys:**
- Replicate: https://replicate.com/account/api-tokens
- ElevenLabs: https://elevenlabs.io/app/settings/api-keys

### 3. Start the App
```bash
npm run dev
# Open http://localhost:3000
```

---

## 🎯 Usage in 3 Steps

### Step 1: Open Voice Panel
1. Navigate to video editor
2. Click **"Voice"** tab in left sidebar

### Step 2: Enter Text & Configure
```
Text: "Welcome to our product demo"
Provider: Replicate (MiniMax)
Model: MiniMax Turbo
Voice: Professional Man
Emotion: Auto
Speed: 1.0
Pitch: 0
```

### Step 3: Generate
- Click **"Generate Voice"** (or press `Cmd+Enter`)
- Wait ~2 seconds
- Audio appears on timeline! 🎉

---

## 📋 Available Voices

| Voice | Best For | Example Use |
|-------|----------|-------------|
| 🎓 Wise Woman | Documentary, Educational | "In 1969, humans landed on the moon..." |
| 👋 Friendly Person | Tutorials, Kids | "Hey there! Let's learn together!" |
| ⚡ Inspirational Girl | Motivational | "You can achieve anything!" |
| 🎬 Deep Voice Man | Dramatic, Trailers | "In a world of chaos..." |
| 🧘 Calm Woman | Meditation, Wellness | "Take a deep breath..." |
| 💼 Professional Man | Corporate, Business | "Our Q4 results show..." |
| 📖 Storyteller | Narrative, Adventure | "Once upon a time..." |
| 📰 News Anchor | News, Updates | "Breaking news tonight..." |

---

## ⚙️ Quick Settings

### Speed Examples
- **0.8x** - Slow, deliberate (meditation)
- **1.0x** - Normal (most content)
- **1.2x** - Fast, energetic (ads, promos)

### Pitch Examples
- **-3** - Slightly deeper (authority)
- **0** - Normal (most content)
- **+3** - Slightly higher (friendly)

### Emotion Styles
- **auto** - Let AI choose (recommended)
- **happy** - Upbeat, cheerful
- **calm** - Peaceful, relaxed
- **neutral** - Even, professional

---

## 💡 Pro Tips

### Keyboard Shortcuts
- `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows) - Generate voice

### Best Practices
✅ Keep text under 5000 characters
✅ Use punctuation for natural pauses
✅ Match voice to content type
✅ Use "auto" emotion for intelligent style
✅ Preview before adding to timeline

### Cost Optimization
- **MiniMax Turbo**: $0.008/1K chars (cheapest, fast)
- **MiniMax HD**: $0.012/1K chars (higher quality)
- **ElevenLabs**: $0.18-0.24/1K chars (premium quality)

---

## 🔧 Troubleshooting

### "API Key not configured"
```bash
# Add to .env.local
REPLICATE_API_KEY="r8_xxx..."

# Restart dev server
npm run dev
```

### "Text too long"
- Maximum: 5000 characters
- Solution: Split into multiple generations

### "Request timeout"
- Timeout: 30 seconds
- Solution: Use shorter text or MiniMax Turbo

---

## 📊 Model Comparison

| Model | Speed | Cost | Quality | Best For |
|-------|-------|------|---------|----------|
| MiniMax Turbo | ⚡⚡⚡ 2s | 💰 $0.008 | ⭐⭐⭐⭐ | Quick iterations |
| MiniMax HD | ⚡⚡ 6s | 💰💰 $0.012 | ⭐⭐⭐⭐⭐ | Final production |
| Bark | ⚡ 12s | 💰💰 $0.05 | ⭐⭐⭐⭐ | Creative effects |
| ElevenLabs v2 | ⚡⚡ 5s | 💰💰💰 $0.24 | ⭐⭐⭐⭐⭐ | Premium quality |

---

## 🎬 Example Workflows

### Product Demo
```
Text: "Introducing our revolutionary new app that saves you time..."
Voice: Professional Man
Emotion: auto
Speed: 1.0
Pitch: 0
Model: MiniMax Turbo
```

### Kids Tutorial
```
Text: "Hi friends! Today we're going to learn about colors..."
Voice: Friendly Person
Emotion: happy
Speed: 1.05
Pitch: +1
Model: MiniMax Turbo
```

### Documentary
```
Text: "For millions of years, the earth has been shaped by..."
Voice: Wise Woman
Emotion: calm
Speed: 1.0
Pitch: 0
Model: MiniMax HD
```

### Movie Trailer
```
Text: "In a world where everything changes in an instant..."
Voice: Deep Voice Man
Emotion: auto
Speed: 0.95
Pitch: -2
Model: MiniMax HD
```

---

## 🎓 Learn More

- **Full Documentation:** `docs/voice-generation-feature.md`
- **API Reference:** See API section in full docs
- **Code Examples:** `scripts/test-voice-generation.ts`

---

## ✅ Quick Checklist

Before generating your first voice:

- [ ] API key configured in `.env.local`
- [ ] Dev server running (`npm run dev`)
- [ ] Text entered (under 5000 chars)
- [ ] Voice selected
- [ ] Provider chosen (Replicate recommended)

Ready to generate! 🚀

---

**Need Help?**
- Check full documentation: `docs/voice-generation-feature.md`
- Test configuration: `npx tsx scripts/test-voice-generation.ts`
- Report issues: Create GitHub issue with details

---

**Version:** 1.0.0
**Last Updated:** November 23, 2025
**Status:** ✅ Production Ready
