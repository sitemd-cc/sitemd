# sitemd

Websites from Markdown. Built for AI coding assistants.

sitemd turns a folder of markdown files into a production-ready static website with navigation, search, themes, forms, analytics, SEO, and more — all configured through simple settings files.

## Quick Start

```bash
npm install -g @sitemd-cc/sitemd
sitemd init my-site
cd my-site
npm install
sitemd launch
```

Open the dev server URL to see your site (port configured in `sitemd/settings/build.md`, default 4747).

## AI Integration

sitemd ships a single skill for Claude Code and other AI coding agents. The `.claude/skills/sitemd/` and `.agents/skills/sitemd/` directories route agent intent to CLI commands.

All operations go through the `sitemd` CLI — run `sitemd help` for the full command list.

## Project Structure

```
my-site/
  sitemd/          <- Product directory
    pages/         <- Your markdown content
    settings/      <- Site configuration (YAML frontmatter)
    theme/         <- CSS and HTML templates
    media/         <- Images and assets
    site/          <- Built output (gitignored)
  site.md          <- Project context for AI agents
  .claude/skills/sitemd/  <- Claude Code skill
  .agents/skills/sitemd/  <- Generic agent skill
```

## Features

- **Pages from Markdown** — Write content in `.md` files with frontmatter
- **Navigation** — Header, footer, sidebar groups, dropdowns, search
- **Themes** — Light, dark, paper modes with full color customization
- **Cards, Embeds, Galleries** — Rich content components
- **Forms** — Multi-page forms with conditional logic and webhooks
- **Analytics** — Google Analytics, Plausible, Fathom, PostHog, and more
- **SEO** — OG images, sitemaps, structured data, AI crawler control
- **User Auth** — Supabase, Firebase, Clerk, Auth0, custom API
- **Dynamic Data** — Connect to Supabase, Firebase, Airtable, REST APIs
- **Deploy** — `sitemd deploy` to Cloudflare, or host `site/` anywhere

## CLI Commands

```bash
sitemd launch              # Start dev server
sitemd deploy              # Build and deploy
sitemd status              # Project overview
sitemd pages               # List pages
sitemd pages create <slug> # Create a page
sitemd clone <url>         # Clone a website
sitemd auth login          # Log in to your account
sitemd secret set K=V      # Set a secret
sitemd config setup        # Configure services
sitemd update              # Update to latest version
```

## Documentation

Full docs at [sitemd.cc/docs](https://sitemd.cc/docs)

## License

[Elastic License 2.0](LICENSE.md)
