import { V2_CONFIG } from '../../docket/scraper_v2/config';
import { extractDomain } from '../../docket/scraper_v2/utils/url';
import { contentHash } from '../../docket/scraper_v2/utils/hash';
import { waitForToken, exponentialBackoff, sleep, acquireHostSlot, releaseHostSlot } from '../../docket/scraper_v2/utils/rateLimit';
import { fetchRobotsRules, isUrlAllowed } from '../../docket/scraper_v2/utils/robots';
import { smartFetch } from './headless-fetcher';

export interface RobustFetchOptions {
  url: string;
  etag?: string;
  lastModified?: string;
  respectRobots?: boolean;
  forceHeadless?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface RobustFetchResult {
  success: boolean;
  url: string;
  finalUrl: string;
  statusCode: number;
  mimeType: string;
  html: string;
  etag?: string;
  lastModified?: string;
  contentHash: string;
  bytes: number;
  fetchMs: number;
  fetchMethod: 'static' | 'headless';
  retryCount: number;
  wasConditional: boolean;
  error?: string;
}

export async function robustFetch(options: RobustFetchOptions): Promise<RobustFetchResult> {
  const { 
    url, 
    etag, 
    lastModified, 
    respectRobots = true, 
    forceHeadless = false,
    maxRetries = V2_CONFIG.fetcher.maxRetries,
    timeoutMs = V2_CONFIG.fetcher.timeoutMs 
  } = options;
  
  const domain = extractDomain(url);
  const startTime = Date.now();
  let retryCount = 0;
  
  if (respectRobots) {
    try {
      const robotsRules = await fetchRobotsRules(new URL(url).origin);
      if (robotsRules) {
        const parsedUrl = new URL(url);
        if (!isUrlAllowed(parsedUrl.pathname, robotsRules)) {
          return {
            success: false,
            url,
            finalUrl: url,
            statusCode: 0,
            mimeType: '',
            html: '',
            contentHash: '',
            bytes: 0,
            fetchMs: Date.now() - startTime,
            fetchMethod: 'static',
            retryCount: 0,
            wasConditional: false,
            error: 'Blocked by robots.txt',
          };
        }
      }
    } catch (robotsError) {
      console.log(`[RobustFetcher] Could not check robots.txt for ${domain}, proceeding anyway`);
    }
  }
  
  await waitForToken(domain);
  await acquireHostSlot(domain);
  
  try {
    let lastError: Error | null = null;
    
    while (retryCount <= maxRetries) {
      try {
        if (!forceHeadless) {
          const headers: Record<string, string> = {
            'User-Agent': V2_CONFIG.fetcher.userAgent,
            'Accept': 'text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Accept-Language': 'en-US,en;q=0.5',
          };
          
          if (etag) headers['If-None-Match'] = etag;
          if (lastModified) headers['If-Modified-Since'] = lastModified;
          
          const response = await fetch(url, {
            method: 'GET',
            headers,
            redirect: 'follow',
            signal: AbortSignal.timeout(timeoutMs),
          });
          
          const statusCode = response.status;
          const finalUrl = response.url;
          const mimeType = response.headers.get('content-type') || '';
          const responseEtag = response.headers.get('etag') || undefined;
          const responseLM = response.headers.get('last-modified') || undefined;
          
          if (statusCode === 304) {
            return {
              success: true,
              url,
              finalUrl,
              statusCode,
              mimeType,
              html: '',
              etag: responseEtag,
              lastModified: responseLM,
              contentHash: '',
              bytes: 0,
              fetchMs: Date.now() - startTime,
              fetchMethod: 'static',
              retryCount,
              wasConditional: true,
            };
          }
          
          if (statusCode >= 500 && retryCount < maxRetries) {
            const delay = exponentialBackoff(retryCount);
            await sleep(delay);
            retryCount++;
            continue;
          }
          
          if (statusCode === 403 || statusCode === 429 || statusCode === 503) {
            console.log(`[RobustFetcher] Static fetch blocked (${statusCode}), trying headless...`);
            break;
          }
          
          if (statusCode >= 200 && statusCode < 300) {
            const html = await response.text();
            const bytes = new TextEncoder().encode(html).length;
            
            const needsJs = detectNeedsJsRendering(html);
            if (needsJs) {
              console.log(`[RobustFetcher] Static fetch got JS-heavy page, trying headless...`);
              break;
            }
            
            return {
              success: true,
              url,
              finalUrl,
              statusCode,
              mimeType,
              html,
              etag: responseEtag,
              lastModified: responseLM,
              contentHash: contentHash(html),
              bytes,
              fetchMs: Date.now() - startTime,
              fetchMethod: 'static',
              retryCount,
              wasConditional: !!(etag || lastModified),
            };
          }
          
          return {
            success: false,
            url,
            finalUrl,
            statusCode,
            mimeType,
            html: '',
            contentHash: '',
            bytes: 0,
            fetchMs: Date.now() - startTime,
            fetchMethod: 'static',
            retryCount,
            wasConditional: !!(etag || lastModified),
            error: `HTTP ${statusCode}`,
          };
        }
        
        break;
        
      } catch (err) {
        lastError = err as Error;
        
        if ((err as Error).name === 'AbortError' || (err as Error).name === 'TimeoutError') {
          console.log(`[RobustFetcher] Static fetch timed out, trying headless...`);
          break;
        }
        
        if (retryCount < maxRetries) {
          const delay = exponentialBackoff(retryCount);
          await sleep(delay);
          retryCount++;
        } else {
          break;
        }
      }
    }
    
    console.log(`[RobustFetcher] Falling back to headless fetch for ${url}`);
    const headlessResult = await smartFetch(url, {
      waitForTimeout: 3000,
      scrollToBottom: true,
      blockFonts: true,
      forceHeadless: true,
    });
    
    if (headlessResult.success) {
      return {
        success: true,
        url,
        finalUrl: headlessResult.finalUrl,
        statusCode: headlessResult.statusCode,
        mimeType: 'text/html',
        html: headlessResult.html,
        contentHash: contentHash(headlessResult.html),
        bytes: new TextEncoder().encode(headlessResult.html).length,
        fetchMs: Date.now() - startTime,
        fetchMethod: 'headless',
        retryCount,
        wasConditional: false,
      };
    }
    
    return {
      success: false,
      url,
      finalUrl: headlessResult.finalUrl,
      statusCode: headlessResult.statusCode,
      mimeType: '',
      html: '',
      contentHash: '',
      bytes: 0,
      fetchMs: Date.now() - startTime,
      fetchMethod: 'headless',
      retryCount,
      wasConditional: false,
      error: headlessResult.error || 'Headless fetch failed',
    };
    
  } finally {
    releaseHostSlot(domain);
  }
}

function detectNeedsJsRendering(html: string): boolean {
  const htmlLower = html.toLowerCase();
  
  const criticalJsIndicators = [
    "javascript is required",
    "enable javascript",
    "please enable javascript",
    "this page requires javascript",
  ];
  
  if (criticalJsIndicators.some(indicator => htmlLower.includes(indicator))) {
    return true;
  }
  
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;
  const textContent = bodyContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (textContent.length < 100) {
    return true;
  }
  
  const listingPatterns = [/marina/gi, /slip/gi, /boat/gi, /\$[\d,]+/g, /for sale/gi];
  let contentScore = 0;
  for (const pattern of listingPatterns) {
    const matches = textContent.match(pattern);
    contentScore += matches ? matches.length : 0;
  }
  
  if (contentScore >= 3) {
    return false;
  }
  
  const loadingPatterns = [
    /<div[^>]*id=["'](?:root|app|__next)["'][^>]*>\s*<\/div>/i,
    /window\.__INITIAL_STATE__/i,
    /window\.__NUXT__/i,
  ];
  
  return loadingPatterns.some(pattern => pattern.test(html));
}

export async function robustFetchBatch(
  options: RobustFetchOptions[],
  concurrency: number = 3
): Promise<RobustFetchResult[]> {
  const results: RobustFetchResult[] = [];
  
  for (let i = 0; i < options.length; i += concurrency) {
    const batch = options.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(opt => robustFetch(opt).catch(err => ({
        success: false,
        url: opt.url,
        finalUrl: opt.url,
        statusCode: 0,
        mimeType: '',
        html: '',
        contentHash: '',
        bytes: 0,
        fetchMs: 0,
        fetchMethod: 'static' as const,
        retryCount: 0,
        wasConditional: false,
        error: (err as Error).message,
      })))
    );
    results.push(...batchResults);
  }
  
  return results;
}
