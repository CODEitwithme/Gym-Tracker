export class RateLimiter {
  private readonly maxRequests: number
  private readonly windowMs: number
  private readonly records: Map<string, number[]>

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.records = new Map()
  }

  async check(key: string, _kv?: KVNamespace): Promise<boolean> {
    const now = Date.now()

    // Process-local sliding window check (zero KV writes, sub-millisecond execution)
    const timestamps = this.records.get(key) ?? []
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs)

    if (validTimestamps.length >= this.maxRequests) {
      this.records.set(key, validTimestamps)
      return false
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
