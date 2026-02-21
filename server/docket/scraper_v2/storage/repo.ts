import { db } from '../../../db';
import { eq, and, desc, gte, inArray, sql } from 'drizzle-orm';
import {
  dt2Sources, dt2Runs, dt2DiscoveredUrls, dt2Fetches, dt2Articles,
  dt2ArticleSources, dt2Embeddings, dt2Clusters, dt2ClusterMembers,
  dt2Relevance, dt2UserRules, dt2Feedback, dt2RunEvents,
  type Dt2Source, type Dt2Run, type Dt2Article, type Dt2Embedding,
  type Dt2UserRules, type Dt2RunMetrics, type InsertDt2Source,
} from '@shared/docket-v2-schema';
import type { DiscoveredCandidate, ExtractedArticle, RelevanceResult } from '../types';

export const dt2Repo = {
  async getActiveSources(userId: string, orgId: string): Promise<Dt2Source[]> {
    return db.select().from(dt2Sources)
      .where(and(
        eq(dt2Sources.userId, userId),
        eq(dt2Sources.orgId, orgId),
        eq(dt2Sources.status, 'active')
      ));
  },

  async createSource(data: InsertDt2Source): Promise<Dt2Source> {
    const [source] = await db.insert(dt2Sources).values(data).returning();
    return source;
  },

  async updateSource(id: string, data: Partial<InsertDt2Source>): Promise<Dt2Source | null> {
    const [source] = await db.update(dt2Sources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dt2Sources.id, id))
      .returning();
    return source || null;
  },

  async deleteSource(id: string): Promise<void> {
    await db.delete(dt2Sources).where(eq(dt2Sources.id, id));
  },

  async createRun(userId: string, orgId: string, triggeredBy: string = 'scheduler'): Promise<Dt2Run> {
    const [run] = await db.insert(dt2Runs).values({
      userId,
      orgId,
      status: 'running',
      triggeredBy,
    }).returning();
    return run;
  },

  async completeRun(runId: string, status: 'success' | 'failed' | 'partial', metrics: Dt2RunMetrics): Promise<void> {
    await db.update(dt2Runs)
      .set({
        status,
        completedAt: new Date(),
        metrics,
      })
      .where(eq(dt2Runs.id, runId));
  },

  async getRuns(userId: string, limit: number = 20): Promise<Dt2Run[]> {
    return db.select().from(dt2Runs)
      .where(eq(dt2Runs.userId, userId))
      .orderBy(desc(dt2Runs.startedAt))
      .limit(limit);
  },

  async getRunById(runId: string): Promise<Dt2Run | null> {
    const [run] = await db.select().from(dt2Runs).where(eq(dt2Runs.id, runId));
    return run || null;
  },

  async storeDiscoveredUrls(
    runId: string,
    sourceId: string,
    candidates: DiscoveredCandidate[]
  ): Promise<void> {
    if (candidates.length === 0) return;
    
    const values = candidates.map(c => ({
      runId,
      sourceId,
      url: c.url,
      normalizedUrl: c.normalizedUrl,
      discoveryMethod: c.discoveryMethod,
      depth: c.depth,
      status: 'pending' as const,
    }));
    
    await db.insert(dt2DiscoveredUrls).values(values).onConflictDoNothing();
  },

  async getPendingUrls(runId: string, limit: number): Promise<Array<{ id: string; url: string; sourceId: string }>> {
    return db.select({
      id: dt2DiscoveredUrls.id,
      url: dt2DiscoveredUrls.url,
      sourceId: dt2DiscoveredUrls.sourceId,
    })
      .from(dt2DiscoveredUrls)
      .where(and(
        eq(dt2DiscoveredUrls.runId, runId),
        eq(dt2DiscoveredUrls.status, 'pending')
      ))
      .limit(limit);
  },

  async updateDiscoveredUrlStatus(
    id: string,
    status: 'fetched' | 'skipped' | 'error',
    skipReason?: string
  ): Promise<void> {
    await db.update(dt2DiscoveredUrls)
      .set({ status, skipReason })
      .where(eq(dt2DiscoveredUrls.id, id));
  },

  async storeFetch(
    runId: string,
    sourceId: string,
    discoveredUrlId: string | undefined,
    fetchResult: {
      url: string;
      finalUrl: string;
      statusCode: number;
      mimeType: string;
      etag?: string;
      lastModified?: string;
      headersHash: string;
      contentHash: string;
      bytes: number;
      fetchMs: number;
      error?: string;
    }
  ): Promise<string> {
    const [fetch] = await db.insert(dt2Fetches).values({
      runId,
      sourceId,
      discoveredUrlId,
      ...fetchResult,
    }).returning();
    return fetch.id;
  },

  async upsertArticle(article: ExtractedArticle): Promise<{ id: string; isNew: boolean }> {
    const existing = await db.select({ id: dt2Articles.id })
      .from(dt2Articles)
      .where(eq(dt2Articles.contentHash, article.contentHash))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(dt2Articles)
        .set({ updatedAt: new Date() })
        .where(eq(dt2Articles.id, existing[0].id));
      return { id: existing[0].id, isNew: false };
    }
    
    const [newArticle] = await db.insert(dt2Articles).values({
      canonicalUrl: article.canonicalUrl,
      title: article.title,
      author: article.author,
      publishedAt: article.publishedAt,
      mainText: article.mainText,
      htmlFragment: article.htmlFragment,
      language: article.language,
      wordCount: article.wordCount,
      contentHash: article.contentHash,
      titleHash: article.titleHash,
      topKeywords: article.topKeywords,
      readingTimeMinutes: article.readingTimeMinutes,
    }).returning();
    
    return { id: newArticle.id, isNew: true };
  },

  async linkArticleToSource(articleId: string, sourceId: string): Promise<void> {
    await db.insert(dt2ArticleSources).values({
      articleId,
      sourceId,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    }).onConflictDoUpdate({
      target: [dt2ArticleSources.articleId, dt2ArticleSources.sourceId],
      set: { lastSeenAt: new Date() },
    });
  },

  async storeEmbedding(articleId: string, provider: string, model: string, dims: number, vector: number[]): Promise<void> {
    await db.insert(dt2Embeddings).values({
      articleId,
      provider,
      model,
      dims,
      vector,
    }).onConflictDoUpdate({
      target: [dt2Embeddings.articleId, dt2Embeddings.provider, dt2Embeddings.model],
      set: { vector, createdAt: new Date() },
    });
  },

  async getRecentEmbeddings(days: number, limit: number = 1000): Promise<Array<{ articleId: string; vector: number[] }>> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return db.select({
      articleId: dt2Embeddings.articleId,
      vector: dt2Embeddings.vector,
    })
      .from(dt2Embeddings)
      .where(gte(dt2Embeddings.createdAt, cutoff))
      .limit(limit);
  },

  async storeRelevance(
    userId: string,
    orgId: string,
    articleId: string,
    result: RelevanceResult
  ): Promise<void> {
    await db.insert(dt2Relevance).values({
      userId,
      orgId,
      articleId,
      relevanceScore: result.score,
      relevanceLabel: result.label,
      scoreBreakdown: result.breakdown,
    }).onConflictDoUpdate({
      target: [dt2Relevance.userId, dt2Relevance.articleId],
      set: {
        relevanceScore: result.score,
        relevanceLabel: result.label,
        scoreBreakdown: result.breakdown,
        createdAt: new Date(),
      },
    });
  },

  async getUserRules(userId: string): Promise<Dt2UserRules | null> {
    const [rules] = await db.select().from(dt2UserRules).where(eq(dt2UserRules.userId, userId));
    return rules || null;
  },

  async upsertUserRules(userId: string, orgId: string, rules: Partial<Dt2UserRules>): Promise<Dt2UserRules> {
    const [result] = await db.insert(dt2UserRules).values({
      userId,
      orgId,
      includeKeywords: rules.includeKeywords || [],
      excludeKeywords: rules.excludeKeywords || [],
      includeEntities: rules.includeEntities || [],
      excludeEntities: rules.excludeEntities || [],
      topicStatement: rules.topicStatement,
      minScore: rules.minScore || 60,
      cachedTopicEmbedding: rules.cachedTopicEmbedding,
    }).onConflictDoUpdate({
      target: dt2UserRules.userId,
      set: {
        ...rules,
        updatedAt: new Date(),
      },
    }).returning();
    return result;
  },

  async getArticles(
    userId: string,
    options: {
      label?: 'high' | 'medium' | 'low';
      minScore?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Array<Dt2Article & { relevanceScore: number; relevanceLabel: string }>> {
    const { label, minScore, limit = 50, offset = 0 } = options;
    
    let query = db.select({
      ...dt2Articles,
      relevanceScore: dt2Relevance.relevanceScore,
      relevanceLabel: dt2Relevance.relevanceLabel,
    })
      .from(dt2Articles)
      .innerJoin(dt2Relevance, eq(dt2Articles.id, dt2Relevance.articleId))
      .where(eq(dt2Relevance.userId, userId))
      .orderBy(desc(dt2Relevance.relevanceScore), desc(dt2Articles.publishedAt))
      .limit(limit)
      .offset(offset);
    
    return query;
  },

  async storeFeedback(userId: string, orgId: string, articleId: string, action: 'saved' | 'opened' | 'dismissed'): Promise<void> {
    await db.insert(dt2Feedback).values({
      userId,
      orgId,
      articleId,
      action,
      weight: action === 'saved' ? 2 : 1,
    }).onConflictDoNothing();
  },

  async logRunEvent(
    runId: string,
    level: 'info' | 'warn' | 'error',
    eventType: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    await db.insert(dt2RunEvents).values({
      runId,
      level,
      eventType,
      message,
      context,
    });
  },

  async getRunEvents(runId: string): Promise<Array<{ level: string; eventType: string; message: string; createdAt: Date }>> {
    return db.select({
      level: dt2RunEvents.level,
      eventType: dt2RunEvents.eventType,
      message: dt2RunEvents.message,
      createdAt: dt2RunEvents.createdAt,
    })
      .from(dt2RunEvents)
      .where(eq(dt2RunEvents.runId, runId))
      .orderBy(dt2RunEvents.createdAt);
  },

  async getSuccessfulFetches(runId: string): Promise<Array<{
    id: string;
    sourceId: string;
    url: string;
    finalUrl: string | null;
    statusCode: number | null;
    mimeType: string | null;
    content: string;
    contentHash: string | null;
  }>> {
    const fetches = await db.select({
      id: dt2Fetches.id,
      sourceId: dt2Fetches.sourceId,
      url: dt2Fetches.url,
      finalUrl: dt2Fetches.finalUrl,
      statusCode: dt2Fetches.statusCode,
      mimeType: dt2Fetches.mimeType,
      contentHash: dt2Fetches.contentHash,
    })
      .from(dt2Fetches)
      .where(and(
        eq(dt2Fetches.runId, runId),
        eq(dt2Fetches.statusCode, 200)
      ));
    
    return fetches.map(f => ({
      ...f,
      content: '',
    }));
  },

  async getRecentArticlesForDedupe(days: number = 30): Promise<Pick<Dt2Article, 'id' | 'canonicalUrl' | 'contentHash' | 'titleHash'>[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return db.select({
      id: dt2Articles.id,
      canonicalUrl: dt2Articles.canonicalUrl,
      contentHash: dt2Articles.contentHash,
      titleHash: dt2Articles.titleHash,
    })
      .from(dt2Articles)
      .where(gte(dt2Articles.createdAt, cutoff))
      .limit(5000);
  },
};
