// 練到好 — Cloudflare Worker
// Handles: YouTube transcript fetching (via Supadata) + CC-CEDICT dictionary lookup
//
// Environment variables required:
//   SUPADATA_API_KEY  — from supadata.ai
//
// KV namespace required:
//   CEDICT  — bind a KV namespace with this name in your Worker settings
//             then run load-dictionary.js once to populate it

const ALLOWED_ORIGIN = '*'; // Lock to your GitHub Pages URL for extra security
                             // e.g. 'https://yourusername.github.io'

export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return cors(null, env);
    }

    const url = new URL(request.url);

    // ── Health check ──────────────────────────────────
    if (url.pathname === '/ping') {
      return json({ ok: true, cedict: !!env.CEDICT }, env);
    }

    // ── YouTube transcript ────────────────────────────
    if (url.pathname === '/transcript') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) return json({ error: 'Missing url parameter' }, env, 400);
      if (!env.SUPADATA_API_KEY) return json({ error: 'SUPADATA_API_KEY not set' }, env, 500);

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
            if (!fallback.ok) return json({ error: 'No transcript available' }, env, 404);
            const d = await fallback.json();
            return json({ transcript: d.content, lang: d.lang, availableLangs: d.availableLangs || [],
              note: d.lang !== 'zh-TW' ? `zh-TW not available — returned ${d.lang}` : null }, env);
          }
          return json({ error: `Supadata error ${supaRes.status}` }, env, supaRes.status);
        }

        const data = await supaRes.json();
        return json({ transcript: data.content, lang: data.lang,
          availableLangs: data.availableLangs || [], note: null }, env);

      } catch (err) {
        return json({ error: err.message }, env, 500);
      }
    }

    // ── Dictionary lookup ─────────────────────────────
    if (url.pathname === '/lookup') {
      const word = url.searchParams.get('word');
      if (!word) return json({ error: 'Missing word parameter' }, env, 400);

      if (!env.CEDICT) {
        return json({ error: 'Dictionary KV not configured. Run load-dictionary.js first.' }, env, 503);
      }

      try {
        const entry = await env.CEDICT.get(word);
        if (entry) {
          return json({ word, ...JSON.parse(entry), found: true }, env);
        }

        // Try traditional variant index
        const raw = await env.CEDICT.get(`_trad_${word}`);
        if (raw) {
          const keys = JSON.parse(raw);
          const entries = [];
          for (const k of keys.slice(0, 3)) {
            const e = await env.CEDICT.get(k);
            if (e) entries.push(JSON.parse(e));
          }
          if (entries.length > 0) {
            return json({ word, entries, found: true, multiple: true }, env);
          }
        }

        return json({ word, found: false }, env, 404);

      } catch (err) {
        return json({ error: err.message }, env, 500);
      }
    }

    return json({ error: 'Unknown endpoint' }, env, 404);
  }
};

function json(data, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    }
  });
}

function cors(body, env) {
  return new Response(body, {
    headers: {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
