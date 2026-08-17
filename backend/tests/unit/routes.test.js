import assert from 'node:assert/strict'
import test from 'node:test'
import { createDev2Router } from '../../src/dev2/routes.js'

test('registers only the REST routes owned by Dev 2', () => {
  const calls = []
  const router = {
    use: (handler) => calls.push(['use', handler]),
    get: (path, handler) => calls.push(['get', path, handler]),
  }
  const authenticate = () => {}
  const handler = () => {}
  const controller = {
    latest: handler,
    history: handler,
    recent: handler,
    exportCsv: handler,
    nodes: handler,
    node: handler,
    gatewayStatus: handler,
  }

  createDev2Router({ Router: () => router, authenticate, controller })

  assert.equal(calls[0][0], 'use')
  assert.deepEqual(calls.filter(([method]) => method === 'get').map(([, path]) => path), [
    '/sensors/latest',
    '/sensors/history',
    '/sensors/recent',
    '/sensors/export',
    '/nodes',
    '/nodes/:id',
    '/gateway/status',
  ])
})
