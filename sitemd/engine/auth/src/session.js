// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
const TOKEN_KEY = 'sitemd-auth-token';
const USER_KEY = 'sitemd-auth-user';
export const USERDATA_KEY = 'sitemd-auth-userdata';
export const USERDATA_TS_KEY = 'sitemd-auth-userdata-ts';
export const USERDATA_TTL = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------
let listeners = [];

export function getToken() { return localStorage.getItem(TOKEN_KEY); }

export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch(e) { return null; }
}

export function setSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(USERDATA_KEY);
  localStorage.removeItem(USERDATA_TS_KEY);
  notify();
}

export function isLoggedIn() { return !!getToken(); }

export function notify() {
  const user = getUser();
  for (let i = 0; i < listeners.length; i++) listeners[i](user);
}

export function addListener(fn) {
  listeners.push(fn);
  return function() { listeners = listeners.filter(function(f) { return f !== fn; }); };
}

// Cross-tab sync — detect auth changes from other tabs/windows.
// The storage event only fires in OTHER tabs, complementing the
// notify() calls in setSession/clearSession for the active tab.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', function(e) {
    if (e.key === TOKEN_KEY || e.key === USER_KEY) {
      notify();
    }
  });
}
