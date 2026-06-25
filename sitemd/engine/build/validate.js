/**
 * Content validation.
 * Validates pages against quality rules for their content type.
 */

const fs = require('fs')
const path = require('path')
const { findMarkdownFiles } = require('./discover')
const { parseFrontmatter } = require('./parse')
const { loadSettings } = require('./config')

/**
 * Resolve slug from a markdown file's frontmatter or relative path.
 */
function resolveSlug(meta, relativePath) {
  if (meta.slug) return meta.slug
  let slug = '/' + relativePath.replace(/\.md$/, '').replace(/\\/g, '/')
  if (slug.endsWith('/index')) slug = slug.slice(0, -6) || '/'
  return slug
}

/**
 * Strip fenced code blocks and inline code spans from a markdown body.
 * Used to keep example syntax inside code from triggering link/image/modal
 * validation false positives on syntax-reference docs.
 */
function stripCode(body) {
  // Fenced code blocks (any fence length ≥3, matching close)
  body = body.replace(/^(`{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, '')
  // Inline code spans
  body = body.replace(/`[^`\n]*`/g, '')
  return body
}

/**
 * Validate a single page. Returns { slug, contentType, checks }.
 * `allSlugs` is the Set of all known slugs for link validation.
 */
function runPageChecks(slug, meta, body, allSlugs, root) {
  // Detect content type
  let contentType = 'page'
  if (meta.groupMember) {
    const groups = Array.isArray(meta.groupMember) ? meta.groupMember : [meta.groupMember]
    if (groups.some(g => (typeof g === 'string' ? g : Object.keys(g)[0]) === 'docs')) contentType = 'docs'
    if (groups.some(g => (typeof g === 'string' ? g : Object.keys(g)[0]) === 'blog')) contentType = 'blog'
  }
  if (slug === '/changelog') contentType = 'changelog'
  if (slug === '/roadmap') contentType = 'roadmap'

  const checks = []

  // Universal checks
  checks.push({
    name: 'title',
    passed: !!meta.title,
    message: meta.title ? 'Title present' : 'Missing title in frontmatter',
  })

  checks.push({
    name: 'description_present',
    passed: !!meta.description,
    message: meta.description ? 'Description present' : 'Missing description in frontmatter',
  })

  if (meta.description) {
    checks.push({
      name: 'description_length',
      passed: meta.description.length <= 160,
      message: meta.description.length <= 160
        ? `Description is ${meta.description.length} chars`
        : `Description is ${meta.description.length} chars (should be ≤160)`,
    })
  }

  // Strip code blocks/spans for link/image/modal scanning so example
  // syntax inside docs doesn't produce false-positive warnings.
  const bodyNoCode = stripCode(body)

  // Check internal links
  const linkMatches = bodyNoCode.match(/\[([^\]]*)\]\(\/[^)]+\)/g) || []
  const brokenLinks = []
  for (const link of linkMatches) {
    const hrefMatch = link.match(/\]\((\/[^)#\s]+)/)
    if (hrefMatch && !allSlugs.has(hrefMatch[1]) && !/^\/media\//.test(hrefMatch[1]) && !/\/(rss|feed|atom)\.xml$/.test(hrefMatch[1])) {
      brokenLinks.push(hrefMatch[1])
    }
  }
  // Also check button targets
  const buttonMatches = bodyNoCode.match(/^button:.*:\s*\/[\w/-]+.*$/gm) || []
  for (const btn of buttonMatches) {
    const slugMatch = btn.match(/:\s*(\/[\w/-]+)/)
    if (slugMatch) {
      const cleanSlug = slugMatch[1].replace(/\+[a-z]+(?::[^\s)]+)?/gi, '').trim()
      if (cleanSlug.startsWith('//')) continue
      if (cleanSlug && !allSlugs.has(cleanSlug) && !/^\/media\//.test(cleanSlug)) {
        brokenLinks.push(cleanSlug)
      }
    }
  }
  checks.push({
    name: 'internal_links',
    passed: brokenLinks.length === 0,
    message: brokenLinks.length === 0 ? 'All internal links valid' : `Broken links: ${brokenLinks.join(', ')}`,
  })

  // Check images have alt text
  const imgMatches = bodyNoCode.match(/!\[([^\]]*)\]\(/g) || []
  const emptyAlts = imgMatches.filter(m => m === '![](').length
  checks.push({
    name: 'image_alt_text',
    passed: emptyAlts === 0,
    message: emptyAlts === 0 ? 'All images have alt text' : `${emptyAlts} image(s) missing alt text`,
  })

  // Check code blocks have language hints — track fence length so nested
  // 4-backtick wrappers don't confuse the toggle.
  let unlabeled = 0
  let currentFence = null
  for (const line of body.split('\n')) {
    const fenceMatch = line.match(/^(`{3,})/)
    if (!fenceMatch) continue
    if (currentFence) {
      // Only close on a fence at least as long as the opener
      if (fenceMatch[1].length >= currentFence.length) currentFence = null
    } else {
      currentFence = fenceMatch[1]
      const after = line.slice(fenceMatch[1].length).trim()
      if (after === '') unlabeled++
    }
  }
  checks.push({
    name: 'code_language_hints',
    passed: unlabeled === 0,
    message: unlabeled === 0 ? 'All code blocks have language hints' : `${unlabeled} code block(s) missing language hint`,
  })

  // Type-specific checks
  if (contentType === 'docs') {
    checks.push({
      name: 'sidebar_config',
      passed: !!meta.sidebarGroupShown,
      message: meta.sidebarGroupShown ? `sidebarGroupShown: ${meta.sidebarGroupShown}` : 'Missing sidebarGroupShown in frontmatter',
    })
    checks.push({
      name: 'group_membership',
      passed: !!(meta.groupMember && meta.groupMember.length > 0),
      message: meta.groupMember ? 'Has group membership' : 'Missing groupMember in frontmatter',
    })
  }

  if (contentType === 'blog') {
    const hasDate = /\*\*[A-Z][a-z]+ \d{1,2}, \d{4}\*\*/.test(body)
    checks.push({
      name: 'blog_date',
      passed: hasDate,
      message: hasDate ? 'Date line found' : 'Missing date line (expected **Month DD, YYYY** format)',
    })
  }

  if (contentType === 'changelog') {
    const hasVersion = /^## v\d+\.\d+\.\d+\s*—/m.test(body)
    checks.push({
      name: 'version_format',
      passed: hasVersion,
      message: hasVersion ? 'Valid version format' : 'Missing version header (expected ## vX.Y.Z — Date)',
    })
  }

  // Component syntax checks — modal indentation
  let modalOpens = 0
  let modalIndented = 0
  const bodyLines = body.split('\n')
  let inModal = false
  let currentModalHasIndent = false
  for (const line of bodyLines) {
    if (/^modal:\s*\S+/.test(line)) {
      if (inModal && currentModalHasIndent) modalIndented++
      modalOpens++
      inModal = true
      currentModalHasIndent = false
    } else if (inModal) {
      if (/^ {2,}\S/.test(line)) {
        currentModalHasIndent = true
      } else if (line.trim() && !/^\s/.test(line)) {
        if (currentModalHasIndent) modalIndented++
        inModal = false
      }
    }
  }
  if (inModal && currentModalHasIndent) modalIndented++
  if (modalOpens > 0 && modalIndented < modalOpens) {
    checks.push({
      name: 'modal_syntax',
      passed: false,
      message: `${modalOpens - modalIndented} modal block(s) may have incorrect indentation — content lines must be indented 2+ spaces`,
    })
  }

  // Check modal references point to defined modals
  const definedModals = new Set()
  for (const line of bodyLines) {
    const m = line.match(/^modal:\s*(\S+)/)
    if (m) definedModals.add(m[1])
  }
  const globalModalsDir = path.join(root, 'modals')
  if (fs.existsSync(globalModalsDir)) {
    for (const f of fs.readdirSync(globalModalsDir).filter(f => f.endsWith('.md'))) {
      definedModals.add(f.replace(/\.md$/, ''))
    }
  }
  const modalRefs = [...bodyNoCode.matchAll(/#modal:(\S+?)(?:[\s)"']|$)/g)].map(m => m[1])
  const undefinedModals = modalRefs.filter(id => !definedModals.has(id))
  if (undefinedModals.length > 0) {
    checks.push({
      name: 'modal_references',
      passed: false,
      message: `${undefinedModals.length} modal reference(s) point to undefined modals: ${undefinedModals.join(', ')} — define with "modal: id" + indented content, or create modals/id.md`,
    })
  }

  const formBlocks = body.match(/^form:/gm) || []
  if (formBlocks.length > 0) {
    const hasFields = /fields:/m.test(body)
    const hasWebhook = /webhook:/m.test(body)
    if (!hasFields || !hasWebhook) {
      const missing = [!hasWebhook && 'webhook', !hasFields && 'fields'].filter(Boolean)
      checks.push({
        name: 'form_completeness',
        passed: false,
        message: `Form block missing required property: ${missing.join(', ')} — every form block needs "webhook: URL" and "fields:" with at least one field`,
      })
    }
  }

  // Word count
  const wordCount = body.split(/\s+/).filter(Boolean).length
  checks.push({
    name: 'word_count',
    passed: true,
    message: `${wordCount} words`,
  })

  return { slug, contentType, checks }
}

/**
 * Validate a single page by slug.
 */
function validatePage(root, slug) {
  const config = loadSettings(root)
  const pagesDir = path.join(root, config.pagesDir)

  let targetMeta = null
  let targetBody = null
  const allSlugs = new Set()

  if (fs.existsSync(pagesDir)) {
    for (const f of findMarkdownFiles(pagesDir)) {
      const raw = fs.readFileSync(f.filePath, 'utf-8')
      const { meta, body } = parseFrontmatter(raw)
      const pageSlug = resolveSlug(meta, f.relativePath)
      allSlugs.add(pageSlug)
      if (pageSlug === slug) { targetMeta = meta; targetBody = body }
    }
  }

  if (!targetMeta) return { error: `Page not found for slug: ${slug}` }
  return runPageChecks(slug, targetMeta, targetBody, allSlugs, root)
}

/**
 * Validate all pages. Returns { pages: [{ slug, contentType, checks }] }.
 */
function validateAllPages(root) {
  const config = loadSettings(root)
  const pagesDir = path.join(root, config.pagesDir)

  // First pass: collect all slugs + page data
  const pageData = []
  const allSlugs = new Set()

  if (fs.existsSync(pagesDir)) {
    for (const f of findMarkdownFiles(pagesDir)) {
      const raw = fs.readFileSync(f.filePath, 'utf-8')
      const { meta, body } = parseFrontmatter(raw)
      const slug = resolveSlug(meta, f.relativePath)
      allSlugs.add(slug)
      pageData.push({ slug, meta, body })
    }
  }

  // Second pass: validate each page
  const pages = pageData.map(p => runPageChecks(p.slug, p.meta, p.body, allSlugs, root))
  return { pages }
}

module.exports = { validatePage, validateAllPages }
