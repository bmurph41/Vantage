import OpenAI from "openai";
import { db } from "../db";
import { articles as articlesTable, articleRemovalPatterns } from "@shared/docktalk-schema";
import { eq, desc, isNotNull, sql, and, gte } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface LearningInsights {
  categoryPatterns: CategoryPattern[];
  removalPatterns: RemovalPattern[];
  duplicatePatterns: string[];
  lastUpdated: Date;
  totalReviewedArticles: number;
  totalRemovedArticles: number;
}

interface CategoryPattern {
  fromCategory: string;
  toCategory: string;
  count: number;
  examples: string[];
}

interface RemovalPattern {
  reason: string;
  count: number;
  keywords: string[];
  sources: string[];
}

let cachedInsights: LearningInsights | null = null;
let insightsCacheExpiry = 0;

export async function getReviewedArticleStats(): Promise<{
  totalReviewed: number;
  categoryCorrectionCounts: Record<string, Record<string, number>>;
  recentCorrections: Array<{title: string; from: string; to: string}>;
}> {
  const reviewed = await db
    .select({
      title: articlesTable.title,
      originalCategory: articlesTable.originalCategory,
      category: articlesTable.category,
      categories: articlesTable.categories,
    })
    .from(articlesTable)
    .where(eq(articlesTable.manuallyReviewed, true))
    .orderBy(desc(articlesTable.updatedAt))
    .limit(500);

  const corrections = reviewed.filter(
    a => a.originalCategory && a.category && a.originalCategory !== a.category
  );

  const categoryCorrectionCounts: Record<string, Record<string, number>> = {};
  
  corrections.forEach(c => {
    const from = c.originalCategory!;
    const to = c.category!;
    if (!categoryCorrectionCounts[from]) {
      categoryCorrectionCounts[from] = {};
    }
    categoryCorrectionCounts[from][to] = (categoryCorrectionCounts[from][to] || 0) + 1;
  });

  return {
    totalReviewed: reviewed.length,
    categoryCorrectionCounts,
    recentCorrections: corrections.slice(0, 50).map(c => ({
      title: c.title,
      from: c.originalCategory!,
      to: c.category!
    }))
  };
}

export async function getRemovalStats(): Promise<{
  totalRemoved: number;
  reasonCounts: Record<string, number>;
  recentRemovals: Array<{title: string; reason: string; source: string}>;
}> {
  const removals = await db
    .select({
      articleTitle: articleRemovalPatterns.articleTitle,
      removalReason: articleRemovalPatterns.removalReason,
      source: articleRemovalPatterns.articleSource,
    })
    .from(articleRemovalPatterns)
    .orderBy(desc(articleRemovalPatterns.removedAt))
    .limit(500);

  const reasonCounts: Record<string, number> = {};
  removals.forEach(r => {
    const reason = r.removalReason || 'unspecified';
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  });

  return {
    totalRemoved: removals.length,
    reasonCounts,
    recentRemovals: removals.slice(0, 50).map(r => ({
      title: r.articleTitle || 'Unknown',
      reason: r.removalReason || 'unspecified',
      source: r.source || 'unknown'
    }))
  };
}

export async function analyzeLearningPatterns(): Promise<LearningInsights> {
  const now = Date.now();
  
  if (cachedInsights && insightsCacheExpiry > now) {
    return cachedInsights;
  }

  console.log("[AI Learning] Analyzing learning patterns from reviewed articles...");

  const [reviewedStats, removalStats] = await Promise.all([
    getReviewedArticleStats(),
    getRemovalStats()
  ]);

  const categoryPatterns: CategoryPattern[] = [];
  for (const [from, toMap] of Object.entries(reviewedStats.categoryCorrectionCounts)) {
    for (const [to, count] of Object.entries(toMap)) {
      const examples = reviewedStats.recentCorrections
        .filter(c => c.from === from && c.to === to)
        .slice(0, 5)
        .map(c => c.title);
      
      categoryPatterns.push({ fromCategory: from, toCategory: to, count, examples });
    }
  }
  categoryPatterns.sort((a, b) => b.count - a.count);

  const removalPatterns: RemovalPattern[] = [];
  const reasonGroups: Record<string, Array<{title: string; source: string}>> = {};
  
  removalStats.recentRemovals.forEach(r => {
    if (!reasonGroups[r.reason]) {
      reasonGroups[r.reason] = [];
    }
    reasonGroups[r.reason].push({ title: r.title, source: r.source });
  });

  for (const [reason, items] of Object.entries(reasonGroups)) {
    const keywords = extractKeywords(items.map(i => i.title));
    const sources = [...new Set(items.map(i => i.source))];
    removalPatterns.push({
      reason,
      count: items.length,
      keywords: keywords.slice(0, 10),
      sources: sources.slice(0, 5)
    });
  }
  removalPatterns.sort((a, b) => b.count - a.count);

  const duplicatePatterns = await analyzeDuplicatePatterns();

  cachedInsights = {
    categoryPatterns,
    removalPatterns,
    duplicatePatterns,
    lastUpdated: new Date(),
    totalReviewedArticles: reviewedStats.totalReviewed,
    totalRemovedArticles: removalStats.totalRemoved
  };

  insightsCacheExpiry = now + 30 * 60 * 1000;

  console.log(`[AI Learning] Analyzed ${reviewedStats.totalReviewed} reviewed articles and ${removalStats.totalRemoved} removals`);
  console.log(`[AI Learning] Found ${categoryPatterns.length} category correction patterns`);
  console.log(`[AI Learning] Found ${removalPatterns.length} removal reason patterns`);

  return cachedInsights;
}

function extractKeywords(titles: string[]): string[] {
  const wordCounts: Record<string, number> = {};
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'new', 'from', 'as', 'more', 'about']);

  titles.forEach(title => {
    const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
    words.forEach(word => {
      if (word.length > 2 && !stopWords.has(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });
  });

  return Object.entries(wordCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

async function analyzeDuplicatePatterns(): Promise<string[]> {
  const patterns: string[] = [];
  
  patterns.push("Exact title matches should be rejected");
  patterns.push("Articles from same source within 24 hours with >80% title similarity are likely duplicates");
  patterns.push("Press releases syndicated across multiple sources should be grouped");
  
  return patterns;
}

export function buildEnhancedTrainingContext(insights: LearningInsights): string {
  const sections: string[] = [];

  if (insights.categoryPatterns.length > 0) {
    const correctionLines = insights.categoryPatterns
      .slice(0, 15)
      .map(p => {
        const exampleStr = p.examples.length > 0 
          ? ` (e.g., "${p.examples[0].substring(0, 60)}...")`
          : '';
        return `- "${p.fromCategory}" → "${p.toCategory}" (${p.count} corrections)${exampleStr}`;
      });

    sections.push(`
LEARNED CATEGORY CORRECTIONS (from ${insights.totalReviewedArticles} reviewed articles):
Users frequently correct these categorization mistakes. Avoid making them:
${correctionLines.join('\n')}`);
  }

  if (insights.removalPatterns.length > 0) {
    const removalLines = insights.removalPatterns
      .slice(0, 10)
      .map(p => {
        const keywordStr = p.keywords.length > 0 ? ` Keywords: ${p.keywords.slice(0, 5).join(', ')}` : '';
        return `- "${p.reason}" (${p.count} removals)${keywordStr}`;
      });

    sections.push(`
CONTENT TO AVOID (from ${insights.totalRemovedArticles} removed articles):
Users removed articles for these reasons. Be cautious with similar content:
${removalLines.join('\n')}`);
  }

  return sections.join('\n');
}

export async function generateFilterRecommendations(): Promise<{
  sourcesToDeprioritize: string[];
  keywordsToFilter: string[];
  categoryGuidelines: string[];
}> {
  const insights = await analyzeLearningPatterns();
  
  const sourcesToDeprioritize: string[] = [];
  const keywordsToFilter: string[] = [];
  const categoryGuidelines: string[] = [];

  const sourceRemovalCounts: Record<string, number> = {};
  insights.removalPatterns.forEach(p => {
    p.sources.forEach(s => {
      sourceRemovalCounts[s] = (sourceRemovalCounts[s] || 0) + p.count;
    });
  });

  Object.entries(sourceRemovalCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([source, count]) => {
      if (count >= 3) {
        sourcesToDeprioritize.push(source);
      }
    });

  insights.removalPatterns.forEach(p => {
    keywordsToFilter.push(...p.keywords.slice(0, 3));
  });

  insights.categoryPatterns.slice(0, 10).forEach(p => {
    categoryGuidelines.push(
      `When AI suggests "${p.fromCategory}", consider if "${p.toCategory}" is more appropriate`
    );
  });

  return {
    sourcesToDeprioritize: [...new Set(sourcesToDeprioritize)],
    keywordsToFilter: [...new Set(keywordsToFilter)].slice(0, 20),
    categoryGuidelines: categoryGuidelines.slice(0, 10)
  };
}

export async function runLearningCycle(): Promise<{
  success: boolean;
  insights: LearningInsights;
  recommendations: Awaited<ReturnType<typeof generateFilterRecommendations>>;
}> {
  console.log("[AI Learning] Starting learning cycle...");
  
  try {
    insightsCacheExpiry = 0;
    
    const insights = await analyzeLearningPatterns();
    const recommendations = await generateFilterRecommendations();

    console.log("[AI Learning] Learning cycle complete");
    console.log(`[AI Learning] Sources to deprioritize: ${recommendations.sourcesToDeprioritize.join(', ') || 'none'}`);
    console.log(`[AI Learning] Keywords to filter: ${recommendations.keywordsToFilter.slice(0, 10).join(', ') || 'none'}`);

    return { success: true, insights, recommendations };
  } catch (error) {
    console.error("[AI Learning] Learning cycle failed:", error);
    throw error;
  }
}

export function invalidateLearningCache(): void {
  insightsCacheExpiry = 0;
  cachedInsights = null;
  console.log("[AI Learning] Cache invalidated - next request will refresh learning data");
}
