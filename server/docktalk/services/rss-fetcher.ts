import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { storage } from "../storage";
import { scoreArticle } from "./scoring";
import { categorizeAndTag } from "./categorizer";
import { summarizeArticle } from "./ai-summarizer";
import { enrichArticle } from "./ai-enrichment";
import { broadcastNewArticle } from "../websocket";
import { scrapeWebPage, validateScrapedArticle, fetchArticleBody, type ScrapedArticle } from "./web-scraper";

// Normalize entity types from AI to database enum values
function normalizeEntityType(type: string): 'company' | 'person' | 'location' | 'asset' | null {
  const normalized = type.toLowerCase().trim();
  const typeMap: Record<string, 'company' | 'person' | 'location' | 'asset'> = {
    'company': 'company',
    'person': 'person',
    'people': 'person',
    'location': 'location',
    'asset': 'asset',
    'facility': 'asset',
    'vessel': 'asset'
  };
  return typeMap[normalized] || null;
}

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: ['contentSnippet', 'content', 'summary']
  }
});

interface FeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  guid?: string;
}

export async function fetchRssFeeds(): Promise<number> {
  let totalNewArticles = 0;
  
  try {
    const sources = await storage.getRssSources();
    
    for (const source of sources) {
      try {
        if (source.sourceType === 'web_scrape') {
          console.log(`Scraping web page: ${source.name}`);
          const articles = await scrapeWebPage(source.url);
          
          for (const article of articles) {
            if (validateScrapedArticle(article)) {
              const newArticles = await processScrapedArticle(article, source.name);
              totalNewArticles += newArticles;
            }
          }
          
          await storage.updateRssSourceLastScrapedAt(source.id);
        } else {
          console.log(`Fetching RSS feed: ${source.name}`);
          const feed = await parser.parseURL(source.url);
          
          for (const item of feed.items || []) {
            const newArticles = await processRssItem(item, source.name);
            totalNewArticles += newArticles;
          }
          
          await storage.updateRssSourceLastFetched(source.id);
        }
      } catch (error) {
        console.error(`Error fetching source ${source.name}:`, error);
      }
    }
    
    return totalNewArticles;
  } catch (error) {
    console.error("Error in RSS fetching process:", error);
    return totalNewArticles;
  }
}

async function processScrapedArticle(article: ScrapedArticle, sourceName: string): Promise<number> {
  try {
    if (!article.url || !article.title) {
      return 0;
    }

    const existingArticle = await storage.getArticleByUrl(article.url);
    if (existingArticle) {
      return 0;
    }

    let content = article.content || "";
    
    if (!content || content.length < 100) {
      console.log(`Fetching full article body for: ${article.title}`);
      const fetchedBody = await fetchArticleBody(article.url);
      if (fetchedBody) {
        content = fetchedBody;
      }
    }
    
    const title = article.title;
    
    const relevanceScore = scoreArticle(title, content, sourceName);
    
    if (relevanceScore < 40) {
      return 0;
    }

    const { categories, tags, region } = await categorizeAndTag(title, content);
    const category = categories[0] || "General";
    
    let summary: string | null = null;
    try {
      summary = await summarizeArticle(`${title}\n\n${content}`);
    } catch (error) {
      console.warn("Failed to generate AI summary:", error);
    }

    let sentiment: string | null = null;
    let dealMetadata: any = null;
    let dealInfo: any = null;
    let geography: string[] = [];
    let entities: any[] = [];
    
    try {
      const enrichment = await enrichArticle(title, summary || content, content);
      sentiment = enrichment.sentiment;
      dealMetadata = enrichment.dealMetadata;
      dealInfo = enrichment.dealInfo;
      geography = enrichment.geography;
      entities = enrichment.entities || [];
    } catch (error) {
      console.warn("Failed to enrich article:", error);
    }

    const searchText = [
      title,
      summary || content,
      tags.join(" "),
      sourceName,
      categories.join(" "),
      geography.join(" ")
    ].join(" ").toLowerCase();

    const publishedAt = article.publishedAt || new Date();

    // Check if article matches removal patterns before creating
    const { shouldRemove, matchedPattern } = await storage.checkArticleAgainstRemovalPatterns(title, content);
    
    if (shouldRemove) {
      console.log(`Article matches removal patterns, auto-removing: "${title}"`);
      return 0;
    }

    const newArticle = await storage.createArticle({
      title,
      url: article.url,
      source: sourceName,
      publishedAt,
      category,
      categories,
      tags,
      summary,
      content,
      imageUrl: article.imageUrl || null,
      relevanceScore,
      sentiment,
      dealMetadata,
      geography,
      region: region as "US/Domestic" | "International",
      searchText,
      isBookmarked: false
    });

    // Extract and link entities
    if (entities.length > 0) {
      for (const entity of entities) {
        try {
          // Normalize entity type to enum values
          const normalizedType = normalizeEntityType(entity.type);
          if (!normalizedType) {
            console.warn(`Invalid entity type "${entity.type}" for entity ${entity.name}, skipping`);
            continue;
          }
          
          const entityId = await storage.getOrCreateEntity(
            entity.name,
            normalizedType,
            {
              description: entity.context || undefined
            }
          );
          
          await storage.linkArticleToEntity(
            newArticle.id,
            entityId,
            1,
            entity.confidence || 100,
            entity.context
          );
        } catch (error) {
          console.warn(`Failed to link entity ${entity.name}:`, error);
        }
      }
    }

    // Extract and save deal if detected
    if (dealInfo && dealInfo.transactionType) {
      try {
        // Check if deal already exists for this article (deduplication)
        const existingDeals = await storage.getDealsByArticle(newArticle.id);
        if (existingDeals.length > 0) {
          console.log(`Deal already exists for article ${newArticle.id}, skipping duplicate`);
        } else {
          // Find or create entity IDs for buyer/seller if names are provided
        let buyerEntityId: number | undefined;
        let sellerEntityId: number | undefined;

        if (dealInfo.buyer) {
          // Try to find existing entity first
          const buyerResults = await storage.searchEntities(dealInfo.buyer, 'company');
          if (buyerResults.length > 0) {
            buyerEntityId = buyerResults[0].id;
          } else {
            // Create new entity if not found
            buyerEntityId = await storage.getOrCreateEntity(
              dealInfo.buyer,
              'company',
              { description: `Deal participant identified in article: ${title}` }
            );
          }
        }

        if (dealInfo.seller) {
          // Try to find existing entity first
          const sellerResults = await storage.searchEntities(dealInfo.seller, 'company');
          if (sellerResults.length > 0) {
            sellerEntityId = sellerResults[0].id;
          } else {
            // Create new entity if not found
            sellerEntityId = await storage.getOrCreateEntity(
              dealInfo.seller,
              'company',
              { description: `Deal participant identified in article: ${title}` }
            );
          }
        }

        // Parse dates if provided (ISO format YYYY-MM-DD)
        let closingDate: Date | undefined;
        let announcedDate: Date | undefined;

        if (dealInfo.closingDate) {
          try {
            closingDate = new Date(dealInfo.closingDate);
          } catch (e) {
            console.warn("Failed to parse closing date:", dealInfo.closingDate);
          }
        }

        if (dealInfo.announcedDate) {
          try {
            announcedDate = new Date(dealInfo.announcedDate);
          } catch (e) {
            console.warn("Failed to parse announced date:", dealInfo.announcedDate);
          }
        }

        await storage.createDeal({
          articleId: newArticle.id,
          transactionType: dealInfo.transactionType,
          dealStatus: dealInfo.dealStatus || 'announced',
          buyer: dealInfo.buyer || null,
          buyerEntityId: buyerEntityId || null,
          seller: dealInfo.seller || null,
          sellerEntityId: sellerEntityId || null,
          transactionSize: dealInfo.transactionSize || null,
          valuation: dealInfo.valuation || null,
          equityStake: dealInfo.equityStake || null,
          closingDate: closingDate || null,
          announcedDate: announcedDate || null,
          dealSummary: dealInfo.dealSummary || null,
          confidence: dealInfo.confidence || 80
        });

          console.log(`Deal extracted from article: ${title}`);
        }
      } catch (error) {
        console.warn(`Failed to save deal for article ${newArticle.id}:`, error);
      }
    }

    broadcastNewArticle(newArticle);

    return 1;
  } catch (error) {
    console.error("Error processing scraped article:", error);
    return 0;
  }
}

async function processRssItem(item: FeedItem, sourceName: string): Promise<number> {
  try {
    const url = item.link || item.guid;
    if (!url || !item.title) {
      return 0;
    }

    // Check if article already exists
    const existingArticle = await storage.getArticleByUrl(url);
    if (existingArticle) {
      return 0;
    }

    const content = item.content || item.contentSnippet || item.summary || "";
    const title = item.title;
    
    // Score article for relevance
    const relevanceScore = scoreArticle(title, content, sourceName);
    
    // Skip low relevance articles
    if (relevanceScore < 40) {
      return 0;
    }

    // Categorize and tag with AI
    const { categories, tags, region } = await categorizeAndTag(title, content);
    const category = categories[0] || "General";
    
    // Generate AI summary
    let summary: string | null = null;
    try {
      summary = await summarizeArticle(`${title}\n\n${content}`);
    } catch (error) {
      console.warn("Failed to generate AI summary:", error);
    }

    // Enrich with sentiment analysis and deal extraction
    let sentiment: string | null = null;
    let dealMetadata: any = null;
    let dealInfo: any = null;
    let geography: string[] = [];
    let entities: any[] = [];
    
    try {
      const enrichment = await enrichArticle(title, summary || content, content);
      sentiment = enrichment.sentiment;
      dealMetadata = enrichment.dealMetadata;
      dealInfo = enrichment.dealInfo;
      geography = enrichment.geography;
      entities = enrichment.entities || [];
    } catch (error) {
      console.warn("Failed to enrich article:", error);
    }

    // Create search text
    const searchText = [
      title,
      summary || content,
      tags.join(" "),
      sourceName,
      categories.join(" "),
      geography.join(" ")
    ].join(" ").toLowerCase();

    const publishedAt = item.isoDate ? new Date(item.isoDate) : 
                       item.pubDate ? new Date(item.pubDate) : 
                       new Date();

    // Check if article matches removal patterns before creating
    const { shouldRemove, matchedPattern } = await storage.checkArticleAgainstRemovalPatterns(title, content);
    
    if (shouldRemove) {
      console.log(`Article matches removal patterns, auto-removing: "${title}"`);
      return 0;
    }

    const newArticle = await storage.createArticle({
      title,
      url,
      source: sourceName,
      publishedAt,
      category,
      categories,
      tags,
      summary,
      content,
      imageUrl: null,
      relevanceScore,
      sentiment,
      dealMetadata,
      geography,
      region: region as "US/Domestic" | "International",
      searchText,
      isBookmarked: false
    });

    // Extract and link entities
    if (entities.length > 0) {
      for (const entity of entities) {
        try {
          // Normalize entity type to enum values
          const normalizedType = normalizeEntityType(entity.type);
          if (!normalizedType) {
            console.warn(`Invalid entity type "${entity.type}" for entity ${entity.name}, skipping`);
            continue;
          }
          
          const entityId = await storage.getOrCreateEntity(
            entity.name,
            normalizedType,
            {
              description: entity.context || undefined
            }
          );
          
          await storage.linkArticleToEntity(
            newArticle.id,
            entityId,
            1,
            entity.confidence || 100,
            entity.context
          );
        } catch (error) {
          console.warn(`Failed to link entity ${entity.name}:`, error);
        }
      }
    }

    // Broadcast new article to WebSocket clients
    broadcastNewArticle(newArticle);

    return 1;
  } catch (error) {
    console.error("Error processing RSS item:", error);
    return 0;
  }
}

export async function initializeDefaultRssSources(): Promise<void> {
  const defaultSources = [
    { name: "Marina Dock Age", url: "https://www.marinadockage.com/feed/" },
    { name: "Boating Industry", url: "https://boatingindustry.com/feed/" },
    { name: "Soundings Trade Only", url: "https://www.tradeonlytoday.com/.rss/full/" },
    { name: "NMMA", url: "https://www.nmma.org/pressroom/news?rss=true" },
    { name: "Reuters Markets", url: "https://www.reuters.com/markets/us/rss" },
    { name: "Maritime Reporter", url: "https://www.marinelink.com/rss/news" },
    { name: "SuperYacht News", url: "https://www.superyachtnews.com/rss" },
    { name: "Trade Winds", url: "https://www.tradewindsnews.com/rss" }
  ];

  for (const source of defaultSources) {
    try {
      const existingSources = await storage.getRssSources();
      const exists = existingSources.some(s => s.url === source.url);
      
      if (!exists) {
        await storage.createRssSource(source);
        console.log(`Added RSS source: ${source.name}`);
      }
    } catch (error) {
      console.warn(`Failed to add RSS source ${source.name}:`, error);
    }
  }
}
