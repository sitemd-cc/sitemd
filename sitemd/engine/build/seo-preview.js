const path = require('path');
const { deriveDescription } = require('../seo');

// ---------------------------------------------------------------------------
// SEO Preview — dev-only pages showing how search engines / social see a page
// ---------------------------------------------------------------------------

// Common English stop words for keyword extraction
const STOP_WORDS = new Set([
  'a','about','above','after','again','against','all','am','an','and','any','are',
  'as','at','be','because','been','before','being','below','between','both','but',
  'by','can','could','did','do','does','doing','down','during','each','few','for',
  'from','further','get','got','had','has','have','having','he','her','here','hers',
  'herself','him','himself','his','how','i','if','in','into','is','it','its','itself',
  'just','let','like','ll','may','me','might','more','most','must','my','myself',
  'need','no','nor','not','now','of','off','on','once','only','or','other','our',
  'ours','ourselves','out','over','own','re','s','same','she','should','so','some',
  'still','such','t','than','that','the','their','theirs','them','themselves','then',
  'there','these','they','this','those','through','to','too','under','until','up',
  'us','ve','very','want','was','we','were','what','when','where','which','while',
  'who','whom','why','will','with','would','you','your','yours','yourself','yourselves',
  'also','already','always','another','around','away','back','best','better','big',
  'come','day','don','didn','doesn','even','every','first','go','going','good',
  'great','help','here','high','however','ii','iii','keep','know','last','long',
  'look','made','make','many','much','new','next','old','one','part','people',
  'place','put','really','right','said','say','see','set','since','small','take',
  'tell','thing','think','time','two','use','used','using','way','well','went','work',
]);

// ---------------------------------------------------------------------------
// Lightweight SEO data resolution for preview pages
// Self-contained resolver used by the SEO preview system
// ---------------------------------------------------------------------------
function resolvePreviewSeoData(page, config) {
  const meta = page.meta || {};
  const slug = page.slug;
  const isHome = slug === '/' || slug === '/index';

  const pageTitle = page.title || config.title;
  const rawSuffix = meta.titleSuffix != null ? meta.titleSuffix : (config.seoTitleSuffix || '');
  const titleSuffix = rawSuffix === 'none' ? '' : (rawSuffix && !rawSuffix.startsWith(' ') ? ' ' + rawSuffix : rawSuffix);
  const formattedTitle = isHome
    ? pageTitle
    : pageTitle + titleSuffix;

  // Browser tab title — independent of SEO title
  const tabBase = meta.tabTitle || pageTitle;
  const rawTabSuffix = meta.tabTitleSuffix != null ? meta.tabTitleSuffix : rawSuffix;
  const tabSuffix = rawTabSuffix === 'none' ? '' : (rawTabSuffix && !rawTabSuffix.startsWith(' ') ? ' ' + rawTabSuffix : rawTabSuffix);
  const tabFormattedTitle = isHome
    ? tabBase
    : tabBase + tabSuffix;

  const description = page.description || config.description;
  const baseUrl = config.url || 'http://localhost';
  const canonical = meta.canonical || (baseUrl + (isHome ? '/' : slug));

  let ogType = meta.ogType || 'website';
  if (!meta.ogType) {
    if (slug.startsWith('/blog/') || slug.startsWith('/changelog/')) ogType = 'article';
  }

  let schemaType = meta.schemaType || 'WebPage';
  if (!meta.schemaType) {
    if (isHome) schemaType = 'WebSite';
    else if (slug.startsWith('/blog/')) schemaType = 'BlogPosting';
    else if (slug.startsWith('/docs/')) schemaType = 'TechArticle';
    else if (slug.startsWith('/changelog/')) schemaType = 'Article';
    else if (slug.startsWith('/guides/') || slug.startsWith('/tutorials/')) schemaType = 'HowTo';
    else if (slug.startsWith('/team/') || slug.startsWith('/about/team/')) schemaType = 'ProfilePage';
  }

  // FAQ auto-detection: 3+ H3 headings ending with ? in page body
  if (schemaType === 'WebPage' && !meta.schemaType && page.body) {
    const faqHeadings = (page.body.match(/^###\s+.+\?\s*$/gm) || []);
    if (faqHeadings.length >= 3) schemaType = 'FAQPage';
  }

  let image = meta.image || '';
  if (!image && config.ogImage === 'auto') {
    image = '/og/default.png';
  } else if (!image && config.ogImage && config.ogImage !== 'auto' && config.ogImage !== 'none') {
    image = config.ogImage;
  }
  if (image && !image.startsWith('http')) {
    image = baseUrl + (image.startsWith('/') ? '' : '/') + image;
  }

  let updated = meta.updated || '';
  if (!updated && page.filePath) {
    try {
      const fs = require('fs');
      const stat = fs.statSync(page.filePath);
      updated = stat.mtime.toISOString().split('T')[0];
    } catch (e) { /* ignore */ }
  }

  return {
    slug,
    title: pageTitle,
    formattedTitle,
    tabFormattedTitle,
    description,
    canonical,
    ogTitle: meta.ogTitle || formattedTitle,
    ogDescription: meta.ogDescription || description,
    ogType,
    image,
    schemaType,
    author: meta.author || config.defaultAuthor || '',
    published: meta.published || '',
    updated,
    robots: meta.robots || '',
    isHome,
  };
}

// ---------------------------------------------------------------------------
// Extract top keywords from markdown body
// ---------------------------------------------------------------------------
function extractKeywords(html, count) {
  if (!html) return [];
  const limit = count || 15;

  // Extract visible text from rendered HTML (same content Google indexes)
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')  // scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')    // styles
    .replace(/<[^>]+>/g, ' ')                           // all HTML tags
    .replace(/&[a-z0-9#]+;/gi, ' ')                    // HTML entities
    .toLowerCase();

  // Tokenize
  const words = text.split(/[\s,.;:!?()\[\]{}"'`\/\\<>@#$%^&*+=~|]+/).filter(Boolean);
  const freq = new Map();
  for (const word of words) {
    if (word.length < 3) continue;
    if (/^\d+$/.test(word)) continue;
    if (STOP_WORDS.has(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

// ---------------------------------------------------------------------------
// Build meta tags audit list
// ---------------------------------------------------------------------------
function buildMetaAudit(seoData, config) {
  const tags = [];
  const warn = (condition, msg) => condition ? msg : null;

  tags.push({
    tag: 'title',
    value: seoData.tabFormattedTitle,
    limit: 60,
    warning: null,
  });

  tags.push({
    tag: 'meta description',
    value: seoData.description,
    limit: 155,
    warning: !seoData.description
      ? 'Missing \u2014 add description in frontmatter'
      : null,
  });

  tags.push({
    tag: 'canonical',
    value: seoData.canonical,
    warning: warn(!config.url, 'No site URL configured \u2014 canonical will be wrong in production'),
  });

  tags.push({ tag: 'og:title', value: seoData.ogTitle, limit: 60, warning: null });
  tags.push({ tag: 'og:description', value: seoData.ogDescription, limit: 155, warning: null });
  tags.push({ tag: 'og:type', value: seoData.ogType, warning: null });
  tags.push({ tag: 'og:url', value: seoData.canonical, warning: null });
  tags.push({ tag: 'og:site_name', value: config.brandName || config.title, limit: 30, warning: null });

  tags.push({
    tag: 'og:image',
    value: seoData.image || '',
    warning: warn(!seoData.image, 'No OG image \u2014 social shares will have no preview image'),
  });

  const twitterCard = seoData.image ? 'summary_large_image' : 'summary';
  tags.push({ tag: 'twitter:card', value: twitterCard, warning: null });
  tags.push({ tag: 'twitter:title', value: seoData.ogTitle, limit: 70, warning: null });
  tags.push({ tag: 'twitter:description', value: seoData.ogDescription, limit: 200, warning: null });
  if (seoData.image) tags.push({ tag: 'twitter:image', value: seoData.image, warning: null });
  if (config.twitterHandle) tags.push({ tag: 'twitter:site', value: config.twitterHandle, warning: null });

  if (seoData.robots) tags.push({ tag: 'robots', value: seoData.robots, warning: null });

  tags.push({
    tag: 'language',
    value: config.language || 'en',
    warning: null,
  });

  return tags;
}

// ---------------------------------------------------------------------------
// Build simplified JSON-LD preview
// ---------------------------------------------------------------------------
function buildJsonLdPreview(seoData, config) {
  const baseUrl = config.url || 'http://localhost';

  // Breadcrumbs
  const parts = seoData.slug === '/' ? [] : seoData.slug.replace(/^\//, '').split('/');
  const breadcrumbItems = [{ '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl + '/' }];
  let accumulated = '';
  for (let i = 0; i < parts.length; i++) {
    accumulated += '/' + parts[i];
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: i + 2,
      name: i === parts.length - 1 ? seoData.title : parts[i].charAt(0).toUpperCase() + parts[i].slice(1),
      item: baseUrl + accumulated,
    });
  }

  const graph = [
    { '@type': 'BreadcrumbList', itemListElement: breadcrumbItems },
  ];

  // Page schema
  const pageSchema = {
    '@type': seoData.schemaType,
    name: seoData.title,
    description: seoData.description,
    url: seoData.canonical,
  };
  if (seoData.image) pageSchema.image = seoData.image;
  if (seoData.author) pageSchema.author = { '@type': 'Person', name: seoData.author };
  if (seoData.published) pageSchema.datePublished = seoData.published;
  if (seoData.updated) pageSchema.dateModified = seoData.updated;
  graph.push(pageSchema);

  return { '@context': 'https://schema.org', '@graph': graph };
}

// ---------------------------------------------------------------------------
// HTML escape
// ---------------------------------------------------------------------------
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Truncate with ellipsis
// ---------------------------------------------------------------------------
function trunc(str, max) {
  if (!str || str.length <= max) return str || '';
  return str.slice(0, max - 1) + '\u2026';
}

// ---------------------------------------------------------------------------
// Character count badge HTML
// ---------------------------------------------------------------------------
function charBadge(text, limit) {
  const len = (text || '').length;
  let color = '#22c55e'; // green
  if (len > limit) color = '#ef4444'; // red
  else if (len > limit * 0.85) color = '#f59e0b'; // yellow
  return `<span class="seo-char-badge" style="color:${color}">${len}/${limit}</span>`;
}

// ---------------------------------------------------------------------------
// Generate the full SEO preview HTML (content only — wrapped by caller)
// ---------------------------------------------------------------------------
function generatePreviewContent(page, seoData, keywords, metaTags, jsonLd, config) {
  const siteName = config.brandName || config.title;
  const domain = (config.url || 'http://localhost').replace(/^https?:\/\//, '');
  const urlDisplay = domain + (seoData.isHome ? '' : seoData.slug);
  const hasImage = !!seoData.image;
  // In dev, rewrite absolute OG URLs to relative paths the dev server can serve
  let imgSrc = '';
  if (hasImage) {
    let raw = seoData.image;
    // Strip the site's own base URL so the dev server can serve the file
    const baseUrl = config.url || '';
    if (baseUrl && raw.startsWith(baseUrl)) {
      raw = raw.slice(baseUrl.length);
    }
    const ogMatch = raw.match(/\/og\/.+$/);
    imgSrc = esc(ogMatch ? ogMatch[0] : raw);
  }
  const favMode = config.favicon || (config.customFavicon ? 'custom' : 'letter');
  const favIsLetter = favMode === 'letter' || (favMode === 'brand' && !config.brandImage) || (favMode === 'custom' && !config.customFavicon);
  const faviconHref = config.customFavicon ? esc(config.customFavicon) : (favIsLetter ? '/favicon.svg' : '/favicon.ico');
  const isTrial = config._mode === 'trial';

  const placeholderInner = isTrial && config.ogImage === 'auto'
    ? `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span style="max-width:280px;text-align:center;line-height:1.4">OG images are generated during production builds. Set a domain in <code>settings/deploy.md</code> and run <code>sitemd activate</code> to enable.</span>`
    : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span>No OG image</span>`;
  const imagePlaceholder = `<div class="seo-img-placeholder">${placeholderInner}</div>`;

  const parts = [];

  // --- Inline styles ---
  parts.push(`<style>
.seo-preview { max-width: 720px; margin: 0 auto; padding: 2rem 0; }
.seo-preview h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
.seo-preview .seo-back { font-size: 0.875rem; margin-bottom: 2rem; display: inline-block; }
.seo-preview h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted, #6b7280); margin: 2.5rem 0 0.75rem; font-weight: 600; }
.seo-preview h2:first-of-type { margin-top: 1.5rem; }

/* Google SERP */
.seo-google { background: var(--bg, #fff); border: 1px solid var(--border, #dfe1e5); border-radius: 12px; padding: 1.25rem 1.5rem; }
[data-theme="dark"] .seo-google { background: var(--bg, #1e1e1e); border-color: var(--border, #3c3c3c); }
.seo-google-url { font-size: 0.8125rem; color: #202124; display: flex; align-items: center; gap: 0.375rem; margin-bottom: 0.25rem; }
[data-theme="dark"] .seo-google-url { color: #bdc1c6; }
.seo-google-url img { width: 18px; height: 18px; border-radius: 50%; position: relative; top: 8px; }
.seo-google-url .seo-google-domain { color: #202124; }
[data-theme="dark"] .seo-google-url .seo-google-domain { color: #bdc1c6; }
.seo-google-url .seo-google-path { color: #5f6368; font-size: 0.75rem; }
[data-theme="dark"] .seo-google-url .seo-google-path { color: #9aa0a6; }
.seo-google-title { font-size: 1.25rem; color: #1a0dab; text-decoration: none; display: block; margin-bottom: 0.25rem; line-height: 1.3; }
[data-theme="dark"] .seo-google-title { color: #8ab4f8; }
.seo-google-desc { font-size: 0.875rem; color: #4d5156; line-height: 1.5; }
[data-theme="dark"] .seo-google-desc { color: #bdc1c6; }
.seo-char-badge { font-size: 0.6875rem; font-weight: 600; font-family: monospace; margin-left: 0.5rem; }

/* Social cards shared */
.seo-social-card { border: 1px solid var(--border, #dfe1e5); border-radius: 12px; overflow: hidden; max-width: 504px; }
[data-theme="dark"] .seo-social-card { border-color: var(--border, #3c3c3c); }
.seo-img-wrap { position: relative; overflow: hidden; width: 100%; }
.seo-og .seo-img-wrap, .seo-og .seo-img-placeholder { aspect-ratio: 1.91/1; }
.seo-imessage .seo-img-wrap, .seo-imessage .seo-img-placeholder { aspect-ratio: 1.91/1; }
.seo-social-img { width: 100%; height: 100%; object-fit: cover; display: block; position: absolute; top: 0; left: 0; }
.seo-img-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; background: var(--surface, #f3f4f6); color: var(--text-muted, #6b7280); font-size: 0.8125rem; }
[data-theme="dark"] .seo-img-placeholder { background: var(--surface, #2d2d2d); color: var(--text-muted, #9ca3af); }
.seo-og-body { padding: 0.625rem 0.75rem; background: var(--surface, #f0f2f5); }
[data-theme="dark"] .seo-og-body { background: var(--surface, #2d2d2d); }
.seo-og-domain { font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted, #65676b); }
.seo-og-title { font-size: 0.9375rem; font-weight: 600; margin: 0.125rem 0; line-height: 1.3; }
.seo-og-desc { font-size: 0.8125rem; color: var(--text-muted, #65676b); line-height: 1.4; }

/* Mobile */
.seo-imessage { border-radius: 16px; overflow: hidden; max-width: 300px; border: 1px solid var(--border, #dfe1e5); }
[data-theme="dark"] .seo-imessage { border-color: var(--border, #3c3c3c); }
.seo-imessage-body { padding: 0.5rem 0.75rem; background: var(--surface, #e9e9eb); }
[data-theme="dark"] .seo-imessage-body { background: var(--surface, #2d2d2d); }
.seo-imessage-title { font-size: 0.8125rem; font-weight: 600; line-height: 1.3; }
.seo-imessage-domain { font-size: 0.6875rem; color: var(--text-muted, #8e8e93); }

/* Browser tab */
.seo-tab { display: inline-flex; align-items: center; gap: 0.5rem; background: var(--surface, #f3f4f6); border: 1px solid var(--border, #dfe1e5); border-bottom: none; border-radius: 8px 8px 0 0; padding: 0.5rem 1rem 0.5rem 0.75rem; max-width: 240px; font-size: 0.75rem; }
[data-theme="dark"] .seo-tab { background: var(--surface, #2d2d2d); border-color: var(--border, #3c3c3c); }
.seo-tab img { width: 16px; height: 16px; flex-shrink: 0; position: relative; top: 8px; }
.seo-tab-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.seo-tab-bar { height: 3px; background: var(--border, #dfe1e5); border-radius: 0; }
[data-theme="dark"] .seo-tab-bar { background: var(--border, #3c3c3c); }

/* Keywords */
.seo-keywords { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.seo-kw { display: inline-flex; align-items: center; gap: 0.25rem; background: var(--surface, #f3f4f6); border: 1px solid var(--border, #e5e7eb); border-radius: 6px; padding: 0.25rem 0.625rem; font-size: 0.8125rem; }
[data-theme="dark"] .seo-kw { background: var(--surface, #2d2d2d); border-color: var(--border, #3c3c3c); }
.seo-kw-count { font-size: 0.6875rem; opacity: 0.5; font-family: monospace; }

/* Meta audit table */
.seo-audit { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.seo-audit th { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 2px solid var(--border, #e5e7eb); font-weight: 600; }
[data-theme="dark"] .seo-audit th { border-color: var(--border, #3c3c3c); }
.seo-audit td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border, #f3f4f6); vertical-align: top; }
[data-theme="dark"] .seo-audit td { border-color: var(--border, #2d2d2d); }
.seo-audit-tag { font-family: monospace; white-space: nowrap; font-weight: 500; }
.seo-audit-value { word-break: break-all; max-width: 420px; }
.seo-audit-warn { color: #f59e0b; font-size: 0.75rem; display: block; margin-top: 0.125rem; }
.seo-audit-miss { color: #ef4444; font-style: italic; }

/* JSON-LD */
.seo-jsonld { background: var(--surface, #f8f9fa); border: 1px solid var(--border, #e5e7eb); border-radius: 8px; padding: 1rem; font-family: monospace; font-size: 0.75rem; white-space: pre-wrap; word-break: break-word; overflow-x: auto; line-height: 1.6; }
[data-theme="dark"] .seo-jsonld { background: var(--surface, #1e1e1e); border-color: var(--border, #3c3c3c); }

/* Info tooltips */
.seo-info-tip { position: relative; top: -2px; display: inline-flex; align-items: center; justify-content: center; width: 1.125rem; height: 1.125rem; font-size: 0.6875rem; font-weight: 700; font-style: normal; line-height: 1; border-radius: 50%; border: 1.5px solid var(--text-muted, #9ca3af); color: var(--text-muted, #9ca3af); cursor: help; vertical-align: middle; text-transform: none; letter-spacing: 0; margin-left: 0.375rem; }
.seo-info-tip:hover { border-color: var(--text, #374151); color: var(--text, #374151); }
[data-theme="dark"] .seo-info-tip:hover { border-color: var(--text, #e5e7eb); color: var(--text, #e5e7eb); }
.seo-info-tip .seo-tip-text { display: none; position: absolute; left: calc(100% + 0.5rem); top: 50%; transform: translateY(-50%); width: 320px; padding: 0.75rem 1rem; background: var(--bg, #fff); border: 1px solid var(--border, #e5e7eb); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); font-size: 0.75rem; font-weight: 400; line-height: 1.6; text-transform: none; letter-spacing: 0; color: var(--text, #374151); white-space: normal; z-index: 100; }
[data-theme="dark"] .seo-info-tip .seo-tip-text { background: var(--bg, #1e1e1e); border-color: var(--border, #3c3c3c); color: var(--text, #e5e7eb); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
.seo-info-tip:hover .seo-tip-text { display: block; }
.seo-tip-text code { font-size: 0.6875rem; background: var(--surface, #f3f4f6); padding: 0.0625rem 0.25rem; border-radius: 3px; }
[data-theme="dark"] .seo-tip-text code { background: var(--surface, #2d2d2d); }
</style>`);

  // --- Header ---
  parts.push(`<div class="seo-preview">`);
  parts.push(`<h1>SEO Preview</h1>`);
  parts.push(`<a class="seo-back" href="${esc(seoData.isHome ? '/' : seoData.slug)}">&larr; Back to ${esc(page.title)}</a>`);

  // --- Google Search Result ---
  parts.push(`<h2>Search</h2>`);
  parts.push(`<div class="seo-google">`);
  parts.push(`<div class="seo-google-url"><img src="${faviconHref}" alt="" onerror="this.style.display='none'"><span><span class="seo-google-domain">${esc(domain)}</span> <span class="seo-google-path">${esc(seoData.isHome ? '' : seoData.slug)}</span></span></div>`);
  parts.push(`<span class="seo-google-title">${esc(trunc(seoData.formattedTitle, 60))} ${charBadge(seoData.formattedTitle, 60)}</span>`);
  parts.push(`<span class="seo-google-desc">${esc(trunc(seoData.description, 155))} ${charBadge(seoData.description, 155)}</span>`);
  parts.push(`</div>`);

  // --- Social Card (OG / Twitter / Facebook / LinkedIn) ---
  parts.push(`<h2>Social</h2>`);
  parts.push(`<div class="seo-social-card seo-og">`);
  if (hasImage) {
    parts.push(`<div class="seo-img-wrap"><img class="seo-social-img" src="${imgSrc}" alt="" onerror="this.parentNode.style.display='none';this.parentNode.nextElementSibling.style.display='flex';"></div>`);
    parts.push(`<div class="seo-img-placeholder" style="display:none">${placeholderInner}</div>`);
  } else {
    parts.push(imagePlaceholder);
  }
  parts.push(`<div class="seo-og-body">`);
  parts.push(`<div class="seo-og-domain">${esc(domain)}</div>`);
  parts.push(`<div class="seo-og-title">${esc(trunc(seoData.ogTitle, 100))} ${charBadge(seoData.ogTitle, 60)}</div>`);
  parts.push(`<div class="seo-og-desc">${esc(trunc(seoData.ogDescription, 300))} ${charBadge(seoData.ogDescription, 155)}</div>`);
  parts.push(`</div></div>`);

  // --- Mobile Link Preview ---
  parts.push(`<h2>Mobile</h2>`);
  parts.push(`<div class="seo-imessage">`);
  if (hasImage) {
    parts.push(`<div class="seo-img-wrap"><img class="seo-social-img" src="${imgSrc}" alt="" onerror="this.parentNode.style.display='none';this.parentNode.nextElementSibling.style.display='flex';"></div>`);
    parts.push(`<div class="seo-img-placeholder" style="display:none">${placeholderInner}</div>`);
  } else {
    parts.push(imagePlaceholder);
  }
  parts.push(`<div class="seo-imessage-body">`);
  parts.push(`<div class="seo-imessage-title">${esc(trunc(seoData.ogTitle, 80))} ${charBadge(seoData.ogTitle, 60)}</div>`);
  parts.push(`<div class="seo-imessage-domain">${esc(domain)}</div>`);
  parts.push(`</div></div>`);

  // --- Browser Tab ---
  parts.push(`<h2>Browser</h2>`);
  parts.push(`<div><div class="seo-tab"><img src="${faviconHref}" alt="" onerror="this.style.display='none'"><span class="seo-tab-title">${esc(trunc(seoData.tabFormattedTitle, 30))}</span></div>${charBadge(seoData.tabFormattedTitle, 30)}<div class="seo-tab-bar"></div></div>`);

  // --- Keywords ---
  parts.push(`<h2>Keywords</h2>`);
  if (keywords.length > 0) {
    parts.push(`<div class="seo-keywords">`);
    for (const kw of keywords) {
      parts.push(`<span class="seo-kw">${esc(kw.word)} <span class="seo-kw-count">\u00d7${kw.count}</span></span>`);
    }
    parts.push(`</div>`);
  } else {
    parts.push(`<p style="opacity:0.5;font-size:0.875rem">No keywords extracted (page may have minimal content).</p>`);
  }

  // --- Meta Tags Audit ---
  parts.push(`<h2>Meta <span class="seo-info-tip">i<span class="seo-tip-text"><strong>title</strong> / <strong>meta description</strong> \u2014 text shown in search results.<br><strong>canonical</strong> \u2014 preferred URL, prevents duplicate content.<br><strong>og:*</strong> \u2014 Open Graph tags control social share previews (Facebook, LinkedIn, etc.).<br><strong>twitter:card</strong> \u2014 <code>summary_large_image</code> when an OG image is set (large banner), otherwise <code>summary</code> (small thumbnail).<br><strong>robots</strong> \u2014 crawler directives (index, noindex, etc.).</span></span></h2>`);
  parts.push(`<table class="seo-audit"><thead><tr><th>Tag</th><th>Value</th></tr></thead><tbody>`);
  for (const tag of metaTags) {
    const valueHtml = tag.value
      ? `<span class="seo-audit-value">${esc(tag.value)}</span>`
      : `<span class="seo-audit-miss">not set</span>`;
    const badgeHtml = tag.limit && tag.value ? ' ' + charBadge(tag.value, tag.limit) : '';
    const warnHtml = tag.warning ? `<span class="seo-audit-warn">\u26a0 ${esc(tag.warning)}</span>` : '';
    parts.push(`<tr><td class="seo-audit-tag">${esc(tag.tag)}</td><td>${valueHtml}${badgeHtml}${warnHtml}</td></tr>`);
  }
  parts.push(`</tbody></table>`);

  // --- JSON-LD ---
  if (config.structuredData !== false) {
    parts.push(`<h2>Data <span class="seo-info-tip">i<span class="seo-tip-text"><strong>JSON-LD</strong> structured data that search engines use for rich results (stars, breadcrumbs, FAQs, etc.).<br><strong>BreadcrumbList</strong> \u2014 navigation hierarchy derived from the page URL.<br><strong>Page schema</strong> \u2014 type auto-derived from location: <code>BlogPosting</code> for /blog/, <code>TechArticle</code> for /docs/, <code>FAQPage</code> when 3+ question headings are detected, etc.</span></span></h2>`);
    parts.push(`<pre class="seo-jsonld">${esc(JSON.stringify(jsonLd, null, 2))}</pre>`);
  }

  parts.push(`</div>`); // close .seo-preview
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Public API — compute the SEO preview slug for a source page
// ---------------------------------------------------------------------------
function seoPreviewSlugFor(page) {
  const isHome = page.slug === '/' || page.slug === '/index';
  return isHome ? '/seo-preview' : page.slug + '/seo-preview';
}

// ---------------------------------------------------------------------------
// Public API — generate the SEO preview HTML for a single page
// Called lazily by the dev server on first request, not during the build.
// ---------------------------------------------------------------------------
function generateSeoPreviewForPage(page, config) {
  const seoData = resolvePreviewSeoData(page, config);
  const keywords = extractKeywords(page.renderedContent);
  const metaTags = buildMetaAudit(seoData, config);
  const jsonLd = buildJsonLdPreview(seoData, config);
  return generatePreviewContent(page, seoData, keywords, metaTags, jsonLd, config);
}

module.exports = { generateSeoPreviewForPage, seoPreviewSlugFor, extractKeywords, resolvePreviewSeoData };
