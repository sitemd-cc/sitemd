const fs = require('fs');

// ---------------------------------------------------------------------------
// JSON-LD structured data generation
// ---------------------------------------------------------------------------

function buildJsonLd(seoData, config) {
  const graph = [];

  // BreadcrumbList — every page gets one
  graph.push(buildBreadcrumbs(seoData, config));

  // Page-type-specific schema
  switch (seoData.schemaType) {
    case 'BlogPosting':
    case 'Article':
      graph.push(buildArticle(seoData, config));
      break;
    case 'TechArticle':
      graph.push(buildTechArticle(seoData, config));
      break;
    case 'WebSite':
      graph.push(buildWebSite(config));
      if (config.orgName) graph.push(buildOrganization(config));
      break;
    case 'FAQPage':
      graph.push(buildFAQPage(seoData, config));
      break;
    case 'HowTo':
      graph.push(buildHowTo(seoData, config));
      break;
    case 'SoftwareApplication':
      graph.push(buildSoftwareApplication(seoData, config));
      break;
    case 'ProfilePage':
      graph.push(buildProfilePage(seoData, config));
      break;
    default:
      graph.push(buildWebPage(seoData, config));
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

function buildBreadcrumbs(seoData, config) {
  const items = [];
  items.push({
    '@type': 'ListItem',
    position: 1,
    name: 'Home',
    item: config.url + '/',
  });

  if (seoData.slug !== '/') {
    const parts = seoData.slug.replace(/^\//, '').split('/');
    let accumulated = '';
    for (let i = 0; i < parts.length; i++) {
      accumulated += '/' + parts[i];
      const name = parts[i].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      items.push({
        '@type': 'ListItem',
        position: i + 2,
        name: i === parts.length - 1 ? seoData.title : name,
        item: config.url + accumulated,
      });
    }
  }

  return {
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

function buildWebPage(seoData, config) {
  const page = {
    '@type': 'WebPage',
    name: seoData.title,
    description: seoData.description,
    url: seoData.canonical,
  };
  if (seoData.updated) page.dateModified = seoData.updated;
  return page;
}

function buildArticle(seoData, config) {
  const article = {
    '@type': seoData.schemaType,
    headline: seoData.title,
    description: seoData.description,
    url: seoData.canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': seoData.canonical },
  };
  if (seoData.author) {
    article.author = { '@type': 'Person', name: seoData.author };
  }
  if (seoData.published) article.datePublished = seoData.published;
  if (seoData.updated) article.dateModified = seoData.updated;
  if (seoData.image) article.image = seoData.image;
  if (config.orgName) {
    article.publisher = { '@type': 'Organization', name: config.orgName };
    if (config.orgLogo) {
      article.publisher.logo = { '@type': 'ImageObject', url: absolute(config.orgLogo, config) };
    }
  }
  return article;
}

function buildTechArticle(seoData, config) {
  const article = {
    '@type': 'TechArticle',
    headline: seoData.title,
    description: seoData.description,
    url: seoData.canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': seoData.canonical },
  };
  if (seoData.author) {
    article.author = { '@type': 'Person', name: seoData.author };
  }
  if (seoData.updated) article.dateModified = seoData.updated;
  if (seoData.image) article.image = seoData.image;
  return article;
}

function buildWebSite(config) {
  return {
    '@type': 'WebSite',
    name: config.title,
    url: config.url + '/',
  };
}

function buildOrganization(config) {
  const org = {
    '@type': 'Organization',
    name: config.orgName,
    url: config.url + '/',
  };
  if (config.orgLogo) {
    org.logo = { '@type': 'ImageObject', url: absolute(config.orgLogo, config) };
  }
  return org;
}

function buildFAQPage(seoData, config) {
  const page = {
    '@type': 'FAQPage',
    name: seoData.title,
    url: seoData.canonical,
    mainEntity: (seoData.faqItems || []).map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
  if (seoData.description) page.description = seoData.description;
  return page;
}

function buildHowTo(seoData, config) {
  const howTo = {
    '@type': 'HowTo',
    name: seoData.title,
    description: seoData.description,
    url: seoData.canonical,
  };
  if (seoData.howToSteps && seoData.howToSteps.length) {
    howTo.step = seoData.howToSteps.map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text,
    }));
  }
  if (seoData.image) howTo.image = seoData.image;
  return howTo;
}

function buildSoftwareApplication(seoData, config) {
  const app = {
    '@type': 'SoftwareApplication',
    name: seoData.appName || seoData.title,
    description: seoData.description,
    url: seoData.canonical,
  };
  if (seoData.appCategory) app.applicationCategory = seoData.appCategory;
  if (seoData.appOS) app.operatingSystem = seoData.appOS;
  if (seoData.image) app.image = seoData.image;
  if (config.orgName) {
    app.author = { '@type': 'Organization', name: config.orgName };
  }
  return app;
}

function buildProfilePage(seoData, config) {
  const person = {
    '@type': 'Person',
    name: seoData.title,
    url: seoData.canonical,
  };
  if (seoData.description) person.description = seoData.description;
  if (seoData.image) person.image = seoData.image;
  if (seoData.author && seoData.author !== seoData.title) {
    person.name = seoData.author;
  }

  return {
    '@type': 'ProfilePage',
    mainEntity: person,
    url: seoData.canonical,
  };
}

function absolute(urlOrPath, config) {
  if (urlOrPath.startsWith('http')) return urlOrPath;
  return config.url + (urlOrPath.startsWith('/') ? '' : '/') + urlOrPath;
}

module.exports = { buildJsonLd };
