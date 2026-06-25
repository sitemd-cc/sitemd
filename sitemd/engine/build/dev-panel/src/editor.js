/* =========================================================================
   Editor — state management, highlight sync, comments, dirty tracking
   ========================================================================= */

import { state, els } from './index.js';
import { highlight } from './highlighter.js';
import { applySearchHighlights, findMatches, updateSearchCount } from './search.js';

// -----------------------------------------------------------------------
// Sync highlight overlay
// -----------------------------------------------------------------------
var highlightRAF = null;
export function syncHighlight() {
  if (highlightRAF) return;
  highlightRAF = requestAnimationFrame(function () {
    highlightRAF = null;
    var html = highlight(els.textarea.value);
    if (state.search.active && state.search.matches.length) {
      html = applySearchHighlights(html, state.search.matches, state.search.current);
    }
    els.pre.innerHTML = html + '\n';
    syncScroll();
  });
}

// Force the browser to re-run spellcheck on programmatically-set content.
// Chrome/Safari only spellcheck text the user typed; toggling the attribute
// off and back on across a frame triggers a re-evaluation of the whole value.
export function kickSpellcheck() {
  if (!els.textarea || !state.spellcheck) return;
  els.textarea.spellcheck = false;
  requestAnimationFrame(function () {
    els.textarea.spellcheck = state.spellcheck;
  });
}

export function syncScroll() {
  els.pre.scrollTop = els.textarea.scrollTop;
  els.pre.scrollLeft = els.textarea.scrollLeft;
}

// -----------------------------------------------------------------------
// Comment stripping (hide frontmatter # comments from editor)
// -----------------------------------------------------------------------
function stripComments(content) {
  var lines = content.split('\n');
  var comments = [];
  var stripped = [];
  var inFM = false, fmDone = false;
  for (var i = 0; i < lines.length; i++) {
    if (i === 0 && lines[i] === '---') { inFM = true; stripped.push(lines[i]); continue; }
    if (inFM && lines[i] === '---') { inFM = false; fmDone = true; stripped.push(lines[i]); continue; }
    if (inFM && /^\s*#/.test(lines[i])) {
      comments.push({ line: stripped.length, text: lines[i] });
    } else {
      stripped.push(lines[i]);
    }
  }
  return { stripped: stripped.join('\n'), comments: comments };
}

function restoreComments(content, comments) {
  if (!comments || !comments.length) return content;
  var lines = content.split('\n');
  for (var i = 0; i < comments.length; i++) {
    lines.splice(comments[i].line + i, 0, comments[i].text);
  }
  return lines.join('\n');
}

export function getFullContent() {
  var val = els.textarea.value;
  if (state.hideComments && state.strippedComments && state.strippedComments.length) {
    return restoreComments(val, state.strippedComments);
  }
  return val;
}

export function applyCommentVisibility(content) {
  if (state.hideComments) {
    var result = stripComments(content);
    state.strippedComments = result.comments;
    return result.stripped;
  }
  state.strippedComments = [];
  return content;
}

// -----------------------------------------------------------------------
// Dirty tracking
// -----------------------------------------------------------------------
export function onInput() {
  if (state.search.active && state.search.query) {
    state.search.matches = findMatches(els.textarea.value, state.search.query);
    if (state.search.current >= state.search.matches.length) {
      state.search.current = Math.max(0, state.search.matches.length - 1);
    }
    if (!state.search.matches.length) state.search.current = -1;
    updateSearchCount();
  }
  syncHighlight();
  var isDirty = getFullContent() !== state.originalContent;
  if (isDirty !== state.dirty) {
    state.dirty = isDirty;
    els.saveBtn.disabled = !isDirty;
    els.headerFile.innerHTML = state.currentFile +
      (isDirty ? '<span class="dirty-indicator"> ●</span>' : '');
  }
}
