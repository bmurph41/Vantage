/**
 * Lease Connect Service
 * =====================
 * Handles copying leases between Operations and Valuator contexts.
 * 
 * Import: Operations → Valuator (deep copy with all sub-resources)
 * Push:   Valuator → Operations (update source lease with changes)
 */

import { eq, and, sql } from "drizzle-orm";
import {
  commercialLeases,
  leaseTerms,
  leaseChargeLines,
  leaseAbatements,
  leaseSales,
  leasePercentRentRules,
  leaseTiPrograms,
  leaseTiDraws,
  leaseRecoveryModels,
  leaseRecoveryCategories,
} from "@shared/commercial-lease-schema";
import type {
  ImportMode,
  ImportFromOperationsResult,
  PushToOperationsResult,
} from "@shared/lease-context-types";

type DB = any;

// ─── Import from Operations into a Valuator Project ──────────────────────────

export async function importFromOperations(
  db: DB,
  orgId: string,
  projectId: string,
  leaseIds: string[],
  mode: ImportMode
): Promise<ImportFromOperationsResult> {
  const results: ImportFromOperationsResult = {
    imported: 0,
    failed: 0,
    errors: [],
    leases: [],
  };

  for (const sourceId of leaseIds) {
    try {
      // 1. Fetch source lease and verify ownership
      const [source] = await db
        .select()
        .from(commercialLeases)
        .where(
          and(
            eq(commercialLeases.id, sourceId),
            eq(commercialLeases.orgId, orgId),
            eq(commercialLeases.leaseContext, "operations")
          )
        );

      if (!source) {
        results.failed++;
        results.errors.push(`Lease ${sourceId} not found or not accessible`);
        continue;
      }

      // 2. Check if already imported (for linked mode)
      if (mode === "linked") {
        const [existing] = await db
          .select({ id: commercialLeases.id })
          .from(commercialLeases)
          .where(
            and(
              eq(commercialLeases.projectId, projectId),
              eq(commercialLeases.sourceLeaseId, sourceId)
            )
          );

        if (existing) {
          results.failed++;
          results.errors.push(
            `${source.tenantName} is already linked to this project`
          );
          continue;
        }
      }

      // 3. Create the copy
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...leaseData } = source;

      const [newLease] = await db
        .insert(commercialLeases)
        .values({
          ...leaseData,
          projectId,
          orgId,
          leaseContext: "valuator",
          sourceLeaseId: mode === "linked" ? sourceId : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // 4. Deep copy all sub-resources
      await copySubResources(db, sourceId, newLease.id);

      results.imported++;
      results.leases.push({
        sourceId,
        newId: newLease.id,
        tenantName: source.tenantName,
      });
    } catch (err: any) {
      results.failed++;
      results.errors.push(`Failed to import ${sourceId}: ${err.message}`);
    }
  }

  return results;
}

// ─── Deep Copy All Sub-Resources ─────────────────────────────────────────────

async function copySubResources(db: DB, sourceLeaseId: string, newLeaseId: string) {
  // Terms
  const terms = await db
    .select()
    .from(leaseTerms)
    .where(eq(leaseTerms.leaseId, sourceLeaseId));

  for (const term of terms) {
    const { id: _id, leaseId: _lid, createdAt: _ca, updatedAt: _ua, ...data } = term;
    await db.insert(leaseTerms).values({
      ...data,
      leaseId: newLeaseId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Charge Lines
  const chargeLines = await db
    .select()
    .from(leaseChargeLines)
    .where(eq(leaseChargeLines.leaseId, sourceLeaseId));

  for (const cl of chargeLines) {
    const { id: _id, leaseId: _lid, createdAt: _ca, updatedAt: _ua, ...data } = cl;
    await db.insert(leaseChargeLines).values({
      ...data,
      leaseId: newLeaseId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Abatements
  const abatements = await db
    .select()
    .from(leaseAbatements)
    .where(eq(leaseAbatements.leaseId, sourceLeaseId));

  for (const ab of abatements) {
    const { id: _id, leaseId: _lid, createdAt: _ca, updatedAt: _ua, ...data } = ab;
    await db.insert(leaseAbatements).values({
      ...data,
      leaseId: newLeaseId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Sales data
  const sales = await db
    .select()
    .from(leaseSales)
    .where(eq(leaseSales.leaseId, sourceLeaseId));

  for (const s of sales) {
    const { id: _id, leaseId: _lid, createdAt: _ca, updatedAt: _ua, ...data } = s;
    await db.insert(leaseSales).values({
      ...data,
      leaseId: newLeaseId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Percent Rent Rules
  const pctRules = await db
    .select()
    .from(leasePercentRentRules)
    .where(eq(leasePercentRentRules.leaseId, sourceLeaseId));

  for (const pr of pctRules) {
    const { id: _id, leaseId: _lid, createdAt: _ca, updatedAt: _ua, ...data } = pr;
    await db.insert(leasePercentRentRules).values({
      ...data,
      leaseId: newLeaseId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // TI Programs + Draws
  const tiPrograms = await db
    .select()
    .from(leaseTiPrograms)
    .where(eq(leaseTiPrograms.leaseId, sourceLeaseId));

  for (const tp of tiPrograms) {
    const { id: oldTpId, leaseId: _lid, createdAt: _ca, updatedAt: _ua, ...tpData } = tp;

    const [newTp] = await db
      .insert(leaseTiPrograms)
      .values({
        ...tpData,
        leaseId: newLeaseId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Copy draws for this TI program
    const draws = await db
      .select()
      .from(leaseTiDraws)
      .where(eq(leaseTiDraws.tiProgramId, oldTpId));

    for (const draw of draws) {
      const { id: _did, tiProgramId: _tpid, createdAt: _dca, updatedAt: _dua, ...drawData } = draw;
      await db.insert(leaseTiDraws).values({
        ...drawData,
        tiProgramId: newTp.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // Recovery Models + Categories
  const recoveryModels = await db
    .select()
    .from(leaseRecoveryModels)
    .where(eq(leaseRecoveryModels.leaseId, sourceLeaseId));

  for (const rm of recoveryModels) {
    const { id: oldRmId, leaseId: _lid, createdAt: _ca, updatedAt: _ua, ...rmData } = rm;

    const [newRm] = await db
      .insert(leaseRecoveryModels)
      .values({
        ...rmData,
        leaseId: newLeaseId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Copy categories for this recovery model
    const cats = await db
      .select()
      .from(leaseRecoveryCategories)
      .where(eq(leaseRecoveryCategories.recoveryModelId, oldRmId));

    for (const cat of cats) {
      const { id: _cid, recoveryModelId: _rmid, createdAt: _cca, updatedAt: _cua, ...catData } = cat;
      await db.insert(leaseRecoveryCategories).values({
        ...catData,
        recoveryModelId: newRm.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}

// ─── Push Valuator Changes Back to Operations ────────────────────────────────

export async function pushToOperations(
  db: DB,
  orgId: string,
  valuatorLeaseId: string
): Promise<PushToOperationsResult> {
  // 1. Get the valuator lease
  const [valLease] = await db
    .select()
    .from(commercialLeases)
    .where(
      and(
        eq(commercialLeases.id, valuatorLeaseId),
        eq(commercialLeases.orgId, orgId),
        eq(commercialLeases.leaseContext, "valuator")
      )
    );

  if (!valLease) {
    throw new Error("Valuator lease not found");
  }

  if (!valLease.sourceLeaseId) {
    throw new Error("This lease is not linked to an Operations lease");
  }

  // 2. Verify source lease exists
  const [sourceLease] = await db
    .select()
    .from(commercialLeases)
    .where(
      and(
        eq(commercialLeases.id, valLease.sourceLeaseId),
        eq(commercialLeases.orgId, orgId),
        eq(commercialLeases.leaseContext, "operations")
      )
    );

  if (!sourceLease) {
    throw new Error("Source Operations lease not found");
  }

  // 3. Determine what changed
  const updatedFields: string[] = [];
  const updates: Record<string, any> = {};

  const fieldsToCompare = [
    "tenantName", "suite", "sf", "leaseType", "units",
    "commencementDate", "expirationDate", "rentCommencementDate",
    "securityDeposit", "fiscalYearEndMonth", "notes", "active",
  ] as const;

  for (const field of fieldsToCompare) {
    if (String(valLease[field]) !== String(sourceLease[field])) {
      updatedFields.push(field);
      updates[field] = valLease[field];
    }
  }

  // 4. Apply updates to source lease
  if (updatedFields.length > 0) {
    updates.updatedAt = new Date();
    await db
      .update(commercialLeases)
      .set(updates)
      .where(eq(commercialLeases.id, sourceLease.id));
  }

  // 5. Sync sub-resources: delete old, copy new
  // (Full replacement — the valuator version is the "approved" state)
  const subTables = [
    leaseTerms,
    leaseChargeLines,
    leaseAbatements,
    leaseSales,
    leasePercentRentRules,
  ];

  for (const table of subTables) {
    await db.delete(table).where(eq((table as any).leaseId, sourceLease.id));
  }

  // Delete TI programs (cascades to draws)
  await db
    .delete(leaseTiPrograms)
    .where(eq(leaseTiPrograms.leaseId, sourceLease.id));

  // Delete recovery models (cascades to categories)
  await db
    .delete(leaseRecoveryModels)
    .where(eq(leaseRecoveryModels.leaseId, sourceLease.id));

  // Copy all sub-resources from valuator to source
  await copySubResources(db, valuatorLeaseId, sourceLease.id);

  return {
    success: true,
    updatedFields,
    sourceLeaseId: sourceLease.id,
  };
}
