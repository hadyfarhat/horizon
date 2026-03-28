import axios from 'axios'
import type { OpenSkyResponse, OpenSkyStateVector } from '../types/OpenSky'
import type { Asset } from '../types/Asset'
import { calculateConfidence } from '../utils/confidence'

// Relative URLs — proxied through Vite in dev and Vercel rewrites in production
// This avoids CORS since the browser sees same-origin requests
const TOKEN_URL  = '/opensky-auth/auth/realms/opensky-network/protocol/openid-connect/token'
const STATES_URL = '/opensky-api/api/states/all'

const CLIENT_ID     = import.meta.env.VITE_OPENSKY_CLIENT_ID as string
const CLIENT_SECRET = import.meta.env.VITE_OPENSKY_CLIENT_SECRET as string

// Module-level token cache — shared across all calls within the same session
let cachedToken: string | null = null
let tokenExpiresAt = 0

// Exchanges client credentials for a Bearer token from the OpenSky auth server.
// Caches the token for 29 minutes (tokens last 30) to avoid unnecessary round trips.
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

  const params = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  })

  const response = await axios.post<{ access_token: string; expires_in: number }>(
    TOKEN_URL,
    params,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )

  cachedToken = response.data.access_token
  tokenExpiresAt = Date.now() + 29 * 60 * 1000

  return cachedToken
}

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

// Fetches all airborne aircraft from the OpenSky REST API.
// Handles token expiry by invalidating the cache and retrying once on a 401.
export async function fetchAircraft(): Promise<Asset[]> {
  const token = await getAccessToken()

  let response
  try {
    response = await axios.get<OpenSkyResponse>(STATES_URL, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      // Token expired mid-session — clear cache and fetch a fresh one
      cachedToken = null
      tokenExpiresAt = 0
      const freshToken = await getAccessToken()
      response = await axios.get<OpenSkyResponse>(STATES_URL, {
        headers: { Authorization: `Bearer ${freshToken}` },
      })
    } else {
      throw err
    }
  }

  const states = response.data.states
  if (!states) return []

  return states.reduce<Asset[]>((acc, state) => {
    const asset = normaliseStateVector(state)
    if (asset) acc.push(asset)
    return acc
  }, [])
}
