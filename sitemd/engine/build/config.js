const fs = require('fs');
const path = require('path');
const { marked } = require('./lib/marked.min.js');
const { parseFrontmatter, parseNavItems, parseFooterSocial, parseGroups, setPalette } = require('./parse');
const { loadBackendConfig, flattenBackendConfig, flattenSecretsOnly, loadEnvConfig, loadProjectConfig, loadGlobalConfig } = require('../cli/config-store');
const { normalizeIndent } = require('./parse-indent');

// Standardize 4-space indented settings files to canonical 2-space.
// Operates on the YAML frontmatter region only; preserves comments,
// blank lines, and trailing content verbatim. Idempotent.
function standardizeSettingsIndent(root) {
  const files = ['groups.md', 'header.md', 'footer.md'];
  for (const name of files) {
    const fp = path.join(root, 'settings', name);
    if (!fs.existsSync(fp)) continue;
    const raw = fs.readFileSync(fp, 'utf-8');
    const m = raw.match(/^(\s*---[ \t]*\n)([\s\S]*?)(\n---)/);
    if (!m) continue;
    const fm = m[2];
    const normalized = normalizeIndent(fm);
    if (normalized === fm) continue;
    const next = m[1] + normalized + m[3] + raw.slice(m[0].length);
    fs.writeFileSync(fp, next);
    console.log(`    ↳ reindented settings/${name} to 2-space`);
  }
}

// countrySortToTop parser — extracts array from raw frontmatter
function parseCountrySortToTop(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return [];

  const lines = match[1].split('\n');
  const result = [];
  let inList = false;

  for (const line of lines) {
    if (line.trim().startsWith('#')) continue;
    if (/^countrySortToTop\s*:/.test(line)) {
      inList = true;
      if (line.includes('[]')) return [];
      continue;
    }
    if (inList && /^[a-zA-Z]/.test(line)) break;
    if (inList && /^\s+- /.test(line)) {
      result.push(line.replace(/^\s+- /, '').trim());
    }
  }
  return result;
}

// Heading ID state — shared across configureMarked calls
const _usedIds = new Set();
let _firstH1Seen = false;

function resetHeadingIds() {
  _usedIds.clear();
  _firstH1Seen = false;
}

// Extract a heading hierarchy (H2 → top-level, H3 → nested anchor, plus
// inline `{#id}` anchor divs nested under their preceding H2) from rendered
// page HTML. Returns [{ label, hash, anchors: [{ label, hash }] }] suitable
// for building a per-page TOC sidebar.
function extractTocTree(html) {
  const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
  const humanize = (id) => {
    const s = id.replace(/[-_]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  // Single regex: H2 | H3 | inline anchor div
  const re = /<h2(?:\s+class="[^"]*")?\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>|<h3(?:\s+class="[^"]*")?\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h3>|<div\s+id="([^"]+)"><\/div>/g;

  // Pass 1: collect raw matches with position info
  const raw = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1] !== undefined) {
      raw.push({ kind: 'h2', id: m[1], label: stripTags(m[2]), start: m.index, end: re.lastIndex });
    } else if (m[3] !== undefined) {
      raw.push({ kind: 'h3', id: m[3], label: stripTags(m[4]), start: m.index, end: re.lastIndex });
    } else {
      raw.push({ kind: 'anchor', id: m[5], label: humanize(m[5]), start: m.index, end: re.lastIndex });
    }
  }

  // Drop inline-anchor divs that sit immediately before a heading (only
  // whitespace between) — they're typically alt-ids for that heading and
  // would otherwise duplicate it in the sidebar.
  const keep = raw.filter((node, i) => {
    if (node.kind !== 'anchor') return true;
    const next = raw[i + 1];
    if (!next || (next.kind !== 'h2' && next.kind !== 'h3')) return true;
    const between = html.slice(node.end, next.start);
    return between.trim() !== '';
  });

  // Pass 2: build tree
  const tree = [];
  let current = null;
  for (const node of keep) {
    if (!node.label) continue;
    if (node.kind === 'h2') {
      current = { label: node.label, hash: '#' + node.id, anchors: [] };
      tree.push(current);
    } else {
      const child = { label: node.label, hash: '#' + node.id };
      if (current) current.anchors.push(child);
      else tree.push({ label: node.label, hash: '#' + node.id, anchors: [] });
    }
  }
  return tree;
}

// Configure a marked instance with heading IDs and link modifiers.
// Called by render.js on its own marked import to guarantee the renderer
// is applied to the instance that actually parses page content.
// (esbuild bundling can create separate marked instances per module,
// so calling marked.use() here at module level is not reliable.)
function configureMarked(m) {
  m.use({ renderer: {
    heading({ tokens, depth }) {
      const html = this.parser.parseInline(tokens);
      const raw = html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, '').replace(/\\n/g, ' ');
      let id = raw.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (_usedIds.has(id)) {
        let n = 2;
        while (_usedIds.has(`${id}-${n}`)) n++;
        id = `${id}-${n}`;
      }
      _usedIds.add(id);
      // Downgrade H1s after the first to <h2 class="h1-style"> to preserve
      // SEO structure (one true H1) while keeping the visual appearance.
      if (depth === 1) {
        if (_firstH1Seen) {
          return `<h2 class="h1-style" id="${id}">${html.replace(/\\n/g, '<br>')}</h2>\n`;
        }
        _firstH1Seen = true;
      }
      return `<h${depth} id="${id}">${html.replace(/\\n/g, '<br>')}</h${depth}>\n`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${title}"` : '';

      // Strip +newtab / +sametab modifiers from href
      let target = null;
      if (href && href.endsWith('+newtab')) {
        href = href.slice(0, -'+newtab'.length);
        target = '_blank';
      } else if (href && href.endsWith('+sametab')) {
        href = href.slice(0, -'+sametab'.length);
        target = '_self';
      }

      // Default: external URLs open in new tab (unless +sametab overrides)
      if (target === null && href && /^https?:\/\//.test(href)) {
        target = '_blank';
      }

      if (target === '_blank') {
        return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      return `<a href="${href}"${titleAttr}>${text}</a>`;
    },
    image({ href, title, text }) {
      // Normalize relative paths: "media/..." → "/media/..."
      if (href && !href.startsWith('/') && !href.startsWith('http') && !href.startsWith('data:')) {
        href = '/' + href;
      }
      const titleAttr = title ? ` title="${title}"` : '';
      // Self-hosted video: render <video> instead of <img>
      if (href && /\.(mp4|webm|ogv|mov|m4v)(\?.*)?$/i.test(href)) {
        const altAttr = text ? ` aria-label="${text}"` : '';
        return `<video src="${href}" controls playsinline preload="metadata"${altAttr}${titleAttr}></video>`;
      }
      return `<img src="${href}" alt="${text || ''}" loading="lazy"${titleAttr}>`;
    }
  }});
}

// ---------------------------------------------------------------------------
// Defaults — overridden by settings/*.md frontmatter
// ---------------------------------------------------------------------------
const DEFAULTS = {
  title: 'sitemd',
  brandName: '',
  description: 'Websites from Markdown. Built for Claude Code.',
  url: 'https://sitemd.cc',
  port: 4747,
  pagesDir: 'pages',
  themeDir: 'theme',
  outputDir: 'site',
  sitemap: true,
  robots: true,
  // SEO defaults
  language: 'en',
  seoTitleSuffix: null, // derived from brandName after settings load
  ogImage: 'auto',
  ogStyle: 'template',
  structuredData: true,
  llmsTxt: true,
  markdownOutput: true,
  allowAICrawlers: true,
  indexNow: true,
  _sitemdBadge: 'show',
  authProvider: 'none',
  dataProvider: 'none',
};

// ---------------------------------------------------------------------------
// Settings loader — reads settings/*.md frontmatter as config
// ---------------------------------------------------------------------------
function loadSettings(root) {
  const config = { ...DEFAULTS };
  const settingsDir = path.join(root, 'settings');

  if (!fs.existsSync(settingsDir)) return config;

  const files = fs.readdirSync(settingsDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(settingsDir, file), 'utf-8');
    const { meta } = parseFrontmatter(raw);

    // header.md — parse nav items, brand, and theme toggle
    if (file === 'header.md') {
      config.brandDisplay = meta.brandDisplay || 'text';
      if (meta.brandImage) config.brandImage = meta.brandImage; // legacy fallback
      if (meta.brandName) config.headerBrandName = meta.brandName;
      if (meta.themeModeToggle) config.themeModeToggle = meta.themeModeToggle;
      config.headerSearch = meta.search || 'show';
      config.authHeaderButton = meta.headerAuth || 'show';
      if (Array.isArray(meta.items)) {
        config.navItems = parseNavItems(raw);
      }
      continue;
    }

    // groups.md — parse named page groups
    if (file === 'groups.md') {
      config.groups = parseGroups(raw);
      continue;
    }

    // footer.md — parse footer settings
    if (file === 'footer.md') {
      config.footerCopyright = meta.copyright || '&copy; {{year}} {{brandName}}';
      if (meta.brandName) config.footerBrandName = meta.brandName;
      if (meta.brandDisplay) config.footerBrandDisplay = meta.brandDisplay;
      config.footerTagline = meta.tagline || '';
      config.footerGroups = parseNavItems(raw);
      config.footerSocial = parseFooterSocial(raw);
      continue;
    }

    // seo.md — parse SEO settings
    if (file === 'seo.md') {
      config.language = meta.language || config.language;
      if (meta.titleSuffix != null) config.seoTitleSuffix = meta.titleSuffix;
      // ogImage: "auto" (generate cards), file path, or "none"
      if (meta.ogImage != null) {
        const val = String(meta.ogImage).trim();
        if (val === 'auto' || val === 'true') config.ogImage = 'auto';
        else if (val === 'none' || val === 'false' || val === '') config.ogImage = 'none';
        else config.ogImage = val; // file path
      }
      // Backward compat: old ogImages + defaultOgImage settings
      if (meta.ogImages != null && meta.ogImage == null) {
        config.ogImage = (meta.ogImages === 'true' || meta.ogImages === true) ? 'auto' : 'none';
      }
      if (meta.defaultOgImage && meta.ogImage == null && config.ogImage === 'auto') {
        config.ogImage = meta.defaultOgImage;
      }
      config.defaultAuthor = meta.defaultAuthor || '';
      config.twitterHandle = meta.twitterHandle || '';
      config.ogStyle = meta.ogStyle || config.ogStyle;
      config.ogBackground = meta.ogBackground || '';
      config.ogTextColor = meta.ogTextColor || '';
      config.ogLogo = meta.ogLogo || '';
      if (meta.customFavicon) config.customFavicon = meta.customFavicon; // legacy fallback
      config.structuredData = meta.structuredData !== 'false' && meta.structuredData !== false;
      config.llmsTxt = meta.llmsTxt !== 'false' && meta.llmsTxt !== false;
      config.markdownOutput = meta.markdownOutput !== 'false' && meta.markdownOutput !== false;
      config.allowAICrawlers = meta.allowAICrawlers !== 'false' && meta.allowAICrawlers !== false;
      config.orgName = meta.orgName || '';
      config.orgLogo = meta.orgLogo || '';
      config.indexNow = meta.indexNow !== 'false' && meta.indexNow !== false;
      continue;
    }

    // email.md — parse email provider settings
    if (file === 'email.md') {
      config.emailProvider = meta.provider || '';
      config.emailApiKey = meta.apiKey || '';
      config.emailFrom = meta.from || '';
      config.emailRegion = meta.region || '';
      config.emailAccessKeyId = meta.accessKeyId || '';
      config.emailSecretAccessKey = meta.secretAccessKey || '';
      config.emailHost = meta.host || '';
      config.emailPort = meta.port || 587;
      config.emailUser = meta.user || '';
      config.emailPass = meta.pass || '';
      continue;
    }

    // forms.md — parse form settings
    if (file === 'forms.md') {
      config.formSubmitLabel = meta.submitLabel || 'Submit';
      config.formThankYou = meta.thankYou || 'Thank you for your submission!';
      config.formHoneypot = meta.honeypot !== 'false' && meta.honeypot !== false;
      config.formCountrySortToTop = parseCountrySortToTop(raw);
      continue;
    }

    // auth.md — parse auth settings
    if (file === 'auth.md') {
      config.authEnabled = meta.enabled === true || meta.enabled === 'true';
      config.authProvider = meta.provider || 'none';
      config.authLoginMode = ['magic-link', 'password'].includes(meta.loginMode) ? meta.loginMode : 'password';
      config.authLoginPage = meta.loginPage || '/login';
      config.authAfterLogin = meta.afterLogin || '/account';
      config.authAfterLogout = meta.afterLogout || '/';
      config.authUserDataUrl = (meta.userDataUrl || '').replace(/\/+$/, '');
      config.authUserTypeField = meta.userTypeField || '';
      config.authAccessDeniedPage = meta.accessDeniedPage || '/access-denied';
      // Non-secret provider settings from auth.md
      config.authApiUrl = meta.apiUrl || '';
      config.authSupabaseUrl = meta.supabaseUrl || '';
      config.authFirebaseAuthDomain = meta.firebaseAuthDomain || '';
      config.authFirebaseProjectId = meta.firebaseProjectId || '';
      config.authAuth0Domain = meta.auth0Domain || '';
      config.authAuth0ClientId = meta.auth0ClientId || '';
      // Secret credentials come from .sitemd/secrets
      // (merged via flattenSecretsOnly below)
      continue;
    }

    // data.md — parse data provider settings
    if (file === 'data.md') {
      config.dataProvider = meta.provider || 'none';
      config.dataCacheTTL = parseInt(meta.cacheTTL, 10) || 300;
      config.dataLoadingText = meta.loadingText || 'Loading...';
      config.dataEmptyText = meta.emptyText || 'No items found.';
      config.dataErrorText = meta.errorText || 'Unable to load data.';
      config.dataSources = Array.isArray(meta.sources) ? meta.sources : [];
      continue;
    }

    // analytics.md — parse analytics settings
    if (file === 'analytics.md') {
      config.analyticsProvider = meta.provider || '';
      config.analyticsId = meta.id || '';
      config.analyticsHost = meta.host || '';
      config.gtm = meta.gtm || '';
      // Parse pixel entries — frontmatter parser yields strings like "meta: 123"
      config.pixels = (Array.isArray(meta.pixels) ? meta.pixels : []).map(entry => {
        if (typeof entry === 'object') return entry;
        const colonIdx = entry.indexOf(':');
        if (colonIdx === -1) return null;
        return { [entry.slice(0, colonIdx).trim()]: entry.slice(colonIdx + 1).trim() };
      }).filter(Boolean);
      config.customHead = meta.customHead || '';
      continue;
    }

    // All other settings — merge flat values into config
    for (const [key, val] of Object.entries(meta)) {
      if (key.startsWith('#')) continue; // skip comments that parsed as keys
      // Coerce booleans and numbers
      if (val === 'true') config[key] = true;
      else if (val === 'false') config[key] = false;
      else if (/^\d+$/.test(val)) config[key] = parseInt(val, 10);
      else config[key] = val;
    }
  }

  // Overlay secrets from config store (non-secrets live in settings/*.md)
  const configStoreData = loadBackendConfig(root);
  const secretsFlat = flattenSecretsOnly(configStoreData);
  for (const [key, val] of Object.entries(secretsFlat)) {
    if (val !== undefined && val !== '') config[key] = val;
  }

  // Overlay env vars (highest precedence — CI can override everything)
  const envFlat = flattenBackendConfig(loadEnvConfig());
  for (const [key, val] of Object.entries(envFlat)) {
    if (val !== undefined && val !== '') config[key] = val;
  }

  // Populate named color palette — built-in defaults + user overrides via palette.* keys
  const palette = {
    red: '#ef4444', orange: '#f97316', amber: '#f59e0b', yellow: '#eab308',
    lime: '#84cc16', green: '#22c55e', emerald: '#10b981', teal: '#14b8a6',
    cyan: '#06b6d4', sky: '#0ea5e9', blue: '#3b82f6', indigo: '#6366f1',
    violet: '#8b5cf6', purple: '#a855f7', fuchsia: '#d946ef', pink: '#ec4899',
    rose: '#f43f5e', slate: '#64748b', gray: '#6b7280', zinc: '#71717a',
    stone: '#78716c',
  };
  for (const [key, val] of Object.entries(config)) {
    if (key.startsWith('palette.')) {
      palette[key.slice(8)] = val;
    }
  }
  config._palette = palette;
  setPalette(palette);

  // Mode detection: activated (receipt present) vs trial (no receipt)
  const { loadSiteReceipt } = require('./site-identity');
  const receipt = loadSiteReceipt(root);
  config._mode = (process.env.SITEMD_FORCE_TRIAL === '1') ? 'trial' : (receipt.activated ? 'activated' : 'trial');
  config._siteTitle = config.title;
  config._brandName = config.brandName || config.title;

  // Derive domain from url (strip protocol and trailing path)
  if (config.url && !config.domain) {
    config.domain = config.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }

  // Normalize deployPages — array of group names and/or path prefixes (null = deploy all)
  if (Array.isArray(config.deployPages) && config.deployPages.length > 0) {
    config.deployPages = config.deployPages.map(String).filter(Boolean);
  } else {
    config.deployPages = null;
  }

  // Ensure brandImage and customFavicon have defaults (may come from meta.md, header.md, or seo.md)
  if (!config.brandImage) config.brandImage = '/theme/images/logo.svg';
  if (!config.customFavicon) config.customFavicon = '';

  // Derive brandName from title when not explicitly set
  if (!config.brandName) config.brandName = config.title || 'sitemd';

  // Auto-derive org identity from brand settings when not explicitly set
  if (!config.orgName) config.orgName = config.brandName;
  if (!config.orgLogo) config.orgLogo = config.brandImage;

  // Derive default titleSuffix from brandName if not explicitly set in seo.md
  if (config.seoTitleSuffix == null) {
    config.seoTitleSuffix = ' | ' + (config.brandName || config.title || '');
  }

  // Compat: seoTitleTemplate alias for SEO modules
  config.seoTitleTemplate = '{title} | ' + (config.brandName || config.title || '');

  return config;
}

// ---------------------------------------------------------------------------
// Settings self-repair — validate and fix settings files on build
// ---------------------------------------------------------------------------

const { SETTINGS_SCHEMA, KEY_FILE_MAP } = require('./settings-schema');

/**
 * Validate settings files and log warnings for issues.
 * Returns an array of warning strings (empty = all good).
 */
function validateSettings(root) {
  const settingsDir = path.join(root, 'settings');
  if (!fs.existsSync(settingsDir)) return [];

  const warnings = [];

  for (const [filename, schema] of Object.entries(SETTINGS_SCHEMA)) {
    const filePath = path.join(settingsDir, filename);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, 'utf-8');
    const meta = parseFrontmatter(raw);

    // Check required keys
    if (schema.required) {
      for (const key of schema.required) {
        if (!meta[key] && meta[key] !== false && meta[key] !== 0) {
          warnings.push(`${filename}: missing required "${key}"`);
        }
      }
    }

    // Check for unknown keys
    if (schema.known) {
      for (const key of Object.keys(meta)) {
        if (key.startsWith('#')) continue; // parsed comment
        if (key.startsWith('palette.')) continue; // dynamic palette keys
        if (!schema.known.includes(key)) {
          const correctFile = KEY_FILE_MAP[key];
          if (correctFile) {
            const files = Array.isArray(correctFile) ? correctFile : [correctFile];
            const others = files.filter(f => f !== filename);
            if (others.length > 0) {
              warnings.push(`${filename}: "${key}" belongs in ${others.join(' or ')}, not here`);
            } else {
              // Key is actually valid in this file — shouldn't happen, but guard
              warnings.push(`${filename}: unknown key "${key}" — check spelling or remove`);
            }
          } else {
            warnings.push(`${filename}: unknown key "${key}" — check spelling or remove`);
          }
        }
      }
    }

    // Check valid values
    if (schema.validValues) {
      for (const [key, allowed] of Object.entries(schema.validValues)) {
        if (meta[key] && !allowed.includes(String(meta[key]))) {
          warnings.push(`${filename}: "${key}" has invalid value "${meta[key]}" (expected: ${allowed.join(', ')})`);
        }
      }
    }
  }

  return warnings;
}

/**
 * Run settings validation and print warnings during build.
 * Non-blocking — warns but does not fail the build.
 */
function repairSettings(root) {
  standardizeSettingsIndent(root);
  const warnings = validateSettings(root);
  if (warnings.length > 0) {
    console.log('\n  Settings warnings:');
    for (const w of warnings) {
      console.log(`    ⚠ ${w}`);
    }
    console.log();
  }
  return warnings;
}

module.exports = { DEFAULTS, marked, configureMarked, resetHeadingIds, extractTocTree, loadSettings, validateSettings, repairSettings };
