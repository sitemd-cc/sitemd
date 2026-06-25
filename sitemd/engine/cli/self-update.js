const { bold, green, cyan, dim } = require('./ui')

async function selfUpdate(root, version) {
  console.log(`  To update to v${version}:`)
  console.log()
  console.log(`    ${cyan('npm update -g @sitemd-cc/sitemd')}`)
  console.log()
  console.log(`  Then run ${bold('sitemd update')} in your project to migrate any settings.`)
  console.log()
}

module.exports = { selfUpdate }
