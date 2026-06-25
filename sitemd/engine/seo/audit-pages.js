const path = require('path');
const { deriveDescription } = require('./seo');

// ---------------------------------------------------------------------------
// SEO Audit — per-page checks
// ---------------------------------------------------------------------------

// Utility slugs that are not public-facing content — excluded from scoring
const UTILITY_SLUGS = new Set(['/404', '/access-denied', '/maintenance']);

function isExcludedFromAudit(page, config) {
  return page.dirPrefix !== config.pagesDir || UTILITY_SLUGS.has(page.slug);
}

/**
 * Audit individual pages for SEO issues.
 * @param {Array} pages - Array of page objects with meta, body, slug, seo, etc.
 * @param {object} config - Loaded site settings
 * @returns {Array} Array of check results
 */
function auditPages(pages, config) {
  const checks = [];
  const allSlugs = new Set(pages.map(p => p.slug));

  for (const page of pages) {
    const { meta, body, slug, seo } = page;
    const isHome = slug === '/' || slug === '/index';

    // Skip auth pages, account pages, gated pages, and utility pages (404, etc.)
    if (isExcludedFromAudit(page, config)) continue;

    // Title missing
    checks.push({
      name: 'page_title_missing',
      severity: 'error',
      passed: !!meta.title,
      message: meta.title ? `Title: "${meta.title}"` : `${slug} — missing title`,
      why: 'Search engines display your title as the clickable headline in results. Missing titles show the raw URL, which looks broken and gets almost zero clicks.',
      fix: `Add a title field to the frontmatter of ${path.basename(page.filePath)}`,
      slug,
      category: 'meta',
    });

    // Title length
    if (seo.formattedTitle) {
      const len = seo.formattedTitle.length;
      const ok = len >= 10 && len <= 60;
      checks.push({
        name: 'page_title_length',
        severity: 'warning',
        passed: ok,
        message: ok
          ? `${slug} — title is ${len} chars`
          : `${slug} — title is ${len} chars (${len > 60 ? 'over 60, will be truncated' : 'under 10, too vague'})`,
        why: 'Google truncates titles over ~60 characters with "..." — your carefully chosen words get cut off. Under 10 characters is too vague to rank for meaningful queries.',
        fix: len > 60
          ? `Shorten the title or suffix for ${slug} to fit within 60 characters`
          : `Write a more descriptive title for ${slug}`,
        slug,
        category: 'meta',
      });
    }

    // Double suffix
    if (seo.formattedTitle && config.seoTitleSuffix) {
      const suffix = config.seoTitleSuffix.trim();
      if (suffix) {
        const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const count = (seo.formattedTitle.match(new RegExp(escaped, 'g')) || []).length;
        checks.push({
          name: 'page_title_double_suffix',
          severity: 'warning',
          passed: count <= 1,
          message: count > 1
            ? `${slug} — title contains suffix "${suffix}" ${count} times: "${seo.formattedTitle}"`
            : `${slug} — no duplicate suffix`,
          why: 'Double suffixes (e.g. "About | Site | Site") waste title space and look like a bug to both users and search engines.',
          fix: `Remove the duplicate titleSuffix from the frontmatter of ${slug}`,
          slug,
          category: 'meta',
        });
      }
    }

    // Description missing
    const derivedDesc = deriveDescription(body);
    const hasDesc = !!(meta.description || derivedDesc);
    checks.push({
      name: 'page_description_missing',
      severity: 'warning',
      passed: hasDesc,
      message: hasDesc
        ? `${slug} — description present${!meta.description && derivedDesc ? ' (auto-derived)' : ''}`
        : `${slug} — no description and none could be derived from content`,
      why: 'The meta description is your elevator pitch in search results. Without one, Google picks a random sentence from your page — usually not the one you\'d choose.',
      fix: `Add a description field to the frontmatter of ${slug}`,
      slug,
      category: 'meta',
    });

    // Description length
    const descText = meta.description || derivedDesc;
    if (descText) {
      const len = descText.length;
      const ok = len >= 50 && len <= 160;
      checks.push({
        name: 'page_description_length',
        severity: 'warning',
        passed: ok,
        message: ok
          ? `${slug} — description is ${len} chars`
          : `${slug} — description is ${len} chars (${len > 160 ? 'over 160, will be truncated' : 'under 50, too short'})`,
        why: 'Google truncates descriptions over ~160 characters. Under 50 characters wastes the opportunity to convince searchers to click.',
        fix: len > 160
          ? `Trim the description for ${slug} to 160 characters or less`
          : `Expand the description for ${slug} to at least 50 characters`,
        slug,
        category: 'meta',
      });
    }

    // OG image missing (only when global OG is disabled)
    if (config.ogImage === 'none' && !meta.image) {
      checks.push({
        name: 'page_og_image_missing',
        severity: 'warning',
        passed: false,
        message: `${slug} — no social sharing image`,
        why: 'This page has no social sharing image. When shared on social media, it\'ll show a text-only card that\'s easy to scroll past.',
        fix: `Add an image field to the frontmatter of ${slug}, or enable global ogImage in settings/seo.md`,
        slug,
        category: 'social',
      });
    }

    // robots: noindex (informational)
    if (meta.robots && /noindex/i.test(meta.robots)) {
      checks.push({
        name: 'page_robots_noindex',
        severity: 'info',
        passed: false,
        message: `${slug} — marked as noindex (hidden from search engines)`,
        why: 'This page is explicitly hidden from search engines. Confirming this is intentional — if not, remove the robots: noindex directive.',
        fix: `Remove robots: noindex from the frontmatter of ${slug} if this page should be indexed`,
        slug,
        category: 'technical',
      });
    }

    // Alt text missing on images
    if (body) {
      const imageMatches = body.match(/!\[([^\]]*)\]\([^)]+\)/g) || [];
      const missingAlt = imageMatches.filter(m => {
        const alt = m.match(/!\[([^\]]*)\]/);
        return alt && !alt[1].trim();
      });
      if (missingAlt.length > 0) {
        checks.push({
          name: 'page_missing_alt_text',
          severity: 'warning',
          passed: false,
          message: `${slug} — ${missingAlt.length} image${missingAlt.length > 1 ? 's' : ''} without alt text`,
          why: 'Alt text describes images to screen readers and search engines. Missing alt text hurts accessibility compliance and means Google can\'t index your images.',
          fix: `Add descriptive alt text to all images in ${slug}`,
          slug,
          category: 'content',
        });
      }
    }

    // Heading hierarchy (strip code blocks first to avoid false positives)
    // Multiple H1s are allowed — the engine auto-downgrades extras to <h2 class="h1-style">
    // so the rendered HTML always has exactly one true <h1>. Only flag missing H1.
    if (body) {
      const bodyNoCode = body.replace(/```[\s\S]*?```/g, '');
      const h1s = (bodyNoCode.match(/^#\s+.+$/gm) || []).length;
      if (h1s === 0) {
        checks.push({
          name: 'page_heading_hierarchy',
          severity: 'warning',
          passed: false,
          message: `${slug} — no H1 heading`,
          why: 'Search engines use H1 as the primary content signal. Without one, Google has no clear topic anchor for the page.',
          fix: `Add an H1 heading (# Title) to ${slug}. If you don't want it visible, use a hidden block:\n\nhidden:\n# Page Title\n/hidden`,
          slug,
          category: 'content',
        });
      }
    }

    // Broken internal links
    if (body) {
      const linkMatches = body.match(/\[([^\]]*)\]\(\/[^)]+\)/g) || [];
      const brokenLinks = [];
      for (const link of linkMatches) {
        const hrefMatch = link.match(/\]\((\/[^)#\s]+)/);
        if (hrefMatch) {
          // Strip sitemd link modifiers (+newtab, +sametab, +outline, etc.)
          const cleanSlug = hrefMatch[1].replace(/\+[a-z]+(?::[^\s)]+)?/gi, '');
          // Skip asset paths (media, site output, etc.) — only check page slugs
          if (cleanSlug && !cleanSlug.startsWith('/media/') && !cleanSlug.startsWith('/site/') && !allSlugs.has(cleanSlug)) {
            brokenLinks.push(cleanSlug);
          }
        }
      }
      if (brokenLinks.length > 0) {
        checks.push({
          name: 'page_broken_links',
          severity: 'error',
          passed: false,
          message: `${slug} — ${brokenLinks.length} broken link${brokenLinks.length > 1 ? 's' : ''}: ${brokenLinks.join(', ')}`,
          why: 'Broken links create dead ends for both visitors and search engine crawlers. They waste crawl budget and signal a poorly maintained site.',
          fix: `Fix or remove the broken links in ${slug}: ${brokenLinks.join(', ')}`,
          slug,
          category: 'content',
        });
      }
    }

    // Thin content (skip homepage — special pages already excluded above)
    if (body && !isHome) {
      const wordCount = body.replace(/```[\s\S]*?```/g, '').replace(/---/g, '').trim().split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount < 50) {
        checks.push({
          name: 'page_thin_content',
          severity: 'warning',
          passed: false,
          message: `${slug} — only ${wordCount} words of content`,
          why: 'Pages with very little content are unlikely to rank for any meaningful query. Search engines may treat them as low-quality or doorway pages.',
          fix: `Add more substantive content to ${slug} (aim for at least 100 words)`,
          slug,
          category: 'content',
        });
      }
    }
  }

  return checks;
}

module.exports = { auditPages, isExcludedFromAudit, UTILITY_SLUGS };
