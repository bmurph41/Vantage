import { db } from "../db";
import {
  aiKeywordWeights,
  aiSourceAdjustments,
  aiLearningRules,
  aiTrainingSessions,
  aiTrainingAnalytics,
  articleFeedback,
  articles,
  type AiKeywordWeight,
  type AiSourceAdjustment,
  type AiLearningRule,
} from "@shared/docket-schema";
import { eq, and, gte, sql, desc, inArray, or } from "drizzle-orm";

const DEFAULT_KEYWORDS: Record<string, { weight: number; category: string }> = {
  marina: { weight: 15, category: "marina" },
  boat: { weight: 10, category: "marina" },
  slip: { weight: 12, category: "marina" },
  dock: { weight: 10, category: "marina" },
  yacht: { weight: 12, category: "marina" },
  harbor: { weight: 8, category: "marina" },
  moorage: { weight: 10, category: "marina" },
  berth: { weight: 10, category: "marina" },
  boatyard: { weight: 12, category: "marina" },
  superyacht: { weight: 15, category: "marina" },
  acquisition: { weight: 12, category: "investment" },
  transaction: { weight: 10, category: "investment" },
  valuation: { weight: 8, category: "investment" },
  "private equity": { weight: 10, category: "investment" },
  investment: { weight: 8, category: "investment" },
  merger: { weight: 10, category: "investment" },
  inflation: { weight: 5, category: "macro" },
  "interest rate": { weight: 6, category: "macro" },
  recession: { weight: 5, category: "macro" },
  hurricane: { weight: 6, category: "macro" },
  operations: { weight: 5, category: "operational" },
  management: { weight: 4, category: "operational" },
  renovation: { weight: 6, category: "operational" },
  regulation: { weight: 5, category: "regulatory" },
  compliance: { weight: 5, category: "regulatory" },
  permit: { weight: 4, category: "regulatory" },
  spam: { weight: -20, category: "negative" },
  advertisement: { weight: -15, category: "negative" },
  "cruise ship": { weight: -10, category: "negative" },
  cargo: { weight: -8, category: "negative" },
};

interface ScoringContext {
  keywords: Map<string, AiKeywordWeight>;
  sourceAdjustments: Map<string, AiSourceAdjustment>;
  learningRules: AiLearningRule[];
  lastUpdated: Date;
}

const scoringContextCache: Map<string, ScoringContext> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getOrganizationScoringContext(orgId: string): Promise<ScoringContext> {
  const cached = scoringContextCache.get(orgId);
  if (cached && Date.now() - cached.lastUpdated.getTime() < CACHE_TTL_MS) {
    return cached;
  }

  const [keywords, sources, rules] = await Promise.all([
    db.select().from(aiKeywordWeights).where(and(
      eq(aiKeywordWeights.orgId, orgId),
      eq(aiKeywordWeights.isActive, true)
    )),
    db.select().from(aiSourceAdjustments).where(and(
      eq(aiSourceAdjustments.orgId, orgId),
      eq(aiSourceAdjustments.isActive, true)
    )),
    db.select().from(aiLearningRules).where(and(
      eq(aiLearningRules.orgId, orgId),
      eq(aiLearningRules.isActive, true)
    )),
  ]);

  const context: ScoringContext = {
    keywords: new Map(keywords.map(k => [k.keyword.toLowerCase(), k])),
    sourceAdjustments: new Map(sources.map(s => [s.sourceName.toLowerCase(), s])),
    learningRules: rules,
    lastUpdated: new Date(),
  };

  scoringContextCache.set(orgId, context);
  return context;
}

export function clearScoringCache(orgId?: string) {
  if (orgId) {
    scoringContextCache.delete(orgId);
  } else {
    scoringContextCache.clear();
  }
}

export async function scoreArticleAdaptive(
  title: string,
  content: string,
  source: string,
  orgId: string
): Promise<{ score: number; breakdown: ScoreBreakdown }> {
  const context = await getOrganizationScoringContext(orgId);
  const text = `${title} ${content}`.toLowerCase();
  const breakdown: ScoreBreakdown = {
    baseScore: 0,
    keywordScore: 0,
    sourceScore: 0,
    ruleScore: 0,
    matchedKeywords: [],
    appliedRules: [],
  };

  let score = 0;

  if (/marina|boating|dock|yacht|maritime|superyacht/i.test(source)) {
    score += 15;
    breakdown.baseScore += 15;
  }

  const sourceKey = source.toLowerCase();
  const sourceAdj = context.sourceAdjustments.get(sourceKey);
  if (sourceAdj) {
    score += sourceAdj.currentRelevanceBonus;
    breakdown.sourceScore = sourceAdj.currentRelevanceBonus;
  }

  const allKeywords = new Map<string, number>();
  
  for (const [keyword, config] of Object.entries(DEFAULT_KEYWORDS)) {
    allKeywords.set(keyword, config.weight);
  }
  
  for (const [keyword, kw] of context.keywords) {
    allKeywords.set(keyword, kw.currentWeight);
  }

  for (const [keyword, weight] of allKeywords) {
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      const contribution = Math.min(weight * matches.length, weight * 2);
      score += contribution;
      breakdown.keywordScore += contribution;
      breakdown.matchedKeywords.push({
        keyword,
        weight,
        count: matches.length,
        contribution,
      });
    }
  }

  for (const rule of context.learningRules) {
    let ruleMatches = false;
    
    if (rule.patternType === "keyword") {
      ruleMatches = text.includes(rule.pattern.toLowerCase());
    } else if (rule.patternType === "regex") {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        ruleMatches = regex.test(text);
      } catch (e) {
      }
    } else if (rule.patternType === "source") {
      ruleMatches = sourceKey.includes(rule.pattern.toLowerCase());
    }

    if (ruleMatches) {
      score += rule.scoreAdjustment;
      breakdown.ruleScore += rule.scoreAdjustment;
      breakdown.appliedRules.push({
        ruleId: rule.id,
        pattern: rule.pattern,
        type: rule.ruleType,
        adjustment: rule.scoreAdjustment,
      });

      await db.update(aiLearningRules)
        .set({ 
          timesApplied: sql`${aiLearningRules.timesApplied} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(aiLearningRules.id, rule.id));
    }
  }

  if (/\$[\d,]+|€[\d,]+|£[\d,]+|million|billion/i.test(text)) {
    score += 8;
    breakdown.baseScore += 8;
  }

  if (/florida|california|mediterranean|caribbean|bahamas|monaco|france|italy|spain|greece/i.test(text)) {
    score += 4;
    breakdown.baseScore += 4;
  }

  score = Math.max(0, Math.min(100, score));
  breakdown.baseScore = Math.max(0, breakdown.baseScore);

  return { score, breakdown };
}

export interface ScoreBreakdown {
  baseScore: number;
  keywordScore: number;
  sourceScore: number;
  ruleScore: number;
  matchedKeywords: Array<{
    keyword: string;
    weight: number;
    count: number;
    contribution: number;
  }>;
  appliedRules: Array<{
    ruleId: number;
    pattern: string;
    type: string;
    adjustment: number;
  }>;
}

export async function processFeedbackForLearning(
  feedbackId: number,
  articleId: number,
  feedbackType: string,
  orgId: string
): Promise<{ keywordsUpdated: number; sourcesUpdated: number; rulesCreated: number }> {
  const startTime = Date.now();
  const results = { keywordsUpdated: 0, sourcesUpdated: 0, rulesCreated: 0 };

  const [article] = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);
  if (!article) return results;

  const isPositive = feedbackType === "helpful";
  const isNegative = ["irrelevant", "spam", "low_quality"].includes(feedbackType);
  const adjustment = isPositive ? 1 : isNegative ? -1 : 0;

  if (adjustment !== 0) {
    const existingSource = await db.select().from(aiSourceAdjustments)
      .where(and(
        eq(aiSourceAdjustments.orgId, orgId),
        eq(aiSourceAdjustments.sourceName, article.source)
      ))
      .limit(1);

    if (existingSource.length > 0) {
      const src = existingSource[0];
      const newHelpful = src.helpfulArticles + (isPositive ? 1 : 0);
      const newIrrelevant = src.irrelevantArticles + (isNegative ? 1 : 0);
      const newTotal = src.totalArticles + 1;
      const newAccuracy = Math.round((newHelpful / Math.max(1, newHelpful + newIrrelevant)) * 100);
      const bonusAdjustment = isPositive ? 2 : isNegative ? -2 : 0;
      const newBonus = Math.max(-50, Math.min(50, src.currentRelevanceBonus + bonusAdjustment));

      await db.update(aiSourceAdjustments)
        .set({
          helpfulArticles: newHelpful,
          irrelevantArticles: newIrrelevant,
          totalArticles: newTotal,
          accuracyRate: newAccuracy,
          currentRelevanceBonus: newBonus,
          updatedAt: new Date(),
        })
        .where(eq(aiSourceAdjustments.id, src.id));
      
      results.sourcesUpdated++;
    } else {
      await db.insert(aiSourceAdjustments).values({
        orgId,
        sourceName: article.source,
        sourceUrl: article.url,
        baseRelevanceBonus: 0,
        currentRelevanceBonus: adjustment * 2,
        totalArticles: 1,
        helpfulArticles: isPositive ? 1 : 0,
        irrelevantArticles: isNegative ? 1 : 0,
        accuracyRate: isPositive ? 100 : isNegative ? 0 : 50,
      });
      results.sourcesUpdated++;
    }

    const titleWords = extractSignificantWords(article.title);
    for (const word of titleWords) {
      const existingKeyword = await db.select().from(aiKeywordWeights)
        .where(and(
          eq(aiKeywordWeights.orgId, orgId),
          eq(aiKeywordWeights.keyword, word)
        ))
        .limit(1);

      if (existingKeyword.length > 0) {
        const kw = existingKeyword[0];
        const newPositive = kw.positiveSignals + (isPositive ? 1 : 0);
        const newNegative = kw.negativeSignals + (isNegative ? 1 : 0);
        const totalSignals = newPositive + newNegative;
        const newConfidence = Math.min(100, 50 + Math.floor((totalSignals / 20) * 50));
        const weightAdjustment = isPositive ? 1 : isNegative ? -1 : 0;
        const newWeight = Math.max(1, Math.min(20, kw.currentWeight + weightAdjustment));

        await db.update(aiKeywordWeights)
          .set({
            positiveSignals: newPositive,
            negativeSignals: newNegative,
            currentWeight: newWeight,
            confidenceScore: newConfidence,
            updatedAt: new Date(),
          })
          .where(eq(aiKeywordWeights.id, kw.id));
        
        results.keywordsUpdated++;
      } else if (isPositive) {
        const defaultConfig = DEFAULT_KEYWORDS[word];
        await db.insert(aiKeywordWeights).values({
          orgId,
          keyword: word,
          category: (defaultConfig?.category as any) || "custom",
          baseWeight: defaultConfig?.weight || 5,
          currentWeight: (defaultConfig?.weight || 5) + 1,
          positiveSignals: 1,
          negativeSignals: 0,
          confidenceScore: 51,
          isUserDefined: !defaultConfig,
        });
        results.keywordsUpdated++;
      }
    }

    if (isNegative && feedbackType === "spam") {
      await db.insert(aiLearningRules).values({
        orgId,
        ruleType: "penalize",
        pattern: article.source,
        patternType: "source",
        scoreAdjustment: -15,
        confidenceScore: 60,
        learnedFromFeedbackId: feedbackId,
        learnedFromArticleId: articleId,
      });
      results.rulesCreated++;
    }
  }

  await db.update(articleFeedback)
    .set({
      processedByAi: true,
      processedAt: new Date(),
    })
    .where(eq(articleFeedback.id, feedbackId));

  await updateTrainingAnalytics(orgId, feedbackType);
  await recordTrainingSession(orgId, results, Date.now() - startTime);

  clearScoringCache(orgId);

  return results;
}

function extractSignificantWords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those',
    'it', 'its', 'new', 'from', 'as', 'more', 'about', 'up', 'out', 'into',
    'over', 'after', 'before', 'between', 'under', 'above', 'below', 'all',
    'each', 'every', 'both', 'few', 'many', 'some', 'any', 'most', 'other',
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  return [...new Set(words)].slice(0, 10);
}

async function updateTrainingAnalytics(orgId: string, feedbackType: string) {
  const existing = await db.select().from(aiTrainingAnalytics)
    .where(eq(aiTrainingAnalytics.orgId, orgId))
    .limit(1);

  const updates: any = {
    totalFeedback: sql`${aiTrainingAnalytics.totalFeedback} + 1`,
    updatedAt: new Date(),
    lastTrainingAt: new Date(),
  };

  if (feedbackType === "helpful") {
    updates.helpfulFeedback = sql`${aiTrainingAnalytics.helpfulFeedback} + 1`;
  } else if (feedbackType === "irrelevant") {
    updates.irrelevantFeedback = sql`${aiTrainingAnalytics.irrelevantFeedback} + 1`;
  } else if (feedbackType === "duplicate") {
    updates.duplicateFeedback = sql`${aiTrainingAnalytics.duplicateFeedback} + 1`;
  } else if (feedbackType === "wrong_category") {
    updates.wrongCategoryFeedback = sql`${aiTrainingAnalytics.wrongCategoryFeedback} + 1`;
  }

  if (existing.length > 0) {
    await db.update(aiTrainingAnalytics).set(updates).where(eq(aiTrainingAnalytics.orgId, orgId));
  } else {
    await db.insert(aiTrainingAnalytics).values({
      orgId,
      totalFeedback: 1,
      helpfulFeedback: feedbackType === "helpful" ? 1 : 0,
      irrelevantFeedback: feedbackType === "irrelevant" ? 1 : 0,
      duplicateFeedback: feedbackType === "duplicate" ? 1 : 0,
      wrongCategoryFeedback: feedbackType === "wrong_category" ? 1 : 0,
    });
  }
}

async function recordTrainingSession(
  orgId: string,
  results: { keywordsUpdated: number; sourcesUpdated: number; rulesCreated: number },
  durationMs: number
) {
  await db.insert(aiTrainingSessions).values({
    orgId,
    sessionType: "feedback_processing",
    feedbackProcessed: 1,
    keywordsUpdated: results.keywordsUpdated,
    sourcesUpdated: results.sourcesUpdated,
    rulesCreated: results.rulesCreated,
    durationMs,
  });
}

export async function getTrainingAnalytics(orgId: string) {
  const [analytics] = await db.select().from(aiTrainingAnalytics)
    .where(eq(aiTrainingAnalytics.orgId, orgId))
    .limit(1);

  const [keywordCount] = await db.select({ count: sql<number>`count(*)` })
    .from(aiKeywordWeights)
    .where(and(eq(aiKeywordWeights.orgId, orgId), eq(aiKeywordWeights.isActive, true)));

  const [ruleCount] = await db.select({ count: sql<number>`count(*)` })
    .from(aiLearningRules)
    .where(and(eq(aiLearningRules.orgId, orgId), eq(aiLearningRules.isActive, true)));

  const [sourceCount] = await db.select({ count: sql<number>`count(*)` })
    .from(aiSourceAdjustments)
    .where(eq(aiSourceAdjustments.orgId, orgId));

  const recentSessions = await db.select().from(aiTrainingSessions)
    .where(eq(aiTrainingSessions.orgId, orgId))
    .orderBy(desc(aiTrainingSessions.processedAt))
    .limit(10);

  const estimatedAccuracy = analytics 
    ? Math.round((analytics.helpfulFeedback / Math.max(1, analytics.totalFeedback)) * 100)
    : 50;

  return {
    totalFeedback: analytics?.totalFeedback || 0,
    helpfulFeedback: analytics?.helpfulFeedback || 0,
    irrelevantFeedback: analytics?.irrelevantFeedback || 0,
    duplicateFeedback: analytics?.duplicateFeedback || 0,
    wrongCategoryFeedback: analytics?.wrongCategoryFeedback || 0,
    totalKeywords: Number(keywordCount?.count || 0),
    activeRules: Number(ruleCount?.count || 0),
    trackedSources: Number(sourceCount?.count || 0),
    estimatedAccuracy,
    lastTrainingAt: analytics?.lastTrainingAt,
    recentSessions,
  };
}

export async function getKeywordWeights(orgId: string) {
  return db.select().from(aiKeywordWeights)
    .where(eq(aiKeywordWeights.orgId, orgId))
    .orderBy(desc(aiKeywordWeights.currentWeight));
}

export async function getSourceAdjustments(orgId: string) {
  return db.select().from(aiSourceAdjustments)
    .where(eq(aiSourceAdjustments.orgId, orgId))
    .orderBy(desc(aiSourceAdjustments.totalArticles));
}

export async function getLearningRules(orgId: string) {
  return db.select().from(aiLearningRules)
    .where(eq(aiLearningRules.orgId, orgId))
    .orderBy(desc(aiLearningRules.timesApplied));
}

export async function addCustomKeyword(
  orgId: string,
  keyword: string,
  weight: number,
  category: string
) {
  await db.insert(aiKeywordWeights).values({
    orgId,
    keyword: keyword.toLowerCase(),
    category: category as any,
    baseWeight: weight,
    currentWeight: weight,
    isUserDefined: true,
    confidenceScore: 100,
  }).onConflictDoUpdate({
    target: [aiKeywordWeights.orgId, aiKeywordWeights.keyword],
    set: {
      currentWeight: weight,
      baseWeight: weight,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  clearScoringCache(orgId);
}

export async function updateKeywordWeight(
  orgId: string,
  keywordId: number,
  newWeight: number
) {
  await db.update(aiKeywordWeights)
    .set({ currentWeight: newWeight, updatedAt: new Date() })
    .where(and(
      eq(aiKeywordWeights.id, keywordId),
      eq(aiKeywordWeights.orgId, orgId)
    ));

  clearScoringCache(orgId);
}

export async function deleteKeyword(orgId: string, keywordId: number) {
  await db.update(aiKeywordWeights)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(aiKeywordWeights.id, keywordId),
      eq(aiKeywordWeights.orgId, orgId)
    ));

  clearScoringCache(orgId);
}

export async function addLearningRule(
  orgId: string,
  ruleType: string,
  pattern: string,
  patternType: string,
  scoreAdjustment: number
) {
  await db.insert(aiLearningRules).values({
    orgId,
    ruleType,
    pattern,
    patternType,
    scoreAdjustment,
    confidenceScore: 100,
  });

  clearScoringCache(orgId);
}

export async function deleteLearningRule(orgId: string, ruleId: number) {
  await db.update(aiLearningRules)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(aiLearningRules.id, ruleId),
      eq(aiLearningRules.orgId, orgId)
    ));

  clearScoringCache(orgId);
}

export async function initializeDefaultKeywords(orgId: string) {
  const existing = await db.select({ count: sql<number>`count(*)` })
    .from(aiKeywordWeights)
    .where(eq(aiKeywordWeights.orgId, orgId));

  if (Number(existing[0]?.count || 0) > 0) {
    return;
  }

  const values = Object.entries(DEFAULT_KEYWORDS).map(([keyword, config]) => ({
    orgId,
    keyword,
    category: config.category as any,
    baseWeight: config.weight,
    currentWeight: config.weight,
    confidenceScore: 80,
    isUserDefined: false,
  }));

  if (values.length > 0) {
    await db.insert(aiKeywordWeights).values(values);
  }

  console.log(`[Adaptive Scoring] Initialized ${values.length} default keywords for org ${orgId}`);
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
