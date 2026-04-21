---
name: seo
description: "Run an SEO health check and fix issues. Shows a scored report with actionable recommendations. Usage: /seo [scope]"
argument-hint: "[all|settings|pages|/slug]"
---

# SEO Audit

Run a comprehensive SEO health check across site settings and public content pages. Presents a scored report with educational explanations and offers to fix issues.

Auth pages, account pages, gated pages, and utility pages (404, access-denied, maintenance) are automatically excluded from scoring — they're not indexable content.

## Input

Optional argument `$ARGUMENTS`: `settings` (site-level only), `pages` (page-level only), or a slug like `/about` (single page). Default is `all`.

Parse the argument:
- If it starts with `/`, treat it as a slug
- If it matches `settings` or `pages`, use as scope
- Otherwise, default scope is `all`

## Procedure

### Step 1: Run the audit

Call `sitemd_seo_audit` with the appropriate scope or slug parameter.

### Step 2: Present the report

Format the results as a readable report:

1. **Score header** — Show the overall score (0-100) with a brief assessment:
   - 90-100: "Excellent — your SEO is in great shape"
   - 70-89: "Good — a few things to tighten up"
   - 50-69: "Needs attention — several issues affecting your visibility"
   - Below 50: "Critical — your site has significant SEO gaps"

2. **Errors first** — List all failed checks with severity `error`. For each:
   - The issue (message)
   - Why it matters (why field)
   - How to fix it (fix field)

3. **Warnings** — List all failed checks with severity `warning`, same format

4. **Info/opportunities** — List failed `info` checks as "Opportunities to improve" — these are optional but valuable

5. **Passing checks** — Briefly note what's working well (count of passed checks)

6. **Summary line** — "X passed, Y errors, Z warnings, N opportunities"

### Step 3: Offer to fix issues

After presenting the report, offer to fix issues:

"I can fix [N] of these issues for you. Want me to handle them, or would you prefer to pick specific ones?"

For each error and warning that can be fixed:

- **Settings issues** — Read the relevant settings file (`settings/seo.md` or `settings/meta.md`), update the frontmatter field, and write it back. For fields that are commented out (prefixed with `#`), uncomment them and set the value.
- **Page meta issues** (missing title, description, bad length) — Read the page file, add or update frontmatter fields. For missing descriptions, derive one from the page content.
- **Content issues** (alt text, headings) — Describe what needs to change and offer to edit the page body.
- **Cross-page issues** (duplicates) — Show which pages conflict and offer to rewrite descriptions/titles to be unique.

Group fixes by file to minimize edits. Apply all fixes for a single file in one edit operation.

### Step 4: Re-run (optional)

After fixes, offer to re-run the audit to verify improvements:

"Want me to re-run the audit to see your updated score?"

## Rules

- **No permission required** — Call MCP tools immediately
- **Always show the full report before offering fixes** — Don't silently fix things
- **For description generation, derive from page content** — Don't invent descriptions
- **Group fixes by file** to minimize edit operations
- **Educational tone** — The why explanations should help site owners understand SEO, not just check boxes
- **Never mark a check as passing when it doesn't** — Be honest about the state
