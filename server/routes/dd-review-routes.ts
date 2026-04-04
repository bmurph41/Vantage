/**
 * DD Review Dashboard Routes
 * Portfolio-level due diligence review — cross-deal DD status,
 * timelines, inspections, deposits, and next steps.
 * Modeled after institutional DD Review decks (Southern Marinas pattern).
 */

import { Router, Request, Response, NextFunction } from "express";
import { db, pool } from "../db";
import {
  crmDeals,
  crmPipelineStages,
  dealDeposits,
  dealExtensions,
} from "@shared/schema";
import { eq, and, inArray, isNull, or, asc, sql } from "drizzle-orm";

const router = Router();

// ============================================================================
// GET /api/dd-review/dashboard
// Returns portfolio-level DD review data across all active deals
// ============================================================================
router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId;
    if (!orgId) return res.status(401).json({ error: "No org context" });

    // 1. Fetch all active deals with DD-relevant fields (not closed/lost)
    const deals = await db
      .select({
        id: crmDeals.id,
        title: crmDeals.title,
        city: crmDeals.city,
        state: crmDeals.state,
        stage: crmDeals.stage,
        stageId: crmDeals.stageId,
        value: crmDeals.value,
        assetClass: crmDeals.assetClass,
        propertyType: crmDeals.propertyType,
        probability: crmDeals.probability,
        psaSignedDate: crmDeals.psaSignedDate,
        ddExpirationDate: crmDeals.ddExpirationDate,
        closingDate: crmDeals.closingDate,
        ddPeriodDays: crmDeals.ddPeriodDays,
        hasExtensions: crmDeals.hasExtensions,
        extensionCount: crmDeals.extensionCount,
        daysToClosing: crmDeals.daysToClosing,
        daysInCurrentStage: crmDeals.daysInCurrentStage,
        currentStageEnteredAt: crmDeals.currentStageEnteredAt,
        createdAt: crmDeals.createdAt,
        firstDepositAmount: crmDeals.firstDepositAmount,
        firstDepositDays: crmDeals.firstDepositDays,
        firstDepositDueDate: crmDeals.firstDepositDueDate,
        secondDepositAmount: crmDeals.secondDepositAmount,
        secondDepositDays: crmDeals.secondDepositDays,
        secondDepositDueDate: crmDeals.secondDepositDueDate,
        titleInsuranceCompany: crmDeals.titleInsuranceCompany,
        lender: crmDeals.lender,
        propertyDetails: crmDeals.propertyDetails,
        ddProjectId: crmDeals.ddProjectId,
        modelingProjectId: crmDeals.modelingProjectId,
        isClosed: crmDeals.isClosed,
        // Stage info
        stageName: crmPipelineStages.name,
        stageOrder: crmPipelineStages.stageOrder,
        stageType: crmPipelineStages.stageType,
      })
      .from(crmDeals)
      .leftJoin(crmPipelineStages, eq(crmDeals.stageId, crmPipelineStages.id))
      .where(
        and(
          eq(crmDeals.orgId, orgId),
          or(eq(crmDeals.isClosed, false), isNull(crmDeals.isClosed))
        )
      )
      .orderBy(asc(crmPipelineStages.stageOrder), asc(crmDeals.title));

    if (deals.length === 0) {
      return res.json({
        deals: [],
        groups: [],
        depositSummary: { underContract: { deposit1Total: 0, deposit2Total: 0, totalDeposits: 0 }, underLOI: { deposit1Total: 0, deposit2Total: 0, totalDeposits: 0 } },
        countdownDeals: [],
      });
    }

    const dealIds = deals.map((d) => d.id);

    // 2. Fetch deposits for all deals
    const deposits = await db
      .select()
      .from(dealDeposits)
      .where(inArray(dealDeposits.dealId, dealIds))
      .orderBy(asc(dealDeposits.displayOrder));

    // 3. Fetch extensions for all deals
    const extensions = await db
      .select()
      .from(dealExtensions)
      .where(inArray(dealExtensions.dealId, dealIds))
      .orderBy(asc(dealExtensions.displayOrder));

    // 4. Fetch DD checklist stats per deal (via raw SQL for efficiency)
    const checklistStatsResult = await pool.query(`
      SELECT
        c.dd_project_id,
        COUNT(i.id) AS total_items,
        COUNT(CASE WHEN i.status IN ('approved', 'provided') THEN 1 END) AS completed_items,
        COUNT(CASE WHEN i.status = 'open' THEN 1 END) AS open_items,
        COUNT(CASE WHEN i.internal_status = 'waiting_on_seller' THEN 1 END) AS waiting_on_seller,
        COUNT(CASE WHEN i.internal_status = 'waiting_on_third_party' THEN 1 END) AS waiting_on_third_party
      FROM dd_checklists c
      JOIN dd_checklist_sections s ON s.checklist_id = c.id
      JOIN dd_checklist_items i ON i.section_id = s.id
      WHERE c.org_id = $1
      GROUP BY c.dd_project_id
    `, [orgId]);

    const checklistStatsMap: Record<string, any> = {};
    for (const row of checklistStatsResult.rows) {
      checklistStatsMap[row.dd_project_id] = {
        totalItems: parseInt(row.total_items),
        completedItems: parseInt(row.completed_items),
        openItems: parseInt(row.open_items),
        waitingOnSeller: parseInt(row.waiting_on_seller),
        waitingOnThirdParty: parseInt(row.waiting_on_third_party),
        completionPct: row.total_items > 0 ? Math.round((parseInt(row.completed_items) / parseInt(row.total_items)) * 100) : 0,
      };
    }

    // 5. Build per-deal deposit map
    const depositMap: Record<string, any[]> = {};
    for (const dep of deposits) {
      if (!depositMap[dep.dealId]) depositMap[dep.dealId] = [];
      depositMap[dep.dealId].push(dep);
    }

    // 6. Build per-deal extension map
    const extensionMap: Record<string, any[]> = {};
    for (const ext of extensions) {
      if (!extensionMap[ext.dealId]) extensionMap[ext.dealId] = [];
      extensionMap[ext.dealId].push(ext);
    }

    // 7. Compute countdowns and enrich deals
    const now = new Date();
    const enrichedDeals = deals.map((deal) => {
      const ddExp = deal.ddExpirationDate ? new Date(deal.ddExpirationDate) : null;
      const closing = deal.closingDate ? new Date(deal.closingDate) : null;
      const psaSigned = deal.psaSignedDate ? new Date(deal.psaSignedDate) : null;
      const created = new Date(deal.createdAt);

      const ddDaysLeft = ddExp ? Math.ceil((ddExp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
      const closingDaysLeft = closing ? Math.ceil((closing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
      const timeInDeal = Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

      // Classify deal into DD Review groups
      const stageLower = (deal.stageName || deal.stage || "").toLowerCase();
      let ddGroup: "under_contract" | "under_loi" | "prospecting" | "other" = "other";
      if (stageLower.includes("contract") || stageLower.includes("closing") || stageLower.includes("due diligence")) {
        ddGroup = "under_contract";
      } else if (stageLower.includes("loi") || stageLower.includes("letter of intent") || stageLower.includes("negotiat")) {
        ddGroup = "under_loi";
      } else if (stageLower.includes("prospect") || stageLower.includes("lead") || stageLower.includes("qualification")) {
        ddGroup = "prospecting";
      }

      const dealDeposits = depositMap[deal.id] || [];
      const dealExtensions = extensionMap[deal.id] || [];
      const ddStats = deal.ddProjectId ? checklistStatsMap[deal.ddProjectId] || null : null;

      // Compute total deposit
      let totalDeposit = 0;
      for (const dep of dealDeposits) {
        totalDeposit += parseFloat(dep.amount || "0");
      }

      return {
        ...deal,
        ddGroup,
        ddDaysLeft,
        closingDaysLeft,
        timeInDeal,
        ddUrgency: ddDaysLeft !== null ? (ddDaysLeft <= 0 ? "expired" : ddDaysLeft <= 7 ? "critical" : ddDaysLeft <= 14 ? "warning" : "ok") : null,
        closingUrgency: closingDaysLeft !== null ? (closingDaysLeft <= 0 ? "past_due" : closingDaysLeft <= 7 ? "critical" : closingDaysLeft <= 14 ? "warning" : "ok") : null,
        deposits: dealDeposits,
        extensions: dealExtensions,
        totalDeposit,
        checklistStats: ddStats,
      };
    });

    // 8. Group deals by DD stage
    const groups = [
      {
        key: "under_contract",
        label: "Under Contract",
        deals: enrichedDeals.filter((d) => d.ddGroup === "under_contract"),
        totalValue: 0,
        totalSlips: 0,
        dealCount: 0,
      },
      {
        key: "under_loi",
        label: "Under LOI",
        deals: enrichedDeals.filter((d) => d.ddGroup === "under_loi"),
        totalValue: 0,
        totalSlips: 0,
        dealCount: 0,
      },
      {
        key: "prospecting",
        label: "Prospecting",
        deals: enrichedDeals.filter((d) => d.ddGroup === "prospecting"),
        totalValue: 0,
        totalSlips: 0,
        dealCount: 0,
      },
    ];

    // Compute group subtotals
    for (const group of groups) {
      group.dealCount = group.deals.length;
      group.totalValue = group.deals.reduce((sum, d) => sum + parseFloat(d.value || "0"), 0);
      group.totalSlips = group.deals.reduce((sum, d) => {
        const pd = d.propertyDetails as any;
        return sum + (pd?.totalSlips || pd?.total_slips || 0);
      }, 0);
    }

    // 9. Deposit summary by group
    const depositSummary = {
      underContract: computeDepositSummary(enrichedDeals.filter((d) => d.ddGroup === "under_contract")),
      underLOI: computeDepositSummary(enrichedDeals.filter((d) => d.ddGroup === "under_loi")),
    };

    // 10. Countdown deals (sorted by urgency — most urgent first)
    const countdownDeals = enrichedDeals
      .filter((d) => d.ddDaysLeft !== null || d.closingDaysLeft !== null)
      .sort((a, b) => {
        const aUrgent = Math.min(a.ddDaysLeft ?? 999, a.closingDaysLeft ?? 999);
        const bUrgent = Math.min(b.ddDaysLeft ?? 999, b.closingDaysLeft ?? 999);
        return aUrgent - bUrgent;
      });

    res.json({
      deals: enrichedDeals,
      groups: groups.filter((g) => g.dealCount > 0),
      depositSummary,
      countdownDeals,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

function computeDepositSummary(deals: any[]) {
  let deposit1Total = 0;
  let deposit2Total = 0;
  let totalDeposits = 0;

  for (const deal of deals) {
    const deps = deal.deposits || [];
    for (const dep of deps) {
      const amt = parseFloat(dep.amount || "0");
      totalDeposits += amt;
      if (dep.depositNumber === 1) deposit1Total += amt;
      if (dep.depositNumber === 2) deposit2Total += amt;
    }
  }

  return { deposit1Total, deposit2Total, totalDeposits, dealCount: deals.length };
}

export { router as ddReviewRouter };
