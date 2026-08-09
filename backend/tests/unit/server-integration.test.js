import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createApp } = require('../../server.js')

test('mounts Dev 1 auth and Dev 2 IoT routes in one Express app', async (context) => {
  const { app } = await createApp()
  const server = app.listen(0)
  context.after(() => new Promise(resolve => server.close(resolve)))

  await new Promise(resolve => server.once('listening', resolve))
  const { port } = server.address()

  const health = await fetch(`http://127.0.0.1:${port}/api/health`)
  assert.equal(health.status, 200)
  assert.equal((await health.json()).service, 'classroom-monitoring-backend')

  const protectedIotRoute = await fetch(`http://127.0.0.1:${port}/api/sensors/latest?room_id=P.101`)
  assert.equal(protectedIotRoute.status, 401)
})
