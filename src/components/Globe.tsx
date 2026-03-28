import { Ion } from 'cesium'
import { Viewer } from 'resium'
import type { Asset } from '../types/Asset'
import AssetMarker from './AssetMarker'

// Must be set before the Viewer renders
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN as string

interface GlobeProps {
  aircraft:      Map<string, Asset>
  vessels:       Map<string, Asset>
  selectedAsset: Asset | null
  onSelectAsset: (asset: Asset) => void
}

export default function Globe({ aircraft, vessels, selectedAsset, onSelectAsset }: GlobeProps) {
  // Combine both maps into a single flat array for rendering
  const allAssets = [...aircraft.values(), ...vessels.values()]

  return (
    <Viewer
      full                        // fills the parent container (100vw × 100vh)
      timeline={false}            // hide timeline bar — not needed for a live dashboard
      animation={false}           // hide animation clock widget
      baseLayerPicker={false}     // hide imagery layer selector
      navigationHelpButton={false}
      homeButton={false}
      geocoder={false}            // hide search bar
      sceneModePicker={false}     // hide 2D/3D/Columbus toggle
      fullscreenButton={false}
      selectionIndicator={false}  // hide Cesium's default selection ring — we use the sidebar
      infoBox={false}             // hide Cesium's default info popup — we use the sidebar
    >
      {allAssets.map(asset => (
        <AssetMarker
          key={asset.id}
          asset={asset}
          isSelected={selectedAsset?.id === asset.id}
          onSelect={onSelectAsset}
        />
      ))}
    </Viewer>
  )
}
