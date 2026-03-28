import type { Asset } from '../types/Asset'

interface AssetMarkerProps {
  asset:    Asset
  onSelect: (asset: Asset) => void
}

// Stub — implemented in Task 21
export default function AssetMarker(_props: AssetMarkerProps) {
  return null
}
