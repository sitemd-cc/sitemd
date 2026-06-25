const fs = require('fs');
const path = require('path');
const { findMarkdownFiles } = require('./discover');
const { parseFrontmatter } = require('./parse');

// ---------------------------------------------------------------------------
// Reconcile page filenames with their frontmatter slugs
// ---------------------------------------------------------------------------
function reconcileFilenames(pagesDir) {
  const renamed = [];
  const conflicts = [];

  const files = findMarkdownFiles(pagesDir);

  for (const { filePath, relativePath } of files) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { meta } = parseFrontmatter(raw);

    // Only act on pages with an explicit slug
    if (!meta.slug) continue;

    // Derive expected relative path from slug (mirrors tools.js logic)
    const slugPath = meta.slug.replace(/^\//, '') || 'home';
    const expectedRel = slugPath + '.md';

    // Normalize for comparison (forward slashes)
    const normalizedActual = relativePath.replace(/\\/g, '/');
    const normalizedExpected = expectedRel.replace(/\\/g, '/');

    if (normalizedActual === normalizedExpected) continue;

    const targetPath = path.join(pagesDir, expectedRel);

    // Conflict: target already exists (and isn't the same file, case-insensitive)
    if (fs.existsSync(targetPath) && fs.realpathSync(targetPath) !== fs.realpathSync(filePath)) {
      conflicts.push({ file: relativePath, slug: meta.slug });
      continue;
    }

    // Create parent directories
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    // Case-insensitive FS (macOS): rename via temp file
    if (fs.existsSync(targetPath)) {
      const tmp = targetPath + '.sitemd-tmp';
      fs.renameSync(filePath, tmp);
      fs.renameSync(tmp, targetPath);
    } else {
      fs.renameSync(filePath, targetPath);
    }

    renamed.push({ from: relativePath, to: expectedRel, slug: meta.slug });

    // Clean empty parent directories up to pagesDir
    let dir = path.dirname(filePath);
    while (dir !== pagesDir && dir.startsWith(pagesDir)) {
      try {
        const entries = fs.readdirSync(dir);
        if (entries.length === 0) {
          fs.rmdirSync(dir);
          dir = path.dirname(dir);
        } else {
          break;
        }
      } catch {
        break;
      }
    }
  }

  return { renamed, conflicts };
}

module.exports = { reconcileFilenames };
