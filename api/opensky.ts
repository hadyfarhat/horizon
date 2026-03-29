// Edge runtime runs on Cloudflare's network rather than AWS Lambda.
// OpenSky blocks AWS IP ranges but not Cloudflare, so this avoids ETIMEDOUT errors.
export const config = { runtime: 'edge' }

const TOKEN_URL  = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'

// Restrict to Northern Europe — consistent with the AISStream bounding box
// and dramatically reduces response size compared to a global query.
const STATES_URL = 'https://opensky-network.org/api/states/all?lamin=48&lomin=-10&lamax=72&lomax=30'

const CLIENT_ID     = process.env.VITE_OPENSKY_CLIENT_ID     ?? ''
const CLIENT_SECRET = process.env.VITE_OPENSKY_CLIENT_SECRET ?? ''

// Exchanges client credentials for a Bearer token.
// Edge functions are stateless so the token cannot be cached across requests.
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

export default async function handler() {
  try {
    const token = await getAccessToken()

    const response = await fetch(STATES_URL, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      return Response.json(
        { error: `OpenSky returned ${response.status}` },
        { status: 502 },
      )
    }

    const data = await response.json()
    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
