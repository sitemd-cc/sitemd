// ---------------------------------------------------------------------------
// Form component — parser + HTML builder
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Country list (ISO 3166-1 common names)
// ---------------------------------------------------------------------------
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda',
  'Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain',
  'Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia',
  'Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso',
  'Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic',
  'Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba',
  'Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia',
  'Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia',
  'Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau',
  'Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq',
  'Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan',
  'Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon',
  'Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar',
  'Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania',
  'Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro',
  'Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands',
  'New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia',
  'Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea',
  'Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia',
  'Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines',
  'Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia',
  'Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands',
  'Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan',
  'Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania',
  'Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey',
  'Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom',
  'United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela',
  'Vietnam','Yemen','Zambia','Zimbabwe',
];

// Form counter — ensures unique IDs when multiple forms exist on one page
let _formCounter = 0;
function resetFormCounter() { _formCounter = 0; }

// ---------------------------------------------------------------------------
// Form block parser — parses YAML-like text into a form definition
// Input: plain text lines (no frontmatter delimiters, no leading indent)
// ---------------------------------------------------------------------------
const { normalizeIndent } = require('../parse-indent');

function parseFormBlock(text) {
  const lines = normalizeIndent(text).split('\n');
  const def = {
    webhook: '',
    thankYou: '',
    redirectUrl: '',
    submitLabel: '',
    fields: [],
    pages: [],
  };

  let context = 'top';
  let currentField = null;
  let currentPage = null;
  let inOptions = false;
  let inNext = false;
  let inShowWhenAny = false;
  let inShowWhenAll = false;
  let inPageFields = false;

  function finalizeField() {
    if (!currentField) return;
    if (inPageFields && currentPage) {
      currentPage.fields.push(currentField);
    } else if (context === 'fields' || context === 'top') {
      def.fields.push(currentField);
    }
    currentField = null;
    inOptions = false;
    inShowWhenAny = false;
    inShowWhenAll = false;
  }

  function finalizePage() {
    finalizeField();
    if (currentPage) {
      def.pages.push(currentPage);
      currentPage = null;
      inPageFields = false;
      inNext = false;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Top-level keys
    if (/^webhook\s*:/.test(line)) {
      def.webhook = line.replace(/^webhook\s*:\s*/, '').trim();
      continue;
    }
    if (/^thankYou\s*:/.test(line)) {
      def.thankYou = line.replace(/^thankYou\s*:\s*/, '').trim();
      continue;
    }
    if (/^redirectUrl\s*:/.test(line)) {
      def.redirectUrl = line.replace(/^redirectUrl\s*:\s*/, '').trim();
      continue;
    }
    if (/^submitLabel\s*:/.test(line)) {
      def.submitLabel = line.replace(/^submitLabel\s*:\s*/, '').trim();
      continue;
    }

    // Fields key (single-page)
    if (/^fields\s*:/.test(line)) {
      context = 'fields';
      inPageFields = false;
      continue;
    }

    // Pages key (multi-page)
    if (/^pages\s*:/.test(line)) {
      context = 'pages';
      continue;
    }

    // --- Multi-page: page-level entries (2-space indent) ---
    if (context === 'pages') {
      if (/^  - id\s*:/.test(line)) {
        finalizePage();
        currentPage = {
          id: line.replace(/^  - id\s*:\s*/, '').trim(),
          title: '',
          fields: [],
          next: [],
        };
        inPageFields = false;
        inNext = false;
        continue;
      }

      if (/^\s{4}title\s*:/.test(line) && currentPage && !inPageFields) {
        currentPage.title = line.replace(/^\s+title\s*:\s*/, '').trim();
        continue;
      }

      if (/^\s{4}fields\s*:/.test(line) && currentPage) {
        inPageFields = true;
        inNext = false;
        continue;
      }

      if (/^\s{4}next\s*:/.test(line) && currentPage) {
        finalizeField();
        inNext = true;
        inPageFields = false;
        continue;
      }

      if (inNext && /^\s{6}- /.test(line) && currentPage) {
        const content = line.replace(/^\s+- /, '').trim();
        if (content.startsWith('when:')) {
          currentPage._pendingNextRule = { when: content.replace(/^when\s*:\s*/, '').trim() };
        } else if (content.startsWith('default:')) {
          currentPage.next.push({ default: true, goto: content.replace(/^default\s*:\s*/, '').trim() });
        } else if (content.startsWith('goto:') && currentPage._pendingNextRule) {
          currentPage._pendingNextRule.goto = content.replace(/^goto\s*:\s*/, '').trim();
          currentPage.next.push(currentPage._pendingNextRule);
          delete currentPage._pendingNextRule;
        }
        continue;
      }

      if (inNext && /^\s{8}goto\s*:/.test(line) && currentPage && currentPage._pendingNextRule) {
        currentPage._pendingNextRule.goto = line.replace(/^\s+goto\s*:\s*/, '').trim();
        currentPage.next.push(currentPage._pendingNextRule);
        delete currentPage._pendingNextRule;
        continue;
      }

      // Field entries inside a page (6-space indent)
      if (inPageFields && currentPage) {
        if (/^\s{6}- id\s*:/.test(line)) {
          finalizeField();
          currentField = { id: line.replace(/^\s+- id\s*:\s*/, '').trim() };
          inOptions = false; inShowWhenAny = false; inShowWhenAll = false;
          continue;
        }
        if (/^\s{8}/.test(line) && currentField) {
          if (parseFieldProp(line, currentField)) continue;
        }
        if (/^\s{10}- /.test(line) && currentField) {
          const val = line.replace(/^\s+- /, '').trim();
          if (inOptions) { if (!currentField.options) currentField.options = []; currentField.options.push(val); }
          else if (inShowWhenAny) { if (!currentField.showWhenAny) currentField.showWhenAny = []; currentField.showWhenAny.push(val); }
          else if (inShowWhenAll) { if (!currentField.showWhenAll) currentField.showWhenAll = []; currentField.showWhenAll.push(val); }
          continue;
        }
      }

      continue;
    }

    // --- Single-page: field entries (2-space indent) ---
    if (context === 'fields' || context === 'top') {
      if (/^  - id\s*:/.test(line)) {
        finalizeField();
        context = 'fields';
        currentField = { id: line.replace(/^  - id\s*:\s*/, '').trim() };
        inOptions = false; inShowWhenAny = false; inShowWhenAll = false;
        continue;
      }

      if (/^\s{4}/.test(line) && currentField) {
        if (parseFieldProp(line, currentField)) continue;
      }

      if (/^\s{6}- /.test(line) && currentField) {
        const val = line.replace(/^\s+- /, '').trim();
        if (inOptions) { if (!currentField.options) currentField.options = []; currentField.options.push(val); }
        else if (inShowWhenAny) { if (!currentField.showWhenAny) currentField.showWhenAny = []; currentField.showWhenAny.push(val); }
        else if (inShowWhenAll) { if (!currentField.showWhenAll) currentField.showWhenAll = []; currentField.showWhenAll.push(val); }
        continue;
      }
    }
  }

  if (context === 'pages') {
    finalizePage();
  } else {
    finalizeField();
  }

  return def;

  function parseFieldProp(line, field) {
    const t = line.trim();
    const colonIdx = t.indexOf(':');
    if (colonIdx === -1) return false;

    const key = t.slice(0, colonIdx).trim();
    const val = t.slice(colonIdx + 1).trim();

    switch (key) {
      case 'type': field.type = val; return true;
      case 'label': field.label = val; return true;
      case 'description': field.description = val; return true;
      case 'placeholder': field.placeholder = val; return true;
      case 'required': field.required = val === 'true'; return true;
      case 'default': field.default = val; return true;
      case 'text': field.text = val; return true;
      case 'min': field.min = parseFloat(val); return true;
      case 'max': field.max = parseFloat(val); return true;
      case 'prefill': field.prefill = val; return true;
      case 'showWhen': field.showWhen = val; return true;
      case 'options':
        inOptions = true; inShowWhenAny = false; inShowWhenAll = false;
        return true;
      case 'showWhenAny':
        inShowWhenAny = true; inOptions = false; inShowWhenAll = false;
        return true;
      case 'showWhenAll':
        inShowWhenAll = true; inOptions = false; inShowWhenAny = false;
        return true;
      default: return false;
    }
  }
}

// ---------------------------------------------------------------------------
// HTML builder — generates form HTML from parsed definition
// ---------------------------------------------------------------------------
function buildFormHtml(formDef, config) {
  _formCounter++;
  const formId = 'form-' + _formCounter;
  const webhook = esc(formDef.webhook);
  const thankYou = formDef.thankYou || config.formThankYou || 'Thank you for your submission!';
  const redirectUrl = formDef.redirectUrl || '';
  const submitLabel = formDef.submitLabel || config.formSubmitLabel || 'Submit';
  const honeypot = config.formHoneypot !== false;
  const countrySortToTop = config.formCountrySortToTop || [];

  const isMultiPage = formDef.pages.length > 0;
  const pages = isMultiPage ? formDef.pages : [{ id: 'main', title: '', fields: formDef.fields, next: [] }];
  const totalPages = pages.length;

  let html = `<div class="sitemd-form" data-form-id="${formId}" data-webhook="${webhook}"`;
  html += ` data-thank-you="${esc(thankYou)}"`;
  if (redirectUrl) html += ` data-redirect="${esc(redirectUrl)}"`;
  html += '>\n';

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const isLast = i === pages.length - 1;
    const isFirst = i === 0;

    html += `  <div class="form-page" data-page="${esc(page.id)}" data-page-index="${i}"`;
    if (page.next.length > 0) {
      html += ` data-next-rules="${esc(JSON.stringify(page.next))}"`;
    }
    if (i > 0) html += ' hidden';
    html += '>\n';

    if (isMultiPage && page.title) {
      html += '    <div class="form-page-header">\n';
      html += `      <h3>${esc(page.title)}</h3>\n`;
      html += `      <span class="form-progress">Step ${i + 1} of ${totalPages}</span>\n`;
      html += '    </div>\n';
    }

    for (const field of page.fields) {
      html += renderField(field, formId, countrySortToTop);
    }

    html += '    <div class="form-nav">\n';
    if (isMultiPage && !isFirst) {
      html += '      <button type="button" class="btn btn-outline form-prev">Back</button>\n';
    } else if (isMultiPage) {
      html += '      <div></div>\n';
    }
    if (isMultiPage && !isLast) {
      html += '      <button type="button" class="btn form-next">Continue</button>\n';
    } else {
      html += `      <button type="button" class="btn form-submit">${esc(submitLabel)}</button>\n`;
    }
    html += '    </div>\n';

    html += '  </div>\n';
  }

  if (honeypot) {
    html += '  <div style="position:absolute;left:-9999px" aria-hidden="true">\n';
    html += '    <input type="text" name="sitemd_hp" tabindex="-1" autocomplete="off">\n';
    html += '  </div>\n';
  }

  html += '  <div class="form-thankyou" hidden>\n';
  html += `    <p>${esc(thankYou)}</p>\n`;
  html += '  </div>\n';

  html += '</div>\n';
  return html;
}

// ---------------------------------------------------------------------------
// Field renderers
// ---------------------------------------------------------------------------
function renderField(field, formId, countrySortToTop) {
  const type = field.type || 'shorttext';
  const id = `${formId}-${field.id}`;
  const isDisplay = type === 'heading' || type === 'paragraph';

  let condAttrs = '';
  if (field.showWhen) condAttrs += ` data-show-when="${esc(field.showWhen)}"`;
  if (field.showWhenAny) condAttrs += ` data-show-when-any="${esc(field.showWhenAny.join(','))}"`;
  if (field.showWhenAll) condAttrs += ` data-show-when-all="${esc(field.showWhenAll.join(','))}"`;

  if (type === 'hidden') {
    const prefill = field.prefill || field.id;
    return `  <input type="hidden" name="${esc(field.id)}" data-field-id="${esc(field.id)}" data-prefill="${esc(prefill)}" value="${esc(field.default || '')}">\n`;
  }

  if (type === 'heading') {
    return `  <div class="form-field form-display"${condAttrs}><h3 class="form-heading">${esc(field.text || field.label || '')}</h3></div>\n`;
  }
  if (type === 'paragraph') {
    return `  <div class="form-field form-display"${condAttrs}><p class="form-paragraph">${esc(field.text || field.label || '')}</p></div>\n`;
  }

  let html = `  <div class="form-field" data-field-id="${esc(field.id)}" data-field-type="${esc(type)}"`;
  if (field.required) html += ' data-required="true"';
  html += condAttrs;
  html += '>\n';

  if (field.label && type !== 'consent') {
    html += `    <label for="${id}">${esc(field.label)}`;
    if (field.required) html += ' <span class="form-required">*</span>';
    html += '</label>\n';
  }

  if (field.description) {
    html += `    <p class="form-description">${esc(field.description)}</p>\n`;
  }

  const prefillAttr = ` data-prefill="${esc(field.prefill || field.id)}"`;
  const placeholder = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : '';
  const required = field.required ? ' required' : '';
  const defaultVal = field.default ? ` value="${esc(field.default)}"` : '';

  switch (type) {
    case 'shorttext':
    case 'name-first':
    case 'name-last':
      html += `    <input type="text" id="${id}" name="${esc(field.id)}"${placeholder}${required}${defaultVal}${prefillAttr}>\n`;
      break;

    case 'longtext':
      html += `    <textarea id="${id}" name="${esc(field.id)}" rows="4"${placeholder}${required}${prefillAttr}>${esc(field.default || '')}</textarea>\n`;
      break;

    case 'email':
      html += `    <input type="email" id="${id}" name="${esc(field.id)}"${placeholder}${required}${defaultVal}${prefillAttr}>\n`;
      break;

    case 'phone':
      html += `    <input type="tel" id="${id}" name="${esc(field.id)}"${placeholder}${required}${defaultVal}${prefillAttr}>\n`;
      break;

    case 'number': {
      const min = field.min != null ? ` min="${field.min}"` : '';
      const max = field.max != null ? ` max="${field.max}"` : '';
      html += `    <input type="number" id="${id}" name="${esc(field.id)}"${min}${max}${placeholder}${required}${defaultVal}${prefillAttr}>\n`;
      break;
    }

    case 'date':
      html += `    <input type="date" id="${id}" name="${esc(field.id)}"${required}${defaultVal}${prefillAttr}>\n`;
      break;

    case 'name':
      html += '    <div class="form-name-row">\n';
      html += '      <div class="form-name-field">\n';
      html += `        <input type="text" id="${id}-first" name="${esc(field.id)}.first" placeholder="First name"${required} data-prefill="${esc(field.prefill || field.id)}.first">\n`;
      html += '      </div>\n';
      html += '      <div class="form-name-field">\n';
      html += `        <input type="text" id="${id}-last" name="${esc(field.id)}.last" placeholder="Last name"${required} data-prefill="${esc(field.prefill || field.id)}.last">\n`;
      html += '      </div>\n';
      html += '    </div>\n';
      break;

    case 'address':
      html += renderAddress(id, field, prefillAttr, required, countrySortToTop);
      break;

    case 'country':
      html += renderCountrySelect(id, field, required, prefillAttr, countrySortToTop);
      break;

    case 'dropdown':
      html += `    <select id="${id}" name="${esc(field.id)}"${required}${prefillAttr}>\n`;
      html += '      <option value="">Select...</option>\n';
      for (const opt of (field.options || [])) {
        const sel = field.default === opt ? ' selected' : '';
        html += `      <option value="${esc(opt)}"${sel}>${esc(opt)}</option>\n`;
      }
      html += '    </select>\n';
      break;

    case 'radio':
      html += `    <fieldset class="form-options" id="${id}"${prefillAttr}>\n`;
      for (const opt of (field.options || [])) {
        const checked = field.default === opt ? ' checked' : '';
        html += `      <label class="form-option"><input type="radio" name="${esc(field.id)}" value="${esc(opt)}"${checked}${required}> ${esc(opt)}</label>\n`;
      }
      html += '    </fieldset>\n';
      break;

    case 'checkbox':
      html += `    <fieldset class="form-options" id="${id}"${prefillAttr}>\n`;
      for (const opt of (field.options || [])) {
        html += `      <label class="form-option"><input type="checkbox" name="${esc(field.id)}" value="${esc(opt)}"> ${esc(opt)}</label>\n`;
      }
      html += '    </fieldset>\n';
      break;

    case 'consent':
      html += `    <label class="form-option form-consent"><input type="checkbox" name="${esc(field.id)}" value="yes" required> ${esc(field.label)}</label>\n`;
      break;

    case 'rating':
      html += `    <fieldset class="form-rating" id="${id}"${prefillAttr}>\n`;
      for (let s = 1; s <= 5; s++) {
        html += `      <label class="form-star" data-value="${s}"><input type="radio" name="${esc(field.id)}" value="${s}" hidden> <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></label>\n`;
      }
      html += '    </fieldset>\n';
      break;

    default:
      html += `    <input type="text" id="${id}" name="${esc(field.id)}"${placeholder}${required}${defaultVal}${prefillAttr}>\n`;
  }

  if (!isDisplay) {
    html += '    <div class="form-error" hidden></div>\n';
  }

  html += '  </div>\n';
  return html;
}

function renderAddress(id, field, prefillAttr, required, countrySortToTop) {
  const pfx = field.prefill || field.id;
  let html = '    <div class="form-address">\n';
  html += `      <input type="text" id="${id}-street" name="${esc(field.id)}.street" placeholder="Street address"${required} data-prefill="${esc(pfx)}.street">\n`;
  html += '      <div class="form-address-row">\n';
  html += `        <input type="text" id="${id}-city" name="${esc(field.id)}.city" placeholder="City"${required} data-prefill="${esc(pfx)}.city">\n`;
  html += `        <input type="text" id="${id}-state" name="${esc(field.id)}.state" placeholder="State / Province"${required} data-prefill="${esc(pfx)}.state">\n`;
  html += '      </div>\n';
  html += '      <div class="form-address-row">\n';
  html += `        <input type="text" id="${id}-zip" name="${esc(field.id)}.zip" placeholder="ZIP / Postal code"${required} data-prefill="${esc(pfx)}.zip">\n`;
  html += `        <select id="${id}-country" name="${esc(field.id)}.country"${required} data-prefill="${esc(pfx)}.country">\n`;
  html += '          <option value="">Country</option>\n';
  html += buildCountryOptions(countrySortToTop);
  html += '        </select>\n';
  html += '      </div>\n';
  html += '    </div>\n';
  return html;
}

function renderCountrySelect(id, field, required, prefillAttr, countrySortToTop) {
  let html = `    <select id="${id}" name="${esc(field.id)}"${required}${prefillAttr}>\n`;
  html += '      <option value="">Select country...</option>\n';
  html += buildCountryOptions(countrySortToTop);
  html += '    </select>\n';
  return html;
}

function buildCountryOptions(sortToTop) {
  let html = '';
  if (sortToTop.length > 0) {
    for (const c of sortToTop) {
      html += `          <option value="${esc(c)}">${esc(c)}</option>\n`;
    }
    html += '          <option disabled>──────────</option>\n';
  }
  for (const c of COUNTRIES) {
    if (sortToTop.includes(c)) continue;
    html += `          <option value="${esc(c)}">${esc(c)}</option>\n`;
  }
  return html;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// countrySortToTop parser — extracts array from raw frontmatter
// ---------------------------------------------------------------------------
function parseCountrySortToTop(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return [];

  const lines = match[1].split('\n');
  const result = [];
  let inList = false;

  for (const line of lines) {
    if (line.trim().startsWith('#')) continue;
    if (/^countrySortToTop\s*:/.test(line)) {
      inList = true;
      if (line.includes('[]')) return [];
      continue;
    }
    if (inList && /^[a-zA-Z]/.test(line)) break;
    if (inList && /^\s+- /.test(line)) {
      result.push(line.replace(/^\s+- /, '').trim());
    }
  }
  return result;
}

module.exports = { parseFormBlock, buildFormHtml, resetFormCounter, parseCountrySortToTop };
