---
name: launch
description: "Launch the sitemd dev server. Usage: /launch [demo|scratch]. No args serves the user's project."
argument-hint: "[demo|scratch]"
---

# Launch Site

Starts the dev server with file watching and live build sync, then opens in the default browser.

## Input

Optional target from arguments: `$ARGUMENTS`

- No arguments → serve the user's project (`sitemd/`)
- `demo` → serve the demo component showcase (`sitemd/templates/demo/`)
- `scratch` → serve the blank-slate template (`sitemd/templates/scratch/`)

## Procedure

### Determine the target

1. Parse `$ARGUMENTS` for "demo" or "scratch"
2. If **demo**: set root to `sitemd/templates/demo/`, read port from its `settings/build.md` (default 4848)
3. If **scratch**: set root to `sitemd/templates/scratch/`, read port from its `settings/build.md` (default 4747)
4. If **no arguments**: set root to `sitemd/`, read port from its `settings/build.md` (default 4747)

### Check binary

1. Check if `sitemd/sitemd` binary exists in the project
2. If missing, run `./sitemd/install` to download it

### Check dependencies

1. Check if `<root>/node_modules/` exists (where `<root>` is the target directory from step 1)
2. If missing or if `package.json` is newer than `node_modules/`, run `npm install` from `<root>`
3. If install fails, warn the user but continue launching — some features (icons, OG images) may not work

### Launch the server

1. Kill any existing process on the determined port: `lsof -ti:<port> | xargs kill 2>/dev/null; true`
2. Start the dev server in background: `cd <root> && ./sitemd/sitemd launch &` (for demo/scratch, use `SITEMD_PROJECT_ROOT="$(pwd)" ./sitemd/sitemd launch &` from inside the target directory)
3. Wait 1 second for the server to start, then open in browser:
   - If Chrome is installed (`/Applications/Google Chrome.app` exists), open with a dedicated debugging profile and DevTools: `sleep 1 && open -na "Google Chrome" --args --user-data-dir="/tmp/sitemd-chrome-debug" --auto-open-devtools-for-tabs http://localhost:<port>`
   - Otherwise: `sleep 1 && open http://localhost:<port>`
4. Tell the user what's running:
   - Demo: "Demo showcase is live at http://localhost:<port> — browse to see what sitemd can do"
   - Scratch: "Blank-slate template is live at http://localhost:<port>"
   - Project: "Your site is live at http://localhost:<port> with live build sync — file changes auto-rebuild"

## Rules

- **No permission required** — Execute immediately without asking
- **Read the port from the target's settings** — do not hardcode ports
- **Set `SITEMD_PROJECT_ROOT`** when launching demo/scratch — tells the binary the actual project root
- **Use `./sitemd/sitemd launch`** — the compiled binary, not `node engine/build --serve`
- **Background the server** so the terminal stays usable
