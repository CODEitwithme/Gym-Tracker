export class RateLimiter {
  private readonly maxRequests: number
  private readonly windowMs: number
  private readonly records: Map<string, number[]>

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.records = new Map()
  }

  async check(key: string, kv?: KVNamespace): Promise<boolean> {
    const now = Date.now()

    // 1. Process-local in-memory check
    const timestamps = this.records.get(key) ?? []
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs)

    if (validTimestamps.length >= this.maxRequests) {
      this.records.set(key, validTimestamps)
      return false
    }

    // 2. Distributed KV check across all worker instances in production
    if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
      const windowBucket = Math.floor(now / this.windowMs)
      const kvKey = `rl:${key}:${windowBucket}`
      try {
        const currentCountStr = await kv.get(kvKey)
        const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0
        if (currentCount >= this.maxRequests) {
          return false
        }
        await kv.put(kvKey, String(currentCount + 1), {
          expirationTtl: Math.max(60, Math.ceil((this.windowMs * 2) / 1000)),
        })
      } catch {
        // Fall back to in-memory check if KV temporarily fails
      }
    }

    validTimestamps.push(now)
    this.records.set(key, validTimestamps)
    return true
  }

  reset(key?: string): void {
    if (key) {
      this.records.delete(key)
    } else {
      this.records.clear()
    }
  }
}

