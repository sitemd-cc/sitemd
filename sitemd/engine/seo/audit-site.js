const { isExcludedFromAudit } = require('./audit-pages');

// ---------------------------------------------------------------------------
// SEO Audit — site-wide cross-page checks
// ---------------------------------------------------------------------------

/**
 * Run site-wide cross-page SEO checks (duplicates, freshness, schema coverage).
 * @param {Array} pages - Array of page objects with meta, body, slug, seo, etc.
 * @param {object} config - Loaded site settings
 * @returns {Array} Array of check results
 */
function auditSiteWide(pages, config) {
  const checks = [];

  // Filter to only indexable content pages
  const scoredPages = pages.filter(p => !isExcludedFromAudit(p, config));

  // Duplicate titles
  const titleMap = {};
  for (const page of scoredPages) {
    const t = page.seo.formattedTitle;
    if (t) (titleMap[t] = titleMap[t] || []).push(page.slug);
  }
  for (const [title, slugs] of Object.entries(titleMap)) {
    if (slugs.length > 1) {
      checks.push({
        name: 'duplicate_titles',
        severity: 'warning',
        passed: false,
        message: `Duplicate title "${title}" on ${slugs.length} pages: ${slugs.join(', ')}`,
        why: 'Duplicate titles confuse search engines about which page to rank. Google may pick the wrong one or suppress both — cannibalizing your own traffic.',
        fix: `Give each page a unique title: ${slugs.join(', ')}`,
        category: 'meta',
      });
    }
  }

  // Duplicate descriptions
  const descMap = {};
  for (const page of scoredPages) {
    const d = page.seo.description;
    if (d && d.length > 10) (descMap[d] = descMap[d] || []).push(page.slug);
  }
  for (const [desc, slugs] of Object.entries(descMap)) {
    if (slugs.length > 1) {
      checks.push({
        name: 'duplicate_descriptions',
        severity: 'warning',
        passed: false,
        message: `${slugs.length} pages share the same description: ${slugs.join(', ')}`,
        why: 'When multiple pages share a description, search engines can\'t differentiate them in results. Each page should have a unique pitch for its specific content.',
        fix: `Write unique descriptions for: ${slugs.join(', ')}`,
        category: 'meta',
      });
    }
  }

  // Content freshness
  const now = Date.now();
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  const stalePages = [];
  for (const page of scoredPages) {
    if (page.seo.updated) {
      const ts = Date.parse(page.seo.updated);
      if (!isNaN(ts) && (now - ts) > oneYear) {
        stalePages.push(page.slug);
      }
    }
  }
  if (stalePages.length > 0) {
    checks.push({
      name: 'content_freshness',
      severity: 'info',
      passed: false,
      message: `${stalePages.length} page${stalePages.length > 1 ? 's' : ''} not updated in over a year: ${stalePages.join(', ')}`,
      why: 'Search engines use freshness as a ranking signal. Pages with stale dates may be deprioritized in results, especially for queries where recency matters.',
      fix: `Review and update stale pages, or add updated: with today\'s date if the content is still current`,
      category: 'freshness',
    });
  }

  // Structured data coverage
  const genericSchemaPages = scoredPages.filter(p =>
    p.seo.schemaType === 'WebPage' && !p.seo.isHome
  );
  if (genericSchemaPages.length > 0) {
    checks.push({
      name: 'structured_data_coverage',
      severity: 'info',
      passed: false,
      message: `${genericSchemaPages.length} page${genericSchemaPages.length > 1 ? 's' : ''} using generic WebPage schema: ${genericSchemaPages.map(p => p.slug).join(', ')}`,
      why: 'Specific schema types (BlogPosting, TechArticle, FAQPage) unlock rich result features — FAQ dropdowns, how-to carousels, article cards — that generic WebPage doesn\'t qualify for.',
      fix: 'Add schemaType to page frontmatter (e.g. BlogPosting, TechArticle, FAQPage, HowTo)',
      category: 'technical',
    });
  }

  // Blog author missing
  const blogPages = scoredPages.filter(p => {
    if (!p.meta.groupMember) return false;
    const groups = Array.isArray(p.meta.groupMember) ? p.meta.groupMember : [p.meta.groupMember];
    return groups.some(g => (typeof g === 'string' ? g : Object.keys(g)[0]) === 'blog');
  });
  const authorlessBlogPosts = blogPages.filter(p => !p.meta.author && !config.defaultAuthor);
  if (authorlessBlogPosts.length > 0) {
    checks.push({
      name: 'blog_author_missing',
      severity: 'info',
      passed: false,
      message: `${authorlessBlogPosts.length} blog post${authorlessBlogPosts.length > 1 ? 's' : ''} without author attribution: ${authorlessBlogPosts.map(p => p.slug).join(', ')}`,
      why: 'Google\'s E-E-A-T guidelines value author attribution. Blog posts without an author appear less trustworthy and may rank lower for competitive queries.',
      fix: 'Set defaultAuthor in settings/seo.md, or add author: to individual blog post frontmatter',
      category: 'social',
    });
  }

  return checks;
}

module.exports = { auditSiteWide };
