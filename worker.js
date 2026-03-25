// 練到好 — Cloudflare Worker
// Handles:
//   /ping             — health check
//   /transcript       — YouTube transcript via Supadata
//   /lookup           — CC-CEDICT dictionary lookup
//   /sync (GET)       — pull progress data for a passphrase
//   /sync (POST)      — push progress data for a passphrase
//
// Environment variables required:
//   SUPADATA_API_KEY  — from supadata.ai
//
// KV namespaces required:
//   CEDICT  — dictionary data (run load-dictionary.js once to populate)
//   SYNC    — progress sync data (create empty, no population needed)

const ALLOWED_ORIGIN = '*';

export default {
  async fetch(request, env) {

    if (request.method === 'OPTIONS') return cors();

    const url = new URL(request.url);

    // ── Health check ──────────────────────────────────
    if (url.pathname === '/ping') {
      return json({ ok: true, cedict: !!env.CEDICT, sync: !!env.SYNC });
    }

    // ── YouTube transcript ────────────────────────────
    if (url.pathname === '/transcript') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) return json({ error: 'Missing url parameter' }, 400);
      if (!env.SUPADATA_API_KEY) return json({ error: 'SUPADATA_API_KEY not set' }, 500);

      try {
        const supaRes = await fetch(
          `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(videoUrl)}&lang=zh-TW&text=true`,
          { headers: { 'x-api-key': env.SUPADATA_API_KEY } }
        );
        if (!supaRes.ok) {
          if (supaRes.status === 404) {
            const fallback = await fetch(
              `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(videoUrl)}&text=true`,
              { headers: { 'x-api-key': env.SUPADATA_API_KEY } }
            );
            if (!fallback.ok) return json({ error: 'No transcript available' }, 404);
            const d = await fallback.json();
            return json({ transcript: d.content, lang: d.lang, availableLangs: d.availableLangs || [],
              note: d.lang !== 'zh-TW' ? `zh-TW not available — returned ${d.lang}` : null });
          }
          return json({ error: `Supadata error ${supaRes.status}` }, supaRes.status);
        }
        const data = await supaRes.json();
        return json({ transcript: data.content, lang: data.lang,
          availableLangs: data.availableLangs || [], note: null });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    // ── Dictionary lookup ─────────────────────────────
    if (url.pathname === '/lookup') {
      const word = url.searchParams.get('word');
      if (!word) return json({ error: 'Missing word parameter' }, 400);
      if (!env.CEDICT) return json({ error: 'Dictionary KV not configured' }, 503);

      try {
        const entry = await env.CEDICT.get(word);
        if (entry) return json({ word, ...JSON.parse(entry), found: true });

        const raw = await env.CEDICT.get(`_trad_${word}`);
        if (raw) {
          const keys = JSON.parse(raw);
          const entries = [];
          for (const k of keys.slice(0, 3)) {
            const e = await env.CEDICT.get(k);
            if (e) entries.push(JSON.parse(e));
          }
          if (entries.length > 0) return json({ word, entries, found: true, multiple: true });
        }
        return json({ word, found: false }, 404);
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    // ── Sync ──────────────────────────────────────────
    if (url.pathname === '/sync') {
      if (!env.SYNC) return json({ error: 'SYNC KV not configured' }, 503);

      const passphrase = url.searchParams.get('key');
      if (!passphrase || passphrase.length < 6) {
        return json({ error: 'Missing or too-short sync key' }, 400);
      }

      // Hash the passphrase so raw passphrases never sit in KV
      const kvKey = `sync_${await sha256(passphrase)}`;

      // GET — pull data
      if (request.method === 'GET') {
        try {
          const data = await env.SYNC.get(kvKey);
          if (!data) return json({ found: false });
          return json({ found: true, data: JSON.parse(data) });
        } catch (err) {
          return json({ error: err.message }, 500);
        }
      }

      // POST — push data
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          // Store with 90-day TTL — refreshed on every push
          await env.SYNC.put(kvKey, JSON.stringify(body), { expirationTtl: 60 * 60 * 24 * 90 });
          return json({ ok: true, savedAt: new Date().toISOString() });
        } catch (err) {
          return json({ error: err.message }, 500);
        }
      }
    }

    // ── Google Translate TTS proxy ────────────────────
    if (url.pathname === '/tts') {
      const text = url.searchParams.get('text');
      const lang = url.searchParams.get('lang') || 'zh-TW';
      if (!text) return json({ error: 'Missing text parameter' }, 400);

      try {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(lang)}&client=tw-ob&ttsspeed=0.85`;
        const ttsRes = await fetch(ttsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://translate.google.com/',
          }
        });

        if (!ttsRes.ok) {
          return json({ error: `TTS fetch failed: ${ttsRes.status}` }, ttsRes.status);
        }

        const audioData = await ttsRes.arrayBuffer();
        return new Response(audioData, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
            'Cache-Control': 'public, max-age=3600',
          }
        });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    return json({ error: 'Unknown endpoint' }, 404);
  }
};

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    }
  });
}

function cors() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
