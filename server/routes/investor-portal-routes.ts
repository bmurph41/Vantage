/**
 * Investor Portal Routes (Sections 2.1-2.5)
 *
 * LP Dashboard, Capital Calls, Distributions, Tax Documents, Investor Reporting.
 * GP-side management + LP-facing data endpoints.
 */
import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  investors,
  investments,
  distributions,
  distributionAllocations,
  capitalCalls,
  capitalCallLineItems,
  taxDocuments,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const investorPortalRouter = Router();

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || null;
}

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.claims?.sub || null;
}

// ============================================================================
// GP-SIDE INVESTOR MANAGEMENT
// ============================================================================

// GET / — list all investors for org
investorPortalRouter.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db
      .select()
      .from(investors)
      .where(eq(investors.orgId, orgId))
      .orderBy(desc(investors.createdAt));

    res.json(result);
  } catch (error) {
    console.error("Error listing investors:", error);
    res.status(500).json({ error: "Failed to list investors" });
  }
});

// POST / — create investor
investorPortalRouter.post("/", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [created] = await db
      .insert(investors)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating investor:", error);
    res.status(500).json({ error: "Failed to create investor" });
  }
});

// GET /:id — get investor detail
investorPortalRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [investor] = await db
      .select()
      .from(investors)
      .where(and(eq(investors.id, req.params.id), eq(investors.orgId, orgId)));

    if (!investor) return res.status(404).json({ error: "Investor not found" });

    res.json(investor);
  } catch (error) {
    console.error("Error fetching investor:", error);
    res.status(500).json({ error: "Failed to fetch investor" });
  }
});

// PUT /:id — update investor
investorPortalRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [updated] = await db
      .update(investors)
      .set(req.body)
      .where(and(eq(investors.id, req.params.id), eq(investors.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Investor not found" });

    res.json(updated);
  } catch (error) {
    console.error("Error updating investor:", error);
    res.status(500).json({ error: "Failed to update investor" });
  }
});

// GET /:id/portfolio — investor's investments + distributions summary
investorPortalRouter.get("/:id/portfolio", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const investorId = req.params.id;

    const investmentList = await db
      .select()
      .from(investments)
      .where(
        and(eq(investments.investorId, investorId), eq(investments.orgId, orgId))
      )
      .orderBy(desc(investments.createdAt));

    const distributionSummary = await db
      .select({
        totalDistributed: sql<string>`coalesce(sum(${distributionAllocations.amount}), '0')`,
        totalReturnOfCapital: sql<string>`coalesce(sum(${distributionAllocations.returnOfCapital}), '0')`,
        totalPreferredReturn: sql<string>`coalesce(sum(${distributionAllocations.preferredReturnAmount}), '0')`,
        totalProfitShare: sql<string>`coalesce(sum(${distributionAllocations.profitShare}), '0')`,
      })
      .from(distributionAllocations)
      .where(eq(distributionAllocations.investorId, investorId));

    const totalCommitment = investmentList.reduce(
      (sum, inv) => sum + parseFloat(inv.commitmentAmount || "0"),
      0
    );
    const totalFunded = investmentList.reduce(
      (sum, inv) => sum + parseFloat(inv.fundedAmount || "0"),
      0
    );

    res.json({
      investments: investmentList,
      summary: {
        totalCommitment,
        totalFunded,
        totalDistributed: parseFloat(distributionSummary[0]?.totalDistributed || "0"),
        totalReturnOfCapital: parseFloat(distributionSummary[0]?.totalReturnOfCapital || "0"),
        totalPreferredReturn: parseFloat(distributionSummary[0]?.totalPreferredReturn || "0"),
        totalProfitShare: parseFloat(distributionSummary[0]?.totalProfitShare || "0"),
        investmentCount: investmentList.length,
      },
    });
  } catch (error) {
    console.error("Error fetching investor portfolio:", error);
    res.status(500).json({ error: "Failed to fetch investor portfolio" });
  }
});

// ============================================================================
// INVESTMENTS
// ============================================================================

// POST /investments — create investment
investorPortalRouter.post("/investments", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [created] = await db
      .insert(investments)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating investment:", error);
    res.status(500).json({ error: "Failed to create investment" });
  }
});

// GET /investments/deal/:dealId — all investments in a deal
investorPortalRouter.get("/investments/deal/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db
      .select()
      .from(investments)
      .where(
        and(eq(investments.dealId, req.params.dealId), eq(investments.orgId, orgId))
      )
      .orderBy(desc(investments.createdAt));

    res.json(result);
  } catch (error) {
    console.error("Error listing deal investments:", error);
    res.status(500).json({ error: "Failed to list deal investments" });
  }
});

// PUT /investments/:id — update investment
investorPortalRouter.put("/investments/:id", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [updated] = await db
      .update(investments)
      .set(req.body)
      .where(
        and(eq(investments.id, req.params.id), eq(investments.orgId, orgId))
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Investment not found" });

    res.json(updated);
  } catch (error) {
    console.error("Error updating investment:", error);
    res.status(500).json({ error: "Failed to update investment" });
  }
});

// ============================================================================
// DISTRIBUTIONS
// ============================================================================

// POST /distributions — create distribution
investorPortalRouter.post("/distributions", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [created] = await db
      .insert(distributions)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating distribution:", error);
    res.status(500).json({ error: "Failed to create distribution" });
  }
});

// GET /distributions/deal/:dealId — list distributions for deal
investorPortalRouter.get("/distributions/deal/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db
      .select()
      .from(distributions)
      .where(
        and(
          eq(distributions.dealId, req.params.dealId),
          eq(distributions.orgId, orgId)
        )
      )
      .orderBy(desc(distributions.createdAt));

    res.json(result);
  } catch (error) {
    console.error("Error listing deal distributions:", error);
    res.status(500).json({ error: "Failed to list deal distributions" });
  }
});

// POST /distributions/:id/approve — approve distribution
investorPortalRouter.post("/distributions/:id/approve", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [updated] = await db
      .update(distributions)
      .set({ status: "approved", approvedBy: userId })
      .where(
        and(eq(distributions.id, req.params.id), eq(distributions.orgId, orgId))
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Distribution not found" });

    res.json(updated);
  } catch (error) {
    console.error("Error approving distribution:", error);
    res.status(500).json({ error: "Failed to approve distribution" });
  }
});

// POST /distributions/:id/allocations — bulk create allocations
investorPortalRouter.post("/distributions/:id/allocations", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const distributionId = req.params.id;
    const allocations: Array<Record<string, any>> = req.body.allocations;

    if (!Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ error: "allocations array is required" });
    }

    // Verify distribution belongs to org
    const [dist] = await db
      .select()
      .from(distributions)
      .where(
        and(eq(distributions.id, distributionId), eq(distributions.orgId, orgId))
      );

    if (!dist) return res.status(404).json({ error: "Distribution not found" });

    const values = allocations.map((a) => ({
      ...a,
      distributionId,
    }));

    const created = await db
      .insert(distributionAllocations)
      .values(values)
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating distribution allocations:", error);
    res.status(500).json({ error: "Failed to create distribution allocations" });
  }
});

// ============================================================================
// CAPITAL CALLS
// ============================================================================

// POST /capital-calls — create capital call
investorPortalRouter.post("/capital-calls", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [created] = await db
      .insert(capitalCalls)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating capital call:", error);
    res.status(500).json({ error: "Failed to create capital call" });
  }
});

// GET /capital-calls/deal/:dealId — list calls for deal
investorPortalRouter.get("/capital-calls/deal/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db
      .select()
      .from(capitalCalls)
      .where(
        and(
          eq(capitalCalls.dealId, req.params.dealId),
          eq(capitalCalls.orgId, orgId)
        )
      )
      .orderBy(desc(capitalCalls.createdAt));

    res.json(result);
  } catch (error) {
    console.error("Error listing deal capital calls:", error);
    res.status(500).json({ error: "Failed to list deal capital calls" });
  }
});

// POST /capital-calls/:id/calculate — auto-calc LP amounts by ownership %
investorPortalRouter.post("/capital-calls/:id/calculate", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const callId = req.params.id;

    // Fetch the capital call
    const [call] = await db
      .select()
      .from(capitalCalls)
      .where(and(eq(capitalCalls.id, callId), eq(capitalCalls.orgId, orgId)));

    if (!call) return res.status(404).json({ error: "Capital call not found" });

    const totalAmount = parseFloat(call.totalAmount || "0");
    if (totalAmount <= 0) {
      return res.status(400).json({ error: "Capital call totalAmount must be greater than 0" });
    }

    // Get all investments for this deal
    const dealInvestments = await db
      .select()
      .from(investments)
      .where(
        and(
          eq(investments.dealId, call.dealId!),
          eq(investments.orgId, orgId),
          eq(investments.status, "committed")
        )
      );

    if (dealInvestments.length === 0) {
      return res.status(400).json({ error: "No active investments found for this deal" });
    }

    // Calculate each LP's share based on ownership percentage
    const lineItemValues = dealInvestments.map((inv) => ({
      capitalCallId: callId,
      investmentId: inv.id,
      investorId: inv.investorId,
      amountCalled: String(
        (totalAmount * parseFloat(inv.ownershipPct || "0")) / 100
      ),
      dueDate: call.dueDate,
      status: "pending" as const,
    }));

    const created = await db
      .insert(capitalCallLineItems)
      .values(lineItemValues)
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Error calculating capital call allocations:", error);
    res.status(500).json({ error: "Failed to calculate capital call allocations" });
  }
});

// POST /capital-calls/:id/issue — change status to issued
investorPortalRouter.post("/capital-calls/:id/issue", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [updated] = await db
      .update(capitalCalls)
      .set({ status: "issued", noticeSentAt: new Date() })
      .where(
        and(eq(capitalCalls.id, req.params.id), eq(capitalCalls.orgId, orgId))
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Capital call not found" });

    res.json(updated);
  } catch (error) {
    console.error("Error issuing capital call:", error);
    res.status(500).json({ error: "Failed to issue capital call" });
  }
});

// PATCH /capital-calls/line-items/:lineItemId/mark-received — log payment
investorPortalRouter.patch(
  "/capital-calls/line-items/:lineItemId/mark-received",
  async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(401).json({ error: "Unauthorized" });

      const { amountReceived, paymentMethod, referenceNumber } = req.body;

      const [updated] = await db
        .update(capitalCallLineItems)
        .set({
          amountReceived: amountReceived || undefined,
          paymentMethod: paymentMethod || undefined,
          referenceNumber: referenceNumber || undefined,
          status: "received",
          receivedAt: new Date(),
        })
        .where(eq(capitalCallLineItems.id, req.params.lineItemId))
        .returning();

      if (!updated)
        return res.status(404).json({ error: "Line item not found" });

      res.json(updated);
    } catch (error) {
      console.error("Error marking line item received:", error);
      res.status(500).json({ error: "Failed to mark line item received" });
    }
  }
);

// GET /capital-calls/overdue — all overdue calls
investorPortalRouter.get("/capital-calls/overdue", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db
      .select()
      .from(capitalCallLineItems)
      .innerJoin(
        capitalCalls,
        eq(capitalCallLineItems.capitalCallId, capitalCalls.id)
      )
      .where(
        and(
          eq(capitalCalls.orgId, orgId),
          eq(capitalCallLineItems.status, "pending"),
          sql`${capitalCallLineItems.dueDate} < current_date`
        )
      )
      .orderBy(desc(capitalCallLineItems.dueDate));

    res.json(result);
  } catch (error) {
    console.error("Error listing overdue capital calls:", error);
    res.status(500).json({ error: "Failed to list overdue capital calls" });
  }
});

// ============================================================================
// TAX DOCUMENTS
// ============================================================================

// POST /tax-documents — upload tax doc
investorPortalRouter.post("/tax-documents", async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const [created] = await db
      .insert(taxDocuments)
      .values({ ...req.body, orgId, uploadedBy: userId })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error("Error uploading tax document:", error);
    res.status(500).json({ error: "Failed to upload tax document" });
  }
});

// GET /tax-documents/investor/:investorId — list tax docs for investor
investorPortalRouter.get(
  "/tax-documents/investor/:investorId",
  async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(401).json({ error: "Unauthorized" });

      const result = await db
        .select()
        .from(taxDocuments)
        .where(
          and(
            eq(taxDocuments.investorId, req.params.investorId),
            eq(taxDocuments.orgId, orgId)
          )
        )
        .orderBy(desc(taxDocuments.uploadedAt));

      res.json(result);
    } catch (error) {
      console.error("Error listing tax documents:", error);
      res.status(500).json({ error: "Failed to list tax documents" });
    }
  }
);

// POST /tax-documents/:id/publish — make available to investor
investorPortalRouter.post(
  "/tax-documents/:id/publish",
  async (req: Request, res: Response) => {
    try {
      const orgId = getOrgId(req);
      if (!orgId) return res.status(401).json({ error: "Unauthorized" });

      const [updated] = await db
        .update(taxDocuments)
        .set({ isAvailableToInvestor: true, sentAt: new Date() })
        .where(
          and(eq(taxDocuments.id, req.params.id), eq(taxDocuments.orgId, orgId))
        )
        .returning();

      if (!updated)
        return res.status(404).json({ error: "Tax document not found" });

      res.json(updated);
    } catch (error) {
      console.error("Error publishing tax document:", error);
      res.status(500).json({ error: "Failed to publish tax document" });
    }
  }
);

// ============================================================================
// LP DASHBOARD (data endpoints)
// ============================================================================

// GET /lp/dashboard/:investorId — portfolio summary (aggregated metrics)
investorPortalRouter.get(
  "/lp/dashboard/:investorId",
  async (req: Request, res: Response) => {
    try {
      const investorId = req.params.investorId;

      // Aggregate investment metrics
      const investmentMetrics = await db
        .select({
          totalCommitment: sql<string>`coalesce(sum(${investments.commitmentAmount}::numeric), 0)`,
          totalFunded: sql<string>`coalesce(sum(${investments.fundedAmount}::numeric), 0)`,
          investmentCount: sql<number>`count(*)::int`,
          activeInvestments: sql<number>`count(*) filter (where ${investments.status} = 'committed')::int`,
        })
        .from(investments)
        .where(eq(investments.investorId, investorId));

      // Aggregate distribution metrics
      const distributionMetrics = await db
        .select({
          totalDistributed: sql<string>`coalesce(sum(${distributionAllocations.amount}::numeric), 0)`,
          totalReturnOfCapital: sql<string>`coalesce(sum(${distributionAllocations.returnOfCapital}::numeric), 0)`,
          totalPreferredReturn: sql<string>`coalesce(sum(${distributionAllocations.preferredReturnAmount}::numeric), 0)`,
          totalProfitShare: sql<string>`coalesce(sum(${distributionAllocations.profitShare}::numeric), 0)`,
          distributionCount: sql<number>`count(*)::int`,
        })
        .from(distributionAllocations)
        .where(eq(distributionAllocations.investorId, investorId));

      // Outstanding capital calls
      const capitalCallMetrics = await db
        .select({
          totalCalled: sql<string>`coalesce(sum(${capitalCallLineItems.amountCalled}::numeric), 0)`,
          totalReceived: sql<string>`coalesce(sum(${capitalCallLineItems.amountReceived}::numeric), 0)`,
          pendingCalls: sql<number>`count(*) filter (where ${capitalCallLineItems.status} = 'pending')::int`,
        })
        .from(capitalCallLineItems)
        .where(eq(capitalCallLineItems.investorId, investorId));

      res.json({
        investments: investmentMetrics[0],
        distributions: distributionMetrics[0],
        capitalCalls: capitalCallMetrics[0],
      });
    } catch (error) {
      console.error("Error fetching LP dashboard:", error);
      res.status(500).json({ error: "Failed to fetch LP dashboard" });
    }
  }
);

// GET /lp/positions/:investorId — investment positions
investorPortalRouter.get(
  "/lp/positions/:investorId",
  async (req: Request, res: Response) => {
    try {
      const investorId = req.params.investorId;

      const positions = await db
        .select()
        .from(investments)
        .where(eq(investments.investorId, investorId))
        .orderBy(desc(investments.createdAt));

      res.json(positions);
    } catch (error) {
      console.error("Error fetching LP positions:", error);
      res.status(500).json({ error: "Failed to fetch LP positions" });
    }
  }
);

// GET /lp/distributions/:investorId — distribution history
investorPortalRouter.get(
  "/lp/distributions/:investorId",
  async (req: Request, res: Response) => {
    try {
      const investorId = req.params.investorId;

      const result = await db
        .select()
        .from(distributionAllocations)
        .innerJoin(
          distributions,
          eq(distributionAllocations.distributionId, distributions.id)
        )
        .where(eq(distributionAllocations.investorId, investorId))
        .orderBy(desc(distributions.distributionDate));

      res.json(result);
    } catch (error) {
      console.error("Error fetching LP distributions:", error);
      res.status(500).json({ error: "Failed to fetch LP distributions" });
    }
  }
);
