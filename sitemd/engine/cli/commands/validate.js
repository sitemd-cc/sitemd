const { dim, bold, green, red, check, cross } = require('../ui')

async function runValidate(args, root) {
  const { validatePage, validateAllPages } = require('../../build/validate')

  const slug = args[0] || null

  // JSON output when piped
  const jsonMode = !process.stdout.isTTY

  if (slug) {
    // Single page validation
    const target = slug.startsWith('/') ? slug : '/' + slug
    const result = validatePage(root, target)
    if (result.error) {
      if (jsonMode) { console.log(JSON.stringify({ error: result.error })); return }
      console.error(`  ${result.error}`)
      process.exit(1)
    }
    if (jsonMode) { console.log(JSON.stringify(result, null, 2)); return }
    printPageResult(result)
  } else {
    // All pages validation
    const result = validateAllPages(root)
    if (jsonMode) { console.log(JSON.stringify(result, null, 2)); return }

    const totalChecks = result.pages.reduce((sum, p) => sum + p.checks.length, 0)
    const totalFails = result.pages.reduce((sum, p) => sum + p.checks.filter(c => !c.passed).length, 0)

    console.log(`  ${bold(result.pages.length + ' pages')}, ${totalChecks} checks, ${totalFails === 0 ? green('0 issues') : red(totalFails + ' issue' + (totalFails === 1 ? '' : 's'))}`)
    console.log()

    for (const page of result.pages) {
      printPageResult(page)
    }
  }
}

function printPageResult(page) {
  const fails = page.checks.filter(c => !c.passed)
  if (fails.length === 0) {
    console.log(`  ${check} ${green(page.slug)} ${dim(`(${page.contentType})`)}`)
  } else {
    console.log(`  ${cross} ${bold(page.slug)} ${dim(`(${page.contentType})`)}`)
    for (const c of fails) {
      console.log(`    ${dim('→')} ${c.message}`)
    }
  }
}

module.exports = { runValidate }
