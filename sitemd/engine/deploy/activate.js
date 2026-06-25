/**
 * Site activation client — calls the sitemd API to activate/verify sites.
 * V2: fingerprint-based (title + brandName + domain). Activations are permanent.
 */

const API_URL = 'https://api.sitemd.cc'

/**
 * Activate a site. Returns the activation receipt.
 * Throws on failure with a user-friendly message.
 * @param {string} authToken - Bearer token
 * @param {object} fingerprint - { title, brandName, domain, seoTitles, seoBrands, headerBrand, footerBrand }
 * @returns {Promise<{ activated: boolean, siteTitle: string, brandName: string, domain: string, email: string, activatedAt: string }>}
 */
async function activateSite(authToken, fingerprint) {
  let res
  try {
    res = await fetch(`${API_URL}/activations/activate-site`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ fingerprint }),
    })
  } catch (err) {
    throw new Error('Network required for site activation. Check your connection and try again.')
  }

  const data = await res.json()

  if (res.ok) return data

  if (res.status === 401) {
    throw new Error('Authentication expired. Run: sitemd auth login')
  }
  if (res.status === 403) {
    throw new Error(data.message || 'No available site slots. Purchase additional sites at https://sitemd.cc/upgrade')
  }
  const reason = data.message ? `${data.error}: ${data.message}` : (data.error || 'Site activation failed')
  throw new Error(reason)
}

/**
 * Verify a site fingerprint against stored activation.
 * Returns { verified: true } or { verified: false, reason, details }.
 * @param {string} authToken - Bearer token
 * @param {object} fingerprint - Same shape as activateSite
 * @returns {Promise<{ verified: boolean, reason?: string, details?: string[] }>}
 */
async function verifySite(authToken, fingerprint) {
  let res
  try {
    res = await fetch(`${API_URL}/activations/verify-site`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ fingerprint }),
    })
  } catch (err) {
    throw new Error('Network required for site verification. Check your connection and try again.')
  }

  const data = await res.json()

  if (res.ok) return data

  if (res.status === 401) {
    throw new Error('Authentication expired. Run: sitemd auth login')
  }
  if (res.status === 404) {
    return { verified: false, reason: data.reason || 'No activation found for this site identity' }
  }
  throw new Error(data.error || 'Site verification failed')
}

module.exports = { activateSite, verifySite }
