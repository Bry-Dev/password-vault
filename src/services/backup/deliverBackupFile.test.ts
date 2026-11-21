import { describe, expect, it } from 'vitest'
import { deliverBackupFile, type DeliveryPlatform } from './deliverBackupFile'

const file = new File(['{}'], 'local-vault-2026-11-22.pvault', { type: 'application/json' })

function fakePlatform(overrides: Partial<DeliveryPlatform> & { shareError?: unknown } = {}) {
  const calls = { shared: [] as File[][], downloaded: [] as File[] }
  const platform: DeliveryPlatform = {
    prefersShare: () => true,
    canShareFiles: () => true,
    share: async (data) => {
      if (overrides.shareError) throw overrides.shareError
      calls.shared.push(data.files ?? [])
    },
    download: (f) => calls.downloaded.push(f),
    ...overrides,
  }
  return { platform, calls }
}

const domError = (name: string) => new DOMException('failed', name)

describe('deliverBackupFile', () => {
  it('opens the share sheet with the file on a touch device that can share files', async () => {
    const { platform, calls } = fakePlatform()
    expect(await deliverBackupFile(file, platform)).toBe('shared')
    expect(calls.shared).toEqual([[file]])
    expect(calls.downloaded).toEqual([])
  })

  it('downloads on devices that do not prefer sharing (desktop)', async () => {
    const { platform, calls } = fakePlatform({ prefersShare: () => false })
    expect(await deliverBackupFile(file, platform)).toBe('downloaded')
    expect(calls.downloaded).toEqual([file])
    expect(calls.shared).toEqual([])
  })

  it('downloads when the browser cannot share files', async () => {
    const { platform, calls } = fakePlatform({ canShareFiles: () => false })
    expect(await deliverBackupFile(file, platform)).toBe('downloaded')
    expect(calls.downloaded).toEqual([file])
  })

  it('reports cancelled, without downloading, when the user dismisses the share sheet', async () => {
    const { platform, calls } = fakePlatform({ shareError: domError('AbortError') })
    expect(await deliverBackupFile(file, platform)).toBe('cancelled')
    expect(calls.downloaded).toEqual([])
  })

  it('falls back to downloading when sharing fails for another reason', async () => {
    const { platform, calls } = fakePlatform({ shareError: domError('NotAllowedError') })
    expect(await deliverBackupFile(file, platform)).toBe('downloaded')
    expect(calls.downloaded).toEqual([file])
  })

  it('falls back to downloading when checking share support throws', async () => {
    const { platform, calls } = fakePlatform({
      canShareFiles: () => {
        throw new TypeError('bad')
      },
    })
    expect(await deliverBackupFile(file, platform)).toBe('downloaded')
    expect(calls.downloaded).toEqual([file])
  })
})
