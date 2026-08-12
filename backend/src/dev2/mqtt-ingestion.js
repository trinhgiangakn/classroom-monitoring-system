import { MQTT_TOPICS } from './constants.js'
import { ValidationError } from './errors.js'

const TOPIC_PATTERNS = [
  {
    type: 'telemetry',
    pattern: /^classroom\/([^/]+)\/sensor\/([^/]+)\/telemetry$/,
  },
  {
    type: 'node-status',
    pattern: /^classroom\/([^/]+)\/sensor\/([^/]+)\/status$/,
  },
  {
    type: 'gateway-status',
    pattern: /^classroom\/([^/]+)\/gateway\/status$/,
  },
  {
    type: 'gateway-metrics',
    pattern: /^classroom\/([^/]+)\/gateway\/metrics$/,
  },
]

function parseTopic(topic) {
  for (const definition of TOPIC_PATTERNS) {
    const match = definition.pattern.exec(topic)
    if (match) {
      return {
        type: definition.type,
        roomId: match[1],
        nodeId: match[2] ?? null,
      }
    }
  }
  return null
}

function parseJson(message) {
  try {
    const text = Buffer.isBuffer(message) ? message.toString('utf8') : String(message)
    return JSON.parse(text)
  } catch (error) {
    throw new ValidationError('MQTT payload must be valid JSON', { cause: error.message })
  }
}

function subscribe(client, topic) {
  return new Promise((resolve, reject) => {
    client.subscribe(topic, { qos: 1 }, (error) => error ? reject(error) : resolve())
  })
}

function unsubscribe(client, topic) {
  return new Promise((resolve, reject) => {
    client.unsubscribe(topic, (error) => error ? reject(error) : resolve())
  })
}

export class MqttIngestion {
  constructor({
    client,
    service,
    publish,
    onTelemetryPersisted = async () => {},
    onNodeStatusesChanged = async () => {},
    logger = console,
  }) {
    if (!client?.on || !client?.subscribe) throw new TypeError('MQTT client is required')
    if (!service) throw new TypeError('service is required')
    if (typeof publish !== 'function') throw new TypeError('WebSocket publish adapter is required')
    this.client = client
    this.service = service
    this.publish = publish
    this.onTelemetryPersisted = onTelemetryPersisted
    this.onNodeStatusesChanged = onNodeStatusesChanged
    this.logger = logger
    this.started = false
    this.handleMessage = this.handleMessage.bind(this)
  }

  async start() {
    if (this.started) return
    for (const topic of MQTT_TOPICS) {
      await subscribe(this.client, topic)
    }
    this.client.on('message', this.handleMessage)
    this.started = true
  }

  async stop() {
    if (!this.started) return
    this.client.off?.('message', this.handleMessage)
    for (const topic of MQTT_TOPICS) {
      await unsubscribe(this.client, topic)
    }
    this.started = false
  }

  async handleMessage(topic, message) {
    const context = parseTopic(topic)
    if (!context) return

    try {
      const payload = parseJson(message)
      let result
      if (context.type === 'telemetry') {
        result = await this.service.ingestTelemetry(payload, context)
      } else if (context.type === 'node-status') {
        result = await this.service.ingestNodeStatus(payload, context)
      } else if (context.type === 'gateway-status') {
        result = await this.service.ingestGatewayStatus(payload, context)
      } else {
        result = await this.service.ingestGatewayMetrics(payload, context)
      }

      for (const event of result.events) {
        await this.publish(event.payload, {
          roomId: event.roomId,
          nodeId: event.nodeId ?? null,
        })
      }

      if (context.type === 'telemetry' && result.telemetry) {
        await this.onTelemetryPersisted({
          roomId: context.roomId,
          nodeId: context.nodeId,
          telemetry: result.telemetry,
        })
      }

      if (
        (context.type === 'telemetry' || context.type === 'node-status')
        && result.events.some((event) => event.payload.event === 'node:status')
      ) {
        const statuses = await this.service.nodeStatuses(context.roomId)
        await this.onNodeStatusesChanged({ roomId: context.roomId, statuses })
      }
    } catch (error) {
      this.logger.warn?.('Dev 2 rejected MQTT message', {
        topic,
        code: error.code ?? 'MQTT_INGESTION_ERROR',
        message: error.message,
      })
    }
  }
}

export { parseTopic }
