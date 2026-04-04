import type { ConnectionStatus } from '../types/ConnectionStatus'
import './StatusBar.css'

interface StatusBarProps {
  openSkyStatus: 'loading' | 'ok' | 'error'
  wsStatus:      ConnectionStatus
}

// Label and colour for each WebSocket connection state
const WS_STATUS_CONFIG: Record<ConnectionStatus, { label: string; colour: string }> = {
  connected:    { label: 'AIS Stream',   colour: '#4CAF50' },
  reconnecting: { label: 'Reconnecting', colour: '#FFA500' },
  disconnected: { label: 'Disconnected', colour: '#F44336' },
}

// Label and colour for each adsb.lol fetch state
const OPENSKY_STATUS_CONFIG = {
  loading: { label: 'adsb.lol', colour: null    },  // spinner — no dot colour
  ok:      { label: 'adsb.lol', colour: '#4CAF50' },
  error:   { label: 'adsb.lol', colour: '#F44336' },
}

export default function StatusBar({ openSkyStatus, wsStatus }: StatusBarProps) {
  const ws      = WS_STATUS_CONFIG[wsStatus]
  const openSky = OPENSKY_STATUS_CONFIG[openSkyStatus]

  return (
    <div className="status-bar">
      {/* adsb.lol status — spinner on initial load, green on success, red on fetch failure */}
      <div className="status-item">
        {openSkyStatus === 'loading'
          ? <span className="spinner" aria-label="Loading aircraft" />
          : <span className="status-dot" style={{ background: openSky.colour! }} />
        }
        <span className="status-label">{openSky.label}</span>
      </div>

      <div className="status-divider" />

      {/* AISStream WebSocket connection status */}
      <div className="status-item">
        <span
          className={`status-dot ${wsStatus === 'reconnecting' ? 'status-dot--pulse' : ''}`}
          style={{ background: ws.colour }}
        />
        <span className="status-label">{ws.label}</span>
      </div>
    </div>
  )
}
