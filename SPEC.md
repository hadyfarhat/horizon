# Horizon — Project Specification

> **Maritime & Air Domain Awareness Dashboard**

## Section 1 — Purpose

### Motivation

Horizon is a personal portfolio project built to explore geospatial data processing and visualisation. The project exists to demonstrate two things: the ability to learn and adapt quickly to new technology, and a practical understanding of the engineering principles behind real-time domain awareness systems — ingesting data from multiple sources, processing it, and presenting it in a meaningful way.

### Objective

The core objective is to apply the same engineering design pattern used in professional systems integration work — ingesting data from multiple sources, processing it into a common model, and presenting it visually — in the context of geospatial and maritime domain awareness.

In Horizon, this is achieved by:

- Ingesting live aircraft positions from the OpenSky Network REST API
- Ingesting live vessel positions from AISStream via WebSocket
- Processing both into a normalised common data model (the Asset model)
- Presenting them fused on a 3D CesiumJS globe

The use of two different data protocols (REST and WebSocket) is intentional. It demonstrates comfort working across multiple integration patterns, not just one.

### A Note on AI-Assisted Development

Horizon was built with the assistance of AI tooling. This is standard practice in modern software engineering. What matters is genuine understanding of every architectural and implementation decision made. The author can explain, justify, and if necessary rebuild every part of this system.

---

## Section 2 — Features

### Core Features

| # | Feature |
|---|---------|
| 1 | A full screen 3D Cesium globe as the main view |
| 2 | Live aircraft plotted as airplane icons, positions updated every 15 seconds via OpenSky Network REST API |
| 3 | Live vessels plotted as ship icons, positions updated in real time via AISStream WebSocket |
| 4 | Each marker oriented in the direction of travel using heading data |
| 5 | Click any marker to open a detail panel showing: name, type, coordinates, speed, heading, and country |
| 6 | A sidebar panel showing asset counts and a live feed of recently updated assets |
| 7 | Data confidence score — each asset colour coded by how recently its position was reported |
| 8 | WebSocket auto-reconnection with exponential backoff if AISStream disconnects |
| 9 | Connection status indicator showing live or reconnecting state |
| 10 | Asset display cap — 300 aircraft and 200 vessels maximum, showing most recently updated |

#### Confidence score colour coding

| Status | Threshold | Colour |
|--------|-----------|--------|
| Fresh | Under 2 minutes | 🟢 Green |
| Stale | 2 to 5 minutes | 🟡 Amber |
| Very stale | Over 5 minutes | 🔴 Red |

### Out of Scope

- User authentication
- Persisting or saving data
- Mobile responsiveness
- Backend server (everything runs client side)
- Satellite tracking
- Historical tracks

---

## Section 3 — Data Sources

### 3.1 OpenSky Network — Aircraft

| Property | Value |
|----------|-------|
| URL | `https://opensky-network.org/api/states/all` |
| Protocol | REST (HTTP GET) |
| Authentication | None required for basic use. Register for higher rate limits. |
| Update frequency | Polled by the app every 15 seconds |
| Response | JSON object with a `states` array. Each state vector is a positional array — fields identified by index. |

#### Fields used from each state vector

| Index | Field | Used for |
|-------|-------|----------|
| 0 | ICAO24 | Unique aircraft ID |
| 1 | Callsign | Label and sidebar (trim trailing spaces) |
| 2 | Origin country | Sidebar detail |
| 4 | Last contact (Unix) | Confidence score calculation |
| 5 | Longitude | Globe position |
| 6 | Latitude | Globe position |
| 7 | Altitude (m) | 3D positioning (can be null) |
| 8 | On ground | Boolean — filter out grounded aircraft |
| 9 | Velocity (m/s) | Sidebar detail (can be null) |
| 10 | Heading (deg) | Marker orientation (can be null) |

#### Notes

- Callsigns have trailing spaces — must be trimmed
- Many fields can be null — handle gracefully throughout
- Filter out aircraft where index 8 (`on_ground`) is `true`
- Filter out aircraft where latitude or longitude is `null`

---

### 3.2 AISStream — Vessels

| Property | Value |
|----------|-------|
| URL | `wss://stream.aisstream.io/v0/stream` |
| Protocol | WebSocket (persistent connection) |
| Authentication | API key sent in subscription message on connect |
| Update frequency | Real time — server pushes whenever a vessel transmits its position |

#### Subscription message to send on connect

```json
{
  "APIKey": "YOUR_API_KEY",
  "BoundingBoxes": [[[-90, -180], [90, 180]]],
  "FilterMessageTypes": ["PositionReport"]
}
```

#### Response structure

```json
{
  "Message": {
    "PositionReport": {
      "Cog": 196.2,
      "Sog": 0,
      "TrueHeading": 104,
      "NavigationalStatus": 0,
      "Valid": true
    }
  },
  "MessageType": "PositionReport",
  "MetaData": {
    "MMSI": 246502000,
    "ShipName": "GRUNO4",
    "latitude": 53.44514,
    "longitude": 6.82334,
    "time_utc": "2026-03-28 10:26:15.262 +0000 UTC"
  }
}
```

#### Fields used

| Field | Location | Used for |
|-------|----------|----------|
| `ShipName` | MetaData | Label and sidebar |
| `MMSI` | MetaData | Unique vessel ID |
| `latitude` | MetaData | Globe position |
| `longitude` | MetaData | Globe position |
| `time_utc` | MetaData | Confidence score calculation |
| `Cog` | PositionReport | Course over ground (direction of travel) |
| `Sog` | PositionReport | Speed over ground — sidebar detail |
| `TrueHeading` | PositionReport | Marker orientation |
| `NavigationalStatus` | PositionReport | Underway / anchored / moored |

#### Notes

- Messages arrive in binary format — parse with `JSON.parse(event.data)`
- Connection must handle disconnection with exponential backoff reconnection
- See Section 4.5 for reconnection logic

---

### 3.3 Confidence Score Thresholds

Both APIs provide a timestamp for the last known position. Compare against current time:

| Status | Threshold | Colour |
|--------|-----------|--------|
| Fresh | Under 2 minutes | Green |
| Stale | 2 to 5 minutes | Amber |
| Very stale | Over 5 minutes | Red |

Confidence is recalculated on every asset update and on a 30-second interval timer for all existing assets.

---

## Section 4 — Architecture

### 4.1 Overview

Horizon is a single-page React application with no backend. All data fetching, processing and rendering happens client-side in the browser. Two data pipelines run in parallel — one for aircraft, one for vessels — feeding into a shared state layer that drives the Cesium globe and sidebar.

### 4.2 Data Flow

```
OpenSky REST API              AISStream WebSocket
      |                               |
      | HTTP GET every 15s            | Persistent WSS connection
      |                               | Messages pushed in real time
      v                               v
Aircraft Service              Vessel Service
- Fetch and parse             - Connect and subscribe
- Filter grounded aircraft    - Parse binary JSON
- Normalise to Asset model    - Normalise to Asset model
      |                               |
      v                               v
            Shared Application State
            (React useState / useRef)
            - Aircraft map: ICAO24 -> Asset
            - Vessel map: MMSI -> Asset
            - Selected asset
            - WebSocket connection status
            - OpenSky loading state
                       |
             ┌──────────┴──────────┐
             v                     v
        Cesium Globe           Sidebar Panel
        - Plot markers         - Asset counts
        - Orient by heading    - Live asset feed
        - Colour by            - Selected asset detail
          confidence           - Connection status
```

### 4.3 The Common Asset Model

Both data sources are normalised into a single shared structure. This is the processing (data fusion) step — raw API data goes in, a clean `Asset` object comes out. The rest of the app does not need to know where the data came from.

```typescript
interface Asset {
  id:          string              // ICAO24 for aircraft, MMSI for vessels
  type:        'aircraft' | 'vessel'
  name:        string              // callsign or ship name
  latitude:    number
  longitude:   number
  altitude:    number | null       // null for vessels
  speed:       number | null
  heading:     number | null
  country:     string | null
  lastUpdated: Date                // used for confidence score
  confidence:  'fresh' | 'stale' | 'very-stale'
}
```

### 4.4 Confidence Score Calculation

Runs on every asset update and on a 30-second interval timer:

```typescript
const ageMinutes = (Date.now() - asset.lastUpdated.getTime()) / 60000

if (ageMinutes < 2)      confidence = 'fresh'
else if (ageMinutes < 5) confidence = 'stale'
else                     confidence = 'very-stale'
```

### 4.5 WebSocket Reconnection (Exponential Backoff)

```typescript
let reconnectDelay = 1000 // start at 1 second

socket.onclose = () => {
  setTimeout(() => {
    connect()
    reconnectDelay = Math.min(reconnectDelay * 2, 30000) // max 30 seconds
  }, reconnectDelay)
}
```

### 4.6 Asset Cap Enforcement

When the asset map exceeds the cap (300 aircraft, 200 vessels), remove the oldest assets by `lastUpdated` first. This keeps the globe performant and ensures the most current data is always displayed.

---

## Section 5 — Components

### 5.1 Component Tree

```
App
├── StatusBar
├── Globe
│   └── AssetMarker (one per asset)
└── Sidebar
    ├── Header
    ├── AssetCounts
    ├── AssetDetail
    └── AssetFeed
```

### 5.2 Component Responsibilities

#### `App`
Root component. Owns all application state. Runs the OpenSky polling interval and the AISStream WebSocket connection. Passes data down as props.

#### `StatusBar`
Displayed prominently in the UI. Combines both data loading states side by side:
- **OpenSky loading indicator** — spinning icon shown for the first 15 seconds while the initial aircraft fetch completes
- **WebSocket status indicator** — colour coded dot:
  - 🟢 Green dot + "Live" — connected
  - 🟡 Amber dot + "Reconnecting" — reconnecting
  - 🔴 Red dot + "Disconnected" — disconnected

#### `Globe`
Renders the Resium/CesiumJS viewer. Iterates over all assets and renders an `AssetMarker` for each one. Handles click events and passes the selected asset up to App.

#### `AssetMarker`
A single marker on the globe. Receives one `Asset` object. Renders the correct icon (airplane for aircraft, ship for vessel), orients it by heading, and colours it by confidence score.

#### `Sidebar`
The left panel. Receives assets and selected asset as props. Renders all sub-components.

#### `Header`
Displays the Horizon title and subtitle.

#### `AssetCounts`
Two metric cards side by side — total aircraft count (blue) and total vessel count (green).

#### `AssetDetail`
Renders when an asset is selected. Shows all fields from the Asset model. Shows empty state when nothing is selected.

#### `AssetFeed`
Scrollable list of the 20 most recently updated assets. Each row shows: icon, name, confidence badge, last updated time.

### 5.3 State in App

```typescript
const [aircraft, setAircraft] =
  useState<Map<string, Asset>>(new Map())

const [vessels, setVessels] =
  useState<Map<string, Asset>>(new Map())

const [selectedAsset, setSelectedAsset] =
  useState<Asset | null>(null)

const [wsStatus, setWsStatus] =
  useState<ConnectionStatus>('disconnected')

const [openSkyLoading, setOpenSkyLoading] =
  useState<boolean>(true)
```

---

## Section 6 — Tech Stack

| Technology | Purpose |
|------------|---------|
| React | UI framework |
| TypeScript | Type safety across the entire codebase |
| Vite | Build tool — fast dev server and production build |
| Resium | React wrapper for CesiumJS |
| CesiumJS | 3D globe engine |
| Axios | HTTP requests for OpenSky REST API |
| Native WebSocket | AISStream connection (no library needed) |
| Vercel | Deployment and hosting |

---

## Section 7 — Environment Variables

Store in a `.env` file in the project root. **Never commit to GitHub.** Add `.env` to `.gitignore` before the first commit.

```
VITE_CESIUM_TOKEN=your_cesium_ion_access_token
VITE_AISSTREAM_KEY=your_aisstream_api_key
VITE_OPENSKY_CLIENT_ID=your_opensky_client_id
VITE_OPENSKY_CLIENT_SECRET=your_opensky_client_secret
```

OpenSky Network uses OAuth2 client credentials flow. Obtain `client_id` and `client_secret` from the OpenSky Account page. Do not commit `credentials.json` — add it to `.gitignore` and copy the values into `.env`.

When deploying to Vercel, set these variables in the Vercel dashboard under **Project Settings > Environment Variables**.

---

## Section 8 — Repository Structure

```
horizon/
├── src/
│   ├── components/
│   │   ├── Globe.tsx
│   │   ├── AssetMarker.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── AssetCounts.tsx
│   │   ├── AssetDetail.tsx
│   │   ├── AssetFeed.tsx
│   │   └── StatusBar.tsx
│   ├── services/
│   │   ├── opensky.ts
│   │   └── aisstream.ts
│   ├── types/
│   │   ├── Asset.ts
│   │   ├── OpenSky.ts
│   │   ├── AISStream.ts
│   │   ├── Confidence.ts
│   │   └── ConnectionStatus.ts
│   ├── utils/
│   │   └── confidence.ts
│   └── App.tsx
├── public/
├── .env                  ← never commit
├── .gitignore
├── README.md
├── SPEC.md
└── vite.config.ts
```

### Type Definitions

#### `types/Asset.ts`

```typescript
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
```

#### `types/OpenSky.ts`

```typescript
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
```

#### `types/AISStream.ts`

```typescript
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
```

#### `types/Confidence.ts`

```typescript
export type Confidence = 'fresh' | 'stale' | 'very-stale'

export interface ConfidenceThresholds {
  freshMaxMinutes: number   // default: 2
  staleMaxMinutes: number   // default: 5
}
```

#### `types/ConnectionStatus.ts`

```typescript
export type ConnectionStatus =
  'connected' | 'reconnecting' | 'disconnected'

export interface ConnectionState {
  status:            ConnectionStatus
  reconnectAttempts: number
  lastConnected:     Date | null
}
```

---

## Section 9 — Build and Deployment

### Build

```bash
npm run build
```

This produces a `dist/` folder containing the production build.

### Deployment

1. Connect the GitHub repo to Vercel at [vercel.com](https://vercel.com)
2. Vercel automatically detects Vite and configures the build settings
3. Set environment variables in Vercel dashboard under **Project Settings > Environment Variables**:
   - `VITE_CESIUM_TOKEN`
   - `VITE_AISSTREAM_KEY`
   - `VITE_OPENSKY_CLIENT_ID`
   - `VITE_OPENSKY_CLIENT_SECRET`
4. Every push to `main` triggers an automatic redeploy
5. Copy the live Vercel URL and add it to the README and cover letter

---

## Section 10 — Tasks

Work through tasks in order. Complete and confirm each task before moving on. Commit to GitHub after each completed phase.

---

### Phase 1 — Setup

- **Task 01** — Confirm Cesium Ion account exists and access token is available
- **Task 02** — Confirm AISStream account exists and API key is available
- **Task 03** — Confirm OpenSky Network account exists
- **Task 04** — Confirm GitHub repo `horizon` exists and is initialised
- **Task 05** — Scaffold the project:
  ```bash
  npm create vite@latest . -- --template react-ts
  npm install
  ```
  > Commit: `feat: initial project scaffold with React and TypeScript`

---

### Phase 2 — Dependencies and Config

- **Task 06** — Install runtime dependencies:
  ```bash
  npm install resium cesium axios
  ```
- **Task 07** — Install dev dependencies:
  ```bash
  npm install vite-plugin-cesium --save-dev
  ```
- **Task 08** — Configure `vite.config.ts` for CesiumJS static assets using `vite-plugin-cesium`
- **Task 09** — Create `.env` file with tokens. Verify `.env` is in `.gitignore` before any commit.
- **Task 10** — Create the full folder structure:
  ```
  src/components/
  src/services/
  src/types/
  src/utils/
  ```
  > Commit: `feat: install dependencies and configure Vite for CesiumJS`

---

### Phase 3 — Types

- **Task 11** — Create `src/types/Asset.ts` — `AssetType`, `Asset` interface
- **Task 12** — Create `src/types/OpenSky.ts` — `OpenSkyStateVector`, `OpenSkyResponse`
- **Task 13** — Create `src/types/AISStream.ts` — `AISPositionReport`, `AISMetaData`, `AISMessage`
- **Task 14** — Create `src/types/Confidence.ts` — `Confidence` type, `ConfidenceThresholds` interface
- **Task 15** — Create `src/types/ConnectionStatus.ts` — `ConnectionStatus` type, `ConnectionState` interface

  > Commit: `feat: add TypeScript type definitions for all data models`

---

### Phase 4 — Utils

- **Task 16** — Create `src/utils/confidence.ts`
  - Implement `calculateConfidence(lastUpdated: Date): Confidence`
  - Use thresholds from Section 3.3

  > Commit: `feat: add confidence score utility`

---

### Phase 5 — Services

- **Task 17** — Create `src/services/opensky.ts`
  - OpenSky requires OAuth2 client credentials flow — no unauthenticated access
  - Implement `getAccessToken()` — POST to `https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token` with `client_id` and `client_secret` (`grant_type=client_credentials`)
  - Cache the token in module scope; track expiry (tokens last 30 minutes — cache for 29 to be safe)
  - On 401 response from `/states/all`, invalidate the cached token and retry once with a fresh token
  - `fetchAircraft()` — call `getAccessToken()`, then GET `/states/all` with `Authorization: Bearer <token>` header
  - Parse `OpenSkyStateVector` array
  - Filter out on-ground aircraft (index 8 === `true`)
  - Filter out aircraft with null latitude or longitude
  - Trim callsign trailing spaces
  - Normalise each valid state vector to `Asset` model
  - Return `Asset[]`
  - Read credentials from `import.meta.env.VITE_OPENSKY_CLIENT_ID` and `import.meta.env.VITE_OPENSKY_CLIENT_SECRET`

  > Commit: `feat: implement OpenSky service with OAuth2 and normalisation to Asset`

- **Task 18** — Create `src/services/aisstream.ts`
  - `connectAISStream(onAsset, onStatusChange): void`
  - Open WebSocket to `wss://stream.aisstream.io/v0/stream`
  - On open: send subscription message with API key and global bounding box, filtering for `PositionReport` only
  - On message: parse JSON, normalise `AISMessage` to `Asset`, call `onAsset(asset)`
  - On close: update status to reconnecting, implement exponential backoff reconnection (start 1s, double each attempt, max 30s)
  - On error: log error, trigger reconnection
  - Update connection status via `onStatusChange` callback

  > Commit: `feat: implement AISStream WebSocket service with reconnection`

---

### Phase 6 — Components

- **Task 19** — Create `src/App.tsx`
  - Declare all state (see Section 5.3)
  - On mount: start OpenSky polling interval (every 15 seconds)
  - On mount: connect AISStream WebSocket
  - After first OpenSky fetch: set `openSkyLoading` to `false`
  - Enforce asset caps on each update (Section 4.6)
  - Recalculate confidence scores every 30 seconds
  - Pass state to `Globe`, `Sidebar`, `StatusBar` as props
  - Clean up interval and WebSocket on unmount

  > Commit: `feat: implement App with state management and data services`

- **Task 20** — Create `src/components/Globe.tsx`
  - Render Resium Viewer filling the screen
  - Iterate over aircraft and vessels, render `AssetMarker` for each
  - Handle marker click — call `onSelectAsset(asset)`

  > Commit: `feat: render Cesium globe with asset markers`

- **Task 21** — Create `src/components/AssetMarker.tsx`
  - Receive `Asset` as prop
  - Render airplane icon for aircraft, ship icon for vessels
  - Orient marker using heading value
  - Apply colour based on confidence score:
    - `fresh` → green
    - `stale` → amber
    - `very-stale` → red

  > Commit: `feat: implement AssetMarker with icon, orientation and confidence colour`

- **Task 22** — Create `src/components/StatusBar.tsx`
  - Receive `openSkyLoading` and `wsStatus` as props
  - Show spinning loader while `openSkyLoading` is `true` (first 15s)
  - Show WebSocket status dot (see Section 5.2)
  - Display both indicators side by side

  > Commit: `feat: implement StatusBar with OpenSky loader and WebSocket status`

- **Task 23** — Create `src/components/Sidebar.tsx`
  - Layout wrapper for all sidebar sub-components
  - Fixed width left panel

  > Commit: `feat: implement Sidebar layout`

- **Task 24** — Create `src/components/Header.tsx`
  - Display "HORIZON" title
  - Subtitle: "Domain Awareness Dashboard"

- **Task 25** — Create `src/components/AssetCounts.tsx`
  - Receive aircraft count and vessel count as props
  - Render two metric cards side by side
  - Aircraft count — blue
  - Vessel count — green

- **Task 26** — Create `src/components/AssetDetail.tsx`
  - Receive `selectedAsset` as prop (can be `null`)
  - When `null`: show empty state — "Select an asset to view details"
  - When asset selected: show all `Asset` fields in a clean panel
  - Show confidence badge with appropriate colour

- **Task 27** — Create `src/components/AssetFeed.tsx`
  - Receive all assets as prop
  - Sort by `lastUpdated` descending
  - Display the 20 most recently updated
  - Each row: icon, name, confidence badge, last updated time

  > Commit: `feat: implement all Sidebar sub-components`

---

### Phase 7 — Polish

- **Task 28** — Apply dark tactical UI theme across all components
  - Dark navy background (`#0a1628` or similar)
  - Muted blue sidebar panel
  - Clean sans-serif typography
  - Consistent spacing and padding

- **Task 29** — Test asset cap enforcement
  - Verify aircraft list never exceeds 300
  - Verify vessel list never exceeds 200
  - Verify oldest assets are removed first

- **Task 30** — Test WebSocket reconnection
  - Disconnect network briefly
  - Verify status bar shows reconnecting
  - Verify connection re-establishes automatically

- **Task 31** — Test confidence score colour coding
  - Verify fresh assets show green
  - Verify stale assets show amber after 2 minutes
  - Verify very stale assets show red after 5 minutes

- **Task 32** — Remove all `console.log` statements from production code

- **Task 33** — Test in Chrome and Firefox — verify globe renders correctly

  > Commit: `chore: polish UI, test features, remove console logs`

---

### Phase 8 — Deployment

- **Task 34** — Run `npm run build` — verify `dist/` folder is produced with no errors
- **Task 35** — Connect GitHub repo to Vercel at [vercel.com](https://vercel.com) — Vercel auto-detects Vite configuration
- **Task 36** — Set environment variables in Vercel dashboard:
  - `VITE_CESIUM_TOKEN`
  - `VITE_AISSTREAM_KEY`
- **Task 37** — Trigger a deploy — verify live URL works correctly:
  - Globe renders
  - Aircraft appear within 15 seconds
  - Vessels appear shortly after
  - Click interaction works
  - Status bar shows connected
- **Task 38** — Copy live Vercel URL and add to README

  > Commit: `chore: add live demo URL to README`

---

### Phase 9 — Documentation

- **Task 39** — Write `README.md` with the following sections:
  - Project title and one-line description
  - Live demo link (Vercel URL)
  - Why this was built and what it demonstrates
  - Architecture diagram showing the data flow:
    ```
    OpenSky REST  → Aircraft Service → Asset → Globe
    AISStream WSS → Vessel Service   → Asset → Globe
    ```
  - Tech stack table
  - How to run locally (`clone`, `npm install`, add `.env`, `npm run dev`)
  - Environment variables needed
  - Data sources explanation

---

*End of spec.*
