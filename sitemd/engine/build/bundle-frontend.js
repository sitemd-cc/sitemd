// Frontend module bundler — bundles auth/src, data/src, dev-panel/src into IIFEs.
// Used by both the dev server (on-the-fly) and production build (to dist).

const path = require('path');
const fs = require('fs');

const MODULES = {
  auth: {
    src: path.join(__dirname, '..', 'auth', 'src', 'index.js'),
    out: path.join(__dirname, '..', 'auth', 'auth.js'),
  },
  data: {
    src: path.join(__dirname, '..', 'data', 'src', 'index.js'),
    out: path.join(__dirname, '..', 'data', 'data.js'),
  },
  'dev-panel': {
    src: path.join(__dirname, 'dev-panel', 'src', 'index.js'),
    out: path.join(__dirname, 'dev-panel', 'dev-panel.js'),
  },
};

/**
 * Bundle a frontend module from src/ to its output path.
 * Returns the bundled code as a string (also writes to disk if destPath given).
 * @param {string} name — 'auth', 'data', or 'dev-panel'
 * @param {string} [destPath] — optional output path (defaults to module's out path)
 * @returns {string|null} bundled code, or null if src/ doesn't exist
 */
function bundleFrontendModule(name, destPath) {
  const mod = MODULES[name];
  if (!mod || !fs.existsSync(mod.src)) return null;

  const { requireExternal } = require('./modules');
  const esbuild = requireExternal('esbuild');
  if (!esbuild) return null;

  const result = esbuild.buildSync({
    entryPoints: [mod.src],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    minify: false,
    legalComments: 'none',
  });

  const code = result.outputFiles[0].text;

  if (destPath) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, code);
  }

  return code;
}

/**
 * Check if a module has src/ sources available for bundling.
 */
function hasSrc(name) {
  const mod = MODULES[name];
  return mod && fs.existsSync(mod.src);
}

module.exports = { bundleFrontendModule, hasSrc, MODULES };
