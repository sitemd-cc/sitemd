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
title: Startup Landing Page
titleSuffix: " | sitemd.cc"
tabTitle: Startup Landing Page
tabTitleSuffix: " | sitemd.cc"
description: Build a product marketing page with hero sections, feature cards, brand integrations, and calls to action.
groupMember:
  - build
  - Build Examples
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Startup Landing Page

A startup landing page needs a bold hero, clear feature breakdown, social proof, and strong calls to action. Here's how to build one with sitemd.

---

## Hero Section

Use a `center:` fence to center your hero content. `{{brandDisplay}}` renders your site's brand name inline.

center:
# Ship faster with sitemd

The modern way to build websites. Describe what you want, your agent writes the markdown, and your site builds itself.

button: Get Started: #modal:get-started +big
button: See How It Works: #how-it-works +big +outline
/center

The markdown for this hero:

```markdown
center:
# Ship faster with {{brandDisplay}}

The modern way to build websites. Describe what you want,
your agent writes the markdown, and your site builds itself.

button: Get Started: /contact +big
button: See How It Works: #how-it-works +big +outline
/center
```

---

## Feature Cards with Icons

Use `card-icon:` with any [Lucide icon](https://lucide.dev) or brand icon (prefix with `brand-`).

card: Lightning Fast
card-icon: zap +color:amber
card-text: Every file save triggers a rebuild in milliseconds. No build step, no waiting, no configuration needed.

card: AI-Native Workflow
card-icon: bot +color:violet
card-text: Built for coding agents. Your AI assistant writes the markdown — you describe what you want in plain language.

card: Deploy Anywhere
card-icon: globe +color:sky
card-text: One command deploys to Cloudflare, Netlify, Vercel, or GitHub Pages. No vendor lock-in, ever.

```markdown
card: Lightning Fast
card-icon: zap +color:amber
card-text: Every file save triggers a rebuild in milliseconds.

card: AI-Native Workflow
card-icon: bot +color:violet
card-text: Built for coding agents. Your AI assistant writes the markdown.

card: Deploy Anywhere
card-icon: globe +color:sky
card-text: One command deploys to Cloudflare, Netlify, Vercel, or GitHub Pages.
```

---

{#how-it-works}

## How It Works

1. **Install sitemd** — One command to set up your project
2. **Write markdown** — Or tell your coding agent what to build
3. **See it live** — The dev server shows every change instantly
4. **Go live** — Deploy to any static hosting in seconds

---

## Integration Cards with Brand Icons

Show which platforms you integrate with using brand icons from [Simple Icons](https://simpleicons.org). Prefix the icon name with `brand-` and add `+color:` with the brand's hex color.

card: GitHub
card-icon: brand-github +color:#181717
card-text: Push to deploy. Your site builds and ships on every commit.

card: Discord
card-icon: brand-discord +color:#5865F2
card-text: Embed your Discord community widget directly on any page.

card: Vercel
card-icon: brand-vercel +color:#000000
card-text: Deploy to Vercel with zero configuration. Push to ship.

```markdown
card: GitHub
card-icon: brand-github +color:#181717
card-text: Push to deploy. Your site builds and ships on every commit.

card: Discord
card-icon: brand-discord +color:#5865F2
card-text: Embed your Discord community widget directly on any page.

card: Vercel
card-icon: brand-vercel +color:#000000
card-text: Deploy to Vercel with zero configuration. Push to ship.
```

---

## Call to Action

End your landing page with a strong, centered CTA.

center:
## Ready to launch?

Start building your site in under a minute. No credit card, no signup, no waiting.

button: Get Started Free: #modal:get-started +big +color:emerald
button: Buy Now: #modal:get-started +big +outline +color:emerald
/center

modal: get-started
  ### Get Started with sitemd

  form:
    webhook: https://hooks.example.com/demo
    submitLabel: Create My Site
    thankYou: You're in! This is a demo — nothing was sent.
    fields:
      - id: name
        type: shorttext
        label: Name
        required: true
      - id: email
        type: email
        label: Email
        required: true
        placeholder: you@company.com
      - id: plan
        type: select
        label: Plan
        options:
          - Free
          - Pro ($19/mo)
          - Enterprise (Custom)
      - id: use_case
        type: longtext
        label: What are you building?
        placeholder: Tell us about your project...

---

For the full reference on building pages, see the [sitemd documentation](https://sitemd.cc/docs).
