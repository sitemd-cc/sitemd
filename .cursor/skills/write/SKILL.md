---
name: write
description: Generate high-quality content for any page type. Usage: /write [type] [topic]. Types: page, docs, blog, changelog, roadmap.
argument-hint: "[type] [topic]"
---

# Write Content

Generate high-quality site content. Routes to the appropriate procedure based on content type.

## Input

The user provides content type and optional topic as arguments: `$ARGUMENTS`

Parse the first word as the content type: `page`, `docs`, `blog`, `changelog`, or `roadmap`. Everything after is the topic. Accept `doc` as an alias for `docs` and `change` as an alias for `changelog`.

If no arguments are provided and this is a mid-conversation invocation (i.e. work was done earlier in the conversation), assume the user wants `docs` written to cover the feature or change just completed. Summarize what you understand the recent work to be and ask the user to confirm before proceeding. The same applies to `changelog` — if invoked as `/write changelog` mid-conversation with no further args, generate the entry based on the work just completed rather than requiring git context. If invoked at the start of a conversation with no prior context, ask the user what type of content to write and the topic.

## Procedure

### Step 1: Gather Context

Call `sitemd_site_context` with the detected `contentType` and `topic`, and gather context in parallel:
- `sitemd_site_context` — site identity, conventions, type-specific state
- Glob `pages/**/*.md` — for cross-referencing and internal linking
- Read `settings/groups.md` — for group configuration and sidebar ordering

Read the results carefully. Note the site name, existing pages in the target group, and any type-specific state (current changelog version, roadmap sections). The `syntax` field in the response contains all available markdown components with examples.

### Using Components

sitemd pages support rich components beyond plain markdown. When writing content, actively use these where appropriate:

- **CTAs and navigation** — use `button:` syntax instead of bare links for calls to action
- **Feature grids** — use `card:` blocks to present features, services, or options in a responsive grid
- **Media** — use `gallery:` for multiple images, `image-row:` for side-by-side, `embed:` for video/audio
- **Interactivity** — use `modal:` for supplementary content, `[text]{tooltip}` for inline definitions
- **Image styling** — use modifiers (`+width:N`, `+circle`, `+expand`) instead of raw HTML

Refer to the `syntax` field from `sitemd_site_context` for exact patterns and copy-pasteable examples.

### Step 2: Route to Content Type

Based on the content type, follow the corresponding procedure below.

---

## Type: page

Write a general-purpose page (landing, feature, about, etc.).

### Structure
1. H1 — a clear, compelling headline (not the page title — the reader-facing hook)
2. Opening paragraph — one sentence stating what this page is about
3. 2-5 H2 sections developing the main points
4. CTA or next step at the end (button or link to a related page)

### Voice Rules
- Second person ("you", "your")
- Present tense
- No hedging words: never use "might", "could", "helps to", "it's worth noting"
- No stock phrases: never use "in today's world", "it's no secret", "at the end of the day"
- Lead with what the reader gets, not what the feature is
- Short paragraphs (3-4 sentences max)

### Frontmatter
```yaml
title: Page Title
description: Under 160 characters, SEO-friendly
slug: /page-slug              # use "/" for the home page
sidebarGroupShown: none
```

### Quality Gates
- [ ] Description under 160 characters
- [ ] At least one internal link to another page
- [ ] No placeholder or lorem ipsum text

### Create the Page
Call `sitemd_pages_create` with the title, description, slug, and content.

---

## Type: docs

Write documentation for a sitemd feature.

### Context Gathering
Before writing, you MUST:
1. Read all existing docs in `sitemd/pages/docs/` to match tone and avoid duplication
2. Check `sitemd/settings/groups.md` for the current docs items list

If no topic was provided, run `git log --oneline -20` to find recent features with code changes but no matching doc updates. Report the gaps and let the user choose which to document, or document the one with the most changes.

### Structure
1. H1 — feature name (matches the page title without suffix)
2. One-line summary — a single sentence stating what the feature does
3. User-facing interface first — show the settings file format, the markdown syntax, or the command to run
4. How it works — explain the mechanics
5. Reference tables — settings, options, parameters
6. Related pages — links to docs that reference or relate to this feature

### Voice Rules
- Imperative mood for instructions: "Add the field" not "You should add the field"
- No marketing language: never use "powerful", "seamless", "elegant", "robust"
- Show what to type, not abstract concepts
- Use code blocks with language hints for every example
- Use tables for reference material (setting names, options, defaults)
- Keep examples real — use actual values from the project, not lorem ipsum
- Prefer question-based H2 headings when the section answers a question: "How does X work?" rather than "X Mechanics" — AI systems match user queries to headings
- Start every section with a direct, standalone answer sentence that works as a citation on its own

### Frontmatter
```yaml
title: Feature Name
description: Under 160 characters
slug: /docs/feature-slug
updated: YYYY-MM-DD
sidebarGroupShown: docs
groupMember:
  - docs
```

Include `updated:` with today's date. Search engines and AI systems use this as a freshness signal.

### Quality Gates
- [ ] Has `sidebarGroupShown: docs` and `groupMember: [docs]`
- [ ] Every code example uses real values
- [ ] At least one code block with a language hint
- [ ] Links to at least one related doc page
- [ ] Description under 160 characters

### Create the Page
1. Call `sitemd_pages_create` with the content (include `groupMember: ["docs"]` — this automatically adds the page to the docs group sidebar)
2. Add nested anchors to `sitemd/settings/groups.md` — every `## heading` becomes an 8-space-indented anchor under the page item:
   ```yaml
   items:
     - Feature Name: /docs/feature-slug
       - Section One: #section-one
       - Section Two: #section-two
   ```
3. Review the docs group item ordering in `sitemd/settings/groups.md` (which uses `itemOrder: manual`) and place the new page where it fits in a logical user journey: getting started → core concepts → content components → interactive features → integrations/services → tooling/deployment → advanced topics. Reorder existing items if needed to maintain this flow.

### Cross-Reference
After creating the doc, check if any existing doc pages should mention or link to this feature. If so, edit the page file directly at `pages/{slug}.md` to update them naturally (not as an appendix). Default to **both** — create a new page AND update existing pages unless the feature is too small for its own page. When updating existing pages, add a section or paragraph. Don't restructure what's already there.

---

## Type: blog

Write a blog post.

### Structure
1. H1 — the title (engaging, not clickbait)
2. Date line — `**Month DD, YYYY**` (use today's date)
3. Opening paragraph — state the thesis. What is this post arguing or explaining? Be specific.
4. 3-5 H2 sections developing the argument
5. No explicit "Conclusion" section — the last paragraph should land the point naturally

### Voice Rules
- Opinionated but grounded — take a stance, support it with evidence
- First-person plural ("we") sparingly, only when representing the team
- Short paragraphs (3-4 sentences max)
- No listicles unless the structure genuinely demands it
- The thesis must be non-obvious — "X is good" is not a thesis; "X solves Y in a way that Z doesn't" is
- Include specific numbers, measurements, or comparisons when available — AI systems prioritize content with verifiable data over vague claims

### Frontmatter
```yaml
title: Post Title
description: Under 160 characters
slug: /blog/post-slug
sidebarGroupShown: blog
groupMember:
  - blog
```

### Quality Gates
- [ ] 400-1200 words
- [ ] Has a date line in `**Month DD, YYYY**` format with today's date
- [ ] The thesis is non-obvious and stated in the opening paragraph
- [ ] At least one internal link
- [ ] Description under 160 characters

### Create the Page
1. Call `sitemd_pages_create` with the content (include `groupMember: ["blog"]` — this automatically adds the page to the blog group sidebar)

---

## Type: changelog

Generate a changelog entry from git history.

### Context Gathering
1. Read `sitemd/pages/changelog.md` to get the current version and format
2. Run `git log --oneline` since the latest version tag to review recent commits
3. Review the categorized commits: Added, Changed, Fixed, Removed

### Structure
Prepend a new version section to the existing changelog body. Format:

```markdown
## vX.Y.Z — Month DD, YYYY

### Added
- Item one
- Item two

### Changed
- Item one

### Fixed
- Item one

---
```

Only include sections that have items. Use `---` as a separator between versions.

### Version Bump Rules
- All items are fixes → patch bump (0.0.x)
- Any new features (Added items) → minor bump (0.x.0)
- Breaking changes → major bump (x.0.0)

### Voice Rules
- Terse, factual — each item is a single line
- Start each item with a noun or action: "Blog section with index page" not "Added a blog section"
- No editorializing: never use "exciting", "awesome", "long-awaited"
- Each item must be verifiable against an actual code change

### Quality Gates
- [ ] Version number increments correctly from the previous version
- [ ] Every item corresponds to an actual commit
- [ ] No duplicate entries (check against existing changelog)
- [ ] Date is today's date

### Update the Page
Edit the changelog page file directly at `pages/changelog.md` to prepend the new version section (including the trailing `---`).

---

## Type: roadmap

Update the product roadmap.

### Context Gathering
1. Read `sitemd/pages/roadmap.md` for current items
2. Read `sitemd/pages/changelog.md` to verify shipped items
3. If `--sync` flag is present and GitHub is configured (check `sitemd_status`), fetch issues from GitHub

### Structure
Three sections, each with bullet items:

```markdown
## Shipped
- **Feature name** — One-sentence description

---

## In Progress
- **Feature name** — One-sentence description

---

## Planned
- **Feature name** — One-sentence description
```

### GitHub Sync (when --sync flag is used)
If `content.githubRepo` is configured:
1. Fetch issues from GitHub using the configured token
2. Map issue labels to roadmap sections using `roadmapLabels` from `sitemd/settings/content.md`:
   - Labels matching `shipped` values → **Shipped**
   - Labels matching `inProgress` values → **In Progress**
   - Labels matching `planned` values → **Planned**
   - Issues with no matching labels → skip (not everything is roadmap-worthy)
3. Each issue becomes: `- **{title}** — {first sentence of body}`
4. Cross-reference shipped items against the changelog — flag any without a changelog entry

### Voice Rules
- Present tense for shipped items
- Progressive tense for in-progress items
- Future tense for planned items
- No dates on planned items (they become stale)
- Keep descriptions to one sentence

### Quality Gates
- [ ] Shipped items correspond to actual features (verify against changelog)
- [ ] No duplicate items across sections
- [ ] Items flow between sections (planned → in progress → shipped), not added directly to shipped

### Update the Page
Edit the roadmap page file directly at `pages/roadmap.md` with the full updated body.

---

## Step 3: Validate

After creating or updating the page, call `sitemd_content_validate` with the page slug. Fix any failed checks before reporting success.

## Step 4: Report

Report what was created or updated:
- File path and slug
- Content type and word count
- Group assignment (if any)
- Any validation warnings
- Remind the user that the dev server auto-rebuilds, or suggest `/launch` if not running

## Rules

- **No permission required** — Execute immediately without asking
- **Match existing tone** — Read existing pages of the same type before writing
- **Real content only** — No placeholder text, no lorem ipsum, no "coming soon"
- **Today's date** — Use the actual current date for blog posts and changelog entries
- **Frontmatter field order** — title, description, slug, sidebarGroupShown, groupMember
