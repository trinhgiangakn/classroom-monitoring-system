import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { AlertService } = require('../../src/modules/alerts/alert.service')

function repositoryFor(alert) {
  const calls = []
  return {
    calls,
    async findById() { return alert },
    async restoreDismissal(id, userId) { calls.push(['restore', id, userId]) },
    async dismissResolved(roomId, userId) { calls.push(['dismiss-resolved', roomId, userId]); return 4 },
    async softDelete(id, userId) { calls.push(['delete', id, userId]); return true },
  }
}

test('restore is scoped to the current user', async () => {
  const repository = repositoryFor({ id: '7', status: 'NEW' })
  const service = new AlertService(repository)

  await service.restoreDismissal('7', 21)

  assert.deepEqual(repository.calls, [['restore', '7', 21]])
})

test('global deletion accepts resolved alerts and rejects active alerts', async () => {
  const resolvedRepository = repositoryFor({ id: '8', status: 'RESOLVED' })
  await new AlertService(resolvedRepository).remove('8', 1)
  assert.deepEqual(resolvedRepository.calls, [['delete', '8', 1]])

  const activeRepository = repositoryFor({ id: '9', status: 'ACKNOWLEDGED' })
  await assert.rejects(
    () => new AlertService(activeRepository).remove('9', 1),
    error => error.statusCode === 409 && /đã xử lý/.test(error.message),
  )
  assert.deepEqual(activeRepository.calls, [])
})

test('bulk dismissal targets resolved alerts in the current room and user scope', async () => {
  const repository = repositoryFor({ id: '10', status: 'RESOLVED' })
  const dismissed = await new AlertService(repository).dismissResolved('P.101', 21)

  assert.equal(dismissed, 4)
  assert.deepEqual(repository.calls, [['dismiss-resolved', 'P.101', 21]])
})
