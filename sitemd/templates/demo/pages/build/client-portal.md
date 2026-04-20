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
title: Client Portal
titleSuffix: " | sitemd.cc"
tabTitle: Client Portal
tabTitleSuffix: " | sitemd.cc"
description: Build a client portal with authenticated dashboards, project tracking, invoice tables, gated content tiers, and support forms.
groupMember:
  - build
  - Build Examples
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Client Portal

A client portal gives your customers a private, logged-in space to track projects, view invoices, and submit requests. sitemd handles authentication, gated content, dynamic data, and forms — all configured through markdown.

---

## Authentication Setup

Start by configuring auth so clients can log in. sitemd supports Supabase, Firebase, Clerk, and Auth0.

### Settings

Configure your auth provider in `settings/auth.md`:

```yaml
---
provider: supabase
loginMode: magic-link
afterLogin: /portal
afterLogout: /
userTypeField: client_tier
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
- **User data** — Access `{{currentUser.email}}`, `{{currentUser.name}}` anywhere
- **Client tiers** — Gate content by `userTypeField` (e.g., standard, premium, enterprise)

---

## Project Dashboard

Show clients their active projects using auth-filtered dynamic data. Each project opens a detail modal with tabs for overview, timeline, and shared files.

### Dynamic Data Setup

```markdown
data: projects
data-display: cards
data-auth: required
data-filter: client_id = {{currentUser.id}}
data-title: {{name}}
data-text: {{status}} — Due {{due_date}}
data-image: {{thumbnail}}
data-detail: modal
data-detail-field: Status: {{status}}
data-detail-field: Budget: ${{spent}} / ${{budget}}
data-detail-field: Timeline: {{start_date}} — {{due_date}}
data-detail-field: Lead: {{project_lead}}
data-sort: due_date asc
```

### What It Looks Like

Here's a project detail modal with tabs — click to explore:

modal: project-detail
  tab: Overview
    ### Website Redesign

    **Status:** In Progress
    **Budget:** $12,500 / $18,000
    **Timeline:** Jan 15 — Mar 30, 2026
    **Lead:** Sarah Chen

    The homepage and product pages are complete. Currently working on blog templates and mobile optimization.

    button: Message Team: #modal:support-form
  tab: Timeline
    ### Milestones

    - **Jan 15** — Project kickoff ✓
    - **Feb 1** — Homepage wireframes ✓
    - **Feb 15** — Design review ✓
    - **Mar 1** — Development sprint (current)
    - **Mar 15** — QA and testing
    - **Mar 30** — Launch

  tab: Files
    ### Shared Documents

    - Brand Guidelines v2.pdf
    - Wireframes — Final.fig
    - Content Inventory.xlsx
    - Analytics Report — Q1.csv

    button: Request File Access: #modal:support-form

button: View Project Details: #modal:project-detail +big

modal: support-form
  ### Submit a Request

  form:
    webhook: https://hooks.example.com/demo
    submitLabel: Send Message
    thankYou: Thanks! This is a demo — nothing was sent.
    fields:
      - id: subject
        type: shorttext
        label: Subject
        required: true
        placeholder: Brief description of your request
      - id: message
        type: longtext
        label: Message
        required: true
        placeholder: How can we help?

button: Open Support Form: #modal:support-form +big +outline

---

## Invoice Table

Display invoices in a table filtered to the logged-in client. Each row shows the invoice number, date, amount, and payment status.

### Dynamic Data Setup

```markdown
data: invoices
data-display: table
data-auth: required
data-filter: client_id = {{currentUser.id}}
data-field: Invoice: {{invoice_number}}
data-field: Date: {{date}}
data-field: Amount: ${{amount}}
data-field: Status: {{status}}
data-sort: date desc
data-limit: 20
data-paginate: true
```

### What It Looks Like

| Invoice | Date | Amount | Status |
|---|---|---|---|
| INV-2026-041 | Mar 15, 2026 | $4,500 | ✅ Paid |
| INV-2026-033 | Feb 15, 2026 | $4,500 | ✅ Paid |
| INV-2026-028 | Jan 15, 2026 | $6,000 | ✅ Paid |
| INV-2026-052 | Apr 1, 2026 | $3,000 | ⏳ Pending |
| INV-2026-019 | Dec 15, 2025 | $4,500 | ✅ Paid |

---

## Gated Client Tiers

Show different content based on the client's subscription tier. Use `gated:` fences to restrict sections to specific user types.

```markdown
gated: premium, enterprise
## Priority Support

Your account includes priority support with a 4-hour response
guarantee and a dedicated account manager.

button: Contact Account Manager: #modal:support-form
/gated
```

card: Standard
card-icon: user +color:blue
card-text: Project dashboard, invoice history, file sharing, and support form. Included for all clients.

card: Premium
card-icon: crown +color:amber
card-text: Everything in Standard, plus real-time project analytics, priority support queue, and dedicated account manager.
card-link: Upgrade: #modal:support-form

card: Enterprise
card-icon: building +color:violet
card-text: Everything in Premium, plus custom integrations, SLA guarantees, and white-label reporting.
card-link: Contact Sales: #modal:support-form

---

## Support Request Form

Let clients submit support requests or change orders directly from the portal. This form posts to any webhook endpoint.

form:
  webhook: https://hooks.example.com/demo
  submitLabel: Submit Request
  thankYou: Thanks! This is a demo form — nothing was sent.
  fields:
    - id: subject
      type: select
      label: Subject
      required: true
      options:
        - Bug Report
        - Change Request
        - Billing Question
        - General Question
    - id: priority
      type: radio
      label: Priority
      options:
        - Low
        - Medium
        - High
    - id: project
      type: select
      label: Related Project
      options:
        - Website Redesign
        - Mobile App
        - Brand Guidelines
        - Other
    - id: message
      type: longtext
      label: Message
      required: true
      placeholder: Describe your request...

---

## Portal Structure

A complete client portal typically has:

| Directory | Purpose |
|---|---|
| `pages/` | Public marketing pages, login prompt |
| `auth-pages/` | Login, signup, forgot password |
| `account-pages/` | Client dashboard, project list, invoices |
| `gated-pages/premium/` | Premium-tier analytics and reports |
| `gated-pages/enterprise/` | Enterprise admin and integrations |
| `modals/` | Project detail views, support forms |
| `settings/auth.md` | Auth provider configuration |
| `settings/data.md` | Data source for projects and invoices |

---

For the full reference on auth, gating, forms, and dynamic data, see the [sitemd docs](https://sitemd.cc/docs/user-auth).
