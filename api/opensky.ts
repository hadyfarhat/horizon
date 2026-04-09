import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { ADSBAircraft, ADSBResponse } from '../src/types/ADSBLol.js'

// 1000nm circle centred at 60°N 10°E covers the Northern Europe bounding box.
// We then filter to the exact box before returning to keep the payload small.
const ADSB_URL = 'https://api.adsb.lol/v2/lat/60/lon/10/dist/1000'

const LAT_MIN = 48, LAT_MAX = 72
const LON_MIN = -10, LON_MAX = 30

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(ADSB_URL)

    if (!response.ok) {
      return res.status(502).json({ error: `adsb.lol returned ${response.status}` })
    }

    const data = await response.json() as ADSBResponse

    // Filter to the bounding box; grounded/position-less aircraft are excluded here
    // so the client normaliser never has to handle them
    const filtered = (data.ac ?? []).filter((ac: ADSBAircraft) =>
      ac.lat != null &&
      ac.lon != null &&
      ac.alt_baro !== 'ground' &&
      ac.lat >= LAT_MIN && ac.lat <= LAT_MAX &&
      ac.lon >= LON_MIN && ac.lon <= LON_MAX
    )

    return res.json({ ac: filtered })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: message })
  }
}
