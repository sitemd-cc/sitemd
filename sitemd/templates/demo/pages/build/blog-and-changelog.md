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
title: Blog & Changelog
titleSuffix: " | sitemd.cc"
tabTitle: Blog & Changelog
tabTitleSuffix: " | sitemd.cc"
description: Build a blog with RSS feeds and author cards, plus a changelog with version entries.
groupMember:
  - build
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Blog & Changelog

Blogs and changelogs are page groups with special features — RSS feeds, author cards, date ordering, and sidebar navigation. Here's how to set them up.

---

## Blog Setup

A blog in sitemd is a group of pages with an RSS feed. You need two things:

### 1. Define the Blog Group

In `settings/groups.md`, add a blog group with `feed: true` for automatic RSS:

```yaml
---
groups:
  - name: blog
    feed: true
    indexPage: blog.md
    locations:
      - sidebar:
          - group: blog
      - header
    items:
      - Blog: /blog
      - How We Built Our Site: /blog/how-we-built-our-site
      - Launching Version 2.0: /blog/launching-v2
---
```

The `feed: true` setting generates an RSS feed at `/blog/feed.xml` automatically.

### 2. Write Blog Posts

Each blog post is a markdown file in `pages/blog/` with `groupMember` frontmatter:

```yaml
---
title: How We Built Our Site
description: From idea to launch in a weekend with sitemd and Claude Code.
groupMember:
  - blog
sidebarGroupShown: blog
---

# How We Built Our Site
**March 15, 2026**

Your blog post content here...
```

### Author Cards

Add an author card at the end of any blog post. Author cards show an avatar, name, role, bio, and social links:

author: Sarah Chen
author-image: https://i.pravatar.cc/128?img=5
author-role: Head of Product
author-bio: Sarah writes about product strategy, developer tools, and building in public.
author-link: Twitter: https://x.com
author-link: GitHub: https://github.com
author-link: LinkedIn: https://linkedin.com

```markdown
author: Sarah Chen
author-image: https://i.pravatar.cc/128?img=5
author-role: Head of Product
author-bio: Sarah writes about product strategy, developer tools, and building in public.
author-link: Twitter: https://x.com
author-link: GitHub: https://github.com
author-link: LinkedIn: https://linkedin.com
```

---

## Changelog Setup

A changelog is a regular page with version entries. No special configuration needed — just write the markdown:

### Example Changelog Page

```yaml
---
title: Changelog
description: What's new and what's changed.
---

# Changelog

## v2.1.0 — April 2026

- **Brand icons** — 3,400+ brand logos from Simple Icons
- **Content alignment** — Center or right-align any content block
- **Hidden content** — Visually hide content for SEO and accessibility

## v2.0.0 — March 2026

- **User authentication** — Login, signup, and gated content
- **Dynamic data** — Connect pages to Supabase, Firebase, or any API
- **Forms** — Inline forms with webhooks and conditional logic

## v1.0.0 — February 2026

- Initial release
- Pages, components, themes, and deploy targets
```

### Rendered Example

Here's what a changelog section looks like when rendered:

---

## v2.1.0 — April 2026

- **Brand icons** — 3,400+ brand logos from Simple Icons available with `card-icon: brand-name`
- **Content alignment** — Center or right-align text, buttons, images, and cards with `center:` fences
- **Hidden content** — Visually hide content for SEO and accessibility with `hidden:` fences

## v2.0.0 — March 2026

- **User authentication** — Login, signup, magic links, and session management
- **Dynamic data** — Connect pages to live data from Supabase, Firebase, or any REST API
- **Forms** — Inline YAML forms with webhooks, multi-page flows, and conditional logic

---

## Tips

- **Use `/write changelog`** to let your coding agent generate changelog entries from your git history
- **Use `/write blog`** to generate blog post drafts from a topic description
- **RSS feeds** work with any group — not just blogs. Add `feed: true` to any group definition

---

For the full reference on blogs, RSS, and content generation, see the [sitemd docs](https://sitemd.cc/docs/groups).
