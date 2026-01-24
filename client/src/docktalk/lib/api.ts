import { Article, SystemStats, TrendingTopic, CategoryDistribution, SourceDistribution, ArticleFilters } from "../types/article";

const API_BASE = "/api/docktalk";

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function getHeaders(includeContentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  return headers;
}

export async function fetchArticles(filters: ArticleFilters): Promise<Article[]> {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      // Handle array parameters (like categories) by appending each value separately
      if (Array.isArray(value)) {
        value.forEach(item => params.append(key, item.toString()));
      } else {
        params.append(key, value.toString());
      }
    }
  });

  const response = await fetch(`${API_BASE}/articles?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch articles: ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchArticleById(id: number): Promise<Article> {
  const response = await fetch(`${API_BASE}/articles/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.statusText}`);
  }
  
  return response.json();
}

export async function updateBookmarkStatus(id: number, isBookmarked: boolean): Promise<void> {
  const response = await fetch(`${API_BASE}/articles/${id}/bookmark`, {
    method: "PATCH",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify({ isBookmarked }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update bookmark: ${response.statusText}`);
  }
}

export async function fetchSystemStats(): Promise<SystemStats> {
  const response = await fetch(`${API_BASE}/analytics/stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch system stats: ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchTrendingTopics(): Promise<TrendingTopic[]> {
  const response = await fetch(`${API_BASE}/analytics/trending`);
  if (!response.ok) {
    throw new Error(`Failed to fetch trending topics: ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchCategoryDistribution(): Promise<CategoryDistribution[]> {
  const response = await fetch(`${API_BASE}/analytics/categories`, {
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch category distribution: ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchAllCategories(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/categories/all`, {
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch all categories: ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchSourceDistribution(): Promise<SourceDistribution[]> {
  const response = await fetch(`${API_BASE}/analytics/sources`, {
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch source distribution: ${response.statusText}`);
  }
  
  return response.json();
}

export async function triggerManualFetch(): Promise<{ success: boolean; newArticles: number; timestamp: string }> {
  const response = await fetch(`${API_BASE}/rss-sources/fetch`, {
    method: "POST",
    headers: getHeaders(false),
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error(`Failed to trigger manual fetch: ${response.statusText}`);
  }
  
  return response.json();
}

export interface AutoFetchStatus {
  enabled: boolean;
  lastFetch: string | null;
  isFetching: boolean;
  nextFetch: string | null;
}

export async function fetchAutoFetchStatus(): Promise<AutoFetchStatus> {
  const response = await fetch(`${API_BASE}/auto-fetch/status`, {
    credentials: "include"
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch auto-fetch status: ${response.statusText}`);
  }
  
  return response.json();
}

export async function toggleAutoFetch(enabled: boolean): Promise<AutoFetchStatus> {
  const response = await fetch(`${API_BASE}/auto-fetch/toggle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ enabled }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to toggle auto-fetch: ${response.statusText}`);
  }
  
  return response.json();
}

export async function addRssSource(name: string, url: string): Promise<void> {
  const response = await fetch(`${API_BASE}/rss-sources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, url }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to add RSS source: ${response.statusText}`);
  }
}

export interface RssSource {
  id: number;
  name: string;
  sourceType: "rss" | "web_scrape";
  url: string;
  isActive: boolean;
  minRelevanceScore: number;
  customKeywords: string[] | null;
  lastFetched: string | null;
  lastScrapedAt: string | null;
  createdAt: string;
}

export interface PreviewArticle {
  title: string;
  link: string;
  pubDate?: string;
  relevanceScore: number;
}

export interface RssPreviewResponse {
  feedTitle: string;
  feedDescription: string;
  itemCount: number;
  previewArticles: PreviewArticle[];
}

export async function fetchRssSources(): Promise<RssSource[]> {
  const response = await fetch(`${API_BASE}/rss-sources`, {
    credentials: "include",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    const errorMessage = errorData.error || errorData.message || response.statusText;
    throw new Error(`Failed to fetch RSS sources: ${errorMessage}`);
  }
  return response.json();
}

export async function createRssSource(data: {
  name: string;
  sourceType?: "rss" | "web_scrape";
  url: string;
  minRelevanceScore?: number;
  customKeywords?: string[];
}): Promise<RssSource> {
  const response = await fetch(`${API_BASE}/rss-sources`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    const errorMessage = errorData.error || errorData.message || response.statusText;
    throw new Error(`Failed to create RSS source: ${errorMessage}`);
  }
  
  return response.json();
}

export async function updateRssSource(id: number, data: {
  name?: string;
  sourceType?: "rss" | "web_scrape";
  url?: string;
  isActive?: boolean;
  minRelevanceScore?: number;
  customKeywords?: string[];
}): Promise<RssSource> {
  const response = await fetch(`${API_BASE}/rss-sources/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    const errorMessage = errorData.error || errorData.message || response.statusText;
    throw new Error(`Failed to update RSS source: ${errorMessage}`);
  }
  
  return response.json();
}

export async function deleteRssSource(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/rss-sources/${id}`, {
    method: "DELETE",
    headers: getHeaders(false),
    credentials: "include",
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    const errorMessage = errorData.error || errorData.message || response.statusText;
    throw new Error(`Failed to delete RSS source: ${errorMessage}`);
  }
}

export async function previewRssSource(url: string, sourceType: "rss" | "web_scrape" = "rss"): Promise<RssPreviewResponse> {
  const response = await fetch(`${API_BASE}/rss-sources/preview`, {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify({ url, sourceType }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to preview ${sourceType === "web_scrape" ? "web page" : "RSS source"}: ${response.statusText}`);
  }
  
  return response.json();
}

export async function updateArticleCategory(id: number, categories: string[]): Promise<void> {
  const response = await fetch(`${API_BASE}/articles/${id}/category`, {
    method: "PATCH",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify({ categories }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    const errorMessage = errorData.error || response.statusText;
    const details = errorData.details ? ` - ${JSON.stringify(errorData.details)}` : '';
    throw new Error(`Failed to update article category: ${errorMessage}${details}`);
  }
}

export async function updateArticleRegion(id: number, region: string | null): Promise<void> {
  const response = await fetch(`${API_BASE}/articles/${id}/region`, {
    method: "PATCH",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify({ region }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    const errorMessage = errorData.error || response.statusText;
    const details = errorData.details ? ` - ${JSON.stringify(errorData.details)}` : '';
    throw new Error(`Failed to update article region: ${errorMessage}${details}`);
  }
}

export async function exportTrainingData(): Promise<Blob> {
  const response = await fetch(`${API_BASE}/training/export`);
  
  if (!response.ok) {
    throw new Error(`Failed to export training data: ${response.statusText}`);
  }
  
  const data = await response.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  return blob;
}

export async function removeArticle(id: number, reason: string): Promise<void> {
  const response = await fetch(`${API_BASE}/articles/${id}/remove`, {
    method: "POST",
    credentials: "include",
    headers: getHeaders(),
    body: JSON.stringify({ reason }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    const errorMessage = errorData.error || response.statusText;
    throw new Error(`Failed to remove article: ${errorMessage}`);
  }
}

export interface ArticleUpdate {
  title?: string;
  summary?: string;
  categories?: string[];
  region?: "US/Domestic" | "International" | null;
  tags?: string[];
}

export async function updateArticle(id: number, updates: ArticleUpdate): Promise<Article> {
  const response = await fetch(`${API_BASE}/articles/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    const errorMessage = errorData.error || response.statusText;
    throw new Error(`Failed to update article: ${errorMessage}`);
  }
  
  return response.json();
}

export async function deleteArticle(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/articles/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    const errorMessage = errorData.error || response.statusText;
    throw new Error(`Failed to delete article: ${errorMessage}`);
  }
}

// Global Engagement API (cross-organization trending)
export interface TrendingArticle extends Article {
  viewCount: number;
  likeCount: number;
  engagementScore: number;
  isLiked: boolean;
}

export interface EngagementStats {
  viewCount: number;
  likeCount: number;
  isLiked: boolean;
}

export async function recordArticleView(articleId: number, sessionId?: string, referrer?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/articles/${articleId}/view`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId, referrer }),
  });
  
  if (!response.ok) {
    console.error("Failed to record article view");
  }
}

export async function toggleArticleLike(articleId: number): Promise<{ liked: boolean }> {
  const response = await fetch(`${API_BASE}/articles/${articleId}/like`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  
  if (!response.ok) {
    throw new Error("Failed to toggle article like");
  }
  
  return response.json();
}

export async function fetchArticleEngagement(articleId: number): Promise<EngagementStats> {
  const response = await fetch(`${API_BASE}/articles/${articleId}/engagement`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch article engagement");
  }
  
  return response.json();
}

export async function fetchTrendingArticles(limit: number = 10, hoursBack: number = 48): Promise<TrendingArticle[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    hoursBack: hoursBack.toString(),
  });
  
  const response = await fetch(`${API_BASE}/articles/trending?${params}`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch trending articles");
  }
  
  return response.json();
}

export async function fetchUserLikedArticles(): Promise<number[]> {
  const response = await fetch(`${API_BASE}/user/likes`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch user likes");
  }
  
  return response.json();
}

// ============================================================================
// USER BOOKMARKS API
// ============================================================================

export interface UserBookmark {
  id: number;
  userId: string;
  orgId: string;
  articleId: number;
  notes: string | null;
  createdAt: string;
  article: Article;
}

export async function fetchUserBookmarks(): Promise<UserBookmark[]> {
  const response = await fetch(`${API_BASE}/bookmarks`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch bookmarks");
  }
  
  return response.json();
}

export async function createBookmark(articleId: number, notes?: string): Promise<UserBookmark> {
  const response = await fetch(`${API_BASE}/bookmarks/${articleId}`, {
    method: "POST",
    credentials: "include",
    headers: getHeaders(),
    body: JSON.stringify({ notes }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || "Failed to create bookmark");
  }
  
  return response.json();
}

export async function deleteBookmark(articleId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/bookmarks/${articleId}`, {
    method: "DELETE",
    credentials: "include",
    headers: getHeaders(false),
  });
  
  if (!response.ok) {
    throw new Error("Failed to delete bookmark");
  }
}

export async function checkBookmarkStatus(articleId: number): Promise<{ isBookmarked: boolean }> {
  const response = await fetch(`${API_BASE}/bookmarks/${articleId}/status`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to check bookmark status");
  }
  
  return response.json();
}

// ============================================================================
// USER READING LIST API
// ============================================================================

export interface ReadingListItem {
  id: number;
  userId: string;
  orgId: string;
  articleId: number;
  priority: "low" | "medium" | "high";
  status: "unread" | "reading" | "completed";
  notes: string | null;
  addedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  article: Article;
}

export async function fetchReadingList(status?: string): Promise<ReadingListItem[]> {
  const params = new URLSearchParams();
  if (status) {
    params.append("status", status);
  }
  
  const response = await fetch(`${API_BASE}/reading-list?${params}`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch reading list");
  }
  
  return response.json();
}

export async function addToReadingList(articleId: number, priority?: "low" | "medium" | "high", notes?: string): Promise<ReadingListItem> {
  const response = await fetch(`${API_BASE}/reading-list/${articleId}`, {
    method: "POST",
    credentials: "include",
    headers: getHeaders(),
    body: JSON.stringify({ priority, notes }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || "Failed to add to reading list");
  }
  
  return response.json();
}

export async function updateReadingListItem(articleId: number, updates: {
  priority?: "low" | "medium" | "high";
  status?: "unread" | "reading" | "completed";
  notes?: string;
}): Promise<ReadingListItem> {
  const response = await fetch(`${API_BASE}/reading-list/${articleId}`, {
    method: "PATCH",
    credentials: "include",
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    throw new Error("Failed to update reading list item");
  }
  
  return response.json();
}

export async function removeFromReadingList(articleId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/reading-list/${articleId}`, {
    method: "DELETE",
    credentials: "include",
    headers: getHeaders(false),
  });
  
  if (!response.ok) {
    throw new Error("Failed to remove from reading list");
  }
}

export async function checkReadingListStatus(articleId: number): Promise<{ inReadingList: boolean; item: ReadingListItem | null }> {
  const response = await fetch(`${API_BASE}/reading-list/${articleId}/status`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to check reading list status");
  }
  
  return response.json();
}

// ============================================================================
// M&A ALERTS API
// ============================================================================

export interface MaAlert {
  id: string;
  userId: string;
  orgId: string;
  name: string;
  keywords: string[];
  dealTypes: string[] | null;
  regions: string[] | null;
  emailEnabled: boolean;
  pushEnabled: boolean;
  frequency: "immediate" | "daily" | "weekly";
  isActive: boolean;
  lastTriggeredAt: string | null;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function fetchMaAlerts(): Promise<MaAlert[]> {
  const response = await fetch(`${API_BASE}/alerts`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch M&A alerts");
  }
  
  return response.json();
}

export async function createMaAlert(data: {
  name: string;
  keywords: string[];
  dealTypes?: string[];
  regions?: string[];
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  frequency?: "immediate" | "daily" | "weekly";
}): Promise<MaAlert> {
  const response = await fetch(`${API_BASE}/alerts`, {
    method: "POST",
    credentials: "include",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || "Failed to create M&A alert");
  }
  
  return response.json();
}

export async function updateMaAlert(alertId: string, updates: Partial<{
  name: string;
  keywords: string[];
  dealTypes: string[];
  regions: string[];
  emailEnabled: boolean;
  pushEnabled: boolean;
  frequency: "immediate" | "daily" | "weekly";
  isActive: boolean;
}>): Promise<MaAlert> {
  const response = await fetch(`${API_BASE}/alerts/${alertId}`, {
    method: "PATCH",
    credentials: "include",
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    throw new Error("Failed to update M&A alert");
  }
  
  return response.json();
}

export async function deleteMaAlert(alertId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/alerts/${alertId}`, {
    method: "DELETE",
    credentials: "include",
    headers: getHeaders(false),
  });
  
  if (!response.ok) {
    throw new Error("Failed to delete M&A alert");
  }
}

// ============================================================================
// DIGEST PREFERENCES API
// ============================================================================

export interface DigestPreferences {
  id: string;
  userId: string;
  orgId: string;
  emailAddress: string;
  frequency: "daily" | "weekly";
  dayOfWeek: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" | null;
  timeOfDay: string;
  timezone: string;
  categories: string[] | null;
  includeDeals: boolean;
  includeSummaries: boolean;
  includeTrending: boolean;
  maxArticles: number;
  enabled: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchDigestPreferences(): Promise<DigestPreferences | null> {
  const response = await fetch(`${API_BASE}/digest`, {
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch digest preferences");
  }
  
  return response.json();
}

export async function saveDigestPreferences(data: {
  emailAddress: string;
  frequency?: "daily" | "weekly";
  dayOfWeek?: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
  timeOfDay?: string;
  timezone?: string;
  categories?: string[];
  includeDeals?: boolean;
  includeSummaries?: boolean;
  includeTrending?: boolean;
  maxArticles?: number;
  enabled?: boolean;
}): Promise<DigestPreferences> {
  const response = await fetch(`${API_BASE}/digest`, {
    method: "POST",
    credentials: "include",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || "Failed to save digest preferences");
  }
  
  return response.json();
}

export async function updateDigestPreferences(updates: Partial<{
  emailAddress: string;
  frequency: "daily" | "weekly";
  dayOfWeek: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
  timeOfDay: string;
  timezone: string;
  categories: string[];
  includeDeals: boolean;
  includeSummaries: boolean;
  includeTrending: boolean;
  maxArticles: number;
  enabled: boolean;
}>): Promise<DigestPreferences> {
  const response = await fetch(`${API_BASE}/digest`, {
    method: "PATCH",
    credentials: "include",
    headers: getHeaders(),
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    throw new Error("Failed to update digest preferences");
  }
  
  return response.json();
}

export async function deleteDigestPreferences(): Promise<void> {
  const response = await fetch(`${API_BASE}/digest`, {
    method: "DELETE",
    credentials: "include",
    headers: getHeaders(false),
  });
  
  if (!response.ok) {
    throw new Error("Failed to delete digest preferences");
  }
}
