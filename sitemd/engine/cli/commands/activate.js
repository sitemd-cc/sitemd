const { ask } = require('./helpers')

async function runActivate(root) {
  const { getToken } = require('../auth-store')
  const { activateSite } = require('../../deploy/activate')
  const { extractSiteFingerprint, loadSiteReceipt, writeSiteReceipt } = require('../../build/site-identity')

  const token = getToken()
  if (!token) {
    console.error('✗ Not authenticated. Run: sitemd auth login')
    process.exit(1)
  }

  // Check if already activated
  const receipt = loadSiteReceipt(root)
  if (receipt.activated) {
    console.log(`✓ Already activated: ${receipt.siteTitle}`)
    return
  }

  // Build to memory to extract fingerprint
  const { syncThemeToCSS } = require('../../build/css')
  const { build } = require('../../build/render')
  syncThemeToCSS(root)
  const result = build(root, { quiet: true })
  const memoryOutput = result.config._memoryOutput || new Map()
  const fingerprint = extractSiteFingerprint(result.config, memoryOutput)

  if (!fingerprint.domain) {
    console.error('✗ No url configured. Set the url field in settings/meta.md (e.g., url: https://yourdomain.com)')
    process.exit(1)
  }

  console.log(`  Site identity:  title='${fingerprint.title}'  brand='${fingerprint.brandName}'  domain='${fingerprint.domain}'`)
  console.log()

  if (process.stdin.isTTY) {
    const answer = await ask('  This will consume 1 site slot (permanent). Continue? (y/N) ')
    if (answer.toLowerCase() !== 'y') {
      console.log('  Cancelled.')
      return
    }
  }

  try {
    const activationResult = await activateSite(token, fingerprint)
    writeSiteReceipt(root, activationResult)
    console.log(`✓ Site activated: ${fingerprint.title}`)
  } catch (err) {
    console.error(`✗ ${err.message}`)
    process.exit(1)
  }
}

module.exports = { runActivate }
