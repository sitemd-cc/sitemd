// ---------------------------------------------------------------------------
// Supabase adapter
// ---------------------------------------------------------------------------
import { getUser, setSession, clearSession, addListener } from '../session.js';

export function createSupabaseAdapter(cfg) {
  let _client = null;

  return {
    init: function() {
      return import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/module/index.js')
        .then(function(mod) {
          _client = mod.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
          _client.auth.onAuthStateChange(function(event, session) {
            if (session && session.user) {
              const u = session.user;
              const user = {
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
      return _client.auth.signInWithPassword({ email: email, password: password })
        .then(function(res) {
          if (res.error) throw new Error(res.error.message);
          return { token: res.data.session.access_token, user: getUser() };
        });
    },

    signup: function(email, password, name) {
      return _client.auth.signUp({
        email: email, password: password,
        options: { data: { name: name } }
      }).then(function(res) {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
    },

    logout: function() {
      return _client.auth.signOut().then(function() { clearSession(); });
    },

    getSession: function() {
      return _client.auth.getSession().then(function(res) {
        if (!res.data.session) return null;
        return { token: res.data.session.access_token, user: getUser() };
      });
    },

    onAuthChange: function(fn) {
      return addListener(fn);
    },

    getUser: function() { return Promise.resolve(getUser()); },

    requestMagicLink: function(email) {
      return _client.auth.signInWithOtp({ email: email })
        .then(function(res) {
          if (res.error) throw new Error(res.error.message);
          return { ok: true };
        });
    },

    consumeCallback: function() { return Promise.resolve(false); }
  };
}
