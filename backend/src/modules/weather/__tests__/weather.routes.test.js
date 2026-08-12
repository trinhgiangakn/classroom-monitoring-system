const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');

const { createWeatherRouter } = require('../weather.routes');

test('GET /api/weather/current returns only the persisted fresh snapshot', async (t) => {
  let providerWasCalled = false;
  const weatherContext = {
    provider: { fetchCurrent: async () => { providerWasCalled = true; } },
    getFreshLatest: async (roomId) => ({ roomId, temperatureC: 34.2, fetchedAt: new Date('2026-08-11T10:00:00Z') }),
  };
  const app = express();
  app.use('/api', createWeatherRouter({
    Router: express.Router,
    authenticate: (req, res, next) => next(),
    afterAuthenticate: (req, res, next) => next(),
    weatherContext,
  }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/weather/current?room_id=P.101`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.roomId, 'P.101');
  assert.equal(body.data.temperatureC, 34.2);
  assert.equal(providerWasCalled, false);
});

test('GET /api/weather/current returns null when no fresh snapshot exists', async (t) => {
  const app = express();
  app.use('/api', createWeatherRouter({
    Router: express.Router,
    authenticate: (req, res, next) => next(),
    afterAuthenticate: (req, res, next) => next(),
    weatherContext: { getFreshLatest: async () => null },
  }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/weather/current`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data, null);
});
