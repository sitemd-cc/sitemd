const { normalizeIndent } = require('./parse-indent');

// ---------------------------------------------------------------------------
// Footer parsers — social links from raw frontmatter
// ---------------------------------------------------------------------------
function parseFooterSocial(raw) {
  const match = raw.match(/^\s*---[ \t]*\n([\s\S]*?)\n---/);
  if (!match) return [];

  const lines = match[1].split('\n');
  const social = [];
  let inSocial = false;

  for (const line of lines) {
    if (line.trim().startsWith('#')) continue;

    if (/^social\s*:/.test(line)) {
      inSocial = true;
      if (line.includes('[]')) return [];
      continue;
    }

    if (inSocial && /^[a-zA-Z]/.test(line)) {
      inSocial = false;
      continue;
    }

    if (!inSocial) continue;

    if (/^\s+- /.test(line)) {
      const content = line.replace(/^\s+- /, '').trim();
      const colonIdx = content.indexOf(': ');
      if (colonIdx !== -1) {
        const platform = content.slice(0, colonIdx).trim();
        let url = content.slice(colonIdx + 2).trim();
        // Bare email addresses -> mailto: links
        if (!url.startsWith('mailto:') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) {
          url = 'mailto:' + url;
        }
        social.push({ platform, url });
      }
    }
  }

  return social;
}

// ---------------------------------------------------------------------------
// Groups parser — named page collections from settings/groups.md
// ---------------------------------------------------------------------------
function parseGroups(raw) {
  const match = raw.match(/^\s*---[ \t]*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const lines = normalizeIndent(match[1]).split('\n');
  const groups = {};
  let inGroups = false;
  let currentName = null;
  let inItems = false;
  let inLocations = false;
  let inSidebar = false;

  // Lazy-load parseLinkEntry to avoid circular dependency
  let _parseLinkEntry;
  function parseLinkEntry(str) {
    if (!_parseLinkEntry) _parseLinkEntry = require('./parse-links').parseLinkEntry;
    return _parseLinkEntry(str);
  }

  for (const line of lines) {
    if (line.trim().startsWith('#')) continue;

    if (/^groups\s*:/.test(line)) {
      inGroups = true;
      inItems = false;
      inLocations = false;
      inSidebar = false;
      if (line.includes('[]')) return {};
      continue;
    }

    // Stop if we hit another top-level key
    if (inGroups && /^[a-zA-Z]/.test(line)) {
      inGroups = false;
      continue;
    }

    if (!inGroups) continue;

    // Group name: "  - name: docs"
    if (/^  - name\s*:/.test(line)) {
      currentName = line.replace(/^  - name\s*:\s*/, '').trim();
      groups[currentName] = { indexPage: null, items: [], locations: null };
      inItems = false;
      inLocations = false;
      inSidebar = false;
      continue;
    }

    // Slug: "    slug: my-group" — optional URL-friendly key (defaults to kebab-case of name)
    if (/^\s+slug\s*:/.test(line) && currentName && !inItems && !inLocations) {
      groups[currentName].slug = line.replace(/^\s+slug\s*:\s*/, '').trim();
      continue;
    }

    // Feed: "    feed: true"
    if (/^\s+feed\s*:/.test(line) && currentName && !inItems && !inLocations) {
      groups[currentName].feed = line.replace(/^\s+feed\s*:\s*/, '').trim() === 'true';
      continue;
    }

    // Index page: "    indexPage: path/to/page.md"
    if (/^\s+indexPage\s*:/.test(line) && currentName) {
      const val = line.replace(/^\s+indexPage\s*:\s*/, '').trim();
      if (val) groups[currentName].indexPage = val;
      inItems = false;
      inLocations = false;
      inSidebar = false;
      continue;
    }

    // Search settings: "    search: show" and "    searchScope: group"
    if (/^\s+search\s*:/.test(line) && currentName && !inItems && !inLocations) {
      groups[currentName].search = line.replace(/^\s+search\s*:\s*/, '').trim();
      continue;
    }
    if (/^\s+searchScope\s*:/.test(line) && currentName && !inItems && !inLocations) {
      groups[currentName].searchScope = line.replace(/^\s+searchScope\s*:\s*/, '').trim();
      continue;
    }
    if (/^\s+anchorsDisplay\s*:/.test(line) && currentName && !inItems) {
      groups[currentName].anchorsDisplay = line.replace(/^\s+anchorsDisplay\s*:\s*/, '').trim();
      continue;
    }
    if (/^\s+itemOrder\s*:/.test(line) && currentName && !inItems && !inLocations) {
      groups[currentName].itemOrder = line.replace(/^\s+itemOrder\s*:\s*/, '').trim();
      continue;
    }

    // Locations key: "    locations:"
    if (/^\s+locations\s*:/.test(line) && currentName) {
      inLocations = true;
      inItems = false;
      inSidebar = false;
      groups[currentName].locations = { sidebar: [], header: false, footer: false };
      if (line.includes('[]')) continue; // locations: [] — empty
      continue;
    }

    // Items/links key: "    items:" or "    links:" (legacy)
    if (/^\s+(?:items|links)\s*:/.test(line) && currentName) {
      inItems = true;
      inLocations = false;
      inSidebar = false;
      continue;
    }

    // Inside locations block (6-space indent: "      - header")
    if (inLocations && !inSidebar && /^\s{6}- /.test(line) && currentName) {
      const content = line.replace(/^\s+- /, '').trim();
      if (content === 'header') {
        groups[currentName].locations.header = true;
      } else if (content === 'footer') {
        groups[currentName].locations.footer = true;
      } else if (content.startsWith('sidebar')) {
        inSidebar = true;
        // "sidebar:" with colon means nested list follows
        // "sidebar" without colon would be a bare flag (treat as sidebar on own group)
        if (!content.includes(':')) {
          groups[currentName].locations.sidebar.push({ type: 'group', name: currentName });
          inSidebar = false;
        }
      }
      continue;
    }

    // Inside sidebar sub-list (10-space indent: "          - group: docs")
    if (inSidebar && /^\s{10}- /.test(line) && currentName) {
      const content = line.replace(/^\s+- /, '').trim();
      if (content.startsWith('group:')) {
        const name = content.replace(/^group\s*:\s*/, '').trim();
        if (name) groups[currentName].locations.sidebar.push({ type: 'group', name });
      } else if (content) {
        groups[currentName].locations.sidebar.push({ type: 'page', path: content });
      }
      continue;
    }

    // Exit sidebar if we hit a non-sidebar-indent line while in sidebar
    if (inSidebar && !/^\s{10}/.test(line)) {
      inSidebar = false;
      // Fall through to check if it's another locations entry or items entry
      if (/^\s{6}- /.test(line) && inLocations) {
        const content = line.replace(/^\s+- /, '').trim();
        if (content === 'header') {
          groups[currentName].locations.header = true;
        } else if (content === 'footer') {
          groups[currentName].locations.footer = true;
        }
        continue;
      }
    }

    // Anchor sub-item: "        - Label: #anchor" (8-space indent, under a 6-space item)
    if (/^\s{8}- /.test(line) && inItems && currentName) {
      const content = line.replace(/^\s+- /, '').trim();
      const colonHash = content.indexOf(': #');
      if (colonHash !== -1) {
        const label = content.slice(0, colonHash).trim();
        const hash = content.slice(colonHash + 2).trim();
        const items = groups[currentName].items;
        if (items.length > 0) {
          const parent = items[items.length - 1];
          if (!parent.anchors) parent.anchors = [];
          parent.anchors.push({ label, hash });
        }
      }
      continue;
    }

    // Item entry: "      - Label: /slug" or "      - button: Label: /slug"
    if (/^\s{6}- /.test(line) && inItems && currentName) {
      const content = line.replace(/^\s+- /, '').trim();
      if (content.startsWith('button: ') || content.startsWith('cta: ')) {
        const prefix = content.startsWith('button: ') ? 'button: ' : 'cta: ';
        const parsed = parseLinkEntry(content.slice(prefix.length));
        if (parsed) groups[currentName].items.push({ ...parsed, type: 'button' });
      } else {
        const parsed = parseLinkEntry(content);
        if (parsed) groups[currentName].items.push(parsed);
      }
    }
  }

  // Apply defaults: groups with no locations field get sidebar on own members
  for (const [name, group] of Object.entries(groups)) {
    if (!group.locations) {
      group.locations = { sidebar: [{ type: 'group', name }], header: false, footer: false };
    }
  }

  // Default slug to kebab-case of name if not set
  for (const [name, group] of Object.entries(groups)) {
    if (!group.slug) {
      group.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
  }

  return groups;
}

module.exports = { parseFooterSocial, parseGroups };
