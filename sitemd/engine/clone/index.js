/**
 * clone/index.js — Orchestrator for website cloning.
 *
 * Wires together: crawl → extract → map → assets → report.
 */

const { URL } = require('url');
const { crawl } = require('./crawl');
const { extract } = require('./extract');
const { mapPage, mapMeta, mapHeader, mapFooter, mapGroups, mapTheme } = require('./map');
const { downloadAssets } = require('./assets');

// ---------------------------------------------------------------------------
// Puppeteer availability check
// ---------------------------------------------------------------------------

function requirePuppeteer() {
  try {
    return require('puppeteer');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main clone function
// ---------------------------------------------------------------------------

/**
 * Clone a website: crawl, extract, map, download assets, return report.
 *
 * @param {string} url - Target website URL
 * @param {string} root - sitemd project root directory
 * @param {object} opts - { maxPages, skipPaths, includeAssets }
 * @returns {Promise<object>} Structured clone report
 */
async function clone(url, root, opts = {}) {
  const puppeteer = requirePuppeteer();
  if (!puppeteer) {
    return {
      error: true,
      message: 'Puppeteer is not installed. Run `npm install puppeteer` in the project directory, then try again.',
    };
  }

  const maxPages = Math.min(opts.maxPages || 50, 200);
  const skipPaths = opts.skipPaths || [];
  const includeAssets = opts.includeAssets !== false;

  // Normalize URL
  let targetUrl = url;
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;
  const origin = new URL(targetUrl).origin;

  const warnings = [];
  const unmapped = [];

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // --- Phase 1: Crawl ---
    const crawledPages = await crawl(browser, targetUrl, { maxPages, skipPaths });

    if (!crawledPages.length) {
      return {
        error: true,
        message: `Could not reach ${targetUrl}. Check the URL and try again.`,
      };
    }

    // Separate successful pages from failures
    const goodPages = crawledPages.filter(p => p.html && p.statusCode < 400);
    const failedPages = crawledPages.filter(p => !p.html || p.statusCode >= 400);

    for (const fp of failedPages) {
      unmapped.push({
        url: fp.url,
        reason: fp.statusCode >= 400 ? `HTTP ${fp.statusCode}` : (fp.error || 'Empty content'),
      });
    }

    // --- Phase 2: Extract ---
    const extracted = await extract(browser, goodPages, origin);

    // --- Phase 3: Map ---
    const mappedPages = extracted.pages.map(p => mapPage(p, origin));

    const site = {
      ...mapMeta(extracted.site),
      ...mapTheme(extracted.site),
      logo: extracted.site.logo || null,
      suggestedMode: guessSiteMode(extracted.site),
    };

    const navigation = {
      header: mapHeader(extracted.navigation, origin),
      footer: mapFooter(extracted.footer, origin),
    };

    const groups = mapGroups(mappedPages);

    // Collect page-level warnings
    for (const page of mappedPages) {
      for (const w of page.warnings) {
        warnings.push(`${page.slug}: ${w}`);
      }
    }

    // --- Phase 4: Assets ---
    let assets = { downloaded: 0, skipped: 0, items: [] };
    if (includeAssets) {
      assets = await downloadAssets(browser, mappedPages, root, origin);
    }

    // --- Build report ---
    return {
      source: targetUrl,
      crawled: crawledPages.length,
      site,
      navigation,
      groups,
      pages: mappedPages.map(p => ({
        sourceUrl: p.sourceUrl,
        slug: p.slug,
        title: p.title,
        description: p.description,
        type: p.type,
        content: p.content,
        groupMember: p.groupMember,
        components: p.components,
        confidence: p.confidence,
        warnings: p.warnings,
      })),
      assets,
      warnings,
      unmapped,
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}

// ---------------------------------------------------------------------------
// Theme mode heuristic
// ---------------------------------------------------------------------------

function guessSiteMode(siteData) {
  return 'light';
}

module.exports = { clone };
