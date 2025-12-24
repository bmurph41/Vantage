import * as cheerio from 'cheerio';
import { robustFetch, robustFetchBatch } from './robust-fetcher';
import RssParser from 'rss-parser';

export interface DiscoveredListing {
  url: string;
  title?: string;
  discoveredAt: Date;
  priority: 'high' | 'medium' | 'low';
  source: 'rss' | 'sitemap' | 'crawl' | 'pagination';
  metadata?: Record<string, unknown>;
}

export interface DiscoveryOptions {
  seedUrl: string;
  baseUrl: string;
  maxPages?: number;
  allowPatterns?: string[];
  denyPatterns?: string[];
  paginationSelector?: string;
  listingSelector?: string;
  respectRobots?: boolean;
}

const MARINA_RSS_FEEDS = [
  'https://www.marinaworld.com/feed/',
  'https://www.boatinternational.com/rss/latest-news',
];

const LISTING_URL_PATTERNS = [
  /\/marina[s-]?for[- ]?sale\//i,
  /\/property\//i,
  /\/listing\//i,
  /\/commercial[- ]?real[- ]?estate\//i,
  /\/cre[- ]?listings?\//i,
  /\/for[- ]?sale\//i,
  /\/inventory\//i,
  /id=\d+/i,
  /listing_id/i,
];

const EXCLUDE_URL_PATTERNS = [
  /\/login\b/i,
  /\/register\b/i,
  /\/contact\b/i,
  /\/about\b/i,
  /\/privacy\b/i,
  /\/terms\b/i,
  /\/careers\b/i,
  /\.(pdf|jpg|jpeg|png|gif|zip|docx?)$/i,
  /\?sort=/i,
  /\?page=0/i,
];

export async function discoverFromRss(feedUrl: string): Promise<DiscoveredListing[]> {
  const parser = new RssParser();
  const listings: DiscoveredListing[] = [];

  try {
    const feed = await parser.parseURL(feedUrl);

    for (const item of feed.items || []) {
      if (!item.link) continue;

      const isListing = LISTING_URL_PATTERNS.some(p => p.test(item.link!));

      listings.push({
        url: item.link,
        title: item.title || undefined,
        discoveredAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        priority: isListing ? 'high' : 'medium',
        source: 'rss',
        metadata: {
          feedUrl,
          pubDate: item.pubDate,
          categories: item.categories,
        },
      });
    }
  } catch (error) {
    console.error(`[Discovery] RSS feed fetch failed for ${feedUrl}:`, error);
  }

  return listings;
}

export async function discoverFromSitemap(sitemapUrl: string, options?: { maxUrls?: number; allowPatterns?: string[] }): Promise<DiscoveredListing[]> {
  const listings: DiscoveredListing[] = [];
  const maxUrls = options?.maxUrls || 100;

  try {
    const result = await robustFetch({ url: sitemapUrl, respectRobots: false });

    if (!result.success || !result.html) {
      console.error(`[Discovery] Sitemap fetch failed for ${sitemapUrl}`);
      return [];
    }

    const $ = cheerio.load(result.html, { xmlMode: true });

    const sitemapIndexUrls = $('sitemap > loc').map((_, el) => $(el).text().trim()).get();
    if (sitemapIndexUrls.length > 0) {
      for (const indexUrl of sitemapIndexUrls.slice(0, 5)) {
        const subListings = await discoverFromSitemap(indexUrl, options);
        listings.push(...subListings);
        if (listings.length >= maxUrls) break;
      }
      return listings.slice(0, maxUrls);
    }

    $('url').each((_, el) => {
      if (listings.length >= maxUrls) return false;

      const loc = $('loc', el).text().trim();
      const lastmod = $('lastmod', el).text().trim();
      const priority = $('priority', el).text().trim();

      if (!loc) return;

      const isListing = LISTING_URL_PATTERNS.some(p => p.test(loc));
      if (!isListing && !options?.allowPatterns?.some(p => new RegExp(p).test(loc))) {
        return;
      }

      const isExcluded = EXCLUDE_URL_PATTERNS.some(p => p.test(loc));
      if (isExcluded) return;

      listings.push({
        url: loc,
        discoveredAt: lastmod ? new Date(lastmod) : new Date(),
        priority: parseFloat(priority) >= 0.7 ? 'high' : parseFloat(priority) >= 0.5 ? 'medium' : 'low',
        source: 'sitemap',
        metadata: { lastmod, priority },
      });
    });
  } catch (error) {
    console.error(`[Discovery] Sitemap parse failed for ${sitemapUrl}:`, error);
  }

  return listings;
}

export async function discoverFromCrawl(options: DiscoveryOptions): Promise<DiscoveredListing[]> {
  const listings: DiscoveredListing[] = [];
  const visited = new Set<string>();
  const maxPages = options.maxPages || 50;
  const queue: Array<{ url: string; depth: number }> = [{ url: options.seedUrl, depth: 0 }];

  const listingSelector = options.listingSelector || 
    'a[href*="listing"], a[href*="property"], a[href*="marina"], a[href*="for-sale"]';
  const paginationSelector = options.paginationSelector ||
    'a[href*="page="], a[href*="/page/"], .pagination a, .next-page, [rel="next"]';

  const normalizeUrl = (href: string, baseUrl: string): string | null => {
    try {
      const url = new URL(href, baseUrl);
      url.hash = '';
      return url.href;
    } catch {
      return null;
    }
  };

  while (queue.length > 0 && visited.size < maxPages) {
    const batch = queue.splice(0, 3);
    const fetchResults = await robustFetchBatch(
      batch.map(b => ({ url: b.url, respectRobots: options.respectRobots !== false })),
      3
    );

    for (let i = 0; i < fetchResults.length; i++) {
      const result = fetchResults[i];
      const { url, depth } = batch[i];

      if (!result.success || !result.html) continue;
      if (visited.has(url)) continue;
      visited.add(url);

      const $ = cheerio.load(result.html);
      const baseUrl = new URL(url).origin;

      $(listingSelector).each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        const fullUrl = normalizeUrl(href, url);
        if (!fullUrl) return;

        if (!fullUrl.startsWith(baseUrl) && !fullUrl.startsWith(options.baseUrl)) return;

        const isExcluded = EXCLUDE_URL_PATTERNS.some(p => p.test(fullUrl));
        if (isExcluded) return;

        if (options.denyPatterns?.some(p => new RegExp(p).test(fullUrl))) return;

        if (options.allowPatterns && !options.allowPatterns.some(p => new RegExp(p).test(fullUrl))) {
          if (!LISTING_URL_PATTERNS.some(p => p.test(fullUrl))) return;
        }

        if (!listings.find(l => l.url === fullUrl) && !visited.has(fullUrl)) {
          const title = $(el).text().trim() || $(el).attr('title') || undefined;
          listings.push({
            url: fullUrl,
            title,
            discoveredAt: new Date(),
            priority: 'high',
            source: 'crawl',
          });
        }
      });

      if (depth < 3) {
        $(paginationSelector).each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;

          const fullUrl = normalizeUrl(href, url);
          if (!fullUrl) return;

          if (!fullUrl.startsWith(baseUrl)) return;

          if (!visited.has(fullUrl) && !queue.find(q => q.url === fullUrl)) {
            queue.push({ url: fullUrl, depth: depth + 1 });
          }
        });
      }
    }
  }

  return listings;
}

export async function discoverPaginatedListings(
  baseUrl: string,
  options: {
    paginationPattern?: string;
    maxPages?: number;
    listingSelector?: string;
  } = {}
): Promise<DiscoveredListing[]> {
  const listings: DiscoveredListing[] = [];
  const maxPages = options.maxPages || 10;
  const seenUrls = new Set<string>();

  const paginationPatterns = [
    (page: number) => `${baseUrl}?page=${page}`,
    (page: number) => `${baseUrl}/page/${page}`,
    (page: number) => `${baseUrl}&page=${page}`,
  ];

  const getPageUrl = options.paginationPattern
    ? (page: number) => options.paginationPattern!.replace('{page}', page.toString())
    : paginationPatterns[0];

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = getPageUrl(page);

    const result = await robustFetch({ url: pageUrl });
    if (!result.success || !result.html) {
      console.log(`[Discovery] Pagination stopped at page ${page} - fetch failed`);
      break;
    }

    const $ = cheerio.load(result.html);
    const listingSelector = options.listingSelector ||
      'a[href*="listing"], a[href*="property"], a[href*="marina"]';

    let pageHasListings = false;

    $(listingSelector).each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      let fullUrl: string;
      try {
        fullUrl = new URL(href, pageUrl).href;
      } catch {
        return;
      }

      if (seenUrls.has(fullUrl)) return;
      seenUrls.add(fullUrl);

      const isExcluded = EXCLUDE_URL_PATTERNS.some(p => p.test(fullUrl));
      if (isExcluded) return;

      const title = $(el).text().trim() || $(el).attr('title') || undefined;
      listings.push({
        url: fullUrl,
        title,
        discoveredAt: new Date(),
        priority: 'high',
        source: 'pagination',
        metadata: { page },
      });
      pageHasListings = true;
    });

    if (!pageHasListings && page > 1) {
      console.log(`[Discovery] Pagination stopped at page ${page} - no new listings found`);
      break;
    }
  }

  return listings;
}

export async function discoverMarinaSources(): Promise<DiscoveredListing[]> {
  const allListings: DiscoveredListing[] = [];

  for (const feedUrl of MARINA_RSS_FEEDS) {
    try {
      const rssListings = await discoverFromRss(feedUrl);
      allListings.push(...rssListings);
    } catch (error) {
      console.error(`[Discovery] Failed to fetch RSS feed ${feedUrl}:`, error);
    }
  }

  return allListings;
}

export async function tryDiscoverSitemap(domain: string): Promise<string | null> {
  const sitemapUrls = [
    `${domain}/sitemap.xml`,
    `${domain}/sitemap_index.xml`,
    `${domain}/sitemap-index.xml`,
    `${domain}/sitemaps/sitemap.xml`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const result = await robustFetch({ url: sitemapUrl, respectRobots: false, timeoutMs: 10000 });
      if (result.success && result.html && result.html.includes('<urlset')) {
        return sitemapUrl;
      }
    } catch {
      continue;
    }
  }

  return null;
}
