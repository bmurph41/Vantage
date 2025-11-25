import { Article, SystemStats, TrendingTopic, CategoryDistribution, SourceDistribution, ArticleFilters } from "../types/article";

const API_BASE = "/api/docktalk";

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
    headers: {
      "Content-Type": "application/json",
    },
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
  });
  
  if (!response.ok) {
    throw new Error(`Failed to trigger manual fetch: ${response.statusText}`);
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
  const response = await fetch(`${API_BASE}/rss-sources`);
  if (!response.ok) {
    throw new Error(`Failed to fetch RSS sources: ${response.statusText}`);
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
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create RSS source: ${response.statusText}`);
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
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update RSS source: ${response.statusText}`);
  }
  
  return response.json();
}

export async function deleteRssSource(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/rss-sources/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete RSS source: ${response.statusText}`);
  }
}

export async function previewRssSource(url: string, sourceType: "rss" | "web_scrape" = "rss"): Promise<RssPreviewResponse> {
  const response = await fetch(`${API_BASE}/rss-sources/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
    headers: {
      "Content-Type": "application/json",
    },
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
    headers: {
      "Content-Type": "application/json",
    },
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
    headers: {
      "Content-Type": "application/json",
    },
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
