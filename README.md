# Voltiq — Energy Consumption Monitoring Dashboard

A cloud analytics application for monitoring, analysing, and managing energy
usage across multiple devices and locations in real time.

Two services:

| Service | Stack | Port |
|---|---|---|
| `backend/` | Node.js · Express · TypeScript · Prisma · PostgreSQL | 4000 |
| `frontend/` | Next.js (App Router) · TypeScript · Tailwind · Recharts | 3000 |

---

## Quick start

Prerequisites: **Node 18+**, **PostgreSQL 14+** running locally.

```bash
# 1. Create the database
createdb energy_dashboard

# 2. Backend
cd backend
cp .env.example .env          # then edit DATABASE_URL for your machine
npm install
npm run db:migrate            # creates the schema
npm run seed                  # 60 days of history across 13 devices
npm run dev                   # http://localhost:4000

# 3. Frontend (in a second terminal)
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

Then open <http://localhost:3000> and sign in with a seeded account:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@voltiq.io` | `admin1234` |
| Viewer | `viewer@voltiq.io` | `viewer1234` |

Both are offered as one-click fills on the login screen.

### Environment variables

**`backend/.env`**

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string (required) |
| `PORT` | `4000` | API port |
| `JWT_SECRET` | — | Secret used to sign JWTs (required) |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowed origins |
| `REALTIME_INGEST_ENABLED` | `true` | Pull no-key public realtime APIs into the app |
| `REALTIME_INGEST_POLL_MS` | `60000` | How often realtime readings are fetched and stored |
| `REALTIME_LATITUDE` / `REALTIME_LONGITUDE` | Bengaluru | Coordinates used by Open-Meteo |
| `REALTIME_TIMEZONE` | `Asia/Kolkata` | Site timezone for the realtime feed |
| `REALTIME_BASE_LOAD_KW` | `8` | Baseline load used by the no-hardware estimation model |
| `REALTIME_SOLAR_CAPACITY_KW` | `5` | Solar capacity used to convert irradiance into estimated generation |
| `REALTIME_DEMAND_ALERT_KW` | `12` | Demand alert threshold |
| `REALTIME_CARBON_ALERT_G_PER_KWH` | `300` | Carbon intensity alert threshold |
| `SIMULATOR_ENABLED` | `false` | Optional fallback demo simulator |
| `SIMULATOR_TICK_MS` | `4000` | Simulator tick interval if the fallback is explicitly enabled |

**`frontend/.env.local`**

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Base URL of the API |

---

## What's in it

**Dashboard** — KPI cards (consumption, cost, carbon, active devices) with
period-over-period deltas and animated counters; a consumption trend chart with
24h/7d/30d/90d toggles and an energy/cost switch; breakdowns by device type and
by location; a live-usage widget fed by SSE; and an anomaly feed.

**Analytics** — period-vs-period comparison, device-vs-device and
site-vs-site comparison, an hour-of-day × day-of-week peak heatmap, a
straight-line month-end cost projection, and CSV export over any date range.

**Devices** — searchable/filterable table with live per-device draw, 24h energy
and cost, efficiency score, and full CRUD (admin only). Each device has a detail
page with a drag-to-zoom time series, threshold configuration, and its own
alert history.

**Alerts** — severity-classified log with filters, single and bulk
acknowledge, and a toast that fires when a new alert arrives while you're
using the app.

**Settings** — theme (light/dark/system), notification preferences, location
management, global tariff and carbon-intensity config, and user administration
with role management.

---

## How the data works

The live data path is now driven by no-key public realtime APIs in
[`backend/src/services/realtimeIngest.ts`](backend/src/services/realtimeIngest.ts):

- **Open-Meteo** provides realtime temperature, cloud cover, and shortwave
  radiation for the configured latitude/longitude.
- **UK Carbon Intensity API** provides realtime grid carbon intensity and
  powers carbon alerts/settings.

Because there is no physical meter or Arduino measuring the building, the app
converts those real external signals into estimated energy readings:

```
demand kW = base load + temperature cooling factor + cloud lighting factor
solar kW  = shortwave radiation ratio × configured solar capacity
net kW    = demand kW - solar kW
```

Every poll writes real-time-derived `Reading` rows into PostgreSQL for two
auto-created devices:

- `Estimated Building Load` — positive consumption.
- `Estimated Solar Generation` — negative generation, so netting works in the
  existing analytics SQL.

The worker also broadcasts SSE `live` events, broadcasts `reading` invalidation
events so charts refresh, and creates threshold/carbon alerts. The old
simulator still exists in [`backend/src/services/simulator.ts`](backend/src/services/simulator.ts),
but it is disabled by default and should stay disabled when presenting the app
as a realtime external-data dashboard.

### Time zones

Prisma stores `DateTime` as `timestamp(3)` holding the UTC instant. Bucketing
that directly would split "days" at UTC midnight, which is the wrong boundary
for anyone not on UTC. Every bucket expression in
[`analytics.ts`](backend/src/services/analytics.ts) therefore re-interprets the
column as UTC, converts it into the caller's zone, truncates, and converts back:

```sql
date_trunc('day', ts AT TIME ZONE 'UTC' AT TIME ZONE $tz) AT TIME ZONE $tz
```

The browser sends its IANA zone as `?tz=` on every analytics request. The
simulator derives its load shapes from server-local time and the seed anchors
each site to that same zone, so "8am on the chart" means "8am in the shift
pattern".

---

## Design system

Tokens live in [`frontend/app/globals.css`](frontend/app/globals.css) and are
the single source of truth — Tailwind maps its colour, radius, and shadow
scales onto CSS custom properties, so no component holds a raw hex value and
light/dark swap in one place.

The **semantic energy states** are deliberately not generic red/yellow/green:
`optimal` is a cool jade, `elevated` a deep amber, `high` a burnt orange, and
`critical` a muted crimson. All four clear 3:1 against both mode surfaces.

The **categorical series palette** (used for device types) was validated
against the lightness band, chroma floor, Machado-2009 CVD separation, and
surface contrast. Both modes pass all six checks — worst adjacent CVD ΔE is
23.6 in light and 24.0 in dark, against a target of 12. The dark steps are a
*selected* set for the dark surface, not an inversion of the light ones.

Device types map to **fixed** categorical slots, so a type keeps its colour no
matter how many types a chart happens to show — filtering never repaints the
survivors. The heatmap uses a single-hue sequential ramp, because there colour
encodes magnitude rather than identity.

Type: **Inter** for UI, **Space Grotesk** for large numeric displays, both via
`next/font`.

---

## Project layout

```
backend/
  prisma/
    schema.prisma          # User, Location, Device, Reading, Alert, Setting
    seed.ts                # 60 days × 13 devices, plus derived alert history
  src/
    lib/                   # config, prisma client, errors, range parsing
    middleware/             # JWT auth + role guards, error handler
    realtime/hub.ts        # SSE client registry and broadcast
    routes/                # auth, devices, locations, analytics, alerts, users,
                           #   realtime, settings, stream
    services/
      realtimeIngest.ts    # no-key external API ingestion + alerts + SSE
      simulation.ts        # the generative energy model
      simulator.ts         # optional fallback demo simulator
      analytics.ts         # all aggregation SQL
      settings.ts          # cached global config

frontend/
  app/
    (auth)/                # login, signup
    (app)/                 # dashboard, analytics, devices, alerts, settings
  components/
    ui/                    # Button, Card, Badge, Field, Modal, DataTable,
                           #   KpiCard, Skeleton, States, Toaster, ...
    charts/                # TrendChart, BreakdownDonut, PeakHeatmap,
                           #   ComparisonChart, DeviceSeriesChart, primitives
    layout/                # AppShell, Sidebar, Icons, ThemeToggle
    dashboard/ alerts/ devices/ settings/ analytics/
  lib/                     # api client, auth, theme, toast, live (SSE),
                           #   formatters, domain constants
```

---

## API

All routes except `/health` and `/api/auth/{login,signup}` require
`Authorization: Bearer <token>`. Mutating device, location, user, and tariff
routes additionally require the `ADMIN` role.

| Method | Route | Notes |
|---|---|---|
| `POST` | `/api/auth/signup` | First account created becomes admin |
| `POST` | `/api/auth/login` | |
| `GET` `PATCH` | `/api/auth/me` | Profile + preferences |
| `POST` | `/api/auth/change-password` | |
| `GET` `POST` `PATCH` `DELETE` | `/api/devices[/:id]` | |
| `GET` | `/api/devices/:id/series` | Per-device time series |
| `GET` `POST` `PATCH` `DELETE` | `/api/locations[/:id]` | |
| `GET` | `/api/analytics/summary` | KPIs + previous-period deltas |
| `GET` | `/api/analytics/series` | Bucketed trend |
| `GET` | `/api/analytics/breakdown` | `?dimension=type\|location\|device` |
| `GET` | `/api/analytics/heatmap` | Hour × weekday |
| `GET` | `/api/analytics/projection` | Month-end cost estimate |
| `GET` | `/api/analytics/comparison` | `?dimension=device\|location` |
| `GET` | `/api/analytics/export` | Streaming CSV |
| `GET` | `/api/alerts` | Filter + cursor pagination |
| `POST` | `/api/alerts/:id/acknowledge`, `/api/alerts/acknowledge-all` | |
| `GET` | `/api/realtime/status` | Realtime worker status, latest pull, source list |
| `GET` | `/api/realtime/latest` | Latest external-data snapshot |
| `GET` | `/api/realtime/sources` | APIs used by the app; both require no key |
| `POST` | `/api/realtime/pull-now` | Admin only: fetch external APIs immediately |
| `GET` `POST` `PATCH` `DELETE` | `/api/users[/:id]` | Admin only |
| `GET` `PATCH` | `/api/settings` | Tariff, carbon intensity, currency |
| `GET` | `/api/stream` | SSE: `live`, `alert`, `reading` events |

Analytics endpoints accept `?range=24h|7d|30d|90d` **or** `?from=&to=` (ISO),
plus `?tz=`, `?deviceIds=`, `?locationIds=`, and `?granularity=`.

`EventSource` cannot set headers, so `/api/stream` also accepts the token as
`?token=`.

---

## Useful commands

```bash
# Backend
npm run dev          # tsx watch
npm run build        # tsc
npm run db:migrate   # apply migrations
npm run db:reset     # drop, re-migrate, re-seed
npm run db:studio    # Prisma Studio
npm run seed         # re-seed (destructive)

# Frontend
npm run dev
npm run build
npm run typecheck
```

## Notes and limitations

- Email digests can be enabled in Settings, but no mail server is wired up —
  the preference is stored and not acted on.
- Report export is CSV. PDF was left out rather than shipped as a
  screenshot-to-PDF that would lose the underlying numbers.
- Tariff changes apply to readings recorded from that point on; historical
  costs keep the rate they were priced at.
- Alert thresholds are defined per 15-minute interval, so the device chart only
  plots the threshold line at 15-minute granularity — at hourly or daily
  buckets it would be comparing against a sum several times larger.
