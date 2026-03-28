import type { Asset } from '../types/Asset'
import type { ConnectionStatus } from '../types/ConnectionStatus'

interface SidebarProps {
  aircraft:      Map<string, Asset>
  vessels:       Map<string, Asset>
  selectedAsset: Asset | null
  wsStatus:      ConnectionStatus
}

// Stub — implemented in Task 23
export default function Sidebar(_props: SidebarProps) {
  return null
}
