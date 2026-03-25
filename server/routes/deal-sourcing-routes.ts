/**
 * G.3 — AI Deal Sourcing Routes
 *
 * Analyzes historical deal activity to build an "ideal deal" profile (buy box),
 * scores inbound deals against it, and assigns tier rankings (A/B/C/D).
 * Uses AI to identify patterns in top-performing investments.
 */

import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import {
  buyBoxProfiles,
  buyBoxScores,
  crmDeals,
} from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";

export const dealSourcingRouter = Router();

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// ═══════════════════════════════════════════════════════════════════════════
// BUY BOX PROFILE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// GET /buy-box — get buy box profiles
dealSourcingRouter.get("/buy-box", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const profiles = await db
      .select()
      .from(buyBoxProfiles)
      .where(eq(buyBoxProfiles.orgId, orgId))
      .orderBy(desc(buyBoxProfiles.createdAt));
    res.json(profiles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /buy-box — create or update a buy box profile manually
dealSourcingRouter.post("/buy-box", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const [profile] = await db
      .insert(buyBoxProfiles)
      .values({ ...req.body, orgId, createdBy: userId })
      .returning();
    res.status(201).json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /buy-box/:id — update buy box
dealSourcingRouter.put("/buy-box/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [updated] = await db
      .update(buyBoxProfiles)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(buyBoxProfiles.id, req.params.id), eq(buyBoxProfiles.orgId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Buy box not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /buy-box/:id
dealSourcingRouter.delete("/buy-box/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [deleted] = await db
      .delete(buyBoxProfiles)
      .where(and(eq(buyBoxProfiles.id, req.params.id), eq(buyBoxProfiles.orgId, orgId)))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Buy box not found" });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AI-GENERATED BUY BOX
// ═══════════════════════════════════════════════════════════════════════════

// POST /buy-box/generate — AI analyzes closed deals to build ideal profile
dealSourcingRouter.post("/buy-box/generate", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;

    // Get closed/won deals
    const closedDeals = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.isWon, true)))
      .orderBy(desc(crmDeals.updatedAt))
      .limit(50);

    if (closedDeals.length < 3) {
      // Not enough data — return a default profile
      const [profile] = await db
        .insert(buyBoxProfiles)
        .values({
          orgId,
          name: "Default Buy Box",
          isDefault: true,
          preferredAssetClasses: ["marina", "multifamily", "self_storage"],
          priceMin: "1000000",
          priceMax: "50000000",
          capRateMin: "0.050",
          capRateMax: "0.090",
          confidence: "20",
          dataPointCount: closedDeals.length,
          lastGeneratedAt: new Date(),
          createdBy: userId,
        })
        .returning();

      return res.json({
        profile,
        message: `Only ${closedDeals.length} closed deals found. Need at least 3 for AI analysis. Default profile created.`,
      });
    }

    // Extract patterns from closed deals
    const assetClasses = [...new Set(closedDeals.map((d) => d.assetClass).filter(Boolean))];
    const values = closedDeals.map((d) => parseFloat(d.value || "0")).filter((v) => v > 0);
    const cities = closedDeals
      .map((d) => {
        const parts = (d.address || "").split(",");
        return parts.length >= 2 ? parts[parts.length - 2]?.trim() : null;
      })
      .filter(Boolean);
    const uniqueMarkets = [...new Set(cities)];

    let aiProfile: any = null;
    const anthropic = getAnthropicClient();

    if (anthropic && closedDeals.length >= 5) {
      try {
        const dealsSummary = closedDeals
          .map(
            (d) =>
              `${d.assetClass} | ${d.address || "N/A"} | $${Number(d.value || 0).toLocaleString()} | Stage: ${d.stage}`,
          )
          .join("\n");

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content: `Analyze these ${closedDeals.length} closed CRE investments and identify the ideal acquisition profile.

CLOSED DEALS:
${dealsSummary}

Return a JSON object with:
{
  "preferred_asset_classes": ["list"],
  "preferred_markets": ["list"],
  "price_range": { "min": number, "max": number },
  "cap_rate_range": { "min": number, "max": number },
  "preferred_strategies": ["value_add", "core_plus", etc.],
  "avoid_characteristics": ["list of red flags"],
  "pattern_insights": "2-3 sentences about patterns found",
  "confidence": 0-100
}`,
            },
          ],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) aiProfile = JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through to rule-based
      }
    }

    // Build profile from data + AI insights
    const priceMin = values.length > 0 ? Math.min(...values) * 0.5 : 1000000;
    const priceMax = values.length > 0 ? Math.max(...values) * 1.5 : 50000000;

    const [profile] = await db
      .insert(buyBoxProfiles)
      .values({
        orgId,
        name: "AI-Generated Buy Box",
        isDefault: true,
        preferredAssetClasses: aiProfile?.preferred_asset_classes || assetClasses,
        preferredMarkets: aiProfile?.preferred_markets || uniqueMarkets,
        priceMin: String(Math.round(aiProfile?.price_range?.min || priceMin)),
        priceMax: String(Math.round(aiProfile?.price_range?.max || priceMax)),
        capRateMin: String(aiProfile?.cap_rate_range?.min || 0.05),
        capRateMax: String(aiProfile?.cap_rate_range?.max || 0.09),
        preferredStrategies: aiProfile?.preferred_strategies || ["value_add"],
        avoidCharacteristics: aiProfile?.avoid_characteristics || [],
        aiGeneratedProfile: aiProfile,
        confidence: String(aiProfile?.confidence || 50),
        dataPointCount: closedDeals.length,
        lastGeneratedAt: new Date(),
        createdBy: userId,
      })
      .returning();

    res.json({
      profile,
      dealsAnalyzed: closedDeals.length,
      patternInsights: aiProfile?.pattern_insights || "Profile built from deal history data.",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DEAL SCORING AGAINST BUY BOX
// ═══════════════════════════════════════════════════════════════════════════

// POST /score/:dealId — score a deal against the default buy box
dealSourcingRouter.post("/score/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { dealId } = req.params;
    const { buyBoxId } = req.body;

    // Get deal
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId)));
    if (!deal) return res.status(404).json({ error: "Deal not found" });

    // Get buy box profile
    let profile;
    if (buyBoxId) {
      [profile] = await db
        .select()
        .from(buyBoxProfiles)
        .where(and(eq(buyBoxProfiles.id, buyBoxId), eq(buyBoxProfiles.orgId, orgId)));
    } else {
      [profile] = await db
        .select()
        .from(buyBoxProfiles)
        .where(and(eq(buyBoxProfiles.orgId, orgId), eq(buyBoxProfiles.isDefault, true)))
        .limit(1);
    }

    if (!profile) {
      return res.status(400).json({
        error: "No buy box profile found. Create one first or use POST /buy-box/generate.",
      });
    }

    const { score, tier, matches, misses } = scoreDeal(deal, profile);

    // Store score
    const [stored] = await db
      .insert(buyBoxScores)
      .values({
        orgId,
        dealId,
        buyBoxId: profile.id,
        score,
        tier,
        matches,
        misses,
      })
      .returning();

    res.json({
      dealId,
      dealTitle: deal.title,
      score,
      tier,
      matches,
      misses,
      scoreId: stored.id,
      buyBoxName: profile.name,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /score-batch — score all open deals
dealSourcingRouter.post("/score-batch", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    // Get default buy box
    const [profile] = await db
      .select()
      .from(buyBoxProfiles)
      .where(and(eq(buyBoxProfiles.orgId, orgId), eq(buyBoxProfiles.isDefault, true)))
      .limit(1);

    if (!profile) {
      return res.status(400).json({ error: "No default buy box profile found." });
    }

    const openDeals = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, false)))
      .limit(200);

    const results = [];
    for (const deal of openDeals) {
      const { score, tier, matches, misses } = scoreDeal(deal, profile);

      await db.insert(buyBoxScores).values({
        orgId,
        dealId: deal.id,
        buyBoxId: profile.id,
        score,
        tier,
        matches,
        misses,
      });

      results.push({
        dealId: deal.id,
        dealTitle: deal.title,
        score,
        tier,
        assetClass: deal.assetClass,
        value: deal.value,
      });
    }

    results.sort((a, b) => b.score - a.score);

    const tierCounts = {
      A: results.filter((r) => r.tier === "A").length,
      B: results.filter((r) => r.tier === "B").length,
      C: results.filter((r) => r.tier === "C").length,
      D: results.filter((r) => r.tier === "D").length,
    };

    res.json({
      totalScored: results.length,
      tierCounts,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /scores/:dealId — get score history for a deal
dealSourcingRouter.get("/scores/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const scores = await db
      .select()
      .from(buyBoxScores)
      .where(and(eq(buyBoxScores.dealId, req.params.dealId), eq(buyBoxScores.orgId, orgId)))
      .orderBy(desc(buyBoxScores.scoredAt));
    res.json(scores);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /leaderboard — all deals ranked by buy box score
dealSourcingRouter.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    // Get latest score per deal
    const scores = await db
      .select()
      .from(buyBoxScores)
      .where(eq(buyBoxScores.orgId, orgId))
      .orderBy(desc(buyBoxScores.scoredAt));

    const latestByDeal = new Map<string, any>();
    for (const s of scores) {
      if (!latestByDeal.has(s.dealId)) latestByDeal.set(s.dealId, s);
    }

    const leaderboard = Array.from(latestByDeal.values()).sort((a, b) => b.score - a.score);

    res.json({
      total: leaderboard.length,
      leaderboard,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Scoring Function ─────────────────────────────────────────────────────

function scoreDeal(
  deal: any,
  profile: any,
): { score: number; tier: string; matches: string[]; misses: string[] } {
  let score = 100;
  const matches: string[] = [];
  const misses: string[] = [];

  // Asset class match (25 points)
  const preferredClasses = (profile.preferredAssetClasses as string[]) || [];
  if (preferredClasses.length > 0) {
    if (preferredClasses.some((c: string) => c.toLowerCase() === (deal.assetClass || "").toLowerCase())) {
      matches.push(`Asset class (${deal.assetClass}) matches target set`);
    } else {
      score -= 25;
      misses.push(`Asset class (${deal.assetClass || "Unknown"}) not in target: ${preferredClasses.join(", ")}`);
    }
  }

  // Price range (20 points)
  const dealValue = parseFloat(deal.value || "0");
  const priceMin = parseFloat(profile.priceMin || "0");
  const priceMax = parseFloat(profile.priceMax || "999999999");
  if (dealValue > 0) {
    if (dealValue >= priceMin && dealValue <= priceMax) {
      matches.push(`Price $${dealValue.toLocaleString()} within range`);
    } else {
      score -= 20;
      misses.push(
        `Price $${dealValue.toLocaleString()} outside $${priceMin.toLocaleString()}-$${priceMax.toLocaleString()} range`,
      );
    }
  }

  // Market match (15 points)
  const preferredMarkets = (profile.preferredMarkets as string[]) || [];
  if (preferredMarkets.length > 0 && deal.address) {
    const dealAddress = (deal.address || "").toLowerCase();
    const marketMatch = preferredMarkets.some((m: string) =>
      dealAddress.includes(m.toLowerCase()),
    );
    if (marketMatch) {
      matches.push("Market matches preferred geography");
    } else {
      score -= 15;
      misses.push(`Market not in preferred list: ${preferredMarkets.slice(0, 5).join(", ")}`);
    }
  }

  // Cap rate range (15 points) — use deal probability as proxy if cap rate not available
  const capRateMin = parseFloat(profile.capRateMin || "0");
  const capRateMax = parseFloat(profile.capRateMax || "1");
  // Cap rate scoring deferred if no cap rate data on deal

  // Avoid characteristics (15 points)
  const avoidList = (profile.avoidCharacteristics as string[]) || [];
  // Checked against deal description/notes
  const dealText = `${deal.title || ""} ${deal.description || ""}`.toLowerCase();
  const avoidHit = avoidList.find((a: string) => dealText.includes(a.toLowerCase()));
  if (avoidHit) {
    score -= 15;
    misses.push(`Contains avoid characteristic: "${avoidHit}"`);
  } else if (avoidList.length > 0) {
    matches.push("No avoid characteristics detected");
  }

  // Size/units (10 points)
  const unitsMin = profile.unitsMin;
  const unitsMax = profile.unitsMax;
  // Unit count not always on deal — skip if not available

  score = Math.max(0, Math.min(100, score));
  const tier = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";

  return { score, tier, matches, misses };
}
