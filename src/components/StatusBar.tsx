import type { ConnectionStatus } from '../types/ConnectionStatus'

interface StatusBarProps {
  openSkyLoading: boolean
  wsStatus:       ConnectionStatus
}

// Stub — implemented in Task 22
export default function StatusBar(_props: StatusBarProps) {
  return null
}
