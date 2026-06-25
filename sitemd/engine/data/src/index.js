// ---------------------------------------------------------------------------
// sitemd data — entry point
// ---------------------------------------------------------------------------
import { resolveCurrentUser, setCacheTTL, cacheKey, cacheGet, cacheSet, escHtml, getAuthToken, waitForAuth } from './filters.js';
import { createSupabaseAdapter } from './providers/supabase.js';
import { createFirebaseAdapter } from './providers/firebase.js';
import { createAirtableAdapter } from './providers/airtable.js';
import { createRestAdapter } from './providers/rest.js';
import { renderCards, renderList, renderTable, renderDetail, renderPagination, initModalDelegation } from './render.js';

(function() {
  'use strict';

  const el = document.getElementById('sitemd-data');
  if (!el) return;
  const cfg = JSON.parse(el.dataset.config);

  // Set cache TTL from config
  if (cfg.cacheTTL) setCacheTTL(cfg.cacheTTL);

  // Initialize modal click delegation
  initModalDelegation();

  // ---------------------------------------------------------------------------
  // Provider adapters — factory functions return Promise<Array<Object>>
  // ---------------------------------------------------------------------------
  const adapterFactories = {
    supabase: createSupabaseAdapter,
    firebase: createFirebaseAdapter,
    airtable: createAirtableAdapter,
    rest: createRestAdapter
  };

  const adapter = (adapterFactories[cfg.provider] || null);
  const fetchAdapter = adapter ? adapter(cfg) : null;

  // ---------------------------------------------------------------------------
  // Find source definition by name
  // ---------------------------------------------------------------------------
  function findSource(name) {
    const sources = cfg.sources || [];
    for (let i = 0; i < sources.length; i++) {
      if (sources[i].name === name) return sources[i];
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Main: hydrate all data blocks on the page
  // ---------------------------------------------------------------------------
  function hydrateAll() {
    const blocks = document.querySelectorAll('.sitemd-data');
    for (let i = 0; i < blocks.length; i++) {
      hydrateBlock(blocks[i]);
    }
    document.dispatchEvent(new CustomEvent('sitemd:data-ready'));
  }

  function hydrateBlock(container) {
    const sourceName = container.dataset.source;
    const display = container.dataset.display || 'cards';
    const blockAuth = container.dataset.auth;
    const blockFilter = container.dataset.filter || '';
    const blockSort = container.dataset.sort || '';
    const blockLimit = parseInt(container.dataset.limit, 10) || 0;
    const paginate = container.dataset.paginate === 'true';
    const param = container.dataset.param || '';
    const key = container.dataset.key || '';

    const loadingEl = container.querySelector('.sitemd-data-loading');
    const errorEl = container.querySelector('.sitemd-data-error');
    const emptyEl = container.querySelector('.sitemd-data-empty');
    const contentEl = container.querySelector('.sitemd-data-content');
    const paginationEl = container.querySelector('.sitemd-data-pagination');

    // Look up source definition
    const source = findSource(sourceName);
    if (!source) {
      showError(errorEl, loadingEl, 'Data source "' + sourceName + '" not found.');
      return;
    }

    // Merge block-level overrides with source defaults
    const mergedSource = Object.assign({}, source);

    // Check if auth is needed
    const needsAuth = blockAuth === 'required' || source.auth === 'required';

    function doFetch() {
      // Resolve currentUser references in filters
      const sourceFilter = mergedSource.filter || '';
      const combinedFilter = blockFilter || sourceFilter;
      mergedSource._resolvedFilter = resolveCurrentUser(combinedFilter);
      mergedSource._resolvedSort = blockSort || mergedSource.sort || '';
      mergedSource._resolvedLimit = blockLimit || mergedSource.limit || 0;

      // For detail display, add param-based filter
      if (display === 'detail' && param && key) {
        const urlParams = new URLSearchParams(window.location.search);
        const paramValue = urlParams.get(param);
        if (!paramValue) {
          showEmpty(emptyEl, loadingEl);
          return;
        }
        const detailFilter = key + ' = ' + paramValue;
        mergedSource._resolvedFilter = mergedSource._resolvedFilter
          ? mergedSource._resolvedFilter + ', ' + detailFilter
          : detailFilter;
        mergedSource._resolvedLimit = 1;
      }

      const token = needsAuth ? getAuthToken() : '';

      // Check cache
      const ck = cacheKey(sourceName, mergedSource._resolvedFilter + mergedSource._resolvedSort + mergedSource._resolvedLimit);
      const cached = cacheGet(ck);
      if (cached) {
        renderData(cached, container, display, contentEl, loadingEl, errorEl, emptyEl, paginationEl, paginate, blockLimit);
        return;
      }

      // Fetch from provider
      if (!fetchAdapter) {
        showError(errorEl, loadingEl, 'Unknown data provider: ' + cfg.provider);
        return;
      }

      fetchAdapter(mergedSource, token)
        .then(function(rows) {
          cacheSet(ck, rows);
          renderData(rows, container, display, contentEl, loadingEl, errorEl, emptyEl, paginationEl, paginate, blockLimit);
        })
        .catch(function(err) {
          showError(errorEl, loadingEl, cfg.errorText || 'Unable to load data.');
          console.error('[sitemd-data]', err);
        });
    }

    if (needsAuth) {
      // Hide block until auth is confirmed
      if (!getAuthToken()) {
        container.style.display = 'none';
        waitForAuth(function() {
          if (getAuthToken()) {
            container.style.display = '';
            doFetch();
          }
        });
      } else {
        doFetch();
      }
    } else {
      doFetch();
    }
  }

  function renderData(rows, container, display, contentEl, loadingEl, errorEl, emptyEl, paginationEl, paginate, blockLimit) {
    loadingEl.hidden = true;
    errorEl.hidden = true;

    if (!rows || rows.length === 0) {
      emptyEl.hidden = false;
      contentEl.innerHTML = '';
      return;
    }
    emptyEl.hidden = true;

    // Detail mode — render single record
    if (display === 'detail') {
      contentEl.innerHTML = renderDetail(rows[0], container.dataset.fields || '[]');
      return;
    }

    // Pagination setup
    const pageSize = blockLimit || rows.length;
    const totalPages = paginate ? Math.ceil(rows.length / pageSize) : 1;
    let currentPage = 1;

    const detailMode = container.dataset.detail || '';
    const detailFieldsStr = container.dataset.detailFields || '';

    function showPage(page) {
      currentPage = page;
      const start = (page - 1) * pageSize;
      const pageRows = paginate ? rows.slice(start, start + pageSize) : rows;
      let html = '';

      if (display === 'cards') {
        html = renderCards(pageRows, container.dataset.map || '{}', detailMode, detailFieldsStr);
      } else if (display === 'list') {
        html = renderList(pageRows, container.dataset.map || '{}', detailMode, detailFieldsStr);
      } else if (display === 'table') {
        html = renderTable(pageRows, container.dataset.fields || '[]', container.dataset.link || '', detailMode, detailFieldsStr);
      }

      contentEl.innerHTML = html;

      if (paginate && paginationEl) {
        renderPagination(paginationEl, currentPage, totalPages, showPage);
      }
    }

    showPage(1);
  }

  function showError(errorEl, loadingEl, message) {
    loadingEl.hidden = true;
    errorEl.hidden = false;
    errorEl.innerHTML = '<p class="data-error-text">' + escHtml(message) + '</p>' +
      '<button class="data-error-retry" onclick="location.reload()">Retry</button>';
  }

  function showEmpty(emptyEl, loadingEl) {
    loadingEl.hidden = true;
    emptyEl.hidden = false;
  }

  // ---------------------------------------------------------------------------
  // Initialize
  // ---------------------------------------------------------------------------
  (function init() {
    const hasAuthBlocks = document.querySelector('.sitemd-data[data-auth="required"]');
    if (hasAuthBlocks) {
      waitForAuth(hydrateAll);
    } else {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hydrateAll);
      } else {
        hydrateAll();
      }
    }
  })();
})();
