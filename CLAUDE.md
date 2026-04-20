# sitemd

sitemd is a markdown-first static site builder. Pages are `.md` files with YAML frontmatter. Settings are YAML frontmatter in `settings/*.md`. The build engine converts everything to static HTML.

## First Steps

1. **If no binary** (`sitemd/sitemd` does not exist) — run `./sitemd/install` (Unix) or `node sitemd/install.js` (any platform) to download it
2. Call `sitemd_status` to understand the project state
3. **If fresh project** (siteName "My Site", ≤4 pages) — this is a new installation:
   a. Run `/launch` to start the user's site (port 4747) — open in browser
   b. Run `/launch demo` to start the demo showcase (port 4848) — open in browser
   c. Tell the user: "Your blank site is live at :4747 and the demo showcase is at :4848. Browse the demo to see what's possible."
   d. Ask: "What are you building? One sentence is enough."
   e. Run `/kickstart` with their answer — the user watches their site update live as pages are created
4. **If existing project** — continue normal workflow:
   a. Glob `pages/**/*.md` and read frontmatter to see existing content
   b. Call `sitemd_site_context` with a content type to get site identity, conventions, and existing pages
   c. Create pages with `sitemd_pages_create` — use rich components (buttons, cards, embeds, galleries)
   d. Validate with `sitemd_content_validate`

## Quick Start

```bash
./sitemd/install                    # Download binary (or: node sitemd/install.js)
./sitemd/sitemd launch              # Dev server on localhost:4747
```

Note: when sitemd was installed via `npm install` or `npx @sitemd-cc/sitemd init`, the binary downloads automatically via the package's `postinstall` hook — no separate install step is needed unless you ran with `--ignore-scripts`.

## File Structure

```
sitemd/              # Product directory
  sitemd             # Compiled binary (run ./sitemd/sitemd launch)
  install            # Bootstrap script (downloads binary on first run)
  pages/             # Markdown pages → HTML (slug derived from file path or frontmatter)
  settings/          # Site configuration (YAML frontmatter, no markdown body)
    meta.md          # Site title, brand name, description, URL
    header.md        # Navigation items
    footer.md        # Footer content, social links
    groups.md        # Page groups (sidebar, header dropdown, footer columns)
    theme.md         # Colors, fonts, CSS variables
    build.md         # Build mode settings
    seo.md           # SEO configuration
    content.md       # Content generation settings
    deploy.md        # Deployment target
    auth.md          # Authentication provider
    forms.md         # Form defaults
    email.md         # Email provider
    analytics.md     # Analytics provider
    data.md          # Dynamic data provider
  theme/             # HTML layout templates and CSS
  .sitemd/           # Local config (gitignored)
    config.json      # Secrets (API keys, tokens) — managed via sitemd_config_set
```

## File Path Conventions

Read and edit these files directly — no MCP tool needed for reads.

- **Pages**: `pages/{slug}.md` — e.g., `/about` → `pages/about.md`, `/docs/setup` → `pages/docs/setup.md`, `/` → `pages/home.md`
- **Settings**: `settings/{name}.md` — read directly, preserve inline `#` comments when editing
- **Groups**: `settings/groups.md` — read directly, but use `sitemd_groups_add_pages` for writes (indent-sensitive 2-10 space levels)
- **Secrets**: `.sitemd/config.json` (gitignored) — always use `sitemd_config_set` (routes secrets vs non-secrets)

## Page Format

Every page is a markdown file with YAML frontmatter:

```yaml
---
title: Page Title — sitemd
description: SEO description, under 160 characters
slug: /url-path               # use "/" for the home page
sidebarGroupShown: docs       # which group sidebar to show (or "none")
groupMember:
  - docs                      # group membership
---

# Page content in markdown
```

## Settings Format

Settings files use YAML frontmatter with inline `#` comments. No markdown body.

```yaml
---
# What this setting does
settingName: defaultValue

# Section header
anotherSetting: value
---
```

## MCP Tools

sitemd exposes MCP tools for programmatic access. Connect via `.mcp.json`. For reads (pages, settings, groups), use native file tools directly — see File Path Conventions above.

### Content Creation
- `sitemd_pages_create` — Create a new page (writes file + adds to header nav + adds to groups.md sidebar)
- `sitemd_pages_create_batch` — Create multiple pages in one call
- `sitemd_pages_delete` — Delete a page (removes file + cleans up nav and group references)
- `sitemd_groups_add_pages` — Add pages to a group sidebar (handles indent-sensitive groups.md format)
- `sitemd_site_context` — Get site identity, existing pages, conventions, and type-specific state before writing content
- `sitemd_content_validate` — Quality-check a page (description length, links, type-specific rules)
- `sitemd_seo_audit` — Comprehensive SEO health check with scored report and recommendations

### Build & Deploy
- `sitemd_status` — Full project state (replaces reading multiple files)
- `sitemd_init` — Initialize project from scratch template
- `sitemd_build` — Build site locally (render pipeline + validation)
- `sitemd_deploy` — Build and deploy to configured hosting
- `sitemd_activate` — Activate site (permanent, consumes 1 site slot)
- `sitemd_clone` — Scrape existing website into sitemd pages

### Config & Auth
- `sitemd_config_set` — Set config values (routes secrets to .sitemd/config.json, non-secrets to settings/*.md)
- `sitemd_auth_login` / `sitemd_auth_poll` / `sitemd_auth_status` / `sitemd_auth_logout` / `sitemd_auth_api_key` — Authentication
- `sitemd_auth_setup` — Enable user authentication on site

### Updates
- `sitemd_update_check` / `sitemd_update_apply` — Check for and apply sitemd updates

## Content Generation

When writing content for a sitemd site, follow these conventions:

### Before Writing
Call `sitemd_site_context` with the content type (`page`, `docs`, `blog`, `changelog`, `roadmap`) and topic. This returns site identity, existing pages, title conventions, and current state. The full syntax reference is documented below — no tool call needed for syntax.

### Writing Conventions by Type

**General pages:** Second person, present tense, no hedging. Lead with reader value. Description under 160 chars.

**Docs:** Imperative mood ("Add the field"). No marketing language. Show what to type. Code blocks with language hints. Tables for reference. Must have `sidebarGroupShown: docs` and `groupMember: [docs]`. Add nested anchors to `groups.md`.

**Blog:** Opinionated with a thesis. Date line as `**Month DD, YYYY**`. 400-1200 words. Short paragraphs. Must have `groupMember: [blog]`.

**Changelog:** Prepend `## vX.Y.Z — Month DD, YYYY` with `### Added/Changed/Fixed/Removed`. Terse, factual. Run `git log` for commit data. Prepend new entries to the changelog page file directly.

**Roadmap:** Three sections: Shipped / In Progress / Planned. Items as `- **Name** — One sentence`. No dates on planned items.

### After Writing
Call `sitemd_content_validate` to check quality. Fix any failures.

### Draft Mode
Set `draft: true` in frontmatter for pages that shouldn't appear in production builds. Drafts are visible in the dev server with a banner.

## Groups System

Groups organize pages into navigable collections (sidebar, header dropdown, footer column). Defined in `settings/groups.md`:

```yaml
groups:
  - name: docs
    itemOrder: manual
    locations:
      - sidebar:
          - group: docs
      - header
    items:
      - Getting Started: /docs/getting-started
        - Installation: #installation
        - First Page: #first-page
```

Pages join groups via frontmatter `groupMember` field.

## Markdown Extensions

Beyond standard markdown, sitemd supports rich components. This is the canonical syntax reference — use it directly when writing content.

### Buttons
`button: Label: /slug` on its own line. Consecutive lines form a row.
Modifiers: `+outline`, `+big`, `+newtab`, `+sametab`, `+color:red` (any named color or `+color:#hex`)
Targets: `/slug`, `https://url`, `#anchor`, `mailto:email`, `none` (non-linking span), `silent`

```
button: Get Started: /docs
button: Learn More: /about +outline
```

### Cards
Consecutive blocks form a responsive 2-column grid. All fields except `card:` are optional.

```
card: Feature One
card-text: Description of the feature.
card-link: Learn more: /features/one

card: Feature Two
card-text: Another description.
card-image: /media/feature-two.jpg
card-link: Explore: /features/two
```

### Embeds
`embed: URL` — auto-detects YouTube, Vimeo, Spotify, X/Twitter, Reddit, Instagram, LinkedIn, TikTok, CodePen. Any other URL becomes a responsive iframe.

### Images
`![alt](url +modifier)` — modifiers are order-independent, appended after the URL.
Modifiers: `+width:N`, `+height:N`, `+crop:WxH`, `+circle`, `+square`, `+rect`, `+bw`, `+sepia`, `+rotate:1|2|3`, `+corner:none|subtle|curve`, `+expand` (lightbox)

### Gallery
Grid layout with click-to-expand lightbox. Flags: `+noexpand`, `+corner:curve`

```
gallery:
  ![Photo one](/media/1.jpg)
  ![Photo two](/media/2.jpg)
  ![Photo three](/media/3.jpg)
```

### Image Row
Equal-height flex row. Mobile wraps to 2 per row.

```
image-row:
  ![First](/media/one.jpg)
  ![Second](/media/two.jpg)
```

### Tooltips
`[visible text]{tooltip content}` — inline, hover/tap to show. Plain text only in tooltip.

### Modals
Indented content block, triggered via `[link text](#modal:id)` or `button: Label: #modal:id`

```
modal: team-info
  ## Meet the Team
  We are a small group focused on developer tools.
  button: Say Hello: /contact

[Meet our team](#modal:team-info)
```

Tabbed modals: use `tab: Tab Name` inside the block. Global modals: create `modals/modal-id.md`.

### Inline Anchors
`{#custom-id}` on its own line. Headings auto-generate IDs (`## Getting Started` → `#getting-started`).
Cross-page links: `[text](/docs/page#section-id)`

### Link Modifiers
`[text](url+newtab)` — opens in new tab. `+sametab` forces same tab for external links.

### Forms
Indented YAML block with webhook, fields, and optional multi-page routing.

```
form:
  webhook: https://hooks.example.com/contact
  submitLabel: Send
  fields:
    - id: email
      type: email
      label: Email
      required: true
    - id: message
      type: longtext
      label: Message
```

Field types: shorttext, longtext, email, phone, number, date, name, address, country, dropdown, radio, checkbox, rating, consent, hidden.

### Gated Sections
Content visible only to specific user types.

```
gated: premium, enterprise
  This content is only visible to premium and enterprise users.
/gated
```

### Dynamic Data
`data: source` with display options. Source defined in `settings/data.md`.

```
data: products
data-display: cards
data-title: name
data-text: {{description}}
data-link: View: /products/{{slug}}
```

## Build Modes

- **Trial** (default): All features work locally. Memory-only output (no `site/` directory).
- **Activated**: Full output to `site/`, SEO files, clean HTML. Requires auth + site activation (permanent, consumes 1 site slot). Every build/deploy verifies site identity with the API.
