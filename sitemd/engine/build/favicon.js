const fs = require('fs');
const path = require('path');
const { requireExternal } = require('./modules');

let _sharp = null;

function checkSharp() {
  if (_sharp) return true;
  _sharp = requireExternal('sharp');
  return !!_sharp;
}

function letterSvg(letter, accent) {
  return `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="64" fill="${accent}"/>
  <text x="256" y="380" font-family="Inter, system-ui, sans-serif" font-size="340" font-weight="700" fill="white" text-anchor="middle">${letter}</text>
</svg>`;
}

function getModeAccent(config, cssDefaults, mode) {
  return config[mode + '.color-accent'] || cssDefaults[mode + '.color-accent'] || '#2563eb';
}

async function generateFavicons(config, root, distDir) {
  const { parseCssDefaults } = require('./css');
  const cssDefaults = parseCssDefaults(path.join(root, config.themeDir || 'theme', 'styles.css'));
  if (!checkSharp()) return { hasFavicon: false, isSvg: false };

  let sourceBuffer = null;
  let isSvg = false;
  let isLetter = false;

  // Favicon mode: 'letter' (auto), 'brand' (use brandImage), 'custom' (user upload)
  const faviconMode = config.favicon || (config.customFavicon ? 'custom' : 'letter');

  if (faviconMode === 'custom' && config.customFavicon) {
    const srcPath = path.join(root, 'media/favicon', config.customFavicon.replace(/^\//, ''));
    if (fs.existsSync(srcPath)) {
      sourceBuffer = fs.readFileSync(srcPath);
      isSvg = srcPath.endsWith('.svg');
    } else {
      console.log(`  ⚠ favicon: custom image not found at media/favicon/${config.customFavicon} — using letter mode`);
    }
  } else if (faviconMode === 'brand' && config.brandImage) {
    const { parseImageModifiers } = require('./parse');
    const { cleanUrl, mods } = parseImageModifiers(config.brandImage);
    const imgPath = path.join(root, cleanUrl.replace(/^\//, ''));
    if (fs.existsSync(imgPath)) {
      sourceBuffer = fs.readFileSync(imgPath);
      isSvg = imgPath.endsWith('.svg');
      // Apply image modifiers (circle, corner) via sharp
      if (!isSvg && (mods.circle || mods.corner)) {
        const meta = await _sharp(sourceBuffer).metadata();
        const size = Math.min(meta.width || 512, meta.height || 512);
        let mask;
        if (mods.circle) {
          mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`);
        } else if (mods.corner === 'curve') {
          const r = Math.round(size * 0.18);
          mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="white"/></svg>`);
        } else if (mods.corner === 'subtle') {
          const r = Math.round(size * 0.08);
          mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="white"/></svg>`);
        }
        if (mask) {
          sourceBuffer = await _sharp(sourceBuffer)
            .resize(size, size, { fit: 'cover' })
            .composite([{ input: mask, blend: 'dest-in' }])
            .png()
            .toBuffer();
          isSvg = false;
        }
      }
    } else {
      console.log(`  ⚠ favicon: brand image not found at ${cleanUrl} — using letter mode`);
    }
  }

  // Letter mode: generate per-theme SVGs so favicon updates on theme toggle
  if (!sourceBuffer) {
    isLetter = true;
    const letter = (config.title || config.brandName || 'S').charAt(0).toUpperCase();
    const defaultMode = ['light', 'dark', 'paper'].includes(config.defaultMode)
      ? config.defaultMode : 'light';
    const defaultAccent = getModeAccent(config, cssDefaults, defaultMode);

    sourceBuffer = Buffer.from(letterSvg(letter, defaultAccent));
    isSvg = true;

    // Generate per-mode SVGs for frontend theme switching
    const modes = ['light', 'dark', 'paper'];
    for (const mode of modes) {
      const accent = getModeAccent(config, cssDefaults, mode);
      fs.writeFileSync(path.join(distDir, `favicon-${mode}.svg`), letterSvg(letter, accent));
    }
  }

  // Clean up stale letter-mode SVGs when not in letter mode
  if (!isLetter) {
    for (const f of ['favicon.svg', 'favicon-light.svg', 'favicon-dark.svg', 'favicon-paper.svg']) {
      const p = path.join(distDir, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }

  // favicon.ico + apple-touch-icon use the default mode's accent (static)
  const ico = await _sharp(sourceBuffer)
    .resize(48, 48, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(distDir, 'favicon.ico'), ico);

  const apple = await _sharp(sourceBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(distDir, 'apple-touch-icon.png'), apple);

  // Brand/custom mode: generate a mid-size PNG for browsers
  if (!isLetter) {
    const png = await _sharp(sourceBuffer)
      .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(distDir, 'favicon.png'), png);
  }

  if (isSvg && isLetter) {
    fs.writeFileSync(path.join(distDir, 'favicon.svg'), sourceBuffer);
  }

  return { hasFavicon: true, isSvg, isLetter };
}

module.exports = { generateFavicons };
