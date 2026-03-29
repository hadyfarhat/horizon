import type { VercelRequest, VercelResponse } from '@vercel/node'

// OpenSky OAuth2 token endpoint
const TOKEN_URL  = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
const STATES_URL = 'https://opensky-network.org/api/states/all'

const CLIENT_ID     = process.env.VITE_OPENSKY_CLIENT_ID     ?? ''
const CLIENT_SECRET = process.env.VITE_OPENSKY_CLIENT_SECRET ?? ''

// Module-level token cache — reused across warm lambda invocations
let cachedToken: string | null = null
let tokenExpiresAt = 0

// Exchanges client credentials for a Bearer token.
// Caches the token for 29 minutes (tokens last 30) to reduce auth round trips.
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })

  if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`)

  const data = await res.json() as { access_token: string }
  cachedToken    = data.access_token
  tokenExpiresAt = Date.now() + 29 * 60 * 1000

  return cachedToken
}

// Fetches all airborne aircraft from OpenSky and returns the raw JSON response.
// Handles token expiry by invalidating the cache and retrying once on a 401.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const token = await getAccessToken()

    let openSkyRes = await fetch(STATES_URL, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (openSkyRes.status === 401) {
      // Token expired mid-session — clear cache and retry once with a fresh token
      cachedToken = null
      tokenExpiresAt = 0
      const freshToken = await getAccessToken()
      openSkyRes = await fetch(STATES_URL, {
        headers: { Authorization: `Bearer ${freshToken}` },
      })
    }

    if (!openSkyRes.ok) {
      res.status(openSkyRes.status).json({ error: 'OpenSky request failed' })
      return
    }

    const data = await openSkyRes.json()
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
}
