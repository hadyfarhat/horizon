// Edge runtime runs on Cloudflare's network rather than AWS Lambda.
// OpenSky blocks AWS IP ranges but not Cloudflare, so this avoids ETIMEDOUT errors.
export const config = { runtime: 'edge' }

// Restrict to Northern Europe — consistent with the AISStream bounding box
// and dramatically reduces response size compared to a global query.
const STATES_URL = 'https://opensky-network.org/api/states/all?lamin=48&lomin=-10&lamax=72&lomax=30'

const USERNAME = process.env.VITE_OPENSKY_USERNAME ?? ''
const PASSWORD = process.env.VITE_OPENSKY_PASSWORD ?? ''

export default async function handler() {
  try {
    // Basic Auth avoids the OAuth2 token exchange, which times out from Cloudflare's edge network.
    const credentials = btoa(`${USERNAME}:${PASSWORD}`)
    const response = await fetch(STATES_URL, {
      headers: { Authorization: `Basic ${credentials}` },
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
