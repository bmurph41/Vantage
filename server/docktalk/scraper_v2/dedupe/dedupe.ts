import type { Dt2Article } from '@shared/docktalk-v2-schema';
import { simhash, simhashSimilarity } from '../utils/hash';
import { cosineSimilarity } from '../embeddings/provider';
import { V2_CONFIG } from '../config';

export interface DedupeResult {
  isExactDuplicate: boolean;
  isSoftDuplicate: boolean;
  similarity: number;
  matchedArticleId?: string;
  matchReason?: 'canonical_url' | 'content_hash' | 'title_hash' | 'simhash' | 'embedding';
}

export function checkExactDuplicate(
  newArticle: { canonicalUrl?: string; contentHash: string; titleHash: string },
  existingArticles: Pick<Dt2Article, 'id' | 'canonicalUrl' | 'contentHash' | 'titleHash'>[]
): DedupeResult {
  for (const existing of existingArticles) {
    if (newArticle.canonicalUrl && existing.canonicalUrl && 
        newArticle.canonicalUrl === existing.canonicalUrl) {
      return {
        isExactDuplicate: true,
        isSoftDuplicate: false,
        similarity: 1.0,
        matchedArticleId: existing.id,
        matchReason: 'canonical_url',
      };
    }
    
    if (newArticle.contentHash === existing.contentHash) {
      return {
        isExactDuplicate: true,
        isSoftDuplicate: false,
        similarity: 1.0,
        matchedArticleId: existing.id,
        matchReason: 'content_hash',
      };
    }
    
    if (newArticle.titleHash === existing.titleHash) {
      return {
        isExactDuplicate: true,
        isSoftDuplicate: false,
        similarity: 0.98,
        matchedArticleId: existing.id,
        matchReason: 'title_hash',
      };
    }
  }
  
  return {
    isExactDuplicate: false,
    isSoftDuplicate: false,
    similarity: 0,
  };
}

export function checkSimhashSimilarity(
  newContent: string,
  existingContents: Array<{ id: string; content: string }>
): DedupeResult {
  const newHash = simhash(newContent);
  
  for (const existing of existingContents) {
    const existingHash = simhash(existing.content);
    const similarity = simhashSimilarity(newHash, existingHash);
    
    if (similarity >= 0.9) {
      return {
        isExactDuplicate: false,
        isSoftDuplicate: true,
        similarity,
        matchedArticleId: existing.id,
        matchReason: 'simhash',
      };
    }
  }
  
  return {
    isExactDuplicate: false,
    isSoftDuplicate: false,
    similarity: 0,
  };
}

export function checkEmbeddingSimilarity(
  newEmbedding: number[],
  existingEmbeddings: Array<{ articleId: string; vector: number[] }>
): DedupeResult {
  const threshold = V2_CONFIG.dedupe.similarityThreshold;
  let bestMatch: { articleId: string; similarity: number } | null = null;
  
  for (const existing of existingEmbeddings) {
    const similarity = cosineSimilarity(newEmbedding, existing.vector);
    
    if (similarity >= threshold) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { articleId: existing.articleId, similarity };
      }
    }
  }
  
  if (bestMatch) {
    return {
      isExactDuplicate: false,
      isSoftDuplicate: true,
      similarity: bestMatch.similarity,
      matchedArticleId: bestMatch.articleId,
      matchReason: 'embedding',
    };
  }
  
  return {
    isExactDuplicate: false,
    isSoftDuplicate: false,
    similarity: 0,
  };
}

export function findNearestNeighbors(
  queryEmbedding: number[],
  candidates: Array<{ articleId: string; vector: number[] }>,
  k: number = 5,
  minSimilarity: number = 0.7
): Array<{ articleId: string; similarity: number }> {
  const scored = candidates.map(c => ({
    articleId: c.articleId,
    similarity: cosineSimilarity(queryEmbedding, c.vector),
  }));
  
  return scored
    .filter(s => s.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}
