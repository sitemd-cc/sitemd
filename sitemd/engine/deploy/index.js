/**
 * Deploy command — builds the site and deploys to a hosting target.
 * License enforcement: auth check → fingerprint extraction → API activation/verification → deploy.
 */

const path = require('path')
const { getToken } = require('../cli/auth-store')
const { activateSite, verifySite } = require('./activate')
const { extractSiteFingerprint, loadSiteReceipt, writeSiteReceipt } = require('../build/site-identity')
const { loadProjectConfig, saveProjectConfig } = require('../cli/config-store')

/**
 * Main deploy flow.
 * @param {object} config - Build config (from settings)
 * @param {string} config.target - Deploy target: 'cloudflare', 'github', 'netlify', 'vercel'
 * @param {string} root - Site content root
 * @param {Map} memoryOutput - Rendered HTML pages from build
 */
async function deploy(config, root, memoryOutput, opts = {}) {
  // Step 1: Check auth
  const token = getToken()
  if (!token) {
    console.error('✗ Not authenticated. Run: sitemd auth login')
    process.exit(1)
  }

  // Step 2: Extract fingerprint from rendered output
  const fingerprint = extractSiteFingerprint(config, memoryOutput)

  // Step 3: Check local receipt
  const receipt = loadSiteReceipt(root)

  if (!receipt.activated) {
    // Step 4a: Activate — first time
    if (!config.domain) {
      console.error('✗ No url configured. Set the url field in settings/meta.md (e.g., url: https://yourdomain.com)')
      process.exit(1)
    }

    console.log(`  Site identity:  title='${fingerprint.title}'  brand='${fingerprint.brandName}'  domain='${fingerprint.domain}'`)
    console.log()

    // In non-interactive contexts (agent), skip the prompt
    if (process.stdin.isTTY) {
      const readline = require('readline')
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise(resolve => {
        rl.question('  This site identity will be activated to your sitemd account and consume 1 site slot.\n  Site activations are permanent — this cannot be undone, credited, or refunded.\n  Continue? (y/N) ', resolve)
      })
      rl.close()
      if (answer.toLowerCase() !== 'y') {
        console.log('  Cancelled. Update settings/meta.md, settings/header.md, or settings/footer.md to change site identity.')
        process.exit(0)
      }
    }

    try {
      const result = await activateSite(token, fingerprint)
      writeSiteReceipt(root, result)
      console.log('✓ Site activated')
    } catch (err) {
      console.error(`✗ ${err.message}`)
      process.exit(1)
    }
  } else {
    // Step 4b: Verify — already activated
    try {
      const result = await verifySite(token, fingerprint)
      if (result.verified) {
        console.log('✓ Site verified')
      } else {
        const details = result.details ? result.details.join('; ') : result.reason
        console.error(`✗ Site identity changed since activation. ${details}`)
        console.error('  Contact support@sitemd.cc if you need to update your site identity.')
        process.exit(1)
      }
    } catch (err) {
      console.error(`✗ ${err.message}`)
      process.exit(1)
    }
  }

  // Step 5: Re-build in activated mode (receipt now exists → config._mode = 'activated' → writes to disk)
  // Skip when --no-build is set (e.g. sandbox deploys with post-build injections)
  if (!opts.skipBuild) {
    const { syncThemeToCSS } = require('../build/css')
    const { build: runBuild } = require('../build/render')
    syncThemeToCSS(root)
    runBuild(root)
  }

  // Step 5.5: SEO health check
  try {
    const { runSeoAudit, printSeoSummary } = require('../seo/audit')
    printSeoSummary(runSeoAudit(root))
  } catch (e) { /* audit is non-blocking */ }

  // Step 6: Deploy to target
  const { target } = config
  const supported = ['cloudflare', 'github', 'netlify', 'vercel']
  if (!supported.includes(target)) {
    console.error(`✗ Unknown deploy target: ${target}. Supported: ${supported.join(', ')}`)
    process.exit(1)
  }

  await deployTarget(config, target)

  // Step 7: Post-deploy hooks
  try {
    const { postDeploy } = require('./post-deploy')
    const effectiveRoot = config._root || root || process.cwd()
    await postDeploy(config, { root: effectiveRoot, loadProjectConfig, saveProjectConfig })
  } catch (err) {
    console.log(`  · Post-deploy: ${err.message}`)
  }
}

const TARGETS = {
  cloudflare: require('./targets/cloudflare'),
  github: require('./targets/github'),
  netlify: require('./targets/netlify'),
  vercel: require('./targets/vercel'),
}

async function deployTarget(config, target) {
  const mod = TARGETS[target]

  switch (target) {
    case 'cloudflare': {
      const result = await mod.deployCloudflare({
        outputDir: config.outputDir,
        projectName: config.cloudflareProject,
        accountId: config.cloudflareAccountId,
        apiToken: config.cloudflareApiToken,
        branch: config.cloudflareBranch,
        domain: config.domain,
      })
      console.log(`✓ Deployed to ${result.url}`)
      break
    }
    case 'github': {
      const result = await mod.deployGitHub({
        outputDir: config.outputDir,
        repo: config.githubRepo,
        token: config.githubToken,
        branch: config.githubBranch || 'gh-pages',
      })
      console.log(`✓ Deployed to ${result.url}`)
      break
    }
    case 'netlify': {
      const result = await mod.deployNetlify({
        outputDir: config.outputDir,
        siteId: config.netlifySiteId,
        token: config.netlifyToken,
      })
      console.log(`✓ Deployed to ${result.url}`)
      break
    }
    case 'vercel': {
      const result = await mod.deployVercel({
        outputDir: config.outputDir,
        projectId: config.vercelProjectId,
        token: config.vercelToken,
        teamId: config.vercelTeamId,
      })
      console.log(`✓ Deployed to ${result.url}`)
      break
    }
  }
}

module.exports = { deploy }
