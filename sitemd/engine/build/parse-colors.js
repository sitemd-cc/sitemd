// Shared color palette state — used by parse.js, parse-links.js, parse-cards.js
let _palette = {};

function setPalette(palette) {
  _palette = palette;
}

function resolveColor(raw) {
  if (raw === 'accent') return 'var(--color-accent)';
  return raw.startsWith('#') ? raw : (_palette[raw] || raw);
}

module.exports = { setPalette, resolveColor };
