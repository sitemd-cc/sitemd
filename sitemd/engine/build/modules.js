/**
 * Extra module resolution paths for native dependencies.
 *
 * og.js and images.js depend on sharp, satori, and @resvg/resvg-js which may
 * be installed at various levels in the project tree. This wrapper injects
 * extra node_modules paths so require() can find them.
 */

const path = require('path');

function requireWithExtraPaths(modulePath) {
  const mod = require(modulePath);
  const cached = require.cache[modulePath];
  if (cached) {
    const extra = [
      path.resolve(__dirname, '../seo/node_modules'),   // engine/seo/
      path.resolve(__dirname, '../../node_modules'),     // sitemd/
      path.resolve(__dirname, '../../../node_modules'),   // project root
    ];
    for (const p of extra) {
      if (!cached.paths.includes(p)) cached.paths.unshift(p);
    }
  }
  return mod;
}

/**
 * Resolve an external/native module that may not be findable from the pkg
 * snapshot filesystem. Tries the standard require first, then searches
 * common node_modules locations relative to the project. If all candidates
 * fail and the module has known platform-specific packages, auto-installs
 * the correct one for the current platform.
 */
function requireExternal(name) {
  const candidates = [
    () => require(name),
    () => require(path.join(process.cwd(), 'node_modules', name)),
    () => { const r = process.env.SITEMD_PROJECT_ROOT; return r ? require(path.join(r, '..', 'node_modules', name)) : null; },
    () => { const r = process.env.SITEMD_PROJECT_ROOT; return r ? require(path.join(r, 'node_modules', name)) : null; },
  ];
  for (const fn of candidates) {
    try { const m = fn(); if (m) return m; } catch {}
  }

  // Auto-install platform-specific native packages on first use
  const pkgs = platformPackages(name);
  if (pkgs.length > 0) {
    const installRoot = process.env.SITEMD_PROJECT_ROOT || process.cwd();
    const installDir = path.join(installRoot, '..');
    try {
      console.log(`  Installing ${name} for ${process.platform}-${process.arch}...`);
      const { execSync } = require('child_process');
      execSync(`npm install --no-save ${pkgs.join(' ')}`, { cwd: installDir, stdio: ['ignore', 'ignore', 'pipe'], timeout: 60000 });
      // Retry resolution after install
      for (const fn of candidates) {
        try { const m = fn(); if (m) return m; } catch {}
      }
    } catch (e) {
      console.error(`  Could not install ${name}: ${e.message}`);
    }
  }

  return null;
}

/**
 * Map a module name to the platform-specific packages needed for the current
 * OS + arch. Returns an empty array if no platform packages are known.
 */
function platformPackages(name) {
  const p = process.platform;
  const a = process.arch;

  if (name === 'sharp') {
    const tag = p === 'win32' ? `win32-${a}` : p === 'linux' ? (isMusl() ? `linuxmusl-${a}` : `linux-${a}`) : `${p}-${a}`;
    const pkgs = [`@img/sharp-${tag}`];
    // libvips is needed on non-win32 platforms
    if (p !== 'win32') pkgs.push(`@img/sharp-libvips-${tag}`);
    return pkgs;
  }

  if (name === '@resvg/resvg-js') {
    const tag = p === 'win32' ? `win32-${a}-msvc`
      : p === 'darwin' ? `${p}-${a}`
      : isMusl() ? `linux-${a}-musl` : `linux-${a}-gnu`;
    return [`@resvg/resvg-js-${tag}`];
  }

  return [];
}

/** Detect musl libc (Alpine, etc.) vs glibc */
function isMusl() {
  try {
    const { execSync } = require('child_process');
    const ldd = execSync('which ldd', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return require('fs').readFileSync(ldd, 'utf8').includes('musl');
  } catch { return false; }
}

module.exports = { requireWithExtraPaths, requireExternal };
