// ---------------------------------------------------------------------------
// Centralized settings schema — single source of truth for all settings files
// Used by: config.js (validation)
// ---------------------------------------------------------------------------

const SETTINGS_SCHEMA = {
  'meta.md': {
    required: ['title'],
    known: ['title', 'brandName', 'description', 'url', 'brandImage', 'favicon', 'customFavicon',
      'titleSuffix', 'tabTitle', 'tabTitleSuffix'],
  },
  'header.md': {
    known: ['brandDisplay', 'brandName', 'themeModeToggle', 'search', 'headerAuth', 'items'],
    validValues: {
      brandDisplay: ['text', 'image', 'image-text', 'text-image'],
      themeModeToggle: ['show', 'hide'],
      search: ['show', 'hide'],
      headerAuth: ['show', 'hide'],
    },
  },
  'footer.md': {
    known: ['copyright', 'brandName', 'brandDisplay', 'tagline', 'items', 'social'],
    validValues: {
      brandDisplay: ['text', 'image', 'image-text', 'text-image', 'none'],
    },
  },
  'theme.md': {
    known: ['defaultMode', 'accentColor', 'fontSans', 'fontMono', 'contentWidth', 'pageWidth', 'radius', 'imageCorners',
      'borderRadius', 'buttonStyle'],
    validValues: {
      defaultMode: ['light', 'dark', 'system', 'paper'],
      imageCorners: ['none', 'subtle', 'curve'],
    },
  },
  'build.md': {
    known: ['port', 'pagesDir', 'themeDir', 'outputDir', 'sitemap', 'robots',
      'imageOptimization', 'imageMaxWidth', 'imageQuality'],
    validValues: {
      imageOptimization: ['false', 'optimize'],
    },
  },
  'deploy.md': {
    known: ['target', 'cloudflareProject', 'cloudflareAccountId', 'cloudflareBranch',
      'netlifySiteId', 'vercelProjectId', 'vercelTeamId', 'githubRepo', 'githubBranch',
      'mediaHosting', 'mediaCdnUrl', 'r2AccountId', 'r2Bucket', 's3Region', 's3Bucket',
      'deployPages', 'additionalDomains'],
    validValues: {
      target: ['cloudflare', 'github', 'netlify', 'vercel'],
      mediaHosting: ['false', 'r2', 's3'],
    },
  },
  'seo.md': {
    known: ['language', 'ogImage', 'ogStyle', 'ogBackground', 'ogTextColor', 'ogLogo',
      'defaultAuthor', 'twitterHandle', 'structuredData', 'llmsTxt', 'markdownOutput',
      'allowAICrawlers', 'indexNow', 'orgName', 'orgLogo'],
  },
  'email.md': {
    known: ['provider', 'from', 'host', 'port', 'user', 'region'],
    validValues: {
      provider: ['resend', 'sendgrid', 'postmark', 'mailgun', 'ses', 'smtp'],
    },
  },
  'analytics.md': {
    known: ['provider', 'id', 'host', 'gtm', 'pixels', 'customHead'],
    validValues: {
      provider: ['google', 'plausible', 'fathom', 'umami', 'simpleanalytics', 'posthog', 'matomo'],
    },
  },
  'auth.md': {
    known: ['enabled', 'provider', 'loginMode', 'loginPage', 'afterLogin', 'afterLogout',
      'userDataUrl', 'userTypeField', 'accessDeniedPage',
      'apiUrl', 'supabaseUrl', 'firebaseAuthDomain', 'firebaseProjectId',
      'auth0Domain', 'auth0ClientId'],
    validValues: {
      enabled: [true, false],
      provider: ['none', 'custom', 'supabase', 'firebase', 'clerk', 'auth0'],
      loginMode: ['password', 'magic-link'],
    },
  },
  'data.md': {
    known: ['provider', 'cacheTTL', 'loadingText', 'emptyText', 'errorText',
      'supabaseUrl', 'firebaseProjectId', 'airtableBaseId', 'restBaseUrl', 'sources'],
    validValues: {
      provider: ['none', 'supabase', 'firebase', 'airtable', 'rest'],
    },
  },
  'forms.md': {
    known: ['submitLabel', 'thankYou', 'honeypot', 'countrySortToTop'],
  },
  'groups.md': {
    known: ['groups'],
  },
};

// Reverse lookup: key name → which settings file(s) it belongs in
// Keys valid in multiple files (e.g. brandName) map to an array
const KEY_FILE_MAP = {};
for (const [file, schema] of Object.entries(SETTINGS_SCHEMA)) {
  if (schema.known) {
    for (const key of schema.known) {
      if (KEY_FILE_MAP[key]) {
        if (Array.isArray(KEY_FILE_MAP[key])) {
          KEY_FILE_MAP[key].push(file);
        } else {
          KEY_FILE_MAP[key] = [KEY_FILE_MAP[key], file];
        }
      } else {
        KEY_FILE_MAP[key] = file;
      }
    }
  }
}

module.exports = { SETTINGS_SCHEMA, KEY_FILE_MAP };
