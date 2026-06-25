const fs = require('fs')
const path = require('path')
const { dim, bold, green, yellow } = require('../ui')

function secretsPath(root) {
  return path.join(root, '.sitemd', 'secrets')
}

function readSecrets(root) {
  const p = secretsPath(root)
  if (!fs.existsSync(p)) return {}
  const secrets = {}
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    secrets[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return secrets
}

function writeSecrets(root, secrets) {
  const dir = path.join(root, '.sitemd')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const lines = ['# sitemd secrets — DO NOT commit this file']
  for (const [key, value] of Object.entries(secrets)) {
    lines.push(`${key}=${value}`)
  }
  fs.writeFileSync(secretsPath(root), lines.join('\n') + '\n', { mode: 0o600 })
}

function runSecret(args, root) {
  const sub = args[0]
  if (sub === 'set') return secretSet(args.slice(1), root)
  if (sub === 'list') return secretList(root)
  if (sub === 'remove') return secretRemove(args.slice(1), root)

  console.log(`  ${bold('Usage:')} sitemd secret <command>`)
  console.log()
  console.log(`  ${bold('Commands:')}`)
  console.log('    set KEY=VALUE    Set a secret')
  console.log('    list             List secret keys')
  console.log('    remove KEY       Remove a secret')
  process.exit(1)
}

function secretSet(args, root) {
  const kv = args[0]
  if (!kv) {
    console.error('  Usage: sitemd secret set KEY=VALUE')
    process.exit(1)
  }
  const eq = kv.indexOf('=')
  if (eq === -1) {
    console.error('  Usage: sitemd secret set KEY=VALUE')
    process.exit(1)
  }

  const key = kv.slice(0, eq)
  const value = kv.slice(eq + 1)
  const secrets = readSecrets(root)
  secrets[key] = value
  writeSecrets(root, secrets)
  console.log(`  ${green('Set')} ${key} in .sitemd/secrets`)
}

function secretList(root) {
  const secrets = readSecrets(root)
  const keys = Object.keys(secrets)

  if (keys.length === 0) {
    console.log('  No secrets configured. Run sitemd secret set KEY=VALUE to add one.')
    return
  }

  console.log(`  ${bold('Secrets')} (.sitemd/secrets):`)
  for (const key of keys) {
    console.log(`    ${key}`)
  }
}

function secretRemove(args, root) {
  const key = args[0]
  if (!key) {
    console.error('  Usage: sitemd secret remove KEY')
    process.exit(1)
  }

  const secrets = readSecrets(root)
  if (!(key in secrets)) {
    console.error(`  Secret "${key}" not found.`)
    process.exit(1)
  }

  delete secrets[key]
  writeSecrets(root, secrets)
  console.log(`  Removed ${key} from .sitemd/secrets`)
}

function migrateConfigJsonToSecrets(root) {
  const configJsonPath = path.join(root, '.sitemd', 'config.json')
  if (!fs.existsSync(configJsonPath)) return false

  let config
  try {
    config = JSON.parse(fs.readFileSync(configJsonPath, 'utf-8'))
  } catch { return false }

  if (Object.keys(config).length === 0) return false

  const secrets = readSecrets(root)
  let migrated = 0

  function flattenToSecrets(obj, prefix) {
    for (const [key, val] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        flattenToSecrets(val, fullKey)
      } else if (val !== undefined && val !== null && val !== '') {
        const secretKey = fullKey.replace(/\./g, '_').toUpperCase()
        if (!secrets[secretKey]) {
          secrets[secretKey] = String(val)
          migrated++
        }
      }
    }
  }

  flattenToSecrets(config, '')
  if (migrated > 0) {
    writeSecrets(root, secrets)
    console.log(`  ${yellow('Migrated')} ${migrated} values from .sitemd/config.json → .sitemd/secrets`)
  }
  return migrated > 0
}

module.exports = { runSecret, readSecrets, writeSecrets, migrateConfigJsonToSecrets }
