import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AISMessage } from '../src/types/AISStream.js'

// AISStream blocks direct browser WebSocket connections.
// This function acts as a server-side relay: it connects to AISStream via WebSocket
// (no browser restrictions) and streams vessel data to the browser via SSE.

// Heartbeat interval — server pings the browser every 10 seconds.
// If the browser misses two consecutive heartbeats it closes and reconnects the EventSource,
// which triggers the reconnecting status in the UI.
const HEARTBEAT_INTERVAL_MS = 10_000

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Set SSE headers — keeps the HTTP connection open as a one-way stream
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Flush headers immediately so the browser knows the stream has started
  res.flushHeaders()

  // Guard flag — prevents writing to the response after it has been ended
  // (e.g. browser disconnects, which closes the WS, which would trigger onclose)
  let ended = false

  function end() {
    if (ended) return
    ended = true
    res.end()
  }

  // Send a named heartbeat event every 10 seconds.
  // Using a named event (not an SSE comment) means the client can listen for it
  // and reset its watchdog timer — SSE comments are invisible to EventSource handlers.
  const heartbeat = setInterval(() => {
    if (ended) return
    try {
      res.write('event: heartbeat\ndata: ping\n\n')
    } catch {
      clearInterval(heartbeat)
      end()
    }
  }, HEARTBEAT_INTERVAL_MS)

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream')

  ws.onopen = () => {
    // Subscribe to PositionReport messages within Northern Europe.
    // Restricting the bounding box reduces message volume to a manageable rate
    // and keeps the vessel display focused on a coherent geographic area.
    // Bounds: lat 48–72°N, lon -10–30°E (covers UK, North Sea, Baltic, Scandinavia)
    ws.send(JSON.stringify({
      APIKey:             process.env.VITE_AISSTREAM_KEY ?? '',
      BoundingBoxes:      [[[48, -10], [72, 30]]],
      FilterMessageTypes: ['PositionReport'],
    }))

    // Notify the browser that the upstream AISStream connection is established
    res.write('event: status\ndata: connected\n\n')
  }

  ws.onmessage = async (event) => {
    if (ended) return
    try {
      // Handle both string and Blob formats (Node's native WebSocket returns Blobs)
      const raw = event.data instanceof Blob
        ? await (event.data as Blob).text()
        : event.data as string

      // Only forward PositionReport messages
      const msg = JSON.parse(raw) as AISMessage
      if (msg.MessageType === 'PositionReport') {
        res.write(`data: ${raw}\n\n`)
      } else {
        // Map known AISStream errors to specific status strings the client can act on
        const error = ((msg as unknown as Record<string, unknown>).error as string | undefined) ?? ''
        const status = error.toLowerCase().includes('concurrent')
          ? 'concurrent-limit'
          : raw
        res.write(`event: status\ndata: ${status}\n\n`)
      }
    } catch {
      // Malformed message — skip silently
    }
  }

  ws.onclose = () => {
    clearInterval(heartbeat)
    if (ended) return
    res.write('event: status\ndata: disconnected\n\n')
    end()
  }

  ws.onerror = () => {
    clearInterval(heartbeat)
    if (ended) return
    res.write('event: status\ndata: disconnected\n\n')
    end()
  }

  // When the browser disconnects, close the upstream WebSocket.
  // Setting ended=true first prevents onclose from attempting to write back.
  req.on('close', () => {
    clearInterval(heartbeat)
    ended = true
    ws.close()
  })
}
