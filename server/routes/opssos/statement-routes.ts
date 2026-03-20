import { Router } from "express";
import * as XLSX from "xlsx";
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

    // Fetch the template to get column/filter/total configuration
    const [template] = await db
      .select()
      .from(opssosStatementTemplates)
      .where(and(eq(opssosStatementTemplates.id, templateId), eq(opssosStatementTemplates.orgId, orgId)));

    // Generate XLSX workbook
    const workbook = XLSX.utils.book_new();

    // Build statement header info
    const headerData = [
      ["Operating Statement"],
      ["Period", `${periodStart || "N/A"} to ${periodEnd || "N/A"}`],
      ["Template", template?.name || "Custom"],
      ["Generated", new Date().toISOString()],
      ["Status", "Draft"],
      [],
    ];

    // Build data columns from template config
    const columns = (template?.columns as any[]) || [
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "budget", label: "Budget" },
      { key: "variance", label: "Variance" },
      { key: "variancePct", label: "Variance %" },
    ];

    const columnLabels = columns.map((c: any) => c.label || c.key);
    const dataRows: any[][] = [];

    // Build statement line items based on filters
    const filters = (template?.filters as any) || {};
    const categories = filters.categories || [
      "Revenue", "Cost of Goods Sold", "Operating Expenses",
      "Administrative Expenses", "Other Income/Expenses",
    ];

    // Generate structured line items per category
    for (const category of categories) {
      dataRows.push([category, "", "", "", ""]);
      // Placeholder line items per category (will be populated from actual GL data when available)
      dataRows.push(["  (Line items from GL)", "", "", "", ""]);
      dataRows.push([]);
    }

    // Totals section
    const totalsConfig = (template?.totals as any) || {};
    dataRows.push([]);
    dataRows.push(["TOTALS"]);
    if (totalsConfig.showNetIncome !== false) {
      dataRows.push(["Net Operating Income", "", "", "", ""]);
    }
    if (totalsConfig.showCashFlow !== false) {
      dataRows.push(["Cash Flow", "", "", "", ""]);
    }

    // Combine into sheet
    const sheetData = [...headerData, columnLabels, ...dataRows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths
    sheet["!cols"] = columns.map((_: any, i: number) => ({ wch: i === 0 ? 35 : 15 }));

    XLSX.utils.book_append_sheet(workbook, sheet, "Statement");

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Encode as base64 data URL for storage
    const base64 = Buffer.from(buffer).toString("base64");
    const fileUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;

    const [exportRecord] = await db
      .insert(opssosStatementExports)
      .values({
        orgId,
        statementId: statement.id,
        format: "xlsx",
        fileUrl,
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
