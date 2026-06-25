---
name: sitemd
description: "Manage this sitemd project — pages, settings, deploy, dev server, and content generation. All operations route through the sitemd CLI."
---

# sitemd

This project uses [sitemd](https://sitemd.cc) — a markdown-first static site builder. All operations go through the `sitemd` CLI. Run `sitemd help` for the full command list.

## Common Commands

```bash
sitemd launch              # Start dev server (localhost:4747)
sitemd deploy              # Build and deploy
sitemd status              # Project overview
sitemd pages               # List all pages
sitemd pages create <slug> # Create a new page
sitemd pages delete <slug> # Delete a page
sitemd groups              # List sidebar groups
sitemd groups add <g> <s>  # Add page to group
sitemd seo [slug]          # SEO health check
sitemd validate [slug]     # Content quality check
sitemd clone <url>         # Clone a website
sitemd auth login          # Log in
sitemd auth setup          # Enable user auth
sitemd secret set K=V      # Set a secret
sitemd config set <k> <v>  # Set a config value
```

## Project Structure

```
sitemd/
  pages/           Markdown pages (one .md per page)
  settings/        Site config (YAML frontmatter in .md files)
  theme/           HTML templates and CSS
  media/           Images and assets
  auth-pages/      Login, signup, forgot-password
  account-pages/   User dashboard
  gated-pages/     Authenticated-only content
  site/            Built output (gitignored)
```

## Page Format

Pages are markdown files with YAML frontmatter:

```markdown
---
title: Page Title
description: Short description for SEO
slug: /my-page
---

# Heading

Content goes here.
```

Key frontmatter fields: `title`, `description`, `slug`, `groupMember` (sidebar group), `sidebarGroupShown` (which sidebar to display).

## Settings

All config lives in `sitemd/settings/*.md` as YAML frontmatter:
- `meta.md` — site name, URL, description
- `build.md` — dev server port, output options
- `deploy.md` — deploy target and settings
- `header.md` — navigation links
- `footer.md` — footer content
- `groups.md` — sidebar group definitions
- `auth.md` — user authentication config

Secrets (API keys, tokens) go in `.sitemd/secrets` (flat KEY=VALUE file, gitignored). Manage with `sitemd secret set/list/remove`.

## Content Generation

When creating pages, use `sitemd pages create <slug>` with flags:
- `--title "Title"` — page title
- `--description "Desc"` — SEO description
- `--group docs` — add to a sidebar group
- `--content "# Heading\n\nBody"` — markdown content

For docs pages, always set both `groupMember` and `sidebarGroupShown` to the same group name so the sidebar renders.

## Deployment

Configure deploy target in `sitemd/settings/deploy.md`. Set credentials with `sitemd secret set`. Then run `sitemd deploy`.
