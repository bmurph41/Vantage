import type { ExtractedArticle, ScoringContext, RelevanceResult, UserRulesContext, FeedbackStats } from '../types';
import type { Dt2ScoreBreakdown } from '@shared/docktalk-v2-schema';
import { cosineSimilarity } from '../embeddings/provider';
import { isSpamContent, hasExcessiveBoilerplate } from '../utils/text';
import { V2_CONFIG } from '../config';

export function scoreRelevance(
  article: ExtractedArticle,
  articleEmbedding: number[],
  context: ScoringContext
): RelevanceResult {
  const config = V2_CONFIG.relevance;
  const { rules, feedbackStats } = context;
  
  const penalties: string[] = [];
  let score = 50;
  
  let embeddingSimilarity = 0;
  if (rules.topicEmbedding && rules.topicEmbedding.length > 0) {
    embeddingSimilarity = cosineSimilarity(articleEmbedding, rules.topicEmbedding);
    score += Math.round(embeddingSimilarity * config.embeddingWeight);
  }
  
  const textLower = `${article.title} ${article.mainText}`.toLowerCase();
  let keywordScore = 0;
  let excludeHit = false;
  
  for (const keyword of rules.excludeKeywords) {
    if (textLower.includes(keyword.toLowerCase())) {
      excludeHit = true;
      keywordScore += config.keywordExcludePenalty;
      penalties.push(`exclude_keyword:${keyword}`);
      break;
    }
  }
  
  if (!excludeHit) {
    let includeBonus = 0;
    for (const keyword of rules.includeKeywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        includeBonus += config.keywordIncludeBonus;
      }
    }
    keywordScore = Math.min(includeBonus, config.keywordIncludeCap);
  }
  score += keywordScore;
  
  let qualityScore = 0;
  if (article.wordCount < config.qualityMinWords) {
    qualityScore += config.qualityPenalty;
    penalties.push('low_word_count');
  }
  
  if (isSpamContent(article.mainText)) {
    qualityScore += config.spamPenalty;
    penalties.push('spam_content');
  }
  
  if (hasExcessiveBoilerplate(article.mainText, 0.4)) {
    qualityScore += -10;
    penalties.push('excessive_boilerplate');
  }
  score += qualityScore;
  
  let recencyScore = 0;
  if (article.publishedAt) {
    const ageMs = Date.now() - article.publishedAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    
    if (ageHours <= 48) {
      recencyScore = config.recency48hBonus;
    } else if (ageHours <= 168) {
      recencyScore = config.recency7dBonus;
    } else if (ageHours > 720) {
      recencyScore = config.recency30dPenalty;
      penalties.push('old_article');
    }
  }
  score += recencyScore;
  
  let feedbackScore = 0;
  const similarToSaved = checkSimilarToSavedTopics(article, feedbackStats);
  feedbackScore = Math.min(similarToSaved * 5, config.feedbackMaxBonus);
  score += feedbackScore;
  
  const sourceTrustScore = 0;
  
  score = Math.max(0, Math.min(100, score));
  
  let label: 'high' | 'medium' | 'low';
  if (excludeHit) {
    label = 'low';
    score = Math.min(score, 40);
  } else if (score >= config.highThreshold) {
    label = 'high';
  } else if (score >= config.mediumThreshold) {
    label = 'medium';
  } else {
    label = 'low';
  }
  
  const breakdown: Dt2ScoreBreakdown = {
    embedding_similarity: Math.round(embeddingSimilarity * 100) / 100,
    keyword_score: keywordScore,
    quality_score: qualityScore,
    recency_score: recencyScore,
    feedback_score: feedbackScore,
    source_trust_score: sourceTrustScore,
    exclude_hit: excludeHit,
    penalties: penalties.length > 0 ? penalties : undefined,
  };
  
  return { score, label, breakdown };
}

function checkSimilarToSavedTopics(article: ExtractedArticle, feedbackStats: FeedbackStats): number {
  let matches = 0;
  const textLower = `${article.title} ${article.mainText}`.toLowerCase();
  
  for (const keyword of feedbackStats.savedKeywords) {
    if (textLower.includes(keyword.toLowerCase())) {
      matches++;
    }
  }
  
  for (const topic of feedbackStats.savedTopics) {
    if (textLower.includes(topic.toLowerCase())) {
      matches++;
    }
  }
  
  return Math.min(matches, 3);
}

export function buildUserRulesContext(
  rules: {
    includeKeywords?: string[] | null;
    excludeKeywords?: string[] | null;
    includeEntities?: string[] | null;
    excludeEntities?: string[] | null;
    topicStatement?: string | null;
    cachedTopicEmbedding?: number[] | null;
    minScore?: number;
  }
): UserRulesContext {
  return {
    includeKeywords: rules.includeKeywords || [],
    excludeKeywords: rules.excludeKeywords || [],
    includeEntities: rules.includeEntities || [],
    excludeEntities: rules.excludeEntities || [],
    topicStatement: rules.topicStatement || undefined,
    topicEmbedding: rules.cachedTopicEmbedding || undefined,
    minScore: rules.minScore || 60,
  };
}

export function buildFeedbackStats(
  feedback: Array<{ action: string; articleKeywords?: string[] }>
): FeedbackStats {
  const savedKeywords: string[] = [];
  const savedTopics: string[] = [];
  const dismissedPatterns: string[] = [];
  
  for (const f of feedback) {
    if (f.action === 'saved' && f.articleKeywords) {
      savedKeywords.push(...f.articleKeywords.slice(0, 5));
    }
    if (f.action === 'dismissed' && f.articleKeywords) {
      dismissedPatterns.push(...f.articleKeywords.slice(0, 3));
    }
  }
  
  return {
    savedTopics: [...new Set(savedTopics)],
    dismissedPatterns: [...new Set(dismissedPatterns)],
    savedKeywords: [...new Set(savedKeywords)].slice(0, 20),
  };
}
