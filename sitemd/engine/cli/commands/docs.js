const { bold, dim } = require('../ui')

async function runDocs(args) {
  const { fetchDocsIndex, searchDocs, fetchDocPage } = require('../docs')
  const query = args.join(' ').trim()

  try {
    const index = await fetchDocsIndex()

    // No query — list all doc pages
    if (!query) {
      console.log()
      console.log(`  ${bold('sitemd documentation')}`)
      console.log()
      for (const doc of index) {
        console.log(`  ${bold(doc.t)}`)
        console.log(`    ${dim(doc.s)}`)
      }
      console.log()
      console.log(`  ${dim(`${index.length} pages. Run`)} ${bold('sitemd docs <query>')} ${dim('to search.')}`)
      console.log()
      return
    }

    // Exact slug — fetch and display
    if (query.startsWith('/docs/')) {
      try {
        const content = await fetchDocPage(query)
        console.log()
        console.log(content)
        console.log()
      } catch (e) {
        console.error(`  Could not fetch ${query}: ${e.message}`)
        process.exit(1)
      }
      return
    }

    // Keyword search
    const results = searchDocs(index, query)
    if (!results.length) {
      console.log()
      console.log(`  No docs found for "${query}". Run ${bold('sitemd docs')} to see all pages.`)
      console.log()
      return
    }

    // Fetch top result
    const top = results[0]
    try {
      const content = await fetchDocPage(top.s)
      console.log()
      console.log(`  ${bold(top.t)} ${dim(top.s)}`)
      console.log()
      console.log(content)
      console.log()
    } catch (e) {
      // Fall back to search index excerpt
      console.log()
      console.log(`  ${bold(top.t)} ${dim(top.s)}`)
      console.log()
      console.log(top.b || `(Could not fetch full content: ${e.message})`)
      console.log()
    }

    // Show other matches
    if (results.length > 1) {
      console.log(`  ${dim('Also relevant:')}`)
      for (const doc of results.slice(1, 5)) {
        console.log(`    ${doc.t} ${dim(doc.s)}`)
      }
      console.log()
    }
  } catch (e) {
    console.error(`  Could not fetch sitemd docs: ${e.message}`)
    process.exit(1)
  }
}

module.exports = { runDocs }
