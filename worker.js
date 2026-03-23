// 練到好 — YouTube Transcript Worker
// Deploy this to Cloudflare Workers.
// Set SUPADATA_API_KEY as an environment variable in your Worker settings.

const ALLOWED_ORIGIN = '*'; // Lock this to your GitHub Pages URL for extra security
                             // e.g. 'https://yourusername.github.io'

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    const url = new URL(request.url);

    // Health check endpoint — used by the Test button in Settings
    if (url.pathname === '/ping') {
      return json({ ok: true }, env);
    }

    // Transcript endpoint
    if (url.pathname === '/transcript') {
      const videoUrl = url.searchParams.get('url');
      if (!videoUrl) {
        return json({ error: 'Missing url parameter' }, env, 400);
      }

      if (!env.SUPADATA_API_KEY) {
        return json({ error: 'SUPADATA_API_KEY not configured in Worker environment' }, env, 500);
      }

      try {
        // Request zh-TW first, fall back to zh if unavailable
        const supaRes = await fetch(
          `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(videoUrl)}&lang=zh-TW&text=true`,
          { headers: { 'x-api-key': env.SUPADATA_API_KEY } }
        );

        if (!supaRes.ok) {
          // Try without language preference if zh-TW not found
          if (supaRes.status === 404) {
            const fallbackRes = await fetch(
              `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(videoUrl)}&text=true`,
              { headers: { 'x-api-key': env.SUPADATA_API_KEY } }
            );
            if (!fallbackRes.ok) {
              return json({ error: 'No transcript available for this video' }, env, 404);
            }
            const fallbackData = await fallbackRes.json();
            return json({
              transcript: fallbackData.content,
              lang: fallbackData.lang,
              availableLangs: fallbackData.availableLangs || [],
              note: fallbackData.lang !== 'zh-TW' ? `zh-TW not available — returned ${fallbackData.lang}` : null
            }, env);
          }
          return json({ error: `Supadata error: ${supaRes.status}` }, env, supaRes.status);
        }

        const data = await supaRes.json();
        return json({
          transcript: data.content,
          lang: data.lang,
          availableLangs: data.availableLangs || [],
          note: null
        }, env);

      } catch (err) {
        return json({ error: `Worker error: ${err.message}` }, env, 500);
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
