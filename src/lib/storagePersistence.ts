/**
 * Utility for querying and requesting persistent browser storage
 * (IndexedDB / Cache API) via the StorageManager API.
 * Prevents aggressive WebKit/iOS 7-day storage eviction.
 */

export interface StorageQuotaInfo {
  quota: number
  usage: number
  percentUsed: number
  usageMb: number
  quotaMb: number
}

/**
 * Checks whether persistent storage has been granted for this origin.
 */
export async function checkStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted()
    } catch {
      return false
    }
  }
  return false
}

/**
 * Requests persistent storage from the browser.
 * In standalone PWA mode or with user engagement, browsers typically grant this.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist()
    } catch {
      return false
    }
  }
  return false
}

/**
 * Returns estimated storage usage and quota in bytes and megabytes.
 */
export async function getStorageQuota(): Promise<StorageQuotaInfo | null> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate()
      const usage = estimate.usage ?? 0
      const quota = estimate.quota ?? 0
      const percentUsed = quota > 0 ? (usage / quota) * 100 : 0
      return {
        usage,
        quota,
        percentUsed: Math.round(percentUsed * 10) / 10,
        usageMb: Math.round((usage / (1024 * 1024)) * 10) / 10,
        quotaMb: Math.round((quota / (1024 * 1024)) * 10) / 10,
      }
    } catch {
      return null
    }
  }
  return null
}

