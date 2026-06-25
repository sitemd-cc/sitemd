const { getAuth, saveAuth, clearAuth, isTTY } = require('./auth-store')
const readline = require('readline')

const API_URL = 'https://api.sitemd.cc'

async function run(command, args) {
  switch (command) {
    case 'login': return login(args || [])
    case 'logout': return logout()
    case 'status': return status()
    case 'api-key': return apiKey(args || [])
    case 'setup': return authSetup(args || [])
    default:
      console.log('Usage: sitemd auth <command>\n')
      console.log('Commands:')
      console.log('  login       Log in to your sitemd account')
      console.log('  logout      Clear saved credentials')
      console.log('  status      Show current auth status')
      console.log('  setup       Enable user authentication')
      console.log('  api-key     Create an API key for CI')
      process.exit(1)
  }
}

async function login(args) {
  const email = args[0]
  const codeIdx = args.indexOf('--code')
  const code = codeIdx !== -1 ? args[codeIdx + 1] : null

  // Non-interactive verify: sitemd login user@example.com --code 123456
  if (email && code) {
    return verifyCode(email, code)
  }

  // Non-interactive send: sitemd login user@example.com
  if (email && !email.startsWith('--')) {
    return sendCode(email)
  }

  // Interactive: prompt for email, send code, prompt for code
  if (isTTY()) {
    const inputEmail = await prompt('Email: ')
    if (!inputEmail || !inputEmail.includes('@')) {
      console.error('Valid email required.')
      process.exit(1)
    }

    await sendCode(inputEmail)

    const inputCode = await prompt('Verification code: ')
    if (!inputCode) {
      console.error('No code provided.')
      process.exit(1)
    }

    return verifyCode(inputEmail, inputCode)
  }

  console.error('Usage: sitemd login <email> [--code <code>]')
  process.exit(1)
}

async function sendCode(email) {
  if (!email.includes('@')) {
    console.error('Valid email required.')
    process.exit(1)
  }

  console.log(`Sending verification code to ${email}...`)

  const res = await fetch(`${API_URL}/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error(`Failed: ${err.error || res.statusText}`)
    process.exit(1)
  }

  console.log(`Verification code sent to ${email}.`)
  if (!isTTY()) {
    console.log(`\nVerify with:\n  sitemd login ${email} --code <code>`)
  }
}

async function verifyCode(email, code) {
  const res = await fetch(`${API_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error(`Verification failed: ${err.error || res.statusText}`)
    process.exit(1)
  }

  const data = await res.json()
  saveAuth({ token: data.token, email: data.email, userId: data.accountId, name: null })
  console.log(`\nLogged in as ${data.email}`)
}

function logout() {
  clearAuth()
  console.log('Logged out')
}

async function status() {
  const auth = getAuth()
  if (!auth?.token) {
    console.log('Not logged in. Run: sitemd login')
    return
  }

  if (process.env.SITEMD_TOKEN) {
    console.log('Authenticated via SITEMD_TOKEN env var')
  }

  const res = await fetch(`${API_URL}/account`, {
    headers: { 'Authorization': `Bearer ${auth.token}` },
  })

  if (!res.ok) {
    console.log('Token is invalid or expired. Run: sitemd login')
    return
  }

  const account = await res.json()
  console.log(`Logged in as ${account.email}`)
  if (account.name) console.log(`Name: ${account.name}`)

  const licRes = await fetch(`${API_URL}/licenses`, {
    headers: { 'Authorization': `Bearer ${auth.token}` },
  })
  if (licRes.ok) {
    const { licenses } = await licRes.json()
    if (licenses.length === 0) {
      console.log('\nNo licenses. Purchase at https://sitemd.cc/upgrade')
    } else {
      const totalMax = licenses.reduce((sum, l) => sum + l.max_sites, 0)
      const totalUsed = licenses.reduce((sum, l) => sum + l.sites_used, 0)
      console.log(`\nLicenses: ${licenses.length}`)
      console.log(`Site slots: ${totalUsed}/${totalMax} used`)
    }
  }
}

async function whoami() {
  const auth = getAuth()
  if (!auth?.token) {
    console.log('Not logged in. Run: sitemd login')
    return
  }

  const res = await fetch(`${API_URL}/account`, {
    headers: { 'Authorization': `Bearer ${auth.token}` },
  })

  if (!res.ok) {
    if (res.status === 401) {
      console.log('Session expired. Run: sitemd login')
      return
    }
    console.error(`Failed: ${res.statusText}`)
    process.exit(1)
  }

  const data = await res.json()
  console.log(`Account: ${data.email}`)
}

async function apiKey(args) {
  const auth = getAuth()
  if (!auth?.token) {
    console.error('Not logged in. Run: sitemd login')
    process.exit(1)
  }

  const name = args.join(' ') || 'CLI'

  const res = await fetch(`${API_URL}/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.token}`,
    },
    body: JSON.stringify({ name }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    console.error(`Failed: ${data.error || 'Failed to create API key'}`)
    process.exit(1)
  }

  const data = await res.json()
  console.log(`API key created: ${data.name}`)
  console.log(`\n  ${data.key}\n`)
  console.log('Save this key — it won\'t be shown again.')
  console.log('Use it with: SITEMD_TOKEN=<key> sitemd deploy')
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function authSetup(args) {
  const fs = require('fs')
  const path = require('path')
  const { bold, green, dim } = require('./ui')

  const root = process.env.SITEMD_PROJECT_ROOT || process.cwd()
  const provider = args[0] || 'custom'
  const validProviders = ['custom', 'supabase', 'firebase', 'clerk', 'auth0']
  if (!validProviders.includes(provider)) {
    console.error(`  Invalid provider "${provider}". Must be one of: ${validProviders.join(', ')}`)
    process.exit(1)
  }

  const loginModeIdx = args.indexOf('--login-mode')
  const loginMode = loginModeIdx !== -1 && args[loginModeIdx + 1] ? args[loginModeIdx + 1] : 'password'

  const authSettingsPath = path.join(root, 'settings', 'auth.md')
  if (fs.existsSync(authSettingsPath)) {
    const content = fs.readFileSync(authSettingsPath, 'utf-8')
    if (content.includes('enabled: true')) {
      console.log(`  Auth already enabled. Edit settings/auth.md to change provider or settings.`)
      return
    }
  }

  const engineAuthDir = path.resolve(__dirname, '../auth')
  const { copyDirRecursive } = require('./commands/helpers')
  const created = []

  const authPagesSource = path.join(engineAuthDir, 'pages')
  const authPagesDest = path.join(root, 'auth-pages')
  if (fs.existsSync(authPagesSource) && !fs.existsSync(authPagesDest)) {
    copyDirRecursive(authPagesSource, authPagesDest)
    created.push('auth-pages/')
  }

  const accountPagesSource = path.join(engineAuthDir, 'account-pages')
  const accountPagesDest = path.join(root, 'account-pages')
  if (fs.existsSync(accountPagesSource) && !fs.existsSync(accountPagesDest)) {
    copyDirRecursive(accountPagesSource, accountPagesDest)
    created.push('account-pages/')
  }

  const gatedPagesDest = path.join(root, 'gated-pages')
  if (!fs.existsSync(gatedPagesDest)) {
    fs.mkdirSync(gatedPagesDest, { recursive: true })
    created.push('gated-pages/')
  }

  fs.mkdirSync(path.join(root, 'settings'), { recursive: true })
  const authContent = [
    '---', '# User authentication', 'enabled: true',
    `provider: ${provider}`, `loginMode: ${loginMode}`, '',
    '# Routes', 'loginPage: /login', 'afterLogin: /account',
    'afterLogout: /', 'accessDeniedPage: /access-denied', '---',
  ].join('\n') + '\n'
  fs.writeFileSync(authSettingsPath, authContent)
  created.push('settings/auth.md')

  console.log(`  ${green('Auth enabled')} with ${bold(provider)} provider`)
  for (const f of created) console.log(`    ${dim('+')} ${f}`)
  console.log()
  console.log(`  Configure provider credentials: ${bold('sitemd secret set')}`)
}

module.exports = { run, login, logout, status, whoami, apiKey, authSetup }
