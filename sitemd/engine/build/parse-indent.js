// Normalize over-indented YAML-ish input to canonical 2-space.
// sitemd's hand-rolled settings parsers (parseGroups, parseNavItems,
// parseFormBlock) hardcode exact indent widths for nesting. The canonical
// style is 2-space, but users and LLMs reasonably produce 4-space (or
// list markers indented at 4 with properties at 6, etc.). Rather than
// rewriting every depth-sensitive regex, we pre-normalize input.
//
// Detection: scan non-empty, non-comment lines. Find the minimum non-zero
// leading-space count. If it's > 2 and the difference is even, subtract
// (min - 2) from every indented line. Top-level (zero-indent) lines and
// blanks/comments are untouched. Idempotent: a 2-space file has min=2 →
// shift=0 → returns input unchanged.
function normalizeIndent(raw) {
  if (!raw) return raw;
  const lines = raw.split('\n');
  let minIndent = Infinity;
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^( +)/);
    if (!m) continue;
    if (m[1].length < minIndent) minIndent = m[1].length;
  }
  if (minIndent === Infinity) return raw;
  const shift = minIndent - 2;
  if (shift <= 0 || shift % 2 !== 0) return raw;
  return lines
    .map(l => {
      const m = l.match(/^( +)(.*)$/);
      if (!m) return l;
      const newLen = Math.max(0, m[1].length - shift);
      return ' '.repeat(newLen) + m[2];
    })
    .join('\n');
}

module.exports = { normalizeIndent };
