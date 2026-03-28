export interface AISPositionReport {
  Cog:                number
  Latitude:           number
  Longitude:          number
  Sog:                number
  TrueHeading:        number
  NavigationalStatus: number
  UserID:             number
  Valid:              boolean
}

export interface AISMetaData {
  MMSI:        number
  MMSI_String: string
  ShipName:    string
  latitude:    number
  longitude:   number
  time_utc:    string
}

export interface AISMessage {
  Message: {
    PositionReport: AISPositionReport
  }
  MessageType: string
  MetaData:    AISMetaData
}
