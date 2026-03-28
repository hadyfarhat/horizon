import type { ConnectionStatus } from '../types/ConnectionStatus'
import './StatusBar.css'

interface StatusBarProps {
  openSkyLoading: boolean
  wsStatus:       ConnectionStatus
}

// Label and colour for each WebSocket connection state
const WS_STATUS_CONFIG: Record<ConnectionStatus, { label: string; colour: string }> = {
  connected:    { label: 'Live',         colour: '#4CAF50' },
  reconnecting: { label: 'Reconnecting', colour: '#FFA500' },
  disconnected: { label: 'Disconnected', colour: '#F44336' },
}

export default function StatusBar({ openSkyLoading, wsStatus }: StatusBarProps) {
  const ws = WS_STATUS_CONFIG[wsStatus]

  return (
    <div className="status-bar">
      {/* OpenSky loading indicator — shown only during the first 15s fetch */}
      <div className="status-item">
        {openSkyLoading
          ? <span className="spinner" aria-label="Loading aircraft" />
          : <span className="status-dot" style={{ background: '#4CAF50' }} />
        }
        <span className="status-label">OpenSky</span>
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
