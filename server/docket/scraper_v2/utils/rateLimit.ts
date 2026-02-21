import { V2_CONFIG } from '../config';
import type { RateLimitBucket } from '../types';

const hostBuckets = new Map<string, RateLimitBucket>();

export function getHostBucket(host: string): RateLimitBucket {
  let bucket = hostBuckets.get(host);
  if (!bucket) {
    bucket = {
      tokens: V2_CONFIG.fetcher.perHostRateLimit,
      lastRefill: Date.now(),
      maxTokens: V2_CONFIG.fetcher.perHostRateLimit,
      refillRate: V2_CONFIG.fetcher.perHostRateLimit / (V2_CONFIG.fetcher.rateLimitWindowMs / 1000),
    };
    hostBuckets.set(host, bucket);
  }
  return bucket;
}

export function refillBucket(bucket: RateLimitBucket): void {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  const tokensToAdd = elapsed * bucket.refillRate;
  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
}

export function tryConsume(host: string, tokens: number = 1): boolean {
  const bucket = getHostBucket(host);
  refillBucket(bucket);
  
  if (bucket.tokens >= tokens) {
    bucket.tokens -= tokens;
    return true;
  }
  
  return false;
}

export async function waitForToken(host: string, tokens: number = 1): Promise<void> {
  while (!tryConsume(host, tokens)) {
    const bucket = getHostBucket(host);
    const waitTime = Math.ceil((tokens - bucket.tokens) / bucket.refillRate * 1000);
    await sleep(Math.min(waitTime, 5000));
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function jitter(baseMs: number, factor: number = 0.5): number {
  const variance = baseMs * factor;
  return baseMs + (Math.random() * variance * 2) - variance;
}

export function exponentialBackoff(attempt: number, baseMs: number = 1000, maxMs: number = 30000): number {
  const delay = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  return jitter(delay);
}

const hostConcurrency = new Map<string, number>();
const maxHostConcurrency = V2_CONFIG.fetcher.perHostConcurrency;

export async function acquireHostSlot(host: string): Promise<void> {
  while ((hostConcurrency.get(host) || 0) >= maxHostConcurrency) {
    await sleep(100);
  }
  hostConcurrency.set(host, (hostConcurrency.get(host) || 0) + 1);
}

export function releaseHostSlot(host: string): void {
  const current = hostConcurrency.get(host) || 0;
  if (current > 0) {
    hostConcurrency.set(host, current - 1);
  }
}

export function clearRateLimits(): void {
  hostBuckets.clear();
  hostConcurrency.clear();
}
