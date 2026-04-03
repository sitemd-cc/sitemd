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
title: Real Estate Portfolio
titleSuffix: " | sitemd.cc"
tabTitle: Real Estate Portfolio
tabTitleSuffix: " | sitemd.cc"
description: Build a property listing site with image carousels, detail modals, filtering, gallery tours, and inquiry forms.
groupMember:
  - build
  - Build Examples
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Real Estate Portfolio

A property listing site needs image-rich cards, detailed spec sheets, photo galleries, and inquiry forms. sitemd handles all of this with carousel cards, tabbed modals, galleries, and dynamic data.

---

## Property Listings

Display properties as image carousel cards. Multiple `card-image:` lines create a swipeable carousel — perfect for showing multiple photos of each listing.

### Dynamic Data Setup

```markdown
data: properties
data-display: cards
data-title: {{address}}
data-text: {{bedrooms}} bd / {{bathrooms}} ba — ${{price}}
data-image: {{image_urls}}
data-detail: modal
data-detail-field: Square Feet: {{sqft}}
data-detail-field: Lot Size: {{lot_size}}
data-detail-field: Year Built: {{year_built}}
data-detail-field: Garage: {{garage}}
data-sort: price desc
data-limit: 12
data-paginate: true
```

### What It Looks Like

card: 742 Evergreen Terrace
card-text: 4 bd / 3 ba — $675,000
card-image: https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop
card-image: https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop
card-image: https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop
card-link: View Property: #modal:property-evergreen

card: 1600 Pennsylvania Ave
card-text: 6 bd / 5 ba — $1,250,000
card-image: https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop
card-image: https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop
card-link: View Property: #modal:property-pennsylvania

card: 221B Baker Street
card-text: 3 bd / 2 ba — $425,000
card-image: https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop
card-image: https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&h=400&fit=crop
card-image: https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?w=600&h=400&fit=crop
card-link: View Property: #modal:property-baker

```markdown
card: 742 Evergreen Terrace
card-text: 4 bd / 3 ba — $675,000
card-image: https://photos.example.com/742-front.jpg
card-image: https://photos.example.com/742-living.jpg
card-image: https://photos.example.com/742-kitchen.jpg
card-link: View Property: #modal:property-742
```

---

## Property Detail Modals

Full property details in a tabbed modal — specs, photo gallery, and listing agent. Click any property above or the buttons below to explore:

modal: property-evergreen
  tab: Details
    ### 742 Evergreen Terrace

    **$675,000** — [Springfield, IL]{Listed 14 days ago — 3 saves this week}

    | Feature | Detail |
    |---|---|
    | Bedrooms | 4 |
    | Bathrooms | 3 |
    | Square Feet | 2,400 |
    | Lot Size | 0.28 acres |
    | Year Built | 1985 |
    | Garage | 2-car attached |
    | HOA | None |
    | Taxes | $4,200/yr |

    Charming colonial in a quiet neighborhood with mature trees. Recently renovated kitchen with granite countertops and stainless appliances. Hardwood floors throughout the main level. Finished basement with bonus room.

    button: Schedule Tour: #modal:inquiry-form +color:emerald
    button: Save Listing: #modal:inquiry-form +outline
  tab: Photos
    gallery:
      ![Front exterior](https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop)
      ![Living room](https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop)
      ![Kitchen](https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop)
      ![Master bedroom](https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&h=400&fit=crop)
      ![Backyard](https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&h=400&fit=crop)
  tab: Agent
    ### Listing Agent

    author: Maria Santos
    author-image: https://i.pravatar.cc/128?img=32
    author-role: Senior Agent — Lakeside Realty
    author-bio: 12 years of experience in residential real estate. Specializing in the Springfield metro area with over 200 homes sold.
    author-link: Email: mailto:hello@example.com
    author-link: Phone: tel:+15551234567

    button: Contact Agent: #modal:inquiry-form

modal: property-pennsylvania
  tab: Details
    ### 1600 Pennsylvania Ave

    **$1,250,000** — [Georgetown, DC]{Listed 7 days ago — 12 saves this week}

    | Feature | Detail |
    |---|---|
    | Bedrooms | 6 |
    | Bathrooms | 5 |
    | Square Feet | 4,800 |
    | Lot Size | 0.45 acres |
    | Year Built | 1942 |
    | Garage | 3-car detached |
    | HOA | $150/mo |
    | Taxes | $9,600/yr |

    Stately Georgian colonial on a tree-lined avenue. Grand foyer with curved staircase, formal living and dining rooms, chef's kitchen with marble countertops. Primary suite with fireplace and spa bathroom. Landscaped gardens with stone patio.

    button: Schedule Tour: #modal:inquiry-form +color:emerald
    button: Save Listing: #modal:inquiry-form +outline
  tab: Photos
    gallery:
      ![Front exterior](https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop)
      ![Interior](https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop)
      ![Kitchen](https://images.unsplash.com/photo-1600585154526-fecdf28e12e6?w=600&h=400&fit=crop)
      ![Garden](https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=600&h=400&fit=crop)
  tab: Agent
    ### Listing Agent

    author: James Whitfield
    author-image: https://i.pravatar.cc/128?img=53
    author-role: Principal Broker — Capitol Realty Group
    author-bio: 20 years specializing in luxury properties in the DC metro area. Licensed in DC, Virginia, and Maryland.
    author-link: Email: mailto:hello@example.com
    author-link: Phone: tel:+15559876543

    button: Contact Agent: #modal:inquiry-form

modal: property-baker
  tab: Details
    ### 221B Baker Street

    **$425,000** — [Marylebone, London]{Listed 21 days ago — 8 saves this week}

    | Feature | Detail |
    |---|---|
    | Bedrooms | 3 |
    | Bathrooms | 2 |
    | Square Feet | 1,650 |
    | Lot Size | 0.12 acres |
    | Year Built | 1890 |
    | Garage | Street parking |
    | HOA | None |
    | Taxes | $3,100/yr |

    Classic Victorian townhouse with original period features. Exposed brick, hardwood floors, and ornate fireplace mantels throughout. Updated kitchen and bathrooms. Private rear garden with patio. Walking distance to Regent's Park.

    button: Schedule Tour: #modal:inquiry-form +color:emerald
    button: Save Listing: #modal:inquiry-form +outline
  tab: Photos
    gallery:
      ![Front exterior](https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop)
      ![Living room](https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=600&h=400&fit=crop)
      ![Kitchen](https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?w=600&h=400&fit=crop)
      ![Garden](https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&h=400&fit=crop)
  tab: Agent
    ### Listing Agent

    author: Eleanor Voss
    author-image: https://i.pravatar.cc/128?img=44
    author-role: Senior Agent — Heritage Homes
    author-bio: Specialist in period properties and Victorian restorations. 15 years serving the Marylebone and Mayfair markets.
    author-link: Email: mailto:hello@example.com
    author-link: Phone: tel:+44207555123

    button: Contact Agent: #modal:inquiry-form

---

## Filtering and Sorting

Let visitors narrow listings by price, bedrooms, neighborhood, or property type using `data-filter` and `data-sort`:

```markdown
## Under $500K

data: properties
data-display: cards
data-filter: price <= 500000
data-sort: price asc
data-title: {{address}}
data-text: {{bedrooms}} bd / {{bathrooms}} ba — ${{price}}
data-image: {{image_urls}}

## 3+ Bedrooms

data: properties
data-display: cards
data-filter: bedrooms >= 3
data-sort: price asc
data-title: {{address}}
data-text: {{bedrooms}} bd / {{bathrooms}} ba — ${{price}}

## Downtown

data: properties
data-display: cards
data-filter: neighborhood = Downtown
data-sort: created_at desc
data-title: {{address}}
data-text: {{bedrooms}} bd / {{bathrooms}} ba — ${{price}}
```

Combine filters to create targeted landing pages — [great for SEO]{Create pages like "/homes-under-500k" or "/3-bedroom-downtown" that rank for specific searches}.

---

## Photo Gallery

For dedicated listing pages (not modals), use a full gallery for the property photo tour. Visitors can click any image to open a fullscreen lightbox:

gallery:
  ![Front exterior](https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop)
  ![Living room](https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop)
  ![Kitchen](https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop)
  ![Master bedroom](https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&h=400&fit=crop)
  ![Backyard](https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=600&h=400&fit=crop)
  ![Garage](https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=600&h=400&fit=crop)

```markdown
gallery:
  ![Front exterior](https://photos.example.com/742-front.jpg)
  ![Living room](https://photos.example.com/742-living.jpg)
  ![Kitchen](https://photos.example.com/742-kitchen.jpg)
  ![Master bedroom](https://photos.example.com/742-master.jpg)
  ![Backyard](https://photos.example.com/742-backyard.jpg)
  ![Garage](https://photos.example.com/742-garage.jpg)
```

---

## Inquiry Form

Let potential buyers request tours or ask questions. This form lives inside a modal — accessible from any listing's detail view:

modal: inquiry-form
  ### Schedule a Tour

  form:
    webhook: https://hooks.example.com/demo
    submitLabel: Request Tour
    thankYou: Thanks for your interest! This is a demo — no request was sent.
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
      - id: phone
        type: shorttext
        label: Phone
        placeholder: (555) 555-5555
      - id: date
        type: shorttext
        label: Preferred Tour Date
        placeholder: e.g. April 15, 2026
      - id: preapproved
        type: radio
        label: Pre-approved for mortgage?
        options:
          - "Yes"
          - "No"
          - Not yet — need a referral
      - id: message
        type: longtext
        label: Questions or Comments
        placeholder: Any specific questions about the property?

button: Schedule a Tour: #modal:inquiry-form +big

```markdown
modal: inquiry-form
  ### Schedule a Tour

  form:
    webhook: https://hooks.example.com/inquiry
    submitLabel: Request Tour
    fields:
      - id: name
        type: name
        label: Full Name
        required: true
      - id: email
        type: email
        label: Email
        required: true
      ...
```

---

## Listing Site Structure

A complete real estate site typically has:

| Directory | Purpose |
|---|---|
| `pages/` | Homepage, search, neighborhood guides, about |
| `pages/listings/` | Individual property pages with full galleries |
| `auth-pages/` | Agent login (optional) |
| `account-pages/` | Saved listings, search alerts |
| `modals/` | Property detail views, inquiry forms |
| `settings/data.md` | Property data source configuration |

---

For the full reference on dynamic data, galleries, modals, and forms, see the [sitemd docs](https://sitemd.cc/docs/dynamic-data).
