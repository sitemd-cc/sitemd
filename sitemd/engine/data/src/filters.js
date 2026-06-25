// ---------------------------------------------------------------------------
// Shared filter/sort/limit/pagination logic
// ---------------------------------------------------------------------------

// Supabase filter parser — converts "field = value" to PostgREST params
export function parseFilters(filterStr) {
  const parts = [];
  const segments = filterStr.split(/\s*,\s*/);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i].trim();
    let m;
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

// Resolve {{currentUser.field}} references in filters
export function resolveCurrentUser(str) {
  if (!str || str.indexOf('{{currentUser.') === -1) return str;
  const auth = window.__sitemdAuth;
  const user = auth ? auth.getUser() : null;
  if (!user) return str;
  return str.replace(/\{\{currentUser\.(\w+)\}\}/g, function(_, key) {
    return user[key] != null ? user[key] : '';
  });
}

// Template interpolation — replace {{field}} with row values
export function interpolate(template, row) {
  return template.replace(/\{\{(\w+)\}\}/g, function(_, key) {
    return row[key] != null ? row[key] : '';
  });
}

// ---------------------------------------------------------------------------
// Cache helpers — sessionStorage with TTL
// ---------------------------------------------------------------------------
let _cacheTTL = 300;

export function setCacheTTL(ttl) {
  _cacheTTL = ttl;
}

export function cacheKey(source, filter) {
  return 'sitemd-data:' + source + ':' + (filter || '');
}

export function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.ts > _cacheTTL * 1000) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch(e) { return null; }
}

export function cacheSet(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
  } catch(e) { /* quota exceeded — ignore */ }
}

// ---------------------------------------------------------------------------
// HTML/attribute escaping
// ---------------------------------------------------------------------------
export function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

export function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Link value parser — "Label: /url" or just "/url"
// ---------------------------------------------------------------------------
export function parseLinkValue(val) {
  const colonIdx = val.indexOf(':');
  // Check if the colon is part of a URL scheme (http:, https:, etc.)
  if (colonIdx !== -1 && !/^https?$/.test(val.slice(0, colonIdx).trim())) {
    return { label: val.slice(0, colonIdx).trim(), url: val.slice(colonIdx + 1).trim() };
  }
  return { label: val, url: val };
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
export function getAuthToken() {
  return localStorage.getItem('sitemd-auth-token') || '';
}

export function waitForAuth(callback) {
  if (window.__sitemdAuth) { callback(); return; }
  let checks = 0;
  const interval = setInterval(function() {
    checks++;
    if (window.__sitemdAuth || checks > 50) { // 5 seconds max
      clearInterval(interval);
      callback();
    }
  }, 100);
}
