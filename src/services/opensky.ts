import type { ADSBAircraft, ADSBResponse } from '../types/ADSBLol'
import type { Asset } from '../types/Asset'
import { calculateConfidence } from '../utils/confidence'

const API_URL = '/api/opensky'

// adsb.lol reports altitude in feet; Cesium expects metres
const FEET_TO_METRES = 0.3048

function normaliseAircraft(ac: ADSBAircraft): Asset {
  // seen_pos is seconds since last position update — derive lastUpdated from it
  const lastUpdated = new Date(Date.now() - ((ac.seen_pos ?? 0) * 1000))

  return {
    id:          ac.hex,
    type:        'aircraft',
    name:        ac.flight?.trim() || ac.hex,
    latitude:    ac.lat!,
    longitude:   ac.lon!,
    altitude:    typeof ac.alt_baro === 'number' ? ac.alt_baro * FEET_TO_METRES : null,
    speed:       ac.gs    ?? null,
    heading:     ac.true_heading ?? ac.track ?? null,
    country:     null,
    lastUpdated,
    confidence:  calculateConfidence(lastUpdated),
  }
}

export async function fetchAircraft(): Promise<Asset[]> {
  const response = await fetch(API_URL)
  if (!response.ok) throw new Error(`Aircraft proxy returned ${response.status}`)

  const data = await response.json() as ADSBResponse

  // Server already filtered out grounded and position-less aircraft
  return (data.ac ?? []).map(normaliseAircraft)
}
