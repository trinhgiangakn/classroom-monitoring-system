import assert from 'node:assert/strict'
import test from 'node:test'
import { Dev2Jobs } from '../../src/dev2/jobs.js'

test('offline watchdog uses the SRS 15-second cutoff and publishes node:status', async () => {
  let cutoff
  const published = []
  const jobs = new Dev2Jobs({
    repository: {},
    service: {
      markOfflineNodes: async (value) => {
        cutoff = value
        return [{
          roomId: 'P.101',
          nodeId: 'NODE-NW',
          payload: { event: 'node:status', data: { status: 'Offline' } },
        }]
      },
    },
    publish: async (...args) => published.push(args),
    now: () => new Date('2026-07-25T00:00:00Z'),
  })

  await jobs.runOfflineWatchdog()
  assert.equal(cutoff.toISOString(), '2026-07-24T23:59:45.000Z')
  assert.equal(published[0][0].event, 'node:status')
})
