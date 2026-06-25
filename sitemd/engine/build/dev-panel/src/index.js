/* =========================================================================
   Dev Panel — In-browser markdown editor for sitemd dev server
   Injected by dev server only. Never ships to production.
   ========================================================================= */

import { syncHighlight, syncScroll, onInput, getFullContent, applyCommentVisibility } from './editor.js';
import { findMatches, updateSearchCount, executeSearch, searchNext, searchPrev, openSearch, closeSearch } from './search.js';
import { saveFile, smartReload } from './save.js';
import { loadSlugMap, loadFileList, loadFile, resolveCurrentPage, collapseExplorer, watchNavigation, currentSlugFn } from './file-list.js';

// -----------------------------------------------------------------------
// State (shared across all modules)
// -----------------------------------------------------------------------
export var state = {
  open: localStorage.getItem('sitemd-dev-panel') === 'open',
  currentFile: localStorage.getItem('sitemd-dev-file') || null,
  originalContent: '',
  dirty: false,
  slugMap: {},
  reverseSlugMap: {},
  fileList: null,
  saving: false,
  hideComments: localStorage.getItem('sitemd-dev-hide-comments') !== 'false',
  spellcheck: localStorage.getItem('sitemd-dev-spellcheck') !== 'false',
  strippedComments: [],
  search: { active: false, query: '', matches: [], current: -1 },
  justSaved: false,
};

// -----------------------------------------------------------------------
// DOM references (shared across all modules)
// -----------------------------------------------------------------------
export var els = {};

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
function $(sel, ctx) { return (ctx || document).querySelector(sel); }
export function fetchJSON(url) {
  return fetch(url).then(function (r) { return r.json(); });
}

// -----------------------------------------------------------------------
// Status bar (ephemeral)
// -----------------------------------------------------------------------
var statusTimer = null;
export function setStatus(msg) {
  if (!els.status || !els.statusWrap) return;
  els.status.textContent = msg;
  els.statusWrap.classList.add('visible');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(function () {
    els.statusWrap.classList.remove('visible');
  }, 1200);
}

var siteStatusTimer = null;
export function setSiteStatus(msg) {
  if (!els.siteStatus || !els.siteStatusWrap) return;
  els.siteStatus.textContent = msg;
  els.siteStatusWrap.classList.add('visible');
  clearTimeout(siteStatusTimer);
  siteStatusTimer = setTimeout(function () {
    els.siteStatusWrap.classList.remove('visible');
  }, 1200);
}

// -----------------------------------------------------------------------
// Build DOM
// -----------------------------------------------------------------------
function createPanel() {
  var panel = document.createElement('div');
  panel.className = 'dev-panel' + (state.open ? ' is-open' : '');
  panel.innerHTML =
    '<div class="dev-panel-toolbar">' +
      '<button class="dev-panel-files-toggle">' +
        '<svg viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
        'sitemd dev panel' +
      '</button>' +
      '<span class="dev-panel-header-file">No file open</span>' +
      '<div class="dev-panel-header-actions">' +
        '<button class="dev-panel-btn save-btn" disabled>Save</button>' +
      '</div>' +
    '</div>' +
    '<div class="dev-panel-files collapsed"></div>' +
    '<div class="dev-panel-editor">' +
      '<div class="dev-panel-status">' +
        '<span class="dev-panel-status-msg"></span>' +
      '</div>' +
      '<label class="dev-panel-hide-comments">' +
        '<span class="dev-panel-hide-comments-inner">' +
          '<span class="dev-panel-hide-comments-label">comments</span>' +
          '<span class="dev-panel-switch' + (state.hideComments ? '' : ' on') + '">' +
            '<span class="dev-panel-switch-thumb"></span>' +
          '</span>' +
        '</span>' +
      '</label>' +
      '<label class="dev-panel-spellcheck">' +
        '<span class="dev-panel-spellcheck-inner">' +
          '<span class="dev-panel-spellcheck-label">spellcheck</span>' +
          '<span class="dev-panel-switch' + (state.spellcheck ? ' on' : '') + '">' +
            '<span class="dev-panel-switch-thumb"></span>' +
          '</span>' +
        '</span>' +
      '</label>' +
      '<div class="dev-panel-search">' +
        '<input type="text" class="dev-panel-search-input" placeholder="Find..." spellcheck="false">' +
        '<span class="dev-panel-search-count"></span>' +
        '<button class="dev-panel-search-prev" aria-label="Previous match">' +
          '<svg viewBox="0 0 10 10"><path d="M2 7l3-4 3 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
        '</button>' +
        '<button class="dev-panel-search-next" aria-label="Next match">' +
          '<svg viewBox="0 0 10 10"><path d="M2 3l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
        '</button>' +
        '<button class="dev-panel-search-close" aria-label="Close search">' +
          '<svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="dev-panel-editor-wrap">' +
        '<pre></pre>' +
        '<textarea spellcheck="' + (state.spellcheck ? 'true' : 'false') + '" autocorrect="off" autocapitalize="off" placeholder="Select a file to edit..."></textarea>' +
      '</div>' +
    '</div>';
  document.body.appendChild(panel);

  var toggle = document.createElement('button');
  toggle.className = 'dev-panel-toggle';
  toggle.setAttribute('aria-label', 'Toggle dev panel');
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  toggle.setAttribute('data-tooltip', isMac ? '\u2318/' : 'Ctrl+/');
  toggle.innerHTML = '<svg viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  document.body.appendChild(toggle);

  var siteStatus = document.createElement('div');
  siteStatus.className = 'dev-site-status';
  siteStatus.innerHTML = '<span class="dev-site-status-msg"></span>';
  document.body.appendChild(siteStatus);

  els.panel = panel;
  els.toggle = toggle;
  els.headerFile = $('.dev-panel-header-file', panel);
  els.saveBtn = $('.save-btn', panel);
  els.filesToggle = $('.dev-panel-files-toggle', panel);
  els.files = $('.dev-panel-files', panel);
  els.editorWrap = $('.dev-panel-editor-wrap', panel);
  els.pre = $('pre', panel);
  els.textarea = $('textarea', panel);
  els.statusWrap = $('.dev-panel-status', panel);
  els.status = $('.dev-panel-status-msg', panel);
  els.siteStatusWrap = siteStatus;
  els.siteStatus = $('.dev-site-status-msg', siteStatus);
  els.hideCommentsToggle = $('.dev-panel-hide-comments', panel);
  els.hideCommentsSwitch = $('.dev-panel-hide-comments .dev-panel-switch', panel);
  els.spellcheckToggle = $('.dev-panel-spellcheck', panel);
  els.spellcheckSwitch = $('.dev-panel-spellcheck .dev-panel-switch', panel);
  els.searchBar = $('.dev-panel-search', panel);
  els.searchInput = $('.dev-panel-search-input', panel);
  els.searchCount = $('.dev-panel-search-count', panel);
  els.searchPrev = $('.dev-panel-search-prev', panel);
  els.searchNext = $('.dev-panel-search-next', panel);
  els.searchClose = $('.dev-panel-search-close', panel);

  if (state.open) document.body.classList.add('dev-panel-open');
}

// -----------------------------------------------------------------------
// Toggle panel
// -----------------------------------------------------------------------
function togglePanel() {
  state.open = !state.open;
  els.panel.classList.toggle('is-open', state.open);
  document.body.classList.toggle('dev-panel-open', state.open);
  localStorage.setItem('sitemd-dev-panel', state.open ? 'open' : 'closed');
}

// -----------------------------------------------------------------------
// SSE
// -----------------------------------------------------------------------
window.__sitemdDevPanel = true;

function initSSE() {
  var es = new EventSource('/__reload');
  es.onmessage = function (e) {
    if (e.data === 'reload') {
      smartReload();
    }
  };
}

// -----------------------------------------------------------------------
// Event bindings
// -----------------------------------------------------------------------
function bindEvents() {
  els.toggle.addEventListener('click', togglePanel);

  els.filesToggle.addEventListener('click', function () {
    var expanding = !els.filesToggle.classList.contains('expanded');
    els.filesToggle.classList.toggle('expanded', expanding);
    els.files.classList.toggle('collapsed', !expanding);
  });

  els.files.addEventListener('click', function (e) {
    var secToggle = e.target.closest('.dev-panel-section-toggle');
    if (secToggle) {
      var secKey = secToggle.getAttribute('data-section');
      var children = els.files.querySelector('.dev-panel-section-children[data-section-parent="' + secKey + '"]');
      if (children) {
        var opening = children.hidden;
        children.hidden = !opening;
        secToggle.classList.toggle('expanded', opening);
      }
      return;
    }
    var dirToggle = e.target.closest('.dev-panel-dir-toggle');
    if (dirToggle) {
      var dirKey = dirToggle.getAttribute('data-dir');
      var children = els.files.querySelector('.dev-panel-dir-children[data-parent="' + dirKey + '"]');
      if (children) {
        var opening = children.hidden;
        children.hidden = !opening;
        dirToggle.classList.toggle('expanded', opening);
      }
      return;
    }
    var item = e.target.closest('.dev-panel-file');
    if (!item) return;
    loadFile(item.getAttribute('data-path'));
    collapseExplorer();
  });

  els.hideCommentsToggle.addEventListener('click', function () {
    var fullContent = getFullContent();
    state.hideComments = !state.hideComments;
    localStorage.setItem('sitemd-dev-hide-comments', state.hideComments);
    els.hideCommentsSwitch.classList.toggle('on', !state.hideComments);
    els.textarea.value = applyCommentVisibility(fullContent);
    if (state.search.active && state.search.query) {
      state.search.matches = findMatches(els.textarea.value, state.search.query);
      state.search.current = state.search.matches.length > 0 ? 0 : -1;
      updateSearchCount();
    }
    syncHighlight();
    setStatus(state.hideComments ? 'Comments hidden' : 'Comments shown');
  });

  els.spellcheckToggle.addEventListener('click', function () {
    state.spellcheck = !state.spellcheck;
    localStorage.setItem('sitemd-dev-spellcheck', state.spellcheck);
    els.spellcheckSwitch.classList.toggle('on', state.spellcheck);
    els.textarea.spellcheck = state.spellcheck;
    // Force the browser to re-evaluate spellcheck on existing content
    var val = els.textarea.value;
    var s = els.textarea.selectionStart, e = els.textarea.selectionEnd;
    els.textarea.blur();
    els.textarea.value = '';
    els.textarea.value = val;
    els.textarea.setSelectionRange(s, e);
    els.textarea.focus();
    setStatus(state.spellcheck ? 'Spellcheck on' : 'Spellcheck off');
  });

  els.textarea.addEventListener('input', onInput);
  els.textarea.addEventListener('scroll', function () {
    syncScroll();
    if (els.textarea.scrollTop > 0) {
      els.hideCommentsToggle.classList.add('scrolled');
    } else {
      els.hideCommentsToggle.classList.remove('scrolled');
    }
  });

  els.panel.addEventListener('wheel', function (e) {
    var target = e.target.closest('.dev-panel-editor-wrap textarea, .dev-panel-files');
    if (!target) return;
    var atTop = target.scrollTop === 0;
    var atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 1;
    if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
      e.preventDefault();
    }
  }, { passive: false });

  els.saveBtn.addEventListener('click', saveFile);

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      togglePanel();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      if (state.currentFile && state.dirty) {
        e.preventDefault();
        saveFile();
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'f' && state.open && state.currentFile) {
      e.preventDefault();
      openSearch();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '.') {
      e.preventDefault();
      var slug = currentSlugFn();
      var previewUrl = slug === '/' ? '/seo-preview' : slug + '/seo-preview';
      window.open(previewUrl, '_blank');
    }
  });

  els.searchInput.addEventListener('input', function () {
    executeSearch();
  });

  els.searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSearch();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) searchPrev(); else searchNext();
    }
  });

  els.searchPrev.addEventListener('click', searchPrev);
  els.searchNext.addEventListener('click', searchNext);
  els.searchClose.addEventListener('click', closeSearch);

  els.textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      var start = this.selectionStart;
      var end = this.selectionEnd;
      var val = this.value;
      this.value = val.substring(0, start) + '  ' + val.substring(end);
      this.selectionStart = this.selectionEnd = start + 2;
      onInput();
    }
  });
}

// -----------------------------------------------------------------------
// Init
// -----------------------------------------------------------------------
function init() {
  createPanel();
  bindEvents();
  var slugMapReady = loadSlugMap();
  loadFileList();
  watchNavigation();
  initSSE();

  slugMapReady.then(function () {
    var resolved = resolveCurrentPage(true);
    if (!resolved && state.currentFile) {
      loadFile(state.currentFile, true);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
