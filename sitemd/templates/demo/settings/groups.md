---
# Groups Settings
# Define named groups of pages. Groups can be displayed as header dropdowns,
# footer columns, or page sidebars.
#
# Each group has:
#   name: groupName              — unique identifier
#   feed: true                   — generate RSS feed at /{name}/feed.xml
#   indexPage: path/to/page.md   — optional page to use as the group's index
#   locations:                   — where this group is shown on the site
#     - sidebar:                 — show as sidebar on listed pages
#         - group: groupName     — all pages in a group
#         - path/to/page.md     — specific page (file path)
#     - header                   — show as dropdown in header nav
#     - footer                   — show as column in footer
#   itemOrder: alpha               — sort items alphabetically (default preserves list order)
#   items:                       — ordered list of pages/links in this group
#     - Label: /slug
#     - Label: https://example.com
#     - button: Label: /slug              — button link
#     - button: Label: /slug +outline     — outline button
#     - Label: /slug +newtab     — force new window
#     - Label: https://example.com +sametab — force same window
#
# Page frontmatter:
#   sidebarGroupShown: groupName      — override: show this group as sidebar
#   sidebarGroupShown: none           — override: suppress sidebar
#   groupMember:                      — groups this page belongs to
#     - groupName                     — uses page title as label
#     - groupName: Custom Label       — custom label in that group's sidebar
#
# Item order is preserved as written. Set itemOrder: alpha to sort alphabetically.

groups:
  - name: Build Examples
    slug: build
    indexPage: none
    itemOrder: manual
    locations:
      - sidebar:
          - group: build
      - header
    items:
      - Startup Landing Page: /build/startup-landing-page
      - Documentation Site: /build/documentation-site
      - Blog & Changelog: /build/blog-and-changelog
      - Portfolio: /build/portfolio
      - SaaS Product: /build/saas-product
      - Community Hub: /build/community-hub
      - Client Portal: /build/client-portal
      - Online Store: /build/online-store
      - Real Estate Portfolio: /build/real-estate-portfolio
      - Job Board: /build/job-board
      - Course Platform: /build/course-platform
      - Event Site: /build/event-site

  - name: Components
    indexPage: components.md
    anchorsDisplay: expanded
    itemOrder: manual
    locations:
      - sidebar:
          - components.md
    items:
      - Components: /components
        - Buttons: #buttons
        - Brand Display: #brand-display
        - Images: #images
        - Image Rows: #image-rows
        - Galleries: #galleries
        - Cards: #cards
        - Embeds: #embeds
        - Tooltips: #tooltips
        - Modals: #modals
        - Forms: #forms
        - Tables: #tables
        - Code Blocks: #code-blocks
        - Blockquotes: #blockquotes
        - Content Alignment: #content-alignment
        - Lists: #lists
        - Named Colors: #named-colors
        - User Authentication: #user-authentication
        - Gated Content: #gated-content
        - Hidden Content: #hidden-content
        - Dynamic Data: #dynamic-data
        - Author Cards: #author-cards
---
