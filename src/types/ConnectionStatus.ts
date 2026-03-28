export type ConnectionStatus =
  'connected' | 'reconnecting' | 'disconnected'

export interface ConnectionState {
  status:            ConnectionStatus
  reconnectAttempts: number
  lastConnected:     Date | null
}
