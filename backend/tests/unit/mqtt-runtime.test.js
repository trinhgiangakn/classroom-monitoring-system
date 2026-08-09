import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { attachMqttIngestion, buildMqttOptions } = require('../../config/mqtt.js')

test('builds MQTT runtime options without inventing credentials', () => {
  assert.deepEqual(buildMqttOptions({ MQTT_CLIENT_ID: 'backend-test' }), {
    clientId: 'backend-test',
    clean: true,
    connectTimeout: 10_000,
    reconnectPeriod: 2_000,
    resubscribe: true,
    queueQoSZero: false,
  })
})

test('starts ingestion on connect and stops both ingestion and client', async () => {
  const client = new EventEmitter()
  client.connected = false
  client.end = (force, options, callback) => callback()
  let starts = 0
  let stops = 0
  const ingestion = {
    started: false,
    start: async () => { starts += 1; ingestion.started = true },
    stop: async () => { stops += 1; ingestion.started = false },
  }
  const logger = { info: () => {}, error: () => {} }

  const stop = attachMqttIngestion({ client, ingestion, logger })
  client.connected = true
  client.emit('connect')
  await new Promise(resolve => setImmediate(resolve))

  assert.equal(starts, 1)
  await stop()
  assert.equal(stops, 1)
})
