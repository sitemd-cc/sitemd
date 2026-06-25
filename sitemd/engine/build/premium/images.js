const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Build-time image optimization — resize, compress, convert to WebP
// ---------------------------------------------------------------------------

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif']);
const CACHE_FILE = '.image-cache.json';

function loadSharp() {
  const { requireExternal } = require('../modules');
  return requireExternal('sharp');
}

function fileHash(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(data).digest('hex');
}

function collectImages(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectImages(full));
    } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Optimize images in the build output directory.
 * - Resizes images wider than maxWidth
 * - Converts to WebP alongside originals
 * - Compresses originals with quality setting
 * - Rewrites <img> tags in HTML to <picture> with WebP source
 *
 * @param {string} distDir - Build output directory (e.g. site/)
 * @param {object} config
 * @param {string|boolean} config.imageOptimization - 'optimize' or false
 * @param {number} config.imageMaxWidth - Max width in pixels (default 1920)
 * @param {number} config.imageQuality - Quality 1-100 (default 80)
 */
async function optimizeImages(distDir, config) {
  if (!config.imageOptimization || config.imageOptimization === 'false') return;

  const sharp = loadSharp();
  if (!sharp) {
    console.log('  Image optimization: Sharp not available, skipping');
    return;
  }

  const maxWidth = config.imageMaxWidth || 1920;
  const quality = config.imageQuality || 80;
  const mediaDir = path.join(distDir, 'media');

  if (!fs.existsSync(mediaDir)) return;

  // Load cache
  const cacheFile = path.join(mediaDir, CACHE_FILE);
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch (e) { /* fresh */ }
  const newCache = {};

  const images = collectImages(mediaDir);
  if (images.length === 0) return;

  let optimized = 0;
  let skipped = 0;

  for (const imgPath of images) {
    const relPath = path.relative(distDir, imgPath);
    const hash = fileHash(imgPath);
    const cacheKey = `${relPath}:${maxWidth}:${quality}`;

    // Skip if unchanged
    if (cache[cacheKey] === hash) {
      newCache[cacheKey] = hash;
      // Check WebP exists too
      const webpPath = imgPath.replace(/\.[^.]+$/, '.webp');
      if (fs.existsSync(webpPath)) {
        skipped++;
        continue;
      }
    }

    try {
      const img = sharp(imgPath);
      const metadata = await img.metadata();

      // Resize if wider than max
      const needsResize = metadata.width && metadata.width > maxWidth;
      let pipeline = sharp(imgPath);
      if (needsResize) {
        pipeline = pipeline.resize(maxWidth, null, { withoutEnlargement: true });
      }

      // Compress original format
      const ext = path.extname(imgPath).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg') {
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      } else if (ext === '.png') {
        pipeline = pipeline.png({ quality });
      }

      // Write optimized original
      const tmpPath = imgPath + '.tmp';
      await pipeline.toFile(tmpPath);
      fs.renameSync(tmpPath, imgPath);

      // Generate WebP variant
      const webpPath = imgPath.replace(/\.[^.]+$/, '.webp');
      let webpPipeline = sharp(imgPath);
      if (needsResize) {
        webpPipeline = webpPipeline.resize(maxWidth, null, { withoutEnlargement: true });
      }
      await webpPipeline.webp({ quality }).toFile(webpPath);

      newCache[cacheKey] = fileHash(imgPath);
      optimized++;
    } catch (e) {
      // Skip problematic images (animated GIFs, corrupt files, etc.)
      newCache[cacheKey] = hash;
      skipped++;
    }
  }

  // Save cache
  fs.writeFileSync(cacheFile, JSON.stringify(newCache, null, 2));

  // Rewrite HTML files to use <picture> tags
  if (optimized > 0 || skipped > 0) {
    rewriteHtmlForWebP(distDir);
  }

  if (optimized > 0) {
    console.log(`  Images: ${optimized} optimized${skipped > 0 ? `, ${skipped} cached` : ''}`);
  }
}

/**
 * Scan all HTML files in distDir and rewrite <img src="/media/...">
 * to <picture> with WebP <source> + original fallback.
 */
function rewriteHtmlForWebP(distDir) {
  const htmlFiles = collectHtmlFiles(distDir);

  for (const htmlPath of htmlFiles) {
    let html = fs.readFileSync(htmlPath, 'utf-8');
    let changed = false;

    // Match <img> tags with /media/ sources that have optimizable extensions
    html = html.replace(
      /<img\s([^>]*?)src="(\/media\/[^"]+\.(png|jpe?g|gif))"([^>]*?)>/gi,
      (match, before, src, ext, after) => {
        const webpSrc = src.replace(/\.[^.]+$/, '.webp');
        // Check the WebP file actually exists
        const webpFile = path.join(distDir, webpSrc.slice(1)); // remove leading /
        if (!fs.existsSync(webpFile)) return match;

        changed = true;
        return `<picture><source srcset="${webpSrc}" type="image/webp"><img ${before}src="${src}"${after}></picture>`;
      }
    );

    if (changed) {
      fs.writeFileSync(htmlPath, html);
    }
  }
}

function collectHtmlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectHtmlFiles(full));
    } else if (entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Inject width/height attributes into <img> tags for local /media/ images.
 * This lets browsers reserve layout space before lazy images load, preventing
 * layout shift that would break anchor scroll positions.
 *
 * No-op if sharp is not available.
 *
 * @param {string} distDir - Build output directory
 */
async function injectImageDimensions(distDir) {
  const sharp = loadSharp();
  if (!sharp) return;

  const htmlFiles = collectHtmlFiles(distDir);
  const dimCache = {};

  for (const htmlPath of htmlFiles) {
    let html = fs.readFileSync(htmlPath, 'utf-8');
    let changed = false;

    html = await replaceAsync(
      html,
      /<img\s([^>]*?)src="(\/media\/[^"]+\.(png|jpe?g|gif|webp|avif))"([^>]*?)>/gi,
      async (match, before, src, _ext, after) => {
        // Skip if already has width or height
        if (/\bwidth=/.test(before) || /\bwidth=/.test(after) ||
            /\bheight=/.test(before) || /\bheight=/.test(after)) return match;

        const imgFile = path.join(distDir, src.slice(1));
        if (!fs.existsSync(imgFile)) return match;

        try {
          if (!dimCache[imgFile]) {
            const meta = await sharp(imgFile).metadata();
            if (!meta.width || !meta.height) return match;
            dimCache[imgFile] = { w: meta.width, h: meta.height };
          }
          const { w, h } = dimCache[imgFile];
          changed = true;
          return `<img ${before}src="${src}" width="${w}" height="${h}"${after}>`;
        } catch (e) {
          return match;
        }
      }
    );

    if (changed) {
      fs.writeFileSync(htmlPath, html);
    }
  }
}

async function replaceAsync(str, regex, asyncFn) {
  const promises = [];
  str.replace(regex, (match, ...args) => {
    promises.push(asyncFn(match, ...args));
    return match;
  });
  const results = await Promise.all(promises);
  let i = 0;
  return str.replace(regex, () => results[i++]);
}

module.exports = { optimizeImages, injectImageDimensions };
