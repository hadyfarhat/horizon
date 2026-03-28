import type { Asset } from '../types/Asset'
import type { Confidence } from '../types/Confidence'
import './AssetDetail.css'

interface AssetDetailProps {
  asset: Asset | null
}

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  'fresh':      'Fresh',
  'stale':      'Stale',
  'very-stale': 'Very Stale',
}

const CONFIDENCE_CLASSES: Record<Confidence, string> = {
  'fresh':      'badge--fresh',
  'stale':      'badge--stale',
  'very-stale': 'badge--very-stale',
}

// Formats a nullable number to a fixed decimal string, or returns a fallback
function fmt(value: number | null, decimals = 2, fallback = 'N/A'): string {
  return value !== null ? value.toFixed(decimals) : fallback
}

export default function AssetDetail({ asset }: AssetDetailProps) {
  if (!asset) {
    return (
      <div className="asset-detail asset-detail--empty">
        <p className="asset-detail__empty-text">Select an asset to view details</p>
      </div>
    )
  }

  return (
    <div className="asset-detail">
      {/* Header row — name, type icon, confidence badge */}
      <div className="asset-detail__header">
        <span className="asset-detail__icon">
          {asset.type === 'aircraft' ? '✈' : '⛵'}
        </span>
        <span className="asset-detail__name">{asset.name}</span>
        <span className={`badge ${CONFIDENCE_CLASSES[asset.confidence]}`}>
          {CONFIDENCE_LABELS[asset.confidence]}
        </span>
      </div>

      {/* Detail rows */}
      <dl className="asset-detail__fields">
        <div className="asset-detail__row">
          <dt>Type</dt>
          <dd>{asset.type === 'aircraft' ? 'Aircraft' : 'Vessel'}</dd>
        </div>
        <div className="asset-detail__row">
          <dt>ID</dt>
          <dd className="asset-detail__mono">{asset.id}</dd>
        </div>
        <div className="asset-detail__row">
          <dt>Latitude</dt>
          <dd className="asset-detail__mono">{fmt(asset.latitude, 4)}°</dd>
        </div>
        <div className="asset-detail__row">
          <dt>Longitude</dt>
          <dd className="asset-detail__mono">{fmt(asset.longitude, 4)}°</dd>
        </div>
        {asset.altitude !== null && (
          <div className="asset-detail__row">
            <dt>Altitude</dt>
            <dd className="asset-detail__mono">{fmt(asset.altitude, 0)} m</dd>
          </div>
        )}
        <div className="asset-detail__row">
          <dt>Speed</dt>
          <dd className="asset-detail__mono">{fmt(asset.speed, 1)} {asset.type === 'aircraft' ? 'm/s' : 'kn'}</dd>
        </div>
        <div className="asset-detail__row">
          <dt>Heading</dt>
          <dd className="asset-detail__mono">{fmt(asset.heading, 0)}°</dd>
        </div>
        {asset.country && (
          <div className="asset-detail__row">
            <dt>Origin</dt>
            <dd>{asset.country}</dd>
          </div>
        )}
        <div className="asset-detail__row">
          <dt>Last Updated</dt>
          <dd className="asset-detail__mono">{asset.lastUpdated.toLocaleTimeString()}</dd>
        </div>
      </dl>
    </div>
  )
}
