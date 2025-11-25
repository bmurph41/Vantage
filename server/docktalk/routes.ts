import type { Express } from "express";
import { createServer, type Server } from "http";
import { IStorage } from "./storage";
import { z } from "zod";
import { startCronJobs, triggerManualFetch } from "./cron-jobs";
import bcrypt from "bcrypt";
import { initializeWebSocket } from "./websocket";
import type { User } from "@shared/docktalk-schema";
import { requireMarinaMatchAuth, type DockTalkRequest } from "./middleware/auth";
import {
  generateCategorySummary,
  generateAllCategorySummaries,
  getLatestSummaries,
  editSummary
} from "./services/category-summary-service";
import { getUncachableResendClient } from "./lib/resend-client";

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
  'Business Planning'
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

export async function registerDockTalkRoutes(app: Express, dockTalkStorage: IStorage): Promise<void> {
  // Note: DockTalk routes are integrated into MarinaMatch
  // Authentication is handled by MarinaMatch's central auth system
  // All routes use requireMarinaMatchAuth middleware

  // Legacy Standalone Authentication Endpoints - DISABLED in integrated version
  // These endpoints are not used when DockTalk is integrated into MarinaMatch
  /* app.post("/api/docktalk/auth/signup", async (req, res) => {
    try {
      const { username, password } = SignupSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await dockTalkStorage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Create user with default viewer role and free tier
      const newUser = await dockTalkStorage.createUser({
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

  app.post("/api/docktalk/auth/login", async (req, res) => {
    try {
      const { username, password } = LoginSchema.parse(req.body);
      
      // Get user
      const user = await dockTalkStorage.getUserByUsername(username);
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
      await dockTalkStorage.updateUserLastLogin(user.id);
      
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

  app.post("/api/docktalk/auth/logout", (req, res) => {
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

  app.get("/api/docktalk/auth/me", (req, res) => {
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

  app.get("/api/docktalk/saved-filters", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      if (!req.dockTalkUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const filters = await dockTalkStorage.getSavedFilters(req.dockTalkUser.id, req.dockTalkUser.orgId);
      res.json(filters);
    } catch (error) {
      console.error("Error fetching saved filters:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docktalk/saved-filters", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      if (!req.dockTalkUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const { name, criteria } = SavedFilterSchema.parse(req.body);
      const filter = await dockTalkStorage.createSavedFilter({
        userId: req.dockTalkUser.id,
        orgId: req.dockTalkUser.orgId,
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

  app.patch("/api/docktalk/saved-filters/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      if (!req.dockTalkUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const id = req.params.id;
      const body = SavedFilterSchema.partial().parse(req.body);
      const filter = await dockTalkStorage.updateSavedFilter(id, req.dockTalkUser.id, req.dockTalkUser.orgId, body);
      
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

  app.delete("/api/docktalk/saved-filters/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      if (!req.dockTalkUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const id = req.params.id;
      const deleted = await dockTalkStorage.deleteSavedFilter(id, req.dockTalkUser.id, req.dockTalkUser.orgId);
      
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
  app.get("/api/docktalk/articles", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const filters = ArticleQuerySchema.parse(req.query);
      const userId = req.dockTalkUser?.id || null;
      const articles = await dockTalkStorage.getArticles(userId, {
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

  app.get("/api/docktalk/articles/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const article = await dockTalkStorage.getArticleById(id);
      
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      res.json(article);
    } catch (error) {
      console.error("Error fetching article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/docktalk/articles/:id/bookmark", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isBookmarked } = BookmarkSchema.parse(req.body);
      
      await dockTalkStorage.updateBookmarkStatus(id, isBookmarked);
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
  app.get("/api/docktalk/sentiment/trends", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const trends = await dockTalkStorage.getSentimentTrends(days);
      
      res.json(trends);
    } catch (error) {
      console.error("Error fetching sentiment trends:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Analytics endpoints
  app.get("/api/docktalk/analytics/stats", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const stats = await dockTalkStorage.getSystemStats();
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

  app.get("/api/docktalk/analytics/trending", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const trending = await dockTalkStorage.getTrendingTopics();
      res.json(trending);
    } catch (error) {
      console.error("Error fetching trending topics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docktalk/analytics/categories", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const categories = await dockTalkStorage.getCategoryDistribution();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Returns all valid categories (for category editing UI)
  app.get("/api/docktalk/categories/all", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      res.json(VALID_CATEGORIES);
    } catch (error) {
      console.error("Error fetching all categories:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docktalk/analytics/sources", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      // Get sources from actual articles (dynamically updates as articles are added)
      const sources = await dockTalkStorage.getSourceDistribution();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching sources:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // RSS Sources endpoints
  app.get("/api/docktalk/rss-sources", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const sources = await dockTalkStorage.getRssSources();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching RSS sources:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Manual RSS fetch trigger
  app.post("/api/docktalk/rss-sources/fetch", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
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
  app.get("/api/docktalk/admin/rss-sources", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const sources = await dockTalkStorage.getAllRssSources();
      res.json(sources);
    } catch (error) {
      console.error("Error fetching RSS sources:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docktalk/rss-sources", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const RssSourceSchema = z.object({
        name: z.string().min(1, "Name is required"),
        sourceType: z.enum(["rss", "web_scrape"]).optional(),
        url: z.string().url("Invalid URL format"),
        minRelevanceScore: z.number().min(0).max(100).default(50),
        customKeywords: z.array(z.string()).default([])
      });

      const validated = RssSourceSchema.parse(req.body);
      
      const newSource = await dockTalkStorage.createRssSource(validated);
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

  app.patch("/api/docktalk/rss-sources/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
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
      const updated = await dockTalkStorage.updateRssSource(id, validated);
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

  app.delete("/api/docktalk/rss-sources/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await dockTalkStorage.deleteRssSource(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting RSS source:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Preview RSS feed or web scrape before adding
  app.post("/api/docktalk/rss-sources/preview", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
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
  app.post("/api/docktalk/fetch", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const count = await triggerManualFetch();
      res.json({ message: `Successfully fetched ${count} new articles` });
    } catch (error) {
      console.error("Error during manual fetch:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Historical backfill endpoint (admin only)
  app.post("/api/docktalk/admin/backfill", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Admin role check
    if (req.dockTalkUser?.role !== 'admin') {
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

  // Manual summary generation (admin only)
  app.post("/api/docktalk/admin/generate-summaries", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Admin role check
    if (req.dockTalkUser?.role !== 'admin') {
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
  app.post("/api/docktalk/articles/recategorize-batch", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const { categorizeAndTag } = await import("./services/categorizer");
      const articles = await dockTalkStorage.getArticles(null, { limit: 1000, offset: 0 });
      
      let processedCount = 0;
      const batchSize = 3; // Process in smaller batches to respect OpenAI rate limits
      
      for (let i = 0; i < articles.length; i += batchSize) {
        const batch = articles.slice(i, i + batchSize);
        
        // Process articles sequentially to avoid rate limits
        for (const article of batch) {
          try {
            const { categories, tags } = await categorizeAndTag(article.title, article.content || "");
            await dockTalkStorage.updateArticleCategory(article.id, categories, tags);
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
  app.post("/api/docktalk/deals/backfill-from-articles", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const { enrichArticle } = await import("./services/ai-enrichment");
      
      // Parse request body for date range (default to 90 days)
      const daysBack = parseInt(req.body.daysBack as string) || 90;
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - daysBack);
      
      
      // Fetch articles from the specified date range
      const articles = await dockTalkStorage.getArticles(null, { 
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
                  
                  const entityId = await dockTalkStorage.getOrCreateEntity(
                    entity.name,
                    normalizedType,
                    { description: entity.context || undefined }
                  );
                  
                  // Link entity to article (linkArticleToEntity handles duplicates internally)
                  await dockTalkStorage.linkArticleToEntity(
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
              const existingDeals = await dockTalkStorage.getDealsByArticle(article.id);
              if (existingDeals.length > 0) {
              } else {
                // Find or create entity IDs for buyer/seller
                let buyerEntityId: number | undefined;
                let sellerEntityId: number | undefined;

                if (dealInfo.buyer) {
                  const buyerResults = await dockTalkStorage.searchEntities(dealInfo.buyer, 'company');
                  if (buyerResults.length > 0) {
                    buyerEntityId = buyerResults[0].id;
                  } else {
                    buyerEntityId = await dockTalkStorage.getOrCreateEntity(
                      dealInfo.buyer,
                      'company',
                      { description: `Deal participant identified in article: ${article.title}` }
                    );
                  }
                }

                if (dealInfo.seller) {
                  const sellerResults = await dockTalkStorage.searchEntities(dealInfo.seller, 'company');
                  if (sellerResults.length > 0) {
                    sellerEntityId = sellerResults[0].id;
                  } else {
                    sellerEntityId = await dockTalkStorage.getOrCreateEntity(
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

                await dockTalkStorage.createDeal({
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
  app.patch("/api/docktalk/articles/:id/category", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const CategoryUpdateSchema = z.object({
        categories: z.array(z.enum(VALID_CATEGORIES))
      });

      const id = parseInt(req.params.id);
      
      // Log incoming request for debugging
      
      const { categories } = CategoryUpdateSchema.parse(req.body);
      
      const article = await dockTalkStorage.getArticleById(id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      
      await dockTalkStorage.updateArticleCategoryManual(id, categories, article.category || "");
      
      // Fetch updated article to return complete data
      const updated = await dockTalkStorage.getArticleById(id);
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
  app.patch("/api/docktalk/articles/:id/region", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const RegionUpdateSchema = z.object({
        region: z.enum(["US/Domestic", "International"]).nullable()
      });

      const id = parseInt(req.params.id);
      const { region } = RegionUpdateSchema.parse(req.body);
      
      const article = await dockTalkStorage.getArticleById(id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      await dockTalkStorage.updateArticle(id, { region });
      
      // Fetch updated article to return complete data
      const updated = await dockTalkStorage.getArticleById(id);
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
  app.patch("/api/docktalk/articles/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
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
      
      const article = await dockTalkStorage.getArticleById(id);
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
      
      const updated = await dockTalkStorage.updateArticle(id, updateData);
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
  app.delete("/api/docktalk/articles/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const article = await dockTalkStorage.getArticleById(id);
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      await dockTalkStorage.deleteArticle(id);
      res.json({ success: true, message: "Article deleted successfully" });
    } catch (error) {
      console.error("Error deleting article:", error);
      res.status(500).json({ error: "Failed to delete article" });
    }
  });

  // Auto-recategorize using updated AI logic
  app.post("/api/docktalk/articles/:id/recategorize", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const { categorizeAndTag } = await import("./services/categorizer");
      const id = parseInt(req.params.id);
      const article = await dockTalkStorage.getArticleById(id);
      
      if (!article) {
        return res.status(404).json({ error: "Article not found" });
      }
      
      const { categories, tags } = await categorizeAndTag(article.title, article.content || "");
      await dockTalkStorage.updateArticleCategory(id, categories, tags);
      
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
  app.get("/api/docktalk/training/export", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const manuallyReviewedArticles = await dockTalkStorage.getManuallyReviewedArticles();
      
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
  app.post("/api/docktalk/articles/:id/remove", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const RemovalSchema = z.object({
        reason: z.string().min(10, "Removal reason must be at least 10 characters"),
      });

      const id = parseInt(req.params.id);
      const { reason } = RemovalSchema.parse(req.body);
      
      // Get userId from authenticated session (guaranteed by requireMarinaMatchAuth middleware)
      const userId = req.dockTalkUser!.id;

      await dockTalkStorage.removeArticle(id, reason, userId);
      
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
  app.get("/api/docktalk/articles/removal-patterns", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const patterns = await dockTalkStorage.getRemovalPatterns();
      res.json(patterns);
    } catch (error) {
      console.error("Error fetching removal patterns:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Entity Extraction & Tracking endpoints (Institutional Intelligence - Protected)
  app.get("/api/docktalk/entities", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
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
      
      const entities = await dockTalkStorage.getAllEntities(type, limit);
      res.json(entities);
    } catch (error) {
      console.error("Error fetching entities:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docktalk/entities/search", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
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
      
      const entities = await dockTalkStorage.searchEntities(query.trim(), type);
      res.json(entities);
    } catch (error) {
      console.error("Error searching entities:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docktalk/entities/:id/articles", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
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
      
      const articles = await dockTalkStorage.getArticlesByEntity(entityId, limit);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching articles for entity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docktalk/articles/:id/entities", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const articleId = parseInt(req.params.id, 10);
      
      if (isNaN(articleId) || articleId < 1) {
        return res.status(400).json({ error: "Invalid article ID" });
      }
      
      const entities = await dockTalkStorage.getEntitiesByArticle(articleId);
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

  app.get("/api/docktalk/watchlists", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const watchlists = await dockTalkStorage.getWatchlistsByUser(req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      res.json(watchlists);
    } catch (error) {
      console.error("Error fetching watchlists:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docktalk/watchlists", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const user = await dockTalkStorage.getUser(req.dockTalkUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = WatchlistSchema.parse(req.body);
      const watchlist = await dockTalkStorage.createWatchlist({
        ...data,
        userId: req.dockTalkUser!.id,
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

  app.get("/api/docktalk/watchlists/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const watchlist = await dockTalkStorage.getWatchlistById(req.params.id, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      if (!watchlist) {
        return res.status(404).json({ error: "Watchlist not found" });
      }

      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/docktalk/watchlists/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const data = WatchlistUpdateSchema.parse(req.body);
      const watchlist = await dockTalkStorage.updateWatchlist(req.params.id, req.dockTalkUser!.id, req.dockTalkUser!.orgId, data);

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

  app.delete("/api/docktalk/watchlists/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const deleted = await dockTalkStorage.deleteWatchlist(req.params.id, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      if (!deleted) {
        return res.status(404).json({ error: "Watchlist not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting watchlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docktalk/watchlists/:id/entities/:entityId", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const entityId = parseInt(req.params.entityId, 10);
      if (isNaN(entityId) || entityId < 1) {
        return res.status(400).json({ error: "Invalid entity ID" });
      }

      const added = await dockTalkStorage.addEntityToWatchlist(req.params.id, entityId, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      if (!added) {
        return res.status(404).json({ error: "Watchlist not found or entity already added" });
      }

      res.status(201).json({ success: true });
    } catch (error) {
      console.error("Error adding entity to watchlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/docktalk/watchlists/:id/entities/:entityId", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const entityId = parseInt(req.params.entityId, 10);
      if (isNaN(entityId) || entityId < 1) {
        return res.status(400).json({ error: "Invalid entity ID" });
      }

      const removed = await dockTalkStorage.removeEntityFromWatchlist(req.params.id, entityId, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      if (!removed) {
        return res.status(404).json({ error: "Watchlist or entity not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error removing entity from watchlist:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docktalk/watchlists/:id/entities", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const entities = await dockTalkStorage.getWatchlistEntities(req.params.id, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      res.json(entities);
    } catch (error) {
      console.error("Error fetching watchlist entities:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docktalk/watchlists/:id/articles", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

      const articles = await dockTalkStorage.getArticlesByWatchlist(req.params.id, req.dockTalkUser!.id, req.dockTalkUser!.orgId, limit, offset);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching watchlist articles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Entity endpoints
  app.get("/api/docktalk/entities/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const entity = await dockTalkStorage.getEntityById(id);
      
      if (!entity) {
        return res.status(404).json({ error: "Entity not found" });
      }

      res.json(entity);
    } catch (error) {
      console.error("Error fetching entity:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docktalk/entities/:id/analytics", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const analytics = await dockTalkStorage.getEntityAnalytics(id);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching entity analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docktalk/entities/:id/deals", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const role = req.query.role as 'buyer' | 'seller' | undefined;
      const deals = await dockTalkStorage.getDealsByEntity(id, role);

      // Batch fetch articles and entities
      const articleIds = Array.from(new Set(deals.map(d => d.articleId)));
      const entityIds = Array.from(new Set(deals.flatMap(d => [d.buyerEntityId, d.sellerEntityId].filter((eid): eid is number => eid !== null))));
      
      const [articlesMap, entitiesMap] = await Promise.all([
        dockTalkStorage.getArticlesByIds(articleIds).then(articles => 
          new Map(articles.map(a => [a.id, a]))
        ),
        dockTalkStorage.getEntitiesByIds(entityIds).then(entities => 
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

  app.get("/api/docktalk/entities/:id/articles", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const articles = await dockTalkStorage.getArticlesByEntity(id, limit);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching entity articles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Deal endpoints
  app.get("/api/docktalk/deals/analytics", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
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

      const analytics = await dockTalkStorage.getDealAnalytics(filters);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching deal analytics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docktalk/deals", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const params = DealQuerySchema.parse(req.query);
      
      const fromDate = params.fromDate ? new Date(params.fromDate) : undefined;
      const toDate = params.toDate ? new Date(params.toDate) : undefined;

      const deals = await dockTalkStorage.getDeals({
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
        dockTalkStorage.getArticlesByIds(articleIds).then(articles => 
          new Map(articles.map(a => [a.id, a]))
        ),
        dockTalkStorage.getEntitiesByIds(entityIds).then(entities => 
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

  app.get("/api/docktalk/deals/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const dealId = parseInt(req.params.id, 10);
      if (isNaN(dealId) || dealId < 1) {
        return res.status(400).json({ error: "Invalid deal ID" });
      }

      const deal = await dockTalkStorage.getDealById(dealId);
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

  app.patch("/api/docktalk/deals/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Role check for admin, analyst, or partner
    if (!['admin', 'analyst', 'partner'].includes(req.dockTalkUser!.role)) {
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

      const updated = await dockTalkStorage.updateDeal(dealId, updates);
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

  app.get("/api/docktalk/articles/:id/deals", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const articleId = parseInt(req.params.id, 10);
      if (isNaN(articleId) || articleId < 1) {
        return res.status(400).json({ error: "Invalid article ID" });
      }

      const deals = await dockTalkStorage.getDealsByArticle(articleId);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching deals for article:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Portfolio Companies Management
  const PortfolioCompanySchema = z.object({
    companyName: z.string().min(1),
    aliases: z.array(z.string()).optional(),
    sector: z.string().optional(),
    region: z.string().optional(),
    notes: z.string().optional(),
  });

  const PortfolioCompanyUpdateSchema = PortfolioCompanySchema.partial();

  app.get("/api/docktalk/portfolio-companies", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const companies = await dockTalkStorage.getPortfolioCompanies(req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      res.json(companies);
    } catch (error) {
      console.error("Error fetching portfolio companies:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docktalk/portfolio-companies", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const user = await dockTalkStorage.getUser(req.dockTalkUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = PortfolioCompanySchema.parse(req.body);
      const company = await dockTalkStorage.createPortfolioCompany({
        ...data,
        userId: req.dockTalkUser!.id,
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

  app.get("/api/docktalk/portfolio-companies/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const company = await dockTalkStorage.getPortfolioCompanyById(req.params.id, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      if (!company) {
        return res.status(404).json({ error: "Portfolio company not found" });
      }

      res.json(company);
    } catch (error) {
      console.error("Error fetching portfolio company:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/docktalk/portfolio-companies/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const data = PortfolioCompanyUpdateSchema.parse(req.body);
      const company = await dockTalkStorage.updatePortfolioCompany(req.params.id, req.dockTalkUser!.id, req.dockTalkUser!.orgId, data);

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

  app.delete("/api/docktalk/portfolio-companies/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const success = await dockTalkStorage.deletePortfolioCompany(req.params.id, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      if (!success) {
        return res.status(404).json({ error: "Portfolio company not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting portfolio company:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/docktalk/portfolio-companies/:id/articles", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const articles = await dockTalkStorage.getArticlesForPortfolioCompany(
        req.params.id,
        req.dockTalkUser!.id,
        req.dockTalkUser!.orgId,
        limit
      );

      res.json(articles);
    } catch (error) {
      console.error("Error fetching portfolio company articles:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Saved Searches Management
  const SavedSearchSchema = z.object({
    name: z.string().min(1),
    criteria: z.object({}).passthrough(),
    alertFrequency: z.enum(["none", "immediate", "daily", "weekly"]).default("none"),
  });

  const SavedSearchUpdateSchema = SavedSearchSchema.partial();

  app.get("/api/docktalk/saved-searches", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const searches = await dockTalkStorage.getSavedSearches(req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      res.json(searches);
    } catch (error) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/docktalk/saved-searches", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const user = await dockTalkStorage.getUser(req.dockTalkUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = SavedSearchSchema.parse(req.body);
      const search = await dockTalkStorage.createSavedSearch({
        ...data,
        userId: req.dockTalkUser!.id,
        orgId: user.orgId,
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

  app.get("/api/docktalk/saved-searches/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const search = await dockTalkStorage.getSavedSearchById(req.params.id, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      if (!search) {
        return res.status(404).json({ error: "Saved search not found" });
      }

      res.json(search);
    } catch (error) {
      console.error("Error fetching saved search:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/docktalk/saved-searches/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const data = SavedSearchUpdateSchema.parse(req.body);
      const search = await dockTalkStorage.updateSavedSearch(req.params.id, req.dockTalkUser!.id, req.dockTalkUser!.orgId, data);

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

  app.delete("/api/docktalk/saved-searches/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const success = await dockTalkStorage.deleteSavedSearch(req.params.id, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
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
  app.get("/api/docktalk/users", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Admin role check
    if (req.dockTalkUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      const users = await dockTalkStorage.getAllUsers();
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

  app.patch("/api/docktalk/users/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Admin role check
    if (req.dockTalkUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      const data = UserUpdateSchema.parse(req.body);
      const user = await dockTalkStorage.updateUser(req.params.id, data);
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

  app.delete("/api/docktalk/users/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Admin role check
    if (req.dockTalkUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      await dockTalkStorage.deactivateUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Current user endpoints
  app.get("/api/docktalk/user/current", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const user = await dockTalkStorage.getUser(req.dockTalkUser!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const prefs = await dockTalkStorage.getUserNotificationPreferences(user.id, user.orgId!);
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
    categories: z.array(z.enum(VALID_CATEGORIES)).min(1, "Select at least one category"),
    frequency: z.enum(["none", "immediate", "daily", "weekly"]),
    deliveryTime: z.string().optional(),
    timezone: z.string().default("America/New_York"),
    enabled: z.boolean().default(true),
  });

  app.patch("/api/docktalk/user/notification-preferences", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const user = await dockTalkStorage.getUser(req.dockTalkUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = NotificationPreferencesSchema.parse(req.body);
      
      // Check if preferences exist
      const existing = await dockTalkStorage.getUserNotificationPreferences(req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      
      let prefs;
      if (existing) {
        prefs = await dockTalkStorage.updateUserNotificationPreferences(req.dockTalkUser!.id, req.dockTalkUser!.orgId, {
          emailAddress: data.email,
          categories: data.categories,
          frequency: data.frequency,
          deliveryTime: data.deliveryTime || "09:00",
          timezone: data.timezone || "America/New_York",
          enabled: data.enabled,
        });
      } else {
        prefs = await dockTalkStorage.createUserNotificationPreferences({
          userId: req.dockTalkUser!.id,
          orgId: user.orgId,
          emailAddress: data.email,
          categories: data.categories,
          frequency: data.frequency,
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
  app.get("/api/docktalk/user/filter-preferences", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const prefs = await dockTalkStorage.getUserFilterPreferences(req.dockTalkUser!.id, req.dockTalkUser!.orgId);
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

  app.put("/api/docktalk/user/filter-preferences", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const user = await dockTalkStorage.getUser(req.dockTalkUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = FilterPreferencesSchema.parse(req.body);
      const prefs = await dockTalkStorage.saveUserFilterPreferences(req.dockTalkUser!.id, user.orgId, data);
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
  app.get("/api/docktalk/user-preferences", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const user = await dockTalkStorage.getUser(req.dockTalkUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const notificationPrefs = await dockTalkStorage.getUserNotificationPreferences(user.id, user.orgId);
      const filterPrefs = await dockTalkStorage.getUserFilterPreferences(user.id, user.orgId);

      // Combine preferences into unified format expected by frontend
      res.json({
        id: user.id,
        emailNotifications: notificationPrefs?.enabled ?? false,
        alertFrequency: notificationPrefs?.frequency ?? 'daily',
        subscriptionTier: user.subscriptionTier || 'free',
        categoriesFilter: filterPrefs?.categories || notificationPrefs?.categories || [],
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
  });

  app.patch("/api/docktalk/user-preferences", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const user = await dockTalkStorage.getUser(req.dockTalkUser!.id);
      if (!user || !user.orgId) {
        return res.status(403).json({ error: "User organization not found" });
      }

      const data = UserPreferencesUpdateSchema.parse(req.body);
      
      // Update notification preferences if relevant fields are provided
      if (data.emailNotifications !== undefined || data.alertFrequency !== undefined) {
        const existing = await dockTalkStorage.getUserNotificationPreferences(user.id, user.orgId);
        
        if (existing) {
          await dockTalkStorage.updateUserNotificationPreferences(user.id, user.orgId, {
            enabled: data.emailNotifications ?? existing.enabled,
            frequency: data.alertFrequency ?? existing.frequency,
          });
        } else {
          // Create new preferences with user's email
          await dockTalkStorage.createUserNotificationPreferences({
            userId: user.id,
            orgId: user.orgId,
            emailAddress: user.email || `${user.username}@docktalk.local`,
            categories: data.categoriesFilter || [],
            frequency: data.alertFrequency || 'daily',
            enabled: data.emailNotifications ?? true,
          });
        }
      }

      // Update filter preferences if categories are provided
      if (data.categoriesFilter !== undefined) {
        await dockTalkStorage.saveUserFilterPreferences(user.id, user.orgId, {
          categories: data.categoriesFilter,
        });
      }

      // Return updated preferences
      const notificationPrefs = await dockTalkStorage.getUserNotificationPreferences(user.id, user.orgId);
      const filterPrefs = await dockTalkStorage.getUserFilterPreferences(user.id, user.orgId);

      res.json({
        id: user.id,
        emailNotifications: notificationPrefs?.enabled ?? false,
        alertFrequency: notificationPrefs?.frequency ?? 'daily',
        subscriptionTier: user.subscriptionTier || 'free',
        categoriesFilter: filterPrefs?.categories || notificationPrefs?.categories || [],
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

  app.get("/api/docktalk/notifications", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const notifications = await dockTalkStorage.getNotificationsByUser(req.dockTalkUser!.id, req.dockTalkUser!.orgId, 50);
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

  app.get("/api/docktalk/summaries", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Pro tier check
    if (req.dockTalkUser?.subscriptionTier !== 'pro' && req.dockTalkUser?.role !== 'admin') {
      return res.status(403).json({ 
        error: "Pro subscription required",
        message: "This feature requires a Pro subscription. Upgrade to access AI-powered category summaries and advanced analytics.",
        currentTier: req.dockTalkUser?.subscriptionTier,
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

  app.post("/api/docktalk/summaries/generate", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Role check for admin or analyst
    if (!['admin', 'analyst'].includes(req.dockTalkUser!.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        required: ['admin', 'analyst'],
        current: req.dockTalkUser!.role
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

  app.post("/api/docktalk/summaries/generate-all", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Role check for admin or analyst
    if (!['admin', 'analyst'].includes(req.dockTalkUser!.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        required: ['admin', 'analyst'],
        current: req.dockTalkUser!.role
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

  app.patch("/api/docktalk/summaries/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Role check for admin, analyst, or partner
    if (!['admin', 'analyst', 'partner'].includes(req.dockTalkUser!.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        required: ['admin', 'analyst', 'partner'],
        current: req.dockTalkUser!.role
      });
    }
    
    try {
      const summaryId = parseInt(req.params.id);
      if (isNaN(summaryId)) {
        return res.status(400).json({ error: "Invalid summary ID" });
      }

      const { summaryText, editReason } = SummaryEditSchema.parse(req.body);
      const updated = await editSummary(summaryId, req.dockTalkUser!.id, summaryText, editReason);
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
  app.post("/api/docktalk/test-digest", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Admin role check
    if (req.dockTalkUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      
      // Get user's notification preferences for email address
      const prefs = await dockTalkStorage.getUserNotificationPreferences(req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      const testEmail = prefs?.emailAddress || req.body.email;
      
      if (!testEmail) {
        return res.status(400).json({ 
          error: "No email address found. Please configure notification preferences first." 
        });
      }

      // Fetch sample articles from the last week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const sampleArticles = await dockTalkStorage.getArticles(req.dockTalkUser!.id, {
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
        subject: `DockTalk Daily Digest Preview - ${new Date().toLocaleDateString()} (${sampleArticles.length} Articles)`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">⚓ DockTalk 2.0</h1>
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
              <p style="margin: 10px 0 0 0;">Manage your notification preferences in DockTalk settings</p>
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

  // Test email notification endpoint (admin only)
  app.post("/api/docktalk/test-email", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    // Admin role check
    if (req.dockTalkUser?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    try {
      const { client, fromEmail } = await getUncachableResendClient();
      
      // Get user's notification preferences for email address
      const prefs = await dockTalkStorage.getUserNotificationPreferences(req.dockTalkUser!.id, req.dockTalkUser!.orgId);
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
        subject: "DockTalk 2.0 - Test Email Notification",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">⚓ DockTalk 2.0</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Marina Industry Intelligence</p>
            </div>
            
            <div style="padding: 30px 20px;">
              <h2 style="color: #003366; margin-top: 0;">Email Notification Test Successful! ✅</h2>
              
              <p style="color: #333; line-height: 1.6;">
                This is a test email to confirm that DockTalk's email notification system is working correctly.
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
              <p style="margin: 0;">DockTalk 2.0 - Institutional-Grade Marina Industry Intelligence</p>
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
  app.get("/api/docktalk/tags", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const tags = await dockTalkStorage.getUserTags(req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching user tags:", error);
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  // Create a new tag
  app.post("/api/docktalk/tags", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const TagSchema = z.object({
        name: z.string().min(1, "Name is required").max(50, "Name too long"),
        description: z.string().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
      });

      const validated = TagSchema.parse(req.body);
      
      const tag = await dockTalkStorage.createUserTag({
        ...validated,
        userId: req.dockTalkUser!.id,
        orgId: req.dockTalkUser!.orgId,
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
  app.patch("/api/docktalk/tags/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
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
      
      const tag = await dockTalkStorage.updateUserTag(id, req.dockTalkUser!.id, req.dockTalkUser!.orgId, validated);
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
  app.delete("/api/docktalk/tags/:id", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid tag ID" });
      }

      const deleted = await dockTalkStorage.deleteUserTag(id, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
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
  app.get("/api/docktalk/articles/:articleId/tags", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      if (isNaN(articleId)) {
        return res.status(400).json({ error: "Invalid article ID" });
      }

      const assignments = await dockTalkStorage.getArticleTagAssignments(articleId, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching article tags:", error);
      res.status(500).json({ error: "Failed to fetch article tags" });
    }
  });

  // Assign a tag to an article
  app.post("/api/docktalk/articles/:articleId/tags", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
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
      
      const assignment = await dockTalkStorage.assignTagToArticle({
        articleId,
        tagId: validated.tagId,
        userId: req.dockTalkUser!.id,
        orgId: req.dockTalkUser!.orgId,
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
  app.delete("/api/docktalk/articles/:articleId/tags/:tagId", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      const tagId = parseInt(req.params.tagId);
      if (isNaN(articleId) || isNaN(tagId)) {
        return res.status(400).json({ error: "Invalid article or tag ID" });
      }

      const removed = await dockTalkStorage.removeTagFromArticle(articleId, tagId, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
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
  app.get("/api/docktalk/tags/:tagId/articles", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const tagId = parseInt(req.params.tagId);
      if (isNaN(tagId)) {
        return res.status(400).json({ error: "Invalid tag ID" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const articles = await dockTalkStorage.getTaggedArticles(tagId, req.dockTalkUser!.id, req.dockTalkUser!.orgId, limit);
      res.json(articles);
    } catch (error) {
      console.error("Error fetching tagged articles:", error);
      res.status(500).json({ error: "Failed to fetch tagged articles" });
    }
  });

  // ============ ARTICLE FEEDBACK API ============

  // Get feedback for an article
  app.get("/api/docktalk/articles/:articleId/feedback", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const articleId = parseInt(req.params.articleId);
      if (isNaN(articleId)) {
        return res.status(400).json({ error: "Invalid article ID" });
      }

      const feedback = await dockTalkStorage.getArticleFeedback(articleId, req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching article feedback:", error);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  // Submit feedback for an article (irrelevant, duplicate, etc.)
  app.post("/api/docktalk/articles/:articleId/feedback", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
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
      
      const feedback = await dockTalkStorage.createArticleFeedback({
        articleId,
        userId: req.dockTalkUser!.id,
        orgId: req.dockTalkUser!.orgId,
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
  app.get("/api/docktalk/feedback/stats", requireMarinaMatchAuth, async (req: DockTalkRequest, res) => {
    try {
      const stats = await dockTalkStorage.getFeedbackStats(req.dockTalkUser!.id, req.dockTalkUser!.orgId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching feedback stats:", error);
      res.status(500).json({ error: "Failed to fetch feedback stats" });
    }
  });

  // DockTalk routes registered successfully
}
