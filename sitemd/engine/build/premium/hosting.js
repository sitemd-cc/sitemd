const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Media hosting — sync media files to R2/S3 CDN, rewrite HTML URLs
// ---------------------------------------------------------------------------

/**
 * Sync media/ to remote object storage and rewrite HTML asset URLs.
 *
 * @param {string} distDir - Build output directory (e.g. site/)
 * @param {object} config
 * @param {string} config.mediaHosting - 'r2' | 's3' | false
 * @param {string} config.mediaCdnUrl - CDN URL prefix (e.g. https://cdn.example.com)
 */
async function syncMedia(distDir, config) {
  if (!config.mediaHosting || config.mediaHosting === 'false') return;

  const cdnUrl = (config.mediaCdnUrl || '').replace(/\/+$/, '');
  if (!cdnUrl) {
    console.log('  Media hosting: mediaCdnUrl not set, skipping');
    return;
  }

  const mediaDir = path.join(distDir, 'media');
  if (!fs.existsSync(mediaDir)) return;

  const files = collectFiles(mediaDir);
  if (files.length === 0) return;

  // Load manifest (tracks what's already on the CDN)
  const manifestPath = path.join(distDir, '.media-manifest.json');
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch (e) { /* fresh */ }

  const newManifest = {};
  const toUpload = [];

  for (const file of files) {
    const hash = sha256(file.content);
    const relPath = path.relative(mediaDir, file.fullPath);
    const key = relPath.replace(/\\/g, '/');
    newManifest[key] = hash;
    if (manifest[key] !== hash) {
      toUpload.push({ key, content: file.content, fullPath: file.fullPath });
    }
  }

  if (toUpload.length === 0) {
    console.log(`  Media hosting: ${files.length} files already synced`);
  } else {
    console.log(`  Media hosting: uploading ${toUpload.length} files (${files.length - toUpload.length} cached)`);

    if (config.mediaHosting === 'r2') {
      await uploadS3Compatible(toUpload, {
        accountId: config.hostingR2AccountId,
        accessKey: config.hostingR2AccessKey,
        secretKey: config.hostingR2SecretKey,
        bucket: config.hostingR2Bucket,
        endpoint: config.hostingR2AccountId
          ? `https://${config.hostingR2AccountId}.r2.cloudflarestorage.com`
          : null,
        region: 'auto',
      });
    } else if (config.mediaHosting === 's3') {
      await uploadS3Compatible(toUpload, {
        accessKey: config.hostingS3AccessKey,
        secretKey: config.hostingS3SecretKey,
        bucket: config.hostingS3Bucket,
        endpoint: `https://s3.${config.hostingS3Region || 'us-east-1'}.amazonaws.com`,
        region: config.hostingS3Region || 'us-east-1',
      });
    }

    fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2));
    console.log(`  ✓ Media synced to CDN`);
  }

  // Rewrite /media/ URLs in HTML output to CDN URL
  rewriteMediaUrls(distDir, cdnUrl);
}

// ---------------------------------------------------------------------------
// S3-compatible upload (works for both R2 and AWS S3)
// ---------------------------------------------------------------------------

async function uploadS3Compatible(files, opts) {
  const { accessKey, secretKey, bucket, endpoint, region } = opts;

  if (!accessKey || !secretKey || !bucket || !endpoint) {
    throw new Error('Media hosting: missing credentials. Run: sitemd config setup hosting');
  }

  for (const file of files) {
    const url = `${endpoint}/${bucket}/${file.key}`;
    const contentType = mimeType(file.key);
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z';

    const headers = await signRequest({
      method: 'PUT',
      url,
      headers: {
        'content-type': contentType,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': sha256(file.content),
      },
      body: file.content,
      accessKey,
      secretKey,
      region,
      service: 's3',
      dateStamp,
      amzDate,
    });

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: file.content,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Upload failed for ${file.key}: ${res.status} ${text.slice(0, 200)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// AWS SigV4 signing (minimal — PUT only)
// ---------------------------------------------------------------------------

async function signRequest({ method, url, headers, body, accessKey, secretKey, region, service, dateStamp, amzDate }) {
  const parsedUrl = new URL(url);
  const host = parsedUrl.host;
  const canonicalUri = parsedUrl.pathname;
  const canonicalQueryString = '';
  const payloadHash = sha256(body);

  const signedHeaders = Object.keys(headers)
    .map(k => k.toLowerCase())
    .sort()
    .join(';');

  const canonicalHeadersStr = Object.keys(headers)
    .map(k => k.toLowerCase())
    .sort()
    .map(k => `${k}:${headers[Object.keys(headers).find(h => h.toLowerCase() === k)]}\n`)
    .join('');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeadersStr,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(Buffer.from(canonicalRequest)),
  ].join('\n');

  const signingKey = hmacChain(
    ['AWS4' + secretKey, dateStamp, region, service, 'aws4_request']
  );
  const signature = hmac(signingKey, stringToSign, 'hex');

  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  return { ...headers, host, authorization };
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key, data, encoding) {
  return crypto.createHmac('sha256', key).update(data).digest(encoding);
}

function hmacChain(parts) {
  let key = parts[0];
  for (let i = 1; i < parts.length; i++) {
    key = hmac(typeof key === 'string' ? Buffer.from(key) : key, parts[i]);
  }
  return key;
}

// ---------------------------------------------------------------------------
// HTML URL rewriting
// ---------------------------------------------------------------------------

function rewriteMediaUrls(distDir, cdnUrl) {
  const htmlFiles = collectHtmlFiles(distDir);
  let count = 0;

  for (const htmlPath of htmlFiles) {
    let html = fs.readFileSync(htmlPath, 'utf-8');
    const original = html;

    // Rewrite src="/media/..." and href="/media/..."
    html = html.replace(/(src|href)="(\/media\/[^"]+)"/g, (_, attr, src) => {
      return `${attr}="${cdnUrl}${src}"`;
    });

    // Rewrite url('/media/...') in inline styles
    html = html.replace(/url\('(\/media\/[^']+)'\)/g, (_, src) => {
      return `url('${cdnUrl}${src}')`;
    });
    html = html.replace(/url\("(\/media\/[^"]+)"\)/g, (_, src) => {
      return `url("${cdnUrl}${src}")`;
    });

    // Rewrite srcset="/media/..." values
    html = html.replace(/srcset="([^"]+)"/g, (_, srcset) => {
      const rewritten = srcset.replace(/(\/media\/[^\s,]+)/g, `${cdnUrl}$1`);
      return `srcset="${rewritten}"`;
    });

    if (html !== original) {
      fs.writeFileSync(htmlPath, html);
      count++;
    }
  }

  if (count > 0) {
    console.log(`  ✓ CDN URLs rewritten in ${count} HTML files`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, results);
    } else if (entry.name !== '.image-cache.json' && !entry.name.startsWith('.')) {
      results.push({ fullPath, content: fs.readFileSync(fullPath) });
    }
  }
  return results;
}

function collectHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectHtmlFiles(fullPath, results);
    } else if (entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

function mimeType(key) {
  const ext = path.extname(key).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.pdf': 'application/pdf', '.mp3': 'audio/mpeg',
  };
  return types[ext] || 'application/octet-stream';
}

module.exports = { syncMedia };
