// ---------------------------------------------------------------------------
// sitemd auth — entry point
// ---------------------------------------------------------------------------
import { getToken, getUser, isLoggedIn } from './session.js';
import { setApiConfig, apiFetch } from './api.js';
import { setUserDataConfig, hydrateUserData } from './user-data.js';
import { setUiConfig, checkPageAuth, initAuthButton } from './ui.js';

import { createCustomAdapter } from './adapters/custom.js';
import { createSupabaseAdapter } from './adapters/supabase.js';
import { createFirebaseAdapter } from './adapters/firebase.js';
import { createClerkAdapter } from './adapters/clerk.js';
import { createAuth0Adapter } from './adapters/auth0.js';

(function() {
  'use strict';

  const el = document.getElementById('sitemd-auth');
  if (!el) return;
  const cfg = window.__sitemdAuthCfg || JSON.parse(el.dataset.config);

  // Inject cfg into modules that need it
  setApiConfig(cfg);
  setUserDataConfig(cfg);
  setUiConfig(cfg);

  // ---------------------------------------------------------------------------
  // Select adapter
  // ---------------------------------------------------------------------------
  const adapterFactories = {
    custom: createCustomAdapter,
    supabase: createSupabaseAdapter,
    firebase: createFirebaseAdapter,
    clerk: createClerkAdapter,
    auth0: createAuth0Adapter
  };
  const factory = adapterFactories[cfg.provider] || createCustomAdapter;
  const adapter = factory(cfg);

  // ---------------------------------------------------------------------------
  // SPA hook
  // ---------------------------------------------------------------------------
  window.__sitemdAuthCheck = function() {
    checkPageAuth();
    hydrateUserData();
    initAuthButton();
  };

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.__sitemdAuthCfg = cfg;

  let _readyResolve;
  const _readyPromise = new Promise(function(resolve) { _readyResolve = resolve; });

  window.__sitemdAuth = {
    ready: _readyPromise,
    login: function(email, password) { return adapter.login(email, password); },
    signup: function(email, password, name) { return adapter.signup(email, password, name); },
    logout: function() { return adapter.logout(); },
    isLoggedIn: isLoggedIn,
    getUser: function() { return adapter.getUser(); },
    getToken: getToken,
    onAuthChange: function(fn) { return adapter.onAuthChange(fn); },
    // Magic link (passwordless)
    requestMagicLink: function(email) { return adapter.requestMagicLink(email); },
    // Password reset
    forgotPassword: function(email) { return apiFetch('POST', '/auth/forgot-password', { email: email }); },
    resetPassword: function(token, pw) { return apiFetch('POST', '/auth/reset-password', { token: token, password: pw }); },
    // Account management
    getAccount: function() { return apiFetch('GET', '/account'); },
    updateAccount: function(data) { return apiFetch('PATCH', '/account', data); },
    changePassword: function(cur, next) { return apiFetch('POST', '/account/password', { currentPassword: cur, newPassword: next }); },
    deleteAccount: function() { return apiFetch('DELETE', '/account'); },
    getLicenses: function() { return apiFetch('GET', '/licenses'); },
    getLicense: function(id) { return apiFetch('GET', '/licenses/' + id); },
    listActivations: function() { return apiFetch('POST', '/activations/list'); },
    getApiKeys: function() { return apiFetch('GET', '/api-keys'); },
    createApiKey: function(name) { return apiFetch('POST', '/api-keys', { name: name }); },
    deleteApiKey: function(id) { return apiFetch('DELETE', '/api-keys/' + id); },
    getPayments: function() { return apiFetch('GET', '/payments'); },
    _apiUrl: cfg.apiUrl
  };

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  adapter.init().then(function() {
    return adapter.consumeCallback();
  }).then(function() {
    _readyResolve();
    onReady(function() {
      checkPageAuth();
      hydrateUserData();
      initAuthButton();
      document.dispatchEvent(new CustomEvent('sitemd:auth-ready'));
    });
  }).catch(function(err) {
    console.warn('[sitemd-auth] Init error:', err);
    _readyResolve();
    onReady(function() {
      checkPageAuth();
      hydrateUserData();
      initAuthButton();
      document.dispatchEvent(new CustomEvent('sitemd:auth-ready'));
    });
  });
})();
