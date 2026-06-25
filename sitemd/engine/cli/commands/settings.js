const fs = require('fs')
const path = require('path')
const { dim, bold, green } = require('../ui')

const SETTINGS_FILES = ['meta', 'header', 'footer', 'groups', 'build', 'theme', 'seo', 'email', 'analytics', 'deploy', 'content', 'auth', 'data', 'forms']

async function runSettings(args, root) {
  const { parseFrontmatter } = require('../../build/parse')

  const jsonMode = args.includes('--json')
  const name = args.find(a => !a.startsWith('-'))

  const settingsDir = path.join(root, 'settings')
  if (!fs.existsSync(settingsDir)) {
    console.error('  No settings/ directory found.')
    process.exit(1)
  }

  if (name) {
    // Read specific settings file
    const filePath = path.join(settingsDir, name + '.md')
    if (!fs.existsSync(filePath)) {
      console.error(`  Settings file not found: settings/${name}.md`)
      process.exit(1)
    }

    const raw = fs.readFileSync(filePath, 'utf-8')
    const { meta } = parseFrontmatter(raw)

    if (jsonMode || !process.stdout.isTTY) {
      console.log(JSON.stringify(meta, null, 2))
      return
    }

    console.log(`  ${bold('settings/' + name + '.md')}`)
    console.log()
    printFields(meta)
    console.log()
  } else {
    // List all settings files with summary
    const results = {}
    for (const file of SETTINGS_FILES) {
      const filePath = path.join(settingsDir, file + '.md')
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const { meta } = parseFrontmatter(raw)
        results[file] = meta
      }
    }

    if (jsonMode || !process.stdout.isTTY) {
      console.log(JSON.stringify(results, null, 2))
      return
    }

    console.log(`  ${bold('Settings')}`)
    console.log()
    for (const [file, meta] of Object.entries(results)) {
      const keys = Object.keys(meta).filter(k => !k.startsWith('_'))
      const preview = keys.slice(0, 3).map(k => {
        const v = meta[k]
        const val = typeof v === 'string' ? v : (Array.isArray(v) ? `[${v.length}]` : typeof v)
        return `${k}: ${val.length > 30 ? val.slice(0, 30) + '...' : val}`
      }).join(', ')
      console.log(`  ${green(file.padEnd(12))} ${preview || dim('(empty)')}${keys.length > 3 ? dim(` +${keys.length - 3} more`) : ''}`)
    }
    console.log()
    console.log(`  ${dim('Run')} ${bold('sitemd settings <name>')} ${dim('to see full details.')}`)
    console.log()
  }
}

function printFields(meta, indent = '  ') {
  for (const [key, val] of Object.entries(meta)) {
    if (key.startsWith('_')) continue
    if (Array.isArray(val)) {
      console.log(`${indent}${bold(key)}:`)
      for (const item of val) {
        if (typeof item === 'object') {
          console.log(`${indent}  - ${JSON.stringify(item)}`)
        } else {
          console.log(`${indent}  - ${item}`)
        }
      }
    } else if (typeof val === 'object' && val !== null) {
      console.log(`${indent}${bold(key)}:`)
      for (const [k, v] of Object.entries(val)) {
        console.log(`${indent}  ${k}: ${v}`)
      }
    } else {
      console.log(`${indent}${bold(key)}: ${val}`)
    }
  }
}

module.exports = { runSettings }
