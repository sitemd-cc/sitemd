/**
 * Update checker — fetches latest version from npm, release notes from GitHub.
 * Caches results at ~/.sitemd/update-check.json with a 1-hour TTL.
 * All network calls fail silently — offline is fine.
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const { SITEMD_DIR } = require('./auth-store')

const CACHE_FILE = path.join(SITEMD_DIR, 'update-check.json')
const CACHE_TTL = 60 * 60 * 1000 // 1 hour
const TIMEOUT = 5000

const VERSION = (() => {
  try { return require('../../package.json').version } catch { return null }
})()

// ---------------------------------------------------------------------------
// Version comparison
// ---------------------------------------------------------------------------

/** Compare semver strings. Returns -1 if a < b, 0 if equal, 1 if a > b. */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na < nb) return -1
    if (na > nb) return 1
  }
  return 0
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

function readCache() {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    if (!data.latest || !data.checkedAt) return null
    const hasUpdate = VERSION && compareVersions(data.latest, VERSION) > 0
    return { ...data, current: VERSION, hasUpdate }
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    if (!fs.existsSync(SITEMD_DIR)) {
      fs.mkdirSync(SITEMD_DIR, { recursive: true, mode: 0o700 })
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), { mode: 0o600 })
  } catch {}
}

function isCacheStale() {
  const cache = readCache()
  if (!cache) return true
  const age = Date.now() - new Date(cache.checkedAt).getTime()
  return age > CACHE_TTL
}

// ---------------------------------------------------------------------------
// Network fetchers
// ---------------------------------------------------------------------------

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'sitemd-update-check' },
      timeout: TIMEOUT,
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error('Invalid JSON')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

async function fetchLatestVersion() {
  const data = await fetchJSON('https://registry.npmjs.org/@sitemd-cc%2Fsitemd/latest')
  return data.version || null
}

async function fetchReleaseNotes() {
  try {
    const data = await fetchJSON('https://api.github.com/repos/sitemd-cc/sitemd/releases/latest')
    return {
      releaseNotes: data.body || null,
      releaseUrl: data.html_url || null,
    }
  } catch {
    return { releaseNotes: null, releaseUrl: null }
  }
}

// ---------------------------------------------------------------------------
// Main check
// ---------------------------------------------------------------------------

async function checkForUpdate() {
  const current = VERSION

  try {
    const latest = await fetchLatestVersion()
    if (!latest) return { current, latest: null, hasUpdate: false }

    const { releaseNotes, releaseUrl } = await fetchReleaseNotes()

    const cacheData = {
      latest,
      checkedAt: new Date().toISOString(),
      releaseNotes,
      releaseUrl,
    }
    writeCache(cacheData)

    const hasUpdate = current && compareVersions(latest, current) > 0
    return { current, latest, hasUpdate, releaseNotes, releaseUrl }
  } catch {
    return { current, latest: null, hasUpdate: false }
  }
}

function checkForUpdateBackground() {
  if (!isCacheStale()) return
  checkForUpdate().catch(() => {})
}

module.exports = {
  readCache,
  checkForUpdate,
  checkForUpdateBackground,
  compareVersions,
  isCacheStale,
  CACHE_FILE,
}
