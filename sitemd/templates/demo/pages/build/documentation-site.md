---
# How to write in sitemd:
# Markdown: **bold**, *italic*, [link](url), ![image](url), `code`
# Headings: # H1 through ###### H6 (auto-generate anchor IDs)
# Code blocks: ``` with optional language (```js, ```yaml, etc.)
# Tables: | col | col | with | --- | separator row
# Lists: - unordered, 1. ordered (nesting supported)
# Blockquotes: > quoted text
# Buttons: button: Label: /slug (see docs/buttons-and-links)
# Inline anchors: {#id} on its own line
# Link modifiers: [text](url+newtab), [text](url+sametab)
# Embeds: embed: URL (YouTube, Vimeo, Spotify, CodePen, tweets, any URL)
# Cards: card: Title, card-text: Text, card-image: URL (multiple for carousel), card-link: Label: /slug
# Images: ![alt](url +width:N +circle +bw +expand) — see docs/images
# Image row: image-row: with indented ![alt](url) lines (equal height)
# Gallery: gallery: with indented ![alt](url) lines (grid + lightbox)
# Forms: form: with indented YAML (webhook, fields, pages) — see docs/forms
# Data: data: source, data-display: cards/list/table/detail — see docs/dynamic-data
# Tooltips: [hover text]{tooltip content} — inline tooltip on hover/focus
# Modals: modal: id with indented content (tab: Tab Name for tabbed sections)
# Modal triggers: [link text](#modal:id) — opens the named modal on click
# Gated sections: gated: type1, type2 ... /gated (content visible only to those user types)
# Inline HTML: use any HTML tag directly — <div>, <span>, <details>, etc.
# Horizontal rules: ---
#
title: Documentation Site
titleSuffix: " | sitemd.cc"
tabTitle: Documentation Site
tabTitleSuffix: " | sitemd.cc"
description: Build a docs site with sidebar navigation, anchor links, code blocks, and search.
groupMember:
  - build
  - Build Examples
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Documentation Site

A docs site needs sidebar navigation, anchor links, code blocks, and search. sitemd handles all of this with markdown files and one settings file. The sidebar you see on this page right now is a working example.

---

## What You Need

A documentation site in sitemd is three things:

1. **Markdown pages** in `pages/docs/` — each file is a doc page
2. **A group** in `settings/groups.md` — defines the sidebar and page order
3. **Frontmatter** on each page — connects pages to the group

That's it. No framework, no config files, no plugins.

---

## Step 1: Create Your Pages

Each doc page is a markdown file with a title and group membership:

```yaml
---
title: Getting Started
description: Install and run your first build.
groupMember:
  - docs
sidebarGroupShown: docs
---

# Getting Started

Your first paragraph here...

## Installation

Content about installation...

## Quick Start

Content about getting started...
```

The `groupMember` field puts this page in the `docs` group. The `sidebarGroupShown` field tells sitemd to display the docs sidebar on this page.

Headings automatically generate anchor IDs — `## Installation` becomes `#installation`, and these appear as sub-items in the sidebar.

---

## Step 2: Configure the Group

Define your docs group in `settings/groups.md`:

```yaml
---
groups:
  - name: docs
    indexPage: docs/getting-started.md
    itemOrder: manual
    locations:
      - sidebar:
          - group: docs
      - header
    items:
      - Getting Started: /docs/getting-started
        - Installation: #installation
        - Quick Start: #quick-start
      - Configuration: /docs/configuration
        - Settings Files: #settings-files
        - Theme Options: #theme-options
      - API Reference: /docs/api-reference
---
```

The `locations` field controls where this group appears:
- `sidebar` — shows as a sidebar on the listed pages
- `header` — shows as a dropdown in the header navigation

Indented items under each page are anchor links — they appear as sub-items in the sidebar and link directly to that section.

---

## Step 3: Add Search

Search is enabled by default. Users can press `Cmd+K` (or `Ctrl+K`) to search across all pages. To customize:

```yaml
# settings/header.md
---
search: show
---
```

Search indexes all page titles, descriptions, headings, and content automatically.

---

## Code Blocks

Documentation sites need great code blocks. sitemd supports syntax highlighting for any language:

```javascript
// JavaScript
const config = {
  title: 'My Docs',
  theme: 'dark',
  deploy: 'cloudflare'
}
```

```python
# Python
def build_site(config):
    pages = load_pages("pages/")
    return render(pages, config)
```

```yaml
# YAML — used for sitemd settings
title: My Documentation
description: Learn how to use our product.
groupMember:
  - docs
```

---

## Tables

Tables work with standard markdown syntax:

| Setting | Default | Description |
|---|---|---|
| `search` | `show` | Enable site-wide search |
| `themeModeToggle` | `show` | Show the light/dark/paper toggle |
| `brandDisplay` | `text` | How the brand appears in the header |
| `headerAuth` | `hide` | Show login/signup buttons |

```markdown
| Setting | Default | Description |
|---|---|---|
| `search` | `show` | Enable site-wide search |
| `themeModeToggle` | `show` | Show the light/dark/paper toggle |
```

---

## Real-World Example

The [sitemd.cc documentation](https://sitemd.cc/docs) is built exactly this way — 65 pages with sidebar navigation, anchor links, code blocks, and search. All markdown files.

---

For the full reference on groups, sidebars, and navigation, see the [sitemd docs](https://sitemd.cc/docs/groups).
