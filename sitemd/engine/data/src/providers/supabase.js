// ---------------------------------------------------------------------------
// Supabase data provider
// ---------------------------------------------------------------------------
import { parseFilters } from '../filters.js';

export function createSupabaseAdapter(cfg) {
  return function supabase(source, token) {
    const url = cfg.supabaseUrl + '/rest/v1/' + encodeURIComponent(source.table || source.name);
    const params = [];
    if (source.select) params.push('select=' + encodeURIComponent(source.select));
    if (source._resolvedFilter) {
      const filters = parseFilters(source._resolvedFilter);
      for (let i = 0; i < filters.length; i++) params.push(filters[i]);
    }
    if (source._resolvedSort) {
      params.push('order=' + encodeURIComponent(source._resolvedSort.replace(/\s+/g, '.')));
    }
    if (source._resolvedLimit) params.push('limit=' + source._resolvedLimit);

    const headers = { 'apikey': cfg.supabaseAnonKey, 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    return fetch(url + (params.length ? '?' + params.join('&') : ''), { headers: headers })
      .then(function(r) { if (!r.ok) throw new Error(r.statusText); return r.json(); });
  };
}
