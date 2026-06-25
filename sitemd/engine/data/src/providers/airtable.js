// ---------------------------------------------------------------------------
// Airtable data provider
// ---------------------------------------------------------------------------

export function createAirtableAdapter(cfg) {
  return function airtable(source, token) {
    const baseId = cfg.airtableBaseId;
    const table = source.table || source.name;
    const url = 'https://api.airtable.com/v0/' + encodeURIComponent(baseId) + '/' + encodeURIComponent(table);

    const params = [];
    if (source._resolvedFilter) {
      params.push('filterByFormula=' + encodeURIComponent(source._resolvedFilter));
    }
    if (source._resolvedSort) {
      const sortParts = source._resolvedSort.split(/\s+/);
      const sortField = sortParts[0];
      const sortDir = (sortParts[1] || 'asc').toLowerCase();
      params.push('sort[0][field]=' + encodeURIComponent(sortField));
      params.push('sort[0][direction]=' + encodeURIComponent(sortDir));
    }
    if (source._resolvedLimit) params.push('maxRecords=' + source._resolvedLimit);
    if (source.select) {
      const fields = source.select.split(',').map(function(s) { return s.trim(); });
      for (let i = 0; i < fields.length; i++) {
        params.push('fields[]=' + encodeURIComponent(fields[i]));
      }
    }

    const airtableToken = cfg.airtableToken;
    const headers = { 'Authorization': 'Bearer ' + airtableToken };

    return fetch(url + (params.length ? '?' + params.join('&') : ''), { headers: headers })
      .then(function(r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(function(data) {
        if (!data.records) return [];
        return data.records.map(function(rec) {
          const obj = Object.assign({}, rec.fields);
          obj._id = rec.id;
          return obj;
        });
      });
  };
}
