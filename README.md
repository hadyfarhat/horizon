# Horizon

> **Note:** This project originally used the OpenSky Network API for live aircraft data. OpenSky has since blocked Cloudflare IP ranges (which Vercel's infrastructure uses), making it impossible to call from a deployed serverless environment. The project has been migrated to [adsb.lol](https://adsb.lol) as a result.

**Maritime & Air Domain Awareness Dashboard** — live aircraft and vessel positions fused on a 3D globe.

**Live demo:** https://horizon-demo-three.vercel.app

---

## What this demonstrates

Horizon applies the same design pattern used in professional systems integration: ingest data from multiple heterogeneous sources, process it into a common model, and present it in a meaningful way.

Specifically:

- Two live data pipelines running in parallel — one REST, one WebSocket
- A common `Asset` model that normalises both sources so the rest of the app is source-agnostic
- Server-side proxy functions (Vercel) to handle CORS restrictions and keep credentials out of the browser
- Real-time connection management with heartbeat/watchdog and auto-reconnect
- A confidence scoring system that colour-codes markers by data freshness

---

## Architecture

```
OpenSky REST API                    AISStream WebSocket
      |                                     |
      | poll every 15s                      | real-time push
      v                                     v
api/opensky.ts (Vercel Edge fn)     api/aisstream.ts (Vercel fn, SSE relay)
- Basic auth                         - Connects to AISStream server-side
- Bounding box: Northern Europe      - Forwards PositionReports via SSE
- Returns state vectors              - Heartbeat every 10s
      |                                     |
      v                                     v
src/services/opensky.ts             src/services/aisstream.ts
- Normalise state vectors            - Normalise AISMessage
- Filter grounded aircraft           - 25s watchdog + auto-reconnect
      |                                     |
      v                                     v
                  Common Asset Model
      { id, type, name, lat, lon, altitude,
        speed, heading, country, lastUpdated, confidence }
                          |
              .-----------+-----------.
              v                       v
         Cesium Globe             Sidebar Panel
         - Billboard markers      - Asset counts
         - Oriented by heading    - Live feed (20 most recent)
         - Coloured by confidence - Selected asset detail
                                  - Connection status
```

AISStream blocks direct browser WebSocket connections. Both data sources run through Vercel functions: OpenSky as an Edge function (runs on Cloudflare's network, bypassing OpenSky's AWS IP blocks), AISStream as a Node.js SSE relay bridging the server-side WebSocket to the browser.

---

## Tech stack

| Technology | Purpose |
|------------|---------|
| React + TypeScript | UI framework |
| Vite 5 | Build tool |
| Resium + CesiumJS | 3D globe rendering |
| Vercel Edge Function | OpenSky proxy (Cloudflare network) |
| Vercel Serverless Function | AISStream SSE relay |
| SSE (EventSource) | Browser transport for real-time vessel data |

---

## Running locally

```bash
git clone https://github.com/your-username/horizon.git
cd horizon
npm install
```

Create a `.env` file in the project root:

```
VITE_CESIUM_TOKEN=your_cesium_ion_access_token
VITE_AISSTREAM_KEY=your_aisstream_api_key
VITE_OPENSKY_USERNAME=your_opensky_username
VITE_OPENSKY_PASSWORD=your_opensky_password
```

Start the dev server (Vercel CLI required for the API functions):

```bash
npx vercel dev
```

The app will be available at `http://localhost:3000`.

---

## Environment variables

| Variable | Where to get it |
|----------|----------------|
| `VITE_CESIUM_TOKEN` | [cesium.com/ion](https://cesium.com/ion) — Access Tokens |
| `VITE_AISSTREAM_KEY` | [aisstream.io](https://aisstream.io) — API Keys |
| `VITE_OPENSKY_USERNAME` | [opensky-network.org](https://opensky-network.org) — register for a free account |
| `VITE_OPENSKY_PASSWORD` | Same as above |

For Vercel deployment, set these in **Project Settings > Environment Variables**.

---

## Data sources

**OpenSky Network** — provides a REST API returning the current state of all tracked airborne aircraft. Each state vector is a positional array containing ICAO24 identifier, callsign, coordinates, altitude, speed, heading, and last contact timestamp. Polled every 15 seconds, restricted to Northern Europe (lat 48–72°N, lon −10–30°E).

**AISStream** — provides real-time AIS (Automatic Identification System) vessel position data via WebSocket. AIS is the maritime equivalent of aircraft transponders — vessels broadcast their position, speed, and heading continuously. Restricted to Northern Europe to keep message volume manageable. The connection is maintained through a server-side SSE relay with heartbeat-based dead connection detection.
