const { buildAuthButton } = require('./html');
const { generateFeeds } = require('../seo/seo');

// ---------------------------------------------------------------------------
// HTML post-processing injections
// ---------------------------------------------------------------------------
// Injects extra elements into the rendered HTML for a single page: auth
// scripts, data scripts, embed scripts, RSS feed discovery, badge, flash
// prevention, and diagnostic script.
//
// `html`   — the fully assembled page HTML string
// `page`   — the page object ({ meta, slug, ... })
// `config` — the resolved site config
// `extras` — { globalModalsHtml, buildDiagnosticScript }
//
// Returns the modified HTML string.
// ---------------------------------------------------------------------------
function injectPageExtras(html, page, config, extras) {
  const { globalModalsHtml, buildDiagnosticScript } = extras;

  // Inject global modals before </main>
  if (globalModalsHtml) {
    html = html.replace('</main>', globalModalsHtml + '\n</main>');
  }

  // Inject "built with sitemd.cc" badge into footer (hidden if configured)
  if (config._sitemdBadge !== 'hide') {
    const badge = '<p class="sitemd-badge" style="font-size:var(--font-xs,12px);color:var(--color-text-tertiary,#999);margin:0;">built with <a href="https://sitemd.cc" target="_blank" rel="noopener" style="color:var(--color-accent,#4f46e5);text-decoration:none;">sitemd.cc</a></p>';
    // Insert badge into footer-inner, alongside the copyright row
    // Capture optional footer-brand div that follows copyright
    html = html.replace(
      /(<p class="footer-copyright">[^<]*<\/p>)\n?\s*(<div class="footer-brand">[\s\S]*?<\/div>)?/,
      '<div class="footer-meta" style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">$1\n      $2\n      ' + badge + '</div>'
    );
  }

  // Inject third-party embed scripts when needed
  if (html.includes('reddit-embed-bq')) {
    html = html.replace('</body>', '<script async src="https://embed.reddit.com/widgets.js" charset="UTF-8"></script>\n</body>');
  }

  // Auth header button — not gated, always inject when auth is configured
  if (config.authProvider && config.authProvider !== 'none') {
    const authBtn = buildAuthButton(config);
    if (authBtn) {
      html = html.replace('<button class="theme-toggle"', authBtn + '\n        <button class="theme-toggle"');
    }
  }

  // Auth: data-auth attribute, config, and scripts
  if (config.authProvider && config.authProvider !== 'none') {
    // Stamp data-auth and data-gated-types on gated pages
    const gatedTypes = page.meta._gatedTypes;
    if (gatedTypes && gatedTypes.length > 0) {
      if (gatedTypes.includes('anyLoggedIn')) {
        html = html.replace('<main id="main"', '<main id="main" data-auth="required"');
      } else {
        const typeList = gatedTypes.join(',');
        html = html.replace('<main id="main"',
          `<main id="main" data-auth="required" data-gated-types="${typeList}"`);
      }
    } else if (page.meta.auth === 'required') {
      html = html.replace('<main id="main"', '<main id="main" data-auth="required"');
    }

    // Inline flash-prevention script in <head>
    const flashScript = `<script>if(document.querySelector('[data-auth="required"]')&&!localStorage.getItem('sitemd-auth-token')){var m=document.getElementById('main');if(m)m.style.visibility='hidden'}</script>`;
    html = html.replace('</head>', flashScript + '\n</head>');

    // Auth config — inline in <head> so auth-page scripts have access before auth.js loads
    const authCfg = JSON.stringify({
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
    }).replace(/'/g, '&#39;');
    html = html.replace('</head>',
      `<script>window.__sitemdAuthCfg=${authCfg}</script>\n` +
      `<script id="sitemd-auth" data-config='${authCfg}' src="/theme/auth.js"></script>\n</head>`);

    // Gated sections flash prevention CSS
    if (html.includes('data-gated=')) {
      html = html.replace('</head>',
        '<style>.gated-section{display:none!important}.gated-section.gated-visible{display:block!important}</style>\n</head>');
    }
  }

  // Data: inject data.js script when data provider is configured
  if (config.dataProvider && config.dataProvider !== 'none') {
    const dataCfg = JSON.stringify({
      provider: config.dataProvider,
      cacheTTL: config.dataCacheTTL || 300,
      errorText: config.dataErrorText || 'Unable to load data.',
      sources: config.dataSources || [],
      // Provider credentials come from CLI config store
      supabaseUrl: config.dataSupabaseUrl || config.authSupabaseUrl || '',
      supabaseAnonKey: config.dataSupabaseAnonKey || config.authSupabaseAnonKey || '',
      firebaseApiKey: config.dataFirebaseApiKey || config.authFirebaseApiKey || '',
      firebaseProjectId: config.dataFirebaseProjectId || config.authFirebaseProjectId || '',
      airtableBaseId: config.dataAirtableBaseId || '',
      airtableToken: config.dataAirtableToken || '',
      restBaseUrl: config.dataRestBaseUrl || '',
      restHeaders: config.dataRestHeaders || '',
    }).replace(/'/g, '&#39;');
    html = html.replace('</body>',
      `<script id="sitemd-data" data-config='${dataCfg}' src="/theme/data.js"></script>\n</body>`);
  }

  // Frontend state explainer — inline diagnostic for broken module states
  if ((config.authProvider && config.authProvider !== 'none') ||
    (config.dataProvider && config.dataProvider !== 'none')) {
    html = html.replace('</body>', buildDiagnosticScript() + '\n</body>');
  }

  // RSS feed autodiscovery — inject <link rel="alternate"> for pages in feed-enabled groups
  if (generateFeeds && config.groups) {
    const groups = config.groups;
    const feedGroupNames = Object.entries(groups).filter(([, g]) => g.feed === true).map(([name]) => name);
    if (feedGroupNames.length) {
      const members = Array.isArray(page.meta.groupMember) ? page.meta.groupMember : [];
      const memberNames = members.map(m => typeof m === 'string' ? (m.includes(':') ? m.split(':')[0].trim() : m.trim()) : '');
      for (const gName of feedGroupNames) {
        // Inject on group member pages and the group index page
        const isGroupMember = memberNames.includes(gName);
        const isIndexPage = page.slug === `/${gName}`;
        if (isGroupMember || isIndexPage) {
          const gTitle = gName.charAt(0).toUpperCase() + gName.slice(1);
          html = html.replace('</head>',
            `<link rel="alternate" type="application/rss+xml" title="${gTitle} Feed" href="/${gName}/feed.xml">\n</head>`);
        }
      }
    }
  }

  return html;
}

module.exports = { injectPageExtras };
