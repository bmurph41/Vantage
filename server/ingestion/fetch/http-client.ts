/**
 * Polite HTTP client used by marketplace scraper adapters.
 *
 * Every outbound scrape request goes through politeGet():
 *   1. SSRF guard (reuses checkMarketplaceScrapeUrl from ingestion_v2)
 *   2. robots.txt check for the adapter's User-Agent
 *   3. Per-domain rate limiter (requestsPerMinute from marketplace_sources)
 *   4. Timeout + proper User-Agent header
 *   5. Retry-After honoring on 429 / 503
 *
 * Adapters should NEVER call fetch() directly for live sources. Doing so
 * bypasses ToS / rate-limit / SSRF protections and can get MarinaMatch
 * blocked by the origin or worse.
 */

import { checkMarketplaceScrapeUrl } from '../../listings/ingestion_v2/fetch/ssrfGuard';
import { isAllowedByRobots } from './robots';
import { rateLimiter } from './rate-limiter';

export interface PoliteFetchOptions {
  userAgent: string;
  requestsPerMinute: number;
  timeoutMs?: number;
  maxRetries?: number;
  acceptLanguage?: string;
  extraHeaders?: Record<string, string>;
}

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = 'RobotsDisallowedError';
  }
}

export class SsrfBlockedError extends Error {
  constructor(url: string, reason: string) {
    super(`SSRF guard blocked ${url}: ${reason}`);
    this.name = 'SsrfBlockedError';
  }
}

export async function politeGet(
  url: string,
  opts: PoliteFetchOptions,
): Promise<{ status: number; text: string; headers: Headers }> {
  const ssrf = checkMarketplaceScrapeUrl(url);
  if (!ssrf.allowed) {
    throw new SsrfBlockedError(url, ssrf.reason || 'not allowed');
  }

  const robotsCheck = await isAllowedByRobots(url, opts.userAgent);
  if (!robotsCheck.allowed) {
    throw new RobotsDisallowedError(url);
  }

  const parsed = new URL(url);
  const host = parsed.host.toLowerCase();

  // If robots.txt advertises a crawl-delay that's stricter than our
  // configured rate, down-shift our effective rate.
  let effectiveRpm = Math.max(1, opts.requestsPerMinute || 30);
  if (robotsCheck.crawlDelaySeconds) {
    const robotsRpm = Math.floor(60 / robotsCheck.crawlDelaySeconds);
    effectiveRpm = Math.max(1, Math.min(effectiveRpm, robotsRpm));
  }

  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxRetries = opts.maxRetries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await rateLimiter.acquire(host, effectiveRpm);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'user-agent': opts.userAgent,
          'accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.8',
          'accept-language': opts.acceptLanguage ?? 'en-US,en;q=0.9',
          ...(opts.extraHeaders || {}),
        },
      });

      if (resp.status === 429 || resp.status === 503) {
        const retryAfter = resp.headers.get('retry-after');
        const waitMs = parseRetryAfter(retryAfter) ?? 2_000 * (attempt + 1);
        rateLimiter.delay(host, waitMs);
        if (attempt < maxRetries) continue;
      }

      const text = await resp.text();
      return { status: resp.status, text, headers: resp.headers };
    } catch (err) {
      if (attempt >= maxRetries) throw err;
      const backoffMs = 1_000 * Math.pow(2, attempt);
      rateLimiter.delay(host, backoffMs);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`politeGet exhausted retries for ${url}`);
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const dateMs = Date.parse(header);
  if (isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

export const DEFAULT_USER_AGENT =
  'MarinaMatchBot/1.0 (+https://marinamatch.com/bot; contact=ingest@marinamatch.com)';
