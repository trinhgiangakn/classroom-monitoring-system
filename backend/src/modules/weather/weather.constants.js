const HANOI_WEATHER = Object.freeze({
  roomId: 'P.101',
  city: 'Hanoi',
  latitude: 21.0285,
  longitude: 105.8542,
  provider: 'open-meteo',
});

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const WEATHER_FRESHNESS_MS = 2 * 60 * 60 * 1000;

module.exports = {
  HANOI_WEATHER,
  OPEN_METEO_FORECAST_URL,
  WEATHER_REFRESH_INTERVAL_MS,
  WEATHER_FRESHNESS_MS,
};
