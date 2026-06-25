/**
 * Email template compiler — builds emails/*.md into site/_emails.json
 *
 * Reads markdown templates from emails/ subdirectories, parses frontmatter,
 * converts markdown body to HTML, and writes a JSON manifest that any
 * backend can consume.
 *
 * Template format:
 *   ---
 *   id: unique-id
 *   from: Optional Sender <email@example.com>
 *   subject: Subject with {{variables}}
 *   ---
 *   Markdown body with {{variables}}
 */

const fs = require('fs')
const path = require('path')

// Minimal markdown → HTML (covers what email templates need)
function md(text) {
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^(?!<[h|a])(.*\S.*)$/gm, '<p>$1</p>')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function parseFrontmatter(content) {
  const match = content.match(/^\s*---[ \t]*\n([\s\S]*?)\n---[ \t]*\n([\s\S]*)$/)
  if (!match) throw new Error('No frontmatter found')
  const meta = {}
  for (const line of match[1].split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    meta[key] = val
  }
  return { meta, body: match[2].trim() }
}

function collectTemplates(emailsDir, defaultFrom) {
  if (!fs.existsSync(emailsDir)) return []

  const templates = []
  for (const sub of fs.readdirSync(emailsDir, { withFileTypes: true })) {
    if (!sub.isDirectory() || sub.name.startsWith('.')) continue
    const subDir = path.join(emailsDir, sub.name)
    for (const file of fs.readdirSync(subDir)) {
      if (!file.endsWith('.md')) continue
      const content = fs.readFileSync(path.join(subDir, file), 'utf-8')
      const { meta, body } = parseFrontmatter(content)

      // Extract variable names from {{var}} patterns
      const vars = [...new Set([
        ...(meta.subject?.match(/\{\{(\w+)\}\}/g) || []),
        ...(body.match(/\{\{(\w+)\}\}/g) || []),
      ])].map(v => v.replace(/[{}]/g, ''))

      templates.push({
        id: meta.id,
        category: sub.name,
        from: meta.from || defaultFrom,
        subject: meta.subject,
        vars,
        html: md(body),
      })
    }
  }
  return templates
}

/**
 * Compile email templates from emails/ into site/_emails.json
 * @param {string} root - Project root directory
 * @param {string} outputDir - Build output directory (e.g. site/)
 * @param {object} config - Loaded site config
 * @returns {number} Number of templates compiled (0 if no emails/ dir)
 */
function compileEmails(root, outputDir, config) {
  const emailsDir = path.join(root, 'emails')
  if (!fs.existsSync(emailsDir)) return 0

  const defaultFrom = config.emailFrom || ''
  const templates = collectTemplates(emailsDir, defaultFrom)
  if (!templates.length) return 0

  const manifest = JSON.stringify(templates, null, 2)
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, '_emails.json'), manifest)

  return templates.length
}

module.exports = { compileEmails }
