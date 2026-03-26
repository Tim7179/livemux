# LiveMux

Self-hosted RTMP/HLS streaming server — accepts streams from OBS, delivers HLS
to viewers, and provides a web admin dashboard for stream key management,
multi-grid monitoring, and recordings. Deployed entirely with Docker Compose.

## Features

- **RTMP ingest** on port 1935 – point OBS directly at this server
- **HLS output** – low-latency playback in any browser with [hls.js](https://github.com/video-dev/hls.js)
- **Stream key auth** – only approved keys can publish
- **Multi-view dashboard** – watch up to 16 simultaneous 1080p streams in a grid
- **Recording** – every stream session saved as `.flv`
- **REST API** – manage stream keys, sessions, and recordings programmatically
- **Redis-backed state** – ready for horizontal API scaling

## Quick Start

```bash
# 1. Clone and configure
git clone <repo>
cd livemux
cp .env.example .env
# Open .env and set ADMIN_API_KEY to a strong secret

# 2. Start
docker compose up --build -d

# 3. Open admin dashboard
open http://localhost
```

## OBS Setup

| Field | Value |
|-------|-------|
| Service | Custom |
| Server | `rtmp://<your-server-ip>:1935/live` |
| Stream Key | *(create one in the admin dashboard)* |

## Ports

| Port | Protocol | Use |
|------|----------|-----|
| 1935 | TCP | RTMP ingest from OBS |
| 80   | TCP | HLS playback, web dashboard, REST API |

## HLS Playback URL

```
http://<host>/hls/<STREAM_KEY>.m3u8
```

Playback works in any browser with hls.js or natively in Safari.

## REST API

All management endpoints require the `X-Admin-Key` header.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health check |
| GET | `/api/streams` | List active streams |
| GET | `/api/stream-keys` | List all stream keys |
| POST | `/api/stream-keys` | Create stream key `{ name, description }` |
| PATCH | `/api/stream-keys/:key` | Update name / active status |
| DELETE | `/api/stream-keys/:key` | Delete stream key |
| GET | `/api/recordings` | List recordings |
| DELETE | `/api/recordings/:filename` | Delete recording |

## Running Tests

```bash
cd api
npm install
npm test
```

51 tests across unit and integration suites.

## Architecture

```
OBS ──RTMP──► nginx-rtmp ──on_publish──► Node.js API ──► SQLite
                  │                           │
                  │ HLS segments              └──► Redis (active streams)
                  ▼
             Browser (hls.js)
```

See [CLAUDE.md](CLAUDE.md) for full developer documentation.

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

For horizontal scaling: add a second API container and point Redis at a shared
instance.  See `docker-compose.prod.yml` for the commented template.
