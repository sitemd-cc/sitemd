// ---------------------------------------------------------------------------
// REST/HTTP data provider
// ---------------------------------------------------------------------------

export function createRestAdapter(cfg) {
  return function rest(source, token) {
    const baseUrl = (cfg.restBaseUrl || '').replace(/\/+$/, '');
    const endpoint = source.table || source.name;
    const url = baseUrl + '/' + endpoint;

    const params = [];
    if (source._resolvedFilter) params.push('filter=' + encodeURIComponent(source._resolvedFilter));
    if (source._resolvedSort) params.push('sort=' + encodeURIComponent(source._resolvedSort));
    if (source._resolvedLimit) params.push('limit=' + source._resolvedLimit);

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    // Parse custom headers from config
    if (cfg.restHeaders) {
      try {
        const custom = JSON.parse(cfg.restHeaders);
        for (const k in custom) headers[k] = custom[k];
      } catch(e) { /* ignore */ }
    }

    return fetch(url + (params.length ? '?' + params.join('&') : ''), { headers: headers })
      .then(function(r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(function(data) {
        // Support nested response: try data.data, data.items, data.results, or plain array
        if (Array.isArray(data)) return data;
        if (data.data && Array.isArray(data.data)) return data.data;
        if (data.items && Array.isArray(data.items)) return data.items;
        if (data.results && Array.isArray(data.results)) return data.results;
        return [];
      });
  };
}
