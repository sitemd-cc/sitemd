const fs = require('fs')
const path = require('path')
const { bold, green, dim } = require('../ui')
const { copyDirRecursive, getPkgRoot } = require('./helpers')

async function runInit(args) {
  const flags = new Set(args.filter(a => a.startsWith('--')))
  const positional = args.filter(a => !a.startsWith('--'))
  const target = positional[0]
  const quiet = flags.has('--quiet')
  if (!target) {
    console.error('  Usage: sitemd init <directory>')
    process.exit(1)
  }

  const targetDir = path.resolve(process.cwd(), target)

  if (fs.existsSync(targetDir)) {
    if (fs.existsSync(path.join(targetDir, 'sitemd', 'engine')) || fs.existsSync(path.join(targetDir, 'sitemd', 'settings'))) {
      console.error(`  Directory ${bold(target)} already contains a sitemd project.`)
      console.error(`  Use ${bold('sitemd update')} to update an existing project.`)
      process.exit(1)
    }
  }

  if (!quiet) {
    console.log(`  Creating ${bold(target)}...`)
    console.log()
  }

  const pkgRoot = getPkgRoot(path.resolve(__dirname, '..', '..', '..'))
  const npmRoot = path.resolve(pkgRoot, '..')

  // Product directories -> targetDir/sitemd/
  const sitemdDir = path.join(targetDir, 'sitemd')
  for (const dir of ['engine', 'settings', 'theme', 'pages', 'media', 'templates', 'modals']) {
    const src = path.join(pkgRoot, dir)
    if (fs.existsSync(src)) {
      copyDirRecursive(src, path.join(sitemdDir, dir))
    }
  }

  // Product files -> targetDir/sitemd/
  for (const file of ['LICENSE.md']) {
    const src = path.join(pkgRoot, file)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(sitemdDir, file))
    }
  }

  // Root-level files -> targetDir/
  const siteMdSrc = path.join(npmRoot, 'site.md')
  if (fs.existsSync(siteMdSrc)) {
    fs.copyFileSync(siteMdSrc, path.join(targetDir, 'site.md'))
  }

  // Package.json at root
  const rootPkgSrc = path.join(npmRoot, 'package.json')
  if (fs.existsSync(rootPkgSrc)) {
    const pkg = JSON.parse(fs.readFileSync(rootPkgSrc, 'utf8'))
    delete pkg.private
    fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  }

  // Install single skill to project root
  for (const dir of ['.claude/skills/sitemd', '.agents/skills/sitemd']) {
    const src = path.join(npmRoot, dir, 'SKILL.md')
    if (fs.existsSync(src)) {
      const destDir = path.join(targetDir, dir)
      fs.mkdirSync(destDir, { recursive: true })
      fs.copyFileSync(src, path.join(destDir, 'SKILL.md'))
    }
  }

  if (quiet) return

  console.log(`  ${green('Done!')} Created sitemd project at ${bold(target)}`)
  console.log()
  console.log(`  ${bold('Get started:')}`)
  console.log(`    cd ${target}`)
  console.log(`    npm install`)
  console.log(`    sitemd launch`)
  console.log()
  console.log(`  ${dim('Docs: https://sitemd.cc/docs')}`)
  console.log()
}

module.exports = { runInit }
