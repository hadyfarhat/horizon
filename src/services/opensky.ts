import axios from 'axios'
import type { OpenSkyResponse, OpenSkyStateVector } from '../types/OpenSky'
import type { Asset } from '../types/Asset'
import { calculateConfidence } from '../utils/confidence'

const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
const STATES_URL = 'https://opensky-network.org/api/states/all'

const CLIENT_ID     = import.meta.env.VITE_OPENSKY_CLIENT_ID as string
const CLIENT_SECRET = import.meta.env.VITE_OPENSKY_CLIENT_SECRET as string

let cachedToken: string | null = null
let tokenExpiresAt = 0

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
  // Cache for 29 minutes to avoid using an about-to-expire token
  tokenExpiresAt = Date.now() + 29 * 60 * 1000

  return cachedToken
}

function normaliseStateVector(state: OpenSkyStateVector): Asset | null {
  const latitude  = state[6]
  const longitude = state[5]
  const onGround  = state[8]

  if (onGround || latitude === null || longitude === null) return null

  const lastContact = state[4]
  const lastUpdated = new Date(lastContact * 1000)

  return {
    id:          state[0],
    type:        'aircraft',
    name:        state[1]?.trim() || state[0],
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

export async function fetchAircraft(): Promise<Asset[]> {
  const token = await getAccessToken()

  let response
  try {
    response = await axios.get<OpenSkyResponse>(STATES_URL, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      // Token may have expired — invalidate cache and retry once
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
