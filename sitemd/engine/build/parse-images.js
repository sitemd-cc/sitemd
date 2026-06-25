const crypto = require('crypto');

let _imageGroupCounter = 0;
function resetImageGroupCounter() { _imageGroupCounter = 0; }

// Corner rounding — resolved from per-image +corner:name or global config
const CORNER_VALUES = { none: '0', subtle: '6px', curve: '16px' };

// Self-hosted video extensions — `![alt](/media/foo.mp4)` renders <video>
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogv|mov|m4v)(\?.*)?$/i;
function isVideoUrl(url) {
  return !!url && VIDEO_EXTENSIONS.test(url);
}

function parseImageModifiers(url) {
  let cleanUrl = url;
  const mods = {};

  let changed = true;
  while (changed) {
    changed = false;
    const widthMatch = cleanUrl.match(/\s\+width:(\d+)$/);
    if (widthMatch) { mods.width = parseInt(widthMatch[1]); cleanUrl = cleanUrl.slice(0, -widthMatch[0].length); changed = true; continue; }

    const heightMatch = cleanUrl.match(/\s\+height:(\d+)$/);
    if (heightMatch) { mods.height = parseInt(heightMatch[1]); cleanUrl = cleanUrl.slice(0, -heightMatch[0].length); changed = true; continue; }

    const cropMatch = cleanUrl.match(/\s\+crop:(\d+)x(\d+)$/);
    if (cropMatch) { mods.cropW = parseInt(cropMatch[1]); mods.cropH = parseInt(cropMatch[2]); cleanUrl = cleanUrl.slice(0, -cropMatch[0].length); changed = true; continue; }

    const rotateMatch = cleanUrl.match(/\s\+rotate:([1-3])$/);
    if (rotateMatch) { mods.rotate = parseInt(rotateMatch[1]); cleanUrl = cleanUrl.slice(0, -rotateMatch[0].length); changed = true; continue; }

    const cornerMatch = cleanUrl.match(/\s\+corner:(none|subtle|curve)$/);
    if (cornerMatch) { mods.corner = cornerMatch[1]; cleanUrl = cleanUrl.slice(0, -cornerMatch[0].length); changed = true; continue; }

    if (cleanUrl.endsWith(' +circle')) { mods.circle = true; cleanUrl = cleanUrl.slice(0, -8); changed = true; continue; }
    if (cleanUrl.endsWith(' +square')) { mods.square = true; cleanUrl = cleanUrl.slice(0, -8); changed = true; continue; }
    if (cleanUrl.endsWith(' +rect')) { mods.rect = true; cleanUrl = cleanUrl.slice(0, -6); changed = true; continue; }
    if (cleanUrl.endsWith(' +bw')) { mods.bw = true; cleanUrl = cleanUrl.slice(0, -4); changed = true; continue; }
    if (cleanUrl.endsWith(' +sepia')) { mods.sepia = true; cleanUrl = cleanUrl.slice(0, -7); changed = true; continue; }
    if (cleanUrl.endsWith(' +expand')) { mods.expand = true; cleanUrl = cleanUrl.slice(0, -8); changed = true; continue; }
    if (cleanUrl.endsWith(' +noexpand')) { mods.noexpand = true; cleanUrl = cleanUrl.slice(0, -10); changed = true; continue; }

    // Video-only modifiers
    if (cleanUrl.endsWith(' +autoplay')) { mods.autoplay = true; cleanUrl = cleanUrl.slice(0, -10); changed = true; continue; }
    if (cleanUrl.endsWith(' +muted')) { mods.muted = true; cleanUrl = cleanUrl.slice(0, -7); changed = true; continue; }
    if (cleanUrl.endsWith(' +loop')) { mods.loop = true; cleanUrl = cleanUrl.slice(0, -6); changed = true; continue; }
    if (cleanUrl.endsWith(' +nocontrols')) { mods.nocontrols = true; cleanUrl = cleanUrl.slice(0, -12); changed = true; continue; }
    const posterMatch = cleanUrl.match(/\s\+poster:([^\s]+)$/);
    if (posterMatch) { mods.poster = posterMatch[1]; cleanUrl = cleanUrl.slice(0, -posterMatch[0].length); changed = true; continue; }
  }

  cleanUrl = cleanUrl.trim();
  // Normalize relative paths: "media/..." → "/media/..."
  if (cleanUrl && !cleanUrl.startsWith('/') && !cleanUrl.startsWith('http') && !cleanUrl.startsWith('data:')) {
    cleanUrl = '/' + cleanUrl;
  }
  return { cleanUrl, mods };
}

function buildImageStyle(mods) {
  const styles = [];
  const filters = [];

  if (mods.width) styles.push(`max-width:${mods.width}px`);
  if (mods.height) { styles.push(`height:${mods.height}px`); styles.push('object-fit:cover'); }
  if (mods.cropW && mods.cropH) { styles.push(`width:${mods.cropW}px`); styles.push(`height:${mods.cropH}px`); styles.push('object-fit:cover'); }
  if (mods.circle) { styles.push('border-radius:50%'); styles.push('aspect-ratio:1'); styles.push('object-fit:cover'); }
  if (mods.square) { styles.push('aspect-ratio:1'); styles.push('object-fit:cover'); }
  if (mods.rect) { styles.push('aspect-ratio:3/2'); styles.push('object-fit:cover'); }
  if (mods.corner && CORNER_VALUES[mods.corner] !== undefined) {
    styles.push(`border-radius:${CORNER_VALUES[mods.corner]}`);
  }
  if (mods.bw) filters.push('grayscale(1)');
  if (mods.sepia) filters.push('sepia(1)');
  if (filters.length) styles.push(`filter:${filters.join(' ')}`);

  return styles.length ? ` style="${styles.join(';')}"` : '';
}

function buildRotateWrap(imgHtml, mods) {
  if (!mods.rotate) return imgHtml;
  const deg = mods.rotate * 90;
  return `<div class="img-rotate" data-rotate="${deg}">${imgHtml}</div>`;
}

function buildVideoHtml(alt, cleanUrl, mods) {
  const style = buildImageStyle(mods);
  const attrs = [];
  // autoplay implies muted + playsinline; loop is a sensible default for autoplay
  if (mods.autoplay) {
    attrs.push('autoplay', 'muted', 'loop', 'playsinline');
  } else {
    if (mods.muted) attrs.push('muted');
    if (mods.loop) attrs.push('loop');
    attrs.push('playsinline');
  }
  if (!mods.nocontrols) attrs.push('controls');
  attrs.push('preload="metadata"');
  let posterAttr = '';
  if (mods.poster) {
    let p = mods.poster;
    if (!p.startsWith('/') && !p.startsWith('http') && !p.startsWith('data:')) p = '/media/' + p;
    posterAttr = ` poster="${p}"`;
  }
  const altAttr = alt ? ` aria-label="${alt}"` : '';
  return `<video src="${cleanUrl}" ${attrs.join(' ')}${posterAttr}${altAttr}${style}></video>`;
}

function buildImageHtml(alt, url) {
  const { cleanUrl, mods } = parseImageModifiers(url);

  if (isVideoUrl(cleanUrl)) {
    // Videos don't support lightbox/expand
    return buildRotateWrap(buildVideoHtml(alt, cleanUrl, mods), mods);
  }

  const style = buildImageStyle(mods);
  const img = `<img src="${cleanUrl}" alt="${alt}" loading="lazy"${style}>`;

  let html;
  if (mods.expand) {
    html = `<a class="img-expand" data-lightbox href="${cleanUrl}">${img}</a>`;
  } else {
    html = img;
  }

  return buildRotateWrap(html, mods);
}

function buildImageRowHtml(block) {
  const lines = block.trim().split('\n').filter(l => l.trim());
  const images = [];
  for (const line of lines) {
    const m = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (m) images.push({ alt: m[1], url: m[2] });
  }
  if (images.length === 0) return block;

  const groupId = `row-${++_imageGroupCounter}`;

  const items = images.map(img => {
    const { cleanUrl, mods } = parseImageModifiers(img.url);
    if (isVideoUrl(cleanUrl)) {
      return `<figure class="image-row-item">${buildVideoHtml(img.alt, cleanUrl, mods)}</figure>`;
    }
    const style = buildImageStyle(mods);
    const imgTag = `<img src="${cleanUrl}" alt="${img.alt}" loading="lazy"${style}>`;
    if (mods.expand) {
      return `<figure class="image-row-item"><a class="img-expand" data-lightbox data-lightbox-group="${groupId}" href="${cleanUrl}">${imgTag}</a></figure>`;
    }
    return `<figure class="image-row-item">${imgTag}</figure>`;
  });

  return `<div class="image-row">${items.join('')}</div>\n`;
}

function buildGalleryHtml(block, noexpand, cornerOverride) {
  const lines = block.trim().split('\n').filter(l => l.trim());
  const images = [];
  for (const line of lines) {
    const m = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (m) images.push({ alt: m[1], url: m[2] });
  }
  if (images.length === 0) return block;

  const groupId = `gallery-${++_imageGroupCounter}`;

  const items = images.map(img => {
    const { cleanUrl, mods } = parseImageModifiers(img.url);
    if (isVideoUrl(cleanUrl)) {
      return `<figure class="gallery-item">${buildVideoHtml(img.alt, cleanUrl, mods)}</figure>`;
    }
    const style = buildImageStyle(mods);
    const imgTag = `<img src="${cleanUrl}" alt="${img.alt}" loading="lazy"${style}>`;
    if (noexpand || mods.noexpand) {
      return `<figure class="gallery-item">${imgTag}</figure>`;
    }
    return `<figure class="gallery-item"><a class="img-expand" data-lightbox data-lightbox-group="${groupId}" href="${cleanUrl}">${imgTag}</a></figure>`;
  });

  const classes = ['gallery'];
  if (noexpand) classes.push('gallery-static');
  const cornerStyle = cornerOverride && CORNER_VALUES[cornerOverride] !== undefined
    ? ` style="--gallery-radius:${CORNER_VALUES[cornerOverride]}"`
    : '';
  return `<div class="${classes.join(' ')}"${cornerStyle}>${items.join('')}</div>\n`;
}

module.exports = {
  CORNER_VALUES,
  resetImageGroupCounter,
  parseImageModifiers,
  buildImageStyle,
  buildRotateWrap,
  buildImageHtml,
  buildVideoHtml,
  buildImageRowHtml,
  buildGalleryHtml,
  isVideoUrl,
};
