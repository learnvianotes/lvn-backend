import { ErrorCode } from '@lvn-backend/errors'
import { DevicesService } from '../../src/push/devices.service'

const TOKEN = 'fcm-token-1234567890abcd'

describe('push registration for an under-13 account', () => {
  it('refuses the token until devices are open, then stores it', async () => {
    const upsert = jest.fn(async () => undefined)
    const closed = new DevicesService({ deviceToken: { upsert } } as never, { assertDevicesOpen: async () => Promise.reject(Object.assign(new Error('closed'), { code: ErrorCode.FEATURE_UNAVAILABLE_FOR_MINOR })) } as never)
    await expect(closed.register('child', TOKEN, 'ANDROID')).rejects.toMatchObject({ code: ErrorCode.FEATURE_UNAVAILABLE_FOR_MINOR })
    expect(upsert).not.toHaveBeenCalled()

    const open = new DevicesService({ deviceToken: { upsert } } as never, { assertDevicesOpen: async () => undefined } as never)
    await open.register('child', TOKEN, 'ANDROID')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ userId: 'child', token: TOKEN }) }))
  })
})
