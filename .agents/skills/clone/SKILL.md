---
name: clone
description: Clone an existing website into a sitemd project. Scrapes content, navigation, images, forms, and embeds, mapping them to sitemd components.
---

# Clone Website

Scrape an existing website and import its content into this sitemd project. Extracts text, images, navigation, forms, embeds, and cards — mapping everything to sitemd's component model. Styling is NOT copied; sitemd's built-in themes apply.

**Critical: Do NOT rewrite, rephrase, improve, or editorialize any cloned content.** The goal is a format conversion, not a content rewrite. Every heading, paragraph, bullet point, and sentence must be preserved verbatim from the source. Your only job is to reformat the existing content into sitemd markdown syntax and components (buttons, cards, embeds, galleries, etc.). If a heading says "We're the best" — write exactly that. If copy is awkward or has typos — keep it. The user owns their content; you are a formatter, not an editor.

## Input

The target URL is provided as the argument: `$ARGUMENTS`

If no argument is provided, ask the user for the URL to clone.

## Procedure

### 1. Check Puppeteer

Before cloning, verify Puppeteer is installed:

```bash
node -e "require('puppeteer')" 2>/dev/null && echo "OK" || echo "MISSING"
```

If missing, install it:

```bash
npm install puppeteer
```

This downloads Chromium (~150MB) — it's only needed for cloning and can be removed after.

### 2. Run the clone

Call the `sitemd_clone` MCP tool with:
- `url` — the target website URL
- `maxPages` — (optional) limit pages to crawl, default 50
- `includeAssets` — (optional) download images locally, default true
- `skipPaths` — (optional) URL prefixes to skip (e.g. `["/admin", "/api"]`)

This crawls the site, extracts content, maps it to sitemd components, and downloads images. It returns a structured JSON report.

### 3. Review the report

Summarize the results for the user:
- How many pages were found and extracted
- What page types were detected (standard, blog, docs, changelog, roadmap)
- What components were found (cards, buttons, forms, embeds)
- Any warnings or unmapped pages
- Asset download stats

Ask the user if they want to proceed with importing all pages, or select specific ones.

### 4. Update site settings

Using the report's `site` and `navigation` data:

1. Update `settings/meta.md` frontmatter with extracted title, brandName, description
2. Update `settings/header.md` items with extracted navigation structure
3. Update `settings/footer.md` with extracted copyright and social links
4. Update `settings/theme.md` with suggested accentColor (if detected)
5. Update `settings/groups.md` with detected groups (blog, docs, etc.)

Edit the settings files directly for these changes.

### 5. Create pages

For each page in the report:
1. Call `sitemd_pages_create` with the page's title, description, slug, content, and groupMember
2. If the page belongs to a group, call `sitemd_groups_add_pages`

Create pages in order: index page first (use `slug: /` for the home page), then group index pages, then individual pages.

### 6. Report results

Tell the user:
- What was created successfully
- What needs manual attention:
  - Forms with placeholder webhook URLs that need real endpoints
  - Auth-gated pages that were skipped
  - Dynamic content that needs data source configuration
  - Embeds that couldn't be identified
  - Low-confidence pages that may need review
- Suggest running `/launch` to preview the imported site

## Rules

- **Never rewrite content** — use the exact text from the scraped source. No rephrasing, no "improving", no summarizing, no expanding. Copy verbatim.
- **Format only** — your changes are limited to converting HTML structure into sitemd markdown syntax and components. The words stay the same.
- Never overwrite existing pages — report conflicts and ask user
- Preserve extracted content structure faithfully (heading levels, list nesting, paragraph breaks)
- Forms get placeholder webhook URLs — always warn the user
- Low-confidence pages (< 0.5) should be flagged for manual review
- If the site appears to be an SPA with mostly empty content, warn the user
