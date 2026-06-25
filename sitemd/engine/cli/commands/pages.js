const fs = require('fs')
const path = require('path')
const { dim, bold, green, red } = require('../ui')

async function runPages(args, root) {
  const sub = args[0]
  if (sub === 'create') return runPagesCreate(args.slice(1), root)
  if (sub === 'create-batch') return runPagesCreateBatch(args.slice(1), root)
  if (sub === 'delete') return runPagesDelete(args.slice(1), root)
  return runPagesList(args, root)
}

async function runPagesList(args, root) {
  const { findMarkdownFiles } = require('../../build/discover')
  const { parseFrontmatter } = require('../../build/parse')
  const { loadSettings } = require('../../build/config')

  const config = loadSettings(root)
  const pagesDir = path.join(root, config.pagesDir)

  if (!fs.existsSync(pagesDir)) {
    console.log('  No pages directory found.')
    process.exit(1)
  }

  const files = findMarkdownFiles(pagesDir)
  const pages = files.map(f => {
    const raw = fs.readFileSync(f.filePath, 'utf-8')
    const { meta } = parseFrontmatter(raw)
    let slug = meta.slug
    if (!slug) {
      slug = '/' + f.relativePath.replace(/\.md$/, '').replace(/\\/g, '/')
      if (slug.endsWith('/index')) slug = slug.slice(0, -6) || '/'
    }
    return {
      relativePath: f.relativePath,
      title: meta.title || null,
      slug,
      description: meta.description || null,
      groupMember: meta.groupMember || null,
    }
  })

  // JSON output when piped
  if (!process.stdout.isTTY) {
    console.log(JSON.stringify(pages, null, 2))
    return
  }

  console.log(`  ${bold(pages.length + ' pages')}`)
  console.log()

  // Find max slug length for alignment
  const maxSlug = Math.min(Math.max(...pages.map(p => p.slug.length), 4), 40)

  for (const p of pages) {
    const slug = p.slug.padEnd(maxSlug)
    const title = p.title || dim('(no title)')
    const group = p.groupMember ? dim(` [${Array.isArray(p.groupMember) ? p.groupMember.map(g => typeof g === 'string' ? g : Object.keys(g)[0]).join(', ') : p.groupMember}]`) : ''
    console.log(`  ${green(slug)}  ${title}${group}`)
  }
  console.log()
}

function runPagesCreate(args, root) {
  const slug = args[0]
  if (!slug) {
    console.error('  Usage: sitemd pages create <slug> [--title "Title"] [--description "Desc"] [--group docs]')
    process.exit(1)
  }

  const title = flagVal(args, '--title') || slug.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const description = flagVal(args, '--description') || ''
  const group = flagVal(args, '--group')
  const content = flagVal(args, '--content') || ''

  const { loadSettings } = require('../../build/config')
  const { parseGroups } = require('../../build/parse')
  const { writeGroupsFile, resolveGroup } = require('../../build/groups')
  const config = loadSettings(root)

  let normalizedSlug = slug.startsWith('/') ? slug : '/' + slug
  const slugPath = normalizedSlug.replace(/^\//, '') || 'home'
  const filePath = path.join(root, config.pagesDir, slugPath + '.md')

  if (fs.existsSync(filePath)) {
    console.error(`  Page already exists: ${normalizedSlug}`)
    process.exit(1)
  }

  let fm = '---\n'
  fm += `title: ${title}\n`
  if (description) fm += `description: ${description}\n`
  fm += `slug: ${normalizedSlug}\n`
  if (group) {
    fm += `sidebarGroupShown: ${group}\n`
    fm += `groupMember:\n  - ${group}\n`
  }
  fm += '---\n'

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, fm + '\n' + content + '\n')

  if (group) {
    const groupsPath = path.join(root, 'settings', 'groups.md')
    if (fs.existsSync(groupsPath)) {
      const groups = parseGroups(fs.readFileSync(groupsPath, 'utf-8'))
      const [resolvedKey, resolvedGroup] = resolveGroup(groups, group)
      if (resolvedGroup) {
        if (!resolvedGroup.items.find(item => item.slug === normalizedSlug)) {
          resolvedGroup.items.push({ label: title, slug: normalizedSlug, type: 'link', target: null, variant: null, size: null, color: null })
          writeGroupsFile(groupsPath, groups)
        }
      }
    }
  }

  console.log(`  ${green('Created')} ${normalizedSlug} → ${path.relative(root, filePath)}`)
}

function runPagesCreateBatch(args, root) {
  const jsonPath = args[0]
  if (!jsonPath) {
    console.error('  Usage: sitemd pages create-batch <pages.json>')
    console.error('  JSON file should contain an array of {title, description, slug, content} objects')
    process.exit(1)
  }

  let pages
  try {
    pages = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  } catch (e) {
    console.error(`  Failed to read ${jsonPath}: ${e.message}`)
    process.exit(1)
  }

  let created = 0, failed = 0
  for (const page of pages) {
    const pageArgs = [page.slug]
    if (page.title) pageArgs.push('--title', page.title)
    if (page.description) pageArgs.push('--description', page.description)
    if (page.groupMember?.[0]) pageArgs.push('--group', page.groupMember[0])
    if (page.content) pageArgs.push('--content', page.content)
    try {
      runPagesCreate(pageArgs, root)
      created++
    } catch {
      failed++
    }
  }
  console.log()
  console.log(`  ${created} created, ${failed} failed`)
}

function runPagesDelete(args, root) {
  const slug = args[0]
  if (!slug) {
    console.error('  Usage: sitemd pages delete <slug>')
    process.exit(1)
  }

  const { loadSettings } = require('../../build/config')
  const { parseFrontmatter, parseGroups } = require('../../build/parse')
  const { writeGroupsFile } = require('../../build/groups')
  const config = loadSettings(root)

  const normalizedSlug = slug.startsWith('/') ? slug : '/' + slug
  const slugPath = normalizedSlug.replace(/^\//, '') || 'home'
  const filePath = path.join(root, config.pagesDir, slugPath + '.md')

  if (!fs.existsSync(filePath)) {
    console.error(`  Page not found: ${normalizedSlug}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { meta } = parseFrontmatter(raw)
  fs.unlinkSync(filePath)

  const groupMembers = meta.groupMember || []
  if (groupMembers.length > 0) {
    const groupsPath = path.join(root, 'settings', 'groups.md')
    if (fs.existsSync(groupsPath)) {
      const groups = parseGroups(fs.readFileSync(groupsPath, 'utf-8'))
      for (const g of (Array.isArray(groupMembers) ? groupMembers : [groupMembers])) {
        if (groups[g]) {
          groups[g].items = groups[g].items.filter(item => item.slug !== normalizedSlug)
        }
      }
      writeGroupsFile(groupsPath, groups)
    }
  }

  console.log(`  ${red('Deleted')} ${normalizedSlug}`)
}

function flagVal(args, flag) {
  const idx = args.indexOf(flag)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null
}

module.exports = { runPages }
