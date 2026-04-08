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
title: What Will You Build?
titleSuffix: " | sitemd.cc"
tabTitle: What Will You Build?
tabTitleSuffix: " | sitemd.cc"
description: The most popular ways to use sitemd — with examples and markdown you can copy.
slug: /build
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# What Will You Build?

sitemd builds any kind of site from markdown files. Pick a starting point below — each guide shows you the real markdown and settings you need, with live rendered examples on the page.

---

card: Startup Landing Page
card-icon: rocket
card-text: Hero sections, feature cards, brand integrations, and call-to-action buttons. Everything a product launch needs.
card-link: Build this: /build/startup-landing-page

card: Documentation Site
card-icon: book-open
card-text: Sidebar navigation, anchor links, code blocks, and search. A full docs site from a handful of markdown files.
card-link: Build this: /build/documentation-site

card: Blog & Changelog
card-icon: rss
card-text: Blog posts with author cards and RSS feeds. Changelogs with version entries. All powered by page groups.
card-link: Build this: /build/blog-and-changelog

card: Portfolio
card-icon: image
card-text: Image galleries, creative layouts, and author bios. Show off your work with visual-first pages.
card-link: Build this: /build/portfolio

card: SaaS Product
card-icon: lock
card-text: Authentication, gated content, pricing modals, dynamic data, and forms. A full product site with user accounts.
card-link: Build this: /build/saas-product

card: Community Hub
card-icon: users
card-text: Roadmaps, changelogs, embeds, contact forms, and brand integrations. Rally your community around your project.
card-link: Build this: /build/community-hub

card: Client Portal
card-icon: shield
card-text: Authenticated dashboards, project tracking, invoice tables, and gated content tiers. A full client portal with login.
card-link: Build this: /build/client-portal

card: Online Store
card-icon: shopping-cart
card-text: Product catalogs with detail modals, category filtering, image cards, and order forms. An e-commerce storefront from markdown.
card-link: Build this: /build/online-store

card: Real Estate Portfolio
card-icon: building
card-text: Property listings with image carousels, detail modals with specs and galleries, filtering, and inquiry forms.
card-link: Build this: /build/real-estate-portfolio

card: Job Board
card-icon: briefcase
card-text: Job listings with filtering by role, location, and type. Detail modals with requirements and an apply form.
card-link: Build this: /build/job-board

card: Course Platform
card-icon: graduation-cap
card-text: Course catalogs with gated lesson tiers, instructor profiles, enrollment forms, and student dashboards.
card-link: Build this: /build/course-platform

card: Event Site
card-icon: calendar
card-text: Event listings with schedules, speaker profiles, registration forms, and ticket selection.
card-link: Build this: /build/event-site

---

center:
For the full reference on every feature, visit the [sitemd documentation](https://sitemd.cc/docs).
/center
