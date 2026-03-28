import './AssetCounts.css'

interface AssetCountsProps {
  aircraftCount: number
  vesselCount:   number
}

export default function AssetCounts({ aircraftCount, vesselCount }: AssetCountsProps) {
  return (
    <div className="asset-counts">
      <div className="asset-counts__card asset-counts__card--aircraft">
        <span className="asset-counts__value">{aircraftCount}</span>
        <span className="asset-counts__label">Aircraft</span>
      </div>
      <div className="asset-counts__card asset-counts__card--vessel">
        <span className="asset-counts__value">{vesselCount}</span>
        <span className="asset-counts__label">Vessels</span>
      </div>
    </div>
  )
}
