import type { Dt2Source } from '@shared/docktalk-v2-schema';
import type { DiscoveredCandidate } from '../types';
import { discoverFromRss } from './rss';
import { discoverFromSitemap } from './sitemap';
import { discoverFromCrawl } from './crawl';
import { logDiscovery, logger } from '../utils/logger';

export async function discover(source: Dt2Source, runId: string): Promise<DiscoveredCandidate[]> {
  let candidates: DiscoveredCandidate[] = [];
  
  try {
    switch (source.type) {
      case 'rss':
        candidates = await discoverFromRss({
          feedUrl: source.discoveryUrl,
          baseUrl: source.baseUrl,
          allowPatterns: source.allowPatterns,
          denyPatterns: source.denyPatterns,
          maxItems: source.crawlPolicy.maxPagesPerRun,
        });
        break;
        
      case 'sitemap':
        candidates = await discoverFromSitemap({
          sitemapUrl: source.discoveryUrl,
          baseUrl: source.baseUrl,
          allowPatterns: source.allowPatterns,
          denyPatterns: source.denyPatterns,
          maxUrls: source.crawlPolicy.maxPagesPerRun,
          maxDepth: source.crawlPolicy.maxDepth,
        });
        break;
        
      case 'html':
        candidates = await discoverFromCrawl({
          seedUrl: source.discoveryUrl,
          baseUrl: source.baseUrl,
          crawlPolicy: source.crawlPolicy,
          allowPatterns: source.allowPatterns,
          denyPatterns: source.denyPatterns,
        });
        break;
        
      default:
        logger.warn({
          module: 'docktalk_v2',
          event: 'unknown_source_type',
          sourceId: source.id,
          type: source.type,
        });
        return [];
    }
    
    logDiscovery(runId, source.id, candidates.length, source.type);
    
  } catch (error) {
    logger.error({
      module: 'docktalk_v2',
      event: 'discovery_error',
      sourceId: source.id,
      type: source.type,
      error: (error as Error).message,
    });
    throw error;
  }
  
  return candidates;
}

export { discoverFromRss } from './rss';
export { discoverFromSitemap } from './sitemap';
export { discoverFromCrawl } from './crawl';
