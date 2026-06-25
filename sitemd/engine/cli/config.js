/**
 * CLI config commands — manage backend settings (secrets, credentials, service config).
 * Usage: node engine/cli/config [command] [args]
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const {
  loadProjectConfig, loadGlobalConfig, loadBackendConfig,
  saveProjectConfig, saveGlobalConfig,
  setSettingsFrontmatter,
  getDotPath, setDotPath, deleteDotPath,
  KNOWN_KEYS, redact,
} = require('./config-store')
const { isTTY } = require('./auth-store')

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function run(command, args, root, useGlobal) {
  root = root || findProjectRoot(process.cwd())
  useGlobal = useGlobal || false
  args = args || []

  switch (command) {
    case 'set':    return cmdSet(args, root, useGlobal)
    case 'get':    return cmdGet(args, root, useGlobal)
    case 'delete': return cmdDelete(args, root, useGlobal)
    case 'setup':  return cmdSetup(args, root, useGlobal)
    default:       return cmdShow(root, useGlobal)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const useGlobal = args.includes('--global')
  const filtered = args.filter(a => a !== '--global')
  return run(filtered[0], filtered.slice(1), findProjectRoot(process.cwd()), useGlobal)
}

// ---------------------------------------------------------------------------
// config (no args) — show current config summary
// ---------------------------------------------------------------------------

function cmdShow(root, useGlobal) {
  const config = useGlobal ? loadGlobalConfig() : loadBackendConfig(root)
  const sections = ['deploy', 'hosting', 'email', 'analytics', 'auth', 'content', 'data']

  let hasAny = false
  for (const section of sections) {
    const data = config[section]
    if (!data || Object.keys(data).length === 0) continue
    hasAny = true

    console.log(`\n  ${section}`)
    for (const [key, value] of Object.entries(data)) {
      const dotKey = `${section}.${key}`
      const meta = KNOWN_KEYS[dotKey]
      const isSecret = meta?.secret
      const display = isSecret ? redact(value) : (Array.isArray(value) ? JSON.stringify(value) : value)
      console.log(`    ${key}: ${display}`)
    }
  }

  if (!hasAny) {
    console.log('\n  No config set. Run: sitemd config setup')
  }
  console.log()
}

// ---------------------------------------------------------------------------
// config set <key> <value>
// ---------------------------------------------------------------------------

function cmdSet(args, root, useGlobal) {
  const [key, ...rest] = args
  const value = rest.join(' ')
  if (!key || !value) {
    console.error('Usage: sitemd config set <key> <value>')
    console.error('Example: sitemd config set deploy.cloudflareApiToken cf_xxx')
    process.exit(1)
  }

  if (!KNOWN_KEYS[key]) {
    console.log(`  Warning: "${key}" is not a recognized config key`)
  }

  const config = useGlobal ? loadGlobalConfig() : loadProjectConfig(root)
  setDotPath(config, key, value)
  if (useGlobal) {
    saveGlobalConfig(config)
  } else {
    saveProjectConfig(root, config)
  }

  const meta = KNOWN_KEYS[key]
  const display = meta?.secret ? redact(value) : value
  console.log(`  ✓ ${key}: ${display}`)
}

// ---------------------------------------------------------------------------
// config get <key>
// ---------------------------------------------------------------------------

function cmdGet(args, root, useGlobal) {
  const [key] = args
  if (!key) {
    console.error('Usage: sitemd config get <key>')
    process.exit(1)
  }

  const config = useGlobal ? loadGlobalConfig() : loadBackendConfig(root)
  const value = getDotPath(config, key)
  if (value === undefined) {
    console.log(`  ${key}: (not set)`)
  } else {
    console.log(`  ${key}: ${Array.isArray(value) ? JSON.stringify(value) : value}`)
  }
}

// ---------------------------------------------------------------------------
// config delete <key>
// ---------------------------------------------------------------------------

function cmdDelete(args, root, useGlobal) {
  const [key] = args
  if (!key) {
    console.error('Usage: sitemd config delete <key>')
    process.exit(1)
  }

  const config = useGlobal ? loadGlobalConfig() : loadProjectConfig(root)
  const existed = getDotPath(config, key) !== undefined
  deleteDotPath(config, key)
  if (useGlobal) {
    saveGlobalConfig(config)
  } else {
    saveProjectConfig(root, config)
  }

  console.log(existed ? `  ✓ Removed ${key}` : `  ${key} was not set`)
}

// ---------------------------------------------------------------------------
// config setup [section] — interactive, educational setup
// ---------------------------------------------------------------------------

const SETUP_SECTIONS = {
  deploy: {
    title: 'Deploy',
    description: 'Deploy your site to a hosting provider. Credentials are stored locally and never committed to git.',
    providers: [
      { value: 'cloudflare', label: 'Cloudflare Pages', desc: 'Fast, free tier, integrated CDN' },
      { value: 'netlify',    label: 'Netlify',          desc: 'Popular, git-based deploys' },
      { value: 'vercel',     label: 'Vercel',           desc: 'Frontend platform, preview deploys' },
      { value: 'github',     label: 'GitHub Pages',     desc: 'Free for public repos' },
    ],
    providerKey: 'target',
    settingsFile: 'deploy.md',
    providerSteps: {
      cloudflare: [
        { key: 'deploy.cloudflareProject', prompt: 'Cloudflare Pages project name', help: 'The name of your Pages project in the Cloudflare dashboard.', toSettings: { file: 'deploy.md', key: 'cloudflareProject' } },
        { key: 'deploy.cloudflareAccountId', prompt: 'Cloudflare account ID', help: 'Find this in your Cloudflare dashboard URL: dash.cloudflare.com/<account-id>', toSettings: { file: 'deploy.md', key: 'cloudflareAccountId' } },
        { key: 'deploy.cloudflareApiToken', prompt: 'Cloudflare API token', help: 'Create at dash.cloudflare.com/profile/api-tokens with "Cloudflare Pages: Edit" permission.', secret: true },
      ],
      netlify: [
        { key: 'deploy.netlifySiteId', prompt: 'Netlify site ID', help: 'Find in Site settings > General > Site ID.', toSettings: { file: 'deploy.md', key: 'netlifySiteId' } },
        { key: 'deploy.netlifyToken', prompt: 'Netlify personal access token', help: 'Create at app.netlify.com/user/applications#personal-access-tokens', secret: true },
      ],
      vercel: [
        { key: 'deploy.vercelProjectId', prompt: 'Vercel project ID', help: 'Find in Project Settings > General.', toSettings: { file: 'deploy.md', key: 'vercelProjectId' } },
        { key: 'deploy.vercelToken', prompt: 'Vercel token', help: 'Create at vercel.com/account/tokens', secret: true },
        { key: 'deploy.vercelTeamId', prompt: 'Vercel team ID (optional)', help: 'Only needed for team projects. Find in Team Settings.', optional: true, toSettings: { file: 'deploy.md', key: 'vercelTeamId' } },
      ],
      github: [
        { key: 'deploy.githubRepo', prompt: 'GitHub repo (owner/repo)', help: 'e.g. myuser/mysite', toSettings: { file: 'deploy.md', key: 'githubRepo' } },
        { key: 'deploy.githubToken', prompt: 'GitHub personal access token', help: 'Create at github.com/settings/tokens with repo scope.', secret: true },
        { key: 'deploy.githubBranch', prompt: 'Branch', help: 'Branch for GitHub Pages deployment.', default: 'gh-pages', optional: true, toSettings: { file: 'deploy.md', key: 'githubBranch' } },
      ],
    },
  },
  hosting: {
    title: 'Media Hosting',
    description: 'Host media files on a CDN for faster delivery. Credentials are stored locally.',
    settingsFile: 'deploy.md',
    providerKey: 'mediaHosting',
    providers: [
      { value: 'r2',  label: 'Cloudflare R2', desc: 'S3-compatible, no egress fees' },
      { value: 's3',  label: 'AWS S3',        desc: 'Industry standard object storage' },
    ],
    providerSteps: {
      r2: [
        { key: 'hosting.r2AccountId', prompt: 'Cloudflare account ID', help: 'Same as your Cloudflare account ID.', toSettings: { file: 'deploy.md', key: 'r2AccountId' } },
        { key: 'hosting.r2AccessKey', prompt: 'R2 access key ID', help: 'Create at Cloudflare dashboard > R2 > Manage API Tokens', secret: true },
        { key: 'hosting.r2SecretKey', prompt: 'R2 secret access key', secret: true },
        { key: 'hosting.r2Bucket', prompt: 'R2 bucket name', help: 'The bucket to store media files in.', toSettings: { file: 'deploy.md', key: 'r2Bucket' } },
      ],
      s3: [
        { key: 'hosting.s3Region', prompt: 'AWS region', help: 'e.g. us-east-1', default: 'us-east-1', toSettings: { file: 'deploy.md', key: 's3Region' } },
        { key: 'hosting.s3AccessKey', prompt: 'S3 access key ID', secret: true },
        { key: 'hosting.s3SecretKey', prompt: 'S3 secret access key', secret: true },
        { key: 'hosting.s3Bucket', prompt: 'S3 bucket name', toSettings: { file: 'deploy.md', key: 's3Bucket' } },
      ],
    },
  },
  email: {
    title: 'Email',
    description: 'Send transactional emails (verification, password resets, notifications).',
    settingsFile: 'email.md',
    providerKey: 'provider',
    providers: [
      { value: 'resend',   label: 'Resend',   desc: 'Modern email API, free tier available', url: 'resend.com' },
      { value: 'sendgrid', label: 'SendGrid', desc: 'Established, high volume', url: 'sendgrid.com' },
      { value: 'postmark', label: 'Postmark', desc: 'Fast delivery, great for transactional', url: 'postmarkapp.com' },
      { value: 'mailgun',  label: 'Mailgun',  desc: 'Developer-friendly', url: 'mailgun.com' },
      { value: 'ses',      label: 'AWS SES',  desc: 'Amazon Simple Email Service' },
      { value: 'smtp',     label: 'SMTP',     desc: 'Any SMTP server' },
    ],
    providerSteps: {
      resend:   [{ key: 'email.apiKey', prompt: 'Resend API key', help: 'Get one at resend.com/api-keys', secret: true }],
      sendgrid: [{ key: 'email.apiKey', prompt: 'SendGrid API key', help: 'Create at app.sendgrid.com/settings/api_keys', secret: true }],
      postmark: [{ key: 'email.apiKey', prompt: 'Postmark server token', help: 'Find in your Postmark server settings', secret: true }],
      mailgun:  [{ key: 'email.apiKey', prompt: 'Mailgun API key', help: 'Find at app.mailgun.com/settings/api_security', secret: true }],
      ses: [
        { key: 'email.region', prompt: 'AWS region', help: 'e.g. us-east-1', default: 'us-east-1', toSettings: { file: 'email.md', key: 'region' } },
        { key: 'email.accessKeyId', prompt: 'AWS access key ID', secret: true },
        { key: 'email.secretAccessKey', prompt: 'AWS secret access key', secret: true },
      ],
      smtp: [
        { key: 'email.host', prompt: 'SMTP host', help: 'e.g. smtp.gmail.com', toSettings: { file: 'email.md', key: 'host' } },
        { key: 'email.port', prompt: 'SMTP port', default: '587', toSettings: { file: 'email.md', key: 'port' } },
        { key: 'email.user', prompt: 'SMTP username', toSettings: { file: 'email.md', key: 'user' } },
        { key: 'email.pass', prompt: 'SMTP password', secret: true },
      ],
    },
  },
  analytics: {
    title: 'Analytics',
    description: 'Add site-wide analytics tracking. IDs are saved to settings/analytics.md.',
    steps: [
      {
        key: 'analytics.id',
        prompt: 'Tracking / measurement ID',
        help: 'The provider-specific ID (e.g. G-XXXXXXX for Google Analytics, or your Plausible domain).',
        toSettings: { file: 'analytics.md', key: 'id' },
      },
      {
        key: 'analytics.host',
        prompt: 'Instance URL (self-hosted only)',
        help: 'Only needed for self-hosted providers like Umami, Matomo, or PostHog.',
        optional: true,
        toSettings: { file: 'analytics.md', key: 'host' },
      },
      {
        key: 'analytics.gtm',
        prompt: 'Google Tag Manager ID',
        help: 'Format: GTM-XXXXXXX. Optional — only if you use GTM.',
        optional: true,
        toSettings: { file: 'analytics.md', key: 'gtm' },
      },
    ],
  },
  auth: {
    title: 'Auth',
    description: 'Configure authentication provider credentials. Stored locally, never committed.',
    providers: [
      { value: 'custom',   label: 'Custom API', desc: 'Your own auth API endpoint' },
      { value: 'supabase', label: 'Supabase',   desc: 'Open-source Firebase alternative' },
      { value: 'firebase', label: 'Firebase',    desc: 'Google auth platform' },
      { value: 'clerk',    label: 'Clerk',       desc: 'Drop-in auth UI components' },
      { value: 'auth0',    label: 'Auth0',       desc: 'Identity platform by Okta' },
    ],
    settingsFile: 'auth.md',
    providerKey: 'provider',
    providerSteps: {
      custom: [
        { key: 'auth.apiUrl', prompt: 'Auth API URL', help: 'The base URL of your auth API (e.g. https://api.example.com)', toSettings: { file: 'auth.md', key: 'apiUrl' } },
      ],
      supabase: [
        { key: 'auth.supabaseUrl', prompt: 'Supabase project URL', help: 'Find in Supabase dashboard > Settings > API', toSettings: { file: 'auth.md', key: 'supabaseUrl' } },
        { key: 'auth.supabaseAnonKey', prompt: 'Supabase anon key', help: 'The public anon key from Settings > API', secret: true },
      ],
      firebase: [
        { key: 'auth.firebaseApiKey', prompt: 'Firebase API key', help: 'Find in Firebase console > Project settings', secret: true },
        { key: 'auth.firebaseAuthDomain', prompt: 'Firebase auth domain', help: 'Format: your-project.firebaseapp.com', toSettings: { file: 'auth.md', key: 'firebaseAuthDomain' } },
        { key: 'auth.firebaseProjectId', prompt: 'Firebase project ID', toSettings: { file: 'auth.md', key: 'firebaseProjectId' } },
      ],
      clerk: [
        { key: 'auth.clerkPublishableKey', prompt: 'Clerk publishable key', help: 'Find in Clerk dashboard > API Keys', secret: true },
      ],
      auth0: [
        { key: 'auth.auth0Domain', prompt: 'Auth0 domain', help: 'Format: your-tenant.auth0.com', toSettings: { file: 'auth.md', key: 'auth0Domain' } },
        { key: 'auth.auth0ClientId', prompt: 'Auth0 client ID', help: 'Find in Auth0 dashboard > Applications', toSettings: { file: 'auth.md', key: 'auth0ClientId' } },
      ],
    },
  },
  content: {
    title: 'Content',
    description: 'GitHub integration for automated changelog and roadmap generation.',
    steps: [
      {
        key: 'content.githubRepo',
        prompt: 'GitHub repo (owner/repo)',
        help: 'e.g. myuser/my-product — used for changelog and roadmap sync.',
      },
      {
        key: 'content.githubToken',
        prompt: 'GitHub personal access token',
        help: 'Create at github.com/settings/tokens with repo scope.',
        secret: true,
      },
    ],
  },
  data: {
    title: 'Data',
    description: 'Configure data provider credentials for dynamic content. Stored locally, never committed.',
    providers: [
      { value: 'supabase', label: 'Supabase',  desc: 'PostgreSQL with instant APIs' },
      { value: 'firebase', label: 'Firebase',   desc: 'Google real-time database' },
      { value: 'airtable', label: 'Airtable',   desc: 'Spreadsheet-database hybrid' },
      { value: 'rest',     label: 'REST API',   desc: 'Any REST endpoint' },
    ],
    settingsFile: 'data.md',
    providerKey: 'provider',
    providerSteps: {
      supabase: [
        { key: 'data.supabaseUrl', prompt: 'Supabase project URL', help: 'Find in Supabase dashboard > Settings > API', toSettings: { file: 'data.md', key: 'supabaseUrl' } },
        { key: 'data.supabaseAnonKey', prompt: 'Supabase anon key', help: 'Public anon key from Settings > API', secret: true },
        { key: 'data.supabaseServiceKey', prompt: 'Supabase service role key (optional)', help: 'Only for server-side queries. Keep this secret.', secret: true, optional: true },
      ],
      firebase: [
        { key: 'data.firebaseApiKey', prompt: 'Firebase API key', help: 'Find in Firebase console > Project settings', secret: true },
        { key: 'data.firebaseProjectId', prompt: 'Firebase project ID', toSettings: { file: 'data.md', key: 'firebaseProjectId' } },
      ],
      airtable: [
        { key: 'data.airtableApiKey', prompt: 'Airtable API key', help: 'Create at airtable.com/account', secret: true },
        { key: 'data.airtableBaseId', prompt: 'Airtable base ID', help: 'Find in the Airtable API docs for your base (starts with app...)', toSettings: { file: 'data.md', key: 'airtableBaseId' } },
      ],
      rest: [
        { key: 'data.restBaseUrl', prompt: 'REST API base URL', help: 'e.g. https://api.example.com/v1', toSettings: { file: 'data.md', key: 'restBaseUrl' } },
        { key: 'data.restAuthHeader', prompt: 'Authorization header (optional)', help: 'e.g. Bearer your-token-here', secret: true, optional: true },
      ],
    },
  },
}

async function cmdSetup(args, root, useGlobal) {
  if (!isTTY()) {
    console.error('Setup requires an interactive terminal. Use `sitemd config set` for non-interactive config.')
    process.exit(1)
  }

  const sectionName = args[0]
  const sections = sectionName ? [sectionName] : Object.keys(SETUP_SECTIONS)

  for (const name of sections) {
    const section = SETUP_SECTIONS[name]
    if (!section) {
      console.error(`Unknown section: ${name}. Available: ${Object.keys(SETUP_SECTIONS).join(', ')}`)
      process.exit(1)
    }
    await runSetupSection(section, name, root, useGlobal)
  }
}

async function runSetupSection(section, sectionName, root, useGlobal) {
  const config = useGlobal ? loadGlobalConfig() : loadProjectConfig(root)

  console.log(`\n  ${section.title} — ${section.description}\n`)

  // If section has provider selection (email)
  if (section.providers) {
    console.log('  Provider?')
    for (let i = 0; i < section.providers.length; i++) {
      const p = section.providers[i]
      const num = `${i + 1}.`.padEnd(3)
      const label = p.value.padEnd(10)
      const urlPart = p.url ? ` (${p.url})` : ''
      console.log(`    ${num} ${label} — ${p.desc}${urlPart}`)
    }
    console.log()

    // The frontmatter key for the provider (e.g. 'target' for deploy, 'provider' for auth/email/data)
    const providerFrontmatterKey = section.providerKey || 'provider'

    // Read current provider from settings frontmatter
    let currentProvider
    if (section.settingsFile) {
      const settingsPath = path.join(root, 'settings', section.settingsFile)
      if (fs.existsSync(settingsPath)) {
        const content = fs.readFileSync(settingsPath, 'utf-8')
        const match = content.match(new RegExp(`^${providerFrontmatterKey}:\\s*(\\S+)`, 'm'))
        if (match) currentProvider = match[1]
      }
    }

    const defaultHint = currentProvider ? ` [${currentProvider}]` : ''
    const choice = await ask(`  > Choose provider${defaultHint}: `)
    const idx = parseInt(choice, 10) - 1
    let provider

    if (choice === '' && currentProvider) {
      provider = currentProvider
    } else if (idx >= 0 && idx < section.providers.length) {
      provider = section.providers[idx].value
    } else {
      // Try matching by name
      provider = section.providers.find(p => p.value === choice.toLowerCase())?.value
      if (!provider) {
        console.log('  Skipped.\n')
        return
      }
    }

    // Write provider selection to settings frontmatter
    if (section.settingsFile) {
      setSettingsFrontmatter(root, section.settingsFile, providerFrontmatterKey, provider)
    }

    // Run provider-specific steps
    const steps = section.providerSteps[provider] || []
    for (const step of steps) {
      await runStep(step, config, sectionName, root)
    }
  }

  // Run common steps
  if (section.steps) {
    for (const step of section.steps) {
      await runStep(step, config, sectionName, root)
    }
  }

  // Save
  if (useGlobal) {
    saveGlobalConfig(config)
  } else {
    saveProjectConfig(root, config)
  }

  // Summary
  const sectionData = config[sectionName] || {}
  const provider = sectionData.provider
  const keyCount = Object.keys(sectionData).filter(k => sectionData[k] !== undefined && sectionData[k] !== '').length
  const providerInfo = provider ? `: ${provider}` : ''
  console.log(`  ✓ ${section.title} configured${providerInfo} (${keyCount} values set)\n`)
}

async function runStep(step, config, sectionName, root) {
  const current = step.toSettings
    ? null  // Don't read from config store for settings-file values
    : getDotPath(config, step.key)
  const currentDisplay = current
    ? (step.secret ? redact(current) : current)
    : step.default || ''

  if (step.help) console.log(`  ${step.help}`)

  const defaultHint = currentDisplay ? ` [${currentDisplay}]` : (step.default ? ` [${step.default}]` : '')
  const answer = await ask(`  ${step.prompt}${defaultHint}: `)

  const finalValue = answer || (current ? undefined : step.default)

  if (answer === '' && step.optional && !current) return
  if (!answer && !current && !step.default) return

  if (finalValue) {
    if (step.toSettings) {
      // Write non-secret to settings/*.md frontmatter
      setSettingsFrontmatter(root, step.toSettings.file, step.toSettings.key, finalValue)
    } else {
      // Write secret to config store
      setDotPath(config, step.key, finalValue)
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function findProjectRoot(dir) {
  let current = dir
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'settings'))) return current
    current = path.dirname(current)
  }
  return dir
}

module.exports = { run, cmdSetup, cmdShow, cmdSet, cmdGet, cmdDelete, findProjectRoot }

if (require.main === module) {
  main().catch(err => {
    console.error(err.message)
    process.exit(1)
  })
}
