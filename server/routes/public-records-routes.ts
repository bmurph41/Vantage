/**
 * F.6 — Public Records / Title Data Routes
 *
 * Property enrichment from ATTOM Data Solutions, with caching in
 * propertyPublicRecords table. Supports auto-fill from address,
 * selective field import, and data refresh.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { propertyPublicRecords, crmProperties, crmDeals } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { PublicRecordsService } from "../services/public-records-service";

export const publicRecordsRouter = Router();

const publicRecordsService = new PublicRecordsService();

// ── Enrich from Address ──────────────────────────────────────────────────

// POST /enrich — pull public records for an address and store
publicRecordsRouter.post("/enrich", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { address, dealId, propertyId } = req.body;

    if (!address) {
      return res.status(400).json({ error: "address is required" });
    }

    // Check for existing recent record (within 30 days)
    const existing = await db
      .select()
      .from(propertyPublicRecords)
      .where(
        and(
          eq(propertyPublicRecords.orgId, orgId),
          eq(propertyPublicRecords.address, address),
          sql`${propertyPublicRecords.updatedAt} > now() - interval '30 days'`,
        ),
      )
      .limit(1);

    if (existing.length > 0 && !req.body.forceRefresh) {
      return res.json({ ...existing[0], cached: true });
    }

    // Fetch fresh data
    const snapshot = await publicRecordsService.enrichFromAddress(address);

    // Upsert the record
    if (existing.length > 0) {
      const [updated] = await db
        .update(propertyPublicRecords)
        .set({
          ...snapshotToDbFields(snapshot),
          updatedAt: new Date(),
        })
        .where(eq(propertyPublicRecords.id, existing[0].id))
        .returning();
      return res.json({ ...updated, cached: false });
    }

    const [record] = await db
      .insert(propertyPublicRecords)
      .values({
        orgId,
        dealId: dealId || null,
        propertyId: propertyId || null,
        address,
        ...snapshotToDbFields(snapshot),
      })
      .returning();

    res.status(201).json({ ...record, cached: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Import Fields to Deal/Property ───────────────────────────────────────

// POST /import — selectively import public record fields into a deal or property
publicRecordsRouter.post("/import", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { recordId, targetType, targetId, fields } = req.body;

    if (!recordId || !targetType || !targetId || !fields?.length) {
      return res.status(400).json({
        error: "recordId, targetType (deal|property), targetId, and fields[] are required",
      });
    }

    const [record] = await db
      .select()
      .from(propertyPublicRecords)
      .where(and(eq(propertyPublicRecords.id, recordId), eq(propertyPublicRecords.orgId, orgId)));

    if (!record) return res.status(404).json({ error: "Public record not found" });

    const fieldMap = buildFieldMap(record);
    const importedFields: Record<string, any> = {};

    for (const field of fields) {
      if (fieldMap[field] !== undefined) {
        importedFields[field] = fieldMap[field];
      }
    }

    if (targetType === "property") {
      const propertyUpdate: Record<string, any> = {};
      if (importedFields.yearBuilt) propertyUpdate.yearBuilt = importedFields.yearBuilt;
      if (importedFields.lastSalePrice) propertyUpdate.lastSalePrice = String(importedFields.lastSalePrice);
      if (importedFields.lastSaleDate) propertyUpdate.lastSaleDate = importedFields.lastSaleDate;
      if (importedFields.totalUnits) propertyUpdate.totalSlips = importedFields.totalUnits;

      if (Object.keys(propertyUpdate).length > 0) {
        await db
          .update(crmProperties)
          .set(propertyUpdate)
          .where(and(eq(crmProperties.id, targetId), eq(crmProperties.orgId, orgId)));
      }
    } else if (targetType === "deal") {
      const dealUpdate: Record<string, any> = {};
      if (importedFields.lastSalePrice) dealUpdate.askPrice = String(importedFields.lastSalePrice);
      if (importedFields.assessedValue) dealUpdate.assessedValue = String(importedFields.assessedValue);

      if (Object.keys(dealUpdate).length > 0) {
        await db
          .update(crmDeals)
          .set(dealUpdate)
          .where(and(eq(crmDeals.id, targetId), eq(crmDeals.orgId, orgId)));
      }
    }

    res.json({ imported: importedFields, targetType, targetId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Lookup & History ─────────────────────────────────────────────────────

// GET /property/:propertyId — get cached public records for a property
publicRecordsRouter.get("/property/:propertyId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const records = await db
      .select()
      .from(propertyPublicRecords)
      .where(
        and(
          eq(propertyPublicRecords.orgId, orgId),
          eq(propertyPublicRecords.propertyId, req.params.propertyId),
        ),
      )
      .orderBy(desc(propertyPublicRecords.updatedAt))
      .limit(1);

    if (records.length === 0) return res.status(404).json({ error: "No public records found" });
    res.json(records[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /deal/:dealId — get cached public records for a deal
publicRecordsRouter.get("/deal/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const records = await db
      .select()
      .from(propertyPublicRecords)
      .where(
        and(
          eq(propertyPublicRecords.orgId, orgId),
          eq(propertyPublicRecords.dealId, req.params.dealId),
        ),
      )
      .orderBy(desc(propertyPublicRecords.updatedAt));
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET / — list all public records for org
publicRecordsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const records = await db
      .select()
      .from(propertyPublicRecords)
      .where(eq(propertyPublicRecords.orgId, orgId))
      .orderBy(desc(propertyPublicRecords.updatedAt))
      .limit(100);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /:id — remove a public record
publicRecordsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [deleted] = await db
      .delete(propertyPublicRecords)
      .where(
        and(eq(propertyPublicRecords.id, req.params.id), eq(propertyPublicRecords.orgId, orgId)),
      )
      .returning();
    if (!deleted) return res.status(404).json({ error: "Record not found" });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Sale History Detail ──────────────────────────────────────────────────

// GET /sale-history/:address — get sale history for an address (live lookup)
publicRecordsRouter.get("/sale-history/:address", async (req: Request, res: Response) => {
  try {
    const address = decodeURIComponent(req.params.address);
    const attomId = await publicRecordsService.lookupPropertyId(address);
    if (!attomId) return res.status(404).json({ error: "Property not found in public records" });

    const saleData = await publicRecordsService.getSaleHistory(attomId);
    const sales = (saleData?.property?.[0]?.saleHistory || []).map((s: any) => ({
      date: s.amount?.saleTransDate || s.amount?.saleRecDate,
      price: parseFloat(s.amount?.saleAmt) || 0,
      buyer: s.amount?.buyerName,
      seller: s.amount?.sellerName,
      docNumber: s.amount?.documentNumber,
      transactionType: s.amount?.transactionType,
    }));

    res.json({ address, attomId, sales });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /tax-history/:address — get tax assessment history
publicRecordsRouter.get("/tax-history/:address", async (req: Request, res: Response) => {
  try {
    const address = decodeURIComponent(req.params.address);
    const attomId = await publicRecordsService.lookupPropertyId(address);
    if (!attomId) return res.status(404).json({ error: "Property not found in public records" });

    const taxData = await publicRecordsService.getTaxHistory(attomId);
    const assessment = taxData?.property?.[0]?.assessment || {};

    res.json({
      address,
      attomId,
      assessedValue: parseFloat(assessment.assessed?.assdTtlValue) || null,
      marketValue: parseFloat(assessment.market?.mktTtlValue) || null,
      taxYear: parseInt(assessment.tax?.taxYear) || null,
      annualTaxes: parseFloat(assessment.tax?.taxAmt) || null,
      landValue: parseFloat(assessment.assessed?.assdLandValue) || null,
      improvementValue: parseFloat(assessment.assessed?.assdImprValue) || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────

function snapshotToDbFields(snapshot: any) {
  return {
    externalId: snapshot.externalId,
    provider: snapshot.provider,
    yearBuilt: snapshot.yearBuilt,
    buildingSqFt: snapshot.buildingSqFt,
    lotSqFt: snapshot.lotSqFt,
    totalUnits: snapshot.totalUnits,
    stories: snapshot.stories,
    constructionType: snapshot.constructionType,
    propertyType: snapshot.propertyType,
    currentOwner: snapshot.currentOwner,
    ownerMailingAddress: snapshot.ownerMailingAddress,
    ownershipType: snapshot.ownershipType,
    assessedValue: snapshot.assessedValue ? String(snapshot.assessedValue) : null,
    taxYear: snapshot.taxYear,
    annualTaxes: snapshot.annualTaxes ? String(snapshot.annualTaxes) : null,
    taxExemptions: snapshot.taxExemptions,
    saleHistory: snapshot.saleHistory,
    lastSaleDate: snapshot.lastSaleDate,
    lastSalePrice: snapshot.lastSalePrice ? String(snapshot.lastSalePrice) : null,
    liens: snapshot.liens,
    totalLienAmount: snapshot.totalLienAmount ? String(snapshot.totalLienAmount) : null,
    zoningCode: snapshot.zoningCode,
    zoningDescription: snapshot.zoningDescription,
    dataAsOf: snapshot.dataAsOf,
    rawResponse: snapshot,
  };
}

function buildFieldMap(record: any): Record<string, any> {
  return {
    yearBuilt: record.yearBuilt,
    buildingSqFt: record.buildingSqFt,
    lotSqFt: record.lotSqFt,
    totalUnits: record.totalUnits,
    stories: record.stories,
    constructionType: record.constructionType,
    propertyType: record.propertyType,
    currentOwner: record.currentOwner,
    ownerMailingAddress: record.ownerMailingAddress,
    assessedValue: record.assessedValue ? parseFloat(record.assessedValue) : null,
    taxYear: record.taxYear,
    annualTaxes: record.annualTaxes ? parseFloat(record.annualTaxes) : null,
    lastSaleDate: record.lastSaleDate,
    lastSalePrice: record.lastSalePrice ? parseFloat(record.lastSalePrice) : null,
    totalLienAmount: record.totalLienAmount ? parseFloat(record.totalLienAmount) : null,
    zoningCode: record.zoningCode,
  };
}
