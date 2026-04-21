---
name: sitemd-merge
description: Reconcile conflicts left behind by sitemd's non-destructive installer. Runs when the user asks to "merge the sitemd install conflicts" or similar. Looks for .mcp-sitemd.json and *-sitemd/ directories in .claude/skills/ and .agents/skills/, then merges or replaces per user preference.
---

# Reconcile sitemd install conflicts

The sitemd installer never destroys existing agent content. When it encounters collisions, it writes its version to a deferred location and leaves the user's original files untouched. This skill walks those deferred files and merges them into the live configuration.

## What to look for

Scan the project root for these:

| Deferred file | What it means |
|---|---|
| `.mcp-sitemd.json` | Existing `.mcp.json` had a `sitemd` entry with a different command. Our entry was deferred. |
| `.claude/skills/<name>-sitemd/` | A Claude skill with the same name already existed. Our version was deferred. |
| `.agents/skills/<name>-sitemd/` | Same, for the generic `.agents/` tree. |

`CLAUDE.md` and `AGENTS.md` are never deferred — sitemd's content is appended inside a `<!-- sitemd:begin --> ... <!-- sitemd:end -->` marker block (or the file is created if missing). If you see a `CLAUDE-sitemd.md` or `AGENTS-sitemd.md`, it's from a pre-0.1.3 install or a manual rename; treat it as deferred content the user wants merged.

## Procedure

### 1. Inventory

Run:
```
ls .mcp-sitemd.json 2>/dev/null
find .claude/skills -maxdepth 1 -type d -name '*-sitemd' 2>/dev/null
find .agents/skills -maxdepth 1 -type d -name '*-sitemd' 2>/dev/null
```

If nothing is returned, there are no conflicts. Tell the user, exit.

### 2. Reconcile `.mcp-sitemd.json`

Read both `.mcp.json` and `.mcp-sitemd.json`. Show the user the existing `sitemd` entry and the deferred one. Ask: "Keep existing, replace with sitemd's version, or merge?"

- **Keep existing** → delete `.mcp-sitemd.json`.
- **Replace** → take the `sitemd` key from `.mcp-sitemd.json` and overwrite it in `.mcp.json`; delete `.mcp-sitemd.json`.
- **Merge** → Rare for MCP entries since they're just `command` + `args`. If the user really wants to run both, they need a different server name — ask what to call it and add that instead.

### 3. Reconcile skill collisions

For each `<name>-sitemd/` directory:

1. Read both `<name>/SKILL.md` and `<name>-sitemd/SKILL.md`.
2. Show the user the difference — frontmatter + body.
3. Ask which to keep:
   - **Existing** → delete `<name>-sitemd/`.
   - **Sitemd's** → delete `<name>/`, rename `<name>-sitemd/` → `<name>/`.
   - **Both (rename one)** → ask for a new name for the sitemd version, e.g. `<name>-vendor/` or `sitemd-<name>/`.

Do the same pass for `.claude/skills/` and `.agents/skills/`.

### 4. Verify

After each merge decision, verify:
- `.mcp.json` is valid JSON with a working `sitemd` entry (command path resolves).
- Every skill directory contains a `SKILL.md`.
- No `*-sitemd` files or `.mcp-sitemd.json` remain unless the user explicitly kept them.

### 5. Summarize

Tell the user what was merged, what was kept as-is, and what (if anything) still needs attention.

## Guidelines

- **Never destroy without showing the diff first.** If the user would benefit from seeing what they're losing, show it.
- **Prefer merge over replace** when both files have non-trivial differences. Most skill collisions are because the user customized a skill — their version usually wins.
- **After MCP merge, remind the user to restart their agent session** — MCP server discovery happens at agent boot.
- If something goes wrong (malformed JSON, permission errors), stop and report the error verbatim. Don't try to paper over it.
