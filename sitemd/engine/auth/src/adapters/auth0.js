// ---------------------------------------------------------------------------
// Auth0 adapter
// ---------------------------------------------------------------------------
import { getUser, setSession, clearSession, addListener } from '../session.js';
import { loadScript } from '../loader.js';

export function createAuth0Adapter(cfg) {
  let _client = null;

  function _syncUser() {
    return _client.getUser().then(function(a0User) {
      if (a0User) {
        const user = {
          id: a0User.sub || '',
          email: a0User.email || '',
          name: a0User.name || '',
          avatar: a0User.picture || '',
          emailVerified: !!a0User.email_verified
        };
        return _client.getTokenSilently().then(function(token) {
          setSession(token, user);
        });
      }
    });
  }

  return {
    init: function() {
      return loadScript('https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js')
        .then(function() {
          return window.auth0.createAuth0Client({
            domain: cfg.auth0Domain,
            clientId: cfg.auth0ClientId,
            authorizationParams: { redirect_uri: window.location.origin + (cfg.afterLogin || '/') },
            cacheLocation: 'localstorage'
          });
        }).then(function(client) {
          _client = client;
          // Handle redirect callback
          if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
            return client.handleRedirectCallback().then(function() {
              // Remove only Auth0 callback params, preserve app-specific ones
              var params = new URLSearchParams(window.location.search);
              params.delete('code');
              params.delete('state');
              var clean = params.toString();
              window.history.replaceState({}, document.title, window.location.pathname + (clean ? '?' + clean : ''));
              return _syncUser();
            });
          }
          return _syncUser();
        });
    },

    login: function() {
      return _client.loginWithRedirect();
    },

    signup: function() {
      return _client.loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } });
    },

    logout: function() {
      clearSession();
      return _client.logout({ logoutParams: { returnTo: window.location.origin + (cfg.afterLogout || '/') } });
    },

    getSession: function() {
      return _client.isAuthenticated().then(function(authed) {
        if (!authed) return null;
        return _client.getTokenSilently().then(function(token) {
          return { token: token, user: getUser() };
        });
      });
    },

    onAuthChange: function(fn) {
      return addListener(fn);
    },

    getUser: function() { return Promise.resolve(getUser()); },

    requestMagicLink: function(email) {
      return _client.loginWithRedirect({
        authorizationParams: {
          connection: 'email',
          login_hint: email
        }
      });
    },

    consumeCallback: function() { return Promise.resolve(false); }
  };
}
