---
# sitemd site identity — do not edit manually
---

# sitemd

This project uses [sitemd](https://sitemd.cc) — a markdown-first static site builder.

## Quick Start

```bash
./sitemd/sitemd launch
```

Open the dev server URL to see your site (port configured in `sitemd/settings/build.md`, default 4747). Edit pages in `sitemd/pages/`, configure in `sitemd/settings/`.

## Project Structure

```
sitemd/
  pages/           Markdown pages (one .md file per page)
  settings/        Site configuration (YAML frontmatter)
  theme/           HTML templates and CSS
  media/           Images and assets
  auth-pages/      Login, signup, forgot-password pages
  account-pages/   User dashboard pages
  gated-pages/     Authenticated-only content
  modals/          Global modal dialogs
  site/            Built output (gitignored)
```

## Agent Setup

Run `sitemd setup` to configure AI agent integration:

- Creates `.mcp.json` for MCP tool auto-discovery
- Adds sitemd context to `CLAUDE.md` / `AGENTS.md`
- Installs agent skills (`.agents/skills/`, `.claude/skills/`)

This runs automatically on first `sitemd launch` if not yet configured.

## For AI Agents

The sitemd MCP server provides tools for page management, content generation, deployment, and configuration. After setup, connect via `.mcp.json`.

Key tools: `sitemd_status` (project state), `sitemd_pages_create` (create pages), `sitemd_site_context` (writing briefs), `sitemd_deploy` (build and deploy).

Page format: markdown files with YAML frontmatter in `sitemd/pages/`. Settings: YAML frontmatter in `sitemd/settings/*.md`.

Run `sitemd setup` or call the `sitemd_status` MCP tool to get started.

## Documentation

Full docs at [sitemd.cc/docs](https://sitemd.cc/docs)
