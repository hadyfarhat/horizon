import type { Confidence } from '../types/Confidence'

export function calculateConfidence(lastUpdated: Date): Confidence {
  const ageMinutes = (Date.now() - lastUpdated.getTime()) / 60000

  if (ageMinutes < 2)      return 'fresh'
  else if (ageMinutes < 5) return 'stale'
  else                     return 'very-stale'
}
