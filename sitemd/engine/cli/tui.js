const { dim, bold, cyan } = require('./ui')

const SEP = { label: '', detail: '', action: '', value: '', separator: true }

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

function terminalLines(line) {
  const cols = process.stdout.columns || 80
  const visible = stripAnsi(line).length
  if (visible === 0) return 1
  return Math.ceil(visible / cols)
}

function totalTerminalLines(lines) {
  return lines.reduce((sum, l) => sum + terminalLines(l), 0)
}

function renderRows(rows, selected) {
  const selectableRows = rows.filter(r => !r.separator)
  const labelW = Math.max(...selectableRows.map(r => stripAnsi(r.label).length))
  const lines = []
  let selectIdx = 0
  for (const r of rows) {
    if (r.separator) {
      lines.push('')
      continue
    }
    const isSel = selectIdx === selected
    const pointer = isSel ? cyan('❯') : ' '
    const visibleLen = stripAnsi(r.label).length
    const pad = ' '.repeat(Math.max(0, labelW - visibleLen))
    const label = isSel ? bold(r.label) + pad : r.label + pad
    lines.push(`  ${pointer} ${label}  ${dim(r.detail)}`)
    selectIdx++
  }
  return lines
}

function selectableCount(rows) {
  return rows.filter(r => !r.separator).length
}

function resolveIndex(rows, selectIdx) {
  let count = 0
  for (const r of rows) {
    if (r.separator) continue
    if (count === selectIdx) return r
    count++
  }
  return rows[0]
}

async function interactiveSelect(rows) {
  if (selectableCount(rows) === 0) return null

  if (!process.stdin.isTTY) {
    const lines = renderRows(rows, -1)
    console.log(lines.join('\n'))
    return null
  }

  let selected = 0
  const total = selectableCount(rows)

  process.stdout.write(`  ${dim('↑/↓ navigate  enter select  q quit')}\n`)
  const initialLines = renderRows(rows, selected)
  let prevHeight = totalTerminalLines(initialLines)
  process.stdout.write(initialLines.join('\n') + '\n')

  return new Promise(resolve => {
    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf-8')

    function cleanup() {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
    }

    function redraw() {
      process.stdout.write(`\x1b[${prevHeight}A\x1b[0J`)
      const lines = renderRows(rows, selected)
      prevHeight = totalTerminalLines(lines)
      process.stdout.write(lines.join('\n') + '\n')
    }

    function onData(key) {
      if (key === '\x1b[A') {
        selected = (selected - 1 + total) % total
        redraw()
      } else if (key === '\x1b[B') {
        selected = (selected + 1) % total
        redraw()
      } else if (key === '\r' || key === '\n') {
        cleanup()
        resolve(resolveIndex(rows, selected))
      } else if (key === 'q' || key === '\x1b' || key === '\x03') {
        cleanup()
        resolve(null)
      }
    }

    stdin.on('data', onData)
  })
}

module.exports = { SEP, interactiveSelect, selectableCount }
