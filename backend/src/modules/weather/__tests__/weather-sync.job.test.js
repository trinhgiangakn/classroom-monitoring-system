const assert = require('node:assert/strict');
const test = require('node:test');

const { WeatherSyncJob } = require('../weather-sync.job');

test('publishes one fresh snapshot after a successful hourly sync', async () => {
  const published = [];
  const weatherContext = {
    async refresh(roomId) {
      return { roomId, city: 'Hanoi', temperatureC: 34.2 };
    },
  };
  const job = new WeatherSyncJob({
    weatherContext,
    publish: async (snapshot) => published.push(snapshot),
    logger: { error() {} },
  });

  const result = await job.runOnce();

  assert.equal(result.city, 'Hanoi');
  assert.deepEqual(published, [{ roomId: 'P.101', city: 'Hanoi', temperatureC: 34.2 }]);
});

test('contains provider failures so the scheduled job can continue later', async () => {
  const errors = [];
  const job = new WeatherSyncJob({
    weatherContext: {
      async refresh() {
        throw new Error('Open-Meteo request failed: 503');
      },
    },
    publish: async () => assert.fail('publish must not run after a provider failure'),
    logger: { error: (...args) => errors.push(args) },
  });

  const result = await job.runOnce();

  assert.equal(result, null);
  assert.equal(errors.length, 1);
  assert.match(errors[0][0], /Weather sync failed/);
});
