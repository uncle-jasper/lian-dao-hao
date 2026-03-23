# 練到好 — Liàn Dào Hǎo

> *Practice until it's good.*

A content-driven Taiwanese Mandarin learning app for intermediate learners targeting TOCFL Level 4. Feed in real content you care about — YouTube transcripts, articles, podcasts — and work through a structured 30-minute session built around that material. Built as a single HTML file with no external dependencies beyond API calls.

---

## What it does

Each session has five segments:

1. **準備 Warm-up** — content overview and key vocabulary preview
2. **理解 Comprehension** — reading challenges drawn directly from your source material (3 multiple choice + 2 open response)
3. **詞彙與語法 Vocab & Grammar** — vocab cards, a grammar pattern exercise, and sentence production using words pulled from your content and struggle bank
4. **角色扮演 Roleplay** — conversational practice in a scenario built from your content, with per-turn coaching notes from Claude
5. **回顧 Review** — session summary, newly flagged items, struggle bank count

---

## Features

**Content ingestion**
- YouTube URL — attempts to auto-fetch CC subtitles; falls back to manual paste
- Article URL or pasted text
- Podcast — upload audio (transcribed via OpenAI Whisper API, optional) or paste a transcript
- Free-paste for any Chinese text

**Struggle bank**
- Pre-load vocab and grammar patterns you already know you struggle with
- Flag additional items during any session
- All bank items are automatically woven into every session's challenges

**Speaking input**
- Mic input via Web Speech API set to `zh-TW` on every response field
- Type-what-you-said fallback if mic isn't available or preferred

**Chinese-first display**
- Challenges show Chinese only; English available on demand via toggle

**Character counter**
- Live counter on all content inputs
- Thresholds adjust automatically based on your current mode (see below)

**Installable PWA**
- Works on iOS (Add to Home Screen), Android, and desktop Chrome/Edge
- Offline shell via service worker — API calls still require a connection

---

## Efficient Mode

Efficient Mode is **on by default** and keeps session costs to roughly **$0.04–0.05** per session. It can be toggled in Settings or directly from the **⬡ pill in the topbar**.

| | Efficient (default) | Full |
|---|---|---|
| Content truncation | 1,500 chars | 3,000 chars |
| Counter warning threshold | 1,000 chars | 2,000 chars |
| Open answer evaluation | Model answer shown locally | Claude evaluates |
| Sentence evaluation | Self-check prompt | Claude evaluates |
| Roleplay turn cap | 8 turns | Unlimited |
| Estimated cost/session | ~$0.04–0.05 | ~$0.07–0.10 |

Switch to Full mode when you want detailed Claude feedback on every response — e.g. when drilling a specific grammar weakness or doing a focused writing session.

---

## Token efficiency tips

- **Paste excerpts, not full transcripts.** 800–1,000 chars is plenty for a rich session. The character counter guides you.
- **Use the session focus field.** A specific note like "drill 而且 vs 但是" tightens Claude's output and reduces wasted tokens.
- **MC questions are free.** Multiple choice answers are scored locally — no API call.
- **Skip eval when you already know.** In Full mode, only hit Evaluate when you're genuinely unsure about your answer.
- **Set a spend cap.** Go to [console.anthropic.com](https://console.anthropic.com) → Billing → Usage limits and set a monthly ceiling. Takes 30 seconds and eliminates any surprise charges.

---

## Setup

1. Clone or download this repo
2. Enable GitHub Pages — Settings → Pages → main branch → root
3. Open the live URL, go to **⚙ Settings**, paste your Anthropic API key
4. Optionally add an OpenAI API key for native podcast audio transcription
5. Add known problem vocab and grammar patterns to **⊞ Struggle Bank**
6. Start a session

---

## API keys

| Key | Required | Used for |
|---|---|---|
| Anthropic | ✅ Yes | All session content generation |
| OpenAI | Optional | Podcast audio transcription via Whisper |

No OpenAI key? Transcribe podcast audio for free at [Whisper.app](https://whisperapp.net) or [Memo.ac](https://memo.ac), then paste the result.

Keys are stored in `localStorage` in your browser and sent only to the respective APIs.

---

## Estimated cost

At 3–4 sessions per week in Efficient Mode: roughly **$6–8/month**.
In Full Mode: roughly **$10–15/month**.

---

## Files

```
index.html      — the entire app
manifest.json   — PWA manifest
sw.js           — service worker (offline shell + asset caching)
icon-192.svg    — PWA icon (192×192)
icon-512.svg    — PWA icon (512×512)
```

No build step. No framework. No runtime dependencies. Traditional Chinese (繁體字) throughout.

---

## License

MIT
