/**
 * Demo Seed Service
 *
 * Creates a minimal sample dataset for new organizations so new users
 * have something to explore immediately after signup. Records are
 * identified by the "(Demo)" suffix in their name/title so they can be
 * bulk-deleted later.
 *
 * Seeded records:
 *   1 CRM contact  — "Sample Contact (Demo)"
 *   1 CRM deal     — "Marina Bay Acquisition (Demo)"
 *   1 modeling project — marinaName "Marina Bay Acquisition (Demo)"
 */

import { db } from '../db';
import { crmContacts, crmDeals, modelingProjects } from '@shared/schema';
import { and, eq, like } from 'drizzle-orm';
import { logger } from '../lib/logger';

export const DEMO_MARKER = '(Demo)';

export async function seedDemoData(orgId: string, userId: string): Promise<void> {
  try {
    const [contact] = await db.insert(crmContacts).values({
      orgId,
      firstName: 'Sample',
      lastName: `Contact ${DEMO_MARKER}`,
      email: 'sample@example.com',
      position: 'Marina Owner',
      company: 'Bayside Marina Holdings',
      contactType: 'prospect',
      contactTag: 'seller',
      leadScore: 'warm',
      leadSource: 'referral',
      ownerId: userId,
    }).returning();

    const [deal] = await db.insert(crmDeals).values({
      orgId,
      title: `Marina Bay Acquisition ${DEMO_MARKER}`,
      type: 'marina_acquisition',
      description: 'Sample deal to illustrate the pipeline. Feel free to explore or delete it.',
      stage: 'lead',
      priority: 'medium',
      value: '4500000',
      amount: '4500000',
      assetClass: 'marina',
      marinaName: 'Marina Bay',
      ownerId: userId,
      primaryContactId: contact.id,
    }).returning();

    await db.insert(modelingProjects).values({
      orgId,
      marinaName: `Marina Bay Acquisition ${DEMO_MARKER}`,
      purchasePrice: '4500000',
      year1CapRate: '7.25',
      totalStorageUnits: 120,
      ebitda: '326250',
      dealOutcome: 'active',
      assetClass: 'marina',
      city: 'Clearwater',
      state: 'FL',
      dealId: deal.id,
      createdBy: userId,
    });

    logger.info({ orgId, userId }, '[demo-seed] Sample dataset provisioned');
  } catch (err) {
    logger.warn({ err, orgId }, '[demo-seed] Failed to provision sample dataset (non-fatal)');
  }
}

export async function clearDemoData(orgId: string): Promise<{ deleted: number }> {
  let deleted = 0;

  const marker = `%${DEMO_MARKER}%`;

  const deletedProjects = await db.delete(modelingProjects)
    .where(and(eq(modelingProjects.orgId, orgId), like(modelingProjects.marinaName, marker)))
    .returning({ id: modelingProjects.id });
  deleted += deletedProjects.length;

  const deletedDeals = await db.delete(crmDeals)
    .where(and(eq(crmDeals.orgId, orgId), like(crmDeals.title, marker)))
    .returning({ id: crmDeals.id });
  deleted += deletedDeals.length;

  const deletedContacts = await db.delete(crmContacts)
    .where(and(eq(crmContacts.orgId, orgId), like(crmContacts.lastName, marker)))
    .returning({ id: crmContacts.id });
  deleted += deletedContacts.length;

  logger.info({ orgId, deleted }, '[demo-seed] Demo data cleared');
  return { deleted };
}
