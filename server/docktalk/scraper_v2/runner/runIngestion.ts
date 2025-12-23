import type { IngestionRunContext, ExtractedArticle, RelevanceResult } from '../types';
import type { Dt2Source, Dt2RunMetrics } from '@shared/docktalk-v2-schema';
import { discover } from '../discovery';
import { fetchUrl, fetchBatch } from '../fetch/client';
import { extractArticle, isValidExtraction } from '../extract/extractor';
import { checkExactDuplicate, checkEmbeddingSimilarity } from '../dedupe/dedupe';
import { clusterArticles, mergeOverlappingClusters } from '../dedupe/clustering';
import { scoreRelevance, buildUserRulesContext, buildFeedbackStats } from '../relevance/scorer';
import { getEmbeddingProvider } from '../embeddings/provider';
import { truncateForEmbedding } from '../utils/text';
import { dt2Repo } from '../storage/repo';
import { logRunComplete, logError, logger } from '../utils/logger';
import { V2_CONFIG } from '../config';

export async function runIngestion(userId: string, orgId: string, triggeredBy: string = 'scheduler'): Promise<string> {
  const run = await dt2Repo.createRun(userId, orgId, triggeredBy);
  const context: IngestionRunContext = {
    runId: run.id,
    userId,
    orgId,
    metrics: {
      discovered: 0,
      fetched_ok: 0,
      fetched_fail: 0,
      extracted_ok: 0,
      deduped: 0,
      embedded: 0,
      high_relevance: 0,
      medium_relevance: 0,
      low_relevance: 0,
      startTime: Date.now(),
    },
  };

  try {
    const sources = await dt2Repo.getActiveSources(userId, orgId);
    if (sources.length === 0) {
      await dt2Repo.completeRun(run.id, 'success', buildMetrics(context));
      return run.id;
    }

    await runDiscoveryPhase(context, sources);
    
    const articles = await runFetchPhase(context, sources);
    
    await runEmbeddingPhase(context, articles);
    
    await runRelevancePhase(context, articles);
    
    const finalMetrics = buildMetrics(context);
    const status = context.metrics.fetched_fail > context.metrics.fetched_ok ? 'partial' : 'success';
    
    await dt2Repo.completeRun(run.id, status, finalMetrics);
    logRunComplete(run.id, status, finalMetrics);
    
    return run.id;
    
  } catch (error) {
    logError(run.id, error as Error, { phase: 'ingestion' });
    await dt2Repo.logRunEvent(run.id, 'error', 'ingestion_failed', (error as Error).message);
    await dt2Repo.completeRun(run.id, 'failed', buildMetrics(context));
    throw error;
  }
}

async function runDiscoveryPhase(context: IngestionRunContext, sources: Dt2Source[]): Promise<void> {
  for (const source of sources) {
    try {
      const candidates = await discover(source, context.runId);
      context.metrics.discovered += candidates.length;
      
      await dt2Repo.storeDiscoveredUrls(context.runId, source.id, candidates);
      await dt2Repo.logRunEvent(context.runId, 'info', 'discovery_complete', 
        `Discovered ${candidates.length} URLs from ${source.name}`,
        { sourceId: source.id, count: candidates.length }
      );
      
    } catch (error) {
      await dt2Repo.logRunEvent(context.runId, 'error', 'discovery_failed',
        (error as Error).message,
        { sourceId: source.id }
      );
    }
  }
}

async function runFetchPhase(context: IngestionRunContext, sources: Dt2Source[]): Promise<Array<{ article: ExtractedArticle; articleId: string; sourceId: string }>> {
  const articles: Array<{ article: ExtractedArticle; articleId: string; sourceId: string }> = [];
  const totalLimit = sources.reduce((sum, s) => sum + s.crawlPolicy.maxPagesPerRun, 0);
  const pendingUrls = await dt2Repo.getPendingUrls(context.runId, totalLimit);
  
  const existingArticles = await dt2Repo.getRecentArticlesForDedupe(30);
  
  const batchSize = 10;
  for (let i = 0; i < pendingUrls.length; i += batchSize) {
    const batch = pendingUrls.slice(i, i + batchSize);
    const fetchOptions = batch.map(u => ({ url: u.url }));
    
    const results = await fetchBatch(fetchOptions);
    
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const urlRecord = batch[j];
      
      if (result.error || result.statusCode >= 400) {
        context.metrics.fetched_fail++;
        await dt2Repo.updateDiscoveredUrlStatus(urlRecord.id, 'error', result.error);
      } else {
        context.metrics.fetched_ok++;
        await dt2Repo.updateDiscoveredUrlStatus(urlRecord.id, 'fetched');
        
        if (result.content && result.mimeType?.includes('text/html')) {
          try {
            const extracted = extractArticle({
              html: result.content,
              url: result.finalUrl || result.url,
            });
            
            if (extracted && isValidExtraction(extracted)) {
              const dedupeResult = checkExactDuplicate(extracted, existingArticles);
              
              if (dedupeResult.isExactDuplicate) {
                context.metrics.deduped++;
                await dt2Repo.linkArticleToSource(dedupeResult.matchedArticleId!, urlRecord.sourceId);
              } else {
                const { id: articleId, isNew } = await dt2Repo.upsertArticle(extracted);
                await dt2Repo.linkArticleToSource(articleId, urlRecord.sourceId);
                
                if (isNew) {
                  context.metrics.extracted_ok++;
                  articles.push({ article: extracted, articleId, sourceId: urlRecord.sourceId });
                  existingArticles.push({
                    id: articleId,
                    canonicalUrl: extracted.canonicalUrl,
                    contentHash: extracted.contentHash,
                    titleHash: extracted.titleHash,
                  });
                } else {
                  context.metrics.deduped++;
                }
              }
            }
          } catch (error) {
            logger.warn({
              module: 'docktalk_v2',
              event: 'extraction_failed',
              url: result.url,
              error: (error as Error).message,
            });
          }
        }
      }
      
      await dt2Repo.storeFetch(
        context.runId,
        urlRecord.sourceId,
        urlRecord.id,
        {
          url: result.url,
          finalUrl: result.finalUrl,
          statusCode: result.statusCode,
          mimeType: result.mimeType,
          etag: result.etag,
          lastModified: result.lastModified,
          headersHash: result.headersHash,
          contentHash: result.contentHash,
          bytes: result.bytes,
          fetchMs: result.fetchMs,
          error: result.error,
        }
      );
    }
  }
  
  return articles;
}


async function runEmbeddingPhase(
  context: IngestionRunContext,
  articles: Array<{ article: ExtractedArticle; articleId: string }>
): Promise<void> {
  if (articles.length === 0) return;
  
  const provider = getEmbeddingProvider();
  
  for (const { article, articleId } of articles) {
    try {
      const text = truncateForEmbedding(article.title, article.mainText);
      const embedding = await provider.embed(text);
      
      await dt2Repo.storeEmbedding(
        articleId,
        provider.name,
        provider.model,
        provider.dimensions,
        embedding
      );
      
      context.metrics.embedded++;
    } catch (error) {
      logger.warn({
        module: 'docktalk_v2',
        event: 'embedding_failed',
        articleId,
        error: (error as Error).message,
      });
    }
  }
}

async function runRelevancePhase(
  context: IngestionRunContext,
  articles: Array<{ article: ExtractedArticle; articleId: string }>
): Promise<void> {
  if (articles.length === 0) return;
  
  const userRules = await dt2Repo.getUserRules(context.userId);
  const rulesContext = buildUserRulesContext(userRules || {});
  const feedbackStats = buildFeedbackStats([]);
  
  const provider = getEmbeddingProvider();
  
  for (const { article, articleId } of articles) {
    try {
      const text = truncateForEmbedding(article.title, article.mainText);
      const embedding = await provider.embed(text);
      
      const result = scoreRelevance(article, embedding, {
        userId: context.userId,
        orgId: context.orgId,
        rules: rulesContext,
        feedbackStats,
      });
      
      await dt2Repo.storeRelevance(context.userId, context.orgId, articleId, result);
      
      if (result.label === 'high') context.metrics.high_relevance++;
      else if (result.label === 'medium') context.metrics.medium_relevance++;
      else context.metrics.low_relevance++;
      
    } catch (error) {
      logger.warn({
        module: 'docktalk_v2',
        event: 'relevance_scoring_failed',
        articleId,
        error: (error as Error).message,
      });
    }
  }
}

function buildMetrics(context: IngestionRunContext): Dt2RunMetrics {
  return {
    ...context.metrics,
    duration_ms: Date.now() - context.metrics.startTime,
  };
}
