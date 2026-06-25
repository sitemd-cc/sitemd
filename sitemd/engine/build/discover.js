const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Recursive markdown file discovery
// ---------------------------------------------------------------------------
function findMarkdownFiles(dir, base) {
  base = base || dir;
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findMarkdownFiles(fullPath, base));
    } else if (entry.name.endsWith('.md')) {
      results.push({
        filePath: fullPath,
        relativePath: path.relative(base, fullPath),
      });
    }
  }

  return results;
}

module.exports = { findMarkdownFiles };
