import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const jwt = require('jsonwebtoken')
const { createApp } = require('../../server.js')

const alert = {
  id: '7',
  roomId: 'P.101',
  severity: 'WARNING',
  source: 'NODE-NE',
  message: 'Weak BLE signal',
  status: 'NEW',
  metadata: null,
  createdAt: new Date('2026-08-17T03:00:00.000Z'),
  acknowledgedBy: null,
  acknowledgedAt: null,
  resolvedBy: null,
  resolvedAt: null,
}

test('exposes list, summary, acknowledge, and resolve alert endpoints', async context => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'alert-route-test-secret'
  context.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  })

  const receivedFilters = []
  const service = {
    async list(filters) { receivedFilters.push(filters); return [alert] },
    async summary() { return { critical: 0, warning: 1, resolved: 0, unresolved: 1, total: 1 } },
    async acknowledge(id, actorId) { return { ...alert, id, status: 'ACKNOWLEDGED', acknowledgedBy: actorId } },
    async resolve(id, actorId) { return { ...alert, id, status: 'RESOLVED', resolvedBy: actorId } },
    async restoreDismissal(id) { return { ...alert, id } },
    async dismissResolved(roomId, actorId) { return roomId === 'P.101' && actorId === 21 ? 3 : 0 },
    async remove(id) { return { ...alert, id, status: 'RESOLVED' } },
  }
  const { app } = await createApp({ alertService: service })
  const server = app.listen(0)
  context.after(() => new Promise(resolve => server.close(resolve)))
  await new Promise(resolve => server.once('listening', resolve))
  const { port } = server.address()
  const token = jwt.sign({ id: 21, role: 'technician' }, process.env.JWT_SECRET)
  const headers = { Authorization: `Bearer ${token}` }

  const list = await fetch(`http://127.0.0.1:${port}/api/alerts?room_id=P.101&severity=warning&status=new`, { headers })
  assert.equal(list.status, 200)
  assert.equal((await list.json()).data[0].source, 'NODE-NE')
  assert.deepEqual(receivedFilters[0], {
    roomId: 'P.101', severity: 'WARNING', status: 'NEW', visibility: 'visible', limit: undefined, userId: 21,
  })

  const summary = await fetch(`http://127.0.0.1:${port}/api/alerts/summary?room_id=P.101`, { headers })
  assert.equal((await summary.json()).data.unresolved, 1)

  const acknowledged = await fetch(`http://127.0.0.1:${port}/api/alerts/7/acknowledge`, { method: 'PUT', headers })
  assert.equal((await acknowledged.json()).data.status, 'ACKNOWLEDGED')

  const resolved = await fetch(`http://127.0.0.1:${port}/api/alerts/7/resolve`, { method: 'PUT', headers })
  assert.equal((await resolved.json()).data.resolved_by, 21)

  const restored = await fetch(`http://127.0.0.1:${port}/api/alerts/7/dismiss`, { method: 'DELETE', headers })
  assert.equal((await restored.json()).message, 'Alert restored')

  const dismissedResolved = await fetch(`http://127.0.0.1:${port}/api/alerts/dismiss-resolved?room_id=P.101`, { method: 'PUT', headers })
  assert.equal((await dismissedResolved.json()).data.dismissed, 3)

  const forbiddenDelete = await fetch(`http://127.0.0.1:${port}/api/alerts/7`, { method: 'DELETE', headers })
  assert.equal(forbiddenDelete.status, 403)

  const adminToken = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET)
  const deleted = await fetch(`http://127.0.0.1:${port}/api/alerts/7`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  })
  assert.equal(deleted.status, 200)
  assert.equal((await deleted.json()).message, 'Alert deleted')
})

test('rejects invalid alert filters', async context => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'alert-route-test-secret'
  context.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previousSecret
  })
  const service = { list: async () => [], summary: async () => ({}) }
  const { app } = await createApp({ alertService: service })
  const server = app.listen(0)
  context.after(() => new Promise(resolve => server.close(resolve)))
  await new Promise(resolve => server.once('listening', resolve))
  const { port } = server.address()
  const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET)

  const response = await fetch(`http://127.0.0.1:${port}/api/alerts?severity=unknown`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(response.status, 400)
})
