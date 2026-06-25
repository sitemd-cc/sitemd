// ---------------------------------------------------------------------------
// Search index generator — builds search-index.json at build time
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeadings(renderedContent) {
  if (!renderedContent) return [];
  var headings = [];
  // Strip code blocks before heading extraction so HTML examples don't get matched
  var cleaned = renderedContent.replace(/<pre[\s\S]*?<\/pre>/gi, '').replace(/<code[\s\S]*?<\/code>/gi, '');
  // Split content at heading tags (h1-h4), capturing the tag itself
  var re = /<h([1-4])(?:\s[^>]*)?\bid="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/gi;
  var match;
  var matches = [];
  while ((match = re.exec(cleaned)) !== null) {
    matches.push({ id: match[2], html: match[3] });
  }
  // Also match h2.h1-style (downgraded h1s)
  var re2 = /<h2\s[^>]*class="h1-style"[^>]*\bid="([^"]*)"[^>]*>([\s\S]*?)<\/h2>/gi;
  while ((match = re2.exec(cleaned)) !== null) {
    if (!matches.some(function(m) { return m.id === match[1]; })) {
      matches.push({ id: match[1], html: match[2] });
    }
  }
  // For each heading, find its position in the original content and extract context
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    var text = stripHtml(m.html);
    // Find this heading in original content by its id to get accurate context
    var idRe = new RegExp('<h[1-4][^>]*\\bid="' + m.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>[\\s\\S]*?</h[1-4]>', 'i');
    var idMatch = idRe.exec(renderedContent);
    var context = '';
    if (idMatch) {
      var afterHeading = renderedContent.slice(idMatch.index + idMatch[0].length);
      // Strip code blocks from context too
      afterHeading = afterHeading.replace(/<pre[\s\S]*?<\/pre>/gi, ' ');
      // Take content up to next heading
      var nextH = afterHeading.search(/<h[1-4][\s>]/i);
      if (nextH !== -1) afterHeading = afterHeading.slice(0, nextH);
      context = stripHtml(afterHeading).slice(0, 200);
    }
    headings.push({ i: m.id, t: text, c: context });
  }
  return headings;
}

function generateSearchIndex(pages, config, distDir) {
  const index = [];

  // Build regex to strip trailing brand name suffix from titles
  // e.g. "Colors — sitemd" → "Colors"
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const names = [...new Set([config.brandName, config.title].filter(Boolean))];
  const suffixRe = new RegExp('\\s*[—–-]\\s*(?:' + names.map(esc).join('|') + ')$');

  for (const page of pages) {
    // Skip pages that opt out of search
    if (page.meta.search === 'exclude') continue;

    // Get first group membership
    const members = page.meta.groupMember;
    let group = '';
    if (Array.isArray(members) && members.length > 0) {
      const entry = members[0];
      group = entry.includes(':') ? entry.slice(0, entry.indexOf(':')).trim() : entry.trim();
    }

    // Strip code blocks and HTML from rendered content
    const contentNoCode = (page.renderedContent || '').replace(/<pre[\s\S]*?<\/pre>/gi, ' ').replace(/<code[\s\S]*?<\/code>/gi, ' ');
    const body = stripHtml(contentNoCode).slice(0, 5000);

    // Extract headings with context
    const headings = extractHeadings(page.renderedContent);

    const entry = {
      t: page.title.replace(suffixRe, ''),
      s: page.slug,
      g: group,
      b: body,
    };
    if (headings.length > 0) entry.h = headings;

    index.push(entry);
  }

  fs.writeFileSync(path.join(distDir, 'search-index.json'), JSON.stringify(index));
}

module.exports = { generateSearchIndex };
