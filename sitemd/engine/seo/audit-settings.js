// ---------------------------------------------------------------------------
// SEO Audit — settings-level checks
// ---------------------------------------------------------------------------

/**
 * Audit site-level SEO settings.
 * @param {object} config - Loaded site settings
 * @returns {Array} Array of check results
 */
function auditSettings(config) {
  const checks = [];

  // URL
  const urlMissing = !config.url || config.url === 'https://example.com';
  checks.push({
    name: 'settings_url',
    severity: 'error',
    passed: !urlMissing,
    message: urlMissing ? 'Site URL is missing or still a placeholder' : `Site URL: ${config.url}`,
    why: 'Canonical URLs, sitemaps, and OG tags all need your real domain. Without it, search engines may index duplicate content or broken links.',
    fix: 'Set the url field in settings/meta.md to your production domain (e.g. https://yoursite.com)',
    category: 'meta',
  });

  // Description
  const desc = config.description || '';
  const descWeak = !desc || desc.length < 20;
  checks.push({
    name: 'settings_description',
    severity: 'warning',
    passed: !descWeak,
    message: descWeak
      ? (desc ? `Site description is only ${desc.length} characters` : 'Site description is missing')
      : `Site description: ${desc.length} chars`,
    why: 'This is the default snippet shown in search results. A compelling description directly affects your click-through rate from Google.',
    fix: 'Add a meaningful description (50-160 chars) in settings/meta.md',
    category: 'meta',
  });

  // OG Image
  const noOg = config.ogImage === 'none';
  checks.push({
    name: 'settings_og_image',
    severity: 'warning',
    passed: !noOg,
    message: noOg ? 'OG social sharing image is disabled' : `OG image: ${config.ogImage}`,
    why: 'OG images are the thumbnail shown when your link is shared on social media. Without one, platforms show a blank card that gets scrolled past.',
    fix: 'Set ogImage to "auto" (generates branded cards) or a custom image path in settings/seo.md',
    category: 'social',
  });

  // Favicon
  const letterFavicon = !config.customFavicon && (!config.favicon || config.favicon === 'letter');
  checks.push({
    name: 'settings_favicon',
    severity: 'info',
    passed: !letterFavicon,
    message: letterFavicon ? 'Using auto-generated letter favicon' : 'Custom favicon configured',
    why: 'A custom favicon makes your site recognizable in browser tabs, bookmarks, and mobile home screens. Letter mode works but looks generic.',
    fix: 'Set favicon to "brand" (uses your brandImage) or "custom" with a customFavicon path in settings/meta.md',
    category: 'meta',
  });

  // Structured Data
  checks.push({
    name: 'settings_structured_data',
    severity: 'warning',
    passed: config.structuredData !== false,
    message: config.structuredData === false ? 'Structured data (JSON-LD) is disabled' : 'Structured data enabled',
    why: 'Structured data (JSON-LD) helps search engines understand your content and can unlock rich results like FAQ dropdowns, how-to steps, and article cards in search results.',
    fix: 'Set structuredData: true in settings/seo.md',
    category: 'technical',
  });

  // Language (always passes — informational)
  checks.push({
    name: 'settings_language',
    severity: 'info',
    passed: true,
    message: `Language: ${config.language || 'en'}`,
    why: 'The language tag helps search engines serve your content to the right audience.',
    fix: null,
    category: 'meta',
  });

  // IndexNow
  checks.push({
    name: 'settings_index_now',
    severity: 'info',
    passed: config.indexNow !== false,
    message: config.indexNow === false ? 'IndexNow is disabled' : 'IndexNow enabled',
    why: 'IndexNow notifies Bing, Yandex, and others immediately when you publish. Without it, search engines may take days to discover your updates.',
    fix: 'Set indexNow: true in settings/seo.md',
    category: 'technical',
  });

  // Default author
  checks.push({
    name: 'settings_default_author',
    severity: 'info',
    passed: !!config.defaultAuthor,
    message: config.defaultAuthor ? `Default author: ${config.defaultAuthor}` : 'No default author configured',
    why: 'Blog and article pages include author attribution in their schema. Without a default author, your content appears authorless to search engines, weakening E-E-A-T signals.',
    fix: 'Uncomment and set defaultAuthor in settings/seo.md',
    category: 'social',
  });

  // Twitter handle
  checks.push({
    name: 'settings_twitter_handle',
    severity: 'info',
    passed: !!config.twitterHandle,
    message: config.twitterHandle ? `Twitter: @${config.twitterHandle}` : 'No Twitter/X handle configured',
    why: 'The twitter:site tag attributes shared content to your account. Without it, shares on X/Twitter won\'t link back to your profile.',
    fix: 'Uncomment and set twitterHandle (without @) in settings/seo.md',
    category: 'social',
  });

  // Org identity
  const hasOrg = !!(config.orgName && config.orgLogo);
  const orgRelevant = config.structuredData !== false;
  checks.push({
    name: 'settings_org_identity',
    severity: 'info',
    passed: hasOrg || !orgRelevant,
    message: hasOrg ? `Organization: ${config.orgName}` : (orgRelevant ? 'Organization name/logo not configured' : 'Structured data off — org schema not applicable'),
    why: 'Organization schema on your homepage tells search engines who you are. orgName and orgLogo are auto-derived from brandName and brandImage — override in settings/seo.md if your legal org name differs from your brand.',
    fix: 'To customize, uncomment and set orgName and orgLogo in settings/seo.md',
    category: 'social',
  });

  // llms.txt
  checks.push({
    name: 'settings_llms_txt',
    severity: 'info',
    passed: config.llmsTxt !== false,
    message: config.llmsTxt === false ? 'llms.txt generation is disabled' : 'llms.txt enabled',
    why: 'llms.txt is a standard for AI model discovery. Disabling it means AI tools like ChatGPT and Claude can\'t index your content for recommendations and citations.',
    fix: 'Set llmsTxt: true in settings/seo.md',
    category: 'technical',
  });

  // Markdown output
  checks.push({
    name: 'settings_markdown_output',
    severity: 'info',
    passed: config.markdownOutput !== false,
    message: config.markdownOutput === false ? 'Markdown output is disabled' : 'Markdown output enabled',
    why: 'Markdown output publishes .md versions of every page. AI tools and LLMs prefer structured text over HTML — this makes your content more accessible to AI-powered search.',
    fix: 'Set markdownOutput: true in settings/seo.md',
    category: 'technical',
  });

  // AI crawlers
  checks.push({
    name: 'settings_ai_crawlers',
    severity: 'info',
    passed: config.allowAICrawlers !== false,
    message: config.allowAICrawlers === false ? 'AI crawlers are blocked via robots.txt' : 'AI crawlers allowed',
    why: 'Blocking AI crawlers via robots.txt prevents your content from appearing in AI-powered answers, summaries, and recommendations — increasingly where users discover content.',
    fix: 'Set allowAICrawlers: true in settings/seo.md',
    category: 'technical',
  });

  return checks;
}

module.exports = { auditSettings };
