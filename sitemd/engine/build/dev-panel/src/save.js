/* =========================================================================
   Save — save logic, dirty state, reload coordination with dev server
   ========================================================================= */

import { state, els } from './index.js';
import { getFullContent } from './editor.js';
import { setStatus, setSiteStatus } from './index.js';
import { loadSlugMap, loadFileList, loadFile } from './file-list.js';

// -----------------------------------------------------------------------
// Save file
// -----------------------------------------------------------------------
export function saveFile() {
  if (!state.currentFile || state.saving || !state.dirty) return;
  state.saving = true;
  els.saveBtn.disabled = true;
  setStatus('Saving...');

  var cursorStart = els.textarea.selectionStart;
  var cursorEnd = els.textarea.selectionEnd;
  var scrollTop = els.textarea.scrollTop;
  sessionStorage.setItem('sitemd-dev-cursor', JSON.stringify({
    start: cursorStart, end: cursorEnd, scroll: scrollTop
  }));

  fetch('/__dev/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: state.currentFile, content: getFullContent() })
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    state.saving = false;
    if (data.ok) {
      state.originalContent = getFullContent();
      state.dirty = false;
      els.saveBtn.disabled = true;
      state.justSaved = true;
      setStatus('Saved');
      setSiteStatus('Reloaded');
    } else {
      setStatus('Save failed: ' + (data.error || 'unknown'));
      els.saveBtn.disabled = false;
    }
  })
  .catch(function () {
    state.saving = false;
    setStatus('Save failed (network error)');
    els.saveBtn.disabled = false;
  });
}

// -----------------------------------------------------------------------
// Smart reload (called on SSE reload events)
// -----------------------------------------------------------------------
export function smartReload() {
  loadSlugMap();
  loadFileList();

  var reload = window.__sitemdReloadContent ? window.__sitemdReloadContent() : Promise.resolve();

  reload.then(function() {
    if (typeof window.initSidebarSearch === 'function') window.initSidebarSearch();
    if (typeof window.__sitemdClearCache === 'function') window.__sitemdClearCache();

    var cursor = sessionStorage.getItem('sitemd-dev-cursor');
    if (cursor) {
      try {
        cursor = JSON.parse(cursor);
        els.textarea.selectionStart = cursor.start;
        els.textarea.selectionEnd = cursor.end;
        els.textarea.scrollTop = cursor.scroll;
      } catch (e) {}
      sessionStorage.removeItem('sitemd-dev-cursor');
    }

    // Re-fetch editor content if the current file was externally modified (e.g. auto-image rewrite)
    if (state.currentFile && !state.dirty) {
      fetch('/__dev/file?path=' + encodeURIComponent(state.currentFile))
        .then(function(r) { return r.text(); })
        .then(function(content) {
          if (content !== state.originalContent) {
            loadFile(state.currentFile, true, true);
          }
        }).catch(function() {});
    }

    if (!state.justSaved) {
      setStatus('Reloaded');
    }
    state.justSaved = false;
  }).catch(function () {
    location.reload();
  });
}
