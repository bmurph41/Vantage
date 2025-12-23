import Parser from 'rss-parser';
import type { DiscoveredCandidate } from '../types';
import { normalizeUrl, isValidHttpUrl, shouldIncludeUrl } from '../utils/url';
import { logger } from '../utils/logger';

const parser = new Parser({
  timeout: 30000,
  headers: {
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

export interface RssDiscoveryOptions {
  feedUrl: string;
  baseUrl: string;
  allowPatterns?: string[] | null;
  denyPatterns?: string[] | null;
  maxItems?: number;
}

export async function discoverFromRss(options: RssDiscoveryOptions): Promise<DiscoveredCandidate[]> {
  const { feedUrl, baseUrl, allowPatterns, denyPatterns, maxItems = 100 } = options;
  const candidates: DiscoveredCandidate[] = [];
  
  try {
    const feed = await parser.parseURL(feedUrl);
    
    for (const item of feed.items.slice(0, maxItems)) {
      const url = item.link || item.guid;
      if (!url || !isValidHttpUrl(url)) continue;
      
      const normalizedUrl = normalizeUrl(url, baseUrl);
      
      if (!shouldIncludeUrl(normalizedUrl, allowPatterns, denyPatterns)) {
        continue;
      }
      
      let publishedAt: Date | undefined;
      if (item.pubDate || item.isoDate) {
        try {
          publishedAt = new Date(item.pubDate || item.isoDate!);
          if (isNaN(publishedAt.getTime())) publishedAt = undefined;
        } catch {
          publishedAt = undefined;
        }
      }
      
      candidates.push({
        url,
        normalizedUrl,
        discoveryMethod: 'rss',
        title: item.title,
        publishedAt,
        metadata: {
          feedTitle: feed.title,
          author: item.creator || item.author,
          categories: item.categories,
        },
      });
    }
    
    logger.debug({
      module: 'docktalk_v2',
      event: 'rss_discovery',
      feedUrl,
      itemsFound: candidates.length,
    });
    
  } catch (error) {
    logger.error({
      module: 'docktalk_v2',
      event: 'rss_discovery_error',
      feedUrl,
      error: (error as Error).message,
    });
    throw error;
  }
  
  return candidates;
}

export function isRssFeed(mimeType: string): boolean {
  const rssTypes = [
    'application/rss+xml',
    'application/atom+xml',
    'application/xml',
    'text/xml',
  ];
  return rssTypes.some(t => mimeType.includes(t));
}
