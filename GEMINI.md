# sitemd

You are working in a sitemd project — a markdown-based static site builder.

## First Steps

1. **If no binary** (`sitemd/sitemd` does not exist) — run `./sitemd/install` to download it
2. Call `sitemd_status` to understand the project state
3. Read files in `pages/` to see existing content
4. Call `sitemd_site_context` with a content type to get site identity, conventions, and existing pages
5. Create pages with `sitemd_pages_create` — use rich components (buttons, cards, embeds, galleries)
6. Validate with `sitemd_content_validate`

## Project Structure

```
sitemd/            ← Product directory
  sitemd           ← Compiled binary (run ./sitemd/sitemd launch)
  install          ← Bootstrap script (downloads binary on first run)
  pages/           ← Markdown content files
  settings/        ← Site configuration (YAML frontmatter in .md files)
  theme/           ← CSS and HTML templates
  media/           ← Images and assets
  site/            ← Built output
```

## How It Works

- Pages are `.md` files in `sitemd/pages/` with YAML frontmatter for metadata
- Settings are `.md` files in `sitemd/settings/` with YAML frontmatter for configuration
- The build engine reads pages + settings + theme and produces static HTML in `sitemd/site/`
- Run `./sitemd/sitemd launch` to start the dev server with live reload

## MCP Tools Available

You have access to sitemd MCP tools. Read pages, settings, and groups files directly — no MCP tool needed for reads. Pages: `pages/{slug}.md`. Settings: `settings/{name}.md`. Groups: `settings/groups.md`.

- **sitemd_status** — Project state (pages, auth, config)
- **sitemd_pages_create** — Create new pages (writes file + adds to nav + groups)
- **sitemd_pages_create_batch** — Create multiple pages in one call
- **sitemd_pages_delete** — Delete a page (cleans up nav + group references)
- **sitemd_groups_add_pages** — Add pages to group sidebar (indent-sensitive format)
- **sitemd_site_context** — Site identity, existing pages, conventions
- **sitemd_content_validate** — Validate page content and frontmatter
- **sitemd_seo_audit** — SEO health check with scored report
- **sitemd_init** — Initialize project from template
- **sitemd_build** — Build site locally
- **sitemd_deploy** — Build and deploy to configured target
- **sitemd_activate** — Activate site (permanent)
- **sitemd_clone** — Clone an existing website
- **sitemd_config_set** — Manage backend config (routes secrets vs non-secrets)
- **sitemd_auth_login/poll/status/logout/api_key** — Authentication
- **sitemd_auth_setup** — Enable user authentication
- **sitemd_update_check/apply** — Check and apply updates

## Settings Files

All configuration is in `settings/*.md` frontmatter:

| File | Controls |
|---|---|
| meta.md | Site title, brand name, description, URL |
| header.md | Navigation items, brand display, search |
| footer.md | Footer links, copyright, social |
| groups.md | Page groups for sidebars and dropdowns |
| theme.md | Colors, fonts, layout, light/dark/paper modes |
| build.md | Dev server port, output directory |
| deploy.md | Domain, deploy target |
| seo.md | OG images, sitemaps, structured data |
| forms.md | Form defaults |
| analytics.md | Analytics provider |
| auth.md | User authentication provider |
| data.md | Dynamic data provider |
| email.md | Transactional email provider |
| content.md | Content generation settings |

## Key Conventions

- Edit settings by modifying YAML frontmatter, not the markdown body
- Pages use frontmatter for title, description, layout, group membership
- The dev server auto-rebuilds on file changes
- Use MCP tools for creating pages and managing content — they handle frontmatter, groups, and validation automatically

## Markdown Extensions

Beyond standard markdown, sitemd supports rich components. This is the canonical syntax reference.

### Buttons
`button: Label: /slug` on its own line. Consecutive lines form a row.
Modifiers: `+outline`, `+big`, `+newtab`, `+sametab`, `+color:red` (any named color or `+color:#hex`)

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
`embed: URL` — auto-detects YouTube, Vimeo, Spotify, X/Twitter, Reddit, Instagram, LinkedIn, TikTok, CodePen.

### Images
`![alt](url +modifier)` — modifiers appended after the URL.
Modifiers: `+width:N`, `+height:N`, `+crop:WxH`, `+circle`, `+square`, `+rect`, `+bw`, `+sepia`, `+rotate:1|2|3`, `+corner:none|subtle|curve`, `+expand` (lightbox)

### Gallery
```
gallery:
  ![Photo one](/media/1.jpg)
  ![Photo two](/media/2.jpg)
```

### Image Row
```
image-row:
  ![First](/media/one.jpg)
  ![Second](/media/two.jpg)
```

### Tooltips
`[visible text]{tooltip content}` — inline, hover/tap to show.

### Modals
```
modal: team-info
  ## Meet the Team
  Content here (indented)

[Meet our team](#modal:team-info)
```

### Inline Anchors
`{#custom-id}` on its own line. Link with `[text](#custom-id)`.

### Link Modifiers
`[text](url+newtab)` — opens in new tab.

### Forms
```
form:
  webhook: https://hooks.example.com/contact
  fields:
    - id: email
      type: email
      label: Email
      required: true
```

### Gated Sections
```
gated: premium, enterprise
  Content only visible to these user types.
/gated
```

### Dynamic Data
```
data: products
data-display: cards
data-title: name
data-text: {{description}}
```
