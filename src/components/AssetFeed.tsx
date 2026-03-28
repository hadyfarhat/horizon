import type { Asset } from '../types/Asset'
import type { Confidence } from '../types/Confidence'
import './AssetFeed.css'

interface AssetFeedProps {
  assets: Asset[]
}

const FEED_LIMIT = 20

const CONFIDENCE_CLASSES: Record<Confidence, string> = {
  'fresh':      'feed-badge--fresh',
  'stale':      'feed-badge--stale',
  'very-stale': 'feed-badge--very-stale',
}

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  'fresh':      'Fresh',
  'stale':      'Stale',
  'very-stale': 'Very Stale',
}

// Formats a Date to a short HH:MM:SS string for the feed rows
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function AssetFeed({ assets }: AssetFeedProps) {
  // Sort newest first and take the top 20
  const feed = assets
    .slice()
    .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
    .slice(0, FEED_LIMIT)

  return (
    <div className="asset-feed">
      <h2 className="asset-feed__title">Recent Activity</h2>

      {feed.length === 0 ? (
        <p className="asset-feed__empty">Waiting for data…</p>
      ) : (
        <ul className="asset-feed__list">
          {feed.map(asset => (
            <li key={asset.id} className="asset-feed__row">
              <span className="asset-feed__icon">
                {asset.type === 'aircraft' ? '✈' : '⛵'}
              </span>
              <span className="asset-feed__name">{asset.name}</span>
              <span className={`feed-badge ${CONFIDENCE_CLASSES[asset.confidence]}`}>
                {CONFIDENCE_LABELS[asset.confidence]}
              </span>
              <span className="asset-feed__time">{formatTime(asset.lastUpdated)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
