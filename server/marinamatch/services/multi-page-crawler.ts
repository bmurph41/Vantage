import * as cheerio from "cheerio";
import axios from "axios";
import crypto from "crypto";
import { extractListingsWithAI, validateExtractedListing, EstimatedCost } from "./ai-extractor";

export interface CrawlConfig {
  seedUrls: string[];
  crawlMode: "single" | "pagination" | "multi_seed" | "sitemap";
  paginationSelector?: string;
  paginationUrlPattern?: string;
  listingLinkSelector?: string;
  maxPagesPerRun: number;
  maxCrawlDepth: number;
  tokenBudgetPerRun: number;
  respectRobotsTxt: boolean;
  userAgent: string;
  rateLimitRpm: number;
}

export interface CrawlResult {
  pagesVisited: string[];
  pagesCrawled: number;
  pagesSkipped: number;
  linksDiscovered: number;
  listingUrls: string[];
  tokensSpent: number;
  errors: string[];
  budgetExceeded: boolean;
}

export interface PageContent {
  url: string;
  html: string;
  links: string[];
  nextPageUrl?: string;
  listingLinks: string[];
}

const COST_PER_1K_INPUT_TOKENS = 0.0025;
const COST_PER_1K_OUTPUT_TOKENS = 0.01;
const AVG_TOKENS_PER_PAGE = 4000;
const ESTIMATED_COST_PER_PAGE = (AVG_TOKENS_PER_PAGE / 1000) * COST_PER_1K_INPUT_TOKENS + 0.5 * COST_PER_1K_OUTPUT_TOKENS;

interface RobotsTxtRules {
  disallowedPaths: string[];
  allowedPaths: string[];
  crawlDelay?: number;
}

const robotsTxtCache: Map<string, { rules: RobotsTxtRules; fetchedAt: number }> = new Map();
const ROBOTS_TXT_CACHE_TTL = 3600000;

export class MultiPageCrawler {
  private config: CrawlConfig;
  private visitedUrls: Set<string> = new Set();
  private urlQueue: Array<{ url: string; depth: number }> = [];
  private totalCost: number = 0;
  private errors: string[] = [];
  private sourceName: string;
  private baseHost: string = "";
  private robotsRules: RobotsTxtRules | null = null;

  constructor(config: CrawlConfig, sourceName: string) {
    this.config = config;
    this.sourceName = sourceName;
  }

  private async fetchRobotsTxt(baseUrl: string): Promise<RobotsTxtRules> {
    try {
      const url = new URL(baseUrl);
      const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
      const cacheKey = url.host;

      const cached = robotsTxtCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < ROBOTS_TXT_CACHE_TTL) {
        console.log(`[${this.sourceName}] Using cached robots.txt for ${url.host}`);
        return cached.rules;
      }

      console.log(`[${this.sourceName}] Fetching robots.txt from ${robotsUrl}`);
      const response = await axios.get(robotsUrl, {
        timeout: 5000,
        headers: { "User-Agent": this.config.userAgent },
        validateStatus: (status) => status < 500,
      });

      const rules: RobotsTxtRules = { disallowedPaths: [], allowedPaths: [] };

      if (response.status !== 200) {
        console.log(`[${this.sourceName}] No robots.txt found (${response.status}), allowing all`);
        robotsTxtCache.set(cacheKey, { rules, fetchedAt: Date.now() });
        return rules;
      }

      const lines = response.data.toString().split("\n");
      let inUserAgentBlock = false;
      const userAgent = this.config.userAgent.split("/")[0].toLowerCase();

      for (const line of lines) {
        const trimmed = line.trim().toLowerCase();
        if (trimmed.startsWith("user-agent:")) {
          const agent = trimmed.replace("user-agent:", "").trim();
          inUserAgentBlock = agent === "*" || agent.includes(userAgent);
        } else if (inUserAgentBlock) {
          if (trimmed.startsWith("disallow:")) {
            const path = line.trim().replace(/disallow:/i, "").trim();
            if (path) rules.disallowedPaths.push(path);
          } else if (trimmed.startsWith("allow:")) {
            const path = line.trim().replace(/allow:/i, "").trim();
            if (path) rules.allowedPaths.push(path);
          } else if (trimmed.startsWith("crawl-delay:")) {
            const delay = parseInt(trimmed.replace("crawl-delay:", "").trim());
            if (!isNaN(delay)) rules.crawlDelay = delay;
          }
        }
      }

      console.log(`[${this.sourceName}] Parsed robots.txt: ${rules.disallowedPaths.length} disallowed, ${rules.allowedPaths.length} allowed`);
      robotsTxtCache.set(cacheKey, { rules, fetchedAt: Date.now() });
      return rules;
    } catch (error: any) {
      console.log(`[${this.sourceName}] Error fetching robots.txt: ${error.message}, allowing all`);
      return { disallowedPaths: [], allowedPaths: [] };
    }
  }

  private isUrlAllowedByRobots(url: string): boolean {
    if (!this.config.respectRobotsTxt || !this.robotsRules) {
      return true;
    }

    try {
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname + parsedUrl.search;

      for (const allowedPath of this.robotsRules.allowedPaths) {
        if (path.startsWith(allowedPath)) {
          return true;
        }
      }

      for (const disallowedPath of this.robotsRules.disallowedPaths) {
        if (disallowedPath === "/" || path.startsWith(disallowedPath)) {
          console.log(`[${this.sourceName}] Skipping ${url} - disallowed by robots.txt`);
          return false;
        }
      }

      return true;
    } catch {
      return true;
    }
  }

  async crawl(): Promise<CrawlResult> {
    const result: CrawlResult = {
      pagesVisited: [],
      pagesCrawled: 0,
      pagesSkipped: 0,
      linksDiscovered: 0,
      listingUrls: [],
      tokensSpent: 0,
      errors: [],
      budgetExceeded: false,
    };

    console.log(`[${this.sourceName}] Starting multi-page crawl with mode: ${this.config.crawlMode}`);
    console.log(`[${this.sourceName}] Budget: $${this.config.tokenBudgetPerRun}, Max pages: ${this.config.maxPagesPerRun}`);

    const seedUrls = this.config.seedUrls?.length > 0 
      ? this.config.seedUrls 
      : [];

    if (seedUrls.length === 0) {
      console.log(`[${this.sourceName}] No seed URLs configured`);
      return result;
    }

    try {
      const firstUrl = new URL(seedUrls[0]);
      this.baseHost = firstUrl.hostname;
    } catch (e) {
      this.errors.push(`Invalid seed URL: ${seedUrls[0]}`);
      result.errors = this.errors;
      return result;
    }

    if (this.config.respectRobotsTxt) {
      this.robotsRules = await this.fetchRobotsTxt(seedUrls[0]);
    }

    for (const seedUrl of seedUrls) {
      this.urlQueue.push({ url: seedUrl, depth: 0 });
    }

    while (this.urlQueue.length > 0) {
      if (result.pagesCrawled >= this.config.maxPagesPerRun) {
        console.log(`[${this.sourceName}] Max pages limit reached (${this.config.maxPagesPerRun})`);
        break;
      }

      if (this.totalCost >= this.config.tokenBudgetPerRun) {
        console.log(`[${this.sourceName}] Token budget exceeded ($${this.totalCost.toFixed(4)})`);
        result.budgetExceeded = true;
        break;
      }

      const { url, depth } = this.urlQueue.shift()!;
      
      if (this.visitedUrls.has(this.normalizeUrl(url))) {
        result.pagesSkipped++;
        continue;
      }

      if (depth > this.config.maxCrawlDepth) {
        result.pagesSkipped++;
        continue;
      }

      if (!this.isUrlAllowedByRobots(url)) {
        result.pagesSkipped++;
        continue;
      }

      this.visitedUrls.add(this.normalizeUrl(url));
      result.pagesVisited.push(url);

      try {
        const pageContent = await this.fetchPage(url);
        if (!pageContent) {
          result.pagesSkipped++;
          continue;
        }

        result.pagesCrawled++;
        console.log(`[${this.sourceName}] Crawled page ${result.pagesCrawled}/${this.config.maxPagesPerRun}: ${url}`);

        if (this.config.crawlMode === "pagination" && pageContent.nextPageUrl) {
          if (!this.visitedUrls.has(this.normalizeUrl(pageContent.nextPageUrl))) {
            this.urlQueue.push({ url: pageContent.nextPageUrl, depth: depth });
            console.log(`[${this.sourceName}] Found next page: ${pageContent.nextPageUrl}`);
          }
        }

        if (this.config.listingLinkSelector && pageContent.listingLinks.length > 0) {
          for (const listingUrl of pageContent.listingLinks) {
            if (!this.visitedUrls.has(this.normalizeUrl(listingUrl))) {
              result.listingUrls.push(listingUrl);
              result.linksDiscovered++;
              if (depth < this.config.maxCrawlDepth) {
                this.urlQueue.push({ url: listingUrl, depth: depth + 1 });
              }
            }
          }
          console.log(`[${this.sourceName}] Found ${pageContent.listingLinks.length} listing links on ${url}`);
        }

        this.totalCost += ESTIMATED_COST_PER_PAGE;

        await this.delay(60000 / this.config.rateLimitRpm);

      } catch (error: any) {
        this.errors.push(`Error crawling ${url}: ${error.message}`);
        console.error(`[${this.sourceName}] Error crawling ${url}:`, error.message);
      }
    }

    result.tokensSpent = this.totalCost;
    result.errors = this.errors;
    
    console.log(`[${this.sourceName}] Crawl complete: ${result.pagesCrawled} pages, ${result.linksDiscovered} links, $${this.totalCost.toFixed(4)} estimated cost`);
    
    return result;
  }

  private async fetchPage(url: string): Promise<PageContent | null> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": this.config.userAgent,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        timeout: 15000,
        maxRedirects: 3,
      });

      const $ = cheerio.load(response.data);
      
      let nextPageUrl: string | undefined;
      if (this.config.paginationSelector) {
        const nextLink = $(this.config.paginationSelector).first();
        if (nextLink.length > 0) {
          const href = nextLink.attr("href");
          if (href) {
            nextPageUrl = this.resolveUrl(href, url);
          }
        }
      } else if (this.config.paginationUrlPattern) {
        nextPageUrl = this.findNextPageFromPattern(url);
      }

      const listingLinks: string[] = [];
      if (this.config.listingLinkSelector) {
        $(this.config.listingLinkSelector).each((_, el) => {
          const href = $(el).attr("href");
          if (href) {
            const absoluteUrl = this.resolveUrl(href, url);
            if (this.isSameHost(absoluteUrl)) {
              listingLinks.push(absoluteUrl);
            }
          }
        });
      }

      const allLinks: string[] = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (href) {
          const absoluteUrl = this.resolveUrl(href, url);
          if (this.isSameHost(absoluteUrl)) {
            allLinks.push(absoluteUrl);
          }
        }
      });

      return {
        url,
        html: response.data,
        links: allLinks,
        nextPageUrl,
        listingLinks: [...new Set(listingLinks)],
      };

    } catch (error: any) {
      console.error(`[${this.sourceName}] Failed to fetch ${url}:`, error.message);
      return null;
    }
  }

  private findNextPageFromPattern(currentUrl: string): string | undefined {
    if (!this.config.paginationUrlPattern) return undefined;

    const pageMatch = currentUrl.match(/[?&]page=(\d+)/i) || currentUrl.match(/\/page\/(\d+)/i);
    const currentPage = pageMatch ? parseInt(pageMatch[1], 10) : 1;
    const nextPage = currentPage + 1;

    return this.config.paginationUrlPattern.replace("{page}", nextPage.toString());
  }

  private resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return href;
    }
  }

  private isSameHost(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === this.baseHost || parsed.hostname.endsWith(`.${this.baseHost}`);
    } catch {
      return false;
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      const normalized = parsed.href.toLowerCase();
      return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
    } catch {
      return url.toLowerCase();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export async function discoverListingUrls(
  searchUrl: string,
  sourceName: string,
  config: Partial<CrawlConfig> & { tokenBudgetPerRun?: number | string }
): Promise<{ urls: string[]; pagesCrawled: number; cost: number }> {
  const parsedBudget = typeof config.tokenBudgetPerRun === "string" 
    ? parseFloat(config.tokenBudgetPerRun) 
    : (config.tokenBudgetPerRun || 0.50);

  const fullConfig: CrawlConfig = {
    seedUrls: [searchUrl],
    crawlMode: config.crawlMode || "single",
    paginationSelector: config.paginationSelector,
    paginationUrlPattern: config.paginationUrlPattern,
    listingLinkSelector: config.listingLinkSelector,
    maxPagesPerRun: config.maxPagesPerRun || 5,
    maxCrawlDepth: config.maxCrawlDepth || 1,
    tokenBudgetPerRun: isNaN(parsedBudget) ? 0.50 : parsedBudget,
    respectRobotsTxt: config.respectRobotsTxt ?? true,
    userAgent: config.userAgent || "MarinaMatchBot/1.0 (+https://marinamatch.com)",
    rateLimitRpm: config.rateLimitRpm || 30,
  };

  const crawler = new MultiPageCrawler(fullConfig, sourceName);
  const result = await crawler.crawl();

  return {
    urls: result.listingUrls.length > 0 ? result.listingUrls : result.pagesVisited,
    pagesCrawled: result.pagesCrawled,
    cost: result.tokensSpent,
  };
}

export function estimateCrawlCost(config: CrawlConfig & { tokenBudgetPerRun?: number | string }): { estimatedPages: number; estimatedCost: number; warning?: string } {
  const seedCount = config.seedUrls?.length || 1;
  let estimatedPages = seedCount;

  if (config.crawlMode === "pagination") {
    estimatedPages = Math.min(seedCount * 5, config.maxPagesPerRun);
  } else if (config.crawlMode === "multi_seed") {
    estimatedPages = Math.min(seedCount * 2, config.maxPagesPerRun);
  }

  const estimatedCost = estimatedPages * ESTIMATED_COST_PER_PAGE;
  
  const budget = typeof config.tokenBudgetPerRun === "string" 
    ? parseFloat(config.tokenBudgetPerRun) 
    : (config.tokenBudgetPerRun || 0.50);
  
  let warning: string | undefined;
  if (!isNaN(budget) && estimatedCost > budget) {
    warning = `Estimated cost ($${estimatedCost.toFixed(2)}) exceeds budget ($${budget.toFixed(2)})`;
  }

  return { estimatedPages, estimatedCost, warning };
}
