(function() {
  'use strict';

  var el = document.getElementById('sitemd-auth');
  if (!el) return;
  var cfg = window.__sitemdAuthCfg || JSON.parse(el.dataset.config);

  // ---------------------------------------------------------------------------
  // Storage keys
  // ---------------------------------------------------------------------------
  var TOKEN_KEY = 'sitemd-auth-token';
  var USER_KEY = 'sitemd-auth-user';
  var USERDATA_KEY = 'sitemd-auth-userdata';
  var USERDATA_TS_KEY = 'sitemd-auth-userdata-ts';
  var USERDATA_TTL = 5 * 60 * 1000; // 5 minutes

  // ---------------------------------------------------------------------------
  // Session helpers
  // ---------------------------------------------------------------------------
  var listeners = [];

  function getToken() { return localStorage.getItem(TOKEN_KEY); }

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch(e) { return null; }
  }

  function setSession(token, user) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    notify();
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(USERDATA_KEY);
    localStorage.removeItem(USERDATA_TS_KEY);
    notify();
  }

  function isLoggedIn() { return !!getToken(); }

  function notify() {
    var user = getUser();
    for (var i = 0; i < listeners.length; i++) listeners[i](user);
  }

  // ---------------------------------------------------------------------------
  // Dynamic script loader
  // ---------------------------------------------------------------------------
  function loadScript(url) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = url; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ---------------------------------------------------------------------------
  // Normalized user: { id, email, name, avatar, emailVerified, raw }
  // ---------------------------------------------------------------------------
  function normalizeUser(raw, mapping) {
    if (!raw) return null;
    return {
      id: raw[mapping.id] || '',
      email: mapping.email(raw),
      name: mapping.name(raw),
      avatar: mapping.avatar(raw),
      emailVerified: mapping.emailVerified(raw),
      raw: raw
    };
  }

  // ---------------------------------------------------------------------------
  // Custom adapter — direct fetch to cfg.apiUrl
  // ---------------------------------------------------------------------------
  var customAdapter = {
    init: function() { return Promise.resolve(); },

    login: function(email, password) {
      return apiFetch('POST', '/auth/login', { email: email, password: password })
        .then(function(res) {
          var user = { id: res.userId, email: res.email, name: res.name || '' };
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
      var token = getToken();
      var user = getUser();
      if (!token) return Promise.resolve(null);
      return Promise.resolve({ token: token, user: user });
    },

    onAuthChange: function(fn) {
      listeners.push(fn);
      return function() { listeners = listeners.filter(function(f) { return f !== fn; }); };
    },

    getUser: function() { return Promise.resolve(getUser()); },

    requestMagicLink: function(email) {
      return apiFetch('POST', '/auth/magic-link/request', { email: email });
    },

    consumeCallback: function() {
      var hash = window.location.hash;
      var match = hash.match(/[#&]magic=([^&]+)/);
      if (!match) return Promise.resolve(false);
      var sessionToken = match[1];
      history.replaceState(null, '', window.location.pathname + window.location.search);
      return fetch(cfg.apiUrl + '/account', {
        headers: { 'Authorization': 'Bearer ' + sessionToken }
      }).then(function(r) {
        if (!r.ok) return false;
        return r.json().then(function(data) {
          var user = { id: data.id, email: data.email, name: data.name || '' };
          setSession(sessionToken, user);
          return true;
        });
      }).catch(function() { return false; });
    }
  };

  // ---------------------------------------------------------------------------
  // Supabase adapter
  // ---------------------------------------------------------------------------
  var supabaseAdapter = {
    _client: null,

    init: function() {
      var self = this;
      return import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/module/index.js')
        .then(function(mod) {
          self._client = mod.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
          self._client.auth.onAuthStateChange(function(event, session) {
            if (session && session.user) {
              var u = session.user;
              var user = {
                id: u.id, email: u.email || '',
                name: (u.user_metadata && u.user_metadata.name) || '',
                avatar: (u.user_metadata && u.user_metadata.avatar_url) || '',
                emailVerified: !!u.email_confirmed_at
              };
              setSession(session.access_token, user);
            } else if (event === 'SIGNED_OUT') {
              clearSession();
            }
          });
        });
    },

    login: function(email, password) {
      var self = this;
      return self._client.auth.signInWithPassword({ email: email, password: password })
        .then(function(res) {
          if (res.error) throw new Error(res.error.message);
          return { token: res.data.session.access_token, user: getUser() };
        });
    },

    signup: function(email, password, name) {
      var self = this;
      return self._client.auth.signUp({
        email: email, password: password,
        options: { data: { name: name } }
      }).then(function(res) {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
    },

    logout: function() {
      var self = this;
      return self._client.auth.signOut().then(function() { clearSession(); });
    },

    getSession: function() {
      var self = this;
      return self._client.auth.getSession().then(function(res) {
        if (!res.data.session) return null;
        return { token: res.data.session.access_token, user: getUser() };
      });
    },

    onAuthChange: function(fn) {
      listeners.push(fn);
      return function() { listeners = listeners.filter(function(f) { return f !== fn; }); };
    },

    getUser: function() { return Promise.resolve(getUser()); },

    requestMagicLink: function(email) {
      return this._client.auth.signInWithOtp({ email: email })
        .then(function(res) {
          if (res.error) throw new Error(res.error.message);
          return { ok: true };
        });
    },

    consumeCallback: function() { return Promise.resolve(false); }
  };

  // ---------------------------------------------------------------------------
  // Firebase adapter
  // ---------------------------------------------------------------------------
  var firebaseAdapter = {
    _auth: null,

    init: function() {
      var self = this;
      return Promise.all([
        import('https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
      ]).then(function(mods) {
        var app = mods[0].initializeApp({
          apiKey: cfg.firebaseApiKey,
          authDomain: cfg.firebaseAuthDomain,
          projectId: cfg.firebaseProjectId
        });
        self._auth = mods[1].getAuth(app);
        mods[1].onAuthStateChanged(self._auth, function(fbUser) {
          if (fbUser) {
            fbUser.getIdToken().then(function(token) {
              var user = {
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
      var self = this;
      return import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
        .then(function(mod) {
          return mod.signInWithEmailAndPassword(self._auth, email, password);
        }).then(function(cred) {
          return cred.user.getIdToken().then(function(token) {
            return { token: token, user: getUser() };
          });
        });
    },

    signup: function(email, password, name) {
      var self = this;
      return import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
        .then(function(mod) {
          return mod.createUserWithEmailAndPassword(self._auth, email, password)
            .then(function(cred) {
              if (name) return mod.updateProfile(cred.user, { displayName: name });
            });
        });
    },

    logout: function() {
      var self = this;
      return import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
        .then(function(mod) { return mod.signOut(self._auth); })
        .then(function() { clearSession(); });
    },

    getSession: function() {
      var self = this;
      if (!self._auth || !self._auth.currentUser) return Promise.resolve(null);
      return self._auth.currentUser.getIdToken().then(function(token) {
        return { token: token, user: getUser() };
      });
    },

    onAuthChange: function(fn) {
      listeners.push(fn);
      return function() { listeners = listeners.filter(function(f) { return f !== fn; }); };
    },

    getUser: function() { return Promise.resolve(getUser()); },

    requestMagicLink: function(email) {
      var self = this;
      return import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
        .then(function(mod) {
          var actionCodeSettings = {
            url: window.location.origin + (cfg.afterLogin || '/account'),
            handleCodeInApp: true
          };
          return mod.sendSignInLinkToEmail(self._auth, email, actionCodeSettings);
        }).then(function() {
          localStorage.setItem('sitemd-firebase-magic-email', email);
          return { ok: true };
        });
    },

    consumeCallback: function() {
      var self = this;
      return import('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js')
        .then(function(mod) {
          if (!mod.isSignInWithEmailLink(self._auth, window.location.href)) return false;
          var email = localStorage.getItem('sitemd-firebase-magic-email');
          if (!email) email = window.prompt('Enter your email to confirm sign-in');
          if (!email) return false;
          return mod.signInWithEmailLink(self._auth, email, window.location.href)
            .then(function() {
              localStorage.removeItem('sitemd-firebase-magic-email');
              history.replaceState(null, '', window.location.pathname);
              return true;
            });
        }).catch(function() { return false; });
    }
  };

  // ---------------------------------------------------------------------------
  // Clerk adapter
  // ---------------------------------------------------------------------------
  var clerkAdapter = {
    _clerk: null,

    init: function() {
      var self = this;
      return loadScript('https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js')
        .then(function() {
          self._clerk = new window.Clerk(cfg.clerkPublishableKey);
          return self._clerk.load();
        }).then(function() {
          if (self._clerk.user) {
            var u = self._clerk.user;
            var user = {
              id: u.id,
              email: u.primaryEmailAddress ? u.primaryEmailAddress.emailAddress : '',
              name: [u.firstName, u.lastName].filter(Boolean).join(' '),
              avatar: u.imageUrl || '',
              emailVerified: true
            };
            var token = self._clerk.session ? self._clerk.session.id : '';
            setSession(token, user);
          }
        });
    },

    login: function(email, password) {
      var self = this;
      return self._clerk.client.signIn.create({ identifier: email, password: password })
        .then(function(signIn) {
          if (signIn.status === 'complete') {
            return self._clerk.setActive({ session: signIn.createdSessionId });
          }
          throw new Error('Sign in incomplete: ' + signIn.status);
        }).then(function() {
          return { token: self._clerk.session.id, user: getUser() };
        });
    },

    signup: function(email, password, name) {
      var self = this;
      var params = { emailAddress: email, password: password };
      if (name) {
        var parts = name.split(' ');
        params.firstName = parts[0];
        params.lastName = parts.slice(1).join(' ') || undefined;
      }
      return self._clerk.client.signUp.create(params);
    },

    logout: function() {
      var self = this;
      return self._clerk.signOut().then(function() { clearSession(); });
    },

    getSession: function() {
      var self = this;
      if (!self._clerk || !self._clerk.session) return Promise.resolve(null);
      return Promise.resolve({ token: self._clerk.session.id, user: getUser() });
    },

    onAuthChange: function(fn) {
      listeners.push(fn);
      return function() { listeners = listeners.filter(function(f) { return f !== fn; }); };
    },

    getUser: function() { return Promise.resolve(getUser()); },

    requestMagicLink: function(email) {
      var self = this;
      return self._clerk.client.signIn.create({
        identifier: email,
        strategy: 'email_link',
        redirectUrl: window.location.origin + (cfg.afterLogin || '/account')
      }).then(function() {
        return { ok: true };
      });
    },

    consumeCallback: function() { return Promise.resolve(false); }
  };

  // ---------------------------------------------------------------------------
  // Auth0 adapter
  // ---------------------------------------------------------------------------
  var auth0Adapter = {
    _client: null,

    init: function() {
      var self = this;
      return loadScript('https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js')
        .then(function() {
          return window.auth0.createAuth0Client({
            domain: cfg.auth0Domain,
            clientId: cfg.auth0ClientId,
            authorizationParams: { redirect_uri: window.location.origin + (cfg.afterLogin || '/') },
            cacheLocation: 'localstorage'
          });
        }).then(function(client) {
          self._client = client;
          // Handle redirect callback
          if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
            return client.handleRedirectCallback().then(function() {
              window.history.replaceState({}, document.title, window.location.pathname);
              return self._syncUser();
            });
          }
          return self._syncUser();
        });
    },

    _syncUser: function() {
      var self = this;
      return self._client.getUser().then(function(a0User) {
        if (a0User) {
          var user = {
            id: a0User.sub || '',
            email: a0User.email || '',
            name: a0User.name || '',
            avatar: a0User.picture || '',
            emailVerified: !!a0User.email_verified
          };
          return self._client.getTokenSilently().then(function(token) {
            setSession(token, user);
          });
        }
      });
    },

    login: function() {
      return this._client.loginWithRedirect();
    },

    signup: function() {
      return this._client.loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } });
    },

    logout: function() {
      var self = this;
      clearSession();
      return self._client.logout({ logoutParams: { returnTo: window.location.origin + (cfg.afterLogout || '/') } });
    },

    getSession: function() {
      var self = this;
      return self._client.isAuthenticated().then(function(authed) {
        if (!authed) return null;
        return self._client.getTokenSilently().then(function(token) {
          return { token: token, user: getUser() };
        });
      });
    },

    onAuthChange: function(fn) {
      listeners.push(fn);
      return function() { listeners = listeners.filter(function(f) { return f !== fn; }); };
    },

    getUser: function() { return Promise.resolve(getUser()); },

    requestMagicLink: function(email) {
      return this._client.loginWithRedirect({
        authorizationParams: {
          connection: 'email',
          login_hint: email
        }
      });
    },

    consumeCallback: function() { return Promise.resolve(false); }
  };

  // ---------------------------------------------------------------------------
  // API fetch helper (used by custom adapter + sitemd.cc dashboard methods)
  // ---------------------------------------------------------------------------
  function showConfigError(msg) {
    if (document.getElementById('sitemd-config-error')) return;
    var banner = document.createElement('div');
    banner.id = 'sitemd-config-error';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#fef2f2;border-top:2px solid #dc2626;color:#991b1b;padding:12px 16px;font:14px/1.5 system-ui,sans-serif;z-index:99999;text-align:center';
    banner.innerHTML = msg;
    document.body.appendChild(banner);
  }

  function apiFetch(method, path, body) {
    if (!cfg.apiUrl && location.hostname === 'localhost') {
      var msg = '<strong>Auth API URL not configured.</strong> Run: <code style="background:#fee2e2;padding:2px 6px;border-radius:3px">sitemd config set auth.apiUrl &lt;your-api-url&gt;</code> then restart the dev server.';
      showConfigError(msg);
      return Promise.reject(new Error('Auth API URL not configured. Run: sitemd config set auth.apiUrl <url>'));
    }
    var url = cfg.apiUrl + path;
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    var token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function(r) {
      if (r.status === 401) {
        clearSession();
        window.location.href = cfg.loginPage || '/login';
        return Promise.reject(new Error('Session expired'));
      }
      if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || 'Request failed'); });
      if (r.status === 204) return {};
      return r.json();
    });
  }

  // ---------------------------------------------------------------------------
  // Select adapter
  // ---------------------------------------------------------------------------
  var adapters = {
    custom: customAdapter,
    supabase: supabaseAdapter,
    firebase: firebaseAdapter,
    clerk: clerkAdapter,
    auth0: auth0Adapter
  };
  var adapter = adapters[cfg.provider] || customAdapter;

  // ---------------------------------------------------------------------------
  // Page gating
  // ---------------------------------------------------------------------------
  function checkPageAuth() {
    var main = document.getElementById('main');
    if (!main) return;

    var required = main.getAttribute('data-auth') === 'required';
    if (!required) {
      revealGatedSections();
      return;
    }

    if (!isLoggedIn()) {
      sessionStorage.setItem('sitemd-auth-redirect', location.pathname + location.search);
      window.location.href = cfg.loginPage || '/login';
      return;
    }

    // User is logged in — check user-type gating
    var gatedTypes = main.getAttribute('data-gated-types');
    if (gatedTypes) {
      checkUserType(gatedTypes.split(','), function(allowed) {
        if (allowed) {
          main.style.visibility = '';
          revealGatedSections();
        } else {
          window.location.href = cfg.accessDeniedPage || '/access-denied';
        }
      });
    } else {
      main.style.visibility = '';
      revealGatedSections();
    }
  }

  // ---------------------------------------------------------------------------
  // currentUser variable hydration
  // ---------------------------------------------------------------------------
  function hydrateUserData() {
    var user = getUser();
    if (!user) return;

    // Merge extended data if available
    var ext;
    try { ext = JSON.parse(localStorage.getItem(USERDATA_KEY)); } catch(e) { ext = null; }
    var merged = Object.assign({}, user, ext || {});

    var spans = document.querySelectorAll('[data-current-user]');
    for (var i = 0; i < spans.length; i++) {
      var field = spans[i].getAttribute('data-current-user');
      spans[i].textContent = merged[field] != null ? String(merged[field]) : '';
    }

    // Fetch extended data if webhook configured and cache expired
    if (cfg.userDataUrl && isLoggedIn()) {
      var ts = parseInt(localStorage.getItem(USERDATA_TS_KEY), 10) || 0;
      if (Date.now() - ts > USERDATA_TTL) {
        fetchExtendedUserData();
      }
    }
  }

  function fetchExtendedUserData() {
    var token = getToken();
    if (!token || !cfg.userDataUrl) return;
    fetch(cfg.userDataUrl, {
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
  function getUserType() {
    if (!cfg.userTypeField) return [];
    var user = getUser();
    var ext;
    try { ext = JSON.parse(localStorage.getItem(USERDATA_KEY)); } catch(e) { ext = null; }
    var merged = Object.assign({}, user, ext || {});
    var val = merged[cfg.userTypeField];
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return String(val).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  }

  function checkUserType(requiredTypes, callback) {
    var types = getUserType();
    if (types.length > 0) {
      var allowed = requiredTypes.some(function(t) {
        return types.indexOf(t.trim()) !== -1;
      });
      callback(allowed);
      return;
    }

    // No type data yet — try fetching extended data first
    if (cfg.userDataUrl && isLoggedIn()) {
      var token = getToken();
      fetch(cfg.userDataUrl, {
        headers: { 'Authorization': 'Bearer ' + token }
      }).then(function(r) {
        if (!r.ok) return null;
        return r.json();
      }).then(function(data) {
        if (data) {
          localStorage.setItem(USERDATA_KEY, JSON.stringify(data));
          localStorage.setItem(USERDATA_TS_KEY, String(Date.now()));
        }
        var freshTypes = getUserType();
        var allowed = freshTypes.length > 0 && requiredTypes.some(function(t) {
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

  function revealGatedSections() {
    var sections = document.querySelectorAll('.gated-section');
    if (sections.length === 0) return;

    var userTypes = getUserType();

    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      var allowed = section.getAttribute('data-gated');
      if (!allowed) continue;

      var requiredTypes = allowed.split(',');
      var match = false;

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

  // ---------------------------------------------------------------------------
  // Header auth button
  // ---------------------------------------------------------------------------
  function initAuthButton() {
    var btn = document.querySelector('.auth-toggle');
    if (!btn) return;
    if (isLoggedIn()) {
      btn.classList.add('is-logged-in');
      btn.setAttribute('href', cfg.afterLogin || '/account');
    } else {
      btn.classList.remove('is-logged-in');
      btn.setAttribute('href', cfg.loginPage || '/login');
    }
  }

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

  var _readyResolve;
  var _readyPromise = new Promise(function(resolve) { _readyResolve = resolve; });

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
  // License check — three-tier: certificate → revocation → grace period
  // ---------------------------------------------------------------------------
  var PUBLIC_KEY_HEX = 'c334b7e48dad4475577287c95da8c45bfd9e105f537db1b94cde09874bce1bb5';
  var GRACE_KEY = 'sitemd-license-grace';
  var GRACE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  function hexToBytes(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  function verifyEd25519(payloadB64, sigB64) {
    if (!window.crypto || !window.crypto.subtle) return Promise.resolve(null); // null = unsupported
    try {
      var pubKeyBytes = hexToBytes(PUBLIC_KEY_HEX);
      return crypto.subtle.importKey('raw', pubKeyBytes, { name: 'Ed25519' }, false, ['verify'])
        .then(function(key) {
          var msg = new TextEncoder().encode(atob(payloadB64));
          var sig = Uint8Array.from(atob(sigB64), function(c) { return c.charCodeAt(0); });
          return crypto.subtle.verify('Ed25519', key, sig, msg);
        })
        .catch(function() { return null; }); // null = unsupported/error
    } catch(e) {
      return Promise.resolve(null);
    }
  }

  function verifyCertificate(cert, hostname) {
    if (!cert) return Promise.resolve({ valid: false, reason: 'no-cert' });
    try {
      var parts = cert.split('.');
      if (parts.length !== 2) return Promise.resolve({ valid: false, reason: 'bad-format' });
      var payload = JSON.parse(atob(parts[0]));
      if (payload.domain !== hostname) return Promise.resolve({ valid: false, reason: 'domain-mismatch' });
      if (new Date(payload.expiresAt) < new Date()) return Promise.resolve({ valid: false, reason: 'expired' });
      return verifyEd25519(parts[0], parts[1]).then(function(sigValid) {
        if (sigValid === false) return { valid: false, reason: 'bad-signature' };
        // sigValid === null means browser doesn't support Ed25519 — allow with domain+expiry check only
        return { valid: true, cert: payload };
      });
    } catch(e) {
      return Promise.resolve({ valid: false, reason: 'parse-error' });
    }
  }

  function checkRevocation(hostname) {
    var opts = { method: 'GET' };
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(3000);
    return fetch('https://api.sitemd.cc/license?domain=' + encodeURIComponent(hostname), opts)
      .then(function(r) {
        if (r.ok) {
          try { localStorage.setItem(GRACE_KEY, String(Date.now())); } catch(e) {}
          return true;
        }
        // Explicit 403 — revoked, clear grace immediately
        try { localStorage.removeItem(GRACE_KEY); } catch(e) {}
        return false;
      })
      .catch(function() {
        // Network error — check grace period
        try {
          var last = parseInt(localStorage.getItem(GRACE_KEY), 10);
          if (last && (Date.now() - last) < GRACE_TTL) return true;
        } catch(e) {}
        return false; // fail closed after grace period
      });
  }

  function checkLicense(hostname) {
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return Promise.resolve(true);
    var cert = (cfg && cfg.certificate) || '';
    return verifyCertificate(cert, hostname).then(function(result) {
      if (!result.valid) return false;
      return checkRevocation(hostname);
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  checkLicense(window.location.hostname).then(function(licensed) {
    if (!licensed) {
      document.dispatchEvent(new CustomEvent('sitemd:auth-failed', { detail: { reason: 'license' } }));
      return;
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
  });
})();
