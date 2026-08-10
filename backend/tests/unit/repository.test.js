import assert from 'node:assert/strict'
import test from 'node:test'
import { IotRepository } from '../../src/dev2/iot-repository.js'

test('recent telemetry uses validated literal pagination for MySQL compatibility', async () => {
  let captured
  const database = {
    execute: async (sql, parameters) => {
      captured = { sql, parameters }
      return [[]]
    },
    getConnection: async () => { throw new Error('not used') },
  }

  const repository = new IotRepository(database)
  await repository.getRecent({
    roomId: 'P.101',
    nodeId: null,
    from: new Date('2026-08-09T00:00:00Z'),
    to: new Date('2026-08-10T00:00:00Z'),
    limit: 50,
    offset: 10,
  })

  assert.match(captured.sql, /LIMIT 50 OFFSET 10$/)
  assert.equal(captured.parameters.length, 5)
})
