const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Card image generation — gradient or Unsplash modes
// ---------------------------------------------------------------------------

function hashToHue(title) {
  const hash = [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  return Math.abs(hash) % 360;
}

function buildGradientSvg(title) {
  const hue = hashToHue(title);
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

async function generateGradient(title, outputPath) {
  const { requireExternal } = require('../modules');
  const sharp = requireExternal('sharp');
  if (!sharp) return false;
  const svg = buildGradientSvg(title);
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  return true;
}

async function fetchUnsplash(title, outputPath) {
  try {
    const query = encodeURIComponent(title);
    const url = `https://unsplash.com/napi/search/photos?query=${query}&per_page=1&orientation=landscape`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return false;

    const imageUrl = data.results[0].urls.small;
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return false;

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (e) {
    return false;
  }
}

async function generateCardImages(pending, config, distDir) {
  const mode = config.cardAutoImages;
  if (!mode || mode === 'false') return;

  const outDir = path.join(distDir, 'media/content/cards');
  fs.mkdirSync(outDir, { recursive: true });

  let generated = 0;
  let cached = 0;

  for (const card of pending) {
    const outputPath = path.join(outDir, `${card.hash}.png`);

    // Skip if already cached
    if (fs.existsSync(outputPath)) {
      cached++;
      continue;
    }

    let ok = false;
    if (mode === 'unsplash') {
      ok = await fetchUnsplash(card.title, outputPath);
    }
    // Fall back to gradient if unsplash failed or mode is gradient
    if (!ok) {
      ok = await generateGradient(card.title, outputPath);
    }
    if (ok) generated++;
  }

  if (generated > 0 || cached > 0) {
    console.log(`  Card images: ${generated} generated, ${cached} cached`);
  }
}

module.exports = { generateCardImages };
