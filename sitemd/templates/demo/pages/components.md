---
# How to write in sitemd:
# Markdown: **bold**, *italic*, [link](url), ![image](url), `code`
# Headings: # H1 through ###### H6 (auto-generate anchor IDs)
# Code blocks: ``` with optional language (```js, ```yaml, etc.)
# Tables: | col | col | with | --- | separator row
# Lists: - unordered, 1. ordered (nesting supported)
# Blockquotes: > quoted text
# Buttons: button: Label: /slug (see docs/buttons-and-links)
# Inline anchors: {#id} on its own line
# Link modifiers: [text](url+newtab), [text](url+sametab)
# Embeds: embed: URL (YouTube, Vimeo, Spotify, CodePen, tweets, any URL)
# Cards: card: Title, card-text: Text, card-image: URL, card-link: Label: /slug
# Images: ![alt](url +width:N +circle +bw +expand) — see docs/images
# Image row: image-row: with indented ![alt](url) lines (equal height)
# Gallery: gallery: with indented ![alt](url) lines (grid + lightbox)
# Forms: form: with indented YAML (webhook, fields, pages) — see docs/forms
# Data: data: source, data-display: cards/list/table/detail — see docs/dynamic-data
# Tooltips: [hover text]{tooltip content} — inline tooltip on hover/focus
# Modals: modal: id with indented content (tab: Tab Name for tabbed sections)
# Modal triggers: [link text](#modal:id) — opens the named modal on click
# Gated sections: gated: type1, type2 ... /gated (content visible only to those user types)
# Inline HTML: use any HTML tag directly — <div>, <span>, <details>, etc.
# Horizontal rules: ---
#
title: Components List
titleSuffix: " | sitemd.cc"
tabTitle: Components List
tabTitleSuffix: " | sitemd.cc"
description: Every sitemd component in one place. Buttons, images, galleries, cards, embeds, tooltips, modals, forms, and more.
sidebarGroupShown: Components
groupMember:
  - Components
---

card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Components

Everything on this page is built with pure markdown — no HTML, no CSS, no JavaScript. Each section shows a live component followed by the markdown that produces it.

---

## Buttons

Buttons link to pages, external URLs, or modals. Consecutive button lines form a row.

button: Primary Button: /components
button: Outline Button: /components +outline
button: External Link: https://sitemd.cc +newtab

```markdown
button: Primary Button: /components
button: Outline Button: /components +outline
button: External Link: https://sitemd.cc +newtab
```

### Big buttons

button: Big Primary: /components +big
button: Big Outline: /components +big +outline

```markdown
button: Big Primary: /components +big
button: Big Outline: /components +big +outline
```

### Colored buttons

button: Red: /components +color:red
button: Green: /components +color:green
button: Blue: /components +color:blue
button: Purple: /components +color:purple
button: Orange: /components +color:orange
button: Pink: /components +color:pink

```markdown
button: Red: /components +color:red
button: Green: /components +color:green
button: Blue: /components +color:blue
button: Purple: /components +color:purple
button: Orange: /components +color:orange
button: Pink: /components +color:pink
```

You can also use hex colors:

button: Custom Hex: /components +color:#7c3aed

```markdown
button: Custom Hex: /components +color:#7c3aed
```

### Button icons

Add an icon to any button with the `+icon:name` modifier. Icons come from the [Lucide](https://lucide.dev) icon set.

button: Download: /components +icon:download
button: Next Step: /components +icon-right:arrow-right
button: Learn More: https://sitemd.cc/docs +icon-left:external-link +outline +newtab

```markdown
button: Download: /components +icon:download
button: Next Step: /components +icon-right:arrow-right
button: Learn More: https://sitemd.cc/docs +icon-left:external-link +outline +newtab
```

---

## Brand Display

Render your site's brand name (and logo, if configured) inline anywhere on the page using `{{brandDisplay}}`. Add a width to scale it: `{{brandDisplay:200}}`.

{{brandDisplay}}

Scaled to 200px wide:

{{brandDisplay:200}}

```markdown
{{brandDisplay}}

{{brandDisplay:200}}
```

---

## Images

Basic images work like standard markdown. Add modifiers after the URL for sizing, shapes, filters, and more.

### Basic image

![Mountain landscape](https://picsum.photos/id/29/800/400)

```markdown
![Mountain landscape](https://picsum.photos/id/29/800/400)
```

### Width and height

![Sized image](https://picsum.photos/id/10/800/400 +width:400)

```markdown
![Sized image](https://picsum.photos/id/10/800/400 +width:400)
```

### Shapes

![Circle](https://picsum.photos/id/64/300/300 +circle +width:150)
![Square](https://picsum.photos/id/65/300/300 +square +width:150)
![Rectangle](https://picsum.photos/id/66/300/300 +rect +width:200)

```markdown
![Circle](https://picsum.photos/id/64/300/300 +circle +width:150)
![Square](https://picsum.photos/id/65/300/300 +square +width:150)
![Rectangle](https://picsum.photos/id/66/300/300 +rect +width:200)
```

### Filters

![Black and white](https://picsum.photos/id/39/400/300 +bw +width:300)
![Sepia tone](https://picsum.photos/id/42/400/300 +sepia +width:300)

```markdown
![Black and white](https://picsum.photos/id/39/400/300 +bw +width:300)
![Sepia tone](https://picsum.photos/id/42/400/300 +sepia +width:300)
```

### Crop and rotation

![Cropped](https://picsum.photos/id/20/800/600 +crop:300x200)
![Rotated 90](https://picsum.photos/id/37/300/200 +rotate:1 +width:200)

```markdown
![Cropped](https://picsum.photos/id/20/800/600 +crop:300x200)
![Rotated 90](https://picsum.photos/id/37/300/200 +rotate:1 +width:200)
```

### Corner styles

![No corners](https://picsum.photos/id/48/300/200 +corner:none +width:200)
![Subtle corners](https://picsum.photos/id/48/300/200 +corner:subtle +width:200)
![Curved corners](https://picsum.photos/id/48/300/200 +corner:curve +width:200)

```markdown
![No corners](https://picsum.photos/id/48/300/200 +corner:none +width:200)
![Subtle corners](https://picsum.photos/id/48/300/200 +corner:subtle +width:200)
![Curved corners](https://picsum.photos/id/48/300/200 +corner:curve +width:200)
```

### Click to expand

Click this image to open it in a fullscreen lightbox:

![Expandable image](https://picsum.photos/id/15/800/500 +expand)

```markdown
![Expandable image](https://picsum.photos/id/15/800/500 +expand)
```

---

## Image Rows

Image rows display images side by side at equal height. They wrap on mobile.

image-row:
  ![First](https://picsum.photos/id/10/600/400)
  ![Second](https://picsum.photos/id/14/600/400)
  ![Third](https://picsum.photos/id/29/600/400)

```markdown
image-row:
  ![First](https://picsum.photos/id/10/600/400)
  ![Second](https://picsum.photos/id/14/600/400)
  ![Third](https://picsum.photos/id/29/600/400)
```

---

## Galleries

Galleries create a responsive grid with a built-in lightbox. Click any image to browse.

gallery:
  ![Photo one](https://picsum.photos/id/36/600/400)
  ![Photo two](https://picsum.photos/id/39/600/400)
  ![Photo three](https://picsum.photos/id/42/600/400)
  ![Photo four](https://picsum.photos/id/48/600/400)
  ![Photo five](https://picsum.photos/id/56/600/400)
  ![Photo six](https://picsum.photos/id/60/600/400)

```markdown
gallery:
  ![Photo one](https://picsum.photos/id/36/600/400)
  ![Photo two](https://picsum.photos/id/39/600/400)
  ![Photo three](https://picsum.photos/id/42/600/400)
  ![Photo four](https://picsum.photos/id/48/600/400)
  ![Photo five](https://picsum.photos/id/56/600/400)
  ![Photo six](https://picsum.photos/id/60/600/400)
```

Galleries support modifiers too:

gallery +corner:curve:
  ![Curved one](https://picsum.photos/id/70/600/400)
  ![Curved two](https://picsum.photos/id/71/600/400)
  ![Curved three](https://picsum.photos/id/73/600/400)

```markdown
gallery +corner:curve:
  ![Curved one](https://picsum.photos/id/70/600/400)
  ![Curved two](https://picsum.photos/id/71/600/400)
  ![Curved three](https://picsum.photos/id/73/600/400)
```

---

## Cards

Cards arrange content in a responsive grid. Each card can have a title, description, image, and link.

### Basic cards

card: Getting Started
card-text: Learn how to create pages, configure settings, and build your first sitemd site.
card-link: Read the docs: https://sitemd.cc/docs

card: Components
card-text: Every building block available in sitemd — buttons, images, forms, and more.
card-link: Browse components: /components

card: Blog
card-text: Sample blog posts showing how to write and organize blog content.
card-link: Browse components: /components

```markdown
card: Getting Started
card-text: Learn how to create pages, configure settings, and build your first sitemd site.
card-link: Read the docs: https://sitemd.cc/docs

card: Components
card-text: Every building block available in sitemd — buttons, images, forms, and more.
card-link: Browse components: /components

card: Blog
card-text: Sample blog posts showing how to write and organize blog content.
card-link: Browse components: /components
```

### Cards with images

card: Mountain Vista
card-text: Cards can include images above the title for visual impact.
card-image: https://picsum.photos/id/29/600/300
card-link: Learn more: /components

card: Ocean Waves
card-text: Images are responsive and maintain their aspect ratio.
card-image: https://picsum.photos/id/90/600/300
card-link: Learn more: /components

```markdown
card: Mountain Vista
card-text: Cards can include images above the title for visual impact.
card-image: https://picsum.photos/id/29/600/300
card-link: Learn more: /components

card: Ocean Waves
card-text: Images are responsive and maintain their aspect ratio.
card-image: https://picsum.photos/id/90/600/300
card-link: Learn more: /components
```

### Cards with icons

Use `card-icon:` to show a Lucide icon instead of an image. Add `+color:name` to tint it.

card: Fast Builds
card-icon: zap
card-text: Millisecond rebuilds on every file save.

card: Fully Responsive
card-icon: tablet-smartphone
card-text: Every page adapts to any screen size automatically.

card: Open Source
card-icon: package-open
card-text: No vendor lock-in. Host your site anywhere you want.

```markdown
card: Fast Builds
card-icon: zap
card-text: Millisecond rebuilds on every file save.

card: Fully Responsive
card-icon: tablet-smartphone
card-text: Every page adapts to any screen size automatically.

card: Open Source
card-icon: package-open
card-text: No vendor lock-in. Host your site anywhere you want.
```

### Brand icons

Use the `brand-` prefix to access 3,400+ brand logos from [Simple Icons](https://simpleicons.org). Add `+color:` with the brand's hex color.

card: GitHub
card-icon: brand-github +color:#181717
card-text: Source code and version control.

card: Discord
card-icon: brand-discord +color:#5865F2
card-text: Community chat and support.

card: Figma
card-icon: brand-figma +color:#F24E1E
card-text: Design files and prototypes.

card: Vercel
card-icon: brand-vercel +color:#000000
card-text: Frontend hosting and deployment.

```markdown
card: GitHub
card-icon: brand-github +color:#181717
card-text: Source code and version control.

card: Discord
card-icon: brand-discord +color:#5865F2
card-text: Community chat and support.

card: Figma
card-icon: brand-figma +color:#F24E1E
card-text: Design files and prototypes.

card: Vercel
card-icon: brand-vercel +color:#000000
card-text: Frontend hosting and deployment.
```

### Banner cards

Add `+banner` to a card title to make it span the full width, breaking out of the grid. Useful for featured content or section headers.

card: Everything you need to build a site +banner
card-icon: package-open
card-text: sitemd includes pages, blogs, docs, forms, auth, and more — all from markdown.

card: Documentation
card-icon: book-open
card-text: Six-page guide covering every aspect of sitemd.
card-link: Read the docs: https://sitemd.cc/docs

card: Components
card-icon: blocks
card-text: Live examples of every building block.
card-link: Browse: /components

```markdown
card: Everything you need to build a site +banner
card-icon: package-open
card-text: sitemd includes pages, blogs, docs, forms, auth, and more — all from markdown.

card: Documentation
card-icon: book-open
card-text: Six-page guide covering every aspect of sitemd.
card-link: Read the docs: https://sitemd.cc/docs

card: Components
card-icon: blocks
card-text: Live examples of every building block.
card-link: Browse: /components
```

### Carousel cards

Add multiple `card-image:` lines to a single card to create an image carousel with slide indicators, navigation arrows, and swipe support. Click an image to open the lightbox.

card: Mountain Views
card-text: Swipe or click the arrows to browse. Click an image to open the lightbox.
card-image: https://picsum.photos/id/29/600/400
card-image: https://picsum.photos/id/15/600/400
card-image: https://picsum.photos/id/10/600/400
card-link: See more images: /components#galleries

card: Ocean Sunset
card-text: Regular image cards work alongside carousel cards in the same grid.
card-image: https://picsum.photos/id/90/600/400

```markdown
card: Mountain Views
card-text: Swipe or click the arrows to browse. Click an image to open the lightbox.
card-image: https://picsum.photos/id/29/600/400
card-image: https://picsum.photos/id/15/600/400
card-image: https://picsum.photos/id/10/600/400
card-link: See more images: /components#galleries

card: Ocean Sunset
card-text: Regular image cards work alongside carousel cards in the same grid.
card-image: https://picsum.photos/id/90/600/400
```

### Inline markdown in titles

Card titles support inline markdown — **bold**, *italic*, and [links](url).

card: **New** — Carousel Cards
card-text: Multiple images per card with swipe navigation and lightbox.

card: Read the [full docs](https://sitemd.cc/docs)
card-text: Six pages covering everything you need to know.

```markdown
card: **New** — Carousel Cards
card-text: Multiple images per card with swipe navigation and lightbox.

card: Read the [full docs](https://sitemd.cc/docs)
card-text: Six pages covering everything you need to know.
```

---

## Embeds

Paste a URL from a supported provider and sitemd handles the rest. Embeds are fully responsive.

### YouTube

embed: https://www.youtube.com/watch?v=dQw4w9WgXcQ

```markdown
embed: https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### Other supported providers

sitemd auto-detects and embeds content from these platforms:

| Provider | Example URL |
|---|---|
| YouTube | `youtube.com/watch?v=ID` or `youtu.be/ID` |
| Vimeo | `vimeo.com/123456` |
| Spotify | `open.spotify.com/track/ID` |
| Twitter / X | `x.com/user/status/ID` |
| Reddit | `reddit.com/r/sub/comments/ID/title` |
| Instagram | `instagram.com/p/ID` |
| TikTok | `tiktok.com/@user/video/ID` |
| LinkedIn | `linkedin.com/posts/...` |
| CodePen | `codepen.io/user/pen/ID` |

---

## Tooltips

Hover over [highlighted text]{This is a tooltip. It appears on hover and works inline anywhere.} to see a tooltip.

Tooltips work in [paragraphs]{Paragraph tooltip}, in **[bold text]{Bold tooltip}**, and in [links]{Link tooltip too}.

```markdown
[highlighted text]{This is a tooltip. It appears on hover.}
```

---

## Modals

Modals are content overlays triggered by links. They can contain any sitemd component.

### Inline modal

modal: demo-modal
  ## This is a modal

  Modals can contain any markdown content — text, buttons, images, even other components.

  button: Got it: #close

[Open the demo modal](#modal:demo-modal)

```markdown
modal: demo-modal
  ## This is a modal

  Modals can contain any markdown content.

  button: Got it: #close

[Open the demo modal](#modal:demo-modal)
```

### Tabbed modal

modal: tabbed-modal
  tab: Overview
    This is the first tab. Tabbed modals are great for organizing related content.
  tab: Details
    This is the second tab. Each tab has its own content panel.
  tab: Settings
    And a third tab. Switch between them by clicking the tab headers.

[Open the tabbed modal](#modal:tabbed-modal)

```markdown
modal: tabbed-modal
  tab: Overview
    This is the first tab.
  tab: Details
    This is the second tab.
  tab: Settings
    And a third tab.

[Open the tabbed modal](#modal:tabbed-modal)
```

### Global modals

Global modals live in the `modals/` directory and can be triggered from any page. This demo site has one — [open it from here](#modal:welcome).

```markdown
[open it from here](#modal:welcome)
```

The modal file is `modals/welcome.md`. Any `.md` file in that directory becomes a global modal with the filename as its ID.

---

## Forms

Forms collect user input and submit to a webhook endpoint. They support a wide range of field types. Forms are a premium feature — they render as a live, interactive form once you authenticate with `sitemd auth login`.

form:
  webhook: https://hooks.example.com/demo
  submitLabel: Send Message
  thankYou: Thanks for the message! This is a demo form — nothing was actually sent.
  fields:
    - id: name
      type: name
      label: Your Name
      required: true
    - id: email
      type: email
      label: Email Address
      required: true
      placeholder: you@example.com
    - id: topic
      type: select
      label: Topic
      options:
        - General Question
        - Feature Request
        - Bug Report
        - Other
    - id: priority
      type: radio
      label: Priority
      options:
        - Low
        - Medium
        - High
    - id: rating
      type: rating
      label: How are you finding sitemd?
    - id: message
      type: longtext
      label: Message
      placeholder: Tell us what's on your mind...
      required: true
    - id: consent
      type: consent
      label: I agree to receive follow-up emails about my inquiry.

```markdown
form:
  webhook: https://hooks.example.com/demo
  submitLabel: Send Message
  fields:
    - id: name
      type: name
      label: Your Name
      required: true
    - id: email
      type: email
      label: Email Address
      required: true
    - id: topic
      type: select
      label: Topic
      options:
        - General Question
        - Feature Request
        - Bug Report
    - id: message
      type: longtext
      label: Message
      required: true
```

### Supported field types

| Type | Description |
|---|---|
| `shorttext` | Single-line text input |
| `longtext` | Multi-line textarea |
| `email` | Email with validation |
| `phone` | Phone number |
| `number` | Number input with min/max |
| `date` | Date picker |
| `name` | First and last name (side by side) |
| `address` | Full address (street, city, state, zip, country) |
| `checkbox` | Single checkbox |
| `checkboxes` | Multiple checkboxes |
| `radio` | Radio button group |
| `select` | Dropdown select |
| `rating` | Star rating (1-5) |
| `country` | Country selector |
| `consent` | Required agreement checkbox |

Forms also support multi-page flows with conditional logic, answer piping, URL prefill, and hidden fields. See the [full docs](https://sitemd.cc/docs/forms) for details.

---

## Custom Anchors

{#custom-anchor}

You can create anchor points anywhere on a page with `{#id}` syntax, then link to them:

[Jump to this anchor](#custom-anchor)

```markdown
{#custom-anchor}

[Jump to this anchor](#custom-anchor)
```

---

## Tables

| Feature | Free | Premium |
|---|---|---|
| Pages & Content | Unlimited | Unlimited |
| Components | All | All |
| Theme Modes | All 3 | All 3 |
| Custom Domain | — | Yes |
| Deploy Targets | — | All |
| Forms | — | Yes |
| Auth & Gating | — | Yes |

```markdown
| Feature | Free | Premium |
|---|---|---|
| Pages & Content | Unlimited | Unlimited |
| Components | All | All |
| Theme Modes | All 3 | All 3 |
```

---

## Code Blocks

Code blocks support syntax highlighting for any language:

```yaml
# This is YAML — used for sitemd settings and frontmatter
title: My Page
description: A page built with sitemd
slug: /my-page
groupMember:
  - docs
```

```javascript
// JavaScript code highlighting works too
function greet(name) {
  return `Hello, ${name}!`
}
```

```markdown
# And of course markdown
This is a **bold** statement with a [link](/components).
```

---

## Blockquotes

> sitemd is designed for people who want a beautiful site without writing code. Describe what you want, let your coding agent handle the markdown, and deploy with a single command.

```markdown
> sitemd is designed for people who want a beautiful site without writing code.
```

---

## Content Alignment

Wrap content in `center:` or `right:` fences to control alignment. Works with text, buttons, images, and cards.

### Centered content

center:
This text is centered. Buttons and images inside a `center:` fence are centered too.

button: Centered Button: /components
button: Centered Outline: /components +outline
/center

```markdown
center:
This text is centered. Buttons and images inside here are centered too.

button: Centered Button: /components
button: Centered Outline: /components +outline
/center
```

### Right-aligned content

right:
This text is right-aligned. All block elements inside shift to the right.

button: Right Button: /components
/right

```markdown
right:
This text is right-aligned. All block elements inside shift to the right.

button: Right Button: /components
/right
```

---

## Lists

### Unordered

- Pages are markdown files in the `pages/` directory
- Settings are markdown files in the `settings/` directory
  - Each setting controls one aspect of your site
  - Comments in the frontmatter explain each option
- The dev server rebuilds instantly on save

### Ordered

1. Install sitemd
2. Run the dev server
3. Edit your markdown files
4. Deploy when ready

```markdown
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

1. First step
2. Second step
3. Third step
```

---

## Named Colors

sitemd includes a full palette of named colors you can use with buttons and other components:

button: Red: none +color:red
button: Orange: none +color:orange
button: Amber: none +color:amber
button: Yellow: none +color:yellow
button: Lime: none +color:lime
button: Green: none +color:green
button: Emerald: none +color:emerald
button: Teal: none +color:teal
button: Cyan: none +color:cyan
button: Sky: none +color:sky
button: Blue: none +color:blue
button: Indigo: none +color:indigo
button: Violet: none +color:violet
button: Purple: none +color:purple
button: Fuchsia: none +color:fuchsia
button: Pink: none +color:pink
button: Rose: none +color:rose

---

## User Authentication

sitemd has a full authentication system built in. Add login, signup, and account pages to your site — all configured through markdown settings. No auth code to write.

### Supported providers

| Provider | Description |
|---|---|
| Supabase | Open-source Firebase alternative with Row Level Security |
| Firebase | Google's auth platform with email, social, and phone login |
| Clerk | Drop-in auth with pre-built UI components |
| Auth0 | Enterprise-grade identity platform |

### What you get

- **Login and signup pages** — Pre-built in `auth-pages/` (this demo includes them at [/login](/login) and [/sign-up](/sign-up))
- **Magic link auth** — Passwordless email login with one setting change
- **Account dashboard** — Protected pages in `account-pages/` that require login
- **Session management** — Automatic login persistence, token refresh, and logout
- **User data** — Access `{{currentUser.email}}`, `{{currentUser.name}}`, and custom fields anywhere on your site

### Setup

Pick a provider and configure it in `settings/auth.md`:

```yaml
---
provider: supabase
loginMode: magic-link
afterLogin: /account
afterLogout: /
---
```

Then set your credentials via the CLI:

```bash
sitemd config set supabaseUrl https://your-project.supabase.co
sitemd config set supabaseAnonKey your-anon-key
```

That is it. Your site now has working auth. See the [full auth docs](https://sitemd.cc/docs/user-auth) for provider-specific setup.

---

## Gated Content

Once auth is configured, you can restrict content to specific user types. Gate entire pages, inline sections, or whole directories.

### Gate a section inline

```markdown
gated: premium, enterprise
This content is only visible to premium and enterprise users.
Everything between the opening and closing tags is hidden until
the user logs in with the right account type.
/gated
```

### Gate an entire page

Place the file in `gated-pages/` with a subdirectory matching the user type:

```
gated-pages/
  premium/
    exclusive-content.md    → only visible to "premium" users
    vip-resources.md        → only visible to "premium" users
  enterprise/
    admin-tools.md          → only visible to "enterprise" users
```

### Gate via frontmatter

```yaml
---
title: Premium Resources
gated: premium
---
```

### User types

User types come from your auth provider. Set the field name in `settings/auth.md`:

```yaml
userTypeField: subscription_tier
```

sitemd reads this field from the authenticated user's profile and matches it against your gated content types. Common patterns: free/pro/enterprise, subscriber/non-subscriber, admin/member.

Gated content is fully hidden until the user authenticates — no flash of restricted content. See the [full gating docs](https://sitemd.cc/docs/user-auth#gating-pages) for details.

---

## Hidden Content

Visually hide content while keeping it accessible to search engines and screen readers. Useful for adding an SEO H1, extra keywords, or accessibility descriptions without affecting the visual design.

hidden:
This content is in the DOM for SEO and accessibility but visually hidden from the page.
/hidden

The content above is hidden — inspect the page source to see it. Here's the markdown:

```markdown
hidden:
This content is in the DOM for SEO and accessibility
but visually hidden from the page.
/hidden
```

---

## Dynamic Data

Connect your pages to live data from Supabase, Firebase, Airtable, or any REST API. Display data as cards, lists, tables, or detail views — all from markdown.

### Supported providers

| Provider | Description |
|---|---|
| Supabase | PostgREST API with Row Level Security |
| Firebase | Firestore REST API |
| Airtable | Direct base access |
| REST API | Any JSON endpoint — auto-detects response format |

### Display modes

**Cards** — Responsive grid with images, titles, descriptions, and links:

```markdown
data: products
data-display: cards
data-title: name
data-text: {{description}} — ${{price}}
data-image: image_url
data-link: View: /products/{{slug}}
```

**Table** — Structured data with sortable columns:

```markdown
data: team-members
data-display: table
data-field: Name: name
data-field: Role: role
data-field: Email: email
```

**List** — Clean list with optional thumbnails:

```markdown
data: announcements
data-display: list
data-title: title
data-text: {{date}} — {{summary}}
```

**Detail** — Single-item view with a modal for full details:

```markdown
data: products
data-display: cards
data-title: name
data-detail: modal
data-detail-field: Price: ${{price}}
data-detail-field: Description: {{description}}
```

### Query options

Filter, sort, limit, and paginate your data right from markdown:

```markdown
data: products
data-display: cards
data-title: name
data-filter: category = electronics
data-sort: price desc
data-limit: 12
data-paginate: true
```

### Auth integration

Combine with user auth to show personalized data:

```markdown
data: my-orders
data-display: table
data-auth: required
data-filter: user_id = {{currentUser.id}}
data-field: Order: order_number
data-field: Status: status
data-field: Total: ${{total}}
```

### Setup

Configure your provider in `settings/data.md` and set credentials via the CLI:

```yaml
---
provider: supabase
sources:
  - name: products
    table: products
    select: name, description, price, image_url, slug
    sort: created_at desc
---
```

```bash
sitemd config set supabaseUrl https://your-project.supabase.co
sitemd config set supabaseAnonKey your-anon-key
```

See the [full dynamic data docs](https://sitemd.cc/docs/dynamic-data) for all query options and provider setup.

---

## Author Cards

Display author attribution with avatar, name, role, bio, and social links. Commonly placed at the end of blog posts.

### Single Author

author: Jane Doe
author-image: https://i.pravatar.cc/128?img=5
author-role: Senior Engineer at Acme Corp
author-bio: Jane writes about distributed systems, developer tooling, and the future of the web platform.
author-link: Twitter: https://x.com
author-link: GitHub: https://github.com
author-link: LinkedIn: https://linkedin.com
author-link: https://example.com

### Minimal Author (name only)

author: Bob Smith

### Multiple Authors

author: Alice Chen
author-image: https://i.pravatar.cc/128?img=9
author-role: Product Designer
author-bio: Alice focuses on design systems and accessible interfaces.
author-link: Twitter: https://x.com

author: Marcus Rivera
author-image: https://i.pravatar.cc/128?img=12
author-role: Staff Engineer
author-bio: Marcus specializes in performance optimization and web standards.
author-link: GitHub: https://github.com
author-link: mailto:hello@example.com

---

Need help with any of these features? Reach out at support@sitemd.cc.
