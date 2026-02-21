export interface DealMetadata {
  isDeal: boolean;
  dealType?: 'acquisition' | 'm&a' | 'financing' | 'partnership' | 'expansion' | 'ipo';
  parties?: string[];
  dealValue?: string;
  currency?: string;
  operators?: string[];
  marinas?: string[];
  metrics?: {
    type: string;
    value: string;
  }[];
}

export interface Article {
  id: number;
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  category: string | null; // Legacy - kept for backward compatibility during migration
  categories: string[] | null; // New multi-category support
  tags: string[] | null;
  summary: string | null;
  content: string | null;
  imageUrl: string | null;
  relevanceScore: number | null;
  sentiment: string | null;
  dealMetadata: DealMetadata | null;
  geography: string[] | null;
  region: string | null;
  searchText: string;
  isBookmarked: boolean | null;
  manuallyReviewed: boolean | null;
  originalCategory: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SystemStats {
  id?: number;
  totalArticles: number | null;
  todayArticles: number | null;
  avgRelevance: number | null;
  lastUpdate: string | null;
  rssFeedStatus: string | null;
  scraperStatus: string | null;
  aiStatus: string | null;
  dbStatus: string | null;
}

export interface TrendingTopic {
  topic: string;
  count: number;
  growth: number;
}

export interface CategoryDistribution {
  category: string;
  count: number;
}

export interface SourceDistribution {
  source: string;
  count: number;
  type: 'rss' | 'scraped';
}

export interface ArticleFilters {
  search?: string;
  category?: string; // Legacy single category filter
  categories?: string[]; // New multi-category filter (OR logic)
  source?: string; // Legacy single source filter
  sources?: string[]; // New multi-source filter (OR logic)
  region?: string; // Legacy single region filter
  regions?: string[]; // New multi-region filter (OR logic)
  fromDate?: string;
  toDate?: string;
  minRelevance?: number;
  bookmarked?: boolean; // Filter for saved/bookmarked articles
  limit?: number;
  offset?: number;
  sortBy?: 'newest' | 'relevance';
}
