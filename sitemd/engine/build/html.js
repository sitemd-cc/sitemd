const { buildBtnHtml, buildLinkAttrs, parseImageModifiers, buildImageStyle } = require('./parse');
const { resolveIcon } = require('./icons');

// Build header search button
function buildHeaderSearch(config) {
  if (config.headerSearch === 'hide') return '';
  return `<button class="search-toggle" type="button" aria-label="Search site">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>`;
}

// Build brand image tag with modifier support
function buildBrandImg(src, alt, extraClass) {
  const { cleanUrl, mods } = parseImageModifiers(src);
  const style = buildImageStyle(mods);
  const cls = extraClass ? `brand-logo ${extraClass}` : 'brand-logo';
  return `<img src="${cleanUrl}" class="${cls}" alt="${alt}"${style}>`;
}

// Build brand HTML from settings/header.md
function buildBrand(config) {
  const display = config.brandDisplay || 'text';
  const image = config.brandImage || '/theme/images/logo.svg';
  const name = config.headerBrandName || config.brandName;

  if (display === 'image') {
    return `<a href="/" class="site-name">${buildBrandImg(image, name)}</a>`;
  }
  if (display === 'image-text') {
    return `<a href="/" class="site-name">${buildBrandImg(image, name)}${name}</a>`;
  }
  if (display === 'text-image') {
    return `<a href="/" class="site-name">${name}${buildBrandImg(image, name, 'brand-logo--after')}</a>`;
  }
  return `<a href="/" class="site-name">${name}</a>`;
}

// Build inline brand element for {{brandDisplay}} variable in page content
// Optional width param scales the entire brand element to fit a total width
function buildBrandInline(config, width) {
  const display = config.brandDisplay || 'text';
  const image = config.brandImage || '/theme/images/logo.svg';
  const name = config.headerBrandName || config.brandName;

  let inner;
  if (display === 'image') {
    inner = buildBrandImg(image, name);
  } else if (display === 'image-text') {
    inner = `${buildBrandImg(image, name)}${name}`;
  } else if (display === 'text-image') {
    inner = `${name}${buildBrandImg(image, name, 'brand-logo--after')}`;
  } else {
    inner = name;
  }
  if (width) {
    return `<div class="brand-inline" style="font-size:${width / 7}px">${inner}</div>`;
  }
  return `<div class="brand-inline">${inner}</div>`;
}

// Build just the brand image for {{brandImage}} variable in page content
function buildBrandImage(config) {
  const image = config.brandImage || '/theme/images/logo.svg';
  const name = config.headerBrandName || config.brandName;
  return buildBrandImg(image, name);
}

// Build nav HTML from settings/header.md
function buildNav(config, pages, currentSlug) {
  const items = config.navItems || [];
  if (items.length === 0) {
    // Fallback: link to all pages that have nav metadata
    return pages
      .filter(p => p.meta['nav.label'])
      .sort((a, b) => (parseInt(a.meta['nav.order']) || 0) - (parseInt(b.meta['nav.order']) || 0))
      .map(p => `<a href="${p.slug}"${p.slug === currentSlug ? ' class="active"' : ''}>${p.meta['nav.label']}</a>`)
      .join('\n        ');
  }

  const chevron = '<svg class="nav-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  return items.map(item => {
    if (item.type === 'group') {
      // Resolve group by name or slug
      const groupRef = item.groupRef || item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const allGroups = config.groups || {};
      let groupDef = allGroups[groupRef];
      let groupDisplayName = null;
      if (!groupDef) {
        // Try matching by slug
        for (const [gName, gDef] of Object.entries(allGroups)) {
          if (gDef.slug === groupRef) { groupDef = gDef; groupDisplayName = gName; break; }
        }
      } else {
        groupDisplayName = groupRef;
      }
      // Use group name (display name) when resolving from groups.md
      const label = (!item.children || item.children.length === 0) && groupDef
        ? (groupDisplayName || groupRef.charAt(0).toUpperCase() + groupRef.slice(1))
        : item.label;
      const childList = (item.children && item.children.length > 0)
        ? item.children
        : (groupDef ? groupDef.items : []);
      const children = childList.map(child => {
        if (child.type === 'button') return buildBtnHtml(child);
        return `<a href="${child.slug}"${buildLinkAttrs(child)}>${child.label}</a>`;
      }).join('\n            ');
      return `<div class="nav-group">
          <button type="button" class="nav-group-toggle">${label} ${chevron}</button>
          <div class="nav-dropdown">
            ${children}
          </div>
        </div>`;
    }

    if (item.type === 'button' || item.type === 'cta') {
      return buildBtnHtml(item);
    }

    // Regular link
    return `<a href="${item.slug}"${item.slug === currentSlug ? ' class="active"' : ''}${buildLinkAttrs(item)}>${item.label}</a>`;
  }).join('\n        ');
}

// Build footer HTML from settings/footer.md
function buildFooter(config) {
  const footerBrand = config.footerBrandName || config.brandName;
  const copyright = (config.footerCopyright || '&copy; {{year}} {{brandName}}')
    .replace(/\{\{year\}\}/g, String(new Date().getFullYear()))
    .replace(/\{\{brandName\}\}/g, footerBrand)
    .replace(/\{\{siteName\}\}/g, footerBrand);
  const tagline = config.footerTagline || '';
  const groups = config.footerGroups || [];
  const social = config.footerSocial || [];

  let html = '';

  // Footer items (same format as header: links, buttons, groups)
  if (groups.length > 0) {
    html += '<div class="footer-groups">\n';
    for (const item of groups) {
      if (item.type === 'button') {
        html += `      <div class="footer-group">${buildBtnHtml(item)}</div>\n`;
        continue;
      }
      if (item.type === 'group') {
        // Group with children — renders as footer column
        const groupRef = item.groupRef || item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const allGroups = config.groups || {};
        let groupDef = allGroups[groupRef];
        let groupDisplayName = null;
        if (!groupDef) {
          for (const [gName, gDef] of Object.entries(allGroups)) {
            if (gDef.slug === groupRef) { groupDef = gDef; groupDisplayName = gName; break; }
          }
        } else {
          groupDisplayName = groupRef;
        }
        // Use group name (display name) when resolving from groups.md
        const label = (!item.children || item.children.length === 0) && groupDef
          ? (groupDisplayName || groupRef.charAt(0).toUpperCase() + groupRef.slice(1))
          : item.label;
        const childList = (item.children && item.children.length > 0)
          ? item.children
          : (groupDef ? groupDef.items : []);
        // headingLink: explicit setting wins, then group indexPage, "none" disables
        let headingLink;
        if (item.headingLink === 'none') {
          headingLink = null;
        } else if (item.headingLink) {
          headingLink = item.headingLink;
        } else if (groupDef && groupDef.indexPage) {
          // Resolve indexPage file path to slug: strip .md and prefix with /
          headingLink = '/' + groupDef.indexPage.replace(/\.md$/, '');
        } else {
          headingLink = null;
        }
        html += `      <div class="footer-group">\n`;
        html += headingLink
          ? `        <h4><a href="${headingLink}"${buildLinkAttrs({ slug: headingLink })}>${label}</a></h4>\n`
          : `        <h4>${label}</h4>\n`;
        html += `        <ul>\n`;
        for (const link of childList) {
          if (link.type === 'button') {
            html += `          <li>${buildBtnHtml(link)}</li>\n`;
          } else {
            html += `          <li><a href="${link.slug}"${buildLinkAttrs(link)}>${link.label}</a></li>\n`;
          }
        }
        html += `        </ul>\n      </div>\n`;
        continue;
      }
      // Regular link
      html += `      <div class="footer-group"><a href="${item.slug}"${buildLinkAttrs(item)}>${item.label}</a></div>\n`;
    }
    html += '    </div>\n';
  }

  // Social links
  if (social.length > 0) {
    html += '    <div class="footer-social">\n';
    for (const s of social) {
      html += `      <a href="${s.url}" target="_blank" rel="noopener noreferrer" aria-label="${s.platform}">${socialIcon(s.platform)}</a>\n`;
    }
    html += '    </div>\n';
  }

  // Copyright (with optional brand display injected after)
  html += `    <p class="footer-copyright">${copyright}</p>\n`;
  const footerDisplay = config.footerBrandDisplay;
  if (footerDisplay && footerDisplay !== 'none') {
    const fImage = config.brandImage || '/theme/images/logo.svg';
    const fName = config.footerBrandName || config.brandName;
    let brandHtml = '';
    if (footerDisplay === 'image') {
      brandHtml = buildBrandImg(fImage, fName);
    } else if (footerDisplay === 'image-text') {
      brandHtml = `${buildBrandImg(fImage, fName)}<span>${fName}</span>`;
    } else if (footerDisplay === 'text-image') {
      brandHtml = `<span>${fName}</span>${buildBrandImg(fImage, fName, 'brand-logo--after')}`;
    } else if (footerDisplay === 'text') {
      brandHtml = `<span>${fName}</span>`;
    }
    html += `    <div class="footer-brand">${brandHtml}</div>\n`;
  }

  // Tagline
  if (tagline) {
    html += `    <p class="footer-tagline">${tagline}</p>\n`;
  }

  return html;
}

// Build sidebar from a named group (matches by name or slug)
function buildSidebar(config, groupName, currentSlug) {
  const groups = config.groups || {};
  let group = groups[groupName];
  if (!group) {
    // Try matching by slug
    for (const [, gDef] of Object.entries(groups)) {
      if (gDef.slug === groupName || gDef.slug === groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) {
        group = gDef; break;
      }
    }
  }
  if (!group || !group.items || group.items.length === 0) return '';

  let html = '';

  // Prepend search unless group has search: hide
  if (group.search !== 'hide') {
    html += buildSidebarSearch(groupName, group.searchScope || 'group') + '\n        ';
  }

  const anchorsDisplay = group.anchorsDisplay || 'collapsed';
  html += renderSidebarItems(group.items, currentSlug, { anchorsDisplay });

  return html;
}

function buildSidebarSearch(scope, scopeType) {
  return `<div class="sidebar-search" data-scope="${scope}" data-scope-type="${scopeType}">
          <button class="sidebar-search-btn" type="button" aria-label="Search">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <input class="sidebar-search-input" type="search" placeholder="Search..." aria-label="Search this section" autocomplete="off" hidden>
          <div class="sidebar-search-results"></div>
        </div>`;
}

const _chevronSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

// Shared item renderer used by group sidebars and per-page sidebars.
function renderSidebarItems(items, currentSlug, opts = {}) {
  const anchorsDisplay = opts.anchorsDisplay || 'collapsed';
  const forceActive = opts.forceActive === true;
  return items
    .map(link => {
      if (link.type === 'button') {
        return buildBtnHtml(link);
      }
      const isActive = forceActive || link.slug === currentSlug;
      const active = isActive ? ' class="active"' : '';
      const linkHtml = `<a href="${link.slug}"${active}${buildLinkAttrs(link)}>${link.label}</a>`;

      if (link.anchors && link.anchors.length > 0) {
        const expanded = isActive || anchorsDisplay === 'expanded';
        const anchorLinks = link.anchors
          .map(a => {
            const href = a.hash && a.hash.startsWith('#') ? `${link.slug}${a.hash}` : a.hash;
            return `<a href="${href}">${a.label}</a>`;
          })
          .join('\n            ');
        return `<div class="sidebar-anchors">
          ${linkHtml}
          <button class="sidebar-anchors-toggle" type="button" aria-expanded="${expanded}" aria-label="Toggle sections">${_chevronSvg}</button>
          <div class="sidebar-anchors-list"${expanded ? '' : ' hidden'}>
            ${anchorLinks}
          </div>
        </div>`;
      }

      return linkHtml;
    })
    .join('\n        ');
}

// Build a sidebar from an explicit item array (per-page frontmatter).
// `selfTree`, when provided, is the page's own H2/H3/inline-anchor hierarchy
// from extractTocTree() — each H2 becomes a top-level item with its H3s and
// inline anchors nested underneath.
function buildSidebarFromItems(items, currentSlug, opts = {}) {
  const search = buildSidebarSearch('site', 'site') + '\n        ';
  if (opts.selfTree) {
    if (!opts.selfTree.length) return '';
    const selfItems = opts.selfTree.map(node => ({
      label: node.label,
      // Use full slug+hash so the link works from anywhere; renderSidebarItems
      // honors `slug` directly as the href.
      slug: `${currentSlug}${node.hash}`,
      anchors: (node.anchors || []).map(a => ({
        label: a.label,
        // Absolute href (does not start with `#`) → renderSidebarItems uses it as-is.
        hash: `${currentSlug}${a.hash}`,
      })),
    }));
    return search + renderSidebarItems(selfItems, currentSlug, { anchorsDisplay: 'expanded' });
  }
  if (!items || !items.length) return '';
  return search + renderSidebarItems(items, currentSlug, { anchorsDisplay: 'expanded' });
}

// Social icon — resolves brand icons from Simple Icons via the icon resolver.
// Maps platform names to Simple Icons slugs and patches size for footer/author context.
function socialIcon(platform) {
  const slugMap = { twitter: 'brand-x', email: 'mail' };
  const slug = slugMap[platform] || platform;
  const svg = resolveIcon(slug);
  if (!svg) return `<span>${platform}</span>`;
  return svg.replace(/width="24"/, 'width="18"').replace(/height="24"/, 'height="18"');
}

// Build auth header button
function buildAuthButton(config) {
  if (!config.authProvider || config.authProvider === 'none') return '';
  if (config.authHeaderButton === 'hide') return '';
  return `<a href="${config.authLoginPage || '/login'}" class="auth-toggle" aria-label="Account">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
        </a>`;
}

module.exports = { buildBrand, buildBrandInline, buildBrandImage, buildNav, buildFooter, buildSidebar, buildSidebarFromItems, buildHeaderSearch, buildAuthButton, socialIcon };
