/**
 * Simple per-domain token-bucket rate limiter used by the polite HTTP client.
 *
 * Each host gets an independent bucket refilled at `requestsPerMinute / 60`
 * tokens per second. `await limiter.acquire(host, ratePerMin)` resolves when
 * a token is available; if the bucket is empty the caller sleeps just long
 * enough to get one.
 *
 * The limiter is process-local. For multi-process crawlers we would promote
 * it to Redis, but for a single Node process (which is how MarinaMatch runs)
 * this is sufficient and dependency-free.
 */

interface Bucket {
  tokens: number;
  lastRefillMs: number;
  ratePerSec: number;
  capacity: number;
  pending: Array<() => void>;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  private getBucket(host: string, requestsPerMinute: number): Bucket {
    const ratePerSec = Math.max(requestsPerMinute, 1) / 60;
    const capacity = Math.max(1, Math.min(requestsPerMinute, 60)); // burst cap
    let b = this.buckets.get(host);
    if (!b) {
      b = {
        tokens: capacity,
        lastRefillMs: Date.now(),
        ratePerSec,
        capacity,
        pending: [],
      };
      this.buckets.set(host, b);
    } else {
      // If a caller requests a different rate, honor the lower of the two
      // so we never exceed any configured limit for that host.
      b.ratePerSec = Math.min(b.ratePerSec, ratePerSec);
      b.capacity = Math.min(b.capacity, capacity);
    }
    return b;
  }

  private refill(b: Bucket) {
    const now = Date.now();
    const elapsedSec = (now - b.lastRefillMs) / 1000;
    if (elapsedSec <= 0) return;
    b.tokens = Math.min(b.capacity, b.tokens + elapsedSec * b.ratePerSec);
    b.lastRefillMs = now;
  }

  private drainPending(b: Bucket) {
    while (b.pending.length > 0 && b.tokens >= 1) {
      b.tokens -= 1;
      const next = b.pending.shift()!;
      next();
    }
    if (b.pending.length > 0) {
      const waitMs = Math.ceil(((1 - b.tokens) / b.ratePerSec) * 1000);
      setTimeout(() => {
        this.refill(b);
        this.drainPending(b);
      }, Math.max(10, waitMs));
    }
  }

  async acquire(host: string, requestsPerMinute: number): Promise<void> {
    const b = this.getBucket(host, requestsPerMinute);
    this.refill(b);
    if (b.tokens >= 1 && b.pending.length === 0) {
      b.tokens -= 1;
      return;
    }
    return new Promise<void>((resolve) => {
      b.pending.push(resolve);
      this.drainPending(b);
    });
  }

  /** Force the next acquire() on this host to wait at least `ms` milliseconds (honors Retry-After). */
  delay(host: string, ms: number) {
    const b = this.buckets.get(host);
    if (!b) return;
    b.tokens = Math.min(b.tokens, 0);
    b.lastRefillMs = Date.now() + ms;
  }

  reset() {
    this.buckets.clear();
  }
}

export const rateLimiter = new RateLimiter();
