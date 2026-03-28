export type Confidence = 'fresh' | 'stale' | 'very-stale'

export interface ConfidenceThresholds {
  freshMaxMinutes: number  // default: 2
  staleMaxMinutes: number  // default: 5
}
