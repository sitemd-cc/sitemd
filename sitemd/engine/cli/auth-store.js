/**
 * Auth token storage — reads/writes ~/.sitemd/credentials
 * Precedence: SITEMD_TOKEN env var > credentials file
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const SITEMD_DIR = path.join(os.homedir(), '.sitemd')
const AUTH_FILE = path.join(SITEMD_DIR, 'credentials')

function ensureDir() {
  if (!fs.existsSync(SITEMD_DIR)) {
    fs.mkdirSync(SITEMD_DIR, { recursive: true, mode: 0o700 })
  }
}

/** Get the current auth token. Returns null if not authenticated. */
function getToken() {
  // Env var takes precedence
  if (process.env.SITEMD_TOKEN) return process.env.SITEMD_TOKEN

  try {
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
    return data.token || null
  } catch {
    return null
  }
}

/** Get stored auth data (token, email, userId). Returns null if not authenticated. */
function getAuth() {
  if (process.env.SITEMD_TOKEN) {
    return { token: process.env.SITEMD_TOKEN, email: null, userId: null }
  }

  try {
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
  } catch {
    return null
  }
}

/** Save auth data to ~/.sitemd/auth.json */
function saveAuth({ token, email, userId, name }) {
  ensureDir()
  const data = { token, email, userId, name, savedAt: new Date().toISOString() }
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), { mode: 0o600 })
}

/** Clear stored auth data */
function clearAuth() {
  try { fs.unlinkSync(AUTH_FILE) } catch {}
}

/** Check if running in a TTY (interactive terminal) */
function isTTY() {
  return process.stdin.isTTY && process.stdout.isTTY
}

module.exports = { getToken, getAuth, saveAuth, clearAuth, isTTY, SITEMD_DIR }
