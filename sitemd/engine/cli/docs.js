// ---------------------------------------------------------------------------
// Docs — fetch and search official sitemd documentation from sitemd.cc
// ---------------------------------------------------------------------------

const https = require('https');
const http = require('http');

const DOCS_SITE = process.env.SITEMD_DOCS_URL || 'https://sitemd.cc';
const SEARCH_INDEX_URL = DOCS_SITE + '/search-index.json';
const FETCH_TIMEOUT = 10000;

// Module-level cache for the docs index
let _cachedIndex = null;

// ---------------------------------------------------------------------------
// HTTP fetch helper (Node built-in, no external deps)
// ---------------------------------------------------------------------------
function fetch(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`Request timed out after ${FETCH_TIMEOUT}ms`));
    }, FETCH_TIMEOUT);

    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        return resolve(fetch(res.headers.location));
      }
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { clearTimeout(timer); resolve(data); });
      res.on('error', err => { clearTimeout(timer); reject(err); });
    });
    req.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

// ---------------------------------------------------------------------------
// Fetch the docs index (search-index.json filtered to docs group)
// ---------------------------------------------------------------------------
async function fetchDocsIndex() {
  if (_cachedIndex) return _cachedIndex;

  const raw = await fetch(SEARCH_INDEX_URL);
  const index = JSON.parse(raw);
  _cachedIndex = index.filter(entry => entry.g === 'docs');
  return _cachedIndex;
}

// ---------------------------------------------------------------------------
// Search docs by keyword scoring
// ---------------------------------------------------------------------------
function searchDocs(index, query) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  const scored = index.map(doc => {
    let score = 0;
    const titleLower = doc.t.toLowerCase();
    const descLower = (doc.b || '').slice(0, 300).toLowerCase();
    const bodyLower = (doc.b || '').toLowerCase();

    for (const token of tokens) {
      if (titleLower.includes(token)) score += 10;
      if (descLower.includes(token)) score += 5;
      const bodyCount = Math.min((bodyLower.split(token).length - 1), 5);
      score += bodyCount;
    }

    return { ...doc, score };
  }).filter(d => d.score > 0).sort((a, b) => b.score - a.score);

  return scored;
}

// ---------------------------------------------------------------------------
// Fetch a specific doc page as markdown
// ---------------------------------------------------------------------------
async function fetchDocPage(slug) {
  // Normalize slug
  const normalized = slug.startsWith('/') ? slug : '/docs/' + slug;
  const url = DOCS_SITE + normalized + '/index.md';
  return fetch(url);
}

module.exports = { fetchDocsIndex, searchDocs, fetchDocPage };
