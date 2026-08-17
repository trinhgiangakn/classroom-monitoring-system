import { IotController } from './iot-controller.js'
import { IotRepository } from './iot-repository.js'
import { IotService } from './iot-service.js'
import { Dev2Jobs } from './jobs.js'
import { MqttIngestion } from './mqtt-ingestion.js'
import { createDev2Router } from './routes.js'

export function createDev2Module({
  database,
  Router,
  authenticate,
  afterAuthenticate,
  mqttClient = null,
  publishWebSocket,
  onTelemetryPersisted,
  onNodeStatusesChanged,
  logger = console,
  now,
  timeZone,
  airQualityClassifier,
}) {
  if (typeof publishWebSocket !== 'function') {
    throw new TypeError('Dev 4 WebSocket publish adapter is required')
  }

  const repository = new IotRepository(database)
  const service = new IotService(repository, { now, timeZone, airQualityClassifier })
  const controller = new IotController(service)
  const router = createDev2Router({ Router, authenticate, afterAuthenticate, controller })
  const jobs = new Dev2Jobs({
    repository,
    service,
    publish: publishWebSocket,
    onNodeStatusesChanged,
    logger,
    now,
  })
  const mqtt = mqttClient
    ? new MqttIngestion({
        client: mqttClient,
        service,
        publish: publishWebSocket,
        onTelemetryPersisted,
        onNodeStatusesChanged,
        logger,
      })
    : null

  return { router, mqtt, jobs, repository, service }
}

export { IotController } from './iot-controller.js'
export { IotRepository } from './iot-repository.js'
export { IotService } from './iot-service.js'
export { Dev2Jobs } from './jobs.js'
export { MqttIngestion, parseTopic } from './mqtt-ingestion.js'
export { createDev2Router } from './routes.js'
export { toErrorResponse } from './errors.js'
