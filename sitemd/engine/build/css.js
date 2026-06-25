const fs = require('fs');
const path = require('path');
const { loadSettings } = require('./config');

// ---------------------------------------------------------------------------
// CSS defaults parser — reads custom properties from styles.css
// ---------------------------------------------------------------------------
function parseCssDefaults(cssPath) {
  const defaults = {};
  const css = fs.readFileSync(cssPath, 'utf-8');

  // Match theme-mode selector blocks
  const blockRe = /(?::root,\s*)?\[data-theme="(\w+)"\]\s*\{([^}]+)\}/g;
  let match;
  while ((match = blockRe.exec(css)) !== null) {
    const mode = match[1];
    const body = match[2];
    const varRe = /--([\w-]+)\s*:\s*(.+?)\s*;/g;
    let varMatch;
    while ((varMatch = varRe.exec(body)) !== null) {
      defaults[`${mode}.${varMatch[1]}`] = varMatch[2];
    }
  }

  // Match standalone :root block (fonts, layout, spacing)
  const rootRe = /(?<!\,\s*):root\s*\{([^}]+)\}/g;
  while ((match = rootRe.exec(css)) !== null) {
    const body = match[1];
    const varRe = /--([\w-]+)\s*:\s*(.+?)\s*;/g;
    let varMatch;
    while ((varMatch = varRe.exec(body)) !== null) {
      defaults[`root.${varMatch[1]}`] = varMatch[2];
    }
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Settings → CSS sync — patches styles.css to match settings/theme.md
// ---------------------------------------------------------------------------
function syncThemeToCSS(root) {
  const config = loadSettings(root);
  const cssPath = path.join(root, config.themeDir, 'styles.css');
  let css = fs.readFileSync(cssPath, 'utf-8');
  let changed = false;

  // Sync per-mode color blocks: light, dark, paper
  const MODES = ['light', 'dark', 'paper'];
  for (const mode of MODES) {
    // Collect all settings for this mode
    const vars = {};
    for (const [key, val] of Object.entries(config)) {
      if (!key.startsWith(mode + '.') || !val || val === '') continue;
      const varName = '--' + key.slice(mode.length + 1);
      vars[varName] = val;
    }
    if (Object.keys(vars).length === 0) continue;

    // Match the CSS block for this mode
    const selector = mode === 'light'
      ? ':root,\\s*\\[data-theme="light"\\]'
      : `\\[data-theme="${mode}"\\]`;
    const blockRe = new RegExp(`(${selector}\\s*\\{)([^}]+)(\\})`, 's');
    const match = css.match(blockRe);
    if (!match) continue;

    // Parse existing declarations, preserving order
    const declRe = /(--[\w-]+)\s*:\s*(.+?)\s*;/g;
    let declMatch;
    const existing = [];
    while ((declMatch = declRe.exec(match[2])) !== null) {
      existing.push({ name: declMatch[1], value: declMatch[2] });
    }

    // Update values from settings
    let blockChanged = false;
    for (const decl of existing) {
      if (vars[decl.name] !== undefined && vars[decl.name] !== decl.value) {
        decl.value = vars[decl.name];
        blockChanged = true;
      }
    }

    if (blockChanged) {
      const indent = '  ';
      const newBody = '\n' + existing.map(d => `${indent}${d.name}: ${d.value};`).join('\n') + '\n';
      css = css.replace(blockRe, `$1${newBody}$3`);
      changed = true;
    }
  }

  // Sync global :root values (fonts, layout dimensions)
  const GLOBAL_MAP = {
    fontSans: '--font-sans',
    fontMono: '--font-mono',
    contentWidth: '--content-width',
    pageWidth: '--page-width',
    radius: '--radius',
    imageCorners: '--image-corners',
  };

  for (const [settingKey, varName] of Object.entries(GLOBAL_MAP)) {
    const val = config[settingKey];
    if (!val || val === '') continue;
    const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escaped}\\s*:\\s*)(.+?)(\\s*;)`);
    const m = css.match(re);
    if (m && m[2] !== val) {
      css = css.replace(re, `$1${val}$3`);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(cssPath, css);
    console.log('  Synced: settings/theme.md → theme/styles.css');
  }

  return changed;
}

// ---------------------------------------------------------------------------
// Theme style generator — turns settings/theme.md into CSS overrides
// ---------------------------------------------------------------------------
function generateThemeStyles(config, cssDefaults) {
  const IMAGE_CORNER_VALUES = { none: '0', subtle: '6px', curve: '16px' };

  const GLOBAL_VAR_MAP = {
    fontSans:     '--font-sans',
    fontMono:     '--font-mono',
    contentWidth: '--content-width',
    pageWidth:    '--page-width',
    radius:       '--radius',
    imageCorners: '--image-corners',
  };

  const blocks = [];

  // Global overrides → :root (only emit changed values)
  const rootDecls = [];
  for (const [key, varName] of Object.entries(GLOBAL_VAR_MAP)) {
    let val = config[key];
    if (!val || val === '') continue;
    // Resolve named image corner values to CSS
    if (key === 'imageCorners' && IMAGE_CORNER_VALUES[val]) val = IMAGE_CORNER_VALUES[val];
    const varSuffix = varName.slice(2);
    if (cssDefaults[`root.${varSuffix}`] === val || cssDefaults[`light.${varSuffix}`] === val) continue;
    rootDecls.push(`${varName}: ${val};`);
  }
  if (rootDecls.length) {
    blocks.push(`:root {\n      ${rootDecls.join('\n      ')}\n    }`);
  }

  // Per-mode overrides → [data-theme="<mode>"] (only emit changed values)
  const MODES = ['light', 'dark', 'paper'];
  for (const mode of MODES) {
    const modeDecls = [];
    for (const [key, val] of Object.entries(config)) {
      if (!key.startsWith(mode + '.') || !val || val === '') continue;
      if (cssDefaults[key] === val) continue;
      const varName = '--' + key.slice(mode.length + 1);
      modeDecls.push(`${varName}: ${val};`);
    }
    if (modeDecls.length) {
      blocks.push(`[data-theme="${mode}"] {\n      ${modeDecls.join('\n      ')}\n    }`);
    }
  }

  // Hide theme mode toggle if configured
  if (config.themeModeToggle === 'hide') {
    blocks.push(`.theme-toggle { display: none !important; }`);
  }

  if (blocks.length === 0) return '';

  return `<style>\n    ${blocks.join('\n    ')}\n  </style>`;
}

module.exports = { parseCssDefaults, syncThemeToCSS, generateThemeStyles };
