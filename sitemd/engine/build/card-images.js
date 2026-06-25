const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Card image generation — per-card auto-color and auto-photo modes
// ---------------------------------------------------------------------------

// Named color → hue mapping for +color: modifier
const COLOR_HUES = {
  red: 0, orange: 30, yellow: 60, lime: 90, green: 120, teal: 160,
  cyan: 180, blue: 240, indigo: 260, purple: 280, pink: 330, rose: 345,
};

function hashToHue(title) {
  const hash = [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  return Math.abs(hash) % 360;
}

function colorHintToHue(color) {
  if (!color) return null;
  // Named color
  const lower = color.toLowerCase();
  if (COLOR_HUES[lower] !== undefined) return COLOR_HUES[lower];
  // Hex → crude hue extraction (convert to RGB, then to HSL hue)
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  if (hex.length !== 6) return null;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  let hue;
  if (max === r) hue = ((g - b) / (max - min)) * 60;
  else if (max === g) hue = (2 + (b - r) / (max - min)) * 60;
  else hue = (4 + (r - g) / (max - min)) * 60;
  return ((hue % 360) + 360) % 360;
}

function buildGradientSvg(title, colorHint) {
  const hue = colorHintToHue(colorHint) ?? hashToHue(title);
  const hue2 = (hue + 40) % 360;
  return `<svg width="600" height="300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue}, 40%, 45%)"/>
      <stop offset="100%" style="stop-color:hsl(${hue2}, 35%, 30%)"/>
    </linearGradient>
  </defs>
  <rect width="600" height="300" fill="url(#g)"/>
</svg>`;
}

async function generateGradient(title, outputPath, colorHint) {
  const { requireExternal } = require('./modules');
  const sharp = requireExternal('sharp');
  if (!sharp) return false;
  const svg = buildGradientSvg(title, colorHint);
  await sharp(Buffer.from(svg)).resize(1200, 600).png().toFile(outputPath);
  return true;
}

async function fetchUnsplash(query, outputPath) {
  try {
    const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return false;
    const photo = data.results.find(function(r) { return !r.plus; });
    if (!photo) return false;
    const imageUrl = photo.urls.regular;
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return false;
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (e) {
    return false;
  }
}

async function fetchOpenverse(query, outputPath) {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=1&format=json`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return false;
    const imageUrl = data.results[0].url;
    if (!imageUrl) return false;
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return false;
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (e) {
    return false;
  }
}

async function generateCardImages(pending, root) {
  if (!pending || pending.length === 0) return;

  const outDir = path.join(root, 'media/content/cards');
  fs.mkdirSync(outDir, { recursive: true });

  let generated = 0;
  let cached = 0;

  for (const card of pending) {
    const outputPath = path.join(outDir, `${card.filename}.png`);

    if (fs.existsSync(outputPath)) {
      cached++;
      continue;
    }

    let ok = false;

    if (card.mode === 'auto-photo') {
      const query = card.prompt || (card.title + (card.text ? ' ' + card.text : '')).slice(0, 100);
      ok = await fetchUnsplash(query, outputPath);
      if (!ok) ok = await fetchOpenverse(query, outputPath);
      if (!ok) ok = await generateGradient(card.title, outputPath);
    } else {
      // auto-color
      ok = await generateGradient(card.title, outputPath, card.color);
    }

    if (ok) {
      generated++;
      // Rewrite source markdown: replace auto directive with concrete image path
      if (card.sourceFile && card.rawLine) {
        try {
          const src = fs.readFileSync(card.sourceFile, 'utf-8');
          const imgPath = `media/content/cards/${card.filename}.png`;
          const escaped = card.rawLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`^card-image:\\s+${escaped}$`, 'm');
          if (re.test(src)) {
            const patched = src.replace(re, `card-image: ${imgPath}`);
            fs.writeFileSync(card.sourceFile, patched);
          }
        } catch (e) { /* source rewrite failed — non-fatal */ }
      }
    }
  }

  if (generated > 0 || cached > 0) {
    console.log(`  Card images: ${generated} generated, ${cached} cached`);
  }
}

module.exports = { generateCardImages };
