/* =========================================================================
   Syntax highlighting — VS Code Dark+ token colors
   ========================================================================= */

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function span(cls, content) {
  return '<span class="' + cls + '">' + content + '</span>';
}

function parseLink(line, start) {
  var closeB = line.indexOf(']', start);
  if (closeB === -1 || line[closeB + 1] !== '(') return null;
  var closeP = line.indexOf(')', closeB + 2);
  if (closeP === -1) return null;
  return {
    text: line.slice(start + 1, closeB),
    url: line.slice(closeB + 2, closeP),
    end: closeP + 1
  };
}

// Highlight inline markdown: bold, italic, code, links, images, HTML
function highlightInline(line) {
  if (!line) return '';

  var result = '';
  var i = 0;
  var len = line.length;

  while (i < len) {
    // Inline code `...`
    if (line[i] === '`') {
      var end = line.indexOf('`', i + 1);
      if (end !== -1) {
        result += span('hl-code-inline', esc(line.slice(i, end + 1)));
        i = end + 1;
        continue;
      }
    }

    // Image ![alt](url)
    if (line[i] === '!' && line[i + 1] === '[') {
      var parsed = parseLink(line, i + 1);
      if (parsed) {
        result += span('hl-image-bang', '!') +
          span('hl-link-punct', '[') +
          span('hl-link-text', esc(parsed.text)) +
          span('hl-link-punct', '](') +
          span('hl-link-url', esc(parsed.url)) +
          span('hl-link-punct', ')');
        i = parsed.end;
        continue;
      }
    }

    // Link [text](url)
    if (line[i] === '[') {
      var parsed = parseLink(line, i);
      if (parsed) {
        result += span('hl-link-punct', '[') +
          span('hl-link-text', esc(parsed.text)) +
          span('hl-link-punct', '](') +
          span('hl-link-url', esc(parsed.url)) +
          span('hl-link-punct', ')');
        i = parsed.end;
        continue;
      }
    }

    // Bold+italic ***text*** or ___text___
    if ((line[i] === '*' || line[i] === '_') && line[i + 1] === line[i] && line[i + 2] === line[i]) {
      var ch = line[i];
      var close = line.indexOf(ch + ch + ch, i + 3);
      if (close !== -1) {
        result += span('hl-bold-italic', esc(line.slice(i, close + 3)));
        i = close + 3;
        continue;
      }
    }

    // Bold **text** or __text__
    if ((line[i] === '*' || line[i] === '_') && line[i + 1] === line[i]) {
      var ch = line[i];
      var close = line.indexOf(ch + ch, i + 2);
      if (close !== -1 && close > i + 2) {
        result += span('hl-bold', esc(line.slice(i, close + 2)));
        i = close + 2;
        continue;
      }
    }

    // Italic *text* or _text_
    if ((line[i] === '*' || line[i] === '_') && i + 1 < len && line[i + 1] !== ' ') {
      var ch = line[i];
      var close = line.indexOf(ch, i + 1);
      if (close !== -1 && line[close - 1] !== ' ') {
        result += span('hl-italic', esc(line.slice(i, close + 1)));
        i = close + 1;
        continue;
      }
    }

    // HTML tags
    if (line[i] === '<') {
      var tagEnd = line.indexOf('>', i);
      if (tagEnd !== -1 && /^<\/?\w/.test(line.slice(i))) {
        result += span('hl-html', esc(line.slice(i, tagEnd + 1)));
        i = tagEnd + 1;
        continue;
      }
    }

    // Plain text — batch consecutive chars
    var next = i + 1;
    while (next < len && !'`[!*_<'.includes(line[next])) next++;
    result += span('hl-text', esc(line.slice(i, next)));
    i = next;
  }

  return result;
}

export function highlight(text) {
  var lines = text.split('\n');
  var out = [];
  var inFrontmatter = false;
  var fmDone = false;
  var inCodeFence = false;
  var codeFenceMarker = '';

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    // --- Fenced code blocks ---
    if (inCodeFence) {
      if (line.trimEnd() === codeFenceMarker) {
        out.push(span('hl-code-fence', esc(line)));
        inCodeFence = false;
        codeFenceMarker = '';
      } else {
        out.push(span('hl-code-body', esc(line)));
      }
      continue;
    }
    var fenceMatch = line.match(/^(`{3,})(.*)/);
    if (fenceMatch && !inFrontmatter) {
      inCodeFence = true;
      codeFenceMarker = fenceMatch[1];
      var lang = fenceMatch[2].trim();
      if (lang) {
        out.push(span('hl-code-fence', esc(fenceMatch[1])) + span('hl-code-lang', esc(lang)));
      } else {
        out.push(span('hl-code-fence', esc(line)));
      }
      continue;
    }

    // --- YAML frontmatter ---
    if (i === 0 && line === '---') {
      inFrontmatter = true;
      out.push(span('hl-fm-delim', '---'));
      continue;
    }
    if (inFrontmatter) {
      if (line === '---') {
        inFrontmatter = false;
        fmDone = true;
        out.push(span('hl-fm-delim', '---'));
        continue;
      }
      // Comment lines
      if (/^\s*#/.test(line)) {
        out.push(span('hl-fm-comment', esc(line)));
        continue;
      }
      // key: value
      var kvMatch = line.match(/^(\s*)([\w.-]+)(\s*:\s*)(.*)/);
      if (kvMatch) {
        out.push(
          esc(kvMatch[1]) +
          span('hl-fm-key', esc(kvMatch[2])) +
          span('hl-fm-delim', esc(kvMatch[3])) +
          (kvMatch[4] ? span('hl-fm-value', esc(kvMatch[4])) : '')
        );
        continue;
      }
      // List items in frontmatter (  - value)
      var fmList = line.match(/^(\s*-\s+)(.*)/);
      if (fmList) {
        out.push(span('hl-fm-delim', esc(fmList[1])) + span('hl-fm-value', esc(fmList[2])));
        continue;
      }
      out.push(span('hl-fm-value', esc(line)));
      continue;
    }

    // --- Headings ---
    if (/^#{1,6}\s/.test(line)) {
      out.push(span('hl-heading', esc(line)));
      continue;
    }

    // --- Blockquote ---
    if (/^>\s?/.test(line)) {
      out.push(span('hl-blockquote', esc(line)));
      continue;
    }

    // --- Horizontal rule ---
    if (/^-{3,}\s*$/.test(line) && fmDone) {
      out.push(span('hl-hr', esc(line)));
      continue;
    }

    // --- Inline anchor {#id} ---
    if (/^\{#[a-z0-9][a-z0-9-]*\}$/.test(line)) {
      out.push(span('hl-anchor', esc(line)));
      continue;
    }

    // --- sitemd button: syntax ---
    if (/^button:\s+/.test(line)) {
      out.push(span('hl-button', esc(line)));
      continue;
    }

    // --- sitemd embed: syntax ---
    if (/^embed:\s+/.test(line)) {
      out.push(span('hl-embed', esc(line)));
      continue;
    }

    // --- List items ---
    var listMatch = line.match(/^(\s*)([-*]|\d+\.)\s/);
    if (listMatch) {
      var prefix = listMatch[1] + listMatch[2];
      var rest = line.slice(prefix.length);
      out.push(span('hl-list-mark', esc(prefix)) + highlightInline(rest));
      continue;
    }

    // --- Inline highlighting for normal lines ---
    out.push(highlightInline(line));
  }

  return out.join('\n');
}
