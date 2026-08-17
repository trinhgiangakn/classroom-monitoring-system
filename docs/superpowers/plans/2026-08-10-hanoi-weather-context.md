# Hanoi Weather Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist hourly Hanoi weather snapshots from Open-Meteo and use fresh weather only as a secondary source for advisory alerts, while indoor sensor telemetry remains the sole source of automatic device commands.

**Architecture:** A provider maps Open-Meteo's response to a normalized weather snapshot. A background job persists a snapshot at startup and every 60 minutes, then emits `weather:update`. A read-only context service exposes the newest snapshot only when it is younger than two hours. The automation runtime may create a deduplicated advisory alert from that context; it never passes weather data into device-command evaluation.

**Tech Stack:** Node.js built-in `fetch`, CommonJS backend modules, MySQL 8.0, existing Express/Socket.io runtime, Node built-in `node:test`.

## Global Constraints

- Source: Open-Meteo Forecast API; Hanoi coordinates `21.0285,105.8542`.
- Refresh immediately after backend startup and every `3_600_000` ms; all stored timestamps are UTC.
- A snapshot is usable for a maximum of two hours (`7_200_000` ms); stale or missing weather means no weather advisory.
- Indoor AHT20, BMP280, BH1750 and MQ135 telemetry remains the sole source for automatic commands to light, fan, humidifier and curtain.
- External weather may add an advisory only; it must never call `deviceCommands.dispatch` or alter AUTO/MANUAL/Safe Mode decisions.
- Provider/network/database weather errors must be logged and isolated: MQTT ingestion, device ACK and existing indoor rules continue running.
- Use Node's global `fetch`; do not add an HTTP client or scheduler dependency.
- Never commit `.env`, Gmail App Passwords, API credentials, or raw secrets.

---

## Target Files

```text
database/mysql/migrations/015_create_external_weather_data_table.sql
backend/src/modules/weather/weather.constants.js
backend/src/modules/weather/open-meteo.provider.js
backend/src/modules/weather/mysql-weather.repository.js
backend/src/modules/weather/weather-context.service.js
backend/src/modules/weather/weather-sync.job.js
backend/src/modules/weather/weather.routes.js
backend/src/modules/weather/__tests__/open-meteo.provider.test.js
backend/src/modules/weather/__tests__/weather-context.service.test.js
backend/src/modules/weather/__tests__/weather-sync.job.test.js
backend/src/modules/weather/__tests__/weather.routes.test.js
backend/src/modules/automation/weather-advisory.js
backend/src/modules/automation/__tests__/weather-advisory.test.js
backend/src/modules/automation/mysql-automation.repository.js
backend/src/modules/automation/automation-runtime.js
backend/src/modules/automation/automation.service.js
backend/src/modules/realtime/realtime.events.js
backend/server.js
backend/.env.example
```

The normalized in-memory snapshot uses camelCase:

```js
{
  roomId: 'P.101', city: 'Hanoi', latitude: 21.0285, longitude: 105.8542,
  provider: 'open-meteo', temperatureC: 34.2, humidityPercent: 68,
  precipitationProbability: 35, precipitationMm: 0.1, windSpeedKmh: 10.8,
  weatherCode: 3, observedAt: Date, fetchedAt: Date, rawPayload: {}
}
```

An automation rule may optionally contain an advisory, for example:

```json
{
  "sensor": "temperature",
  "activation": { "comparison": "GTE", "threshold": 30, "action": "TURN_ON" },
  "deactivation": { "comparison": "LTE", "threshold": 28, "action": "TURN_OFF" },
  "delay_ms": 10000,
  "weather_advisory": {
    "field": "temperatureC",
    "comparison": "GTE",
    "threshold": 34,
    "severity": "INFO",
    "message": "Ngoài trời nóng; khuyến nghị thông gió cho phòng P.101."
  }
}
```

## Implementation Tasks

### Task 1: Add persistent weather storage

**Files:** `database/mysql/migrations/015_create_external_weather_data_table.sql`

- [ ] Add `external_weather_data` with room, city, coordinates, provider, weather measurements, UTC `observed_at`, UTC `fetched_at`, JSON raw response and indexes on `(room_code, fetched_at)`.
- [ ] Add a unique key `(room_code, provider, observed_at)` so a repeated hourly snapshot is updated rather than duplicated.
- [ ] Keep the migration additive; do not modify earlier migrations or existing telemetry tables.
- [ ] Run `cd backend; npm run migrate` and verify with `SHOW CREATE TABLE external_weather_data;`.
- [ ] Commit: `feat(weather): add external weather persistence`.

### Task 2: Implement and test the Open-Meteo provider

**Files:** `weather.constants.js`, `open-meteo.provider.js`, `__tests__/open-meteo.provider.test.js`

- [ ] Define Hanoi constants, refresh interval, freshness limit and Open-Meteo endpoint in one constants module.
- [ ] Write tests first with an injected fake `fetch`. Assert request query contains `latitude`, `longitude`, `current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code`, `hourly=precipitation_probability`, and `timezone=UTC`.
- [ ] Assert response mapping finds the current hour's precipitation probability and returns the normalized camelCase snapshot above.
- [ ] Assert malformed response and non-OK HTTP response reject with a meaningful error.
- [ ] Implement `OpenMeteoProvider.fetchCurrent(roomId)` using global `fetch`, with no hidden dependency.
- [ ] Run `node --test src/modules/weather/__tests__/open-meteo.provider.test.js` from `backend`.
- [ ] Commit: `feat(weather): add Open-Meteo Hanoi provider`.

### Task 3: Implement repository, freshness context and hourly job

**Files:** `mysql-weather.repository.js`, `weather-context.service.js`, `weather-sync.job.js`, associated tests

- [ ] Write repository tests using a fake database connection. Verify `insertOrUpdate(snapshot)` uses `INSERT ... ON DUPLICATE KEY UPDATE` and maps camelCase fields to database snake_case.
- [ ] Implement `findLatest(roomId)` ordered by `fetched_at DESC, id DESC` and map database rows back to the normalized shape.
- [ ] Write context tests: fresh data is returned; a value older than two hours returns `null`; provider/repository errors are surfaced to the job but do not corrupt previous data.
- [ ] Implement `WeatherContextService.refresh(roomId)` and `getFreshLatest(roomId, now)`.
- [ ] Write job tests with injected `setInterval`, `clearInterval`, weather context and publisher. Verify one immediate refresh, one 60-minute interval, successful publish, and logged-but-contained failure.
- [ ] Implement `WeatherSyncJob.start()`/`stop()`; its publisher receives the normalized snapshot.
- [ ] Run all weather module tests.
- [ ] Commit: `feat(weather): sync and expose fresh Hanoi weather context`.

### Task 4: Expose current weather and publish realtime updates

**Files:** `weather.routes.js`, `realtime.events.js`, `server.js`, `__tests__/weather.routes.test.js`, `.env.example`

- [ ] Add `WEATHER_UPDATE: 'weather:update'` to the existing realtime event constants.
- [ ] Add an authenticated `GET /api/weather/current` route. It returns `{ data: snapshot }` for fresh data and `{ data: null }` when absent/stale; it must not trigger a provider request.
- [ ] Test route response using an Express app with injected no-op authentication middleware and fake context.
- [ ] In `server.js`, construct provider/repository/context before `createApp`, pass the context to the app, create the job after realtime exists, publish `weather:update` with the existing room publisher, start after listening, and stop it during shutdown.
- [ ] Add commented non-secret weather configuration documentation only if needed; coordinates are application constants, not secrets.
- [ ] Run `npm start`, verify `GET http://localhost:3000/api/weather/current` after the first refresh, and confirm `weather:update` does not replace current telemetry events.
- [ ] Commit: `feat(weather): publish hourly weather context`.

### Task 5: Add strictly advisory Rule Engine integration

**Files:** `weather-advisory.js`, `mysql-automation.repository.js`, `automation-runtime.js`, `automation.service.js`, `__tests__/weather-advisory.test.js`

- [ ] Write pure evaluator tests first. It must return no match when weather is null/stale, a field is unknown, weather fails the comparison, indoor activation fails, or valid node count is below the rule's minimum.
- [ ] Test matching indoor + outdoor conditions produces a recommendation with `severity`, `message`, values and a dedupe key based on `rule.id` plus `weather.fetchedAt`.
- [ ] Test that advisory execution in MANUAL mode can create an alert but makes **zero** calls to `deviceCommands.dispatch`; thus it is useful guidance, never device control.
- [ ] Map `conditions.weather_advisory` to an optional `weatherAdvisory` property in `MySqlAutomationRepository` without changing ordinary rules.
- [ ] Inject `weatherContext` into `AutomationRuntime`; fetch it alongside normal room context and rules using `getFreshLatest(roomId)`.
- [ ] In `AutomationService.handleTelemetry`, evaluate the advisory separately from AUTO command evaluation. Require valid indoor nodes, store only the latest observed weather timestamp per rule in a `Map` to avoid repeated alerts, create an alert and publish existing `alert:new` only once per fresh weather snapshot.
- [ ] Leave `evaluateRule` and normal `deviceCommands.dispatch` path untouched except for passing weather separately; weather must never become a command sensor.
- [ ] Run rule, safe-mode and new advisory tests together.
- [ ] Commit: `feat(automation): add weather-based advisory alerts`.

### Task 6: Integration, safety review and documentation

**Files:** tests above and `docs/superpowers/specs/2026-08-10-hanoi-weather-context-design.md`

- [ ] With MySQL and Mosquitto running, start backend and confirm a weather row is saved at startup.
- [ ] Publish valid local telemetry for a known node; confirm sensor data ingestion and normal rules still work when Open-Meteo is unavailable.
- [ ] Verify a current weather advisory appears only when both its local indoor condition and external weather condition match, and no device command is created solely due to weather.
- [ ] Verify a stale snapshot does not generate an advisory and provider failure only logs an error.
- [ ] Run `cd backend; npm test`; run targeted module tests; run frontend build if shared files changed.
- [ ] Inspect `git diff --check`, `git status --short`, and ensure `.env`/passwords are absent from staged changes.
- [ ] Update implementation notes only with non-secret configuration and known demo limitations.
- [ ] Commit: `test(weather): verify advisory integration and fallback safety`.

## Final Verification Commands

```powershell
cd D:\Projects\classroom-monitoring-system\backend
npm run migrate
npm test
node --test src/modules/weather/__tests__/*.test.js src/modules/automation/__tests__/weather-advisory.test.js
git diff --check
git status --short
```

Expected evidence:

- backend starts despite a temporary Open-Meteo failure;
- one current Hanoi snapshot is persisted and available from `/api/weather/current`;
- `weather:update` is emitted after a successful refresh;
- weather may produce one deduplicated advisory for a matching fresh snapshot;
- no weather-only action publishes a device command or changes a device state.
