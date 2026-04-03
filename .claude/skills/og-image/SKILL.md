---
name: og-image
description: Generate a custom branded OG social share image from the site's theme colors and content.
---

# OG Image Generator

Generate a branded social share image (1200×630 @2x) by writing and running a Node script using Satori + Resvg. The image is saved to `media/og-image.png` and configured in SEO settings.

No permission required — execute immediately.

## Procedure

### Step 1: Read site config

Read these settings files in parallel:
- `settings/meta.md` — get brand name, description, brand image
- `settings/theme.md` — get `defaultMode`
- `settings/seo.md` — check current OG image state

### Step 2: Determine theme colors

Check `defaultMode` from theme settings:
- If `dark`, `light`, or `paper` → use that mode
- If `system` → ask the user: "Your theme is set to system mode. Which theme should the OG image use: dark, light, or paper?"

Read `theme/styles.css` to extract CSS variables for the chosen mode:
- Light mode: `:root, [data-theme="light"]` block
- Dark/paper: `[data-theme="<mode>"]` block
- Extract: `--color-bg`, `--color-bg-secondary`, `--color-bg-tertiary`, `--color-text`, `--color-text-secondary`, `--color-text-tertiary`, `--color-border`, `--color-accent`, `--color-code-bg`, `--color-code-text`

### Step 3: Ask the user 3 questions

Present smart defaults based on the config:

1. **Heading text** — default: brand name or site title. "What heading should appear on the image?"
2. **Subheading text** — default: site description. "What subheading (if any)?"
3. **Preview object** — "What should the main visual be? This is what people see when the link is shared. Could be a product screenshot, a browser mockup, a code snippet, an illustration, a logo — whatever represents your site." If the user doesn't want a preview object, use a simpler layout (heading + subheading + optional brand image). If they do want one, design and build it with Satori elements.

If the user gives short answers or says "defaults are fine", use the defaults.

### Step 4: Write and run a generation script

Write a standalone Node script (e.g. `scripts/generate-og.js`) that generates the image. Run it with `node`. Delete the script after successful generation.

#### Script template

```javascript
const fs = require('fs');
const path = require('path');

// JSX-like element helper for Satori
function h(type, props, ...children) {
  const flat = children.flat().filter(Boolean);
  return { type, props: { ...props, children: flat.length === 1 ? flat[0] : flat.length === 0 ? undefined : flat } };
}

(async () => {
  const satori = (await import('satori')).default;
  const { Resvg } = require('@resvg/resvg-js');

  // Load Inter fonts from engine
  const fontsDir = path.join(__dirname, '..', 'sitemd', 'engine', 'seo', 'fonts');
  const fonts = [
    { name: 'Inter', data: fs.readFileSync(path.join(fontsDir, 'Inter-Regular.ttf')), weight: 400, style: 'normal' },
    { name: 'Inter', data: fs.readFileSync(path.join(fontsDir, 'Inter-Bold.ttf')), weight: 700, style: 'normal' },
  ];

  // Build the layout using h() — design freely based on user's request
  const element = h('div', {
    style: {
      width: '100%', height: '100%', display: 'flex',
      // ... your layout here, using the theme colors
    },
  }, /* child elements */);

  // Render: Satori → SVG, Resvg → PNG at 2x
  const svg = await satori(element, { width: 1200, height: 630, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 2400 } });
  const png = resvg.render().asPng();

  const outPath = path.join(__dirname, '..', 'media', 'og-image.png');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${(png.length / 1024).toFixed(0)} KB)`);
})();
```

#### Satori constraints

Satori renders a subset of CSS via flexbox. Key rules:
- Every element must use `display: 'flex'` (no block/grid/inline)
- Use `flexDirection`, `alignItems`, `justifyContent` for all layout
- `fontFamily: 'Inter'` — the loaded font. Use `fontWeight: 700` for bold
- Supports: `position`, `border`, `borderRadius`, `background`, `backgroundImage` (linear/radial gradients), `boxShadow`, `opacity`, `overflow: 'hidden'`, `gap`
- Does NOT support: CSS grid, `transform` (except on the root), `filter`, `backdrop-filter`, `animation`, `@font-face`
- Images: use `<img>` elements with `src` as data URIs or absolute URLs
- Text must be direct children — wrap in a `<div>` or `<span>`, not bare strings mixed with elements

#### Safe zones and padding

The canvas is 1200×630 (rendered at 2400×1260 for retina). Social platforms crop unpredictably:
- Use **60-80px padding** on all sides as a safe zone
- Keep critical content (text, logos) within the inner ~1060×470 area
- Full-bleed background colors and subtle gradients can extend to edges
- Place accent bars, borders, and decorative elements at edges — they survive partial cropping

### Step 5: Update SEO settings

After generating the image:
1. Update `settings/seo.md` — set `ogImage: /media/og-image.png`

### Step 6: Show the result

Tell the user:
- "Generated `media/og-image.png` — open the file to preview it."
- "SEO settings updated to use this image."
- "Want any changes? I can adjust the text, colors, or layout and regenerate."

### Step 7: Iterate

If the user wants changes, update the script and regenerate. They can review the raw PNG each time without restarting the dev server.

## Rules

- Always read site config before asking questions — use real values as defaults
- Never generate without asking the user first (unless they explicitly provide all parameters)
- Save to `media/og-image.png`
- Clean up the generation script after successful runs
- Design freely — there are no fixed layouts. Build whatever best represents the user's site
- Keep iteration fast — modify and re-run the script, no server restart needed
