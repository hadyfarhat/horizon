import type { Asset } from '../types/Asset'

interface GlobeProps {
  aircraft:      Map<string, Asset>
  vessels:       Map<string, Asset>
  onSelectAsset: (asset: Asset) => void
}

// Stub — implemented in Task 20
export default function Globe(_props: GlobeProps) {
  return null
}
