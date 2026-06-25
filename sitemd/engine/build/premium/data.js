// ---------------------------------------------------------------------------
// Data component — parser + HTML builder
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Data block parser — parses consecutive data:/data-*: lines into a definition
// Input: block of lines like "data: source-name\ndata-display: cards\n..."
// ---------------------------------------------------------------------------
function parseDataBlock(block) {
  const lines = block.trim().split('\n').filter(l => l.trim());
  const def = {
    source: '',
    display: 'cards',
    filter: '',
    sort: '',
    limit: 0,
    paginate: false,
    auth: '',
    param: '',
    key: '',
    // Card/list map slots
    title: '',
    text: '',
    image: '',
    link: '',
    // Table/detail fields: [{label, template}]
    fields: [],
    // Detail mode: 'modal' or '' (page navigation)
    detail: '',
    // Detail fields shown in modal: [{label, template}]
    detailFields: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^data:\s+/.test(trimmed)) {
      def.source = trimmed.replace(/^data:\s+/, '').trim();
    } else if (/^data-display:\s+/.test(trimmed)) {
      def.display = trimmed.replace(/^data-display:\s+/, '').trim();
    } else if (/^data-filter:\s+/.test(trimmed)) {
      def.filter = trimmed.replace(/^data-filter:\s+/, '').trim();
    } else if (/^data-sort:\s+/.test(trimmed)) {
      def.sort = trimmed.replace(/^data-sort:\s+/, '').trim();
    } else if (/^data-limit:\s+/.test(trimmed)) {
      def.limit = parseInt(trimmed.replace(/^data-limit:\s+/, '').trim(), 10) || 0;
    } else if (/^data-paginate:\s+/.test(trimmed)) {
      def.paginate = trimmed.replace(/^data-paginate:\s+/, '').trim() === 'true';
    } else if (/^data-auth:\s+/.test(trimmed)) {
      def.auth = trimmed.replace(/^data-auth:\s+/, '').trim();
    } else if (/^data-param:\s+/.test(trimmed)) {
      def.param = trimmed.replace(/^data-param:\s+/, '').trim();
    } else if (/^data-key:\s+/.test(trimmed)) {
      def.key = trimmed.replace(/^data-key:\s+/, '').trim();
    } else if (/^data-title:\s+/.test(trimmed)) {
      def.title = trimmed.replace(/^data-title:\s+/, '').trim();
    } else if (/^data-text:\s+/.test(trimmed)) {
      def.text = trimmed.replace(/^data-text:\s+/, '').trim();
    } else if (/^data-image:\s+/.test(trimmed)) {
      def.image = trimmed.replace(/^data-image:\s+/, '').trim();
    } else if (/^data-link:\s+/.test(trimmed)) {
      def.link = trimmed.replace(/^data-link:\s+/, '').trim();
    } else if (/^data-detail:\s+/.test(trimmed)) {
      def.detail = trimmed.replace(/^data-detail:\s+/, '').trim();
    } else if (/^data-detail-field:\s+/.test(trimmed)) {
      const val = trimmed.replace(/^data-detail-field:\s+/, '').trim();
      const colonIdx = val.indexOf(':');
      if (colonIdx !== -1) {
        def.detailFields.push({
          label: val.slice(0, colonIdx).trim(),
          template: val.slice(colonIdx + 1).trim(),
        });
      }
    } else if (/^data-field:\s+/.test(trimmed)) {
      const val = trimmed.replace(/^data-field:\s+/, '').trim();
      const colonIdx = val.indexOf(':');
      if (colonIdx !== -1) {
        def.fields.push({
          label: val.slice(0, colonIdx).trim(),
          template: val.slice(colonIdx + 1).trim(),
        });
      }
    }
  }

  return def;
}

// ---------------------------------------------------------------------------
// HTML builder — generates placeholder div with data-* attributes
// ---------------------------------------------------------------------------
function buildDataHtml(dataDef, config) {
  const attrs = [];
  attrs.push(`data-source="${esc(dataDef.source)}"`);
  attrs.push(`data-display="${esc(dataDef.display)}"`);

  // Build map object based on display mode
  const map = {};
  if (dataDef.display === 'table' || dataDef.display === 'detail') {
    // Fields array → map is serialized as fields
    if (dataDef.fields.length > 0) {
      attrs.push(`data-fields='${esc(JSON.stringify(dataDef.fields))}'`);
    }
  } else {
    // Cards/list use named slots
    if (dataDef.title) map.title = dataDef.title;
    if (dataDef.text) map.text = dataDef.text;
    if (dataDef.image) map.image = dataDef.image;
    if (dataDef.link) map.link = dataDef.link;
    if (Object.keys(map).length > 0) {
      attrs.push(`data-map='${esc(JSON.stringify(map))}'`);
    }
  }

  // Table/detail can also have a link
  if ((dataDef.display === 'table' || dataDef.display === 'detail') && dataDef.link) {
    attrs.push(`data-link="${esc(dataDef.link)}"`);
  }

  if (dataDef.filter) attrs.push(`data-filter="${esc(dataDef.filter)}"`);
  if (dataDef.sort) attrs.push(`data-sort="${esc(dataDef.sort)}"`);
  if (dataDef.limit) attrs.push(`data-limit="${dataDef.limit}"`);
  if (dataDef.paginate) attrs.push(`data-paginate="true"`);
  if (dataDef.auth) attrs.push(`data-auth="${esc(dataDef.auth)}"`);
  if (dataDef.param) attrs.push(`data-param="${esc(dataDef.param)}"`);
  if (dataDef.key) attrs.push(`data-key="${esc(dataDef.key)}"`);
  if (dataDef.detail) attrs.push(`data-detail="${esc(dataDef.detail)}"`);
  if (dataDef.detailFields.length > 0) {
    attrs.push(`data-detail-fields='${esc(JSON.stringify(dataDef.detailFields))}'`);
  }

  const loadingText = (config && config.dataLoadingText) || 'Loading...';
  const emptyText = (config && config.dataEmptyText) || 'No items found.';

  return `<div class="sitemd-data" ${attrs.join(' ')}>\n` +
    `  <div class="sitemd-data-loading">${esc(loadingText)}</div>\n` +
    `  <div class="sitemd-data-error" hidden></div>\n` +
    `  <div class="sitemd-data-empty" hidden>${esc(emptyText)}</div>\n` +
    `  <div class="sitemd-data-content"></div>\n` +
    `  <div class="sitemd-data-pagination" hidden></div>\n` +
    `</div>\n`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { parseDataBlock, buildDataHtml };
