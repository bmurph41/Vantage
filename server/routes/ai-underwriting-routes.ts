/**
 * G.1 — AI Underwriting Assistant Routes
 *
 * When a deal address is entered, AI researches the market, pulls comps,
 * fetches public records, and generates first-draft pro forma assumptions.
 * Turns a blank deal into a working underwrite in under 60 seconds.
 */

import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import {
  aiUnderwritingRuns,
  crmDeals,
  salesComps,
  propertyPublicRecords,
} from "@shared/schema";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { PublicRecordsService } from "../services/public-records-service";

export const aiUnderwritingRouter = Router();

const publicRecordsService = new PublicRecordsService();

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// ── Run AI Underwriting ──────────────────────────────────────────────────

// POST /run/:dealId — run full AI underwriting analysis
aiUnderwritingRouter.post("/run/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { dealId } = req.params;

    // Get the deal
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId)));

    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const address = deal.address || req.body.address || "";
    const assetClass = deal.assetClass || req.body.assetClass || "commercial";
    const askPrice = deal.value || req.body.askPrice;

    if (!address) {
      return res.status(400).json({ error: "Deal must have an address for AI underwriting" });
    }

    // Create run record
    const [run] = await db
      .insert(aiUnderwritingRuns)
      .values({
        orgId,
        dealId,
        status: "researching",
        address,
        assetClass,
        askPrice: askPrice ? String(askPrice) : null,
        createdBy: userId,
      })
      .returning();

    const startTime = Date.now();

    // Step 1: Find comparable sales from internal DB
    let compsFound = 0;
    let compsContext = "No comparable sales found in database.";
    try {
      const city = extractCity(address);
      const state = extractState(address);

      const conditions = [eq(salesComps.orgId, orgId)];
      if (city) conditions.push(ilike(salesComps.city, `%${city}%`));
      if (state) conditions.push(ilike(salesComps.state, `%${state}%`));

      const comps = await db
        .select()
        .from(salesComps)
        .where(and(...conditions))
        .orderBy(desc(salesComps.saleYear))
        .limit(10);

      // Also check global comps
      const globalComps = await db
        .select()
        .from(salesComps)
        .where(
          and(
            eq(salesComps.scope, "global"),
            city ? ilike(salesComps.city, `%${city}%`) : sql`true`,
          ),
        )
        .limit(5);

      const allComps = [...comps, ...globalComps];
      compsFound = allComps.length;

      if (allComps.length > 0) {
        compsContext = allComps
          .map(
            (c) =>
              `${c.marina || c.address || "Unknown"}: $${c.salePrice?.toLocaleString() || "N/A"}, Cap Rate: ${c.capRate || "N/A"}%, NOI: $${c.noi?.toLocaleString() || "N/A"}, ${c.wetSlips || 0} wet slips, ${c.saleYear || "N/A"}`,
          )
          .join("\n");
      }
    } catch {
      // Continue without comps
    }

    // Step 2: Pull public records
    let publicRecordsContext = "Public records not available.";
    let publicRecordsEnriched = false;
    try {
      const snapshot = await publicRecordsService.enrichFromAddress(address);
      if (snapshot.externalId) {
        publicRecordsEnriched = true;
        publicRecordsContext = [
          `Year Built: ${snapshot.yearBuilt || "Unknown"}`,
          `Building SF: ${snapshot.buildingSqFt?.toLocaleString() || "Unknown"}`,
          `Lot SF: ${snapshot.lotSqFt?.toLocaleString() || "Unknown"}`,
          `Units: ${snapshot.totalUnits || "Unknown"}`,
          `Current Owner: ${snapshot.currentOwner || "Unknown"}`,
          `Last Sale: ${snapshot.lastSaleDate || "Unknown"} at $${snapshot.lastSalePrice?.toLocaleString() || "Unknown"}`,
          `Assessed Value: $${snapshot.assessedValue?.toLocaleString() || "Unknown"}`,
          `Annual Taxes: $${snapshot.annualTaxes?.toLocaleString() || "Unknown"}`,
          `Total Liens: $${snapshot.totalLienAmount?.toLocaleString() || "0"}`,
        ].join("\n");

        // Store public records
        await db.insert(propertyPublicRecords).values({
          orgId,
          dealId,
          address,
          externalId: snapshot.externalId,
          provider: snapshot.provider,
          yearBuilt: snapshot.yearBuilt,
          buildingSqFt: snapshot.buildingSqFt,
          lotSqFt: snapshot.lotSqFt,
          totalUnits: snapshot.totalUnits,
          stories: snapshot.stories,
          constructionType: snapshot.constructionType,
          currentOwner: snapshot.currentOwner,
          assessedValue: snapshot.assessedValue ? String(snapshot.assessedValue) : null,
          taxYear: snapshot.taxYear,
          annualTaxes: snapshot.annualTaxes ? String(snapshot.annualTaxes) : null,
          saleHistory: snapshot.saleHistory,
          lastSaleDate: snapshot.lastSaleDate,
          lastSalePrice: snapshot.lastSalePrice ? String(snapshot.lastSalePrice) : null,
          liens: snapshot.liens,
          totalLienAmount: String(snapshot.totalLienAmount),
          dataAsOf: snapshot.dataAsOf,
          rawResponse: snapshot,
        });
      }
    } catch {
      // Continue without public records
    }

    // Step 3: AI synthesis
    await db
      .update(aiUnderwritingRuns)
      .set({ status: "analyzing", compsFound, publicRecordsEnriched })
      .where(eq(aiUnderwritingRuns.id, run.id));

    const anthropic = getAnthropicClient();
    let suggestedAssumptions: any = null;
    let marketCommentary = "";
    let riskFlags: string[] = [];
    let confidence = "low";
    let modelUsed = "";
    let tokensUsed = 0;

    if (anthropic) {
      try {
        const prompt = `You are a CRE underwriting analyst. Based on the following data, suggest specific pro forma assumptions for this deal.

DEAL: ${assetClass} | ${address} | Ask: $${askPrice ? Number(askPrice).toLocaleString() : "Not disclosed"}

COMPARABLE SALES (from our database):
${compsContext}

PUBLIC RECORDS:
${publicRecordsContext}

Provide specific assumptions in this exact JSON format:
{
  "going_in_occupancy": 0.92,
  "stabilized_occupancy": 0.95,
  "average_rent_per_unit": 1850,
  "annual_rent_growth": 0.03,
  "expense_ratio": 0.42,
  "going_in_cap_rate": 0.063,
  "exit_cap_rate": 0.068,
  "hold_period_years": 5,
  "debt_assumption": { "ltv": 0.70, "rate": 0.065, "amortization": 30, "term": 5 },
  "market_commentary": "2-3 sentences on market conditions and deal positioning",
  "risk_flags": ["list 3-5 specific risk factors to investigate"],
  "confidence": "high | medium | low"
}

Base assumptions on the comps data, public records, and your knowledge of ${assetClass} markets. Be conservative and realistic.`;

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        });

        modelUsed = "claude-sonnet-4-20250514";
        tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

        const responseText =
          response.content[0].type === "text" ? response.content[0].text : "";

        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          suggestedAssumptions = JSON.parse(jsonMatch[0]);
          marketCommentary = suggestedAssumptions.market_commentary || "";
          riskFlags = suggestedAssumptions.risk_flags || [];
          confidence = suggestedAssumptions.confidence || "medium";
        }
      } catch (aiError: any) {
        // AI failed — provide rule-based defaults
        suggestedAssumptions = getDefaultAssumptions(assetClass);
        marketCommentary = "AI analysis unavailable — using conservative defaults based on asset class.";
        riskFlags = ["AI underwriting unavailable — manual verification required"];
        confidence = "low";
      }
    } else {
      // No AI key — use rule-based defaults
      suggestedAssumptions = getDefaultAssumptions(assetClass);
      marketCommentary = "AI not configured — using conservative defaults based on asset class.";
      riskFlags = ["Manual verification required — AI underwriting not available"];
      confidence = "low";
    }

    const durationMs = Date.now() - startTime;

    // Update run record
    const [updated] = await db
      .update(aiUnderwritingRuns)
      .set({
        status: "complete",
        compsFound,
        publicRecordsEnriched,
        suggestedAssumptions,
        marketCommentary,
        riskFlags,
        confidence,
        modelUsed,
        tokensUsed,
        durationMs,
      })
      .where(eq(aiUnderwritingRuns.id, run.id))
      .returning();

    res.json({
      runId: updated.id,
      dealId,
      status: "complete",
      compsFound,
      publicRecordsEnriched,
      suggestedAssumptions,
      marketCommentary,
      riskFlags,
      confidence,
      durationMs,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Apply to Pro Forma ───────────────────────────────────────────────────

// POST /apply/:runId — mark assumptions as applied to pro forma
aiUnderwritingRouter.post("/apply/:runId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const [updated] = await db
      .update(aiUnderwritingRuns)
      .set({ appliedToProForma: true, appliedAt: new Date() })
      .where(
        and(eq(aiUnderwritingRuns.id, req.params.runId), eq(aiUnderwritingRuns.orgId, orgId)),
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Run not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── History ──────────────────────────────────────────────────────────────

// GET /deal/:dealId — get underwriting runs for a deal
aiUnderwritingRouter.get("/deal/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const runs = await db
      .select()
      .from(aiUnderwritingRuns)
      .where(
        and(
          eq(aiUnderwritingRuns.dealId, req.params.dealId),
          eq(aiUnderwritingRuns.orgId, orgId),
        ),
      )
      .orderBy(desc(aiUnderwritingRuns.createdAt));
    res.json(runs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /:runId — get single run detail
aiUnderwritingRouter.get("/:runId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [run] = await db
      .select()
      .from(aiUnderwritingRuns)
      .where(
        and(eq(aiUnderwritingRuns.id, req.params.runId), eq(aiUnderwritingRuns.orgId, orgId)),
      );
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────

function extractCity(address: string): string | null {
  const parts = address.split(",").map((s) => s.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}

function extractState(address: string): string | null {
  const parts = address.split(",").map((s) => s.trim());
  if (parts.length < 2) return null;
  const lastPart = parts[parts.length - 1];
  const stateMatch = lastPart.match(/^([A-Z]{2})/);
  return stateMatch ? stateMatch[1] : null;
}

function getDefaultAssumptions(assetClass: string): any {
  const defaults: Record<string, any> = {
    marina: {
      going_in_occupancy: 0.88,
      stabilized_occupancy: 0.93,
      average_rent_per_unit: 350, // per slip per month
      annual_rent_growth: 0.04,
      expense_ratio: 0.45,
      going_in_cap_rate: 0.065,
      exit_cap_rate: 0.07,
      hold_period_years: 7,
      debt_assumption: { ltv: 0.60, rate: 0.07, amortization: 25, term: 5 },
    },
    multifamily: {
      going_in_occupancy: 0.92,
      stabilized_occupancy: 0.95,
      average_rent_per_unit: 1600,
      annual_rent_growth: 0.03,
      expense_ratio: 0.40,
      going_in_cap_rate: 0.055,
      exit_cap_rate: 0.06,
      hold_period_years: 5,
      debt_assumption: { ltv: 0.70, rate: 0.065, amortization: 30, term: 5 },
    },
    hotel: {
      going_in_occupancy: 0.65,
      stabilized_occupancy: 0.72,
      average_rent_per_unit: 150, // ADR
      annual_rent_growth: 0.025,
      expense_ratio: 0.55,
      going_in_cap_rate: 0.07,
      exit_cap_rate: 0.075,
      hold_period_years: 7,
      debt_assumption: { ltv: 0.55, rate: 0.075, amortization: 25, term: 5 },
    },
  };

  return (
    defaults[assetClass.toLowerCase()] || {
      going_in_occupancy: 0.90,
      stabilized_occupancy: 0.93,
      average_rent_per_unit: 1500,
      annual_rent_growth: 0.03,
      expense_ratio: 0.42,
      going_in_cap_rate: 0.06,
      exit_cap_rate: 0.065,
      hold_period_years: 5,
      debt_assumption: { ltv: 0.65, rate: 0.065, amortization: 30, term: 5 },
    }
  );
}
