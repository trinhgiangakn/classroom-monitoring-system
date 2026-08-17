const assert = require('node:assert/strict');
const test = require('node:test');

const { MySqlWeatherRepository } = require('../mysql-weather.repository');

test('stores a normalized Hanoi weather snapshot with an upsert-safe payload', async () => {
  const calls = [];
  const database = {
    async query(sql, values) {
      calls.push({ sql, values });
      return [{ insertId: 15 }];
    },
  };
  const repository = new MySqlWeatherRepository(database);
  const result = await repository.insertOrUpdate({
    roomId: 'P.101',
    city: 'Hanoi',
    latitude: 21.0285,
    longitude: 105.8542,
    provider: 'open-meteo',
    temperatureC: 34.2,
    humidityPercent: 68,
    precipitationProbability: 35,
    precipitationMm: 0.1,
    windSpeedKmh: 10.8,
    weatherCode: 3,
    observedAt: new Date('2026-08-11T10:00:00.000Z'),
    fetchedAt: new Date('2026-08-11T10:05:00.000Z'),
    rawPayload: { current: { temperature_2m: 34.2 } },
  });

  assert.equal(result.id, 15);
  assert.match(calls[0].sql, /ON DUPLICATE KEY UPDATE/i);
  assert.equal(calls[0].values[0], 'P.101');
  assert.equal(calls[0].values[5], 34.2);
  assert.equal(calls[0].values[13], JSON.stringify({ current: { temperature_2m: 34.2 } }));
});

test('maps the latest persisted row back into the weather snapshot contract', async () => {
  const database = {
    async query() {
      return [[{
        id: 15,
        room_code: 'P.101',
        city: 'Hanoi',
        latitude: '21.028500',
        longitude: '105.854200',
        provider: 'open-meteo',
        temperature_c: '34.200',
        humidity_percent: '68.00',
        precipitation_probability: '35.00',
        precipitation_mm: '0.100',
        wind_speed_kmh: '10.800',
        weather_code: 3,
        observed_at: new Date('2026-08-11T10:00:00.000Z'),
        fetched_at: new Date('2026-08-11T10:05:00.000Z'),
        raw_payload: JSON.stringify({ current: { temperature_2m: 34.2 } }),
      }]];
    },
  };
  const repository = new MySqlWeatherRepository(database);

  const result = await repository.findLatest('P.101');

  assert.equal(result.id, 15);
  assert.equal(result.temperatureC, 34.2);
  assert.equal(result.humidityPercent, 68);
  assert.deepEqual(result.rawPayload, { current: { temperature_2m: 34.2 } });
});
