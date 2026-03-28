import type { Confidence } from './Confidence'

export type AssetType = 'aircraft' | 'vessel'

export interface Asset {
  id:          string
  type:        AssetType
  name:        string
  latitude:    number
  longitude:   number
  altitude:    number | null
  speed:       number | null
  heading:     number | null
  country:     string | null
  lastUpdated: Date
  confidence:  Confidence
}
