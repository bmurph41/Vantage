import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, index, serial, boolean, jsonb, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("docktalk_user_role", ["admin", "analyst", "partner", "viewer"]);
export const subscriptionTierEnum = pgEnum("docktalk_subscription_tier", ["free", "pro"]);
export const regionEnum = pgEnum("docktalk_region", ["US/Domestic", "International"]);
export const featureTierEnum = pgEnum("docktalk_feature_tier", ["docktalk_free", "docktalk_pro"]);

// Organization Features - tracks which organizations have DockTalk enabled
export const organizationFeatures = pgTable("organization_features", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().unique(), // References MarinaMatch organizations.id (not enforced by FK to avoid circular dependency)
  feature: text("feature").notNull().default("docktalk"), // Feature identifier
  tier: featureTierEnum("tier").notNull().default("docktalk_free"),
  activatedAt: timestamp("activated_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // null = no expiration
  isActive: boolean("is_active").notNull().default(true),
  billingMetadata: jsonb("billing_metadata"), // For future billing integration
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  byOrg: index("idx_org_features_org").on(table.orgId),
  byFeature: index("idx_org_features_feature").on(table.feature),
}));

// DockTalk Users - shadow records linked to MarinaMatch users
export const users = pgTable("docktalk_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Link to MarinaMatch user (null for standalone DockTalk users if we ever support that)
  marinaUserId: varchar("marina_user_id"), // References MarinaMatch users.id
  orgId: varchar("org_id"), // References MarinaMatch organizations.id
  // Standalone DockTalk credentials (nullable for MarinaMatch users)
  username: text("username").unique(),
  password: text("password"),
  email: text("email"),
  // DockTalk-specific fields
  role: userRoleEnum("role").notNull().default("viewer"),
  subscriptionTier: subscriptionTierEnum("subscription_tier").notNull().default("free"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byMarinaUser: index("idx_docktalk_users_marina").on(table.marinaUserId),
  byOrg: index("idx_docktalk_users_org").on(table.orgId),
}));

export const alertFrequencyEnum = pgEnum("docktalk_alert_frequency", ["none", "immediate", "daily", "weekly"]);

export const userNotificationPreferences = pgTable("docktalk_user_notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(), // Organization scope for multi-tenancy
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
  byOrg: index("idx_docktalk_notification_prefs_org").on(table.orgId),
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

// Structured location type for watchlist criteria
export type WatchlistLocation = {
  type: 'city' | 'zip' | 'county' | 'state' | 'region';
  value: string;
};

export type WatchlistCriteria = {
  entities?: string[];
  categories?: string[];
  locations?: string[]; // Legacy simple locations for backward compatibility
  structuredLocations?: WatchlistLocation[]; // New structured locations
};

export const watchlists = pgTable("docktalk_watchlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(), // Organization scope for multi-tenancy
  name: text("name").notNull(),
  description: text("description"),
  criteria: jsonb("criteria").$type<WatchlistCriteria>(),
  alertFrequency: alertFrequencyEnum("alert_frequency").notNull().default("none"),
  lastAlertSent: timestamp("last_alert_sent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_watchlists_user").on(table.userId),
  byOrg: index("idx_docktalk_watchlists_org").on(table.orgId),
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
  consecutiveFailures: integer("consecutive_failures").default(0),
  lastFailureAt: timestamp("last_failure_at"),
  lastSuccessAt: timestamp("last_success_at"),
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
  orgId: varchar("org_id").notNull(), // Organization scope for multi-tenancy
  name: text("name").notNull(),
  criteria: text("criteria").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_saved_filters_user").on(table.userId),
  byOrg: index("idx_docktalk_saved_filters_org").on(table.orgId),
}));

export const savedSearches = pgTable("docktalk_saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull(), // Organization scope for multi-tenancy
  name: text("name").notNull(),
  criteria: jsonb("criteria").notNull(),
  alertFrequency: text("alert_frequency").notNull().default("none"),
  lastAlertSent: timestamp("last_alert_sent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_saved_searches_user").on(table.userId),
  byOrg: index("idx_docktalk_saved_searches_org").on(table.orgId),
}));

export const userArticleAnnotations = pgTable("docktalk_user_article_annotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull(), // Organization scope for multi-tenancy
  articleId: integer("article_id").notNull().references(() => articles.id),
  customTags: text("custom_tags").array(),
  privateNotes: text("private_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_annotations_user").on(table.userId),
  byArticle: index("idx_docktalk_annotations_article").on(table.articleId),
  byOrg: index("idx_docktalk_annotations_org").on(table.orgId),
  uniqueUserArticle: index("idx_docktalk_annotations_user_article").on(table.userId, table.articleId),
}));

// DockTalk Article-CRM Entity Links (Phase 4A - Cross-Module Integration)
// Junction table linking DockTalk articles to CRM entities (contacts, companies, properties)
export const docktalkCrmEntityLinkTypeEnum = pgEnum("docktalk_crm_entity_link_type", [
  "contact",
  "company", 
  "property",
  "deal"
]);

export const articleCrmLinks = pgTable("docktalk_article_crm_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(), // Organization scope for multi-tenancy
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  entityType: docktalkCrmEntityLinkTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(), // References crmContacts.id, crmCompanies.id, crmProperties.id, or crmDeals.id
  linkSource: text("link_source").notNull().default("manual"), // "manual" | "ai_detected" | "keyword_match"
  confidence: integer("confidence").default(100), // 0-100 confidence score for AI-detected links
  notes: text("notes"),
  createdBy: varchar("created_by"), // User who created the link (null for AI-detected)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  byOrg: index("idx_docktalk_crm_links_org").on(table.orgId),
  byArticle: index("idx_docktalk_crm_links_article").on(table.articleId),
  byEntity: index("idx_docktalk_crm_links_entity").on(table.entityType, table.entityId),
  uniqueArticleEntity: uniqueIndex("idx_docktalk_crm_links_unique").on(table.articleId, table.entityType, table.entityId),
}));

export const companyTypeEnum = pgEnum("docktalk_company_type", [
  "marina_operator", 
  "marina_owner", 
  "boat_dealer", 
  "marine_services", 
  "yacht_club", 
  "boatyard", 
  "marine_retail",
  "marine_finance",
  "other"
]);

export const relationshipStageEnum = pgEnum("docktalk_relationship_stage", [
  "tracking",
  "interested", 
  "in_pipeline",
  "portfolio_holding",
  "exited"
]);

export const alertSensitivityEnum = pgEnum("docktalk_alert_sensitivity", [
  "all_mentions",
  "headlines_only",
  "high_relevance"
]);

export const portfolioCompanies = pgTable("docktalk_portfolio_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull(), // Organization scope for multi-tenancy
  companyName: text("company_name").notNull(),
  aliases: text("aliases").array(),
  sector: text("sector"),
  region: text("region"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  crmCompanyId: varchar("crm_company_id"), // Links to CRM companies.id (not enforced by FK to avoid circular dependency)
  crmLinkStatus: text("crm_link_status").default("unlinked"), // unlinked, linked, pending_review
  
  // New classification fields
  companyType: companyTypeEnum("company_type"),
  relationshipStage: relationshipStageEnum("relationship_stage").default("tracking"),
  geographyFocus: text("geography_focus").array(), // Array of regions/states
  website: text("website"),
  parentCompany: text("parent_company"),
  
  // News monitoring fields
  watchKeywords: text("watch_keywords").array(), // Additional keywords to match
  excludedTerms: text("excluded_terms").array(), // Terms to filter out
  
  // Alert configuration
  alertFrequency: alertFrequencyEnum("alert_frequency").default("daily"),
  alertChannels: text("alert_channels").array().default(sql`ARRAY['in_app']::text[]`), // in_app, email
  alertSensitivity: alertSensitivityEnum("alert_sensitivity").default("all_mentions"),
  lastAlertSent: timestamp("last_alert_sent"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_portfolio_user").on(table.userId),
  byCompany: index("idx_docktalk_portfolio_company").on(table.companyName),
  byOrg: index("idx_docktalk_portfolio_org").on(table.orgId),
  byCrmCompany: index("idx_docktalk_portfolio_crm_company").on(table.crmCompanyId),
  byCompanyType: index("idx_docktalk_portfolio_company_type").on(table.companyType),
  byRelationshipStage: index("idx_docktalk_portfolio_relationship_stage").on(table.relationshipStage),
}));

export const notificationSourceEnum = pgEnum("docktalk_notification_source", ["saved_search", "category_alert"]);

export const notifications = pgTable("docktalk_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull(), // Organization scope for multi-tenancy
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
  byOrg: index("idx_docktalk_notifications_org").on(table.orgId),
  bySavedSearch: index("idx_docktalk_notifications_search").on(table.savedSearchId),
  bySource: index("idx_docktalk_notifications_source").on(table.source),
  bySentAt: index("idx_docktalk_notifications_sent_at").on(table.sentAt),
}));

export const userFilterPreferences = pgTable("docktalk_user_filter_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(), // Organization scope for multi-tenancy
  categories: text("categories").array(),
  sources: text("sources").array(),
  regions: text("regions").array(),
  fromDate: text("from_date"),
  minRelevance: integer("min_relevance"),
  sortBy: text("sort_by").default("newest"),
  customGeographyRegions: text("custom_geography_regions").array(), // User-defined custom geography regions for portfolio companies
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_filter_prefs_user").on(table.userId),
  byOrg: index("idx_docktalk_filter_prefs_org").on(table.orgId),
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

export const insertArticleCrmLinkSchema = createInsertSchema(articleCrmLinks).omit({
  id: true,
  createdAt: true,
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

// User Tag Library - custom tags for AI training
export const userTagLibrary = pgTable("docktalk_user_tag_library", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6366f1"), // Tailwind indigo-500
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_tag_library_user").on(table.userId),
  byOrg: index("idx_docktalk_tag_library_org").on(table.orgId),
  uniqueUserTag: uniqueIndex("idx_docktalk_tag_library_unique").on(table.userId, table.name),
}));

// Article Tag Assignments - links articles to user tags for AI training
export const articleTagAssignments = pgTable("docktalk_article_tag_assignments", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => userTagLibrary.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  confidence: integer("confidence").default(100), // User confidence in tag assignment
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  byArticle: index("idx_docktalk_tag_assignments_article").on(table.articleId),
  byTag: index("idx_docktalk_tag_assignments_tag").on(table.tagId),
  byUser: index("idx_docktalk_tag_assignments_user").on(table.userId),
  byOrg: index("idx_docktalk_tag_assignments_org").on(table.orgId),
  uniqueAssignment: uniqueIndex("idx_docktalk_tag_assignments_unique").on(table.articleId, table.tagId, table.userId),
}));

// Article Feedback - user feedback for AI training (irrelevant, duplicate, etc.)
export const articleFeedbackTypeEnum = pgEnum("docktalk_article_feedback_type", ["irrelevant", "duplicate", "low_quality", "wrong_category", "spam", "helpful"]);

export const articleFeedback = pgTable("docktalk_article_feedback", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  feedbackType: articleFeedbackTypeEnum("feedback_type").notNull(),
  reason: text("reason"),
  suggestedCategory: text("suggested_category"),
  duplicateOfArticleId: integer("duplicate_of_article_id").references(() => articles.id),
  processedByAi: boolean("processed_by_ai").default(false),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  byArticle: index("idx_docktalk_feedback_article").on(table.articleId),
  byUser: index("idx_docktalk_feedback_user").on(table.userId),
  byOrg: index("idx_docktalk_feedback_org").on(table.orgId),
  byType: index("idx_docktalk_feedback_type").on(table.feedbackType),
  uniqueFeedback: uniqueIndex("idx_docktalk_feedback_unique").on(table.articleId, table.userId, table.feedbackType),
}));

// Global Article Engagement Tables - NOT org-scoped for cross-organization trending
export const articleViews = pgTable("docktalk_article_views", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  userId: varchar("user_id"), // Optional - can track anonymous views too
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
  sessionId: varchar("session_id"), // For grouping page views in a session
  referrer: text("referrer"), // Where they came from
}, (table) => ({
  byArticle: index("idx_docktalk_views_article").on(table.articleId),
  byUser: index("idx_docktalk_views_user").on(table.userId),
  byDate: index("idx_docktalk_views_date").on(table.viewedAt),
}));

export const articleLikes = pgTable("docktalk_article_likes", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(), // Must be logged in to like
  likedAt: timestamp("liked_at").notNull().defaultNow(),
}, (table) => ({
  byArticle: index("idx_docktalk_likes_article").on(table.articleId),
  byUser: index("idx_docktalk_likes_user").on(table.userId),
  uniqueLike: uniqueIndex("idx_docktalk_likes_unique").on(table.articleId, table.userId),
}));

export const insertArticleViewSchema = createInsertSchema(articleViews).omit({
  id: true,
  viewedAt: true,
});

export const insertArticleLikeSchema = createInsertSchema(articleLikes).omit({
  id: true,
  likedAt: true,
});

export const insertUserTagLibrarySchema = createInsertSchema(userTagLibrary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

export const insertArticleTagAssignmentSchema = createInsertSchema(articleTagAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertArticleFeedbackSchema = createInsertSchema(articleFeedback).omit({
  id: true,
  createdAt: true,
  processedByAi: true,
  processedAt: true,
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
export type ArticleCrmLink = typeof articleCrmLinks.$inferSelect;
export type InsertArticleCrmLink = z.infer<typeof insertArticleCrmLinkSchema>;
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
export type UserTag = typeof userTagLibrary.$inferSelect;
export type InsertUserTag = z.infer<typeof insertUserTagLibrarySchema>;
export type ArticleTagAssignment = typeof articleTagAssignments.$inferSelect;
export type InsertArticleTagAssignment = z.infer<typeof insertArticleTagAssignmentSchema>;
export type ArticleFeedback = typeof articleFeedback.$inferSelect;
export type InsertArticleFeedback = z.infer<typeof insertArticleFeedbackSchema>;
export type ArticleView = typeof articleViews.$inferSelect;
export type InsertArticleView = z.infer<typeof insertArticleViewSchema>;
export type ArticleLike = typeof articleLikes.$inferSelect;
export type InsertArticleLike = z.infer<typeof insertArticleLikeSchema>;

// ============================================================================
// AI TRAINING SYSTEM - Real-time learning from user feedback
// ============================================================================

// Keyword category for organizing learned keywords
export const keywordCategoryEnum = pgEnum("docktalk_keyword_category", [
  "marina", "investment", "macro", "operational", "regulatory", "negative", "custom"
]);

// AI Keyword Weights - dynamically adjusted based on user feedback
export const aiKeywordWeights = pgTable("docktalk_ai_keyword_weights", {
  id: serial("id").primaryKey(),
  orgId: varchar("org_id").notNull(), // Per-organization learning
  keyword: text("keyword").notNull(),
  category: keywordCategoryEnum("category").notNull().default("custom"),
  baseWeight: integer("base_weight").notNull().default(5), // Initial weight (1-20)
  currentWeight: integer("current_weight").notNull().default(5), // Adjusted weight
  positiveSignals: integer("positive_signals").notNull().default(0), // Helpful votes
  negativeSignals: integer("negative_signals").notNull().default(0), // Irrelevant votes
  confidenceScore: integer("confidence_score").notNull().default(50), // 0-100 confidence
  isActive: boolean("is_active").notNull().default(true),
  isUserDefined: boolean("is_user_defined").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byOrg: index("idx_docktalk_keyword_weights_org").on(table.orgId),
  byCategory: index("idx_docktalk_keyword_weights_category").on(table.category),
  byKeyword: index("idx_docktalk_keyword_weights_keyword").on(table.keyword),
  uniqueOrgKeyword: uniqueIndex("idx_docktalk_keyword_weights_unique").on(table.orgId, table.keyword),
}));

// AI Source Adjustments - per-source accuracy adjustments
export const aiSourceAdjustments = pgTable("docktalk_ai_source_adjustments", {
  id: serial("id").primaryKey(),
  orgId: varchar("org_id").notNull(),
  sourceName: text("source_name").notNull(), // RSS source name
  sourceUrl: text("source_url"), // Source URL for matching
  baseRelevanceBonus: integer("base_relevance_bonus").notNull().default(0), // -50 to +50
  currentRelevanceBonus: integer("current_relevance_bonus").notNull().default(0),
  totalArticles: integer("total_articles").notNull().default(0),
  helpfulArticles: integer("helpful_articles").notNull().default(0),
  irrelevantArticles: integer("irrelevant_articles").notNull().default(0),
  accuracyRate: integer("accuracy_rate").notNull().default(50), // 0-100 percentage
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byOrg: index("idx_docktalk_source_adj_org").on(table.orgId),
  bySource: index("idx_docktalk_source_adj_source").on(table.sourceName),
  uniqueOrgSource: uniqueIndex("idx_docktalk_source_adj_unique").on(table.orgId, table.sourceName),
}));

// AI Learning Rules - patterns learned from user corrections
export const aiLearningRules = pgTable("docktalk_ai_learning_rules", {
  id: serial("id").primaryKey(),
  orgId: varchar("org_id").notNull(),
  ruleType: text("rule_type").notNull(), // "include", "exclude", "boost", "penalize"
  pattern: text("pattern").notNull(), // Regex or keyword pattern
  patternType: text("pattern_type").notNull().default("keyword"), // "keyword", "regex", "source", "category"
  scoreAdjustment: integer("score_adjustment").notNull().default(0), // -50 to +50
  timesApplied: integer("times_applied").notNull().default(0),
  timesValidated: integer("times_validated").notNull().default(0), // User confirmed correct
  timesOverridden: integer("times_overridden").notNull().default(0), // User said wrong
  confidenceScore: integer("confidence_score").notNull().default(50),
  isActive: boolean("is_active").notNull().default(true),
  learnedFromFeedbackId: integer("learned_from_feedback_id").references(() => articleFeedback.id),
  learnedFromArticleId: integer("learned_from_article_id").references(() => articles.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byOrg: index("idx_docktalk_learning_rules_org").on(table.orgId),
  byType: index("idx_docktalk_learning_rules_type").on(table.ruleType),
  byPattern: index("idx_docktalk_learning_rules_pattern").on(table.pattern),
}));

// AI Training Sessions - track training progress over time
export const aiTrainingSessions = pgTable("docktalk_ai_training_sessions", {
  id: serial("id").primaryKey(),
  orgId: varchar("org_id").notNull(),
  sessionType: text("session_type").notNull().default("feedback_processing"), // "feedback_processing", "batch_review", "rule_refinement"
  feedbackProcessed: integer("feedback_processed").notNull().default(0),
  keywordsUpdated: integer("keywords_updated").notNull().default(0),
  sourcesUpdated: integer("sources_updated").notNull().default(0),
  rulesCreated: integer("rules_created").notNull().default(0),
  rulesUpdated: integer("rules_updated").notNull().default(0),
  accuracyBefore: integer("accuracy_before"), // Estimated accuracy before training
  accuracyAfter: integer("accuracy_after"), // Estimated accuracy after training
  processedAt: timestamp("processed_at").defaultNow(),
  durationMs: integer("duration_ms"),
  metadata: jsonb("metadata"), // Additional session details
}, (table) => ({
  byOrg: index("idx_docktalk_training_sessions_org").on(table.orgId),
  byDate: index("idx_docktalk_training_sessions_date").on(table.processedAt),
}));

// AI Training Analytics - aggregated stats for dashboard
export const aiTrainingAnalytics = pgTable("docktalk_ai_training_analytics", {
  id: serial("id").primaryKey(),
  orgId: varchar("org_id").notNull().unique(),
  totalFeedback: integer("total_feedback").notNull().default(0),
  helpfulFeedback: integer("helpful_feedback").notNull().default(0),
  irrelevantFeedback: integer("irrelevant_feedback").notNull().default(0),
  duplicateFeedback: integer("duplicate_feedback").notNull().default(0),
  wrongCategoryFeedback: integer("wrong_category_feedback").notNull().default(0),
  totalKeywords: integer("total_keywords").notNull().default(0),
  customKeywords: integer("custom_keywords").notNull().default(0),
  activeRules: integer("active_rules").notNull().default(0),
  estimatedAccuracy: integer("estimated_accuracy").notNull().default(50), // 0-100
  lastTrainingAt: timestamp("last_training_at"),
  articlesScored: integer("articles_scored").notNull().default(0),
  articlesFiltered: integer("articles_filtered").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byOrg: index("idx_docktalk_training_analytics_org").on(table.orgId),
}));

// Insert schemas for AI training tables
export const insertAiKeywordWeightSchema = createInsertSchema(aiKeywordWeights).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertAiSourceAdjustmentSchema = createInsertSchema(aiSourceAdjustments).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertAiLearningRuleSchema = createInsertSchema(aiLearningRules).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertAiTrainingSessionSchema = createInsertSchema(aiTrainingSessions).omit({
  id: true, processedAt: true,
});
export const insertAiTrainingAnalyticsSchema = createInsertSchema(aiTrainingAnalytics).omit({
  id: true, updatedAt: true,
});

// Types for AI training tables
export type AiKeywordWeight = typeof aiKeywordWeights.$inferSelect;
export type InsertAiKeywordWeight = z.infer<typeof insertAiKeywordWeightSchema>;
export type AiSourceAdjustment = typeof aiSourceAdjustments.$inferSelect;
export type InsertAiSourceAdjustment = z.infer<typeof insertAiSourceAdjustmentSchema>;
export type AiLearningRule = typeof aiLearningRules.$inferSelect;
export type InsertAiLearningRule = z.infer<typeof insertAiLearningRuleSchema>;
export type AiTrainingSession = typeof aiTrainingSessions.$inferSelect;
export type InsertAiTrainingSession = z.infer<typeof insertAiTrainingSessionSchema>;
export type AiTrainingAnalytics = typeof aiTrainingAnalytics.$inferSelect;
export type InsertAiTrainingAnalytics = z.infer<typeof insertAiTrainingAnalyticsSchema>;

// ============================================================================
// USER BOOKMARKS & READING LIST
// ============================================================================

// User Bookmarks - per-user article bookmarking with optional notes
export const userBookmarks = pgTable("docktalk_user_bookmarks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_bookmarks_user").on(table.userId),
  byOrg: index("idx_docktalk_bookmarks_org").on(table.orgId),
  byArticle: index("idx_docktalk_bookmarks_article").on(table.articleId),
  uniqueUserArticle: uniqueIndex("idx_docktalk_bookmarks_unique").on(table.userId, table.articleId),
}));

// Reading List Status enum
export const readingListStatusEnum = pgEnum("docktalk_reading_list_status", ["unread", "reading", "completed"]);
export const readingListPriorityEnum = pgEnum("docktalk_reading_list_priority", ["low", "medium", "high"]);

// User Reading List - articles to read later with priority and status tracking
export const userReadingList = pgTable("docktalk_user_reading_list", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  priority: readingListPriorityEnum("priority").notNull().default("medium"),
  status: readingListStatusEnum("status").notNull().default("unread"),
  notes: text("notes"),
  addedAt: timestamp("added_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  byUser: index("idx_docktalk_reading_list_user").on(table.userId),
  byOrg: index("idx_docktalk_reading_list_org").on(table.orgId),
  byArticle: index("idx_docktalk_reading_list_article").on(table.articleId),
  byStatus: index("idx_docktalk_reading_list_status").on(table.status),
  byPriority: index("idx_docktalk_reading_list_priority").on(table.priority),
  uniqueUserArticle: uniqueIndex("idx_docktalk_reading_list_unique").on(table.userId, table.articleId),
}));

// ============================================================================
// M&A DEAL ALERTS
// ============================================================================

// M&A Alert frequency enum
export const maAlertFrequencyEnum = pgEnum("docktalk_ma_alert_frequency", ["immediate", "daily", "weekly"]);

// M&A Alerts - keyword-based deal notification subscriptions
export const maAlerts = pgTable("docktalk_ma_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  name: text("name").notNull(),
  keywords: text("keywords").array().notNull(),
  dealTypes: text("deal_types").array(), // acquisition, merger, sale, investment, partnership
  regions: text("regions").array(),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  pushEnabled: boolean("push_enabled").notNull().default(false),
  frequency: maAlertFrequencyEnum("frequency").notNull().default("daily"),
  isActive: boolean("is_active").notNull().default(true),
  lastTriggeredAt: timestamp("last_triggered_at"),
  matchCount: integer("match_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_ma_alerts_user").on(table.userId),
  byOrg: index("idx_docktalk_ma_alerts_org").on(table.orgId),
  byActive: index("idx_docktalk_ma_alerts_active").on(table.isActive),
}));

// M&A Alert Matches - tracks which articles matched which alerts
export const maAlertMatches = pgTable("docktalk_ma_alert_matches", {
  id: serial("id").primaryKey(),
  alertId: varchar("alert_id").notNull().references(() => maAlerts.id, { onDelete: "cascade" }),
  articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  matchedKeywords: text("matched_keywords").array().notNull(),
  matchScore: integer("match_score").notNull().default(0),
  notified: boolean("notified").notNull().default(false),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  byAlert: index("idx_docktalk_ma_matches_alert").on(table.alertId),
  byArticle: index("idx_docktalk_ma_matches_article").on(table.articleId),
  byNotified: index("idx_docktalk_ma_matches_notified").on(table.notified),
  uniqueAlertArticle: uniqueIndex("idx_docktalk_ma_matches_unique").on(table.alertId, table.articleId),
}));

// ============================================================================
// DIGEST EMAIL PREFERENCES
// ============================================================================

// Digest frequency enum
export const digestFrequencyEnum = pgEnum("docktalk_digest_frequency", ["daily", "weekly"]);
export const digestDayOfWeekEnum = pgEnum("docktalk_digest_day", ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

// Digest Preferences - user preferences for scheduled digest emails
export const digestPreferences = pgTable("docktalk_digest_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  emailAddress: text("email_address").notNull(),
  frequency: digestFrequencyEnum("frequency").notNull().default("daily"),
  dayOfWeek: digestDayOfWeekEnum("day_of_week").default("monday"),
  timeOfDay: text("time_of_day").notNull().default("09:00"),
  timezone: text("timezone").notNull().default("America/New_York"),
  categories: text("categories").array(),
  includeDeals: boolean("include_deals").notNull().default(true),
  includeSummaries: boolean("include_summaries").notNull().default(true),
  includeTrending: boolean("include_trending").notNull().default(true),
  maxArticles: integer("max_articles").notNull().default(10),
  enabled: boolean("enabled").notNull().default(true),
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  byUser: index("idx_docktalk_digest_prefs_user").on(table.userId),
  byOrg: index("idx_docktalk_digest_prefs_org").on(table.orgId),
  byEnabled: index("idx_docktalk_digest_prefs_enabled").on(table.enabled),
  byFrequency: index("idx_docktalk_digest_prefs_frequency").on(table.frequency),
}));

// Insert schemas for new tables
export const insertUserBookmarkSchema = createInsertSchema(userBookmarks).omit({
  id: true,
  createdAt: true,
});

export const insertUserReadingListSchema = createInsertSchema(userReadingList).omit({
  id: true,
  addedAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertMaAlertSchema = createInsertSchema(maAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTriggeredAt: true,
  matchCount: true,
});

export const insertMaAlertMatchSchema = createInsertSchema(maAlertMatches).omit({
  id: true,
  createdAt: true,
  notifiedAt: true,
});

export const insertDigestPreferencesSchema = createInsertSchema(digestPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSentAt: true,
});

// Types for new tables
export type UserBookmark = typeof userBookmarks.$inferSelect;
export type InsertUserBookmark = z.infer<typeof insertUserBookmarkSchema>;
export type UserReadingListItem = typeof userReadingList.$inferSelect;
export type InsertUserReadingListItem = z.infer<typeof insertUserReadingListSchema>;
export type MaAlert = typeof maAlerts.$inferSelect;
export type InsertMaAlert = z.infer<typeof insertMaAlertSchema>;
export type MaAlertMatch = typeof maAlertMatches.$inferSelect;
export type InsertMaAlertMatch = z.infer<typeof insertMaAlertMatchSchema>;
export type DigestPreferences = typeof digestPreferences.$inferSelect;
export type InsertDigestPreferences = z.infer<typeof insertDigestPreferencesSchema>;
