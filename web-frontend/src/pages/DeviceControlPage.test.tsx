import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DeviceControlPage } from './DeviceControlPage'
import * as deviceApi from '../services/deviceApi'

describe('DeviceControlPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders device control page and handles mode switching', async () => {
    let currentMode: 'AUTO' | 'MANUAL' = 'MANUAL'

    vi.spyOn(deviceApi, 'getDevices').mockImplementation(async () => ({
      success: true,
      room_id: 'P.101',
      operation_mode: currentMode,
      manual_control_locked: currentMode === 'AUTO',
      devices: [
        { device_id: 'LIGHT_01', name: 'Đèn chiếu sáng', type: 'RELAY', actual_state: 'ON', operation_mode: currentMode },
        { device_id: 'FAN_01', name: 'Quạt thông gió', type: 'RELAY', actual_state: 'ON', operation_mode: currentMode },
        { device_id: 'CURTAIN_01', name: 'Rèm cửa', type: 'MOTOR', actual_state: 'STOPPED', operation_mode: currentMode },
      ],
    }))

    vi.spyOn(deviceApi, 'getDeviceCommands').mockResolvedValue([])
    vi.spyOn(deviceApi, 'setOperationMode').mockImplementation(async (mode) => {
      currentMode = mode
      return {
        success: true,
        current_mode: mode,
        message: `Đã chuyển sang chế độ ${mode}`,
      }
    })

    const user = userEvent.setup()
    render(<DeviceControlPage />)

    // Verify initial render
    await waitFor(() => {
      expect(screen.getByText(/Đèn chiếu sáng/i)).toBeInTheDocument()
    })

    // Click AUTO mode button
    const autoBtn = screen.getByRole('button', { name: /AUTO/i })
    await user.click(autoBtn)

    await waitFor(() => {
      expect(screen.getByText(/AUTO đang kích hoạt/i)).toBeInTheDocument()
    })
  })
})
