#!/usr/bin/env node

/**
 * sitemd CLI — interactive command hub.
 * Usage: sitemd [command] [options]
 */

const fs = require('fs')
const path = require('path')
const { dim, bold, green, yellow, cyan, header, statusLine } = require('./ui')
const { SEP, interactiveSelect } = require('./tui')

const VERSION = (() => {
  try { return require('../../package.json').version } catch { return 'unknown' }
})()

// ---------------------------------------------------------------------------
// Project root detection
// ---------------------------------------------------------------------------

function findRoot(dir) {
  let current = dir || process.cwd()
  while (current !== path.dirname(current)) {
    // Primary: site.md at root with sitemd/ directory
    if (fs.existsSync(path.join(current, 'site.md')) && fs.existsSync(path.join(current, 'sitemd'))) {
      return path.join(current, 'sitemd')
    }
    // Fallback: sitemd/ contains settings/ (no site.md yet)
    if (fs.existsSync(path.join(current, 'sitemd', 'settings'))) return path.join(current, 'sitemd')
    // Direct structure: settings/ at this level (monorepo dev)
    if (fs.existsSync(path.join(current, 'settings'))) return current
    current = path.dirname(current)
  }
  return null
}

// ---------------------------------------------------------------------------
// Project state detection
// ---------------------------------------------------------------------------

function detectState(root) {
  if (!root) return { isProject: false }

  const { getAuth } = require('./auth-store')
  const { loadBackendConfig } = require('./config-store')

  const hasPages = fs.existsSync(path.join(root, 'pages'))
  const hasSite = fs.existsSync(path.join(root, 'site'))
  const auth = getAuth()
  const config = loadBackendConfig(root)

  // Read site name from settings/meta.md frontmatter
  let siteName = ''
  try {
    const metaRaw = fs.readFileSync(path.join(root, 'settings', 'meta.md'), 'utf8')
    const match = metaRaw.match(/^brandName:\s*(.+)$/m) || metaRaw.match(/^title:\s*(.+)$/m)
    if (match) siteName = match[1].trim()
  } catch {}

  // Read url from settings/meta.md and derive domain
  let domain = ''
  try {
    const metaRaw = fs.readFileSync(path.join(root, 'settings', 'meta.md'), 'utf8')
    const urlMatch = metaRaw.match(/^url:\s*(.+)$/m)
    if (urlMatch) domain = urlMatch[1].trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  } catch {}

  // Count markdown files in pages/
  let pageCount = 0
  if (hasPages) {
    const countMd = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) countMd(path.join(dir, entry.name))
        else if (entry.name.endsWith('.md')) pageCount++
      }
    }
    try { countMd(path.join(root, 'pages')) } catch {}
  }

  const deployTarget = config.deploy?.cloudflareProject ? 'cloudflare' : null

  // Check site activation status
  const { loadSiteReceipt } = require('../build/site-identity')
  const receipt = loadSiteReceipt(root)

  // Check npm dependencies
  const { checkDependencies } = require('../build/deps')
  const deps = checkDependencies(root)

  return {
    isProject: true,
    siteName,
    pageCount,
    hasSite,
    siteActivated: receipt.activated,
    isLoggedIn: !!auth?.token,
    email: auth?.email,
    domain,
    deployTarget,
    hasDeployConfig: !!(config.deploy?.cloudflareProject || config.deploy?.cloudflareAccountId),
    hasEmailConfig: !!config.email?.provider,
    hasAnalytics: !!config.analytics?.id,
    dependencies: { ok: deps.ok, missing: deps.missing },
  }
}

// ---------------------------------------------------------------------------
// Interactive menu
// ---------------------------------------------------------------------------

function buildMenu(state) {
  const rows = []

  rows.push({ label: 'Launch dev server', detail: 'localhost:4747', action: 'launch', value: 'launch' })

  if (state.hasDeployConfig && state.domain) {
    rows.push({ label: 'Deploy', detail: state.domain, action: 'deploy', value: 'deploy' })
  }

  rows.push(SEP)

  if (state.isLoggedIn) {
    rows.push({ label: 'Account & licenses', detail: state.email || '', action: 'auth-status', value: 'auth-status' })
  } else {
    rows.push({ label: 'Log in', detail: 'sitemd account', action: 'auth-login', value: 'auth-login' })
  }

  if (state.hasDeployConfig || state.hasEmailConfig || state.hasAnalytics) {
    rows.push({ label: 'View configuration', detail: '', action: 'config-show', value: 'config-show' })
    rows.push({ label: 'Reconfigure services', detail: 'deploy, email, analytics', action: 'config-setup', value: 'config-setup' })
  } else {
    rows.push({ label: 'Configure services', detail: 'deploy, email, analytics', action: 'config-setup', value: 'config-setup' })
  }

  rows.push({ label: 'Help', detail: 'all commands', action: 'help', value: 'help' })

  return rows
}

async function interactive(root, state) {
  header(VERSION)

  // Status lines
  if (state.siteName) {
    const activationLabel = state.siteActivated ? green('activated') : dim('trial (unactivated)')
    statusLine('Project', `${state.siteName} (${activationLabel})`)
  }
  statusLine('Pages', `${state.pageCount} file${state.pageCount !== 1 ? 's' : ''}`)

  if (state.isLoggedIn) {
    statusLine('Auth', state.email || green('logged in'))
  } else {
    statusLine('Auth', dim('not logged in'))
  }

  if (state.hasDeployConfig && state.domain) {
    statusLine('Deploy', `${state.domain} ${dim('→')} ${state.deployTarget}`)
  } else if (state.hasDeployConfig) {
    statusLine('Deploy', state.deployTarget)
  } else {
    statusLine('Deploy', dim('not configured'))
  }

  if (!state.dependencies.ok) {
    statusLine('Deps', yellow(`missing: ${state.dependencies.missing.join(', ')} — run npm install`))
  }

  // Proactive update notification (cache-only, zero latency)
  const { readCache, compareVersions } = require('./update-check')
  const cached = readCache()
  if (cached?.latest && compareVersions(cached.latest, VERSION) > 0) {
    console.log()
    console.log(`  ${yellow('Update:')} v${VERSION} → v${cached.latest}  ${dim('sitemd update')}`)
  }

  console.log()

  const rows = buildMenu(state)
  const choice = await interactiveSelect(rows)

  if (!choice) {
    process.exit(0)
  }

  console.log()
  await dispatch(choice.action, root)
}

// ---------------------------------------------------------------------------
// Command dispatch
// ---------------------------------------------------------------------------

async function dispatch(action, root) {
  // Propagate project root for symlink-safe path resolution in engine entry points
  if (root) process.env.SITEMD_PROJECT_ROOT = root
  switch (action) {
    case 'setup':
      await runSetup(root)
      break
    case 'launch':
      require('../build/index').runServe(root)
      break
    case 'build':
      require('../build/index').runBuild(root)
      break
    case 'deploy':
      require('../build/deps').requireDependencies(root)
      await require('./commands/deploy').runDeploy(root)
      break
    case 'deploy-only':
      require('../build/deps').requireDependencies(root)
      await require('./commands/deploy').runDeploy(root, { skipBuild: true })
      break
    case 'auth-login':
      await require('./auth').run('login', [])
      break
    case 'auth-logout':
      await require('./auth').run('logout', [])
      break
    case 'auth-status':
      await require('./auth').run('status', [])
      break
    case 'auth-api-key':
      await require('./auth').run('api-key', [])
      break
    case 'config-show':
      await require('./config').run(undefined, [], root)
      break
    case 'config-setup':
      await require('./config').run('setup', [], root)
      break
    case 'help':
      showHelp()
      break
  }
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function showHelp() {
  console.log(`  ${bold('sitemd')} — Websites from Markdown`)
  console.log()
  console.log(`  ${bold('Usage:')} sitemd [command] [options]`)
  console.log()
  console.log(`  ${bold('Commands:')}`)
  console.log(`    status             Show project overview`)
  console.log(`    launch             Start dev server (localhost:4747)`)
  console.log(`    launch demo        Preview the demo component showcase`)
  console.log(`    launch scratch     Preview the blank-slate template`)
  console.log(`    deploy             Build and deploy to configured target`)
  console.log(`    activate           Activate this site (permanent, consumes 1 slot)`)
  console.log(`    clone <url>        Clone a website into this project`)
  console.log(`    pages              List all pages with metadata`)
  console.log(`    pages create <slug>  Create a new page`)
  console.log(`    pages delete <slug>  Delete a page`)
  console.log(`    pages create-batch <file>  Create pages from JSON`)
  console.log(`    groups             List sidebar groups`)
  console.log(`    groups add <group> <slug>  Add page to a group`)
  console.log(`    settings [name]    Show settings (all or specific file)`)
  console.log(`    seo [slug]         Run SEO health check`)
  console.log(`    validate [slug]    Validate content quality`)
  console.log(`    init <dir>         Scaffold a new sitemd project`)
  console.log(`    scratch            Reset project to blank-slate`)
  console.log(`    update             Check for and apply engine updates`)
  console.log(`    login [email]      Log in (6-digit verification code)`)
  console.log(`    whoami             Show current account`)
  console.log(`    auth logout        Clear saved credentials`)
  console.log(`    auth status        Check account & licenses`)
  console.log(`    auth setup         Enable user authentication`)
  console.log(`    auth api-key       Create an API key for CI`)
  console.log(`    secret set K=V     Set a secret (.sitemd/secrets)`)
  console.log(`    secret list        List secret keys`)
  console.log(`    secret remove KEY  Remove a secret`)
  console.log(`    config             Show current config`)
  console.log(`    config setup       Interactive service configuration`)
  console.log(`    config set <k> <v> Set a config value`)
  console.log(`    config get <k>     Get a config value`)
  console.log(`    config delete <k>  Remove a config value`)
  console.log(`    docs               Browse official sitemd documentation`)
  console.log(`    docs <query>       Search docs (e.g. "forms", "deploy")`)
  console.log(`    feedback [type] [title]  Report a bug or request a feature`)
  console.log(`    help               Show this help`)
  console.log()
  console.log(`  ${bold('Options:')}`)
  console.log(`    --global           Use global config (~/.sitemd/)`)
  console.log()
  console.log(`  Run ${bold('sitemd')} with no arguments for an interactive guide.`)
  console.log()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  // Version
  if (command === '--version' || command === '-v') {
    console.log(VERSION || 'unknown')
    return
  }

  // Help
  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp()
    return
  }

  // Find project root
  const root = findRoot(process.cwd())

  // Background update check (refreshes cache silently)
  require('./update-check').checkForUpdateBackground()

  // Commands that work without a project root
  if (command === 'init') {
    return require('./commands/init').runInit(args.slice(1))
  }
  if (command === 'docs') {
    return require('./commands/docs').runDocs(args.slice(1))
  }
  if (command === 'login') {
    return require('./auth').login(args.slice(1))
  }
  if (command === 'whoami') {
    return require('./auth').whoami()
  }

  // No project found
  if (!root && command !== 'help' && command !== 'update') {
    if (!command) {
      header(VERSION)
      console.log(`  No sitemd project found in this directory.`)
      console.log()
      console.log(`  To get started:`)
      console.log(`    ${bold('sitemd init <directory>')}  — scaffold a new project`)
      console.log()
      return
    }
  }

  const effectiveRoot = root || process.cwd()

  // Direct command dispatch
  if (command) {
    const useGlobal = args.includes('--global')
    const rest = args.slice(1).filter(a => a !== '--global')

    switch (command) {
      case 'launch': {
        const target = rest[0]
        if (target === 'demo' || target === 'scratch') {
          const { getPkgRoot } = require('./commands/helpers')
          const pkgRoot = getPkgRoot(path.resolve(__dirname, '..', '..'))
          let templateDir = path.join(pkgRoot, 'templates', target)
          if (!fs.existsSync(templateDir)) {
            templateDir = path.join(pkgRoot, '..', '..', 'distro', 'templates', target)
          }
          if (!fs.existsSync(templateDir)) {
            console.error(`  Could not find ${target} template.`)
            process.exit(1)
          }
          console.log(`  Serving ${bold(target)} template...`)
          return dispatch('launch', templateDir)
        }
        return dispatch('launch', effectiveRoot)
      }
      case 'deploy':
        if (rest.includes('--no-build')) return dispatch('deploy-only', effectiveRoot)
        return dispatch('deploy', effectiveRoot)
      case 'activate':
        return require('./commands/activate').runActivate(effectiveRoot)
      case 'login':
        return require('./auth').login(rest)
      case 'whoami':
        return require('./auth').whoami()
      case 'auth':
        return require('./auth').run(rest[0], rest.slice(1))
      case 'clone':
        return require('./commands/clone').runClone(rest, effectiveRoot)
      case 'feedback':
        return require('./commands/feedback').runFeedback(rest, VERSION)
      case 'config':
        return require('./config').run(rest[0], rest.slice(1), effectiveRoot, useGlobal)
      case 'status':
        return require('./commands/status').runStatus(rest, effectiveRoot)
      case 'pages':
        return require('./commands/pages').runPages(rest, effectiveRoot)
      case 'groups':
        return require('./commands/groups').runGroups(rest, effectiveRoot)
      case 'seo':
        return require('./commands/seo').runSeo(rest, effectiveRoot)
      case 'validate':
        return require('./commands/validate').runValidate(rest, effectiveRoot)
      case 'settings':
        return require('./commands/settings').runSettings(rest, effectiveRoot)
      case 'secret':
        return require('./commands/secret').runSecret(rest, effectiveRoot)
      case 'scratch':
        return require('./commands/scratch').runScratch(effectiveRoot)
      case 'update':
        return require('./commands/update').runUpdate(root, VERSION)
      default:
        console.error(`  Unknown command: ${command}. Run ${bold('sitemd help')} to see all commands.`)
        process.exit(1)
    }
  }

  // Interactive mode (no args, TTY)
  if (!process.stdin.isTTY) {
    showHelp()
    return
  }

  const state = detectState(effectiveRoot)
  if (!state.isProject) {
    header(VERSION)
    console.log(`  No sitemd project found. Create ${bold('settings/')} and ${bold('pages/')} to get started.`)
    console.log()
    return
  }

  await interactive(effectiveRoot, state)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
