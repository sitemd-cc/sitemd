// Icon resolver — resolves icon names to inline SVG at build time.
// Supports Lucide (UI icons) and Simple Icons (brand logos).
// Only icons actually referenced in content are read from disk and cached.

const fs = require('fs');
const path = require('path');

const _cache = new Map();
let _lucideDir = null;
let _simpleDir = null;
let _lucideMissing = false;
let _simpleMissing = false;

// Built-in brand SVGs for icons removed from or missing in simple-icons.
// Normalized to match normalizeSimpleIcon() output (class="icon", fill, 24x24).
const BUILTIN_BRANDS = {
  linkedin: '<svg class="icon" fill="currentColor" width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
};

function findPackageIconsDir(packageName, memo) {
  if (memo.dir !== undefined) return memo.dir;
  const candidates = [
    process.env.SITEMD_PROJECT_ROOT,
    process.env.SITEMD_PROJECT_ROOT && path.resolve(process.env.SITEMD_PROJECT_ROOT, '..'),
    process.cwd(),
    path.join(process.cwd(), 'sitemd'),
    path.resolve(__dirname, '../..'),
    path.resolve(fs.realpathSync(__dirname), '../..'),
  ].filter(Boolean);
  for (const root of candidates) {
    // Try require.resolve first (works for packages without restrictive exports)
    try {
      const pkgPath = require.resolve(`${packageName}/package.json`, { paths: [root] });
      memo.dir = path.join(path.dirname(pkgPath), 'icons');
      return memo.dir;
    } catch {}
    // Fall back to direct node_modules lookup (for ESM packages with exports restrictions)
    const direct = path.join(root, 'node_modules', packageName, 'icons');
    if (fs.existsSync(direct)) {
      memo.dir = direct;
      return memo.dir;
    }
  }
  memo.dir = '';
  memo.missing = true;
  return memo.dir;
}

function lucideDir() {
  if (_lucideDir !== null) return _lucideDir;
  const memo = {};
  _lucideDir = findPackageIconsDir('lucide-static', memo);
  if (memo.missing) _lucideMissing = true;
  return _lucideDir;
}

function simpleDir() {
  if (_simpleDir !== null) return _simpleDir;
  const memo = {};
  _simpleDir = findPackageIconsDir('simple-icons', memo);
  if (memo.missing) _simpleMissing = true;
  return _simpleDir;
}

// Normalize a Simple Icons SVG for inline use.
// Strips <title>, role attr; adds fill, dimensions, and .icon class.
function normalizeSimpleIcon(svg) {
  svg = svg.replace(/<title>[\s\S]*?<\/title>\s*/, '');
  svg = svg.replace(/\s*role="img"/, '');
  svg = svg.replace(/<!--[\s\S]*?-->\s*/, '').trim();
  svg = svg.replace(/\n\s*/g, ' ');
  // Add fill, width, height, and class
  if (/class="[^"]*"/.test(svg)) {
    svg = svg.replace(/class="[^"]*"/, 'class="icon"');
  } else {
    svg = svg.replace('<svg', '<svg class="icon"');
  }
  if (!/fill=/.test(svg)) {
    svg = svg.replace('<svg', '<svg fill="currentColor"');
  }
  if (!/width=/.test(svg)) {
    svg = svg.replace('<svg', '<svg width="24" height="24"');
  }
  return svg;
}

// Normalize a Lucide SVG for inline use.
function normalizeLucide(svg) {
  svg = svg.replace(/<!--[\s\S]*?-->\s*/, '').trim();
  svg = svg.replace(/\n\s*/g, ' ');
  if (/class="[^"]*"/.test(svg)) {
    svg = svg.replace(/class="[^"]*"/, 'class="icon"');
  } else {
    svg = svg.replace('<svg', '<svg class="icon"');
  }
  return svg;
}

// Try to read an SVG from a directory. Returns raw string or null.
function readSvg(dir, name) {
  if (!dir) return null;
  const file = path.join(dir, `${name}.svg`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

// Resolve an icon name (e.g. "arrow-right", "github", "brand-apple") to inline SVG.
// Lucide is checked first; Simple Icons is the fallback.
// The "brand-" prefix forces Simple Icons lookup (for ~32 collision names).
function resolveIcon(name) {
  if (!name) return null;
  name = name.trim().toLowerCase();
  if (_cache.has(name)) return _cache.get(name);

  const forceBrand = name.startsWith('brand-');
  const lookupName = forceBrand ? name.slice(6) : name;

  let svg = null;

  // Lucide first (unless brand- prefix forces Simple Icons)
  if (!forceBrand) {
    const raw = readSvg(lucideDir(), lookupName);
    if (raw) svg = normalizeLucide(raw);
  }

  // Simple Icons fallback (or forced via brand- prefix)
  if (!svg) {
    const raw = readSvg(simpleDir(), lookupName);
    if (raw) svg = normalizeSimpleIcon(raw);
  }

  // Built-in fallback for brands missing from simple-icons
  if (!svg && BUILTIN_BRANDS[lookupName]) {
    svg = BUILTIN_BRANDS[lookupName];
  }

  if (!svg) {
    if (!_lucideMissing || !_simpleMissing) {
      console.warn(`[icons] unknown icon "${name}" — not found in lucide or simple-icons`);
    }
    _cache.set(name, null);
    return null;
  }

  _cache.set(name, svg);
  return svg;
}

module.exports = { resolveIcon };
