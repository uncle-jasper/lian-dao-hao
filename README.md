# 練到好 — Liàn Dào Hǎo

> *Practice until it's good.*

A content-driven Taiwanese Mandarin learning app for intermediate learners targeting TOCFL Level 4. Built as a single HTML file with no external dependencies beyond API calls.

## What it does

Each 30-minute session has five segments:

1. **準備 Warm-up** — content overview and key vocabulary preview
2. **理解 Comprehension** — reading/listening challenges drawn from your source material
3. **詞彙與語法 Vocab & Grammar** — targeted production practice using words and patterns from your struggle bank
4. **角色扮演 Roleplay** — conversational practice in a scenario built from your content, with live coaching notes
5. **回顧 Review** — session summary, flagged items, streak tracking

## Features

- Feed in YouTube transcripts, articles, or podcast transcripts as session content
- **Struggle bank** — pre-load vocab and grammar you already know you struggle with; flag more during sessions; all items are woven into every session automatically
- **Mic input** via Web Speech API (`zh-TW`) — speak your answers, text as fallback
- **Podcast transcription** via OpenAI Whisper API (optional — or use [Whisper.app](https://whisperapp.net) / [Memo.ac](https://memo.ac) to transcribe for free first)
- Character counter with token-efficiency warnings on all content inputs
- Chinese-only challenges with English available on demand
- Installable as a PWA on iOS, Android, and desktop

## Setup

1. Clone or download this repo
2. Enable GitHub Pages (Settings → Pages → main branch → root)
3. Open the live URL, go to **Settings**, paste your Anthropic API key
4. Optionally add an OpenAI API key for native podcast audio transcription
5. Add your known problem vocab and grammar patterns to the **Struggle Bank**
6. Start a session

## API keys

| Key | Required | Used for |
|---|---|---|
| Anthropic | ✅ Yes | All session content generation |
| OpenAI | Optional | Podcast audio transcription (Whisper) |

Keys are stored in `localStorage` in your browser. They are never sent anywhere except the respective APIs.

## Estimated cost

~$0.05–0.08 per 30-minute session using Claude Sonnet. At 3–4 sessions per week, expect roughly **$10–15/month** in Anthropic API usage.

## Token efficiency tips

- Paste excerpts (under 2,000 chars) rather than full transcripts — the counter will guide you
- Use the session focus field to direct Claude toward your weakest points
- MC comprehension questions are scored locally (no API call)
- Each roleplay turn is one API call — 8 turns is the sweet spot

## Tech

Single HTML file. No build step. No framework. No external dependencies at runtime.
Uses Traditional Chinese (繁體字) throughout.

## License

MIT
