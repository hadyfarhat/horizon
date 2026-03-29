import { useState, useEffect, useCallback } from 'react'
import type { Asset } from './types/Asset'
import type { ConnectionStatus } from './types/ConnectionStatus'
import { fetchAircraft } from './services/opensky'
import { connectAISStream } from './services/aisstream'
import { calculateConfidence } from './utils/confidence'
import Globe from './components/Globe'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'

const AIRCRAFT_CAP           = 100
const VESSEL_CAP             = 50
const OPENSKY_INTERVAL_MS    = 15_000  // poll OpenSky every 15 seconds
const CONFIDENCE_INTERVAL_MS = 30_000  // recalculate confidence every 30 seconds

// Removes very-stale vessels first, then oldest by lastUpdated if still over cap.
// This keeps actively transmitting vessels on screen rather than rotating them out
// whenever a new message arrives.
function enforceVesselCap(map: Map<string, Asset>, cap: number): Map<string, Asset> {
  if (map.size <= cap) return map

  // First pass: remove very-stale vessels (silent for >5 minutes)
  const next = new Map(map)
  for (const [id, asset] of next) {
    if (asset.confidence === 'very-stale') next.delete(id)
    if (next.size <= cap) return next
  }

  // Second pass: if still over cap, remove oldest by lastUpdated
  const entries = [...next.entries()].sort(
    ([, a], [, b]) => b.lastUpdated.getTime() - a.lastUpdated.getTime() // newest first
  )
  return new Map(entries.slice(0, cap))
}

// Recalculates confidence for every asset in the map based on current time.
function refreshConfidence(map: Map<string, Asset>): Map<string, Asset> {
  const next = new Map(map)
  for (const [id, asset] of next) {
    next.set(id, { ...asset, confidence: calculateConfidence(asset.lastUpdated) })
  }
  return next
}

export default function App() {
  const [aircraft, setAircraft]             = useState<Map<string, Asset>>(new Map())
  const [vessels, setVessels]               = useState<Map<string, Asset>>(new Map())
  const [selectedAsset, setSelectedAsset]   = useState<Asset | null>(null)
  const [wsStatus, setWsStatus]           = useState<ConnectionStatus>('disconnected')
  const [openSkyStatus, setOpenSkyStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  // Fetches the latest aircraft snapshot from OpenSky and replaces state entirely.
  // OpenSky returns a complete snapshot of all airborne aircraft, so there is no
  // benefit to merging — replacing gives a clean, consistent view each poll.
  // Updates openSkyStatus to reflect whether the last fetch succeeded or failed.
  const pollOpenSky = useCallback(async () => {
    try {
      const assets = await fetchAircraft()

      // Sort by most recently contacted, keep the top AIRCRAFT_CAP
      const capped = assets
        .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
        .slice(0, AIRCRAFT_CAP)

      setAircraft(new Map(capped.map(a => [a.id, a])))
      setOpenSkyStatus('ok')

      // If the selected asset is an aircraft, update it with the latest position
      setSelectedAsset(prev => {
        if (prev?.type !== 'aircraft') return prev
        return assets.find(a => a.id === prev.id) ?? prev
      })
    } catch {
      // Mark as error so the status bar reflects the failed fetch
      setOpenSkyStatus('error')
    }
  }, [])

  useEffect(() => {
    // Initial OpenSky fetch then poll on interval
    pollOpenSky()
    const openSkyInterval = setInterval(pollOpenSky, OPENSKY_INTERVAL_MS)

    // Connect to AISStream via the SSE proxy
    const disconnectAIS = connectAISStream(
      (asset) => {
        setVessels(prev => {
          // Once at cap, only update vessels already being tracked — don't add new ones.
          // New vessels are admitted only when very-stale ones are pruned (every 30s).
          // This keeps the displayed set stable and prevents constant marker turnover.
          if (!prev.has(asset.id) && prev.size >= VESSEL_CAP) return prev

          const next = new Map(prev)
          next.set(asset.id, asset)
          return next
        })

        // If this vessel is currently selected, keep its detail panel up to date
        setSelectedAsset(prev => prev?.id === asset.id ? asset : prev)
      },
      (status) => setWsStatus(status),
    )

    // Recalculate confidence scores for all assets on a 30-second timer.
    // Also prune very-stale vessels to make room for newly active ones.
    const confidenceInterval = setInterval(() => {
      setAircraft(prev => refreshConfidence(prev))
      setVessels(prev => {
        const updated = refreshConfidence(prev)
        // Remove vessels that have been silent for over 5 minutes
        for (const [id, asset] of updated) {
          if (asset.confidence === 'very-stale') updated.delete(id)
        }
        return updated
      })
    }, CONFIDENCE_INTERVAL_MS)

    // Clean up all subscriptions and timers on unmount
    return () => {
      clearInterval(openSkyInterval)
      clearInterval(confidenceInterval)
      disconnectAIS()
    }
  }, [pollOpenSky])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <StatusBar openSkyStatus={openSkyStatus} wsStatus={wsStatus} />
      <Sidebar
        aircraft={aircraft}
        vessels={vessels}
        selectedAsset={selectedAsset}
      />
      <Globe
        aircraft={aircraft}
        vessels={vessels}
        selectedAsset={selectedAsset}
        onSelectAsset={setSelectedAsset}
      />
    </div>
  )
}
