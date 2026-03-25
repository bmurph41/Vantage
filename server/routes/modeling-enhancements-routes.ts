/**
 * Financial Model Enhancements — 6 Fixes
 *
 * 1. Rent Roll → Pro Forma auto-sync
 * 2. Stress test calculation engine (enhanced)
 * 3. IC approval workflow routes
 * 4. Loan schedule caching (populate monthlyLoanSchedule)
 * 5. Capital stack year-by-year projections
 * 6. Deal scoring model routes
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  modelingRentRollUnits,
  underwritingAssumptions,
  modelingProjectConfig,
  modelingProjects,
  stressTestScenarios,
  crmDeals,
  modelingApprovalRequests,
  modelingApproverDecisions,
  monthlyLoanSchedule,
  debtTranches,
  capitalStacks,
  capitalStackProjections,
  dealScoringModels,
  dealScores,
  users,
} from "@shared/schema";
import { eq, and, desc, sql, count, sum } from "drizzle-orm";

export const modelingEnhancementsRouter = Router();

// ═══════════════════════════════════════════════════════════════════════════
// FIX 1: RENT ROLL → PRO FORMA AUTO-SYNC
// ═══════════════════════════════════════════════════════════════════════════

// POST /rent-roll-sync/:projectId — sync rent roll unit data into underwriting assumptions
modelingEnhancementsRouter.post("/rent-roll-sync/:projectId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { projectId } = req.params;
    const { targetYear = 1 } = req.body;

    // Get all rent roll units for this project
    const units = await db
      .select()
      .from(modelingRentRollUnits)
      .where(
        and(
          eq(modelingRentRollUnits.orgId, orgId),
          eq(modelingRentRollUnits.modelingProjectId, projectId),
        ),
      );

    if (units.length === 0) {
      return res.status(404).json({ error: "No rent roll units found for this project" });
    }

    // Aggregate rent roll metrics
    const totalUnits = units.length;
    const occupiedUnits = units.filter((u) => u.status === "occupied").length;
    const vacantUnits = totalUnits - occupiedUnits;
    const occupancyRate = totalUnits > 0 ? occupiedUnits / totalUnits : 0;

    // Revenue aggregation
    const monthlySlipRevenue = units.reduce(
      (sum, u) => sum + parseFloat(u.monthlyRent || "0"),
      0,
    );
    const annualSlipRevenue = monthlySlipRevenue * 12;

    // Additional charges
    const monthlyElectric = units.reduce((sum, u) => sum + parseFloat(u.electricCharge || "0"), 0);
    const monthlyWater = units.reduce((sum, u) => sum + parseFloat(u.waterCharge || "0"), 0);
    const monthlyLiveaboard = units
      .filter((u) => u.isLiveaboard)
      .reduce((sum, u) => sum + parseFloat(u.liveaboardRate || "0"), 0);
    const monthlyOther = units.reduce((sum, u) => sum + parseFloat(u.otherCharges || "0"), 0);

    const annualOtherRevenue = (monthlyElectric + monthlyWater + monthlyLiveaboard + monthlyOther) * 12;
    const grossPotentialRevenue = annualSlipRevenue + annualOtherRevenue;
    const effectiveGrossRevenue = grossPotentialRevenue * occupancyRate;

    // Storage type breakdown
    const byType: Record<string, { count: number; revenue: number }> = {};
    for (const unit of units) {
      const type = unit.storageType || "other";
      if (!byType[type]) byType[type] = { count: 0, revenue: 0 };
      byType[type].count++;
      byType[type].revenue += parseFloat(unit.monthlyRent || "0") * 12;
    }

    // Upsert underwriting assumptions for target year
    const existing = await db
      .select()
      .from(underwritingAssumptions)
      .where(
        and(
          eq(underwritingAssumptions.orgId, orgId),
          eq(underwritingAssumptions.modelingProjectId, projectId),
          eq(underwritingAssumptions.year, targetYear),
        ),
      );

    const assumptionData = {
      orgId,
      modelingProjectId: projectId,
      year: targetYear,
      period: "annual",
      grossPotentialRevenue: String(Math.round(grossPotentialRevenue)),
      occupancyRate: String(Math.round(occupancyRate * 10000) / 10000),
      effectiveGrossRevenue: String(Math.round(effectiveGrossRevenue)),
      slipRevenue: String(Math.round(annualSlipRevenue)),
      otherRevenue: String(Math.round(annualOtherRevenue)),
      notes: `Auto-synced from rent roll (${totalUnits} units, ${occupiedUnits} occupied) on ${new Date().toISOString().split("T")[0]}`,
      updatedAt: new Date(),
    };

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(underwritingAssumptions)
        .set(assumptionData)
        .where(eq(underwritingAssumptions.id, existing[0].id))
        .returning();
    } else {
      [result] = await db
        .insert(underwritingAssumptions)
        .values(assumptionData)
        .returning();
    }

    res.json({
      synced: true,
      targetYear,
      metrics: {
        totalUnits,
        occupiedUnits,
        vacantUnits,
        occupancyRate: Math.round(occupancyRate * 100 * 100) / 100,
        grossPotentialRevenue: Math.round(grossPotentialRevenue),
        effectiveGrossRevenue: Math.round(effectiveGrossRevenue),
        annualSlipRevenue: Math.round(annualSlipRevenue),
        annualOtherRevenue: Math.round(annualOtherRevenue),
        byStorageType: byType,
      },
      assumptionId: result.id,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 2: STRESS TEST CALCULATION ENGINE (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════

// POST /stress-tests/:id/run-enhanced — run stress test with real model data
modelingEnhancementsRouter.post("/stress-tests/:id/run-enhanced", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const [scenario] = await db
      .select()
      .from(stressTestScenarios)
      .where(
        and(eq(stressTestScenarios.id, req.params.id), eq(stressTestScenarios.orgId, orgId)),
      );

    if (!scenario) return res.status(404).json({ error: "Stress test scenario not found" });

    const assumptions = (scenario.assumptions || {}) as any;
    const vacancyIncrease = assumptions.vacancyIncrease || 0; // percentage points
    const rentDecline = assumptions.rentDecline || 0; // percentage
    const capRateExpansion = assumptions.capRateExpansion || 0; // basis points
    const rateIncrease = assumptions.rateIncrease || 0; // percentage points
    const expenseIncrease = assumptions.expenseIncrease || 0; // percentage

    // Get all deals with their modeling projects
    const deals = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, false)));

    // Get modeling data for each deal
    const dealResults: any[] = [];
    let totalBaseValue = 0;
    let totalImpactedValue = 0;

    for (const deal of deals) {
      const dealValue = parseFloat(deal.value || "0");
      if (dealValue <= 0) continue;

      // Try to get actual underwriting assumptions
      let baseNOI = dealValue * 0.06; // Default 6% cap rate
      let baseOccupancy = 0.92;
      let baseExpenses = baseNOI * 0.42 / 0.58; // Derive from 42% expense ratio
      let baseCapRate = 0.06;
      let baseDSCR = 1.25;

      // Check for linked modeling project
      const [model] = await db
        .select()
        .from(modelingProjects)
        .where(
          and(eq(modelingProjects.dealId, deal.id), eq(modelingProjects.orgId, orgId)),
        );

      if (model) {
        // Get Year 1 assumptions
        const [uw] = await db
          .select()
          .from(underwritingAssumptions)
          .where(
            and(
              eq(underwritingAssumptions.modelingProjectId, model.id),
              eq(underwritingAssumptions.year, 1),
            ),
          );

        if (uw) {
          if (uw.noi) baseNOI = parseFloat(uw.noi);
          if (uw.occupancyRate) baseOccupancy = parseFloat(uw.occupancyRate);
          if (uw.operatingExpenses) baseExpenses = parseFloat(uw.operatingExpenses);
        }

        if (model.year1CapRate) baseCapRate = parseFloat(String(model.year1CapRate)) / 100;

        // Get debt for DSCR
        const debtTranche = await db
          .select()
          .from(debtTranches)
          .where(eq(debtTranches.orgId, orgId))
          .limit(1);

        if (debtTranche.length > 0) {
          const annualDS = dealValue * 0.65 * 0.065; // LTV * rate approximation
          baseDSCR = baseNOI / annualDS;
        }
      }

      // Apply stress assumptions
      const stressedOccupancy = Math.max(0, baseOccupancy - vacancyIncrease / 100);
      const stressedRevenue = (baseNOI + baseExpenses) * (1 - rentDecline / 100) * (stressedOccupancy / baseOccupancy);
      const stressedExpenses = baseExpenses * (1 + expenseIncrease / 100);
      const stressedNOI = Math.max(0, stressedRevenue - stressedExpenses);
      const stressedCapRate = baseCapRate + capRateExpansion / 10000;
      const stressedValue = stressedCapRate > 0 ? stressedNOI / stressedCapRate : 0;

      // Stressed debt service (rate increase)
      const baseLoanAmount = dealValue * 0.65;
      const baseRate = 0.065;
      const stressedRate = baseRate + rateIncrease / 100;
      const stressedMonthlyRate = stressedRate / 12;
      const stressedAnnualDS = baseLoanAmount * stressedRate; // Simplified
      const stressedDSCR = stressedAnnualDS > 0 ? stressedNOI / stressedAnnualDS : 0;

      const valueChange = stressedValue - dealValue;
      const noiChange = stressedNOI - baseNOI;

      totalBaseValue += dealValue;
      totalImpactedValue += stressedValue;

      dealResults.push({
        dealId: deal.id,
        dealTitle: deal.title,
        assetClass: deal.assetClass,
        baseValue: Math.round(dealValue),
        baseNOI: Math.round(baseNOI),
        baseCapRate: Math.round(baseCapRate * 10000) / 100,
        baseDSCR: Math.round(baseDSCR * 100) / 100,
        stressedNOI: Math.round(stressedNOI),
        stressedValue: Math.round(stressedValue),
        stressedCapRate: Math.round(stressedCapRate * 10000) / 100,
        stressedDSCR: Math.round(stressedDSCR * 100) / 100,
        noiChange: Math.round(noiChange),
        noiChangePct: baseNOI > 0 ? Math.round((noiChange / baseNOI) * 10000) / 100 : 0,
        valueChange: Math.round(valueChange),
        valueChangePct: dealValue > 0 ? Math.round((valueChange / dealValue) * 10000) / 100 : 0,
        dscrBreached: stressedDSCR < 1.0,
        ltv: dealValue > 0 ? Math.round((baseLoanAmount / stressedValue) * 10000) / 100 : 0,
      });
    }

    // Sort by impact (worst first)
    dealResults.sort((a, b) => a.valueChangePct - b.valueChangePct);

    const portfolioImpact = {
      totalBaseValue: Math.round(totalBaseValue),
      totalImpactedValue: Math.round(totalImpactedValue),
      totalValueChange: Math.round(totalImpactedValue - totalBaseValue),
      percentChange: totalBaseValue > 0
        ? Math.round(((totalImpactedValue - totalBaseValue) / totalBaseValue) * 10000) / 100
        : 0,
      dealsAnalyzed: dealResults.length,
      dealsWithDSCRBreach: dealResults.filter((d) => d.dscrBreached).length,
      worstImpactedDeal: dealResults[0]?.dealTitle || null,
      worstImpactPct: dealResults[0]?.valueChangePct || 0,
    };

    // Update scenario with results
    await db
      .update(stressTestScenarios)
      .set({
        results: dealResults,
        portfolioImpact,
      })
      .where(eq(stressTestScenarios.id, scenario.id));

    res.json({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioType: scenario.scenarioType,
      assumptions,
      portfolioImpact,
      dealResults,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /stress-tests/presets — create from preset
modelingEnhancementsRouter.post("/stress-tests/presets", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { preset } = req.body;

    const presets: Record<string, any> = {
      mild_recession: {
        name: "Mild Recession",
        scenarioType: "mild_recession",
        assumptions: { vacancyIncrease: 5, rentDecline: 3, capRateExpansion: 25, rateIncrease: 0.5, expenseIncrease: 2 },
      },
      gfc: {
        name: "GFC-Level Stress",
        scenarioType: "gfc",
        assumptions: { vacancyIncrease: 15, rentDecline: 12, capRateExpansion: 100, rateIncrease: 2.0, expenseIncrease: 5 },
      },
      rate_shock: {
        name: "Rate Shock (+300bps)",
        scenarioType: "rate_shock",
        assumptions: { vacancyIncrease: 2, rentDecline: 0, capRateExpansion: 50, rateIncrease: 3.0, expenseIncrease: 0 },
      },
      stagflation: {
        name: "Stagflation",
        scenarioType: "custom",
        assumptions: { vacancyIncrease: 8, rentDecline: 5, capRateExpansion: 50, rateIncrease: 2.0, expenseIncrease: 8 },
      },
    };

    const selected = presets[preset];
    if (!selected) {
      return res.status(400).json({ error: `Unknown preset. Available: ${Object.keys(presets).join(", ")}` });
    }

    const [created] = await db
      .insert(stressTestScenarios)
      .values({ orgId, ...selected, createdBy: userId })
      .returning();

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 3: IC APPROVAL WORKFLOW ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// POST /approvals — create approval request
modelingEnhancementsRouter.post("/approvals", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { modelingProjectId, scenarioVersionId, title, description, requiredApprovers, quorumCount, deadline } = req.body;

    if (!modelingProjectId || !scenarioVersionId || !title || !requiredApprovers?.length) {
      return res.status(400).json({ error: "modelingProjectId, scenarioVersionId, title, and requiredApprovers[] are required" });
    }

    const [request] = await db
      .insert(modelingApprovalRequests)
      .values({
        orgId,
        modelingProjectId,
        scenarioVersionId,
        title,
        description,
        requestedBy: userId,
        requiredApprovers,
        quorumCount: quorumCount || 1,
        deadline: deadline ? new Date(deadline) : null,
      })
      .returning();

    // Create pending decisions for each approver
    for (const approverId of requiredApprovers) {
      await db.insert(modelingApproverDecisions).values({
        approvalRequestId: request.id,
        approverId,
        decision: "pending",
      });
    }

    res.status(201).json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /approvals — list approval requests
modelingEnhancementsRouter.get("/approvals", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { status, projectId } = req.query;

    const conditions = [eq(modelingApprovalRequests.orgId, orgId)];
    if (status) conditions.push(eq(modelingApprovalRequests.status, status as string));
    if (projectId) conditions.push(eq(modelingApprovalRequests.modelingProjectId, projectId as string));

    const requests = await db
      .select()
      .from(modelingApprovalRequests)
      .where(and(...conditions))
      .orderBy(desc(modelingApprovalRequests.requestedAt));

    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /approvals/:id — get single request with decisions
modelingEnhancementsRouter.get("/approvals/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const [request] = await db
      .select()
      .from(modelingApprovalRequests)
      .where(and(eq(modelingApprovalRequests.id, req.params.id), eq(modelingApprovalRequests.orgId, orgId)));

    if (!request) return res.status(404).json({ error: "Approval request not found" });

    const decisions = await db
      .select({
        id: modelingApproverDecisions.id,
        approverId: modelingApproverDecisions.approverId,
        decision: modelingApproverDecisions.decision,
        comments: modelingApproverDecisions.comments,
        decidedAt: modelingApproverDecisions.decidedAt,
        approverName: users.name,
        approverEmail: users.email,
      })
      .from(modelingApproverDecisions)
      .leftJoin(users, eq(users.id, modelingApproverDecisions.approverId))
      .where(eq(modelingApproverDecisions.approvalRequestId, request.id));

    res.json({
      ...request,
      decisions,
      approvedCount: decisions.filter((d) => d.decision === "approved").length,
      rejectedCount: decisions.filter((d) => d.decision === "rejected").length,
      pendingCount: decisions.filter((d) => d.decision === "pending").length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /approvals/:id/decide — submit approval decision
modelingEnhancementsRouter.post("/approvals/:id/decide", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { decision, comments } = req.body;

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    // Update this approver's decision
    const [updated] = await db
      .update(modelingApproverDecisions)
      .set({ decision, comments, decidedAt: new Date() })
      .where(
        and(
          eq(modelingApproverDecisions.approvalRequestId, req.params.id),
          eq(modelingApproverDecisions.approverId, userId),
        ),
      )
      .returning();

    if (!updated) {
      return res.status(403).json({ error: "You are not an approver for this request" });
    }

    // Check if quorum is met
    const allDecisions = await db
      .select()
      .from(modelingApproverDecisions)
      .where(eq(modelingApproverDecisions.approvalRequestId, req.params.id));

    const [request] = await db
      .select()
      .from(modelingApprovalRequests)
      .where(eq(modelingApprovalRequests.id, req.params.id));

    const approvedCount = allDecisions.filter((d) => d.decision === "approved").length;
    const rejectedCount = allDecisions.filter((d) => d.decision === "rejected").length;
    const quorum = request?.quorumCount || 1;

    let newStatus = "pending";
    if (approvedCount >= quorum) {
      newStatus = "approved";
    } else if (rejectedCount > allDecisions.length - quorum) {
      // Not enough remaining approvers to reach quorum
      newStatus = "rejected";
    }

    if (newStatus !== "pending") {
      await db
        .update(modelingApprovalRequests)
        .set({ status: newStatus, completedAt: new Date(), updatedAt: new Date() })
        .where(eq(modelingApprovalRequests.id, req.params.id));
    }

    res.json({
      decision: updated.decision,
      requestStatus: newStatus,
      approvedCount,
      rejectedCount,
      quorumRequired: quorum,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /approvals/pending/me — get my pending approval requests
modelingEnhancementsRouter.get("/approvals/pending/me", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const pendingDecisions = await db
      .select({
        decisionId: modelingApproverDecisions.id,
        requestId: modelingApprovalRequests.id,
        title: modelingApprovalRequests.title,
        description: modelingApprovalRequests.description,
        requestedAt: modelingApprovalRequests.requestedAt,
        deadline: modelingApprovalRequests.deadline,
        projectId: modelingApprovalRequests.modelingProjectId,
      })
      .from(modelingApproverDecisions)
      .innerJoin(
        modelingApprovalRequests,
        eq(modelingApproverDecisions.approvalRequestId, modelingApprovalRequests.id),
      )
      .where(
        and(
          eq(modelingApproverDecisions.approverId, userId),
          eq(modelingApproverDecisions.decision, "pending"),
          eq(modelingApprovalRequests.status, "pending"),
        ),
      )
      .orderBy(desc(modelingApprovalRequests.requestedAt));

    res.json(pendingDecisions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 4: LOAN SCHEDULE CACHING
// ═══════════════════════════════════════════════════════════════════════════

// POST /loan-schedule/cache/:debtTrancheId — compute and store monthly schedule
modelingEnhancementsRouter.post("/loan-schedule/cache/:debtTrancheId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { debtTrancheId } = req.params;

    // Get the debt tranche
    const [tranche] = await db
      .select()
      .from(debtTranches)
      .where(and(eq(debtTranches.id, debtTrancheId), eq(debtTranches.orgId, orgId)));

    if (!tranche) return res.status(404).json({ error: "Debt tranche not found" });

    const loanAmount = parseFloat(tranche.loanAmount || "0");
    const interestRate = parseFloat(tranche.interestRate || "0") / 100;
    const termMonths = (tranche.termYears || 5) * 12;
    const amortMonths = (tranche.amortizationYears || 30) * 12;
    const ioMonths = (tranche.interestOnlyMonths || 0);

    if (loanAmount <= 0 || interestRate <= 0) {
      return res.status(400).json({ error: "Loan amount and interest rate must be positive" });
    }

    // Delete existing cached schedule
    await db
      .delete(monthlyLoanSchedule)
      .where(eq(monthlyLoanSchedule.debtTrancheId, debtTrancheId));

    // Compute amortization schedule
    const monthlyRate = interestRate / 12;
    const amortPayment = amortMonths > 0
      ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortMonths)) / (Math.pow(1 + monthlyRate, amortMonths) - 1)
      : loanAmount * monthlyRate; // Interest-only if no amort

    const scheduleRows: any[] = [];
    let balance = loanAmount;
    const startDate = new Date();

    for (let month = 1; month <= termMonths; month++) {
      const periodDate = new Date(startDate);
      periodDate.setMonth(periodDate.getMonth() + month);

      const isIO = month <= ioMonths;
      const interestPayment = balance * monthlyRate;
      const principalPayment = isIO ? 0 : amortPayment - interestPayment;
      const scheduledPayment = isIO ? interestPayment : amortPayment;
      const endingBalance = Math.max(0, balance - principalPayment);

      scheduleRows.push({
        orgId,
        debtTrancheId,
        capitalStackId: tranche.capitalStackId,
        periodMonth: month,
        periodYear: periodDate.getFullYear(),
        periodDate: periodDate.toISOString().split("T")[0],
        beginningBalance: String(Math.round(balance * 100) / 100),
        endingBalance: String(Math.round(endingBalance * 100) / 100),
        scheduledPayment: String(Math.round(scheduledPayment * 100) / 100),
        principalPayment: String(Math.round(principalPayment * 100) / 100),
        interestPayment: String(Math.round(interestPayment * 100) / 100),
        interestRate: String(interestRate),
        isInterestOnly: isIO,
      });

      balance = endingBalance;
    }

    // Bulk insert
    if (scheduleRows.length > 0) {
      await db.insert(monthlyLoanSchedule).values(scheduleRows);
    }

    const totalInterest = scheduleRows.reduce((s, r) => s + parseFloat(r.interestPayment), 0);
    const totalPrincipal = scheduleRows.reduce((s, r) => s + parseFloat(r.principalPayment), 0);

    res.json({
      debtTrancheId,
      periodsGenerated: scheduleRows.length,
      loanAmount,
      endingBalance: Math.round(balance * 100) / 100,
      totalInterest: Math.round(totalInterest),
      totalPrincipal: Math.round(totalPrincipal),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /loan-schedule/:debtTrancheId — get cached schedule
modelingEnhancementsRouter.get("/loan-schedule/:debtTrancheId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const schedule = await db
      .select()
      .from(monthlyLoanSchedule)
      .where(
        and(
          eq(monthlyLoanSchedule.debtTrancheId, req.params.debtTrancheId),
          eq(monthlyLoanSchedule.orgId, orgId),
        ),
      )
      .orderBy(monthlyLoanSchedule.periodMonth);

    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 5: CAPITAL STACK YEAR-BY-YEAR PROJECTIONS
// ═══════════════════════════════════════════════════════════════════════════

// POST /capital-stack-projections/:capitalStackId — compute and store projections
modelingEnhancementsRouter.post("/capital-stack-projections/:capitalStackId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { capitalStackId } = req.params;
    const {
      holdPeriod = 5,
      year1NOI,
      noiGrowthRate = 0.03,
      capexPctOfRevenue = 0.05,
      exitCapRate = 0.065,
      saleCostPct = 0.02,
    } = req.body;

    // Get capital stack
    const [stack] = await db
      .select()
      .from(capitalStacks)
      .where(and(eq(capitalStacks.id, capitalStackId), eq(capitalStacks.orgId, orgId)));

    if (!stack) return res.status(404).json({ error: "Capital stack not found" });

    const purchasePrice = parseFloat(stack.purchasePrice || "0");
    const totalEquity = parseFloat(stack.totalEquity || "0");
    const totalDebt = parseFloat(stack.totalDebt || "0");
    const baseNOI = year1NOI || purchasePrice * 0.06; // Default 6% cap

    // Get debt tranches for this stack
    const tranches = await db
      .select()
      .from(debtTranches)
      .where(and(eq(debtTranches.capitalStackId, capitalStackId), eq(debtTranches.orgId, orgId)));

    // Calculate annual debt service from tranches
    let annualDS = 0;
    let annualPrincipal = 0;
    let annualInterest = 0;
    for (const t of tranches) {
      const la = parseFloat(t.loanAmount || "0");
      const rate = parseFloat(t.interestRate || "0") / 100;
      const amortYears = t.amortizationYears || 30;
      const monthlyRate = rate / 12;
      const monthlyPayment = la * (monthlyRate * Math.pow(1 + monthlyRate, amortYears * 12)) / (Math.pow(1 + monthlyRate, amortYears * 12) - 1);
      const yearlyInterest = la * rate;
      annualDS += monthlyPayment * 12;
      annualInterest += yearlyInterest;
      annualPrincipal += monthlyPayment * 12 - yearlyInterest;
    }

    // Delete existing projections
    await db
      .delete(capitalStackProjections)
      .where(eq(capitalStackProjections.capitalStackId, capitalStackId));

    const projections: any[] = [];
    let cumulativeCF = -totalEquity; // Initial equity investment
    let remainingDebt = totalDebt;

    for (let year = 0; year <= holdPeriod; year++) {
      const growthFactor = Math.pow(1 + noiGrowthRate, year);
      const noi = year === 0 ? 0 : baseNOI * growthFactor;
      const grossRevenue = year === 0 ? 0 : noi / 0.58; // Assume ~58% margin
      const opEx = grossRevenue - noi;
      const capex = year === 0 ? 0 : grossRevenue * capexPctOfRevenue;
      const ncf = noi - capex;
      const cfBeforeDebt = ncf;
      const cfAfterDebt = year === 0 ? -totalEquity : ncf - annualDS;

      // Track debt paydown
      if (year > 0) remainingDebt -= annualPrincipal;

      // DSCR
      const dscr = annualDS > 0 ? noi / annualDS : 0;
      const debtYield = totalDebt > 0 ? noi / totalDebt : 0;

      // Exit year calculations
      let exitValue = 0;
      let loanPayoff = 0;
      let netSaleProceeds = 0;
      if (year === holdPeriod && year > 0) {
        exitValue = noi / exitCapRate;
        loanPayoff = Math.max(0, remainingDebt);
        netSaleProceeds = exitValue * (1 - saleCostPct) - loanPayoff;
      }

      // Cumulative
      cumulativeCF += cfAfterDebt + (year === holdPeriod ? netSaleProceeds : 0);
      const equityMultiple = totalEquity > 0 ? cumulativeCF / totalEquity : 0;
      const cashOnCash = totalEquity > 0 && year > 0 ? cfAfterDebt / totalEquity : 0;

      projections.push({
        orgId,
        capitalStackId,
        year,
        grossRevenue: String(Math.round(grossRevenue)),
        operatingExpenses: String(Math.round(opEx)),
        noi: String(Math.round(noi)),
        capex: String(Math.round(capex)),
        ncf: String(Math.round(ncf)),
        totalDebtService: String(Math.round(year === 0 ? 0 : annualDS)),
        principalPaydown: String(Math.round(year === 0 ? 0 : annualPrincipal)),
        interestExpense: String(Math.round(year === 0 ? 0 : annualInterest)),
        cashFlowBeforeDebt: String(Math.round(cfBeforeDebt)),
        cashFlowAfterDebt: String(Math.round(cfAfterDebt)),
        dscr: String(Math.round(dscr * 10000) / 10000),
        debtYield: String(Math.round(debtYield * 10000) / 10000),
        exitValue: String(Math.round(exitValue)),
        loanPayoff: String(Math.round(loanPayoff)),
        netSaleProceeds: String(Math.round(netSaleProceeds)),
        cumulativeCashFlow: String(Math.round(cumulativeCF)),
        equityMultiple: String(Math.round(equityMultiple * 10000) / 10000),
        cashOnCash: String(Math.round(cashOnCash * 10000) / 10000),
      });
    }

    if (projections.length > 0) {
      await db.insert(capitalStackProjections).values(projections);
    }

    res.json({
      capitalStackId,
      holdPeriod,
      yearsGenerated: projections.length,
      projections,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /capital-stack-projections/:capitalStackId — get cached projections
modelingEnhancementsRouter.get("/capital-stack-projections/:capitalStackId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const projections = await db
      .select()
      .from(capitalStackProjections)
      .where(
        and(
          eq(capitalStackProjections.capitalStackId, req.params.capitalStackId),
          eq(capitalStackProjections.orgId, orgId),
        ),
      )
      .orderBy(capitalStackProjections.year);
    res.json(projections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FIX 6: DEAL SCORING MODEL ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// POST /scoring-models — create scoring model
modelingEnhancementsRouter.post("/scoring-models", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { name, criteria, isDefault } = req.body;

    if (!name || !criteria?.length) {
      return res.status(400).json({ error: "name and criteria[] are required" });
    }

    // If setting as default, unset others
    if (isDefault) {
      await db
        .update(dealScoringModels)
        .set({ isDefault: false })
        .where(eq(dealScoringModels.orgId, orgId));
    }

    const [model] = await db
      .insert(dealScoringModels)
      .values({ orgId, name, criteria, isDefault: isDefault || false })
      .returning();

    res.status(201).json(model);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /scoring-models — list scoring models
modelingEnhancementsRouter.get("/scoring-models", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const models = await db
      .select()
      .from(dealScoringModels)
      .where(eq(dealScoringModels.orgId, orgId))
      .orderBy(desc(dealScoringModels.createdAt));
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /scoring-models/:id — update model
modelingEnhancementsRouter.put("/scoring-models/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [updated] = await db
      .update(dealScoringModels)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(dealScoringModels.id, req.params.id), eq(dealScoringModels.orgId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Scoring model not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /scoring-models/:modelId/score/:dealId — score a deal against a model
modelingEnhancementsRouter.post("/scoring-models/:modelId/score/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { modelId, dealId } = req.params;

    const [model] = await db
      .select()
      .from(dealScoringModels)
      .where(and(eq(dealScoringModels.id, modelId), eq(dealScoringModels.orgId, orgId)));

    if (!model) return res.status(404).json({ error: "Scoring model not found" });

    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId)));

    if (!deal) return res.status(404).json({ error: "Deal not found" });

    // Score against each criterion
    const criteria = (model.criteria || []) as Array<{
      name: string;
      weight: number;
      type: string; // numeric_range | boolean | select
      field?: string;
      min?: number;
      max?: number;
      idealMin?: number;
      idealMax?: number;
      options?: string[];
      idealValue?: string;
    }>;

    const scores: Record<string, { score: number; weight: number; value: any; maxScore: number }> = {};
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const criterion of criteria) {
      const weight = criterion.weight || 1;
      totalWeight += weight;

      // Get deal field value
      const fieldValue = (deal as any)[criterion.field || ""] || req.body[criterion.name];
      let criterionScore = 50; // Default middle score

      if (criterion.type === "numeric_range" && fieldValue !== undefined) {
        const val = parseFloat(fieldValue);
        const idealMin = criterion.idealMin ?? criterion.min ?? 0;
        const idealMax = criterion.idealMax ?? criterion.max ?? 100;

        if (val >= idealMin && val <= idealMax) {
          criterionScore = 100;
        } else if (val < idealMin) {
          criterionScore = Math.max(0, 100 - ((idealMin - val) / idealMin) * 100);
        } else {
          criterionScore = Math.max(0, 100 - ((val - idealMax) / idealMax) * 100);
        }
      } else if (criterion.type === "boolean") {
        criterionScore = fieldValue ? 100 : 0;
      } else if (criterion.type === "select" && criterion.idealValue) {
        criterionScore = fieldValue === criterion.idealValue ? 100 : 30;
      }

      scores[criterion.name] = {
        score: Math.round(criterionScore),
        weight,
        value: fieldValue,
        maxScore: 100,
      };

      totalWeightedScore += criterionScore * weight;
    }

    const totalScore = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 10) / 10 : 0;
    const grade = totalScore >= 90 ? "A+" : totalScore >= 80 ? "A" : totalScore >= 70 ? "B+" : totalScore >= 60 ? "B" : totalScore >= 50 ? "C" : totalScore >= 40 ? "D" : "F";

    const [stored] = await db
      .insert(dealScores)
      .values({
        orgId,
        dealId,
        modelId,
        scores,
        totalScore: String(totalScore),
        grade,
        scoredBy: userId,
      })
      .returning();

    res.json({
      scoreId: stored.id,
      dealId,
      modelId,
      modelName: model.name,
      totalScore,
      grade,
      scores,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /scores/:dealId — get all scores for a deal
modelingEnhancementsRouter.get("/scores/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const scores = await db
      .select()
      .from(dealScores)
      .where(and(eq(dealScores.dealId, req.params.dealId), eq(dealScores.orgId, orgId)))
      .orderBy(desc(dealScores.scoredAt));
    res.json(scores);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
