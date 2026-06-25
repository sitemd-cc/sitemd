const { resolveColor } = require('./parse-colors');
const { resolveIcon } = require('./icons.js');

function parseLinkEntry(str) {
  // "Label: /slug", "Label: https://...", or "Label: #anchor"
  const httpIdx = str.indexOf(': https://');
  const httpxIdx = str.indexOf(': http://');
  const slashIdx = str.indexOf(': /');
  const hashIdx = str.indexOf(': #');
  const mailtoIdx = str.indexOf(': mailto:');

  let colonIdx = -1;
  if (slashIdx !== -1) colonIdx = slashIdx;
  if (httpIdx !== -1 && (colonIdx === -1 || httpIdx < colonIdx)) colonIdx = httpIdx;
  if (httpxIdx !== -1 && (colonIdx === -1 || httpxIdx < colonIdx)) colonIdx = httpxIdx;
  if (hashIdx !== -1 && (colonIdx === -1 || hashIdx < colonIdx)) colonIdx = hashIdx;
  if (mailtoIdx !== -1 && (colonIdx === -1 || mailtoIdx < colonIdx)) colonIdx = mailtoIdx;

  // Support "Label: none" and "Label: silent" as non-link targets
  const noneIdx = str.indexOf(': none');
  if (noneIdx !== -1 && (colonIdx === -1 || noneIdx < colonIdx)) colonIdx = noneIdx;
  const silentIdx = str.indexOf(': silent');
  if (silentIdx !== -1 && (colonIdx === -1 || silentIdx < colonIdx)) colonIdx = silentIdx;

  // Detect bare email addresses: "Label: user@example.com"
  if (colonIdx === -1) {
    const emailMatch = str.match(/^(.+?):\s+([^\s@]+@[^\s@]+\.[^\s@]+)$/);
    if (emailMatch) {
      return { label: emailMatch[1].trim(), slug: 'mailto:' + emailMatch[2].trim() };
    }
    return null;
  }

  let slug = str.slice(colonIdx + 2).trim();
  let target = null;
  let variant = null;
  let color = null;
  let size = null;
  let icon = null;
  let iconPos = null;

  // Extract +modifiers from end of slug (order-independent, space before + is optional)
  let changed = true;
  while (changed) {
    changed = false;
    let m;
    if ((m = slug.match(/\s?\+newtab$/))) {
      slug = slug.slice(0, -m[0].length).trim();
      target = '_blank';
      changed = true;
    } else if ((m = slug.match(/\s?\+sametab$/))) {
      slug = slug.slice(0, -m[0].length).trim();
      target = '_self';
      changed = true;
    } else if ((m = slug.match(/\s?\+outline$/))) {
      slug = slug.slice(0, -m[0].length).trim();
      variant = 'outline';
      changed = true;
    } else if ((m = slug.match(/\s?\+big$/))) {
      slug = slug.slice(0, -m[0].length).trim();
      size = 'big';
      changed = true;
    } else if ((m = slug.match(/\s?\+color:(#[0-9a-fA-F]{3,6}|[a-z]+)$/))) {
      color = resolveColor(m[1]);
      slug = slug.slice(0, -m[0].length).trim();
      changed = true;
    } else if ((m = slug.match(/\s?\+icon-left:([a-z0-9-]+)$/))) {
      icon = m[1];
      iconPos = 'left';
      slug = slug.slice(0, -m[0].length).trim();
      changed = true;
    } else if ((m = slug.match(/\s?\+icon-right:([a-z0-9-]+)$/))) {
      icon = m[1];
      iconPos = 'right';
      slug = slug.slice(0, -m[0].length).trim();
      changed = true;
    } else if ((m = slug.match(/\s?\+icon:([a-z0-9-]+)$/))) {
      icon = m[1];
      iconPos = 'left';
      slug = slug.slice(0, -m[0].length).trim();
      changed = true;
    }
  }

  return {
    label: str.slice(0, colonIdx).trim(),
    slug,
    target,
    variant,
    color,
    size,
    icon,
    iconPos,
  };
}

// Build HTML attributes for link target behavior
function buildLinkAttrs(link) {
  const t = link.target;
  if (t === '_blank') return ' target="_blank" rel="noopener noreferrer"';
  if (t === '_self') return '';
  // Auto: external links open in new window
  if (link.slug && link.slug.startsWith('http')) return ' target="_blank" rel="noopener noreferrer"';
  return '';
}

// Build button HTML — renders as <span> for none/silent targets, <a> otherwise
function buildBtnHtml(item) {
  const cls = item.variant === 'outline' ? 'btn btn-outline' : 'btn';
  const style = item.color ? ` style="--btn-bg:${item.color};--btn-bg-hover:${item.color}"` : '';
  const slug = (item.slug || '').split(' ')[0]; // strip any leftover modifiers

  // Build inner content with optional icon
  let inner = item.label;
  if (item.icon) {
    const svg = resolveIcon(item.icon);
    if (svg) {
      const iconLeft = `<span class="btn-icon btn-icon-left">${svg}</span>`;
      const iconRight = `<span class="btn-icon btn-icon-right">${svg}</span>`;
      inner = item.iconPos === 'right'
        ? `${item.label}${iconRight}`
        : `${iconLeft}${item.label}`;
    }
  }

  if (slug === 'none') {
    return `<span class="${cls} btn-none"${style}>${inner}</span>`;
  }
  if (slug === 'silent') {
    return `<span class="${cls} btn-silent"${style}>${inner}</span>`;
  }
  return `<a href="${item.slug}" class="${cls}"${style}${buildLinkAttrs(item)}>${inner}</a>`;
}

module.exports = { parseLinkEntry, buildLinkAttrs, buildBtnHtml };
