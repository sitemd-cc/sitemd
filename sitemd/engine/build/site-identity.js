/**
 * Site identity — fingerprinting and activation receipt management.
 *
 * extractSiteFingerprint() scans rendered HTML output to build a rich identity fingerprint.
 * loadSiteReceipt() / writeSiteReceipt() manage the local site.md activation receipt.
 * The API is the source of truth — site.md is just a local receipt.
 */

const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Fingerprint extraction from rendered HTML
// ---------------------------------------------------------------------------

/** Extract text content from first matching tag in HTML */
function extractTag(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = html.match(re)
  return m ? m[1].replace(/<[^>]*>/g, '').trim() : null
}

/** Extract meta content by property or name */
function extractMeta(html, attr) {
  const re = new RegExp(`<meta\\s+(?:property|name)=["']${attr}["']\\s+content=["']([^"']*)["']`, 'i')
  const m = html.match(re)
  if (m) return m[1].trim()
  // Also check reversed attribute order
  const re2 = new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+(?:property|name)=["']${attr}["']`, 'i')
  const m2 = html.match(re2)
  return m2 ? m2[1].trim() : null
}

/** Extract brand text from header nav area */
function extractHeaderBrand(html) {
  // Look for the header/nav brand element — typically a link with site name
  const headerMatch = html.match(/<header[^>]*>([\s\S]*?)<\/header>/i)
  if (!headerMatch) return null
  const header = headerMatch[1]
  // Look for the nav brand link (usually first link in nav or header)
  const brandLink = header.match(/<a[^>]*class="[^"]*brand[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
    || header.match(/<a[^>]*href=["']\/["'][^>]*>([\s\S]*?)<\/a>/i)
  if (brandLink) return brandLink[1].replace(/<[^>]*>/g, '').trim()
  // Fallback: first text in header
  const firstText = header.replace(/<[^>]*>/g, '').trim().split('\n')[0]
  return firstText || null
}

/** Extract brand text from footer area */
function extractFooterBrand(html) {
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i)
  if (!footerMatch) return null
  const footer = footerMatch[1]
  // Look for copyright or brand text
  const copyright = footer.match(/©\s*\d{0,4}\s*([\w\s'.&-]+)/i)
  if (copyright) return copyright[1].trim()
  // Look for brand link
  const brandLink = footer.match(/<a[^>]*class="[^"]*brand[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
  if (brandLink) return brandLink[1].replace(/<[^>]*>/g, '').trim()
  return null
}

/**
 * Extract a rich site identity fingerprint from rendered HTML output.
 * @param {object} config - Build config (has .domain, .title, .brandName)
 * @param {Map} memoryOutput - Map of urlPath → rendered HTML strings
 * @returns {object} fingerprint
 */
function extractSiteFingerprint(config, memoryOutput) {
  const UTILITY_SLUGS = new Set([
    '/login', '/sign-up', '/forgot-password',
    '/account', '/access-denied', '/maintenance',
    '/404',
  ])

  const seoTitles = []
  const seoBrands = []
  let headerBrand = null
  let footerBrand = null

  // Scan all rendered pages (skip utility/system pages — they don't reflect site identity)
  const pages = memoryOutput || new Map()
  for (const [urlPath, html] of pages) {
    if (urlPath === '__404__' || UTILITY_SLUGS.has(urlPath)) continue

    // Collect per-page title
    const title = extractTag(html, 'title')
    if (title) seoTitles.push(title)

    // Collect per-page og:site_name
    const siteName = extractMeta(html, 'og:site_name')
    if (siteName) seoBrands.push(siteName)

    // Extract header/footer brand from first page (homepage)
    if (urlPath === '/' && !headerBrand) {
      headerBrand = extractHeaderBrand(html)
      footerBrand = extractFooterBrand(html)
    }
  }

  return {
    title: config.title || null,
    brandName: config.brandName || config.title || null,
    domain: config.domain || null,
    seoTitles: [...new Set(seoTitles)],
    seoBrands: [...new Set(seoBrands)],
    headerBrand: headerBrand || null,
    footerBrand: footerBrand || null,
  }
}

// ---------------------------------------------------------------------------
// site.md receipt management
// ---------------------------------------------------------------------------

const SITE_MD_BODY = `# sitemd

This project uses [sitemd](https://sitemd.cc) — a markdown-first static site builder.

## Quick Start

\`\`\`bash
sitemd launch    # Start dev server at localhost:4747
sitemd deploy    # Build and deploy to configured target
sitemd status    # Show project overview
sitemd help      # Full command list
\`\`\`

## Project Structure

\`\`\`
sitemd/
  pages/           Markdown pages (one .md per page)
  settings/        Site config (YAML frontmatter in .md files)
  theme/           HTML templates and CSS
  media/           Images and assets
  auth-pages/      Login, signup, forgot-password
  account-pages/   User dashboard
  gated-pages/     Authenticated-only content
  site/            Built output (gitignored)
\`\`\`

## Page Format

Pages are markdown files with YAML frontmatter in \`sitemd/pages/\`. Key fields: \`title\`, \`description\`, \`slug\`, \`groupMember\` (sidebar group), \`sidebarGroupShown\` (which sidebar to display).

## Settings

Non-secret config lives in \`sitemd/settings/*.md\` as YAML frontmatter (meta, build, deploy, header, footer, groups, auth). Secrets (API keys, tokens) live in \`.sitemd/secrets\` — a flat KEY=VALUE file, managed via \`sitemd secret set/list/remove\`.

## Documentation

Full docs at [sitemd.cc/docs](https://sitemd.cc/docs)
`

/** Parse YAML frontmatter from a string. Returns { frontmatter, body }. */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }
  const fm = {}
  for (const line of match[1].split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const val = line.slice(idx + 1).trim()
    fm[key] = val
  }
  return { frontmatter: fm, body: match[2] }
}

/** Serialize frontmatter object + body back to markdown. */
function serializeFrontmatter(fm, body) {
  const lines = ['---']
  if (Object.keys(fm).length === 0) {
    lines.push('# sitemd site identity — do not edit manually')
  } else {
    lines.push('# sitemd activation receipt — do not edit manually')
    for (const [key, val] of Object.entries(fm)) {
      lines.push(`${key}: ${val}`)
    }
  }
  lines.push('---')
  lines.push('')
  return lines.join('\n') + body
}

/**
 * Resolve the project root (one level above the sitemd/ content root).
 * @param {string} root - The sitemd content root (e.g. /project/sitemd/)
 * @returns {string} project root (e.g. /project/)
 */
function projectRoot(root) {
  const parent = path.dirname(root)
  // Guard against binary snapshot paths where dirname yields '/' or the same path
  if (parent === '/' || parent === '.' || parent === root) {
    return process.cwd()
  }
  return parent
}

/**
 * Load the site.md activation receipt.
 * If site.md is missing, regenerates an empty one.
 * @param {string} root - The sitemd content root
 * @returns {{ activated: boolean, siteTitle: string|null, brandName: string|null, email: string|null, activatedAt: string|null }}
 */
function loadSiteReceipt(root) {
  const siteMdPath = path.join(projectRoot(root), 'site.md')

  if (!fs.existsSync(siteMdPath)) {
    regenerateSiteMd(root)
    return { activated: false, siteTitle: null, brandName: null, email: null, activatedAt: null }
  }

  const content = fs.readFileSync(siteMdPath, 'utf-8')
  const { frontmatter } = parseFrontmatter(content)

  const hasReceipt = !!(frontmatter.siteTitle && frontmatter.email && frontmatter.activatedAt)
  return {
    activated: hasReceipt,
    siteTitle: frontmatter.siteTitle || null,
    brandName: frontmatter.brandName || null,
    email: frontmatter.email || null,
    activatedAt: frontmatter.activatedAt || null,
  }
}

/**
 * Write a fresh empty site.md (no activation receipt).
 * @param {string} root - The sitemd content root
 */
function regenerateSiteMd(root) {
  const siteMdPath = path.join(projectRoot(root), 'site.md')
  const content = serializeFrontmatter({}, SITE_MD_BODY)
  fs.writeFileSync(siteMdPath, content, 'utf-8')
}

/**
 * Write activation receipt fields into site.md frontmatter.
 * Preserves the body content.
 * @param {string} root - The sitemd content root
 * @param {{ siteTitle: string, brandName: string, email: string, activatedAt: string }} receipt
 */
function writeSiteReceipt(root, { siteTitle, brandName, email, activatedAt }) {
  const siteMdPath = path.join(projectRoot(root), 'site.md')

  let body = SITE_MD_BODY
  if (fs.existsSync(siteMdPath)) {
    const content = fs.readFileSync(siteMdPath, 'utf-8')
    const parsed = parseFrontmatter(content)
    body = parsed.body
  }

  const fm = { siteTitle, brandName, email, activatedAt }
  fs.writeFileSync(siteMdPath, serializeFrontmatter(fm, body), 'utf-8')
}

module.exports = {
  extractSiteFingerprint,
  loadSiteReceipt,
  regenerateSiteMd,
  writeSiteReceipt,
}
