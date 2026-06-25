// ---------------------------------------------------------------------------
// Firebase (Firestore) data provider
// ---------------------------------------------------------------------------

export function createFirebaseAdapter(cfg) {
  return function firebase(source, token) {
    const projectId = cfg.firebaseProjectId;
    const collection = source.table || source.name;
    const url = 'https://firestore.googleapis.com/v1/projects/' + projectId +
      '/databases/(default)/documents/' + encodeURIComponent(collection);

    const params = [];
    if (source._resolvedLimit) params.push('pageSize=' + source._resolvedLimit);

    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (cfg.firebaseApiKey) params.push('key=' + encodeURIComponent(cfg.firebaseApiKey));

    return fetch(url + (params.length ? '?' + params.join('&') : ''), { headers: headers })
      .then(function(r) { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(function(data) {
        if (!data.documents) return [];
        return data.documents.map(function(doc) {
          const obj = {};
          const fields = doc.fields || {};
          for (const k in fields) {
            const f = fields[k];
            obj[k] = f.stringValue || f.integerValue || f.doubleValue ||
              f.booleanValue || f.timestampValue || f.arrayValue || '';
          }
          // Extract document ID from name
          const parts = doc.name.split('/');
          obj._id = parts[parts.length - 1];
          return obj;
        });
      });
  };
}
