export type OpenSkyStateVector = [
  string,          // 0: icao24
  string | null,   // 1: callsign
  string,          // 2: origin_country
  number | null,   // 3: time_position
  number,          // 4: last_contact
  number | null,   // 5: longitude
  number | null,   // 6: latitude
  number | null,   // 7: baro_altitude
  boolean,         // 8: on_ground
  number,          // 9: velocity
  number | null,   // 10: true_track (heading)
  number | null,   // 11: vertical_rate
  null,            // 12: sensors
  number | null,   // 13: geo_altitude
  string | null,   // 14: squawk
  boolean,         // 15: spi
  number           // 16: position_source
]

export interface OpenSkyResponse {
  time:   number
  states: OpenSkyStateVector[] | null
}
