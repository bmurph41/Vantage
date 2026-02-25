import { db } from "../db";
import { assetClassConfigs, userAssetSubscriptions, articles, rssSources, aiKeywordWeights, aiSourceAdjustments, aiLearningRules, articleRemovalPatterns, articleFeedback } from "@shared/docket-schema";
import { users } from "@shared/docket-schema";
import { eq, isNull, sql } from "drizzle-orm";

export async function seedMarinaAssetClass() {
  console.log("[Asset Class Seed] Starting marina config seed...");

  // 1. Check if marina config already exists
  const existing = await db.select().from(assetClassConfigs).where(eq(assetClassConfigs.slug, "marina")).limit(1);

  let marinaConfigId: number;

  if (existing.length > 0) {
    marinaConfigId = existing[0].id;
    console.log(`[Asset Class Seed] Marina config already exists (id: ${marinaConfigId}), skipping insert.`);
  } else {
    const [inserted] = await db.insert(assetClassConfigs).values({
      slug: "marina",
      displayName: "Marina",
      icon: "anchor",
      color: "#1B3A5C",
      isActive: true,
      requiredKeywords: [
        "marina", "marina for sale", "marina broker", "property investment", "marina operations",
        "marinas for sale", "properties", "boat sales", "private equity in marinas", "boat slip",
        "dry stack", "yacht club", "boatyard", "superyacht marina", "megayacht", "dockage",
        "storage", "marine industry", "marina operator", "marina owner", "marina management"
      ],
      scoringTerms: {
        vertical: {
          marina: 8, boat: 8, boating: 8, slip: 8, "dry stack": 8,
          dock: 8, "fuel dock": 8, harbor: 8, moorage: 8, berth: 8,
          yacht: 8, nautical: 8, outboard: 8, inboard: 8,
          haul: 8, launch: 8, dockmaster: 8, superyacht: 8,
          megayacht: 8, pontoon: 8, jetty: 8, wharf: 8,
          anchorage: 8, boatyard: 8, shipyard: 8, waterfront: 8, sailing: 8
        },
        verticalWeightCap: 40,
        verticalWeightEach: 8
      },
      excludeKeywords: ["cruise ship", "cargo", "container", "oil rig", "commercial vessel"],
      sourceMatchRegex: "marina|boating|dock|yacht|maritime|superyacht",
      aiSystemPrompt: "You are an expert in the marina and marine industry. Analyze this article and assign 1-4 most relevant categories. Focus on recreational boating, marina operations, yacht/boat sales, marine infrastructure, and waterfront investment.",
      categories: [
        "Marina Sale", "Boat Sales", "Boat Show", "Manufacturing", "Education",
        "Macro", "M&A", "Development", "Operations", "Regulatory",
        "Environmental", "Technology", "Insurance", "Legal",
        "People Moves", "Company Earnings", "Awards",
        "Business Planning", "Industry Trends", "General"
      ],
      categoryDefinitions: {
        "Marina Sale": "Marina sales, acquisitions, buyouts, purchases, valuations, transaction multiples",
        "Boat Sales": "Boat sales data, brokerage, yacht sales, dealer sales, market trends",
        "Boat Show": "Boat shows, marine trade shows, exhibitions, industry events",
        "Manufacturing": "Boat manufacturing, shipbuilding, production, OEM, factory operations",
        "Education": "Training programs, certifications, courses, marine education, safety",
        "Macro": "Federal Reserve, interest rates, inflation, economic indicators, GDP",
        "M&A": "Mergers, acquisitions, buyouts, deals, transactions, valuations",
        "Development": "Construction, renovation, permitting, zoning, new projects",
        "Operations": "Day-to-day marina operations, dock management, fuel systems, storage",
        "Regulatory": "Government regulations, compliance, zoning laws, permits",
        "Environmental": "Climate change, sea level rise, sustainability, storm resilience",
        "Technology": "IoT, sensors, digital platforms, AI, smart marina tech",
        "Insurance": "Insurance coverage, risk management, climate risk, liability",
        "Legal": "Legal disputes, lawsuits, compliance requirements",
        "People Moves": "Executive appointments, hirings, promotions, retirements",
        "Company Earnings": "Quarterly earnings, financial results, revenue reports",
        "Awards": "Industry awards, recognition, honors, achievements",
        "Business Planning": "Strategic planning, expansion plans, growth strategy",
        "Industry Trends": "Market analysis, forecasts, research studies",
        "General": "Articles that don't clearly fit other categories"
      },
      baseSourceBonus: 20,
      termWeightCap: 40,
      termWeightEach: 8,
      financialBonus: 10,
      locationBonusTerms: [
        "florida", "california", "mediterranean", "caribbean",
        "bahamas", "monaco", "france", "italy", "spain", "greece"
      ],
      locationBonus: 5,
      topicStatement: "Marina investment, operations, and recreational boating industry intelligence",
      defaultKeywordWeights: {
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
        cargo: { weight: -8, category: "negative" }
      }
    }).returning();

    marinaConfigId = inserted.id;
    console.log(`[Asset Class Seed] Created marina config (id: ${marinaConfigId})`);
  }

  // 2. Backfill articles
  const articleResult = await db.update(articles)
    .set({ assetClassId: marinaConfigId })
    .where(isNull(articles.assetClassId));
  console.log(`[Asset Class Seed] Backfilled articles with marina config`);

  // 3. Backfill RSS sources
  await db.update(rssSources)
    .set({ assetClassId: marinaConfigId })
    .where(isNull(rssSources.assetClassId));
  console.log(`[Asset Class Seed] Backfilled RSS sources with marina config`);

  // 4. Backfill AI learning tables
  await db.update(aiKeywordWeights)
    .set({ assetClassId: marinaConfigId })
    .where(isNull(aiKeywordWeights.assetClassId));

  await db.update(aiSourceAdjustments)
    .set({ assetClassId: marinaConfigId })
    .where(isNull(aiSourceAdjustments.assetClassId));

  await db.update(aiLearningRules)
    .set({ assetClassId: marinaConfigId })
    .where(isNull(aiLearningRules.assetClassId));

  await db.update(articleRemovalPatterns)
    .set({ assetClassId: marinaConfigId })
    .where(isNull(articleRemovalPatterns.assetClassId));

  await db.update(articleFeedback)
    .set({ assetClassId: marinaConfigId })
    .where(isNull(articleFeedback.assetClassId));

  console.log(`[Asset Class Seed] Backfilled AI learning tables`);

  // 5. Auto-subscribe all existing users to marina
  const allUsers = await db.select({ id: users.id }).from(users);
  let subsCreated = 0;

  for (const user of allUsers) {
    try {
      await db.insert(userAssetSubscriptions).values({
        userId: user.id,
        assetClassId: marinaConfigId,
        isPrimary: true,
        showShared: true,
        notificationLevel: "all",
      }).onConflictDoNothing();
      subsCreated++;
    } catch (e) {
      // Already subscribed, skip
    }
  }

  console.log(`[Asset Class Seed] Subscribed ${subsCreated} users to marina`);
  console.log(`[Asset Class Seed] Complete!`);

  return marinaConfigId;
}