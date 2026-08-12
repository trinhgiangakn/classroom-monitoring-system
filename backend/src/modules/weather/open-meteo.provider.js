const {
  HANOI_WEATHER,
  OPEN_METEO_FORECAST_URL,
} = require('./weather.constants');

function toUtcDate(value) {
  if (typeof value !== 'string' || !value) {
    throw new Error('Open-Meteo response is missing current.time');
  }
  return new Date(value.endsWith('Z') ? value : `${value}Z`);
}

function findPrecipitationProbability(hourly, observedAt) {
  if (!Array.isArray(hourly?.time) || !Array.isArray(hourly?.precipitation_probability)) return null;
  const hour = observedAt.toISOString().slice(0, 13);
  const index = hourly.time.findIndex((time) => time.startsWith(hour));
  return index < 0 ? null : hourly.precipitation_probability[index] ?? null;
}

class OpenMeteoProvider {
  constructor({ fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');
    this.fetchImpl = fetchImpl;
    this.now = now;
  }

  async fetchCurrent(roomId = HANOI_WEATHER.roomId) {
    const url = new URL(OPEN_METEO_FORECAST_URL);
    url.search = new URLSearchParams({
      latitude: String(HANOI_WEATHER.latitude),
      longitude: String(HANOI_WEATHER.longitude),
      current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code',
      hourly: 'precipitation_probability',
      timezone: 'UTC',
    }).toString();

    const response = await this.fetchImpl(url.toString());
    if (!response?.ok) throw new Error(`Open-Meteo request failed: ${response?.status ?? 'unknown'}`);
    const payload = await response.json();
    if (!payload?.current) throw new Error('Open-Meteo response is missing current weather');

    const observedAt = toUtcDate(payload.current.time);
    if (Number.isNaN(observedAt.getTime())) throw new Error('Open-Meteo current.time is invalid');

    return {
      roomId,
      city: HANOI_WEATHER.city,
      latitude: HANOI_WEATHER.latitude,
      longitude: HANOI_WEATHER.longitude,
      provider: HANOI_WEATHER.provider,
      temperatureC: payload.current.temperature_2m ?? null,
      humidityPercent: payload.current.relative_humidity_2m ?? null,
      precipitationProbability: findPrecipitationProbability(payload.hourly, observedAt),
      precipitationMm: payload.current.precipitation ?? null,
      windSpeedKmh: payload.current.wind_speed_10m ?? null,
      weatherCode: payload.current.weather_code ?? null,
      observedAt,
      fetchedAt: this.now(),
      rawPayload: payload,
    };
  }
}

module.exports = { OpenMeteoProvider, findPrecipitationProbability, toUtcDate };
