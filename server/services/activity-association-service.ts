import { db } from '../db';
import { crmActivityAssociations, crmContactCompanies, crmCompanyProperties, crmContactProperties, crmDeals } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

interface AssociationTarget {
  objectType: string;
  objectId: string;
  isPrimary: boolean;
}

export async function associateActivity(
  activityId: string,
  originObjectType: string,
  originObjectId: string,
  orgId: string
): Promise<AssociationTarget[]> {
  const targets: AssociationTarget[] = [];
  const seen = new Set<string>();

  const addTarget = (objectType: string, objectId: string, isPrimary: boolean) => {
    const key = `${objectType}:${objectId}`;
    if (!seen.has(key)) {
      seen.add(key);
      targets.push({ objectType, objectId, isPrimary });
    }
  };

  addTarget(originObjectType, originObjectId, true);

  try {
    if (originObjectType === 'contact') {
      const companies = await db.select({
        companyId: crmContactCompanies.companyId,
        isPrimary: crmContactCompanies.isPrimary,
      }).from(crmContactCompanies).where(
        and(eq(crmContactCompanies.contactId, originObjectId), eq(crmContactCompanies.orgId, orgId))
      );
      for (const c of companies) {
        addTarget('company', c.companyId, false);
      }

      const deals = await db.select({
        id: crmDeals.id,
      }).from(crmDeals).where(
        and(
          eq(crmDeals.orgId, orgId),
          eq(crmDeals.contactId, originObjectId),
          inArray(crmDeals.stage, ['lead', 'qualifying', 'proposal', 'negotiation', 'due_diligence', 'under_contract'])
        )
      );
      for (const d of deals) {
        addTarget('deal', d.id, false);
      }
    } else if (originObjectType === 'company') {
      const contacts = await db.select({
        contactId: crmContactCompanies.contactId,
        isPrimary: crmContactCompanies.isPrimary,
      }).from(crmContactCompanies).where(
        and(eq(crmContactCompanies.companyId, originObjectId), eq(crmContactCompanies.orgId, orgId))
      );
      for (const c of contacts) {
        if (c.isPrimary) {
          addTarget('contact', c.contactId, false);
        }
      }

      const deals = await db.select({
        id: crmDeals.id,
      }).from(crmDeals).where(
        and(
          eq(crmDeals.orgId, orgId),
          eq(crmDeals.companyId, originObjectId),
          inArray(crmDeals.stage, ['lead', 'qualifying', 'proposal', 'negotiation', 'due_diligence', 'under_contract'])
        )
      );
      for (const d of deals) {
        addTarget('deal', d.id, false);
      }

      const properties = await db.select({
        propertyId: crmCompanyProperties.propertyId,
      }).from(crmCompanyProperties).where(
        and(eq(crmCompanyProperties.companyId, originObjectId), eq(crmCompanyProperties.orgId, orgId))
      );
      for (const p of properties) {
        addTarget('property', p.propertyId, false);
      }
    } else if (originObjectType === 'property') {
      const companies = await db.select({
        companyId: crmCompanyProperties.companyId,
      }).from(crmCompanyProperties).where(
        and(eq(crmCompanyProperties.propertyId, originObjectId), eq(crmCompanyProperties.orgId, orgId))
      );
      for (const c of companies) {
        addTarget('company', c.companyId, false);
      }
    } else if (originObjectType === 'lead') {
      // When an activity is logged on a lead, auto-associate with its contact/company if converted
      try {
        const { crmLeads } = await import('@shared/schema');
        const leadResults = await db
          .select({ primaryContactId: crmLeads.primaryContactId, accountId: crmLeads.accountId })
          .from(crmLeads)
          .where(and(eq(crmLeads.id, originObjectId), eq(crmLeads.orgId, orgId)));
        const lead = leadResults[0];
        if (lead?.primaryContactId) addTarget('contact', lead.primaryContactId, false);
        if (lead?.accountId) addTarget('company', lead.accountId, false);
      } catch (leadErr) {
        // Schema mismatch or table doesn't exist — non-fatal
      }
    } else if (originObjectType === 'deal') {
      const [deal] = await db.select({
        contactId: crmDeals.contactId,
        companyId: crmDeals.companyId,
      }).from(crmDeals).where(
        and(eq(crmDeals.id, originObjectId), eq(crmDeals.orgId, orgId))
      );
      if (deal) {
        if (deal.contactId) addTarget('contact', deal.contactId, false);
        if (deal.companyId) addTarget('company', deal.companyId, false);
      }
    }
  } catch (err) {
    console.error('Auto-association expansion failed (non-fatal):', err);
  }

  if (targets.length > 0) {
    try {
      await db.insert(crmActivityAssociations).values(
        targets.map(t => ({
          activityId,
          objectType: t.objectType,
          objectId: t.objectId,
          isPrimary: t.isPrimary,
          orgId,
        }))
      ).onConflictDoNothing();
    } catch (err) {
      console.error('Failed to insert activity associations:', err);
    }
  }

  return targets;
}
