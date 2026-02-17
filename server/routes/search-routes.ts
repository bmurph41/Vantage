import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { userPinnedItems, userRecentItems, userFavorites } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

router.get("/api/search", async (req: any, res: Response) => {
  try {
    const query = (req.query.q as string || "").trim();
    if (query.length < 2) {
      return res.json({ results: [], query });
    }

    const orgId = req.user.orgId;
    const searchPattern = `%${query}%`;

    const [contacts, companies, deals, properties, modelingProjects, ddProjects] = await Promise.all([
      db.execute(sql`
        SELECT id, 
          COALESCE(first_name || ' ' || last_name, first_name, last_name, email) as title,
          COALESCE(company, email) as subtitle,
          'contact' as type
        FROM crm_contacts 
        WHERE org_id = ${orgId}
          AND (
            first_name ILIKE ${searchPattern} OR 
            last_name ILIKE ${searchPattern} OR 
            email ILIKE ${searchPattern} OR
            company ILIKE ${searchPattern} OR
            (first_name || ' ' || last_name) ILIKE ${searchPattern}
          )
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 5
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT id, name as title, 
          COALESCE(city || ', ' || state, industry) as subtitle,
          'company' as type
        FROM crm_companies 
        WHERE org_id = ${orgId}
          AND (name ILIKE ${searchPattern} OR city ILIKE ${searchPattern} OR industry ILIKE ${searchPattern})
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 5
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT id, name as title, 
          COALESCE(stage, status) as subtitle,
          'deal' as type
        FROM crm_deals 
        WHERE org_id = ${orgId}
          AND (name ILIKE ${searchPattern})
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 5
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT id, name as title, 
          COALESCE(city || ', ' || state, address) as subtitle,
          'property' as type
        FROM crm_properties 
        WHERE org_id = ${orgId}
          AND (name ILIKE ${searchPattern} OR city ILIKE ${searchPattern} OR address ILIKE ${searchPattern})
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 5
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT id, name as title, 
          status as subtitle,
          'modelingProject' as type
        FROM modeling_projects 
        WHERE org_id = ${orgId}
          AND (name ILIKE ${searchPattern})
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 5
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT id, name as title, 
          status as subtitle,
          'ddProject' as type
        FROM projects 
        WHERE org_id = ${orgId}
          AND (name ILIKE ${searchPattern})
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 5
      `).catch(() => ({ rows: [] })),
    ]);

    const results = [
      ...contacts.rows,
      ...companies.rows,
      ...deals.rows,
      ...properties.rows,
      ...modelingProjects.rows,
      ...ddProjects.rows,
    ].map((r: any) => ({
      id: r.id,
      type: r.type,
      title: r.title || "Untitled",
      subtitle: r.subtitle || null,
      description: null,
    }));

    res.json({ results, query });
  } catch (error: any) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

router.get("/api/quick-access/pinned", async (req: any, res: Response) => {
  try {
    const items = await db
      .select()
      .from(userPinnedItems)
      .where(and(eq(userPinnedItems.userId, req.user.id), eq(userPinnedItems.orgId, req.user.orgId)))
      .limit(10);

    res.json(items.map((i) => ({
      id: i.id,
      itemType: i.itemType,
      itemId: i.itemId,
      title: i.title,
      subtitle: i.description,
    })));
  } catch {
    res.json([]);
  }
});

router.get("/api/quick-access/favorites", async (req: any, res: Response) => {
  try {
    const items = await db
      .select()
      .from(userFavorites)
      .where(and(eq(userFavorites.userId, req.user.id), eq(userFavorites.orgId, req.user.orgId)))
      .limit(10);

    res.json(items.map((i) => ({
      id: i.id,
      itemType: i.itemType,
      itemId: i.itemId,
      title: i.title,
      subtitle: i.subtitle,
    })));
  } catch {
    res.json([]);
  }
});

router.get("/api/quick-access/recent", async (req: any, res: Response) => {
  try {
    const items = await db
      .select()
      .from(userRecentItems)
      .where(and(eq(userRecentItems.userId, req.user.id), eq(userRecentItems.orgId, req.user.orgId)))
      .orderBy(desc(userRecentItems.accessedAt))
      .limit(10);

    res.json(items.map((i) => ({
      id: i.id,
      itemType: i.itemType,
      itemId: i.itemId,
      title: i.title,
      subtitle: null,
    })));
  } catch {
    res.json([]);
  }
});

export default router;
