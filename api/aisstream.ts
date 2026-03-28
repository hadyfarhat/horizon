import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AISMessage } from '../src/types/AISStream'

// AISStream blocks direct browser WebSocket connections.
// This function acts as a server-side relay: it connects to AISStream via WebSocket
// (no browser restrictions) and streams vessel data to the browser via SSE.
export default function handler(req: VercelRequest, res: VercelResponse) {
  // Set SSE headers — keeps the HTTP connection open as a one-way stream
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // Flush headers immediately so the browser knows the stream has started
  res.flushHeaders()

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream')

  ws.onopen = () => {
    // Subscribe to global PositionReport messages once the upstream connection is live
    ws.send(JSON.stringify({
      APIKey:             process.env.VITE_AISSTREAM_KEY ?? '',
      BoundingBoxes:      [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ['PositionReport'],
    }))

    // Notify the browser that the upstream AISStream connection is established
    res.write('event: status\ndata: connected\n\n')
  }

  ws.onmessage = async (event) => {
    try {
      // Handle both string and Blob formats (Node's native WebSocket returns Blobs)
      const raw = event.data instanceof Blob
        ? await (event.data as Blob).text()
        : event.data as string

      // Only forward PositionReport messages
      const msg = JSON.parse(raw) as AISMessage
      if (msg.MessageType === 'PositionReport') {
        res.write(`data: ${raw}\n\n`)
      }
    } catch {
      // Malformed message — skip silently
    }
  }

  ws.onclose = () => {
    res.write('event: status\ndata: disconnected\n\n')
    res.end()
  }

  ws.onerror = () => {
    res.write('event: status\ndata: disconnected\n\n')
    res.end()
  }

  // Clean up the upstream WebSocket when the browser disconnects
  req.on('close', () => {
    ws.close()
  })
}
