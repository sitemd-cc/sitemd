# Changelog

A running log of everything shipped in sitemd.

---

## v0.1.2 — April 20, 2026

### Authentication

- CLI login via magic link now works end-to-end — the `?cli=` device code is stored in `sessionStorage` before the magic link is sent and approved automatically when the exchange completes on `/account`; previously the code was lost when the magic link redirect navigated away from the login page, leaving `sitemd_auth_poll` pending indefinitely
- opening a CLI login URL while already signed in now approves the session immediately and shows a confirmation screen instead of silently redirecting to `/account/`
- password reset flow — `POST /auth/forgot-password` sends a reset email, `POST /auth/reset-password` applies the new password with token validation; new `/reset-password` page reads the token from the URL, validates password confirmation, and shows success with a login link; previously the forgot-password page called endpoints that didn't exist
- magic link login now restores the original page redirect — if a gated page sent you to `/login`, completing the magic link flow redirects back to that page instead of always landing on `/account`
- auth state syncs across browser tabs — logging in or out in one tab now notifies all other open tabs via `storage` events; previously other tabs kept stale session state until manually refreshed
- Auth0 adapter no longer strips app-specific query parameters after the OAuth callback; only the `code` and `state` params added by Auth0 are removed

### Distribution

- `npm install @sitemd-cc/sitemd` now places `.mcp.json`, `CLAUDE.md`, `.claude/skills/`, and `.agents/skills/` at the project root automatically — the postinstall hook detects the project root via `INIT_CWD` and copies agent files there without overwriting existing content; previously these files ended up inside the `sitemd/` subdirectory where Claude Code couldn't discover them
- LICENSE.md now appears at the GitHub repo root (visible to GitHub's license detection) instead of only inside `sitemd/`
- npm package now includes CHANGELOG.md and LICENSE.md at the package root
- native dependencies (sharp, @resvg/resvg-js) auto-install on first use — the compiled binary ships without platform-specific native addons and downloads them when OG image generation or image optimization is first invoked; eliminates the need for CI-based cross-platform compilation

---

## v0.1.1 — April 8, 2026

### AI Agent Integration

- new `/release` skill — stages a running log of changelog entries and pending doc page updates between releases, then publishes them atomically; the end-of-session ritual is `/release`, and `/release finalize` writes the section to your changelog page, copies staged docs into `pages/docs/`, and deploys
- `write` skill gains a staged-output mode (`--output <dir>`) so other skills can redirect doc page writes into a staging directory instead of the live `pages/` tree; used by `/release` to stage docs updates
- `/release` skill now tracks new docs that need a sidebar nav entry — staging classifies each staged doc as new vs updated, drafts the planned sub-anchor list from H2 headings, and persists it as a `Pending nav additions:` block in `UNRELEASED.md` so finalize can auto-insert the nav entry via `sitemd_groups_add_pages` after copying the doc into `pages/docs/`; no more hand-editing `groups.md` for new docs, and the plan survives across sessions

### Distribution

- npm package and GitHub repo now ship a top-level `CHANGELOG.md` so users get release notes locally without visiting sitemd.cc
- `npm install @sitemd-cc/sitemd` and `npx @sitemd-cc/sitemd init my-site` now download the platform binary automatically via a `postinstall` hook — no separate `./sitemd/install` step required; users get a fully working install in one command
- new cross-platform `install.js` Node bootstrap ships alongside the existing shell `install` script — works on Windows without WSL, runs as the npm postinstall hook, and serves as a manual recovery command on any platform when `--ignore-scripts` was used; both scripts read the wanted version from the local `package.json` so the download always matches the installed package
- both install scripts (`install.js` and `install`) are now idempotent — re-running with a matching binary version is a silent no-op (~50ms), and version mismatches trigger an in-place upgrade; pass `--force` to skip the version check and reinstall
- plugin manifest descriptions for Claude Code, Codex, Cursor, and OpenClaw now make clear that sitemd is a full product requiring the binary, not just an MCP shim — and point users at `npx @sitemd-cc/sitemd init` as the recommended bootstrap path

### Content

- per-page sidebar nav — declare a custom sidebar directly in any page's frontmatter without touching `groups.md`; supports an explicit nested item list (with the same `Label: /url` syntax as nav/groups, including `+newtab` and other modifiers), `sidebar: none` to suppress an inherited group sidebar, and `sidebar: self` as a shortcut that auto-builds a table-of-contents sidebar from the page's own headings — each `##` becomes a top-level item, `###` headings nest as anchors under their parent `##`, and standalone `{#anchor}` tags map in as anchors too (alt-id anchors that immediately precede a heading are skipped to avoid duplication); the shortcut expands itself into the equivalent nested explicit list on first build so you can edit, reorder, or remove entries, and per-page sidebars get the search button and full active-state highlighting just like group sidebars
- device variants — wrap any markdown in `mobile: ... /mobile` or `desktop: ... /desktop` fences to show different content per viewport (768px breakpoint); the canonical use is embedding a portrait video for mobile and a landscape one for desktop, but it works for any content (text, images, copy, sections)
- self-hosted videos now embed with native markdown — `![alt](/media/marketing.mp4)` renders a `<video>` element with sensible defaults (controls, playsinline, preload metadata), works inside `gallery:` and `image-row:` blocks alongside images, inherits the same width/corner/shape modifiers as images, respects `/center` and `/right` alignment fences (centered videos wider than the content column overhang equally on both sides on desktop, and shrink to fit the viewport on mobile), and adds video-only modifiers `+autoplay`, `+muted`, `+loop`, `+nocontrols`, and `+poster:filename`; videos in `media/` are uploaded to your configured media CDN (R2/S3) automatically, just like images
- comprehensive markdown syntax reference at `/docs/markdown-syntax` — single-page lookup for every standard markdown feature, frontmatter field, component block (`button:`, `card:`, `embed:`, `gallery:`, `image-row:`, `form:`, `data:`, `modal:`, `author:`), inline modifier (image options, link `+newtab`/`+sametab`, tooltips, hard line breaks, inline anchors), and layout fence (`center:`, `right:`, `left:`, `hidden:`, `mobile:`, `desktop:`, `gated:`); cross-links to every component-specific deep dive and includes a quick-reference cheat-sheet table for fast lookup
- sitewide header search is faster and more responsive — typing into ⌘K is debounced to the trailing edge of typing bursts, the fuzzy/typo-tolerance fallback now runs only against titles and headings (not full page bodies, which previously dominated the typing hot path), and the underlying Levenshtein implementation reuses preallocated Int16 row buffers instead of allocating a 2D JS array per call; ships in the default theme so any deployed site picks it up after the next `sitemd deploy`. Behavior change: typo tolerance no longer surfaces words that appear only in body text — exact substring matches against bodies still work as before, just not fuzzy ones

### Dev Server

- dev server rebuilds are dramatically faster on multi-page sites — `/{slug}/seo-preview` pages used to be regenerated for every page on every rebuild (regex keyword extraction over rendered HTML, sync `fs.statSync` per page, ~40KB of HTML assembly per page), but they're now lazy-generated by the dev server on first request and cached until the next rebuild; editing one markdown file no longer pays the cost of re-rendering preview HTML for every other page in the site
- live-reload no longer compounds with the number of open browser tabs — the hydrate script and dev panel script used to each open their own SSE connection per tab (so 5 tabs meant 10 sockets to broadcast against on every rebuild), and back-to-back rebuilds (e.g. settings change → CSS sync → content rebuild) used to fan out as multiple reload events; hydrate now skips its connection when the dev panel is present, and reload broadcasts are coalesced via a 50ms trailing-edge throttle so multiple rebuilds within the throttle window collapse into a single reload event

### Dev Panel

- dev panel markdown editor now spellchecks your prose — wavy underlines appear on misspellings with native browser suggestions on right-click, and a new `spellcheck` toggle in the editor toolbar (top-right, next to `comments`) lets you mute it; preference persists across sessions, and spellcheck re-evaluates when you open a new file so you don't have to type to wake it up

### Fixed

- settings parsers (`groups.md`, `header.md`, `footer.md`, and in-page form blocks) now accept 4-space indentation in addition to canonical 2-space — previously a 4-space file would silently parse to nothing, producing surprises like an empty sidebar; the build also auto-rewrites such files to 2-space on the next run so on-disk style stays canonical
- clicking a hash-only sidebar link (e.g. table-of-contents anchors) no longer triggers a brief content/sidebar flash from a spurious SPA reload, and the clicked item now correctly highlights as active
- `npx @sitemd-cc/sitemd init my-site` no longer fails with `ENOENT` when run from a fresh npm install — the compiled binary's `init` and `scratch` commands now resolve their product directory via `process.execPath` instead of `__dirname` (which yao-pkg snapshots into a virtual path that doesn't exist on the user's filesystem)
- projects created by `sitemd init` now ship with `install` and `install.js` alongside the binary, so the new project's own `npm install` triggers the binary download via its inherited postinstall hook
- `sitemd_content_validate` no longer flags false positives on syntax-reference doc pages — fenced code blocks and inline code spans are now stripped before scanning for broken links, missing image alt text, and undefined modal references, so example markdown inside code blocks (like `[link](/url)` or `![alt](/media/foo.png)` shown as a teaching example) no longer trips validation; the internal-link check also gained the `/media/` exemption that the button check already had
- `code_language_hints` validator now tracks fence length so a 4-backtick code block wrapping a 3-backtick example (` ````markdown ` containing ` ```js `) no longer confuses the in-block toggle into reporting the inner closing fence as a missing-language-hint block
- `sitemd_pages_create` no longer creates a phantom lowercase group when an agent calls it with `groupMember` containing case variants like `["docs", "Docs"]` — `addPageToGroup` now resolves group references via name- and slug-equivalence (so `docs` matches the existing `Docs` group), and only creates a new group when no equivalent match exists

---

## v0.1.0 — April 3, 2026

Initial public release.

### Core

- Markdown-first static site generator — pages are `.md` files with YAML frontmatter
- Compiled binary distribution for macOS (arm64, x64), Linux (x64, arm64), and Windows (x64) — no Node.js required
- Bootstrap install script that detects OS/arch and downloads the correct binary
- Dev server with hot reload on localhost
- In-browser dev panel with file tree, settings editor, and navigation

### Content & Components

- Full markdown: headings with auto-anchor IDs, bold, italic, code blocks with syntax hints, tables, lists, blockquotes, inline HTML
- Buttons — primary, outline, big, colored, and icon variants; consecutive buttons auto-group into rows
- Cards — responsive grid layout with images, icons, text, and links
- Image galleries with lightbox expand
- Image modifiers: `+width`, `+circle`, `+bw`, `+sepia`, `+expand`, `+rotate`, `+corner`
- Embeds for YouTube, Vimeo, Spotify, CodePen, Twitter/X, Reddit, Instagram, TikTok, and generic iframe URLs
- Modals with optional tabbed content
- Inline tooltips via `[text]{tooltip}` syntax
- Link modifiers: `+newtab`, `+sametab`, `+color`, `+outline`
- Inline anchors (`{#id}`) and horizontal rules

### Theme & Design

- Three color modes: light, dark, and paper — plus system-preference detection with toggle
- 60+ CSS custom properties for full visual customization
- Single accent color theming
- Configurable fonts (ships with Inter and JetBrains Mono)
- Configurable content width, page width, border radius, image corners, and button style
- Responsive mobile-first layout with collapsible sidebar drawer
- Pure CSS with no framework dependencies

### Navigation & Structure

- Group-based sidebar navigation with auto-generation from page metadata
- Header navigation with dropdowns, buttons, and social links
- Footer with configurable columns, copyright, tagline, and social icons
- Brand display modes: text, image, image+text, text+image
- Site-wide full-text search with `⌘K` / `Ctrl+K` hotkey and heading-level results

### SEO & Discovery

- Auto-generated `sitemap.xml` and `robots.txt`
- RSS (`feed.xml`) and Atom (`atom.xml`) feeds with full page content
- OG image generation — auto-styled from theme colors or custom image
- JSON-LD structured data
- Meta tags: title, description, `og:*`, `twitter:card`
- `llms.txt` and `llms-full.txt` for AI model discovery
- Per-bot AI crawler control (allow or block)
- IndexNow integration — auto-notify search engines on deploy
- SEO audit tool with scored report and actionable recommendations
- Content validation for titles, descriptions, heading structure, images, and internal links

### Authentication

- Five auth providers: Custom API, Supabase, Firebase, Clerk, Auth0
- Password-based and magic link (passwordless) login modes
- Full auth flow: signup, login, logout, forgot password, reset password, email change
- Session management with 30-day tokens
- User profile and account management pages
- Account deletion

### Gated Content

- Page-level access control — require login or restrict to specific user types
- Section-level gating within pages using `gated:` blocks
- User type classification via configurable external data webhook
- Customizable access-denied page

### Forms

- Declarative form syntax in markdown with YAML-like field definitions
- Field types: text, email, textarea, select, checkbox, radio, date, time, file, country
- Multi-page forms with conditional field visibility (`show-when` rules)
- Webhook-based submission handler
- Honeypot spam protection
- Custom success pages and redirects

### Dynamic Data

- Four data source providers: Supabase, Firebase, Airtable, REST APIs
- Display modes: cards, list, table, and detail (modal or dedicated page)
- Filtering, sorting, and pagination
- Auth-gated data — restrict visibility to logged-in users or specific types
- URL parameter binding for dynamic queries
- Configurable response caching with TTL

### Analytics

- Seven analytics providers: Google Analytics, Plausible, Fathom, Umami, Simple Analytics, PostHog, Matomo
- Google Tag Manager support
- Ad pixel tracking: Meta (Facebook), Google Ads, LinkedIn, TikTok
- Custom `<head>` injection for additional scripts

### Email

- Six transactional email providers: Resend, SendGrid, Postmark, Mailgun, AWS SES, SMTP
- Markdown email templates compiled at build time

### Deployment

- Four hosting targets: Cloudflare Pages, Netlify, Vercel, GitHub Pages
- Single-command build and deploy via `sitemd deploy`
- Site activation with identity fingerprinting (title, brand, domain)
- Media hosting sync to Cloudflare R2 or AWS S3 with automatic CDN URL rewriting
- Post-deploy hooks

### Image Processing

- Sharp-based optimization: resize, compress, and convert to WebP
- Configurable max width and quality
- Hash-based caching to skip unchanged images
- `<picture>` tag generation with WebP fallbacks

### CLI

- Interactive menu with project status, login state, and quick actions
- Project commands: `launch`, `deploy`, `clone`, `init`
- Auth commands: `login`, `logout`, `status`, `api-key`
- Config commands: `setup`, `set`, `get`, `delete`
- Content commands: `pages`, `settings`, `seo`, `validate`
- Utility commands: `update`, `docs`, `feedback`

### AI Agent Integration

- MCP server with 22 tools for programmatic site management
- Plugins for Claude Code, Cursor, OpenAI Codex, Gemini, and OpenClaw
- 12 built-in agent skills: write, deploy, launch, kickstart, seo, site, clone, import, og-image, reload, feedback, shutdown
- `CLAUDE.md` and `AGENTS.md` context files for agent onboarding

### Settings

- 13 settings files: meta, header, footer, theme, build, deploy, seo, email, analytics, auth, data, forms, groups
- All configuration in markdown frontmatter — human-readable and git-friendly
- Separate secret store (`.sitemd/config.json`, gitignored) for API keys and tokens
- Environment variable overrides for CI/CD pipelines
- Schema validation with warnings for unknown or invalid values

### Templates

- Scratch template — blank-slate starting point with 4 pages and 8 settings files
- Demo template — full component showcase with 12 use-case guides

---
