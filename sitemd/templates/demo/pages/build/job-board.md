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
title: Job Board
titleSuffix: " | sitemd.cc"
tabTitle: Job Board
tabTitleSuffix: " | sitemd.cc"
description: Build a job board with filterable listings, detail modals with requirements, and application forms.
groupMember:
  - build
  - Build Examples
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Job Board

A job board needs filterable listings, detailed role descriptions, and an application flow. sitemd handles this with dynamic data cards, tabbed detail modals, and forms — all from markdown.

---

## Job Listings

Display open positions as cards with role, company, location, and type. Each card links to a detail modal with full requirements.

### Dynamic Data Setup

```markdown
data: jobs
data-display: cards
data-title: {{title}}
data-text: {{company}} · {{location}} · {{type}}
data-detail: modal
data-detail-field: Salary: {{salary_range}}
data-detail-field: Department: {{department}}
data-detail-field: Experience: {{experience_level}}
data-detail-field: Posted: {{posted_date}}
data-filter: status = open
data-sort: posted_date desc
data-limit: 20
data-paginate: true
```

### What It Looks Like

card: Senior Frontend Engineer
card-icon: code +color:blue
card-text: Acme Inc · San Francisco, CA · Full-time
card-link: View Role: #modal:job-frontend

card: Product Designer
card-icon: pen-tool +color:violet
card-text: Basecamp · Remote · Full-time
card-link: View Role: #modal:job-designer

card: Marketing Manager
card-icon: megaphone +color:orange
card-text: Stripe · New York, NY · Full-time
card-link: View Role: #modal:job-marketing

card: DevOps Engineer
card-icon: server +color:emerald
card-text: Vercel · Remote · Contract
card-link: View Role: #modal:job-devops

---

## Job Detail Modals

When a visitor clicks a listing, a tabbed modal shows the full role description, requirements, and company info:

modal: job-frontend
  tab: Role
    ### Senior Frontend Engineer

    **Acme Inc** · San Francisco, CA · Full-time
    **$160K — $200K** · Posted 3 days ago

    We're looking for a senior frontend engineer to lead the redesign of our customer dashboard. You'll work closely with design and product to build fast, accessible interfaces used by millions.

    **Responsibilities:**
    - Lead frontend architecture decisions for the dashboard team
    - Build and maintain React components with TypeScript
    - Mentor junior engineers through code reviews and pairing
    - Collaborate with design on prototypes and interaction patterns
    - Improve performance, accessibility, and test coverage

    button: Apply Now: #modal:apply-form +color:emerald
    button: Save Job: #modal:apply-form +outline
  tab: Requirements
    **Must have:**
    - 5+ years of frontend development experience
    - Strong proficiency in React, TypeScript, and CSS
    - Experience with design systems and component libraries
    - Track record of shipping production applications at scale
    - Excellent communication and collaboration skills

    **Nice to have:**
    - Experience with Next.js or Remix
    - Background in data visualization (D3, Chart.js)
    - Contributions to open-source projects

    **Benefits:**
    - Competitive equity package
    - Comprehensive health, dental, and vision
    - Flexible PTO and remote work options
    - $2,500 annual learning and conference budget
  tab: Company
    ### About Acme Inc

    author: Acme Inc
    author-image: https://i.pravatar.cc/128?img=65
    author-role: Series B · 120 employees · Founded 2019
    author-bio: Acme builds developer tools that help engineering teams ship faster. Used by 10,000+ companies worldwide. Backed by a16z and Sequoia.
    author-link: Website: https://example.com
    author-link: Careers: https://example.com

    > "We believe the best tools are built by diverse teams who care deeply about craft." — CEO, Acme Inc

modal: job-designer
  tab: Role
    ### Product Designer

    **Basecamp** · Remote · Full-time
    **$130K — $170K** · Posted 5 days ago

    We're hiring a product designer to shape the next generation of our project management tools. You'll own the end-to-end design process — from research and wireframes to polished UI and interaction design.

    **Responsibilities:**
    - Lead design for key product features from concept to launch
    - Conduct user research and translate insights into design decisions
    - Create wireframes, prototypes, and high-fidelity mockups
    - Build and maintain design system components
    - Collaborate closely with engineering on implementation details

    button: Apply Now: #modal:apply-form +color:emerald
    button: Save Job: #modal:apply-form +outline
  tab: Requirements
    **Must have:**
    - 4+ years of product design experience
    - Strong portfolio showing end-to-end product work
    - Proficiency in Figma and prototyping tools
    - Experience with design systems at scale
    - Excellent visual design and typography skills

    **Nice to have:**
    - Experience with SaaS or developer tools
    - Basic frontend development skills (HTML/CSS)
    - Background in user research or usability testing

    **Benefits:**
    - Fully remote with flexible hours
    - 4-day work week (Fridays off)
    - Annual team retreat
    - $3,000 home office stipend
  tab: Company
    ### About Basecamp

    author: Basecamp
    author-image: https://i.pravatar.cc/128?img=11
    author-role: Bootstrapped · 75 employees · Founded 2004
    author-bio: Basecamp makes project management software used by millions. Known for a calm, sustainable approach to work and building products that last.
    author-link: Website: https://example.com

    > "We don't do sprints. We do cycles — six weeks of focused work followed by two weeks of cooldown." — CTO, Basecamp

modal: job-marketing
  tab: Role
    ### Marketing Manager

    **Stripe** · New York, NY · Full-time
    **$110K — $140K** · Posted 1 week ago

    Join Stripe's marketing team to drive growth for our developer-facing products. You'll own campaigns from strategy through execution, working across content, events, and digital channels.

    **Responsibilities:**
    - Plan and execute multi-channel marketing campaigns
    - Write compelling copy for landing pages, emails, and ads
    - Manage event sponsorships and conference presence
    - Analyze campaign performance and optimize spend
    - Collaborate with product marketing on launches

    button: Apply Now: #modal:apply-form +color:emerald
    button: Save Job: #modal:apply-form +outline
  tab: Requirements
    **Must have:**
    - 5+ years of B2B marketing experience
    - Track record of driving measurable growth
    - Strong writing and storytelling skills
    - Experience with marketing automation (HubSpot, Marketo)
    - Data-driven approach to campaign optimization

    **Nice to have:**
    - Experience marketing to developers
    - Background in fintech or payments
    - Familiarity with SEO and content strategy

    **Benefits:**
    - Competitive base + performance bonus
    - Comprehensive health and wellness benefits
    - $5,000 annual learning budget
    - Hybrid schedule (3 days in office)
  tab: Company
    ### About Stripe

    author: Stripe
    author-image: https://i.pravatar.cc/128?img=68
    author-role: Public · 8,000+ employees · Founded 2010
    author-bio: Stripe builds economic infrastructure for the internet. Millions of businesses use Stripe to accept payments, grow revenue, and accelerate new business opportunities.
    author-link: Website: https://example.com
    author-link: Careers: https://example.com

modal: job-devops
  tab: Role
    ### DevOps Engineer

    **Vercel** · Remote · Contract (6 months)
    **$150K — $180K** · Posted 2 days ago

    We're looking for a DevOps engineer to help scale our edge deployment infrastructure. You'll work on the systems that serve millions of sites globally — optimizing for speed, reliability, and cost.

    **Responsibilities:**
    - Design and maintain CI/CD pipelines for edge deployments
    - Monitor and optimize infrastructure costs across cloud providers
    - Implement observability and alerting for production systems
    - Automate infrastructure provisioning with Terraform
    - Participate in on-call rotation and incident response

    button: Apply Now: #modal:apply-form +color:emerald
    button: Save Job: #modal:apply-form +outline
  tab: Requirements
    **Must have:**
    - 3+ years of DevOps or SRE experience
    - Strong experience with AWS, GCP, or Cloudflare
    - Proficiency in Terraform, Docker, and Kubernetes
    - Experience with monitoring tools (Datadog, Grafana, PagerDuty)
    - Solid understanding of networking and CDN architecture

    **Nice to have:**
    - Experience with edge computing or serverless
    - Background in Node.js or Go
    - Contributions to infrastructure open-source projects

    **Benefits:**
    - Fully remote, async-first culture
    - Competitive contract rate
    - Access to all Vercel products and credits
    - Option to convert to full-time

---

## Filtering by Category

Filter listings by department, location, type, or salary range using `data-filter`:

```markdown
## Engineering

data: jobs
data-display: cards
data-filter: department = Engineering
data-sort: posted_date desc
data-title: {{title}}
data-text: {{company}} · {{location}} · {{type}}

## Remote Only

data: jobs
data-display: cards
data-filter: type = Remote
data-sort: posted_date desc
data-title: {{title}}
data-text: {{company}} · {{location}}

## Senior Roles ($150K+)

data: jobs
data-display: cards
data-filter: min_salary >= 150000
data-sort: min_salary desc
data-title: {{title}}
data-text: {{company}} · {{salary_range}}
```

Create separate pages for each filter to build targeted [landing pages]{e.g., "/jobs/remote-engineering" or "/jobs/senior-design" — each page ranks independently in search engines}.

---

## Application Form

Put the application form inside a modal so candidates can apply without leaving the listing. This form posts to any webhook — connect it to your ATS, email, or Airtable:

modal: apply-form
  ### Apply for This Role

  form:
    webhook: https://hooks.example.com/demo
    submitLabel: Submit Application
    thankYou: Thanks for applying! This is a demo — no application was sent.
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
      - id: portfolio
        type: shorttext
        label: Portfolio or LinkedIn
        placeholder: https://
      - id: experience
        type: select
        label: Years of Experience
        required: true
        options:
          - 1-2 years
          - 3-5 years
          - 5-8 years
          - 8+ years
      - id: cover
        type: longtext
        label: Why are you interested in this role?
        required: true
        placeholder: Tell us what excites you about this opportunity...

button: Open Application Form: #modal:apply-form +big

---

## Job Listings Table

For a denser view, display jobs as a table instead of cards. Good for internal job boards or pages with many listings:

| Role | Department | Location | Type | Salary |
|---|---|---|---|---|
| Senior Frontend Engineer | Engineering | San Francisco, CA | Full-time | $160K — $200K |
| Product Designer | Design | Remote | Full-time | $130K — $170K |
| Marketing Manager | Marketing | New York, NY | Full-time | $110K — $140K |
| DevOps Engineer | Engineering | Remote | Contract | $150K — $180K |
| Content Strategist | Marketing | Chicago, IL | Full-time | $90K — $120K |
| iOS Engineer | Engineering | San Francisco, CA | Full-time | $155K — $195K |

```markdown
data: jobs
data-display: table
data-field: Role: {{title}}
data-field: Department: {{department}}
data-field: Location: {{location}}
data-field: Type: {{type}}
data-field: Salary: {{salary_range}}
data-sort: department asc
```

---

## Board Structure

A complete job board typically has:

| Directory | Purpose |
|---|---|
| `pages/` | Homepage, job listings, category pages, about |
| `pages/jobs/` | Filtered listing pages (by dept, location, type) |
| `modals/` | Job detail views, application forms |
| `settings/data.md` | Job data source configuration |
| `settings/auth.md` | Employer login for posting (optional) |

---

For the full reference on dynamic data, forms, and modals, see the [sitemd docs](https://sitemd.cc/docs/dynamic-data).
