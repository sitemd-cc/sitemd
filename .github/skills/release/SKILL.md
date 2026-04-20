---
name: release
description: Stage changelog entries and doc updates between releases, then publish them atomically. Usage: /release [add|sync|bump|status|docs-list|docs-discard|finalize [version]].
argument-hint: "[subcommand] [args]"
---

# Release

Accumulate a running log of user-impact changes and pending docs updates between releases of your site or product, then publish them atomically when you ship.

The standard flow is: do work → run `/release` at the end of the session → repeat → run `/release finalize` when you're ready to ship the next release.

## Storage

All staging state lives at `sitemd/staging/release/` inside the project root. This is an agent-agnostic location — visible to any coding agent without hiding inside `.claude/` or `.agents/`.

```
sitemd/staging/release/
  UNRELEASED.md          # running log of bullets for the next release
  docs-staged/           # mirrors pages/docs/ — pending doc page updates
```

`UNRELEASED.md` format:

```markdown
# Unreleased — targeting v0.1.1

Base: v0.1.0 (commit abc1234, 2026-04-03)

### Added
- new feature description in user-impact voice
  Docs: docs/new-feature.md

### Fixed
- bug description

---
Pending nav additions:
- docs/new-feature.md → group: docs
  - Overview: #overview
  - Usage: #usage
  - Syntax Reference: #syntax-reference

---
Last synced: <commit-sha> <iso-timestamp>
```

Section names mirror whatever style the project's existing changelog page uses. Default fallback: Keep a Changelog conventions (`Added`, `Changed`, `Fixed`, `Removed`).

Bullets are written in **user-impact voice**: present tense, lowercase first word, no trailing period. Internal-only refactors and chores are skipped.

## Path discovery

Before doing anything, the skill discovers project conventions:

- **Changelog page:** glob `pages/**/*.md` and look for any page with `slug: /changelog` in frontmatter. Fall back to `pages/changelog.md`. If neither exists, ask the user where the changelog should live and offer to create one with a basic template (`# Changelog\n\nA running log of everything shipped.\n`).
- **Docs section:** check whether `pages/docs/` exists. If not, ask the user where docs live, or skip docs staging entirely if the project has none.
- **Current version:** read the latest `## vX.Y.Z` heading from the changelog page to determine the base version. If the changelog has no entries yet, default base to `v0.0.0`.

## Subcommands

### `/release` (no args, default — end-of-session ritual)

Full wrap-up in one command:

1. **Scan session work.** Sources:
   - Files modified during the current agent session
   - `git log <Last synced>..HEAD` for committed work since the last run
   - `Last synced:` marker at the bottom of `UNRELEASED.md` is updated after each successful run, preventing double-logging

2. **Draft changelog bullets** in user-impact voice, grouped by section, matching the style of the project's existing changelog page. Skip internal-only changes (refactors with no user-visible effect, formatting, comment edits, test-only changes, dev-tooling tweaks).

3. **Invoke the `write` skill in staged mode** to draft any docs page updates the session's work warrants. Pass an output-directory override so writes land in `sitemd/staging/release/docs-staged/` (mirroring `pages/docs/`) instead of the live tree:

   ```
   /write docs --output sitemd/staging/release/docs-staged/
   ```

   Existing docs that need edits are first copied to staging, then modified there. If a staged copy already exists from a previous `/release` run, it's edited in place. If the project has no docs section, skip this step.

4. **Classify each staged doc as new or updated.** For each file in `docs-staged/`, check whether the same path exists under `pages/docs/`:
   - **Updated** — already in `pages/docs/`. Nav entry presumed to exist; finalize won't touch the sidebar.
   - **New** — doesn't exist in `pages/docs/`. Will need a sidebar entry inserted at finalize. Read the staged doc's frontmatter (`groupMember`, `slug`) and extract its `## H2` headings to draft the planned sub-anchor list (`- {Title}: #{slug-from-title}`).

5. **Present the full proposal** to the user: new bullets, list of doc files to be created/updated in staging (clearly marking which are **new** vs **updated**), the planned sidebar nav additions for new docs (group + sub-anchor list), and the current state of `UNRELEASED.md`. Ask for confirmation before writing anything.

6. **On confirmation:** append bullets to `UNRELEASED.md` (with `Docs:` sub-lines linking each bullet to its staged doc files), persist the staged docs, advance the `Last synced:` marker to the current `HEAD` SHA + ISO timestamp. Append a `Pending nav additions:` block at the bottom of `UNRELEASED.md` (above the `Last synced:` marker) listing each new doc and its planned group + sub-anchors, so the same plan survives across sessions and is auditable via `/release status`. If there are no new docs, omit the block.

7. **Print** the updated `UNRELEASED.md` and a summary of what's now staged, including the count of pending nav additions.

**Direct-edit guard:** while scanning, if you notice files were edited directly under `pages/docs/` (bypassing staging), warn the user and offer to move them into `sitemd/staging/release/docs-staged/`.

### `/release add <description>`

Manual append, bypassing session/git scanning. Useful when the user wants to log something specific in their own words. Rewrite the description in changelog voice, infer the appropriate section, and append to `UNRELEASED.md`. If the user is logging an internal-only change, push back and skip rather than logging it.

### `/release sync`

Same as the default but ignores the `Last synced:` marker and rebuilds proposed bullets from `git log <Base>..HEAD`. Recovery path for when the running log has drifted from reality (e.g. work was done without running `/release`).

### `/release bump [patch|minor|major]`

Update the target version in the `UNRELEASED.md` header. Default `patch`. Computes the next version from the base version. Does **not** modify `package.json` — version bumps to package metadata happen at ship time, not during release planning.

### `/release status`

Read-only print of `UNRELEASED.md` plus a summary: target version, number of bullets per section, number of staged doc files (split into new vs updated), number of pending sidebar nav additions, and number of commits since base.

### `/release docs-list`

Show what's currently in `sitemd/staging/release/docs-staged/`, so the user can audit before finalize. Mark each entry as **new** (no matching file in `pages/docs/` — will get a sidebar entry at finalize) or **updated** (overwrites an existing doc, no nav change). For new entries, also print the planned sub-anchor list parsed from H2 headings.

### `/release docs-discard <path>`

Remove a single staged doc file without applying it. Path is relative to `docs-staged/`.

### `/release finalize [version]`

When the user is ready to ship the next release. Optional `version` argument (e.g. `/release finalize v0.4.2` or `/release finalize 0.4.2`) overrides the `targeting vX.Y.Z` header in `UNRELEASED.md` — useful when an upstream command (like `/ship`) is authoritative on the version. If omitted, the version is read from the `UNRELEASED.md` header.

If `UNRELEASED.md` has no staged bullets, abort with a message rather than writing an empty section. The caller can decide whether to proceed without finalizing.

1. Read `UNRELEASED.md` and format the contents into a new `## vX.Y.Z — <date>` section, matching the format used by existing entries on the project's changelog page. Use the explicit `version` argument if provided, otherwise the header's target version. Use today's date.

2. Prepend the new section to the discovered changelog page, directly under any existing intro / above the previous most-recent version.

3. For every file in `sitemd/staging/release/docs-staged/`, copy it to its matching path under `pages/docs/` (overwriting). Then empty `docs-staged/`.

4. **Insert sidebar nav entries for newly-copied docs.** Read the `Pending nav additions:` block from `UNRELEASED.md` (populated during the staging step). For each entry:

   - Call the `sitemd_groups_add_pages` MCP tool to insert the page into its declared group(s) with the staged sub-anchor list. This tool handles the indent-sensitive YAML in `groups.md` correctly — never hand-edit `groups.md` directly, because validation hooks may strip entries that don't match expected formatting.
   - Insertion order: append to the end of the group's `items:` list. Users can manually reorder later if needed.

   If the `Pending nav additions:` block is missing (e.g. staging happened in an older version of the skill, or was hand-edited), fall back to the discovery method: for each file copied in step 3, check whether its slug is already in `settings/groups.md`; if not, read its frontmatter (`groupMember`, `slug`) and H2 headings, then call `sitemd_groups_add_pages` as above.

   This step must run **after** step 3 (the doc copy) — validation hooks reject nav entries pointing at pages that don't yet exist under `pages/docs/`.

5. Reset `UNRELEASED.md` to a fresh template seeded with:
   - `targeting v<next-patch>` — the next patch bump from the version just released
   - `Base: vX.Y.Z (commit <new-HEAD-sha>, <today>)`
   - Empty section list
   - Updated `Last synced:` marker

6. Invoke the `deploy` skill (`/deploy`) so the new changelog entry, docs updates, and nav additions go live in a single deploy.

7. Print confirmation including the new version, the number of bullets shipped, the number of doc files updated, the number of nav entries inserted, and the deploy result. **Does not** commit, push, or modify `package.json`.

## Voice rules

- **User-impact voice.** Lead with what the user gets or what changed for them, not implementation details.
- **Present tense, lowercase first word, no trailing period.** Match the style of existing entries on the project's changelog page exactly — read it before writing.
- **Skip internal-only changes.** Refactors, test-only edits, formatting, build tooling, comment changes, and chores never get logged. If the user explicitly tries to log one via `/release add`, push back.
- **One bullet per user-visible change**, not one per commit. If a feature took five commits, it's still one bullet.

## Rules

- **No permission required for read-only subcommands** (`status`, `docs-list`). All other subcommands present a proposal and ask for confirmation before writing.
- **Never commits, never pushes, never bumps `package.json`.** This skill stages and publishes content, not version metadata.
- **Path discovery is mandatory** — never hardcode paths. Different projects use different conventions for where the changelog and docs live.
- **Idempotent.** Running `/release` twice in a row with no work in between should produce no new bullets (the `Last synced:` marker prevents double-logging).
