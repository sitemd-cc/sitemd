// ---------------------------------------------------------------------------
// Dev server auth stub — local mock for testing auth flows without a backend
// Only active for the 'custom' auth provider in dev-serve mode.
// ---------------------------------------------------------------------------

function createDevAuthHandler() {
  let session = null;

  function parseBody(req) {
    return new Promise(function(resolve) {
      let body = '';
      req.on('data', function(chunk) { body += chunk; });
      req.on('end', function() {
        try { resolve(JSON.parse(body)); } catch { resolve({}); }
      });
    });
  }

  function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  function noContent(res) {
    res.writeHead(204);
    res.end();
  }

  function checkAuth(req) {
    if (!session) return false;
    const auth = req.headers['authorization'] || '';
    return auth === 'Bearer ' + session.token;
  }

  function makeToken() {
    return 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function createSession(email, name) {
    session = {
      token: makeToken(),
      user: { id: 'dev-user-1', email: email || 'dev@localhost', name: name || '' }
    };
    return session;
  }

  return function handleDevAuth(req, res) {
    const url = req.url.split('?')[0];
    if (!url.startsWith('/__auth/')) return false;

    const path = url.slice('/__auth'.length); // e.g. /auth/login
    const method = req.method;

    // --- Authentication ---

    if (method === 'POST' && path === '/auth/login') {
      parseBody(req).then(function(body) {
        const s = createSession(body.email, body.name);
        json(res, 200, { token: s.token, userId: s.user.id, email: s.user.email, name: s.user.name });
      });
      return true;
    }

    if (method === 'POST' && path === '/auth/signup') {
      parseBody(req).then(function(body) {
        const s = createSession(body.email, body.name);
        json(res, 200, { ok: true, token: s.token, userId: s.user.id, email: s.user.email, name: s.user.name });
      });
      return true;
    }

    if (method === 'POST' && path === '/auth/logout') {
      session = null;
      noContent(res);
      return true;
    }

    if (method === 'POST' && path === '/auth/magic-link/request') {
      json(res, 200, { ok: true });
      return true;
    }

    if (method === 'POST' && path === '/auth/magic-link/exchange') {
      parseBody(req).then(function(body) {
        // Accept any code — create session. Use email from existing session or default.
        const email = (session && session.user.email) || 'dev@localhost';
        const s = createSession(email, 'Dev User');
        json(res, 200, { token: s.token, userId: s.user.id, email: s.user.email, name: s.user.name });
      });
      return true;
    }

    if (method === 'POST' && path === '/auth/forgot-password') {
      json(res, 200, { ok: true });
      return true;
    }

    if (method === 'POST' && path === '/auth/reset-password') {
      json(res, 200, { ok: true });
      return true;
    }

    // --- Account ---

    if (method === 'GET' && path === '/account') {
      if (!checkAuth(req)) { json(res, 401, { error: 'Not authenticated' }); return true; }
      json(res, 200, { id: session.user.id, email: session.user.email, name: session.user.name });
      return true;
    }

    if (method === 'PATCH' && path === '/account') {
      if (!checkAuth(req)) { json(res, 401, { error: 'Not authenticated' }); return true; }
      parseBody(req).then(function(body) {
        if (body.email) session.user.email = body.email;
        if (body.name) session.user.name = body.name;
        json(res, 200, { id: session.user.id, email: session.user.email, name: session.user.name });
      });
      return true;
    }

    if (method === 'POST' && path === '/account/password') {
      if (!checkAuth(req)) { json(res, 401, { error: 'Not authenticated' }); return true; }
      json(res, 200, { ok: true });
      return true;
    }

    if (method === 'DELETE' && path === '/account') {
      session = null;
      noContent(res);
      return true;
    }

    // --- Licenses ---

    if (method === 'GET' && path === '/licenses') {
      if (!checkAuth(req)) { json(res, 401, { error: 'Not authenticated' }); return true; }
      json(res, 200, { licenses: [{ id: 'dev-license-1', max_sites: 3, sites_used: 1, created_at: new Date().toISOString() }] });
      return true;
    }

    if (method === 'GET' && path.startsWith('/licenses/')) {
      if (!checkAuth(req)) { json(res, 401, { error: 'Not authenticated' }); return true; }
      json(res, 200, { id: 'dev-license-1', max_sites: 3, sites_used: 1, created_at: new Date().toISOString() });
      return true;
    }

    // --- Activations ---

    if (method === 'POST' && path === '/activations/list') {
      if (!checkAuth(req)) { json(res, 401, { error: 'Not authenticated' }); return true; }
      json(res, 200, { activations: [{ site_title: 'Dev Site', domain: 'localhost', activated_at: new Date().toISOString() }] });
      return true;
    }

    // --- API Keys ---

    if (method === 'GET' && path === '/api-keys') {
      if (!checkAuth(req)) { json(res, 401, { error: 'Not authenticated' }); return true; }
      json(res, 200, { keys: [] });
      return true;
    }

    if (method === 'POST' && path === '/api-keys') {
      if (!checkAuth(req)) { json(res, 401, { error: 'Not authenticated' }); return true; }
      parseBody(req).then(function(body) {
        json(res, 200, { id: 'dev-key-1', name: body.name || 'Dev Key', key: 'sk-dev-' + makeToken(), created_at: new Date().toISOString() });
      });
      return true;
    }

    if (method === 'DELETE' && path.startsWith('/api-keys/')) {
      if (!checkAuth(req)) { json(res, 401, { error: 'Not authenticated' }); return true; }
      noContent(res);
      return true;
    }

    // --- Payments ---

    if (method === 'GET' && path === '/payments') {
      if (!checkAuth(req)) { json(res, 401, { error: 'Not authenticated' }); return true; }
      json(res, 200, { payments: [] });
      return true;
    }

    // Unhandled /__auth path
    json(res, 404, { error: 'Not found' });
    return true;
  };
}

module.exports = { createDevAuthHandler };
