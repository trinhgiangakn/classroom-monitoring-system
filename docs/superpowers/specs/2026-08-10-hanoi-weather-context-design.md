# Hanoi Weather Context Design

## Purpose

Add an external Hanoi weather context to support automation recommendations and alerts. Indoor sensor telemetry remains the authoritative source for device decisions.

## Scope

- Provider: Open-Meteo Forecast API.
- Location: Hanoi, Vietnam (`latitude=21.0285`, `longitude=105.8542`).
- Refresh: immediately at backend startup and once every 60 minutes afterward.
- Data: outdoor temperature, relative humidity, precipitation probability, precipitation amount, wind speed, weather code, and fetch time.
- Ownership: Dev 4 Automation, Alerts, and WebSocket integration.

## Architecture

```text
Open-Meteo API -> Weather Sync Job -> MySQL external_weather_data
                                      -> Weather Context Service
                                      -> Rule Engine (secondary condition only)
                                      -> WebSocket weather:update
                                      -> Web Dashboard
```

The weather job is independent from MQTT ingestion. A weather-provider failure must not stop telemetry processing, existing automation, or alerts based on indoor sensors.

## Persistence

Create an `external_weather_data` table with at least:

- `id`, `city`, `latitude`, `longitude`, `provider`
- `temperature_c`, `humidity_percent`
- `precipitation_probability`, `precipitation_mm`
- `wind_speed_kmh`, `weather_code`
- `observed_at`, `fetched_at`, `raw_payload`

All timestamps are stored and compared in UTC. The newest record is valid for use as a secondary condition for at most two hours.

## Automation Safety Rules

1. Indoor AHT20, BMP280, BH1750, and MQ135 data remains the primary source for every device command.
2. A weather record can enrich a condition, create an alert, or provide a recommendation; it must not independently issue a device command.
3. If the latest weather record is missing, stale, or the provider request fails, evaluate normal indoor-sensor rules without weather conditions.
4. Rules requiring weather must explicitly declare it as an optional secondary condition.

Examples:

- High indoor temperature plus high outdoor temperature: create a ventilation recommendation alert.
- High indoor humidity plus rain probability: create an alert to avoid opening the curtain/window automatically.
- Strong wind: create an alert to inhibit curtain-open recommendations.

## Runtime and Realtime

- Reuse the existing backend scheduled-job pattern.
- Publish `weather:update` to room `P.101` after a successful refresh.
- Log request errors without exposing secrets or crashing the backend.
- Use Node.js built-in `fetch`; do not add an HTTP client dependency.

## Validation

- Unit-test API payload mapping, stale-data handling, and provider-failure fallback.
- Integration-test the job with a fake provider and repository.
- Verify database insertion and a `weather:update` event locally.
