const crypto = require('crypto');
const { marked } = require('./lib/marked.min.js');
const { resolveColor } = require('./parse-colors');
const { resolveIcon } = require('./icons.js');
const { parseLinkEntry, buildLinkAttrs } = require('./parse-links');
const { buildEmbedHtml } = require('./parse-embeds');
const { parseImageModifiers, buildImageStyle } = require('./parse-images');

// Card auto-image queue
const _pendingCardImages = [];
let _currentSourceFile = null;

function setCardSourceFile(filePath) { _currentSourceFile = filePath; }
function getPendingCardImages() { return _pendingCardImages; }
function clearPendingCardImages() { _pendingCardImages.length = 0; }

function buildCardGridHtml(block) {
  const lines = block.trim().split('\n').filter(l => l.trim() !== '');
  const cards = [];
  let current = null;

  for (const line of lines) {
    if (/^card:\s+/.test(line)) {
      if (current) cards.push(current);
      current = { title: line.replace(/^card:\s+/, '').trim() };
    } else if (/^card-text:\s+/.test(line) && current) {
      current.text = line.replace(/^card-text:\s+/, '').trim();
    } else if (/^card-image:\s+/.test(line) && current) {
      if (!current.images) current.images = [];
      current.images.push(line.replace(/^card-image:\s+/, '').trim());
    } else if (/^card-icon:\s+/.test(line) && current) {
      current.icon = line.replace(/^card-icon:\s+/, '').trim();
    } else if (/^card-link:\s+/.test(line) && current) {
      current.linkRaw = line.replace(/^card-link:\s+/, '').trim();
    }
  }
  if (current) cards.push(current);
  if (cards.length === 0) return block;

  // Parse +banner modifier from card titles
  for (const card of cards) {
    if (/\s\+banner$/.test(card.title)) {
      card.banner = true;
      card.title = card.title.replace(/\s\+banner$/, '');
    }
  }

  const cardHtmls = cards.map(card => {
    // Per-card auto-image: card-image: auto-color or auto-photo with optional modifiers
    if (card.images && card.images.length === 1 && /^auto-(color|photo)\b/.test(card.images[0])) {
      const raw = card.images[0];
      const mode = raw.startsWith('auto-color') ? 'auto-color' : 'auto-photo';
      let color = null, prompt = null;
      const colorMatch = raw.match(/\+color:([#\w]+)/);
      if (colorMatch) color = colorMatch[1];
      const promptMatch = raw.match(/\+prompt:(.+)$/);
      if (promptMatch) prompt = promptMatch[1].trim();
      const modifier = color || prompt || '';
      const hash = crypto.createHash('md5').update(mode + ':' + card.title + ':' + modifier).digest('hex').slice(0, 8);
      const slug = card.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'card';
      const filename = `${slug}-${hash}`;
      card.images = [`/media/content/cards/${filename}.png`];
      _pendingCardImages.push({ title: card.title, text: card.text || '', filename, mode, color, prompt, rawLine: raw, sourceFile: _currentSourceFile });
    }

    const parts = [];
    if (card.icon) {
      // Icon takes precedence over image — parse optional +color: modifier
      let iconName = card.icon;
      let iconColor = '';
      const cm = iconName.match(/\s?\+color:(#[0-9a-fA-F]{3,6}|[a-z]+)$/);
      if (cm) {
        iconColor = resolveColor(cm[1]);
        iconName = iconName.slice(0, -cm[0].length).trim();
      }
      const svg = resolveIcon(iconName);
      if (svg) {
        const colorStyle = iconColor ? ` style="color:${iconColor}"` : '';
        parts.push(`<div class="card-icon-wrap"${colorStyle}>${svg}</div>`);
      }
    } else if (card.images && card.images.length > 0) {
      if (card.images.length === 1) {
        const { cleanUrl: imgUrl, mods: imgMods } = parseImageModifiers(card.images[0]);
        const imgStyle = buildImageStyle(imgMods);
        parts.push(`<img src="${imgUrl}" alt="${card.title}" loading="lazy" class="card-image"${imgStyle}>`);
      } else {
        const slides = card.images.map((raw, i) => {
          const { cleanUrl: imgUrl, mods: imgMods } = parseImageModifiers(raw);
          const imgStyle = buildImageStyle(imgMods);
          const activeCls = i === 0 ? ' card-carousel-slide--active' : '';
          return `<div class="card-carousel-slide${activeCls}"><img src="${imgUrl}" alt="${card.title}" loading="lazy" class="card-image"${imgStyle}></div>`;
        }).join('');
        const dots = card.images.map((_, i) => {
          const activeCls = i === 0 ? ' card-carousel-dot--active' : '';
          return `<button class="card-carousel-dot${activeCls}" data-index="${i}" aria-label="Slide ${i + 1}"></button>`;
        }).join('');
        parts.push(
          `<div class="card-carousel" data-carousel>` +
            `<div class="card-carousel-track">${slides}</div>` +
            `<button class="card-carousel-prev" aria-label="Previous">&lsaquo;</button>` +
            `<button class="card-carousel-next" aria-label="Next">&rsaquo;</button>` +
            `<div class="card-carousel-dots">${dots}</div>` +
          `</div>`
        );
      }
    }
    parts.push(`<div class="card-body">`);
    parts.push(`<h3 class="card-title">${marked.parseInline(card.title).replace(/\\n/g, '<br>')}</h3>`);
    if (card.text) {
      parts.push(`<p class="card-text">${marked.parseInline(card.text).replace(/\\n/g, '<br>')}</p>`);
    }
    let cardHref = null;
    let cardAttrs = '';
    if (card.linkRaw) {
      const bare = /^(\/|https?:\/\/|#|mailto:)/.test(card.linkRaw);
      const parsed = parseLinkEntry(bare ? `_: ${card.linkRaw}` : card.linkRaw);
      if (parsed) {
        cardHref = parsed.slug;
        cardAttrs = buildLinkAttrs(parsed);
        if (!bare) {
          parts.push(`<a href="${parsed.slug}" class="card-link"${cardAttrs}>${parsed.label} &rarr;</a>`);
        }
      }
    }
    parts.push(`</div>`);
    const bannerCls = card.banner ? ' card--banner' : '';
    if (cardHref) {
      parts.push(`<a href="${cardHref}" class="card-overlay-link"${cardAttrs}></a>`);
      return { html: `<div class="card card-clickable${bannerCls}">${parts.join('')}</div>`, banner: !!card.banner };
    }
    return { html: `<div class="card${bannerCls}">${parts.join('')}</div>`, banner: !!card.banner };
  });

  // Split into segments: consecutive non-banner cards go in a grid, banner cards are standalone
  const output = [];
  let gridBuf = [];
  for (const item of cardHtmls) {
    if (item.banner) {
      if (gridBuf.length) { output.push(`<div class="card-grid">${gridBuf.join('')}</div>`); gridBuf = []; }
      output.push(item.html);
    } else {
      gridBuf.push(item.html);
    }
  }
  if (gridBuf.length) output.push(`<div class="card-grid">${gridBuf.join('')}</div>`);
  return output.join('\n') + '\n';
}

module.exports = {
  setCardSourceFile,
  getPendingCardImages,
  clearPendingCardImages,
  buildCardGridHtml,
};
