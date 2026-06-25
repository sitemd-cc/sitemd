/* =========================================================================
   Search — find/navigate matches in editor text
   ========================================================================= */

import { state, els } from './index.js';
import { syncHighlight, syncScroll } from './editor.js';

// -----------------------------------------------------------------------
// Find matches in plain text
// -----------------------------------------------------------------------
export function findMatches(text, query) {
  if (!query) return [];
  var matches = [];
  var lower = text.toLowerCase();
  var q = query.toLowerCase();
  var start = 0;
  while (true) {
    var idx = lower.indexOf(q, start);
    if (idx === -1) break;
    matches.push({ index: idx, length: q.length });
    start = idx + 1;
  }
  return matches;
}

// Insert <mark> tags into syntax-highlighted HTML at match positions.
// Walks html char-by-char, tracking position in original plain text.
// Handles entity decoding (&amp; &lt; &gt;) and span boundary splitting.
export function applySearchHighlights(html, matches, currentIdx) {
  if (!matches.length) return html;

  var markStarts = {};
  var markEnds = {};
  for (var m = 0; m < matches.length; m++) {
    markStarts[matches[m].index] = m;
    markEnds[matches[m].index + matches[m].length] = true;
  }

  var result = '';
  var textPos = 0;
  var inMark = false;
  var i = 0;
  var len = html.length;

  while (i < len) {
    if (html[i] === '<') {
      var tagEnd = html.indexOf('>', i);
      if (tagEnd === -1) { result += html.slice(i); break; }
      var tag = html.slice(i, tagEnd + 1);

      if (inMark) {
        result += '</mark>' + tag;
        var cls = 'search-match';
        for (var mi = 0; mi < matches.length; mi++) {
          if (textPos > matches[mi].index && textPos < matches[mi].index + matches[mi].length) {
            if (mi === currentIdx) cls = 'search-match active';
            break;
          }
        }
        result += '<mark class="' + cls + '">';
      } else {
        result += tag;
      }

      i = tagEnd + 1;
      continue;
    }

    var ch = html[i];
    var consumed = 1;
    if (html[i] === '&') {
      if (html.slice(i, i + 5) === '&amp;') { consumed = 5; }
      else if (html.slice(i, i + 4) === '&lt;') { consumed = 4; }
      else if (html.slice(i, i + 4) === '&gt;') { consumed = 4; }
    }

    if (inMark && markEnds[textPos]) {
      result += '</mark>';
      inMark = false;
    }

    if (!inMark && markStarts[textPos] !== undefined) {
      var mIdx = markStarts[textPos];
      var cls = mIdx === currentIdx ? 'search-match active' : 'search-match';
      result += '<mark class="' + cls + '">';
      inMark = true;
    }

    result += html.slice(i, i + consumed);
    textPos++;
    i += consumed;
  }

  if (inMark) result += '</mark>';

  return result;
}

// -----------------------------------------------------------------------
// Search execution, navigation, open/close
// -----------------------------------------------------------------------
function highlightPreview(query) {
  if (typeof highlightInPage === 'function') {
    highlightInPage(query);
  }
}

function scrollPreviewToMatch(idx) {
  var content = document.querySelector('.content');
  if (!content) return;
  var marks = content.querySelectorAll('mark.search-highlight');
  if (!marks.length) return;

  for (var mi = 0; mi < marks.length; mi++) {
    marks[mi].classList.remove('active');
  }

  var match = state.search.matches[idx];
  if (!match) return;

  var text = els.textarea.value;
  var fmEnd = 0;
  var lines = text.split('\n');
  if (lines[0] === '---') {
    for (var li = 1; li < lines.length; li++) {
      fmEnd += lines[li - 1].length + 1;
      if (lines[li] === '---') { fmEnd += 4; break; }
    }
  }

  var bodyMatchIdx = 0;
  for (var bi = 0; bi < state.search.matches.length; bi++) {
    if (state.search.matches[bi].index >= fmEnd) {
      if (bi === idx) break;
      bodyMatchIdx++;
    }
  }

  if (match.index < fmEnd) return;

  var targetIdx = Math.min(bodyMatchIdx, marks.length - 1);
  marks[targetIdx].classList.add('active');
  marks[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function updateSearchCount() {
  if (!state.search.matches.length) {
    els.searchCount.textContent = state.search.query ? 'No results' : '';
  } else {
    els.searchCount.textContent = (state.search.current + 1) + ' of ' + state.search.matches.length;
  }
}

function scrollToMatch(idx) {
  var match = state.search.matches[idx];
  if (!match) return;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var activeMark = els.pre.querySelector('mark.search-match.active');
      if (activeMark) {
        var markRect = activeMark.getBoundingClientRect();
        var preRect = els.pre.getBoundingClientRect();
        var markTop = markRect.top - preRect.top + els.pre.scrollTop;
        var wrapHeight = els.textarea.clientHeight;
        var scrollTarget = markTop - wrapHeight / 2 + activeMark.offsetHeight / 2;
        els.textarea.scrollTop = Math.max(0, scrollTarget);
        syncScroll();
        scrollPreviewToMatch(idx);
      }
      els.searchInput.focus();
    });
  });
}

export function executeSearch() {
  var query = els.searchInput.value;
  state.search.query = query;
  state.search.matches = findMatches(els.textarea.value, query);
  state.search.current = state.search.matches.length > 0 ? 0 : -1;
  updateSearchCount();
  highlightPreview(query);
  syncHighlight();
  if (state.search.current >= 0) scrollToMatch(state.search.current);
}

export function searchNext() {
  if (!state.search.matches.length) return;
  state.search.current = (state.search.current + 1) % state.search.matches.length;
  updateSearchCount();
  syncHighlight();
  scrollToMatch(state.search.current);
}

export function searchPrev() {
  if (!state.search.matches.length) return;
  state.search.current = (state.search.current - 1 + state.search.matches.length) % state.search.matches.length;
  updateSearchCount();
  syncHighlight();
  scrollToMatch(state.search.current);
}

export function openSearch() {
  state.search.active = true;
  els.searchBar.classList.add('visible');
  els.searchInput.focus();
  var sel = els.textarea.value.substring(els.textarea.selectionStart, els.textarea.selectionEnd);
  if (sel && sel.length < 100 && sel.indexOf('\n') === -1) {
    els.searchInput.value = sel;
  }
  if (els.searchInput.value) {
    els.searchInput.select();
    executeSearch();
  }
}

export function closeSearch() {
  state.search.active = false;
  state.search.query = '';
  state.search.matches = [];
  state.search.current = -1;
  els.searchBar.classList.remove('visible');
  els.searchInput.value = '';
  els.searchCount.textContent = '';
  syncHighlight();
  if (typeof clearHighlights === 'function') clearHighlights();
  els.textarea.focus();
}
