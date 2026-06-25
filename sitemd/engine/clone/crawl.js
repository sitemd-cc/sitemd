/**
 * crawl.js — Discover all pages on a target website.
 *
 * Strategy:
 * 1. Try /sitemap.xml for declared pages
 * 2. Try /robots.txt for sitemap refs + disallow rules
 * 3. BFS from homepage following internal links
 * 4. Deduplicate
 */

const { URL } = require('url');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeUrl(href, base) {
  try {
    const u = new URL(href, base);
    u.hash = '';
    u.search = '';
    // Strip trailing slash except for root
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return null;
  }
}

function isSameOrigin(href, origin) {
  try {
    return new URL(href).origin === origin;
  } catch {
    return false;
  }
}

function shouldSkip(pathname, skipPaths) {
  return skipPaths.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
}

const SKIP_EXTENSIONS = new Set([
  '.pdf', '.zip', '.tar', '.gz', '.rar',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico',
  '.mp4', '.mp3', '.wav', '.ogg', '.webm',
  '.css', '.js', '.json', '.xml', '.woff', '.woff2', '.ttf', '.eot',
]);

function hasSkipExtension(pathname) {
  const ext = pathname.slice(pathname.lastIndexOf('.')).toLowerCase();
  return SKIP_EXTENSIONS.has(ext);
}

// ---------------------------------------------------------------------------
// Parse sitemap.xml
// ---------------------------------------------------------------------------

async function parseSitemap(page, origin) {
  const urls = new Set();

  async function fetchSitemap(url) {
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!response || response.status() !== 200) return;
      const text = await page.evaluate(() => document.querySelector('*').outerHTML);

      // Extract <loc> tags
      const locMatches = text.match(/<loc>\s*(.*?)\s*<\/loc>/gi) || [];
      for (const match of locMatches) {
        const inner = match.replace(/<\/?loc>/gi, '').trim();
        // Sub-sitemap
        if (inner.endsWith('.xml')) {
          await fetchSitemap(inner);
        } else {
          const normalized = normalizeUrl(inner, origin);
          if (normalized && isSameOrigin(normalized, origin)) {
            urls.add(normalized);
          }
        }
      }
    } catch {}
  }

  await fetchSitemap(`${origin}/sitemap.xml`);
  return urls;
}

// ---------------------------------------------------------------------------
// Parse robots.txt
// ---------------------------------------------------------------------------

async function parseRobots(page, origin) {
  const disallowed = [];
  const sitemaps = [];

  try {
    const response = await page.goto(`${origin}/robots.txt`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    if (!response || response.status() !== 200) return { disallowed, sitemaps, crawlDelay: 0 };
    const text = await page.evaluate(() => document.body?.innerText || '');

    let crawlDelay = 0;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('disallow:')) {
        const path = trimmed.slice(9).trim();
        if (path) disallowed.push(path);
      } else if (trimmed.toLowerCase().startsWith('sitemap:')) {
        sitemaps.push(trimmed.slice(8).trim());
      } else if (trimmed.toLowerCase().startsWith('crawl-delay:')) {
        crawlDelay = parseInt(trimmed.slice(12).trim(), 10) || 0;
      }
    }
    return { disallowed, sitemaps, crawlDelay };
  } catch {
    return { disallowed, sitemaps: [], crawlDelay: 0 };
  }
}

// ---------------------------------------------------------------------------
// BFS link crawler
// ---------------------------------------------------------------------------

async function crawlLinks(browser, origin, seedUrls, opts) {
  const { maxPages, skipPaths, delay, disallowed, timeout } = opts;
  const visited = new Map(); // url -> { url, html, statusCode }
  const queue = [...seedUrls];
  const seen = new Set(seedUrls);

  while (queue.length > 0 && visited.size < maxPages) {
    const url = queue.shift();
    const pathname = new URL(url).pathname;

    // Skip disallowed paths
    if (shouldSkip(pathname, skipPaths) || shouldSkip(pathname, disallowed)) continue;
    if (hasSkipExtension(pathname)) continue;

    let page;
    try {
      page = await browser.newPage();
      await page.setUserAgent('sitemd-clone/1.0');

      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: timeout || 30000,
      });

      const statusCode = response ? response.status() : 0;

      if (statusCode >= 400) {
        visited.set(url, { url, html: '', statusCode });
        await page.close();
        if (delay) await sleep(delay);
        continue;
      }

      // Wait a moment for any late JS rendering
      await sleep(500);

      const html = await page.content();
      visited.set(url, { url, html, statusCode });

      // Collect internal links for BFS
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(Boolean);
      });

      for (const link of links) {
        const normalized = normalizeUrl(link, url);
        if (!normalized) continue;
        if (!isSameOrigin(normalized, origin)) continue;
        if (seen.has(normalized)) continue;
        if (hasSkipExtension(new URL(normalized).pathname)) continue;
        seen.add(normalized);
        queue.push(normalized);
      }
    } catch (e) {
      visited.set(url, { url, html: '', statusCode: 0, error: e.message });
    } finally {
      if (page) try { await page.close(); } catch {}
    }

    if (delay && queue.length > 0) await sleep(delay);
  }

  return Array.from(visited.values());
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main crawl function
// ---------------------------------------------------------------------------

/**
 * Crawl a website and return all discovered pages.
 * @param {object} browser - Puppeteer browser instance
 * @param {string} url - Starting URL
 * @param {object} opts - { maxPages, skipPaths, delay }
 * @returns {Promise<Array<{url, html, statusCode}>>}
 */
async function crawl(browser, url, opts = {}) {
  const maxPages = Math.min(opts.maxPages || 50, 200);
  const skipPaths = opts.skipPaths || [];
  const baseDelay = opts.delay || 500;

  const origin = new URL(url).origin;
  const seedUrls = new Set([normalizeUrl(url, url)]);

  // Open a utility page for sitemap/robots parsing
  const utilPage = await browser.newPage();
  await utilPage.setUserAgent('sitemd-clone/1.0');

  // 1. Parse robots.txt
  const robots = await parseRobots(utilPage, origin);
  const effectiveDelay = Math.max(baseDelay, (robots.crawlDelay || 0) * 1000);

  // 2. Parse sitemap(s)
  const sitemapUrls = await parseSitemap(utilPage, origin);

  // Also check sitemaps declared in robots.txt
  for (const smUrl of robots.sitemaps) {
    try {
      const response = await utilPage.goto(smUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (response && response.status() === 200) {
        const text = await utilPage.evaluate(() => document.querySelector('*').outerHTML);
        const locMatches = text.match(/<loc>\s*(.*?)\s*<\/loc>/gi) || [];
        for (const match of locMatches) {
          const inner = match.replace(/<\/?loc>/gi, '').trim();
          const normalized = normalizeUrl(inner, origin);
          if (normalized && isSameOrigin(normalized, origin)) {
            sitemapUrls.add(normalized);
          }
        }
      }
    } catch {}
  }

  await utilPage.close();

  // Add sitemap URLs to seed
  for (const u of sitemapUrls) seedUrls.add(u);

  // 3. BFS crawl starting from all discovered URLs
  const results = await crawlLinks(browser, origin, Array.from(seedUrls), {
    maxPages,
    skipPaths,
    delay: effectiveDelay,
    disallowed: robots.disallowed,
  });

  return results;
}

module.exports = { crawl };
