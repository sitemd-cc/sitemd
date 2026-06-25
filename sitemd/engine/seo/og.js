const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { requireExternal } = require('../build/modules');

// ---------------------------------------------------------------------------
// OG image generation — Satori + Sharp (default), Puppeteer (opt-in)
// Dependencies are optional: gracefully skip if not installed.
// ---------------------------------------------------------------------------

let _sharp = null;
let _satori = null;
let _resvg = null;
let _puppeteer = null;

function checkDependencies() {
  const result = { sharp: false, satori: false, puppeteer: false };
  _sharp = requireExternal('sharp'); if (_sharp) result.sharp = true;
  const sat = requireExternal('satori'); if (sat) { _satori = sat.default || sat; result.satori = true; }
  _resvg = requireExternal('@resvg/resvg-js'); if (_resvg) result.resvg = true;
  try { _puppeteer = require('puppeteer'); result.puppeteer = true; } catch (e) { /* not installed */ }
  return result;
}

// ---------------------------------------------------------------------------
// Content hash for incremental caching (brand-level, not per-page)
// ---------------------------------------------------------------------------
function computeOgHash(config) {
  const input = [
    config.accentColor || '',
    config.ogBackground || '',
    config.ogTextColor || '',
    config['dark.color-bg'] || '',
    config['dark.color-text'] || '',
    config['dark.color-accent'] || '',
    config.ogLogo || '',
    config.brandName || '',
    config.brandImage || '',
  ].join('|');
  return crypto.createHash('md5').update(input).digest('hex');
}

// ---------------------------------------------------------------------------
// Load OG cache
// ---------------------------------------------------------------------------
function loadCache(cacheFile) {
  try {
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  } catch (e) {
    return {};
  }
}

// ---------------------------------------------------------------------------
// SVG text wrapping helper — truncate text to fit within maxChars
// ---------------------------------------------------------------------------
function truncate(text, max) {
  if (!text || text.length <= max) return text || '';
  const cut = text.lastIndexOf(' ', max);
  return text.slice(0, cut > max * 0.5 ? cut : max) + '…';
}

function escSvg(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Resolve brand colors from theme settings, respecting defaultMode
// Falls back to dark for "system" (dark cards look better on social platforms)
// ---------------------------------------------------------------------------
function resolveColors(config) {
  const mode = ['light', 'dark', 'paper'].includes(config.defaultMode)
    ? config.defaultMode : 'dark';
  return {
    bg: config.ogBackground || config[`${mode}.color-bg`] || '#0f172a',
    fg: config.ogTextColor || config[`${mode}.color-text`] || '#f8fafc',
    accent: config[`${mode}.color-accent`] || config.accentColor || '#2563eb',
  };
}

// ---------------------------------------------------------------------------
// Load brand image as base64 data URI (if available)
// ---------------------------------------------------------------------------
function loadBrandImage(config, root) {
  if (!root || !config.brandImage) return null;
  const imgPath = path.join(root, config.brandImage);
  if (!fs.existsSync(imgPath)) return null;
  try {
    const buf = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml'
      : ext === '.png' ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp' : null;
    if (!mime) return null;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Safe content area — visible across all social platform crops
// OG canvas: 1200×630. Tightest crop ~1.33:1 centered = 630×473.
// Safe zone: 840×400 centered (80px margin inside tightest crop).
// ---------------------------------------------------------------------------
const SAFE = { x: 180, y: 115, w: 840, h: 400 };
const CX = SAFE.x + SAFE.w / 2; // 600
const CY = SAFE.y + SAFE.h / 2; // 315

// Accent bar — flush left edge, rounded on right side only
const BAR_W = 12;
const BAR_R = 6;

function accentBarSvg(accent) {
  const h = 630;
  // Path: straight left edge, rounded top-right and bottom-right corners
  return `<path d="M0,0 H${BAR_W - BAR_R} Q${BAR_W},0 ${BAR_W},${BAR_R} V${h - BAR_R} Q${BAR_W},${h} ${BAR_W - BAR_R},${h} H0 Z" fill="${accent}"/>`;
}

// ---------------------------------------------------------------------------
// Generate template card via Sharp SVG rendering (fallback, no Satori)
// ---------------------------------------------------------------------------
async function generateTemplateCard(config, brandDataUri) {
  const { bg, fg, accent } = resolveColors(config);
  const siteName = config.brandName || config.title || '';

  // Scale content to fill safe area
  let brandImageSvg = '';
  let nameSvg = '';

  if (brandDataUri && siteName) {
    // Image + text: image takes 60% of safe height, text takes rest
    const imgH = Math.round(SAFE.h * 0.55);
    const gap = 24;
    const textSize = Math.min(56, Math.round(SAFE.w / (siteName.length * 0.6)));
    const imgY = CY - (imgH + gap + textSize) / 2;
    const textY = imgY + imgH + gap + textSize * 0.75;
    brandImageSvg = `<image x="${CX - imgH / 2}" y="${imgY}" width="${imgH}" height="${imgH}" href="${brandDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
    nameSvg = `<text x="${CX}" y="${textY}" font-family="Inter, system-ui, sans-serif" font-size="${textSize}" font-weight="700" fill="${fg}" text-anchor="middle">${escSvg(siteName)}</text>`;
  } else if (brandDataUri) {
    // Image only: fill safe area
    const imgSize = Math.min(SAFE.w, SAFE.h) * 0.8;
    brandImageSvg = `<image x="${CX - imgSize / 2}" y="${CY - imgSize / 2}" width="${imgSize}" height="${imgSize}" href="${brandDataUri}" preserveAspectRatio="xMidYMid meet"/>`;
  } else if (siteName) {
    // Text only: scale to fill safe width
    const fontSize = Math.min(120, Math.round(SAFE.w / (siteName.length * 0.58)));
    nameSvg = `<text x="${CX}" y="${CY + fontSize * 0.35}" font-family="Inter, system-ui, sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}" text-anchor="middle">${escSvg(siteName)}</text>`;
  }

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="1200" height="630" fill="${bg}"/>
  ${accentBarSvg(accent)}
  ${brandImageSvg}
  ${nameSvg}
</svg>`;

  return _sharp(Buffer.from(svg)).png().toBuffer();
}

// ---------------------------------------------------------------------------
// Generate template card via Satori (preferred when available)
// ---------------------------------------------------------------------------
async function generateSatoriCard(config, brandDataUri, fontRegular, fontBold) {
  const { bg, fg, accent } = resolveColors(config);
  const siteName = config.brandName || config.title || '';

  // Scale content to fill safe area
  const imgHeight = brandDataUri && siteName ? `${Math.round(SAFE.h * 0.55)}px`
    : brandDataUri ? `${Math.round(Math.min(SAFE.w, SAFE.h) * 0.8)}px`
    : '0px';
  const fontSize = !brandDataUri && siteName
    ? `${Math.min(120, Math.round(SAFE.w / (siteName.length * 0.58)))}px`
    : brandDataUri && siteName
    ? `${Math.min(56, Math.round(SAFE.w / (siteName.length * 0.6)))}px`
    : '72px';

  const innerChildren = [];

  if (brandDataUri) {
    innerChildren.push({
      type: 'img',
      props: {
        src: brandDataUri,
        style: { height: imgHeight, maxWidth: `${SAFE.w}px` },
      },
    });
  }

  if (siteName) {
    innerChildren.push({
      type: 'div',
      props: {
        style: {
          fontSize,
          fontWeight: 700,
          color: fg,
          display: 'flex',
        },
        children: siteName,
      },
    });
  }

  const element = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        position: 'relative',
      },
      children: [
        // Accent bar — flush left, rounded right corners
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              left: '0',
              top: '0',
              width: `${BAR_W}px`,
              height: '100%',
              backgroundColor: accent,
              borderTopRightRadius: `${BAR_R}px`,
              borderBottomRightRadius: `${BAR_R}px`,
            },
          },
        },
        // Content
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              width: `${SAFE.w}px`,
              height: `${SAFE.h}px`,
            },
            children: innerChildren,
          },
        },
      ],
    },
  };

  const svg = await _satori(element, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fontBold, weight: 700, style: 'normal' },
    ],
  });

  // Convert SVG to PNG via resvg-js (preferred) or Sharp
  if (_resvg) {
    const resvg = new _resvg.Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 },
    });
    return resvg.render().asPng();
  }

  return _sharp(Buffer.from(svg)).png().toBuffer();
}

// ---------------------------------------------------------------------------
// Simple text wrapping for SVG
// ---------------------------------------------------------------------------
function wrapText(text, maxChars) {
  if (!text) return [''];
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
    if (lines.length >= 3) break; // max 3 lines
  }
  if (current && lines.length < 3) lines.push(current);
  return lines;
}

// ---------------------------------------------------------------------------
// Generate page screenshots via Puppeteer (opt-in)
// ---------------------------------------------------------------------------
async function generateScreenshots(pages, config, distDir) {
  if (!_puppeteer) {
    console.log('  OG screenshots: puppeteer not installed. Run: npm install puppeteer');
    console.log('  Falling back to template card mode.');
    return false;
  }

  const browser = await _puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });

    for (const p of pages) {
      const seo = p.seoData;
      if (!seo || (p.meta && p.meta.image)) continue;

      const slug = seo.slug === '/' ? 'index' : seo.slug.replace(/^\//, '');
      const outPath = path.join(distDir, 'og', slug + '.png');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });

      const htmlPath = seo.slug === '/' || seo.slug === '/index'
        ? path.join(distDir, 'index.html')
        : path.join(distDir, seo.slug.replace(/^\//, ''), 'index.html');

      if (!fs.existsSync(htmlPath)) continue;

      await page.goto('file://' + htmlPath, { waitUntil: 'load', timeout: 10000 });
      await page.waitForFunction(() => document.fonts.ready, { timeout: 5000 }).catch(() => {});

      const screenshot = await page.screenshot({ type: 'png' });

      // Resize to 1200x630 and compress
      const buffer = await _sharp(screenshot)
        .resize(1200, 630, { fit: 'cover', position: 'top' })
        .png({ quality: 80 })
        .toBuffer();

      fs.writeFileSync(outPath, buffer);
    }
  } finally {
    await browser.close();
  }

  return true;
}

// ---------------------------------------------------------------------------
// Generate favicons from source image or auto-generate from site name
// ---------------------------------------------------------------------------
async function generateFavicons(config, root, distDir) {
  if (!_sharp) return { hasFavicon: false, isSvg: false };

  let sourceBuffer = null;
  let isSvg = false;

  // Favicon mode: 'letter' (auto), 'brand' (use brandImage), 'custom' (user upload)
  const faviconMode = config.favicon || (config.customFavicon ? 'custom' : 'letter');

  if (faviconMode === 'custom' && config.customFavicon) {
    // User-uploaded image in media/seo/favicon/
    const srcPath = path.join(root, 'media/favicon', config.customFavicon.replace(/^\//, ''));
    if (fs.existsSync(srcPath)) {
      sourceBuffer = fs.readFileSync(srcPath);
      isSvg = srcPath.endsWith('.svg');
    }
  } else if (faviconMode === 'brand' && config.brandImage) {
    // Use the site's brand image
    const imgPath = path.join(root, config.brandImage.replace(/^\//, ''));
    if (fs.existsSync(imgPath)) {
      sourceBuffer = fs.readFileSync(imgPath);
      isSvg = imgPath.endsWith('.svg');
    }
  }

  // Fallback: auto-generate letter favicon (also used when faviconMode === 'letter')
  if (!sourceBuffer) {
    const letter = (config.title || config.brandName || 'S').charAt(0).toUpperCase();
    const accent = config._faviconAccent || config.accentColor || '#2563eb';
    const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="64" fill="${accent}"/>
  <text x="256" y="380" font-family="Inter, system-ui, sans-serif" font-size="340" font-weight="700" fill="white" text-anchor="middle">${letter}</text>
</svg>`;
    sourceBuffer = Buffer.from(svg);
    isSvg = true;
  }

  // Generate favicon.ico (48x48 PNG — modern browsers accept PNG favicons)
  const ico = await _sharp(sourceBuffer)
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(distDir, 'favicon.ico'), ico);

  // Generate apple-touch-icon (180x180)
  const apple = await _sharp(sourceBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(distDir, 'apple-touch-icon.png'), apple);

  // Copy/generate SVG favicon
  if (isSvg) {
    fs.writeFileSync(path.join(distDir, 'favicon.svg'), sourceBuffer);
  }

  return { hasFavicon: true, isSvg };
}

// ---------------------------------------------------------------------------
// Orchestrator — generate OG images for all pages
// ---------------------------------------------------------------------------
async function generateOgImages(pages, config, distDir, root) {
  const deps = checkDependencies();
  if (!deps.sharp) {
    console.log('  OG images: skipped (sharp not installed, run: npm install sharp satori @resvg/resvg-js)');
    return;
  }

  const ogDir = path.join(distDir, 'og');
  fs.mkdirSync(ogDir, { recursive: true });

  // Load cache
  const cacheFile = path.join(ogDir, '.og-cache.json');
  const cache = loadCache(cacheFile);
  const newCache = {};

  // Screenshot mode (opt-in)
  if (config.ogStyle === 'screenshot') {
    const success = await generateScreenshots(pages, config, distDir);
    if (success) {
      // Update cache for screenshot mode
      for (const p of pages) {
        if (p.seoData && !(p.meta && p.meta.image)) {
          const slug = p.seoData.slug === '/' ? 'index' : p.seoData.slug.replace(/^\//, '');
          newCache[slug] = 'screenshot';
        }
      }
      fs.writeFileSync(cacheFile, JSON.stringify(newCache, null, 2));
      return;
    }
    // Fall through to template mode if screenshots failed
  }

  // Single shared brand card — same image for all pages
  const outPath = path.join(ogDir, 'default.png');
  const hash = computeOgHash(config);

  if (cache['default'] === hash && fs.existsSync(outPath)) {
    newCache['default'] = hash;
    console.log('  OG images: cached');
  } else {
    // Load brand image
    const brandDataUri = loadBrandImage(config, root);

    // Load fonts for Satori
    let fontRegular = null;
    let fontBold = null;
    if (deps.satori) {
      // Try theme/fonts/ (dev), then theme-fonts/ (compiled binary asset)
      const fontCandidates = [
        path.join(__dirname, '..', 'theme', 'fonts'),
        path.join(__dirname, '..', '..', 'theme-fonts'),
      ];
      for (const fontsDir of fontCandidates) {
        try {
          fontRegular = fs.readFileSync(path.join(fontsDir, 'Inter-Regular.ttf'));
          fontBold = fs.readFileSync(path.join(fontsDir, 'Inter-Bold.ttf'));
          break;
        } catch (e) { /* try next candidate */ }
      }
      if (!fontRegular) console.log('  OG images: Inter TTF fonts not found, using Sharp SVG fallback');
    }

    const useSatori = deps.satori && fontRegular && fontBold;

    try {
      const buffer = useSatori
        ? await generateSatoriCard(config, brandDataUri, fontRegular, fontBold)
        : await generateTemplateCard(config, brandDataUri);

      fs.writeFileSync(outPath, buffer);
      newCache['default'] = hash;
      console.log('  OG images: generated');
    } catch (e) {
      console.log(`  OG image error: ${e.message}`);
    }
  }

  fs.writeFileSync(cacheFile, JSON.stringify(newCache, null, 2));
}

module.exports = {
  checkDependencies,
  computeOgHash,
  generateTemplateCard,
  generateSatoriCard,
  generateScreenshots,
  generateOgImages,
};
