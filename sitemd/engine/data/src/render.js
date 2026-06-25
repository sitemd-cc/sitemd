// ---------------------------------------------------------------------------
// Display renderers — cards, list, table, detail, pagination, modal
// ---------------------------------------------------------------------------
import { interpolate, escHtml, escAttr, parseLinkValue } from './filters.js';

// ---------------------------------------------------------------------------
// Card renderer
// ---------------------------------------------------------------------------
export function renderCards(rows, mapStr, detailMode, detailFieldsStr) {
  let map;
  try { map = JSON.parse(mapStr); } catch(e) { return ''; }
  const useModal = detailMode === 'modal' && detailFieldsStr;

  let html = '<div class="card-grid">';
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    html += '<div class="card">';
    if (map.image) {
      const imgSrc = interpolate(map.image, row);
      const imgAlt = map.title ? interpolate(map.title, row) : '';
      if (imgSrc) html += '<img src="' + escAttr(imgSrc) + '" alt="' + escAttr(imgAlt) + '" loading="lazy" class="card-image">';
    }
    html += '<div class="card-body">';
    if (map.title) html += '<h3 class="card-title">' + escHtml(interpolate(map.title, row)) + '</h3>';
    if (map.text) html += '<p class="card-text">' + escHtml(interpolate(map.text, row)) + '</p>';
    if (map.link) {
      const linkVal = interpolate(map.link, row);
      const linkParts = parseLinkValue(linkVal);
      if (useModal) {
        html += '<span class="card-link">' + makeModalLink(linkParts.label + ' \u2192', row, detailFieldsStr) + '</span>';
      } else {
        html += '<a href="' + escAttr(linkParts.url) + '" class="card-link">' + escHtml(linkParts.label) + ' &rarr;</a>';
      }
    }
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}

// ---------------------------------------------------------------------------
// List renderer
// ---------------------------------------------------------------------------
export function renderList(rows, mapStr, detailMode, detailFieldsStr) {
  let map;
  try { map = JSON.parse(mapStr); } catch(e) { return ''; }
  const useModal = detailMode === 'modal' && detailFieldsStr;

  let html = '<ul class="sitemd-data-list">';
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    html += '<li class="data-list-item">';
    if (map.image) {
      const imgSrc = interpolate(map.image, row);
      if (imgSrc) html += '<img src="' + escAttr(imgSrc) + '" alt="" loading="lazy" class="data-list-thumb">';
    }
    html += '<div class="data-list-body">';
    if (map.title) {
      const titleText = escHtml(interpolate(map.title, row));
      if (useModal) {
        html += '<span class="data-list-title">' + makeModalLink(titleText, row, detailFieldsStr) + '</span>';
      } else if (map.link) {
        const linkVal = interpolate(map.link, row);
        const linkParts = parseLinkValue(linkVal);
        html += '<a href="' + escAttr(linkParts.url) + '" class="data-list-title">' + titleText + '</a>';
      } else {
        html += '<span class="data-list-title">' + titleText + '</span>';
      }
    }
    if (map.text) html += '<p class="data-list-text">' + escHtml(interpolate(map.text, row)) + '</p>';
    html += '</div></li>';
  }
  html += '</ul>';
  return html;
}

// ---------------------------------------------------------------------------
// Table renderer
// ---------------------------------------------------------------------------
export function renderTable(rows, fieldsStr, linkStr, detailMode, detailFieldsStr) {
  let fields;
  try { fields = JSON.parse(fieldsStr); } catch(e) { return ''; }
  const useModal = detailMode === 'modal' && detailFieldsStr;

  let html = '<div class="sitemd-data-table-wrap"><table class="sitemd-data-table"><thead><tr>';
  for (let i = 0; i < fields.length; i++) {
    html += '<th>' + escHtml(fields[i].label) + '</th>';
  }
  if (linkStr) html += '<th></th>';
  html += '</tr></thead><tbody>';

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    html += '<tr>';
    for (let c = 0; c < fields.length; c++) {
      html += '<td>' + escHtml(interpolate(fields[c].template, row)) + '</td>';
    }
    if (linkStr) {
      const linkVal = interpolate(linkStr, row);
      const linkParts = parseLinkValue(linkVal);
      if (useModal) {
        html += '<td>' + makeModalLink(linkParts.label, row, detailFieldsStr) + '</td>';
      } else {
        html += '<td><a href="' + escAttr(linkParts.url) + '" class="data-table-link">' + escHtml(linkParts.label) + '</a></td>';
      }
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

// ---------------------------------------------------------------------------
// Detail renderer
// ---------------------------------------------------------------------------
export function renderDetail(row, fieldsStr) {
  let fields;
  try { fields = JSON.parse(fieldsStr); } catch(e) { return ''; }

  let html = '<dl class="sitemd-data-detail">';
  for (let i = 0; i < fields.length; i++) {
    html += '<div class="data-detail-row">';
    html += '<dt class="data-detail-label">' + escHtml(fields[i].label) + '</dt>';
    html += '<dd class="data-detail-value">' + escHtml(interpolate(fields[i].template, row)) + '</dd>';
    html += '</div>';
  }
  html += '</dl>';
  return html;
}

// ---------------------------------------------------------------------------
// Pagination renderer
// ---------------------------------------------------------------------------
export function renderPagination(paginationEl, currentPage, totalPages, onPageChange) {
  if (totalPages <= 1) { paginationEl.hidden = true; return; }
  paginationEl.hidden = false;
  let html = '<div class="data-pagination-controls">';
  html += '<button class="data-page-btn data-page-prev"' + (currentPage <= 1 ? ' disabled' : '') + '>&laquo; Prev</button>';
  html += '<span class="data-page-info">Page ' + currentPage + ' of ' + totalPages + '</span>';
  html += '<button class="data-page-btn data-page-next"' + (currentPage >= totalPages ? ' disabled' : '') + '>Next &raquo;</button>';
  html += '</div>';
  paginationEl.innerHTML = html;

  const prev = paginationEl.querySelector('.data-page-prev');
  const next = paginationEl.querySelector('.data-page-next');
  if (prev) prev.addEventListener('click', function() { if (currentPage > 1) onPageChange(currentPage - 1); });
  if (next) next.addEventListener('click', function() { if (currentPage < totalPages) onPageChange(currentPage + 1); });
}

// ---------------------------------------------------------------------------
// Modal detail — create and open a modal with record detail view
// ---------------------------------------------------------------------------
let _modalId = 0;

export function openDetailModal(row, detailFieldsStr) {
  let fields;
  try { fields = JSON.parse(detailFieldsStr); } catch(e) { return; }

  // Build detail HTML
  let bodyHtml = '<dl class="sitemd-data-detail">';
  for (let i = 0; i < fields.length; i++) {
    bodyHtml += '<div class="data-detail-row">';
    bodyHtml += '<dt class="data-detail-label">' + escHtml(fields[i].label) + '</dt>';
    bodyHtml += '<dd class="data-detail-value">' + escHtml(interpolate(fields[i].template, row)) + '</dd>';
    bodyHtml += '</div>';
  }
  bodyHtml += '</dl>';

  // Reuse or create the data detail modal
  const modalId = 'sitemd-data-detail-modal';
  let overlay = document.querySelector('[data-modal-id="' + modalId + '"]');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('data-modal-id', modalId);
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="modal-wrap">' +
      '<button class="modal-close" type="button" aria-label="Close">&times;</button>' +
      '<div class="modal-dialog"><div class="modal-body content"></div></div>' +
      '</div>';
    document.body.appendChild(overlay);

    // Close handlers
    overlay.querySelector('.modal-close').addEventListener('click', function() {
      overlay.hidden = true;
      document.body.style.overflow = '';
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.hidden = true;
        document.body.style.overflow = '';
      }
    });
  }

  // Set content and open
  overlay.querySelector('.modal-body').innerHTML = bodyHtml;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  overlay.querySelector('.modal-close').focus();
}

export function makeModalLink(label, row, detailFieldsStr) {
  // Serialize row data into a data attribute for the click handler
  const id = 'data-modal-row-' + (++_modalId);
  // Store row data on window for retrieval
  window['__sitemdRow_' + id] = { row: row, fields: detailFieldsStr };
  return '<a href="#" class="data-detail-trigger" data-row-id="' + id + '">' + escHtml(label) + '</a>';
}

// Delegate click handler for modal detail triggers
export function initModalDelegation() {
  document.addEventListener('click', function(e) {
    const trigger = e.target.closest('.data-detail-trigger');
    if (!trigger) return;
    e.preventDefault();
    const rowId = trigger.dataset.rowId;
    const stored = window['__sitemdRow_' + rowId];
    if (stored) openDetailModal(stored.row, stored.fields);
  });
}
