// ---------------------------------------------------------------------------
// Analytics — generate <script> tags from settings/analytics.md
// ---------------------------------------------------------------------------
function generateAnalyticsHtml(config) {
  const parts = [];
  const provider = (config.analyticsProvider || '').toLowerCase();
  const id = config.analyticsId || '';
  const host = (config.analyticsHost || '').replace(/\/+$/, '');
  const gtm = config.gtm || '';
  const pixels = config.pixels || [];

  // Google Tag Manager — head script
  if (gtm) {
    parts.push(`<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');</script>`);
  }

  // Track whether gtag.js loader is already present (for google-ads dedup)
  let gtagLoaded = false;

  // Analytics provider
  if (provider && id) {
    switch (provider) {
      case 'google':
        parts.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`);
        parts.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`);
        gtagLoaded = true;
        break;
      case 'plausible':
        parts.push(`<script defer data-domain="${id}" src="https://plausible.io/js/script.js"></script>`);
        break;
      case 'fathom':
        parts.push(`<script src="https://cdn.usefathom.com/script.js" data-site="${id}" defer></script>`);
        break;
      case 'umami':
        parts.push(`<script defer src="${host || 'https://cloud.umami.is'}/script.js" data-website-id="${id}"></script>`);
        break;
      case 'simpleanalytics':
        parts.push(`<script async defer src="https://scripts.simpleanalyticscdn.com/latest.js"></script>`);
        break;
      case 'posthog':
        parts.push(`<script>!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onFeatureFlags".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${id}',{api_host:'${host || 'https://us.i.posthog.com'}'});</script>`);
        break;
      case 'matomo':
        parts.push(`<script>var _paq=window._paq=window._paq||[];_paq.push(['trackPageView']);_paq.push(['enableLinkTracking']);(function(){var u="${host}/";_paq.push(['setTrackerUrl',u+'matomo.php']);_paq.push(['setSiteId','${id}']);var d=document,g=d.createElement('script'),s=d.getElementsByTagName('script')[0];g.async=true;g.src=u+'matomo.js';s.parentNode.insertBefore(g,s);})();</script>`);
        break;
    }
  }

  // Ad tracking pixels
  for (const pixel of pixels) {
    const entries = Object.entries(pixel);
    if (!entries.length) continue;
    const [platform, pixelId] = entries[0];

    switch (platform) {
      case 'meta':
        parts.push(`<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');</script>`);
        break;
      case 'google-ads':
        if (gtagLoaded) {
          parts.push(`<script>gtag('config','${pixelId}');</script>`);
        } else {
          parts.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${pixelId}"></script>`);
          parts.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${pixelId}');</script>`);
          gtagLoaded = true;
        }
        break;
      case 'linkedin':
        parts.push(`<script>_linkedin_partner_id="${pixelId}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);</script><script>(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);</script>`);
        break;
      case 'tiktok':
        parts.push(`<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${pixelId}');ttq.page();}(window,document,'ttq');</script>`);
        break;
    }
  }

  if (config.customHead) {
    parts.push(config.customHead.trim());
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// GTM — generate <noscript> tag for <body>
// ---------------------------------------------------------------------------
function generateGtmBodyHtml(config) {
  const gtm = config.gtm || '';
  if (!gtm) return '';
  return `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtm}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
}

module.exports = { generateAnalyticsHtml, generateGtmBodyHtml };
