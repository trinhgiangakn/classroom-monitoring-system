import assert from 'node:assert/strict'
import test from 'node:test'
import { MQTT_TOPICS } from '../../src/dev2/constants.js'
import { MqttIngestion, parseTopic } from '../../src/dev2/mqtt-ingestion.js'

class FakeMqttClient {
  constructor() {
    this.subscriptions = []
    this.listeners = new Map()
  }

  subscribe(topic, options, callback) {
    this.subscriptions.push({ topic, options })
    callback(null)
  }

  unsubscribe(_topic, callback) {
    callback(null)
  }

  on(event, listener) {
    this.listeners.set(event, listener)
  }

  off(event) {
    this.listeners.delete(event)
  }
}

test('parses only the four Dev 2 topic families', () => {
  assert.deepEqual(parseTopic('classroom/P.101/sensor/NODE-NW/telemetry'), {
    type: 'telemetry', roomId: 'P.101', nodeId: 'NODE-NW',
  })
  assert.deepEqual(parseTopic('classroom/P.101/gateway/metrics'), {
    type: 'gateway-metrics', roomId: 'P.101', nodeId: null,
  })
  assert.equal(parseTopic('classroom/P.101/device/RELAY_1/ack'), null)
})

test('subscribes to all Dev 2 topics using MQTT QoS 1', async () => {
  const client = new FakeMqttClient()
  const ingestion = new MqttIngestion({
    client,
    service: {},
    publish: async () => {},
  })
  await ingestion.start()
  assert.deepEqual(client.subscriptions.map((item) => item.topic), [...MQTT_TOPICS])
  assert.ok(client.subscriptions.every((item) => item.options.qos === 1))
  await ingestion.stop()
})

test('publishes the exact service event to the Dev 4 adapter', async () => {
  const client = new FakeMqttClient()
  const published = []
  const service = {
    ingestTelemetry: async (_payload, context) => ({
      events: [{
        roomId: context.roomId,
        nodeId: context.nodeId,
        payload: { event: 'sensor:update', data: { node_id: context.nodeId } },
      }],
    }),
  }
  const ingestion = new MqttIngestion({
    client,
    service,
    publish: async (...args) => published.push(args),
  })
  await ingestion.handleMessage(
    'classroom/P.101/sensor/NODE-NW/telemetry',
    Buffer.from('{"room_id":"P.101"}'),
  )

  assert.deepEqual(published, [[
    { event: 'sensor:update', data: { node_id: 'NODE-NW' } },
    { roomId: 'P.101', nodeId: 'NODE-NW' },
  ]])
})
