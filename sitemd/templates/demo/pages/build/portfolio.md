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
title: Portfolio
titleSuffix: " | sitemd.cc"
tabTitle: Portfolio
tabTitleSuffix: " | sitemd.cc"
description: Build a creative portfolio with image galleries, visual layouts, and author bios.
groupMember:
  - build
  - Build Examples
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Portfolio

A portfolio site is visual-first — galleries, image rows, creative layouts, and an author bio. sitemd's image features and alignment fences make this easy without any CSS.

---

## Image Gallery

Use `gallery:` to create a responsive grid with a built-in lightbox. Click any image to browse full-screen.

gallery:
  ![Landscape](https://picsum.photos/id/29/600/400)
  ![Architecture](https://picsum.photos/id/36/600/400)
  ![Nature](https://picsum.photos/id/15/600/400)
  ![Abstract](https://picsum.photos/id/60/600/400)
  ![City](https://picsum.photos/id/48/600/400)
  ![Ocean](https://picsum.photos/id/90/600/400)

```markdown
gallery:
  ![Landscape](https://picsum.photos/id/29/600/400)
  ![Architecture](https://picsum.photos/id/36/600/400)
  ![Nature](https://picsum.photos/id/15/600/400)
  ![Abstract](https://picsum.photos/id/60/600/400)
  ![City](https://picsum.photos/id/48/600/400)
  ![Ocean](https://picsum.photos/id/90/600/400)
```

---

## Image Row

Use `image-row:` for side-by-side images at equal height. Great for before/after comparisons or photo series.

image-row:
  ![First](https://picsum.photos/id/10/600/400)
  ![Second](https://picsum.photos/id/14/600/400)
  ![Third](https://picsum.photos/id/42/600/400)

```markdown
image-row:
  ![First](https://picsum.photos/id/10/600/400)
  ![Second](https://picsum.photos/id/14/600/400)
  ![Third](https://picsum.photos/id/42/600/400)
```

---

## Image Modifiers

Apply filters and shapes to images inline:

![Black and white](https://picsum.photos/id/64/300/300 +bw +circle +width:150)
![Sepia tone](https://picsum.photos/id/65/300/300 +sepia +circle +width:150)
![Original](https://picsum.photos/id/66/300/300 +circle +width:150)

```markdown
![Black and white](https://picsum.photos/id/64/300/300 +bw +circle +width:150)
![Sepia tone](https://picsum.photos/id/65/300/300 +sepia +circle +width:150)
![Original](https://picsum.photos/id/66/300/300 +circle +width:150)
```

---

## Aligned Layouts

Use `right:` and `left:` fences to create text-beside-image layouts.

right:
### Photography

Capturing moments that tell stories. Specializing in landscape and architectural photography with a focus on natural light and minimal post-processing.

button: View Gallery: #image-gallery +outline
/right

![Portfolio shot](https://picsum.photos/id/39/800/500 +width:500)

---

left:
### Design Work

Brand identity, web design, and visual systems. Every project starts with understanding the story you want to tell.

button: See Projects: #project-cards +outline
/left

![Design work](https://picsum.photos/id/20/800/500 +width:500)

```markdown
right:
### Photography

Capturing moments that tell stories...

button: View Gallery: #image-gallery +outline
/right

![Portfolio shot](https://picsum.photos/id/39/800/500 +width:500)
```

---

{#project-cards}

## Project Cards

Use image cards to showcase individual projects:

card: Brand Refresh
card-text: Complete visual identity redesign for a Series A startup.
card-image: https://picsum.photos/id/56/600/400
card-link: View project: #modal:project-brand

card: Product Launch
card-text: Landing page and marketing site for a new developer tool.
card-image: https://picsum.photos/id/48/600/400
card-link: View project: #modal:project-launch

card: Editorial Series
card-text: Photo essay documenting urban architecture across five cities.
card-image: https://picsum.photos/id/36/600/400
card-link: View project: #modal:project-editorial

modal: project-brand
  tab: Overview
    ### Brand Refresh — Arcline

    **Client:** Arcline · Series A dev tools startup
    **Timeline:** 6 weeks · Completed January 2026

    Full visual identity redesign including logo, color system, typography, iconography, and brand guidelines. The goal was to evolve Arcline's scrappy early-stage look into a polished, developer-trusted brand.

    - Logo and wordmark design
    - Color palette and typography system
    - Icon set (32 custom product icons)
    - Brand guidelines document (48 pages)

  tab: Gallery
    gallery:
      ![Logo concepts](https://picsum.photos/id/56/600/400)
      ![Color system](https://picsum.photos/id/180/600/400)
      ![Typography](https://picsum.photos/id/60/600/400)
      ![Icon set](https://picsum.photos/id/119/600/400)

modal: project-launch
  tab: Overview
    ### Product Launch — Terrace CLI

    **Client:** Terrace · Developer productivity tool
    **Timeline:** 4 weeks · Completed March 2026

    Landing page and marketing site for the launch of Terrace CLI, a terminal-based project management tool. Designed for high conversion with a focus on developer trust signals — code samples, GitHub stars, and benchmark results.

    - Hero with live terminal animation
    - Feature comparison tables
    - Integration showcase with brand icons
    - Docs site with sidebar navigation

  tab: Gallery
    gallery:
      ![Landing hero](https://picsum.photos/id/48/600/400)
      ![Feature section](https://picsum.photos/id/2/600/400)
      ![Docs page](https://picsum.photos/id/0/600/400)
      ![Mobile view](https://picsum.photos/id/20/600/400)

modal: project-editorial
  tab: Overview
    ### Editorial Series — Urban Grid

    **Self-initiated** · Personal project
    **Timeline:** 8 months · Ongoing since 2025

    A photo essay documenting urban architecture and infrastructure across five cities — Portland, Tokyo, Berlin, São Paulo, and Lagos. Exploring how cities express identity through the geometry of their built environment.

    - 120+ photographs across 5 cities
    - Published in Monocle and Dwell Magazine
    - Exhibited at Portland Art Museum (2025)
    - Shot on Fujifilm GFX100S

  tab: Gallery
    gallery:
      ![Portland bridges](https://picsum.photos/id/36/600/400)
      ![Tokyo stations](https://picsum.photos/id/42/600/400)
      ![Berlin facades](https://picsum.photos/id/37/600/400)
      ![São Paulo skyline](https://picsum.photos/id/49/600/400)
      ![Lagos markets](https://picsum.photos/id/43/600/400)

---

## About the Artist

End your portfolio with an author card:

author: Jordan Rivera
author-image: https://i.pravatar.cc/128?img=12
author-role: Photographer & Designer
author-bio: Based in Portland. Fifteen years of experience in visual storytelling, brand design, and editorial photography. Available for commissions and collaborations.
author-link: Twitter: https://x.com
author-link: GitHub: https://github.com
author-link: https://example.com

---

For the full reference on images, galleries, and layouts, see the [sitemd docs](https://sitemd.cc/docs/images).
