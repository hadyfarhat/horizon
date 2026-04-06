export type ConnectionStatus =
  'connected' | 'reconnecting' | 'disconnected' | 'concurrent-limit'

export interface ConnectionState {
  status:            ConnectionStatus
  reconnectAttempts: number
  lastConnected:     Date | null
}
