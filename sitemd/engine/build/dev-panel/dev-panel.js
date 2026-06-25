(() => {
  // source/sitemd/engine/build/dev-panel/src/highlighter.js
  function esc(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function span(cls, content) {
    return '<span class="' + cls + '">' + content + "</span>";
  }
  function parseLink(line, start) {
    var closeB = line.indexOf("]", start);
    if (closeB === -1 || line[closeB + 1] !== "(") return null;
    var closeP = line.indexOf(")", closeB + 2);
    if (closeP === -1) return null;
    return {
      text: line.slice(start + 1, closeB),
      url: line.slice(closeB + 2, closeP),
      end: closeP + 1
    };
  }
  function highlightInline(line) {
    if (!line) return "";
    var result = "";
    var i = 0;
    var len = line.length;
    while (i < len) {
      if (line[i] === "`") {
        var end = line.indexOf("`", i + 1);
        if (end !== -1) {
          result += span("hl-code-inline", esc(line.slice(i, end + 1)));
          i = end + 1;
          continue;
        }
      }
      if (line[i] === "!" && line[i + 1] === "[") {
        var parsed = parseLink(line, i + 1);
        if (parsed) {
          result += span("hl-image-bang", "!") + span("hl-link-punct", "[") + span("hl-link-text", esc(parsed.text)) + span("hl-link-punct", "](") + span("hl-link-url", esc(parsed.url)) + span("hl-link-punct", ")");
          i = parsed.end;
          continue;
        }
      }
      if (line[i] === "[") {
        var parsed = parseLink(line, i);
        if (parsed) {
          result += span("hl-link-punct", "[") + span("hl-link-text", esc(parsed.text)) + span("hl-link-punct", "](") + span("hl-link-url", esc(parsed.url)) + span("hl-link-punct", ")");
          i = parsed.end;
          continue;
        }
      }
      if ((line[i] === "*" || line[i] === "_") && line[i + 1] === line[i] && line[i + 2] === line[i]) {
        var ch = line[i];
        var close = line.indexOf(ch + ch + ch, i + 3);
        if (close !== -1) {
          result += span("hl-bold-italic", esc(line.slice(i, close + 3)));
          i = close + 3;
          continue;
        }
      }
      if ((line[i] === "*" || line[i] === "_") && line[i + 1] === line[i]) {
        var ch = line[i];
        var close = line.indexOf(ch + ch, i + 2);
        if (close !== -1 && close > i + 2) {
          result += span("hl-bold", esc(line.slice(i, close + 2)));
          i = close + 2;
          continue;
        }
      }
      if ((line[i] === "*" || line[i] === "_") && i + 1 < len && line[i + 1] !== " ") {
        var ch = line[i];
        var close = line.indexOf(ch, i + 1);
        if (close !== -1 && line[close - 1] !== " ") {
          result += span("hl-italic", esc(line.slice(i, close + 1)));
          i = close + 1;
          continue;
        }
      }
      if (line[i] === "<") {
        var tagEnd = line.indexOf(">", i);
        if (tagEnd !== -1 && /^<\/?\w/.test(line.slice(i))) {
          result += span("hl-html", esc(line.slice(i, tagEnd + 1)));
          i = tagEnd + 1;
          continue;
        }
      }
      var next = i + 1;
      while (next < len && !"`[!*_<".includes(line[next])) next++;
      result += span("hl-text", esc(line.slice(i, next)));
      i = next;
    }
    return result;
  }
  function highlight(text) {
    var lines = text.split("\n");
    var out = [];
    var inFrontmatter = false;
    var fmDone = false;
    var inCodeFence = false;
    var codeFenceMarker = "";
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (inCodeFence) {
        if (line.trimEnd() === codeFenceMarker) {
          out.push(span("hl-code-fence", esc(line)));
          inCodeFence = false;
          codeFenceMarker = "";
        } else {
          out.push(span("hl-code-body", esc(line)));
        }
        continue;
      }
      var fenceMatch = line.match(/^(`{3,})(.*)/);
      if (fenceMatch && !inFrontmatter) {
        inCodeFence = true;
        codeFenceMarker = fenceMatch[1];
        var lang = fenceMatch[2].trim();
        if (lang) {
          out.push(span("hl-code-fence", esc(fenceMatch[1])) + span("hl-code-lang", esc(lang)));
        } else {
          out.push(span("hl-code-fence", esc(line)));
        }
        continue;
      }
      if (i === 0 && line === "---") {
        inFrontmatter = true;
        out.push(span("hl-fm-delim", "---"));
        continue;
      }
      if (inFrontmatter) {
        if (line === "---") {
          inFrontmatter = false;
          fmDone = true;
          out.push(span("hl-fm-delim", "---"));
          continue;
        }
        if (/^\s*#/.test(line)) {
          out.push(span("hl-fm-comment", esc(line)));
          continue;
        }
        var kvMatch = line.match(/^(\s*)([\w.-]+)(\s*:\s*)(.*)/);
        if (kvMatch) {
          out.push(
            esc(kvMatch[1]) + span("hl-fm-key", esc(kvMatch[2])) + span("hl-fm-delim", esc(kvMatch[3])) + (kvMatch[4] ? span("hl-fm-value", esc(kvMatch[4])) : "")
          );
          continue;
        }
        var fmList = line.match(/^(\s*-\s+)(.*)/);
        if (fmList) {
          out.push(span("hl-fm-delim", esc(fmList[1])) + span("hl-fm-value", esc(fmList[2])));
          continue;
        }
        out.push(span("hl-fm-value", esc(line)));
        continue;
      }
      if (/^#{1,6}\s/.test(line)) {
        out.push(span("hl-heading", esc(line)));
        continue;
      }
      if (/^>\s?/.test(line)) {
        out.push(span("hl-blockquote", esc(line)));
        continue;
      }
      if (/^-{3,}\s*$/.test(line) && fmDone) {
        out.push(span("hl-hr", esc(line)));
        continue;
      }
      if (/^\{#[a-z0-9][a-z0-9-]*\}$/.test(line)) {
        out.push(span("hl-anchor", esc(line)));
        continue;
      }
      if (/^button:\s+/.test(line)) {
        out.push(span("hl-button", esc(line)));
        continue;
      }
      if (/^embed:\s+/.test(line)) {
        out.push(span("hl-embed", esc(line)));
        continue;
      }
      var listMatch = line.match(/^(\s*)([-*]|\d+\.)\s/);
      if (listMatch) {
        var prefix = listMatch[1] + listMatch[2];
        var rest = line.slice(prefix.length);
        out.push(span("hl-list-mark", esc(prefix)) + highlightInline(rest));
        continue;
      }
      out.push(highlightInline(line));
    }
    return out.join("\n");
  }

  // source/sitemd/engine/build/dev-panel/src/search.js
  function findMatches(text, query) {
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
  function applySearchHighlights(html, matches, currentIdx) {
    if (!matches.length) return html;
    var markStarts = {};
    var markEnds = {};
    for (var m = 0; m < matches.length; m++) {
      markStarts[matches[m].index] = m;
      markEnds[matches[m].index + matches[m].length] = true;
    }
    var result = "";
    var textPos = 0;
    var inMark = false;
    var i = 0;
    var len = html.length;
    while (i < len) {
      if (html[i] === "<") {
        var tagEnd = html.indexOf(">", i);
        if (tagEnd === -1) {
          result += html.slice(i);
          break;
        }
        var tag = html.slice(i, tagEnd + 1);
        if (inMark) {
          result += "</mark>" + tag;
          var cls = "search-match";
          for (var mi = 0; mi < matches.length; mi++) {
            if (textPos > matches[mi].index && textPos < matches[mi].index + matches[mi].length) {
              if (mi === currentIdx) cls = "search-match active";
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
      if (html[i] === "&") {
        if (html.slice(i, i + 5) === "&amp;") {
          consumed = 5;
        } else if (html.slice(i, i + 4) === "&lt;") {
          consumed = 4;
        } else if (html.slice(i, i + 4) === "&gt;") {
          consumed = 4;
        }
      }
      if (inMark && markEnds[textPos]) {
        result += "</mark>";
        inMark = false;
      }
      if (!inMark && markStarts[textPos] !== void 0) {
        var mIdx = markStarts[textPos];
        var cls = mIdx === currentIdx ? "search-match active" : "search-match";
        result += '<mark class="' + cls + '">';
        inMark = true;
      }
      result += html.slice(i, i + consumed);
      textPos++;
      i += consumed;
    }
    if (inMark) result += "</mark>";
    return result;
  }
  function highlightPreview(query) {
    if (typeof highlightInPage === "function") {
      highlightInPage(query);
    }
  }
  function scrollPreviewToMatch(idx) {
    var content = document.querySelector(".content");
    if (!content) return;
    var marks = content.querySelectorAll("mark.search-highlight");
    if (!marks.length) return;
    for (var mi = 0; mi < marks.length; mi++) {
      marks[mi].classList.remove("active");
    }
    var match = state.search.matches[idx];
    if (!match) return;
    var text = els.textarea.value;
    var fmEnd = 0;
    var lines = text.split("\n");
    if (lines[0] === "---") {
      for (var li = 1; li < lines.length; li++) {
        fmEnd += lines[li - 1].length + 1;
        if (lines[li] === "---") {
          fmEnd += 4;
          break;
        }
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
    marks[targetIdx].classList.add("active");
    marks[targetIdx].scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function updateSearchCount() {
    if (!state.search.matches.length) {
      els.searchCount.textContent = state.search.query ? "No results" : "";
    } else {
      els.searchCount.textContent = state.search.current + 1 + " of " + state.search.matches.length;
    }
  }
  function scrollToMatch(idx) {
    var match = state.search.matches[idx];
    if (!match) return;
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        var activeMark = els.pre.querySelector("mark.search-match.active");
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
  function executeSearch() {
    var query = els.searchInput.value;
    state.search.query = query;
    state.search.matches = findMatches(els.textarea.value, query);
    state.search.current = state.search.matches.length > 0 ? 0 : -1;
    updateSearchCount();
    highlightPreview(query);
    syncHighlight();
    if (state.search.current >= 0) scrollToMatch(state.search.current);
  }
  function searchNext() {
    if (!state.search.matches.length) return;
    state.search.current = (state.search.current + 1) % state.search.matches.length;
    updateSearchCount();
    syncHighlight();
    scrollToMatch(state.search.current);
  }
  function searchPrev() {
    if (!state.search.matches.length) return;
    state.search.current = (state.search.current - 1 + state.search.matches.length) % state.search.matches.length;
    updateSearchCount();
    syncHighlight();
    scrollToMatch(state.search.current);
  }
  function openSearch() {
    state.search.active = true;
    els.searchBar.classList.add("visible");
    els.searchInput.focus();
    var sel = els.textarea.value.substring(els.textarea.selectionStart, els.textarea.selectionEnd);
    if (sel && sel.length < 100 && sel.indexOf("\n") === -1) {
      els.searchInput.value = sel;
    }
    if (els.searchInput.value) {
      els.searchInput.select();
      executeSearch();
    }
  }
  function closeSearch() {
    state.search.active = false;
    state.search.query = "";
    state.search.matches = [];
    state.search.current = -1;
    els.searchBar.classList.remove("visible");
    els.searchInput.value = "";
    els.searchCount.textContent = "";
    syncHighlight();
    if (typeof clearHighlights === "function") clearHighlights();
    els.textarea.focus();
  }

  // source/sitemd/engine/build/dev-panel/src/editor.js
  var highlightRAF = null;
  function syncHighlight() {
    if (highlightRAF) return;
    highlightRAF = requestAnimationFrame(function() {
      highlightRAF = null;
      var html = highlight(els.textarea.value);
      if (state.search.active && state.search.matches.length) {
        html = applySearchHighlights(html, state.search.matches, state.search.current);
      }
      els.pre.innerHTML = html + "\n";
      syncScroll();
    });
  }
  function syncScroll() {
    els.pre.scrollTop = els.textarea.scrollTop;
    els.pre.scrollLeft = els.textarea.scrollLeft;
  }
  function stripComments(content) {
    var lines = content.split("\n");
    var comments = [];
    var stripped = [];
    var inFM = false, fmDone = false;
    for (var i = 0; i < lines.length; i++) {
      if (i === 0 && lines[i] === "---") {
        inFM = true;
        stripped.push(lines[i]);
        continue;
      }
      if (inFM && lines[i] === "---") {
        inFM = false;
        fmDone = true;
        stripped.push(lines[i]);
        continue;
      }
      if (inFM && /^\s*#/.test(lines[i])) {
        comments.push({ line: stripped.length, text: lines[i] });
      } else {
        stripped.push(lines[i]);
      }
    }
    return { stripped: stripped.join("\n"), comments };
  }
  function restoreComments(content, comments) {
    if (!comments || !comments.length) return content;
    var lines = content.split("\n");
    for (var i = 0; i < comments.length; i++) {
      lines.splice(comments[i].line + i, 0, comments[i].text);
    }
    return lines.join("\n");
  }
  function getFullContent() {
    var val = els.textarea.value;
    if (state.hideComments && state.strippedComments && state.strippedComments.length) {
      return restoreComments(val, state.strippedComments);
    }
    return val;
  }
  function applyCommentVisibility(content) {
    if (state.hideComments) {
      var result = stripComments(content);
      state.strippedComments = result.comments;
      return result.stripped;
    }
    state.strippedComments = [];
    return content;
  }
  function onInput() {
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
      els.headerFile.innerHTML = state.currentFile + (isDirty ? '<span class="dirty-indicator"> \u25CF</span>' : "");
    }
  }

  // source/sitemd/engine/build/dev-panel/src/file-list.js
  function loadSlugMap() {
    return fetchJSON("/__dev/slug-map").then(function(map) {
      state.slugMap = map;
      state.reverseSlugMap = {};
      for (var slug in map) {
        state.reverseSlugMap[map[slug]] = slug;
      }
    });
  }
  function currentSlug() {
    var p = location.pathname;
    return p === "/" ? "/" : p.replace(/\/$/, "");
  }
  function navigatePreview(slug) {
    if (window.__sitemdNavigate) {
      window.__sitemdNavigate(slug);
    } else {
      location.href = slug;
    }
  }
  function resolveCurrentPage(forceLoad) {
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
  function currentSlugFn() {
    return currentSlug();
  }
  function loadFileList() {
    fetchJSON("/__dev/files").then(function(data) {
      state.fileList = data;
      renderFileList();
    });
  }
  function renderFileList() {
    if (!state.fileList) return;
    var expandedDirs = {};
    var expandedSections = {};
    els.files.querySelectorAll(".dev-panel-dir-toggle.expanded").forEach(function(el) {
      expandedDirs[el.getAttribute("data-dir")] = true;
    });
    els.files.querySelectorAll(".dev-panel-section-toggle.expanded").forEach(function(el) {
      expandedSections[el.getAttribute("data-section")] = true;
    });
    var html = "";
    html += renderSection("pages", state.fileList.pages || [], expandedDirs, expandedSections);
    if ((state.fileList["account-pages"] || []).length) html += renderSection("account-pages", state.fileList["account-pages"], expandedDirs, expandedSections);
    if ((state.fileList["auth-pages"] || []).length) html += renderSection("auth-pages", state.fileList["auth-pages"], expandedDirs, expandedSections);
    if ((state.fileList["gated-pages"] || []).length) html += renderSection("gated-pages", state.fileList["gated-pages"], expandedDirs, expandedSections);
    if ((state.fileList.modals || []).length) html += renderSection("modals", state.fileList.modals || [], expandedDirs, expandedSections);
    html += renderSection("settings", state.fileList.settings || [], expandedDirs, expandedSections);
    els.files.innerHTML = html;
    updateActiveFile();
  }
  function renderSection(prefix, files, expandedDirs, expandedSections) {
    var html = "";
    var dirs = {};
    var rootFiles = [];
    files.forEach(function(f) {
      var parts = f.path.split("/");
      if (parts.length > 1) {
        var dir = parts[0];
        if (!dirs[dir]) dirs[dir] = [];
        dirs[dir].push(f);
      } else {
        rootFiles.push(f);
      }
    });
    var secExpanded = Object.keys(expandedSections).length ? expandedSections[prefix] : true;
    html += '<div class="dev-panel-section-toggle' + (secExpanded ? " expanded" : "") + '" data-section="' + prefix + '"><svg viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' + prefix + "</div>";
    html += '<div class="dev-panel-section-children" data-section-parent="' + prefix + '"' + (secExpanded ? "" : " hidden") + ">";
    rootFiles.forEach(function(f) {
      html += fileHTML(prefix + "/" + f.path, f.path, 0);
    });
    Object.keys(dirs).sort().forEach(function(dir) {
      var dirKey = prefix + "/" + dir;
      var dirExp = expandedDirs[dirKey] || false;
      html += '<div class="dev-panel-dir-toggle' + (dirExp ? " expanded" : "") + '" data-dir="' + dirKey + '"><svg viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' + dir + "/</div>";
      html += '<div class="dev-panel-dir-children" data-parent="' + dirKey + '"' + (dirExp ? "" : " hidden") + ">";
      var subdirs = {};
      var dirFiles = [];
      dirs[dir].forEach(function(f) {
        var rest = f.path.slice(dir.length + 1);
        var parts = rest.split("/");
        if (parts.length > 1) {
          var subdir = parts[0];
          if (!subdirs[subdir]) subdirs[subdir] = [];
          subdirs[subdir].push({ path: rest, fullPath: f.path });
        } else {
          dirFiles.push(f);
        }
      });
      dirFiles.forEach(function(f) {
        var name = f.path.split("/").pop();
        html += fileHTML(prefix + "/" + f.path, name, 1);
      });
      Object.keys(subdirs).sort().forEach(function(subdir) {
        var subKey = prefix + "/" + dir + "/" + subdir;
        var subExp = expandedDirs[subKey] || false;
        html += '<div class="dev-panel-dir-toggle' + (subExp ? " expanded" : "") + '" data-dir="' + subKey + '" style="padding-left:24px"><svg viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' + subdir + "/</div>";
        html += '<div class="dev-panel-dir-children" data-parent="' + subKey + '"' + (subExp ? "" : " hidden") + ">";
        subdirs[subdir].forEach(function(sf) {
          var name = sf.fullPath.split("/").pop();
          html += fileHTML(prefix + "/" + sf.fullPath, name, 2);
        });
        html += "</div>";
      });
      html += "</div>";
    });
    html += "</div>";
    return html;
  }
  function fileHTML(fullPath, label, depth) {
    var cls = "dev-panel-file" + (state.currentFile === fullPath ? " active" : "");
    var pad = 12 + depth * 12;
    return '<div class="' + cls + '" data-path="' + fullPath + '" style="padding-left:' + pad + 'px"><svg class="dev-panel-file-icon" viewBox="0 0 16 16"><path d="M13 4H8L6.5 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1z" fill="none" stroke="currentColor" stroke-width="1"/></svg>' + label + "</div>";
  }
  function updateActiveFile() {
    var items = els.files.querySelectorAll(".dev-panel-file");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("active", items[i].getAttribute("data-path") === state.currentFile);
    }
  }
  function loadFile(filePath, skipNav, preserveScroll) {
    if (state.search.active) closeSearch();
    fetch("/__dev/file?path=" + encodeURIComponent(filePath)).then(function(r) {
      return r.text();
    }).then(function(content) {
      var scrollTop = preserveScroll ? els.textarea.scrollTop : 0;
      state.currentFile = filePath;
      state.originalContent = content;
      state.dirty = false;
      localStorage.setItem("sitemd-dev-file", filePath);
      els.textarea.value = applyCommentVisibility(content);
      els.textarea.scrollTop = scrollTop;
      syncHighlight();
      els.headerFile.textContent = filePath;
      els.saveBtn.disabled = true;
      updateActiveFile();
      if (skipNav) {
        setStatus("Opened " + filePath);
      } else {
        var slug = state.reverseSlugMap[filePath];
        if (slug && slug !== currentSlug()) {
          navigatePreview(slug);
          setSiteStatus("Navigated to " + slug);
        }
      }
    }).catch(function() {
      setStatus("Failed to load " + filePath);
    });
  }
  function collapseExplorer() {
    els.filesToggle.classList.remove("expanded");
    els.files.classList.add("collapsed");
  }
  function watchNavigation() {
    var lastPath = location.pathname;
    setInterval(function() {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        resolveCurrentPage();
      }
    }, 200);
    window.addEventListener("popstate", function() {
      setTimeout(resolveCurrentPage, 50);
    });
  }

  // source/sitemd/engine/build/dev-panel/src/save.js
  function saveFile() {
    if (!state.currentFile || state.saving || !state.dirty) return;
    state.saving = true;
    els.saveBtn.disabled = true;
    setStatus("Saving...");
    var cursorStart = els.textarea.selectionStart;
    var cursorEnd = els.textarea.selectionEnd;
    var scrollTop = els.textarea.scrollTop;
    sessionStorage.setItem("sitemd-dev-cursor", JSON.stringify({
      start: cursorStart,
      end: cursorEnd,
      scroll: scrollTop
    }));
    fetch("/__dev/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: state.currentFile, content: getFullContent() })
    }).then(function(r) {
      return r.json();
    }).then(function(data) {
      state.saving = false;
      if (data.ok) {
        state.originalContent = getFullContent();
        state.dirty = false;
        els.saveBtn.disabled = true;
        state.justSaved = true;
        setStatus("Saved");
        setSiteStatus("Reloaded");
      } else {
        setStatus("Save failed: " + (data.error || "unknown"));
        els.saveBtn.disabled = false;
      }
    }).catch(function() {
      state.saving = false;
      setStatus("Save failed (network error)");
      els.saveBtn.disabled = false;
    });
  }
  function smartReload() {
    loadSlugMap();
    loadFileList();
    var reload = window.__sitemdReloadContent ? window.__sitemdReloadContent() : Promise.resolve();
    reload.then(function() {
      if (typeof window.initSidebarSearch === "function") window.initSidebarSearch();
      if (typeof window.__sitemdClearCache === "function") window.__sitemdClearCache();
      var cursor = sessionStorage.getItem("sitemd-dev-cursor");
      if (cursor) {
        try {
          cursor = JSON.parse(cursor);
          els.textarea.selectionStart = cursor.start;
          els.textarea.selectionEnd = cursor.end;
          els.textarea.scrollTop = cursor.scroll;
        } catch (e) {
        }
        sessionStorage.removeItem("sitemd-dev-cursor");
      }
      if (state.currentFile && !state.dirty) {
        fetch("/__dev/file?path=" + encodeURIComponent(state.currentFile)).then(function(r) {
          return r.text();
        }).then(function(content) {
          if (content !== state.originalContent) {
            loadFile(state.currentFile, true, true);
          }
        }).catch(function() {
        });
      }
      if (!state.justSaved) {
        setStatus("Reloaded");
      }
      state.justSaved = false;
    }).catch(function() {
      location.reload();
    });
  }

  // source/sitemd/engine/build/dev-panel/src/index.js
  var state = {
    open: localStorage.getItem("sitemd-dev-panel") === "open",
    currentFile: localStorage.getItem("sitemd-dev-file") || null,
    originalContent: "",
    dirty: false,
    slugMap: {},
    reverseSlugMap: {},
    fileList: null,
    saving: false,
    hideComments: localStorage.getItem("sitemd-dev-hide-comments") !== "false",
    strippedComments: [],
    search: { active: false, query: "", matches: [], current: -1 },
    justSaved: false
  };
  var els = {};
  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }
  function fetchJSON(url) {
    return fetch(url).then(function(r) {
      return r.json();
    });
  }
  var statusTimer = null;
  function setStatus(msg) {
    if (!els.status || !els.statusWrap) return;
    els.status.textContent = msg;
    els.statusWrap.classList.add("visible");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function() {
      els.statusWrap.classList.remove("visible");
    }, 1200);
  }
  var siteStatusTimer = null;
  function setSiteStatus(msg) {
    if (!els.siteStatus || !els.siteStatusWrap) return;
    els.siteStatus.textContent = msg;
    els.siteStatusWrap.classList.add("visible");
    clearTimeout(siteStatusTimer);
    siteStatusTimer = setTimeout(function() {
      els.siteStatusWrap.classList.remove("visible");
    }, 1200);
  }
  function createPanel() {
    var panel = document.createElement("div");
    panel.className = "dev-panel" + (state.open ? " is-open" : "");
    panel.innerHTML = '<div class="dev-panel-toolbar"><button class="dev-panel-files-toggle"><svg viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>sitemd dev panel</button><span class="dev-panel-header-file">No file open</span><div class="dev-panel-header-actions"><button class="dev-panel-btn save-btn" disabled>Save</button></div></div><div class="dev-panel-files collapsed"></div><div class="dev-panel-editor"><div class="dev-panel-status"><span class="dev-panel-status-msg"></span></div><label class="dev-panel-hide-comments"><span class="dev-panel-hide-comments-inner"><span class="dev-panel-hide-comments-label">comments</span><span class="dev-panel-switch' + (state.hideComments ? "" : " on") + '"><span class="dev-panel-switch-thumb"></span></span></span></label><div class="dev-panel-search"><input type="text" class="dev-panel-search-input" placeholder="Find..." spellcheck="false"><span class="dev-panel-search-count"></span><button class="dev-panel-search-prev" aria-label="Previous match"><svg viewBox="0 0 10 10"><path d="M2 7l3-4 3 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button><button class="dev-panel-search-next" aria-label="Next match"><svg viewBox="0 0 10 10"><path d="M2 3l3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button><button class="dev-panel-search-close" aria-label="Close search"><svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button></div><div class="dev-panel-editor-wrap"><pre></pre><textarea spellcheck="false" placeholder="Select a file to edit..."></textarea></div></div>';
    document.body.appendChild(panel);
    var toggle = document.createElement("button");
    toggle.className = "dev-panel-toggle";
    toggle.setAttribute("aria-label", "Toggle dev panel");
    toggle.setAttribute("data-tooltip", (navigator.platform.indexOf("Mac") > -1 ? "⌘" : "Ctrl+") + "/");
    toggle.innerHTML = '<svg viewBox="0 0 10 10"><path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
    document.body.appendChild(toggle);
    var siteStatus = document.createElement("div");
    siteStatus.className = "dev-site-status";
    siteStatus.innerHTML = '<span class="dev-site-status-msg"></span>';
    document.body.appendChild(siteStatus);
    els.panel = panel;
    els.toggle = toggle;
    els.headerFile = $(".dev-panel-header-file", panel);
    els.saveBtn = $(".save-btn", panel);
    els.filesToggle = $(".dev-panel-files-toggle", panel);
    els.files = $(".dev-panel-files", panel);
    els.editorWrap = $(".dev-panel-editor-wrap", panel);
    els.pre = $("pre", panel);
    els.textarea = $("textarea", panel);
    els.statusWrap = $(".dev-panel-status", panel);
    els.status = $(".dev-panel-status-msg", panel);
    els.siteStatusWrap = siteStatus;
    els.siteStatus = $(".dev-site-status-msg", siteStatus);
    els.hideCommentsToggle = $(".dev-panel-hide-comments", panel);
    els.hideCommentsSwitch = $(".dev-panel-switch", panel);
    els.searchBar = $(".dev-panel-search", panel);
    els.searchInput = $(".dev-panel-search-input", panel);
    els.searchCount = $(".dev-panel-search-count", panel);
    els.searchPrev = $(".dev-panel-search-prev", panel);
    els.searchNext = $(".dev-panel-search-next", panel);
    els.searchClose = $(".dev-panel-search-close", panel);
    if (state.open) document.body.classList.add("dev-panel-open");
  }
  function togglePanel() {
    state.open = !state.open;
    els.panel.classList.toggle("is-open", state.open);
    document.body.classList.toggle("dev-panel-open", state.open);
    localStorage.setItem("sitemd-dev-panel", state.open ? "open" : "closed");
  }
  window.__sitemdDevPanel = true;
  function initSSE() {
    var es = new EventSource("/__reload");
    es.onmessage = function(e) {
      if (e.data === "reload") {
        smartReload();
      }
    };
  }
  function bindEvents() {
    els.toggle.addEventListener("click", togglePanel);
    els.filesToggle.addEventListener("click", function() {
      var expanding = !els.filesToggle.classList.contains("expanded");
      els.filesToggle.classList.toggle("expanded", expanding);
      els.files.classList.toggle("collapsed", !expanding);
    });
    els.files.addEventListener("click", function(e) {
      var secToggle = e.target.closest(".dev-panel-section-toggle");
      if (secToggle) {
        var secKey = secToggle.getAttribute("data-section");
        var children = els.files.querySelector('.dev-panel-section-children[data-section-parent="' + secKey + '"]');
        if (children) {
          var opening = children.hidden;
          children.hidden = !opening;
          secToggle.classList.toggle("expanded", opening);
        }
        return;
      }
      var dirToggle = e.target.closest(".dev-panel-dir-toggle");
      if (dirToggle) {
        var dirKey = dirToggle.getAttribute("data-dir");
        var children = els.files.querySelector('.dev-panel-dir-children[data-parent="' + dirKey + '"]');
        if (children) {
          var opening = children.hidden;
          children.hidden = !opening;
          dirToggle.classList.toggle("expanded", opening);
        }
        return;
      }
      var item = e.target.closest(".dev-panel-file");
      if (!item) return;
      loadFile(item.getAttribute("data-path"));
      collapseExplorer();
    });
    els.hideCommentsToggle.addEventListener("click", function() {
      var fullContent = getFullContent();
      state.hideComments = !state.hideComments;
      localStorage.setItem("sitemd-dev-hide-comments", state.hideComments);
      els.hideCommentsSwitch.classList.toggle("on", !state.hideComments);
      els.textarea.value = applyCommentVisibility(fullContent);
      if (state.search.active && state.search.query) {
        state.search.matches = findMatches(els.textarea.value, state.search.query);
        state.search.current = state.search.matches.length > 0 ? 0 : -1;
        updateSearchCount();
      }
      syncHighlight();
      setStatus(state.hideComments ? "Comments hidden" : "Comments shown");
    });
    els.textarea.addEventListener("input", onInput);
    els.textarea.addEventListener("scroll", function() {
      syncScroll();
      if (els.textarea.scrollTop > 0) {
        els.hideCommentsToggle.classList.add("scrolled");
      } else {
        els.hideCommentsToggle.classList.remove("scrolled");
      }
    });
    els.panel.addEventListener("wheel", function(e) {
      var target = e.target.closest(".dev-panel-editor-wrap textarea, .dev-panel-files");
      if (!target) return;
      var atTop = target.scrollTop === 0;
      var atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 1;
      if (atTop && e.deltaY < 0 || atBottom && e.deltaY > 0) {
        e.preventDefault();
      }
    }, { passive: false });
    els.saveBtn.addEventListener("click", saveFile);
    document.addEventListener("keydown", function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        togglePanel();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        if (state.currentFile && state.dirty) {
          e.preventDefault();
          saveFile();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f" && state.open && state.currentFile) {
        e.preventDefault();
        openSearch();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        var slug = currentSlugFn();
        var previewUrl = slug === "/" ? "/seo-preview" : slug + "/seo-preview";
        window.open(previewUrl, "_blank");
      }
    });
    els.searchInput.addEventListener("input", function() {
      executeSearch();
    });
    els.searchInput.addEventListener("keydown", function(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeSearch();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) searchPrev();
        else searchNext();
      }
    });
    els.searchPrev.addEventListener("click", searchPrev);
    els.searchNext.addEventListener("click", searchNext);
    els.searchClose.addEventListener("click", closeSearch);
    els.textarea.addEventListener("keydown", function(e) {
      if (e.key === "Tab") {
        e.preventDefault();
        var start = this.selectionStart;
        var end = this.selectionEnd;
        var val = this.value;
        this.value = val.substring(0, start) + "  " + val.substring(end);
        this.selectionStart = this.selectionEnd = start + 2;
        onInput();
      }
    });
  }
  function init() {
    createPanel();
    bindEvents();
    var slugMapReady = loadSlugMap();
    loadFileList();
    watchNavigation();
    initSSE();
    slugMapReady.then(function() {
      var resolved = resolveCurrentPage(true);
      if (!resolved && state.currentFile) {
        loadFile(state.currentFile, true);
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
