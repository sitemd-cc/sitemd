# sitemd

This project uses [sitemd](https://sitemd.cc) — a markdown-first static site builder.

## Quick Start

```bash
sitemd launch    # Start dev server at localhost:4747
sitemd deploy    # Build and deploy to configured target
sitemd status    # Show project overview
sitemd help      # Full command list
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

Pages are markdown files with YAML frontmatter in `sitemd/pages/`. Key fields: `title`, `description`, `slug`, `groupMember` (sidebar group), `sidebarGroupShown` (which sidebar to display).

## Settings

Non-secret config lives in `sitemd/settings/*.md` as YAML frontmatter (meta, build, deploy, header, footer, groups, auth). Secrets (API keys, tokens) live in `.sitemd/secrets` — a flat KEY=VALUE file, managed via `sitemd secret set/list/remove`.

## Documentation

Full docs at [sitemd.cc/docs](https://sitemd.cc/docs)
