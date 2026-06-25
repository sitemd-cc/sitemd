/* =========================================================================
   File list — navigation, fetching, switching, creating files
   ========================================================================= */

import { state, els, fetchJSON } from './index.js';
import { syncHighlight, applyCommentVisibility, kickSpellcheck } from './editor.js';
import { closeSearch } from './search.js';
import { setStatus, setSiteStatus } from './index.js';

// -----------------------------------------------------------------------
// Slug map + click-to-edit
// -----------------------------------------------------------------------
export function loadSlugMap() {
  return fetchJSON('/__dev/slug-map').then(function (map) {
    state.slugMap = map;
    state.reverseSlugMap = {};
    for (var slug in map) {
      state.reverseSlugMap[map[slug]] = slug;
    }
  });
}

function currentSlug() {
  var p = location.pathname;
  return p === '/' ? '/' : p.replace(/\/$/, '');
}

function navigatePreview(slug) {
  if (window.__sitemdNavigate) {
    window.__sitemdNavigate(slug);
  } else {
    location.href = slug;
  }
}

export function resolveCurrentPage(forceLoad) {
  var slug = currentSlug();
  var fullPath = state.slugMap[slug];
  if (fullPath) {
    if (forceLoad || fullPath !== state.currentFile) {
      loadFile(fullPath, true);
    }
    return true;
  }
  return false;
}

export function currentSlugFn() {
  return currentSlug();
}

// -----------------------------------------------------------------------
// File browser
// -----------------------------------------------------------------------
export function loadFileList() {
  fetchJSON('/__dev/files').then(function (data) {
    state.fileList = data;
    renderFileList();
  });
}

function renderFileList() {
  if (!state.fileList) return;

  var expandedDirs = {};
  var expandedSections = {};
  els.files.querySelectorAll('.dev-panel-dir-toggle.expanded').forEach(function (el) {
    expandedDirs[el.getAttribute('data-dir')] = true;
  });
  els.files.querySelectorAll('.dev-panel-section-toggle.expanded').forEach(function (el) {
    expandedSections[el.getAttribute('data-section')] = true;
  });

  var html = '';

  html += renderSection('pages', state.fileList.pages || [], expandedDirs, expandedSections);
  if ((state.fileList['account-pages'] || []).length) html += renderSection('account-pages', state.fileList['account-pages'], expandedDirs, expandedSections);
  if ((state.fileList['auth-pages'] || []).length) html += renderSection('auth-pages', state.fileList['auth-pages'], expandedDirs, expandedSections);
  if ((state.fileList['gated-pages'] || []).length) html += renderSection('gated-pages', state.fileList['gated-pages'], expandedDirs, expandedSections);
  if ((state.fileList.modals || []).length) html += renderSection('modals', state.fileList.modals || [], expandedDirs, expandedSections);
  html += renderSection('settings', state.fileList.settings || [], expandedDirs, expandedSections);

  els.files.innerHTML = html;
  updateActiveFile();
}

function renderSection(prefix, files, expandedDirs, expandedSections) {
  var html = '';
  var dirs = {};
  var rootFiles = [];

  files.forEach(function (f) {
    var parts = f.path.split('/');
    if (parts.length > 1) {
      var dir = parts[0];
      if (!dirs[dir]) dirs[dir] = [];
      dirs[dir].push(f);
    } else {
      rootFiles.push(f);
    }
  });

  var secExpanded = Object.keys(expandedSections).length ? expandedSections[prefix] : true;
  html += '<div class="dev-panel-section-toggle' + (secExpanded ? ' expanded' : '') + '" data-section="' + prefix + '">' +
    '<svg viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
    prefix +
  '</div>';
  html += '<div class="dev-panel-section-children" data-section-parent="' + prefix + '"' + (secExpanded ? '' : ' hidden') + '>';

  rootFiles.forEach(function (f) {
    html += fileHTML(prefix + '/' + f.path, f.path, 0);
  });

  Object.keys(dirs).sort().forEach(function (dir) {
    var dirKey = prefix + '/' + dir;
    var dirExp = expandedDirs[dirKey] || false;
    html += '<div class="dev-panel-dir-toggle' + (dirExp ? ' expanded' : '') + '" data-dir="' + dirKey + '">' +
      '<svg viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
      dir + '/' +
    '</div>';
    html += '<div class="dev-panel-dir-children" data-parent="' + dirKey + '"' + (dirExp ? '' : ' hidden') + '>';
    var subdirs = {};
    var dirFiles = [];
    dirs[dir].forEach(function (f) {
      var rest = f.path.slice(dir.length + 1);
      var parts = rest.split('/');
      if (parts.length > 1) {
        var subdir = parts[0];
        if (!subdirs[subdir]) subdirs[subdir] = [];
        subdirs[subdir].push({ path: rest, fullPath: f.path });
      } else {
        dirFiles.push(f);
      }
    });
    dirFiles.forEach(function (f) {
      var name = f.path.split('/').pop();
      html += fileHTML(prefix + '/' + f.path, name, 1);
    });
    Object.keys(subdirs).sort().forEach(function (subdir) {
      var subKey = prefix + '/' + dir + '/' + subdir;
      var subExp = expandedDirs[subKey] || false;
      html += '<div class="dev-panel-dir-toggle' + (subExp ? ' expanded' : '') + '" data-dir="' + subKey + '" style="padding-left:24px">' +
        '<svg viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' +
        subdir + '/' +
      '</div>';
      html += '<div class="dev-panel-dir-children" data-parent="' + subKey + '"' + (subExp ? '' : ' hidden') + '>';
      subdirs[subdir].forEach(function (sf) {
        var name = sf.fullPath.split('/').pop();
        html += fileHTML(prefix + '/' + sf.fullPath, name, 2);
      });
      html += '</div>';
    });
    html += '</div>';
  });

  html += '</div>';
  return html;
}

function fileHTML(fullPath, label, depth) {
  var cls = 'dev-panel-file' + (state.currentFile === fullPath ? ' active' : '');
  var pad = 12 + depth * 12;
  return '<div class="' + cls + '" data-path="' + fullPath + '" style="padding-left:' + pad + 'px">' +
    '<svg class="dev-panel-file-icon" viewBox="0 0 16 16"><path d="M13 4H8L6.5 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1z" fill="none" stroke="currentColor" stroke-width="1"/></svg>' +
    label +
  '</div>';
}

function updateActiveFile() {
  var items = els.files.querySelectorAll('.dev-panel-file');
  for (var i = 0; i < items.length; i++) {
    items[i].classList.toggle('active', items[i].getAttribute('data-path') === state.currentFile);
  }
}

// -----------------------------------------------------------------------
// Load file into editor
// -----------------------------------------------------------------------
export function loadFile(filePath, skipNav, preserveScroll) {
  if (state.search.active) closeSearch();
  fetch('/__dev/file?path=' + encodeURIComponent(filePath))
    .then(function (r) { return r.text(); })
    .then(function (content) {
      var scrollTop = preserveScroll ? els.textarea.scrollTop : 0;
      state.currentFile = filePath;
      state.originalContent = content;
      state.dirty = false;
      localStorage.setItem('sitemd-dev-file', filePath);

      els.textarea.value = applyCommentVisibility(content);
      els.textarea.scrollTop = scrollTop;
      syncHighlight();
      kickSpellcheck();
      els.headerFile.textContent = filePath;
      els.saveBtn.disabled = true;
      updateActiveFile();
      if (skipNav) {
        setStatus('Opened ' + filePath);
      } else {
        var slug = state.reverseSlugMap[filePath];
        if (slug && slug !== currentSlug()) {
          navigatePreview(slug);
          setSiteStatus('Navigated to ' + slug);
        }
      }
    })
    .catch(function () {
      setStatus('Failed to load ' + filePath);
    });
}

// -----------------------------------------------------------------------
// Collapse file explorer
// -----------------------------------------------------------------------
export function collapseExplorer() {
  els.filesToggle.classList.remove('expanded');
  els.files.classList.add('collapsed');
}

// -----------------------------------------------------------------------
// URL change detection
// -----------------------------------------------------------------------
export function watchNavigation() {
  var lastPath = location.pathname;
  setInterval(function () {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      resolveCurrentPage();
    }
  }, 200);
  window.addEventListener('popstate', function () {
    setTimeout(resolveCurrentPage, 50);
  });
}
