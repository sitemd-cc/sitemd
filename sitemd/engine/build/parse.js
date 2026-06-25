const fs = require('fs');
const path = require('path');
const { marked } = require('./lib/marked.min.js');
const { resolveIcon } = require('./icons.js');
const { setPalette, resolveColor } = require('./parse-colors');
const { parseLinkEntry } = require('./parse-links');
const { normalizeIndent } = require('./parse-indent');

// ---------------------------------------------------------------------------
// Frontmatter parser
// ---------------------------------------------------------------------------
function parseFrontmatter(content) {
  const match = content.match(/^\s*---[ \t]*\n([\s\S]*?)\n---[ \t]*\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  let currentKey = null;
  // sidebar: nested form needs structured parsing — extract first, then skip
  // its lines during the flat pass below.
  const sidebarParsed = parseSidebarBlock(match[1]);
  const skipSidebarLines = sidebarParsed && sidebarParsed.skipLines;

  match[1].split('\n').forEach((line, idx) => {
    if (skipSidebarLines && skipSidebarLines.has(idx)) return;
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) return;

    // Indented line — belongs to current key (simple nested support)
    if (line.match(/^\s+/) && currentKey) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        // Array item
        if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
        meta[currentKey].push(trimmed.slice(2).trim());
      } else {
        // Nested key:value — store as flat key
        const [k, ...rest] = trimmed.split(':');
        if (k && rest.length) {
          let nested = rest.join(':').trim();
          if ((nested.startsWith('"') && nested.endsWith('"')) || (nested.startsWith("'") && nested.endsWith("'"))) {
            nested = nested.slice(1, -1);
          }
          meta[`${currentKey}.${k.trim()}`] = nested;
        }
      }
      return;
    }

    // Top-level key:value
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    // Only strip quotes when they form a matching pair wrapping the entire value
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    currentKey = key;
    // Handle YAML inline empty array/object
    if (val === '[]') val = [];
    else if (val === '{}') val = {};
    meta[key] = val;
  });

  if (sidebarParsed) {
    // Strip any flattened keys produced by the simple parser before we knew sidebar was nested
    for (const k of Object.keys(meta)) {
      if (k === 'sidebar' || k.startsWith('sidebar.')) delete meta[k];
    }
    meta.sidebar = sidebarParsed.value;
  }

  return { meta, body: match[2] };
}

// Parse a per-page `sidebar:` frontmatter block.
// Supports three forms:
//   sidebar: self      → 'self'
//   sidebar: none      → 'none'
//   sidebar:           → array of items, each: { label, slug, target?, anchors?: [{label, hash}] }
//     - Label: /url
//       - Sub: #anchor
//     - Other: https://example.com
// Returns { value, skipLines: Set<number> } or null when no `sidebar:` key found.
function parseSidebarBlock(rawFrontmatter) {
  const lines = rawFrontmatter.split('\n');
  let startIdx = -1;
  let inlineVal = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('#') || !line.trim()) continue;
    const m = line.match(/^sidebar\s*:\s*(.*)$/);
    if (m) {
      startIdx = i;
      inlineVal = m[1].trim();
      break;
    }
  }
  if (startIdx === -1) return null;

  const skipLines = new Set([startIdx]);

  if (inlineVal === 'self' || inlineVal === 'none') {
    return { value: inlineVal, skipLines };
  }
  if (inlineVal && inlineVal !== '') {
    // Unknown scalar — treat as opaque string, let the simple parser handle it
    return null;
  }

  // Nested list form — collect indented item lines until we hit a non-indented line
  const items = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { skipLines.add(i); continue; }
    if (line.trim().startsWith('#')) { skipLines.add(i); continue; }
    if (!/^\s/.test(line)) break; // back to top-level key

    // Determine indent depth (in spaces)
    const indentMatch = line.match(/^(\s+)- /);
    if (!indentMatch) break;
    const indent = indentMatch[1].length;
    const content = line.replace(/^\s+- /, '').trim();
    skipLines.add(i);

    if (indent <= 2) {
      // Top-level item
      const parsed = parseLinkEntry(content);
      if (parsed) items.push({ ...parsed });
    } else {
      // Nested anchor / sub-link
      const parsed = parseLinkEntry(content);
      if (parsed && items.length > 0) {
        const parent = items[items.length - 1];
        if (!parent.anchors) parent.anchors = [];
        // Anchors only need label + hash for the existing buildSidebar shape;
        // but we accept any slug (e.g. /other-page) too.
        const hash = parsed.slug && parsed.slug.startsWith('#') ? parsed.slug : parsed.slug;
        parent.anchors.push({ label: parsed.label, hash });
      }
    }
  }

  if (items.length === 0) return null;
  return { value: items, skipLines };
}

// ---------------------------------------------------------------------------
// Nav items parser — handles flat links, nested groups, and CTAs
// ---------------------------------------------------------------------------
function parseNavItems(raw) {
  const match = raw.match(/^\s*---[ \t]*\n([\s\S]*?)\n---/);
  if (!match) return [];

  const lines = normalizeIndent(match[1]).split('\n');
  const items = [];
  let inItems = false;
  let currentGroup = null;

  for (const line of lines) {
    if (line.trim().startsWith('#') || !line.trim()) continue;

    // Detect "items:" key
    if (/^items\s*:/.test(line)) {
      inItems = true;
      continue;
    }

    // Stop at next top-level key (e.g. "social:", "tagline:")
    if (inItems && /^[a-zA-Z]/.test(line)) {
      inItems = false;
    }

    if (!inItems) continue;

    // Top-level item (2-space indent)
    if (/^  - /.test(line) && !/^    /.test(line)) {
      currentGroup = null;
      const content = line.replace(/^  - /, '').trim();

      // Button: "button: Label: /slug" or "button: Label: https://..."
      // Also accepts legacy "cta: " prefix
      if (content.startsWith('button: ') || content.startsWith('cta: ')) {
        const prefix = content.startsWith('button: ') ? 'button: ' : 'cta: ';
        const parsed = parseLinkEntry(content.slice(prefix.length));
        if (parsed) items.push({ ...parsed, type: 'button' });
        continue;
      }

      // Group: "group: group-name" — reference to groups.md, or inline with children
      if (content.startsWith('group: ')) {
        const groupName = content.slice(7).trim();
        if (groupName) {
          const groupRef = groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          currentGroup = { type: 'group', label: groupName, groupRef, children: [] };
          items.push(currentGroup);
        }
        continue;
      }

      // Check if it's a group header (ends with ":" and no URL)
      const parsed = parseLinkEntry(content);
      if (parsed) {
        items.push({ ...parsed, type: 'link' });
      } else if (content.endsWith(':')) {
        // Group header — "Group Label:" (trailing colon, no slug)
        const groupLabel = content.replace(/:$/, '').trim();
        if (groupLabel) {
          currentGroup = { type: 'group', label: groupLabel, children: [] };
          items.push(currentGroup);
        }
      } else if (content.startsWith('mailto:')) {
        const email = content.slice(7);
        items.push({ label: email, slug: content, type: 'link' });
      } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content)) {
        items.push({ label: content, slug: 'mailto:' + content, type: 'link' });
      } else if (content) {
        // Label without slug — auto-generate: "About" → "/about"
        const slug = '/' + content.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        items.push({ label: content, slug, type: 'link' });
      }
      continue;
    }

    // Group setting (4+ space indent, no "- " prefix) — e.g. "    headingLink: /slug"
    if (/^    +[a-zA-Z]/.test(line) && !/^    +- /.test(line) && currentGroup) {
      if (/^\s+headingLink\s*:/.test(line)) {
        currentGroup.headingLink = line.replace(/^\s+headingLink\s*:\s*/, '').trim();
      }
      continue;
    }

    // Child item (4+ space indent) — belongs to current group
    if (/^    +- /.test(line) && currentGroup) {
      const content = line.replace(/^\s+- /, '').trim();
      if (content.startsWith('button: ') || content.startsWith('cta: ')) {
        const prefix = content.startsWith('button: ') ? 'button: ' : 'cta: ';
        const parsed = parseLinkEntry(content.slice(prefix.length));
        if (parsed) currentGroup.children.push({ ...parsed, type: 'button' });
      } else if (content.startsWith('headingLink: ') || content.startsWith('headingLink:')) {
        currentGroup.headingLink = content.replace(/^headingLink\s*:\s*/, '').trim();
      } else {
        let parsed = parseLinkEntry(content);
        if (!parsed && content.startsWith('mailto:')) {
          const email = content.slice(7);
          parsed = { label: email, slug: content };
        } else if (!parsed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content)) {
          parsed = { label: content, slug: 'mailto:' + content };
        } else if (!parsed && content) {
          // Auto-generate slug nested under group: "Child 1" in "Group" → "/group/child-1"
          const groupSlug = currentGroup.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const childSlug = content.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          parsed = { label: content, slug: `/${groupSlug}/${childSlug}` };
        }
        if (parsed) currentGroup.children.push(parsed);
      }
    }
  }

  return items;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Sanitize frontmatter — strip leading whitespace before opening ---
// Use before writing any markdown file to prevent parser failures
// ---------------------------------------------------------------------------
function sanitizeFrontmatter(content) {
  return content.replace(/^\s+(?=---)/, '');
}

module.exports = {
  // Core exports
  setPalette, resolveColor, parseFrontmatter, sanitizeFrontmatter, parseNavItems, escapeRegex,
  // Re-exports from submodules
  ...require('./parse-links'),
  ...require('./parse-embeds'),
  ...require('./parse-cards'),
  ...require('./parse-images'),
  ...require('./parse-authors'),
  ...require('./parse-social'),
};
