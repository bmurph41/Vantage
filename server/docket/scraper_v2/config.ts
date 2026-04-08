export const V2_CONFIG = {
  enabled: process.env.DOCKET_SCRAPER_V2 === 'true',
  
  scheduler: {
    intervalMinutes: parseInt(process.env.DOCKET_V2_INTERVAL_MIN || '30', 10),
    maxConcurrentRuns: parseInt(process.env.DOCKET_V2_MAX_CONCURRENT || '3', 10),
  },
  
  fetcher: {
    userAgent: process.env.DOCKET_V2_USER_AGENT || 'DocketBot/1.0 (+https://vantage.com)',
    timeoutMs: parseInt(process.env.DOCKET_V2_TIMEOUT_MS || '30000', 10),
    maxRetries: parseInt(process.env.DOCKET_V2_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.DOCKET_V2_RETRY_DELAY_MS || '1000', 10),
    perHostConcurrency: parseInt(process.env.DOCKET_V2_HOST_CONCURRENCY || '2', 10),
    perHostRateLimit: parseInt(process.env.DOCKET_V2_HOST_RATE_LIMIT || '10', 10),
    rateLimitWindowMs: parseInt(process.env.DOCKET_V2_RATE_WINDOW_MS || '60000', 10),
  },
  
  extractor: {
    minWordCount: parseInt(process.env.DOCKET_V2_MIN_WORDS || '50', 10),
    maxContentLength: parseInt(process.env.DOCKET_V2_MAX_CONTENT || '100000', 10),
  },
  
  dedupe: {
    similarityThreshold: parseFloat(process.env.DOCKET_V2_SIMILARITY_THRESHOLD || '0.92'),
    clusterLookbackDays: parseInt(process.env.DOCKET_V2_CLUSTER_LOOKBACK_DAYS || '30', 10),
  },
  
  relevance: {
    embeddingWeight: 55,
    keywordIncludeBonus: 10,
    keywordIncludeCap: 20,
    keywordExcludePenalty: -50,
    qualityMinWords: 150,
    qualityPenalty: -20,
    spamPenalty: -30,
    recency48hBonus: 10,
    recency7dBonus: 5,
    recency30dPenalty: -10,
    feedbackMaxBonus: 15,
    highThreshold: 75,
    mediumThreshold: 60,
  },
  
  embeddings: {
    provider: process.env.EMBEDDINGS_PROVIDER || 'stub',
    model: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
    dimensions: parseInt(process.env.EMBEDDINGS_DIMS || '256', 10),
  },
};

export function isV2Enabled(): boolean {
  return V2_CONFIG.enabled;
}
