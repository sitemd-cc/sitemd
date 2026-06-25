const fs = require('fs')
const path = require('path')
const { dim, bold, green } = require('../ui')

function runGroups(args, root) {
  const sub = args[0]
  if (sub === 'add') return runGroupsAdd(args.slice(1), root)
  return runGroupsList(root)
}

function runGroupsList(root) {
  const { parseGroups } = require('../../build/parse')
  const groupsPath = path.join(root, 'settings', 'groups.md')

  if (!fs.existsSync(groupsPath)) {
    console.log('  No groups configured.')
    return
  }

  const groups = parseGroups(fs.readFileSync(groupsPath, 'utf-8'))
  const names = Object.keys(groups)

  if (names.length === 0) {
    console.log('  No groups configured.')
    return
  }

  console.log(`  ${bold(names.length + ' group' + (names.length !== 1 ? 's' : ''))}`)
  console.log()

  for (const name of names) {
    const g = groups[name]
    console.log(`  ${green(name)} ${dim('(' + g.items.length + ' pages)')}`)
    for (const item of g.items) {
      console.log(`    ${item.slug}  ${dim(item.label)}`)
    }
    console.log()
  }
}

function runGroupsAdd(args, root) {
  const group = args[0]
  const slug = args[1]

  if (!group || !slug) {
    console.error('  Usage: sitemd groups add <group> <slug> [--label "Label"]')
    process.exit(1)
  }

  const { parseGroups } = require('../../build/parse')
  const { writeGroupsFile, resolveGroup } = require('../../build/groups')

  const groupsPath = path.join(root, 'settings', 'groups.md')
  let groups = {}
  if (fs.existsSync(groupsPath)) {
    groups = parseGroups(fs.readFileSync(groupsPath, 'utf-8'))
  }

  const labelIdx = args.indexOf('--label')
  const label = labelIdx !== -1 && args[labelIdx + 1] ? args[labelIdx + 1] : slug.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const normalizedSlug = slug.startsWith('/') ? slug : '/' + slug

  let [resolvedKey, resolvedGroup] = resolveGroup(groups, group)
  let created = false
  if (!resolvedGroup) {
    const groupSlug = group.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    groups[group] = { slug: groupSlug, items: [] }
    resolvedKey = group
    resolvedGroup = groups[group]
    created = true
  }

  if (resolvedGroup.items.find(item => item.slug === normalizedSlug)) {
    console.log(`  ${dim('Already in group:')} ${normalizedSlug} → ${resolvedKey}`)
    return
  }

  resolvedGroup.items.push({ label, slug: normalizedSlug, type: 'link', target: null, variant: null, size: null, color: null })
  writeGroupsFile(groupsPath, groups)

  console.log(`  ${green('Added')} ${normalizedSlug} → ${resolvedKey}${created ? dim(' (group created)') : ''}`)
}

module.exports = { runGroups }
