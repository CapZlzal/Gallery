/**
 * api/gallery.js — Vercel Serverless Function
 *
 * Secure proxy between the frontend and GitHub Contents API.
 * The GH_TOKEN environment variable is NEVER exposed to the browser.
 *
 * Environment variables (set in Vercel Dashboard → Project → Settings → Environment Variables):
 *   GH_TOKEN   — GitHub Personal Access Token (public_repo scope)
 *   GH_OWNER   — GitHub username  (capzlzal)
 *   GH_REPO    — Repository name  (Gallery)
 *   GH_BRANCH  — Branch           (main)
 *   GH_FILE    — File path        (gallery-data.json)
 *
 * How to run locally:
 *   1. Copy .env.example → .env.local
 *   2. Fill in your values
 *   3. npx vercel dev
 *
 * Endpoints:
 *   GET  /api/gallery          → returns gallery JSON array
 *   POST /api/gallery          → appends one record { record: {...} }
 *   DELETE /api/gallery        → removes record { publicId: "..." }
 */

const GH_OWNER  = process.env.GH_OWNER  || 'capzlzal';
const GH_REPO   = process.env.GH_REPO   || 'Gallery';
const GH_BRANCH = process.env.GH_BRANCH || 'main';
const GH_FILE   = process.env.GH_FILE   || 'gallery-data.json';
const GH_TOKEN  = process.env.GH_TOKEN;  // REQUIRED — never hardcoded

const GH_API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`;

function ghHeaders() {
  if (!GH_TOKEN) throw new Error('GH_TOKEN environment variable is not set');
  return {
    Authorization:  `token ${GH_TOKEN}`,
    Accept:         'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

/** Read current gallery JSON + SHA from GitHub */
async function ghRead() {
  const res = await fetch(`${GH_API}?ref=${GH_BRANCH}`, { headers: ghHeaders() });
  if (res.status === 404) return { data: [], sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const json = await res.json();
  const data = JSON.parse(Buffer.from(json.content, 'base64').toString('utf-8'));
  return { data: Array.isArray(data) ? data : [], sha: json.sha };
}

/** Write gallery JSON back to GitHub */
async function ghWrite(data, sha, msg = 'Update gallery') {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const body = { message: msg, content, branch: GH_BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(GH_API, {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub write failed: ${res.status}`);
  }
}

/** Vercel handler */
export default async function handler(req, res) {
  // CORS — allow requests from your GitHub Pages domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — return gallery array
    if (req.method === 'GET') {
      const { data } = await ghRead();
      return res.status(200).json(data);
    }

    // POST — append a new record
    if (req.method === 'POST') {
      const { record } = req.body;
      if (!record) return res.status(400).json({ error: 'Missing record' });
      const { data, sha } = await ghRead();
      await ghWrite([record, ...data], sha, `Add: ${record.name || 'image'}`);
      return res.status(200).json({ ok: true });
    }

    // DELETE — remove record by publicId
    if (req.method === 'DELETE') {
      const { publicId, name } = req.body;
      if (!publicId) return res.status(400).json({ error: 'Missing publicId' });
      const { data, sha } = await ghRead();
      const newData = data.filter(r => {
        const key = r.type === 'collection' ? r.images?.[0]?.publicId : r.publicId;
        return key !== publicId;
      });
      await ghWrite(newData, sha, `Delete: ${name || publicId}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[api/gallery]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
