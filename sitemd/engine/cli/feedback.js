/**
 * Feedback — build pre-filled GitHub issue URLs with environment context.
 */

const os = require('os')
const { execFile } = require('child_process')

const FEEDBACK_REPO = 'sitemd-cc/sitemd'
const ISSUE_URL = `https://github.com/${FEEDBACK_REPO}/issues/new`

const VERSION = (() => {
  try { return require('../../package.json').version } catch { return 'unknown' }
})()

function collectContext() {
  return {
    sitemdVersion: VERSION,
    nodeVersion: process.version,
    os: `${os.platform()} ${os.release()} (${os.arch()})`,
  }
}

function buildIssueUrl({ type, title, body }) {
  const ctx = collectContext()

  const labels = type === 'bug' ? 'bug' : type === 'feature' ? 'enhancement' : ''

  const envBlock = [
    '### Environment',
    `- sitemd: v${ctx.sitemdVersion}`,
    `- Node: ${ctx.nodeVersion}`,
    `- OS: ${ctx.os}`,
  ].join('\n')

  const fullBody = body ? `${body}\n\n${envBlock}` : envBlock

  const params = new URLSearchParams()
  if (title) params.set('title', title)
  if (labels) params.set('labels', labels)
  params.set('body', fullBody)

  return `${ISSUE_URL}?${params.toString()}`
}

function openInBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open'
  execFile(cmd, [url])
}

module.exports = { collectContext, buildIssueUrl, openInBrowser }
