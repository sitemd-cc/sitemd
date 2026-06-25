/**
 * extract.js — Extract structured content from crawled HTML pages.
 *
 * Uses Puppeteer's DOM APIs since pages are already loaded.
 * Produces an intermediate representation that map.js converts to sitemd markdown.
 */

const { URL } = require('url');

// ---------------------------------------------------------------------------
// Social platform detection
// ---------------------------------------------------------------------------

const SOCIAL_DOMAINS = {
  'github.com': 'github',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'linkedin.com': 'linkedin',
  'youtube.com': 'youtube',
  'discord.gg': 'discord',
  'discord.com': 'discord',
  'mastodon.social': 'mastodon',
  'reddit.com': 'reddit',
  'facebook.com': 'facebook',
  'instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
};

function detectSocialPlatform(href) {
  try {
    const hostname = new URL(href).hostname.replace('www.', '');
    return SOCIAL_DOMAINS[hostname] || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Embed URL detection
// ---------------------------------------------------------------------------

const EMBED_PATTERNS = [
  /youtube\.com\/(?:watch|embed)/i,
  /youtu\.be\//i,
  /vimeo\.com\//i,
  /open\.spotify\.com\//i,
  /codepen\.io\//i,
  /x\.com\/\w+\/status\//i,
  /twitter\.com\/\w+\/status\//i,
];

function isEmbedUrl(src) {
  return EMBED_PATTERNS.some(p => p.test(src));
}

function cleanEmbedUrl(src) {
  // YouTube embed → watch URL
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

// ---------------------------------------------------------------------------
// Site-level extraction (run on homepage)
// ---------------------------------------------------------------------------

/**
 * Extract site-level metadata from the homepage.
 */
async function extractSiteData(page, origin) {
  return await page.evaluate((origin) => {
    const result = {
      title: '',
      description: '',
      logo: null,
    };

    // Title
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    result.title = ogSiteName?.content || document.title || '';

    // Description
    const metaDesc = document.querySelector('meta[name="description"]');
    result.description = metaDesc?.content || '';

    // Logo
    const icon = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
    if (icon?.href) result.logo = icon.href;
    if (!result.logo) {
      const headerImg = document.querySelector('header img, nav img');
      if (headerImg?.src) result.logo = headerImg.src;
    }

    return result;
  }, origin);
}

/**
 * Extract navigation structure from header/nav.
 */
async function extractNavigation(page, origin) {
  return await page.evaluate((origin) => {
    const items = [];

    const nav = document.querySelector('nav') || document.querySelector('header');
    if (!nav) return items;

    // Find top-level links
    const topLinks = nav.querySelectorAll(':scope > a, :scope > ul > li > a, :scope > div > a, :scope > div > ul > li > a');

    for (const a of topLinks) {
      const label = a.textContent.trim();
      if (!label) continue;

      const href = a.getAttribute('href') || '';
      // Check for dropdown
      const parent = a.closest('li') || a.parentElement;
      const subLinks = parent?.querySelectorAll('ul a, div[class*="dropdown"] a, div[class*="menu"] a');

      if (subLinks && subLinks.length > 0 && !Array.from(subLinks).includes(a)) {
        const children = [];
        for (const sub of subLinks) {
          const subLabel = sub.textContent.trim();
          const subHref = sub.getAttribute('href') || '';
          if (subLabel) children.push({ label: subLabel, href: subHref });
        }
        items.push({ label, href, children });
      } else {
        items.push({ label, href });
      }
    }

    return items;
  }, origin);
}

/**
 * Extract footer data.
 */
async function extractFooter(page, origin) {
  return await page.evaluate((origin) => {
    const footer = document.querySelector('footer');
    if (!footer) return { copyright: '', links: [], socialLinks: [] };

    // Copyright text
    let copyright = '';
    const allText = footer.innerText;
    const copyMatch = allText.match(/(?:©|copyright)\s*(?:\d{4}\s*[-–]?\s*)?\d{4}?\s*[^.\n]*/i);
    if (copyMatch) copyright = copyMatch[0].trim();

    // All links
    const links = [];
    const socialLinks = [];
    for (const a of footer.querySelectorAll('a[href]')) {
      const label = a.textContent.trim() || a.getAttribute('aria-label') || '';
      const href = a.getAttribute('href') || '';
      if (label || href) {
        links.push({ label, href });
      }
    }

    return { copyright, links, socialLinks };
  }, origin);
}

// ---------------------------------------------------------------------------
// Page-level extraction
// ---------------------------------------------------------------------------

/**
 * Detect the page type from URL and content patterns.
 */
function detectPageType(url, html) {
  const pathname = new URL(url).pathname.toLowerCase();

  if (/\/(blog|posts|articles)\b/.test(pathname)) return 'blog';
  if (/\/(docs|documentation|guide|reference)\b/.test(pathname)) return 'docs';
  if (/\/changelog\b/.test(pathname)) return 'changelog';
  if (/\/roadmap\b/.test(pathname)) return 'roadmap';

  return 'standard';
}

/**
 * Extract structured content from a single page.
 * Returns intermediate representation for map.js.
 */
async function extractPage(browser, pageData) {
  const { url, html, statusCode } = pageData;
  if (!html || statusCode >= 400) {
    return {
      url,
      statusCode,
      title: '',
      description: '',
      type: 'standard',
      sections: [],
      images: [],
      warnings: [statusCode >= 400 ? `HTTP ${statusCode}` : 'Empty page'],
    };
  }

  const type = detectPageType(url, html);
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const extracted = await page.evaluate((pageUrl) => {
      // --- Title ---
      const h1 = document.querySelector('h1');
      const title = h1?.textContent.trim() || document.title || '';

      // --- Description ---
      const metaDesc = document.querySelector('meta[name="description"]');
      let description = metaDesc?.content || '';
      if (!description) {
        const firstP = document.querySelector('main p, article p, .content p, p');
        if (firstP) {
          description = firstP.textContent.trim().slice(0, 160);
        }
      }

      // --- Find main content area ---
      const mainEl = document.querySelector('main')
        || document.querySelector('article')
        || document.querySelector('[role="main"]')
        || document.querySelector('.content, .main, #content, #main');

      const contentRoot = mainEl || document.body;

      // --- Walk DOM and extract sections ---
      const sections = [];
      const images = [];
      const warnings = [];

      function processElement(el) {
        if (!el) return;

        // Skip header/footer/nav/aside
        const tag = el.tagName?.toLowerCase();
        if (['header', 'footer', 'nav', 'aside', 'script', 'style', 'noscript'].includes(tag)) return;

        // Headings
        if (/^h[1-6]$/.test(tag)) {
          const level = parseInt(tag[1]);
          sections.push({ type: 'heading', level, text: el.textContent.trim() });
          return;
        }

        // Paragraphs
        if (tag === 'p') {
          const text = extractInlineContent(el);
          if (text.trim()) sections.push({ type: 'paragraph', text });
          return;
        }

        // Lists
        if (tag === 'ul' || tag === 'ol') {
          const items = [];
          for (const li of el.querySelectorAll(':scope > li')) {
            items.push(extractInlineContent(li));
          }
          if (items.length) sections.push({ type: 'list', ordered: tag === 'ol', items });
          return;
        }

        // Images
        if (tag === 'img') {
          const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
          const alt = el.getAttribute('alt') || '';
          if (src) {
            const imgData = { type: 'image', src, alt };
            sections.push(imgData);
            images.push({ src, alt });
          }
          return;
        }

        // Code blocks
        if (tag === 'pre') {
          const code = el.querySelector('code');
          const text = code?.textContent || el.textContent || '';
          let lang = '';
          if (code) {
            const cls = code.className || '';
            const langMatch = cls.match(/language-(\w+)/);
            if (langMatch) lang = langMatch[1];
          }
          sections.push({ type: 'code', lang, text: text.trim() });
          return;
        }

        // Tables
        if (tag === 'table') {
          const rows = [];
          for (const tr of el.querySelectorAll('tr')) {
            const cells = [];
            for (const td of tr.querySelectorAll('th, td')) {
              cells.push(td.textContent.trim());
            }
            rows.push(cells);
          }
          if (rows.length) sections.push({ type: 'table', rows });
          return;
        }

        // Blockquotes
        if (tag === 'blockquote') {
          sections.push({ type: 'blockquote', text: el.textContent.trim() });
          return;
        }

        // Horizontal rules
        if (tag === 'hr') {
          sections.push({ type: 'hr' });
          return;
        }

        // Iframes (embeds)
        if (tag === 'iframe') {
          const src = el.getAttribute('src') || '';
          if (src) sections.push({ type: 'iframe', src });
          return;
        }

        // Forms
        if (tag === 'form') {
          const fields = [];
          for (const input of el.querySelectorAll('input, textarea, select')) {
            const inputTag = input.tagName.toLowerCase();
            const inputType = input.getAttribute('type') || (inputTag === 'textarea' ? 'longtext' : 'shorttext');
            const label = findLabel(input);
            const field = {
              id: input.getAttribute('name') || input.getAttribute('id') || `field_${fields.length}`,
              type: mapInputType(inputType),
              label: label || '',
              placeholder: input.getAttribute('placeholder') || '',
              required: input.hasAttribute('required'),
            };
            if (inputTag === 'select') {
              field.options = Array.from(input.querySelectorAll('option'))
                .map(o => o.textContent.trim())
                .filter(Boolean);
            }
            fields.push(field);
          }
          const submitBtn = el.querySelector('button[type="submit"], input[type="submit"]');
          const submitLabel = submitBtn?.textContent?.trim() || submitBtn?.value || 'Submit';
          const action = el.getAttribute('action') || '';
          sections.push({ type: 'form', action, submitLabel, fields });
          warnings.push(`Form action "${action}" needs a webhook URL`);
          return;
        }

        // Details/summary — pass through
        if (tag === 'details') {
          const summary = el.querySelector('summary');
          const summaryText = summary?.textContent?.trim() || '';
          const bodyText = el.textContent.replace(summaryText, '').trim();
          sections.push({ type: 'details', summary: summaryText, body: bodyText });
          return;
        }

        // Check for card-like grid patterns
        if (isCardGrid(el)) {
          const cards = extractCards(el);
          if (cards.length >= 2) {
            sections.push({ type: 'cards', items: cards });
            return;
          }
        }

        // Check for button-styled links
        if (tag === 'a') {
          if (isButton(el)) {
            const label = el.textContent.trim();
            const href = el.getAttribute('href') || '#';
            sections.push({ type: 'button', label, href });
            return;
          }
        }

        // Recurse into children
        for (const child of el.children) {
          processElement(child);
        }
      }

      function extractInlineContent(el) {
        let result = '';
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            result += node.textContent;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const childTag = node.tagName.toLowerCase();
            const text = node.textContent;
            if (childTag === 'strong' || childTag === 'b') result += `**${text}**`;
            else if (childTag === 'em' || childTag === 'i') result += `*${text}*`;
            else if (childTag === 'code') result += `\`${text}\``;
            else if (childTag === 'a') {
              const href = node.getAttribute('href') || '';
              result += `[${text}](${href})`;
            }
            else if (childTag === 'br') result += '\n';
            else if (childTag === 'img') {
              const src = node.getAttribute('src') || '';
              const alt = node.getAttribute('alt') || '';
              result += `![${alt}](${src})`;
            }
            else result += text;
          }
        }
        return result;
      }

      function findLabel(input) {
        // Check for associated label
        const id = input.getAttribute('id');
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) return label.textContent.trim();
        }
        // Check for wrapping label
        const parent = input.closest('label');
        if (parent) {
          const clone = parent.cloneNode(true);
          clone.querySelector('input, textarea, select')?.remove();
          return clone.textContent.trim();
        }
        // Check aria-label
        return input.getAttribute('aria-label') || '';
      }

      function mapInputType(type) {
        const map = {
          'text': 'shorttext',
          'email': 'email',
          'tel': 'phone',
          'number': 'number',
          'date': 'date',
          'time': 'time',
          'checkbox': 'checkbox',
          'radio': 'radio',
          'textarea': 'longtext',
          'password': 'shorttext',
          'url': 'shorttext',
          'search': 'shorttext',
        };
        return map[type] || 'shorttext';
      }

      function isCardGrid(el) {
        const style = getComputedStyle(el);
        const isGrid = style.display === 'grid' || style.display === 'flex';
        if (!isGrid) return false;
        const children = el.children;
        return children.length >= 2 && children.length <= 20;
      }

      function extractCards(el) {
        const cards = [];
        for (const child of el.children) {
          const img = child.querySelector('img');
          const heading = child.querySelector('h2, h3, h4, h5');
          const p = child.querySelector('p');
          const link = child.querySelector('a');

          if (heading || p) {
            cards.push({
              title: heading?.textContent?.trim() || '',
              text: p?.textContent?.trim() || '',
              image: img?.getAttribute('src') || '',
              link: link ? { label: link.textContent.trim(), href: link.getAttribute('href') || '' } : null,
            });
          }
        }
        return cards;
      }

      function isButton(el) {
        const cls = (el.className || '').toLowerCase();
        return /\b(btn|button|cta)\b/.test(cls);
      }

      // Process content
      processElement(contentRoot);

      // Also find images within content that might be lazy-loaded
      const allImages = contentRoot.querySelectorAll('img[src], img[data-src]');
      for (const img of allImages) {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
        const alt = img.getAttribute('alt') || '';
        if (src && !images.some(i => i.src === src)) {
          images.push({ src, alt });
        }
      }

      return { title, description, sections, images, warnings };
    }, url);

    return {
      url,
      statusCode,
      type,
      ...extracted,
    };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Full site extraction
// ---------------------------------------------------------------------------

/**
 * Extract site-level and page-level data from crawled pages.
 * @param {object} browser - Puppeteer browser instance
 * @param {Array} crawledPages - [{url, html, statusCode}]
 * @param {string} origin - Site origin
 * @returns {Promise<{site, navigation, footer, pages}>}
 */
async function extract(browser, crawledPages, origin) {
  // Find homepage
  const homepage = crawledPages.find(p => {
    const pathname = new URL(p.url).pathname;
    return pathname === '/' || pathname === '';
  }) || crawledPages[0];

  // Site-level extraction from homepage
  const homePage = await browser.newPage();
  await homePage.setContent(homepage.html, { waitUntil: 'domcontentloaded' });

  const site = await extractSiteData(homePage, origin);
  const navigation = await extractNavigation(homePage, origin);
  const footer = await extractFooter(homePage, origin);

  // Detect social links from footer
  const socialLinks = [];
  for (const link of footer.links) {
    const platform = detectSocialPlatform(link.href);
    if (platform) {
      socialLinks.push({ platform, url: link.href });
    }
  }
  footer.socialLinks = socialLinks;

  await homePage.close();

  // Page-level extraction
  const pages = [];
  for (const pageData of crawledPages) {
    if (!pageData.html || pageData.statusCode >= 400) {
      pages.push({
        url: pageData.url,
        statusCode: pageData.statusCode,
        title: '',
        description: '',
        type: 'standard',
        sections: [],
        images: [],
        warnings: [pageData.statusCode >= 400 ? `HTTP ${pageData.statusCode}` : 'Empty content'],
      });
      continue;
    }

    const extracted = await extractPage(browser, pageData);
    pages.push(extracted);
  }

  return { site, navigation, footer, pages };
}

module.exports = { extract, extractSiteData, extractNavigation, extractFooter, extractPage };
