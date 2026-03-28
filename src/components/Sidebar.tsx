import type { Asset } from '../types/Asset'
import Header from './Header'
import AssetCounts from './AssetCounts'
import AssetDetail from './AssetDetail'
import AssetFeed from './AssetFeed'
import './Sidebar.css'

interface SidebarProps {
  aircraft:      Map<string, Asset>
  vessels:       Map<string, Asset>
  selectedAsset: Asset | null
}

export default function Sidebar({ aircraft, vessels, selectedAsset }: SidebarProps) {
  // Combine all assets into a flat array for the feed
  const allAssets = [...aircraft.values(), ...vessels.values()]

  return (
    <aside className="sidebar">
      <Header />
      <AssetCounts
        aircraftCount={aircraft.size}
        vesselCount={vessels.size}
      />
      <AssetDetail asset={selectedAsset} />
      <AssetFeed assets={allAssets} />
    </aside>
  )
}
