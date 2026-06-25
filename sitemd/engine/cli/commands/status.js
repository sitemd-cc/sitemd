const fs = require('fs')
const path = require('path')
const { dim, bold, green, yellow, cyan } = require('../ui')

function runStatus(args, root) {
  const { getAuth } = require('../auth-store')
  const { loadBackendConfig } = require('../config-store')
  const { loadSiteReceipt } = require('../../build/site-identity')
  const { checkDependencies } = require('../../build/deps')
  const { readCache, compareVersions } = require('../update-check')
  const { findMarkdownFiles } = require('../../build/discover')

  const VERSION = (() => {
    try { return require('../../../package.json').version } catch { return 'unknown' }
  })()

  const auth = getAuth()
  const config = loadBackendConfig(root)
  const receipt = loadSiteReceipt(root)
  const deps = checkDependencies(root)

  let siteName = ''
  let siteUrl = ''
  let domain = ''
  try {
    const raw = fs.readFileSync(path.join(root, 'settings', 'meta.md'), 'utf8')
    const nameMatch = raw.match(/^brandName:\s*(.+)$/m) || raw.match(/^title:\s*(.+)$/m)
    if (nameMatch) siteName = nameMatch[1].trim()
    const urlMatch = raw.match(/^url:\s*(.+)$/m)
    if (urlMatch) {
      siteUrl = urlMatch[1].replace(/#.*$/, '').trim()
      domain = siteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    }
  } catch {}

  let pageCount = 0
  const pagesDir = path.join(root, 'pages')
  if (fs.existsSync(pagesDir)) {
    try { pageCount = findMarkdownFiles(pagesDir).length } catch {}
  }

  let deployTarget = null
  try {
    const raw = fs.readFileSync(path.join(root, 'settings', 'deploy.md'), 'utf8')
    const m = raw.match(/^target:\s*(\S+)/m)
    if (m) deployTarget = m[1].trim()
  } catch {}
  if (!deployTarget) {
    if (config.deploy?.cloudflareProject) deployTarget = 'cloudflare'
    else if (config.deploy?.netlifyToken) deployTarget = 'netlify'
    else if (config.deploy?.vercelToken) deployTarget = 'vercel'
  }

  const hasSite = fs.existsSync(path.join(root, 'site'))
  const isLoggedIn = !!auth?.token
  const isActivated = receipt.activated

  if (args.includes('--json')) {
    console.log(JSON.stringify({
      version: VERSION,
      project: siteName || null,
      pages: pageCount,
      built: hasSite,
      activated: isActivated,
      auth: { loggedIn: isLoggedIn, email: auth?.email || null },
      deploy: { configured: !!deployTarget, url: siteUrl || null, target: deployTarget },
      dependencies: { ok: deps.ok, missing: deps.missing },
    }, null, 2))
    return
  }

  console.log()
  console.log(`  ${bold('sitemd')}  ${dim('v' + VERSION)}`)
  console.log()

  if (siteName) {
    const activation = isActivated ? green('activated') : dim('trial')
    console.log(`  ${dim('Project:')}   ${siteName} (${activation})`)
  }
  console.log(`  ${dim('Pages:')}     ${pageCount} file${pageCount !== 1 ? 's' : ''}`)
  console.log(`  ${dim('Built:')}     ${hasSite ? green('yes') : dim('no')}`)

  if (isLoggedIn) {
    console.log(`  ${dim('Auth:')}      ${auth.email || green('logged in')}`)
  } else {
    console.log(`  ${dim('Auth:')}      ${dim('not logged in')}`)
  }

  if (deployTarget && domain) {
    console.log(`  ${dim('Deploy:')}    ${domain} ${dim('→')} ${deployTarget}`)
  } else if (deployTarget) {
    console.log(`  ${dim('Deploy:')}    ${deployTarget}`)
  } else {
    console.log(`  ${dim('Deploy:')}    ${dim('not configured')}`)
  }

  if (!deps.ok) {
    console.log(`  ${dim('Deps:')}      ${yellow('missing: ' + deps.missing.join(', '))}`)
  }

  const cached = readCache()
  if (cached?.latest && compareVersions(cached.latest, VERSION) > 0) {
    console.log()
    console.log(`  ${yellow('Update:')} v${VERSION} → v${cached.latest}  ${dim('sitemd update')}`)
  }

  console.log()
}

module.exports = { runStatus }
