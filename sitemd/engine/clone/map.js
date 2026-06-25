/**
 * map.js — Convert extracted page data into sitemd markdown and settings.
 *
 * Pure functions: structured intermediate data → sitemd-ready output.
 */

const { URL } = require('url');

// ---------------------------------------------------------------------------
// Slug derivation
// ---------------------------------------------------------------------------

function urlToSlug(pageUrl, origin) {
  const pathname = new URL(pageUrl).pathname;
  let slug = pathname === '/' ? '/' : pathname;
  // Strip trailing slash
  if (slug !== '/' && slug.endsWith('/')) slug = slug.slice(0, -1);
  // Ensure leading slash
  if (!slug.startsWith('/')) slug = '/' + slug;
  return slug;
}

// ---------------------------------------------------------------------------
// Section → Markdown
// ---------------------------------------------------------------------------

function sectionToMarkdown(section, origin) {
  switch (section.type) {
    case 'heading':
      return '#'.repeat(section.level) + ' ' + section.text;

    case 'paragraph':
      return section.text;

    case 'list': {
      return section.items.map((item, i) => {
        const prefix = section.ordered ? `${i + 1}. ` : '- ';
        return prefix + item;
      }).join('\n');
    }

    case 'image':
      return `![${section.alt || ''}](${section.src})`;

    case 'code':
      return '```' + (section.lang || '') + '\n' + section.text + '\n```';

    case 'table': {
      if (!section.rows.length) return '';
      const header = section.rows[0];
      const divider = header.map(() => '---');
      const body = section.rows.slice(1);
      const lines = [
        '| ' + header.join(' | ') + ' |',
        '| ' + divider.join(' | ') + ' |',
        ...body.map(row => '| ' + row.join(' | ') + ' |'),
      ];
      return lines.join('\n');
    }

    case 'blockquote':
      return section.text.split('\n').map(line => '> ' + line).join('\n');

    case 'hr':
      return '---';

    case 'iframe': {
      const src = section.src;
      // Clean embed URLs to canonical form
      const cleaned = cleanEmbedSrc(src);
      if (isKnownEmbed(cleaned)) {
        return `embed: ${cleaned}`;
      }
      // Generic iframe — inline HTML
      return `<iframe src="${src}" width="100%" height="400" frameborder="0"></iframe>`;
    }

    case 'form':
      return mapForm(section);

    case 'cards':
      return mapCards(section.items, origin);

    case 'button': {
      const href = resolveHref(section.href, origin);
      return `button: ${section.label}: ${href}`;
    }

    case 'details':
      return `<details>\n<summary>${section.summary}</summary>\n\n${section.body}\n\n</details>`;

    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Embed helpers
// ---------------------------------------------------------------------------

function cleanEmbedSrc(src) {
  // YouTube embed → watch
  const ytEmbed = src.match(/youtube\.com\/embed\/([^?&#]+)/);
  if (ytEmbed) return `https://www.youtube.com/watch?v=${ytEmbed[1]}`;
  // Vimeo embed
  const vimeoEmbed = src.match(/player\.vimeo\.com\/video\/(\d+)/);
  if (vimeoEmbed) return `https://vimeo.com/${vimeoEmbed[1]}`;
  // Spotify embed
  const spotifyEmbed = src.match(/open\.spotify\.com\/embed\/(track|album|playlist|episode)\/([^?]+)/);
  if (spotifyEmbed) return `https://open.spotify.com/${spotifyEmbed[1]}/${spotifyEmbed[2]}`;
  return src;
}

function isKnownEmbed(url) {
  const patterns = [
    /youtube\.com\/watch/i,
    /youtu\.be\//i,
    /vimeo\.com\/\d/i,
    /open\.spotify\.com\//i,
    /codepen\.io\//i,
    /x\.com\/\w+\/status\//i,
    /twitter\.com\/\w+\/status\//i,
    /reddit\.com\/r\//i,
    /instagram\.com\/(p|reel)\//i,
    /tiktok\.com\/@/i,
    /linkedin\.com\/(posts|embed)\//i,
  ];
  return patterns.some(p => p.test(url));
}

// ---------------------------------------------------------------------------
// Form mapping
// ---------------------------------------------------------------------------

function mapForm(formSection) {
  const lines = ['form:'];
  lines.push(`  webhook: ${formSection.action || 'https://your-webhook-url.com'}`);
  lines.push(`  submitLabel: ${formSection.submitLabel || 'Submit'}`);
  lines.push('  fields:');

  for (const field of formSection.fields) {
    lines.push(`    - id: ${field.id}`);
    lines.push(`      type: ${field.type}`);
    if (field.label) lines.push(`      label: ${field.label}`);
    if (field.placeholder) lines.push(`      placeholder: ${field.placeholder}`);
    if (field.required) lines.push('      required: true');
    if (field.options && field.options.length) {
      lines.push('      options:');
      for (const opt of field.options) {
        lines.push(`        - ${opt}`);
      }
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Card mapping
// ---------------------------------------------------------------------------

function mapCards(items, origin) {
  const blocks = [];
  for (const card of items) {
    const lines = [];
    lines.push(`card: ${card.title || 'Untitled'}`);
    if (card.text) lines.push(`card-text: ${card.text}`);
    if (card.image) lines.push(`card-image: ${card.image}`);
    if (card.link) {
      const href = resolveHref(card.link.href, origin);
      lines.push(`card-link: ${card.link.label || 'Learn more'}: ${href}`);
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

// ---------------------------------------------------------------------------
// Href resolution
// ---------------------------------------------------------------------------

function resolveHref(href, origin) {
  if (!href || href === '#') return '#';
  try {
    const u = new URL(href, origin);
    // If same origin, use relative path
    if (u.origin === origin) {
      return u.pathname;
    }
    return u.href;
  } catch {
    return href;
  }
}

// ---------------------------------------------------------------------------
// Page mapping
// ---------------------------------------------------------------------------

/**
 * Convert extracted page data to sitemd page format.
 */
function mapPage(pageData, origin) {
  const slug = urlToSlug(pageData.url, origin);
  const sections = pageData.sections || [];

  // Build markdown body
  const bodyParts = [];
  const components = new Set();

  for (const section of sections) {
    const md = sectionToMarkdown(section, origin);
    if (md) {
      bodyParts.push(md);
      // Track component types used
      if (section.type === 'cards') components.add('cards');
      if (section.type === 'button') components.add('buttons');
      if (section.type === 'form') components.add('forms');
      if (section.type === 'iframe') components.add('embeds');
      if (section.type === 'image') components.add('images');
    }
  }

  const content = bodyParts.join('\n\n');

  // Calculate confidence based on content quality
  let confidence = 1.0;
  if (!pageData.title) confidence -= 0.1;
  if (sections.length === 0) confidence -= 0.5;
  if (content.length < 50) confidence -= 0.2;
  if (pageData.warnings && pageData.warnings.length > 0) confidence -= 0.05 * pageData.warnings.length;
  confidence = Math.max(0, Math.min(1, confidence));

  // Determine group membership
  const groupMember = [];
  if (pageData.type === 'blog') groupMember.push('blog');
  if (pageData.type === 'docs') groupMember.push('docs');

  return {
    sourceUrl: pageData.url,
    slug,
    title: pageData.title || slug.slice(1) || 'Untitled',
    description: (pageData.description || '').slice(0, 160),
    type: pageData.type,
    content,
    groupMember,
    components: Array.from(components),
    confidence: Math.round(confidence * 100) / 100,
    warnings: pageData.warnings || [],
    images: pageData.images || [],
  };
}

// ---------------------------------------------------------------------------
// Settings mapping
// ---------------------------------------------------------------------------

function mapMeta(siteData) {
  return {
    title: siteData.title || '',
    brandName: siteData.title || '',
    description: siteData.description || '',
  };
}

function mapHeader(navItems, origin) {
  return navItems.map(item => {
    const href = resolveHref(item.href, origin);
    const entry = { label: item.label, slug: href };
    if (item.children && item.children.length) {
      entry.children = item.children.map(child => ({
        label: child.label,
        slug: resolveHref(child.href, origin),
      }));
    }
    return entry;
  });
}

function mapFooter(footerData, origin) {
  const result = {};
  if (footerData.copyright) result.copyright = footerData.copyright;
  if (footerData.socialLinks && footerData.socialLinks.length) {
    result.social = {};
    for (const s of footerData.socialLinks) {
      result.social[s.platform] = s.url;
    }
  }
  return result;
}

function mapGroups(pages) {
  const groups = {};
  for (const page of pages) {
    if (page.type === 'blog' && !groups.blog) {
      groups.blog = { name: 'blog', items: [] };
    }
    if (page.type === 'docs' && !groups.docs) {
      groups.docs = { name: 'docs', items: [] };
    }
    if (page.type === 'blog') {
      groups.blog.items.push({ label: page.title, slug: page.slug });
    }
    if (page.type === 'docs') {
      groups.docs.items.push({ label: page.title, slug: page.slug });
    }
  }
  return Object.values(groups);
}

function mapTheme(siteData) {
  return {};
}

module.exports = { mapPage, mapMeta, mapHeader, mapFooter, mapGroups, mapTheme };
