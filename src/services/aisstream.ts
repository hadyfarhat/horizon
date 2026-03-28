import type { AISMessage } from '../types/AISStream'
import type { Asset } from '../types/Asset'
import type { ConnectionStatus } from '../types/ConnectionStatus'
import { calculateConfidence } from '../utils/confidence'

const WS_URL    = 'wss://stream.aisstream.io/v0/stream'
const API_KEY   = import.meta.env.VITE_AISSTREAM_KEY as string

// Reconnection config — starts at 1s, doubles on each failure, caps at 30s
const INITIAL_DELAY = 1000
const MAX_DELAY     = 30000

// Normalises an AISStream PositionReport message to the common Asset model.
function normaliseAISMessage(msg: AISMessage): Asset {
  const { MetaData, Message } = msg
  const { PositionReport }    = Message

  // time_utc arrives as a UTC string — parse directly to Date
  const lastUpdated = new Date(MetaData.time_utc)

  // Prefer TrueHeading; fall back to Course over Ground when heading is unavailable (511 = not available per AIS spec)
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

// Opens a WebSocket connection to AISStream and keeps it alive with exponential backoff.
// Calls onAsset for each incoming vessel position and onStatusChange on connection state transitions.
// Returns a cleanup function that permanently closes the connection (used on component unmount).
export function connectAISStream(
  onAsset:        (asset: Asset) => void,
  onStatusChange: (status: ConnectionStatus) => void,
): () => void {
  let socket: WebSocket | null = null
  let reconnectDelay = INITIAL_DELAY
  let cancelled = false // set to true when the caller wants a permanent close

  function connect() {
    if (cancelled) return

    socket = new WebSocket(WS_URL)

    socket.onopen = () => {
      onStatusChange('connected')
      reconnectDelay = INITIAL_DELAY // reset backoff on successful connection

      // Send subscription message immediately after connection is established
      socket!.send(JSON.stringify({
        APIKey:             API_KEY,
        BoundingBoxes:      [[[-90, -180], [90, 180]]],
        FilterMessageTypes: ['PositionReport'],
      }))
    }

    socket.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as AISMessage
        if (msg.MessageType === 'PositionReport') {
          onAsset(normaliseAISMessage(msg))
        }
      } catch {
        // Malformed message — skip silently
      }
    }

    socket.onclose = () => {
      if (cancelled) return
      onStatusChange('reconnecting')

      // Schedule reconnect with current delay, then double it for next attempt
      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY)
        connect()
      }, reconnectDelay)
    }

    socket.onerror = () => {
      // onerror is always followed by onclose, so reconnection is handled there
      onStatusChange('reconnecting')
    }
  }

  connect()

  // Return cleanup function for use in useEffect
  return () => {
    cancelled = true
    socket?.close()
  }
}
