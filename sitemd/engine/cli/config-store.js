/**
 * Config store — manages secrets and credentials for CLI-managed settings.
 *
 * Two-tier settings architecture:
 *   Non-secrets (provider names, project IDs, URLs) → settings/*.md frontmatter
 *   Secrets (API keys, tokens, passwords)           → .sitemd/config.json
 *
 * Storage locations:
 *   Project: .sitemd/config.json (gitignored, at site root)
 *   Legacy:  engine/.sitemd/config.json (auto-migrated on next write)
 *   Global:  ~/.sitemd/config.json (shared across projects)
 *
 * Build precedence: env vars > config store (secrets) > settings/*.md (non-secrets)
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const GLOBAL_DIR = path.join(os.homedir(), '.sitemd')
const GLOBAL_CONFIG = path.join(GLOBAL_DIR, 'config.json')

function projectConfigPath(root) {
  return path.join(root, '.sitemd', 'config.json')
}

function legacyConfigPath(root) {
  return path.join(root, 'engine', '.sitemd', 'config.json')
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return {}
  }
}

/** Load project-level config (.sitemd/config.json, with legacy fallback) */
function loadProjectConfig(root) {
  const data = readJson(projectConfigPath(root))
  if (Object.keys(data).length > 0) return data
  return readJson(legacyConfigPath(root))
}

/** Load global config (~/.sitemd/config.json) */
function loadGlobalConfig() {
  return readJson(GLOBAL_CONFIG)
}

/**
 * Env var mapping: SITEMD_* env vars → structured config keys.
 * Only reads vars that are actually set.
 */
const ENV_MAP = {
  SITEMD_CF_API_TOKEN:  'deploy.cloudflareApiToken',
  SITEMD_CF_ACCOUNT_ID: 'deploy.cloudflareAccountId',
  SITEMD_CF_PROJECT:    'deploy.cloudflareProject',
  SITEMD_CF_BRANCH:     'deploy.cloudflareBranch',
  SITEMD_EMAIL_PROVIDER:'email.provider',
  SITEMD_EMAIL_API_KEY: 'email.apiKey',
  SITEMD_ANALYTICS_ID:  'analytics.id',
  SITEMD_GTM:           'analytics.gtm',
  SITEMD_AUTH_API_URL:           'auth.apiUrl',
  SITEMD_AUTH_SUPABASE_URL:      'auth.supabaseUrl',
  SITEMD_AUTH_SUPABASE_ANON_KEY: 'auth.supabaseAnonKey',
  SITEMD_AUTH_FIREBASE_API_KEY:  'auth.firebaseApiKey',
  SITEMD_AUTH_FIREBASE_DOMAIN:   'auth.firebaseAuthDomain',
  SITEMD_AUTH_FIREBASE_PROJECT:  'auth.firebaseProjectId',
  SITEMD_AUTH_CLERK_KEY:         'auth.clerkPublishableKey',
  SITEMD_AUTH_AUTH0_DOMAIN:      'auth.auth0Domain',
  SITEMD_AUTH_AUTH0_CLIENT_ID:   'auth.auth0ClientId',
  SITEMD_MODULES_TOKEN:          'modules.token',
  SITEMD_GITHUB_REPO:            'content.githubRepo',
  SITEMD_GITHUB_TOKEN:           'content.githubToken',
  SITEMD_NETLIFY_TOKEN:          'deploy.netlifyToken',
  SITEMD_NETLIFY_SITE_ID:        'deploy.netlifySiteId',
  SITEMD_VERCEL_TOKEN:           'deploy.vercelToken',
  SITEMD_VERCEL_PROJECT_ID:      'deploy.vercelProjectId',
  SITEMD_VERCEL_TEAM_ID:         'deploy.vercelTeamId',
  SITEMD_GITHUB_DEPLOY_TOKEN:    'deploy.githubToken',
  SITEMD_GITHUB_DEPLOY_REPO:     'deploy.githubRepo',
  SITEMD_R2_ACCOUNT_ID:          'hosting.r2AccountId',
  SITEMD_R2_ACCESS_KEY:          'hosting.r2AccessKey',
  SITEMD_R2_SECRET_KEY:          'hosting.r2SecretKey',
  SITEMD_R2_BUCKET:              'hosting.r2Bucket',
  SITEMD_S3_REGION:              'hosting.s3Region',
  SITEMD_S3_ACCESS_KEY:          'hosting.s3AccessKey',
  SITEMD_S3_SECRET_KEY:          'hosting.s3SecretKey',
  SITEMD_S3_BUCKET:              'hosting.s3Bucket',
  SITEMD_DATA_SUPABASE_URL:      'data.supabaseUrl',
  SITEMD_DATA_SUPABASE_ANON_KEY: 'data.supabaseAnonKey',
  SITEMD_DATA_SUPABASE_SERVICE_KEY: 'data.supabaseServiceKey',
  SITEMD_DATA_FIREBASE_API_KEY:  'data.firebaseApiKey',
  SITEMD_DATA_FIREBASE_PROJECT:  'data.firebaseProjectId',
  SITEMD_DATA_AIRTABLE_API_KEY:  'data.airtableApiKey',
  SITEMD_DATA_AIRTABLE_BASE_ID:  'data.airtableBaseId',
  SITEMD_DATA_REST_BASE_URL:     'data.restBaseUrl',
  SITEMD_DATA_REST_AUTH_HEADER:  'data.restAuthHeader',
  SITEMD_INDEXNOW_KEY:           'indexnow.apiKey',
}

function loadEnvConfig() {
  const config = {}
  for (const [envVar, dotPath] of Object.entries(ENV_MAP)) {
    const val = process.env[envVar]
    if (val !== undefined) setDotPath(config, dotPath, val)
  }
  return config
}

// ---------------------------------------------------------------------------
// Merge — produces a single structured config object
// ---------------------------------------------------------------------------

/** Deep merge b into a (b wins). Returns a. */
function deepMerge(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') {
      deepMerge(a[k], v)
    } else {
      a[k] = v
    }
  }
  return a
}

/**
 * Load secrets from .sitemd/secrets flat file.
 * Keys use the same SITEMD_* env var names (without prefix works too).
 * Mapped through ENV_MAP just like real env vars.
 */
function loadSecretsFile(root) {
  const secretsFilePath = path.join(root, '.sitemd', 'secrets')
  if (!fs.existsSync(secretsFilePath)) return {}
  const config = {}
  const content = fs.readFileSync(secretsFilePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    const val = trimmed.slice(eq + 1)
    // Try as SITEMD_* env var name first
    const dotPath = ENV_MAP[key] || ENV_MAP['SITEMD_' + key]
    if (dotPath) {
      setDotPath(config, dotPath, val)
    } else {
      // Store raw key as-is for forward compat
      setDotPath(config, key, val)
    }
  }
  return config
}

/**
 * Load the full backend config, merged in precedence order.
 * Returns a structured object: { deploy: {...}, email: {...}, analytics: {...} }
 *
 * Precedence: env vars > .sitemd/secrets > .sitemd/config.json > ~/.sitemd/config.json
 */
function loadBackendConfig(root) {
  const global = loadGlobalConfig()
  const project = loadProjectConfig(root)
  const secrets = loadSecretsFile(root)
  const env = loadEnvConfig()
  return deepMerge(deepMerge(deepMerge(global, project), secrets), env)
}

/**
 * Map structured backend config keys to the flat keys the build engine expects.
 * Call this after loadBackendConfig() to merge into the engine's config object.
 */
const FLAT_MAP = {
  'deploy.cloudflareProject':    'cloudflareProject',
  'deploy.cloudflareAccountId':  'cloudflareAccountId',
  'deploy.cloudflareApiToken':   'cloudflareApiToken',
  'deploy.cloudflareBranch':     'cloudflareBranch',
  'email.provider':              'emailProvider',
  'email.apiKey':                'emailApiKey',
  'email.region':                'emailRegion',
  'email.accessKeyId':           'emailAccessKeyId',
  'email.secretAccessKey':       'emailSecretAccessKey',
  'email.host':                  'emailHost',
  'email.port':                  'emailPort',
  'email.user':                  'emailUser',
  'email.pass':                  'emailPass',
  'analytics.id':                'analyticsId',
  'analytics.host':              'analyticsHost',
  'analytics.gtm':               'gtm',
  'analytics.pixels':            'pixels',
  'analytics.customHead':        'customHead',
  'auth.apiUrl':                 'authApiUrl',
  'auth.supabaseUrl':            'authSupabaseUrl',
  'auth.supabaseAnonKey':        'authSupabaseAnonKey',
  'auth.firebaseApiKey':         'authFirebaseApiKey',
  'auth.firebaseAuthDomain':     'authFirebaseAuthDomain',
  'auth.firebaseProjectId':      'authFirebaseProjectId',
  'auth.clerkPublishableKey':    'authClerkPublishableKey',
  'auth.auth0Domain':            'authAuth0Domain',
  'auth.auth0ClientId':          'authAuth0ClientId',
  'deploy.netlifyToken':         'netlifyToken',
  'deploy.netlifySiteId':        'netlifySiteId',
  'deploy.vercelToken':          'vercelToken',
  'deploy.vercelProjectId':      'vercelProjectId',
  'deploy.vercelTeamId':         'vercelTeamId',
  'deploy.githubToken':          'githubToken',
  'deploy.githubRepo':           'githubRepo',
  'deploy.githubBranch':         'githubBranch',
  'hosting.r2AccountId':         'hostingR2AccountId',
  'hosting.r2AccessKey':         'hostingR2AccessKey',
  'hosting.r2SecretKey':         'hostingR2SecretKey',
  'hosting.r2Bucket':            'hostingR2Bucket',
  'hosting.s3Region':            'hostingS3Region',
  'hosting.s3AccessKey':         'hostingS3AccessKey',
  'hosting.s3SecretKey':         'hostingS3SecretKey',
  'hosting.s3Bucket':            'hostingS3Bucket',
  'modules.token':               'modulesToken',
  'data.supabaseUrl':            'dataSupabaseUrl',
  'data.supabaseAnonKey':        'dataSupabaseAnonKey',
  'data.supabaseServiceKey':     'dataSupabaseServiceKey',
  'data.firebaseApiKey':         'dataFirebaseApiKey',
  'data.firebaseProjectId':      'dataFirebaseProjectId',
  'data.airtableApiKey':         'dataAirtableApiKey',
  'data.airtableBaseId':         'dataAirtableBaseId',
  'data.restBaseUrl':            'dataRestBaseUrl',
  'data.restAuthHeader':         'dataRestAuthHeader',
  'indexnow.apiKey':             'indexnowApiKey',
}

function flattenBackendConfig(backendConfig) {
  const flat = {}
  for (const [dotPath, flatKey] of Object.entries(FLAT_MAP)) {
    const val = getDotPath(backendConfig, dotPath)
    if (val !== undefined) flat[flatKey] = val
  }
  return flat
}

/**
 * Like flattenBackendConfig, but only includes secret keys.
 * Used by the build engine to overlay config-store secrets without
 * overriding non-secret values that belong in settings/*.md.
 */
function flattenSecretsOnly(backendConfig) {
  const flat = {}
  for (const [dotPath, flatKey] of Object.entries(FLAT_MAP)) {
    if (!KNOWN_KEYS[dotPath]?.secret) continue
    const val = getDotPath(backendConfig, dotPath)
    if (val !== undefined) flat[flatKey] = val
  }
  return flat
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Save project config to .sitemd/config.json (auto-migrates from legacy location) */
function saveProjectConfig(root, data) {
  const configPath = projectConfigPath(root)
  ensureDir(path.dirname(configPath))
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
  // Clean up legacy location if it exists
  const legacy = legacyConfigPath(root)
  if (fs.existsSync(legacy)) {
    fs.unlinkSync(legacy)
    const legacyDir = path.dirname(legacy)
    try { fs.rmdirSync(legacyDir) } catch {}
    console.log('  Migrated config from engine/.sitemd/ to .sitemd/')
  }
}

/** Save global config to ~/.sitemd/config.json */
function saveGlobalConfig(data) {
  ensureDir(GLOBAL_DIR)
  fs.writeFileSync(GLOBAL_CONFIG, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
}

// ---------------------------------------------------------------------------
// Dot-path helpers (e.g. "deploy.cloudflareApiToken")
// ---------------------------------------------------------------------------

function getDotPath(obj, dotPath) {
  const parts = dotPath.split('.')
  let current = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  return current
}

function setDotPath(obj, dotPath, value) {
  const parts = dotPath.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {}
    }
    current = current[parts[i]]
  }
  current[parts[parts.length - 1]] = value
}

function deleteDotPath(obj, dotPath) {
  const parts = dotPath.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] == null || typeof current[parts[i]] !== 'object') return
    current = current[parts[i]]
  }
  delete current[parts[parts.length - 1]]
  // Clean up empty parent objects
  if (parts.length > 1 && Object.keys(current).length === 0) {
    deleteDotPath(obj, parts.slice(0, -1).join('.'))
  }
}

// ---------------------------------------------------------------------------
// Known keys — for validation and interactive setup
// ---------------------------------------------------------------------------

const KNOWN_KEYS = {
  'deploy.cloudflareProject':    { label: 'Cloudflare Pages project name', secret: false },
  'deploy.cloudflareAccountId':  { label: 'Cloudflare account ID', secret: false },
  'deploy.cloudflareApiToken':   { label: 'Cloudflare API token', secret: true },
  'deploy.cloudflareBranch':     { label: 'Cloudflare Pages production branch', secret: false },
  'email.provider':              { label: 'Email provider', secret: false },
  'email.apiKey':                { label: 'Email API key', secret: true },
  'email.region':                { label: 'AWS SES region', secret: false },
  'email.accessKeyId':           { label: 'AWS access key ID', secret: true },
  'email.secretAccessKey':       { label: 'AWS secret access key', secret: true },
  'email.host':                  { label: 'SMTP host', secret: false },
  'email.port':                  { label: 'SMTP port', secret: false },
  'email.user':                  { label: 'SMTP username', secret: false },
  'email.pass':                  { label: 'SMTP password', secret: true },
  'analytics.id':                { label: 'Analytics tracking ID', secret: false },
  'analytics.host':              { label: 'Analytics instance URL', secret: false },
  'analytics.gtm':               { label: 'Google Tag Manager ID', secret: false },
  'analytics.pixels':            { label: 'Ad tracking pixels', secret: false },
  'analytics.customHead':        { label: 'Custom head HTML', secret: false },
  'auth.apiUrl':                 { label: 'Custom auth API URL', secret: false },
  'auth.supabaseUrl':            { label: 'Supabase project URL', secret: false },
  'auth.supabaseAnonKey':        { label: 'Supabase anon key', secret: true },
  'auth.firebaseApiKey':         { label: 'Firebase API key', secret: true },
  'auth.firebaseAuthDomain':     { label: 'Firebase auth domain', secret: false },
  'auth.firebaseProjectId':      { label: 'Firebase project ID', secret: false },
  'auth.clerkPublishableKey':    { label: 'Clerk publishable key', secret: true },
  'auth.auth0Domain':            { label: 'Auth0 domain', secret: false },
  'auth.auth0ClientId':          { label: 'Auth0 client ID', secret: false },
  'content.githubRepo':          { label: 'GitHub repo (owner/repo)', secret: false },
  'content.githubToken':         { label: 'GitHub personal access token', secret: true },
  'deploy.netlifyToken':         { label: 'Netlify personal access token', secret: true },
  'deploy.netlifySiteId':        { label: 'Netlify site ID', secret: false },
  'deploy.vercelToken':          { label: 'Vercel API token', secret: true },
  'deploy.vercelProjectId':      { label: 'Vercel project ID', secret: false },
  'deploy.vercelTeamId':         { label: 'Vercel team ID (optional)', secret: false },
  'deploy.githubToken':          { label: 'GitHub Pages access token', secret: true },
  'deploy.githubRepo':           { label: 'GitHub Pages repo (owner/repo)', secret: false },
  'deploy.githubBranch':         { label: 'GitHub Pages branch', secret: false },
  'hosting.r2AccountId':         { label: 'Cloudflare account ID (R2)', secret: false },
  'hosting.r2AccessKey':         { label: 'R2 access key ID', secret: true },
  'hosting.r2SecretKey':         { label: 'R2 secret access key', secret: true },
  'hosting.r2Bucket':            { label: 'R2 bucket name', secret: false },
  'hosting.s3Region':            { label: 'S3 region', secret: false },
  'hosting.s3AccessKey':         { label: 'S3 access key ID', secret: true },
  'hosting.s3SecretKey':         { label: 'S3 secret access key', secret: true },
  'hosting.s3Bucket':            { label: 'S3 bucket name', secret: false },
  'data.supabaseUrl':            { label: 'Supabase project URL (data)', secret: false },
  'data.supabaseAnonKey':        { label: 'Supabase anon key (data)', secret: true },
  'data.supabaseServiceKey':     { label: 'Supabase service role key', secret: true },
  'data.firebaseApiKey':         { label: 'Firebase API key (data)', secret: true },
  'data.firebaseProjectId':      { label: 'Firebase project ID (data)', secret: false },
  'data.airtableApiKey':         { label: 'Airtable API key', secret: true },
  'data.airtableBaseId':         { label: 'Airtable base ID', secret: false },
  'data.restBaseUrl':            { label: 'REST API base URL', secret: false },
  'data.restAuthHeader':         { label: 'REST Authorization header', secret: true },
  'indexnow.apiKey':             { label: 'IndexNow API key', secret: false },
}

/** Redact a secret value, showing only the last 4 characters */
function redact(value) {
  if (value == null || value === '') return ''
  const s = String(value)
  if (s.length <= 4) return '****'
  return '...' + s.slice(-4)
}

// ---------------------------------------------------------------------------
// Settings mirror — update read-only comment blocks in settings/*.md
// ---------------------------------------------------------------------------

// Mirror system removed — secrets now live in .sitemd/secrets only

// ---------------------------------------------------------------------------
// Settings frontmatter helpers — read/write non-secret values in settings/*.md
// ---------------------------------------------------------------------------

/**
 * Set a key-value pair in a settings file's YAML frontmatter.
 * Creates the key if missing, updates if present (including commented-out keys).
 */
function setSettingsFrontmatter(root, filename, key, value) {
  const filePath = path.join(root, 'settings', filename)
  if (!fs.existsSync(filePath)) return false

  let content = fs.readFileSync(filePath, 'utf-8')

  // Match active or commented-out key (e.g., "key: value" or "# key: value")
  const activeRe = new RegExp(`^${key}:.*$`, 'm')
  const commentedRe = new RegExp(`^#\\s*${key}:.*$`, 'm')

  if (activeRe.test(content)) {
    // Update existing active key
    content = content.replace(activeRe, `${key}: ${value}`)
  } else if (commentedRe.test(content)) {
    // Uncomment and set
    content = content.replace(commentedRe, `${key}: ${value}`)
  } else {
    // Insert before closing ---
    const insertIdx = content.lastIndexOf('---')
    if (insertIdx > 0) {
      content = content.slice(0, insertIdx) + `${key}: ${value}\n` + content.slice(insertIdx)
    }
  }

  fs.writeFileSync(filePath, content)
  return true
}

module.exports = {
  loadProjectConfig,
  loadGlobalConfig,
  loadEnvConfig,
  loadSecretsFile,
  loadBackendConfig,
  flattenBackendConfig,
  flattenSecretsOnly,
  saveProjectConfig,
  saveGlobalConfig,
  setSettingsFrontmatter,
  getDotPath,
  setDotPath,
  deleteDotPath,
  KNOWN_KEYS,
  FLAT_MAP,
  ENV_MAP,
  redact,
}
