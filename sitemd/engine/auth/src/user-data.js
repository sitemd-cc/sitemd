// ---------------------------------------------------------------------------
// User data fetching, user type helpers, gated sections
// ---------------------------------------------------------------------------
import { getUser, getToken, isLoggedIn, USERDATA_KEY, USERDATA_TS_KEY, USERDATA_TTL } from './session.js';

let _cfg = null;

export function setUserDataConfig(cfg) { _cfg = cfg; }

// ---------------------------------------------------------------------------
// currentUser variable hydration
// ---------------------------------------------------------------------------
export function hydrateUserData() {
  const user = getUser();
  if (!user) return;

  // Merge extended data if available
  let ext;
  try { ext = JSON.parse(localStorage.getItem(USERDATA_KEY)); } catch(e) { ext = null; }
  const merged = Object.assign({}, user, ext || {});

  const spans = document.querySelectorAll('[data-current-user]');
  for (let i = 0; i < spans.length; i++) {
    const field = spans[i].getAttribute('data-current-user');
    spans[i].textContent = merged[field] != null ? String(merged[field]) : '';
  }

  // Fetch extended data if webhook configured and cache expired
  if (_cfg.userDataUrl && isLoggedIn()) {
    const ts = parseInt(localStorage.getItem(USERDATA_TS_KEY), 10) || 0;
    if (Date.now() - ts > USERDATA_TTL) {
      fetchExtendedUserData();
    }
  }
}

export function fetchExtendedUserData() {
  const token = getToken();
  if (!token || !_cfg.userDataUrl) return;
  fetch(_cfg.userDataUrl, {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(function(r) {
    if (!r.ok) return;
    return r.json();
  }).then(function(data) {
    if (!data) return;
    localStorage.setItem(USERDATA_KEY, JSON.stringify(data));
    localStorage.setItem(USERDATA_TS_KEY, String(Date.now()));
    hydrateUserData();
    revealGatedSections();
  }).catch(function() {});
}

// ---------------------------------------------------------------------------
// User type helpers
// ---------------------------------------------------------------------------
export function getUserType() {
  if (!_cfg.userTypeField) return [];
  const user = getUser();
  let ext;
  try { ext = JSON.parse(localStorage.getItem(USERDATA_KEY)); } catch(e) { ext = null; }
  const merged = Object.assign({}, user, ext || {});
  const val = merged[_cfg.userTypeField];
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return String(val).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
}

export function checkUserType(requiredTypes, callback) {
  const types = getUserType();
  if (types.length > 0) {
    const allowed = requiredTypes.some(function(t) {
      return types.indexOf(t.trim()) !== -1;
    });
    callback(allowed);
    return;
  }

  // No type data yet -- try fetching extended data first
  if (_cfg.userDataUrl && isLoggedIn()) {
    const token = getToken();
    fetch(_cfg.userDataUrl, {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function(r) {
      if (!r.ok) return null;
      return r.json();
    }).then(function(data) {
      if (data) {
        localStorage.setItem(USERDATA_KEY, JSON.stringify(data));
        localStorage.setItem(USERDATA_TS_KEY, String(Date.now()));
      }
      const freshTypes = getUserType();
      const allowed = freshTypes.length > 0 && requiredTypes.some(function(t) {
        return freshTypes.indexOf(t.trim()) !== -1;
      });
      callback(allowed);
    }).catch(function() {
      callback(false);
    });
  } else {
    callback(false);
  }
}

export function revealGatedSections() {
  const sections = document.querySelectorAll('.gated-section');
  if (sections.length === 0) return;

  const userTypes = getUserType();

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const allowed = section.getAttribute('data-gated');
    if (!allowed) continue;

    const requiredTypes = allowed.split(',');
    let match = false;

    if (requiredTypes.indexOf('anyLoggedIn') !== -1 && isLoggedIn()) {
      match = true;
    } else {
      match = requiredTypes.some(function(t) {
        return userTypes.indexOf(t.trim()) !== -1;
      });
    }

    if (match) {
      section.style.display = '';
      section.classList.add('gated-visible');
    }
  }
}
