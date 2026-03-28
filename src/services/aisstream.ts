import type { AISMessage } from '../types/AISStream'
import type { Asset } from '../types/Asset'
import type { ConnectionStatus } from '../types/ConnectionStatus'
import { calculateConfidence } from '../utils/confidence'

// Our Vercel Function proxy — connects to AISStream server-side and relays
// messages to the browser via SSE (AISStream blocks direct browser WebSocket connections)
const SSE_URL = '/api/aisstream'

// Normalises an AISStream PositionReport message to the common Asset model.
function normaliseAISMessage(msg: AISMessage): Asset {
  const { MetaData, Message } = msg
  const { PositionReport }    = Message

  const lastUpdated = new Date(MetaData.time_utc)

  // Prefer TrueHeading; fall back to Course over Ground (511 = not available per AIS spec)
  const heading =
    PositionReport.TrueHeading !== 511
      ? PositionReport.TrueHeading
      : PositionReport.Cog ?? null

  return {
    id:          String(MetaData.MMSI),
    type:        'vessel',
    name:        MetaData.ShipName.trim() || String(MetaData.MMSI),
    latitude:    MetaData.latitude,
    longitude:   MetaData.longitude,
    altitude:    null,
    speed:       PositionReport.Sog,
    heading,
    country:     null,
    lastUpdated,
    confidence:  calculateConfidence(lastUpdated),
  }
}

// Connects to the AISStream proxy via SSE and calls onAsset for each incoming vessel position.
// EventSource handles reconnection to the proxy automatically on network drops.
// Custom 'status' events from the proxy convey the upstream AISStream connection state.
// Returns a cleanup function for use in useEffect.
export function connectAISStream(
  onAsset:        (asset: Asset) => void,
  onStatusChange: (status: ConnectionStatus) => void,
): () => void {
  let es: EventSource | null = null
  let cancelled = false

  function connect() {
    if (cancelled) return

    onStatusChange('reconnecting')

    es = new EventSource(SSE_URL)

    // Vessel position messages forwarded from AISStream by the proxy
    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as AISMessage
        onAsset(normaliseAISMessage(msg))
      } catch {
        // Malformed message — skip silently
      }
    }

    // Custom events sent by the proxy to reflect upstream AISStream connection state
    es.addEventListener('status', (event) => {
      const status = (event as MessageEvent).data as string
      if (status === 'connected')    onStatusChange('connected')
      if (status === 'disconnected') onStatusChange('reconnecting')
    })

    // SSE connection to the proxy was lost — EventSource will auto-reconnect
    es.onerror = () => {
      if (!cancelled) onStatusChange('reconnecting')
    }
  }

  connect()

  // Return cleanup function for use in useEffect
  return () => {
    cancelled = true
    es?.close()
    onStatusChange('disconnected')
  }
}
