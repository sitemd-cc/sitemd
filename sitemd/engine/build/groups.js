const fs = require('fs');
const path = require('path');
const { loadSettings } = require('./config');
const { parseFrontmatter, parseNavItems, escapeRegex } = require('./parse');
const { findMarkdownFiles } = require('./discover');

// Helper: resolve a group reference (name or slug) to [key, group] pair
function resolveGroup(groups, ref) {
  if (!ref) return [null, null];
  // Direct match by key (name)
  if (groups[ref]) return [ref, groups[ref]];
  // Match by slug
  const slugRef = ref.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const [name, group] of Object.entries(groups)) {
    if (group.slug === slugRef || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === slugRef) {
      return [name, group];
    }
  }
  return [null, null];
}

// Helper: check if a page is covered by a group's sidebar locations
function pageCoveredBySidebar(page, group) {
  const loc = group.locations;
  if (!loc || !loc.sidebar || loc.sidebar.length === 0) return false;
  for (const entry of loc.sidebar) {
    if (entry.type === 'group') {
      // Check if page is a member of this referenced group
      const members = page.meta.groupMember;
      if (members && Array.isArray(members)) {
        const isMember = members.some(m => {
          const n = m.includes(':') ? m.slice(0, m.indexOf(':')).trim() : m.trim();
          return n === entry.name || n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        });
        if (isMember) return true;
      }
    } else if (entry.type === 'page') {
      if (page.relativePath === entry.path) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Groups sync — bidirectional sync between groups.md and page frontmatter,
// legacy migration from layout:docs
// ---------------------------------------------------------------------------
function syncGroups(root) {
  const config = loadSettings(root);
  const pagesDir = path.join(root, config.pagesDir);
  const groupsPath = path.join(root, 'settings', 'groups.md');

  // Read current groups from settings
  let groups = config.groups || {};
  let groupsChanged = false;

  // Force rewrite if groups.md uses old format (links: instead of items:, missing locations:)
  if (fs.existsSync(groupsPath)) {
    const groupsRaw = fs.readFileSync(groupsPath, 'utf-8');
    if (Object.keys(groups).length > 0 && (/^\s+links\s*:/m.test(groupsRaw) || !/^\s+locations\s*:/m.test(groupsRaw))) {
      groupsChanged = true;
    }
  }
  let pagesChanged = false;

  // Collect all page files and their frontmatter
  const pageFiles = findMarkdownFiles(pagesDir);
  const pageData = [];
  for (const { filePath, relativePath } of pageFiles) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { meta, body } = parseFrontmatter(raw);
    let slug = meta.slug;
    if (!slug) {
      slug = '/' + relativePath.replace(/\.md$/, '').replace(/\\/g, '/');
      if (slug.endsWith('/index')) slug = slug.slice(0, -6) || '/';
    }
    pageData.push({ filePath, relativePath, slug, meta, body, raw });
  }

  // --- Legacy migration: layout:docs + sidebar_order → groups + new frontmatter ---
  const legacyDocs = pageData.filter(p =>
    p.meta.layout === 'docs' && p.meta.sidebar_order && !p.meta.groupMember
  );

  if (legacyDocs.length > 0) {
    // Sort by sidebar_order
    legacyDocs.sort((a, b) =>
      (parseInt(a.meta.sidebar_order) || 99) - (parseInt(b.meta.sidebar_order) || 99)
    );

    // Build docs group from legacy pages
    if (!groups.docs) {
      groups.docs = {
        indexPage: null, items: [],
        locations: { sidebar: [{ type: 'group', name: 'docs' }], header: false, footer: false },
      };
    }
    if (groups.docs.items.length === 0) {
      for (const page of legacyDocs) {
        const label = page.meta.sidebar_label ||
          (page.meta.title || '').replace(/\s*[—–-]\s*\w+$/, '') ||
          page.meta.title || 'Untitled';
        groups.docs.items.push({ label, slug: page.slug, target: null });
      }
      groupsChanged = true;
    }

    // Patch each legacy page's frontmatter
    for (const page of legacyDocs) {
      let raw = page.raw;
      // Remove legacy fields
      raw = raw.replace(/^layout\s*:\s*docs\s*\n/m, '');
      raw = raw.replace(/^sidebar_order\s*:\s*\d+\s*\n/m, '');
      raw = raw.replace(/^sidebar_label\s*:\s*.+\s*\n/m, '');
      // Add new fields before the closing ---
      const insertFields = `sidebarGroupShown: docs\ngroupMember:\n  - docs\n`;
      raw = raw.replace(/\n---\n/, '\n' + insertFields + '---\n');
      if (raw !== page.raw) {
        fs.writeFileSync(page.filePath, raw);
        pagesChanged = true;
      }
    }

    if (pagesChanged) {
      console.log('  Migrated: layout:docs pages → groups system');
    }
  }

  // --- Bidirectional sync: pages → groups.md ---
  // Re-read page data after potential migration
  const updatedPageData = [];
  for (const { filePath, relativePath } of pageFiles) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { meta } = parseFrontmatter(raw);
    let slug = meta.slug;
    if (!slug) {
      slug = '/' + relativePath.replace(/\.md$/, '').replace(/\\/g, '/');
      if (slug.endsWith('/index')) slug = slug.slice(0, -6) || '/';
    }
    updatedPageData.push({ filePath, relativePath, slug, meta, raw });
  }

  // Track which groups already existed in groups.md (loaded from disk).
  // For pre-existing groups, groups.md is authoritative for which items appear.
  // Pages won't be re-added if manually removed — UNLESS the page file is newer
  // than groups.md (meaning it was just created and should be picked up).
  const groupsMtime = fs.existsSync(groupsPath) ? fs.statSync(groupsPath).mtimeMs : 0;

  for (const page of updatedPageData) {
    const members = page.meta.groupMember;
    if (!members || !Array.isArray(members)) continue;

    for (const entry of members) {
      // Parse "groupName" or "groupName: Custom Label"
      let groupName, customLabel;
      const colonIdx = entry.indexOf(':');
      if (colonIdx !== -1) {
        groupName = entry.slice(0, colonIdx).trim();
        customLabel = entry.slice(colonIdx + 1).trim();
      } else {
        groupName = entry.trim();
        customLabel = null;
      }

      // Resolve group by name or slug — skip if not found
      const [resolvedName, grp] = resolveGroup(groups, groupName);
      if (!resolvedName) continue;

      // Skip the group's index page — it shouldn't appear as a regular item
      if (grp.indexPage && (page.relativePath === grp.indexPage || page.slug === '/' + grp.indexPage.replace(/\.md$/, ''))) continue;

      // Check if page is already in group
      const existingLink = grp.items.find(l => l.slug === page.slug);
      if (!existingLink) {
        // groups.md is the source of truth for which items appear.
        // Only auto-add if the page file is newer than groups.md (just created).
        const isNewPage = fs.statSync(page.filePath).mtimeMs > groupsMtime;
        if (isNewPage) {
          const label = customLabel ||
            (page.meta.title || '').replace(/\s*[—–-]\s*\w+$/, '') ||
            page.meta.title || 'Untitled';
          grp.items.push({ label, slug: page.slug, target: null });
          groupsChanged = true;
        }
      } else if (customLabel && existingLink.label !== customLabel) {
        // Update label if custom label provided and different
        existingLink.label = customLabel;
        groupsChanged = true;
      }
    }
  }

  // --- Bidirectional sync: groups.md → pages ---
  for (const [groupName, group] of Object.entries(groups)) {
    for (const link of group.items) {
      if (link.slug.startsWith('http') || link.slug === 'none' || link.slug === 'silent' || link.type === 'button') continue; // skip external links, non-link targets, buttons

      const page = updatedPageData.find(p => p.slug === link.slug);
      if (!page) continue;

      // Check if page has groupMember including this group
      const members = page.meta.groupMember;
      if (!members || !Array.isArray(members)) {
        // Add groupMember and sidebarGroupShown to page frontmatter
        let raw = page.raw;
        let insertField = '';
        if (!page.meta.sidebarGroupShown && pageCoveredBySidebar(page, group)) {
          insertField += `sidebarGroupShown: ${groupName}\n`;
        }
        insertField += `groupMember:\n  - ${groupName}\n`;
        raw = raw.replace(/\n---\n/, '\n' + insertField + '---\n');
        if (raw !== page.raw) {
          fs.writeFileSync(page.filePath, raw);
          page.raw = raw;
          // Re-parse meta after write so subsequent checks see updated state
          page.meta = parseFrontmatter(raw).meta;
          pagesChanged = true;
        }
      } else {
        const hasGroup = members.some(m => {
          const ref = m.includes(':') ? m.slice(0, m.indexOf(':')).trim() : m.trim();
          // Match by exact name, slug, or kebab-case equivalence
          const [resolved] = resolveGroup(groups, ref);
          return resolved === groupName;
        });
        if (!hasGroup) {
          // Append to existing groupMember list
          let raw = page.raw;
          // Find the last entry in groupMember array and add after it
          const memberRe = /^(groupMember\s*:\s*\n(?:\s+- .+\n)*)/m;
          const memberMatch = raw.match(memberRe);
          if (memberMatch) {
            raw = raw.replace(memberRe, memberMatch[1] + `  - ${groupName}\n`);
            if (raw !== page.raw) {
              fs.writeFileSync(page.filePath, raw);
              page.raw = raw;
              page.meta = parseFrontmatter(raw).meta;
              pagesChanged = true;
            }
          }
        }
      }

      // Ensure sidebarGroupShown is set if page is covered by sidebar locations but missing it
      if (!page.meta.sidebarGroupShown && pageCoveredBySidebar(page, group)) {
        let raw = page.raw;
        // Add sidebarGroupShown before groupMember
        raw = raw.replace(/^(groupMember\s*:)/m, `sidebarGroupShown: ${groupName}\n$1`);
        if (raw !== page.raw) {
          fs.writeFileSync(page.filePath, raw);
          page.raw = raw;
          page.meta = parseFrontmatter(raw).meta;
          pagesChanged = true;
        }
      }
    }

    // Sync sidebar locations for pages listed by file path (not group members)
    const loc = group.locations;
    if (loc && loc.sidebar) {
      for (const entry of loc.sidebar) {
        if (entry.type !== 'page') continue;
        const page = updatedPageData.find(p => p.relativePath === entry.path);
        if (!page) continue;
        if (!page.meta.sidebarGroupShown) {
          let raw = page.raw;
          // Insert before closing --- or before groupMember if present
          if (/^groupMember\s*:/m.test(raw)) {
            raw = raw.replace(/^(groupMember\s*:)/m, `sidebarGroupShown: ${groupName}\n$1`);
          } else {
            raw = raw.replace(/\n---\n/, `\nsidebarGroupShown: ${groupName}\n---\n`);
          }
          if (raw !== page.raw) {
            fs.writeFileSync(page.filePath, raw);
            page.raw = raw;
            page.meta = parseFrontmatter(raw).meta;
            pagesChanged = true;
          }
        }
      }
    }
  }

  // --- Bidirectional sync: pages → locations (sidebarGroupShown back to groups.md) ---
  for (const page of updatedPageData) {
    const shown = page.meta.sidebarGroupShown;
    if (!shown || shown === 'none') continue;

    const group = groups[shown];
    if (!group) continue;

    // Check if this page is already covered by the group's sidebar locations
    if (pageCoveredBySidebar(page, group)) continue;

    // Page has sidebarGroupShown but isn't covered — add to locations
    const members = page.meta.groupMember;
    const isMember = members && Array.isArray(members) && members.some(m => {
      const n = m.includes(':') ? m.slice(0, m.indexOf(':')).trim() : m.trim();
      return n === shown;
    });

    if (isMember) {
      // Add group: reference if not already present
      const hasGroupRef = group.locations.sidebar.some(e => e.type === 'group' && e.name === shown);
      if (!hasGroupRef) {
        group.locations.sidebar.push({ type: 'group', name: shown });
        groupsChanged = true;
      }
    } else {
      // Add specific page path
      const hasPageRef = group.locations.sidebar.some(e => e.type === 'page' && e.path === page.relativePath);
      if (!hasPageRef) {
        group.locations.sidebar.push({ type: 'page', path: page.relativePath });
        groupsChanged = true;
      }
    }
  }

  // --- Remove stale group items (slug no longer matches any page) ---
  for (const [groupName, group] of Object.entries(groups)) {
    const before = group.items.length;
    group.items = group.items.filter(link => {
      if (link.slug.startsWith('http') || link.slug === 'none' || link.slug === 'silent' || link.type === 'button') return true;
      return updatedPageData.some(p => p.slug === link.slug);
    });
    if (group.items.length < before) groupsChanged = true;
  }

  // --- Reverse sync: detect manual header/footer edits → update group locations ---
  if (syncLocationsFromNav(groups, root)) {
    groupsChanged = true;
  }

  // --- Forward sync: push group locations → header/footer files ---
  syncHeaderLocations(groups, root);
  syncFooterLocations(groups, root);

  // --- Write updated groups.md if changed ---
  if (groupsChanged) {
    writeGroupsFile(groupsPath, groups);
    console.log('  Synced: settings/groups.md ↔ pages');
  }

  return { groups, pagesChanged, groupsChanged };
}

function writeGroupsFile(filePath, groups) {
  // Read existing file to preserve comments at top
  let header = `---
# Groups Settings
# Define named groups of pages. Groups can be displayed as header dropdowns,
# footer columns, or page sidebars.
#
# Each group has:
#   name: groupName              — unique identifier
#   feed: true                   — generate RSS feed at /{name}/feed.xml
#   indexPage: path/to/page.md   — optional page to use as the group's index
#   locations:                   — where this group is shown on the site
#     - sidebar:                 — show as sidebar on listed pages
#         - group: groupName     — all pages in a group
#         - path/to/page.md     — specific page (file path)
#     - header                   — show as dropdown in header nav
#     - footer                   — show as column in footer
#   itemOrder: alpha               — sort items alphabetically (default preserves list order)
#   items:                       — ordered list of pages/links in this group
#     - Label: /slug
#     - Label: https://example.com
#     - button: Label: /slug              — button link
#     - button: Label: /slug +outline     — outline button
#     - Label: /slug +newtab     — force new window
#     - Label: https://example.com +sametab — force same window
#
# Page frontmatter:
#   sidebarGroupShown: groupName      — override: show this group as sidebar
#   sidebarGroupShown: none           — override: suppress sidebar
#   groupMember:                      — groups this page belongs to
#     - groupName                     — uses page title as label
#     - groupName: Custom Label       — custom label in that group's sidebar
#
# Item order is preserved as written. Set itemOrder: alpha to sort alphabetically.
`;

  const groupNames = Object.keys(groups);
  if (groupNames.length === 0) {
    header += '\ngroups: []\n---\n';
    fs.writeFileSync(filePath, header);
    return;
  }

  header += '\ngroups:\n';
  for (let i = 0; i < groupNames.length; i++) {
    const name = groupNames[i];
    const group = groups[name];
    header += `  - name: ${name}\n`;
    // Write slug only if it differs from the default kebab-case of name
    const defaultSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (group.slug && group.slug !== defaultSlug) {
      header += `    slug: ${group.slug}\n`;
    }
    if (group.feed) {
      header += `    feed: true\n`;
    }
    if (group.indexPage) {
      header += `    indexPage: ${group.indexPage}\n`;
    }
    if (group.anchorsDisplay) {
      header += `    anchorsDisplay: ${group.anchorsDisplay}\n`;
    }
    if (group.itemOrder) {
      header += `    itemOrder: ${group.itemOrder}\n`;
    }

    // Write locations
    const loc = group.locations || { sidebar: [{ type: 'group', name }], header: false, footer: false };
    const hasSidebar = loc.sidebar && loc.sidebar.length > 0;
    if (!hasSidebar && !loc.header && !loc.footer) {
      header += `    locations: []\n`;
    } else {
      header += `    locations:\n`;
      if (hasSidebar) {
        header += `      - sidebar:\n`;
        for (const entry of loc.sidebar) {
          if (entry.type === 'group') {
            header += `          - group: ${entry.name}\n`;
          } else {
            header += `          - ${entry.path}\n`;
          }
        }
      }
      if (loc.header) header += `      - header\n`;
      if (loc.footer) header += `      - footer\n`;
    }

    header += `    items:\n`;
    // Always preserve item order as written — groups.md is the source of truth.
    // Use itemOrder: alpha to explicitly opt into alphabetical sorting.
    const items = group.itemOrder === 'alpha' ? [...group.items].sort((a, b) => a.label.localeCompare(b.label))
      : group.items;
    for (const link of items) {
      let entry = `${link.label}: ${link.slug}`;
      if (link.target === '_blank') entry += ' +newtab';
      else if (link.target === '_self') entry += ' +sametab';
      if (link.variant === 'outline') entry += ' +outline';
      if (link.size === 'big') entry += ' +big';
      if (link.color) entry += ` +color:${link.color}`;
      const prefix = link.type === 'button' ? 'button: ' : '';
      header += `      - ${prefix}${entry}\n`;
      if (link.anchors && link.anchors.length > 0) {
        for (const anchor of link.anchors) {
          header += `        - ${anchor.label}: ${anchor.hash}\n`;
        }
      }
    }
    // Blank line between groups for visual clarity
    if (i < groupNames.length - 1) header += '\n';
  }
  header += '---\n';

  // Only write if content actually changed (avoids triggering fs.watch loop)
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (existing !== header) {
    fs.writeFileSync(filePath, header);
  }
}

// ---------------------------------------------------------------------------
// Reverse sync — detect manual header/footer edits and update group locations
// ---------------------------------------------------------------------------
function syncLocationsFromNav(groups, root) {
  let changed = false;

  for (const [fileSetting, settingsFile] of [['header', 'header.md'], ['footer', 'footer.md']]) {
    const filePath = path.join(root, 'settings', settingsFile);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsedItems = parseNavItems(raw);

    for (const [groupName, group] of Object.entries(groups)) {
      const loc = group.locations || {};

      const groupSlug = group.slug || groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existsInNav = parsedItems.some(item => {
        if (item.type !== 'group') return false;
        const ref = item.groupRef || item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return ref === groupName || ref === groupSlug;
      });

      if (existsInNav && !loc[fileSetting]) {
        // User manually added group to nav file — update locations
        if (!group.locations) group.locations = {};
        group.locations[fileSetting] = true;
        changed = true;
      } else if (!existsInNav && loc[fileSetting]) {
        // User manually removed group from nav file — update locations
        group.locations[fileSetting] = false;
        changed = true;
      }
    }
  }

  return changed;
}

// ---------------------------------------------------------------------------
// Header/footer location sync — add/remove group entries based on locations
// ---------------------------------------------------------------------------
function syncHeaderLocations(groups, root) {
  const headerPath = path.join(root, 'settings', 'header.md');
  if (!fs.existsSync(headerPath)) return;

  let raw = fs.readFileSync(headerPath, 'utf-8').replace(/^\s+(?=---)/, '');
  let changed = false;

  // Parse which groups currently have header dropdowns (empty groups that resolve from groups.md)
  const parsedItems = parseNavItems(raw);

  for (const [groupName, group] of Object.entries(groups)) {
    const loc = group.locations || {};

    // Check if a dropdown for this group exists in header (match by name or slug)
    const groupSlug = group.slug || groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existingItem = parsedItems.find(item => {
      if (item.type !== 'group') return false;
      const ref = item.groupRef || item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return ref === groupName || ref === groupSlug;
    });

    if (loc.header && !existingItem) {
      // Add group reference entry
      const insertLine = `  - group: ${groupName}\n`;
      // Find the items section and append
      const itemsMatch = raw.match(/^(items\s*:.*\n(?:[\s\S]*?))(\n---\n)/m);
      if (itemsMatch) {
        raw = raw.replace(itemsMatch[0], itemsMatch[1] + insertLine + itemsMatch[2]);
        changed = true;
      }
    } else if (!loc.header && existingItem && (!existingItem.children || existingItem.children.length === 0)) {
      // Remove the group entry (only if no inline children)
      if (existingItem.groupRef) {
        const refRe = new RegExp(`^  - group\\s*:\\s*${escapeRegex(groupName)}\\s*\\n`, 'm');
        if (refRe.test(raw)) {
          raw = raw.replace(refRe, '');
          changed = true;
        }
      } else {
        const dropdownRe = new RegExp(`^  - ${escapeRegex(existingItem.label)}:\\s*\\n`, 'm');
        if (dropdownRe.test(raw)) {
          raw = raw.replace(dropdownRe, '');
          changed = true;
        }
      }
    }
  }

  if (changed) {
    fs.writeFileSync(headerPath, raw);
    console.log('  Synced: settings/header.md ↔ group locations');
  }
}

function syncFooterLocations(groups, root) {
  const footerPath = path.join(root, 'settings', 'footer.md');
  if (!fs.existsSync(footerPath)) return;

  let raw = fs.readFileSync(footerPath, 'utf-8').replace(/^\s+(?=---)/, '');
  let changed = false;

  // Parse current footer items (same format as header)
  const parsedItems = parseNavItems(raw);

  for (const [groupName, group] of Object.entries(groups)) {
    const loc = group.locations || {};

    // Check if footer already has a group entry matching this group name or slug
    const groupSlug = group.slug || groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existingEntry = parsedItems.find(g => {
      if (g.type !== 'group') return false;
      const ref = g.groupRef || g.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return ref === groupName || ref === groupSlug;
    });

    if (loc.footer && !existingEntry) {
      // Add footer group entry using reference format
      const newEntry = `  - group: ${groupName}\n`;
      // Check if items: [] — need to replace with actual content
      if (/^items\s*:\s*\[\]/m.test(raw)) {
        raw = raw.replace(/^items\s*:\s*\[\]/m, `items:\n${newEntry}`);
        changed = true;
      } else if (/^items\s*:/m.test(raw)) {
        // Append to existing items section — find end of items entries
        const itemsMatch = raw.match(/^(items\s*:\s*\n(?:[\s\S]*?))(\n[a-zA-Z#]|\n---)/m);
        if (itemsMatch) {
          raw = raw.replace(itemsMatch[0], itemsMatch[1] + newEntry + itemsMatch[2]);
          changed = true;
        }
      }
    } else if (!loc.footer && existingEntry) {
      if (existingEntry.groupRef) {
        // Remove reference entry: "  - group: name"
        const entryRe = new RegExp(`  - group\\s*:\\s*${escapeRegex(groupName)}\\s*\\n`, 'm');
        if (entryRe.test(raw)) {
          raw = raw.replace(entryRe, '');
          changed = true;
        }
      } else {
        // Remove inline group entry: "  - Label:" and any indented children
        const entryRe = new RegExp(
          `  - ${escapeRegex(existingEntry.label)}\\s*:\\s*\\n(?:    [^\\n]*\\n)*`,
          'm'
        );
        if (entryRe.test(raw)) {
          raw = raw.replace(entryRe, '');
          changed = true;
        }
      }
      // Clean up: if items section is now empty, reset to items: []
      if (changed && (/^items\s*:\s*\n\s*\n/m.test(raw) || /^items\s*:\s*\n---/m.test(raw))) {
        raw = raw.replace(/^items\s*:\s*\n/m, 'items: []\n');
      }
    }
  }

  if (changed) {
    fs.writeFileSync(footerPath, raw);
    console.log('  Synced: settings/footer.md ↔ group locations');
  }
}

module.exports = { syncGroups, writeGroupsFile, pageCoveredBySidebar, syncLocationsFromNav, syncHeaderLocations, syncFooterLocations, resolveGroup };
