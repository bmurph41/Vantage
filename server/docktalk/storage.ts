import { users, articles, rssSources, systemStats, savedFilters, savedSearches, userArticleAnnotations, portfolioCompanies, notifications, articleFingerprints, articleDuplicates, userNotificationPreferences, articleRemovalPatterns, userFilterPreferences, entities, articleEntities, watchlists, watchlistEntities, organizationFeatures, type User, type InsertUser, type Article, type InsertArticle, type RssSource, type InsertRssSource, type SystemStats, type SavedFilter, type InsertSavedFilter, type SavedSearch, type InsertSavedSearch, type UserArticleAnnotation, type InsertUserArticleAnnotation, type PortfolioCompany, type InsertPortfolioCompany, type Notification, type InsertNotification, type UserNotificationPreferences, type InsertUserNotificationPreferences, type ArticleRemovalPattern, type InsertArticleRemovalPattern, type UserFilterPreferences, type InsertUserFilterPreferences, type Entity, type InsertEntity, type ArticleEntity, type InsertArticleEntity, type Watchlist, type InsertWatchlist, type WatchlistEntity, type InsertWatchlistEntity } from "@shared/docktalk-schema";
import { docktalkDeals, type DocktalkDeal, type InsertDocktalkDeal } from "@shared/schema";
import { db } from "./db";
import { eq, desc, ilike, and, or, gte, lte, sql, count, inArray } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Article methods
  /**
   * CURRENT BEHAVIOR: Articles are globally accessible to all authenticated users.
   * This is acceptable for the PE firm use case where all users within a firm 
   * should see the same marina industry intelligence.
   * 
   * FUTURE ENHANCEMENT: userId parameter is included for future tenant partitioning
   * or user-specific visibility (e.g., private annotations, user-scoped feeds).
   * 
   * TODO: When implementing user-scoped visibility:
   * 1. Add tenantId column to articles table
   * 2. Implement join to userArticleAnnotations for user-specific filtering
   * 3. Add conditional where clause: if (userId) { conditions.push(...) }
   * 
   * For now, userId is accepted but not used in query logic.
   */
  getArticles(userId: string | null, filters: {
    search?: string;
    category?: string;
    categories?: string[];
    source?: string;
    sources?: string[];
    fromDate?: Date;
    toDate?: Date;
    minRelevance?: number;
    sentiment?: string;
    dealsOnly?: boolean;
    dealType?: string;
    geography?: string;
    region?: string;
    regions?: string[];
    limit?: number;
    offset?: number;
    sortBy?: 'newest' | 'relevance';
  }): Promise<Article[]>;
  getArticleById(id: number): Promise<Article | undefined>;
  createArticle(article: InsertArticle): Promise<Article>;
  updateArticle(id: number, article: Partial<InsertArticle>): Promise<Article>;
  deleteArticle(id: number): Promise<void>;
  getArticleByUrl(url: string): Promise<Article | undefined>;
  updateBookmarkStatus(id: number, isBookmarked: boolean): Promise<void>;
  updateArticleCategory(id: number, categories: string[], tags: string[]): Promise<void>;
  getDealArticles(filters: {
    dealType?: string;
    fromDate?: Date;
    toDate?: Date;
    geography?: string;
    limit?: number;
    offset?: number;
  }): Promise<Article[]>;
  getSentimentTrends(days: number): Promise<{ date: string; positive: number; neutral: number; negative: number }[]>;
  deleteOldArticles(beforeDate: Date): Promise<number>;
  
  // RSS Source methods
  getRssSources(): Promise<RssSource[]>;
  getAllRssSources(): Promise<RssSource[]>;
  createRssSource(source: InsertRssSource): Promise<RssSource>;
  updateRssSource(id: number, updates: Partial<InsertRssSource>): Promise<RssSource>;
  deleteRssSource(id: number): Promise<void>;
  updateRssSourceLastFetched(id: number): Promise<void>;
  updateRssSourceLastScrapedAt(id: number): Promise<void>;
  recordRssSourceSuccess(id: number): Promise<void>;
  recordRssSourceFailure(id: number): Promise<void>;
  
  // Category correction methods
  updateArticleCategoryManual(id: number, categories: string[], originalCategory: string): Promise<void>;
  getManuallyReviewedArticles(): Promise<Article[]>;
  
  // Article removal methods
  removeArticle(id: number, reason: string, userId: string): Promise<void>;
  getRemovalPatterns(): Promise<any[]>;
  checkArticleAgainstRemovalPatterns(title: string, content: string): Promise<{ shouldRemove: boolean; matchedPattern?: any }>;
  
  // Analytics methods
  getSystemStats(): Promise<SystemStats | undefined>;
  updateSystemStats(stats: Partial<SystemStats>): Promise<void>;
  getTrendingTopics(): Promise<{ topic: string; count: number; growth: number }[]>;
  getCategoryDistribution(): Promise<{ category: string; count: number }[]>;
  getSourceDistribution(): Promise<{ source: string; count: number; type: 'rss' | 'scraped' }[]>;
  
  // Saved Filters methods
  getSavedFilters(userId: string, orgId: string): Promise<SavedFilter[]>;
  createSavedFilter(filter: InsertSavedFilter): Promise<SavedFilter>;
  getSavedFilterById(id: string, userId: string, orgId: string): Promise<SavedFilter | undefined>;
  updateSavedFilter(id: string, userId: string, orgId: string, filter: Partial<InsertSavedFilter>): Promise<SavedFilter | null>;
  deleteSavedFilter(id: string, userId: string, orgId: string): Promise<boolean>;
  
  // Portfolio Companies methods
  getPortfolioCompanies(userId: string, orgId: string): Promise<PortfolioCompany[]>;
  createPortfolioCompany(company: InsertPortfolioCompany): Promise<PortfolioCompany>;
  getPortfolioCompanyById(id: string, userId: string, orgId: string): Promise<PortfolioCompany | undefined>;
  updatePortfolioCompany(id: string, userId: string, orgId: string, company: Partial<InsertPortfolioCompany>): Promise<PortfolioCompany | null>;
  deletePortfolioCompany(id: string, userId: string, orgId: string): Promise<boolean>;
  getArticlesForPortfolioCompany(companyId: string, userId: string, orgId: string, limit?: number): Promise<Article[]>;
  
  // Saved Searches methods
  getSavedSearches(userId: string, orgId: string): Promise<SavedSearch[]>;
  createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  getSavedSearchById(id: string, userId: string, orgId: string): Promise<SavedSearch | undefined>;
  updateSavedSearch(id: string, userId: string, orgId: string, search: Partial<InsertSavedSearch>): Promise<SavedSearch | null>;
  deleteSavedSearch(id: string, userId: string, orgId: string): Promise<boolean>;
  updateLastAlertSent(id: string): Promise<void>;
  getActiveSearchesForAlerts(frequency: string): Promise<SavedSearch[]>;
  
  // User methods
  updateUserLastLogin(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  deactivateUser(id: string): Promise<void>;
  
  // MarinaMatch Integration methods
  getOrganizationFeature(orgId: string): Promise<{ id: string; orgId: string; feature: string; tier: string; isActive: boolean; activatedAt: Date; expiresAt: Date | null } | undefined>;
  createOrganizationFeature(data: { orgId: string; feature?: string; tier?: string; isActive?: boolean }): Promise<{ id: string; orgId: string; feature: string; tier: string; isActive: boolean; activatedAt: Date; expiresAt: Date | null }>;
  getDockTalkUserByMarinaUserId(marinaUserId: string): Promise<User | undefined>;
  createDockTalkUserFromMarinaUser(data: { marinaUserId: string; orgId: string; email: string | null; role: string; subscriptionTier: string; isActive: boolean }): Promise<User>;
  
  // Notification methods
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string, orgId: string, limit?: number): Promise<Notification[]>;
  getNotificationsBySavedSearch(savedSearchId: string, limit?: number): Promise<Notification[]>;
  
  // Deduplication methods
  getRecentArticles(days?: number): Promise<Article[]>;
  createArticleFingerprint(fingerprint: { articleId: number; normalizedTitle: string; fingerprintHash: string; titleTrigrams: string }): Promise<void>;
  getArticleFingerprintByArticleId(articleId: number): Promise<{ articleId: number; normalizedTitle: string; fingerprintHash: string; titleTrigrams: string } | undefined>;
  findSimilarArticlesByFingerprint(fingerprintHash: string, excludeArticleId?: number): Promise<Article[]>;
  findSimilarArticlesByTitle(normalizedTitle: string, titleTrigrams: string, excludeArticleId?: number): Promise<Article[]>;
  createArticleDuplicate(duplicate: { canonicalArticleId: number; duplicateTitle: string; duplicateUrl: string; duplicateSource: string; duplicatePublishedAt: Date | null; duplicateContent: string | null; similarityScore: number; suppressionReason: string }): Promise<void>;
  getDuplicatesByCanonicalId(canonicalArticleId: number): Promise<Array<{ id: number; duplicateTitle: string; duplicateUrl: string; duplicateSource: string; similarityScore: number; createdAt: Date }>>;
  
  getUserNotificationPreferences(userId: string, orgId: string): Promise<UserNotificationPreferences | undefined>;
  createUserNotificationPreferences(prefs: InsertUserNotificationPreferences): Promise<UserNotificationPreferences>;
  updateUserNotificationPreferences(userId: string, orgId: string, prefs: Partial<InsertUserNotificationPreferences>): Promise<UserNotificationPreferences | undefined>;
  
  getUserFilterPreferences(userId: string, orgId: string): Promise<UserFilterPreferences | undefined>;
  saveUserFilterPreferences(userId: string, orgId: string, preferences: InsertUserFilterPreferences): Promise<UserFilterPreferences>;
  
  // Entity methods
  getEntityById(id: number): Promise<Entity | undefined>;
  getEntitiesByIds(ids: number[]): Promise<Entity[]>;
  getArticlesByIds(ids: number[]): Promise<Article[]>;
  getOrCreateEntity(name: string, type: 'company' | 'person' | 'location' | 'asset', metadata?: { description?: string; industry?: string; location?: string; aliases?: string[] }): Promise<number>;
  linkArticleToEntity(articleId: number, entityId: number, mentionCount?: number, confidence?: number, context?: string): Promise<void>;
  getEntitiesByArticle(articleId: number): Promise<Array<{ id: number; name: string; type: string; mentionCount: number; confidence: number }>>;
  getArticlesByEntity(entityId: number, limit?: number): Promise<Article[]>;
  searchEntities(query: string, type?: string): Promise<Array<{ id: number; name: string; type: string; description: string | null; articleCount: number }>>;
  getAllEntities(type?: string, limit?: number): Promise<Array<{ id: number; name: string; type: string; description: string | null; articleCount: number }>>;
  getEntityAnalytics(entityId: number): Promise<{
    totalDeals: number;
    dealsByType: Array<{ type: string; count: number }>;
    dealsByRole: { asBuyer: number; asSeller: number };
    avgDealSize: string | null;
    recentActivity: number;
    geographicFocus: Array<{ region: string; count: number }>;
  }>;
  getDealsByEntity(entityId: number, role?: 'buyer' | 'seller'): Promise<DocktalkDeal[]>;
  
  // Watchlist methods
  createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  getWatchlistsByUser(userId: string, orgId: string): Promise<Watchlist[]>;
  getWatchlistById(id: string, userId: string, orgId: string): Promise<Watchlist | undefined>;
  updateWatchlist(id: string, userId: string, orgId: string, updates: Partial<InsertWatchlist>): Promise<Watchlist | undefined>;
  deleteWatchlist(id: string, userId: string, orgId: string): Promise<boolean>;
  addEntityToWatchlist(watchlistId: string, entityId: number, userId: string, orgId: string): Promise<boolean>;
  removeEntityFromWatchlist(watchlistId: string, entityId: number, userId: string, orgId: string): Promise<boolean>;
  getWatchlistEntities(watchlistId: string, userId: string, orgId: string): Promise<Entity[]>;
  getArticlesByWatchlist(watchlistId: string, userId: string, orgId: string, limit?: number, offset?: number): Promise<Article[]>;
  
  // Deal methods
  createDeal(deal: InsertDocktalkDeal): Promise<DocktalkDeal>;
  getDeals(filters: {
    transactionType?: string;
    dealStatus?: string;
    entityId?: number;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<DocktalkDeal[]>;
  getDealById(id: number): Promise<DocktalkDeal | undefined>;
  updateDeal(id: number, updates: Partial<InsertDocktalkDeal>): Promise<DocktalkDeal | undefined>;
  getDealsByArticle(articleId: number): Promise<DocktalkDeal[]>;
  getDealAnalytics(filters?: {
    transactionType?: string;
    dealStatus?: string;
    region?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{
    totalDeals: number;
    dealsByType: Array<{ type: string; count: number }>;
    dealsByStatus: Array<{ status: string; count: number }>;
    dealsByRegion: Array<{ region: string; count: number }>;
    monthlyDeals: Array<{ month: string; count: number }>;
    recentDealsCount: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getArticles(userId: string | null, filters: {
    search?: string;
    category?: string;
    categories?: string[];
    source?: string;
    sources?: string[];
    fromDate?: Date;
    toDate?: Date;
    minRelevance?: number;
    sentiment?: string;
    dealsOnly?: boolean;
    dealType?: string;
    geography?: string;
    region?: string;
    regions?: string[];
    limit?: number;
    offset?: number;
    sortBy?: 'newest' | 'relevance';
  }): Promise<Article[]> {
    const conditions = [];
    
    // NOTE: userId is currently not used in filtering.
    // All articles are globally accessible to all authenticated users.
    // This is intentional for the current PE firm use case.
    // See interface documentation above for future enhancement plan.
    
    // Filter out removed articles by default
    conditions.push(eq(articles.isRemoved, false));
    
    if (filters.search) {
      conditions.push(ilike(articles.searchText, `%${filters.search}%`));
    }
    
    // Multi-category filtering with OR logic (array overlap)
    // Merge legacy single category with new categories array
    const categoryFilters: string[] = [];
    if (filters.categories && filters.categories.length > 0) {
      categoryFilters.push(...filters.categories);
    }
    if (filters.category && !categoryFilters.includes(filters.category)) {
      categoryFilters.push(filters.category);
    }
    
    if (categoryFilters.length > 0) {
      // Use PostgreSQL array overlap operator (&&) for OR logic
      // This checks if the article's categories array has ANY overlap with the filter array
      // Format as proper PostgreSQL array literal: ARRAY['value1', 'value2']
      const arrayLiteral = `ARRAY[${categoryFilters.map(c => `'${c.replace(/'/g, "''")}'`).join(', ')}]::text[]`;
      conditions.push(
        sql.raw(`categories && ${arrayLiteral}`)
      );
    }
    
    // Multi-source filtering with OR logic
    // Merge legacy single source with new sources array
    const sourceFilters: string[] = [];
    if (filters.sources && filters.sources.length > 0) {
      sourceFilters.push(...filters.sources);
    }
    if (filters.source && !sourceFilters.includes(filters.source)) {
      sourceFilters.push(filters.source);
    }
    
    if (sourceFilters.length > 0) {
      // Use Drizzle's inArray for SQL injection protection
      conditions.push(inArray(articles.source, sourceFilters));
    }
    if (filters.fromDate) {
      conditions.push(gte(articles.publishedAt, filters.fromDate));
    }
    if (filters.toDate) {
      conditions.push(lte(articles.publishedAt, filters.toDate));
    }
    if (filters.minRelevance) {
      conditions.push(gte(articles.relevanceScore, filters.minRelevance));
    }
    if (filters.sentiment) {
      conditions.push(eq(articles.sentiment, filters.sentiment));
    }
    if (filters.dealsOnly) {
      conditions.push(sql`${articles.dealMetadata}->>'isDeal' = 'true'`);
    }
    if (filters.dealType) {
      conditions.push(sql`${articles.dealMetadata}->>'dealType' = ${filters.dealType}`);
    }
    if (filters.geography) {
      conditions.push(sql`${articles.geography} @> ARRAY[${filters.geography}]::text[]`);
    }
    
    // Multi-region filtering with OR logic
    // Merge legacy single region with new regions array
    const regionFilters: string[] = [];
    if (filters.regions && filters.regions.length > 0) {
      regionFilters.push(...filters.regions);
    }
    if (filters.region && !regionFilters.includes(filters.region)) {
      regionFilters.push(filters.region);
    }
    
    if (regionFilters.length > 0) {
      // Use Drizzle's inArray for SQL injection protection (cast to supported enum values)
      conditions.push(inArray(articles.region, regionFilters as Array<"US/Domestic" | "International">));
    }

    const orderBy = filters.sortBy === 'relevance' 
      ? [desc(articles.relevanceScore), desc(articles.publishedAt)]
      : [desc(articles.publishedAt), desc(articles.relevanceScore)];

    return await db
      .select()
      .from(articles)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(...orderBy)
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  }

  async getArticleById(id: number): Promise<Article | undefined> {
    const [article] = await db.select().from(articles).where(eq(articles.id, id));
    return article || undefined;
  }

  async createArticle(article: InsertArticle): Promise<Article> {
    const [newArticle] = await db.insert(articles).values(article).returning();
    return newArticle;
  }

  async updateArticle(id: number, article: Partial<InsertArticle>): Promise<Article> {
    const [updatedArticle] = await db
      .update(articles)
      .set({ ...article, updatedAt: new Date() })
      .where(eq(articles.id, id))
      .returning();
    return updatedArticle;
  }

  async deleteArticle(id: number): Promise<void> {
    await db.delete(articles).where(eq(articles.id, id));
  }

  async getArticleByUrl(url: string): Promise<Article | undefined> {
    const [article] = await db.select().from(articles).where(eq(articles.url, url));
    return article || undefined;
  }

  async updateBookmarkStatus(id: number, isBookmarked: boolean): Promise<void> {
    await db.update(articles).set({ isBookmarked }).where(eq(articles.id, id));
  }

  async updateArticleCategory(id: number, categories: string[], tags: string[]): Promise<void> {
    await db.update(articles).set({ 
      categories,
      category: categories[0] || null,
      tags,
      updatedAt: new Date()
    }).where(eq(articles.id, id));
  }

  async getDealArticles(filters: {
    dealType?: string;
    fromDate?: Date;
    toDate?: Date;
    geography?: string;
    limit?: number;
    offset?: number;
  }): Promise<Article[]> {
    // Defensive clamping for institutional-grade safety
    const safeLimit = Math.max(1, Math.min(200, Math.floor(filters.limit || 50)));
    const safeOffset = Math.max(0, Math.floor(filters.offset || 0));
    
    const conditions = [sql`${articles.dealMetadata}->>'isDeal' = 'true'`];
    
    if (filters.dealType) {
      conditions.push(sql`${articles.dealMetadata}->>'dealType' = ${filters.dealType}`);
    }
    if (filters.fromDate) {
      conditions.push(gte(articles.publishedAt, filters.fromDate));
    }
    if (filters.toDate) {
      conditions.push(lte(articles.publishedAt, filters.toDate));
    }
    if (filters.geography) {
      conditions.push(sql`${articles.geography} @> ARRAY[${filters.geography}]::text[]`);
    }

    return await db
      .select()
      .from(articles)
      .where(and(...conditions))
      .orderBy(desc(articles.publishedAt))
      .limit(safeLimit)
      .offset(safeOffset);
  }

  async getSentimentTrends(days: number): Promise<{ date: string; positive: number; neutral: number; negative: number }[]> {
    // Clamp days to safe range (1-365)
    const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
    
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - safeDays);
    
    const result = await db
      .select({
        date: sql<string>`DATE(${articles.publishedAt} AT TIME ZONE 'UTC')`,
        positive: sql<number>`COUNT(*) FILTER (WHERE ${articles.sentiment} = 'positive')`,
        neutral: sql<number>`COUNT(*) FILTER (WHERE ${articles.sentiment} = 'neutral')`,
        negative: sql<number>`COUNT(*) FILTER (WHERE ${articles.sentiment} = 'negative')`
      })
      .from(articles)
      .where(gte(articles.publishedAt, daysAgo))
      .groupBy(sql`DATE(${articles.publishedAt} AT TIME ZONE 'UTC')`)
      .orderBy(sql`DATE(${articles.publishedAt} AT TIME ZONE 'UTC')`);

    return result;
  }

  async deleteOldArticles(beforeDate: Date): Promise<number> {
    // Delete articles older than the specified date, but preserve bookmarked articles
    const result = await db
      .delete(articles)
      .where(
        and(
          lte(articles.createdAt, beforeDate),
          eq(articles.isBookmarked, false)
        )
      );
    
    return result.rowCount || 0;
  }

  async getRssSources(): Promise<RssSource[]> {
    return await db.select().from(rssSources).where(eq(rssSources.isActive, true));
  }

  async getAllRssSources(): Promise<RssSource[]> {
    return await db.select().from(rssSources).orderBy(desc(rssSources.createdAt));
  }

  async createRssSource(source: InsertRssSource): Promise<RssSource> {
    const [newSource] = await db.insert(rssSources).values(source).returning();
    return newSource;
  }

  async updateRssSource(id: number, updates: Partial<InsertRssSource>): Promise<RssSource> {
    const [updated] = await db
      .update(rssSources)
      .set(updates)
      .where(eq(rssSources.id, id))
      .returning();
    return updated;
  }

  async deleteRssSource(id: number): Promise<void> {
    await db.delete(rssSources).where(eq(rssSources.id, id));
  }

  async updateRssSourceLastFetched(id: number): Promise<void> {
    await db.update(rssSources).set({ lastFetched: new Date() }).where(eq(rssSources.id, id));
  }

  async updateRssSourceLastScrapedAt(id: number): Promise<void> {
    await db.update(rssSources).set({ lastScrapedAt: new Date() }).where(eq(rssSources.id, id));
  }

  async recordRssSourceSuccess(id: number): Promise<void> {
    await db.update(rssSources).set({ 
      consecutiveFailures: 0,
      lastSuccessAt: new Date(),
      isActive: true
    }).where(eq(rssSources.id, id));
  }

  async recordRssSourceFailure(id: number): Promise<void> {
    const source = await db.query.rssSources.findFirst({
      where: eq(rssSources.id, id)
    });
    
    if (!source) return;
    
    const newFailureCount = (source.consecutiveFailures || 0) + 1;
    const shouldDisable = newFailureCount >= 3;
    
    await db.update(rssSources).set({ 
      consecutiveFailures: newFailureCount,
      lastFailureAt: new Date(),
      isActive: shouldDisable ? false : source.isActive
    }).where(eq(rssSources.id, id));
    
    if (shouldDisable) {
      console.log(`🚫 RSS source "${source.name}" disabled after ${newFailureCount} consecutive failures`);
    }
  }

  async updateArticleCategoryManual(id: number, categories: string[], originalCategory: string): Promise<void> {
    await db.update(articles).set({
      categories,
      category: categories[0] || null,
      manuallyReviewed: true,
      originalCategory,
      updatedAt: new Date()
    }).where(eq(articles.id, id));
  }

  async getManuallyReviewedArticles(): Promise<Article[]> {
    return await db
      .select()
      .from(articles)
      .where(eq(articles.manuallyReviewed, true))
      .orderBy(desc(articles.updatedAt));
  }

  async getSystemStats(): Promise<SystemStats | undefined> {
    const [stats] = await db.select().from(systemStats).limit(1);
    return stats || undefined;
  }

  async updateSystemStats(stats: Partial<SystemStats>): Promise<void> {
    const existing = await this.getSystemStats();
    if (existing) {
      await db.update(systemStats).set(stats).where(eq(systemStats.id, existing.id));
    } else {
      await db.insert(systemStats).values(stats as any);
    }
  }

  async getTrendingTopics(): Promise<{ topic: string; count: number; growth: number }[]> {
    // This would need more complex analytics - simplified for now
    const result = await db
      .select({
        topic: sql<string>`unnest(${articles.tags})`,
        count: sql<number>`count(*)`
      })
      .from(articles)
      .where(gte(articles.createdAt, sql`NOW() - INTERVAL '7 days'`))
      .groupBy(sql`unnest(${articles.tags})`)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return result.map(r => ({ ...r, growth: Math.floor(Math.random() * 30) }));
  }

  async getCategoryDistribution(): Promise<{ category: string; count: number }[]> {
    const category = sql<string>`unnest(coalesce(${articles.categories}, ARRAY[]::text[]))`;
    const result = await db
      .select({
        category,
        count: sql<number>`count(*)`
      })
      .from(articles)
      .where(gte(articles.createdAt, sql`NOW() - INTERVAL '30 days'`))
      .groupBy(category)
      .orderBy(sql`count(*) desc`);
    
    return result as { category: string; count: number }[];
  }

  async getSourceDistribution(): Promise<{ source: string; count: number; type: 'rss' | 'scraped' }[]> {
    const result = await db
      .select({
        source: articles.source,
        count: sql<number>`count(*)`
      })
      .from(articles)
      .where(gte(articles.createdAt, sql`NOW() - INTERVAL '30 days'`))
      .groupBy(articles.source)
      .orderBy(sql`count(*) desc`);

    return result.map(r => ({ ...r, type: 'rss' as const }));
  }

  async getSavedFilters(userId: string, orgId: string): Promise<SavedFilter[]> {
    return await db
      .select()
      .from(savedFilters)
      .where(and(eq(savedFilters.userId, userId), eq(savedFilters.orgId, orgId)))
      .orderBy(desc(savedFilters.createdAt));
  }

  async createSavedFilter(filter: InsertSavedFilter): Promise<SavedFilter> {
    const [newFilter] = await db.insert(savedFilters).values(filter).returning();
    return newFilter;
  }

  async getSavedFilterById(id: string, userId: string, orgId: string): Promise<SavedFilter | undefined> {
    const [filter] = await db
      .select()
      .from(savedFilters)
      .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, userId), eq(savedFilters.orgId, orgId)));
    return filter || undefined;
  }

  async updateSavedFilter(id: string, userId: string, orgId: string, filter: Partial<InsertSavedFilter>): Promise<SavedFilter | null> {
    const [updatedFilter] = await db
      .update(savedFilters)
      .set({ ...filter, updatedAt: new Date() })
      .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, userId), eq(savedFilters.orgId, orgId)))
      .returning();
    return updatedFilter || null;
  }

  async deleteSavedFilter(id: string, userId: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(savedFilters)
      .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, userId), eq(savedFilters.orgId, orgId)))
      .returning();
    return result.length > 0;
  }

  async getPortfolioCompanies(userId: string, orgId: string): Promise<PortfolioCompany[]> {
    return await db
      .select()
      .from(portfolioCompanies)
      .where(and(eq(portfolioCompanies.userId, userId), eq(portfolioCompanies.orgId, orgId), eq(portfolioCompanies.isActive, true)))
      .orderBy(desc(portfolioCompanies.createdAt));
  }

  async createPortfolioCompany(company: InsertPortfolioCompany): Promise<PortfolioCompany> {
    const [newCompany] = await db.insert(portfolioCompanies).values(company).returning();
    return newCompany;
  }

  async getPortfolioCompanyById(id: string, userId: string, orgId: string): Promise<PortfolioCompany | undefined> {
    const [company] = await db
      .select()
      .from(portfolioCompanies)
      .where(and(
        eq(portfolioCompanies.id, id),
        eq(portfolioCompanies.userId, userId),
        eq(portfolioCompanies.orgId, orgId),
        eq(portfolioCompanies.isActive, true)
      ));
    return company || undefined;
  }

  async updatePortfolioCompany(id: string, userId: string, orgId: string, company: Partial<InsertPortfolioCompany>): Promise<PortfolioCompany | null> {
    const [updatedCompany] = await db
      .update(portfolioCompanies)
      .set({ ...company, updatedAt: new Date() })
      .where(and(eq(portfolioCompanies.id, id), eq(portfolioCompanies.userId, userId), eq(portfolioCompanies.orgId, orgId)))
      .returning();
    return updatedCompany || null;
  }

  async deletePortfolioCompany(id: string, userId: string, orgId: string): Promise<boolean> {
    const [deleted] = await db
      .update(portfolioCompanies)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(portfolioCompanies.id, id), eq(portfolioCompanies.userId, userId), eq(portfolioCompanies.orgId, orgId)))
      .returning();
    return !!deleted;
  }

  async getArticlesForPortfolioCompany(companyId: string, userId: string, orgId: string, limit: number = 50): Promise<Article[]> {
    const company = await this.getPortfolioCompanyById(companyId, userId, orgId);
    if (!company) return [];

    const searchTerms = [
      company.companyName,
      ...(company.aliases || []).filter(alias => alias && alias.trim().length > 0)
    ];

    if (searchTerms.length === 0) return [];

    const conditions = searchTerms.map(term => 
      ilike(articles.searchText, `%${term}%`)
    );

    return await db
      .select()
      .from(articles)
      .where(sql`(${sql.join(conditions, sql` OR `)})`)
      .orderBy(desc(articles.publishedAt))
      .limit(limit);
  }

  async getSavedSearches(userId: string, orgId: string): Promise<SavedSearch[]> {
    return await db
      .select()
      .from(savedSearches)
      .where(and(eq(savedSearches.userId, userId), eq(savedSearches.orgId, orgId), eq(savedSearches.isActive, true)))
      .orderBy(desc(savedSearches.createdAt));
  }

  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const [newSearch] = await db.insert(savedSearches).values(search).returning();
    return newSearch;
  }

  async getSavedSearchById(id: string, userId: string, orgId: string): Promise<SavedSearch | undefined> {
    const [search] = await db
      .select()
      .from(savedSearches)
      .where(and(
        eq(savedSearches.id, id),
        eq(savedSearches.userId, userId),
        eq(savedSearches.orgId, orgId),
        eq(savedSearches.isActive, true)
      ));
    return search || undefined;
  }

  async updateSavedSearch(id: string, userId: string, orgId: string, search: Partial<InsertSavedSearch>): Promise<SavedSearch | null> {
    const [updatedSearch] = await db
      .update(savedSearches)
      .set({ ...search, updatedAt: new Date() })
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId), eq(savedSearches.orgId, orgId)))
      .returning();
    return updatedSearch || null;
  }

  async deleteSavedSearch(id: string, userId: string, orgId: string): Promise<boolean> {
    const [deleted] = await db
      .update(savedSearches)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId), eq(savedSearches.orgId, orgId)))
      .returning();
    return !!deleted;
  }

  async updateLastAlertSent(id: string): Promise<void> {
    await db
      .update(savedSearches)
      .set({ lastAlertSent: new Date() })
      .where(eq(savedSearches.id, id));
  }

  async getActiveSearchesForAlerts(frequency: string): Promise<SavedSearch[]> {
    const now = new Date();
    let timeThreshold: Date;

    switch (frequency) {
      case "immediate":
        return await db
          .select()
          .from(savedSearches)
          .where(and(
            eq(savedSearches.isActive, true),
            eq(savedSearches.alertFrequency, frequency)
          ));
      case "daily":
        timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "weekly":
        timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        return [];
    }

    return await db
      .select()
      .from(savedSearches)
      .where(and(
        eq(savedSearches.isActive, true),
        eq(savedSearches.alertFrequency, frequency),
        sql`(${savedSearches.lastAlertSent} IS NULL OR ${savedSearches.lastAlertSent} < ${timeThreshold})`
      ));
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deactivateUser(id: string): Promise<void> {
    await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async getNotificationsByUser(userId: string, orgId: string, limit: number = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.orgId, orgId)))
      .orderBy(desc(notifications.sentAt))
      .limit(limit);
  }

  async getNotificationsBySavedSearch(savedSearchId: string, limit: number = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.savedSearchId, savedSearchId))
      .orderBy(desc(notifications.sentAt))
      .limit(limit);
  }

  async getRecentArticles(days: number = 14): Promise<Article[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Include articles with null publishedAt (from web scraping) OR articles within the time window
    return await db
      .select()
      .from(articles)
      .where(
        sql`${articles.publishedAt} IS NULL OR ${articles.publishedAt} >= ${cutoffDate}`
      )
      .orderBy(desc(articles.publishedAt))
      .limit(1000); // Performance limit
  }

  async createArticleFingerprint(fingerprint: { articleId: number; normalizedTitle: string; fingerprintHash: string; titleTrigrams: string }): Promise<void> {
    await db.insert(articleFingerprints).values(fingerprint);
  }

  async getArticleFingerprintByArticleId(articleId: number): Promise<{ articleId: number; normalizedTitle: string; fingerprintHash: string; titleTrigrams: string } | undefined> {
    const [result] = await db
      .select()
      .from(articleFingerprints)
      .where(eq(articleFingerprints.articleId, articleId));
    
    return result || undefined;
  }

  async findSimilarArticlesByFingerprint(fingerprintHash: string, excludeArticleId?: number): Promise<Article[]> {
    const fingerprints = await db
      .select()
      .from(articleFingerprints)
      .where(eq(articleFingerprints.fingerprintHash, fingerprintHash));
    
    if (fingerprints.length === 0) return [];
    
    const articleIds = fingerprints
      .map(f => f.articleId)
      .filter(id => !excludeArticleId || id !== excludeArticleId);
    
    if (articleIds.length === 0) return [];
    
    return await db
      .select()
      .from(articles)
      .where(sql`${articles.id} = ANY(${articleIds})`);
  }

  async findSimilarArticlesByTitle(normalizedTitle: string, titleTrigrams: string, excludeArticleId?: number): Promise<Article[]> {
    const conditions = [ilike(articleFingerprints.normalizedTitle, `%${normalizedTitle}%`)];
    
    if (excludeArticleId) {
      conditions.push(sql`${articleFingerprints.articleId} != ${excludeArticleId}`);
    }
    
    const fingerprints = await db
      .select()
      .from(articleFingerprints)
      .where(and(...conditions))
      .limit(50);
    
    if (fingerprints.length === 0) return [];
    
    const articleIds = fingerprints.map(f => f.articleId);
    
    return await db
      .select()
      .from(articles)
      .where(sql`${articles.id} = ANY(${articleIds})`);
  }

  async createArticleDuplicate(duplicate: { canonicalArticleId: number; duplicateTitle: string; duplicateUrl: string; duplicateSource: string; duplicatePublishedAt: Date | null; duplicateContent: string | null; similarityScore: number; suppressionReason: string }): Promise<void> {
    await db.insert(articleDuplicates).values(duplicate);
  }

  async getDuplicatesByCanonicalId(canonicalArticleId: number): Promise<Array<{ id: number; duplicateTitle: string; duplicateUrl: string; duplicateSource: string; similarityScore: number; createdAt: Date }>> {
    const results = await db
      .select({
        id: articleDuplicates.id,
        duplicateTitle: articleDuplicates.duplicateTitle,
        duplicateUrl: articleDuplicates.duplicateUrl,
        duplicateSource: articleDuplicates.duplicateSource,
        similarityScore: articleDuplicates.similarityScore,
        createdAt: articleDuplicates.createdAt,
      })
      .from(articleDuplicates)
      .where(eq(articleDuplicates.canonicalArticleId, canonicalArticleId))
      .orderBy(desc(articleDuplicates.createdAt));
    
    return results.map(r => ({
      ...r,
      createdAt: r.createdAt || new Date(),
    }));
  }

  async getUserNotificationPreferences(userId: string, orgId: string): Promise<UserNotificationPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(userNotificationPreferences)
      .where(and(eq(userNotificationPreferences.userId, userId), eq(userNotificationPreferences.orgId, orgId)));
    return prefs || undefined;
  }

  async createUserNotificationPreferences(prefs: InsertUserNotificationPreferences): Promise<UserNotificationPreferences> {
    const [created] = await db
      .insert(userNotificationPreferences)
      .values(prefs)
      .returning();
    return created;
  }

  async updateUserNotificationPreferences(userId: string, orgId: string, prefs: Partial<InsertUserNotificationPreferences>): Promise<UserNotificationPreferences | undefined> {
    const [updated] = await db
      .update(userNotificationPreferences)
      .set({ ...prefs, updatedAt: new Date() })
      .where(and(eq(userNotificationPreferences.userId, userId), eq(userNotificationPreferences.orgId, orgId)))
      .returning();
    return updated || undefined;
  }

  async removeArticle(id: number, reason: string, userId: string): Promise<void> {
    const article = await this.getArticleById(id);
    if (!article) {
      throw new Error("Article not found");
    }

    // Extract and normalize keywords from the removal reason
    const keywords = Array.from(new Set(
      reason.toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 3)
    ));

    // Store the removal pattern for AI learning
    await db.insert(articleRemovalPatterns).values({
      articleId: id,
      removalReason: reason,
      removalKeywords: keywords,
      removedBy: userId,
      articleTitle: article.title,
      articleSource: article.source,
      articleCategories: article.categories || [],
      articleTags: article.tags || [],
      articleContent: article.content?.substring(0, 2000) || null,
    });

    // Soft delete the article
    await db.update(articles).set({
      isRemoved: true,
      removalReason: reason,
      removedAt: new Date(),
      removedBy: userId,
    }).where(eq(articles.id, id));
  }

  async getRemovalPatterns(): Promise<ArticleRemovalPattern[]> {
    return await db
      .select()
      .from(articleRemovalPatterns)
      .orderBy(desc(articleRemovalPatterns.removedAt))
      .limit(100);
  }

  async checkArticleAgainstRemovalPatterns(title: string, content: string): Promise<{ shouldRemove: boolean; matchedPattern?: ArticleRemovalPattern }> {
    const patterns = await this.getRemovalPatterns();
    const normalizedTitle = title.toLowerCase();
    const normalizedContent = (content || "").toLowerCase();

    for (const pattern of patterns) {
      // Check if removal keywords match
      if (pattern.removalKeywords && pattern.removalKeywords.length > 0) {
        const matchCount = pattern.removalKeywords.filter(keyword => 
          normalizedTitle.includes(keyword.toLowerCase()) || 
          normalizedContent.includes(keyword.toLowerCase())
        ).length;

        // If 50% or more keywords match, flag for removal
        if (matchCount >= pattern.removalKeywords.length * 0.5) {
          return { shouldRemove: true, matchedPattern: pattern };
        }
      }

      // Check for source matches if source was previously removed
      if (pattern.articleSource && normalizedTitle.includes(pattern.articleSource.toLowerCase())) {
        const keywordMatches = pattern.removalKeywords?.filter(keyword => 
          normalizedTitle.includes(keyword.toLowerCase()) || 
          normalizedContent.includes(keyword.toLowerCase())
        ).length || 0;

        if (keywordMatches > 0) {
          return { shouldRemove: true, matchedPattern: pattern };
        }
      }
    }

    return { shouldRemove: false };
  }

  async getUserFilterPreferences(userId: string, orgId: string): Promise<UserFilterPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(userFilterPreferences)
      .where(and(eq(userFilterPreferences.userId, userId), eq(userFilterPreferences.orgId, orgId)));
    return prefs || undefined;
  }

  async saveUserFilterPreferences(userId: string, orgId: string, preferences: InsertUserFilterPreferences): Promise<UserFilterPreferences> {
    const [result] = await db
      .insert(userFilterPreferences)
      .values({
        ...preferences,
        userId,
        orgId,
      })
      .onConflictDoUpdate({
        target: userFilterPreferences.userId,
        set: {
          ...preferences,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return result;
  }

  async getEntityById(id: number): Promise<Entity | undefined> {
    const [entity] = await db.select().from(entities).where(eq(entities.id, id));
    return entity || undefined;
  }

  async getEntitiesByIds(ids: number[]): Promise<Entity[]> {
    if (ids.length === 0) return [];
    return await db.select().from(entities).where(inArray(entities.id, ids));
  }

  async getArticlesByIds(ids: number[]): Promise<Article[]> {
    if (ids.length === 0) return [];
    return await db.select().from(articles).where(inArray(articles.id, ids));
  }

  async getOrCreateEntity(
    name: string,
    type: 'company' | 'person' | 'location' | 'asset',
    metadata?: { description?: string; industry?: string; location?: string; aliases?: string[] }
  ): Promise<number> {
    const normalizedName = name.toLowerCase().trim();
    
    // Check if entity already exists
    const existing = await db
      .select()
      .from(entities)
      .where(
        and(
          eq(entities.normalizedName, normalizedName),
          eq(entities.type, type)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0].id;
    }
    
    // Create new entity
    const [newEntity] = await db
      .insert(entities)
      .values({
        name,
        type,
        normalizedName,
        description: metadata?.description || null,
        industry: metadata?.industry || null,
        location: metadata?.location || null,
        aliases: metadata?.aliases || null,
        metadata: null,
      })
      .returning();
    
    return newEntity.id;
  }

  async linkArticleToEntity(
    articleId: number,
    entityId: number,
    mentionCount: number = 1,
    confidence: number = 100,
    context?: string
  ): Promise<void> {
    // Check if link already exists
    const existing = await db
      .select()
      .from(articleEntities)
      .where(
        and(
          eq(articleEntities.articleId, articleId),
          eq(articleEntities.entityId, entityId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update mention count if link exists
      await db
        .update(articleEntities)
        .set({
          mentionCount: sql`${articleEntities.mentionCount} + ${mentionCount}`,
        })
        .where(eq(articleEntities.id, existing[0].id));
    } else {
      // Create new link
      await db
        .insert(articleEntities)
        .values({
          articleId,
          entityId,
          mentionCount,
          confidence,
          context: context || null,
        });
    }
  }

  async getEntitiesByArticle(articleId: number): Promise<Array<{ id: number; name: string; type: string; mentionCount: number; confidence: number }>> {
    const results = await db
      .select({
        id: entities.id,
        name: entities.name,
        type: entities.type,
        mentionCount: articleEntities.mentionCount,
        confidence: articleEntities.confidence,
      })
      .from(articleEntities)
      .innerJoin(entities, eq(articleEntities.entityId, entities.id))
      .where(eq(articleEntities.articleId, articleId))
      .orderBy(desc(articleEntities.mentionCount));
    
    return results.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      mentionCount: r.mentionCount || 1,
      confidence: r.confidence || 100
    }));
  }

  async getArticlesByEntity(entityId: number, limit: number = 50): Promise<Article[]> {
    const results = await db
      .select({
        article: articles,
      })
      .from(articleEntities)
      .innerJoin(articles, eq(articleEntities.articleId, articles.id))
      .where(
        and(
          eq(articleEntities.entityId, entityId),
          eq(articles.isRemoved, false)
        )
      )
      .orderBy(desc(articles.publishedAt))
      .limit(limit);
    
    return results.map(r => r.article);
  }

  async searchEntities(query: string, type?: string): Promise<Array<{ id: number; name: string; type: string; description: string | null; articleCount: number }>> {
    const normalizedQuery = query.toLowerCase();
    
    const conditions: any[] = [
      sql`lower(${entities.name}) LIKE ${`%${normalizedQuery}%`}`,
    ];
    
    if (type) {
      conditions.push(sql`${entities.type} = ${type}`);
    }
    
    const results = await db
      .select({
        id: entities.id,
        name: entities.name,
        type: entities.type,
        description: entities.description,
        articleCount: sql<number>`COUNT(DISTINCT ${articleEntities.articleId})::int`,
      })
      .from(entities)
      .leftJoin(articleEntities, eq(entities.id, articleEntities.entityId))
      .where(and(...conditions))
      .groupBy(entities.id, entities.name, entities.type, entities.description)
      .orderBy(desc(sql`COUNT(DISTINCT ${articleEntities.articleId})`))
      .limit(100);
    
    return results;
  }

  async getAllEntities(type?: string, limit: number = 100): Promise<Array<{ id: number; name: string; type: string; description: string | null; articleCount: number }>> {
    const conditions: any[] = type ? [sql`${entities.type} = ${type}`] : [];
    
    const results = await db
      .select({
        id: entities.id,
        name: entities.name,
        type: entities.type,
        description: entities.description,
        articleCount: sql<number>`COUNT(DISTINCT ${articleEntities.articleId})::int`,
      })
      .from(entities)
      .leftJoin(articleEntities, eq(entities.id, articleEntities.entityId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(entities.id, entities.name, entities.type, entities.description)
      .orderBy(desc(sql`COUNT(DISTINCT ${articleEntities.articleId})`))
      .limit(limit);
    
    return results;
  }

  async getEntityAnalytics(entityId: number): Promise<{
    totalDeals: number;
    dealsByType: Array<{ type: string; count: number }>;
    dealsByRole: { asBuyer: number; asSeller: number };
    avgDealSize: string | null;
    recentActivity: number;
    geographicFocus: Array<{ region: string; count: number }>;
  }> {
    // Get all deals where entity is buyer or seller
    const allDeals = await db
      .select({
        id: deals.id,
        transactionType: deals.transactionType,
        transactionSize: deals.transactionSize,
        announcedDate: deals.announcedDate,
        buyerEntityId: deals.buyerEntityId,
        sellerEntityId: deals.sellerEntityId,
        articleId: deals.articleId,
      })
      .from(docktalkDeals)
      .where(
        or(
          eq(docktalkDeals.buyerEntityId, entityId),
          eq(docktalkDeals.sellerEntityId, entityId)
        )
      );

    // Get article regions for geographic focus
    const articleIds = Array.from(new Set(allDeals.map(d => d.articleId)));
    const articlesWithRegion = await db
      .select({
        id: articles.id,
        region: articles.region,
      })
      .from(articles)
      .where(inArray(articles.id, articleIds));

    const articleRegionMap = new Map(articlesWithRegion.map(a => [a.id, a.region]));

    const totalDeals = allDeals.length;

    // Count by transaction type
    const typeMap = new Map<string, number>();
    allDeals.forEach(deal => {
      const type = deal.transactionType || 'other';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    const dealsByType = Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }));

    // Count by role (buyer vs seller)
    const asBuyer = allDeals.filter(d => d.buyerEntityId === entityId).length;
    const asSeller = allDeals.filter(d => d.sellerEntityId === entityId).length;

    // Recent activity (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentActivity = allDeals.filter(d => d.announcedDate && d.announcedDate >= ninetyDaysAgo).length;

    // Geographic focus
    const regionMap = new Map<string, number>();
    allDeals.forEach(deal => {
      const region = articleRegionMap.get(deal.articleId) || 'Unknown';
      regionMap.set(region, (regionMap.get(region) || 0) + 1);
    });
    const geographicFocus = Array.from(regionMap.entries()).map(([region, count]) => ({ region, count }));

    return {
      totalDeals,
      dealsByType,
      dealsByRole: { asBuyer, asSeller },
      avgDealSize: null, // Complex calculation - can be added later
      recentActivity,
      geographicFocus,
    };
  }

  async getDealsByEntity(entityId: number, role?: 'buyer' | 'seller'): Promise<DocktalkDeal[]> {
    let query = db.select().from(docktalkDeals);

    if (role === 'buyer') {
      query = query.where(eq(docktalkDeals.buyerEntityId, entityId)) as any;
    } else if (role === 'seller') {
      query = query.where(eq(docktalkDeals.sellerEntityId, entityId)) as any;
    } else {
      query = query.where(
        or(
          eq(docktalkDeals.buyerEntityId, entityId),
          eq(docktalkDeals.sellerEntityId, entityId)
        )
      ) as any;
    }

    return query.orderBy(desc(docktalkDeals.announcedDate));
  }

  async createWatchlist(insertWatchlist: InsertWatchlist): Promise<Watchlist> {
    const [watchlist] = await db.insert(watchlists).values(insertWatchlist).returning();
    return watchlist;
  }

  async getWatchlistsByUser(userId: string, orgId: string): Promise<Watchlist[]> {
    return db.select().from(watchlists).where(and(eq(watchlists.userId, userId), eq(watchlists.orgId, orgId))).orderBy(desc(watchlists.createdAt));
  }

  async getWatchlistById(id: string, userId: string, orgId: string): Promise<Watchlist | undefined> {
    const [watchlist] = await db.select().from(watchlists).where(and(eq(watchlists.id, id), eq(watchlists.userId, userId), eq(watchlists.orgId, orgId)));
    return watchlist || undefined;
  }

  async updateWatchlist(id: string, userId: string, orgId: string, updates: Partial<InsertWatchlist>): Promise<Watchlist | undefined> {
    const [watchlist] = await db
      .update(watchlists)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(watchlists.id, id), eq(watchlists.userId, userId), eq(watchlists.orgId, orgId)))
      .returning();
    return watchlist || undefined;
  }

  async deleteWatchlist(id: string, userId: string, orgId: string): Promise<boolean> {
    const result = await db.delete(watchlists).where(and(eq(watchlists.id, id), eq(watchlists.userId, userId), eq(watchlists.orgId, orgId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async addEntityToWatchlist(watchlistId: string, entityId: number, userId: string, orgId: string): Promise<boolean> {
    const watchlist = await this.getWatchlistById(watchlistId, userId, orgId);
    if (!watchlist) {
      return false;
    }

    try {
      await db.insert(watchlistEntities).values({ watchlistId, entityId }).onConflictDoNothing();
      return true;
    } catch (error) {
      console.error('Error adding entity to watchlist:', error);
      return false;
    }
  }

  async removeEntityFromWatchlist(watchlistId: string, entityId: number, userId: string, orgId: string): Promise<boolean> {
    const watchlist = await this.getWatchlistById(watchlistId, userId, orgId);
    if (!watchlist) {
      return false;
    }

    const result = await db.delete(watchlistEntities).where(and(eq(watchlistEntities.watchlistId, watchlistId), eq(watchlistEntities.entityId, entityId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getWatchlistEntities(watchlistId: string, userId: string, orgId: string): Promise<Entity[]> {
    const watchlist = await this.getWatchlistById(watchlistId, userId, orgId);
    if (!watchlist) {
      return [];
    }

    const results = await db
      .select({
        id: entities.id,
        name: entities.name,
        type: entities.type,
        normalizedName: entities.normalizedName,
        aliases: entities.aliases,
        description: entities.description,
        industry: entities.industry,
        location: entities.location,
        metadata: entities.metadata,
        createdAt: entities.createdAt,
        updatedAt: entities.updatedAt,
      })
      .from(watchlistEntities)
      .innerJoin(entities, eq(watchlistEntities.entityId, entities.id))
      .where(eq(watchlistEntities.watchlistId, watchlistId))
      .orderBy(desc(watchlistEntities.addedAt));

    return results;
  }

  async getArticlesByWatchlist(watchlistId: string, userId: string, orgId: string, limit: number = 50, offset: number = 0): Promise<Article[]> {
    const watchlist = await this.getWatchlistById(watchlistId, userId, orgId);
    if (!watchlist) {
      return [];
    }

    const entityIds = await db
      .select({ entityId: watchlistEntities.entityId })
      .from(watchlistEntities)
      .where(eq(watchlistEntities.watchlistId, watchlistId));

    if (entityIds.length === 0) {
      return [];
    }

    const results = await db
      .selectDistinct({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        source: articles.source,
        publishedAt: articles.publishedAt,
        category: articles.category,
        categories: articles.categories,
        tags: articles.tags,
        summary: articles.summary,
        content: articles.content,
        imageUrl: articles.imageUrl,
        relevanceScore: articles.relevanceScore,
        sentiment: articles.sentiment,
        dealMetadata: articles.dealMetadata,
        geography: articles.geography,
        region: articles.region,
        searchText: articles.searchText,
        isBookmarked: articles.isBookmarked,
        manuallyReviewed: articles.manuallyReviewed,
        originalCategory: articles.originalCategory,
        isRemoved: articles.isRemoved,
        removalReason: articles.removalReason,
        removedAt: articles.removedAt,
        removedBy: articles.removedBy,
        createdAt: articles.createdAt,
        updatedAt: articles.updatedAt,
      })
      .from(articleEntities)
      .innerJoin(articles, eq(articleEntities.articleId, articles.id))
      .where(
        and(
          inArray(articleEntities.entityId, entityIds.map(e => e.entityId)),
          eq(articles.isRemoved, false)
        )
      )
      .orderBy(desc(articles.publishedAt))
      .limit(limit)
      .offset(offset);

    return results;
  }

  // Deal methods implementation
  async createDeal(deal: InsertDocktalkDeal): Promise<DocktalkDeal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }

  async getDeals(filters: {
    transactionType?: string;
    dealStatus?: string;
    entityId?: number;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<DocktalkDeal[]> {
    const conditions = [];

    if (filters.transactionType) {
      conditions.push(eq(docktalkDeals.transactionType, filters.transactionType as any));
    }

    if (filters.dealStatus) {
      conditions.push(eq(docktalkDeals.dealStatus, filters.dealStatus as any));
    }

    if (filters.entityId) {
      conditions.push(
        sql`(${deals.buyerEntityId} = ${filters.entityId} OR ${deals.sellerEntityId} = ${filters.entityId})`
      );
    }

    if (filters.fromDate) {
      conditions.push(gte(docktalkDeals.announcedDate, filters.fromDate));
    }

    if (filters.toDate) {
      conditions.push(lte(docktalkDeals.announcedDate, filters.toDate));
    }

    let query = db.select().from(docktalkDeals);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query
      .orderBy(desc(docktalkDeals.announcedDate), desc(docktalkDeals.createdAt))
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);

    return results;
  }

  async getDealById(id: number): Promise<DocktalkDeal | undefined> {
    const [deal] = await db.select().from(docktalkDeals).where(eq(docktalkDeals.id, id));
    return deal || undefined;
  }

  async updateDeal(id: number, updates: Partial<InsertDocktalkDeal>): Promise<DocktalkDeal | undefined> {
    const [updated] = await db
      .update(docktalkDeals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(docktalkDeals.id, id))
      .returning();
    return updated || undefined;
  }


  async getDealsByArticle(articleId: number): Promise<DocktalkDeal[]> {
    const results = await db
      .select()
      .from(docktalkDeals)
      .where(eq(docktalkDeals.articleId, articleId))
      .orderBy(desc(docktalkDeals.createdAt));

    return results;
  }

  async getDealAnalytics(filters?: {
    transactionType?: string;
    dealStatus?: string;
    region?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{
    totalDeals: number;
    dealsByType: Array<{ type: string; count: number }>;
    dealsByStatus: Array<{ status: string; count: number }>;
    dealsByRegion: Array<{ region: string; count: number }>;
    monthlyDeals: Array<{ month: string; count: number }>;
    recentDealsCount: number;
  }> {
    // Build conditions for filtering (same as getDeals)
    const conditions = [];

    if (filters?.transactionType) {
      conditions.push(eq(docktalkDeals.transactionType, filters.transactionType as any));
    }

    if (filters?.dealStatus) {
      conditions.push(eq(docktalkDeals.dealStatus, filters.dealStatus as any));
    }

    if (filters?.fromDate) {
      conditions.push(gte(docktalkDeals.announcedDate, filters.fromDate));
    }

    if (filters?.toDate) {
      conditions.push(lte(docktalkDeals.announcedDate, filters.toDate));
    }

    // Add region filter if specified (join with articles table)
    if (filters?.region) {
      conditions.push(eq(articles.region, filters.region as any));
    }

    // Get all deals with article region using LEFT JOIN
    let query = db
      .select({
        id: docktalkDeals.id,
        transactionType: docktalkDeals.transactionType,
        dealStatus: docktalkDeals.dealStatus,
        announcedDate: docktalkDeals.announcedDate,
        articleId: docktalkDeals.articleId,
        region: sql<string>`COALESCE(${articles.region}, 'Unknown')`.as('region'),
      })
      .from(docktalkDeals)
      .leftJoin(articles, eq(docktalkDeals.articleId, articles.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const filteredDeals = await query;

    const totalDeals = filteredDeals.length;

    // Count by transaction type
    const typeMap = new Map<string, number>();
    filteredDeals.forEach(deal => {
      const type = deal.transactionType || 'other';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    const dealsByType = Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }));

    // Count by status
    const statusMap = new Map<string, number>();
    filteredDeals.forEach(deal => {
      const status = deal.dealStatus || 'announced';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });
    const dealsByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

    // Count by region (already joined and coalesced in query)
    const regionMap = new Map<string, number>();
    filteredDeals.forEach(deal => {
      const region = deal.region || 'Unknown';
      regionMap.set(region, (regionMap.get(region) || 0) + 1);
    });
    const dealsByRegion = Array.from(regionMap.entries()).map(([region, count]) => ({ region, count }));

    // Monthly deals (last 12 months)
    const monthlyMap = new Map<string, number>();
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    
    filteredDeals.forEach(deal => {
      if (deal.announcedDate) {
        const dealDate = new Date(deal.announcedDate);
        if (dealDate >= twelveMonthsAgo) {
          const monthKey = `${dealDate.getFullYear()}-${String(dealDate.getMonth() + 1).padStart(2, '0')}`;
          monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
        }
      }
    });

    // Create array for all 12 months (fill gaps with 0)
    const monthlyDeals: Array<{ month: string; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyDeals.push({
        month: monthKey,
        count: monthlyMap.get(monthKey) || 0,
      });
    }

    // Recent deals (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentDealsCount = filteredDeals.filter(deal => {
      if (!deal.announcedDate) return false;
      return new Date(deal.announcedDate) >= thirtyDaysAgo;
    }).length;

    return {
      totalDeals,
      dealsByType,
      dealsByStatus,
      dealsByRegion,
      monthlyDeals,
      recentDealsCount,
    };
  }

  // MarinaMatch Integration methods
  async getOrganizationFeature(orgId: string): Promise<{ id: string; orgId: string; feature: string; tier: string; isActive: boolean; activatedAt: Date; expiresAt: Date | null } | undefined> {
    const [feature] = await db
      .select()
      .from(organizationFeatures)
      .where(and(
        eq(organizationFeatures.orgId, orgId),
        eq(organizationFeatures.feature, 'docktalk')
      ));
    
    if (!feature) return undefined;
    
    return {
      id: feature.id,
      orgId: feature.orgId,
      feature: feature.feature,
      tier: feature.tier,
      isActive: feature.isActive,
      activatedAt: feature.activatedAt,
      expiresAt: feature.expiresAt,
    };
  }

  async createOrganizationFeature(data: { orgId: string; feature?: string; tier?: string; isActive?: boolean }): Promise<{ id: string; orgId: string; feature: string; tier: string; isActive: boolean; activatedAt: Date; expiresAt: Date | null }> {
    const [feature] = await db
      .insert(organizationFeatures)
      .values({
        orgId: data.orgId,
        feature: data.feature || 'docktalk',
        tier: data.tier || 'docktalk_free',
        isActive: data.isActive !== undefined ? data.isActive : true,
      })
      .returning();
    
    return {
      id: feature.id,
      orgId: feature.orgId,
      feature: feature.feature,
      tier: feature.tier,
      isActive: feature.isActive,
      activatedAt: feature.activatedAt,
      expiresAt: feature.expiresAt,
    };
  }

  async getDockTalkUserByMarinaUserId(marinaUserId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.marinaUserId, marinaUserId));
    
    return user || undefined;
  }

  async createDockTalkUserFromMarinaUser(data: { marinaUserId: string; orgId: string; email: string | null; role: string; subscriptionTier: string; isActive: boolean }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        marinaUserId: data.marinaUserId,
        orgId: data.orgId,
        email: data.email,
        // username and password remain null for MarinaMatch users
        username: null,
        password: null,
        role: data.role,
        subscriptionTier: data.subscriptionTier,
        isActive: data.isActive,
      })
      .returning();
    
    return user;
  }
}

export const storage = new DatabaseStorage();
