import type { AISMessage } from '../types/AISStream'
import type { Asset } from '../types/Asset'
import type { ConnectionStatus } from '../types/ConnectionStatus'
import { calculateConfidence } from '../utils/confidence'

// Our Vercel Function proxy — connects to AISStream server-side and relays
// messages to the browser via SSE (AISStream blocks direct browser WebSocket connections)
const SSE_URL = '/api/aisstream'

// If no message or heartbeat is received within this window, we assume the server
// has died without closing the connection (e.g. process killed) and force a reconnect.
const HEARTBEAT_TIMEOUT_MS = 25_000

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
// Monitors server heartbeats — if none arrive within 25s, forces a reconnect so the UI
// reflects disconnection even when the browser hasn't detected the TCP drop yet.
// Returns a cleanup function for use in useEffect.
export function connectAISStream(
  onAsset:        (asset: Asset) => void,
  onStatusChange: (status: ConnectionStatus) => void,
): () => void {
  let es: EventSource | null = null
  let cancelled  = false
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null

  // Resets the heartbeat watchdog — called on every received message or heartbeat comment.
  // If the timer fires it means the server has gone silent, so we force a reconnect.
  function resetHeartbeat() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer)
    heartbeatTimer = setTimeout(() => {
      if (cancelled) return
      onStatusChange('reconnecting')
      es?.close()
      // Delay before reconnecting to give the server-side WebSocket time to close.
      // Without this, the new connection reaches AISStream before the old one is
      // released, triggering a "concurrent connections exceeded" error.
      setTimeout(connect, 3000)
    }, HEARTBEAT_TIMEOUT_MS)
  }

  function connect() {
    if (cancelled) return

    onStatusChange('reconnecting')

    es = new EventSource(SSE_URL)

    // Start the heartbeat watchdog as soon as we open the connection
    resetHeartbeat()

    // Vessel position messages forwarded from AISStream by the proxy.
    // Each message also counts as a sign of life — reset the heartbeat watchdog.
    es.onmessage = (event) => {
      resetHeartbeat()
      try {
        const msg = JSON.parse(event.data as string) as AISMessage
        onAsset(normaliseAISMessage(msg))
      } catch {
        // Malformed message — skip silently
      }
    }

    // Custom events sent by the proxy to reflect upstream AISStream connection state
    es.addEventListener('status', (event) => {
      resetHeartbeat()
      const status = (event as MessageEvent).data as string
      if (status === 'connected')    onStatusChange('connected')
      if (status === 'disconnected') onStatusChange('reconnecting')
    })

    // Server heartbeat — resets the watchdog so a quiet-but-alive connection
    // (no vessels in range) doesn't trigger a spurious reconnect
    es.addEventListener('heartbeat', () => resetHeartbeat())

    // SSE connection to the proxy was lost — EventSource will auto-reconnect
    es.onerror = () => {
      if (!cancelled) onStatusChange('reconnecting')
    }
  }

  connect()

  // Return cleanup function for use in useEffect
  return () => {
    cancelled = true
    if (heartbeatTimer) clearTimeout(heartbeatTimer)
    es?.close()
    onStatusChange('disconnected')
  }
}
