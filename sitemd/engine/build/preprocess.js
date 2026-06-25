const { parseLinkEntry, buildBtnHtml, buildEmbedHtml, buildCardGridHtml, buildImageHtml, buildImageRowHtml, buildGalleryHtml, buildAuthorHtml } = require('./parse');
const { parseFormBlock, buildFormHtml } = require('./premium/form');
const { parseDataBlock, buildDataHtml } = require('./premium/data');
const { parseModalBlock, buildModalHtml } = require('./modal');

// ---------------------------------------------------------------------------
// Component preprocessing pipeline
// ---------------------------------------------------------------------------
// Transforms the raw markdown body through a series of regex replacements for
// sitemd components (buttons, cards, embeds, images, forms, gated sections,
// etc.). Called from build() before passing body to marked().
//
// Returns { body, codeBlocks } — codeBlocks is needed for post-restore but
// the restore step is included here, so callers get back a ready-to-render body.
// ---------------------------------------------------------------------------
function preprocessBody(body, config) {
  // Protect fenced code blocks from pre-processing
  const codeBlocks = [];
  body = body.replace(/^(`{3,})[^\n]*\n[\s\S]*?\n\1$/gm, (m) => {
    codeBlocks.push(m);
    return `\x00CODE${codeBlocks.length - 1}\x00`;
  });

  // Pre-process: inline anchors {#id} → <div id="..."></div>
  body = body.replace(/^\{#([a-z0-9][a-z0-9-]*)\}$/gm, '<div id="$1"></div>\n');

  // Pre-process: [text]{tooltip} → inline tooltip HTML
  let tooltipCounter = 0;
  body = body.replace(/\[([^\]]+)\]\{([^}]+)\}/g, (_, trigger, content) => {
    const id = 'tt-' + (++tooltipCounter);
    return `<span class="tooltip" tabindex="0" aria-describedby="${id}"><span class="tooltip-trigger">${trigger}</span><span class="tooltip-content" role="tooltip" id="${id}">${content}</span></span>`;
  });

  // Pre-process: modal: block → hidden modal overlay HTML (inner content left raw for subsequent passes)
  body = body.replace(/^modal:\s+(\S+)\s*\n((?:(?:[ \t]+.+|[ \t]*)\n)*(?:[ \t]+.+))\n?/gm, (_, id, block) => {
    const modalDef = parseModalBlock(id, block);
    return buildModalHtml(modalDef);
  });

  // Pre-process: consecutive "button:" lines → grouped button rows
  body = body.replace(/(?:^button:\s+.+$\n?)+/gm, (block) => {
    const lines = block.trim().split('\n');
    const buttons = [];
    let hasBig = false;
    for (const line of lines) {
      const rest = line.replace(/^button:\s+/, '');
      const parsed = parseLinkEntry(rest);
      if (!parsed) continue;
      if (parsed.size === 'big') hasBig = true;
      buttons.push(buildBtnHtml(parsed));
    }
    if (buttons.length === 0) return block;
    const rowCls = hasBig ? 'btn-row btn-row-lg' : 'btn-row';
    return `<div class="${rowCls}">${buttons.join('')}</div>\n`;
  });

  // Pre-process: consecutive "card:" / "card-*:" blocks → card grid
  body = body.replace(/(?:^(?:card(?:-(?:text|image|icon|link))?):\s+.+$\n?(?:\n(?=card(?:-(?:text|image|icon|link))?:\s))?)+/gm, (block) => {
    return buildCardGridHtml(block);
  });

  // Pre-process: consecutive "author:" / "author-*:" blocks → author cards
  body = body.replace(/(?:^(?:author(?:-(?:image|role|bio|link))?):\s+.+$\n?(?:\n(?=author(?:-(?:image|role|bio|link))?:\s))?)+/gm, (block) => {
    return buildAuthorHtml(block);
  });

  // Pre-process: embed: URL → responsive iframe
  body = body.replace(/^embed:\s+(\S+)$/gm, (_, url) => buildEmbedHtml(url));

  // Pre-process: gallery: block → gallery grid
  body = body.replace(/^gallery((?:\s+\+(?:noexpand|corner:(?:none|subtle|curve)))*)\s*:\s*\n((?:[ \t]+!\[[^\]]*\]\([^)]+\)[ \t]*\n?)+)/gm, (_, flags, block) => {
    const noexpand = /\+noexpand/.test(flags);
    const cornerMatch = flags && flags.match(/\+corner:(none|subtle|curve)/);
    return buildGalleryHtml(block, noexpand, cornerMatch ? cornerMatch[1] : null);
  });

  // Pre-process: image-row: block → flexbox row
  body = body.replace(/^image-row:\s*\n((?:[ \t]+!\[[^\]]*\]\([^)]+\)[ \t]*\n?)+)/gm, (_, block) => {
    return buildImageRowHtml(block);
  });

  // Pre-process: markdown images with +modifiers → custom <img> HTML
  body = body.replace(/!\[([^\]]*)\]\(([^)]*\s\+[^)]+)\)/g, (_, alt, url) => {
    return buildImageHtml(alt, url);
  });

  // Pre-process: form: block → rendered form HTML
  body = body.replace(/^form:\s*\n((?:[ \t]+.+\n?)+)/gm, (_, block) => {
    const lines = block.split('\n').filter(l => l.trim());
    const minIndent = Math.min(...lines.map(l => l.match(/^(\s*)/)[1].length));
    const deindented = lines.map(l => l.slice(minIndent)).join('\n');
    return buildFormHtml(parseFormBlock(deindented), config);
  });

  // Pre-process: gated: ... / /gated fences → wrapped divs
  body = body.replace(
    /^gated:\s*(.+)\n([\s\S]*?)^\/gated$/gm,
    (_, types, content) => {
      const typeList = types.split(',').map(s => s.trim()).filter(Boolean).join(',');
      return `<div data-gated="${typeList}" class="gated-section" style="display:none">\n\n${content}\n\n</div>\n`;
    }
  );

  // Pre-process: consecutive data:/data-*: lines → data placeholder HTML
  body = body.replace(/(?:^data(?:-[\w]+)?:\s+.+$\n?)+/gm, (block) => {
    const dataDef = parseDataBlock(block);
    if (!dataDef.source) return block;
    return buildDataHtml(dataDef, config);
  });

  // Pre-process: hidden: / /hidden → sr-only wrapped div
  body = body.replace(
    /^hidden:\s*\n([\s\S]*?)^\/hidden$/gm,
    (_, content) => `<div class="sr-only">\n\n${content}\n\n</div>\n`
  );

  // Pre-process: center: / right: / left: alignment fences → wrapped divs
  body = body.replace(
    /^(center|right|left):\s*\n([\s\S]*?)^\/\1$/gm,
    (_, align, content) => `<div class="align-${align}">\n\n${content}\n\n</div>\n`
  );

  // Pre-process: mobile: / desktop: device-variant fences → wrapped divs
  body = body.replace(
    /^(mobile|desktop):\s*\n([\s\S]*?)^\/\1$/gm,
    (_, device, content) => `<div class="device-only device-${device}">\n\n${content}\n\n</div>\n`
  );

  // Restore fenced code blocks
  body = body.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[i]);

  // Pre-process: \n (literal backslash-n) → <br> line break
  body = body.replace(/\\n/g, '<br>');

  return body;
}

module.exports = { preprocessBody };
