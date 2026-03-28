import { useMemo } from 'react'
import { Entity } from 'resium'
import { Cartesian3, Color, Math as CesiumMath } from 'cesium'
import type { Asset } from '../types/Asset'
import type { Confidence } from '../types/Confidence'

interface AssetMarkerProps {
  asset:    Asset
  onSelect: (asset: Asset) => void
}

// Confidence score → billboard colour
const CONFIDENCE_COLORS: Record<Confidence, Color> = {
  'fresh':      Color.fromCssColorString('#4CAF50'), // green
  'stale':      Color.fromCssColorString('#FFA500'), // amber
  'very-stale': Color.fromCssColorString('#F44336'), // red
}

// SVG icon strings — aircraft points up (north), vessel is a hull shape.
// Encoded as data URLs so Cesium can use them as billboard images without a server round trip.
const AIRCRAFT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect x="15" y="4" width="2" height="20" fill="white"/>
  <polygon points="16,10 4,18 4,20 16,16 28,20 28,18" fill="white"/>
  <polygon points="16,22 11,28 11,30 16,27 21,30 21,28" fill="white"/>
</svg>`

const VESSEL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <polygon points="16,3 23,13 23,25 16,29 9,25 9,13" fill="white"/>
  <rect x="15" y="3" width="2" height="10" fill="rgba(0,0,0,0.3)"/>
</svg>`

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const AIRCRAFT_ICON = svgToDataUrl(AIRCRAFT_SVG)
const VESSEL_ICON   = svgToDataUrl(VESSEL_SVG)

export default function AssetMarker({ asset, onSelect }: AssetMarkerProps) {
  const position = useMemo(
    () => Cartesian3.fromDegrees(asset.longitude, asset.latitude, asset.altitude ?? 0),
    [asset.longitude, asset.latitude, asset.altitude],
  )

  const billboard = useMemo(() => ({
    image:  asset.type === 'aircraft' ? AIRCRAFT_ICON : VESSEL_ICON,
    color:  CONFIDENCE_COLORS[asset.confidence],
    // Convert heading (degrees clockwise from north) to Cesium rotation (radians counter-clockwise)
    rotation: asset.heading !== null ? -CesiumMath.toRadians(asset.heading) : 0,
    width:  32,
    height: 32,
    // Keep billboard facing the screen rather than rotating with the globe
    alignedAxis: Cartesian3.UNIT_Z,
  }), [asset.confidence, asset.heading, asset.type])

  return (
    <Entity
      position={position}
      billboard={billboard}
      onClick={() => onSelect(asset)}
    />
  )
}
