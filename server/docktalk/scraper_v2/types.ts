import type { Dt2Source, Dt2CrawlPolicy, Dt2ContentSelectors, Dt2ScoreBreakdown } from '@shared/docktalk-v2-schema';

export interface DiscoveredCandidate {
  url: string;
  normalizedUrl: string;
  discoveryMethod: 'rss' | 'sitemap' | 'crawl';
  depth?: number;
  title?: string;
  publishedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  mimeType: string;
  etag?: string;
  lastModified?: string;
  headersHash: string;
  contentHash: string;
  content: string;
  bytes: number;
  fetchMs: number;
  error?: string;
}

export interface ExtractedArticle {
  canonicalUrl?: string;
  title: string;
  author?: string;
  publishedAt?: Date;
  mainText: string;
  htmlFragment?: string;
  language?: string;
  wordCount: number;
  contentHash: string;
  titleHash: string;
  topKeywords: string[];
  readingTimeMinutes: number;
}

export interface ScoringContext {
  userId: string;
  orgId: string;
  rules: UserRulesContext;
  feedbackStats: FeedbackStats;
}

export interface UserRulesContext {
  includeKeywords: string[];
  excludeKeywords: string[];
  includeEntities: string[];
  excludeEntities: string[];
  topicStatement?: string;
  topicEmbedding?: number[];
  minScore: number;
}

export interface FeedbackStats {
  savedTopics: string[];
  dismissedPatterns: string[];
  savedKeywords: string[];
}

export interface RelevanceResult {
  score: number;
  label: 'high' | 'medium' | 'low';
  breakdown: Dt2ScoreBreakdown;
}

export interface RunMetricsAccumulator {
  discovered: number;
  fetched_ok: number;
  fetched_fail: number;
  extracted_ok: number;
  deduped: number;
  embedded: number;
  high_relevance: number;
  medium_relevance: number;
  low_relevance: number;
  startTime: number;
}

export interface IngestionRunContext {
  runId: string;
  userId: string;
  orgId: string;
  metrics: RunMetricsAccumulator;
  signal?: AbortSignal;
}

export interface EmbeddingProvider {
  name: string;
  model: string;
  dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number;
}

export interface RobotsRules {
  userAgent: string;
  allowed: RegExp[];
  disallowed: RegExp[];
  crawlDelay?: number;
  sitemaps: string[];
}
