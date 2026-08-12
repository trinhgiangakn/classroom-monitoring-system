const assert = require('node:assert/strict');
const test = require('node:test');

const { WeatherContextService } = require('../weather-context.service');

const snapshot = Object.freeze({
  roomId: 'P.101',
  city: 'Hanoi',
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

test('returns only the latest weather snapshot that is within the freshness window', async () => {
  const repository = {
    async findLatest() {
      return snapshot;
    },
  };
  const service = new WeatherContextService({
    provider: {},
    repository,
    now: () => new Date('2026-08-11T11:59:59.000Z'),
    freshnessMs: 2 * 60 * 60 * 1000,
  });

  const result = await service.getFreshLatest('P.101');

  assert.equal(result.temperatureC, 34.2);
  assert.equal(result.city, 'Hanoi');
});

test('does not expose a weather snapshot after the two-hour freshness window', async () => {
  const repository = {
    async findLatest() {
      return snapshot;
    },
  };
  const service = new WeatherContextService({
    provider: {},
    repository,
    now: () => new Date('2026-08-11T12:05:01.000Z'),
    freshnessMs: 2 * 60 * 60 * 1000,
  });

  const result = await service.getFreshLatest('P.101');

  assert.equal(result, null);
});

test('refreshes the external snapshot through the provider and stores it for the same room', async () => {
  const stored = [];
  const provider = {
    async fetchCurrent(roomId) {
      return { ...snapshot, roomId };
    },
  };
  const repository = {
    async insertOrUpdate(value) {
      stored.push(value);
      return value;
    },
  };
  const service = new WeatherContextService({ provider, repository });

  const result = await service.refresh('P.101');

  assert.equal(result.roomId, 'P.101');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].temperatureC, 34.2);
});
