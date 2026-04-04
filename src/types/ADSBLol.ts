export interface ADSBAircraft {
  hex:           string            // ICAO24 identifier
  flight?:       string            // callsign (with trailing spaces)
  lat?:          number            // latitude
  lon?:          number            // longitude
  alt_baro?:     number | 'ground' // barometric altitude in feet, or 'ground' when on ground
  gs?:           number            // ground speed in knots
  track?:        number            // true track over ground (degrees)
  true_heading?: number            // true heading (degrees)
  seen_pos?:     number            // seconds since last position update
  r?:            string            // registration
  t?:            string            // aircraft type code
}

export interface ADSBResponse {
  ac:    ADSBAircraft[]
  msg:   string
  now:   number
  total: number
}
