import { Router } from "express";
import { db } from "../../db";
import { 
  opssosStatementTemplates, 
  opssosStatements,
  opssosStatementExports
} from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

export const statementRouter = Router();

// Get all statement templates
statementRouter.get("/templates", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const templates = await db
      .select()
      .from(opssosStatementTemplates)
      .where(eq(opssosStatementTemplates.orgId, orgId))
      .orderBy(desc(opssosStatementTemplates.createdAt));

    res.json(templates);
  } catch (error) {
    console.error("Error fetching statement templates:", error);
    res.status(500).json({ error: "Failed to fetch statement templates" });
  }
});

// Create statement template
statementRouter.post("/templates", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { name, ownerContactId, filters, columns, totals } = req.body;

    const [template] = await db
      .insert(opssosStatementTemplates)
      .values({
        orgId,
        name,
        ownerContactId,
        filters: filters || {},
        columns: columns || [],
        totals: totals || {},
      })
      .returning();

    res.json(template);
  } catch (error) {
    console.error("Error creating statement template:", error);
    res.status(500).json({ error: "Failed to create statement template" });
  }
});

// Generate statement
statementRouter.post("/generate", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { templateId, periodStart, periodEnd } = req.body;

    // Create statement record
    const [statement] = await db
      .insert(opssosStatements)
      .values({
        orgId,
        templateId,
        periodStart,
        periodEnd,
        status: "draft",
      })
      .returning();

    // TODO: Generate actual XLSX file here
    // For now, create a placeholder export record
    const [exportRecord] = await db
      .insert(opssosStatementExports)
      .values({
        orgId,
        statementId: statement.id,
        format: "xlsx",
        fileUrl: `/exports/statements/${statement.id}.xlsx`,
      })
      .returning();

    res.json({ statement, exports: [exportRecord] });
  } catch (error) {
    console.error("Error generating statement:", error);
    res.status(500).json({ error: "Failed to generate statement" });
  }
});

// Get statement by ID
statementRouter.get("/:id", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const [statement] = await db
      .select()
      .from(opssosStatements)
      .where(and(eq(opssosStatements.id, id), eq(opssosStatements.orgId, orgId)));

    if (!statement) {
      return res.status(404).json({ error: "Statement not found" });
    }

    res.json(statement);
  } catch (error) {
    console.error("Error fetching statement:", error);
    res.status(500).json({ error: "Failed to fetch statement" });
  }
});

// Get statement exports
statementRouter.get("/:id/exports", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;

    const exports = await db
      .select()
      .from(opssosStatementExports)
      .where(eq(opssosStatementExports.statementId, id));

    res.json(exports);
  } catch (error) {
    console.error("Error fetching statement exports:", error);
    res.status(500).json({ error: "Failed to fetch statement exports" });
  }
});
