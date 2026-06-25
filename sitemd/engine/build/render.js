const fs = require('fs');
const path = require('path');
const { loadSettings, marked, configureMarked, resetHeadingIds, extractTocTree, repairSettings } = require('./config');
configureMarked(marked);
const { parseFrontmatter, parseLinkEntry, buildBtnHtml, buildEmbedHtml, buildCardGridHtml, clearPendingCardImages, setCardSourceFile, buildImageHtml, buildImageRowHtml, buildGalleryHtml, resetImageGroupCounter, buildAuthorHtml, resolveColor } = require('./parse');
const { resolveIcon } = require('./icons');
const { findMarkdownFiles } = require('./discover');
const { parseCssDefaults, generateThemeStyles } = require('./css');
const { syncGroups } = require('./groups');
const { scaffoldMissingPages } = require('./scaffold');
const { buildBrand, buildBrandInline, buildBrandImage, buildNav, buildFooter, buildSidebar, buildSidebarFromItems, buildHeaderSearch, buildAuthButton } = require('./html');
const { parseFormBlock, buildFormHtml, resetFormCounter } = require('./premium/form');
const { parseDataBlock, buildDataHtml } = require('./premium/data');
const { parseModalBlock, buildModalHtml, buildGlobalModals } = require('./modal');
const { preprocessBody } = require('./preprocess');
const { injectPageExtras } = require('./inject');
const { reconcileFilenames } = require('./rename');
const { generateSearchIndex } = require('./search');
const { seoPreviewSlugFor } = require('./seo-preview');
const { deriveDescription, copyCustomImages } = require('../seo');
const { resolveSeoData, generateSeoHtml, generateSitemap, generateRobotsTxt, generateLlmsTxt, generateLlmsFullTxt, generateFeeds } = require('../seo/seo');
const { generateAnalyticsHtml, generateGtmBodyHtml } = require('./premium/analytics');
const { compileEmails } = require('../cli/email');

// ---------------------------------------------------------------------------
// Page comment — auto-injected quick-reference for markdown features
// ---------------------------------------------------------------------------
const PAGE_COMMENT_MARKER = '# How to write in sitemd:';
const PAGE_COMMENT_BLOCK = [
  '# How to write in sitemd:',
  '# Markdown: **bold**, *italic*, [link](url), ![image](url), `code`',
  '# Headings: # H1 through ###### H6 (auto-generate anchor IDs)',
  '# Code blocks: ``` with optional language (```js, ```yaml, etc.)',
  '# Tables: | col | col | with | --- | separator row',
  '# Lists: - unordered, 1. ordered (nesting supported)',
  '# Blockquotes: > quoted text',
  '# Buttons: button: Label: /slug (see docs/buttons-and-links)',
  '# Inline anchors: {#id} on its own line',
  '# Link modifiers: [text](url+newtab), [text](url+sametab)',
  '# Embeds: embed: URL (YouTube, Vimeo, Spotify, CodePen, tweets, any URL)',
  '# Cards: card: Title, card-text: Text, card-image: URL (multiple for carousel), card-link: Label: /slug',
  '# Images: ![alt](url +width:N +circle +bw +expand) — see docs/images',
  '# Image row: image-row: with indented ![alt](url) lines (equal height)',
  '# Gallery: gallery: with indented ![alt](url) lines (grid + lightbox)',
  '# Forms: form: with indented YAML (webhook, fields, pages) — see docs/forms',
  '# Data: data: source, data-display: cards/list/table/detail — see docs/dynamic-data',
  '# Tooltips: [hover text]{tooltip content} — inline tooltip on hover/focus',
  '# Modals: modal: id with indented content (tab: Tab Name for tabbed sections)',
  '# Modal triggers: [link text](#modal:id) — opens the named modal on click',
  '# Gated sections: gated: type1, type2 ... /gated (content visible only to those user types)',
  '# Inline HTML: use any HTML tag directly — <div>, <span>, <details>, etc.',
  '# Horizontal rules: ---',
  '#',
].join('\n') + '\n';

function ensurePageComments(files) {
  for (const { filePath } of files) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (raw.includes(PAGE_COMMENT_MARKER)) continue;

    const patched = raw.replace(/^---\n/, '---\n' + PAGE_COMMENT_BLOCK);
    if (patched !== raw) {
      fs.writeFileSync(filePath, patched);
    }
  }
}

// ---------------------------------------------------------------------------
// Title properties — auto-populate titleSuffix, tabTitle, and tabTitleSuffix
// in page frontmatter. Derives defaults from brandName / title so users see
// the full browser-tab title at a glance and can edit or set to "none" to
// remove it per page.
// ---------------------------------------------------------------------------
function ensureTitleSuffix(files, config) {
  const defaultSuffix = config.seoTitleSuffix || '';

  for (const { filePath } of files) {
    let raw = fs.readFileSync(filePath, 'utf-8');
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;

    let fm = fmMatch[1];

    // Skip homepage — it uses site title only, no suffix
    const slugMatch = fm.match(/^slug\s*:\s*(.+)/m);
    const slug = slugMatch ? slugMatch[1].trim() : null;
    if (slug === '/' || slug === '/index') continue;
    // Also skip if filename implies homepage
    if (filePath.endsWith('/index.md') && !filePath.includes('/pages/')) continue;

    const titleLineRe = /^(title\s*:.+)$/m;
    if (!titleLineRe.test(fm)) continue;

    let dirty = false;

    // Inject titleSuffix if missing
    if (!/^titleSuffix\s*:/m.test(fm)) {
      raw = raw.replace(titleLineRe, `$1\ntitleSuffix: "${defaultSuffix}"`);
      fm = raw.match(/^---\n([\s\S]*?)\n---/)[1];
      dirty = true;
    }

    // Inject tabTitle if missing (defaults to the title value)
    if (!/^tabTitle\s*:/m.test(fm)) {
      const titleVal = fm.match(/^title\s*:\s*(.+)/m);
      if (titleVal) {
        const suffixLineRe = /^(titleSuffix\s*:.+)$/m;
        raw = raw.replace(suffixLineRe, `$1\ntabTitle: ${titleVal[1]}`);
        fm = raw.match(/^---\n([\s\S]*?)\n---/)[1];
        dirty = true;
      }
    }

    // Inject tabTitleSuffix if missing (defaults to titleSuffix value)
    if (!/^tabTitleSuffix\s*:/m.test(fm)) {
      const tabTitleLineRe = /^(tabTitle\s*:.+)$/m;
      if (tabTitleLineRe.test(fm)) {
        raw = raw.replace(tabTitleLineRe, `$1\ntabTitleSuffix: "${defaultSuffix}"`);
        dirty = true;
      }
    }

    if (dirty) {
      fs.writeFileSync(filePath, raw);
    }
  }
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Frontend state explainer — inline diagnostic for broken module states.
// Detects missing scripts, failed license checks, and stuck UI on deployed sites.
// ---------------------------------------------------------------------------
function buildDiagnosticScript() {
  return `<script>(function(){var h=location.hostname;if(h==='localhost'||h==='127.0.0.1'||h==='0.0.0.0')return;if(sessionStorage.getItem('sitemd-diag-d'))return;var issues=[];var diagnosed=false;var authEl=document.getElementById('sitemd-auth');var dataEl=document.getElementById('sitemd-data');var authOk=!authEl,dataOk=!dataEl;if(authEl){authEl.addEventListener('error',function(){issues.push({t:'auth-404',m:'auth.js failed to load'});run()});authEl.addEventListener('load',function(){authEl._loaded=true})}if(dataEl){dataEl.addEventListener('error',function(){issues.push({t:'data-404',m:'data.js failed to load'});run()});dataEl.addEventListener('load',function(){dataEl._loaded=true})}document.addEventListener('sitemd:auth-ready',function(){authOk=true});document.addEventListener('sitemd:data-ready',function(){dataOk=true});setTimeout(function(){if(!authOk&&authEl){if(!authEl._loaded)issues.push({t:'auth-timeout',m:'auth.js did not load'});else issues.push({t:'auth-init',m:'auth.js loaded but failed to initialize'})}if(!dataOk&&dataEl){if(!dataEl._loaded)issues.push({t:'data-timeout',m:'data.js did not load'});else issues.push({t:'data-init',m:'data.js loaded but failed to initialize'})}var main=document.getElementById('main');if(main&&main.style.visibility==='hidden')issues.push({t:'hidden',m:'Page content is hidden (auth flow incomplete)'});var gated=document.querySelectorAll('.gated-section');var vis=document.querySelectorAll('.gated-section.gated-visible');if(gated.length>0&&vis.length===0)issues.push({t:'gated',m:'Gated content is permanently hidden'});if(issues.length>0)run()},8000);function run(){if(diagnosed)return;diagnosed=true;var main=document.getElementById('main');if(main&&main.style.visibility==='hidden')main.style.visibility='visible';console.group('%c[sitemd] Site diagnostics — issues detected','font-weight:bold;color:#c33');for(var i=0;i<issues.length;i++){var is=issues[i];console.warn('[sitemd] '+is.m);if(is.t.indexOf('404')>-1||is.t.indexOf('timeout')>-1){console.info('  The build referenced a script that is missing from the deploy output.');console.info('  Fix: sitemd auth login && sitemd build && sitemd deploy')}else if(is.t.indexOf('init')>-1){console.info('  The script loaded but failed to start. Check provider configuration.');console.info('  Fix: verify settings/auth.md or settings/data.md credentials')}else if(is.t==='hidden'||is.t==='gated'){console.info('  This is a symptom of auth module failure — see above.')}}console.groupEnd();var d=document.createElement('div');d.id='sitemd-diag';d.innerHTML='<div style="color:#e87;font-weight:600;margin-bottom:6px;font-size:13px">sitemd: site issue detected</div><div style="color:#aaa;font-size:12px;margin-bottom:8px">'+issues[0].m+'</div><div style="color:#666;font-size:11px">Open browser console for details</div><button onclick="this.parentNode.remove();try{sessionStorage.setItem(\\u0027sitemd-diag-d\\u0027,\\u00271\\u0027)}catch(e){}" style="position:absolute;top:6px;right:8px;background:none;border:none;color:#666;cursor:pointer;font-size:16px;padding:4px;line-height:1">&times;</button>';d.style.cssText='position:fixed;top:16px;right:16px;max-width:340px;background:#1e1e1e;color:#ccc;padding:14px 18px;border-radius:8px;font-family:JetBrains Mono,Fira Code,Cascadia Code,monospace;z-index:99999;box-shadow:0 4px 24px rgba(0,0,0,.25);line-height:1.5';document.body.appendChild(d)}})()</script>`;
}

// ---------------------------------------------------------------------------
// 500 error page generator — standalone HTML served by hosting platforms on server errors
// ---------------------------------------------------------------------------
function build500Page(config, { faviconHead, themeStyles, defaultMode }) {
  const buildMeta = JSON.stringify({
    mode: config._mode,
    modules: true,
    built: new Date().toISOString(),
    pages: config._pageCount || 0,
  });
  return `<!DOCTYPE html>
<html lang="${config.language || 'en'}" data-theme="${defaultMode === 'system' ? 'light' : defaultMode}"${defaultMode === 'system' ? ' data-theme-auto' : ''}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Site Error — ${config.brandName || config.title || 'Site'}</title>
  ${faviconHead}
  ${themeStyles}
  <meta name="robots" content="noindex">
  <!-- sitemd-build: ${buildMeta} -->
</head>
<body>
  <main id="main" style="display:flex;align-items:center;justify-content:center;min-height:80vh;text-align:center;padding:2rem">
    <div>
      <h1 style="font-size:2rem;margin-bottom:0.5rem">This site is experiencing a temporary issue</h1>
      <p style="color:var(--text-muted, #888);font-size:1.1rem">Please try again in a few minutes.</p>
      <p style="margin-top:2rem"><a href="/" style="color:var(--link, #4f9fcf);text-decoration:none">Go to homepage</a></p>
    </div>
  </main>
  <script>
    console.group('%c[sitemd] Site Error Diagnostics', 'font-weight:bold;color:#c33');
    console.warn('Your site returned a 500 error.');
    console.info('This typically means:');
    console.info('  1. The build produced incomplete output');
    console.info('  2. The hosting platform encountered a configuration issue');
    console.info('');
    console.info('To fix:');
    console.info('  1. Rebuild:  sitemd build');
    console.info('  2. Redeploy: sitemd deploy');
    console.info('');
    console.info('If the issue persists, check:');
    console.info('  - Deploy target config: settings/deploy.md');
    console.info('  - Build output: site/ directory');
    console.groupEnd();
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
function build(root, opts = {}) {
  const start = Date.now();
  const config = loadSettings(root);

  // Rename page files whose filename doesn't match their frontmatter slug
  const renameResult = reconcileFilenames(path.join(root, config.pagesDir));
  if (!opts.quiet) {
    for (const r of renameResult.renamed) console.log(`  Renamed: ${r.from} → ${r.to}`);
    for (const c of renameResult.conflicts) console.log(`  Warning: Cannot rename ${c.file} — target exists`);
  }

  syncGroups(root);
  // Re-read config after syncGroups may have updated groups.md
  const updatedConfig = loadSettings(root);
  Object.assign(config, updatedConfig);
  scaffoldMissingPages(config, root);

  const DIST = path.join(root, config.outputDir);
  const PAGES = path.join(root, config.pagesDir);
  const THEME = path.join(root, config.themeDir);

  // Ensure dist exists (production only — trial mode uses memory)
  if (config._mode !== 'trial') {
    fs.mkdirSync(DIST, { recursive: true });
  }

  // Read layout template
  const layoutTemplate = fs.readFileSync(path.join(THEME, 'layout.html'), 'utf-8');

  // Find all .md files recursively in pages/, auth-pages/, and gated-pages/
  // auth-pages/, account-pages/, and gated-pages/ are special directories whose
  // files keep their own slugs independent of file path (exempt from filename reconciliation).
  const files = findMarkdownFiles(PAGES).map(f => ({ ...f, dirPrefix: 'pages' }));
  if (config.authEnabled) {
    for (const special of ['auth-pages', 'account-pages', 'gated-pages']) {
      const dir = path.join(root, special);
      if (fs.existsSync(dir)) files.push(...findMarkdownFiles(dir).map(f => ({ ...f, dirPrefix: special })));
    }
  }

  // Ensure every page file has the sitemd quick-reference comment in frontmatter
  ensurePageComments(files);

  // Auto-populate titleSuffix in page frontmatter when missing
  ensureTitleSuffix(files, config);

  const pages = [];

  // First pass — collect page metadata
  for (const { filePath, relativePath, dirPrefix } of files) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { meta, body } = parseFrontmatter(raw);

    // Derive slug from frontmatter or file path
    let slug = meta.slug;
    if (!slug) {
      slug = '/' + relativePath.replace(/\.md$/, '').replace(/\\/g, '/');
      // Remove trailing /index or /docs-home etc. for section homes
      if (slug.endsWith('/index')) slug = slug.slice(0, -6) || '/';
    }

    // Auto-derive description from body when frontmatter has none
    const description = meta.description || deriveDescription(body) || config.description;

    // Derive gating from gated-pages/ directory structure
    const gatedDir = path.join(root, 'gated-pages');
    if (filePath.startsWith(gatedDir + path.sep)) {
      const afterGated = path.relative(gatedDir, filePath);
      const firstDir = afterGated.split(path.sep)[0];
      if (firstDir && firstDir !== path.basename(filePath)) {
        meta._gatedTypes = [firstDir];
      }
    }

    // Frontmatter gated: overrides directory-derived types
    if (meta.gated) {
      const raw = Array.isArray(meta.gated) ? meta.gated : String(meta.gated).split(',');
      meta._gatedTypes = raw.map(s => String(s).trim()).filter(Boolean);
    }

    pages.push({
      filePath,
      relativePath,
      dirPrefix: dirPrefix || 'pages',
      slug,
      title: meta.title || config.title,
      description,
      layout: meta.layout || 'default',
      body,
      meta,
    });
  }

  // Filter draft pages in production mode
  const isProduction = config._mode === 'activated';
  const draftPages = [];
  for (let i = pages.length - 1; i >= 0; i--) {
    if (pages[i].meta.draft === true) {
      if (isProduction) {
        draftPages.push(pages[i].slug);
        pages.splice(i, 1);
      } else {
        // Inject draft banner in dev mode
        pages[i].body = `<div class="draft-banner" style="background:#f59e0b;color:#000;text-align:center;padding:8px;font-weight:600;font-size:14px;position:sticky;top:0;z-index:999">DRAFT — This page will not appear in production builds</div>\n\n` + pages[i].body;
      }
    }
  }
  if (draftPages.length > 0) {
    console.log(`  Skipping ${draftPages.length} draft page(s) in production mode`);
  }

  // Filter pages by deployPages scope (selective deployment)
  if (config.deployPages) {
    const deployGroups = config.deployPages.filter(e => !e.startsWith('/'));
    const deployPaths = config.deployPages.filter(e => e.startsWith('/'));
    const totalBefore = pages.length;

    for (let i = pages.length - 1; i >= 0; i--) {
      const page = pages[i];
      const members = Array.isArray(page.meta.groupMember) ? page.meta.groupMember : [];
      const memberNames = members.map(m => typeof m === 'string' ? (m.includes(':') ? m.split(':')[0].trim() : m.trim()) : '');
      const inGroup = deployGroups.some(g => memberNames.includes(g));
      const inPath = deployPaths.some(p => page.slug === p || page.slug.startsWith(p + '/'));
      if (!inGroup && !inPath && page.slug !== '/404') {
        pages.splice(i, 1);
      }
    }
    console.log(`  Deploy scope: ${pages.length} of ${totalBefore} page(s) matching deployPages filter`);
  }

  // Copy public/ assets to dist before rendering
  copyCustomImages(root, config);

  // Resolve SEO data per page
  const seoEnabled = true;
  for (const page of pages) {
    page.seoData = seoEnabled ? resolveSeoData(page, config) : {};
  }

  // Generate theme overrides
  const cssDefaults = parseCssDefaults(path.join(THEME, 'styles.css'));
  const themeStyles = generateThemeStyles(config, cssDefaults);
  const analyticsHtml = generateAnalyticsHtml(config);
  const gtmBodyHtml = generateGtmBodyHtml(config);
  const validModes = ['system', 'light', 'dark', 'paper'];
  const defaultMode = validModes.includes(config.defaultMode) ? config.defaultMode : 'system';

  // Favicon <link> tag — letter mode uses SVG with theme switching, brand/custom uses ico/png
  const _favMode = config.favicon || (config.customFavicon ? 'custom' : 'letter');
  const _favIsLetter = _favMode === 'letter' ||
    (_favMode === 'brand' && !config.brandImage) ||
    (_favMode === 'custom' && !config.customFavicon);
  const faviconHead = _favIsLetter
    ? '<link rel="icon" type="image/svg+xml" href="/favicon.svg" id="favicon">'
    : '<link rel="icon" type="image/x-icon" href="/favicon.ico">\n  <link rel="icon" type="image/png" sizes="192x192" href="/favicon.png">';

  // Clear card auto-image queue before rendering
  clearPendingCardImages();
  resetImageGroupCounter();

  // Build global modals (sitemd/modals/*.md) — rendered once, injected into every page
  const modalsDir = path.join(root, 'modals');
  const globalModalsHtml = buildGlobalModals(modalsDir, (md) => {
    // Run the same component preprocessing pipeline as page content
    let b = md;
    b = b.replace(/\[([^\]]+)\]\{([^}]+)\}/g, (_, trigger, content) => {
      return `<span class="tooltip" tabindex="0"><span class="tooltip-trigger">${trigger}</span><span class="tooltip-content" role="tooltip">${content}</span></span>`;
    });
    b = b.replace(/(?:^button:\s+.+$\n?)+/gm, (block) => {
      const lines = block.trim().split('\n');
      const buttons = [];
      let hasBig = false;
      for (const line of lines) {
        const rest = line.replace(/^button:\s+/, '');
        const parsed = parseLinkEntry(rest);
        if (!parsed) continue;
        if (parsed.size === 'big') hasBig = true;
        buttons.push(buildBtnHtml(parsed));
      }
      if (buttons.length === 0) return block;
      const rowCls = hasBig ? 'btn-row btn-row-lg' : 'btn-row';
      return `<div class="${rowCls}">${buttons.join('')}</div>\n`;
    });
    b = b.replace(/(?:^(?:card(?:-(?:text|image|icon|link))?):\s+.+$\n?(?:\n(?=card(?:-(?:text|image|icon|link))?:\s))?)+/gm, (block) => buildCardGridHtml(block));
    b = b.replace(/^embed:\s+(\S+)$/gm, (_, url) => buildEmbedHtml(url));
    b = b.replace(/!\[([^\]]*)\]\(([^)]*\s\+[^)]+)\)/g, (_, alt, url) => buildImageHtml(alt, url));
    b = b.replace(/^form:\s*\n((?:[ \t]+.+\n?)+)/gm, (_, block) => {
      const lines = block.split('\n').filter(l => l.trim());
      const minIndent = Math.min(...lines.map(l => l.match(/^(\s*)/)[1].length));
      const deindented = lines.map(l => l.slice(minIndent)).join('\n');
      return buildFormHtml(parseFormBlock(deindented), config);
    });
    b = b.replace(/\\n/g, '<br>');
    let rendered = marked(b);
    rendered = rendered.replace(/<a\s+href="#modal:([^"]+)"([^>]*)>/g, '<a href="#" data-modal-trigger="$1"$2>');
    return rendered;
  });

  // Second pass — render pages
  for (const page of pages) {
    // Reset heading ID tracker per page
    resetHeadingIds();
    resetFormCounter();

    // Run component preprocessing pipeline (buttons, cards, embeds, forms, etc.)
    setCardSourceFile(page.filePath);
    let body = preprocessBody(page.body, config);

    let content = marked(body);

    // Convert {{currentUser.field}} to hydration placeholders (skip inside <code>/<pre>)
    content = content.replace(
      /(<pre[\s>][\s\S]*?<\/pre>|<code[\s>][\s\S]*?<\/code>)|\{\{currentUser\.(\w+)\}\}/g,
      (match, codeBlock, field) => {
        if (codeBlock) return codeBlock;
        return `<span data-current-user="${field}" class="current-user-value"></span>`;
      }
    );

    // Replace {{brandDisplay}} and {{brandImage}} content variables (skip inside <code>/<pre>)
    // Supports {{brandDisplay +width:N}} for scaling
    content = content.replace(
      /(<pre[\s>][\s\S]*?<\/pre>|<code[\s>][\s\S]*?<\/code>)|\{\{brandDisplay(?:\s?\+width:(\d+))?\}\}/g,
      (match, codeBlock, w) => {
        if (codeBlock) return codeBlock;
        return buildBrandInline(config, w ? parseInt(w) : null);
      }
    );
    content = content.replace(
      /(<pre[\s>][\s\S]*?<\/pre>|<code[\s>][\s\S]*?<\/code>)|\{\{brandImage\}\}/g,
      (match, codeBlock) => {
        if (codeBlock) return codeBlock;
        return buildBrandImage(config);
      }
    );

    // Post-process: inline icon:name → inline SVG with optional +size:N +color:val modifiers (skip inside <code>/<pre>)
    content = content.replace(
      /(<pre[\s>][\s\S]*?<\/pre>|<code[\s>][\s\S]*?<\/code>)|icon:([a-z0-9-]+)((?:\s\+(?:size|color):[^\s]+)*)/g,
      (match, codeBlock, name, modifiers) => {
        if (codeBlock) return codeBlock;
        const svg = resolveIcon(name);
        if (!svg) return match;
        let style = '';
        if (modifiers) {
          const parts = [];
          const sizeM = modifiers.match(/\+size:(\d+)/);
          const colorM = modifiers.match(/\+color:(#[0-9a-fA-F]{3,6}|[a-z]+)/);
          if (sizeM) parts.push(`width:${sizeM[1]}px;height:${sizeM[1]}px`);
          if (colorM) parts.push(`color:${resolveColor(colorM[1])}`);
          if (parts.length) style = ` style="${parts.join(';')}"`;
        }
        return `<span class="inline-icon"${style}>${svg}</span>`;
      }
    );

    // Store rendered content for search index
    page.renderedContent = content;
    // Post-process: #modal:id links → modal trigger data attributes
    content = content.replace(/<a\s+href="#modal:([^"]+)"([^>]*)>/g,
      '<a href="#" data-modal-trigger="$1"$2>');

    let sidebarName = null;
    let sidebarOverrideHtml = null;
    const pageSidebar = page.meta.sidebar;
    if (pageSidebar) {
      if (pageSidebar === 'none') {
        sidebarOverrideHtml = '';
      } else if (pageSidebar === 'self') {
        const tree = extractTocTree(content);
        sidebarOverrideHtml = buildSidebarFromItems(null, page.slug, {
          selfTree: tree,
        });
        // Expand `sidebar: self` shortcut into the explicit nested list,
        // writing it back to the source file so the author can edit/reorder.
        if (tree.length > 0 && page.filePath) {
          try {
            const raw = fs.readFileSync(page.filePath, 'utf-8');
            const lines = [];
            for (const node of tree) {
              lines.push('  - ' + node.label + ': ' + page.slug + node.hash);
              for (const a of (node.anchors || [])) {
                lines.push('    - ' + a.label + ': ' + page.slug + a.hash);
              }
            }
            const next = raw.replace(/^sidebar:\s*self\s*$/m, 'sidebar:\n' + lines.join('\n'));
            if (next !== raw) fs.writeFileSync(page.filePath, next);
          } catch (e) { /* non-fatal */ }
        }
      } else if (Array.isArray(pageSidebar)) {
        sidebarOverrideHtml = buildSidebarFromItems(pageSidebar, page.slug);
      }
    }
    if (sidebarOverrideHtml === null) {
      if (page.meta.sidebarGroupShown === 'none') {
        sidebarName = null;
      } else if (page.meta.sidebarGroupShown) {
        sidebarName = page.meta.sidebarGroupShown;
      } else {
        // Derive from group membership + locations
        const members = page.meta.groupMember;
        if (members && Array.isArray(members)) {
          for (const entry of members) {
            const gName = entry.includes(':') ? entry.slice(0, entry.indexOf(':')).trim() : entry.trim();
            const gDef = (config.groups || {})[gName];
            if (gDef && gDef.locations && gDef.locations.sidebar && gDef.locations.sidebar.length > 0) {
              sidebarName = gName;
              break;
            }
          }
        }
      }
    }
    const layout = layoutTemplate;
    const nav = buildNav(config, pages, page.slug);
    const sidebar = sidebarOverrideHtml !== null
      ? sidebarOverrideHtml
      : (sidebarName ? buildSidebar(config, sidebarName, page.slug) : '');

    const brand = buildBrand(config);
    const headerSearch = buildHeaderSearch(config);
    const footer = buildFooter(config);

    // Store page fragment data for skeleton dev server (before layout assembly)
    const _rawSuffix = page.meta.tabTitleSuffix && page.meta.tabTitleSuffix !== 'none' ? page.meta.tabTitleSuffix : (page.meta.titleSuffix && page.meta.titleSuffix !== 'none' ? page.meta.titleSuffix : '');
    const _titleSuffix = _rawSuffix && !_rawSuffix.startsWith(' ') ? ' ' + _rawSuffix : _rawSuffix;
    const pageTitle = (page.meta.tabTitle || page.title) + _titleSuffix;

    if (!config._pageFragments) config._pageFragments = new Map();
    const urlPath = (page.slug === '/' || page.slug === '/index') ? '/' : page.slug;
    // Determine per-page auth gating
    const _gatedTypes = page.meta._gatedTypes;
    let authAttr = '';
    if (_gatedTypes && _gatedTypes.length > 0) {
      authAttr = _gatedTypes.includes('anyLoggedIn') ? 'required' : 'required';
    } else if (page.meta.auth === 'required') {
      authAttr = 'required';
    }
    const gatedTypesAttr = (_gatedTypes && _gatedTypes.length > 0 && !_gatedTypes.includes('anyLoggedIn'))
      ? _gatedTypes.join(',') : '';

    config._pageFragments.set(urlPath, {
      content,
      nav,
      sidebar,
      title: pageTitle,
      description: page.description,
      slug: page.slug,
      bodyClass: (sidebarName || sidebar) ? 'has-sidebar' : '',
      authRequired: authAttr === 'required',
      gatedTypes: gatedTypesAttr,
      hasGatedSections: content.includes('data-gated='),
    });
    // Store shell data once (footer/brand/headerSearch are page-independent)
    if (!config._shellData) {
      // Inject "built with sitemd.cc" badge into dev-server footer (mirrors the full-page injection at render time)
      let shellFooter = footer;
      if (config._sitemdBadge !== 'hide') {
        const badge = '<p class="sitemd-badge" style="font-size:var(--font-xs,12px);color:var(--color-text-tertiary,#999);margin:0;">built with <a href="https://sitemd.cc" target="_blank" rel="noopener" style="color:var(--color-accent,#4f46e5);text-decoration:none;">sitemd.cc</a></p>';
        shellFooter = shellFooter.replace(
          /(<p class="footer-copyright">[^<]*<\/p>)\n?\s*(<div class="footer-brand">[\s\S]*?<\/div>)?/,
          '<div class="footer-meta" style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">$1\n      $2\n      ' + badge + '</div>'
        );
      }
      config._shellData = {
        footer: shellFooter,
        brand,
        headerSearch,
        authButton: buildAuthButton(config),
        brandName: config.brandName,
        faviconHead,
        themeStyles,
        language: config.language,
        defaultMode,
        // Auth/data config for skeleton injection
        authProvider: config.authProvider,
        authCfg: (config.authProvider && config.authProvider !== 'none') ? JSON.stringify({
          provider: config.authProvider,
          apiUrl: config.authApiUrl || '',
          supabaseUrl: config.authSupabaseUrl || '',
          supabaseAnonKey: config.authSupabaseAnonKey || '',
          firebaseApiKey: config.authFirebaseApiKey || '',
          firebaseAuthDomain: config.authFirebaseAuthDomain || '',
          firebaseProjectId: config.authFirebaseProjectId || '',
          clerkPublishableKey: config.authClerkPublishableKey || '',
          auth0Domain: config.authAuth0Domain || '',
          auth0ClientId: config.authAuth0ClientId || '',
          loginMode: config.authLoginMode || 'password',
          loginPage: config.authLoginPage || '/login',
          afterLogin: config.authAfterLogin || '/account',
          afterLogout: config.authAfterLogout || '/',
          userDataUrl: config.authUserDataUrl || '',
          userTypeField: config.authUserTypeField || '',
          accessDeniedPage: config.authAccessDeniedPage || '/access-denied',
        }).replace(/'/g, '&#39;') : null,
        dataProvider: config.dataProvider,
        dataCfg: (config.dataProvider && config.dataProvider !== 'none') ? JSON.stringify({
          provider: config.dataProvider,
          cacheTTL: config.dataCacheTTL || 300,
          errorText: config.dataErrorText || '',
          sources: config.dataSources || [],
          supabaseUrl: config.dataSupabaseUrl || '',
          supabaseAnonKey: config.dataSupabaseAnonKey || '',
          firebaseApiKey: config.dataFirebaseApiKey || '',
          firebaseProjectId: config.dataFirebaseProjectId || '',
          airtableBaseId: config.dataAirtableBaseId || '',
          airtableToken: config.dataAirtableToken || '',
          restBaseUrl: config.dataRestBaseUrl || '',
          restHeaders: config.dataRestHeaders || '',
        }).replace(/'/g, '&#39;') : null,
      };
    }

    // Replace all layout placeholders except {{content}} first,
    // then insert content last so its literal {{...}} tokens aren't consumed
    const hasSidebar = !!(sidebarName || sidebar);
    const sidebarClass = hasSidebar ? ' site-main--sidebar' : '';
    const sidebarAside = hasSidebar
      ? `<aside class="sidebar-aside"><nav class="sidebar-nav" aria-label="Documentation">${sidebar}</nav></aside>`
      : '';

    let html = layout
      .replace(/\{\{title\}\}/g, pageTitle)
      .replace(/\{\{description\}\}/g, page.description)
      .replace(/\{\{nav\}\}/g, nav)
      .replace(/\{\{sidebarClass\}\}/g, sidebarClass)
      .replace(/\{\{sidebarAside\}\}/g, sidebarAside)
      .replace(/\{\{sidebar\}\}/g, sidebar)
      .replace(/\{\{brand\}\}/g, brand)
      .replace(/\{\{headerSearch\}\}/g, headerSearch)
      .replace(/\{\{footer\}\}/g, footer)
      .replace(/\{\{siteName\}\}/g, config.brandName)
      .replace(/\{\{year\}\}/g, String(new Date().getFullYear()))
      .replace(/\{\{faviconHead\}\}/g, faviconHead)
      .replace(/\{\{themeStyles\}\}/g, themeStyles)
      .replace(/\{\{analytics\}\}/g, analyticsHtml)
      .replace(/\{\{seo\}\}/g, seoEnabled ? generateSeoHtml(page.seoData, config) : '')
      .replace(/\{\{gtmBody\}\}/g, gtmBodyHtml)
      .replace(/\{\{content\}\}/g, content)
      .replace(/data-theme="light"/g, defaultMode === 'system' ? 'data-theme="light" data-theme-auto' : `data-theme="${defaultMode}"`)
      .replace(/lang="en"/g, `lang="${config.language}"`);

    // Inject global modals, auth/data scripts, embed scripts, RSS, badge, diagnostics
    html = injectPageExtras(html, page, config, { globalModalsHtml, buildDiagnosticScript });

    if (config._mode === 'trial') {
      // Trial mode: inject dev banner, store in memory (no files on disk)
      const isDemoSite = config.title === 'sitemd Demo Site';
      if (!isDemoSite) {
        const bannerSpacer = '<div id="sitemd-dev-banner-spacer" style="height:37px"></div>';
        const banner = '<div id="sitemd-dev-banner" style="position:fixed;bottom:0;left:0;right:0;background:#1e1e1e;color:#cccccc;text-align:center;padding:8px 16px;font-family:\'JetBrains Mono\',\'Fira Code\',\'Cascadia Code\',monospace;font-size:13px;z-index:99999;border-top:1px solid #3c3c3c">SITEMD TRIAL MODE \u2014 This site is not activated (or needs to resync via API). Run <code style="background:#2d2d2d;padding:2px 5px;border-radius:3px;font-size:12px">sitemd activate</code> (or tell your agent to), or <a href="https://sitemd.cc/docs/how-to-activate-site" target="_blank" style="color:#4f9fcf;text-decoration:none">read more about site activation</a>.</div>';
        html = html.replace('</footer>', '</footer>\n' + bannerSpacer);
        html = html.replace('</body>', banner + '\n</body>');
      }

      if (!config._memoryOutput) config._memoryOutput = new Map();
      const urlPath = (page.slug === '/' || page.slug === '/index') ? '/' : page.slug;
      config._memoryOutput.set(urlPath, html);
      if (page.slug === '/404') config._memoryOutput.set('__404__', html);
    } else {
      // Activated mode: write to disk
      if (page.slug === '/404') {
        // 404 page outputs as flat 404.html at site root (required by all deploy targets)
        fs.writeFileSync(path.join(DIST, '404.html'), html);
      } else if (page.slug === '/' || page.slug === '/index') {
        fs.writeFileSync(path.join(DIST, 'index.html'), html);
      } else {
        const outDir = path.join(DIST, page.slug.replace(/^\//, ''));
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), html);
      }

      // Write markdown version alongside HTML (for AI crawlers and LLM tools)
      if (config.markdownOutput) {
        const mdBody = page.body.trim();
        const mdContent = mdBody.startsWith('# ') ? mdBody : `# ${page.title}\n\n${mdBody}`;
        if (page.slug === '/404') {
          fs.writeFileSync(path.join(DIST, '404.md'), mdContent);
        } else if (page.slug === '/' || page.slug === '/index') {
          fs.writeFileSync(path.join(DIST, 'index.md'), mdContent);
        } else {
          const outDir = path.join(DIST, page.slug.replace(/^\//, ''));
          fs.mkdirSync(outDir, { recursive: true });
          fs.writeFileSync(path.join(outDir, 'index.md'), mdContent);
        }
      }
    }
  }

  // Register SEO preview stubs (dev-only — content is lazy-generated by the dev
  // server on first request, since previews are rarely accessed and re-running
  // keyword extraction + 40KB HTML assembly for every page on every rebuild was
  // the dominant cost in the dev rebuild loop).
  if (!config._pageFragments) config._pageFragments = new Map();
  for (const page of pages) {
    if (page.slug === '/404') continue;
    const previewSlug = seoPreviewSlugFor(page);
    const nav = buildNav(config, pages, previewSlug);
    config._pageFragments.set(previewSlug, {
      content: null, // lazy: server fills this on first request via generateSeoPreviewForPage
      _seoPreviewSourcePage: page,
      nav,
      sidebar: '',
      title: 'SEO Preview',
      description: '',
      slug: previewSlug,
      bodyClass: '',
      authRequired: false,
      gatedTypes: '',
      hasGatedSections: false,
    });
  }

  // Remove orphaned page directories (pages that no longer exist)
  const validSlugs = new Set(pages.map(p => p.slug.replace(/^\//, '')));
  validSlugs.add('theme'); // preserved: copied separately
  validSlugs.add('404');   // preserved: 404.html is written as flat file
  validSlugs.add('og');    // preserved: OG images directory
  validSlugs.add('media'); // preserved: user media and auto-generated images
  function cleanOrphans(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const rel = prefix ? prefix + '/' + entry.name : entry.name;
      if (validSlugs.has(rel)) continue;
      const isParent = [...validSlugs].some(s => s.startsWith(rel + '/'));
      if (isParent) {
        cleanOrphans(path.join(dir, entry.name), rel);
      } else {
        fs.rmSync(path.join(dir, entry.name), { recursive: true });
      }
    }
  }
  cleanOrphans(DIST, '');

  // Generate search index (all modes — needed for sidebar search)
  generateSearchIndex(pages, config, DIST);

  // Production-only: disk operations (assets, SEO files)
  let emailCount = 0;
  let feedResults = [];
  if (config._mode !== 'trial') {
    // Copy theme assets to dist
    const distTheme = path.join(DIST, 'theme');
    fs.mkdirSync(distTheme, { recursive: true });
    fs.copyFileSync(path.join(THEME, 'styles.css'), path.join(distTheme, 'styles.css'));

    // Copy runtime scripts (auth, data) to build output — bundle from src/ if available
    const { bundleFrontendModule, hasSrc } = require('./bundle-frontend');
    if (config.authProvider && config.authProvider !== 'none') {
      if (hasSrc('auth')) {
        bundleFrontendModule('auth', path.join(distTheme, 'auth.js'));
      } else {
        const authScriptPath = path.join(__dirname, '..', 'auth', 'auth.js');
        if (fs.existsSync(authScriptPath)) fs.copyFileSync(authScriptPath, path.join(distTheme, 'auth.js'));
      }
    }
    if (config.dataProvider && config.dataProvider !== 'none') {
      if (hasSrc('data')) {
        bundleFrontendModule('data', path.join(distTheme, 'data.js'));
      } else {
        const dataScriptPath = path.join(__dirname, '..', 'data', 'data.js');
        if (fs.existsSync(dataScriptPath)) fs.copyFileSync(dataScriptPath, path.join(distTheme, 'data.js'));
      }
    }

    // Copy font files
    const fontsDir = path.join(THEME, 'fonts');
    if (fs.existsSync(fontsDir)) {
      const distFonts = path.join(distTheme, 'fonts');
      fs.mkdirSync(distFonts, { recursive: true });
      for (const f of fs.readdirSync(fontsDir)) {
        fs.copyFileSync(path.join(fontsDir, f), path.join(distFonts, f));
      }
    }

    // Generate sitemap.xml
    if (config.sitemap && generateSitemap) {
      fs.writeFileSync(path.join(DIST, 'sitemap.xml'), generateSitemap(pages, config));
    }

    // Generate robots.txt
    if (config.robots && generateRobotsTxt) {
      fs.writeFileSync(path.join(DIST, 'robots.txt'), generateRobotsTxt(config));
    }

    // Generate llms.txt
    if (config.llmsTxt && generateLlmsTxt) {
      fs.writeFileSync(path.join(DIST, 'llms.txt'), generateLlmsTxt(pages, config));
    }

    // Generate llms-full.txt — full markdown content of every page
    if (config.llmsTxt && config.markdownOutput && generateLlmsFullTxt) {
      fs.writeFileSync(path.join(DIST, 'llms-full.txt'), generateLlmsFullTxt(pages, config));
    }

    // Write IndexNow API key verification file
    if (config.indexNow !== false && config.indexnowApiKey) {
      fs.writeFileSync(path.join(DIST, `${config.indexnowApiKey}.txt`), config.indexnowApiKey);
    }

    // Generate RSS feeds for groups with feed: true
    if (generateFeeds) {
      feedResults = generateFeeds(pages, config);
      for (const feed of feedResults) {
        const feedDir = path.join(DIST, path.dirname(feed.path));
        fs.mkdirSync(feedDir, { recursive: true });
        fs.writeFileSync(path.join(DIST, feed.path), feed.xml);
      }
    }

    // Compile email templates from emails/ into _emails.json
    emailCount = compileEmails(root, DIST, config);

    // Generate 500.html error page — served by hosting platforms on server errors
    config._pageCount = pages.length;
    fs.writeFileSync(path.join(DIST, '500.html'), build500Page(config, { faviconHead, themeStyles, defaultMode }));

    // Build-time validation: warn if script tags were injected but files are missing
    if (config.authProvider && config.authProvider !== 'none' && !fs.existsSync(path.join(distTheme, 'auth.js'))) {
      if (!opts.quiet) {
        console.log('');
        console.log('  \u26a0 Auth is configured but auth.js is missing from the build output.');
        console.log('    Fix: Run "sitemd build" while connected to the internet to refresh modules.');
      }
    }
    if (config.dataProvider && config.dataProvider !== 'none' && !fs.existsSync(path.join(distTheme, 'data.js'))) {
      if (!opts.quiet) {
        console.log('');
        console.log('  \u26a0 Data provider is configured but data.js is missing from the build output.');
        console.log('    Fix: Run "sitemd build" while connected to the internet to refresh modules.');
      }
    }
  }

  // Validate settings and warn about issues
  repairSettings(root);

  const elapsed = Date.now() - start;
  const mode = config._mode === 'trial' ? 'Trial — unactivated (memory-only)' : 'Activated';

  // Build summary
  const generated = [];
  if (config._mode !== 'trial') {
    if (config.sitemap) generated.push('sitemap.xml');
    if (config.robots) generated.push('robots.txt');
    if (config.llmsTxt) generated.push('llms.txt');
    if (config.llmsTxt && config.markdownOutput) generated.push('llms-full.txt');
    if (feedResults.length) generated.push(`${feedResults.length} feed${feedResults.length > 1 ? 's' : ''}`);
    if (emailCount) generated.push(`${emailCount} email${emailCount > 1 ? 's' : ''}`);
  }

  if (!opts.quiet) {
    console.log('');
    console.log('sitemd build complete');
    console.log(`  Pages: ${pages.length}`);
    pages.forEach(p => console.log(`    ${p.slug} ← ${p.relativePath}`));
    if (generated.length) console.log(`  Generated: ${generated.join(', ')}`);
    if (config._mode !== 'trial') console.log(`  Output: ${config.outputDir}/`);
    console.log(`  Time: ${elapsed}ms`);
    console.log(`  Mode: ${mode}`);
    console.log('');
  }

  // Build slug → file map for dev panel
  const slugMap = {};
  for (const page of pages) slugMap[page.slug] = page.dirPrefix + '/' + page.relativePath;

  return { pages, config, slugMap, memoryOutput: config._memoryOutput || null, pageFragments: config._pageFragments || null, shellData: config._shellData || null };
}

module.exports = { build };
