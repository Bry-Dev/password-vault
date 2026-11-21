export type PersistenceResult = 'persisted' | 'not-persisted' | 'unsupported'

type PersistApi = Pick<StorageManager, 'persist' | 'persisted'>

/**
 * Asks the browser to keep this origin's storage (IndexedDB) instead of evicting
 * it under storage pressure. This does NOT protect against the user clearing site
 * data, so encrypted manual backups remain necessary. Never throws.
 */
export async function requestPersistentStorage(
  storage: PersistApi | undefined = globalThis.navigator?.storage,
): Promise<PersistenceResult> {
  if (!storage || typeof storage.persist !== 'function' || typeof storage.persisted !== 'function') {
    return 'unsupported'
  }
  try {
    if (await storage.persisted()) return 'persisted'
    return (await storage.persist()) ? 'persisted' : 'not-persisted'
  } catch {
    return 'not-persisted'
  }
}
