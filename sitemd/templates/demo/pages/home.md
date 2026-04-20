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
title: sitemd Demo Site
titleSuffix: | sitemd.cc
tabTitle: sitemd Demo Site
tabTitleSuffix: | sitemd.cc
description: A live demo of sitemd — the markdown site builder designed for humans and coding agents working together.
slug: /
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

center:
# Ship modern sites fast with markdown
/center

Everything you see here — every page, every component, every setting — is a plain markdown file. No HTML. No CSS. No JavaScript. Just markdown.

center:
button: Build Examples: /build +big +outline
button: Components List: /components +big +outline
/center

---

## What is sitemd?

sitemd is a markdown site builder designed for people who use coding agents like Claude Code, Cursor, and Codex. You describe what you want, your agent writes the markdown, and sitemd turns it into a polished site instantly.

**No code required.** Pages, settings, navigation, themes — everything is configured through markdown files with simple YAML frontmatter.

**Built for AI workflows.** sitemd exposes MCP tools and agent skills that let coding agents create pages, update settings, and deploy your site. Just describe what you want in plain language.

**Instant feedback.** The dev server rebuilds the moment you save a file. No build steps, no waiting, no configuration.

---

## What will you build?

card: Startup Landing Page
card-icon: rocket
card-text: Hero sections, feature cards, brand integrations, and call-to-action buttons.
card-link: View build example: /build/startup-landing-page

card: Documentation Site
card-icon: book-open
card-text: Sidebar navigation, anchor links, code blocks, and search.
card-link: View build example: /build/documentation-site

card: Blog & Changelog
card-icon: rss
card-text: Blog posts with author cards and RSS feeds. Changelogs with version entries.
card-link: View build example: /build/blog-and-changelog

card: Portfolio
card-icon: image
card-text: Image galleries, creative layouts, and author bios.
card-link: View build example: /build/portfolio

card: SaaS Product
card-icon: lock
card-text: Authentication, gated content, pricing modals, dynamic data, and forms.
card-link: View build example: /build/saas-product

card: Community Hub
card-icon: users
card-text: Roadmaps, changelogs, embeds, contact forms, and brand integrations.
card-link: View build example: /build/community-hub

card: Client Portal
card-icon: shield
card-text: Authenticated dashboards, project tracking, invoice tables, and gated content tiers.
card-link: View build example: /build/client-portal

card: Online Store
card-icon: shopping-cart
card-text: Product catalogs with detail modals, category filtering, and order forms.
card-link: View build example: /build/online-store

card: Real Estate Portfolio
card-icon: building
card-text: Property listings with image carousels, detail modals, and inquiry forms.
card-link: View build example: /build/real-estate-portfolio

card: Job Board
card-icon: briefcase
card-text: Job listings with filtering, detail modals with requirements, and apply forms.
card-link: View build example: /build/job-board

card: Course Platform
card-icon: graduation-cap
card-text: Course catalogs with gated lesson tiers, instructor profiles, and enrollment forms.
card-link: View build example: /build/course-platform

card: Event Site
card-icon: calendar
card-text: Event listings with schedules, speaker profiles, and registration forms.
card-link: View build example: /build/event-site

---

## Why sitemd?

card: AI-Native +banner
card-icon: bot
card-text: Describe what you want. Your coding agent writes the markdown. sitemd builds the site.

card: Instant Preview +banner
card-icon: zap
card-text: Every save rebuilds in milliseconds. See changes before you blink.

card: Deploy Anywhere +banner
card-icon: globe
card-text: Cloudflare, Netlify, Vercel, GitHub Pages. One command to go live.

---

## How it works

1. **Write markdown** — Pages are `.md` files. Settings are `.md` files. Everything is markdown.
2. **Let your agent help** — Ask Claude Code or Cursor to add pages, change settings, or build entire sections.
3. **See it live** — The dev server rebuilds instantly when any file changes. No build step, no waiting.
4. **Deploy anywhere** — Cloudflare, Netlify, Vercel, GitHub Pages — one command to go live.

---

center:
## Ready to build?

Start by exploring what sitemd can do. Browse the [component showcase](/components) to see every available building block, or pick a use case from the [Build Examples](/build) header dropdown.

button: Example Builds: /build +outline +big
button: Components List: /components +outline +big

\n

button: Go to sitemd.cc: https://sitemd.cc +sametab +big +icon-right:square-arrow-out-up-right
/center
