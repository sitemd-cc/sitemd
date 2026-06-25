// ---------------------------------------------------------------------------
// Custom adapter -- direct fetch to cfg.apiUrl
// ---------------------------------------------------------------------------
import { getToken, getUser, setSession, clearSession, addListener } from '../session.js';
import { apiFetch } from '../api.js';

export function createCustomAdapter(cfg) {
  return {
    init: function() { return Promise.resolve(); },

    login: function(email, password) {
      return apiFetch('POST', '/auth/login', { email: email, password: password })
        .then(function(res) {
          const user = { id: res.userId, email: res.email, name: res.name || '' };
          setSession(res.token, user);
          return { token: res.token, user: user };
        });
    },

    signup: function(email, password, name) {
      return apiFetch('POST', '/auth/signup', { email: email, password: password, name: name });
    },

    logout: function() {
      return apiFetch('POST', '/auth/logout').then(clearSession).catch(clearSession);
    },

    getSession: function() {
      const token = getToken();
      const user = getUser();
      if (!token) return Promise.resolve(null);
      return Promise.resolve({ token: token, user: user });
    },

    onAuthChange: function(fn) {
      return addListener(fn);
    },

    getUser: function() { return Promise.resolve(getUser()); },

    requestMagicLink: function(email) {
      return apiFetch('POST', '/auth/magic-link/request', { email: email });
    },

    consumeCallback: function() {
      const hash = window.location.hash;
      const match = hash.match(/[#&]magic=([^&]+)/);
      if (!match) return Promise.resolve(false);
      const exchangeCode = match[1];
      history.replaceState(null, '', window.location.pathname + window.location.search);
      return fetch(cfg.apiUrl + '/auth/magic-link/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: exchangeCode }),
      }).then(function(r) {
        if (!r.ok) return false;
        return r.json().then(function(data) {
          const user = { id: data.userId, email: data.email, name: data.name || '' };
          setSession(data.token, user);

          // Approve pending CLI device code (stored by login page before magic link)
          var pendingCli = sessionStorage.getItem('sitemd-cli-code');
          if (pendingCli) {
            sessionStorage.removeItem('sitemd-cli-code');
            fetch(cfg.apiUrl + '/auth/cli/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + data.token },
              body: JSON.stringify({ code: pendingCli, sessionToken: data.token }),
            }).catch(function() {});
          }

          // Restore gated-page redirect (stored by auth gate before login redirect)
          var pendingRedirect = sessionStorage.getItem('sitemd-auth-redirect');
          if (pendingRedirect) {
            sessionStorage.removeItem('sitemd-auth-redirect');
            window.location.href = pendingRedirect;
          }

          return true;
        });
      }).catch(function() { return false; });
    }
  };
}
