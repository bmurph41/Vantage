import type { Express } from "express";
import { createServer, type Server } from "http";
import { IStorage } from "./storage";
import { z } from "zod";
import { startCronJobs, triggerManualFetch, getAutoFetchStatus, setAutoFetchEnabled } from "./cron-jobs";
import { fetchAllSourcesWithReport } from "./services/rss-fetcher";
import bcrypt from "bcrypt";
import { initializeWebSocket } from "./websocket";
import type { User } from "@shared/docket-schema";
import { requireMarinaMatchAuth, type DocketRequest } from "./middleware/auth";
import {
  generateCategorySummary,
  generateAllCategorySummaries,
  getLatestSummaries,
  editSummary
} from "./services/category-summary-service";
import { getUncachableResendClient } from "./lib/resend-client";
import { findMatchingCrmCompanies, searchCrmCompanies } from "./company-matcher";
import { invalidateLearningCache } from "./services/ai-learning";
import { invalidateCategorizerCache } from "./services/categorizer";
import { sendNewSearchRecap } from "./services/alert-service";
import { seedBizJournalsFeeds } from "./seeds/bizjournals-feeds";
import { seedTradePublicationFeeds } from "./seeds/trade-publications-feeds";

const VALID_CATEGORIES = [
  'Macro',
  'M&A',
  'Development',
  'Operations',
  'Regulatory',
  'Environmental',
  'Technology',
  'General',
  'Boat Sales',
  'Boat Show',
  'Manufacturing',
  'Industry Trends',
  'Marina Sale',
  'Education',
  'Insurance',
  'Legal',
  'People Moves',
  'Company Earnings',
  'Awards',
  'Business Planning',
  'International',
  'Interview'
] as const;

// Extend Express session types
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      role?: string;
      subscriptionTier?: string;
    };
  }
}

const ArticleQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(), // Legacy single category filter
  categories: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      return val;
    },
    z.array(z.string()).optional()
  ), // New multi-category filter (OR logic)
  source: z.string().optional(), // Legacy single source filter
  sources: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      return val;
    },
    z.array(z.string()).optional()
  ), // New multi-source filter (OR logic)
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  minRelevance: z.coerce.number().optional(),
  sentiment: z.string().optional(),
  dealsOnly: z.coerce.boolean().optional(),
  dealType: z.string().optional(),
  geography: z.string().optional(),
  region: z.string().optional(),
  regions: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      return val;
    },
    z.array(z.string()).optional()
  ), // Multi-region filter (OR logic)
  limit: z.coerce.number().default(50),
  offset: z.coerce.number().default(0),
  sortBy: z.enum(['newest', 'relevance']).default('newest'),
});

const DealQuerySchema = z.object({
  transactionType: z.enum(['ma', 'financing', 'partnership', 'asset_sale', 'other']).optional(),
  dealStatus: z.enum(['rumored', 'announced', 'pending', 'closed', 'failed']).optional(),
  entityId: z.coerce.number().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  geography: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const SignupSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const BookmarkSchema = z.object({
  isBookmarked: z.boolean(),
});

export async function registerDocketRoutes(app: Express, docketStorage: IStorage): Promise<void> {
  // Note: Docket routes are integrated into MarinaMatch
  // Authentication is handled by MarinaMatch's central auth system
  // All routes use requireMarinaMatchAuth middleware

  // Legacy Standalone Authentication Endpoints - DISABLED in integrated version
  // These endpoints are not used when Docket is integrated into MarinaMatch
  /* app.post("/api/docket/auth/signup", async (req, res) => {
    try {
      const { username, password } = SignupSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await docketStorage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Create user with default viewer role and free tier
      const newUser = await docketStorage.createUser({
        username,
        password: hashedPassword,
        role: "viewer",
        subscriptionTier: "free",
        isActive: true,
      });
      
      // Create session (store only safe user data, no password)
      if (!req.session) {
        return res.status(500).json({ error: "Session not available" });
      }
      
      req.session.user = { 
        id: newUser.id, 
        username: newUser.username, 
        role: newUser.role,
        subscriptionTier: newUser.subscriptionTier
      };
      
      res.json({ user: { 
        id: newUser.id, 
        username: newUser.username, 
        role: newUser.role,
        subscriptionTier: newUser.subscriptionTier
      } });
    } catch (error) {
      // Log only safe error info, never sensitive data
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data" });
      }
      console.error("Signup error: Internal server error");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docket/auth/login", async (req, res) => {
    try {
      const { username, password } = LoginSchema.parse(req.body);
      
      // Get user
      const user = await docketStorage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Check if account is active
      if (!user.isActive) {
        return res.status(403).json({ error: "Account is inactive. Please contact an administrator." });
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Update last login timestamp
      await docketStorage.updateUserLastLogin(user.id);
      
      // Create session (store only safe user data, no password)
      if (!req.session) {
        return res.status(500).json({ error: "Session not available" });
      }
      
      req.session.user = { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        subscriptionTier: user.subscriptionTier
      };
      
      res.json({ user: { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        subscriptionTier: user.subscriptionTier
      } });
    } catch (error) {
      // Log only safe error info, never sensitive data
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data" });
      }
      console.error("Login error: Internal server error");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docket/auth/logout", (req, res) => {
    if (!req.session) {
      return res.status(500).json({ error: "Session not available" });
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error: Session destruction failed");
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/docket/auth/me", (req, res) => {
    if (req.session && req.session.user) {
      res.json({ user: { 
        id: req.session.user.id, 
        username: req.session.user.username,
        role: req.session.user.role,
        subscriptionTier: req.session.user.subscriptionTier
      } });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  }); */

  // Saved Filters endpoints
  const SavedFilterSchema = z.object({
    name: z.string().min(1),
    criteria: z.string(),
  });

  app.get("/api/docket/saved-filters", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      if (!req.docketUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const filters = await docketStorage.getSavedFilters(req.docketUser.id, req.docketUser.orgId);
      res.json(filters);
    } catch (error) {
      console.error("Error fetching saved filters:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docket/saved-filters", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      if (!req.docketUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { name, criteria } = SavedFilterSchema.parse(req.body);
      const filter = await docketStorage.createSavedFilter({
        userId: req.docketUser.id,
        orgId: req.docketUser.orgId,
        name,
        criteria,
      });
      
      res.json(filter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data" });
      }
      console.error("Error creating saved filter:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/docket/saved-filters/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      if (!req.docketUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const id = req.params.id;
      const body = SavedFilterSchema.partial().parse(req.body);
      const filter = await docketStorage.updateSavedFilter(id, req.docketUser.id, req.docketUser.orgId, body);
      
      if (!filter) {
        return res.status(404).json({ error: "Saved filter not found" });
      }
      
      res.json(filter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data" });
      }
      console.error("Error updating saved filter:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/docket/saved-filters/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      if (!req.docketUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const id = req.params.id;
      const deleted = await docketStorage.deleteSavedFilter(id, req.docketUser.id, req.docketUser.orgId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Saved filter not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved filter:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Articles endpoints
  app.get("/api/docket/articles", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const filters = ArticleQuerySchema.parse(req.query);
      const userId = req.docketUser?.id || null;
      const articles = await docketStorage.getArticles(userId, {
        ...filters,
        fromDate: filters.fromDate ? new Date(filters.fromDate) : undefined,
        toDate: filters.toDate ? new Date(filters.toDate) : undefined,
      });
      
      res.json(articles);
    } catch (error) {
      console.error("Error fetching articles:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
      }
      res.status(400).json({ error: "Invalid query parameters" });
    }
  });

  app.get("/api/docket/articles/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid article ID" });
      }
      
      const article = await docketStorage.getArticleById(id);
      
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      res.json(article);
    } catch (error) {
      console.error("Error fetching article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/docket/articles/:id/bookmark", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isBookmarked } = BookmarkSchema.parse(req.body);
      
      await docketStorage.updateBookmarkStatus(id, isBookmarked);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating bookmark:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Analytics endpoints - sentiment trends
  app.get("/api/docket/sentiment/trends", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const trends = await docketStorage.getSentimentTrends(days);
      
      res.json(trends);
    } catch (error) {
      console.error("Error fetching sentiment trends:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Analytics endpoints
  app.get("/api/docket/analytics/stats", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const stats = await docketStorage.getSystemStats();
      res.json(stats || {
        totalArticles: 0,
        todayArticles: 0,
        avgRelevance: 0,
        lastUpdate: new Date(),
        rssFeedStatus: "online",
        scraperStatus: "active",
        aiStatus: "processing",
        dbStatus: "healthy"
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/analytics/trending", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const trending = await docketStorage.getTrendingTopics();
      res.json(trending);
    } catch (error) {
      console.error("Error fetching trending topics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/analytics/categories", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const categories = await docketStorage.getCategoryDistribution();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Returns all valid categories (for category editing UI)
  app.get("/api/docket/categories/all", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      res.json(VALID_CATEGORIES);
    } catch (error) {
      console.error("Error fetching all categories:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/analytics/sources", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      // Get sources from actual articles (dynamically updates as articles are added)
      const sources = await docketStorage.getSourceDistribution();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching sources:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // RSS Sources endpoints
  app.get("/api/docket/rss-sources", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const sources = await docketStorage.getRssSources();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching RSS sources:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Manual RSS fetch trigger
  app.post("/api/docket/rss-sources/fetch", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const newArticles = await triggerManualFetch();
      res.json({ 
        success: true, 
        newArticles,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("Error during manual fetch:", error);
      res.status(500).json({ error: "Failed to fetch RSS feeds" });
    }
  });

  // RSS Source Management - Admin endpoint
  app.get("/api/docket/admin/rss-sources", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const sources = await docketStorage.getAllRssSources();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching RSS sources:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docket/rss-sources", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const RssSourceSchema = z.object({
        name: z.string().min(1, "Name is required"),
        sourceType: z.enum(["rss", "web_scrape"]).optional(),
        url: z.string().url("Invalid URL format"),
        minRelevanceScore: z.number().min(0).max(100).default(25),
        customKeywords: z.array(z.string()).default([])
      });

      const validated = RssSourceSchema.parse(req.body);
      
      const newSource = await docketStorage.createRssSource(validated);
      
      // Trigger 6-month backfill for the new source in the background
      (async () => {
        try {
          console.log(`[Docket] Starting 6-month backfill for new source: ${newSource.name} (ID: ${newSource.id})`);
          const { backfillHistoricalArticles } = await import("./services/backfill");
          const results = await backfillHistoricalArticles({
            sourceId: newSource.id,
            monthsBack: 6,
            maxArticlesPerSource: 200
          });
          const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
          console.log(`[Docket] Backfill completed for ${newSource.name}: ${totalNew} new articles`);
        } catch (backfillError) {
          console.error(`[Docket] Backfill failed for source ${newSource.name}:`, backfillError);
        }
      })();
      
      res.json(newSource);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof Error && error.message.includes("duplicate") || error instanceof Error && error.message.includes("unique")) {
        return res.status(409).json({ error: "A source with this URL already exists" });
      }
      console.error("Error creating RSS source:", error);
      res.status(500).json({ error: "Failed to create RSS source" });
    }
  });


  // Seed BizJournals regional feeds for marina M&A coverage
  app.post("/api/docket/rss-sources/seed-bizjournals", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      console.log("[Docket] Seeding BizJournals regional feeds...");
      const results = await seedBizJournalsFeeds();
      res.json({ 
        success: true,
        message: `Added ${results.added} BizJournals feeds, ${results.skipped} already existed`,
        ...results
      });
    } catch (error) {
      console.error("Error seeding BizJournals feeds:", error);
      res.status(500).json({ error: "Failed to seed BizJournals feeds" });
    }
  });

  app.post("/api/docket/rss-sources/seed-trade-publications", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      console.log("[Docket] Seeding trade publication feeds...");
      const results = await seedTradePublicationFeeds();
      res.json({ 
        success: true,
        message: `Added ${results.added} trade publication feeds, ${results.skipped} already existed`,
        ...results
      });
    } catch (error) {
      console.error("Error seeding trade publication feeds:", error);
      res.status(500).json({ error: "Failed to seed trade publication feeds" });
    }
  });

  app.patch("/api/docket/rss-sources/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const RssSourceUpdateSchema = z.object({
        name: z.string().min(1).optional(),
        sourceType: z.enum(["rss", "web_scrape"]).optional(),
        url: z.string().url().optional(),
        isActive: z.boolean().optional(),
        minRelevanceScore: z.number().min(0).max(100).optional(),
        customKeywords: z.array(z.string()).optional()
      });

      const id = parseInt(req.params.id);
      const validated = RssSourceUpdateSchema.parse(req.body);
      const updated = await docketStorage.updateRssSource(id, validated);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof Error && error.message.includes("duplicate") || error instanceof Error && error.message.includes("unique")) {
        return res.status(409).json({ error: "A source with this URL already exists" });
      }
      console.error("Error updating RSS source:", error);
      res.status(500).json({ error: "Failed to update RSS source" });
    }
  });

  app.delete("/api/docket/rss-sources/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await docketStorage.deleteRssSource(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting RSS source:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Preview RSS feed or web scrape before adding
  app.post("/api/docket/rss-sources/preview", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { url, sourceType = "rss" } = req.body;
      const { scoreArticle } = await import("./services/scoring");
      
      if (sourceType === "web_scrape") {
        const { scrapeWebPage, validateScrapedArticle } = await import("./services/web-scraper");
        const scrapedArticles = await scrapeWebPage(url);
        
        const validArticles = scrapedArticles.filter(validateScrapedArticle);
        
        const previewArticles = validArticles.slice(0, 5).map((article) => ({
          title: article.title,
          link: article.url,
          pubDate: article.publishedAt?.toISOString(),
          relevanceScore: scoreArticle(article.title, article.content || "", "Preview")
        }));
        
        res.json({
          feedTitle: "Web Scraped Content",
          feedDescription: `Scraped ${validArticles.length} valid articles from ${url}`,
          itemCount: validArticles.length,
          previewArticles
        });
      } else {
        const Parser = (await import("rss-parser")).default;
        const parser = new Parser({ timeout: 10000 });
        
        const feed = await parser.parseURL(url);
        
        const previewArticles = feed.items.slice(0, 5).map(item => ({
          title: item.title || "",
          link: item.link || "",
          pubDate: item.pubDate,
          relevanceScore: scoreArticle(item.title || "", item.contentSnippet || "", "Preview")
        }));
        
        res.json({
          feedTitle: feed.title,
          feedDescription: feed.description,
          itemCount: feed.items.length,
          previewArticles
        });
      }
    } catch (error) {
      console.error("Error previewing feed:", error);
      res.status(400).json({ error: `Failed to fetch or parse ${req.body.sourceType === "web_scrape" ? "web page" : "RSS feed"}` });
    }
  });

  // Manual fetch trigger
  app.post("/api/docket/fetch", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const count = await triggerManualFetch();
      res.json({ message: `Successfully fetched ${count} new articles`, newArticles: count });
    } catch (error) {
      console.error("Error during manual fetch:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docket/fetch-all", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const report = await fetchAllSourcesWithReport();
      res.json({
        success: true,
        totalNewArticles: report.totalNew,
        sourcesProcessed: report.sourceResults.length,
        sourceResults: report.sourceResults,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error during full fetch:", error);
      res.status(500).json({ error: "Failed to fetch all sources" });
    }
  });

  // Auto-fetch status endpoint
  app.get("/api/docket/auto-fetch/status", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const status = getAutoFetchStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting auto-fetch status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Toggle auto-fetch
  app.post("/api/docket/auto-fetch/toggle", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }
      const status = setAutoFetchEnabled(enabled);
      res.json(status);
    } catch (error) {
      console.error("Error toggling auto-fetch:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Content freshness check - alerts if no new articles in 24+ hours
  app.get("/api/docket/health/content-freshness", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articles = await docketStorage.getArticles(null, { limit: 1, offset: 0 });
      const latestArticle = articles[0];
      
      if (!latestArticle) {
        return res.json({
          status: 'stale',
          message: 'No articles found in the system',
          latestArticleDate: null,
          hoursStale: null,
          isStale: true
        });
      }
      
      const latestDate = new Date(latestArticle.publishedAt || latestArticle.createdAt);
      const now = new Date();
      const hoursStale = Math.round((now.getTime() - latestDate.getTime()) / (1000 * 60 * 60));
      const isStale = hoursStale >= 24;
      
      res.json({
        status: isStale ? 'stale' : 'fresh',
        message: isStale 
          ? `Content is stale - no new articles in ${hoursStale} hours` 
          : `Content is fresh - latest article is ${hoursStale} hours old`,
        latestArticleDate: latestDate.toISOString(),
        latestArticleTitle: latestArticle.title,
        hoursStale,
        isStale
      });
    } catch (error) {
      console.error("Error checking content freshness:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // AI quota status endpoint
  app.get("/api/docket/health/ai-quota", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { getQuotaStatus, resetQuotaState } = await import("./services/ai-quota-manager");
      const status = getQuotaStatus();
      
      res.json({
        ...status,
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        anthropicConfigured: !!process.env.ANTHROPIC_API_KEY
      });
    } catch (error) {
      console.error("Error checking AI quota:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reset AI quota state (admin only)
  app.post("/api/docket/admin/reset-ai-quota", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    if (req.docketUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      const { resetQuotaState, getQuotaStatus } = await import("./services/ai-quota-manager");
      resetQuotaState();
      const newStatus = getQuotaStatus();
      
      res.json({
        success: true,
        message: 'AI quota state has been reset',
        status: newStatus
      });
    } catch (error) {
      console.error("Error resetting AI quota:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Quick backfill for last 10 days (triggers without requiring admin)
  app.post("/api/docket/backfill-recent", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { backfillHistoricalArticles } = await import("./services/backfill");
      
      console.log('[Docket] Starting quick backfill for last 10 days...');
      
      const results = await backfillHistoricalArticles({
        daysBack: 10,
        maxArticlesPerSource: 30
      });
      
      const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
      const totalDuplicates = results.reduce((sum, r) => sum + r.duplicates, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      
      console.log(`[Docket] Quick backfill completed: ${totalNew} new, ${totalDuplicates} duplicates, ${totalErrors} errors`);
      
      res.json({ 
        success: true,
        totalNew,
        totalDuplicates,
        totalErrors,
        message: `Quick backfill completed: ${totalNew} new articles ingested`
      });
    } catch (error) {
      console.error("Error during quick backfill:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Historical backfill endpoint (admin only)
  app.post("/api/docket/admin/backfill", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    // Admin role check
    if (req.docketUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      const { backfillHistoricalArticles } = await import("./services/backfill");
      
      const BackfillOptionsSchema = z.object({
        sourceId: z.number().optional(),
        sourceName: z.string().optional(),
        monthsBack: z.number().min(1).max(12).optional().default(6),
        maxArticlesPerSource: z.number().min(10).max(1000).optional().default(500),
      });
      
      const options = BackfillOptionsSchema.parse(req.body);
      
      const results = await backfillHistoricalArticles(options);
      
      const totalNew = results.reduce((sum, r) => sum + r.newArticles, 0);
      const totalDuplicates = results.reduce((sum, r) => sum + r.duplicates, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
      
      res.json({ 
        success: true,
        totalNew,
        totalDuplicates,
        totalErrors,
        results,
        message: `Backfill completed: ${totalNew} new articles, ${totalDuplicates} duplicates, ${totalErrors} errors`
      });
    } catch (error) {
      console.error("Error during backfill:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Re-summarize existing articles with updated AI prompt (admin only)
  app.post("/api/docket/admin/resummarize-articles", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    if (req.docketUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      const ResummarizeOptionsSchema = z.object({
        batchSize: z.number().min(1).max(50).optional().default(10),
        maxArticles: z.number().min(10).max(1000).optional().default(500),
        onlyMissing: z.boolean().optional().default(false),
      });
      
      const options = ResummarizeOptionsSchema.parse(req.body);
      
      // Start the re-summarization in the background
      const { resummarizeExistingArticles } = await import("./services/backfill");
      
      // Run asynchronously so we don't block the request
      resummarizeExistingArticles(options).then(result => {
        console.log(`[Docket] Re-summarization completed: ${result.updated} updated, ${result.errors} errors, ${result.skipped} skipped`);
      }).catch(error => {
        console.error('[Docket] Re-summarization failed:', error);
      });
      
      res.json({ 
        success: true,
        message: `Re-summarization started for up to ${options.maxArticles} articles. Check server logs for progress.`
      });
    } catch (error) {
      console.error("Error starting re-summarization:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Manual summary generation (admin only)
  app.post("/api/docket/admin/generate-summaries", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    // Admin role check
    if (req.docketUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      const SummaryOptionsSchema = z.object({
        period: z.enum(["daily", "weekly"]).optional(),
      });
      
      const { period } = SummaryOptionsSchema.parse(req.body);
      
      
      let dailySummaries: any[] = [];
      let weeklySummaries: any[] = [];
      
      if (!period || period === "daily") {
        dailySummaries = await generateAllCategorySummaries("daily");
      }
      
      if (!period || period === "weekly") {
        weeklySummaries = await generateAllCategorySummaries("weekly");
      }
      
      const total = dailySummaries.length + weeklySummaries.length;
      
      res.json({ 
        success: true,
        dailySummaries: dailySummaries.length,
        weeklySummaries: weeklySummaries.length,
        total,
        message: `Successfully generated ${total} summaries (${dailySummaries.length} daily, ${weeklySummaries.length} weekly)`
      });
    } catch (error) {
      console.error("Error during manual summary generation:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Batch recategorization endpoints
  app.post("/api/docket/articles/recategorize-batch", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { categorizeAndTag } = await import("./services/categorizer");
      const articles = await docketStorage.getArticles(null, { limit: 1000, offset: 0 });
      
      let processedCount = 0;
      const batchSize = 3; // Process in smaller batches to respect OpenAI rate limits
      
      for (let i = 0; i < articles.length; i += batchSize) {
        const batch = articles.slice(i, i + batchSize);
        
        // Process articles sequentially to avoid rate limits
        for (const article of batch) {
          try {
            const { categories, tags } = await categorizeAndTag(article.title, article.content || "");
            await docketStorage.updateArticleCategory(article.id, categories, tags);
            processedCount++;
            // Small delay between each article to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Failed to recategorize article ${article.id}:`, error);
          }
        }
        
        // Longer delay between batches
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      res.json({ 
        message: `Successfully recategorized ${processedCount} out of ${articles.length} articles`,
        processed: processedCount,
        total: articles.length
      });
    } catch (error) {
      console.error("Error during batch recategorization:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Deal extraction backfill - extract deals from existing articles
  app.post("/api/docket/deals/backfill-from-articles", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { enrichArticle } = await import("./services/ai-enrichment");
      
      // Parse request body for date range (default to 90 days)
      const daysBack = parseInt(req.body.daysBack as string) || 90;
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysBack);
      
      
      // Fetch articles from the specified date range
      const articles = await docketStorage.getArticles(null, { 
        limit: 1000, 
        offset: 0,
        fromDate
      });
      
      
      let processedCount = 0;
      let dealsFound = 0;
      let entitiesFound = 0;
      const batchSize = 3; // Process in smaller batches to respect AI rate limits
      
      for (let i = 0; i < articles.length; i += batchSize) {
        const batch = articles.slice(i, i + batchSize);
        
        // Process articles sequentially to avoid rate limits
        for (const article of batch) {
          try {
            
            // Re-enrich the article with AI (sentiment, deals, entities, geography)
            const enrichment = await enrichArticle(
              article.title, 
              article.summary || article.content || "", 
              article.content || ""
            );
            
            const { dealInfo, entities } = enrichment;
            
            // Extract and link entities
            if (entities && entities.length > 0) {
              for (const entity of entities) {
                try {
                  // Normalize entity type
                  const normalizeEntityType = (type: string): 'company' | 'person' | 'location' | 'asset' | null => {
                    const normalized = type.toLowerCase();
                    if (normalized === 'company' || normalized === 'organization') return 'company';
                    if (normalized === 'person') return 'person';
                    if (normalized === 'location' || normalized === 'place') return 'location';
                    if (normalized === 'asset' || normalized === 'facility') return 'asset';
                    return null;
                  };
                  
                  const normalizedType = normalizeEntityType(entity.type);
                  if (!normalizedType) continue;
                  
                  const entityId = await docketStorage.getOrCreateEntity(
                    entity.name,
                    normalizedType,
                    { description: entity.context || undefined }
                  );
                  
                  // Link entity to article (linkArticleToEntity handles duplicates internally)
                  await docketStorage.linkArticleToEntity(
                    article.id,
                    entityId,
                    1,
                    entity.confidence || 100,
                    entity.context
                  );
                  entitiesFound++;
                } catch (error) {
                }
              }
            }
            
            // Extract and save deal if detected
            if (dealInfo && dealInfo.transactionType) {
              // Check if deal already exists for this article
              const existingDeals = await docketStorage.getDealsByArticle(article.id);
              if (existingDeals.length > 0) {
              } else {
                // Find or create entity IDs for buyer/seller
                let buyerEntityId: number | undefined;
                let sellerEntityId: number | undefined;

                if (dealInfo.buyer) {
                  const buyerResults = await docketStorage.searchEntities(dealInfo.buyer, 'company');
                  if (buyerResults.length > 0) {
                    buyerEntityId = buyerResults[0].id;
                  } else {
                    buyerEntityId = await docketStorage.getOrCreateEntity(
                      dealInfo.buyer,
                      'company',
                      { description: `Deal participant identified in article: ${article.title}` }
                    );
                  }
                }

                if (dealInfo.seller) {
                  const sellerResults = await docketStorage.searchEntities(dealInfo.seller, 'company');
                  if (sellerResults.length > 0) {
                    sellerEntityId = sellerResults[0].id;
                  } else {
                    sellerEntityId = await docketStorage.getOrCreateEntity(
                      dealInfo.seller,
                      'company',
                      { description: `Deal participant identified in article: ${article.title}` }
                    );
                  }
                }

                // Parse dates
                let closingDate: Date | undefined;
                let announcedDate: Date | undefined;

                if (dealInfo.closingDate) {
                  try {
                    closingDate = new Date(dealInfo.closingDate);
                  } catch (e) {
                  }
                }

                if (dealInfo.announcedDate) {
                  try {
                    announcedDate = new Date(dealInfo.announcedDate);
                  } catch (e) {
                  }
                }

                await docketStorage.createDeal({
                  articleId: article.id,
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

                dealsFound++;
              }
            }
            
            processedCount++;
            
            // Small delay between articles to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`[Deal Backfill] Failed to process article ${article.id}:`, error);
          }
        }
        
        // Longer delay between batches
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Send progress update
      }
      
      res.json({ 
        success: true,
        message: `Successfully processed ${processedCount} articles from the last ${daysBack} days`,
        processed: processedCount,
        total: articles.length,
        dealsFound,
        entitiesFound,
        daysBack
      });
    } catch (error) {
      console.error("[Deal Backfill] Error during deal extraction backfill:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Manual category correction
  app.patch("/api/docket/articles/:id/category", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const CategoryUpdateSchema = z.object({
        categories: z.array(z.enum(VALID_CATEGORIES))
      });

      const id = parseInt(req.params.id);
      
      // Log incoming request for debugging
      
      const { categories } = CategoryUpdateSchema.parse(req.body);
      
      const article = await docketStorage.getArticleById(id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      
      await docketStorage.updateArticleCategoryManual(id, categories, article.category || "");
      
      // Invalidate AI learning caches so next categorization uses updated patterns
      invalidateLearningCache();
      invalidateCategorizerCache();
      
      // Fetch updated article to return complete data
      const updated = await docketStorage.getArticleById(id);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`[Category Update] Validation error for article ${req.params.id}:`, error.errors);
        return res.status(400).json({ error: "Invalid categories", details: error.errors });
      }
      console.error("Error updating article category:", error);
      res.status(500).json({ error: "Failed to update article category" });
    }
  });

  // Manual region correction
  app.patch("/api/docket/articles/:id/region", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const RegionUpdateSchema = z.object({
        region: z.enum(["US/Domestic", "International"]).nullable()
      });

      const id = parseInt(req.params.id);
      const { region } = RegionUpdateSchema.parse(req.body);
      
      const article = await docketStorage.getArticleById(id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      await docketStorage.updateArticle(id, { region });
      
      // Fetch updated article to return complete data
      const updated = await docketStorage.getArticleById(id);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(`[Region Update] Validation error for article ${req.params.id}:`, error.errors);
        return res.status(400).json({ error: "Invalid region", details: error.errors });
      }
      console.error("Error updating article region:", error);
      res.status(500).json({ error: "Failed to update article region" });
    }
  });

  // Full article update (edit title, summary, etc.)
  app.patch("/api/docket/articles/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const ArticleUpdateSchema = z.object({
        title: z.string().min(1).optional(),
        summary: z.string().optional(),
        categories: z.array(z.enum(VALID_CATEGORIES)).optional(),
        region: z.enum(["US/Domestic", "International"]).nullable().optional(),
        tags: z.array(z.string()).optional(),
      });

      const id = parseInt(req.params.id);
      const updates = ArticleUpdateSchema.parse(req.body);
      
      const article = await docketStorage.getArticleById(id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      // If categories are being updated, mark as manually reviewed for AI training
      const updateData: any = { ...updates };
      if (updates.categories) {
        updateData.category = updates.categories[0] || null;
        updateData.manuallyReviewed = true;
        updateData.originalCategory = article.category || article.categories?.[0] || "";
      }
      
      const updated = await docketStorage.updateArticle(id, updateData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid article data", details: error.errors });
      }
      console.error("Error updating article:", error);
      res.status(500).json({ error: "Failed to update article" });
    }
  });

  // Delete article permanently
  app.delete("/api/docket/articles/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const article = await docketStorage.getArticleById(id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      await docketStorage.deleteArticle(id);
      res.json({ success: true, message: "Article deleted successfully" });
    } catch (error) {
      console.error("Error deleting article:", error);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

  // Auto-recategorize using updated AI logic
  app.post("/api/docket/articles/:id/recategorize", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { categorizeAndTag } = await import("./services/categorizer");
      const id = parseInt(req.params.id);
      const article = await docketStorage.getArticleById(id);
      
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      const { categories, tags } = await categorizeAndTag(article.title, article.content || "");
      await docketStorage.updateArticleCategory(id, categories, tags);
      
      res.json({ 
        message: "Article recategorized successfully",
        categories,
        tags
      });
    } catch (error) {
      console.error("Error recategorizing article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Export training data
  app.get("/api/docket/training/export", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const manuallyReviewedArticles = await docketStorage.getManuallyReviewedArticles();
      
      const trainingExamples = manuallyReviewedArticles.map(article => ({
        title: article.title,
        content: article.content?.substring(0, 500) || "",
        originalCategory: article.originalCategory,
        correctedCategory: article.category,
        tags: article.tags
      }));
      
      res.json({
        count: trainingExamples.length,
        examples: trainingExamples,
        exportedAt: new Date()
      });
    } catch (error) {
      console.error("Error exporting training data:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Remove article with reason for AI learning (requires auth)
  app.post("/api/docket/articles/:id/remove", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const RemovalSchema = z.object({
        reason: z.string().min(10, "Removal reason must be at least 10 characters"),
      });

      const id = parseInt(req.params.id);
      const { reason } = RemovalSchema.parse(req.body);
      
      // Get userId from authenticated session (guaranteed by requireMarinaMatchAuth middleware)
      const userId = req.docketUser!.id;

      await docketStorage.removeArticle(id, reason, userId);
      
      // Invalidate AI learning caches so next categorization uses updated patterns
      invalidateLearningCache();
      invalidateCategorizerCache();
      
      res.json({ 
        success: true,
        message: "Article removed successfully. AI will learn from this pattern."
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid removal reason", details: error.errors });
      }
      console.error("Error removing article:", error);
      res.status(500).json({ error: "Failed to remove article" });
    }
  });

  // Get removal patterns for review
  app.get("/api/docket/articles/removal-patterns", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const patterns = await docketStorage.getRemovalPatterns();
      res.json(patterns);
    } catch (error) {
      console.error("Error fetching removal patterns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Global Engagement Tracking (NOT org-scoped - powers cross-organization Trending Now)
  
  // Record article view
  app.post("/api/docket/articles/:id/view", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.id, 10);
      if (isNaN(articleId) || articleId < 1) {
        return res.status(400).json({ error: "Invalid article ID" });
      }
      
      const userId = req.docketUser?.id;
      const sessionId = req.body.sessionId || null;
      const referrer = req.body.referrer || null;
      
      await docketStorage.recordArticleView(articleId, userId, sessionId, referrer);
      res.json({ success: true });
    } catch (error) {
      console.error("Error recording article view:", error);
      res.status(500).json({ error: "Failed to record view" });
    }
  });

  // Toggle article like
  app.post("/api/docket/articles/:id/like", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.id, 10);
      if (isNaN(articleId) || articleId < 1) {
        return res.status(400).json({ error: "Invalid article ID" });
      }
      
      const userId = req.docketUser!.id;
      const isLiked = await docketStorage.getArticleLikeStatus(articleId, userId);
      
      if (isLiked) {
        await docketStorage.removeArticleLike(articleId, userId);
        res.json({ liked: false });
      } else {
        await docketStorage.recordArticleLike(articleId, userId);
        res.json({ liked: true });
      }
    } catch (error) {
      console.error("Error toggling article like:", error);
      res.status(500).json({ error: "Failed to toggle like" });
    }
  });

  // Get article engagement stats
  app.get("/api/docket/articles/:id/engagement", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.id, 10);
      if (isNaN(articleId) || articleId < 1) {
        return res.status(400).json({ error: "Invalid article ID" });
      }
      
      const userId = req.docketUser!.id;
      const stats = await docketStorage.getArticleEngagementStats(articleId);
      const isLiked = await docketStorage.getArticleLikeStatus(articleId, userId);
      
      res.json({ ...stats, isLiked });
    } catch (error) {
      console.error("Error fetching article engagement:", error);
      res.status(500).json({ error: "Failed to fetch engagement stats" });
    }
  });

  // Get trending articles (global across all organizations)
  app.get("/api/docket/articles/trending", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const limitParam = req.query.limit as string | undefined;
      const hoursBackParam = req.query.hoursBack as string | undefined;
      
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 10, 50) : 10;
      const hoursBack = hoursBackParam ? Math.min(parseInt(hoursBackParam, 10) || 48, 168) : 48; // Max 7 days
      
      const trendingArticles = await docketStorage.getTrendingArticles({ limit, hoursBack });
      
      // Also get the current user's likes for these articles
      const userId = req.docketUser!.id;
      const userLikedArticles = await docketStorage.getUserLikedArticles(userId);
      const likedSet = new Set(userLikedArticles);
      
      const articlesWithUserLikes = trendingArticles.map(article => ({
        ...article,
        isLiked: likedSet.has(article.id),
      }));
      
      res.json(articlesWithUserLikes);
    } catch (error) {
      console.error("Error fetching trending articles:", error);
      res.status(500).json({ error: "Failed to fetch trending articles" });
    }
  });

  // Get user's liked articles
  app.get("/api/docket/user/likes", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const userId = req.docketUser!.id;
      const likedArticleIds = await docketStorage.getUserLikedArticles(userId);
      res.json(likedArticleIds);
    } catch (error) {
      console.error("Error fetching user likes:", error);
      res.status(500).json({ error: "Failed to fetch liked articles" });
    }
  });

  // Entity Extraction & Tracking endpoints (Institutional Intelligence - Protected)
  app.get("/api/docket/entities", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const typeParam = req.query.type as string | undefined;
      const limitParam = req.query.limit as string | undefined;
      
      // Validate type enum
      const validTypes = ['company', 'person', 'location', 'asset'];
      const type = typeParam && validTypes.includes(typeParam) ? typeParam : undefined;
      
      // Validate and cap limit
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 100, 1000) : 100;
      if (isNaN(limit) || limit < 1) {
        return res.status(400).json({ error: "Invalid limit parameter" });
      }
      
      const entities = await docketStorage.getAllEntities(type, limit);
      res.json(entities);
    } catch (error) {
      console.error("Error fetching entities:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/entities/search", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const query = req.query.q as string;
      const typeParam = req.query.type as string | undefined;
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Query parameter 'q' is required and cannot be empty" });
      }
      
      if (query.length > 200) {
        return res.status(400).json({ error: "Query parameter is too long (max 200 characters)" });
      }
      
      // Validate type enum
      const validTypes = ['company', 'person', 'location', 'asset'];
      const type = typeParam && validTypes.includes(typeParam) ? typeParam : undefined;
      
      const entities = await docketStorage.searchEntities(query.trim(), type);
      res.json(entities);
    } catch (error) {
      console.error("Error searching entities:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/entities/:id/articles", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const entityId = parseInt(req.params.id, 10);
      const limitParam = req.query.limit as string | undefined;
      
      if (isNaN(entityId) || entityId < 1) {
        return res.status(400).json({ error: "Invalid entity ID" });
      }
      
      // Validate and cap limit
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50;
      if (isNaN(limit) || limit < 1) {
        return res.status(400).json({ error: "Invalid limit parameter" });
      }
      
      const articles = await docketStorage.getArticlesByEntity(entityId, limit);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching articles for entity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/articles/:id/entities", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.id, 10);
      
      if (isNaN(articleId) || articleId < 1) {
        return res.status(400).json({ error: "Invalid article ID" });
      }
      
      const entities = await docketStorage.getEntitiesByArticle(articleId);
      res.json(entities);
    } catch (error) {
      console.error("Error fetching entities for article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Watchlist Management (Portfolio Tracking)
  const WatchlistSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    criteria: z.object({
      entities: z.array(z.string()).optional(),
      categories: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
    }).optional(),
    alertFrequency: z.enum(['none', 'immediate', 'daily', 'weekly']).default('none'),
    isActive: z.boolean().default(true),
  });

  const WatchlistUpdateSchema = WatchlistSchema.partial();

  app.get("/api/docket/watchlists", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const watchlists = await docketStorage.getWatchlistsByUser(req.docketUser!.id, req.docketUser!.orgId);
      res.json(watchlists);
    } catch (error) {
      console.error("Error fetching watchlists:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docket/watchlists", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const user = await docketStorage.getUser(req.docketUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = WatchlistSchema.parse(req.body);
      const watchlist = await docketStorage.createWatchlist({
        ...data,
        userId: req.docketUser!.id,
        orgId: user.orgId,
      });

      res.status(201).json(watchlist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating watchlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/watchlists/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const watchlist = await docketStorage.getWatchlistById(req.params.id, req.docketUser!.id, req.docketUser!.orgId);
      if (!watchlist) {
        return res.status(404).json({ error: "Watchlist not found" });
      }

      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/docket/watchlists/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const data = WatchlistUpdateSchema.parse(req.body);
      const watchlist = await docketStorage.updateWatchlist(req.params.id, req.docketUser!.id, req.docketUser!.orgId, data);

      if (!watchlist) {
        return res.status(404).json({ error: "Watchlist not found" });
      }

      res.json(watchlist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating watchlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/docket/watchlists/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const deleted = await docketStorage.deleteWatchlist(req.params.id, req.docketUser!.id, req.docketUser!.orgId);
      if (!deleted) {
        return res.status(404).json({ error: "Watchlist not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting watchlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docket/watchlists/:id/entities/:entityId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const entityId = parseInt(req.params.entityId, 10);
      if (isNaN(entityId) || entityId < 1) {
        return res.status(400).json({ error: "Invalid entity ID" });
      }

      const added = await docketStorage.addEntityToWatchlist(req.params.id, entityId, req.docketUser!.id, req.docketUser!.orgId);
      if (!added) {
        return res.status(404).json({ error: "Watchlist not found or entity already added" });
      }

      // Backfill historical articles for this entity (past 6 months)
      // This populates matches from existing articles so the watchlist shows historical data
      const backfillResult = await docketStorage.backfillHistoricalArticlesForEntity(entityId, 6);
      
      res.status(201).json({ 
        success: true,
        historicalMatches: backfillResult.matchedCount,
        newLinks: backfillResult.linkedCount
      });
    } catch (error) {
      console.error("Error adding entity to watchlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/docket/watchlists/:id/entities/:entityId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const entityId = parseInt(req.params.entityId, 10);
      if (isNaN(entityId) || entityId < 1) {
        return res.status(400).json({ error: "Invalid entity ID" });
      }

      const removed = await docketStorage.removeEntityFromWatchlist(req.params.id, entityId, req.docketUser!.id, req.docketUser!.orgId);
      if (!removed) {
        return res.status(404).json({ error: "Watchlist or entity not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error removing entity from watchlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/watchlists/:id/entities", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const entities = await docketStorage.getWatchlistEntities(req.params.id, req.docketUser!.id, req.docketUser!.orgId);
      res.json(entities);
    } catch (error) {
      console.error("Error fetching watchlist entities:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/watchlists/:id/articles", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

      const articles = await docketStorage.getArticlesByWatchlist(req.params.id, req.docketUser!.id, req.docketUser!.orgId, limit, offset);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching watchlist articles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Entity endpoints
  app.get("/api/docket/entities/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const entity = await docketStorage.getEntityById(id);
      
      if (!entity) {
        return res.status(404).json({ error: "Entity not found" });
      }

      res.json(entity);
    } catch (error) {
      console.error("Error fetching entity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/entities/:id/analytics", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const analytics = await docketStorage.getEntityAnalytics(id);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching entity analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/entities/:id/deals", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const role = req.query.role as 'buyer' | 'seller' | undefined;
      const deals = await docketStorage.getDealsByEntity(id, role);

      // Batch fetch articles and entities
      const articleIds = Array.from(new Set(deals.map(d => d.articleId)));
      const entityIds = Array.from(new Set(deals.flatMap(d => [d.buyerEntityId, d.sellerEntityId].filter((eid): eid is number => eid !== null))));
      
      const [articlesMap, entitiesMap] = await Promise.all([
        docketStorage.getArticlesByIds(articleIds).then(articles => 
          new Map(articles.map(a => [a.id, a]))
        ),
        docketStorage.getEntitiesByIds(entityIds).then(entities => 
          new Map(entities.map(e => [e.id, e]))
        ),
      ]);

      // Enrich deals
      const enrichedDeals = deals.map((deal) => {
        const article = articlesMap.get(deal.articleId);
        const buyerEntity = deal.buyerEntityId ? entitiesMap.get(deal.buyerEntityId) : null;
        const sellerEntity = deal.sellerEntityId ? entitiesMap.get(deal.sellerEntityId) : null;

        return {
          ...deal,
          article: article ? {
            id: article.id,
            title: article.title,
            url: article.url,
            source: article.source,
            publishedAt: article.publishedAt,
            region: article.region,
          } : null,
          buyerEntity: buyerEntity ? {
            id: buyerEntity.id,
            name: buyerEntity.name,
            type: buyerEntity.type,
          } : null,
          sellerEntity: sellerEntity ? {
            id: sellerEntity.id,
            name: sellerEntity.name,
            type: sellerEntity.type,
          } : null,
        };
      });

      res.json(enrichedDeals);
    } catch (error) {
      console.error("Error fetching entity deals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/entities/:id/articles", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const articles = await docketStorage.getArticlesByEntity(id, limit);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching entity articles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/ma-spotlight-analytics", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const region = req.query.region as string | undefined;

      const allArticles = await docketStorage.getArticles(null, {
        categories: ['M&A', 'Marina Sale'],
        region,
        limit: 500,
        offset: 0,
      });

      const now = new Date();
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      const monthlyMap = new Map<string, number>();
      const categoryMap = new Map<string, number>();

      allArticles.forEach(article => {
        if (article.publishedAt) {
          const pubDate = new Date(article.publishedAt);
          if (pubDate >= twelveMonthsAgo) {
            const monthKey = `${pubDate.getFullYear()}-${String(pubDate.getMonth() + 1).padStart(2, '0')}`;
            monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
          }
        }
        if (article.categories) {
          (article.categories as string[]).forEach(cat => {
            if (cat === 'M&A' || cat === 'Marina Sale') {
              categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
            }
          });
        }
      });

      const monthlyArticles: Array<{ month: string; count: number }> = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyArticles.push({
          month: monthKey,
          count: monthlyMap.get(monthKey) || 0,
        });
      }

      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentCount = allArticles.filter(a => a.publishedAt && new Date(a.publishedAt) >= thirtyDaysAgo).length;

      const byCategory = Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }));

      res.json({
        totalArticles: allArticles.length,
        recentCount,
        monthlyArticles,
        byCategory,
      });
    } catch (error) {
      console.error("Error fetching M&A spotlight analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // M&A Spotlight articles - articles tagged with M&A or Marina Sale categories
  app.get("/api/docket/ma-spotlight-articles", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const offset = parseInt(req.query.offset as string, 10) || 0;
      const region = req.query.region as string | undefined;
      
      // Fetch articles with M&A or Marina Sale categories
      const articles = await docketStorage.getArticles(null, {
        categories: ['M&A', 'Marina Sale'],
        region,
        limit,
        offset
      });
      
      res.json({
        articles,
        total: articles.length,
        limit,
        offset
      });
    } catch (error) {
      console.error("Error fetching M&A spotlight articles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Deal endpoints
  app.get("/api/docket/deals/analytics", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      // Parse filters (subset of DealQuerySchema)
      const filters: {
        transactionType?: string;
        dealStatus?: string;
        region?: string;
        fromDate?: Date;
        toDate?: Date;
      } = {};

      if (req.query.transactionType) {
        filters.transactionType = req.query.transactionType as string;
      }
      if (req.query.dealStatus) {
        filters.dealStatus = req.query.dealStatus as string;
      }
      if (req.query.region) {
        filters.region = req.query.region as string;
      }
      if (req.query.fromDate) {
        filters.fromDate = new Date(req.query.fromDate as string);
      }
      if (req.query.toDate) {
        filters.toDate = new Date(req.query.toDate as string);
      }

      const analytics = await docketStorage.getDealAnalytics(filters);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching deal analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/deals", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const params = DealQuerySchema.parse(req.query);
      
      const fromDate = params.fromDate ? new Date(params.fromDate) : undefined;
      const toDate = params.toDate ? new Date(params.toDate) : undefined;

      const deals = await docketStorage.getDeals({
        transactionType: params.transactionType,
        dealStatus: params.dealStatus,
        entityId: params.entityId,
        fromDate,
        toDate,
        limit: params.limit,
        offset: params.offset
      });

      // Batch fetch all referenced articles and entities to avoid N+1 queries
      const articleIds = Array.from(new Set(deals.map(d => d.articleId)));
      const entityIds = Array.from(new Set(deals.flatMap(d => [d.buyerEntityId, d.sellerEntityId].filter((id): id is number => id !== null))));
      
      const [articlesMap, entitiesMap] = await Promise.all([
        docketStorage.getArticlesByIds(articleIds).then(articles => 
          new Map(articles.map(a => [a.id, a]))
        ),
        docketStorage.getEntitiesByIds(entityIds).then(entities => 
          new Map(entities.map(e => [e.id, e]))
        ),
      ]);

      // Enrich deals with batched data
      const enrichedDeals = deals.map((deal) => {
        const article = articlesMap.get(deal.articleId);
        const buyerEntity = deal.buyerEntityId ? entitiesMap.get(deal.buyerEntityId) : null;
        const sellerEntity = deal.sellerEntityId ? entitiesMap.get(deal.sellerEntityId) : null;

        return {
          ...deal,
          article: article ? {
            id: article.id,
            title: article.title,
            url: article.url,
            source: article.source,
            publishedAt: article.publishedAt,
            categories: article.categories,
            geography: article.geography,
            region: article.region,
          } : null,
          buyerEntity: buyerEntity ? {
            id: buyerEntity.id,
            name: buyerEntity.name,
            type: buyerEntity.type,
          } : null,
          sellerEntity: sellerEntity ? {
            id: sellerEntity.id,
            name: sellerEntity.name,
            type: sellerEntity.type,
          } : null,
        };
      });

      res.json({
        deals: enrichedDeals,
        total: enrichedDeals.length,
        limit: params.limit,
        offset: params.offset
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
      }
      console.error("Error fetching deals:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/deals/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const dealId = parseInt(req.params.id, 10);
      if (isNaN(dealId) || dealId < 1) {
        return res.status(400).json({ error: "Invalid deal ID" });
      }

      const deal = await docketStorage.getDealById(dealId);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }

      res.json(deal);
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const DealUpdateSchema = z.object({
    dealStatus: z.enum(["rumored", "announced", "pending", "closed", "failed"]).optional(),
    transactionSize: z.string().optional(),
    valuation: z.string().optional(),
    equityStake: z.string().optional(),
    closingDate: z.string().optional(),
    dealSummary: z.string().optional(),
    confidence: z.number().min(0).max(100).optional(),
  });

  app.patch("/api/docket/deals/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    // Role check for admin, analyst, or partner
    if (!['admin', 'analyst', 'partner'].includes(req.docketUser!.role)) {
      return res.status(403).json({ error: "Admin, Analyst, or Partner access required" });
    }
    
    try {
      const dealId = parseInt(req.params.id, 10);
      if (isNaN(dealId) || dealId < 1) {
        return res.status(400).json({ error: "Invalid deal ID" });
      }

      const data = DealUpdateSchema.parse(req.body);
      
      // Parse dates if provided
      const updates: any = { ...data };
      if (data.closingDate) {
        updates.closingDate = new Date(data.closingDate);
      }

      const updated = await docketStorage.updateDeal(dealId, updates);
      if (!updated) {
        return res.status(404).json({ error: "Deal not found" });
      }

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating deal:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a deal manually
  const ManualDealSchema = z.object({
    transactionType: z.enum(["M&A", "Financing", "Partnership", "Asset Sale", "Lease", "Other"]),
    dealStatus: z.enum(["Announced", "Pending", "Closed", "Terminated"]).optional(),
    buyer: z.string().optional(),
    seller: z.string().optional(),
    assetDescription: z.string().min(1, "Asset description is required"),
    dealSize: z.string().optional(),
    valuation: z.string().optional(),
    dealDate: z.string().optional(),
    closingDate: z.string().optional(),
    dealSummary: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
  });

  app.post("/api/docket/deals", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const data = ManualDealSchema.parse(req.body);
      const orgId = req.marinaMatchUser?.orgId;
      const userId = req.marinaMatchUser?.id;
      
      if (!orgId || !userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const announcedDate = data.dealDate ? new Date(data.dealDate) : new Date();
      const closingDate = data.closingDate ? new Date(data.closingDate) : null;

      const deal = await docketStorage.createDeal({
        orgId,
        createdBy: userId,
        origin: 'marinaMatch',
        transactionType: data.transactionType,
        dealStatus: (data.dealStatus || 'Announced') as any,
        buyer: data.buyer || null,
        seller: data.seller || null,
        assetDescription: data.assetDescription,
        dealSize: data.dealSize || null,
        valuation: data.valuation || null,
        announcedDate,
        closingDate,
        dealSummary: data.dealSummary || null,
        region: data.region || null,
        city: data.city || null,
        state: data.state || null,
        confidence: 100,
      });

      res.status(201).json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating deal:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Sync deals from Sales Comps
  app.post("/api/docket/deals/sync-from-sales-comps", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const orgId = req.marinaMatchUser?.orgId;
      const userId = req.marinaMatchUser?.id;
      
      if (!orgId || !userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Dynamic imports to avoid circular dependencies
      const { salesComps, docketDeals } = await import("@shared/schema");
      const { isNull, eq: eqOp, and: andOp } = await import("drizzle-orm");
      const { db } = await import("./db");
      
      const comps = await db.select().from(salesComps)
        .where(andOp(
          eqOp(salesComps.orgId, orgId),
          isNull(salesComps.deletedAt)
        ));

      let synced = 0;
      let skipped = 0;

      for (const comp of comps) {
        // Check if already synced by externalId
        const existing = await db.select().from(docketDeals)
          .where(andOp(
            eqOp(docketDeals.orgId, orgId),
            eqOp(docketDeals.externalId, comp.id)
          ))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Create deal from sales comp
        const dealDate = comp.saleYear && comp.saleMonth 
          ? new Date(comp.saleYear, comp.saleMonth - 1, 15)
          : new Date();

        await docketStorage.createDeal({
          orgId,
          createdBy: userId,
          origin: 'marinaMatch',
          externalId: comp.id,
          sourceReference: `Sales Comp: ${comp.marina}`,
          transactionType: 'Asset Sale',
          dealStatus: 'Closed',
          assetDescription: comp.marina,
          dealSize: comp.salePrice ? `$${(comp.salePrice / 1000000).toFixed(1)}M` : null,
          valuation: comp.salePrice ? `$${(comp.salePrice / 1000000).toFixed(1)}M` : null,
          announcedDate: dealDate,
          closingDate: dealDate,
          region: comp.region || null,
          city: comp.city || null,
          state: comp.state || null,
          confidence: 100,
        });
        synced++;
      }

      res.json({ synced, skipped, total: comps.length });
    } catch (error) {
      console.error("Error syncing from sales comps:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/articles/:id/deals", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.id, 10);
      if (isNaN(articleId) || articleId < 1) {
        return res.status(400).json({ error: "Invalid article ID" });
      }

      const deals = await docketStorage.getDealsByArticle(articleId);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching deals for article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Portfolio Companies Management
  const PortfolioCompanySchema = z.object({
    companyName: z.string().min(1),
    aliases: z.array(z.string()).optional().nullable(),
    sector: z.string().optional().nullable(),
    region: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    companyType: z.enum(["marina_operator", "marina_owner", "marina_owner_operator", "boat_dealer", "marine_services", "yacht_club", "boatyard", "marine_retail", "marine_finance", "other"]).optional().nullable(),
    relationshipStage: z.enum(["tracking", "interested", "in_pipeline", "portfolio_holding", "exited"]).optional().nullable(),
    geographyFocus: z.array(z.string()).optional().nullable(),
    website: z.string().optional().nullable(),
    parentCompany: z.string().optional().nullable(),
    watchKeywords: z.array(z.string()).optional().nullable(),
    excludedTerms: z.array(z.string()).optional().nullable(),
    alertFrequency: z.enum(["none", "immediate", "daily", "weekly"]).optional().nullable(),
    alertChannels: z.array(z.string()).optional().nullable(),
    alertSensitivity: z.enum(["all_mentions", "headlines_only", "high_relevance"]).optional().nullable(),
    isActive: z.boolean().optional(),
  });

  const PortfolioCompanyUpdateSchema = PortfolioCompanySchema.partial();

  app.get("/api/docket/portfolio-companies", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const companies = await docketStorage.getPortfolioCompanies(req.docketUser!.id, req.docketUser!.orgId);
      res.json(companies);
    } catch (error) {
      console.error("Error fetching portfolio companies:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docket/portfolio-companies", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const user = await docketStorage.getUser(req.docketUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = PortfolioCompanySchema.parse(req.body);
      const company = await docketStorage.createPortfolioCompany({
        ...data,
        userId: req.docketUser!.id,
        orgId: user.orgId,
      });

      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating portfolio company:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/portfolio-companies/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const company = await docketStorage.getPortfolioCompanyById(req.params.id, req.docketUser!.id, req.docketUser!.orgId);
      if (!company) {
        return res.status(404).json({ error: "Portfolio company not found" });
      }

      res.json(company);
    } catch (error) {
      console.error("Error fetching portfolio company:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/docket/portfolio-companies/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const data = PortfolioCompanyUpdateSchema.parse(req.body);
      const company = await docketStorage.updatePortfolioCompany(req.params.id, req.docketUser!.id, req.docketUser!.orgId, data);

      if (!company) {
        return res.status(404).json({ error: "Portfolio company not found" });
      }

      res.json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating portfolio company:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/docket/portfolio-companies/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const success = await docketStorage.deletePortfolioCompany(req.params.id, req.docketUser!.id, req.docketUser!.orgId);
      if (!success) {
        return res.status(404).json({ error: "Portfolio company not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting portfolio company:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/portfolio-companies/:id/articles", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const articles = await docketStorage.getArticlesForPortfolioCompany(
        req.params.id,
        req.docketUser!.id,
        req.docketUser!.orgId,
        limit
      );

      res.json(articles);
    } catch (error) {
      console.error("Error fetching portfolio company articles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // CRM Company Integration - Match Suggestions
  app.post("/api/docket/portfolio-companies/match-suggestions", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { companyName, domain } = req.body;
      if (!companyName) {
        return res.status(400).json({ error: "Company name is required" });
      }

      const matches = await findMatchingCrmCompanies(companyName, req.docketUser!.orgId, domain);
      res.json(matches);
    } catch (error) {
      console.error("Error finding CRM company matches:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // CRM Company Integration - Search CRM Companies
  app.get("/api/docket/crm-companies/search", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const companies = await searchCrmCompanies(query, req.docketUser!.orgId, limit);
      res.json(companies);
    } catch (error) {
      console.error("Error searching CRM companies:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // CRM Company Integration - Link Portfolio Company to CRM Company
  app.post("/api/docket/portfolio-companies/:id/link-crm", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { crmCompanyId } = req.body;
      if (!crmCompanyId) {
        return res.status(400).json({ error: "CRM company ID is required" });
      }

      const company = await docketStorage.linkPortfolioCompanyToCrm(
        req.params.id,
        req.docketUser!.id,
        req.docketUser!.orgId,
        crmCompanyId
      );

      if (!company) {
        return res.status(404).json({ error: "Portfolio company not found" });
      }

      res.json(company);
    } catch (error) {
      console.error("Error linking portfolio company to CRM:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // CRM Company Integration - Unlink Portfolio Company from CRM Company
  app.delete("/api/docket/portfolio-companies/:id/unlink-crm", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const company = await docketStorage.unlinkPortfolioCompanyFromCrm(
        req.params.id,
        req.docketUser!.id,
        req.docketUser!.orgId
      );

      if (!company) {
        return res.status(404).json({ error: "Portfolio company not found" });
      }

      res.json(company);
    } catch (error) {
      console.error("Error unlinking portfolio company from CRM:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // CRM Company Integration - Create CRM Company from Portfolio Company
  const CreateCrmCompanySchema = z.object({
    name: z.string().min(1),
    domain: z.string().optional(),
    industry: z.string().optional(),
    website: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    description: z.string().optional(),
  });

  app.post("/api/docket/portfolio-companies/:id/create-crm", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const data = CreateCrmCompanySchema.parse(req.body);
      
      const result = await docketStorage.createCrmCompanyFromPortfolio(
        req.params.id,
        req.docketUser!.id,
        req.docketUser!.orgId,
        data
      );

      if (!result) {
        return res.status(404).json({ error: "Portfolio company not found" });
      }

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating CRM company from portfolio:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get CRM Company linked to Portfolio Company
  app.get("/api/docket/portfolio-companies/:id/crm-company", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const company = await docketStorage.getPortfolioCompanyById(
        req.params.id,
        req.docketUser!.id,
        req.docketUser!.orgId
      );

      if (!company) {
        return res.status(404).json({ error: "Portfolio company not found" });
      }

      if (!company.crmCompanyId) {
        return res.json({ linked: false, crmCompany: null });
      }

      const crmCompany = await docketStorage.getLinkedCrmCompany(company.crmCompanyId);
      res.json({ linked: true, crmCompany });
    } catch (error) {
      console.error("Error fetching linked CRM company:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Saved Searches Management
  const SavedSearchSchema = z.object({
    name: z.string().min(1),
    criteria: z.object({}).passthrough(),
    alertFrequency: z.enum(["none", "immediate", "daily", "weekly"]).default("none"),
    deliveryTime: z.string().default("09:00"),
    timezone: z.string().default("America/New_York"),
  });

  const SavedSearchUpdateSchema = SavedSearchSchema.partial().extend({
    isActive: z.boolean().optional(),
  });

  app.get("/api/docket/saved-searches", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const searches = await docketStorage.getSavedSearches(req.docketUser!.id, req.docketUser!.orgId);
      res.json(searches);
    } catch (error) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docket/saved-searches", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const user = await docketStorage.getUser(req.docketUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = SavedSearchSchema.parse(req.body);
      const search = await docketStorage.createSavedSearch({
        ...data,
        userId: req.docketUser!.id,
        orgId: user.orgId,
      });

      // Trigger 24-hour recap email asynchronously (don't block response)
      setImmediate(async () => {
        try {
          console.log(`[Recap] Triggering 24-hour recap for new search: ${search.id}`);
          const result = await sendNewSearchRecap(search.id, req.docketUser!.id, user.orgId);
          if (result.sent) {
            console.log(`[Recap] Successfully sent recap email with ${result.articleCount} articles`);
          } else {
            console.log(`[Recap] Recap not sent: ${result.error || 'No articles found'}`);
          }
        } catch (error) {
          console.error(`[Recap] Error triggering recap:`, error);
        }
      });

      res.status(201).json(search);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating saved search:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/saved-searches/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const search = await docketStorage.getSavedSearchById(req.params.id, req.docketUser!.id, req.docketUser!.orgId);
      if (!search) {
        return res.status(404).json({ error: "Saved search not found" });
      }

      res.json(search);
    } catch (error) {
      console.error("Error fetching saved search:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/docket/saved-searches/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const data = SavedSearchUpdateSchema.parse(req.body);
      const search = await docketStorage.updateSavedSearch(req.params.id, req.docketUser!.id, req.docketUser!.orgId, data);

      if (!search) {
        return res.status(404).json({ error: "Saved search not found" });
      }

      res.json(search);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating saved search:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/docket/saved-searches/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const success = await docketStorage.deleteSavedSearch(req.params.id, req.docketUser!.id, req.docketUser!.orgId);
      if (!success) {
        return res.status(404).json({ error: "Saved search not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting saved search:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User Management (Admin only)
  app.get("/api/docket/users", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    // Admin role check
    if (req.docketUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      const users = await docketStorage.getAllUsers();
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const UserUpdateSchema = z.object({
    email: z.string().email().optional(),
    role: z.enum(["admin", "analyst", "partner", "viewer"]).optional(),
    isActive: z.boolean().optional(),
  });

  app.patch("/api/docket/users/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    // Admin role check
    if (req.docketUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      const data = UserUpdateSchema.parse(req.body);
      const user = await docketStorage.updateUser(req.params.id, data);
      const { password, ...safeUser } = user;

      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/docket/users/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    // Admin role check
    if (req.docketUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      await docketStorage.deactivateUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Current user endpoints
  app.get("/api/docket/user/current", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const user = await docketStorage.getUser(req.docketUser!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const prefs = await docketStorage.getUserNotificationPreferences(user.id, user.orgId!);
      const { password, ...safeUser } = user;
      
      res.json({
        ...safeUser,
        notificationPreferences: prefs || null,
      });
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const NotificationPreferencesSchema = z.object({
    email: z.string().email("Invalid email address"),
    categories: z.array(z.string()).optional().default([]),
    frequency: z.enum(["none", "immediate", "daily", "weekly"]).optional(),
    deliveryTime: z.string().optional(),
    timezone: z.string().default("America/New_York"),
    enabled: z.boolean().default(true),
  });

  app.patch("/api/docket/user/notification-preferences", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const user = await docketStorage.getUser(req.docketUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = NotificationPreferencesSchema.parse(req.body);
      
      // Check if preferences exist
      const existing = await docketStorage.getUserNotificationPreferences(req.docketUser!.id, req.docketUser!.orgId);
      
      let prefs;
      if (existing) {
        const updates: Record<string, any> = {
          emailAddress: data.email,
          deliveryTime: data.deliveryTime || "09:00",
          timezone: data.timezone || "America/New_York",
          enabled: data.enabled,
        };
        if (data.categories && data.categories.length > 0) updates.categories = data.categories;
        if (data.frequency) updates.frequency = data.frequency;
        prefs = await docketStorage.updateUserNotificationPreferences(req.docketUser!.id, req.docketUser!.orgId, updates);
      } else {
        prefs = await docketStorage.createUserNotificationPreferences({
          userId: req.docketUser!.id,
          orgId: user.orgId,
          emailAddress: data.email,
          categories: data.categories || [],
          frequency: data.frequency || 'daily',
          deliveryTime: data.deliveryTime || "09:00",
          timezone: data.timezone || "America/New_York",
          enabled: data.enabled,
        });
      }

      res.json(prefs);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Filter Preferences endpoints
  app.get("/api/docket/user/filter-preferences", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const prefs = await docketStorage.getUserFilterPreferences(req.docketUser!.id, req.docketUser!.orgId);
      res.json(prefs || null);
    } catch (error) {
      console.error("Error fetching filter preferences:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const FilterPreferencesSchema = z.object({
    categories: z.array(z.string()).optional(),
    sources: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    fromDate: z.string().optional(),
    minRelevance: z.number().optional(),
    sortBy: z.string().optional(),
  });

  app.put("/api/docket/user/filter-preferences", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const user = await docketStorage.getUser(req.docketUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = FilterPreferencesSchema.parse(req.body);
      const prefs = await docketStorage.saveUserFilterPreferences(req.docketUser!.id, user.orgId, data);
      res.json(prefs);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error saving filter preferences:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Unified User Preferences endpoint (combines notification and display preferences)
  app.get("/api/docket/user-preferences", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const user = await docketStorage.getUser(req.docketUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const notificationPrefs = await docketStorage.getUserNotificationPreferences(user.id, user.orgId);
      const filterPrefs = await docketStorage.getUserFilterPreferences(user.id, user.orgId);

      res.json({
        id: user.id,
        emailNotifications: notificationPrefs?.enabled ?? false,
        alertFrequency: notificationPrefs?.frequency ?? 'daily',
        subscriptionTier: user.subscriptionTier || 'free',
        categoriesFilter: filterPrefs?.categories || notificationPrefs?.categories || [],
        customGeographyRegions: filterPrefs?.customGeographyRegions || [],
        email: notificationPrefs?.emailAddress,
        deliveryTime: notificationPrefs?.deliveryTime || '09:00',
        timezone: notificationPrefs?.timezone || 'America/New_York',
        createdAt: notificationPrefs?.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: notificationPrefs?.updatedAt?.toISOString() || new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching user preferences:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const UserPreferencesUpdateSchema = z.object({
    emailNotifications: z.boolean().optional(),
    alertFrequency: z.enum(["none", "immediate", "daily", "weekly"]).optional(),
    categoriesFilter: z.array(z.string()).optional(),
    customGeographyRegions: z.array(z.string()).optional(),
    email: z.string().email().optional(),
    deliveryTime: z.string().optional(),
    timezone: z.string().optional(),
  });

  app.patch("/api/docket/user-preferences", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const user = await docketStorage.getUser(req.docketUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = UserPreferencesUpdateSchema.parse(req.body);
      
      const hasNotifFields = data.emailNotifications !== undefined || data.alertFrequency !== undefined
        || data.email !== undefined || data.deliveryTime !== undefined || data.timezone !== undefined;
      if (hasNotifFields) {
        const existing = await docketStorage.getUserNotificationPreferences(user.id, user.orgId);
        
        if (existing) {
          const updates: Record<string, any> = {};
          if (data.emailNotifications !== undefined) updates.enabled = data.emailNotifications;
          if (data.alertFrequency !== undefined) updates.frequency = data.alertFrequency;
          if (data.email !== undefined) updates.emailAddress = data.email;
          if (data.deliveryTime !== undefined) updates.deliveryTime = data.deliveryTime;
          if (data.timezone !== undefined) updates.timezone = data.timezone;
          await docketStorage.updateUserNotificationPreferences(user.id, user.orgId, updates);
        } else {
          await docketStorage.createUserNotificationPreferences({
            userId: user.id,
            orgId: user.orgId,
            emailAddress: data.email || user.email || `${user.username}@docket.local`,
            categories: data.categoriesFilter || [],
            frequency: data.alertFrequency || 'daily',
            enabled: data.emailNotifications ?? true,
            deliveryTime: data.deliveryTime || '09:00',
            timezone: data.timezone || 'America/New_York',
          });
        }
      }

      // Update filter preferences if categories or custom geography regions are provided
      if (data.categoriesFilter !== undefined || data.customGeographyRegions !== undefined) {
        const existingFilterPrefs = await docketStorage.getUserFilterPreferences(user.id, user.orgId);
        await docketStorage.saveUserFilterPreferences(user.id, user.orgId, {
          categories: data.categoriesFilter ?? existingFilterPrefs?.categories ?? [],
          customGeographyRegions: data.customGeographyRegions ?? existingFilterPrefs?.customGeographyRegions ?? [],
        });
      }

      // Return updated preferences
      const notificationPrefs = await docketStorage.getUserNotificationPreferences(user.id, user.orgId);
      const filterPrefs = await docketStorage.getUserFilterPreferences(user.id, user.orgId);

      res.json({
        id: user.id,
        emailNotifications: notificationPrefs?.enabled ?? false,
        alertFrequency: notificationPrefs?.frequency ?? 'daily',
        subscriptionTier: user.subscriptionTier || 'free',
        categoriesFilter: filterPrefs?.categories || notificationPrefs?.categories || [],
        customGeographyRegions: filterPrefs?.customGeographyRegions || [],
        email: notificationPrefs?.emailAddress,
        deliveryTime: notificationPrefs?.deliveryTime || '09:00',
        timezone: notificationPrefs?.timezone || 'America/New_York',
        createdAt: notificationPrefs?.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: notificationPrefs?.updatedAt?.toISOString() || new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating user preferences:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docket/notifications", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const notifications = await docketStorage.getNotificationsByUser(req.docketUser!.id, req.docketUser!.orgId, 50);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Category Summary endpoints (Pro tier only)
  const SummaryQuerySchema = z.object({
    period: z.enum(["daily", "weekly"]).optional()
  });

  const SummaryEditSchema = z.object({
    summaryText: z.string().min(10),
    editReason: z.string().optional()
  });

  const GenerateSummarySchema = z.object({
    category: z.string(),
    period: z.enum(["daily", "weekly"])
  });

  app.get("/api/docket/summaries", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    // Pro tier check
    if (req.docketUser?.subscriptionTier !== 'pro' && req.docketUser?.role !== 'admin') {
      return res.status(403).json({ 
        error: "Pro subscription required",
        message: "This feature requires a Pro subscription. Upgrade to access AI-powered category summaries and advanced analytics.",
        currentTier: req.docketUser?.subscriptionTier,
        requiredTier: "pro"
      });
    }
    
    try {
      const { period } = SummaryQuerySchema.parse(req.query);
      const summaries = await getLatestSummaries(period);
      res.json(summaries);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
      }
      console.error("Error fetching summaries:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docket/summaries/generate", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    // Role check for admin or analyst
    if (!['admin', 'analyst'].includes(req.docketUser!.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        required: ['admin', 'analyst'],
        current: req.docketUser!.role
      });
    }
    
    try {
      const { category, period } = GenerateSummarySchema.parse(req.body);
      const summary = await generateCategorySummary(category, period);
      
      if (!summary) {
        return res.status(404).json({ error: "No articles found for this category in the specified period" });
      }

      res.json(summary);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error generating summary:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docket/summaries/generate-all", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    // Role check for admin or analyst
    if (!['admin', 'analyst'].includes(req.docketUser!.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        required: ['admin', 'analyst'],
        current: req.docketUser!.role
      });
    }
    
    try {
      const { period } = z.object({ period: z.enum(["daily", "weekly"]) }).parse(req.body);
      const summaries = await generateAllCategorySummaries(period);
      res.json({ summaries, count: summaries.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error generating all summaries:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/docket/summaries/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    // Role check for admin, analyst, or partner
    if (!['admin', 'analyst', 'partner'].includes(req.docketUser!.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        required: ['admin', 'analyst', 'partner'],
        current: req.docketUser!.role
      });
    }
    
    try {
      const summaryId = parseInt(req.params.id);
      if (isNaN(summaryId)) {
        return res.status(400).json({ error: "Invalid summary ID" });
      }

      const { summaryText, editReason } = SummaryEditSchema.parse(req.body);
      const updated = await editSummary(summaryId, req.docketUser!.id, summaryText, editReason);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error editing summary:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Daily Digest Preview Email (admin only)
  app.post("/api/docket/test-digest", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    // Admin role check
    if (req.docketUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      
      // Get user's notification preferences for email address
      const prefs = await docketStorage.getUserNotificationPreferences(req.docketUser!.id, req.docketUser!.orgId);
      const testEmail = prefs?.emailAddress || req.body.email;
      
      if (!testEmail) {
        return res.status(400).json({ 
          error: "No email address found. Please configure notification preferences first." 
        });
      }

      // Fetch sample articles from the last week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const sampleArticles = await docketStorage.getArticles(req.docketUser!.id, {
        fromDate: oneWeekAgo,
        limit: 10,
        sortBy: "newest",
        minRelevance: 70
      });

      if (sampleArticles.length === 0) {
        return res.status(400).json({ 
          error: "No articles found in the last week to preview. Try ingesting some articles first." 
        });
      }

      // Build email HTML with real articles
      const articlesHtml = sampleArticles.map(article => `
        <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
          <h3 style="margin: 0 0 8px 0; color: #1a1a1a;">
            <a href="${article.url}" style="color: #0066cc; text-decoration: none;">${article.title}</a>
          </h3>
          <p style="margin: 0; color: #666; font-size: 14px;">
            ${article.source} • ${article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Unknown date'} • ${(article.categories && article.categories.length > 0) ? article.categories[0] : 'General'}
          </p>
          ${article.summary ? `<p style="margin: 8px 0 0 0; color: #333;">${article.summary.substring(0, 200)}${article.summary.length > 200 ? '...' : ''}</p>` : ''}
        </div>
      `).join('');

      // Send test digest email
      const result = await client.emails.send({
        from: fromEmail,
        to: testEmail,
        subject: `The Docket Daily Digest Preview - ${new Date().toLocaleDateString()} (${sampleArticles.length} Articles)`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">⚓ The Docket</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Marina Industry Intelligence</p>
            </div>
            
            <div style="padding: 30px 20px;">
              <h2 style="color: #003366; margin-top: 0;">Daily Digest Preview</h2>
              <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
                <strong>${sampleArticles.length} articles</strong> from the past week matching your saved search criteria.
              </p>
              
              ${articlesHtml}
            </div>
            
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">This is a preview of your Daily Digest email</p>
              <p style="margin: 10px 0 0 0;">Manage your notification preferences in The Docket settings</p>
            </div>
          </div>
        `,
      });


      res.json({ 
        success: true, 
        message: `Daily Digest preview sent to ${testEmail}`,
        articleCount: sampleArticles.length,
        result: result.data 
      });
    } catch (error: any) {
      console.error("Error sending digest preview:", error);
      
      res.status(500).json({ 
        error: "Failed to send digest preview",
        details: error.message 
      });
    }
  });

  app.post("/api/docket/test-email", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      
      // Get user's notification preferences for email address
      const prefs = await docketStorage.getUserNotificationPreferences(req.docketUser!.id, req.docketUser!.orgId);
      const testEmail = prefs?.emailAddress || req.body.email;
      
      if (!testEmail) {
        return res.status(400).json({ 
          error: "No email address found. Please configure notification preferences first." 
        });
      }

      // Send test email
      const result = await client.emails.send({
        from: fromEmail,
        to: testEmail,
        subject: "The Docket - Test Email Notification",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">⚓ The Docket</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Marina Industry Intelligence</p>
            </div>
            
            <div style="padding: 30px 20px;">
              <h2 style="color: #003366; margin-top: 0;">Email Notification Test Successful! ✅</h2>
              
              <p style="color: #333; line-height: 1.6;">
                This is a test email to confirm that The Docket's email notification system is working correctly.
              </p>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; color: #666;"><strong>Email sent to:</strong> ${testEmail}</p>
                <p style="margin: 8px 0 0 0; color: #666;"><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
              </div>
              
              <p style="color: #333; line-height: 1.6;">
                Your notification system is properly configured and ready to send alerts for saved searches and category updates.
              </p>
            </div>
            
            <div style="background-color: #f8f8f8; padding: 20px; text-align: center; color: #666; font-size: 12px;">
              <p style="margin: 0;">The Docket - Institutional-Grade Marina Industry Intelligence</p>
            </div>
          </div>
        `,
      });


      res.json({ 
        success: true, 
        message: `Test email sent to ${testEmail}`,
        result: result.data 
      });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      
      // Check for Resend-specific errors
      if (error.message?.includes('not connected')) {
        return res.status(503).json({ 
          error: "Resend integration not configured. Please set up the Resend connection in Replit." 
        });
      }
      
      res.status(500).json({ 
        error: "Failed to send test email",
        details: error.message 
      });
    }
  });

  // ============ USER TAG LIBRARY API ============
  
  // Get user's tag library
  app.get("/api/docket/tags", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const tags = await docketStorage.getUserTags(req.docketUser!.id, req.docketUser!.orgId);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching user tags:", error);
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  // Create a new tag
  app.post("/api/docket/tags", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const TagSchema = z.object({
        name: z.string().min(1, "Name is required").max(50, "Name too long"),
        description: z.string().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
      });

      const validated = TagSchema.parse(req.body);
      
      const tag = await docketStorage.createUserTag({
        ...validated,
        userId: req.docketUser!.id,
        orgId: req.docketUser!.orgId,
      });
      res.status(201).json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof Error && (error.message.includes("duplicate") || error.message.includes("unique"))) {
        return res.status(409).json({ error: "A tag with this name already exists" });
      }
      console.error("Error creating tag:", error);
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  // Update a tag
  app.patch("/api/docket/tags/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid tag ID" });
      }

      const TagUpdateSchema = z.object({
        name: z.string().min(1).max(50).optional(),
        description: z.string().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      });

      const validated = TagUpdateSchema.parse(req.body);
      
      const tag = await docketStorage.updateUserTag(id, req.docketUser!.id, req.docketUser!.orgId, validated);
      if (!tag) {
        return res.status(404).json({ error: "Tag not found" });
      }
      res.json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating tag:", error);
      res.status(500).json({ error: "Failed to update tag" });
    }
  });

  // Delete a tag
  app.delete("/api/docket/tags/:id", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid tag ID" });
      }

      const deleted = await docketStorage.deleteUserTag(id, req.docketUser!.id, req.docketUser!.orgId);
      if (!deleted) {
        return res.status(404).json({ error: "Tag not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tag:", error);
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // ============ ARTICLE TAG ASSIGNMENTS API ============

  // Get tags assigned to an article
  app.get("/api/docket/articles/:articleId/tags", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      if (isNaN(articleId)) {
        return res.status(400).json({ error: "Invalid article ID" });
      }

      const assignments = await docketStorage.getArticleTagAssignments(articleId, req.docketUser!.id, req.docketUser!.orgId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching article tags:", error);
      res.status(500).json({ error: "Failed to fetch article tags" });
    }
  });

  // Assign a tag to an article
  app.post("/api/docket/articles/:articleId/tags", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      if (isNaN(articleId)) {
        return res.status(400).json({ error: "Invalid article ID" });
      }

      const AssignmentSchema = z.object({
        tagId: z.number().int().positive(),
        confidence: z.number().int().min(0).max(100).optional(),
      });

      const validated = AssignmentSchema.parse(req.body);
      
      const assignment = await docketStorage.assignTagToArticle({
        articleId,
        tagId: validated.tagId,
        userId: req.docketUser!.id,
        orgId: req.docketUser!.orgId,
        confidence: validated.confidence,
      });
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof Error && (error.message.includes("duplicate") || error.message.includes("unique"))) {
        return res.status(409).json({ error: "This tag is already assigned to this article" });
      }
      console.error("Error assigning tag:", error);
      res.status(500).json({ error: "Failed to assign tag" });
    }
  });

  // Remove a tag from an article
  app.delete("/api/docket/articles/:articleId/tags/:tagId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      const tagId = parseInt(req.params.tagId);
      if (isNaN(articleId) || isNaN(tagId)) {
        return res.status(400).json({ error: "Invalid article or tag ID" });
      }

      const removed = await docketStorage.removeTagFromArticle(articleId, tagId, req.docketUser!.id, req.docketUser!.orgId);
      if (!removed) {
        return res.status(404).json({ error: "Tag assignment not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing tag:", error);
      res.status(500).json({ error: "Failed to remove tag" });
    }
  });

  // Get articles with a specific tag
  app.get("/api/docket/tags/:tagId/articles", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const tagId = parseInt(req.params.tagId);
      if (isNaN(tagId)) {
        return res.status(400).json({ error: "Invalid tag ID" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const articles = await docketStorage.getTaggedArticles(tagId, req.docketUser!.id, req.docketUser!.orgId, limit);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching tagged articles:", error);
      res.status(500).json({ error: "Failed to fetch tagged articles" });
    }
  });

  // ============ ARTICLE FEEDBACK API ============

  // Get feedback for an article
  app.get("/api/docket/articles/:articleId/feedback", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      if (isNaN(articleId)) {
        return res.status(400).json({ error: "Invalid article ID" });
      }

      const feedback = await docketStorage.getArticleFeedback(articleId, req.docketUser!.id, req.docketUser!.orgId);
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching article feedback:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  // Submit feedback for an article (irrelevant, duplicate, etc.)
  app.post("/api/docket/articles/:articleId/feedback", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      if (isNaN(articleId)) {
        return res.status(400).json({ error: "Invalid article ID" });
      }

      const FeedbackSchema = z.object({
        feedbackType: z.enum(["irrelevant", "duplicate", "low_quality", "wrong_category", "spam", "helpful"]),
        reason: z.string().optional(),
        suggestedCategory: z.string().optional(),
        duplicateOfArticleId: z.number().int().positive().optional(),
      });

      const validated = FeedbackSchema.parse(req.body);
      
      const feedback = await docketStorage.createArticleFeedback({
        articleId,
        userId: req.docketUser!.id,
        orgId: req.docketUser!.orgId,
        ...validated,
      });
      res.status(201).json(feedback);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof Error && (error.message.includes("duplicate") || error.message.includes("unique"))) {
        return res.status(409).json({ error: "You have already submitted this type of feedback for this article" });
      }
      console.error("Error submitting feedback:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // Get feedback statistics
  app.get("/api/docket/feedback/stats", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const stats = await docketStorage.getFeedbackStats(req.docketUser!.id, req.docketUser!.orgId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching feedback stats:", error);
      res.status(500).json({ error: "Failed to fetch feedback stats" });
    }
  });

  // ============ ENHANCED AI TRAINING ANALYTICS ============

  // Get comprehensive training analytics
  app.get("/api/docket/training/analytics", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const allFeedback = await db
        .select()
        .from(articleFeedback)
        .where(eq(articleFeedback.orgId, req.docketUser!.orgId));

      const allArticles = await db
        .select({
          id: articles.id,
          category: articles.category,
          categories: articles.categories,
          manuallyReviewed: articles.manuallyReviewed,
          originalCategory: articles.originalCategory,
          aiConfidence: articles.aiConfidence,
          createdAt: articles.createdAt,
        })
        .from(articles)
        .where(eq(articles.isRemoved, false))
        .orderBy(desc(articles.createdAt))
        .limit(1000);

      // Feedback breakdown by type
      const feedbackByType: Record<string, number> = {};
      allFeedback.forEach(f => {
        feedbackByType[f.feedbackType] = (feedbackByType[f.feedbackType] || 0) + 1;
      });

      // Category distribution
      const categoryDistribution: Record<string, number> = {};
      allArticles.forEach(a => {
        const cat = a.category || 'Uncategorized';
        categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
      });

      // Articles with corrections (for accuracy tracking)
      const correctedArticles = allArticles.filter(a => 
        a.manuallyReviewed && a.originalCategory && a.category !== a.originalCategory
      );

      // Category accuracy analysis
      const categoryAccuracy: Record<string, { total: number; correct: number; accuracy: number }> = {};
      allArticles.filter(a => a.manuallyReviewed).forEach(a => {
        const originalCat = a.originalCategory || 'Unknown';
        if (!categoryAccuracy[originalCat]) {
          categoryAccuracy[originalCat] = { total: 0, correct: 0, accuracy: 0 };
        }
        categoryAccuracy[originalCat].total++;
        if (a.category === a.originalCategory) {
          categoryAccuracy[originalCat].correct++;
        }
      });
      
      Object.keys(categoryAccuracy).forEach(cat => {
        const data = categoryAccuracy[cat];
        data.accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
      });

      // Confidence distribution
      const confidenceRanges = {
        low: allArticles.filter(a => (a.aiConfidence || 0) < 0.5).length,
        medium: allArticles.filter(a => (a.aiConfidence || 0) >= 0.5 && (a.aiConfidence || 0) < 0.8).length,
        high: allArticles.filter(a => (a.aiConfidence || 0) >= 0.8).length,
      };

      // Feedback trends (last 30 days by week)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentFeedback = allFeedback.filter(f => new Date(f.createdAt) >= thirtyDaysAgo);
      
      const weeklyFeedback: { week: string; count: number; helpful: number; negative: number }[] = [];
      for (let i = 0; i < 4; i++) {
        const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const weekData = recentFeedback.filter(f => {
          const fDate = new Date(f.createdAt);
          return fDate >= weekStart && fDate < weekEnd;
        });
        weeklyFeedback.unshift({
          week: `Week ${4 - i}`,
          count: weekData.length,
          helpful: weekData.filter(f => f.feedbackType === 'helpful').length,
          negative: weekData.filter(f => ['irrelevant', 'spam', 'low_quality'].includes(f.feedbackType)).length,
        });
      }

      // Model refinement readiness
      const unprocessedFeedback = await docketStorage.getUnprocessedFeedback(1000);
      const refinementThreshold = 50;
      const refinementReady = unprocessedFeedback.length >= refinementThreshold;

      res.json({
        totalArticles: allArticles.length,
        totalFeedback: allFeedback.length,
        manuallyReviewedCount: allArticles.filter(a => a.manuallyReviewed).length,
        correctedCategoriesCount: correctedArticles.length,
        feedbackByType,
        categoryDistribution,
        categoryAccuracy,
        confidenceRanges,
        weeklyFeedback,
        modelRefinement: {
          unprocessedFeedbackCount: unprocessedFeedback.length,
          threshold: refinementThreshold,
          readyForRefinement: refinementReady,
          estimatedAccuracyImprovement: Math.min(5, unprocessedFeedback.length * 0.1).toFixed(1),
        },
        generatedAt: new Date(),
      });
    } catch (error) {
      console.error("Error fetching training analytics:", error);
      res.status(500).json({ error: "Failed to fetch training analytics" });
    }
  });

  // Get articles pending review (low confidence or flagged)
  app.get("/api/docket/training/review-queue", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const filter = req.query.filter as string || 'all';

      let query = db
        .select({
          id: articles.id,
          title: articles.title,
          category: articles.category,
          categories: articles.categories,
          aiConfidence: articles.aiConfidence,
          source: articles.source,
          publishedAt: articles.publishedAt,
          createdAt: articles.createdAt,
        })
        .from(articles)
        .where(and(
          eq(articles.isRemoved, false),
          eq(articles.manuallyReviewed, false)
        ));

      let result;
      if (filter === 'low_confidence') {
        result = await db
          .select({
            id: articles.id,
            title: articles.title,
            category: articles.category,
            categories: articles.categories,
            aiConfidence: articles.aiConfidence,
            source: articles.source,
            publishedAt: articles.publishedAt,
            createdAt: articles.createdAt,
          })
          .from(articles)
          .where(and(
            eq(articles.isRemoved, false),
            eq(articles.manuallyReviewed, false),
            sql`${articles.aiConfidence} < 0.6`
          ))
          .orderBy(sql`${articles.aiConfidence} ASC NULLS FIRST`)
          .limit(limit);
      } else if (filter === 'flagged') {
        const flaggedIds = await db
          .selectDistinct({ articleId: articleFeedback.articleId })
          .from(articleFeedback)
          .where(inArray(articleFeedback.feedbackType, ['wrong_category', 'low_quality', 'spam']));
        
        if (flaggedIds.length > 0) {
          result = await db
            .select({
              id: articles.id,
              title: articles.title,
              category: articles.category,
              categories: articles.categories,
              aiConfidence: articles.aiConfidence,
              source: articles.source,
              publishedAt: articles.publishedAt,
              createdAt: articles.createdAt,
            })
            .from(articles)
            .where(and(
              eq(articles.isRemoved, false),
              inArray(articles.id, flaggedIds.map(f => f.articleId))
            ))
            .orderBy(desc(articles.createdAt))
            .limit(limit);
        } else {
          result = [];
        }
      } else {
        result = await db
          .select({
            id: articles.id,
            title: articles.title,
            category: articles.category,
            categories: articles.categories,
            aiConfidence: articles.aiConfidence,
            source: articles.source,
            publishedAt: articles.publishedAt,
            createdAt: articles.createdAt,
          })
          .from(articles)
          .where(and(
            eq(articles.isRemoved, false),
            eq(articles.manuallyReviewed, false)
          ))
          .orderBy(sql`${articles.aiConfidence} ASC NULLS FIRST`)
          .limit(limit);
      }

      res.json({
        articles: result,
        filter,
        count: result.length,
      });
    } catch (error) {
      console.error("Error fetching review queue:", error);
      res.status(500).json({ error: "Failed to fetch review queue" });
    }
  });

  // Trigger model refinement (batch process feedback)
  app.post("/api/docket/training/trigger-refinement", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const unprocessedFeedback = await docketStorage.getUnprocessedFeedback(500);
      
      if (unprocessedFeedback.length === 0) {
        return res.json({
          success: true,
          message: "No unprocessed feedback to refine",
          processedCount: 0,
        });
      }

      // Process feedback - mark as processed and update article metadata
      let processedCount = 0;
      const feedbackSummary: Record<string, number> = {};

      for (const feedback of unprocessedFeedback) {
        try {
          // Update article based on feedback type
          if (feedback.feedbackType === 'helpful') {
            // Increase confidence for helpful articles
            const article = await docketStorage.getArticle(feedback.articleId);
            if (article) {
              const newConfidence = Math.min(1, (article.aiConfidence || 0.5) + 0.1);
              await db.update(articles)
                .set({ aiConfidence: newConfidence })
                .where(eq(articles.id, feedback.articleId));
            }
          } else if (['irrelevant', 'spam', 'low_quality'].includes(feedback.feedbackType)) {
            // Decrease confidence for negative feedback
            const article = await docketStorage.getArticle(feedback.articleId);
            if (article) {
              const newConfidence = Math.max(0, (article.aiConfidence || 0.5) - 0.15);
              await db.update(articles)
                .set({ aiConfidence: newConfidence })
                .where(eq(articles.id, feedback.articleId));
            }
          }

          await docketStorage.markFeedbackProcessed(feedback.id);
          processedCount++;
          feedbackSummary[feedback.feedbackType] = (feedbackSummary[feedback.feedbackType] || 0) + 1;
        } catch (err) {
          console.error(`Error processing feedback ${feedback.id}:`, err);
        }
      }

      res.json({
        success: true,
        message: `Processed ${processedCount} feedback items`,
        processedCount,
        feedbackSummary,
        refinedAt: new Date(),
      });
    } catch (error) {
      console.error("Error triggering model refinement:", error);
      res.status(500).json({ error: "Failed to trigger model refinement" });
    }
  });

  // Bulk review articles (mark multiple as reviewed with category)
  app.post("/api/docket/training/bulk-review", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const BulkReviewSchema = z.object({
        articleIds: z.array(z.number().int().positive()).min(1).max(50),
        category: z.string().min(1),
        action: z.enum(['approve', 'correct']),
      });

      const { articleIds, category, action } = BulkReviewSchema.parse(req.body);

      let updatedCount = 0;
      for (const articleId of articleIds) {
        try {
          const article = await docketStorage.getArticle(articleId);
          if (article) {
            const updateData: any = {
              manuallyReviewed: true,
              category: category,
              categories: [category],
            };
            
            if (action === 'correct') {
              updateData.originalCategory = article.category || article.categories?.[0] || '';
            }
            
            // Increase confidence for approved articles
            if (action === 'approve') {
              updateData.aiConfidence = Math.min(1, (article.aiConfidence || 0.5) + 0.2);
            }

            await docketStorage.updateArticle(articleId, updateData);
            updatedCount++;
          }
        } catch (err) {
          console.error(`Error updating article ${articleId}:`, err);
        }
      }

      res.json({
        success: true,
        message: `Updated ${updatedCount} of ${articleIds.length} articles`,
        updatedCount,
        requestedCount: articleIds.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error in bulk review:", error);
      res.status(500).json({ error: "Failed to bulk review articles" });
    }
  });

  // Get category suggestions based on training data
  app.get("/api/docket/training/category-suggestions", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      // Get all unique categories from manually reviewed articles
      const reviewedArticles = await docketStorage.getManuallyReviewedArticles();
      
      const categoryCounts: Record<string, number> = {};
      reviewedArticles.forEach(article => {
        const cat = article.category || article.categories?.[0];
        if (cat) {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      });

      // Get predefined categories
      const defaultCategories = [
        'M&A Deals', 'Industry News', 'Market Analysis', 'Regulatory',
        'Operations', 'Technology', 'People & Leadership', 'Sustainability',
        'Finance', 'Real Estate'
      ];

      // Merge with user-trained categories
      const allCategories = [...new Set([
        ...defaultCategories,
        ...Object.keys(categoryCounts)
      ])];

      const suggestions = allCategories.map(cat => ({
        category: cat,
        usageCount: categoryCounts[cat] || 0,
        isDefault: defaultCategories.includes(cat),
      })).sort((a, b) => b.usageCount - a.usageCount);

      res.json({
        categories: suggestions,
        totalReviewedArticles: reviewedArticles.length,
      });
    } catch (error) {
      console.error("Error fetching category suggestions:", error);
      res.status(500).json({ error: "Failed to fetch category suggestions" });
    }
  });

  // ============ AI ADAPTIVE SCORING API ============
  
  // Get AI training analytics dashboard data
  app.get("/api/docket/ai/analytics", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { getTrainingAnalytics, initializeDefaultKeywords } = await import("./services/adaptive-scoring");
      const orgId = req.docketUser!.orgId;
      
      // Initialize default keywords if this is a new org
      await initializeDefaultKeywords(orgId);
      
      const analytics = await getTrainingAnalytics(orgId);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching AI analytics:", error);
      res.status(500).json({ error: "Failed to fetch AI analytics" });
    }
  });

  // Get keyword weights
  app.get("/api/docket/ai/keywords", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { getKeywordWeights, initializeDefaultKeywords } = await import("./services/adaptive-scoring");
      const orgId = req.docketUser!.orgId;
      
      await initializeDefaultKeywords(orgId);
      const keywords = await getKeywordWeights(orgId);
      res.json(keywords);
    } catch (error) {
      console.error("Error fetching keywords:", error);
      res.status(500).json({ error: "Failed to fetch keywords" });
    }
  });

  // Add custom keyword
  app.post("/api/docket/ai/keywords", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const KeywordSchema = z.object({
        keyword: z.string().min(1).max(100),
        weight: z.number().int().min(1).max(20),
        category: z.enum(["marina", "investment", "macro", "operational", "regulatory", "negative", "custom"]),
      });

      const { keyword, weight, category } = KeywordSchema.parse(req.body);
      const { addCustomKeyword } = await import("./services/adaptive-scoring");
      
      await addCustomKeyword(req.docketUser!.orgId, keyword, weight, category);
      res.status(201).json({ success: true, keyword, weight, category });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error adding keyword:", error);
      res.status(500).json({ error: "Failed to add keyword" });
    }
  });

  // Update keyword weight
  app.patch("/api/docket/ai/keywords/:keywordId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const keywordId = parseInt(req.params.keywordId);
      const UpdateSchema = z.object({
        weight: z.number().int().min(1).max(20),
      });

      const { weight } = UpdateSchema.parse(req.body);
      const { updateKeywordWeight } = await import("./services/adaptive-scoring");
      
      await updateKeywordWeight(req.docketUser!.orgId, keywordId, weight);
      res.json({ success: true, keywordId, weight });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating keyword:", error);
      res.status(500).json({ error: "Failed to update keyword" });
    }
  });

  // Delete keyword
  app.delete("/api/docket/ai/keywords/:keywordId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const keywordId = parseInt(req.params.keywordId);
      const { deleteKeyword } = await import("./services/adaptive-scoring");
      
      await deleteKeyword(req.docketUser!.orgId, keywordId);
      res.json({ success: true, keywordId });
    } catch (error) {
      console.error("Error deleting keyword:", error);
      res.status(500).json({ error: "Failed to delete keyword" });
    }
  });

  // Get source adjustments
  app.get("/api/docket/ai/sources", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { getSourceAdjustments } = await import("./services/adaptive-scoring");
      const sources = await getSourceAdjustments(req.docketUser!.orgId);
      res.json(sources);
    } catch (error) {
      console.error("Error fetching source adjustments:", error);
      res.status(500).json({ error: "Failed to fetch source adjustments" });
    }
  });

  // Get learning rules
  app.get("/api/docket/ai/rules", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const { getLearningRules } = await import("./services/adaptive-scoring");
      const rules = await getLearningRules(req.docketUser!.orgId);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching learning rules:", error);
      res.status(500).json({ error: "Failed to fetch learning rules" });
    }
  });

  // Add learning rule
  app.post("/api/docket/ai/rules", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const RuleSchema = z.object({
        ruleType: z.enum(["include", "exclude", "boost", "penalize"]),
        pattern: z.string().min(1).max(200),
        patternType: z.enum(["keyword", "regex", "source", "category"]),
        scoreAdjustment: z.number().int().min(-50).max(50),
      });

      const { ruleType, pattern, patternType, scoreAdjustment } = RuleSchema.parse(req.body);
      const { addLearningRule } = await import("./services/adaptive-scoring");
      
      await addLearningRule(req.docketUser!.orgId, ruleType, pattern, patternType, scoreAdjustment);
      res.status(201).json({ success: true, ruleType, pattern, patternType, scoreAdjustment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error adding rule:", error);
      res.status(500).json({ error: "Failed to add rule" });
    }
  });

  // Delete learning rule
  app.delete("/api/docket/ai/rules/:ruleId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const ruleId = parseInt(req.params.ruleId);
      const { deleteLearningRule } = await import("./services/adaptive-scoring");
      
      await deleteLearningRule(req.docketUser!.orgId, ruleId);
      res.json({ success: true, ruleId });
    } catch (error) {
      console.error("Error deleting rule:", error);
      res.status(500).json({ error: "Failed to delete rule" });
    }
  });

  // Score an article with adaptive scoring (for testing/preview)
  app.post("/api/docket/ai/score-preview", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const ScoreSchema = z.object({
        title: z.string().min(1),
        content: z.string().default(""),
        source: z.string().default("Unknown"),
      });

      const { title, content, source } = ScoreSchema.parse(req.body);
      const { scoreArticleAdaptive } = await import("./services/adaptive-scoring");
      
      const result = await scoreArticleAdaptive(title, content, source, req.docketUser!.orgId);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error scoring article:", error);
      res.status(500).json({ error: "Failed to score article" });
    }
  });

  // Process feedback with adaptive learning (called after feedback submission)
  app.post("/api/docket/ai/process-feedback/:feedbackId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const feedbackId = parseInt(req.params.feedbackId);
      const ProcessSchema = z.object({
        articleId: z.number().int().positive(),
        feedbackType: z.enum(["irrelevant", "duplicate", "low_quality", "wrong_category", "spam", "helpful"]),
      });

      const { articleId, feedbackType } = ProcessSchema.parse(req.body);
      const { processFeedbackForLearning } = await import("./services/adaptive-scoring");
      
      const result = await processFeedbackForLearning(
        feedbackId,
        articleId,
        feedbackType,
        req.docketUser!.orgId
      );
      
      res.json({ success: true, ...result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error processing feedback:", error);
      res.status(500).json({ error: "Failed to process feedback" });
    }
  });

  // ============================================================================
  // USER BOOKMARKS ENDPOINTS
  // ============================================================================

  // Get user's bookmarked articles
  app.get("/api/docket/bookmarks", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const bookmarks = await docketStorage.getUserBookmarks(
        req.docketUser!.id,
        req.docketUser!.orgId
      );
      res.json(bookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ error: "Failed to fetch bookmarks" });
    }
  });

  // Bookmark an article
  app.post("/api/docket/bookmarks/:articleId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      const NotesSchema = z.object({
        notes: z.string().optional(),
      });
      const { notes } = NotesSchema.parse(req.body || {});

      const existing = await docketStorage.getBookmark(req.docketUser!.id, articleId);
      if (existing) {
        return res.status(400).json({ error: "Article already bookmarked" });
      }

      const bookmark = await docketStorage.createBookmark({
        userId: req.docketUser!.id,
        orgId: req.docketUser!.orgId,
        articleId,
        notes: notes || null,
      });
      res.status(201).json(bookmark);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating bookmark:", error);
      res.status(500).json({ error: "Failed to create bookmark" });
    }
  });

  // Update bookmark notes
  app.patch("/api/docket/bookmarks/:articleId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      const NotesSchema = z.object({
        notes: z.string(),
      });
      const { notes } = NotesSchema.parse(req.body);

      const updated = await docketStorage.updateBookmarkNotes(req.docketUser!.id, articleId, notes);
      if (!updated) {
        return res.status(404).json({ error: "Bookmark not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating bookmark:", error);
      res.status(500).json({ error: "Failed to update bookmark" });
    }
  });

  // Remove bookmark
  app.delete("/api/docket/bookmarks/:articleId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      const deleted = await docketStorage.deleteBookmark(req.docketUser!.id, articleId);
      if (!deleted) {
        return res.status(404).json({ error: "Bookmark not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      res.status(500).json({ error: "Failed to delete bookmark" });
    }
  });

  // Check if article is bookmarked
  app.get("/api/docket/bookmarks/:articleId/status", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      const isBookmarked = await docketStorage.isArticleBookmarked(req.docketUser!.id, articleId);
      res.json({ isBookmarked });
    } catch (error) {
      console.error("Error checking bookmark status:", error);
      res.status(500).json({ error: "Failed to check bookmark status" });
    }
  });

  // ============================================================================
  // USER READING LIST ENDPOINTS
  // ============================================================================

  // Get user's reading list
  app.get("/api/docket/reading-list", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const status = req.query.status as string | undefined;
      const readingList = await docketStorage.getUserReadingList(
        req.docketUser!.id,
        req.docketUser!.orgId,
        status
      );
      res.json(readingList);
    } catch (error) {
      console.error("Error fetching reading list:", error);
      res.status(500).json({ error: "Failed to fetch reading list" });
    }
  });

  // Add article to reading list
  app.post("/api/docket/reading-list/:articleId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      const AddSchema = z.object({
        priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
        notes: z.string().optional(),
      });
      const { priority, notes } = AddSchema.parse(req.body || {});

      const existing = await docketStorage.getReadingListItem(req.docketUser!.id, articleId);
      if (existing) {
        return res.status(400).json({ error: "Article already in reading list" });
      }

      const item = await docketStorage.addToReadingList({
        userId: req.docketUser!.id,
        orgId: req.docketUser!.orgId,
        articleId,
        priority,
        status: "unread",
        notes: notes || null,
      });
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error adding to reading list:", error);
      res.status(500).json({ error: "Failed to add to reading list" });
    }
  });

  // Update reading list item
  app.patch("/api/docket/reading-list/:articleId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      const UpdateSchema = z.object({
        priority: z.enum(["low", "medium", "high"]).optional(),
        status: z.enum(["unread", "reading", "completed"]).optional(),
        notes: z.string().optional(),
      });
      const updates = UpdateSchema.parse(req.body);

      const updated = await docketStorage.updateReadingListItem(req.docketUser!.id, articleId, updates);
      if (!updated) {
        return res.status(404).json({ error: "Reading list item not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating reading list item:", error);
      res.status(500).json({ error: "Failed to update reading list item" });
    }
  });

  // Remove from reading list
  app.delete("/api/docket/reading-list/:articleId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      const deleted = await docketStorage.removeFromReadingList(req.docketUser!.id, articleId);
      if (!deleted) {
        return res.status(404).json({ error: "Reading list item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from reading list:", error);
      res.status(500).json({ error: "Failed to remove from reading list" });
    }
  });

  // Check if article is in reading list
  app.get("/api/docket/reading-list/:articleId/status", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      const item = await docketStorage.getReadingListItem(req.docketUser!.id, articleId);
      res.json({ 
        inReadingList: !!item,
        item: item || null
      });
    } catch (error) {
      console.error("Error checking reading list status:", error);
      res.status(500).json({ error: "Failed to check reading list status" });
    }
  });

  // ============================================================================
  // M&A ALERTS ENDPOINTS
  // ============================================================================

  // Get user's M&A alerts
  app.get("/api/docket/alerts", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const alerts = await docketStorage.getMaAlerts(
        req.docketUser!.id,
        req.docketUser!.orgId
      );
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching M&A alerts:", error);
      res.status(500).json({ error: "Failed to fetch M&A alerts" });
    }
  });

  // Create M&A alert
  app.post("/api/docket/alerts", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const AlertSchema = z.object({
        name: z.string().min(1).max(100),
        keywords: z.array(z.string()).min(1),
        dealTypes: z.array(z.string()).optional(),
        regions: z.array(z.string()).optional(),
        emailEnabled: z.boolean().optional().default(true),
        pushEnabled: z.boolean().optional().default(false),
        frequency: z.enum(["immediate", "daily", "weekly"]).optional().default("daily"),
      });
      const data = AlertSchema.parse(req.body);

      const alert = await docketStorage.createMaAlert({
        ...data,
        userId: req.docketUser!.id,
        orgId: req.docketUser!.orgId,
        isActive: true,
      });
      res.status(201).json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating M&A alert:", error);
      res.status(500).json({ error: "Failed to create M&A alert" });
    }
  });

  // Get single M&A alert
  app.get("/api/docket/alerts/:alertId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const alert = await docketStorage.getMaAlertById(
        req.params.alertId,
        req.docketUser!.id,
        req.docketUser!.orgId
      );
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Error fetching M&A alert:", error);
      res.status(500).json({ error: "Failed to fetch M&A alert" });
    }
  });

  // Update M&A alert
  app.patch("/api/docket/alerts/:alertId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const UpdateSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        keywords: z.array(z.string()).min(1).optional(),
        dealTypes: z.array(z.string()).optional(),
        regions: z.array(z.string()).optional(),
        emailEnabled: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        frequency: z.enum(["immediate", "daily", "weekly"]).optional(),
        isActive: z.boolean().optional(),
      });
      const updates = UpdateSchema.parse(req.body);

      const updated = await docketStorage.updateMaAlert(
        req.params.alertId,
        req.docketUser!.id,
        req.docketUser!.orgId,
        updates
      );
      if (!updated) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating M&A alert:", error);
      res.status(500).json({ error: "Failed to update M&A alert" });
    }
  });

  // Delete M&A alert
  app.delete("/api/docket/alerts/:alertId", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const deleted = await docketStorage.deleteMaAlert(
        req.params.alertId,
        req.docketUser!.id,
        req.docketUser!.orgId
      );
      if (!deleted) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting M&A alert:", error);
      res.status(500).json({ error: "Failed to delete M&A alert" });
    }
  });

  // Get unnotified matches for an alert
  app.get("/api/docket/alerts/:alertId/matches", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const alert = await docketStorage.getMaAlertById(
        req.params.alertId,
        req.docketUser!.id,
        req.docketUser!.orgId
      );
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }

      const matches = await docketStorage.getUnnotifiedAlertMatches(req.params.alertId);
      res.json(matches);
    } catch (error) {
      console.error("Error fetching alert matches:", error);
      res.status(500).json({ error: "Failed to fetch alert matches" });
    }
  });

  // ============================================================================
  // DIGEST PREFERENCES ENDPOINTS
  // ============================================================================

  // Get user's digest preferences
  app.get("/api/docket/digest", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const prefs = await docketStorage.getDigestPreferences(
        req.docketUser!.id,
        req.docketUser!.orgId
      );
      res.json(prefs || null);
    } catch (error) {
      console.error("Error fetching digest preferences:", error);
      res.status(500).json({ error: "Failed to fetch digest preferences" });
    }
  });

  // Create or update digest preferences
  app.post("/api/docket/digest", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const DigestSchema = z.object({
        emailAddress: z.string().email(),
        frequency: z.enum(["daily", "weekly"]).optional().default("daily"),
        dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]).optional(),
        timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).optional().default("09:00"),
        timezone: z.string().optional().default("America/New_York"),
        categories: z.array(z.string()).optional(),
        includeDeals: z.boolean().optional().default(true),
        includeSummaries: z.boolean().optional().default(true),
        includeTrending: z.boolean().optional().default(true),
        maxArticles: z.number().int().min(1).max(50).optional().default(10),
        enabled: z.boolean().optional().default(true),
      });
      const data = DigestSchema.parse(req.body);

      const existing = await docketStorage.getDigestPreferences(
        req.docketUser!.id,
        req.docketUser!.orgId
      );

      let result;
      if (existing) {
        result = await docketStorage.updateDigestPreferences(
          req.docketUser!.id,
          req.docketUser!.orgId,
          data
        );
      } else {
        result = await docketStorage.createDigestPreferences({
          ...data,
          userId: req.docketUser!.id,
          orgId: req.docketUser!.orgId,
        });
      }
      res.status(existing ? 200 : 201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error saving digest preferences:", error);
      res.status(500).json({ error: "Failed to save digest preferences" });
    }
  });

  // Update digest preferences
  app.patch("/api/docket/digest", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const UpdateSchema = z.object({
        emailAddress: z.string().email().optional(),
        frequency: z.enum(["daily", "weekly"]).optional(),
        dayOfWeek: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]).optional(),
        timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        timezone: z.string().optional(),
        categories: z.array(z.string()).optional(),
        includeDeals: z.boolean().optional(),
        includeSummaries: z.boolean().optional(),
        includeTrending: z.boolean().optional(),
        maxArticles: z.number().int().min(1).max(50).optional(),
        enabled: z.boolean().optional(),
      });
      const updates = UpdateSchema.parse(req.body);

      const updated = await docketStorage.updateDigestPreferences(
        req.docketUser!.id,
        req.docketUser!.orgId,
        updates
      );
      if (!updated) {
        return res.status(404).json({ error: "Digest preferences not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating digest preferences:", error);
      res.status(500).json({ error: "Failed to update digest preferences" });
    }
  });

  // Delete digest preferences
  app.delete("/api/docket/digest", requireMarinaMatchAuth, async (req: DocketRequest, res) => {
    try {
      const deleted = await docketStorage.deleteDigestPreferences(
        req.docketUser!.id,
        req.docketUser!.orgId
      );
      if (!deleted) {
        return res.status(404).json({ error: "Digest preferences not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting digest preferences:", error);
      res.status(500).json({ error: "Failed to delete digest preferences" });
    }
  });

  // Docket routes registered successfully
}
