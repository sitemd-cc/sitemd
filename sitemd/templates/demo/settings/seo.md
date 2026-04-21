---
# SEO Settings
language: en

# OG social share image
# "auto" generates a branded card from your theme colors + site name
# Set a file path (e.g. /media/og-image.png) to use a custom image
# "none" disables OG images entirely
# Per-page override: set image: in page frontmatter
ogImage: media/og-image.png

# ── Auto OG card options (only apply when ogImage: auto) ─────
# Card style: "template" (branded card) or "screenshot" (page capture)
# ogStyle: template
# Background color (defaults to your theme's background for defaultMode)
# ogBackground:
# Text color (defaults to your theme's text color for defaultMode)
# ogTextColor:
# Brand logo for OG cards (path to image in media/)
# ogLogo:

# Default author for article schema
# defaultAuthor:

# Twitter/X handle for twitter:site card attribution
# twitterHandle:

# JSON-LD structured data on every page
structuredData: true

# Generate /llms.txt for AI model discovery
llmsTxt: true

# Publish .md versions of every page (for AI crawlers and LLM tools)
markdownOutput: true

# Allow AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.)
# true = allow all (recommended for visibility)
# false = block via robots.txt
allowAICrawlers: true

# IndexNow — auto-notify Bing, Yandex, Naver, Seznam on every deploy
# API key is auto-generated on first deploy
indexNow: false

# Organization info for homepage schema
# (auto-derived from brandName / brandImage — override here if different)
# orgName:
# orgLogo:

# ── Secrets (CLI-managed) ─────────────────────────
# Manage secrets: sitemd config setup seo
# (none configured)
---
