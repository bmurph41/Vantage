/**
 * Article Deduplication Service
 * 
 * Provides utilities for detecting duplicate articles from multiple sources:
 * - Title normalization and trigram matching
 * - Content fingerprinting using SimHash-inspired algorithm
 * - Similarity scoring and threshold-based duplicate detection
 */

import crypto from 'crypto';

/**
 * Normalize a title for comparison by:
 * - Converting to lowercase
 * - Removing punctuation
 * - Normalizing whitespace
 * - Removing common stop words specific to news
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/g, '') // Remove common words
    .trim();
}

/**
 * Generate trigrams from normalized text
 * Trigrams are sets of 3 consecutive characters used for fuzzy matching
 */
export function generateTrigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, '');
  const trigrams = new Set<string>();
  
  for (let i = 0; i < normalized.length - 2; i++) {
    trigrams.add(normalized.substring(i, i + 3));
  }
  
  return trigrams;
}

/**
 * Calculate Jaccard similarity between two sets of trigrams
 * Returns a value between 0 (no similarity) and 1 (identical)
 */
export function calculateTrigramSimilarity(trigrams1: Set<string>, trigrams2: Set<string>): number {
  if (trigrams1.size === 0 && trigrams2.size === 0) return 1;
  if (trigrams1.size === 0 || trigrams2.size === 0) return 0;
  
  const arr1 = Array.from(trigrams1);
  const arr2 = Array.from(trigrams2);
  const intersection = new Set(arr1.filter(x => trigrams2.has(x)));
  const union = new Set([...arr1, ...arr2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate title similarity score (0-100)
 * Uses trigram matching for fuzzy comparison
 */
export function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalized1 = normalizeTitle(title1);
  const normalized2 = normalizeTitle(title2);
  
  // Exact match after normalization
  if (normalized1 === normalized2) return 100;
  
  // Trigram similarity
  const trigrams1 = generateTrigrams(normalized1);
  const trigrams2 = generateTrigrams(normalized2);
  const similarity = calculateTrigramSimilarity(trigrams1, trigrams2);
  
  return Math.round(similarity * 100);
}

/**
 * Generate a content fingerprint using a simplified SimHash approach
 * This creates a hash that's similar for similar content
 */
export function generateContentFingerprint(title: string, content: string): string {
  // Combine title and first 500 chars of content for fingerprinting
  const text = `${title} ${content.substring(0, 500)}`.toLowerCase();
  
  // Extract meaningful words (remove stop words and short words)
  const words = text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'been', 'were', 'they', 'their'].includes(word));
  
  // Create a frequency map
  const wordFreq = new Map<string, number>();
  words.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  });
  
  // Get top 20 most frequent words as fingerprint
  const topWords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word)
    .sort() // Sort alphabetically for consistency
    .join('|');
  
  // Hash the fingerprint for storage efficiency
  return crypto.createHash('md5').update(topWords).digest('hex');
}

/**
 * Normalize URL for comparison
 * Handles trailing slashes, http vs https, www differences
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove www, normalize protocol, remove trailing slash, remove query params and fragments
    const normalized = urlObj.hostname.replace(/^www\./, '') + urlObj.pathname.replace(/\/$/, '');
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Check if two URLs are essentially the same article
 * Handles minor variations like http/https, www, trailing slashes
 * Stricter matching than substring - requires host match and significant path overlap
 */
export function areUrlsSimilar(url1: string, url2: string): boolean {
  try {
    const url1Obj = new URL(url1);
    const url2Obj = new URL(url2);
    
    // Different domains = different articles (unless just www difference)
    const host1 = url1Obj.hostname.replace(/^www\./, '').toLowerCase();
    const host2 = url2Obj.hostname.replace(/^www\./, '').toLowerCase();
    if (host1 !== host2) return false;
    
    // Normalize paths
    const path1 = url1Obj.pathname.replace(/\/$/, '').toLowerCase();
    const path2 = url2Obj.pathname.replace(/\/$/, '').toLowerCase();
    
    // Exact path match
    if (path1 === path2) return true;
    
    // Check if paths are very similar (one contains the other and length difference < 20%)
    const minLength = Math.min(path1.length, path2.length);
    const maxLength = Math.max(path1.length, path2.length);
    const lengthRatio = minLength / maxLength;
    
    if (lengthRatio > 0.8 && (path1.includes(path2) || path2.includes(path1))) {
      return true;
    }
    
    return false;
  } catch {
    // Fallback to simple comparison if URL parsing fails
    const normalized1 = normalizeUrl(url1);
    const normalized2 = normalizeUrl(url2);
    return normalized1 === normalized2;
  }
}

/**
 * Calculate overall article similarity score (0-100)
 * Combines multiple signals: URL, title, and content
 */
export function calculateArticleSimilarity(
  article1: { url: string; title: string; content?: string },
  article2: { url: string; title: string; content?: string }
): number {
  // URL similarity (highest weight)
  if (areUrlsSimilar(article1.url, article2.url)) {
    return 100;
  }
  
  // Title similarity
  const titleSimilarity = calculateTitleSimilarity(article1.title, article2.title);
  
  // If we have content, include fingerprint matching
  if (article1.content && article2.content) {
    const fingerprint1 = generateContentFingerprint(article1.title, article1.content);
    const fingerprint2 = generateContentFingerprint(article2.title, article2.content);
    
    // If fingerprints match exactly, very high confidence
    if (fingerprint1 === fingerprint2) {
      return Math.max(95, titleSimilarity);
    }
    
    // Otherwise, rely on title similarity
    return titleSimilarity;
  }
  
  return titleSimilarity;
}

/**
 * Check if an article is a duplicate based on similarity threshold
 * Returns true if similarity >= threshold
 */
export function isDuplicate(
  article1: { url: string; title: string; content?: string },
  article2: { url: string; title: string; content?: string },
  threshold: number = 90
): boolean {
  const similarity = calculateArticleSimilarity(article1, article2);
  return similarity >= threshold;
}

/**
 * Serialize trigrams to a string for database storage
 */
export function serializeTrigrams(trigrams: Set<string>): string {
  return Array.from(trigrams).sort().join('|');
}

/**
 * Deserialize trigrams from database string
 */
export function deserializeTrigrams(serialized: string): Set<string> {
  if (!serialized) return new Set();
  return new Set(serialized.split('|'));
}

/**
 * Check for duplicate articles result interface
 */
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  canonicalArticle?: {
    id: number;
    title: string;
    url: string;
    source: string;
    publishedAt: Date | null;
  };
  similarityScore?: number;
  suppressionReason?: string;
}

/**
 * Main deduplication check function
 * Performs multi-stage similarity detection to find duplicate articles
 * 
 * @param newArticle - The article to check for duplicates
 * @param recentArticles - Articles from the last 14 days to compare against
 * @param thresholds - Similarity thresholds for different scenarios
 * @returns DuplicateCheckResult indicating if article is a duplicate
 */
export function checkForDuplicate(
  newArticle: {
    url: string;
    title: string;
    content?: string;
    source: string;
    publishedAt?: Date | null;
  },
  recentArticles: Array<{
    id: number;
    url: string;
    title: string;
    content?: string | null;
    source: string;
    publishedAt: Date | null;
  }>,
  thresholds: {
    crossSource: number; // e.g., 90 - higher threshold for different sources
    sameSource: number;   // e.g., 95 - very high threshold for same source
    maxDaysGap: number;   // e.g., 2 - max days between publication dates
  } = {
    crossSource: 90,
    sameSource: 95,
    maxDaysGap: 2
  }
): DuplicateCheckResult {
  
  for (const existingArticle of recentArticles) {
    // Skip if outside time window (only check if BOTH dates are present)
    if (newArticle.publishedAt && existingArticle.publishedAt) {
      const daysDiff = Math.abs(
        (newArticle.publishedAt.getTime() - existingArticle.publishedAt.getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      
      if (daysDiff > thresholds.maxDaysGap) {
        continue;
      }
    }
    // If either date is missing, still check similarity (don't skip)
    
    // Calculate similarity score
    const similarityScore = calculateArticleSimilarity(
      {
        url: newArticle.url,
        title: newArticle.title,
        content: newArticle.content
      },
      {
        url: existingArticle.url,
        title: existingArticle.title,
        content: existingArticle.content || undefined
      }
    );
    
    // Determine threshold based on source
    const isSameSource = newArticle.source === existingArticle.source;
    const threshold = isSameSource ? thresholds.sameSource : thresholds.crossSource;
    
    // Check if it's a duplicate
    if (similarityScore >= threshold) {
      const suppressionReason = isSameSource
        ? `Same source duplicate: ${similarityScore}% similar to article from ${existingArticle.source}`
        : `Cross-source duplicate: ${similarityScore}% similar to article from ${existingArticle.source}`;
      
      return {
        isDuplicate: true,
        canonicalArticle: {
          id: existingArticle.id,
          title: existingArticle.title,
          url: existingArticle.url,
          source: existingArticle.source,
          publishedAt: existingArticle.publishedAt,
        },
        similarityScore,
        suppressionReason,
      };
    }
  }
  
  return { isDuplicate: false };
}

/**
 * Determine which article should be the canonical version when duplicates are found
 * Returns the article that was published earliest (or the existing one if dates are missing)
 */
export function selectCanonicalArticle(
  newArticle: { publishedAt?: Date | null },
  existingArticle: { id: number; publishedAt: Date | null }
): { useExisting: boolean; reason: string } {
  // If both have dates, compare them
  if (newArticle.publishedAt && existingArticle.publishedAt) {
    if (newArticle.publishedAt < existingArticle.publishedAt) {
      return {
        useExisting: false,
        reason: "New article published earlier"
      };
    } else {
      return {
        useExisting: true,
        reason: "Existing article published earlier"
      };
    }
  }
  
  // If only existing has a date, prefer it
  if (!newArticle.publishedAt && existingArticle.publishedAt) {
    return {
      useExisting: true,
      reason: "Existing article has publication date"
    };
  }
  
  // If only new has a date, prefer it
  if (newArticle.publishedAt && !existingArticle.publishedAt) {
    return {
      useExisting: false,
      reason: "New article has publication date"
    };
  }
  
  // If neither has a date, keep existing (first one wins)
  return {
    useExisting: true,
    reason: "No publication dates available, keeping existing"
  };
}
