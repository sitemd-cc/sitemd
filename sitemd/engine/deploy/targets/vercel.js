/**
 * Vercel deployment via the Deployments API.
 * Creates a deployment, uploads missing files.
 */

const fs = require('fs')
const path = require('path')
const { createHash } = require('crypto')

const VERCEL_API = 'https://api.vercel.com'

/**
 * Deploy to Vercel via the Deployments API.
 * @param {object} opts
 * @param {string} opts.outputDir - Path to built site directory
 * @param {string} opts.projectId - Vercel project ID
 * @param {string} opts.token - Vercel API token
 * @param {string} [opts.teamId] - Vercel team ID (optional)
 */
async function deployVercel({ outputDir, projectId, token, teamId }) {
  if (!projectId || !token) {
    throw new Error('Vercel deploy requires: vercelProjectId, vercelToken. Run: sitemd config setup deploy')
  }

  // Collect files with SHA1 hashes and sizes
  const files = collectFiles(outputDir)
  console.log(`  ${files.length} files to deploy`)

  const fileList = files.map(f => ({
    file: f.relativePath,
    sha: createHash('sha1').update(f.content).digest('hex'),
    size: f.content.length,
  }))

  // Build sha → file map for uploads
  const shaMap = {}
  for (let i = 0; i < files.length; i++) {
    shaMap[fileList[i].sha] = files[i]
  }

  // Step 1: Create deployment
  const teamQuery = teamId ? `?teamId=${teamId}` : ''
  const createRes = await fetch(`${VERCEL_API}/v13/deployments${teamQuery}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectId,
      files: fileList,
      projectSettings: { framework: null },
    }),
  })

  const deploy = await createRes.json()

  // Vercel returns 400 with code "missing_files" when blobs need uploading — handle before ok-check
  const missing = deploy.error?.code === 'missing_files'
    ? deploy.error.missing || []
    : deploy.missing || []

  if (!createRes.ok && missing.length === 0) {
    throw new Error(`Vercel deploy failed: ${deploy.error?.message || createRes.statusText}`)
  }

  // Step 2: Upload missing files if any
  if (missing.length > 0) {
    console.log(`  ${missing.length} files need uploading (${files.length - missing.length} cached)`)

    for (const sha of missing) {
      const file = shaMap[sha]
      if (!file) continue

      const uploadRes = await fetch(`${VERCEL_API}/v2/files${teamQuery}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'x-vercel-digest': sha,
          'x-vercel-size': String(file.content.length),
        },
        body: file.content,
      })

      if (!uploadRes.ok) {
        throw new Error(`Vercel file upload failed for ${file.relativePath}: ${uploadRes.statusText}`)
      }
    }

    // Re-create deployment after uploading files
    const retryRes = await fetch(`${VERCEL_API}/v13/deployments${teamQuery}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectId,
        files: fileList,
        projectSettings: { framework: null },
      }),
    })

    if (!retryRes.ok) {
      const err = await retryRes.json().catch(() => ({}))
      throw new Error(`Vercel deploy retry failed: ${err.error?.message || retryRes.statusText}`)
    }

    const retryDeploy = await retryRes.json()
    return { url: `https://${retryDeploy.url}`, id: retryDeploy.id }
  }

  return { url: `https://${deploy.url}`, id: deploy.id }
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

module.exports = { deployVercel }
