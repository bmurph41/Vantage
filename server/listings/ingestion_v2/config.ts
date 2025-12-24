export const LIV2_CONFIG = {
  featureFlag: process.env.LISTING_INGESTION_V2 === 'true',
  
  fetch: {
    maxBytes: parseInt(process.env.LISTING_V2_MAX_BYTES || '2000000', 10),
    timeoutMs: parseInt(process.env.LISTING_V2_TIMEOUT_MS || '30000', 10),
    maxRetries: 3,
    retryDelayMs: 1000,
    userAgent: 'MarinaMatch/2.0 (Listing Ingestion; +https://marinamatch.com)',
  },
  
  identity: {
    confidenceThreshold: 75,
    maxCandidatesPerRun: 100,
  },
  
  images: {
    maxImagesPerListing: 50,
    maxImageBytes: 5_000_000,
    downloadTimeout: 30000,
  },
  
  validation: {
    minPrice: 10_000,
    maxPrice: 5_000_000_000,
    maxTitleLength: 500,
    maxDescriptionLength: 50000,
  },
  
  rateLimit: {
    defaultRequestsPerMinute: 20,
    defaultDelayMs: 3000,
  },
  
  extractorVersion: '2.0.0',
};

export function isLiv2Enabled(): boolean {
  return LIV2_CONFIG.featureFlag;
}
