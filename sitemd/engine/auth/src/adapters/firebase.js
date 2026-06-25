// ---------------------------------------------------------------------------
// Firebase adapter
// ---------------------------------------------------------------------------
import { getUser, setSession, clearSession, addListener } from '../session.js';

export function createFirebaseAdapter(cfg) {
  let _auth = null;

  return {
    init: function() {
      return Promise.all([
        import('https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
      ]).then(function(mods) {
        const app = mods[0].initializeApp({
          apiKey: cfg.firebaseApiKey,
          authDomain: cfg.firebaseAuthDomain,
          projectId: cfg.firebaseProjectId
        });
        _auth = mods[1].getAuth(app);
        mods[1].onAuthStateChanged(_auth, function(fbUser) {
          if (fbUser) {
            fbUser.getIdToken().then(function(token) {
              const user = {
                id: fbUser.uid, email: fbUser.email || '',
                name: fbUser.displayName || '',
                avatar: fbUser.photoURL || '',
                emailVerified: fbUser.emailVerified
              };
              setSession(token, user);
            });
          } else {
            clearSession();
          }
        });
      });
    },

    login: function(email, password) {
      return import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
        .then(function(mod) {
          return mod.signInWithEmailAndPassword(_auth, email, password);
        }).then(function(cred) {
          return cred.user.getIdToken().then(function(token) {
            return { token: token, user: getUser() };
          });
        });
    },

    signup: function(email, password, name) {
      return import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
        .then(function(mod) {
          return mod.createUserWithEmailAndPassword(_auth, email, password)
            .then(function(cred) {
              if (name) return mod.updateProfile(cred.user, { displayName: name });
            });
        });
    },

    logout: function() {
      return import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
        .then(function(mod) { return mod.signOut(_auth); })
        .then(function() { clearSession(); });
    },

    getSession: function() {
      if (!_auth || !_auth.currentUser) return Promise.resolve(null);
      return _auth.currentUser.getIdToken().then(function(token) {
        return { token: token, user: getUser() };
      });
    },

    onAuthChange: function(fn) {
      return addListener(fn);
    },

    getUser: function() { return Promise.resolve(getUser()); },

    requestMagicLink: function(email) {
      return import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
        .then(function(mod) {
          const actionCodeSettings = {
            url: window.location.origin + (cfg.afterLogin || '/account'),
            handleCodeInApp: true
          };
          return mod.sendSignInLinkToEmail(_auth, email, actionCodeSettings);
        }).then(function() {
          localStorage.setItem('sitemd-firebase-magic-email', email);
          return { ok: true };
        });
    },

    consumeCallback: function() {
      return import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
        .then(function(mod) {
          if (!mod.isSignInWithEmailLink(_auth, window.location.href)) return false;
          let email = localStorage.getItem('sitemd-firebase-magic-email');
          if (!email) email = window.prompt('Enter your email to confirm sign-in');
          if (!email) return false;
          return mod.signInWithEmailLink(_auth, email, window.location.href)
            .then(function() {
              localStorage.removeItem('sitemd-firebase-magic-email');
              history.replaceState(null, '', window.location.pathname);
              return true;
            });
        }).catch(function() { return false; });
    }
  };
}
