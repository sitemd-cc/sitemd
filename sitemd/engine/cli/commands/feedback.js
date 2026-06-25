const { green, dim } = require('../ui')

function runFeedback(args, VERSION) {
  const { buildIssueUrl, openInBrowser, collectContext } = require('../feedback')

  const validTypes = ['bug', 'feature', 'question']
  const type = validTypes.includes(args[0]) ? args.shift() : 'question'
  const title = args.join(' ')

  const url = buildIssueUrl({ type, title, body: '' })
  const ctx = collectContext()

  console.log()
  console.log(`  ${green('Opening GitHub issue form...')}`)
  console.log(`  ${dim(`sitemd v${ctx.sitemdVersion} · Node ${ctx.nodeVersion} · ${ctx.os}`)}`)
  console.log()

  openInBrowser(url)
}

module.exports = { runFeedback }
