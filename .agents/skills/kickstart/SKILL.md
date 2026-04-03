---
name: kickstart
description: "Generate a complete first-draft site from a single prompt. Usage: /kickstart [what you're building]"
argument-hint: "[what you're building]"
---

# Kickstart

Build a complete first-draft site from a single user prompt. This is the "magic moment" — user writes one sentence, watches their site come alive in real-time via live reload.

## Input

The user's description of what they want: `$ARGUMENTS`

If no arguments, ask: "What are you building? One sentence is enough."

## Procedure

### Step 1: Gather Context

Call these MCP tools in parallel:
- `sitemd_site_context` with contentType "page" and the user's description as topic
- Glob `pages/**/*.md` to see current state
- Read `settings/groups.md` for group structure

### Step 2: Plan the Site

Based on the user's description, plan 3-6 pages:
- Home page (always)
- 2-4 content pages based on what they're building
- About page (if relevant)

Plan the navigation (header items) and any groups (docs sidebar, blog, etc.).

Present the plan briefly: "I'll create: Home, [pages...]. Here we go." — then proceed immediately without waiting for confirmation. This is a first draft, not a contract.

### Step 3: Update Settings

Update these settings files directly (read each first, then edit the frontmatter):

1. `settings/meta.md` — site title, brand name, description based on user's description
2. `settings/header.md` — navigation items matching planned pages
3. `settings/footer.md` — brand name, relevant links
4. `settings/groups.md` — add groups if the site needs them (docs sidebar, blog, etc.)

### Step 4: Create Pages

For each planned page, call `sitemd_pages_create`:
- Write real content (not placeholder) using the user's description as context
- Use rich components from the syntax reference:
  - `button:` for CTAs and navigation
  - `card:` blocks for feature grids, services, or options
  - `gallery:` or `image-row:` for visual content
  - `embed:` for video/audio
  - `modal:` for supplementary content
  - `[text]{tooltip}` for inline definitions
- Follow voice rules: second person, present tense, no hedging, lead with reader value
- Proper frontmatter: title, description (<160 chars), slug (`/` for home page), sidebarGroupShown, groupMember

### Step 5: Validate

Call `sitemd_content_validate` on each created page. Fix any failures.

### Step 6: Report

- List what was created (pages, settings updates)
- Remind user the dev server auto-rebuilds — their site is already live
- Suggest next steps: "Edit any page directly, use /write to add more content, or browse the demo at :4848 for component inspiration"

## Rules

- **No permission required** — Execute immediately
- **Speed over perfection** — This is a first draft. Real content, but don't agonize over every word
- **Use the user's words** — Mirror their language and framing in the content
- **3-6 pages max** — Keep the first draft focused. User can add more later
- **Always use components** — Cards, buttons, embeds make the site feel real, not a text dump
- **Real content only** — No placeholder text, no lorem ipsum, no "coming soon"
- **Delete the default home page first** — The scratch template ships with a generic welcome page. Remove it before creating the real home page
