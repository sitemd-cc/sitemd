const fs = require('fs')
const path = require('path')

async function runDeploy(root, opts = {}) {
  const { loadBackendConfig, flattenBackendConfig } = require('../config-store')
  const { deploy } = require('../../deploy')

  const backend = flattenBackendConfig(loadBackendConfig(root))

  // Read target from settings/deploy.md, domain derived from meta.md url
  let target = 'cloudflare'
  try {
    const raw = fs.readFileSync(path.join(root, 'settings', 'deploy.md'), 'utf8')
    const tm = raw.match(/^target:\s*(\S+)/m)
    if (tm) target = tm[1].trim()
  } catch {}

  // Read indexNow from settings/seo.md
  let indexNow = true
  try {
    const raw = fs.readFileSync(path.join(root, 'settings', 'seo.md'), 'utf8')
    const m = raw.match(/^indexNow:\s*(\S+)/m)
    if (m && (m[1] === 'false' || m[1] === false)) indexNow = false
  } catch {}

  let memoryOutput = new Map()
  let buildConfig = {}

  if (opts.skipBuild) {
    // --no-build: read existing site/ output for fingerprinting without rebuilding
    const siteDir = path.join(root, 'site')
    const { loadSettings } = require('../../build/config')
    buildConfig = loadSettings(root)
    const walkHtml = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walkHtml(path.join(dir, entry.name))
        else if (entry.name === 'index.html' || entry.name === '404.html') {
          const html = fs.readFileSync(path.join(dir, entry.name), 'utf8')
          const rel = path.relative(siteDir, dir)
          const urlPath = entry.name === '404.html' ? '__404__' : ('/' + rel).replace(/\/$/, '') || '/'
          memoryOutput.set(urlPath, html)
        }
      }
    }
    if (fs.existsSync(siteDir)) walkHtml(siteDir)
  } else {
    // Normal: build to memory first (renders all pages in trial mode)
    const { syncThemeToCSS } = require('../../build/css')
    const { build: runBuild } = require('../../build/render')
    syncThemeToCSS(root)
    const buildResult = runBuild(root)
    memoryOutput = buildResult.config._memoryOutput || new Map()
    buildConfig = buildResult.config
  }

  const config = {
    ...backend,
    ...buildConfig,
    target,
    indexNow,
    outputDir: path.join(root, 'site'),
    _root: root,
  }

  // deploy() handles activation/verification, then builds final output and deploys
  await deploy(config, root, memoryOutput, opts)
}

module.exports = { runDeploy }
