import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { storage } from "../storage";
import { scrapeWebPage, fetchArticleBody, validateScrapedArticle, type ScrapedArticle } from "./web-scraper";
import { scoreArticle } from "./scoring";
import { categorizeAndTag } from "./categorizer";
import { summarizeArticle } from "./ai-summarizer";
import { enrichArticle } from "./ai-enrichment";
import { checkForDuplicate } from "./deduplication";

const parser = new Parser({
  timeout: 15000,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; DockTalk/2.0; +https://docktalk.replit.app)'
  }
});

interface BackfillOptions {
  sourceId?: number;
  sourceName?: string;
  monthsBack?: number;
  maxArticlesPerSource?: number;
}

interface BackfillResult {
  sourceName: string;
  newArticles: number;
  duplicates: number;
  errors: number;
  status: 'success' | 'partial' | 'error';
  message?: string;
}

/**
 * Backfill articles from the last N months for RSS sources
 * This fetches historical data beyond the typical 10-50 recent items
 */
export async function backfillHistoricalArticles(options: BackfillOptions = {}): Promise<BackfillResult[]> {
  const {
    sourceId,
    sourceName,
    monthsBack = 6,
    maxArticlesPerSource = 500
  } = options;

  const results: BackfillResult[] = [];
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);

  try {
    const sources = await storage.getRssSources();
    const sourcesToProcess = sources.filter(s => {
      if (sourceId && s.id !== sourceId) return false;
      if (sourceName && s.name !== sourceName) return false;
      return true;
    });

    console.log(`Starting backfill for ${sourcesToProcess.length} sources (${monthsBack} months back)`);

    for (const source of sourcesToProcess) {
      const result: BackfillResult = {
        sourceName: source.name,
        newArticles: 0,
        duplicates: 0,
        errors: 0,
        status: 'success'
      };

      try {
        if (source.sourceType === 'web_scrape') {
          // For web scraping sources, scrape archive pages
          console.log(`Backfilling web scrape source: ${source.name}`);
          const backfillResult = await backfillWebScrapeSource(source, cutoffDate, maxArticlesPerSource);
          result.newArticles = backfillResult.newArticles;
          result.duplicates = backfillResult.duplicates;
          result.errors = backfillResult.errors;
        } else {
          // For RSS feeds, try RSS first, then fall back to web scraping
          console.log(`Backfilling RSS source: ${source.name}`);
          const rssResult = await backfillRssSource(source, cutoffDate, maxArticlesPerSource);
          result.newArticles = rssResult.newArticles;
          result.duplicates = rssResult.duplicates;
          result.errors = rssResult.errors;
          
          // If RSS didn't yield many articles, try web scraping archives
          if (rssResult.newArticles < 10) {
            console.log(`RSS feed for ${source.name} has limited history, trying web scraping fallback...`);
            const webResult = await backfillWebScrapeSource(source, cutoffDate, maxArticlesPerSource - rssResult.newArticles);
            result.newArticles += webResult.newArticles;
            result.duplicates += webResult.duplicates;
            result.errors += webResult.errors;
          }
        }

        if (result.errors > 0 && result.newArticles === 0) {
          result.status = 'error';
          result.message = `Failed to fetch articles from ${source.name}`;
        } else if (result.errors > 0) {
          result.status = 'partial';
          result.message = `Partially completed with ${result.errors} errors`;
        }

        await storage.updateRssSourceLastFetched(source.id);
      } catch (error) {
        console.error(`Error backfilling source ${source.name}:`, error);
        result.status = 'error';
        result.message = error instanceof Error ? error.message : 'Unknown error';
        result.errors++;
      }

      results.push(result);
    }

    return results;
  } catch (error) {
    console.error("Error in backfill process:", error);
    throw error;
  }
}

/**
 * Backfill RSS source by fetching and processing feed items
 * Note: Most RSS feeds only provide recent items, so this may not go back full 6 months
 */
async function backfillRssSource(
  source: { id: number; name: string; url: string },
  cutoffDate: Date,
  maxArticles: number
): Promise<{ newArticles: number; duplicates: number; errors: number }> {
  let newArticles = 0;
  let duplicates = 0;
  let errors = 0;

  try {
    const feed = await parser.parseURL(source.url);
    const items = feed.items || [];
    
    console.log(`Found ${items.length} items in RSS feed for ${source.name}`);

    // Process items (most RSS feeds only have recent items)
    for (const item of items.slice(0, maxArticles)) {
      try {
        const url = item.link || item.guid;
        if (!url || !item.title) {
          continue;
        }

        // Check if article already exists
        const existingArticle = await storage.getArticleByUrl(url);
        if (existingArticle) {
          duplicates++;
          continue;
        }

        // Check date
        const publishedAt = item.isoDate ? new Date(item.isoDate) : 
                           item.pubDate ? new Date(item.pubDate) : 
                           new Date();
        
        if (publishedAt < cutoffDate) {
          console.log(`Skipping article older than cutoff date: ${item.title}`);
          continue;
        }

        // Process the article through the full pipeline
        const content = item.content || item.contentSnippet || item.summary || "";
        const title = item.title;
        
        // Score article for relevance
        const relevanceScore = scoreArticle(title, content, source.name);
        
        // Skip low relevance articles
        if (relevanceScore < 40) {
          continue;
        }

        // Categorize and tag with AI
        const { categories, tags, region: detectedRegion } = await categorizeAndTag(title, content);
        const category = categories[0] || "General";
        const region = (detectedRegion as any) || "US/Domestic";
        
        // Generate AI summary
        let summary: string | null = null;
        try {
          summary = await summarizeArticle(`${title}\n\n${content}`);
        } catch (error) {
          console.warn("Failed to generate AI summary:", error);
        }

        // Enrich with sentiment analysis
        let sentiment: string | null = null;
        let dealMetadata: any = null;
        let geography: string[] = [];
        
        try {
          const enrichment = await enrichArticle(title, summary || content, content);
          sentiment = enrichment.sentiment;
          dealMetadata = enrichment.dealMetadata;
          geography = enrichment.geography;
        } catch (error) {
          console.warn("Failed to enrich article:", error);
        }

        // Create search text
        const searchText = [
          title,
          summary || content,
          tags.join(" "),
          source.name,
          categories.join(" "),
          geography.join(" ")
        ].join(" ").toLowerCase();

        // Check removal patterns
        const { shouldRemove } = await storage.checkArticleAgainstRemovalPatterns(title, content);
        
        if (shouldRemove) {
          console.log(`Article matches removal patterns, skipping: "${title}"`);
          continue;
        }

        // Check for duplicates using title-based similarity
        const recentArticles = await storage.getArticles(null, {
          limit: 100,
          offset: 0,
          sortBy: 'newest'
        });
        
        const duplicateCheck = checkForDuplicate(
          {
            url,
            title,
            content,
            source: source.name,
            publishedAt
          },
          recentArticles
        );
        
        if (duplicateCheck.isDuplicate && duplicateCheck.canonicalArticle) {
          console.log(`Duplicate detected: "${title}" (${duplicateCheck.suppressionReason})`);
          // Record the duplicate
          await storage.createArticleDuplicate({
            canonicalArticleId: duplicateCheck.canonicalArticle.id,
            duplicateTitle: title,
            duplicateUrl: url,
            duplicateSource: source.name,
            duplicatePublishedAt: publishedAt,
            duplicateContent: content,
            similarityScore: duplicateCheck.similarityScore || 0,
            suppressionReason: duplicateCheck.suppressionReason || 'Unknown'
          });
          duplicates++;
          continue;
        }

        try {
          await storage.createArticle({
            title,
            url,
            source: source.name,
            publishedAt,
            category,
            categories,
            tags,
            summary,
            content,
            relevanceScore,
            sentiment,
            dealMetadata,
            geography,
            region,
            searchText,
          });
          newArticles++;
        } catch (error) {
          duplicates++;
        }
      } catch (error) {
        console.error(`Error processing RSS item for ${source.name}:`, error);
        errors++;
      }
    }
  } catch (error) {
    console.error(`Error fetching RSS feed for ${source.name}:`, error);
    errors++;
  }

  return { newArticles, duplicates, errors };
}

/**
 * Backfill web scrape source by scraping archive pages
 * Implements custom logic per source to find historical articles
 */
async function backfillWebScrapeSource(
  source: { id: number; name: string; url: string },
  cutoffDate: Date,
  maxArticles: number
): Promise<{ newArticles: number; duplicates: number; errors: number }> {
  let newArticles = 0;
  let duplicates = 0;
  let errors = 0;

  try {
    // Try to scrape archive pages
    const archiveUrls = await discoverArchiveUrls(source.url, source.name);
    
    console.log(`Found ${archiveUrls.length} archive URLs for ${source.name}`);

    for (const archiveUrl of archiveUrls.slice(0, 10)) { // Limit to 10 archive pages
      try {
        const articles = await scrapeWebPage(archiveUrl);
        
        for (const article of articles.slice(0, maxArticles)) {
          if (!validateScrapedArticle(article)) {
            continue;
          }

          const existingArticle = await storage.getArticleByUrl(article.url);
          if (existingArticle) {
            duplicates++;
            continue;
          }

          // Check date
          const publishedAt = article.publishedAt || new Date();
          if (publishedAt < cutoffDate) {
            continue;
          }

          // Process the scraped article through the full pipeline
          let content = article.content || "";
          const title = article.title;
          
          // Score article for relevance
          const relevanceScore = scoreArticle(title, content, source.name);
          
          // Skip low relevance articles
          if (relevanceScore < 40) {
            continue;
          }

          // Categorize and tag with AI
          const { categories, tags, region: detectedRegion } = await categorizeAndTag(title, content);
          const category = categories[0] || "General";
          const region = (detectedRegion as any) || "US/Domestic";
          
          // Generate AI summary
          let summary: string | null = null;
          try {
            summary = await summarizeArticle(`${title}\n\n${content}`);
          } catch (error) {
            console.warn("Failed to generate AI summary:", error);
          }

          // Enrich with sentiment analysis
          let sentiment: string | null = null;
          let dealMetadata: any = null;
          let geography: string[] = [];
          
          try {
            const enrichment = await enrichArticle(title, summary || content, content);
            sentiment = enrichment.sentiment;
            dealMetadata = enrichment.dealMetadata;
            geography = enrichment.geography;
          } catch (error) {
            console.warn("Failed to enrich article:", error);
          }

          // Create search text
          const searchText = [
            title,
            summary || content,
            tags.join(" "),
            source.name,
            categories.join(" "),
            geography.join(" ")
          ].join(" ").toLowerCase();

          // Check removal patterns
          const { shouldRemove } = await storage.checkArticleAgainstRemovalPatterns(title, content);
          
          if (shouldRemove) {
            console.log(`Article matches removal patterns, skipping: "${title}"`);
            continue;
          }

          // Check for duplicates using title-based similarity
          const recentArticles = await storage.getArticles(null, {
            limit: 100,
            offset: 0,
            sortBy: 'newest'
          });
          
          const duplicateCheck = checkForDuplicate(
            {
              url: article.url,
              title,
              content,
              source: source.name,
              publishedAt
            },
            recentArticles
          );
          
          if (duplicateCheck.isDuplicate && duplicateCheck.canonicalArticle) {
            console.log(`Duplicate detected: "${title}" (${duplicateCheck.suppressionReason})`);
            // Record the duplicate
            await storage.createArticleDuplicate({
              canonicalArticleId: duplicateCheck.canonicalArticle.id,
              duplicateTitle: title,
              duplicateUrl: article.url,
              duplicateSource: source.name,
              duplicatePublishedAt: publishedAt,
              duplicateContent: content,
              similarityScore: duplicateCheck.similarityScore || 0,
              suppressionReason: duplicateCheck.suppressionReason || 'Unknown'
            });
            duplicates++;
            continue;
          }

          try {
            await storage.createArticle({
              title,
              url: article.url,
              source: source.name,
              publishedAt,
              category,
              categories,
              tags,
              summary,
              content,
              relevanceScore,
              sentiment,
              dealMetadata,
              geography,
              region,
              searchText,
            });
            newArticles++;
          } catch (error) {
            duplicates++;
          }
        }
      } catch (error) {
        console.error(`Error scraping archive ${archiveUrl}:`, error);
        errors++;
      }
    }
  } catch (error) {
    console.error(`Error backfilling web scrape source ${source.name}:`, error);
    errors++;
  }

  return { newArticles, duplicates, errors };
}

/**
 * Discover archive URLs for a given source
 * Uses source-specific logic to find historical article pages
 */
async function discoverArchiveUrls(baseUrl: string, sourceName: string): Promise<string[]> {
  const archiveUrls: string[] = [];

  try {
    // Different sources have different archive structures
    if (sourceName.toLowerCase().includes('marina dock age')) {
      // Marina Dock Age: https://marinadockage.com/category/news/
      archiveUrls.push('https://marinadockage.com/category/news/');
      archiveUrls.push('https://marinadockage.com/category/news/page/2/');
      archiveUrls.push('https://marinadockage.com/category/news/page/3/');
      archiveUrls.push('https://marinadockage.com/category/news/page/4/');
      archiveUrls.push('https://marinadockage.com/category/news/page/5/');
    } else if (sourceName.toLowerCase().includes('boating industry')) {
      // Boating Industry: https://boatingindustry.com/news/
      archiveUrls.push('https://boatingindustry.com/news/');
      archiveUrls.push('https://boatingindustry.com/news/page/2/');
      archiveUrls.push('https://boatingindustry.com/news/page/3/');
      archiveUrls.push('https://boatingindustry.com/news/page/4/');
      archiveUrls.push('https://boatingindustry.com/news/page/5/');
    } else if (sourceName.toLowerCase().includes('soundings')) {
      // Soundings Trade Only
      archiveUrls.push('https://www.soundingsonline.com/trade-only');
      archiveUrls.push('https://www.soundingsonline.com/trade-only/page/2');
      archiveUrls.push('https://www.soundingsonline.com/trade-only/page/3');
    } else {
      // Default: try the base URL
      archiveUrls.push(baseUrl);
    }
  } catch (error) {
    console.error(`Error discovering archives for ${sourceName}:`, error);
  }

  return archiveUrls;
}

// Re-export the types for use in routes
export type { BackfillOptions, BackfillResult };
