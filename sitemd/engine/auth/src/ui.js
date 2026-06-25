// ---------------------------------------------------------------------------
// Page gating + auth UI
// ---------------------------------------------------------------------------
import { isLoggedIn } from './session.js';
import { checkUserType, revealGatedSections, hydrateUserData } from './user-data.js';

let _cfg = null;

export function setUiConfig(cfg) { _cfg = cfg; }

// ---------------------------------------------------------------------------
// Page gating
// ---------------------------------------------------------------------------
export function checkPageAuth() {
  const main = document.getElementById('sitemd-main') || document.getElementById('main');
  if (!main) return;

  const required = main.getAttribute('data-auth') === 'required';
  if (!required) {
    revealGatedSections();
    return;
  }

  if (!isLoggedIn()) {
    sessionStorage.setItem('sitemd-auth-redirect', location.pathname + location.search);
    window.location.href = _cfg.loginPage || '/login';
    return;
  }

  // User is logged in -- check user-type gating
  const gatedTypes = main.getAttribute('data-gated-types');
  if (gatedTypes) {
    checkUserType(gatedTypes.split(','), function(allowed) {
      if (allowed) {
        main.style.visibility = '';
        revealGatedSections();
      } else {
        window.location.href = _cfg.accessDeniedPage || '/access-denied';
      }
    });
  } else {
    main.style.visibility = '';
    revealGatedSections();
  }
}

// ---------------------------------------------------------------------------
// Header auth button
// ---------------------------------------------------------------------------
export function initAuthButton() {
  const btn = document.querySelector('.auth-toggle');
  if (!btn) return;
  if (isLoggedIn()) {
    btn.classList.add('is-logged-in');
    btn.setAttribute('href', _cfg.afterLogin || '/account');
  } else {
    btn.classList.remove('is-logged-in');
    btn.setAttribute('href', _cfg.loginPage || '/login');
  }
}
