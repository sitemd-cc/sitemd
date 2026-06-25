/**
 * assets.js — Download images and rewrite URLs to local paths.
 */

const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

async function downloadImage(browser, imageUrl, destPath) {
  const page = await browser.newPage();
  try {
    const response = await page.goto(imageUrl, { waitUntil: 'load', timeout: 15000 });
    if (!response || response.status() !== 200) return false;

    const buffer = await response.buffer();
    if (buffer.length > MAX_IMAGE_SIZE) return false;

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buffer);
    return true;
  } catch {
    return false;
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Filename from URL
// ---------------------------------------------------------------------------

function urlToFilename(imageUrl) {
  try {
    const u = new URL(imageUrl);
    const basename = path.basename(u.pathname);
    // Clean up query params from filename
    const clean = basename.split('?')[0].split('#')[0];
    if (!clean || clean === '/') return `image_${Date.now()}.png`;
    // Ensure it has an extension
    if (!/\.\w+$/.test(clean)) return clean + '.png';
    return clean;
  } catch {
    return `image_${Date.now()}.png`;
  }
}

// ---------------------------------------------------------------------------
// Main asset downloader
// ---------------------------------------------------------------------------

/**
 * Download all images from mapped pages and rewrite URLs.
 * @param {object} browser - Puppeteer browser instance
 * @param {Array} pages - Mapped page objects with images array
 * @param {string} root - Project root directory
 * @param {string} origin - Source site origin
 * @returns {Promise<{downloaded, skipped, items}>}
 */
async function downloadAssets(browser, pages, root, origin) {
  const assetsDir = path.join(root, 'media', 'clone');
  const themeImagesDir = path.join(root, 'theme', 'images');

  // Collect all unique image URLs
  const imageMap = new Map(); // originalUrl -> localPath
  const downloaded = [];
  const skipped = [];
  const seen = new Set();

  for (const page of pages) {
    for (const img of (page.images || [])) {
      const absUrl = resolveUrl(img.src, origin);
      if (!absUrl || seen.has(absUrl)) continue;
      seen.add(absUrl);

      const filename = dedupeFilename(urlToFilename(absUrl), imageMap);
      const localPath = `/media/clone/${filename}`;
      const destPath = path.join(assetsDir, filename);

      const ok = await downloadImage(browser, absUrl, destPath);
      if (ok) {
        imageMap.set(absUrl, localPath);
        imageMap.set(img.src, localPath); // Also map the original (possibly relative) src
        downloaded.push({ original: absUrl, local: localPath });
      } else {
        skipped.push({ original: absUrl, reason: 'Download failed or too large' });
      }
    }
  }

  // Rewrite image URLs in page content
  for (const page of pages) {
    for (const [originalUrl, localPath] of imageMap) {
      if (page.content.includes(originalUrl)) {
        page.content = page.content.split(originalUrl).join(localPath);
      }
    }
  }

  return {
    downloaded: downloaded.length,
    skipped: skipped.length,
    items: downloaded,
  };
}

function resolveUrl(src, origin) {
  if (!src) return null;
  try {
    return new URL(src, origin).href;
  } catch {
    return null;
  }
}

function dedupeFilename(name, existing) {
  const values = new Set(existing.values());
  if (!values.has(`/media/clone/${name}`)) return name;

  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let i = 1;
  while (values.has(`/media/clone/${base}_${i}${ext}`)) i++;
  return `${base}_${i}${ext}`;
}

module.exports = { downloadAssets };
