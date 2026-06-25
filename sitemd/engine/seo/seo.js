const fs = require('fs');
const path = require('path');
const { buildJsonLd } = require('./jsonld');

// Check if Sharp is available (for favicon link generation)
const { requireExternal } = require('../build/modules');
let _sharpAvailable = !!requireExternal('sharp');

// ---------------------------------------------------------------------------
// SEO — meta tags, Open Graph, Twitter Cards, structured data, sitemap,
//        robots.txt, llms.txt, and custom images support
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Derive description from markdown body
// ---------------------------------------------------------------------------
function deriveDescription(markdownBody) {
  if (!markdownBody) return '';

  const paragraphs = markdownBody.split(/\n{2,}/);
  for (const p of paragraphs) {
    const trimmed = p.trim();
    // Skip headings, code fences, embeds, buttons, anchors, HTML-only, empty
    if (!trimmed) continue;
    if (/^#{1,6}\s/.test(trimmed)) continue;
    if (/^`{3,}/.test(trimmed)) continue;
    if (/^(embed|button):\s/i.test(trimmed)) continue;
    if (/^\{#[a-z0-9-]+\}$/.test(trimmed)) continue;
    if (/^<[^>]+>$/.test(trimmed)) continue;
    if (/^---+$/.test(trimmed)) continue;
    if (/^\|/.test(trimmed)) continue;

    // Strip markdown formatting
    let text = trimmed
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')    // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → text
      .replace(/(\*\*|__)(.*?)\1/g, '$2')      // bold
      .replace(/(\*|_)(.*?)\1/g, '$2')          // italic
      .replace(/`([^`]+)`/g, '$1')              // inline code
      .replace(/<[^>]+>/g, '')                  // HTML tags
      .replace(/\s+/g, ' ')                     // collapse whitespace
      .trim();

    if (!text) continue;

    if (text.length <= 155) return text;

    // Truncate at last space before 155
    const cut = text.lastIndexOf(' ', 155);
    return text.slice(0, cut > 80 ? cut : 155).replace(/[.,;:!?\s]+$/, '');
  }

  return '';
}

// ---------------------------------------------------------------------------
// HTML-escape for attribute values
// ---------------------------------------------------------------------------
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Resolve SEO data for a single page
// ---------------------------------------------------------------------------
function resolveSeoData(page, config) {
  const meta = page.meta || {};
  const slug = page.slug;
  const isHome = slug === '/' || slug === '/index';

  // Title — homepage uses site title only, others use title + suffix
  const pageTitle = page.title || config.title;
  const rawSuffix = meta.titleSuffix != null ? meta.titleSuffix : (config.seoTitleSuffix || '');
  const titleSuffix = rawSuffix === 'none' ? '' : (rawSuffix && !rawSuffix.startsWith(' ') ? ' ' + rawSuffix : rawSuffix);
  const formattedTitle = isHome
    ? pageTitle
    : pageTitle + titleSuffix;

  // Tab title — independent browser tab control
  const tabBase = meta.tabTitle || pageTitle;
  const rawTabSuffix = meta.tabTitleSuffix != null ? meta.tabTitleSuffix : rawSuffix;
  const tabSuffix = rawTabSuffix === 'none' ? '' : (rawTabSuffix && !rawTabSuffix.startsWith(' ') ? ' ' + rawTabSuffix : rawTabSuffix);
  const tabFormattedTitle = isHome
    ? tabBase
    : tabBase + tabSuffix;

  // Description
  const description = page.description || config.description;

  // Canonical
  const canonical = meta.canonical || (config.url + (isHome ? '/' : slug));

  // OG type
  let ogType = meta.ogType || 'website';
  if (!meta.ogType) {
    if (slug.startsWith('/blog/') || slug.startsWith('/changelog/')) ogType = 'article';
  }

  // Schema type
  let schemaType = meta.schemaType || 'WebPage';
  if (!meta.schemaType) {
    if (isHome) schemaType = 'WebSite';
    else if (slug.startsWith('/blog/')) schemaType = 'BlogPosting';
    else if (slug.startsWith('/docs/')) schemaType = 'TechArticle';
    else if (slug.startsWith('/changelog/')) schemaType = 'Article';
    else if (slug.startsWith('/guides/') || slug.startsWith('/tutorials/')) schemaType = 'HowTo';
    else if (slug.startsWith('/team/') || slug.startsWith('/about/team/')) schemaType = 'ProfilePage';
  }

  // Image — frontmatter override > ogImage setting (auto or custom path)
  let image = meta.image || '';
  if (!image && config.ogImage === 'auto') {
    image = '/og/default.png';
  } else if (!image && config.ogImage && config.ogImage !== 'auto' && config.ogImage !== 'none') {
    image = config.ogImage;
  }
  // Make image absolute
  if (image && !image.startsWith('http')) {
    image = config.url + (image.startsWith('/') ? '' : '/') + image;
  }

  // File mtime for updated fallback
  let updated = meta.updated || '';
  if (!updated && page.filePath) {
    try {
      const stat = fs.statSync(page.filePath);
      updated = stat.mtime.toISOString().split('T')[0];
    } catch (e) { /* ignore */ }
  }

  // FAQ auto-detection: 3+ H3 headings ending with ? followed by paragraph text
  let faqItems = [];
  if (schemaType === 'WebPage' && !meta.schemaType && page.body) {
    faqItems = extractFaqItems(page.body);
    if (faqItems.length >= 3) schemaType = 'FAQPage';
  }

  // HowTo step extraction from ordered lists or H3 headings
  let howToSteps = [];
  if (schemaType === 'HowTo' && page.body) {
    howToSteps = extractHowToSteps(page.body);
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
    faqItems,
    howToSteps,
    appName: meta.appName || '',
    appCategory: meta.appCategory || '',
    appOS: meta.appOS || '',
  };
}

/**
 * Extract FAQ items from markdown: H3 headings ending with ? followed by paragraph text.
 */
function extractFaqItems(body) {
  const items = [];
  const lines = body.split('\n');
  let currentQuestion = null;
  let answerLines = [];

  for (const line of lines) {
    const questionMatch = line.match(/^###\s+(.+\?)\s*$/);
    if (questionMatch) {
      if (currentQuestion && answerLines.length) {
        items.push({ question: currentQuestion, answer: answerLines.join(' ').trim() });
      }
      currentQuestion = questionMatch[1];
      answerLines = [];
    } else if (currentQuestion) {
      const trimmed = line.trim();
      if (trimmed === '' && answerLines.length) {
        // End of answer paragraph
        items.push({ question: currentQuestion, answer: answerLines.join(' ').trim() });
        currentQuestion = null;
        answerLines = [];
      } else if (trimmed && !trimmed.startsWith('#')) {
        // Strip markdown formatting for clean text
        const clean = trimmed
          .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
          .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
          .replace(/(\*\*|__)(.*?)\1/g, '$2')
          .replace(/(\*|_)(.*?)\1/g, '$2')
          .replace(/`([^`]+)`/g, '$1');
        answerLines.push(clean);
      }
    }
  }

  // Flush last item
  if (currentQuestion && answerLines.length) {
    items.push({ question: currentQuestion, answer: answerLines.join(' ').trim() });
  }

  return items;
}

/**
 * Extract HowTo steps from markdown ordered lists or H3 headings.
 */
function extractHowToSteps(body) {
  const steps = [];

  // Try ordered list items first (1. Step text)
  const listMatches = body.match(/^\d+\.\s+.+$/gm);
  if (listMatches && listMatches.length >= 2) {
    for (const match of listMatches) {
      const text = match.replace(/^\d+\.\s+/, '').trim();
      if (text) steps.push(text);
    }
    return steps;
  }

  // Fall back to H3 headings as step names
  const headingMatches = body.match(/^###\s+.+$/gm);
  if (headingMatches) {
    for (const match of headingMatches) {
      const text = match.replace(/^###\s+/, '').trim();
      if (text) steps.push(text);
    }
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Generate SEO HTML for {{seo}} placeholder
// ---------------------------------------------------------------------------
function generateSeoHtml(seoData, config) {
  const lines = [];

  // Canonical
  lines.push(`<link rel="canonical" href="${esc(seoData.canonical)}">`);

  // Open Graph
  lines.push(`<meta property="og:title" content="${esc(seoData.ogTitle)}">`);
  lines.push(`<meta property="og:description" content="${esc(seoData.ogDescription)}">`);
  lines.push(`<meta property="og:url" content="${esc(seoData.canonical)}">`);
  lines.push(`<meta property="og:type" content="${esc(seoData.ogType)}">`);
  lines.push(`<meta property="og:site_name" content="${esc(config.brandName || config.title)}">`);
  if (seoData.image) {
    lines.push(`<meta property="og:image" content="${esc(seoData.image)}">`);
    lines.push(`<meta property="og:image:width" content="1200">`);
    lines.push(`<meta property="og:image:height" content="630">`);
  }

  // Twitter Cards
  lines.push(`<meta name="twitter:card" content="${seoData.image ? 'summary_large_image' : 'summary'}">`);
  lines.push(`<meta name="twitter:title" content="${esc(seoData.ogTitle)}">`);
  lines.push(`<meta name="twitter:description" content="${esc(seoData.ogDescription)}">`);
  if (seoData.image) {
    lines.push(`<meta name="twitter:image" content="${esc(seoData.image)}">`);
  }
  if (config.twitterHandle) {
    lines.push(`<meta name="twitter:site" content="${esc(config.twitterHandle)}">`);
  }

  // Per-page robots
  if (seoData.robots) {
    lines.push(`<meta name="robots" content="${esc(seoData.robots)}">`);
  }

  // Favicon links — emitted when Sharp is available (favicons auto-generated)
  if (_sharpAvailable) {
    lines.push(`<link rel="icon" href="/favicon.svg" type="image/svg+xml">`);
    lines.push(`<link rel="icon" href="/favicon.ico" sizes="48x48">`);
    lines.push(`<link rel="apple-touch-icon" href="/apple-touch-icon.png">`);
  }

  // Markdown alternate link (for AI crawlers and LLM tools)
  if (config.markdownOutput) {
    const mdUrl = seoData.isHome
      ? config.url + '/index.md'
      : config.url + seoData.slug + '/index.md';
    lines.push(`<link rel="alternate" type="text/markdown" href="${esc(mdUrl)}">`);
  }

  // JSON-LD structured data
  if (config.structuredData) {
    const jsonLd = buildJsonLd(seoData, config);
    lines.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);
  }

  return lines.join('\n  ');
}

// ---------------------------------------------------------------------------
// Enhanced sitemap.xml with <lastmod>
// ---------------------------------------------------------------------------
function generateSitemap(pages, config) {
  const urls = pages.map(p => {
    const loc = p.slug === '/' ? config.url + '/' : config.url + p.slug;
    const seo = p.seoData || {};
    const lastmod = seo.updated ? `\n    <lastmod>${seo.updated}</lastmod>` : '';
    // Exclude noindex pages
    if (seo.robots && seo.robots.includes('noindex')) return null;
    return `  <url>\n    <loc>${loc}</loc>${lastmod}\n  </url>`;
  }).filter(Boolean);

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// ---------------------------------------------------------------------------
// Enhanced robots.txt with AI crawler directives
// ---------------------------------------------------------------------------
function generateRobotsTxt(config) {
  const lines = ['User-agent: *', 'Allow: /'];
  if (config.sitemap) {
    lines.push(`Sitemap: ${config.url}/sitemap.xml`);
  }

  // AI crawler directives
  const aiBots = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Amazonbot', 'CCBot'];
  const directive = config.allowAICrawlers ? 'Allow: /' : 'Disallow: /';
  lines.push('');
  for (const bot of aiBots) {
    lines.push(`User-agent: ${bot}`);
    lines.push(directive);
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// llms.txt generation
// ---------------------------------------------------------------------------
function generateLlmsTxt(pages, config) {
  const lines = [];
  lines.push(`# ${config.title}`);
  lines.push('');
  lines.push(`> ${config.description}`);
  lines.push('');

  // Group pages by top-level directory
  const groups = {};
  for (const p of pages) {
    const seo = p.seoData || {};
    if (seo.robots && seo.robots.includes('noindex')) continue;

    const slug = p.slug;
    const parts = slug.replace(/^\//, '').split('/');
    const group = parts.length > 1 ? parts[0] : '_root';
    if (!groups[group]) groups[group] = [];

    const baseUrl = slug === '/' ? config.url + '/' : config.url + slug;
    // Link to .md version when markdown output is enabled
    const url = config.markdownOutput
      ? (slug === '/' ? config.url + '/index.md' : config.url + slug + '/index.md')
      : baseUrl;
    const desc = seo.description || p.description || '';
    groups[group].push({ title: p.title, url, desc });
  }

  // Output grouped pages
  const order = Object.keys(groups).sort((a, b) => {
    if (a === '_root') return 1;
    if (b === '_root') return -1;
    return a.localeCompare(b);
  });

  for (const group of order) {
    const heading = group === '_root' ? 'Pages' : group.charAt(0).toUpperCase() + group.slice(1);
    lines.push(`## ${heading}`);
    lines.push('');
    for (const page of groups[group]) {
      const suffix = page.desc ? `: ${page.desc}` : '';
      lines.push(`- [${page.title}](${page.url})${suffix}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// llms-full.txt generation — full markdown content of every page
// ---------------------------------------------------------------------------
function generateLlmsFullTxt(pages, config) {
  const lines = [];
  lines.push(`# ${config.title}`);
  lines.push('');
  lines.push(`> ${config.description}`);
  lines.push('');

  for (const p of pages) {
    const seo = p.seoData || {};
    if (seo.robots && seo.robots.includes('noindex')) continue;
    if (!p.body || !p.body.trim()) continue;

    const url = p.slug === '/' ? config.url + '/' : config.url + p.slug;
    lines.push('---');
    lines.push('');
    lines.push(`## ${p.title}`);
    lines.push(`Source: ${url}`);
    lines.push('');
    lines.push(p.body.trim());
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Copy media/ to site root
// ---------------------------------------------------------------------------
function copyCustomImages(root, config) {
  const mediaDir = path.join(root, 'media');
  if (!fs.existsSync(mediaDir)) return;

  const dist = path.join(root, config.outputDir, 'media');
  const skip = new Set(['.gitkeep', 'README.md']);

  function copyRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  fs.mkdirSync(dist, { recursive: true });
  copyRecursive(mediaDir, dist);
}

// ---------------------------------------------------------------------------
// RSS feed generation — per-group feeds for any group with feed: true
// ---------------------------------------------------------------------------

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc2822(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toUTCString();
}

function generateFeeds(pages, config) {
  const groups = config.groups || {};
  const feedGroups = Object.entries(groups).filter(([, g]) => g.feed === true);
  if (!feedGroups.length) return [];

  const feeds = [];

  for (const [groupName, group] of feedGroups) {
    // Filter pages belonging to this group
    const groupPages = pages.filter(p => {
      const members = Array.isArray(p.meta.groupMember) ? p.meta.groupMember : [];
      return members.some(m => {
        const name = typeof m === 'string' ? (m.includes(':') ? m.split(':')[0].trim() : m.trim()) : '';
        return name === groupName;
      });
    });

    // Exclude noindex pages and group index pages from feed
    const indexPage = group.indexPage;
    const feedPages = groupPages.filter(p => {
      const seo = p.seoData || {};
      if (seo.robots && seo.robots.includes('noindex')) return false;
      if (indexPage && p.relativePath === indexPage) return false;
      return true;
    });

    // Sort by published date descending (unpublished last)
    feedPages.sort((a, b) => {
      const da = a.meta.published ? new Date(a.meta.published).getTime() : 0;
      const db = b.meta.published ? new Date(b.meta.published).getTime() : 0;
      return db - da;
    });

    // Cap at 50 items
    const items = feedPages.slice(0, 50);

    // Determine group display title (capitalize first letter)
    const groupTitle = groupName.charAt(0).toUpperCase() + groupName.slice(1);
    const channelTitle = `${groupTitle} — ${config.brandName}`;
    const channelLink = `${config.url}/${groupName}`;
    const feedUrl = `${config.url}/${groupName}/feed.xml`;
    const lastBuildDate = toRfc2822(new Date().toISOString());

    const itemsXml = items.map(p => {
      const link = p.slug === '/' ? config.url + '/' : config.url + p.slug;
      const pubDate = toRfc2822(p.meta.published);
      const pubDateTag = pubDate ? `\n      <pubDate>${pubDate}</pubDate>` : '';
      const content = p.renderedContent
        ? `\n      <content:encoded><![CDATA[${p.renderedContent}]]></content:encoded>`
        : '';
      // Strip titleSuffix from feed item titles (e.g. " — sitemd" or " | My Site")
      let itemTitle = p.title;
      const suffix = p.meta.titleSuffix;
      if (suffix && itemTitle.endsWith(suffix.trim())) {
        itemTitle = itemTitle.slice(0, -suffix.trim().length).trim();
      }
      return `    <item>
      <title>${escapeXml(itemTitle)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>${pubDateTag}
      <description>${escapeXml(p.description || '')}</description>${content}
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>${escapeXml(config.description || '')}</description>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <language>${config.language || 'en'}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${itemsXml}
  </channel>
</rss>
`;

    feeds.push({ path: `${groupName}/feed.xml`, xml, groupName, groupTitle });
  }

  return feeds;
}

module.exports = {
  deriveDescription,
  resolveSeoData,
  generateSeoHtml,
  generateSitemap,
  generateRobotsTxt,
  generateLlmsTxt,
  generateLlmsFullTxt,
  copyCustomImages,
  generateFeeds,
};
