import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, index, serial, boolean, jsonb, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("docktalk_user_role", ["admin", "analyst", "partner", "viewer"]);
export const subscriptionTierEnum = pgEnum("docktalk_subscription_tier", ["free", "pro"]);
export const regionEnum = pgEnum("docktalk_region", ["US/Domestic", "International"]);

export const users = pgTable("docktalk_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  role: userRoleEnum("role").notNull().default("viewer"),
  subscriptionTier: subscriptionTierEnum("subscription_tier").notNull().default("free"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const alertFrequencyEnum = pgEnum("docktalk_alert_frequency", ["none", "immediate", "daily", "weekly"]);

export const userNotificationPreferences = pgTable("docktalk_user_notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  emailAddress: text("email_address").notNull(),
  categories: text("categories").array().notNull(),
  frequency: alertFrequencyEnum("frequency").notNull().default("none"),
  deliveryTime: text("delivery_time").default("09:00"),
  timezone: text("timezone").default("America/New_York"),
  enabled: boolean("enabled").default(true),
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_notification_prefs_user").on(table.userId),
  byFrequency: index("idx_docktalk_notification_prefs_frequency").on(table.frequency),
}));

export const articles = pgTable("docktalk_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  source: text("source").notNull(),
  publishedAt: timestamp("published_at"),
  category: text("category"),
  categories: text("categories").array(),
  tags: text("tags").array(),
  summary: text("summary"),
  content: text("content"),
  imageUrl: text("image_url"),
  relevanceScore: integer("relevance_score").default(0),
  sentiment: text("sentiment"),
  dealMetadata: jsonb("deal_metadata"),
  geography: text("geography").array(),
  region: regionEnum("region").default("US/Domestic"),
  searchText: text("search_text").notNull().default(""),
  isBookmarked: boolean("is_bookmarked").default(false),
  manuallyReviewed: boolean("manually_reviewed").default(false),
  originalCategory: text("original_category"),
  isRemoved: boolean("is_removed").default(false),
  removalReason: text("removal_reason"),
  removedAt: timestamp("removed_at"),
  removedBy: varchar("removed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byPublished: index("idx_docktalk_articles_published").on(table.publishedAt),
  byScore: index("idx_docktalk_articles_score").on(table.relevanceScore),
  bySearch: index("idx_docktalk_articles_search").on(table.searchText),
  uniqueUrl: index("idx_docktalk_articles_url").on(table.url),
  byCategory: index("idx_docktalk_articles_category").on(table.category),
  bySentiment: index("idx_docktalk_articles_sentiment").on(table.sentiment),
  byRegion: index("idx_docktalk_articles_region").on(table.region),
}));

export const articleFingerprints = pgTable("docktalk_article_fingerprints", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().unique().references(() => articles.id, { onDelete: "cascade" }),
  normalizedTitle: text("normalized_title").notNull(),
  fingerprintHash: text("fingerprint_hash").notNull(),
  titleTrigrams: text("title_trigrams").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  byArticle: index("idx_docktalk_fingerprints_article").on(table.articleId),
  byHash: index("idx_docktalk_fingerprints_hash").on(table.fingerprintHash),
  byNormalizedTitle: index("idx_docktalk_fingerprints_title").on(table.normalizedTitle),
}));

export const articleDuplicates = pgTable("docktalk_article_duplicates", {
  id: serial("id").primaryKey(),
  canonicalArticleId: integer("canonical_article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  duplicateTitle: text("duplicate_title").notNull(),
  duplicateUrl: text("duplicate_url").notNull(),
  duplicateSource: text("duplicate_source").notNull(),
  duplicatePublishedAt: timestamp("duplicate_published_at"),
  duplicateContent: text("duplicate_content"),
  similarityScore: integer("similarity_score").notNull(),
  suppressionReason: text("suppression_reason").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  byCanonical: index("idx_docktalk_duplicates_canonical").on(table.canonicalArticleId),
  byDate: index("idx_docktalk_duplicates_date").on(table.createdAt),
}));

export const articleRemovalPatterns = pgTable("docktalk_article_removal_patterns", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  removalReason: text("removal_reason").notNull(),
  removalKeywords: text("removal_keywords").array(),
  removedBy: varchar("removed_by").references(() => users.id),
  articleTitle: text("article_title").notNull(),
  articleSource: text("article_source").notNull(),
  articleCategories: text("article_categories").array(),
  articleTags: text("article_tags").array(),
  articleContent: text("article_content"),
  removedAt: timestamp("removed_at").defaultNow(),
}, (table) => ({
  byArticle: index("idx_docktalk_removal_patterns_article").on(table.articleId),
  byRemovedBy: index("idx_docktalk_removal_patterns_user").on(table.removedBy),
  byDate: index("idx_docktalk_removal_patterns_date").on(table.removedAt),
}));

export const entityTypeEnum = pgEnum("docktalk_entity_type", ["company", "person", "location", "asset"]);

export const entities = pgTable("docktalk_entities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: entityTypeEnum("type").notNull(),
  normalizedName: text("normalized_name").notNull(),
  aliases: text("aliases").array(),
  description: text("description"),
  industry: text("industry"),
  location: text("location"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byName: index("idx_docktalk_entities_name").on(table.name),
  byNormalizedName: index("idx_docktalk_entities_normalized").on(table.normalizedName),
  byType: index("idx_docktalk_entities_type").on(table.type),
}));

export const articleEntities = pgTable("docktalk_article_entities", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  entityId: integer("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  mentionCount: integer("mention_count").default(1),
  confidence: integer("confidence").default(100),
  context: text("context"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  byArticle: index("idx_docktalk_article_entities_article").on(table.articleId),
  byEntity: index("idx_docktalk_article_entities_entity").on(table.entityId),
  uniqueArticleEntity: index("idx_docktalk_article_entities_unique").on(table.articleId, table.entityId),
}));

export const watchlists = pgTable("docktalk_watchlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  alertFrequency: alertFrequencyEnum("alert_frequency").notNull().default("none"),
  lastAlertSent: timestamp("last_alert_sent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_watchlists_user").on(table.userId),
}));

export const watchlistEntities = pgTable("docktalk_watchlist_entities", {
  id: serial("id").primaryKey(),
  watchlistId: varchar("watchlist_id").notNull().references(() => watchlists.id, { onDelete: "cascade" }),
  entityId: integer("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow(),
}, (table) => ({
  byWatchlist: index("idx_docktalk_watchlist_entities_watchlist").on(table.watchlistId),
  byEntity: index("idx_docktalk_watchlist_entities_entity").on(table.entityId),
  uniqueWatchlistEntity: uniqueIndex("idx_docktalk_watchlist_entities_unique").on(table.watchlistId, table.entityId),
}));

export const transactionTypeEnum = pgEnum("docktalk_transaction_type", ["ma", "financing", "partnership", "asset_sale", "other"]);
export const dealStatusEnum = pgEnum("docktalk_deal_status", ["rumored", "announced", "pending", "closed", "failed"]);

export const deals = pgTable("docktalk_deals", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  dealStatus: dealStatusEnum("deal_status").notNull().default("announced"),
  buyer: text("buyer"),
  buyerEntityId: integer("buyer_entity_id").references(() => entities.id),
  seller: text("seller"),
  sellerEntityId: integer("seller_entity_id").references(() => entities.id),
  transactionSize: text("transaction_size"),
  valuation: text("valuation"),
  equityStake: text("equity_stake"),
  closingDate: timestamp("closing_date"),
  announcedDate: timestamp("announced_date"),
  dealSummary: text("deal_summary"),
  confidence: integer("confidence").default(80),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byArticle: index("idx_docktalk_deals_article").on(table.articleId),
  byType: index("idx_docktalk_deals_type").on(table.transactionType),
  byStatus: index("idx_docktalk_deals_status").on(table.dealStatus),
  byBuyerEntity: index("idx_docktalk_deals_buyer_entity").on(table.buyerEntityId),
  bySellerEntity: index("idx_docktalk_deals_seller_entity").on(table.sellerEntityId),
  byClosingDate: index("idx_docktalk_deals_closing_date").on(table.closingDate),
  byAnnouncedDate: index("idx_docktalk_deals_announced_date").on(table.announcedDate),
}));

export const sourceTypeEnum = pgEnum("docktalk_source_type", ["rss", "web_scrape"]);

export const rssSources = pgTable("docktalk_rss_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  sourceType: sourceTypeEnum("source_type").notNull().default("rss"),
  isActive: boolean("is_active").default(true),
  minRelevanceScore: integer("min_relevance_score").default(50),
  customKeywords: text("custom_keywords").array(),
  lastFetched: timestamp("last_fetched"),
  lastScrapedAt: timestamp("last_scraped_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemStats = pgTable("docktalk_system_stats", {
  id: serial("id").primaryKey(),
  totalArticles: integer("total_articles").default(0),
  todayArticles: integer("today_articles").default(0),
  avgRelevance: integer("avg_relevance").default(0),
  lastUpdate: timestamp("last_update").defaultNow(),
  rssFeedStatus: text("rss_feed_status").default("online"),
  scraperStatus: text("scraper_status").default("active"),
  aiStatus: text("ai_status").default("processing"),
  dbStatus: text("db_status").default("healthy"),
});

export const savedFilters = pgTable("docktalk_saved_filters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  criteria: text("criteria").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const savedSearches = pgTable("docktalk_saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  criteria: jsonb("criteria").notNull(),
  alertFrequency: text("alert_frequency").notNull().default("none"),
  lastAlertSent: timestamp("last_alert_sent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_saved_searches_user").on(table.userId),
}));

export const userArticleAnnotations = pgTable("docktalk_user_article_annotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  articleId: integer("article_id").notNull().references(() => articles.id),
  customTags: text("custom_tags").array(),
  privateNotes: text("private_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_annotations_user").on(table.userId),
  byArticle: index("idx_docktalk_annotations_article").on(table.articleId),
  uniqueUserArticle: index("idx_docktalk_annotations_user_article").on(table.userId, table.articleId),
}));

export const portfolioCompanies = pgTable("docktalk_portfolio_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyName: text("company_name").notNull(),
  aliases: text("aliases").array(),
  sector: text("sector"),
  region: text("region"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_portfolio_user").on(table.userId),
  byCompany: index("idx_docktalk_portfolio_company").on(table.companyName),
}));

export const notificationSourceEnum = pgEnum("docktalk_notification_source", ["saved_search", "category_alert"]);

export const notifications = pgTable("docktalk_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  source: notificationSourceEnum("source").notNull().default("saved_search"),
  savedSearchId: varchar("saved_search_id").references(() => savedSearches.id),
  categories: text("categories").array(),
  articleSnapshot: jsonb("article_snapshot"),
  articleIds: text("article_ids").array(),
  articleCount: integer("article_count").notNull().default(0),
  frequency: text("frequency").notNull(),
  message: text("message").notNull(),
  deliveryMethod: text("delivery_method").notNull().default("console"),
  deliveryStatus: text("delivery_status").notNull().default("sent"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_notifications_user").on(table.userId),
  bySavedSearch: index("idx_docktalk_notifications_search").on(table.savedSearchId),
  bySource: index("idx_docktalk_notifications_source").on(table.source),
  bySentAt: index("idx_docktalk_notifications_sent_at").on(table.sentAt),
}));

export const userFilterPreferences = pgTable("docktalk_user_filter_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  categories: text("categories").array(),
  sources: text("sources").array(),
  regions: text("regions").array(),
  fromDate: text("from_date"),
  minRelevance: integer("min_relevance"),
  sortBy: text("sort_by").default("newest"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_filter_prefs_user").on(table.userId),
}));

export const summaryPeriodEnum = pgEnum("docktalk_summary_period", ["daily", "weekly"]);

export const categorySummaries = pgTable("docktalk_category_summaries", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  period: summaryPeriodEnum("period").notNull(),
  summaryText: text("summary_text").notNull(),
  keyTrends: text("key_trends").array(),
  articleCount: integer("article_count").notNull().default(0),
  avgRelevance: integer("avg_relevance"),
  topSources: text("top_sources").array(),
  comparisonText: text("comparison_text"),
  previousPeriodCount: integer("previous_period_count"),
  growthPercentage: integer("growth_percentage"),
  generatedAt: timestamp("generated_at").defaultNow(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  isEdited: boolean("is_edited").default(false),
  editedBy: varchar("edited_by").references(() => users.id),
  editedAt: timestamp("edited_at"),
}, (table) => ({
  byCategory: index("idx_docktalk_summaries_category").on(table.category),
  byPeriod: index("idx_docktalk_summaries_period").on(table.period),
  byGeneratedAt: index("idx_docktalk_summaries_generated").on(table.generatedAt),
  uniqueCategoryPeriod: uniqueIndex("idx_docktalk_summaries_unique").on(table.category, table.period, table.periodStart),
}));

export const summaryEdits = pgTable("docktalk_summary_edits", {
  id: serial("id").primaryKey(),
  summaryId: integer("summary_id").notNull().references(() => categorySummaries.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  originalText: text("original_text").notNull(),
  editedText: text("edited_text").notNull(),
  editReason: text("edit_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  bySummary: index("idx_docktalk_edits_summary").on(table.summaryId),
  byUser: index("idx_docktalk_edits_user").on(table.userId),
  byCreatedAt: index("idx_docktalk_edits_created").on(table.createdAt),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
}).extend({
  role: z.enum(["admin", "analyst", "partner", "viewer"]).default("viewer"),
  subscriptionTier: z.enum(["free", "pro"]).default("free"),
});

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRssSourceSchema = createInsertSchema(rssSources).omit({
  id: true,
  createdAt: true,
  lastFetched: true,
  lastScrapedAt: true,
}).partial({
  sourceType: true,
});

export const insertSavedFilterSchema = createInsertSchema(savedFilters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastAlertSent: true,
});

export const insertUserArticleAnnotationSchema = createInsertSchema(userArticleAnnotations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioCompanySchema = createInsertSchema(portfolioCompanies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  sentAt: true,
});

export const insertArticleFingerprintSchema = createInsertSchema(articleFingerprints).omit({
  id: true,
  createdAt: true,
});

export const insertArticleDuplicateSchema = createInsertSchema(articleDuplicates).omit({
  id: true,
  createdAt: true,
});

export const insertArticleRemovalPatternSchema = createInsertSchema(articleRemovalPatterns).omit({
  id: true,
  removedAt: true,
});

export const insertUserNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSentAt: true,
});

export const insertUserFilterPreferencesSchema = createInsertSchema(userFilterPreferences).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEntitySchema = createInsertSchema(entities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertArticleEntitySchema = createInsertSchema(articleEntities).omit({
  id: true,
  createdAt: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastAlertSent: true,
});

export const insertWatchlistEntitySchema = createInsertSchema(watchlistEntities).omit({
  id: true,
  addedAt: true,
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCategorySummarySchema = createInsertSchema(categorySummaries).omit({
  id: true,
  generatedAt: true,
  editedAt: true,
});

export const insertSummaryEditSchema = createInsertSchema(summaryEdits).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreferences = z.infer<typeof insertUserNotificationPreferencesSchema>;
export type Article = typeof articles.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type RssSource = typeof rssSources.$inferSelect;
export type InsertRssSource = z.infer<typeof insertRssSourceSchema>;
export type SavedFilter = typeof savedFilters.$inferSelect;
export type InsertSavedFilter = z.infer<typeof insertSavedFilterSchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type UserArticleAnnotation = typeof userArticleAnnotations.$inferSelect;
export type InsertUserArticleAnnotation = z.infer<typeof insertUserArticleAnnotationSchema>;
export type PortfolioCompany = typeof portfolioCompanies.$inferSelect;
export type InsertPortfolioCompany = z.infer<typeof insertPortfolioCompanySchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type SystemStats = typeof systemStats.$inferSelect;
export type Entity = typeof entities.$inferSelect;
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type ArticleEntity = typeof articleEntities.$inferSelect;
export type InsertArticleEntity = z.infer<typeof insertArticleEntitySchema>;
export type ArticleFingerprint = typeof articleFingerprints.$inferSelect;
export type InsertArticleFingerprint = z.infer<typeof insertArticleFingerprintSchema>;
export type ArticleDuplicate = typeof articleDuplicates.$inferSelect;
export type InsertArticleDuplicate = z.infer<typeof insertArticleDuplicateSchema>;
export type ArticleRemovalPattern = typeof articleRemovalPatterns.$inferSelect;
export type InsertArticleRemovalPattern = z.infer<typeof insertArticleRemovalPatternSchema>;
export type UserFilterPreferences = typeof userFilterPreferences.$inferSelect;
export type InsertUserFilterPreferences = z.infer<typeof insertUserFilterPreferencesSchema>;
export type Watchlist = typeof watchlists.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type WatchlistEntity = typeof watchlistEntities.$inferSelect;
export type InsertWatchlistEntity = z.infer<typeof insertWatchlistEntitySchema>;
export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type CategorySummary = typeof categorySummaries.$inferSelect;
export type InsertCategorySummary = z.infer<typeof insertCategorySummarySchema>;
export type SummaryEdit = typeof summaryEdits.$inferSelect;
export type InsertSummaryEdit = z.infer<typeof insertSummaryEditSchema>;
