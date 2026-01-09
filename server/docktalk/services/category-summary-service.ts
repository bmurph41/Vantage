import OpenAI from "openai";
import { db } from "../db";
import { articles, categorySummaries, summaryEdits } from "@shared/docktalk-schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import type { CategorySummary, InsertCategorySummary } from "@shared/docktalk-schema";

const openai = new OpenAI();

const CATEGORIES = [
  'Macro',
  'M&A',
  'Development',
  'Operations',
  'Regulatory',
  'Environmental',
  'Technology',
  'General',
  'Boat Sales',
  'Boat Show',
  'Manufacturing',
  'Industry Trends',
  'Marina Sale',
  'Education',
  'Insurance',
  'Legal',
  'People Moves',
  'Company Earnings',
  'Awards',
  'Business Planning',
  'International'
];

interface CategoryArticles {
  category: string;
  articles: Array<{
    title: string;
    summary: string;
    source: string;
    publishedAt: Date;
    relevanceScore: number;
  }>;
}

interface SummaryResponse {
  executiveSummary: string;
  keyTrends: string[];
  topSources: string[];
  insights: string;
  comparisonWithPrevious: string;
}

async function getArticlesForPeriod(
  category: string,
  startDate: Date,
  endDate: Date
): Promise<CategoryArticles> {
  const categoryArticles = await db
    .select({
      title: articles.title,
      summary: articles.summary,
      source: articles.source,
      publishedAt: articles.publishedAt,
      relevanceScore: articles.relevanceScore,
    })
    .from(articles)
    .where(
      and(
        sql`${category} = ANY(${articles.categories})`,
        gte(articles.publishedAt, startDate),
        lte(articles.publishedAt, endDate),
        eq(articles.isRemoved, false)
      )
    )
    .orderBy(articles.relevanceScore, articles.publishedAt);

  return {
    category,
    articles: categoryArticles.map(a => ({
      ...a,
      summary: a.summary || "",
      publishedAt: a.publishedAt || new Date(),
      relevanceScore: a.relevanceScore || 0
    }))
  };
}

async function generateSummaryWithAI(
  categoryData: CategoryArticles,
  previousPeriodCount: number,
  period: "daily" | "weekly"
): Promise<SummaryResponse> {
  const articlesList = categoryData.articles
    .slice(0, 50)
    .map((a, i) => `${i + 1}. [${a.source}] ${a.title}\n   Summary: ${a.summary || "No summary"}`)
    .join("\n\n");

  const periodLabel = period === "daily" ? "past 24 hours" : "past 7 days";
  const previousPeriodLabel = period === "daily" ? "previous day" : "previous week";

  const prompt = `You are analyzing marina industry news for institutional investors and PE firms. 

Category: ${categoryData.category}
Period: ${periodLabel}
Article Count: ${categoryData.articles.length}
Previous Period Count: ${previousPeriodCount}

Articles:
${articlesList}

Provide a comprehensive analysis in JSON format:
{
  "executiveSummary": "2-3 paragraph executive summary highlighting key developments, deal activity, and strategic implications for marina operators and investors",
  "keyTrends": ["Array of 3-5 key trends identified across these articles"],
  "topSources": ["Array of 3-5 most frequently cited sources"],
  "insights": "1-2 paragraphs of strategic insights and forward-looking analysis",
  "comparisonWithPrevious": "1 paragraph comparing current period activity vs ${previousPeriodLabel} (${previousPeriodCount} articles)"
}

Focus on:
- M&A activity, deal flow, valuations
- Operational improvements and challenges  
- Regulatory changes and compliance
- Technology adoption and innovation
- Market growth indicators
- Investment opportunities and risks

Return ONLY valid JSON, no other text.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: prompt
      }],
      max_tokens: 2000,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }

    return {
      executiveSummary: `${categoryData.articles.length} articles analyzed for ${categoryData.category} in the ${periodLabel}.`,
      keyTrends: ["Failed to parse AI response"],
      topSources: [],
      insights: "AI response parsing failed.",
      comparisonWithPrevious: ""
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    return {
      executiveSummary: `${categoryData.articles.length} articles analyzed for ${categoryData.category}.`,
      keyTrends: ["AI generation failed"],
      topSources: [],
      insights: "Failed to generate AI summary.",
      comparisonWithPrevious: ""
    };
  }
}

export async function generateCategorySummary(
  category: string,
  period: "daily" | "weekly"
): Promise<CategorySummary | null> {
  const now = new Date();
  
  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);
  
  const periodStart = new Date(periodEnd);
  
  if (period === "daily") {
    periodStart.setDate(periodEnd.getDate() - 1);
    periodStart.setHours(0, 0, 0, 0);
  } else {
    const dayOfWeek = periodEnd.getDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    periodStart.setDate(periodEnd.getDate() - daysToMonday - 7);
    periodStart.setHours(0, 0, 0, 0);
  }

  const previousPeriodStart = new Date(periodStart);
  const previousPeriodEnd = new Date(periodStart);
  
  if (period === "daily") {
    previousPeriodStart.setDate(periodStart.getDate() - 1);
  } else {
    previousPeriodStart.setDate(periodStart.getDate() - 7);
  }

  const [currentArticles, previousArticles] = await Promise.all([
    getArticlesForPeriod(category, periodStart, periodEnd),
    getArticlesForPeriod(category, previousPeriodStart, previousPeriodEnd)
  ]);

  if (currentArticles.articles.length === 0) {
    return null;
  }

  const aiSummary = await generateSummaryWithAI(
    currentArticles,
    previousArticles.articles.length,
    period
  );

  const avgRelevance = currentArticles.articles.length > 0
    ? Math.round(
        currentArticles.articles.reduce((sum, a) => sum + a.relevanceScore, 0) /
        currentArticles.articles.length
      )
    : 0;

  const sourceCounts = new Map<string, number>();
  currentArticles.articles.forEach(a => {
    sourceCounts.set(a.source, (sourceCounts.get(a.source) || 0) + 1);
  });
  const topSources = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([source]) => source);

  const growthPercentage = previousArticles.articles.length > 0
    ? Math.round(
        ((currentArticles.articles.length - previousArticles.articles.length) /
          previousArticles.articles.length) *
        100
      )
    : 0;

  const summaryData: InsertCategorySummary = {
    category,
    period,
    summaryText: `${aiSummary.executiveSummary}\n\n${aiSummary.insights}`,
    keyTrends: aiSummary.keyTrends,
    articleCount: currentArticles.articles.length,
    avgRelevance,
    topSources,
    comparisonText: aiSummary.comparisonWithPrevious,
    previousPeriodCount: previousArticles.articles.length,
    growthPercentage,
    periodStart,
    periodEnd,
    isEdited: false,
    editedBy: null
  };

  const [existing] = await db
    .select()
    .from(categorySummaries)
    .where(
      and(
        eq(categorySummaries.category, category),
        eq(categorySummaries.period, period),
        eq(categorySummaries.periodStart, periodStart)
      )
    )
    .limit(1);

  if (existing) {
    const updateData = {
      ...summaryData,
      isEdited: existing.isEdited,
      editedBy: existing.editedBy
    };
    
    await db
      .update(categorySummaries)
      .set(updateData)
      .where(eq(categorySummaries.id, existing.id));
    
    return { ...existing, ...updateData };
  }

  const [newSummary] = await db
    .insert(categorySummaries)
    .values(summaryData)
    .returning();

  return newSummary;
}

export async function generateAllCategorySummaries(period: "daily" | "weekly"): Promise<CategorySummary[]> {
  const summaries: CategorySummary[] = [];
  
  for (const category of CATEGORIES) {
    try {
      const summary = await generateCategorySummary(category, period);
      if (summary) {
        summaries.push(summary);
      }
    } catch (error) {
      console.error(`Failed to generate summary for ${category}:`, error);
    }
  }

  return summaries;
}

export async function getLatestSummaries(
  period?: "daily" | "weekly"
): Promise<CategorySummary[]> {
  const query = db
    .select()
    .from(categorySummaries)
    .orderBy(categorySummaries.generatedAt);

  if (period) {
    return await query.where(eq(categorySummaries.period, period));
  }

  return await query;
}

export async function editSummary(
  summaryId: number,
  userId: string,
  editedText: string,
  editReason?: string
): Promise<CategorySummary> {
  const [summary] = await db
    .select()
    .from(categorySummaries)
    .where(eq(categorySummaries.id, summaryId))
    .limit(1);

  if (!summary) {
    throw new Error("Summary not found");
  }

  await db.insert(summaryEdits).values({
    summaryId,
    userId,
    originalText: summary.summaryText,
    editedText,
    editReason
  });

  const now = new Date();
  const [updated] = await db
    .update(categorySummaries)
    .set({
      summaryText: editedText,
      isEdited: true,
      editedBy: userId
    })
    .where(eq(categorySummaries.id, summaryId))
    .returning();

  return updated;
}
