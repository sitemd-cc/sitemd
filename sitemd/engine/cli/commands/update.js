const fs = require('fs')
const path = require('path')
const { bold, green, yellow, cyan, dim, red } = require('../ui')

const OLD_CLAUDE_SKILLS = [
  'brain', 'brainstorm', 'clone', 'commit', 'deploy', 'feedback', 'import',
  'kickstart', 'kill', 'launch', 'look', 'og-image', 'plan', 'push',
  'release', 'reload', 'research', 'seo', 'shutdown', 'site', 'sitemd-merge',
  'vibe-audit', 'write',
]

const OLD_AGENTS_SKILLS = [
  'clone', 'deploy', 'feedback', 'import', 'kickstart', 'launch', 'og-image',
  'release', 'reload', 'seo', 'shutdown', 'site', 'sitemd-merge', 'write',
]

async function runUpdate(root, VERSION) {
  const { checkForUpdate } = require('../update-check')
  const { ask } = require('./helpers')

  const currentVersion = VERSION || 'unknown'
  const projectRoot = root && path.basename(root) === 'sitemd' ? path.resolve(root, '..') : root

  // Version check
  console.log(`  Current version: ${bold(currentVersion)}`)
  console.log(`  Checking for updates...`)
  console.log()

  const result = await checkForUpdate()

  if (result.latest) {
    if (result.hasUpdate) {
      console.log(`  ${yellow('Update available:')} v${currentVersion} → v${bold(result.latest)}`)
      console.log(`  Run: ${cyan('npm update -g @sitemd-cc/sitemd')}`)
      console.log()
    } else {
      console.log(`  ${green('Up to date!')} v${currentVersion}`)
      console.log()
    }
  }

  // Architectural migration — clean up old install artifacts
  if (projectRoot) {
    const report = migrateProject(projectRoot, root)
    if (report.length > 0) {
      console.log(`  ${bold('Migration:')}`)
      for (const line of report) console.log(`    ${line}`)
      console.log()
    } else {
      console.log(`  ${dim('No legacy artifacts found.')}`)
      console.log()
    }
  }
}

function migrateProject(projectRoot, sitemdRoot) {
  const report = []

  // 1. Remove old .mcp.json sitemd entries
  for (const name of ['.mcp.json', '.mcp-sitemd.json']) {
    const mcpPath = path.join(projectRoot, name)
    if (fs.existsSync(mcpPath)) {
      if (name === '.mcp-sitemd.json') {
        fs.unlinkSync(mcpPath)
        report.push(`${red('−')} ${name}`)
      } else {
        try {
          const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'))
          if (mcp.mcpServers?.sitemd) {
            delete mcp.mcpServers.sitemd
            if (Object.keys(mcp.mcpServers).length === 0) {
              fs.unlinkSync(mcpPath)
              report.push(`${red('−')} .mcp.json ${dim('(was sitemd-only)')}`)
            } else {
              fs.writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + '\n')
              report.push(`${yellow('~')} .mcp.json ${dim('(removed sitemd entry)')}`)
            }
          }
        } catch {}
      }
    }
  }

  // 2. Remove CLAUDE.md / AGENTS.md marker blocks
  for (const file of ['CLAUDE.md', 'AGENTS.md']) {
    const filePath = path.join(projectRoot, file)
    if (!fs.existsSync(filePath)) continue
    const content = fs.readFileSync(filePath, 'utf-8')
    const beginIdx = content.indexOf('<!-- sitemd:begin -->')
    const endIdx = content.indexOf('<!-- sitemd:end -->')
    if (beginIdx !== -1 && endIdx !== -1) {
      const before = content.slice(0, beginIdx).trimEnd()
      const after = content.slice(endIdx + '<!-- sitemd:end -->'.length).trimStart()
      const cleaned = (before + (after ? '\n\n' + after : '')).trim()
      if (cleaned.length === 0) {
        fs.unlinkSync(filePath)
        report.push(`${red('−')} ${file} ${dim('(was sitemd-only)')}`)
      } else {
        fs.writeFileSync(filePath, cleaned + '\n')
        report.push(`${yellow('~')} ${file} ${dim('(removed sitemd block)')}`)
      }
    }
  }

  // 3. Remove old individual skill directories
  for (const [dir, names] of [
    ['.claude/skills', OLD_CLAUDE_SKILLS],
    ['.agents/skills', OLD_AGENTS_SKILLS],
  ]) {
    let removed = 0
    for (const name of names) {
      const skillDir = path.join(projectRoot, dir, name)
      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true })
        removed++
      }
      // Also check -sitemd suffixed collision directories
      const collisionDir = path.join(projectRoot, dir, name + '-sitemd')
      if (fs.existsSync(collisionDir)) {
        fs.rmSync(collisionDir, { recursive: true })
        removed++
      }
    }
    if (removed > 0) {
      report.push(`${red('−')} ${dir}/ ${dim(`(${removed} old skill dirs)`)}`)
    }
  }

  // 4. Remove old binary files
  if (sitemdRoot) {
    for (const name of ['sitemd-bin', 'sitemd']) {
      const binPath = path.join(sitemdRoot, name)
      if (fs.existsSync(binPath) && !fs.statSync(binPath).isDirectory()) {
        // Only remove if it's the old Node wrapper or binary, not a directory
        try {
          const content = fs.readFileSync(binPath, 'utf-8').slice(0, 200)
          if (content.includes('sitemd-bin') || content.includes('#!/') || !content.includes('{')) {
            fs.unlinkSync(binPath)
            report.push(`${red('−')} sitemd/${name}`)
          }
        } catch {
          // Binary file, not readable as text — it's the old compiled binary
          fs.unlinkSync(binPath)
          report.push(`${red('−')} sitemd/${name}`)
        }
      }
    }
  }

  // 5. Migrate .sitemd/config.json to .sitemd/secrets
  if (sitemdRoot) {
    const { migrateConfigJsonToSecrets } = require('./secret')
    if (migrateConfigJsonToSecrets(sitemdRoot)) {
      report.push(`${yellow('~')} .sitemd/config.json → .sitemd/secrets`)
    }
  }

  // 6. Install/update single skill
  const skillSrc = path.resolve(__dirname, '..', '..', '..', '..', 'source')
  // In installed package, skills are at the package root level
  const pkgSkillSrc = path.resolve(__dirname, '..', '..', '..')
  const actualSrc = fs.existsSync(path.join(skillSrc, '.claude', 'skills', 'sitemd')) ? skillSrc : pkgSkillSrc

  for (const dir of ['.claude/skills/sitemd', '.agents/skills/sitemd']) {
    const srcSkill = path.join(actualSrc, dir, 'SKILL.md')
    const destDir = path.join(projectRoot, dir)
    const destSkill = path.join(destDir, 'SKILL.md')

    if (fs.existsSync(srcSkill)) {
      const srcContent = fs.readFileSync(srcSkill, 'utf-8')
      const destContent = fs.existsSync(destSkill) ? fs.readFileSync(destSkill, 'utf-8') : ''
      if (srcContent !== destContent) {
        fs.mkdirSync(destDir, { recursive: true })
        fs.writeFileSync(destSkill, srcContent)
        report.push(`${green('+')} ${dir}/SKILL.md`)
      }
    }
  }

  // 7. Install/update site.md
  const siteMdSrc = path.join(actualSrc, 'site.md')
  const siteMdDest = path.join(projectRoot, 'site.md')
  if (fs.existsSync(siteMdSrc)) {
    const srcContent = fs.readFileSync(siteMdSrc, 'utf-8')
    const destContent = fs.existsSync(siteMdDest) ? fs.readFileSync(siteMdDest, 'utf-8') : ''
    if (srcContent !== destContent) {
      fs.writeFileSync(siteMdDest, srcContent)
      report.push(`${green('+')} site.md`)
    }
  }

  return report
}

module.exports = { runUpdate }
