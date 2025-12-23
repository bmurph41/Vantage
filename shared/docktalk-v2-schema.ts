import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, index, serial, boolean, jsonb, pgEnum, uniqueIndex, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const dt2SourceTypeEnum = pgEnum("dt2_source_type", ["rss", "sitemap", "html"]);
export const dt2SourceStatusEnum = pgEnum("dt2_source_status", ["active", "paused"]);
export const dt2RunStatusEnum = pgEnum("dt2_run_status", ["running", "success", "failed", "partial"]);
export const dt2DiscoveryMethodEnum = pgEnum("dt2_discovery_method", ["rss", "sitemap", "crawl"]);
export const dt2DiscoveredUrlStatusEnum = pgEnum("dt2_discovered_url_status", ["pending", "fetched", "skipped", "error"]);
export const dt2RelevanceLabelEnum = pgEnum("dt2_relevance_label", ["high", "medium", "low"]);
export const dt2FeedbackActionEnum = pgEnum("dt2_feedback_action", ["saved", "opened", "dismissed"]);
export const dt2RunEventLevelEnum = pgEnum("dt2_run_event_level", ["info", "warn", "error"]);

export type Dt2CrawlPolicy = {
  maxPagesPerRun: number;
  maxDepth: number;
  concurrency: number;
  minDelayMs: number;
  respectRobotsTxt: boolean;
};

export type Dt2ContentSelectors = {
  title?: string;
  content?: string;
  author?: string;
  date?: string;
  image?: string;
};

export type Dt2ScoreBreakdown = {
  embedding_similarity: number;
  keyword_score: number;
  quality_score: number;
  recency_score: number;
  feedback_score: number;
  source_trust_score: number;
  exclude_hit?: boolean;
  penalties?: string[];
};

export type Dt2RunMetrics = {
  discovered: number;
  fetched_ok: number;
  fetched_fail: number;
  extracted_ok: number;
  deduped: number;
  embedded: number;
  high_relevance: number;
  medium_relevance: number;
  low_relevance: number;
  duration_ms: number;
};

export const dt2Sources = pgTable("dt2_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  orgId: varchar("org_id").notNull(),
  name: text("name").notNull(),
  type: dt2SourceTypeEnum("type").notNull(),
  baseUrl: text("base_url").notNull(),
  discoveryUrl: text("discovery_url").notNull(),
  allowPatterns: text("allow_patterns").array(),
  denyPatterns: text("deny_patterns").array(),
  contentSelectors: jsonb("content_selectors").$type<Dt2ContentSelectors>(),
  crawlPolicy: jsonb("crawl_policy").$type<Dt2CrawlPolicy>().notNull().default({
    maxPagesPerRun: 50,
    maxDepth: 2,
    concurrency: 2,
    minDelayMs: 1000,
    respectRobotsTxt: true,
  }),
  headersEncrypted: text("headers_encrypted"),
  status: dt2SourceStatusEnum("status").notNull().default("active"),
  trustScore: integer("trust_score").default(100),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  byUser: index("idx_dt2_sources_user").on(table.userId),
  byOrg: index("idx_dt2_sources_org").on(table.orgId),
  byStatus: index("idx_dt2_sources_status").on(table.status),
}));

export const dt2Runs = pgTable("dt2_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  orgId: varchar("org_id").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  status: dt2RunStatusEnum("status").notNull().default("running"),
  metrics: jsonb("metrics").$type<Dt2RunMetrics>(),
  triggeredBy: text("triggered_by").default("scheduler"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  byUser: index("idx_dt2_runs_user").on(table.userId),
  byOrg: index("idx_dt2_runs_org").on(table.orgId),
  byStatus: index("idx_dt2_runs_status").on(table.status),
  byStarted: index("idx_dt2_runs_started").on(table.startedAt),
}));

export const dt2DiscoveredUrls = pgTable("dt2_discovered_urls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => dt2Runs.id, { onDelete: "cascade" }),
  sourceId: varchar("source_id").notNull().references(() => dt2Sources.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  normalizedUrl: text("normalized_url").notNull(),
  discoveredAt: timestamp("discovered_at").notNull().defaultNow(),
  discoveryMethod: dt2DiscoveryMethodEnum("discovery_method").notNull(),
  depth: integer("depth"),
  status: dt2DiscoveredUrlStatusEnum("status").notNull().default("pending"),
  skipReason: text("skip_reason"),
}, (table) => ({
  byRun: index("idx_dt2_discovered_urls_run").on(table.runId),
  bySource: index("idx_dt2_discovered_urls_source").on(table.sourceId),
  byNormalized: index("idx_dt2_discovered_urls_normalized").on(table.normalizedUrl),
  byStatus: index("idx_dt2_discovered_urls_status").on(table.status),
}));

export const dt2Fetches = pgTable("dt2_fetches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => dt2Runs.id, { onDelete: "cascade" }),
  sourceId: varchar("source_id").notNull().references(() => dt2Sources.id, { onDelete: "cascade" }),
  discoveredUrlId: varchar("discovered_url_id").references(() => dt2DiscoveredUrls.id),
  url: text("url").notNull(),
  finalUrl: text("final_url"),
  statusCode: integer("status_code"),
  mimeType: text("mime_type"),
  etag: text("etag"),
  lastModified: text("last_modified"),
  headersHash: text("headers_hash"),
  contentHash: text("content_hash"),
  bytes: integer("bytes"),
  fetchMs: integer("fetch_ms"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  error: text("error"),
}, (table) => ({
  byRun: index("idx_dt2_fetches_run").on(table.runId),
  byContentHash: index("idx_dt2_fetches_content_hash").on(table.contentHash),
  byFinalUrl: index("idx_dt2_fetches_final_url").on(table.finalUrl),
}));

export const dt2Articles = pgTable("dt2_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  canonicalUrl: text("canonical_url").unique(),
  title: text("title").notNull(),
  author: text("author"),
  publishedAt: timestamp("published_at"),
  mainText: text("main_text").notNull(),
  htmlFragment: text("html_fragment"),
  language: text("language"),
  wordCount: integer("word_count").notNull().default(0),
  contentHash: text("content_hash").notNull().unique(),
  titleHash: text("title_hash").notNull(),
  topKeywords: text("top_keywords").array(),
  readingTimeMinutes: integer("reading_time_minutes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  byContentHash: index("idx_dt2_articles_content_hash").on(table.contentHash),
  byTitleHash: index("idx_dt2_articles_title_hash").on(table.titleHash),
  byPublished: index("idx_dt2_articles_published").on(table.publishedAt),
  byCreated: index("idx_dt2_articles_created").on(table.createdAt),
}));

export const dt2ArticleSources = pgTable("dt2_article_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => dt2Articles.id, { onDelete: "cascade" }),
  sourceId: varchar("source_id").notNull().references(() => dt2Sources.id, { onDelete: "cascade" }),
  firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
}, (table) => ({
  byArticle: index("idx_dt2_article_sources_article").on(table.articleId),
  bySource: index("idx_dt2_article_sources_source").on(table.sourceId),
  uniqueArticleSource: uniqueIndex("idx_dt2_article_sources_unique").on(table.articleId, table.sourceId),
}));

export const dt2Embeddings = pgTable("dt2_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  articleId: varchar("article_id").notNull().references(() => dt2Articles.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  dims: integer("dims").notNull(),
  vector: jsonb("vector").$type<number[]>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  byArticle: index("idx_dt2_embeddings_article").on(table.articleId),
  uniqueArticleProvider: uniqueIndex("idx_dt2_embeddings_unique").on(table.articleId, table.provider, table.model),
}));

export const dt2Clusters = pgTable("dt2_clusters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clusterKey: text("cluster_key").notNull().unique(),
  representativeArticleId: varchar("representative_article_id").references(() => dt2Articles.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  byClusterKey: index("idx_dt2_clusters_key").on(table.clusterKey),
}));

export const dt2ClusterMembers = pgTable("dt2_cluster_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clusterId: varchar("cluster_id").notNull().references(() => dt2Clusters.id, { onDelete: "cascade" }),
  articleId: varchar("article_id").notNull().references(() => dt2Articles.id, { onDelete: "cascade" }),
  similarity: real("similarity").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  byCluster: index("idx_dt2_cluster_members_cluster").on(table.clusterId),
  byArticle: index("idx_dt2_cluster_members_article").on(table.articleId),
  uniqueClusterArticle: uniqueIndex("idx_dt2_cluster_members_unique").on(table.clusterId, table.articleId),
}));

export const dt2Relevance = pgTable("dt2_relevance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  orgId: varchar("org_id").notNull(),
  articleId: varchar("article_id").notNull().references(() => dt2Articles.id, { onDelete: "cascade" }),
  relevanceScore: integer("relevance_score").notNull(),
  relevanceLabel: dt2RelevanceLabelEnum("relevance_label").notNull(),
  scoreBreakdown: jsonb("score_breakdown").$type<Dt2ScoreBreakdown>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  byUser: index("idx_dt2_relevance_user").on(table.userId),
  byArticle: index("idx_dt2_relevance_article").on(table.articleId),
  byScore: index("idx_dt2_relevance_score").on(table.relevanceScore),
  byLabel: index("idx_dt2_relevance_label").on(table.relevanceLabel),
  uniqueUserArticle: uniqueIndex("idx_dt2_relevance_unique").on(table.userId, table.articleId),
}));

export const dt2UserRules = pgTable("dt2_user_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  orgId: varchar("org_id").notNull(),
  includeKeywords: text("include_keywords").array().default(sql`ARRAY[]::text[]`),
  excludeKeywords: text("exclude_keywords").array().default(sql`ARRAY[]::text[]`),
  includeEntities: text("include_entities").array().default(sql`ARRAY[]::text[]`),
  excludeEntities: text("exclude_entities").array().default(sql`ARRAY[]::text[]`),
  topicStatement: text("topic_statement"),
  minScore: integer("min_score").notNull().default(60),
  cachedTopicEmbedding: jsonb("cached_topic_embedding").$type<number[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  byUser: index("idx_dt2_user_rules_user").on(table.userId),
  byOrg: index("idx_dt2_user_rules_org").on(table.orgId),
}));

export const dt2Feedback = pgTable("dt2_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  orgId: varchar("org_id").notNull(),
  articleId: varchar("article_id").notNull().references(() => dt2Articles.id, { onDelete: "cascade" }),
  action: dt2FeedbackActionEnum("action").notNull(),
  weight: integer("weight").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  byUser: index("idx_dt2_feedback_user").on(table.userId),
  byArticle: index("idx_dt2_feedback_article").on(table.articleId),
  uniqueUserArticleAction: uniqueIndex("idx_dt2_feedback_unique").on(table.userId, table.articleId, table.action),
}));

export const dt2RunEvents = pgTable("dt2_run_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => dt2Runs.id, { onDelete: "cascade" }),
  level: dt2RunEventLevelEnum("level").notNull(),
  eventType: text("event_type").notNull(),
  message: text("message").notNull(),
  context: jsonb("context"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  byRun: index("idx_dt2_run_events_run").on(table.runId),
  byLevel: index("idx_dt2_run_events_level").on(table.level),
  byCreated: index("idx_dt2_run_events_created").on(table.createdAt),
}));

export const insertDt2SourceSchema = createInsertSchema(dt2Sources).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDt2RunSchema = createInsertSchema(dt2Runs).omit({ id: true, createdAt: true });
export const insertDt2DiscoveredUrlSchema = createInsertSchema(dt2DiscoveredUrls).omit({ id: true, discoveredAt: true });
export const insertDt2FetchSchema = createInsertSchema(dt2Fetches).omit({ id: true, fetchedAt: true });
export const insertDt2ArticleSchema = createInsertSchema(dt2Articles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDt2EmbeddingSchema = createInsertSchema(dt2Embeddings).omit({ id: true, createdAt: true });
export const insertDt2RelevanceSchema = createInsertSchema(dt2Relevance).omit({ id: true, createdAt: true });
export const insertDt2UserRulesSchema = createInsertSchema(dt2UserRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDt2FeedbackSchema = createInsertSchema(dt2Feedback).omit({ id: true, createdAt: true });
export const insertDt2RunEventSchema = createInsertSchema(dt2RunEvents).omit({ id: true, createdAt: true });

export type Dt2Source = typeof dt2Sources.$inferSelect;
export type InsertDt2Source = z.infer<typeof insertDt2SourceSchema>;
export type Dt2Run = typeof dt2Runs.$inferSelect;
export type InsertDt2Run = z.infer<typeof insertDt2RunSchema>;
export type Dt2DiscoveredUrl = typeof dt2DiscoveredUrls.$inferSelect;
export type Dt2Fetch = typeof dt2Fetches.$inferSelect;
export type Dt2Article = typeof dt2Articles.$inferSelect;
export type InsertDt2Article = z.infer<typeof insertDt2ArticleSchema>;
export type Dt2Embedding = typeof dt2Embeddings.$inferSelect;
export type Dt2Cluster = typeof dt2Clusters.$inferSelect;
export type Dt2ClusterMember = typeof dt2ClusterMembers.$inferSelect;
export type Dt2Relevance = typeof dt2Relevance.$inferSelect;
export type InsertDt2Relevance = z.infer<typeof insertDt2RelevanceSchema>;
export type Dt2UserRules = typeof dt2UserRules.$inferSelect;
export type InsertDt2UserRules = z.infer<typeof insertDt2UserRulesSchema>;
export type Dt2Feedback = typeof dt2Feedback.$inferSelect;
export type Dt2RunEvent = typeof dt2RunEvents.$inferSelect;
