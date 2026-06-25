// ---------------------------------------------------------------------------
// API fetch helper (used by custom adapter + public API methods)
// ---------------------------------------------------------------------------
import { getToken, clearSession } from './session.js';

let _cfg = null;

export function setApiConfig(cfg) { _cfg = cfg; }

export function showConfigError(msg) {
  if (document.getElementById('sitemd-config-error')) return;
  const banner = document.createElement('div');
  banner.id = 'sitemd-config-error';
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#fef2f2;border-top:2px solid #dc2626;color:#991b1b;padding:12px 16px;font:14px/1.5 system-ui,sans-serif;z-index:99999;text-align:center';
  banner.innerHTML = msg;
  document.body.appendChild(banner);
}

export function apiFetch(method, path, body) {
  if (!_cfg.apiUrl && location.hostname === 'localhost') {
    const msg = '<strong>Auth API URL not configured.</strong> Run: <code style="background:#fee2e2;padding:2px 6px;border-radius:3px">sitemd config set auth.apiUrl &lt;your-api-url&gt;</code> then restart the dev server.';
    showConfigError(msg);
    return Promise.reject(new Error('Auth API URL not configured. Run: sitemd config set auth.apiUrl <url>'));
  }
  const url = _cfg.apiUrl + path;
  const opts = {
    method: method,
    headers: { 'Content-Type': 'application/json' }
  };
  const token = getToken();
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(function(r) {
    if (r.status === 401) {
      clearSession();
      window.location.href = _cfg.loginPage || '/login';
      return Promise.reject(new Error('Session expired'));
    }
    if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || 'Request failed'); });
    if (r.status === 204) return {};
    return r.json();
  });
}
