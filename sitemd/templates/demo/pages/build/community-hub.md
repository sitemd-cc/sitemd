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
title: Community Hub
titleSuffix: " | sitemd.cc"
tabTitle: Community Hub
tabTitleSuffix: " | sitemd.cc"
description: Build a community or open-source project hub with roadmaps, changelogs, embeds, and brand integrations.
groupMember:
  - build
  - Build Examples
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Community Hub

A community hub brings your project's roadmap, changelog, integrations, and communication channels together in one place. Here's how to build one with sitemd.

---

## Roadmap Section

Use headings and lists to create a clear roadmap. This pattern works for any project — open source, product, or internal.

### Shipped

- **User authentication** — Login, signup, magic links, and session management
- **Brand icons** — 3,400+ brand logos from Simple Icons with `card-icon: brand-name`
- **Content alignment** — Center or right-align any content block with `center:` and `right:` fences
- **Mobile sidebar** — Auto-close menu, merged hamburger, dynamic scroll

### In Progress

- **Email templates** — Transactional email templates in markdown
- **Multi-language support** — Serve translated content from the same project

### Planned

- **Webhooks dashboard** — View and replay form submissions
- **Plugin system** — Extend sitemd with community-built plugins

The markdown for this is just headings and lists — no special syntax:

```markdown
### Shipped
- **User authentication** — Login, signup, magic links
- **Brand icons** — 3,400+ brand logos from Simple Icons

### In Progress
- **Email templates** — Transactional email templates in markdown

### Planned
- **Webhooks dashboard** — View and replay form submissions
```

---

## Integration Cards

Show your ecosystem with brand icon cards. Use the `brand-` prefix with [Simple Icons](https://simpleicons.org) names and `+color:` for brand colors.

card: GitHub
card-icon: brand-github +color:#181717
card-text: Source code, issues, and pull requests. Star us to stay updated.

card: Discord
card-icon: brand-discord +color:#5865F2
card-text: Join the community for help, feature requests, and showcases.

card: npm
card-icon: brand-npm +color:#CB3837
card-text: Install sitemd from npm. Updated with every release.

card: Reddit
card-icon: brand-reddit +color:#FF4500
card-text: Discussions, tutorials, and community showcases on r/sitemd.

---

## Video Embeds

Embed project walkthroughs, tutorials, or community calls. sitemd auto-detects the provider and makes embeds responsive:

embed: https://www.youtube.com/watch?v=dQw4w9WgXcQ

```markdown
embed: https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

Supported providers: YouTube, Vimeo, Spotify, Twitter/X, Reddit, Instagram, TikTok, LinkedIn, CodePen.

---

## Tooltips for Context

Add inline context to technical terms without cluttering the page:

sitemd uses [MCP]{Model Context Protocol — a standard that lets AI coding agents interact with tools programmatically} for agent integration and [SSG]{Static Site Generation — your site is pre-built as HTML files, no server required at runtime} for deployment.

```markdown
[MCP]{Model Context Protocol — a standard that lets AI coding agents
interact with tools programmatically}

[SSG]{Static Site Generation — your site is pre-built as HTML files,
no server required at runtime}
```

---

## Contact Form

Let your community reach you directly:

form:
  webhook: https://hooks.example.com/demo
  submitLabel: Send Feedback
  thankYou: Thanks for the feedback! This is a demo form — nothing was sent.
  fields:
    - id: name
      type: shorttext
      label: Name
    - id: email
      type: email
      label: Email
      required: true
    - id: type
      type: radio
      label: Type
      options:
        - Bug Report
        - Feature Request
        - General Feedback
    - id: message
      type: longtext
      label: Message
      required: true
      placeholder: Tell us what you think...

---

## Hidden Content for SEO

Use `hidden:` fences to add content that search engines and screen readers can see, but visitors don't:

hidden:
sitemd community hub — open source markdown site builder, community resources, roadmap, changelog, integrations, developer tools
/hidden

```markdown
hidden:
sitemd community hub — open source markdown site builder,
community resources, roadmap, changelog, integrations
/hidden
```

This is useful for adding SEO keywords, an invisible H1, or accessibility descriptions without affecting the visual design.

---

For the full reference on embeds, forms, tooltips, and icons, see the [sitemd docs](https://sitemd.cc/docs).
