import axios from 'axios'
import type { OpenSkyResponse, OpenSkyStateVector } from '../types/OpenSky'
import type { Asset } from '../types/Asset'
import { calculateConfidence } from '../utils/confidence'

// All OpenSky auth and data fetching is handled server-side via the Vercel function.
// This avoids CORS restrictions and keeps credentials out of the browser.
const API_URL = '/api/opensky'

// Maps a raw OpenSky state vector (positional array) to the common Asset model.
// Returns null for grounded aircraft or those with missing position data.
function normaliseStateVector(state: OpenSkyStateVector): Asset | null {
  const latitude  = state[6]
  const longitude = state[5]
  const onGround  = state[8]

  if (onGround || latitude === null || longitude === null) return null

  // OpenSky provides last_contact as a Unix timestamp (seconds)
  const lastContact = state[4]
  const lastUpdated = new Date(lastContact * 1000)

  return {
    id:          state[0],
    type:        'aircraft',
    name:        state[1]?.trim() || state[0], // callsigns have trailing spaces; fall back to icao24
    latitude,
    longitude,
    altitude:    state[7],
    speed:       state[9],
    heading:     state[10],
    country:     state[2] || null,
    lastUpdated,
    confidence:  calculateConfidence(lastUpdated),
  }
}

// Fetches all airborne aircraft via the server-side Vercel function.
// Auth token management is handled entirely server-side.
export async function fetchAircraft(): Promise<Asset[]> {
  const response = await axios.get<OpenSkyResponse>(API_URL)

  const states = response.data.states
  if (!states) return []

  return states.reduce<Asset[]>((acc, state) => {
    const asset = normaliseStateVector(state)
    if (asset) acc.push(asset)
    return acc
  }, [])
}
