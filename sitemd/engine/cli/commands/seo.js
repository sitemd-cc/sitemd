const { dim, bold, green, red, yellow, check, cross } = require('../ui')

async function runSeo(args, root) {
  const { runSeoAudit } = require('../../seo/audit')

  const options = {}

  // Parse args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--settings') options.scope = 'settings'
    else if (arg === '--pages') options.scope = 'pages'
    else if (arg.startsWith('/')) options.slugs = [arg]
    else if (!arg.startsWith('-')) options.slugs = [arg.startsWith('/') ? arg : '/' + arg]
  }

  const report = runSeoAudit(root, options)

  // JSON output when piped
  if (!process.stdout.isTTY) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  // Score header
  const score = report.score !== undefined ? report.score : null
  if (score !== null) {
    const color = score >= 80 ? green : score >= 50 ? yellow : red
    console.log(`  ${bold('SEO Score:')} ${color(score + '/100')}`)
    console.log()
  }

  // Site-level checks
  if (report.site && report.site.length > 0) {
    console.log(`  ${bold('Site Settings')}`)
    for (const c of report.site) {
      const icon = c.passed ? check : cross
      const msg = c.passed ? c.message : (c.fix ? `${c.message} — ${dim('Fix: ' + c.fix)}` : c.message)
      console.log(`    ${icon} ${msg}`)
    }
    console.log()
  }

  // Page-level checks
  if (report.pages && report.pages.length > 0) {
    console.log(`  ${bold('Pages')}`)
    for (const page of report.pages) {
      const fails = page.checks.filter(c => !c.passed)
      if (fails.length === 0) {
        console.log(`    ${check} ${green(page.slug)}`)
      } else {
        console.log(`    ${cross} ${bold(page.slug)}`)
        for (const c of fails) {
          const msg = c.fix ? `${c.message} — ${dim('Fix: ' + c.fix)}` : c.message
          console.log(`      ${dim('→')} ${msg}`)
        }
      }
    }
    console.log()
  }

  // Recommendations
  if (report.recommendations && report.recommendations.length > 0) {
    console.log(`  ${bold('Recommendations')}`)
    for (const rec of report.recommendations) {
      console.log(`    ${dim('•')} ${rec}`)
    }
    console.log()
  }
}

module.exports = { runSeo }
