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
title: Event Site
titleSuffix: " | sitemd.cc"
tabTitle: Event Site
tabTitleSuffix: " | sitemd.cc"
description: Build an event site with listings, schedules, speaker profiles, and registration forms.
groupMember:
  - build
  - Build Examples
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Event Site

An event site needs event listings, detailed schedules, speaker profiles, and a registration flow. sitemd handles this with cards, tabbed modals, author cards, and forms.

---

## Event Listings

Display upcoming events as cards with dates, locations, and descriptions. Each card opens a detail modal with the full schedule and speakers.

### Dynamic Data Setup

```markdown
data: events
data-display: cards
data-title: {{name}}
data-text: {{date}} · {{location}} · {{format}}
data-image: {{cover_image}}
data-detail: modal
data-detail-field: Date: {{date}}
data-detail-field: Time: {{start_time}} — {{end_time}}
data-detail-field: Location: {{venue}}, {{city}}
data-detail-field: Format: {{format}}
data-detail-field: Price: ${{price}}
data-filter: date >= today
data-sort: date asc
data-limit: 12
```

### What It Looks Like

card: Frontend Summit 2026
card-image: https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop
card-text: June 12-13, 2026 · San Francisco, CA · In-person
card-link: View Event: #modal:event-summit

card: Design Systems Workshop
card-image: https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600&h=400&fit=crop
card-text: July 8, 2026 · Remote · Online workshop
card-link: View Event: #modal:event-workshop

card: Startup Meetup — Portland
card-image: https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600&h=400&fit=crop
card-text: August 3, 2026 · Portland, OR · In-person
card-link: View Event: #modal:event-meetup

---

## Event Detail Modals

Full event details in a tabbed modal — overview, schedule, and speakers:

modal: event-summit
  tab: Details
    ### Frontend Summit 2026

    **June 12-13, 2026** · Moscone Center, San Francisco, CA
    **$299 Early Bird** · [Limited to 500 attendees]{Tickets are selling fast — 340 of 500 claimed}

    Two days of talks, workshops, and networking for frontend engineers. Learn from industry leaders about the latest in React, CSS, accessibility, and performance.

    - 16 talks across 2 stages
    - 4 hands-on workshops
    - Networking lunch and after-party
    - All talks recorded and shared post-event

    button: Register Now: #modal:register-form +color:emerald
  tab: Schedule
    ### Day 1 — June 12

    | Time | Session | Speaker | Room |
    |---|---|---|---|
    | 9:00 AM | Opening Keynote | Sarah Chen | Main Stage |
    | 10:00 AM | CSS Architecture at Scale | Alex Morgan | Main Stage |
    | 10:00 AM | Workshop: Accessibility Testing | Jordan Lee | Workshop A |
    | 11:30 AM | React Server Components | Priya Sharma | Main Stage |
    | 1:00 PM | Lunch & Networking | — | Atrium |
    | 2:00 PM | Performance Budgets | Marcus Wright | Main Stage |
    | 3:30 PM | Workshop: Design Tokens | Maya Patel | Workshop A |
    | 5:00 PM | Lightning Talks | Various | Main Stage |
    | 6:30 PM | After-Party | — | Rooftop |

    ### Day 2 — June 13

    | Time | Session | Speaker | Room |
    |---|---|---|---|
    | 9:00 AM | Future of Web Components | James Rivera | Main Stage |
    | 10:00 AM | Design Systems from Scratch | Maya Patel | Main Stage |
    | 10:00 AM | Workshop: Animation & Motion | Alex Morgan | Workshop A |
    | 11:30 AM | Panel: Frontend in 2027 | All Speakers | Main Stage |
    | 1:00 PM | Lunch | — | Atrium |
    | 2:00 PM | Closing Keynote | Sarah Chen | Main Stage |

  tab: Speakers
    ### Featured Speakers

    author: Sarah Chen
    author-image: https://i.pravatar.cc/128?img=26
    author-role: Opening & Closing Keynote
    author-bio: Senior Engineer at Vercel. Creator of the React Performance Toolkit. Speaker at React Conf, JSConf, and CSSConf.
    author-link: Twitter: https://twitter.com

    author: Alex Morgan
    author-image: https://i.pravatar.cc/128?img=59
    author-role: CSS Architecture at Scale
    author-bio: Design Systems Lead at Figma. Author of "Scalable CSS" and maintainer of StyleLint. 15 years of CSS experience.
    author-link: Website: https://example.com

    author: Maya Patel
    author-image: https://i.pravatar.cc/128?img=23
    author-role: Building Design Systems from Scratch
    author-bio: Head of Design at Linear. Previously led the Shopify Polaris design system.
    author-link: LinkedIn: https://linkedin.com

modal: event-workshop
  tab: Details
    ### Design Systems Workshop

    **July 8, 2026** · Remote · Online via Zoom
    **$149** · [50 spots remaining]{Small group format for hands-on learning}

    A full-day intensive workshop on building and scaling design systems. You'll leave with a working design system starter kit and a clear roadmap for your team.

    - Live coding and Figma sessions
    - Build a token-based design system from scratch
    - Small group (max 30 participants)
    - Recording available for 30 days

    button: Register Now: #modal:register-form +color:emerald
  tab: Schedule
    ### Workshop Schedule

    | Time | Session |
    |---|---|
    | 9:00 AM | Welcome and introductions |
    | 9:30 AM | Design tokens: theory and practice |
    | 10:30 AM | Break |
    | 10:45 AM | Hands-on: Building your token system |
    | 12:00 PM | Lunch break |
    | 1:00 PM | Component architecture patterns |
    | 2:30 PM | Break |
    | 2:45 PM | Hands-on: Building core components |
    | 4:00 PM | Documentation and governance |
    | 4:45 PM | Q&A and wrap-up |

  tab: Instructor
    ### Your Instructor

    author: Maya Patel
    author-image: https://i.pravatar.cc/128?img=23
    author-role: Head of Design · Linear
    author-bio: Maya led the Shopify Polaris design system and currently heads design at Linear. She's taught this workshop to teams at Google, Airbnb, and Stripe.
    author-link: Website: https://example.com
    author-link: LinkedIn: https://linkedin.com

modal: event-meetup
  tab: Details
    ### Startup Meetup — Portland

    **August 3, 2026** · WeWork Pearl District, Portland, OR
    **Free** · [Open to all]{Doors open at 5:30 PM — talks start at 6:00 PM}

    A casual evening of lightning talks and networking for Portland's startup community. Three founders share lessons learned, followed by open networking with drinks and snacks.

    - 3 lightning talks (15 min each)
    - Open networking with food and drinks
    - No slides required — just stories
    - Sponsored by Portland Startups

    button: Register Now: #modal:register-form +color:emerald
  tab: Schedule
    ### Evening Schedule

    | Time | Session | Speaker |
    |---|---|---|
    | 5:30 PM | Doors open, networking | — |
    | 6:00 PM | Welcome | Host |
    | 6:10 PM | "Failing Fast, Recovering Faster" | Lena Park, Founder @ Mosaic |
    | 6:30 PM | "Hiring Your First 10" | David Okafor, CTO @ Ridgeline |
    | 6:50 PM | "From Side Project to Series A" | Rosa Jiménez, CEO @ Canopy |
    | 7:15 PM | Open networking | — |
    | 9:00 PM | Venue closes | — |

  tab: Speakers
    ### Tonight's Speakers

    author: Lena Park
    author-image: https://i.pravatar.cc/128?img=5
    author-role: Founder & CEO · Mosaic
    author-bio: Built Mosaic from a weekend prototype to a 40-person company in 18 months. Previously product lead at Nike Digital.
    author-link: Twitter: https://twitter.com

    author: David Okafor
    author-image: https://i.pravatar.cc/128?img=67
    author-role: CTO & Co-founder · Ridgeline
    author-bio: Former Stripe engineer. Built Ridgeline's engineering team from 0 to 25. Passionate about remote-first culture.
    author-link: LinkedIn: https://linkedin.com

    author: Rosa Jiménez
    author-image: https://i.pravatar.cc/128?img=9
    author-role: CEO & Co-founder · Canopy
    author-bio: Raised $12M Series A for Canopy, a climate-tech startup. Forbes 30 Under 30. Portland native.
    author-link: Website: https://example.com

modal: register-form
  ### Register for This Event

  form:
    webhook: https://hooks.example.com/demo
    submitLabel: Complete Registration
    thankYou: You're registered! This is a demo — no registration was created.
    fields:
      - id: name
        type: name
        label: Full Name
        required: true
      - id: email
        type: email
        label: Email
        required: true
        placeholder: you@example.com
      - id: ticket
        type: select
        label: Ticket Type
        required: true
        options:
          - Early Bird — $299
          - General Admission — $399
          - VIP (includes workshops) — $599
          - Student — $149
      - id: dietary
        type: select
        label: Dietary Requirements
        options:
          - No restrictions
          - Vegetarian
          - Vegan
          - Gluten-free
          - Other
      - id: tshirt
        type: radio
        label: T-Shirt Size
        options:
          - S
          - M
          - L
          - XL

button: Open Registration: #modal:register-form +big +outline

---

## Speaker Profiles

Use author cards to showcase speakers on any page — landing pages, individual event pages, or speaker directories:

author: Sarah Chen
author-image: https://i.pravatar.cc/128?img=26
author-role: Senior Engineer · Vercel
author-bio: Creator of the React Performance Toolkit. Speaker at React Conf, JSConf, and CSSConf. Passionate about making the web faster for everyone.
author-link: Twitter: https://twitter.com
author-link: GitHub: https://github.com

author: Marcus Wright
author-image: https://i.pravatar.cc/128?img=12
author-role: Performance Lead · Cloudflare
author-bio: 8 years focused on web performance and Core Web Vitals. Contributor to Lighthouse and WebPageTest. Regular speaker at performance conferences.
author-link: Website: https://example.com
author-link: Twitter: https://twitter.com

```markdown
author: Sarah Chen
author-image: https://i.pravatar.cc/128?img=26
author-role: Senior Engineer · Vercel
author-bio: Creator of the React Performance Toolkit...
author-link: Twitter: https://twitter.com
author-link: GitHub: https://github.com
```

---

## Registration Form

Collect attendee details with a registration form. This posts to a webhook — connect it to your ticketing system, CRM, or email automation:

form:
  webhook: https://hooks.example.com/demo
  submitLabel: Complete Registration
  thankYou: You're registered! This is a demo — no registration was created.
  fields:
    - id: name
      type: name
      label: Full Name
      required: true
    - id: email
      type: email
      label: Email
      required: true
      placeholder: you@example.com
    - id: ticket
      type: select
      label: Ticket Type
      required: true
      options:
        - Early Bird — $299
        - General Admission — $399
        - VIP (includes workshops) — $599
        - Student — $149
    - id: dietary
      type: select
      label: Dietary Requirements
      options:
        - No restrictions
        - Vegetarian
        - Vegan
        - Gluten-free
        - Other
    - id: tshirt
      type: radio
      label: T-Shirt Size
      options:
        - S
        - M
        - L
        - XL
        - XXL
    - id: notes
      type: longtext
      label: Anything else we should know?
      placeholder: Accessibility needs, group bookings, questions...

---

## Schedule Table

For a standalone schedule page, display the full agenda as a table. Use `data-display: table` with a schedule data source, or write it directly in markdown:

| Time | Session | Speaker | Room |
|---|---|---|---|
| 9:00 AM | Opening Keynote | Sarah Chen | Main Stage |
| 10:00 AM | CSS Architecture at Scale | Alex Morgan | Main Stage |
| 10:00 AM | Workshop: Accessibility Testing | Jordan Lee | Workshop A |
| 11:30 AM | React Server Components | Priya Sharma | Main Stage |
| 1:00 PM | Lunch & Networking | — | Atrium |
| 2:00 PM | Performance Budgets | Marcus Wright | Main Stage |
| 3:30 PM | Workshop: Design Tokens | Maya Patel | Workshop A |
| 5:00 PM | Lightning Talks | Various | Main Stage |

```markdown
data: schedule
data-display: table
data-filter: event_id = frontend-summit-2026
data-field: Time: {{start_time}}
data-field: Session: {{title}}
data-field: Speaker: {{speaker_name}}
data-field: Room: {{room}}
data-sort: start_time asc
```

---

## Event Site Structure

A complete event site typically has:

| Directory | Purpose |
|---|---|
| `pages/` | Homepage, event listings, speakers, venue info |
| `pages/events/` | Individual event pages with schedules |
| `modals/` | Event detail views, registration forms |
| `settings/data.md` | Event and schedule data sources |
| `settings/auth.md` | Attendee login for gated content (optional) |

---

For the full reference on dynamic data, forms, author cards, and modals, see the [sitemd docs](https://sitemd.cc/docs/dynamic-data).
