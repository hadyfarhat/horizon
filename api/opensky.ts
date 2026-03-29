import type { VercelRequest, VercelResponse } from '@vercel/node'
import axios from 'axios'

const STATES_URL = 'https://opensky-network.org/api/states/all'

const USERNAME = process.env.VITE_OPENSKY_USERNAME ?? ''
const PASSWORD = process.env.VITE_OPENSKY_PASSWORD ?? ''

// Fetches all airborne aircraft from OpenSky using HTTP Basic auth.
// Basic auth sends credentials directly in the Authorization header —
// no token exchange needed, which avoids the separate auth.opensky-network.org call.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const openSkyRes = await axios.get(STATES_URL, {
      auth: { username: USERNAME, password: PASSWORD },
    })

    res.status(200).json(openSkyRes.data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
}
