/**
 * Cloudflare Pages deployment via Wrangler CLI.
 * Uses `npx wrangler pages deploy` — the official Cloudflare mechanism.
 */

const { execFileSync } = require('child_process')

const CF_API = 'https://api.cloudflare.com/client/v4'

/**
 * Ensure both apex and www custom domains are registered on the Pages project.
 * Idempotent — 409 (already exists) is silently ignored.
 * Non-blocking — errors are logged as warnings, never fail the deploy.
 */
async function ensureCustomDomains({ accountId, apiToken, projectName, domain }) {
  if (!domain) return

  const bare = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const apex = bare.startsWith('www.') ? bare.slice(4) : bare
  const www = `www.${apex}`

  for (const name of [apex, www]) {
    try {
      const res = await fetch(
        `${CF_API}/accounts/${accountId}/pages/projects/${projectName}/domains`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name }),
        }
      )
      if (res.ok) {
        console.log(`  · Custom domain registered: ${name}`)
      } else if (res.status === 409) {
        // Already exists — expected for idempotent deploys
      } else {
        const body = await res.json().catch(() => ({}))
        console.log(`  · Custom domain warning (${name}): ${body.errors?.[0]?.message || res.statusText}`)
      }
    } catch (err) {
      console.log(`  · Custom domain warning (${name}): ${err.message}`)
    }
  }
}

/**
 * Deploy to Cloudflare Pages via Wrangler.
 * @param {object} opts
 * @param {string} opts.outputDir - Path to built site directory
 * @param {string} opts.projectName - Cloudflare Pages project name
 * @param {string} opts.accountId - Cloudflare account ID
 * @param {string} opts.apiToken - Cloudflare API token
 * @param {string} [opts.branch] - Git branch name (default: 'main' — must match project's production branch)
 * @param {string} [opts.domain] - Custom domain (registers apex + www on Pages project)
 */
async function deployCloudflare({ outputDir, projectName, accountId, apiToken, branch, domain }) {
  if (!accountId || !apiToken || !projectName) {
    throw new Error('Cloudflare deploy requires: cloudflareAccountId, cloudflareApiToken, cloudflareProject')
  }

  const output = execFileSync('npx', [
    'wrangler', 'pages', 'deploy', outputDir,
    '--project-name', projectName,
    '--branch', branch || 'main',
    '--commit-dirty=true',
  ], {
    env: {
      ...process.env,
      CLOUDFLARE_API_TOKEN: apiToken,
      CLOUDFLARE_ACCOUNT_ID: accountId,
    },
    encoding: 'utf-8',
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // Parse deployment URL from wrangler output
  const urlMatch = output.match(/https:\/\/[^\s]+\.pages\.dev/)
  const url = urlMatch ? urlMatch[0] : `https://${projectName}.pages.dev`

  await ensureCustomDomains({ accountId, apiToken, projectName, domain })

  return { url, id: null }
}

module.exports = { deployCloudflare }
