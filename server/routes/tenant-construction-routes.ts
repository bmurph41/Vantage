import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  tenantUsers,
  tenantMessages,
  rentPayments,
  leaseRenewalOpportunities,
  vacancyListings,
  leasingProspects,
  showings,
  constructionProjects,
  constructionBudgetLines,
  constructionDraws,
  unitRenovations,
} from "@shared/schema";
import { eq, and, desc, sql, count, sum, gte, lte } from "drizzle-orm";

export const tenantConstructionRouter = Router();

// ── C.1 Tenant Portal ───────────────────────────────────────────────────

// GET /tenants — list tenant users for org
tenantConstructionRouter.get("/tenants", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const results = await db
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.orgId, orgId))
      .orderBy(desc(tenantUsers.createdAt));
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /tenants — create tenant user (generate invite)
tenantConstructionRouter.post("/tenants", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [tenant] = await db
      .insert(tenantUsers)
      .values({ ...req.body, orgId, inviteSentAt: new Date() })
      .returning();
    res.status(201).json(tenant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /tenants/:id — get tenant detail
tenantConstructionRouter.get("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [tenant] = await db
      .select()
      .from(tenantUsers)
      .where(and(eq(tenantUsers.id, req.params.id), eq(tenantUsers.orgId, orgId)));
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    res.json(tenant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /tenants/:id — update tenant
tenantConstructionRouter.put("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [updated] = await db
      .update(tenantUsers)
      .set(req.body)
      .where(and(eq(tenantUsers.id, req.params.id), eq(tenantUsers.orgId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Tenant not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /tenants/:id/messages — list messages
tenantConstructionRouter.get("/tenants/:id/messages", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const messages = await db
      .select()
      .from(tenantMessages)
      .where(
        and(
          eq(tenantMessages.tenantUserId, req.params.id),
          eq(tenantMessages.orgId, orgId)
        )
      )
      .orderBy(desc(tenantMessages.createdAt));
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /tenants/:id/messages — send message to tenant
tenantConstructionRouter.post("/tenants/:id/messages", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [message] = await db
      .insert(tenantMessages)
      .values({ ...req.body, orgId, tenantUserId: req.params.id })
      .returning();
    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── C.2 Rent Payments ───────────────────────────────────────────────────

// POST /rent-payments — create payment record
tenantConstructionRouter.post("/rent-payments", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [payment] = await db
      .insert(rentPayments)
      .values({ ...req.body, orgId })
      .returning();
    res.status(201).json(payment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /rent-payments — list (filter by dealId, tenantUserId, status)
tenantConstructionRouter.get("/rent-payments", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { dealId, tenantUserId, status } = req.query;

    const conditions = [eq(rentPayments.orgId, orgId)];
    if (dealId) conditions.push(eq(rentPayments.dealId, String(dealId)));
    if (tenantUserId) conditions.push(eq(rentPayments.tenantUserId, String(tenantUserId)));
    if (status) conditions.push(eq(rentPayments.status, String(status)));

    const results = await db
      .select()
      .from(rentPayments)
      .where(and(...conditions))
      .orderBy(desc(rentPayments.createdAt));
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /rent-payments/:id — get single
tenantConstructionRouter.get("/rent-payments/:id", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [payment] = await db
      .select()
      .from(rentPayments)
      .where(and(eq(rentPayments.id, req.params.id), eq(rentPayments.orgId, orgId)));
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /rent-payments/:id/status — update status (processing, succeeded, failed)
tenantConstructionRouter.patch("/rent-payments/:id/status", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { status } = req.body;
    const updateData: Record<string, any> = { status };

    if (status === "succeeded") updateData.processedAt = new Date();
    if (status === "failed") {
      updateData.failedAt = new Date();
      updateData.failureReason = req.body.failureReason || null;
    }

    const [updated] = await db
      .update(rentPayments)
      .set(updateData)
      .where(and(eq(rentPayments.id, req.params.id), eq(rentPayments.orgId, orgId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Payment not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /rent-payments/summary/:dealId — payment summary
tenantConstructionRouter.get("/rent-payments/summary/:dealId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { dealId } = req.params;

    const [collected] = await db
      .select({ total: sum(rentPayments.totalAmount) })
      .from(rentPayments)
      .where(
        and(
          eq(rentPayments.orgId, orgId),
          eq(rentPayments.dealId, dealId),
          eq(rentPayments.status, "succeeded")
        )
      );

    const [outstanding] = await db
      .select({ total: sum(rentPayments.totalAmount) })
      .from(rentPayments)
      .where(
        and(
          eq(rentPayments.orgId, orgId),
          eq(rentPayments.dealId, dealId),
          eq(rentPayments.status, "pending")
        )
      );

    const [delinquent] = await db
      .select({ total: sum(rentPayments.totalAmount) })
      .from(rentPayments)
      .where(
        and(
          eq(rentPayments.orgId, orgId),
          eq(rentPayments.dealId, dealId),
          eq(rentPayments.status, "failed")
        )
      );

    res.json({
      dealId,
      collected: collected?.total || "0",
      outstanding: outstanding?.total || "0",
      delinquent: delinquent?.total || "0",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── C.3 Lease Renewals ──────────────────────────────────────────────────

// GET /lease-renewals — list renewal opportunities (filter by status, dealId)
tenantConstructionRouter.get("/lease-renewals", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { status, dealId } = req.query;

    const conditions = [eq(leaseRenewalOpportunities.orgId, orgId)];
    if (status) conditions.push(eq(leaseRenewalOpportunities.status, String(status)));
    if (dealId) conditions.push(eq(leaseRenewalOpportunities.dealId, String(dealId)));

    const results = await db
      .select()
      .from(leaseRenewalOpportunities)
      .where(and(...conditions))
      .orderBy(desc(leaseRenewalOpportunities.createdAt));
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /lease-renewals — create opportunity
tenantConstructionRouter.post("/lease-renewals", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [renewal] = await db
      .insert(leaseRenewalOpportunities)
      .values({ ...req.body, orgId })
      .returning();
    res.status(201).json(renewal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /lease-renewals/:id — update (status, offer details, agreed terms)
tenantConstructionRouter.put("/lease-renewals/:id", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [updated] = await db
      .update(leaseRenewalOpportunities)
      .set({ ...req.body, updatedAt: new Date() })
      .where(
        and(
          eq(leaseRenewalOpportunities.id, req.params.id),
          eq(leaseRenewalOpportunities.orgId, orgId)
        )
      )
      .returning();
    if (!updated) return res.status(404).json({ error: "Renewal opportunity not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /lease-renewals/dashboard — summary: by status counts, upcoming expirations
tenantConstructionRouter.get("/lease-renewals/dashboard", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;

    const statusCounts = await db
      .select({
        status: leaseRenewalOpportunities.status,
        count: count(),
      })
      .from(leaseRenewalOpportunities)
      .where(eq(leaseRenewalOpportunities.orgId, orgId))
      .groupBy(leaseRenewalOpportunities.status);

    const today = new Date().toISOString().split("T")[0];
    const ninetyDaysOut = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const upcomingExpirations = await db
      .select()
      .from(leaseRenewalOpportunities)
      .where(
        and(
          eq(leaseRenewalOpportunities.orgId, orgId),
          gte(leaseRenewalOpportunities.leaseExpiryDate, today),
          lte(leaseRenewalOpportunities.leaseExpiryDate, ninetyDaysOut)
        )
      )
      .orderBy(leaseRenewalOpportunities.leaseExpiryDate);

    res.json({ statusCounts, upcomingExpirations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── C.5 Vacancy Pipeline ────────────────────────────────────────────────

// GET /vacancies — list vacancies (filter by dealId, status)
tenantConstructionRouter.get("/vacancies", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { dealId, status } = req.query;

    const conditions = [eq(vacancyListings.orgId, orgId)];
    if (dealId) conditions.push(eq(vacancyListings.dealId, String(dealId)));
    if (status) conditions.push(eq(vacancyListings.status, String(status)));

    const results = await db
      .select()
      .from(vacancyListings)
      .where(and(...conditions))
      .orderBy(desc(vacancyListings.createdAt));
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /vacancies — create listing
tenantConstructionRouter.post("/vacancies", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [listing] = await db
      .insert(vacancyListings)
      .values({ ...req.body, orgId })
      .returning();
    res.status(201).json(listing);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /vacancies/:id — update
tenantConstructionRouter.put("/vacancies/:id", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [updated] = await db
      .update(vacancyListings)
      .set(req.body)
      .where(
        and(eq(vacancyListings.id, req.params.id), eq(vacancyListings.orgId, orgId))
      )
      .returning();
    if (!updated) return res.status(404).json({ error: "Vacancy listing not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /prospects — list prospects (filter by dealId, stage)
tenantConstructionRouter.get("/prospects", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { dealId, stage } = req.query;

    const conditions = [eq(leasingProspects.orgId, orgId)];
    if (dealId) conditions.push(eq(leasingProspects.dealId, String(dealId)));
    if (stage) conditions.push(eq(leasingProspects.stage, String(stage)));

    const results = await db
      .select()
      .from(leasingProspects)
      .where(and(...conditions))
      .orderBy(desc(leasingProspects.createdAt));
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /prospects — create prospect
tenantConstructionRouter.post("/prospects", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [prospect] = await db
      .insert(leasingProspects)
      .values({ ...req.body, orgId })
      .returning();
    res.status(201).json(prospect);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /prospects/:id — update (advance stage)
tenantConstructionRouter.put("/prospects/:id", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [updated] = await db
      .update(leasingProspects)
      .set({ ...req.body, updatedAt: new Date() })
      .where(
        and(eq(leasingProspects.id, req.params.id), eq(leasingProspects.orgId, orgId))
      )
      .returning();
    if (!updated) return res.status(404).json({ error: "Prospect not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /showings — schedule showing
tenantConstructionRouter.post("/showings", async (req: Request, res: Response) => {
  try {
    const [showing] = await db
      .insert(showings)
      .values(req.body)
      .returning();
    res.status(201).json(showing);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /showings — list (filter by prospectId)
tenantConstructionRouter.get("/showings", async (req: Request, res: Response) => {
  try {
    const { prospectId } = req.query;

    const conditions = [];
    if (prospectId) conditions.push(eq(showings.prospectId, String(prospectId)));

    const results = await db
      .select()
      .from(showings)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(showings.createdAt));
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /showings/:id — update (status, feedback)
tenantConstructionRouter.put("/showings/:id", async (req: Request, res: Response) => {
  try {
    const [updated] = await db
      .update(showings)
      .set(req.body)
      .where(eq(showings.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Showing not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /vacancies/metrics/:dealId — metrics: vacant units, avg days on market, conversion funnel
tenantConstructionRouter.get("/vacancies/metrics/:dealId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { dealId } = req.params;

    const [vacantCount] = await db
      .select({ count: count() })
      .from(vacancyListings)
      .where(
        and(
          eq(vacancyListings.orgId, orgId),
          eq(vacancyListings.dealId, dealId),
          eq(vacancyListings.status, "vacant")
        )
      );

    const [avgDaysOnMarket] = await db
      .select({
        avg: sql<number>`avg(extract(epoch from (now() - ${vacancyListings.vacantSince}::timestamp)) / 86400)::int`,
      })
      .from(vacancyListings)
      .where(
        and(
          eq(vacancyListings.orgId, orgId),
          eq(vacancyListings.dealId, dealId),
          eq(vacancyListings.status, "vacant")
        )
      );

    const funnel = await db
      .select({
        stage: leasingProspects.stage,
        count: count(),
      })
      .from(leasingProspects)
      .where(
        and(
          eq(leasingProspects.orgId, orgId),
          eq(leasingProspects.dealId, dealId)
        )
      )
      .groupBy(leasingProspects.stage);

    res.json({
      dealId,
      vacantUnits: vacantCount?.count || 0,
      avgDaysOnMarket: avgDaysOnMarket?.avg || 0,
      conversionFunnel: funnel,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── D.1 Construction ────────────────────────────────────────────────────

// POST /construction — create project
tenantConstructionRouter.post("/construction", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [project] = await db
      .insert(constructionProjects)
      .values({ ...req.body, orgId })
      .returning();
    res.status(201).json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /construction — list (filter by dealId, status)
tenantConstructionRouter.get("/construction", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { dealId, status } = req.query;

    const conditions = [eq(constructionProjects.orgId, orgId)];
    if (dealId) conditions.push(eq(constructionProjects.dealId, String(dealId)));
    if (status) conditions.push(eq(constructionProjects.status, String(status)));

    const results = await db
      .select()
      .from(constructionProjects)
      .where(and(...conditions))
      .orderBy(desc(constructionProjects.createdAt));
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /construction/:id — get project with budget lines
tenantConstructionRouter.get("/construction/:id", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [project] = await db
      .select()
      .from(constructionProjects)
      .where(
        and(eq(constructionProjects.id, req.params.id), eq(constructionProjects.orgId, orgId))
      );
    if (!project) return res.status(404).json({ error: "Project not found" });

    const budgetLines = await db
      .select()
      .from(constructionBudgetLines)
      .where(eq(constructionBudgetLines.projectId, req.params.id));

    res.json({ ...project, budgetLines });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /construction/:id — update
tenantConstructionRouter.put("/construction/:id", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [updated] = await db
      .update(constructionProjects)
      .set(req.body)
      .where(
        and(eq(constructionProjects.id, req.params.id), eq(constructionProjects.orgId, orgId))
      )
      .returning();
    if (!updated) return res.status(404).json({ error: "Project not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /construction/:id/budget — list budget lines
tenantConstructionRouter.get("/construction/:id/budget", async (req: Request, res: Response) => {
  try {
    const results = await db
      .select()
      .from(constructionBudgetLines)
      .where(eq(constructionBudgetLines.projectId, req.params.id))
      .orderBy(constructionBudgetLines.category);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /construction/:id/budget — create budget line
tenantConstructionRouter.post("/construction/:id/budget", async (req: Request, res: Response) => {
  try {
    const [line] = await db
      .insert(constructionBudgetLines)
      .values({ ...req.body, projectId: req.params.id })
      .returning();
    res.status(201).json(line);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /construction/budget/:lineId — update budget line
tenantConstructionRouter.put("/construction/budget/:lineId", async (req: Request, res: Response) => {
  try {
    const [updated] = await db
      .update(constructionBudgetLines)
      .set(req.body)
      .where(eq(constructionBudgetLines.id, req.params.lineId))
      .returning();
    if (!updated) return res.status(404).json({ error: "Budget line not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /construction/:id/draws — create draw request
tenantConstructionRouter.post("/construction/:id/draws", async (req: Request, res: Response) => {
  try {
    const [draw] = await db
      .insert(constructionDraws)
      .values({ ...req.body, projectId: req.params.id })
      .returning();
    res.status(201).json(draw);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /construction/:id/draws — list draws
tenantConstructionRouter.get("/construction/:id/draws", async (req: Request, res: Response) => {
  try {
    const results = await db
      .select()
      .from(constructionDraws)
      .where(eq(constructionDraws.projectId, req.params.id))
      .orderBy(constructionDraws.drawNumber);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /construction/draws/:drawId — update draw (approve, fund)
tenantConstructionRouter.put("/construction/draws/:drawId", async (req: Request, res: Response) => {
  try {
    const updateData: Record<string, any> = { ...req.body };

    if (req.body.status === "approved") {
      updateData.approvedAt = new Date();
      updateData.approvedBy = req.user!.id;
    }
    if (req.body.status === "funded") {
      updateData.fundedAt = new Date();
    }

    const [updated] = await db
      .update(constructionDraws)
      .set(updateData)
      .where(eq(constructionDraws.id, req.params.drawId))
      .returning();
    if (!updated) return res.status(404).json({ error: "Draw not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /construction/:id/summary — budget vs actual summary
tenantConstructionRouter.get("/construction/:id/summary", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [project] = await db
      .select()
      .from(constructionProjects)
      .where(
        and(eq(constructionProjects.id, req.params.id), eq(constructionProjects.orgId, orgId))
      );
    if (!project) return res.status(404).json({ error: "Project not found" });

    const [budgetTotals] = await db
      .select({
        totalBudgeted: sum(constructionBudgetLines.budgetedAmount),
        totalContracted: sum(constructionBudgetLines.contractedAmount),
        totalActualToDate: sum(constructionBudgetLines.actualToDate),
        totalProjected: sum(constructionBudgetLines.projectedTotal),
      })
      .from(constructionBudgetLines)
      .where(eq(constructionBudgetLines.projectId, req.params.id));

    const [drawTotals] = await db
      .select({
        totalDrawn: sum(constructionDraws.amount),
        drawCount: count(),
      })
      .from(constructionDraws)
      .where(
        and(
          eq(constructionDraws.projectId, req.params.id),
          eq(constructionDraws.status, "funded")
        )
      );

    const categoryBreakdown = await db
      .select({
        category: constructionBudgetLines.category,
        budgeted: sum(constructionBudgetLines.budgetedAmount),
        actual: sum(constructionBudgetLines.actualToDate),
      })
      .from(constructionBudgetLines)
      .where(eq(constructionBudgetLines.projectId, req.params.id))
      .groupBy(constructionBudgetLines.category);

    res.json({
      project,
      budget: {
        totalBudgeted: budgetTotals?.totalBudgeted || "0",
        totalContracted: budgetTotals?.totalContracted || "0",
        totalActualToDate: budgetTotals?.totalActualToDate || "0",
        totalProjected: budgetTotals?.totalProjected || "0",
      },
      draws: {
        totalDrawn: drawTotals?.totalDrawn || "0",
        drawCount: drawTotals?.drawCount || 0,
      },
      categoryBreakdown,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── D.2 Renovations ────────────────────────────────────────────────────

// GET /renovations — list (filter by dealId, status)
tenantConstructionRouter.get("/renovations", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { dealId, status } = req.query;

    const conditions = [eq(unitRenovations.orgId, orgId)];
    if (dealId) conditions.push(eq(unitRenovations.dealId, String(dealId)));
    if (status) conditions.push(eq(unitRenovations.status, String(status)));

    const results = await db
      .select()
      .from(unitRenovations)
      .where(and(...conditions))
      .orderBy(desc(unitRenovations.createdAt));
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /renovations — create
tenantConstructionRouter.post("/renovations", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [renovation] = await db
      .insert(unitRenovations)
      .values({ ...req.body, orgId })
      .returning();
    res.status(201).json(renovation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /renovations/:id — update
tenantConstructionRouter.put("/renovations/:id", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const [updated] = await db
      .update(unitRenovations)
      .set(req.body)
      .where(
        and(eq(unitRenovations.id, req.params.id), eq(unitRenovations.orgId, orgId))
      )
      .returning();
    if (!updated) return res.status(404).json({ error: "Renovation not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /renovations/metrics/:dealId — ROI metrics
tenantConstructionRouter.get("/renovations/metrics/:dealId", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.user!;
    const { dealId } = req.params;

    const [metrics] = await db
      .select({
        totalUnits: count(),
        avgCost: sql<string>`avg(${unitRenovations.actualCost}::numeric)`,
        avgRentLift: sql<string>`avg((${unitRenovations.achievedRent}::numeric - ${unitRenovations.preRenovationRent}::numeric))`,
        avgRoi: sql<string>`avg(
          case when ${unitRenovations.actualCost}::numeric > 0
          then ((${unitRenovations.achievedRent}::numeric - ${unitRenovations.preRenovationRent}::numeric) * 12)
               / ${unitRenovations.actualCost}::numeric * 100
          else null end
        )`,
      })
      .from(unitRenovations)
      .where(
        and(
          eq(unitRenovations.orgId, orgId),
          eq(unitRenovations.dealId, dealId)
        )
      );

    res.json({
      dealId,
      totalUnits: metrics?.totalUnits || 0,
      avgCost: metrics?.avgCost || "0",
      avgRentLift: metrics?.avgRentLift || "0",
      avgRoiPercent: metrics?.avgRoi || "0",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
