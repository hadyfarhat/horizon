import type { VercelRequest, VercelResponse } from '@vercel/node'

// Runs as a Node.js serverless function rather than an edge function.
// OpenSky blocks US-region cloud IPs; deploying to a European Vercel region
// (fra1/cdg1) avoids this without needing the edge runtime.
const TOKEN_URL  = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'

// Restrict to Northern Europe — consistent with the AISStream bounding box
// and dramatically reduces response size compared to a global query.
const STATES_URL = 'https://opensky-network.org/api/states/all?lamin=48&lomin=-10&lamax=72&lomax=30'

const CLIENT_ID     = process.env.VITE_OPENSKY_CLIENT_ID     ?? ''
const CLIENT_SECRET = process.env.VITE_OPENSKY_CLIENT_SECRET ?? ''

// Exchanges client credentials for a Bearer token.
async function getAccessToken(): Promise<string> {
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

  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status}`)
  }

  const json = await res.json() as { access_token: string }
  return json.access_token
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const token = await getAccessToken()

    const response = await fetch(STATES_URL, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      return res.status(502).json({ error: `OpenSky returned ${response.status}` })
    }

    const data = await response.json()
    return res.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: message })
  }
}
