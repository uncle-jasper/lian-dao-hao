#!/usr/bin/env node
// 練到好 — CC-CEDICT Dictionary Loader
// Uploads CC-CEDICT into your Cloudflare KV namespace.
// Run once. Safe to commit to GitHub — no secrets in this file.
//
// Usage:
//   CF_ACCOUNT_ID=xxx CF_API_TOKEN=xxx CF_KV_ID=xxx node load-dictionary.js

const CLOUDFLARE_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN  = process.env.CF_API_TOKEN;
const KV_NAMESPACE_ID       = process.env.CF_KV_ID;
const CEDICT_URL            = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz';

// ─────────────────────────────────────────────────────────────────
// No edits needed below this line
// ─────────────────────────────────────────────────────────────────

const https = require('https');
const zlib  = require('zlib');

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}`;
const HEADERS = {
  'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
  'Content-Type': 'application/json',
};

function parseLine(line) {
  if (!line || line.startsWith('#')) return null;
  const m = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
  if (!m) return null;
  const [, trad, simp, pinyin, defsRaw] = m;
  const defs = defsRaw.split('/').map(d => d.trim()).filter(Boolean);
  return { trad, simp, pinyin, defs };
}

function pickExample(defs) {
  return defs.find(d => d.includes('，') || d.includes('。') || d.length > 15) || defs[0] || '';
}

async function downloadAndParse() {
  console.log('Downloading CC-CEDICT...');
  return new Promise((resolve, reject) => {
    https.get(CEDICT_URL, res => {
      const gunzip = zlib.createGunzip();
      const chunks = [];
      res.pipe(gunzip);
      gunzip.on('data', chunk => chunks.push(chunk));
      gunzip.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const entries = [];
        for (const line of text.split('\n')) {
          const parsed = parseLine(line.trim());
          if (parsed) entries.push(parsed);
        }
        console.log(`Parsed ${entries.length} entries`);
        resolve(entries);
      });
      gunzip.on('error', reject);
    }).on('error', reject);
  });
}

async function kvBulkWrite(pairs) {
  const BATCH = 5000;
  for (let i = 0; i < pairs.length; i += BATCH) {
    const batch = pairs.slice(i, i + BATCH);
    const res = await fetch(`${KV_BASE}/bulk`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify(batch),
    });
    const data = await res.json();
    if (!data.success) {
      console.error('KV write error:', JSON.stringify(data.errors));
      throw new Error('KV write failed');
    }
    console.log(`  Uploaded ${Math.min(i + BATCH, pairs.length)} / ${pairs.length}`);
  }
}

async function main() {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !KV_NAMESPACE_ID) {
    console.error(`
Missing environment variables. Run like this:

  CF_ACCOUNT_ID=your_account_id \\
  CF_API_TOKEN=your_api_token \\
  CF_KV_ID=your_kv_namespace_id \\
  node load-dictionary.js
    `);
    process.exit(1);
  }

  const entries = await downloadAndParse();

  const kvPairs = [];
  const tradIndex = {};

  for (const e of entries) {
    const value = {
      pinyin: e.pinyin,
      defs: e.defs.slice(0, 5),
      example: pickExample(e.defs),
      simp: e.simp,
    };
    kvPairs.push({ key: e.trad, value: JSON.stringify(value) });
    if (e.simp !== e.trad) {
      kvPairs.push({ key: e.simp, value: JSON.stringify(value) });
    }
    if (!tradIndex[e.trad]) tradIndex[e.trad] = [];
    tradIndex[e.trad].push(e.trad);
  }

  for (const [trad, keys] of Object.entries(tradIndex)) {
    if (keys.length > 1) {
      kvPairs.push({ key: `_trad_${trad}`, value: JSON.stringify([...new Set(keys)]) });
    }
  }

  console.log(`Writing ${kvPairs.length} KV entries...`);
  await kvBulkWrite(kvPairs);
  console.log('\nDone! Dictionary loaded into Cloudflare KV.');
}

main().catch(err => { console.error(err); process.exit(1); });
