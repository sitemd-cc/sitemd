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
title: Course Platform
titleSuffix: " | sitemd.cc"
tabTitle: Course Platform
tabTitleSuffix: " | sitemd.cc"
description: Build a learning platform with course catalogs, gated lesson tiers, instructor profiles, and enrollment forms.
groupMember:
  - build
  - Build Examples
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Course Platform

A course platform needs a catalog, lesson content gated by subscription tier, instructor profiles, and enrollment flows. sitemd handles this with dynamic data, gated fences, author cards, and forms.

---

## Course Catalog

Display courses as image cards with instructor, duration, and difficulty level. Each card opens a detail modal with curriculum and instructor bio.

### Dynamic Data Setup

```markdown
data: courses
data-display: cards
data-title: {{name}}
data-text: {{instructor}} · {{duration}} · {{level}}
data-image: {{cover_image}}
data-detail: modal
data-detail-field: Duration: {{duration}}
data-detail-field: Level: {{level}}
data-detail-field: Lessons: {{lesson_count}}
data-detail-field: Students: {{enrollment_count}}
data-sort: enrollment_count desc
data-limit: 12
data-paginate: true
```

### What It Looks Like

card: Full-Stack Web Development
card-image: https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=400&fit=crop
card-text: Sarah Chen · 12 weeks · Beginner to Intermediate
card-link: View Course: #modal:course-webdev

card: Data Science with Python
card-image: https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop
card-text: James Rivera · 10 weeks · Intermediate
card-link: View Course: #modal:course-datascience

card: UI/UX Design Fundamentals
card-image: https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=400&fit=crop
card-text: Maya Patel · 8 weeks · Beginner
card-link: View Course: #modal:course-design

---

## Course Detail Modals

When a visitor clicks a course, a tabbed modal shows the overview, full curriculum, and instructor profile:

modal: course-webdev
  tab: Overview
    ### Full-Stack Web Development

    **12 weeks · 48 lessons · Beginner to Intermediate**
    **2,340 students enrolled**

    Go from zero to deploying a full-stack web application. This course covers HTML, CSS, JavaScript, React, Node.js, and PostgreSQL — with hands-on projects every week.

    - Build 6 real projects from scratch
    - Weekly live Q&A sessions with the instructor
    - Access to private Discord community
    - Certificate of completion

    button: Enroll Now: #modal:enroll-form +color:emerald
  tab: Curriculum
    ### Course Curriculum

    **Module 1 — Foundations** (Free preview)
    1. Welcome and setup
    2. HTML structure and semantics
    3. CSS layout and responsive design
    4. JavaScript fundamentals

    **Module 2 — Frontend** (Pro)
    5. React components and state
    6. Routing and navigation
    7. Forms and validation
    8. API integration

    **Module 3 — Backend** (Pro)
    9. Node.js and Express
    10. Database design with PostgreSQL
    11. Authentication and sessions
    12. REST API design

    **Module 4 — Deployment** (Pro)
    13. Testing and CI/CD
    14. Cloud deployment
    15. Performance optimization
    16. Final project

  tab: Instructor
    ### Your Instructor

    author: Sarah Chen
    author-image: https://i.pravatar.cc/128?img=26
    author-role: Senior Engineer · 10 years experience
    author-bio: Sarah has taught over 5,000 students online and worked at Stripe, Vercel, and GitHub. She specializes in making complex topics approachable for beginners.
    author-link: Twitter: https://twitter.com
    author-link: GitHub: https://github.com

    > "My goal is to get you building real things in the first week — not just watching videos." — Sarah Chen

modal: course-datascience
  tab: Overview
    ### Data Science with Python

    **10 weeks · 40 lessons · Intermediate**
    **1,870 students enrolled**

    Master data analysis, visualization, and machine learning with Python. Work with real datasets from day one — no toy examples. By the end, you'll build a complete ML pipeline from data cleaning to deployment.

    - pandas, NumPy, scikit-learn, and matplotlib
    - 5 portfolio-ready projects with real data
    - Jupyter notebooks for every lesson
    - Certificate of completion

    button: Enroll Now: #modal:enroll-form +color:emerald
  tab: Curriculum
    ### Course Curriculum

    **Module 1 — Python for Data** (Free preview)
    1. Python refresher and environment setup
    2. NumPy arrays and vectorized operations
    3. pandas DataFrames and data cleaning
    4. Data visualization with matplotlib

    **Module 2 — Analysis** (Pro)
    5. Exploratory data analysis workflow
    6. Statistical foundations
    7. Feature engineering
    8. Working with APIs and web scraping

    **Module 3 — Machine Learning** (Pro)
    9. Regression and classification
    10. Model evaluation and validation
    11. Tree-based models and ensembles
    12. Clustering and dimensionality reduction

    **Module 4 — Production** (Pro)
    13. ML pipelines with scikit-learn
    14. Model deployment with Flask
    15. Monitoring and retraining
    16. Final capstone project

  tab: Instructor
    ### Your Instructor

    author: James Rivera
    author-image: https://i.pravatar.cc/128?img=52
    author-role: Data Science Lead · 8 years experience
    author-bio: James has led data teams at Spotify and Airbnb. He holds a PhD in Applied Statistics from Stanford and has taught data science to over 3,000 students online.
    author-link: Twitter: https://twitter.com
    author-link: LinkedIn: https://linkedin.com

    > "Data science is about asking the right questions, not just running the right algorithms." — James Rivera

modal: course-design
  tab: Overview
    ### UI/UX Design Fundamentals

    **8 weeks · 32 lessons · Beginner**
    **3,120 students enrolled**

    Learn the principles of user interface and experience design. From wireframes to polished mockups, you'll build a complete design portfolio using Figma — no prior design experience needed.

    - Design thinking and user research methods
    - Wireframing, prototyping, and usability testing
    - Typography, color theory, and layout systems
    - Portfolio of 4 case studies

    button: Enroll Now: #modal:enroll-form +color:emerald
  tab: Curriculum
    ### Course Curriculum

    **Module 1 — Foundations** (Free preview)
    1. What is UX? Design thinking overview
    2. User research and persona creation
    3. Information architecture and user flows
    4. Introduction to Figma

    **Module 2 — Interface Design** (Pro)
    5. Typography and readability
    6. Color theory and accessibility
    7. Layout systems and grids
    8. Component design and reusability

    **Module 3 — Prototyping** (Pro)
    9. Interactive prototypes in Figma
    10. Micro-interactions and animation
    11. Responsive design patterns
    12. Design handoff to developers

    **Module 4 — Portfolio** (Pro)
    13. Usability testing methods
    14. Iterating on feedback
    15. Case study writing
    16. Portfolio presentation and review

  tab: Instructor
    ### Your Instructor

    author: Maya Patel
    author-image: https://i.pravatar.cc/128?img=23
    author-role: Head of Design · 12 years experience
    author-bio: Maya led the Shopify Polaris design system and currently heads design at Linear. She's passionate about making design education accessible to everyone.
    author-link: Website: https://example.com
    author-link: Dribbble: https://dribbble.com

    > "Good design is invisible. Great design makes people feel something." — Maya Patel

modal: enroll-form
  ### Enroll in This Course

  form:
    webhook: https://hooks.example.com/demo
    submitLabel: Start Learning
    thankYou: You're in! This is a demo — no enrollment was created.
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
      - id: experience
        type: radio
        label: Experience Level
        options:
          - Complete beginner
          - Some coding experience
          - Working professional
      - id: goals
        type: longtext
        label: What do you hope to learn?
        placeholder: Tell us about your goals...

button: Open Enrollment Form: #modal:enroll-form +big +outline

---

## Gated Content Tiers

The heart of a course platform: free preview lessons for everyone, and premium content gated behind a subscription. Use `gated:` fences to control access.

### Free vs Pro Content

```markdown
## Module 1 — Foundations

This module is available to everyone:

1. Welcome and setup
2. HTML structure and semantics
3. CSS layout and responsive design

gated: pro
## Module 2 — Frontend

This content requires a Pro subscription:

5. React components and state
6. Routing and navigation
7. Forms and validation

button: Upgrade to Pro: /pricing
/gated
```

### Page-Level Gating

Gate entire lesson pages by placing them in `gated-pages/`:

```
gated-pages/
  pro/
    react-components.md        → Pro subscribers only
    database-design.md         → Pro subscribers only
    authentication.md          → Pro subscribers only
  enterprise/
    team-licenses.md           → Enterprise only
    custom-curriculum.md       → Enterprise only
```

### Tier Cards

card: Free
card-icon: play-circle +color:blue
card-text: Access Module 1 (4 lessons), community Discord, and weekly newsletter. No credit card required.

card: Pro — $29/mo
card-icon: graduation-cap +color:emerald
card-text: All lessons, live Q&A sessions, project reviews, certificate of completion, and priority support.
card-link: Upgrade: #modal:enroll-form

card: Enterprise
card-icon: building +color:violet
card-text: Team licenses, custom curriculum, dedicated instructor, analytics dashboard, and SSO integration.
card-link: Contact Sales: #modal:enroll-form

---

## Student Dashboard

Show enrolled students their courses and progress using auth-filtered dynamic data:

```markdown
data: enrollments
data-display: cards
data-auth: required
data-filter: user_id = {{currentUser.id}}
data-title: {{course_name}}
data-text: {{completed_lessons}} / {{total_lessons}} lessons · {{progress}}% complete
data-image: {{course_image}}
data-link: Continue: /courses/{{course_slug}}/{{next_lesson}}
data-sort: last_accessed desc
```

A student's dashboard might look like:

| Course | Progress | Last Accessed |
|---|---|---|
| Full-Stack Web Development | 24 / 48 lessons (50%) | Today |
| Data Science with Python | 8 / 40 lessons (20%) | 3 days ago |
| UI/UX Design Fundamentals | 32 / 32 lessons (100%) ✅ | Last week |

---

## Enrollment Form

Let visitors enroll in a course. This form posts to a webhook — connect it to your payment processor, student database, or email automation:

form:
  webhook: https://hooks.example.com/demo
  submitLabel: Start Learning
  thankYou: Thanks for enrolling! This is a demo — no enrollment was created.
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
    - id: course
      type: select
      label: Course
      required: true
      options:
        - Full-Stack Web Development
        - Data Science with Python
        - UI/UX Design Fundamentals
    - id: experience
      type: radio
      label: Experience Level
      options:
        - Complete beginner
        - Some coding experience
        - Working professional
    - id: goals
      type: longtext
      label: What do you hope to learn?
      placeholder: Tell us about your goals...

---

## Platform Structure

A complete course platform typically has:

| Directory | Purpose |
|---|---|
| `pages/` | Homepage, course catalog, pricing, about |
| `pages/courses/` | Individual course overview pages |
| `auth-pages/` | Student login and signup |
| `account-pages/` | Student dashboard, progress, settings |
| `gated-pages/pro/` | Pro-tier lesson content |
| `gated-pages/enterprise/` | Enterprise features |
| `modals/` | Course detail views, enrollment forms |
| `settings/auth.md` | Student auth configuration |
| `settings/data.md` | Course and enrollment data sources |

---

For the full reference on gated content, dynamic data, and forms, see the [sitemd docs](https://sitemd.cc/docs/gated-content).
