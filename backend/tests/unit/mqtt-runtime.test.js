import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { attachMqttIngestion, buildMqttOptions } = require('../../config/mqtt.js')

test('builds MQTT runtime options without inventing credentials', () => {
  const options = buildMqttOptions({ MQTT_CLIENT_ID: 'backend-test' })
  assert.match(options.clientId, /^backend-test-[0-9a-f]{6}$/)
  assert.equal(options.clean, true)
  assert.equal(options.connectTimeout, 10_000)
  assert.equal(options.reconnectPeriod, 2_000)
  assert.equal(options.resubscribe, true)
  assert.equal(options.queueQoSZero, false)
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
