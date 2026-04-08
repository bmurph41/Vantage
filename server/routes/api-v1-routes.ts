/**
 * H.2 — White-Label API v1 Routes
 *
 * External API authenticated via API keys (not session cookies).
 * All endpoints scoped to the org associated with the API key.
 * Rate limited and scope-enforced.
 *
 * Base path: /api/v1/
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  crmDeals,
  crmContacts,
  crmCompanies,
  crmProperties,
  investors,
  investments,
  distributions,
  workOrders,
  webhookEndpoints,
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, ilike, count } from "drizzle-orm";
import { requireScope } from "../middleware/api-key-auth";

export const apiV1Router = Router();

// ── Pagination Helper ────────────────────────────────────────────────────

function getPagination(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function paginatedResponse(data: any[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  };
}

// ── Deals ────────────────────────────────────────────────────────────────

// GET /v1/deals — list deals
apiV1Router.get("/deals", requireScope("deals:read"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const { page, limit, offset } = getPagination(req);
    const { stage, assetClass, search } = req.query;

    const conditions = [eq(crmDeals.orgId, orgId)];
    if (stage) conditions.push(eq(crmDeals.stage, stage as string));
    if (assetClass) conditions.push(eq(crmDeals.assetClass, assetClass as string));
    if (search) conditions.push(ilike(crmDeals.title, `%${search}%`));

    const [{ total }] = await db
      .select({ total: count() })
      .from(crmDeals)
      .where(and(...conditions));

    const deals = await db
      .select({
        id: crmDeals.id,
        title: crmDeals.title,
        stage: crmDeals.stage,
        assetClass: crmDeals.assetClass,
        value: crmDeals.value,
        probability: crmDeals.probability,
        expectedCloseDate: crmDeals.expectedCloseDate,
        isClosed: crmDeals.isClosed,
        isWon: crmDeals.isWon,
        createdAt: crmDeals.createdAt,
        updatedAt: crmDeals.updatedAt,
      })
      .from(crmDeals)
      .where(and(...conditions))
      .orderBy(desc(crmDeals.updatedAt))
      .limit(limit)
      .offset(offset);

    res.json(paginatedResponse(deals, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// GET /v1/deals/:id — deal detail
apiV1Router.get("/deals/:id", requireScope("deals:read"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.id, req.params.id), eq(crmDeals.orgId, orgId)));

    if (!deal) return res.status(404).json({ error: "not_found", message: "Deal not found" });
    res.json({ data: deal });
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ── Portfolio ────────────────────────────────────────────────────────────

// GET /v1/portfolio/summary — portfolio KPIs
apiV1Router.get("/portfolio/summary", requireScope("portfolio:read"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;

    const [stats] = await db
      .select({
        totalDeals: count(),
        totalValue: sql<string>`coalesce(sum(${crmDeals.value}::numeric), 0)`,
        openDeals: sql<number>`count(*) filter (where ${crmDeals.isClosed} = false)`,
        wonDeals: sql<number>`count(*) filter (where ${crmDeals.isWon} = true)`,
        avgDealSize: sql<string>`coalesce(avg(${crmDeals.value}::numeric), 0)`,
      })
      .from(crmDeals)
      .where(eq(crmDeals.orgId, orgId));

    // Stage breakdown
    const stageBreakdown = await db
      .select({
        stage: crmDeals.stage,
        count: count(),
        totalValue: sql<string>`coalesce(sum(${crmDeals.value}::numeric), 0)`,
      })
      .from(crmDeals)
      .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, false)))
      .groupBy(crmDeals.stage);

    res.json({
      data: {
        ...stats,
        stageBreakdown,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ── Contacts ─────────────────────────────────────────────────────────────

// GET /v1/contacts — list contacts
apiV1Router.get("/contacts", requireScope("contacts:read"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const { page, limit, offset } = getPagination(req);
    const { search } = req.query;

    const conditions = [eq(crmContacts.orgId, orgId)];
    if (search) {
      conditions.push(
        sql`(${crmContacts.firstName} || ' ' || ${crmContacts.lastName}) ilike ${`%${search}%`}`,
      );
    }

    const [{ total }] = await db
      .select({ total: count() })
      .from(crmContacts)
      .where(and(...conditions));

    const contacts = await db
      .select({
        id: crmContacts.id,
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
        email: crmContacts.email,
        phone: crmContacts.phone,
        company: crmContacts.company,
        title: crmContacts.title,
        createdAt: crmContacts.createdAt,
      })
      .from(crmContacts)
      .where(and(...conditions))
      .orderBy(desc(crmContacts.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(paginatedResponse(contacts, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// POST /v1/contacts — create contact
apiV1Router.post("/contacts", requireScope("contacts:write"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const { firstName, lastName, email, phone, company, title } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({
        error: "validation_error",
        message: "firstName and lastName are required",
      });
    }

    const [contact] = await db
      .insert(crmContacts)
      .values({ orgId, firstName, lastName, email, phone, company, title })
      .returning();

    res.status(201).json({ data: contact });
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ── Properties ───────────────────────────────────────────────────────────

// GET /v1/properties — list properties
apiV1Router.get("/properties", requireScope("properties:read"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const { page, limit, offset } = getPagination(req);

    const [{ total }] = await db
      .select({ total: count() })
      .from(crmProperties)
      .where(eq(crmProperties.orgId, orgId));

    const properties = await db
      .select({
        id: crmProperties.id,
        name: crmProperties.name,
        address: crmProperties.address,
        city: crmProperties.city,
        state: crmProperties.state,
        propertyType: crmProperties.propertyType,
        askingPrice: crmProperties.askingPrice,
        createdAt: crmProperties.createdAt,
      })
      .from(crmProperties)
      .where(eq(crmProperties.orgId, orgId))
      .orderBy(desc(crmProperties.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(paginatedResponse(properties, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ── LP / Investors ───────────────────────────────────────────────────────

// GET /v1/investors — list investors
apiV1Router.get("/investors", requireScope("lp:read"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const { page, limit, offset } = getPagination(req);

    const [{ total }] = await db
      .select({ total: count() })
      .from(investors)
      .where(eq(investors.orgId, orgId));

    const results = await db
      .select()
      .from(investors)
      .where(eq(investors.orgId, orgId))
      .orderBy(desc(investors.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(paginatedResponse(results, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// GET /v1/distributions — distribution history
apiV1Router.get("/distributions", requireScope("lp:read"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const { page, limit, offset } = getPagination(req);

    const [{ total }] = await db
      .select({ total: count() })
      .from(distributions)
      .where(eq(distributions.orgId, orgId));

    const results = await db
      .select()
      .from(distributions)
      .where(eq(distributions.orgId, orgId))
      .orderBy(desc(distributions.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(paginatedResponse(results, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ── Work Orders ──────────────────────────────────────────────────────────

// GET /v1/work-orders — list work orders
apiV1Router.get("/work-orders", requireScope("operations:read"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const { page, limit, offset } = getPagination(req);
    const { status, dealId } = req.query;

    const conditions = [eq(workOrders.orgId, orgId)];
    if (status) conditions.push(eq(workOrders.status, status as string));
    if (dealId) conditions.push(eq(workOrders.dealId, dealId as string));

    const [{ total }] = await db
      .select({ total: count() })
      .from(workOrders)
      .where(and(...conditions));

    const results = await db
      .select()
      .from(workOrders)
      .where(and(...conditions))
      .orderBy(desc(workOrders.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(paginatedResponse(results, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// POST /v1/work-orders — create work order
apiV1Router.post("/work-orders", requireScope("operations:write"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const { dealId, title, description, priority, category } = req.body;

    if (!title) {
      return res.status(400).json({
        error: "validation_error",
        message: "title is required",
      });
    }

    const [wo] = await db
      .insert(workOrders)
      .values({
        orgId,
        dealId: dealId || null,
        title,
        description,
        priority: priority || "routine",
        category: category || "other",
        status: "open",
      })
      .returning();

    res.status(201).json({ data: wo });
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ── Webhooks ─────────────────────────────────────────────────────────────

// GET /v1/webhooks — list registered webhooks
apiV1Router.get("/webhooks", requireScope("webhooks:read"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const hooks = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.orgId, orgId))
      .orderBy(desc(webhookEndpoints.createdAt));
    res.json({ data: hooks });
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// POST /v1/webhooks — register webhook
apiV1Router.post("/webhooks", requireScope("webhooks:write"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const { url, events, secret } = req.body;

    if (!url || !events?.length) {
      return res.status(400).json({
        error: "validation_error",
        message: "url and events[] are required",
      });
    }

    const [hook] = await db
      .insert(webhookEndpoints)
      .values({
        orgId,
        url,
        events,
        secret: secret || crypto.randomUUID(),
        isActive: true,
      })
      .returning();

    res.status(201).json({ data: hook });
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// DELETE /v1/webhooks/:id — remove webhook
apiV1Router.delete("/webhooks/:id", requireScope("webhooks:write"), async (req: Request, res: Response) => {
  try {
    const orgId = req.apiKeyUser!.orgId;
    const [deleted] = await db
      .delete(webhookEndpoints)
      .where(
        and(eq(webhookEndpoints.id, req.params.id), eq(webhookEndpoints.orgId, orgId)),
      )
      .returning();

    if (!deleted) return res.status(404).json({ error: "not_found" });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ── API Info ─────────────────────────────────────────────────────────────

// GET /v1/ — API info and available endpoints
apiV1Router.get("/", (req: Request, res: Response) => {
  res.json({
    api: "Vantage API",
    version: "v1",
    org: req.apiKeyUser?.orgName,
    scopes: req.apiKeyUser?.scopes,
    endpoints: [
      { method: "GET", path: "/v1/deals", scope: "deals:read" },
      { method: "GET", path: "/v1/deals/:id", scope: "deals:read" },
      { method: "GET", path: "/v1/portfolio/summary", scope: "portfolio:read" },
      { method: "GET", path: "/v1/contacts", scope: "contacts:read" },
      { method: "POST", path: "/v1/contacts", scope: "contacts:write" },
      { method: "GET", path: "/v1/properties", scope: "properties:read" },
      { method: "GET", path: "/v1/investors", scope: "lp:read" },
      { method: "GET", path: "/v1/distributions", scope: "lp:read" },
      { method: "GET", path: "/v1/work-orders", scope: "operations:read" },
      { method: "POST", path: "/v1/work-orders", scope: "operations:write" },
      { method: "GET", path: "/v1/webhooks", scope: "webhooks:read" },
      { method: "POST", path: "/v1/webhooks", scope: "webhooks:write" },
      { method: "DELETE", path: "/v1/webhooks/:id", scope: "webhooks:write" },
    ],
    rateLimit: {
      limit: req.apiKeyUser?.rateLimitPerHour,
      unit: "requests/hour",
    },
  });
});
