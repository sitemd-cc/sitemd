/**
 * GitHub Pages deployment via the Git Data API.
 * Creates blobs, tree, commit, and updates the target branch ref.
 * No local git binary required.
 */

const fs = require('fs')
const path = require('path')

const GH_API = 'https://api.github.com'

/**
 * Deploy to GitHub Pages via the REST API.
 * @param {object} opts
 * @param {string} opts.outputDir - Path to built site directory
 * @param {string} opts.repo - Repository in owner/repo format
 * @param {string} opts.token - GitHub personal access token
 * @param {string} [opts.branch] - Target branch (default: gh-pages)
 */
async function deployGitHub({ outputDir, repo, token, branch = 'gh-pages' }) {
  if (!repo || !token) {
    throw new Error('GitHub Pages deploy requires: githubRepo, githubToken. Run: sitemd config setup deploy')
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const files = collectFiles(outputDir)
  console.log(`  ${files.length} files to deploy to ${repo} (${branch})`)

  // Step 1: Create blobs for each file
  const treeItems = []
  for (const file of files) {
    const blobRes = await ghFetch(`${GH_API}/repos/${repo}/git/blobs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: file.content.toString('base64'),
        encoding: 'base64',
      }),
    })

    treeItems.push({
      path: file.relativePath,
      mode: '100644',
      type: 'blob',
      sha: blobRes.sha,
    })
  }

  // Step 2: Create tree (no base_tree — full replacement)
  const treeRes = await ghFetch(`${GH_API}/repos/${repo}/git/trees`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tree: treeItems }),
  })

  // Step 3: Get current branch SHA (if exists)
  let parentSha = null
  try {
    const refRes = await ghFetch(`${GH_API}/repos/${repo}/git/ref/heads/${branch}`, {
      method: 'GET',
      headers,
    })
    parentSha = refRes.object?.sha
  } catch (e) {
    // Branch doesn't exist yet — will create it
  }

  // Step 4: Create commit
  const commitBody = {
    message: `Deploy site — ${new Date().toISOString().slice(0, 19)}Z`,
    tree: treeRes.sha,
  }
  if (parentSha) commitBody.parents = [parentSha]

  const commitRes = await ghFetch(`${GH_API}/repos/${repo}/git/commits`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(commitBody),
  })

  // Step 5: Create or update branch ref
  if (parentSha) {
    await ghFetch(`${GH_API}/repos/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: commitRes.sha, force: true }),
    })
  } else {
    await ghFetch(`${GH_API}/repos/${repo}/git/refs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commitRes.sha }),
    })
  }

  const [owner, repoName] = repo.split('/')
  const url = `https://${owner}.github.io/${repoName}`
  return { url, id: commitRes.sha }
}

async function ghFetch(url, opts) {
  const res = await fetch(url, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub API error (${res.status}): ${err.message || res.statusText}`)
  }
  return res.json()
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

module.exports = { deployGitHub }
