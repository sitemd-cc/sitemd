---
name: site
description: Show sitemd project status and available actions via MCP, mirroring the interactive CLI experience.
---

# sitemd CLI

Show project status and available actions — the MCP-powered equivalent of the interactive `sitemd` CLI.

## Procedure

1. Call the `sitemd_status` MCP tool (no arguments) to get project state
2. **If fresh project** (siteName "My Site" and ≤4 pages):
   - This is a new installation. Launch the full onboarding flow:
     a. Run `/launch` to start the user's site — open in browser
     b. Run `/launch demo` to start the demo showcase — open in browser
     c. Tell the user: "Your blank site is live and the demo showcase is running too. Browse the demo to see what's possible."
     d. Ask: "What are you building? One sentence is enough."
     e. Run `/kickstart` with their answer — user watches their site update live
3. **If existing project**: present the results as a formatted status overview:
   - Project name, page count
   - Auth state (logged in / not logged in)
   - Deploy config (domain, target, or "not configured")
   - Email and analytics status
4. List the **actions** from the response as numbered options the user can ask for
5. Ask the user what they'd like to do

## MCP Tool Reference

These tools mirror the terminal CLI commands:

| Action | MCP Tool | Notes |
|--------|----------|-------|
| Project status | `sitemd_status` | Full state overview |
| Deploy | `sitemd_deploy` | Build + deploy |
| Log in | `sitemd_auth_login` | Returns a browser URL + code |
| Poll login | `sitemd_auth_poll` | Complete OAuth after user visits URL |
| Auth status | `sitemd_auth_status` | Account + license info |
| Log out | `sitemd_auth_logout` | Clear credentials |
| View config | `sitemd_status` | Full state includes config |
| Set config | `sitemd_config_set` | Set a key/value pair |
| Delete config | Edit `.sitemd/config.json` | Remove a config value |

For `sitemd_config_set`, known keys: `deploy.cloudflareProject`, `deploy.cloudflareAccountId`, `deploy.cloudflareApiToken`, `email.provider`, `email.apiKey`, `analytics.id`, `analytics.gtm`, etc.

## Rules

- **No permission required** — Call MCP tools immediately
- Use the dev server (`/launch`) for serving, not MCP — MCP handles everything else
- When setting up config interactively, ask the user for each value in conversation, then call `sitemd_config_set` for each one
