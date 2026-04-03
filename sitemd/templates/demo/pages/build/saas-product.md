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
# Cards: card: Title, card-text: Text, card-image: URL (multiple for carousel), card-link: Label: /slug
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
title: SaaS Product
titleSuffix: " | sitemd.cc"
tabTitle: SaaS Product
tabTitleSuffix: " | sitemd.cc"
description: Build a SaaS product site with authentication, gated content, pricing, dynamic data, and forms.
groupMember:
  - build
  - Build Examples
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# SaaS Product

A SaaS product site needs authentication, gated content, pricing tiers, forms, and dynamic data. sitemd handles all of this as premium features — configured through markdown, no code required.

---

## Authentication

Add login and signup to your site with one settings file. sitemd supports Supabase, Firebase, Clerk, and Auth0.

### Setup

Configure your auth provider in `settings/auth.md`:

```yaml
---
provider: supabase
loginMode: magic-link
afterLogin: /account
afterLogout: /
userTypeField: subscription_tier
---
```

Then set your credentials via the CLI (secrets never go in markdown files):

```bash
sitemd config set supabaseUrl https://your-project.supabase.co
sitemd config set supabaseAnonKey your-anon-key
```

### What You Get

- **Login and signup pages** — Pre-built in `auth-pages/` with magic link or password auth
- **Session management** — Automatic token refresh, login persistence, and logout
- **User data** — Access `{{currentUser.email}}`, `{{currentUser.name}}` anywhere on your site
- **Account dashboard** — Protected pages in `account-pages/` for logged-in users

---

## Gated Content

Once auth is configured, restrict content by user type. Gate entire pages or inline sections.

### Inline Gating

Wrap any content in a `gated:` fence to restrict it:

```markdown
gated: pro, enterprise
## Pro Features

This section is only visible to users with a "pro" or "enterprise"
subscription tier. Everyone else sees the access-denied message.

button: Upgrade to Pro: /pricing
/gated
```

### Page-Level Gating

Place files in `gated-pages/` with subdirectories matching user types:

```
gated-pages/
  pro/
    advanced-settings.md     → only "pro" users
    api-access.md            → only "pro" users
  enterprise/
    admin-dashboard.md       → only "enterprise" users
    team-management.md       → only "enterprise" users
```

---

## Pricing Modal

Use a tabbed modal for pricing tiers. Visitors click a button to see plans:

modal: pricing
  tab: Starter
    ### Starter — Free

    - 1 project
    - Community support
    - Basic analytics

    button: Get Started: #modal:signup-form
  tab: Pro
    ### Pro — $29/mo

    - Unlimited projects
    - Priority support
    - Advanced analytics
    - Custom domain

    button: Upgrade to Pro: #modal:signup-form +color:emerald
  tab: Enterprise
    ### Enterprise — Custom

    - Everything in Pro
    - SSO and team management
    - Dedicated support
    - SLA guarantee

    button: Contact Sales: #modal:signup-form +color:violet

button: View Pricing: #modal:pricing +big
button: Start Free: #modal:signup-form +big +outline

modal: signup-form
  ### Get Started

  form:
    webhook: https://hooks.example.com/demo
    submitLabel: Create Account
    thankYou: Welcome! This is a demo — no account was created.
    fields:
      - id: name
        type: name
        label: Full Name
        required: true
      - id: email
        type: email
        label: Work Email
        required: true
        placeholder: you@company.com
      - id: company
        type: shorttext
        label: Company
      - id: plan
        type: select
        label: Plan
        options:
          - Starter (Free)
          - Pro ($29/mo)
          - Enterprise (Custom)
      - id: message
        type: longtext
        label: Tell us about your use case
        placeholder: What are you building?

```markdown
modal: pricing
  tab: Starter
    ### Starter — Free
    - 1 project
    - Community support
    button: Get Started: /contact
  tab: Pro
    ### Pro — $29/mo
    - Unlimited projects
    - Priority support
    button: Upgrade to Pro: /contact +color:emerald
  tab: Enterprise
    ### Enterprise — Custom
    - Everything in Pro
    - SSO and team management
    button: Contact Sales: /contact +color:violet

button: View Pricing: #modal:pricing +big
```

---

## Forms

Collect leads, support requests, or feedback with inline forms. Forms submit to any webhook endpoint.

form:
  webhook: https://hooks.example.com/demo
  submitLabel: Request a Demo
  thankYou: Thanks! This is a demo form — nothing was sent.
  fields:
    - id: name
      type: name
      label: Full Name
      required: true
    - id: email
      type: email
      label: Work Email
      required: true
      placeholder: you@company.com
    - id: company
      type: shorttext
      label: Company
    - id: plan
      type: select
      label: Interested In
      options:
        - Starter (Free)
        - Pro ($29/mo)
        - Enterprise (Custom)
    - id: message
      type: longtext
      label: Tell us about your use case
      placeholder: What are you building?

---

## Dynamic Data

Connect your pages to live data from Supabase, Firebase, Airtable, or any REST API. Display as cards, tables, lists, or detail views:

```markdown
data: products
data-display: cards
data-title: name
data-text: {{description}} — ${{price}}
data-image: image_url
data-link: View: /products/{{slug}}
data-filter: active = true
data-sort: price asc
data-limit: 12
```

### Auth-Filtered Data

Show personalized data to logged-in users:

```markdown
data: my-orders
data-display: table
data-auth: required
data-filter: user_id = {{currentUser.id}}
data-field: Order: order_number
data-field: Status: status
data-field: Total: ${{total}}
```

---

## Putting It Together

A complete SaaS product site typically has:

| Directory | Purpose |
|---|---|
| `pages/` | Marketing pages, pricing, features |
| `auth-pages/` | Login, signup, forgot password |
| `account-pages/` | User dashboard, settings, billing |
| `gated-pages/pro/` | Pro-tier features and content |
| `gated-pages/enterprise/` | Enterprise features and admin |
| `modals/` | Pricing modal, feature tours |
| `settings/auth.md` | Auth provider configuration |
| `settings/data.md` | Data source configuration |

---

For the full reference on auth, gating, forms, and dynamic data, see the [sitemd docs](https://sitemd.cc/docs/user-auth).
