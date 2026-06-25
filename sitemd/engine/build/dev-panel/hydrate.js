// sitemd skeleton hydration — fetches shell + page content from dev server API
(function() {
  'use strict';

  var shellLoaded = false;
  var layoutScriptsLoaded = false;

  function hydrate() {
    var slug = location.pathname.replace(/\/+$/, '') || '/';
    fetchShell().then(function() {
      return loadPage(slug);
    }).then(function() {
      loadLayoutScripts();
    });
    setupNavigation();
    setupLiveReload();
  }

  function fetchShell() {
    if (shellLoaded) return Promise.resolve();
    return fetch('/__api/shell').then(function(r) { return r.json(); }).then(function(shell) {
      // First load: replace placeholder divs. Reload: replace existing header/footer.
      var shellEl = document.getElementById('sitemd-shell') || document.querySelector('.site-header');
      if (shellEl) shellEl.outerHTML = shell.header;
      var footerEl = document.getElementById('sitemd-footer') || document.querySelector('.site-footer');
      if (footerEl) footerEl.outerHTML = shell.footer;
      shellLoaded = true;
      // Auth button state must be re-applied after shell replaces the header DOM
      if (typeof window.__sitemdAuthCheck === 'function') window.__sitemdAuthCheck();
    });
  }

  function loadPage(slug, opts) {
    var preserveScroll = opts && opts.preserveScroll;
    var main = document.getElementById('sitemd-main');
    main.classList.remove('loaded');

    // Scroll to top instantly before async fetch — override CSS smooth scrolling
    if (!preserveScroll && !location.hash) {
      document.documentElement.style.scrollBehavior = 'auto';
      document.documentElement.scrollTop = 0;
      document.documentElement.style.scrollBehavior = '';
    }

    return fetch('/__api/page?slug=' + encodeURIComponent(slug)).then(function(res) {
      if (!res.ok) {
        // Try 404 page
        return fetch('/__api/page?slug=/404').then(function(r) {
          return r.ok ? r.text() : '<h1>Page not found</h1>';
        });
      }
      return res.text();
    }).then(function(html) {
      // Preserve scroll position across content swap when reloading
      var savedScroll = preserveScroll ? window.scrollY : null;
      // Wrap in article.content if not already wrapped
      var article = main.querySelector('article.content');
      if (article) {
        article.innerHTML = html;
      } else {
        main.innerHTML = '<article class="content">' + html + '</article>';
      }
      main.classList.add('loaded');
      if (savedScroll !== null) {
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, savedScroll);
        document.documentElement.style.scrollBehavior = '';
      }
      rerunScripts(main);
      initCopyButtons();
      initRotatedImages();
      // Re-init all interactive components after SPA navigation
      if (typeof initModals === 'function') initModals();
      if (typeof initLightbox === 'function') initLightbox();
      if (typeof initCarousels === 'function') initCarousels();
      if (typeof initForms === 'function') initForms();
      if (typeof initTooltips === 'function') initTooltips();

      // Update head metadata
      return fetch('/__api/meta?slug=' + encodeURIComponent(slug)).then(function(r) { return r.json(); }).then(function(meta) {
        document.title = meta.title;
        var descEl = document.querySelector('meta[name="description"]');
        if (descEl) descEl.setAttribute('content', meta.description || '');
        // Update auth attributes on main element
        if (meta.authRequired) {
          main.setAttribute('data-auth', 'required');
          if (meta.gatedTypes) {
            main.setAttribute('data-gated-types', meta.gatedTypes);
          } else {
            main.removeAttribute('data-gated-types');
          }
        } else {
          main.removeAttribute('data-auth');
          main.removeAttribute('data-gated-types');
        }
        // Update nav active state
        updateNavActive(slug);
        // Update sidebar layout
        if (meta.sidebar) {
          main.classList.add('site-main--sidebar');
          var existing = document.querySelector('.sidebar-aside');
          if (!existing) {
            var sidebarEl = document.createElement('aside');
            sidebarEl.className = 'sidebar-aside';
            sidebarEl.innerHTML = '<nav class="sidebar-nav" aria-label="Section">' + meta.sidebar + '</nav>';
            main.insertBefore(sidebarEl, main.firstChild);
          } else {
            var nav = existing.querySelector('.sidebar-nav');
            if (nav) { nav.innerHTML = meta.sidebar; } else { existing.innerHTML = '<nav class="sidebar-nav" aria-label="Section">' + meta.sidebar + '</nav>'; }
          }
          // Re-init sidebar after content replacement
          if (typeof updateMobileSidebar === 'function') updateMobileSidebar();
          if (typeof initSidebarSearch === 'function') initSidebarSearch();
          if (typeof initSidebarAnchors === 'function') initSidebarAnchors();
          if (typeof updateAnchorActive === 'function') updateAnchorActive();
          if (typeof initSidebarScroll === 'function') initSidebarScroll();
        } else {
          main.classList.remove('site-main--sidebar');
          var existing = document.querySelector('.sidebar-aside');
          if (existing) existing.remove();
          if (typeof updateMobileSidebar === 'function') updateMobileSidebar();
        }
      });
    }).then(function() {
      // Scroll to anchor if navigating to a hash link
      if (!preserveScroll && location.hash) {
        var el = document.querySelector(location.hash);
        if (el) el.scrollIntoView();
      }
      // Search highlight after SPA navigation
      if (window._searchHighlightAfterNav) {
        var q = window._searchHighlightAfterNav;
        window._searchHighlightAfterNav = null;
        if (typeof highlightInPage === 'function') highlightInPage(q);
      }
    });
  }

  function updateNavActive(slug) {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;
    nav.querySelectorAll('.nav-link').forEach(function(link) {
      var href = link.getAttribute('href');
      var isActive = href === slug || (slug !== '/' && href !== '/' && slug.startsWith(href));
      link.classList.toggle('is-active', isActive);
    });
  }

  function setupNavigation() {
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      // Allow anchor-only links (scroll, modals) to pass through
      if (href.startsWith('#')) return;
      // Skip modal triggers
      if (href === '#' && link.hasAttribute('data-modal-trigger')) return;
      // Close any open nav dropdowns and suppress hover re-open
      document.querySelectorAll('.nav-group.is-open').forEach(function(g) { g.classList.remove('is-open'); });
      var navGroup = link.closest('.nav-group');
      if (navGroup) {
        navGroup.classList.add('no-hover');
        // Blur to kill :focus-within keeping dropdown open
        if (document.activeElement) document.activeElement.blur();
        navGroup.addEventListener('mouseleave', function handler() {
          navGroup.classList.remove('no-hover');
          navGroup.removeEventListener('mouseleave', handler);
        });
      }
      e.preventDefault();
      // Same-page hash navigation — just scroll, don't re-fetch
      var targetPath = href.split('#')[0];
      var targetHash = href.indexOf('#') !== -1 ? href.slice(href.indexOf('#')) : '';
      var targetNorm = (targetPath || location.pathname).replace(/\/+$/, '') || '/';
      var curNorm = location.pathname.replace(/\/+$/, '') || '/';
      if (targetNorm === curNorm) {
        history.pushState({}, '', href);
        if (targetHash) {
          var el = document.getElementById(targetHash.slice(1));
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
        if (typeof updateAnchorActive === 'function') updateAnchorActive();
        return;
      }
      history.pushState({}, '', href);
      loadPage(targetNorm);
    });

    var _lastPopPath = location.pathname.replace(/\/+$/, '') || '/';
    window.addEventListener('popstate', function() {
      var slug = location.pathname.replace(/\/+$/, '') || '/';
      if (slug === _lastPopPath) {
        // Hash-only change — just update active anchor state
        if (typeof updateAnchorActive === 'function') updateAnchorActive();
        return;
      }
      _lastPopPath = slug;
      loadPage(slug);
    });
  }

  // Expose reload for dev panel to call — single source of truth for content refresh
  window.__sitemdReloadContent = function() {
    shellLoaded = false;
    layoutScriptsLoaded = false;
    var slug = location.pathname.replace(/\/+$/, '') || '/';
    return fetchShell().then(function() {
      return loadPage(slug, { preserveScroll: true });
    }).then(function() {
      loadLayoutScripts();
    });
  };

  function setupLiveReload() {
    // The dev panel script is loaded with `defer`, so it executes during HTML
    // parsing AFTER this (non-deferred) script — but BEFORE DOMContentLoaded
    // fires. Wait until then to decide whether to open our own SSE connection.
    // If the dev panel claimed ownership (`window.__sitemdDevPanel === true`),
    // we skip the connection entirely instead of opening a parallel one that
    // would just no-op on every reload event. This halves the SSE connection
    // count per browser tab, which matters when several tabs are open.
    function connect() {
      if (window.__sitemdDevPanel) return;
      var evtSource = new EventSource('/__reload');
      evtSource.onmessage = function(event) {
        if (event.data === 'reload') {
          window.__sitemdReloadContent();
        }
      };
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', connect);
    } else {
      connect();
    }
  }

  function rerunScripts(container) {
    container.querySelectorAll('script').forEach(function(old) {
      var s = document.createElement('script');
      if (old.src) {
        s.src = old.src;
      } else {
        s.textContent = old.textContent;
      }
      // Copy attributes
      for (var i = 0; i < old.attributes.length; i++) {
        var attr = old.attributes[i];
        if (attr.name !== 'src') s.setAttribute(attr.name, attr.value);
      }
      old.replaceWith(s);
    });
  }

  // Load layout scripts (search, lightbox, gallery, modals, embeds from layout.html)
  function loadLayoutScripts() {
    if (layoutScriptsLoaded) return;
    layoutScriptsLoaded = true;
    // Remove any existing layout script tag
    var existing = document.getElementById('sitemd-layout-scripts');
    if (existing) existing.remove();
    // Fetch and eval to ensure re-execution on reload
    fetch('/__api/layout-scripts').then(function(r) { return r.text(); }).then(function(js) {
      var s = document.createElement('script');
      s.id = 'sitemd-layout-scripts';
      s.textContent = js;
      document.body.appendChild(s);
    });
  }

  // Copy-to-clipboard on code blocks (called after page load)
  function initCopyButtons() {
    document.querySelectorAll('pre code').forEach(function(block) {
      if (block.parentNode.querySelector('.copy-btn')) return;
      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(block.textContent).then(function() {
          btn.textContent = 'Copied';
          setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
        });
      });
      block.parentNode.style.position = 'relative';
      block.parentNode.appendChild(btn);
    });
  }

  // Initialize rotated images
  function initRotatedImages() {
    document.querySelectorAll('.img-rotate').forEach(function(wrap) {
      var deg = parseInt(wrap.getAttribute('data-rotate')) || 0;
      var img = wrap.querySelector('img');
      if (!img) return;
      function apply() {
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) return;
        var maxW = img.style.maxWidth ? parseInt(img.style.maxWidth) : Infinity;
        if (w > maxW) { h = h * (maxW / w); w = maxW; }
        var swap = (deg === 90 || deg === 270);
        var boxW = swap ? h : w;
        var boxH = swap ? w : h;
        var contentW = wrap.parentElement ? wrap.parentElement.clientWidth : w;
        if (boxW > contentW) { var s = contentW / boxW; boxW = contentW; boxH *= s; w *= s; h *= s; }
        wrap.style.width = boxW + 'px';
        wrap.style.height = boxH + 'px';
        img.style.position = 'absolute';
        img.style.left = ((boxW - w) / 2) + 'px';
        img.style.top = ((boxH - h) / 2) + 'px';
        img.style.width = w + 'px';
      }
      if (img.complete) apply();
      else img.addEventListener('load', apply);
    });
  }

  hydrate();
})();
