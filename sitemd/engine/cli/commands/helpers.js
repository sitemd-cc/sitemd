const fs = require('fs')
const path = require('path')
const readline = require('readline')

function getPkgRoot(sourceModePkgRoot) {
  return sourceModePkgRoot
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.name === '.DS_Store' || entry.name.startsWith('._')) continue
    if (entry.name === 'node_modules' || entry.name === '.sitemd') continue
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

module.exports = { copyDirRecursive, ask, getPkgRoot }
