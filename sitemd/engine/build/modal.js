// ---------------------------------------------------------------------------
// Modal component — parser + HTML builder (per-page and global)
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Modal block parser — parses indented modal block into a definition
// Input: id string + indented block like "  tab: Tab One\n    content...\n"
// ---------------------------------------------------------------------------
function parseModalBlock(id, rawBlock) {
  // De-indent: find minimum indent and strip it
  const lines = rawBlock.split('\n');
  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length === 0) return { id, tabs: [] };

  const minIndent = Math.min(...nonEmpty.map(l => l.match(/^(\s*)/)[1].length));
  const deindented = lines.map(l => l.slice(minIndent));

  // Check if there are tab: lines at top indent level
  const hasTabLines = deindented.some(l => /^tab:\s+/.test(l));

  if (!hasTabLines) {
    // Single content block, no tabs
    return {
      id,
      tabs: [{ label: '', content: deindented.join('\n').trim() }],
    };
  }

  // Parse tab sections
  const tabs = [];
  let currentTab = null;
  let contentLines = [];

  for (const line of deindented) {
    if (/^tab:\s+/.test(line)) {
      // Save previous tab
      if (currentTab !== null) {
        tabs.push({ label: currentTab, content: contentLines.join('\n').trim() });
      }
      currentTab = line.replace(/^tab:\s+/, '').trim();
      contentLines = [];
    } else if (currentTab !== null) {
      // Strip one level of indent from tab content
      const stripped = line.match(/^  (.*)$/) ? line.slice(2) : line;
      contentLines.push(stripped);
    }
  }
  // Save last tab
  if (currentTab !== null) {
    tabs.push({ label: currentTab, content: contentLines.join('\n').trim() });
  }

  return { id, tabs };
}

// ---------------------------------------------------------------------------
// HTML builder — generates modal overlay with tabs and content panels
// Content is left as raw markdown for subsequent pipeline processing
// ---------------------------------------------------------------------------
function buildModalHtml(modalDef) {
  const id = esc(modalDef.id);
  const tabs = modalDef.tabs;
  const hasTabs = tabs.length > 1;

  let html = `<div class="modal-overlay" data-modal-id="${id}" role="dialog" aria-modal="true" hidden>\n`;
  html += `<div class="modal-wrap">\n`;
  html += `<button class="modal-close" type="button" aria-label="Close">&times;</button>\n`;
  html += `<div class="modal-dialog">\n`;

  // Tab bar (only if multiple tabs)
  if (hasTabs) {
    html += `<div class="modal-tabs">\n`;
    tabs.forEach((tab, i) => {
      const active = i === 0 ? ' is-active' : '';
      html += `<button class="modal-tab${active}" type="button" data-tab="${i}">${esc(tab.label)}</button>\n`;
    });
    html += `</div>\n`;
  }

  // Content panels
  tabs.forEach((tab, i) => {
    const hidden = i > 0 ? ' hidden' : '';
    html += `<div class="modal-body content" data-tab="${i}"${hidden}>\n\n`;
    html += tab.content + '\n\n';
    html += `</div>\n`;
  });

  html += `</div>\n</div>\n</div>\n`;

  return html;
}

// ---------------------------------------------------------------------------
// Global modals — read from sitemd/modals/*.md, fully rendered at build time
// Each file becomes a modal with ID = filename (without .md)
// File content uses the same format as inline modal content:
//   - Raw markdown for single-panel modals
//   - tab: lines for tabbed modals
// ---------------------------------------------------------------------------
function buildGlobalModals(modalsDir, renderContent) {
  if (!fs.existsSync(modalsDir)) return '';

  const files = fs.readdirSync(modalsDir).filter(f => f.endsWith('.md')).sort();
  if (files.length === 0) return '';

  const parts = [];
  for (const file of files) {
    const id = path.basename(file, '.md');
    const raw = fs.readFileSync(path.join(modalsDir, file), 'utf-8');

    // Parse as if it were an inline modal block (top-level content, no indent)
    const modalDef = parseModalBlock(id, raw);
    if (modalDef.tabs.length === 0) continue;

    // Build the modal HTML shell, then render each tab's content through
    // the full pipeline (buttons, cards, embeds, forms, marked, etc.)
    const tabs = modalDef.tabs;
    const hasTabs = tabs.length > 1;

    let html = `<div class="modal-overlay" data-modal-id="${esc(id)}" role="dialog" aria-modal="true" hidden>\n`;
    html += `<div class="modal-wrap">\n`;
    html += `<button class="modal-close" type="button" aria-label="Close">&times;</button>\n`;
    html += `<div class="modal-dialog">\n`;

    if (hasTabs) {
      html += `<div class="modal-tabs">\n`;
      tabs.forEach((tab, i) => {
        const active = i === 0 ? ' is-active' : '';
        html += `<button class="modal-tab${active}" type="button" data-tab="${i}">${esc(tab.label)}</button>\n`;
      });
      html += `</div>\n`;
    }

    tabs.forEach((tab, i) => {
      const hidden = i > 0 ? ' hidden' : '';
      const rendered = renderContent(tab.content);
      html += `<div class="modal-body content" data-tab="${i}"${hidden}>\n${rendered}\n</div>\n`;
    });

    html += `</div>\n</div>\n</div>\n`;
    parts.push(html);
  }

  return parts.join('\n');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { parseModalBlock, buildModalHtml, buildGlobalModals };
