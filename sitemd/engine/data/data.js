(function() {
  'use strict';

  var el = document.getElementById('sitemd-data');
  if (!el) return;
  var cfg = JSON.parse(el.dataset.config);

  // ---------------------------------------------------------------------------
  // Provider adapters — each returns Promise<Array<Object>>
  // ---------------------------------------------------------------------------
  var adapters = {
    supabase: function(source, token) {
      var url = cfg.supabaseUrl + '/rest/v1/' + encodeURIComponent(source.table || source.name);
      var params = [];
      if (source.select) params.push('select=' + encodeURIComponent(source.select));
      if (source._resolvedFilter) {
        var filters = parseFilters(source._resolvedFilter);
        for (var i = 0; i < filters.length; i++) params.push(filters[i]);
      }
      if (source._resolvedSort) {
        params.push('order=' + encodeURIComponent(source._resolvedSort.replace(/\s+/g, '.')));
      }
      if (source._resolvedLimit) params.push('limit=' + source._resolvedLimit);

      var headers = { 'apikey': cfg.supabaseAnonKey, 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      return fetch(url + (params.length ? '?' + params.join('&') : ''), { headers: headers })
        .then(function(r) { if (!r.ok) throw new Error(r.statusText); return r.json(); });
    },

    firebase: function(source, token) {
      var projectId = cfg.firebaseProjectId;
      var collection = source.table || source.name;
      var url = 'https://firestore.googleapis.com/v1/projects/' + projectId +
        '/databases/(default)/documents/' + encodeURIComponent(collection);

      var params = [];
      if (source._resolvedLimit) params.push('pageSize=' + source._resolvedLimit);

      var headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;
      if (cfg.firebaseApiKey) params.push('key=' + encodeURIComponent(cfg.firebaseApiKey));

      return fetch(url + (params.length ? '?' + params.join('&') : ''), { headers: headers })
        .then(function(r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(function(data) {
          if (!data.documents) return [];
          return data.documents.map(function(doc) {
            var obj = {};
            var fields = doc.fields || {};
            for (var k in fields) {
              var f = fields[k];
              obj[k] = f.stringValue || f.integerValue || f.doubleValue ||
                f.booleanValue || f.timestampValue || f.arrayValue || '';
            }
            // Extract document ID from name
            var parts = doc.name.split('/');
            obj._id = parts[parts.length - 1];
            return obj;
          });
        });
    },

    airtable: function(source, token) {
      var baseId = cfg.airtableBaseId;
      var table = source.table || source.name;
      var url = 'https://api.airtable.com/v0/' + encodeURIComponent(baseId) + '/' + encodeURIComponent(table);

      var params = [];
      if (source._resolvedFilter) {
        params.push('filterByFormula=' + encodeURIComponent(source._resolvedFilter));
      }
      if (source._resolvedSort) {
        var sortParts = source._resolvedSort.split(/\s+/);
        var sortField = sortParts[0];
        var sortDir = (sortParts[1] || 'asc').toLowerCase();
        params.push('sort[0][field]=' + encodeURIComponent(sortField));
        params.push('sort[0][direction]=' + encodeURIComponent(sortDir));
      }
      if (source._resolvedLimit) params.push('maxRecords=' + source._resolvedLimit);
      if (source.select) {
        var fields = source.select.split(',').map(function(s) { return s.trim(); });
        for (var i = 0; i < fields.length; i++) {
          params.push('fields[]=' + encodeURIComponent(fields[i]));
        }
      }

      var airtableToken = cfg.airtableToken;
      var headers = { 'Authorization': 'Bearer ' + airtableToken };

      return fetch(url + (params.length ? '?' + params.join('&') : ''), { headers: headers })
        .then(function(r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(function(data) {
          if (!data.records) return [];
          return data.records.map(function(rec) {
            var obj = Object.assign({}, rec.fields);
            obj._id = rec.id;
            return obj;
          });
        });
    },

    rest: function(source, token) {
      var baseUrl = (cfg.restBaseUrl || '').replace(/\/+$/, '');
      var endpoint = source.table || source.name;
      var url = baseUrl + '/' + endpoint;

      var params = [];
      if (source._resolvedFilter) params.push('filter=' + encodeURIComponent(source._resolvedFilter));
      if (source._resolvedSort) params.push('sort=' + encodeURIComponent(source._resolvedSort));
      if (source._resolvedLimit) params.push('limit=' + source._resolvedLimit);

      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      // Parse custom headers from config
      if (cfg.restHeaders) {
        try {
          var custom = JSON.parse(cfg.restHeaders);
          for (var k in custom) headers[k] = custom[k];
        } catch(e) { /* ignore */ }
      }

      return fetch(url + (params.length ? '?' + params.join('&') : ''), { headers: headers })
        .then(function(r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .then(function(data) {
          // Support nested response: try data.data, data.items, data.results, or plain array
          if (Array.isArray(data)) return data;
          if (data.data && Array.isArray(data.data)) return data.data;
          if (data.items && Array.isArray(data.items)) return data.items;
          if (data.results && Array.isArray(data.results)) return data.results;
          return [];
        });
    }
  };

  // ---------------------------------------------------------------------------
  // Supabase filter parser — converts "field = value" to PostgREST params
  // ---------------------------------------------------------------------------
  function parseFilters(filterStr) {
    var parts = [];
    var segments = filterStr.split(/\s*,\s*/);
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i].trim();
      var m;
      if ((m = seg.match(/^(\w+)\s*!=\s*(.+)$/))) {
        parts.push(m[1] + '=neq.' + m[2].trim());
      } else if ((m = seg.match(/^(\w+)\s*>=\s*(.+)$/))) {
        parts.push(m[1] + '=gte.' + m[2].trim());
      } else if ((m = seg.match(/^(\w+)\s*<=\s*(.+)$/))) {
        parts.push(m[1] + '=lte.' + m[2].trim());
      } else if ((m = seg.match(/^(\w+)\s*>\s*(.+)$/))) {
        parts.push(m[1] + '=gt.' + m[2].trim());
      } else if ((m = seg.match(/^(\w+)\s*<\s*(.+)$/))) {
        parts.push(m[1] + '=lt.' + m[2].trim());
      } else if ((m = seg.match(/^(\w+)\s*=\s*(.+)$/))) {
        parts.push(m[1] + '=eq.' + m[2].trim());
      }
    }
    return parts;
  }

  // ---------------------------------------------------------------------------
  // Template interpolation — replace {{field}} with row values
  // ---------------------------------------------------------------------------
  function interpolate(template, row) {
    return template.replace(/\{\{(\w+)\}\}/g, function(_, key) {
      return row[key] != null ? row[key] : '';
    });
  }

  // ---------------------------------------------------------------------------
  // Cache helpers — sessionStorage with TTL
  // ---------------------------------------------------------------------------
  function cacheKey(source, filter) {
    return 'sitemd-data:' + source + ':' + (filter || '');
  }

  function cacheGet(key) {
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (Date.now() - entry.ts > (cfg.cacheTTL || 300) * 1000) {
        sessionStorage.removeItem(key);
        return null;
      }
      return entry.data;
    } catch(e) { return null; }
  }

  function cacheSet(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
    } catch(e) { /* quota exceeded — ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Display renderers
  // ---------------------------------------------------------------------------
  function renderCards(rows, mapStr, detailMode, detailFieldsStr) {
    var map;
    try { map = JSON.parse(mapStr); } catch(e) { return ''; }
    var useModal = detailMode === 'modal' && detailFieldsStr;

    var html = '<div class="card-grid">';
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      html += '<div class="card">';
      if (map.image) {
        var imgSrc = interpolate(map.image, row);
        var imgAlt = map.title ? interpolate(map.title, row) : '';
        if (imgSrc) html += '<img src="' + escAttr(imgSrc) + '" alt="' + escAttr(imgAlt) + '" loading="lazy" class="card-image">';
      }
      html += '<div class="card-body">';
      if (map.title) html += '<h3 class="card-title">' + escHtml(interpolate(map.title, row)) + '</h3>';
      if (map.text) html += '<p class="card-text">' + escHtml(interpolate(map.text, row)) + '</p>';
      if (map.link) {
        var linkVal = interpolate(map.link, row);
        var linkParts = parseLinkValue(linkVal);
        if (useModal) {
          html += '<span class="card-link">' + makeModalLink(linkParts.label + ' \u2192', row, detailFieldsStr) + '</span>';
        } else {
          html += '<a href="' + escAttr(linkParts.url) + '" class="card-link">' + escHtml(linkParts.label) + ' &rarr;</a>';
        }
      }
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function renderList(rows, mapStr, detailMode, detailFieldsStr) {
    var map;
    try { map = JSON.parse(mapStr); } catch(e) { return ''; }
    var useModal = detailMode === 'modal' && detailFieldsStr;

    var html = '<ul class="sitemd-data-list">';
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      html += '<li class="data-list-item">';
      if (map.image) {
        var imgSrc = interpolate(map.image, row);
        if (imgSrc) html += '<img src="' + escAttr(imgSrc) + '" alt="" loading="lazy" class="data-list-thumb">';
      }
      html += '<div class="data-list-body">';
      if (map.title) {
        var titleText = escHtml(interpolate(map.title, row));
        if (useModal) {
          html += '<span class="data-list-title">' + makeModalLink(titleText, row, detailFieldsStr) + '</span>';
        } else if (map.link) {
          var linkVal = interpolate(map.link, row);
          var linkParts = parseLinkValue(linkVal);
          html += '<a href="' + escAttr(linkParts.url) + '" class="data-list-title">' + titleText + '</a>';
        } else {
          html += '<span class="data-list-title">' + titleText + '</span>';
        }
      }
      if (map.text) html += '<p class="data-list-text">' + escHtml(interpolate(map.text, row)) + '</p>';
      html += '</div></li>';
    }
    html += '</ul>';
    return html;
  }

  function renderTable(rows, fieldsStr, linkStr, detailMode, detailFieldsStr) {
    var fields;
    try { fields = JSON.parse(fieldsStr); } catch(e) { return ''; }
    var useModal = detailMode === 'modal' && detailFieldsStr;

    var html = '<div class="sitemd-data-table-wrap"><table class="sitemd-data-table"><thead><tr>';
    for (var i = 0; i < fields.length; i++) {
      html += '<th>' + escHtml(fields[i].label) + '</th>';
    }
    if (linkStr) html += '<th></th>';
    html += '</tr></thead><tbody>';

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      html += '<tr>';
      for (var c = 0; c < fields.length; c++) {
        html += '<td>' + escHtml(interpolate(fields[c].template, row)) + '</td>';
      }
      if (linkStr) {
        var linkVal = interpolate(linkStr, row);
        var linkParts = parseLinkValue(linkVal);
        if (useModal) {
          html += '<td>' + makeModalLink(linkParts.label, row, detailFieldsStr) + '</td>';
        } else {
          html += '<td><a href="' + escAttr(linkParts.url) + '" class="data-table-link">' + escHtml(linkParts.label) + '</a></td>';
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function renderDetail(row, fieldsStr) {
    var fields;
    try { fields = JSON.parse(fieldsStr); } catch(e) { return ''; }

    var html = '<dl class="sitemd-data-detail">';
    for (var i = 0; i < fields.length; i++) {
      html += '<div class="data-detail-row">';
      html += '<dt class="data-detail-label">' + escHtml(fields[i].label) + '</dt>';
      html += '<dd class="data-detail-value">' + escHtml(interpolate(fields[i].template, row)) + '</dd>';
      html += '</div>';
    }
    html += '</dl>';
    return html;
  }

  // ---------------------------------------------------------------------------
  // Pagination renderer
  // ---------------------------------------------------------------------------
  function renderPagination(paginationEl, currentPage, totalPages, onPageChange) {
    if (totalPages <= 1) { paginationEl.hidden = true; return; }
    paginationEl.hidden = false;
    var html = '<div class="data-pagination-controls">';
    html += '<button class="data-page-btn data-page-prev"' + (currentPage <= 1 ? ' disabled' : '') + '>&laquo; Prev</button>';
    html += '<span class="data-page-info">Page ' + currentPage + ' of ' + totalPages + '</span>';
    html += '<button class="data-page-btn data-page-next"' + (currentPage >= totalPages ? ' disabled' : '') + '>Next &raquo;</button>';
    html += '</div>';
    paginationEl.innerHTML = html;

    var prev = paginationEl.querySelector('.data-page-prev');
    var next = paginationEl.querySelector('.data-page-next');
    if (prev) prev.addEventListener('click', function() { if (currentPage > 1) onPageChange(currentPage - 1); });
    if (next) next.addEventListener('click', function() { if (currentPage < totalPages) onPageChange(currentPage + 1); });
  }

  // ---------------------------------------------------------------------------
  // Modal detail — create and open a modal with record detail view
  // ---------------------------------------------------------------------------
  var _modalId = 0;

  function openDetailModal(row, detailFieldsStr) {
    var fields;
    try { fields = JSON.parse(detailFieldsStr); } catch(e) { return; }

    // Build detail HTML
    var bodyHtml = '<dl class="sitemd-data-detail">';
    for (var i = 0; i < fields.length; i++) {
      bodyHtml += '<div class="data-detail-row">';
      bodyHtml += '<dt class="data-detail-label">' + escHtml(fields[i].label) + '</dt>';
      bodyHtml += '<dd class="data-detail-value">' + escHtml(interpolate(fields[i].template, row)) + '</dd>';
      bodyHtml += '</div>';
    }
    bodyHtml += '</dl>';

    // Reuse or create the data detail modal
    var modalId = 'sitemd-data-detail-modal';
    var overlay = document.querySelector('[data-modal-id="' + modalId + '"]');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.setAttribute('data-modal-id', modalId);
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.hidden = true;
      overlay.innerHTML =
        '<div class="modal-wrap">' +
        '<button class="modal-close" type="button" aria-label="Close">&times;</button>' +
        '<div class="modal-dialog"><div class="modal-body content"></div></div>' +
        '</div>';
      document.body.appendChild(overlay);

      // Close handlers
      overlay.querySelector('.modal-close').addEventListener('click', function() {
        overlay.hidden = true;
        document.body.style.overflow = '';
      });
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
          overlay.hidden = true;
          document.body.style.overflow = '';
        }
      });
    }

    // Set content and open
    overlay.querySelector('.modal-body').innerHTML = bodyHtml;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    overlay.querySelector('.modal-close').focus();
  }

  function makeModalLink(label, row, detailFieldsStr) {
    // Serialize row data into a data attribute for the click handler
    var id = 'data-modal-row-' + (++_modalId);
    // Store row data on window for retrieval
    window['__sitemdRow_' + id] = { row: row, fields: detailFieldsStr };
    return '<a href="#" class="data-detail-trigger" data-row-id="' + id + '">' + escHtml(label) + '</a>';
  }

  // Delegate click handler for modal detail triggers
  document.addEventListener('click', function(e) {
    var trigger = e.target.closest('.data-detail-trigger');
    if (!trigger) return;
    e.preventDefault();
    var rowId = trigger.dataset.rowId;
    var stored = window['__sitemdRow_' + rowId];
    if (stored) openDetailModal(stored.row, stored.fields);
  });

  // ---------------------------------------------------------------------------
  // Link value parser — "Label: /url" or just "/url"
  // ---------------------------------------------------------------------------
  function parseLinkValue(val) {
    var colonIdx = val.indexOf(':');
    // Check if the colon is part of a URL scheme (http:, https:, etc.)
    if (colonIdx !== -1 && !/^https?$/.test(val.slice(0, colonIdx).trim())) {
      return { label: val.slice(0, colonIdx).trim(), url: val.slice(colonIdx + 1).trim() };
    }
    return { label: val, url: val };
  }

  // ---------------------------------------------------------------------------
  // HTML/attribute escaping
  // ---------------------------------------------------------------------------
  function escHtml(s) {
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }
  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------------------------------------------------------------------------
  // Resolve currentUser references in filters
  // ---------------------------------------------------------------------------
  function resolveCurrentUser(str) {
    if (!str || str.indexOf('{{currentUser.') === -1) return str;
    var auth = window.__sitemdAuth;
    var user = auth ? auth.getUser() : null;
    if (!user) return str;
    return str.replace(/\{\{currentUser\.(\w+)\}\}/g, function(_, key) {
      return user[key] != null ? user[key] : '';
    });
  }

  // ---------------------------------------------------------------------------
  // Get auth token if available
  // ---------------------------------------------------------------------------
  function getAuthToken() {
    return localStorage.getItem('sitemd-auth-token') || '';
  }

  // ---------------------------------------------------------------------------
  // Wait for auth to be ready (if auth.js is present)
  // ---------------------------------------------------------------------------
  function waitForAuth(callback) {
    if (window.__sitemdAuth) { callback(); return; }
    var checks = 0;
    var interval = setInterval(function() {
      checks++;
      if (window.__sitemdAuth || checks > 50) { // 5 seconds max
        clearInterval(interval);
        callback();
      }
    }, 100);
  }

  // ---------------------------------------------------------------------------
  // Find source definition by name
  // ---------------------------------------------------------------------------
  function findSource(name) {
    var sources = cfg.sources || [];
    for (var i = 0; i < sources.length; i++) {
      if (sources[i].name === name) return sources[i];
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Main: hydrate all data blocks on the page
  // ---------------------------------------------------------------------------
  function hydrateAll() {
    var blocks = document.querySelectorAll('.sitemd-data');
    for (var i = 0; i < blocks.length; i++) {
      hydrateBlock(blocks[i]);
    }
    document.dispatchEvent(new CustomEvent('sitemd:data-ready'));
  }

  function hydrateBlock(container) {
    var sourceName = container.dataset.source;
    var display = container.dataset.display || 'cards';
    var blockAuth = container.dataset.auth;
    var blockFilter = container.dataset.filter || '';
    var blockSort = container.dataset.sort || '';
    var blockLimit = parseInt(container.dataset.limit, 10) || 0;
    var paginate = container.dataset.paginate === 'true';
    var param = container.dataset.param || '';
    var key = container.dataset.key || '';

    var loadingEl = container.querySelector('.sitemd-data-loading');
    var errorEl = container.querySelector('.sitemd-data-error');
    var emptyEl = container.querySelector('.sitemd-data-empty');
    var contentEl = container.querySelector('.sitemd-data-content');
    var paginationEl = container.querySelector('.sitemd-data-pagination');

    // Look up source definition
    var source = findSource(sourceName);
    if (!source) {
      showError(errorEl, loadingEl, 'Data source "' + sourceName + '" not found.');
      return;
    }

    // Merge block-level overrides with source defaults
    var mergedSource = Object.assign({}, source);

    // Check if auth is needed
    var needsAuth = blockAuth === 'required' || source.auth === 'required';

    function doFetch() {
      // Resolve currentUser references in filters
      var sourceFilter = mergedSource.filter || '';
      var combinedFilter = blockFilter || sourceFilter;
      mergedSource._resolvedFilter = resolveCurrentUser(combinedFilter);
      mergedSource._resolvedSort = blockSort || mergedSource.sort || '';
      mergedSource._resolvedLimit = blockLimit || mergedSource.limit || 0;

      // For detail display, add param-based filter
      if (display === 'detail' && param && key) {
        var urlParams = new URLSearchParams(window.location.search);
        var paramValue = urlParams.get(param);
        if (!paramValue) {
          showEmpty(emptyEl, loadingEl);
          return;
        }
        var detailFilter = key + ' = ' + paramValue;
        mergedSource._resolvedFilter = mergedSource._resolvedFilter
          ? mergedSource._resolvedFilter + ', ' + detailFilter
          : detailFilter;
        mergedSource._resolvedLimit = 1;
      }

      var token = needsAuth ? getAuthToken() : '';

      // Check cache
      var ck = cacheKey(sourceName, mergedSource._resolvedFilter + mergedSource._resolvedSort + mergedSource._resolvedLimit);
      var cached = cacheGet(ck);
      if (cached) {
        renderData(cached, container, display, contentEl, loadingEl, errorEl, emptyEl, paginationEl, paginate, blockLimit);
        return;
      }

      // Fetch from provider
      var adapter = adapters[cfg.provider];
      if (!adapter) {
        showError(errorEl, loadingEl, 'Unknown data provider: ' + cfg.provider);
        return;
      }

      adapter(mergedSource, token)
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
    var pageSize = blockLimit || rows.length;
    var totalPages = paginate ? Math.ceil(rows.length / pageSize) : 1;
    var currentPage = 1;

    var detailMode = container.dataset.detail || '';
    var detailFieldsStr = container.dataset.detailFields || '';

    function showPage(page) {
      currentPage = page;
      var start = (page - 1) * pageSize;
      var pageRows = paginate ? rows.slice(start, start + pageSize) : rows;
      var html = '';

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
  // License check — three-tier: certificate → revocation → grace period
  // ---------------------------------------------------------------------------
  var PUBLIC_KEY_HEX = 'c334b7e48dad4475577287c95da8c45bfd9e105f537db1b94cde09874bce1bb5';
  var GRACE_KEY = 'sitemd-license-grace-data';
  var GRACE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  function hexToBytes(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  function verifyEd25519(payloadB64, sigB64) {
    if (!window.crypto || !window.crypto.subtle) return Promise.resolve(null);
    try {
      var pubKeyBytes = hexToBytes(PUBLIC_KEY_HEX);
      return crypto.subtle.importKey('raw', pubKeyBytes, { name: 'Ed25519' }, false, ['verify'])
        .then(function(key) {
          var msg = new TextEncoder().encode(atob(payloadB64));
          var sig = Uint8Array.from(atob(sigB64), function(c) { return c.charCodeAt(0); });
          return crypto.subtle.verify('Ed25519', key, sig, msg);
        })
        .catch(function() { return null; });
    } catch(e) {
      return Promise.resolve(null);
    }
  }

  function verifyCertificate(cert, hostname) {
    if (!cert) return Promise.resolve({ valid: false, reason: 'no-cert' });
    try {
      var parts = cert.split('.');
      if (parts.length !== 2) return Promise.resolve({ valid: false, reason: 'bad-format' });
      var payload = JSON.parse(atob(parts[0]));
      if (payload.domain !== hostname) return Promise.resolve({ valid: false, reason: 'domain-mismatch' });
      if (new Date(payload.expiresAt) < new Date()) return Promise.resolve({ valid: false, reason: 'expired' });
      return verifyEd25519(parts[0], parts[1]).then(function(sigValid) {
        if (sigValid === false) return { valid: false, reason: 'bad-signature' };
        return { valid: true, cert: payload };
      });
    } catch(e) {
      return Promise.resolve({ valid: false, reason: 'parse-error' });
    }
  }

  function checkRevocation(hostname) {
    var opts = { method: 'GET' };
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(3000);
    return fetch('https://api.sitemd.cc/license?domain=' + encodeURIComponent(hostname), opts)
      .then(function(r) {
        if (r.ok) {
          try { localStorage.setItem(GRACE_KEY, String(Date.now())); } catch(e) {}
          return true;
        }
        try { localStorage.removeItem(GRACE_KEY); } catch(e) {}
        return false;
      })
      .catch(function() {
        try {
          var last = parseInt(localStorage.getItem(GRACE_KEY), 10);
          if (last && (Date.now() - last) < GRACE_TTL) return true;
        } catch(e) {}
        return false;
      });
  }

  function checkLicense(hostname) {
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return Promise.resolve(true);
    var cert = (cfg && cfg.certificate) || '';
    return verifyCertificate(cert, hostname).then(function(result) {
      if (!result.valid) return false;
      return checkRevocation(hostname);
    });
  }

  // ---------------------------------------------------------------------------
  // Initialize
  // ---------------------------------------------------------------------------
  checkLicense(window.location.hostname).then(function(licensed) {
    if (!licensed) {
      document.dispatchEvent(new CustomEvent('sitemd:data-failed', { detail: { reason: 'license' } }));
      return;
    }
    var hasAuthBlocks = document.querySelector('.sitemd-data[data-auth="required"]');
    if (hasAuthBlocks) {
      waitForAuth(hydrateAll);
    } else {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hydrateAll);
      } else {
        hydrateAll();
      }
    }
  });
})();
