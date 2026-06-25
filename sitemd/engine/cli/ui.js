/**
 * Terminal formatting helpers — ANSI colors, status lines, menu rendering.
 * No dependencies.
 */

const hasColor = process.stdout.isTTY && !process.env.NO_COLOR

const c = (code, s) => hasColor ? `\x1b[${code}m${s}\x1b[0m` : s

const dim    = s => c('2', s)
const bold   = s => c('1', s)
const green  = s => c('32', s)
const red    = s => c('31', s)
const yellow = s => c('33', s)
const cyan   = s => c('36', s)

const check = green('✓')
const cross = red('✗')

function header(version) {
  console.log()
  console.log(`  ${bold('sitemd')}${version ? `  ${dim('v' + version)}` : ''}`)
  console.log()
}

function statusLine(label, value) {
  const padded = (label + ':').padEnd(10)
  console.log(`  ${dim(padded)} ${value}`)
}

function menuItem(num, cmd, desc) {
  const n = dim(`${num}.`)
  const c = cmd.padEnd(16)
  console.log(`  ${n} ${bold(c)}${dim(desc)}`)
}

function menuSep() {
  console.log()
}

module.exports = { dim, bold, green, red, yellow, cyan, check, cross, header, statusLine, menuItem, menuSep }
