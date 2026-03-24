#!/usr/bin/env node
// 練到好 — CC-CEDICT Dictionary Loader
// Run once to upload CC-CEDICT into Cloudflare KV.
//
// Prerequisites:
//   npm install node-fetch
//
// Setup:
//   1. In Cloudflare dashboard → Workers & Pages → KV
//      Create a namespace called "CEDICT" — copy its Namespace ID
//   2. In your Worker settings → Settings → Bindings → KV Namespaces
//      Add binding: Variable name = CEDICT, KV Namespace = the one you just created
//   3. Get your Cloudflare Account ID from the dashboard sidebar
//   4. Create a Cloudflare API token with "Workers KV Storage:Edit" permission
//      at dash.cloudflare.com/profile/api-tokens
//   5. Fill in the four constants below and run:
//      node load-dictionary.js

const CLOUDFLARE_ACCOUNT_ID = 'YOUR_ACCOUNT_ID';
const CLOUDFLARE_API_TOKEN  = 'YOUR_API_TOKEN';
const KV_NAMESPACE_ID       = 'YOUR_KV_NAMESPACE_ID'; // The CEDICT namespace ID
const CEDICT_URL            = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz';

// ─────────────────────────────────────────────────────────────────
// You shouldn't need to edit below this line
// ─────────────────────────────────────────────────────────────────

const https = require('https');
const zlib  = require('zlib');
const { Readable } = require('stream');

const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}`;
const HEADERS = {
  'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
  'Content-Type': 'application/json',
};

// Parse a CC-CEDICT line:
// Traditional Simplified [pin1 yin1] /def1/def2/
function parseLine(line) {
  if (!line || line.startsWith('#')) return null;
  const m = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/);
  if (!m) return null;
  const [, trad, simp, pinyin, defsRaw] = m;
  const defs = defsRaw.split('/').map(d => d.trim()).filter(Boolean);
  return { trad, simp, pinyin, defs };
}

// Pick the most useful short example from defs — prefer shorter ones
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
        const lines = text.split('\n');
        const entries = [];
        for (const line of lines) {
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
  // Cloudflare KV bulk write: max 10,000 per request, max 100MB
  const BATCH = 5000;
  for (let i = 0; i < pairs.length; i += BATCH) {
    const batch = pairs.slice(i, i + BATCH);
    const res = await fetch(`${KV_BASE}/bulk`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify(batch),
    });
    const json = await res.json();
    if (!json.success) {
      console.error('KV write error:', JSON.stringify(json.errors));
      throw new Error('KV write failed');
    }
    console.log(`  Uploaded ${Math.min(i + BATCH, pairs.length)} / ${pairs.length}`);
  }
}

async function main() {
  if (CLOUDFLARE_ACCOUNT_ID === 'YOUR_ACCOUNT_ID') {
    console.error('Please fill in the four constants at the top of this file.');
    process.exit(1);
  }

  const entries = await downloadAndParse();

  // Build KV pairs keyed by Traditional Chinese
  const kvPairs = [];
  const tradIndex = {}; // For words with multiple entries

  for (const e of entries) {
    const value = {
      pinyin: e.pinyin,
      defs: e.defs.slice(0, 5), // keep top 5 definitions
      example: pickExample(e.defs),
      simp: e.simp,
    };

    // Key by traditional
    kvPairs.push({ key: e.trad, value: JSON.stringify(value) });

    // Also key by simplified if different
    if (e.simp !== e.trad) {
      kvPairs.push({ key: e.simp, value: JSON.stringify(value) });
    }

    // Build traditional variant index for compound lookups
    if (!tradIndex[e.trad]) tradIndex[e.trad] = [];
    tradIndex[e.trad].push(e.trad);
  }

  // Write traditional index entries
  for (const [trad, keys] of Object.entries(tradIndex)) {
    if (keys.length > 1) {
      kvPairs.push({ key: `_trad_${trad}`, value: JSON.stringify([...new Set(keys)]) });
    }
  }

  console.log(`Writing ${kvPairs.length} KV entries...`);
  await kvBulkWrite(kvPairs);
  console.log('Done! Dictionary loaded into Cloudflare KV.');
  console.log('Now redeploy your Worker to pick up the CEDICT binding.');
}

main().catch(err => { console.error(err); process.exit(1); });
