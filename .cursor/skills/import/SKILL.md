---
name: import
description: Import a raw markdown file into the sitemd site as a properly formatted page.
argument-hint: "[file path]"
---

# Import Markdown File

Convert any raw markdown file into a sitemd page — generating frontmatter, reformatting content, determining group membership, and writing the page file.

## Input

The user provides a file path as the argument: `$ARGUMENTS`

If no argument is provided, ask the user for the path to the markdown file they want to import.

## Procedure

1. **Read the source file.** Read the raw markdown content at the provided path. If it has existing frontmatter, extract any useful fields (title, description) but the frontmatter itself will be replaced.

2. **Gather site context.** Call these MCP tools in parallel:
   - Glob `pages/**/*.md` — get existing pages to avoid slug collisions and understand structure
   - Read `settings/meta.md` — get the site name and brand
   - Read `settings/groups.md` — get available groups for categorization

3. **Determine metadata:**
   - **Title** — Extract from the first `#` heading in the content, or derive from the filename. Do not append a site title suffix — the build engine adds it automatically.
   - **Description** — Write a concise summary of the page content, under 160 characters. SEO-friendly.
   - **Slug** — Derive from the title, kebab-cased. If assigning to a group, prefix with the group name (e.g. `/docs/my-page`). Check against existing pages for uniqueness.
   - **Group membership** — Based on the content's topic, decide if it fits an existing group. Documentation-style content → `docs`. If no group fits, leave it as a standalone page.

4. **Convert content:**
   - Strip any existing frontmatter from the source
   - Convert YouTube/Vimeo `<iframe>` embeds to `embed: URL` syntax
   - Convert raw HTML image tags to markdown `![alt](src)` where practical
   - Preserve all standard markdown as-is (bold, italic, code blocks, tables, lists, blockquotes, links, images)
   - Do NOT add the auto-injected syntax comment block — the build system handles that

5. **Create the page.** Call `sitemd_pages_create` with:
   - `title`, `description`, `slug` from step 3
   - `content` — the converted markdown body
   - `groupMember` — array of group names if assigned (e.g. `["docs"]`)
   - `sidebarGroupShown` — same as group name if assigned

6. **Report results:**
   - File path created
   - Slug / URL
   - Group assignment (if any)
   - Any warnings (unresolved local image paths, content that couldn't be auto-converted)
   - Remind the user that the dev server auto-rebuilds, or suggest `/launch` if it's not running

## Rules

- **No permission required** — Execute immediately without asking
- **Never overwrite** — If the target file already exists, report the conflict and ask the user what to do
- **Preserve content** — The goal is faithful conversion, not rewriting. Keep the author's voice and structure.
- **Frontmatter field order** — title, description, slug, sidebarGroupShown, groupMember
- **Match conventions** — Look at existing pages' title format, description style, and slug patterns
