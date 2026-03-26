# CLAUDE.md – LiveMux

AI assistant guide for this repository.

## Project Purpose

LiveMux — OBS-compatible live-streaming server: accepts RTMP from OBS, converts to HLS
for viewer playback, and provides a web admin dashboard for managing stream
keys, viewing active streams in a multi-grid layout, and accessing recordings.

## Architecture

```
OBS (RTMP push)
      │ port 1935
      ▼
┌─────────────┐   on_publish hook   ┌──────────────────┐
│  nginx-rtmp │ ──────────────────► │  Node.js API     │
│  (ingest)   │ ◄── 200/403 ─────── │  (Express)       │
└──────┬──────┘                     └────────┬─────────┘
       │ HLS segments (.m3u8 / .ts)          │ SQLite (stream keys)
       ▼                                     │ Redis  (active state)
  /hls/<key>.m3u8                            │
       │                                     │
       ▼                                     ▼
  Browser (hls.js)            Web admin dashboard (port 80)
```

### Containers (docker-compose.yml)

| Service | Image | Ports | Role |
|---------|-------|-------|------|
| `nginx` | debian:trixie-slim + nginx-rtmp | 1935, 80 | RTMP ingest, HLS, static files |
| `api`   | node:24-alpine | (internal 3000) | REST API |
| `redis` | redis:8-alpine | (internal 6379) | Active stream state |

## Directory Structure

```
Streaming-server/
├── nginx/
│   ├── Dockerfile        # ubuntu:22.04 + libnginx-mod-rtmp + ffmpeg
│   ├── nginx.conf        # RTMP→HLS config, auth hooks, static serving
│   └── stat.xsl          # RTMP stats stylesheet
├── api/
│   ├── src/
│   │   ├── app.js                    # Express app entry point
│   │   ├── db/database.js            # SQLite init + schema
│   │   ├── middleware/
│   │   │   ├── adminAuth.js          # X-Admin-Key header check
│   │   │   └── errorHandler.js       # Global error handler
│   │   ├── routes/
│   │   │   ├── auth.js               # on_publish / on_publish_done hooks
│   │   │   ├── streamKeys.js         # CRUD for stream keys
│   │   │   ├── streams.js            # Active stream listing
│   │   │   └── recordings.js         # Recording registry
│   │   └── services/
│   │       ├── streamKeyService.js   # Stream key business logic
│   │       ├── streamService.js      # Active stream tracking + sessions
│   │       ├── recordingService.js   # Recording file management
│   │       └── redisService.js       # Redis wrapper (optional, fails gracefully)
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── streamKeyService.test.js
│   │   │   ├── streamService.test.js
│   │   │   └── authRoutes.test.js
│   │   └── integration/
│   │       ├── streamKeys.test.js
│   │       └── streams.test.js
│   ├── package.json
│   └── Dockerfile
├── web/
│   ├── index.html        # SPA admin dashboard
│   ├── css/style.css
│   └── js/app.js         # Dashboard logic (vanilla JS + hls.js)
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.example
```

## Key Conventions

### API Security
- All admin endpoints require the `X-Admin-Key` header.
- The value must match `ADMIN_API_KEY` environment variable.
- The `on_publish` / `on_publish_done` hooks from nginx are **not** protected by
  the admin key (they are internal Docker network calls).

### Stream Key Format
- UUID v4 without dashes (32-character hex string).
- Generated server-side; clients never choose their own key.

### nginx ↔ API Auth Flow
1. OBS connects: `rtmp://host:1935/live/<STREAM_KEY>`
2. nginx sends `POST /api/auth/publish` with form body `name=<STREAM_KEY>&addr=<IP>`
3. API returns `200` (allow) or `403` (deny)
4. On disconnect nginx sends `POST /api/auth/publish-done`

### HLS Playback URL Pattern
```
http://<host>/hls/<STREAM_KEY>.m3u8
```

### Recording Files
- Stored as `.flv` in `/recordings` volume
- Filename pattern: `<STREAM_KEY>-YYYYMMDD-HHMMSS.flv`
- Registered in SQLite by the `on_record_done` hook

### Redis
- Used for cross-container active stream state (scaling)
- Falls back gracefully to in-memory Map if Redis is unavailable
- Key pattern: `stream:<KEY>:active` with 60-second TTL

## Development Workflows

### Run tests (no Docker required)
```bash
cd api
npm install
npm test                    # all suites
npm run test:unit           # unit only
npm run test:integration    # integration only
npm run test:coverage       # with coverage report
```

Tests use an in-memory SQLite database (`DB_PATH=:memory:`).

### Start locally with Docker
```bash
cp .env.example .env
# Edit ADMIN_API_KEY in .env
docker compose up --build
```

### Production deploy
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### OBS Configuration
- Server: `rtmp://<host>:1935/live`
- Stream Key: any active key from the admin dashboard

### Admin Dashboard
- URL: `http://<host>/`
- Enter your `ADMIN_API_KEY` in the sidebar Admin Key field (saved to localStorage)

## Adding Features

### Add a new API route
1. Create `api/src/routes/<name>.js`
2. Register in `api/src/app.js` with `app.use('/api/<name>', require('./routes/<name>'))`
3. Add tests in `api/tests/`

### Horizontal scaling
1. Add a second API instance in `docker-compose.prod.yml` (see commented example)
2. Place a load balancer (nginx upstream / Traefik) in front of both API instances
3. Redis already provides shared active-stream state across instances

### Add HTTPS / TLS
Use a reverse proxy (Caddy or nginx with certbot) in front of the streaming
stack, forwarding port 80 → container:80.  RTMP over TLS (RTMPS) requires
nginx compiled with OpenSSL – add `ssl` to the `listen 1935` directive.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NGINX_RTMP_PORT` | 1935 | Host port for RTMP |
| `NGINX_HTTP_PORT` | 80 | Host port for HTTP |
| `API_PORT` | 3000 | Internal API port |
| `ADMIN_API_KEY` | *(required)* | Admin API authentication key |
| `REDIS_HOST` | redis | Redis hostname |
| `REDIS_PORT` | 6379 | Redis port |
| `HLS_FRAGMENT_SECONDS` | 2 | HLS segment duration |
| `HLS_PLAYLIST_LENGTH` | 10 | HLS playlist window (seconds) |
| `RECORDING_ENABLED` | true | Enable recording |

## Testing Checklist

Before deploying:
- [ ] `npm test` passes (51 tests)
- [ ] `docker compose up --build` succeeds
- [ ] OBS can connect with a valid stream key
- [ ] OBS is rejected with an invalid stream key
- [ ] HLS URL loads in browser
- [ ] Multi-view grid shows all active streams
- [ ] Admin dashboard creates / deletes stream keys
