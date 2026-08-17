import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLatestSensors } from './dev2Api'
import { API_BASE_URL } from '../lib/api'

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('Dev2 API client', () => {
  it('calls the integrated backend with the stored Bearer token', async () => {
    localStorage.setItem('accessToken', 'test-token')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, room_id: 'P.101', data: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await getLatestSensors()

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/sensors/latest?room_id=P.101`,
      expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }),
    )
  })
})
