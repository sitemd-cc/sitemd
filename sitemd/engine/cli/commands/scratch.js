const fs = require('fs')
const path = require('path')
const { bold, green, yellow, dim } = require('../ui')
const { copyDirRecursive, ask, getPkgRoot } = require('./helpers')

async function runScratch(root) {
  console.log(`  ${yellow('This will replace your pages/ and settings/ with a minimal blank-slate.')}`)
  console.log(`  ${dim('engine/ and theme/ will be preserved.')}`)
  console.log()

  const confirm = await ask(`  Type ${bold('yes')} to continue: `)
  if (confirm !== 'yes') {
    console.log('  Cancelled.')
    return
  }

  console.log()

  // Find scratch templates
  const pkgRoot = getPkgRoot(path.resolve(__dirname, '..', '..', '..'))
  let scratchDir = path.join(pkgRoot, 'templates', 'scratch')

  // Fallback: look in distro/templates (for development from repo root)
  if (!fs.existsSync(scratchDir)) {
    scratchDir = path.join(pkgRoot, '..', '..', 'distro', 'templates', 'scratch')
  }

  if (!fs.existsSync(scratchDir)) {
    console.error('  Could not find scratch templates.')
    process.exit(1)
  }

  // Replace pages/
  const pagesDir = path.join(root, 'pages')
  if (fs.existsSync(pagesDir)) fs.rmSync(pagesDir, { recursive: true })
  copyDirRecursive(path.join(scratchDir, 'pages'), pagesDir)

  // Replace settings/
  const settingsDir = path.join(root, 'settings')
  if (fs.existsSync(settingsDir)) fs.rmSync(settingsDir, { recursive: true })
  copyDirRecursive(path.join(scratchDir, 'settings'), settingsDir)

  // Clear media/ (keep directory)
  const mediaDir = path.join(root, 'media')
  if (fs.existsSync(mediaDir)) {
    for (const entry of fs.readdirSync(mediaDir)) {
      if (entry === '.gitkeep') continue
      fs.rmSync(path.join(mediaDir, entry), { recursive: true })
    }
  }

  console.log(`  ${green('Done!')} Project reset to blank-slate.`)
  console.log(`  Run ${bold('sitemd launch')} to preview.`)
  console.log()
}

module.exports = { runScratch }
