// Dependency checker — validates that npm dependencies are installed before build.
// Prints a single actionable warning instead of per-feature error spam.

const fs = require('fs');
const path = require('path');

let _warned = false;

/**
 * Check whether all dependencies declared in the project's package.json are installed.
 * @param {string} root — project root (contains package.json and node_modules)
 * @returns {{ ok: boolean, missing: string[] }}
 */
function checkDependencies(root) {
  const candidates = [
    root,
    process.env.SITEMD_PROJECT_ROOT,
    process.cwd(),
    path.resolve(__dirname, '../..'),
    path.resolve(fs.realpathSync(__dirname), '../..'),
  ].filter(Boolean);

  // Find the project's package.json
  let deps = null;
  let resolveRoot = null;
  for (const candidate of candidates) {
    try {
      const pkgPath = path.join(candidate, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
          deps = Object.keys(pkg.dependencies);
          resolveRoot = candidate;
          break;
        }
      }
    } catch {}
  }

  if (!deps) return { ok: true, missing: [] };

  const missing = [];
  for (const dep of deps) {
    try {
      require.resolve(dep + '/package.json', { paths: [resolveRoot] });
    } catch {
      // Fallback for ESM packages with restrictive exports (e.g. simple-icons)
      const directPath = path.join(resolveRoot, 'node_modules', dep);
      if (!fs.existsSync(directPath)) {
        missing.push(dep);
      }
    }
  }

  return { ok: missing.length === 0, missing };
}

/**
 * Print a single warning block if dependencies are missing.
 * Only prints once per process (dev server rebuilds won't re-warn).
 */
function printDependencyWarning(result) {
  if (result.ok || _warned) return;
  _warned = true;
  console.log();
  console.log(`  \u26a0 Missing npm dependencies: ${result.missing.join(', ')}`);
  console.log('    Run: npm install');
  console.log('    (Icons will not render until dependencies are installed)');
  console.log();
}

/**
 * Check dependencies and exit with error if any are missing.
 * Used before deploy — a production site with missing deps is broken.
 */
function requireDependencies(root) {
  const result = checkDependencies(root);
  if (!result.ok) {
    console.error();
    console.error(`  ✗ Cannot deploy: missing npm dependencies: ${result.missing.join(', ')}`);
    console.error('    Run: npm install');
    console.error();
    process.exit(1);
  }
}

/**
 * Check dependencies and auto-install if any are missing.
 * Used before dev server start — installs silently, warns if install fails.
 */
function ensureDependencies(root) {
  const result = checkDependencies(root);
  if (result.ok) return;

  console.log();
  console.log(`  ⟳ Installing missing dependencies: ${result.missing.join(', ')}`);

  // Resolve the directory containing package.json for npm install
  const candidates = [
    root,
    process.env.SITEMD_PROJECT_ROOT,
    process.cwd(),
    path.resolve(__dirname, '../..'),
    path.resolve(fs.realpathSync(__dirname), '../..'),
  ].filter(Boolean);

  let installDir = root;
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      installDir = candidate;
      break;
    }
  }

  try {
    const { execSync } = require('child_process');
    execSync('npm install', { cwd: installDir, stdio: 'inherit' });
    const recheck = checkDependencies(root);
    if (recheck.ok) {
      console.log('  ✓ Dependencies installed');
      console.log();
    } else {
      printDependencyWarning(recheck);
    }
  } catch {
    printDependencyWarning(result);
  }
}

module.exports = { checkDependencies, printDependencyWarning, requireDependencies, ensureDependencies };
