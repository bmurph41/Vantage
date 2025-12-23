import { V2_CONFIG } from '../config';
import { extractDomain } from '../utils/url';
import { headersHash, contentHash } from '../utils/hash';
import { waitForToken, exponentialBackoff, sleep, acquireHostSlot, releaseHostSlot } from '../utils/rateLimit';
import { fetchRobotsRules, isUrlAllowed } from '../utils/robots';
import { logger } from '../utils/logger';
import type { FetchResult } from '../types';

export interface FetchOptions {
  url: string;
  etag?: string;
  lastModified?: string;
  respectRobots?: boolean;
  signal?: AbortSignal;
}

export async function fetchUrl(options: FetchOptions): Promise<FetchResult> {
  const { url, etag, lastModified, respectRobots = true, signal } = options;
  const domain = extractDomain(url);
  const startTime = Date.now();
  
  let finalUrl = url;
  let statusCode = 0;
  let content = '';
  let mimeType = '';
  let responseEtag: string | undefined;
  let responseLM: string | undefined;
  let rawHeaders: Record<string, string> = {};
  let bytes = 0;
  let error: string | undefined;
  
  try {
    if (respectRobots) {
      const robotsRules = await fetchRobotsRules(new URL(url).origin);
      if (robotsRules) {
        const parsedUrl = new URL(url);
        if (!isUrlAllowed(parsedUrl.pathname, robotsRules)) {
          return {
            url,
            finalUrl: url,
            statusCode: 0,
            mimeType: '',
            headersHash: '',
            contentHash: '',
            content: '',
            bytes: 0,
            fetchMs: Date.now() - startTime,
            error: 'Blocked by robots.txt',
          };
        }
      }
    }
    
    await waitForToken(domain);
    await acquireHostSlot(domain);
    
    const headers: Record<string, string> = {
      'User-Agent': V2_CONFIG.fetcher.userAgent,
      'Accept': 'text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.5',
    };
    
    if (etag) {
      headers['If-None-Match'] = etag;
    }
    if (lastModified) {
      headers['If-Modified-Since'] = lastModified;
    }
    
    let lastError: Error | null = null;
    let attempt = 0;
    
    while (attempt <= V2_CONFIG.fetcher.maxRetries) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          redirect: 'follow',
          signal: signal || AbortSignal.timeout(V2_CONFIG.fetcher.timeoutMs),
        });
        
        statusCode = response.status;
        finalUrl = response.url;
        mimeType = response.headers.get('content-type') || '';
        responseEtag = response.headers.get('etag') || undefined;
        responseLM = response.headers.get('last-modified') || undefined;
        
        response.headers.forEach((value, key) => {
          rawHeaders[key.toLowerCase()] = value;
        });
        
        if (statusCode === 304) {
          content = '';
          bytes = 0;
          break;
        }
        
        if (statusCode >= 500 && attempt < V2_CONFIG.fetcher.maxRetries) {
          const delay = exponentialBackoff(attempt);
          await sleep(delay);
          attempt++;
          continue;
        }
        
        if (statusCode >= 200 && statusCode < 300) {
          content = await response.text();
          bytes = new TextEncoder().encode(content).length;
        } else {
          error = `HTTP ${statusCode}`;
        }
        
        break;
        
      } catch (err) {
        lastError = err as Error;
        
        if ((err as Error).name === 'AbortError') {
          error = 'Request aborted or timeout';
          break;
        }
        
        if (attempt < V2_CONFIG.fetcher.maxRetries) {
          const delay = exponentialBackoff(attempt);
          await sleep(delay);
          attempt++;
        } else {
          error = lastError.message;
          break;
        }
      }
    }
    
  } catch (err) {
    error = (err as Error).message;
  } finally {
    releaseHostSlot(domain);
  }
  
  const fetchMs = Date.now() - startTime;
  
  return {
    url,
    finalUrl,
    statusCode,
    mimeType,
    etag: responseEtag,
    lastModified: responseLM,
    headersHash: headersHash(rawHeaders),
    contentHash: content ? contentHash(content) : '',
    content,
    bytes,
    fetchMs,
    error,
  };
}

export async function fetchBatch(
  urls: FetchOptions[], 
  concurrency: number = V2_CONFIG.fetcher.perHostConcurrency
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  const chunks: FetchOptions[][] = [];
  
  for (let i = 0; i < urls.length; i += concurrency) {
    chunks.push(urls.slice(i, i + concurrency));
  }
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(opts => fetchUrl(opts).catch(err => ({
        url: opts.url,
        finalUrl: opts.url,
        statusCode: 0,
        mimeType: '',
        headersHash: '',
        contentHash: '',
        content: '',
        bytes: 0,
        fetchMs: 0,
        error: (err as Error).message,
      })))
    );
    results.push(...chunkResults);
  }
  
  return results;
}
