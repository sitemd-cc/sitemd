const fs = require('fs');
const path = require('path');
const { findMarkdownFiles } = require('../build/discover');
const { parseFrontmatter } = require('../build/parse');
const { loadSettings } = require('../build/config');
const { resolveSeoData } = require('./seo');

const { auditSettings } = require('./audit-settings');
const { auditPages, isExcludedFromAudit, UTILITY_SLUGS } = require('./audit-pages');
const { auditSiteWide } = require('./audit-site');
const { printSeoSummary } = require('./audit-report');

// ---------------------------------------------------------------------------
// SEO Audit — orchestrator
// ---------------------------------------------------------------------------

/**
 * Run a full SEO audit on the site.
 * @param {string} root - Site content root
 * @param {object} [options]
 * @param {string} [options.scope] - 'all' | 'settings' | 'pages'
 * @param {string[]} [options.slugs] - Audit only these slugs
 * @returns {{ score, summary, settings, pages, siteWide }}
 */
function runSeoAudit(root, options = {}) {
  const scope = options.scope || 'all';
  const config = loadSettings(root);

  const settingsChecks = (scope === 'all' || scope === 'settings')
    ? auditSettings(config)
    : [];

  let pageChecks = [];
  let siteWideChecks = [];

  if (scope === 'all' || scope === 'pages') {
    const pages = loadAllPages(root, config, options.slugs);
    pageChecks = auditPages(pages, config);
    siteWideChecks = auditSiteWide(pages, config);
  }

  const all = [...settingsChecks, ...pageChecks, ...siteWideChecks];
  const summary = { passed: 0, warned: 0, failed: 0, info: 0 };
  for (const c of all) {
    if (c.passed) summary.passed++;
    else if (c.severity === 'error') summary.failed++;
    else if (c.severity === 'warning') summary.warned++;
    else summary.info++;
  }

  // Score: weighted pass rate (errors weight 3x, warnings 2x, info 1x)
  let totalWeight = 0;
  let passedWeight = 0;
  for (const c of all) {
    const w = c.severity === 'error' ? 3 : c.severity === 'warning' ? 2 : 1;
    totalWeight += w;
    if (c.passed) passedWeight += w;
  }
  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 100;

  return { score, summary, settings: settingsChecks, pages: pageChecks, siteWide: siteWideChecks };
}

// ---------------------------------------------------------------------------
// Page discovery — load all pages with metadata and resolved SEO data
// ---------------------------------------------------------------------------

function loadAllPages(root, config, filterSlugs) {
  const pages = [];
  const dirs = [config.pagesDir, 'auth-pages', 'account-pages', 'gated-pages'];

  for (const dir of dirs) {
    const fullDir = path.join(root, dir);
    if (!fs.existsSync(fullDir)) continue;

    for (const f of findMarkdownFiles(fullDir)) {
      const raw = fs.readFileSync(f.filePath, 'utf-8');
      const { meta, body } = parseFrontmatter(raw);

      let slug = meta.slug;
      if (!slug) {
        slug = '/' + f.relativePath.replace(/\.md$/, '').replace(/\\/g, '/');
        if (slug.endsWith('/index')) slug = slug.slice(0, -6) || '/';
      }

      if (filterSlugs && !filterSlugs.includes(slug)) continue;

      const page = {
        meta,
        body,
        slug,
        title: meta.title || '',
        description: meta.description || '',
        filePath: f.filePath,
        dirPrefix: dir,
      };

      // Resolve SEO data using the same logic as the build
      const seo = resolveSeoData(page, config);

      pages.push({ ...page, seo });
    }
  }

  return pages;
}

// ---------------------------------------------------------------------------
// Slug set for broken link detection
// ---------------------------------------------------------------------------

function buildSlugSet(root, config) {
  const slugs = new Set();
  const dirs = [config.pagesDir, 'auth-pages', 'account-pages', 'gated-pages'];
  for (const dir of dirs) {
    const fullDir = path.join(root, dir);
    if (!fs.existsSync(fullDir)) continue;
    for (const f of findMarkdownFiles(fullDir)) {
      const raw = fs.readFileSync(f.filePath, 'utf-8');
      const { meta } = parseFrontmatter(raw);
      let slug = meta.slug;
      if (!slug) {
        slug = '/' + f.relativePath.replace(/\.md$/, '').replace(/\\/g, '/');
        if (slug.endsWith('/index')) slug = slug.slice(0, -6) || '/';
      }
      slugs.add(slug);
    }
  }
  return slugs;
}

// Re-export everything for backward compatibility
module.exports = {
  runSeoAudit,
  printSeoSummary,
  auditSettings,
  auditPages,
  auditSiteWide,
  isExcludedFromAudit,
  UTILITY_SLUGS,
  loadAllPages,
  buildSlugSet,
};
