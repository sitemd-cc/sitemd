const { bold, green, yellow, dim } = require('../ui')

async function runClone(args, root) {
  const url = args[0]
  if (!url) {
    console.error('  Usage: sitemd clone <url> [--max-pages N] [--skip /path1 /path2] [--no-assets]')
    process.exit(1)
  }

  const { clone } = require('../../clone')

  const maxPages = args.includes('--max-pages') ? parseInt(args[args.indexOf('--max-pages') + 1], 10) : 50
  const noAssets = args.includes('--no-assets')
  const skipIdx = args.indexOf('--skip')
  const skipPaths = []
  if (skipIdx !== -1) {
    for (let i = skipIdx + 1; i < args.length; i++) {
      if (args[i].startsWith('--')) break
      skipPaths.push(args[i])
    }
  }

  console.log(`  Cloning ${bold(url)}...`)
  console.log()

  const result = await clone(url, root, { maxPages, skipPaths, includeAssets: !noAssets })

  if (result.error) {
    console.error(`  ${result.message}`)
    process.exit(1)
  }

  // Pretty-print summary to terminal
  console.log(`  ${green('Done!')} Crawled ${result.crawled} pages.`)
  console.log()
  console.log(`  ${bold('Site:')} ${result.site.title || 'Unknown'}`)
  if (result.site.description) console.log(`  ${bold('Description:')} ${result.site.description}`)

  console.log()
  console.log(`  ${bold('Pages extracted:')} ${result.pages.length}`)
  for (const page of result.pages) {
    const conf = Math.round(page.confidence * 100)
    const comps = page.components.length ? ` (${page.components.join(', ')})` : ''
    console.log(`    ${page.slug} — ${page.type}${comps} [${conf}%]`)
  }
  if (result.assets.downloaded) {
    console.log()
    console.log(`  ${bold('Assets:')} ${result.assets.downloaded} downloaded, ${result.assets.skipped} skipped`)
  }
  if (result.warnings.length) {
    console.log()
    console.log(`  ${yellow('Warnings:')}`)
    for (const w of result.warnings) console.log(`    - ${w}`)
  }
  if (result.unmapped.length) {
    console.log()
    console.log(`  ${yellow('Unmapped:')}`)
    for (const u of result.unmapped) console.log(`    - ${u.url}: ${u.reason}`)
  }
  console.log()

  // Also output JSON to stdout if piped
  if (!process.stdout.isTTY) {
    console.log(JSON.stringify(result, null, 2))
  }
}

module.exports = { runClone }
