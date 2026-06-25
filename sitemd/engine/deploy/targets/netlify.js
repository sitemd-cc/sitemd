/**
 * Netlify deployment via Deploy API.
 * Uses file digest to upload only changed files.
 */

const fs = require('fs')
const path = require('path')
const { createHash } = require('crypto')

const NETLIFY_API = 'https://api.netlify.com/api/v1'

/**
 * Deploy to Netlify via the Deploy API.
 * @param {object} opts
 * @param {string} opts.outputDir - Path to built site directory
 * @param {string} opts.siteId - Netlify site ID or name
 * @param {string} opts.token - Netlify personal access token
 */
async function deployNetlify({ outputDir, siteId, token }) {
  if (!siteId || !token) {
    throw new Error('Netlify deploy requires: netlifySiteId, netlifyToken. Run: sitemd config setup deploy')
  }

  // Collect files and compute SHA1 hashes
  const files = collectFiles(outputDir)
  console.log(`  ${files.length} files to deploy`)

  // Build file digest: { "/path": sha1 }
  const fileDigest = {}
  const fileMap = {}
  for (const file of files) {
    const sha = createHash('sha1').update(file.content).digest('hex')
    const key = '/' + file.relativePath
    fileDigest[key] = sha
    fileMap[sha] = file
  }

  // Step 1: Create deploy with file digest
  const createRes = await fetch(`${NETLIFY_API}/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: fileDigest }),
  })

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}))
    throw new Error(`Netlify deploy creation failed: ${err.message || createRes.statusText}`)
  }

  const deploy = await createRes.json()
  const deployId = deploy.id
  const required = deploy.required || []

  console.log(`  ${required.length} files need uploading (${files.length - required.length} cached)`)

  // Step 2: Upload required files
  for (const sha of required) {
    const file = fileMap[sha]
    if (!file) continue

    const uploadRes = await fetch(
      `${NETLIFY_API}/deploys/${deployId}/files/${encodeURIComponent('/' + file.relativePath)}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: file.content,
      }
    )

    if (!uploadRes.ok) {
      throw new Error(`Netlify file upload failed for ${file.relativePath}: ${uploadRes.statusText}`)
    }
  }

  const url = deploy.ssl_url || deploy.url || `https://${deploy.subdomain}.netlify.app`
  return { url, id: deployId }
}

function collectFiles(dir, base = dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, base))
    } else {
      files.push({
        relativePath: path.relative(base, fullPath),
        content: fs.readFileSync(fullPath),
      })
    }
  }
  return files
}

module.exports = { deployNetlify }
