import { describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage } from './persistence'

describe('requestPersistentStorage', () => {
  it('reports unsupported when the Storage API is missing', async () => {
    expect(await requestPersistentStorage(undefined)).toBe('unsupported')
  })

  it('does not ask again when storage is already persisted', async () => {
    const persist = vi.fn(async () => true)
    const result = await requestPersistentStorage({ persisted: async () => true, persist })
    expect(result).toBe('persisted')
    expect(persist).not.toHaveBeenCalled()
  })

  it('asks the browser and reports when it is granted', async () => {
    const result = await requestPersistentStorage({ persisted: async () => false, persist: async () => true })
    expect(result).toBe('persisted')
  })

  it('reports not-persisted when the browser declines', async () => {
    const result = await requestPersistentStorage({ persisted: async () => false, persist: async () => false })
    expect(result).toBe('not-persisted')
  })

  it('never throws if the browser API fails', async () => {
    const result = await requestPersistentStorage({
      persisted: async () => {
        throw new Error('boom')
      },
      persist: async () => true,
    })
    expect(result).toBe('not-persisted')
  })
})
