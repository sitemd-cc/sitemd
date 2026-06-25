/**
 * Post-deploy hooks — runs after a successful deploy.
 * Currently: IndexNow notification for changed URLs.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const https = require('https')

const CACHE_FILE = '.sitemd/last-deploy-urls.json'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow'

/**
 * Run all post-deploy hooks.
 * @param {object} config - Build config (flat keys from engine)
 * @param {object} opts
 * @param {string} opts.root - Project root for config storage
 * @param {function} opts.loadProjectConfig - Config store loader
 * @param {function} opts.saveProjectConfig - Config store writer
 */
async function postDeploy(config, { root, loadProjectConfig, saveProjectConfig }) {
  if (config.indexNow === false) return

  await runIndexNow(config, { root, loadProjectConfig, saveProjectConfig })
}

async function runIndexNow(config, { root, loadProjectConfig, saveProjectConfig }) {
  // Resolve or auto-generate API key
  let apiKey = config.indexnowApiKey
  if (!apiKey) {
    apiKey = crypto.randomUUID().replace(/-/g, '')
    const projectConfig = loadProjectConfig(root)
    if (!projectConfig.indexnow) projectConfig.indexnow = {}
    projectConfig.indexnow.apiKey = apiKey
    saveProjectConfig(root, projectConfig)
    console.log('  Generated IndexNow API key')
  }

  const host = new URL(config.url).hostname

  // Load current URLs from sitemap
  const sitemapPath = path.join(config.outputDir, 'sitemap.xml')
  if (!fs.existsSync(sitemapPath)) {
    console.log('  · IndexNow: no sitemap found, skipping')
    return
  }

  const currentUrls = extractUrlsFromSitemap(fs.readFileSync(sitemapPath, 'utf-8'))
  if (!currentUrls.length) {
    console.log('  · IndexNow: no URLs in sitemap, skipping')
    return
  }

  // Compare against cached URLs from last deploy
  const cachePath = path.join(root, CACHE_FILE)
  let changedUrls = currentUrls // Default: submit all on first deploy

  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      const cachedSet = new Set(cached.urls || [])
      changedUrls = currentUrls.filter(url => !cachedSet.has(url))
      // Include removed URLs so engines re-crawl and see the 404
      const currentSet = new Set(currentUrls)
      const removedUrls = (cached.urls || []).filter(url => !currentSet.has(url))
      changedUrls = [...changedUrls, ...removedUrls]
    } catch {}
  }

  // Save current URLs for next comparison
  const cacheDir = path.dirname(cachePath)
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
  fs.writeFileSync(cachePath, JSON.stringify({ urls: currentUrls, timestamp: new Date().toISOString() }))

  if (!changedUrls.length) {
    console.log('  · IndexNow: no URL changes detected')
    return
  }

  try {
    const result = await submitIndexNow({ host, key: apiKey, urls: changedUrls })
    if (result.status >= 200 && result.status < 300) {
      console.log(`  ✓ IndexNow: notified ${result.submitted} URLs`)
    } else {
      console.log(`  · IndexNow: API returned status ${result.status}`)
    }
  } catch (err) {
    console.log(`  · IndexNow: ${err.message}`)
  }
}

function submitIndexNow({ host, key, urls }) {
  // IndexNow accepts up to 10,000 URLs per request
  const batch = urls.slice(0, 10000)

  const body = JSON.stringify({
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: batch,
  })

  return new Promise((resolve, reject) => {
    const url = new URL(INDEXNOW_ENDPOINT)
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 15000,
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ submitted: batch.length, status: res.statusCode }))
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('IndexNow request timed out'))
    })

    req.write(body)
    req.end()
  })
}

function extractUrlsFromSitemap(xml) {
  const urls = []
  const regex = /<loc>([^<]+)<\/loc>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1])
  }
  return urls
}

module.exports = { postDeploy }
