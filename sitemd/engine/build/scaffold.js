const fs = require('fs');
const path = require('path');
const { parseLinkEntry, escapeRegex } = require('./parse');
const { writeGroupsFile } = require('./groups');

// ---------------------------------------------------------------------------
// Auto-scaffold missing pages and patch header.md with generated slugs
// ---------------------------------------------------------------------------
function generatePlaceholderContent(label, slug) {
  return `---
# How to write in sitemd:
# Markdown: **bold**, *italic*, [link](url), ![image](url), \`code\`
# Headings: # H1 through ###### H6 (auto-generate anchor IDs)
# Code blocks: \`\`\` with optional language (\`\`\`js, \`\`\`yaml, etc.)
# Tables: | col | col | with | --- | separator row
# Lists: - unordered, 1. ordered (nesting supported)
# Blockquotes: > quoted text
# Buttons: button: Label: /slug (see docs/buttons-and-links)
# Inline anchors: {#id} on its own line
# Link modifiers: [text](url+newtab), [text](url+sametab)
# Inline HTML: use any HTML tag directly — <div>, <span>, <details>, etc.
# Horizontal rules: ---
#
title: ${label}
slug: ${slug}
---

# ${label}

This is a placeholder page for **${label}**. Edit this file to add your own content — everything below showcases the formatting elements available to you.

## Text & Inline Formatting

Regular paragraphs are styled with comfortable reading line-height. You can use **bold text** for emphasis, *italic text* for nuance, and \`inline code\` for technical terms. Links like [this one](/) are styled with your accent color.

Combine them freely: ***bold italic***, **\`bold code\`**, or even [**bold links**](/).

## Lists

Unordered lists work great for feature sets or key points:

- First item with some detail
- Second item — supports **inline formatting** too
- Third item with a [link](/)

Ordered lists for step-by-step instructions:

1. Start with your content in markdown
2. Run the build to generate your site
3. Deploy anywhere that serves static files

## Blockquotes

> Blockquotes are perfect for callouts, testimonials, or highlighting key information. They get a styled left border and subtle background.

## Code Blocks

Fenced code blocks include a copy button on hover:

\`\`\`yaml
# Example: sitemd settings use simple YAML
title: My Site
description: Built with sitemd
theme: light
\`\`\`

## Tables

| Feature       | Status    | Notes                    |
|---------------|-----------|--------------------------|
| Markdown      | Supported | Full GFM syntax          |
| Themes        | 3 built-in| Light, dark, and paper   |
| Navigation    | Auto      | Generated from settings  |
| Live Reload   | Yes       | Updates on every save    |

---

### Smaller Headings

H3 headings are great for subsections within a page.

#### H4 Heading

Use H4 for finer groupings when you need more hierarchy.

##### H5 Heading

H5 and H6 are available for deeply nested content.

###### H6 Heading

The smallest heading level — styled with a subtle secondary color.

---

*Replace this placeholder with your own content. Just edit \`pages/${slug.replace(/^\//, '')}.md\` and the site will rebuild automatically.*
`;
}

function scaffoldMissingPages(config, root) {
  const pagesDir = path.join(root, config.pagesDir);
  const groupsPath = path.join(root, 'settings', 'groups.md');
  const navItems = config.navItems || [];
  const groups = config.groups || {};

  // Collect all slugs from nav (flat + group children), track which groups need auto-creation
  const slugs = [];
  const newGroups = []; // groups that need auto-creation in groups.md
  const skipSlugs = new Set(['none', 'silent']);
  function isScaffoldable(link) {
    if (!link.slug || link.type === 'button') return false;
    const s = link.slug.replace(/^\//, '');
    return !s.startsWith('http') && !s.startsWith('#') && !s.startsWith('mailto:') && !skipSlugs.has(s.split(' ')[0]);
  }
  for (const item of navItems) {
    if (isScaffoldable(item)) slugs.push(item);
    if (item.children) {
      const groupKey = item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const childLinks = [];
      for (const child of item.children) {
        if (isScaffoldable(child)) {
          slugs.push({ ...child, groupKey });
          childLinks.push(child);
        }
      }
      // Auto-create group if it doesn't exist in groups.md (match by name or slug)
      const groupExists = groups[groupKey] || Object.values(groups).some(g => g.slug === groupKey);
      if (!groupExists && childLinks.length > 0) {
        newGroups.push({ name: groupKey, items: childLinks });
      }
    }
  }

  let scaffolded = false;
  for (const { label, slug, groupKey } of slugs) {
    if (slug === '/') continue;
    const pagePath = path.join(pagesDir, slug.replace(/^\//, '') + '.md');
    const dirPath = path.join(pagesDir, slug.replace(/^\//, ''), 'index.md');
    const dirCheck = path.join(pagesDir, slug.replace(/^\//, ''));
    if (fs.existsSync(pagePath) || fs.existsSync(dirPath) || fs.existsSync(dirCheck)) continue;

    // Generate placeholder with group membership if part of a group
    let content;
    if (groupKey) {
      content = `---\ntitle: ${label}\nslug: ${slug}\nsidebarGroupShown: ${groupKey}\ngroupMember:\n  - ${groupKey}\n---\n\n` +
        generatePlaceholderContent(label, slug).replace(/^---\n[\s\S]*?\n---\n\n/, '');
    } else {
      content = generatePlaceholderContent(label, slug);
    }
    fs.mkdirSync(path.dirname(pagePath), { recursive: true });
    fs.writeFileSync(pagePath, content);
    console.log(`  Scaffolded: ${slug} → ${config.pagesDir}/${slug.replace(/^\//, '')}.md`);
    scaffolded = true;
  }

  // Auto-create groups in groups.md for new nav groups
  if (newGroups.length > 0) {
    for (const ng of newGroups) {
      groups[ng.name] = {
        indexPage: null,
        items: ng.items.map(l => ({ label: l.label, slug: l.slug, target: l.target || null })),
        locations: { sidebar: [{ type: 'group', name: ng.name }], header: true, footer: false },
      };
    }
    writeGroupsFile(groupsPath, groups);
    console.log(`  Auto-created groups: ${newGroups.map(g => g.name).join(', ')}`);
  }

  // Patch header.md — add slugs to bare labels
  patchHeaderSlugs(navItems, root);

  return scaffolded;
}

function patchHeaderSlugs(navItems, root) {
  const headerPath = path.join(root, 'settings', 'header.md');
  if (!fs.existsSync(headerPath)) return;

  let raw = fs.readFileSync(headerPath, 'utf-8').replace(/^\s+(?=---)/, '');
  let changed = false;

  // Build a map of labels that need slugs (from parsed nav items)
  // We look for lines like "    - Child 1" (no colon+slug) and replace with "    - Child 1: /group/child-1"
  for (const item of navItems) {
    // Top-level bare label
    if (item.type === 'link' && item.slug) {
      const bare = new RegExp(`^(  - )${escapeRegex(item.label)}\\s*$`, 'm');
      if (bare.test(raw)) {
        raw = raw.replace(bare, `$1${item.label}: ${item.slug}`);
        changed = true;
      }
    }
    // Group children
    if (item.children) {
      for (const child of item.children) {
        const bare = new RegExp(`^(\\s+- )${escapeRegex(child.label)}\\s*$`, 'm');
        if (bare.test(raw)) {
          raw = raw.replace(bare, `$1${child.label}: ${child.slug}`);
          changed = true;
        }
      }
    }
  }

  if (changed) {
    fs.writeFileSync(headerPath, raw);
    console.log('  Patched: settings/header.md (added missing slugs)');
  }
}

module.exports = { generatePlaceholderContent, scaffoldMissingPages, patchHeaderSlugs };
