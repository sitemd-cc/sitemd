// ---------------------------------------------------------------------------
// Clerk adapter
// ---------------------------------------------------------------------------
import { getUser, setSession, clearSession, addListener } from '../session.js';
import { loadScript } from '../loader.js';

export function createClerkAdapter(cfg) {
  let _clerk = null;

  return {
    init: function() {
      return loadScript('https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js')
        .then(function() {
          _clerk = new window.Clerk(cfg.clerkPublishableKey);
          return _clerk.load();
        }).then(function() {
          if (_clerk.user) {
            const u = _clerk.user;
            const user = {
              id: u.id,
              email: u.primaryEmailAddress ? u.primaryEmailAddress.emailAddress : '',
              name: [u.firstName, u.lastName].filter(Boolean).join(' '),
              avatar: u.imageUrl || '',
              emailVerified: true
            };
            const token = _clerk.session ? _clerk.session.id : '';
            setSession(token, user);
          }
        });
    },

    login: function(email, password) {
      return _clerk.client.signIn.create({ identifier: email, password: password })
        .then(function(signIn) {
          if (signIn.status === 'complete') {
            return _clerk.setActive({ session: signIn.createdSessionId });
          }
          throw new Error('Sign in incomplete: ' + signIn.status);
        }).then(function() {
          return { token: _clerk.session.id, user: getUser() };
        });
    },

    signup: function(email, password, name) {
      const params = { emailAddress: email, password: password };
      if (name) {
        const parts = name.split(' ');
        params.firstName = parts[0];
        params.lastName = parts.slice(1).join(' ') || undefined;
      }
      return _clerk.client.signUp.create(params);
    },

    logout: function() {
      return _clerk.signOut().then(function() { clearSession(); });
    },

    getSession: function() {
      if (!_clerk || !_clerk.session) return Promise.resolve(null);
      return Promise.resolve({ token: _clerk.session.id, user: getUser() });
    },

    onAuthChange: function(fn) {
      return addListener(fn);
    },

    getUser: function() { return Promise.resolve(getUser()); },

    requestMagicLink: function(email) {
      return _clerk.client.signIn.create({
        identifier: email,
        strategy: 'email_link',
        redirectUrl: window.location.origin + (cfg.afterLogin || '/account')
      }).then(function() {
        return { ok: true };
      });
    },

    consumeCallback: function() { return Promise.resolve(false); }
  };
}
