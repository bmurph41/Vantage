import * as cheerio from 'cheerio';
import type { DiscoveredCandidate } from '../types';
import { normalizeUrl, isValidHttpUrl, shouldIncludeUrl } from '../utils/url';
import { V2_CONFIG } from '../config';
import { logger } from '../utils/logger';

export interface SitemapDiscoveryOptions {
  sitemapUrl: string;
  baseUrl: string;
  allowPatterns?: string[] | null;
  denyPatterns?: string[] | null;
  maxUrls?: number;
  maxDepth?: number;
}

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

export async function discoverFromSitemap(options: SitemapDiscoveryOptions): Promise<DiscoveredCandidate[]> {
  const { sitemapUrl, baseUrl, allowPatterns, denyPatterns, maxUrls = 500, maxDepth = 2 } = options;
  const candidates: DiscoveredCandidate[] = [];
  const visited = new Set<string>();
  
  async function processSitemap(url: string, depth: number): Promise<void> {
    if (depth > maxDepth || visited.has(url) || candidates.length >= maxUrls) return;
    visited.add(url);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': V2_CONFIG.fetcher.userAgent,
          'Accept': 'application/xml, text/xml',
        },
        signal: AbortSignal.timeout(V2_CONFIG.fetcher.timeoutMs),
      });
      
      if (!response.ok) {
        logger.warn({
          module: 'docket_v2',
          event: 'sitemap_fetch_failed',
          url,
          status: response.status,
        });
        return;
      }
      
      const content = await response.text();
      const $ = cheerio.load(content, { xmlMode: true });
      
      const sitemapIndexUrls = $('sitemapindex > sitemap > loc').map((_, el) => $(el).text()).get();
      if (sitemapIndexUrls.length > 0) {
        for (const indexUrl of sitemapIndexUrls.slice(0, 10)) {
          if (candidates.length >= maxUrls) break;
          await processSitemap(indexUrl, depth + 1);
        }
        return;
      }
      
      const urlElements = $('urlset > url');
      urlElements.each((_, el) => {
        if (candidates.length >= maxUrls) return false;
        
        const loc = $(el).find('loc').first().text();
        const lastmod = $(el).find('lastmod').first().text();
        
        if (!loc || !isValidHttpUrl(loc)) return;
        
        const normalizedUrl = normalizeUrl(loc, baseUrl);
        
        if (!shouldIncludeUrl(normalizedUrl, allowPatterns, denyPatterns)) {
          return;
        }
        
        let publishedAt: Date | undefined;
        if (lastmod) {
          try {
            publishedAt = new Date(lastmod);
            if (isNaN(publishedAt.getTime())) publishedAt = undefined;
          } catch {
            publishedAt = undefined;
          }
        }
        
        candidates.push({
          url: loc,
          normalizedUrl,
          discoveryMethod: 'sitemap',
          publishedAt,
          metadata: {
            lastmod,
            sitemapSource: url,
          },
        });
      });
      
    } catch (error) {
      logger.error({
        module: 'docket_v2',
        event: 'sitemap_error',
        url,
        error: (error as Error).message,
      });
    }
  }
  
  await processSitemap(sitemapUrl, 0);
  
  logger.debug({
    module: 'docket_v2',
    event: 'sitemap_discovery',
    sitemapUrl,
    urlsFound: candidates.length,
  });
  
  return candidates;
}
