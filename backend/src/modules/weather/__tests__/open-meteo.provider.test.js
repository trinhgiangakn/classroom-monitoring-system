const assert = require('node:assert/strict');
const test = require('node:test');

const { OpenMeteoProvider } = require('../open-meteo.provider');

test('maps the current Hanoi response to a normalized weather snapshot', async () => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = new URL(url);
    return {
      ok: true,
      json: async () => ({
        current: {
          time: '2026-08-11T10:00',
          temperature_2m: 34.2,
          relative_humidity_2m: 68,
          precipitation: 0.1,
          wind_speed_10m: 10.8,
          weather_code: 3,
        },
        hourly: {
          time: ['2026-08-11T09:00', '2026-08-11T10:00'],
          precipitation_probability: [10, 35],
        },
      }),
    };
  };
  const provider = new OpenMeteoProvider({ fetchImpl, now: () => new Date('2026-08-11T10:05:00.000Z') });

  const snapshot = await provider.fetchCurrent('P.101');

  assert.equal(requestedUrl.searchParams.get('latitude'), '21.0285');
  assert.equal(requestedUrl.searchParams.get('longitude'), '105.8542');
  assert.equal(requestedUrl.searchParams.get('timezone'), 'UTC');
  assert.match(requestedUrl.searchParams.get('current'), /temperature_2m/);
  assert.equal(snapshot.roomId, 'P.101');
  assert.equal(snapshot.city, 'Hanoi');
  assert.equal(snapshot.temperatureC, 34.2);
  assert.equal(snapshot.humidityPercent, 68);
  assert.equal(snapshot.precipitationProbability, 35);
  assert.equal(snapshot.windSpeedKmh, 10.8);
  assert.equal(snapshot.weatherCode, 3);
  assert.equal(snapshot.observedAt.toISOString(), '2026-08-11T10:00:00.000Z');
  assert.equal(snapshot.fetchedAt.toISOString(), '2026-08-11T10:05:00.000Z');
});

test('rejects a non-successful Open-Meteo response', async () => {
  const provider = new OpenMeteoProvider({
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });

  await assert.rejects(() => provider.fetchCurrent('P.101'), /Open-Meteo request failed: 503/);
});
