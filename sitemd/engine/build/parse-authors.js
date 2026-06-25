const { resolveIcon } = require('./icons.js');
const { marked } = require('./lib/marked.min.js');
const { parseImageModifiers, buildImageStyle } = require('./parse-images');

function detectPlatform(url) {
  if (url.startsWith('mailto:')) return 'mail';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'twitter.com' || host === 'x.com') return 'twitter';
    if (host === 'github.com') return 'github';
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';
    if (host === 'youtube.com' || host === 'youtu.be') return 'youtube';
    if (host === 'discord.com' || host === 'discord.gg') return 'discord';
    if (host === 'reddit.com' || host.endsWith('.reddit.com')) return 'reddit';
    if (host === 'instagram.com') return 'instagram';
    if (host.includes('mastodon') || host.includes('fosstodon') || host.includes('hachyderm')) return 'mastodon';
  } catch {}
  return 'website';
}

function platformLabel(platform) {
  const labels = { twitter: 'Twitter', github: 'GitHub', linkedin: 'LinkedIn', youtube: 'YouTube', discord: 'Discord', reddit: 'Reddit', instagram: 'Instagram', mastodon: 'Mastodon', mail: 'Email', website: 'Website' };
  return labels[platform] || platform;
}

function authorLinkIcon(platform) {
  const nameMap = { twitter: 'brand-x', mail: 'mail', website: 'globe' };
  const iconName = nameMap[platform] || platform;
  const svg = resolveIcon(iconName);
  if (!svg) return resolveIcon('link') || '';
  // Social/brand icons render at 18px in author cards
  if (platform !== 'mail' && platform !== 'website') {
    return svg.replace(/width="24"/, 'width="18"').replace(/height="24"/, 'height="18"');
  }
  return svg;
}

function buildAuthorHtml(block) {
  const lines = block.trim().split('\n').filter(l => l.trim() !== '');
  const authors = [];
  let current = null;

  for (const line of lines) {
    if (/^author:\s+/.test(line)) {
      if (current) authors.push(current);
      current = { name: line.replace(/^author:\s+/, '').trim(), links: [] };
    } else if (/^author-image:\s+/.test(line) && current) {
      current.image = line.replace(/^author-image:\s+/, '').trim();
    } else if (/^author-role:\s+/.test(line) && current) {
      current.role = line.replace(/^author-role:\s+/, '').trim();
    } else if (/^author-bio:\s+/.test(line) && current) {
      current.bio = line.replace(/^author-bio:\s+/, '').trim();
    } else if (/^author-link:\s+/.test(line) && current) {
      let raw = line.replace(/^author-link:\s+/, '').trim();
      // Bare email -> mailto:
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) raw = 'mailto:' + raw;
      // Format: "Label: URL" or bare "URL"
      const colonMatch = raw.match(/^(.+?):\s+(https?:\/\/\S+|mailto:\S+)$/);
      if (colonMatch) {
        const url = colonMatch[2];
        const platform = detectPlatform(url);
        current.links.push({ label: colonMatch[1].trim(), url, platform });
      } else {
        const platform = detectPlatform(raw);
        current.links.push({ label: platformLabel(platform), url: raw, platform });
      }
    }
  }
  if (current) authors.push(current);
  if (authors.length === 0) return block;

  const authorHtmls = authors.map(author => {
    const parts = [];
    if (author.image) {
      const { cleanUrl, mods } = parseImageModifiers(author.image);
      const style = buildImageStyle(mods);
      parts.push(`<img src="${cleanUrl}" alt="${author.name}" class="author-avatar" loading="lazy"${style}>`);
    }
    parts.push('<div class="author-body">');
    parts.push(`<div class="author-name">${marked.parseInline(author.name)}</div>`);
    if (author.role) {
      parts.push(`<div class="author-role">${marked.parseInline(author.role)}</div>`);
    }
    if (author.bio) {
      parts.push(`<p class="author-bio">${marked.parseInline(author.bio)}</p>`);
    }
    if (author.links.length > 0) {
      const linkHtmls = author.links.map(link => {
        const icon = authorLinkIcon(link.platform);
        const target = link.url.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener noreferrer"';
        return `<a href="${link.url}" class="author-link" aria-label="${link.label}"${target}>${icon}<span>${link.label}</span></a>`;
      });
      parts.push(`<div class="author-links">${linkHtmls.join('')}</div>`);
    }
    parts.push('</div>');
    return `<div class="author-card">${parts.join('')}</div>`;
  });

  return `<div class="author-group">${authorHtmls.join('')}</div>\n`;
}

module.exports = { detectPlatform, platformLabel, authorLinkIcon, buildAuthorHtml };
