import * as cheerio from 'cheerio';
import type { DiscoveredCandidate } from '../types';
import type { Dt2CrawlPolicy } from '@shared/docktalk-v2-schema';
import { normalizeUrl, isValidHttpUrl, shouldIncludeUrl, extractDomain, resolveUrl, getPathDepth } from '../utils/url';
import { fetchRobotsRules, isUrlAllowed, getCrawlDelay } from '../utils/robots';
import { waitForToken, sleep } from '../utils/rateLimit';
import { V2_CONFIG } from '../config';
import { logger } from '../utils/logger';

export interface CrawlDiscoveryOptions {
  seedUrl: string;
  baseUrl: string;
  crawlPolicy: Dt2CrawlPolicy;
  allowPatterns?: string[] | null;
  denyPatterns?: string[] | null;
}

export async function discoverFromCrawl(options: CrawlDiscoveryOptions): Promise<DiscoveredCandidate[]> {
  const { seedUrl, baseUrl, crawlPolicy, allowPatterns, denyPatterns } = options;
  const { maxPagesPerRun, maxDepth, minDelayMs, respectRobotsTxt } = crawlPolicy;
  
  const candidates: DiscoveredCandidate[] = [];
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: seedUrl, depth: 0 }];
  
  const domain = extractDomain(baseUrl);
  const robotsRules = respectRobotsTxt ? await fetchRobotsRules(baseUrl) : null;
  const crawlDelay = getCrawlDelay(robotsRules, minDelayMs);
  
  while (queue.length > 0 && candidates.length < maxPagesPerRun) {
    const { url, depth } = queue.shift()!;
    const normalizedUrl = normalizeUrl(url, baseUrl);
    
    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);
    
    if (depth > maxDepth) continue;
    
    try {
      const parsedUrl = new URL(url);
      
      if (robotsRules && !isUrlAllowed(parsedUrl.pathname, robotsRules)) {
        continue;
      }
      
      if (!shouldIncludeUrl(normalizedUrl, allowPatterns, denyPatterns)) {
        continue;
      }
      
      await waitForToken(domain);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': V2_CONFIG.fetcher.userAgent,
          'Accept': 'text/html',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(V2_CONFIG.fetcher.timeoutMs),
      });
      
      if (!response.ok) continue;
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) continue;
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      if (isArticlePage($)) {
        candidates.push({
          url,
          normalizedUrl,
          discoveryMethod: 'crawl',
          depth,
          title: $('title').text().trim() || $('h1').first().text().trim(),
          metadata: {
            crawledFrom: seedUrl,
          },
        });
      }
      
      if (depth < maxDepth) {
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          
          const absoluteUrl = resolveUrl(href, url);
          if (!isValidHttpUrl(absoluteUrl)) return;
          
          const linkDomain = extractDomain(absoluteUrl);
          if (linkDomain !== domain) return;
          
          const linkNormalized = normalizeUrl(absoluteUrl, baseUrl);
          if (!visited.has(linkNormalized) && !queue.some(q => normalizeUrl(q.url, baseUrl) === linkNormalized)) {
            queue.push({ url: absoluteUrl, depth: depth + 1 });
          }
        });
      }
      
      await sleep(crawlDelay);
      
    } catch (error) {
      logger.warn({
        module: 'docktalk_v2',
        event: 'crawl_page_error',
        url,
        error: (error as Error).message,
      });
    }
  }
  
  logger.debug({
    module: 'docktalk_v2',
    event: 'crawl_discovery',
    seedUrl,
    pagesFound: candidates.length,
    pagesVisited: visited.size,
  });
  
  return candidates;
}

function isArticlePage($: cheerio.CheerioAPI): boolean {
  const articleIndicators = [
    $('article').length > 0,
    $('[itemtype*="Article"]').length > 0,
    $('meta[property="og:type"][content="article"]').length > 0,
    $('time[datetime]').length > 0,
    $('.post-content, .article-content, .entry-content').length > 0,
  ];
  
  const bodyText = $('body').text();
  const wordCount = bodyText.split(/\s+/).length;
  const hasSubstantialContent = wordCount > 200;
  
  const indicatorScore = articleIndicators.filter(Boolean).length;
  
  return indicatorScore >= 1 && hasSubstantialContent;
}
