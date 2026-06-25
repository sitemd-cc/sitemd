const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// SEO — core utilities
// Full SEO functions (meta tags, sitemap, robots.txt, llms.txt, JSON-LD,
// OG images) are in seo.js, jsonld.js, og.js alongside this file.
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

module.exports = {
  deriveDescription,
  copyCustomImages,
};
