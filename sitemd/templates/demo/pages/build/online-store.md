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
title: Online Store
titleSuffix: " | sitemd.cc"
tabTitle: Online Store
tabTitleSuffix: " | sitemd.cc"
description: Build an e-commerce storefront with product catalogs, detail modals, category filtering, and order forms.
groupMember:
  - build
  - Build Examples
sidebarGroupShown: build
---
card: ⚠️ This is a fully interactive demo site +banner
card-text: 👈 click the pointer tab over there (or use `cmnd+/` or `cntrl+/`) for a live markdown editor you can use to demo pretty much anything sitemd can do by editing live markdown.

# Online Store

An online store needs a product catalog, detail views, category browsing, and a checkout flow. sitemd handles all of this with dynamic data, detail modals, and forms — configured through markdown.

---

## Product Catalog

Display products from a data source as image cards with prices and detail modals. Customers browse visually and click through for full specs.

### Dynamic Data Setup

```markdown
data: products
data-display: cards
data-title: {{name}}
data-text: {{description}} — ${{price}}
data-image: {{image_url}}
data-detail: modal
data-detail-field: Price: ${{price}}
data-detail-field: Material: {{material}}
data-detail-field: Dimensions: {{dimensions}}
data-filter: active = true
data-sort: price asc
data-limit: 12
data-paginate: true
```

### What It Looks Like

card: Minimal Desk Lamp
card-image: https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600&h=400&fit=crop
card-text: Adjustable LED desk lamp with oak base and brass arm. — $89
card-link: View Details: #modal:product-lamp

card: Ceramic Pour-Over Set
card-image: https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop
card-text: Hand-thrown ceramic dripper with matching carafe and walnut stand. — $64
card-link: View Details: #modal:product-pourover

card: Leather Folio
card-image: https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=400&fit=crop
card-text: Full-grain leather document folio with brass zipper and interior pockets. — $120
card-link: View Details: #modal:product-folio

---

## Product Detail Modals

When a customer clicks a product, a detail modal shows full specs, materials, and reviews. Use tabs to organize information without leaving the page.

modal: product-lamp
  tab: Details
    ### Minimal Desk Lamp

    **$89.00** — Free shipping over $50

    Adjustable LED desk lamp with a solid oak base and brushed brass arm. Three brightness levels with warm-to-cool color temperature control. Designed in Portland, crafted in small batches.

    button: Add to Cart: #modal:order-form +color:emerald
    button: Save for Later: #modal:order-form +outline
  tab: Specs
    | Feature | Detail |
    |---|---|
    | Height | 18" adjustable |
    | Base | Solid white oak |
    | Arm | Brushed brass |
    | Bulb | Integrated LED |
    | Wattage | 9W (60W equivalent) |
    | Color temp | 2700K — 5000K |
    | Cord | 6ft braided cloth |
    | Weight | 3.2 lbs |
  tab: Reviews
    **⭐⭐⭐⭐⭐ Beautiful and functional**
    *"Best desk lamp I've owned. The oak and brass look incredible on my desk."* — Alex M.

    **⭐⭐⭐⭐⭐ Worth every penny**
    *"The color temperature control is a game changer for late-night work."* — Sam T.

    **⭐⭐⭐⭐ Great lamp, slow shipping**
    *"Love the design and build quality. Took 10 days to arrive though."* — Jordan K.

modal: product-pourover
  tab: Details
    ### Ceramic Pour-Over Set

    **$64.00** — Free shipping over $50

    Hand-thrown ceramic dripper with matching carafe and walnut stand. The ribbed interior guides water evenly over grounds for a clean, balanced cup. Each piece is unique due to the hand-glazing process.

    button: Add to Cart: #modal:order-form +color:emerald
    button: Save for Later: #modal:order-form +outline
  tab: Specs
    | Feature | Detail |
    |---|---|
    | Dripper | Ceramic, hand-thrown |
    | Carafe | Ceramic, 20oz capacity |
    | Stand | American walnut |
    | Filter | Standard #2 cone |
    | Dishwasher | Dripper and carafe only |
    | Dimensions | 8" × 5" × 6" |
    | Weight | 2.1 lbs |
  tab: Reviews
    **⭐⭐⭐⭐⭐ Morning ritual perfected**
    *"The walnut stand is gorgeous and the ceramic has a beautiful speckled glaze."* — Dana R.

    **⭐⭐⭐⭐⭐ Replaced my Chemex**
    *"Easier to clean, looks better on the counter, and the coffee tastes just as good."* — Chris P.

modal: product-folio
  tab: Details
    ### Leather Folio

    **$120.00** — Free shipping over $50

    Full-grain leather document folio with brass zipper and interior pockets. Fits A4 and US Letter documents, plus a tablet up to 11". Ages beautifully with a rich patina over time.

    button: Add to Cart: #modal:order-form +color:emerald
    button: Save for Later: #modal:order-form +outline
  tab: Specs
    | Feature | Detail |
    |---|---|
    | Leather | Full-grain vegetable-tanned |
    | Hardware | Solid brass YKK zipper |
    | Interior | 3 pockets, pen loop, tablet sleeve |
    | Fits | A4, US Letter, tablets up to 11" |
    | Dimensions | 13.5" × 10" × 1" |
    | Weight | 1.4 lbs |
    | Color | Cognac (darkens with age) |
  tab: Reviews
    **⭐⭐⭐⭐⭐ Executive quality**
    *"Brought this to a client meeting and got three compliments. The leather smell is incredible."* — Michael T.

    **⭐⭐⭐⭐ Beautiful but stiff at first**
    *"Took a week to break in, but now it's buttery soft. The brass zipper is solid."* — Priya K.

modal: order-form
  ### Place Your Order

  form:
    webhook: https://hooks.example.com/demo
    submitLabel: Add to Cart
    thankYou: Added! This is a demo — no order was placed.
    fields:
      - id: product
        type: select
        label: Product
        required: true
        options:
          - Minimal Desk Lamp — $89
          - Ceramic Pour-Over Set — $64
          - Leather Folio — $120
      - id: quantity
        type: shorttext
        label: Quantity
        placeholder: "1"
      - id: email
        type: email
        label: Email (for order confirmation)
        required: true
        placeholder: you@example.com

button: Open Order Form: #modal:order-form +big +outline

```markdown
modal: product-detail
  tab: Details
    ### Minimal Desk Lamp
    **$89.00** — Free shipping over $50
    Adjustable LED desk lamp with a solid oak base...
    button: Add to Cart: #modal:order-form +color:emerald
  tab: Specs
    | Feature | Detail |
    |---|---|
    | Height | 18" adjustable |
    | Base | Solid white oak |
    ...
  tab: Reviews
    **⭐⭐⭐⭐⭐ Beautiful and functional**
    *"Best desk lamp I've owned."* — Alex M.
```

---

## Category Filtering

Filter products by category using `data-filter`. Create separate sections or pages for each category:

```markdown
## Lighting

data: products
data-display: cards
data-filter: category = lighting
data-title: {{name}}
data-text: ${{price}}
data-image: {{image_url}}

## Kitchen

data: products
data-display: cards
data-filter: category = kitchen
data-title: {{name}}
data-text: ${{price}}
data-image: {{image_url}}
```

### Category Cards

card: Lighting
card-icon: lamp-desk +color:amber
card-text: Desk lamps, floor lamps, and pendant lights. Designed for focused work and warm ambiance.

card: Kitchen
card-icon: coffee +color:orange
card-text: Pour-over sets, kettles, ceramic mugs, and handmade kitchen tools.

card: Accessories
card-icon: briefcase +color:emerald
card-text: Leather goods, wallets, folios, and everyday carry essentials.

---

## Order Form

Use a form as a checkout flow. In production, this posts to a payment processor webhook (Stripe, Paddle, etc.):

form:
  webhook: https://hooks.example.com/demo
  submitLabel: Place Order
  thankYou: Thanks! This is a demo — no order was placed.
  fields:
    - id: product
      type: select
      label: Product
      required: true
      options:
        - Minimal Desk Lamp — $89
        - Ceramic Pour-Over Set — $64
        - Leather Folio — $120
    - id: quantity
      type: shorttext
      label: Quantity
      placeholder: "1"
    - id: name
      type: name
      label: Full Name
      required: true
    - id: email
      type: email
      label: Email
      required: true
      placeholder: you@example.com
    - id: notes
      type: longtext
      label: Order Notes
      placeholder: Gift wrapping, special instructions, shipping preferences...

---

## Data Source Setup

Configure your product data in `settings/data.md`:

```yaml
---
provider: supabase

sources:
  - name: products
    table: products
    select: id, name, description, price, image_url, category, material, dimensions, active
    sort: created_at desc
---
```

Then set your credentials:

```bash
sitemd config set supabaseUrl https://your-project.supabase.co
sitemd config set supabaseAnonKey your-anon-key
```

---

## Store Structure

A complete online store typically has:

| Directory | Purpose |
|---|---|
| `pages/` | Homepage, category pages, about, shipping info |
| `auth-pages/` | Customer login and signup |
| `account-pages/` | Order history, saved items, account settings |
| `modals/` | Product detail views, cart, checkout |
| `settings/data.md` | Product data source configuration |
| `settings/auth.md` | Customer auth (optional) |

---

For the full reference on dynamic data, forms, and modals, see the [sitemd docs](https://sitemd.cc/docs/dynamic-data).
