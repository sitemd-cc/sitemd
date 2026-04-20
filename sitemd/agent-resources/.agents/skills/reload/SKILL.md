---
name: reload
description: "Trigger a dev server hot-reload without restarting the server."
---

# Reload Site

Trigger a full site rebuild using the MCP build tool. The dev server picks up the changes and hot-reloads the browser automatically.

## Procedure

1. Call `sitemd_build` (no arguments)
2. Report the result to the user:
   - Number of pages built
   - Number of card images generated (if any)
   - Build mode (trial or activated)
3. The browser will hot-reload automatically

## Rules

- **No permission required** — Execute immediately
- This triggers a one-shot rebuild via MCP, not a dev server restart
- If the user wants continuous rebuilds on file changes, suggest `/launch` instead
- This is NOT a production build — use `sitemd deploy` or `sitemd build` for production output
