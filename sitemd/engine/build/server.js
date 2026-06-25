const fs = require('fs');
const path = require('path');
const http = require('http');
const { syncThemeToCSS } = require('./css');
const { build } = require('./render');
const { requireWithExtraPaths } = require('./modules');
const { createDevAuthHandler } = require('./dev-auth');

// ---------------------------------------------------------------------------
// Dev Panel — helpers
// ---------------------------------------------------------------------------
const DEV_PANEL_DIR = path.resolve(__dirname, 'dev-panel');

function validateDevPath(p, root) {
  if (!p || typeof p !== 'string') return false;
  const allowed = ['pages/', 'settings/', 'account-pages/', 'auth-pages/', 'gated-pages/', 'modals/'];
  if (!allowed.some(a => p.startsWith(a))) return false;
  // Resolve and verify the path stays within the project root
  const resolved = path.resolve(root || '.', p);
  const resolvedRoot = path.resolve(root || '.');
  if (!resolved.startsWith(resolvedRoot + path.sep)) return false;
  // Symlink-aware check: if the directory containing the file is a symlink
  // (e.g. pages/ -> ../source/.../pages/), trust the logical path check above.
  // Only block if neither the logical path nor the real path is within root.
  try {
    const real = fs.realpathSync(resolved);
    const realRoot = fs.realpathSync(resolvedRoot);
    const inLogicalRoot = resolved.startsWith(resolvedRoot + path.sep);
    const inRealRoot = real.startsWith(realRoot + path.sep) || real === realRoot;
    if (!inLogicalRoot && !inRealRoot) return false;
  } catch {
    // File doesn't exist yet (e.g. new file creation) — resolved check above is sufficient
  }
  return true;
}

function listFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    // Resolve symlinks to determine actual type
    const isLink = entry.isSymbolicLink();
    let stat;
    if (isLink) { try { stat = fs.statSync(fullPath); } catch { continue; } }
    if (entry.isDirectory() || (isLink && stat && stat.isDirectory())) {
      const sub = listFiles(fullPath);
      for (const s of sub) {
        results.push({ path: entry.name + '/' + s.path, type: s.type });
      }
    } else if (entry.isFile() || (isLink && stat && stat.isFile())) {
      results.push({ path: entry.name, type: 'file' });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Dev Server
// ---------------------------------------------------------------------------
function serve(root, port) {
  const { ensureDependencies } = require('./deps');
  ensureDependencies(root);
  syncThemeToCSS(root);
  let { pages: initialPages, config, slugMap, memoryOutput, pageFragments, shellData } = build(root, { quiet: true });
  let isTrial = config._mode === 'trial';
  const DIST = path.join(root, config.outputDir);
  const THEME = path.join(root, config.themeDir || 'theme');

  // Dev auth stub — intercepts /__auth/* requests for local auth testing (custom provider only)
  const devAuth = (config.authProvider === 'custom') ? createDevAuthHandler() : null;

  function patchDevAuth() {
    if (devAuth && shellData && shellData.authCfg) {
      const parsed = JSON.parse(shellData.authCfg);
      parsed.apiUrl = '/__auth';
      shellData.authCfg = JSON.stringify(parsed);
    }
  }
  patchDevAuth();

  // Initial favicon generation (fire-and-forget, works in trial mode)
  const { generateFavicons } = require('./favicon');
  generateFavicons(config, root, DIST).catch(() => {});

  // OG image module — resolve once for reuse in rebuilds (dynamic require breaks in pkg binaries)
  let ogModule = null;
  try {
    ogModule = requireWithExtraPaths(require.resolve('../seo/og'));
    ogModule.checkDependencies();
    if (config.ogImage === 'auto') ogModule.generateOgImages(initialPages, config, DIST, root).catch(() => {});
  } catch (e) { /* og module failed */ }

  // Initial card auto-image generation (fire-and-forget, reload deferred until server is ready)
  const { getPendingCardImages, clearPendingCardImages } = require('./parse');
  const { generateCardImages } = require('./card-images');
  let initialCardGenDone = null;
  {
    const pending = getPendingCardImages();
    if (pending.length > 0) {
      const items = [...pending];
      clearPendingCardImages();
      initialCardGenDone = generateCardImages(items, root);
    }
  }

  const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
  };

  // SSE clients for live reload
  const sseClients = new Set();

  const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    const query = new URL(req.url, 'http://localhost').searchParams;

    // SSE endpoint for live reload
    if (urlPath === '/__reload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write('data: connected\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // ----- Dev auth stub -----
    if (devAuth && devAuth(req, res)) return;

    // ----- Dev Panel API endpoints -----

    // Serve dev panel static assets
    if (urlPath === '/__dev/panel.js') {
      const entry = path.join(DEV_PANEL_DIR, 'src', 'index.js');
      if (fs.existsSync(entry)) {
        const esbuild = requireWithExtraPaths('esbuild');
        const result = esbuild.buildSync({
          entryPoints: [entry],
          bundle: true,
          format: 'iife',
          write: false,
          platform: 'browser',
        });
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(result.outputFiles[0].text);
        return;
      }
      // Binary mode — serve pre-bundled file
      const bundled = path.join(DEV_PANEL_DIR, 'dev-panel.js');
      if (fs.existsSync(bundled)) {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        fs.createReadStream(bundled).pipe(res);
        return;
      }
    }
    if (urlPath === '/__dev/panel.css') {
      const fp = path.join(DEV_PANEL_DIR, 'dev-panel.css');
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end(fs.readFileSync(fp, 'utf-8'));
      return;
    }

    // Slug map
    if (urlPath === '/__dev/slug-map') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(slugMap || {}));
      return;
    }

    // File listing
    if (urlPath === '/__dev/files') {
      const pages = listFiles(path.join(root, 'pages'));
      const settings = listFiles(path.join(root, 'settings'));
      const accountPages = listFiles(path.join(root, 'account-pages'));
      const authPages = listFiles(path.join(root, 'auth-pages'));
      const gatedPages = listFiles(path.join(root, 'gated-pages'));
      const modals = listFiles(path.join(root, 'modals'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ pages, settings, 'account-pages': accountPages, 'auth-pages': authPages, 'gated-pages': gatedPages, modals }));
      return;
    }

    // Read file
    if (urlPath === '/__dev/file' && req.method === 'GET') {
      const filePath = query.get('path');
      if (!validateDevPath(filePath, root)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid path' }));
        return;
      }
      const absPath = path.join(root, filePath);
      if (!fs.existsSync(absPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(fs.readFileSync(absPath, 'utf-8'));
      return;
    }

    // Write file
    if (urlPath === '/__dev/file' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { path: filePath, content } = JSON.parse(body);
          if (!validateDevPath(filePath, root)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Invalid path' }));
            return;
          }
          const absPath = path.join(root, filePath);
          fs.writeFileSync(absPath, content);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          // Symlinked files write to a target outside the watched dir tree,
          // so fs.watch won't detect the change — trigger rebuild manually
          try {
            if (fs.lstatSync(absPath).isSymbolicLink()) {
              clearTimeout(debounce);
              debounce = setTimeout(() => {
                if (rebuilding) return;
                const isSettings = filePath.startsWith('settings/');
                suppressWatch = true;
                rebuilding = true;
                try {
                  if (isSettings) syncThemeToCSS(root);
                  const result = build(root, { quiet: true });
                  slugMap = result.slugMap;
                  memoryOutput = result.memoryOutput;
                  pageFragments = result.pageFragments;
                  shellData = result.shellData;
                  isTrial = result.config._mode === 'trial';
                  config = result.config;
                  patchDevAuth();
                  console.log(`  Rebuilt (${filePath} changed via symlink)`);
                  notifyReload();
                } catch (err) {
                  console.error('  Rebuild error:', err.message);
                } finally {
                  rebuilding = false;
                  setTimeout(() => { suppressWatch = false; }, 200);
                }
              }, 150);
            }
          } catch (e) { /* lstat failed — not a symlink, fs.watch will handle it */ }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }

    // ----- Dev image proxy (trial mode protection) -----
    // In trial mode, image src attributes are rewritten to /__dev/img/ URLs
    // so ripped HTML has broken image paths outside localhost.
    if (urlPath.startsWith('/__dev/img/')) {
      const encoded = urlPath.slice('/__dev/img/'.length);
      let decoded;
      try { decoded = Buffer.from(decodeURIComponent(encoded), 'base64url').toString('utf-8'); } catch (e) {
        res.writeHead(400); res.end('Bad path'); return;
      }
      if (decoded.includes('..')) { res.writeHead(400); res.end('Bad path'); return; }
      const filePath = path.join(root, decoded);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mime = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      res.writeHead(404); res.end('Not found'); return;
    }

    // ----- Content Fragment API endpoints (skeleton dev server) -----

    if (urlPath === '/__api/page' && pageFragments) {
      const slug = (query.get('slug') || '/').replace(/\/+$/, '') || '/';
      const frag = pageFragments.get(slug);
      if (frag) {
        // Lazy SEO preview: stub fragments carry content === null and a source page reference.
        // First request generates the content and memoizes it on the fragment; the next rebuild
        // installs a fresh fragment with content === null again, naturally invalidating the cache.
        if (frag.content === null && frag._seoPreviewSourcePage) {
          const { generateSeoPreviewForPage } = require('./seo-preview');
          frag.content = generateSeoPreviewForPage(frag._seoPreviewSourcePage, config);
        }
        const html = isTrial ? rewriteMediaImages(frag.content) : frag.content;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Page not found' }));
      }
      return;
    }

    if (urlPath === '/__api/shell' && shellData) {
      // Build the full header HTML (everything inside <header>)
      const headerHtml = `<header class="site-header">
    <div class="header-inner">
      ${shellData.brand}
      <nav class="site-nav" id="site-nav">
        ${pageFragments ? (pageFragments.values().next().value || {}).nav || '' : ''}
      </nav>
      <div class="header-actions">
        ${shellData.headerSearch}
        ${shellData.authButton || ''}
        <button class="theme-toggle" type="button" aria-label="Toggle theme">
          <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          <svg class="icon-paper" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
        </button>
        <button class="mobile-menu-toggle" type="button" aria-label="Toggle menu" aria-expanded="false">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
    </div>
  </header>`;

      const footerHtml = `<footer class="site-footer">
    <div class="footer-inner">
      ${shellData.footer}
    </div>
  </footer>`;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        header: headerHtml,
        footer: footerHtml,
        head: {
          title: shellData.brandName,
          favicon: '/favicon.svg',
          faviconHead: shellData.faviconHead || '',
        },
        themeCSS: '/theme/styles.css',
        brand: shellData.brand,
      }));
      return;
    }

    if (urlPath === '/__api/meta' && pageFragments) {
      const slug = (query.get('slug') || '/').replace(/\/+$/, '') || '/';
      const frag = pageFragments.get(slug);
      if (frag) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          title: frag.title,
          description: frag.description,
          bodyClass: frag.bodyClass,
          nav: frag.nav,
          sidebar: frag.sidebar,
          authRequired: frag.authRequired || false,
          gatedTypes: frag.gatedTypes || '',
          hasGatedSections: frag.hasGatedSections || false,
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Page not found' }));
      }
      return;
    }

    // Serve layout scripts (inline JS from layout.html — search, lightbox, modals, etc.)
    if (urlPath === '/__api/layout-scripts') {
      const layoutPath = path.join(THEME, 'layout.html');
      if (fs.existsSync(layoutPath)) {
        const layoutHtml = fs.readFileSync(layoutPath, 'utf-8');
        // Extract all <script>...</script> blocks (non-src) from the layout
        const scripts = [];
        const scriptRe = /<script>[\s\S]*?<\/script>/g;
        let m;
        while ((m = scriptRe.exec(layoutHtml)) !== null) {
          // Strip <script> tags, keep inner content
          const inner = m[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
          scripts.push(inner);
        }
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(scripts.join('\n'));
      } else {
        res.writeHead(404);
        res.end('');
      }
      return;
    }

    // Serve hydration script
    if (urlPath === '/__dev/hydrate.js') {
      const fp = path.join(DEV_PANEL_DIR, 'hydrate.js');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(fs.readFileSync(fp, 'utf-8'));
      return;
    }

    // ----- Static file serving -----

    // Helper: inject dev panel into HTML
    function injectDevPanel(html) {
      const devHead = `<link rel="stylesheet" href="/__dev/panel.css">`;
      html = html.replace('</head>', devHead + '\n</head>');
      const devBody = `<script src="/__dev/panel.js" defer></script>`;
      html = html.replace('</body>', devBody + '\n</body>');
      return html;
    }

    // Helper: rewrite media image paths to dev proxy URLs (trial mode only)
    function rewriteMediaImages(html) {
      return html.replace(/(<img\b[^>]*\bsrc=")(\/?media\/[^"]+)(")/g, (_, pre, mediaPath, post) => {
        const clean = mediaPath.startsWith('/') ? mediaPath.slice(1) : mediaPath;
        const encoded = Buffer.from(clean, 'utf-8').toString('base64url');
        return pre + '/__dev/img/' + encoded + post;
      });
    }

    // Helper: build skeleton HTML document (empty containers, hydrated client-side)
    function buildSkeleton() {
      const sd = shellData || {};
      const defaultMode = sd.defaultMode || 'light';
      const themeAttr = defaultMode === 'system' ? 'data-theme="light" data-theme-auto' : `data-theme="${defaultMode}"`;
      const lang = sd.language || 'en';
      return `<!DOCTYPE html>
<html lang="${lang}" ${themeAttr}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loading...</title>
  <meta name="description" content="">
  ${sd.faviconHead || '<link rel="icon" href="/favicon.svg">'}
  <link rel="stylesheet" href="/theme/styles.css">
  ${sd.themeStyles || ''}
  <style>
    #sitemd-main { opacity: 0; transition: opacity 0.15s; }
    #sitemd-main.loaded { opacity: 1; }
  </style>
  <link rel="stylesheet" href="/__dev/panel.css">
${(sd.authProvider && sd.authProvider !== 'none' && sd.authCfg) ? `  <script>if(document.querySelector('[data-auth="required"]')&&!localStorage.getItem('sitemd-auth-token')){var m=document.getElementById('sitemd-main')||document.getElementById('main');if(m)m.style.visibility='hidden'}</script>
  <script>window.__sitemdAuthCfg=${sd.authCfg}</script>
  <script id="sitemd-auth" data-config='${sd.authCfg}' src="/theme/auth.js"></script>
  <style>.gated-section{display:none!important}.gated-section.gated-visible{display:block!important}</style>` : ''}
</head>
<body>
  <a href="#main" class="skip-link">Skip to content</a>
  <div id="sitemd-shell"></div>
  <main id="sitemd-main" class="site-main">
    <article class="content"></article>
  </main>
  <div id="sitemd-footer"></div>
${isTrial && config.title !== 'sitemd Demo Site' ? '  <div id="sitemd-dev-banner-spacer" style="height:12px"></div>' : ''}
  <div class="search-overlay" id="search-overlay" hidden>
    <div class="search-dialog" role="dialog" aria-modal="true" aria-label="Search">
      <div class="search-input-wrap">
        <svg class="search-input-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="search-input" type="search" placeholder="Search..." aria-label="Search site" autocomplete="off">
      </div>
      <div class="search-results"></div>
      <div class="search-footer"><kbd>Esc</kbd> close <span class="search-footer-sep">&middot;</span> <kbd>&uarr;&darr;</kbd> navigate <span class="search-footer-sep">&middot;</span> <kbd>Enter</kbd> select</div>
    </div>
  </div>
  <script>
    // Theme init (before hydration to prevent flash)
    (function() {
      var themes = ['light', 'dark', 'paper'];
      var html = document.documentElement;
      var stored = localStorage.getItem('sitemd-theme');
      if (stored && themes.indexOf(stored) !== -1) {
        html.setAttribute('data-theme', stored);
        var el = document.getElementById('favicon');
        if (el) el.href = '/favicon-' + stored + '.svg';
      } else if (html.hasAttribute('data-theme-auto') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        html.setAttribute('data-theme', 'dark');
        var el = document.getElementById('favicon');
        if (el) el.href = '/favicon-dark.svg';
      }
    })();
  </script>
${(sd.dataProvider && sd.dataProvider !== 'none' && sd.dataCfg) ? `  <script id="sitemd-data" data-config='${sd.dataCfg}' src="/theme/data.js"></script>` : ''}
  <script src="/__dev/hydrate.js"></script>
  <script src="/__dev/panel.js" defer></script>
${isTrial && config.title !== 'sitemd Demo Site' ? `  <div id="sitemd-dev-banner" style="position:fixed;bottom:0;left:0;right:0;background:#1e1e1e;color:#cccccc;text-align:center;padding:8px 16px;font-family:'JetBrains Mono','Fira Code','Cascadia Code',monospace;font-size:13px;z-index:99999;border-top:1px solid #3c3c3c">SITEMD TRIAL (UNACTIVATED) \u2014 Activate to unlock disk output and deployment. Run <code style="background:#2d2d2d;padding:2px 5px;border-radius:3px;font-size:12px">sitemd activate</code> (or tell your agent to), or <a href="https://sitemd.cc/docs/how-to-activate-site" target="_blank" style="color:#4f9fcf;text-decoration:none;">read more about activation</a>.</div>` : ''}
</body>
</html>`;
    }

    // ----- Skeleton serving: ALL dev server page requests return skeleton HTML -----
    // Check if this is a page request (not a static asset, not an API/dev endpoint)
    function isPageRequest(urlPath) {
      // Not a page if it has a file extension (static asset)
      const ext = path.extname(urlPath);
      if (ext && ext !== '.html') return false;
      // Not a page if it starts with /__
      if (urlPath.startsWith('/__')) return false;
      // Not a page if it's a known static directory
      if (urlPath.startsWith('/theme/') || urlPath.startsWith('/media/') || urlPath.startsWith('/og/')) return false;
      return true;
    }

    // Trial mode: serve skeleton for page requests, theme assets from disk/cache
    if (isTrial && memoryOutput) {
      // Page requests get skeleton HTML (content loaded via hydration)
      if (isPageRequest(urlPath)) {
        const cleanPath = urlPath.replace(/\/+$/, '') || '/';
        const hasPage = pageFragments && (pageFragments.has(cleanPath) || pageFragments.has(cleanPath + '/'));
        // Serve skeleton for known pages and unknown paths (hydrate.js handles 404)
        res.writeHead(hasPage ? 200 : 404, { 'Content-Type': 'text/html' });
        res.end(buildSkeleton());
        return;
      }

      // Serve theme assets from disk (CSS, fonts are core — always on disk)
      if (urlPath.startsWith('/theme/')) {
        const assetPath = path.join(THEME, urlPath.slice(7));
        if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
          const ext = path.extname(assetPath);
          const mime = MIME[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': mime });
          fs.createReadStream(assetPath).pipe(res);
          return;
        }
        // Runtime modules (auth.js, data.js) — bundle from src/ if available, else serve bundled file
        const basename = path.basename(urlPath);
        const runtimeName = basename.replace('.js', '');
        if (runtimeName === 'auth' || runtimeName === 'data') {
          const { bundleFrontendModule, hasSrc } = require('./bundle-frontend');
          if (hasSrc(runtimeName)) {
            try {
              const code = bundleFrontendModule(runtimeName);
              if (code) {
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(code);
                return;
              }
            } catch (e) { /* fall through to static file */ }
          }
          const staticPath = runtimeName === 'auth'
            ? path.join(__dirname, '..', 'auth', 'auth.js')
            : path.join(__dirname, '..', 'data', 'data.js');
          if (fs.existsSync(staticPath)) {
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            fs.createReadStream(staticPath).pipe(res);
            return;
          }
        }
      }

      // Serve other static assets from disk (media/, og/, etc.)
      const diskPath = path.join(DIST, urlPath);
      if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
        const ext = path.extname(diskPath);
        const mime = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(diskPath).pipe(res);
        return;
      }

      // Check media/ directory directly (images uploaded by user)
      const mediaPath = path.join(root, urlPath.replace(/^\//, ''));
      if (urlPath.startsWith('/media/') && fs.existsSync(mediaPath) && fs.statSync(mediaPath).isFile()) {
        const ext = path.extname(mediaPath);
        const mime = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(mediaPath).pipe(res);
        return;
      }

      // 404 — serve skeleton (hydrate.js will fetch 404 page content)
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(buildSkeleton());
      return;
    }

    // Activated mode: skeleton for page requests, static assets from disk
    if (isPageRequest(urlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(buildSkeleton());
      return;
    }

    // Activated mode: serve static assets from disk
    let filePath;
    if (urlPath === '/') {
      filePath = path.join(DIST, 'index.html');
    } else {
      filePath = path.join(DIST, urlPath);
      if (!fs.existsSync(filePath)) {
        filePath = path.join(DIST, urlPath, 'index.html');
      }
      if (!fs.existsSync(filePath)) {
        filePath = path.join(DIST, urlPath + '.html');
      }
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mime = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  // Log site activation status
  const { loadSiteReceipt } = require('./site-identity');
  const siteReceipt = loadSiteReceipt(root);
  const activationStatus = siteReceipt.activated
    ? `Site: activated (${siteReceipt.siteTitle})`
    : 'Site: trial (unactivated)';

  const actualPort = port || config.port;
  server.listen(actualPort, () => {
    console.log('');
    console.log(`sitemd dev server ready — http://localhost:${actualPort}`);
    console.log(`  ${initialPages.length} page${initialPages.length !== 1 ? 's' : ''} built successfully`);
    console.log(`  ${activationStatus}`);
    console.log('  Watching for changes (live reload active)');

    // Non-blocking update notification
    try {
      const { readCache, checkForUpdateBackground, compareVersions } = require('../cli/update-check');
      const { yellow, dim } = require('../cli/ui');
      const VERSION = require('../../package.json').version;
      checkForUpdateBackground();
      const cached = readCache();
      if (cached?.latest && compareVersions(cached.latest, VERSION) > 0) {
        console.log(`  ${yellow('Update available:')} v${VERSION} → v${cached.latest}  ${dim('sitemd update')}`);
      }
    } catch {}

    console.log('');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`  Port ${actualPort} is in use, trying ${actualPort + 1}...`);
      serve(root, actualPort + 1);
    } else {
      throw err;
    }
  });

  // Shared rebuild state (used by both site.md watcher and file watcher)
  let debounce = null;
  let suppressWatch = false;
  let rebuilding = false;

  // Coalesced reload broadcast — back-to-back rebuilds (e.g. settings change kicks
  // off a CSS sync followed by a content rebuild) used to trigger multiple SSE
  // broadcasts within milliseconds, each fanning out to every tab and triggering
  // duplicate /__api/page + /__api/shell fetches. Trailing-edge throttle collapses
  // those into a single event.
  let reloadPending = false;
  function notifyReload() {
    if (reloadPending) return;
    reloadPending = true;
    setTimeout(() => {
      reloadPending = false;
      for (const client of sseClients) {
        client.write('data: reload\n\n');
      }
    }, 50);
  }

  // Deferred reload for initial card image generation (server now ready)
  if (initialCardGenDone) initialCardGenDone.then(() => notifyReload()).catch(() => {});

  // Watch site.md for manual edits — re-validate activation status
  const siteMdPath = path.join(path.dirname(root), 'site.md');
  if (fs.existsSync(siteMdPath)) {
    fs.watch(siteMdPath, () => {
      try {
        const updated = loadSiteReceipt(root);
        const newMode = updated.activated ? 'activated' : 'trial';
        if (newMode !== config._mode) {
          config._mode = newMode;
          isTrial = newMode === 'trial';
          console.log(`  Site identity changed: ${updated.activated ? 'activated' : 'trial (unactivated)'}`);
          // Trigger rebuild so pages and theme assets are served correctly for the new mode
          if (!rebuilding) {
            rebuilding = true;
            try {
              const result = build(root, { quiet: true });
              slugMap = result.slugMap;
              memoryOutput = result.memoryOutput;
              pageFragments = result.pageFragments;
              shellData = result.shellData;
              config = result.config;
              patchDevAuth();
              console.log(`  Rebuilt (activation state changed)`);
              notifyReload();
            } catch (err) {
              console.error(`  Rebuild error: ${err.message}`);
            } finally {
              rebuilding = false;
            }
          }
        }
      } catch {}
    });
  }

  // Watch for changes and auto-rebuild
  const watchDirs = ['settings', 'pages', 'theme', 'auth-pages', 'account-pages', 'gated-pages'].map(d => path.join(root, d));

  for (const dir of watchDirs) {
    if (!fs.existsSync(dir)) continue;
    fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename || filename.startsWith('.') || suppressWatch) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (rebuilding) return;
        const isSettings = filename.endsWith('.md') && dir.endsWith('settings');
        suppressWatch = true;
        rebuilding = true;
        try {
          if (isSettings) syncThemeToCSS(root);
          const result = build(root, { quiet: true });
          slugMap = result.slugMap;
          memoryOutput = result.memoryOutput;
          pageFragments = result.pageFragments;
          shellData = result.shellData;
          isTrial = result.config._mode === 'trial';
          config = result.config;
          patchDevAuth();
          console.log(`  Rebuilt (${filename} changed)`);
          notifyReload();
          // Fire-and-forget async favicon + OG generation
          const distDir = path.join(root, result.config.outputDir);
          generateFavicons(result.config, root, distDir).catch(() => {});
          try {
            if (ogModule && result.config.ogImage === 'auto') ogModule.generateOgImages(result.pages, result.config, distDir, root).catch(() => {});
          } catch (e) { /* og module failed */ }
          // Card auto-image generation (fire-and-forget, reload on completion)
          const cardPending = getPendingCardImages();
          if (cardPending.length > 0) {
            const items = [...cardPending];
            clearPendingCardImages();
            generateCardImages(items, root).then(() => notifyReload()).catch(() => {});
          }
        } catch (err) {
          console.error(`  Rebuild error: ${err.message}`);
        } finally {
          suppressWatch = false;
          rebuilding = false;
        }
      }, 150);
    });
  }

}

module.exports = { serve };
