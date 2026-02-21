/**
 * Deal DD Enhancement Routes
 * Endpoints for deal contacts, extensions, deposits, and property address.
 */

import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { dealContacts, dealExtensions, dealDeposits, dealPropertyAddress } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// ============================================================================
// Deal Contacts
// ============================================================================

router.get("/crm/deals/:dealId/deal-contacts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contacts = await db.select().from(dealContacts).where(eq(dealContacts.dealId, req.params.dealId));
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

router.put("/crm/deals/:dealId/deal-contacts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const contacts = req.body;

    // Delete existing and replace
    await db.delete(dealContacts).where(eq(dealContacts.dealId, dealId));

    if (contacts && contacts.length > 0) {
      const values = contacts.map((c: any, i: number) => ({
        dealId,
        contactId: c.contactId || null,
        firstName: c.firstName || null,
        lastName: c.lastName || null,
        company: c.company || null,
        titleRole: c.titleRole || null,
        phone: c.phone || null,
        email: c.email || null,
        contactType: c.contactType || "other",
        teamType: c.teamType || "mutual",
        isPrimary: c.isPrimary || false,
        displayOrder: i,
      }));
      const result = await db.insert(dealContacts).values(values).returning();
      res.json(result);
    } else {
      res.json([]);
    }
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Deal Extensions
// ============================================================================

router.get("/crm/deals/:dealId/extensions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const extensions = await db.select().from(dealExtensions).where(eq(dealExtensions.dealId, req.params.dealId));
    res.json(extensions);
  } catch (error) {
    next(error);
  }
});

router.put("/crm/deals/:dealId/extensions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const extensions = req.body;

    await db.delete(dealExtensions).where(eq(dealExtensions.dealId, dealId));

    if (extensions && extensions.length > 0) {
      const values = extensions.map((ext: any, i: number) => ({
        dealId,
        extensionNumber: i + 1,
        days: ext.days || 0,
        executed: ext.executed || false,
        executedDate: ext.executedDate || null,
        basedOnEvent: ext.basedOnEvent || "dd_expiration",
        notes: ext.notes || null,
        displayOrder: i,
      }));
      const result = await db.insert(dealExtensions).values(values).returning();
      res.json(result);
    } else {
      res.json([]);
    }
  } catch (error) {
    next(error);
  }
});

router.post("/crm/deals/extensions/:extensionId/execute", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.update(dealExtensions)
      .set({ executed: true, executedDate: new Date(), updatedAt: new Date() })
      .where(eq(dealExtensions.id, req.params.extensionId))
      .returning();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Deal Deposits
// ============================================================================

router.get("/crm/deals/:dealId/deposits", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deposits = await db.select().from(dealDeposits).where(eq(dealDeposits.dealId, req.params.dealId));
    res.json(deposits);
  } catch (error) {
    next(error);
  }
});

router.put("/crm/deals/:dealId/deposits", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const deposits = req.body;

    await db.delete(dealDeposits).where(eq(dealDeposits.dealId, dealId));

    if (deposits && deposits.length > 0) {
      const values = deposits.map((dep: any, i: number) => ({
        dealId,
        depositNumber: i + 1,
        amount: (dep.amount || 0).toString(),
        anchorEvent: dep.anchorEvent || "psa_signed",
        daysOffset: dep.daysOffset || 0,
        dayType: dep.dayType || "calendar",
        refundable: dep.refundable !== undefined ? dep.refundable : true,
        appliedToPrice: dep.appliedToPrice !== undefined ? dep.appliedToPrice : true,
        notes: dep.notes || null,
        displayOrder: i,
      }));
      const result = await db.insert(dealDeposits).values(values).returning();
      res.json(result);
    } else {
      res.json([]);
    }
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// Deal Property Address
// ============================================================================

router.get("/crm/deals/:dealId/property-address", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [address] = await db.select().from(dealPropertyAddress).where(eq(dealPropertyAddress.dealId, req.params.dealId));
    res.json(address || null);
  } catch (error) {
    next(error);
  }
});

router.put("/crm/deals/:dealId/property-address", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const addr = req.body;

    // Check if exists
    const [existing] = await db.select().from(dealPropertyAddress).where(eq(dealPropertyAddress.dealId, dealId));

    if (existing) {
      const result = await db.update(dealPropertyAddress)
        .set({
          street: addr.street || null,
          city: addr.city || null,
          state: addr.state || null,
          zip: addr.zip || null,
          lat: addr.lat?.toString() || null,
          lng: addr.lng?.toString() || null,
          fullAddress: addr.fullAddress || null,
          linkedToModel: addr.linkedToModel || false,
          modelId: addr.modelId || null,
          updatedAt: new Date(),
        })
        .where(eq(dealPropertyAddress.dealId, dealId))
        .returning();
      res.json(result[0]);
    } else {
      const result = await db.insert(dealPropertyAddress).values({
        dealId,
        street: addr.street || null,
        city: addr.city || null,
        state: addr.state || null,
        zip: addr.zip || null,
        lat: addr.lat?.toString() || null,
        lng: addr.lng?.toString() || null,
        fullAddress: addr.fullAddress || null,
        linkedToModel: addr.linkedToModel || false,
        modelId: addr.modelId || null,
      }).returning();
      res.json(result[0]);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
