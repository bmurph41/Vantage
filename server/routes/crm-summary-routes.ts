import { Router } from 'express';
import { db } from '../db';
import { 
  crmCompanies, crmContacts, crmProperties, crmDeals, 
  crmActivities, crmTimelineEvents, users, crmNotes, projects,
  crmContactCompanies, crmCompanyProperties, crmContactProperties,
  crmPropertyStorageEntries
} from '@shared/schema';
import { eq, and, or, ilike, desc, asc, sql, gte, lt, inArray } from 'drizzle-orm';

const router = Router();

async function getActivitySummary(orgId: string, entityType: string, entityId: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let entityCondition;
  switch (entityType) {
    case 'company':
      entityCondition = eq(crmActivities.companyId, entityId);
      break;
    case 'contact':
      entityCondition = eq(crmActivities.contactId, entityId);
      break;
    case 'property':
      entityCondition = eq(crmActivities.propertyId, entityId);
      break;
    case 'deal':
      entityCondition = eq(crmActivities.dealId, entityId);
      break;
    default:
      entityCondition = and(
        eq(crmActivities.entityType, entityType),
        eq(crmActivities.entityId, entityId)
      );
  }
  
  const [openCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(crmActivities)
    .where(and(
      eq(crmActivities.orgId, orgId),
      entityCondition,
      or(
        eq(crmActivities.status, 'scheduled'),
        eq(crmActivities.status, 'in_progress')
      )
    ));
  
  const [overdueCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(crmActivities)
    .where(and(
      eq(crmActivities.orgId, orgId),
      entityCondition,
      or(
        eq(crmActivities.status, 'scheduled'),
        eq(crmActivities.status, 'in_progress')
      ),
      lt(crmActivities.scheduledAt, startOfToday)
    ));
  
  const [nextActivity] = await db
    .select({
      id: crmActivities.id,
      subject: crmActivities.subject,
      type: crmActivities.type,
      scheduledAt: crmActivities.scheduledAt,
      status: crmActivities.status,
    })
    .from(crmActivities)
    .where(and(
      eq(crmActivities.orgId, orgId),
      entityCondition,
      or(
        eq(crmActivities.status, 'scheduled'),
        eq(crmActivities.status, 'in_progress')
      ),
      gte(crmActivities.scheduledAt, new Date())
    ))
    .orderBy(asc(crmActivities.scheduledAt))
    .limit(1);
  
  return {
    openCount: openCount?.count || 0,
    overdueCount: overdueCount?.count || 0,
    nextActivity: nextActivity || null,
  };
}

async function getEntityRollups(orgId: string, entityType: string, entityId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let entityCondition;
  switch (entityType) {
    case 'company':
      entityCondition = and(
        eq(crmActivities.entityType, 'company'),
        eq(crmActivities.entityId, entityId)
      );
      break;
    case 'contact':
      entityCondition = and(
        eq(crmActivities.entityType, 'contact'),
        eq(crmActivities.entityId, entityId)
      );
      break;
    case 'property':
      entityCondition = and(
        eq(crmActivities.entityType, 'property'),
        eq(crmActivities.entityId, entityId)
      );
      break;
    default:
      entityCondition = and(
        eq(crmActivities.entityType, entityType),
        eq(crmActivities.entityId, entityId)
      );
  }

  const [lastActivity] = await db
    .select({ lastAt: sql<string>`max(${crmActivities.createdAt})` })
    .from(crmActivities)
    .where(and(eq(crmActivities.orgId, orgId), entityCondition));

  const [nextScheduled] = await db
    .select({
      nextAt: sql<string>`min(${crmActivities.scheduledAt})`,
    })
    .from(crmActivities)
    .where(and(
      eq(crmActivities.orgId, orgId),
      entityCondition,
      eq(crmActivities.status, 'scheduled'),
      gte(crmActivities.scheduledAt, now)
    ));

  const [engagement30d] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(crmActivities)
    .where(and(
      eq(crmActivities.orgId, orgId),
      entityCondition,
      gte(crmActivities.createdAt, thirtyDaysAgo)
    ));

  let openDealsCount = 0;
  let pipelineValue = 0;

  const activeStages = ['lead', 'qualifying', 'proposal', 'negotiation', 'due_diligence', 'under_contract'];

  if (entityType === 'contact') {
    const deals = await db.select({
      count: sql<number>`count(*)::int`,
      totalValue: sql<string>`coalesce(sum(cast(${crmDeals.value} as numeric)), 0)`,
    }).from(crmDeals).where(and(
      eq(crmDeals.orgId, orgId),
      eq(crmDeals.contactId, entityId),
      inArray(crmDeals.stage, activeStages)
    ));
    openDealsCount = deals[0]?.count || 0;
    pipelineValue = parseFloat(deals[0]?.totalValue || '0');
  } else if (entityType === 'company') {
    const deals = await db.select({
      count: sql<number>`count(*)::int`,
      totalValue: sql<string>`coalesce(sum(cast(${crmDeals.value} as numeric)), 0)`,
    }).from(crmDeals).where(and(
      eq(crmDeals.orgId, orgId),
      eq(crmDeals.companyId, entityId),
      inArray(crmDeals.stage, activeStages)
    ));
    openDealsCount = deals[0]?.count || 0;
    pipelineValue = parseFloat(deals[0]?.totalValue || '0');
  }

  return {
    lastActivityAt: lastActivity?.lastAt || null,
    nextActivityAt: nextScheduled?.nextAt || null,
    openDealsCount,
    pipelineValue,
    engagementScore30d: engagement30d?.count || 0,
  };
}

async function getRecentTimeline(orgId: string, entityType: string, entityId: string, limit: number = 3) {
  let entityCondition;
  switch (entityType) {
    case 'company':
      entityCondition = eq(crmTimelineEvents.companyId, entityId);
      break;
    case 'contact':
      entityCondition = eq(crmTimelineEvents.contactId, entityId);
      break;
    case 'property':
      entityCondition = eq(crmTimelineEvents.propertyId, entityId);
      break;
    case 'deal':
      entityCondition = eq(crmTimelineEvents.dealId, entityId);
      break;
    default:
      entityCondition = and(
        eq(crmTimelineEvents.entityType, entityType),
        eq(crmTimelineEvents.entityId, entityId)
      );
  }
  
  const events = await db
    .select({
      id: crmTimelineEvents.id,
      eventType: crmTimelineEvents.eventType,
      title: crmTimelineEvents.title,
      description: crmTimelineEvents.description,
      createdAt: crmTimelineEvents.createdAt,
      actor: {
        id: users.id,
        name: users.displayName,
      }
    })
    .from(crmTimelineEvents)
    .leftJoin(users, eq(crmTimelineEvents.actorId, users.id))
    .where(and(
      eq(crmTimelineEvents.orgId, orgId),
      entityCondition
    ))
    .orderBy(desc(crmTimelineEvents.createdAt))
    .limit(limit);
  
  return events;
}

router.get('/companies/:id/summary', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const [companyRow] = await db
      .select()
      .from(crmCompanies)
      .where(and(eq(crmCompanies.id, id), eq(crmCompanies.orgId, orgId)))
      .limit(1);
    
    if (!companyRow) {
      return res.status(404).json({ error: 'Company not found' });
    }

    let owner = null;
    if (companyRow.ownerId) {
      const [ownerRow] = await db
        .select({ id: users.id, name: users.displayName, email: users.email })
        .from(users).where(eq(users.id, companyRow.ownerId)).limit(1);
      owner = ownerRow || null;
    }

    const [activitySummary, recentTimeline, contacts, properties, deals, recentActivities, notes, rollups] = await Promise.all([
      getActivitySummary(orgId, 'company', id),
      getRecentTimeline(orgId, 'company', id, 10),
      db.select({
        id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName,
        email: crmContacts.email, phone: crmContacts.phone, position: crmContacts.position,
        role: crmContactCompanies.role, isPrimary: crmContactCompanies.isPrimary,
        contactTag: crmContacts.contactTag, leadStatus: crmContacts.leadStatus,
      }).from(crmContactCompanies)
        .innerJoin(crmContacts, eq(crmContactCompanies.contactId, crmContacts.id))
        .where(eq(crmContactCompanies.companyId, id)),
      db.select({
        id: crmProperties.id, title: crmProperties.title, type: crmProperties.type,
        status: crmProperties.status, city: crmProperties.city, state: crmProperties.state,
        listingPrice: crmProperties.listingPrice, wetSlips: crmProperties.wetSlips,
        relationship: crmCompanyProperties.relationship,
      }).from(crmCompanyProperties)
        .innerJoin(crmProperties, eq(crmCompanyProperties.propertyId, crmProperties.id))
        .where(eq(crmCompanyProperties.companyId, id)),
      db.select({
        id: crmDeals.id, name: crmDeals.name, value: crmDeals.value,
        stage: crmDeals.stage, probability: crmDeals.probability,
        expectedCloseDate: crmDeals.expectedCloseDate,
      }).from(crmDeals)
        .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.companyId, id)))
        .orderBy(desc(crmDeals.updatedAt)).limit(10),
      db.select({
        id: crmActivities.id, type: crmActivities.type, subject: crmActivities.subject,
        status: crmActivities.status, scheduledAt: crmActivities.scheduledAt,
        completedAt: crmActivities.completedAt,
      }).from(crmActivities)
        .where(and(eq(crmActivities.orgId, orgId), eq(crmActivities.companyId, id)))
        .orderBy(desc(crmActivities.createdAt)).limit(5),
      db.select({
        id: crmNotes.id, content: crmNotes.content, createdAt: crmNotes.createdAt,
      }).from(crmNotes)
        .where(and(eq(crmNotes.orgId, orgId), eq(crmNotes.entityType, 'company'), eq(crmNotes.entityId, id)))
        .orderBy(desc(crmNotes.createdAt)).limit(5),
      getEntityRollups(orgId, 'company', id),
    ]);
    
    res.json({
      ...companyRow,
      owner,
      activities: activitySummary,
      timeline: recentTimeline,
      contacts,
      properties,
      deals,
      recentActivities,
      notes,
      rollups,
    });
  } catch (error) {
    console.error('Error fetching company summary:', error);
    res.status(500).json({ error: 'Failed to fetch company summary' });
  }
});

router.get('/contacts/:id/summary', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const [contactRow] = await db
      .select()
      .from(crmContacts)
      .where(and(
        eq(crmContacts.id, id),
        eq(crmContacts.orgId, orgId)
      ))
      .limit(1);
    
    if (!contactRow) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    let owner = null;
    if (contactRow.ownerId) {
      const [ownerRow] = await db
        .select({ id: users.id, name: users.displayName, email: users.email })
        .from(users).where(eq(users.id, contactRow.ownerId)).limit(1);
      owner = ownerRow || null;
    }

    let primaryCompany = null;
    if (contactRow.companyId) {
      const [compRow] = await db
        .select({ id: crmCompanies.id, name: crmCompanies.name, industry: crmCompanies.industry })
        .from(crmCompanies).where(eq(crmCompanies.id, contactRow.companyId)).limit(1);
      primaryCompany = compRow || null;
    }

    const [activitySummary, recentTimeline, companies, properties, deals, recentActivities, notes, rollups] = await Promise.all([
      getActivitySummary(orgId, 'contact', id),
      getRecentTimeline(orgId, 'contact', id, 10),
      db.select({
        id: crmCompanies.id, name: crmCompanies.name, industry: crmCompanies.industry,
        role: crmContactCompanies.role, isPrimary: crmContactCompanies.isPrimary,
      }).from(crmContactCompanies)
        .innerJoin(crmCompanies, eq(crmContactCompanies.companyId, crmCompanies.id))
        .where(eq(crmContactCompanies.contactId, id)),
      db.select({
        id: crmProperties.id, title: crmProperties.title, type: crmProperties.type,
        status: crmProperties.status, city: crmProperties.city, state: crmProperties.state,
        relationship: crmContactProperties.relationship,
      }).from(crmContactProperties)
        .innerJoin(crmProperties, eq(crmContactProperties.propertyId, crmProperties.id))
        .where(eq(crmContactProperties.contactId, id)),
      db.select({
        id: crmDeals.id, name: crmDeals.name, value: crmDeals.value,
        stage: crmDeals.stage, probability: crmDeals.probability,
        expectedCloseDate: crmDeals.expectedCloseDate,
      }).from(crmDeals)
        .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.contactId, id)))
        .orderBy(desc(crmDeals.updatedAt)).limit(10),
      db.select({
        id: crmActivities.id, type: crmActivities.type, subject: crmActivities.subject,
        status: crmActivities.status, scheduledAt: crmActivities.scheduledAt,
        completedAt: crmActivities.completedAt, notes: crmActivities.notes,
      }).from(crmActivities)
        .where(and(eq(crmActivities.orgId, orgId), eq(crmActivities.contactId, id)))
        .orderBy(desc(crmActivities.createdAt)).limit(5),
      db.select({
        id: crmNotes.id, content: crmNotes.content, createdAt: crmNotes.createdAt,
      }).from(crmNotes)
        .where(and(eq(crmNotes.orgId, orgId), eq(crmNotes.entityType, 'contact'), eq(crmNotes.entityId, id)))
        .orderBy(desc(crmNotes.createdAt)).limit(5),
      getEntityRollups(orgId, 'contact', id),
    ]);
    
    res.json({
      ...contactRow,
      owner,
      primaryCompany,
      activities: activitySummary,
      timeline: recentTimeline,
      companies,
      properties,
      deals,
      recentActivities,
      notes,
      rollups,
    });
  } catch (error) {
    console.error('Error fetching contact summary:', error);
    res.status(500).json({ error: 'Failed to fetch contact summary' });
  }
});

router.get('/properties/:id/summary', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const [propertyRow] = await db
      .select()
      .from(crmProperties)
      .where(and(eq(crmProperties.id, id), eq(crmProperties.orgId, orgId)))
      .limit(1);
    
    if (!propertyRow) {
      return res.status(404).json({ error: 'Property not found' });
    }

    let owner = null;
    if (propertyRow.ownerId) {
      const [ownerRow] = await db
        .select({ id: users.id, name: users.displayName, email: users.email })
        .from(users).where(eq(users.id, propertyRow.ownerId)).limit(1);
      owner = ownerRow || null;
    }

    let brokerContact = null;
    if (propertyRow.brokerContactId) {
      const [bc] = await db
        .select({ id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName, email: crmContacts.email, phone: crmContacts.phone })
        .from(crmContacts).where(eq(crmContacts.id, propertyRow.brokerContactId)).limit(1);
      brokerContact = bc || null;
    }

    let ownerCompany = null;
    if (propertyRow.ownerCompanyId) {
      const [oc] = await db
        .select({ id: crmCompanies.id, name: crmCompanies.name, industry: crmCompanies.industry })
        .from(crmCompanies).where(eq(crmCompanies.id, propertyRow.ownerCompanyId)).limit(1);
      ownerCompany = oc || null;
    }

    let listingAgent = null;
    if (propertyRow.listingAgentId) {
      const [la] = await db
        .select({ id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName, email: crmContacts.email, phone: crmContacts.phone })
        .from(crmContacts).where(eq(crmContacts.id, propertyRow.listingAgentId)).limit(1);
      listingAgent = la || null;
    }

    const [activitySummary, recentTimeline, companies, contacts, deals, storageEntries, recentActivities, notes, rollups] = await Promise.all([
      getActivitySummary(orgId, 'property', id),
      getRecentTimeline(orgId, 'property', id, 10),
      db.select({
        id: crmCompanies.id, name: crmCompanies.name, industry: crmCompanies.industry,
        relationship: crmCompanyProperties.relationship,
      }).from(crmCompanyProperties)
        .innerJoin(crmCompanies, eq(crmCompanyProperties.companyId, crmCompanies.id))
        .where(eq(crmCompanyProperties.propertyId, id)),
      db.select({
        id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName,
        email: crmContacts.email, phone: crmContacts.phone, position: crmContacts.position,
        contactTag: crmContacts.contactTag, relationship: crmContactProperties.relationship,
      }).from(crmContactProperties)
        .innerJoin(crmContacts, eq(crmContactProperties.contactId, crmContacts.id))
        .where(eq(crmContactProperties.propertyId, id)),
      db.select({
        id: crmDeals.id, name: crmDeals.name, value: crmDeals.value,
        stage: crmDeals.stage, probability: crmDeals.probability,
        expectedCloseDate: crmDeals.expectedCloseDate,
      }).from(crmDeals)
        .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.propertyId, id)))
        .orderBy(desc(crmDeals.updatedAt)).limit(10),
      db.select({
        id: crmPropertyStorageEntries.id,
        storageTypeName: crmPropertyStorageEntries.storageTypeName,
        capacity: crmPropertyStorageEntries.capacity,
        occupied: crmPropertyStorageEntries.occupied,
        rate: crmPropertyStorageEntries.rate,
        rateType: crmPropertyStorageEntries.rateType,
      }).from(crmPropertyStorageEntries)
        .where(eq(crmPropertyStorageEntries.propertyId, id)),
      db.select({
        id: crmActivities.id, type: crmActivities.type, subject: crmActivities.subject,
        status: crmActivities.status, scheduledAt: crmActivities.scheduledAt,
        completedAt: crmActivities.completedAt,
      }).from(crmActivities)
        .where(and(eq(crmActivities.orgId, orgId), eq(crmActivities.propertyId, id)))
        .orderBy(desc(crmActivities.createdAt)).limit(5),
      db.select({
        id: crmNotes.id, content: crmNotes.content, createdAt: crmNotes.createdAt,
      }).from(crmNotes)
        .where(and(eq(crmNotes.orgId, orgId), eq(crmNotes.entityType, 'property'), eq(crmNotes.entityId, id)))
        .orderBy(desc(crmNotes.createdAt)).limit(5),
      getEntityRollups(orgId, 'property', id),
    ]);
    
    res.json({
      ...propertyRow,
      owner,
      brokerContact,
      ownerCompany,
      listingAgent,
      activities: activitySummary,
      timeline: recentTimeline,
      companies,
      contacts,
      deals,
      storageEntries,
      recentActivities,
      notes,
      rollups,
    });
  } catch (error) {
    console.error('Error fetching property summary:', error);
    res.status(500).json({ error: 'Failed to fetch property summary' });
  }
});

router.get('/deals/:id/summary', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { id } = req.params;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const [deal] = await db
      .select({
        deal: crmDeals,
        owner: {
          id: users.id,
          name: users.displayName,
          email: users.email,
        }
      })
      .from(crmDeals)
      .leftJoin(users, eq(crmDeals.ownerId, users.id))
      .where(and(
        eq(crmDeals.id, id),
        eq(crmDeals.orgId, orgId)
      ))
      .limit(1);
    
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    const [activitySummary, recentTimeline] = await Promise.all([
      getActivitySummary(orgId, 'deal', id),
      getRecentTimeline(orgId, 'deal', id),
    ]);
    
    let company = null;
    if (deal.deal.companyId) {
      const [companyData] = await db
        .select({ id: crmCompanies.id, name: crmCompanies.name })
        .from(crmCompanies)
        .where(eq(crmCompanies.id, deal.deal.companyId))
        .limit(1);
      company = companyData || null;
    }
    
    let contact = null;
    if (deal.deal.contactId) {
      const [contactData] = await db
        .select({ 
          id: crmContacts.id, 
          firstName: crmContacts.firstName,
          lastName: crmContacts.lastName,
        })
        .from(crmContacts)
        .where(eq(crmContacts.id, deal.deal.contactId))
        .limit(1);
      contact = contactData || null;
    }
    
    let property = null;
    if (deal.deal.propertyId) {
      const [propertyData] = await db
        .select({ id: crmProperties.id, name: crmProperties.name })
        .from(crmProperties)
        .where(eq(crmProperties.id, deal.deal.propertyId))
        .limit(1);
      property = propertyData || null;
    }
    
    res.json({
      id: deal.deal.id,
      name: deal.deal.name,
      value: deal.deal.value,
      stage: deal.deal.stage,
      probability: deal.deal.probability,
      expectedCloseDate: deal.deal.expectedCloseDate,
      owner: deal.owner,
      activities: activitySummary,
      timeline: recentTimeline,
      associations: {
        company,
        contact,
        property,
      },
    });
  } catch (error) {
    console.error('Error fetching deal summary:', error);
    res.status(500).json({ error: 'Failed to fetch deal summary' });
  }
});


// ── Global CRM Search ─────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const q = (req.query.q as string || '').trim();
    if (!q || q.length < 2) return res.json({ contacts: [], companies: [], properties: [], deals: [] });

    const pattern = `%${q}%`;
    const limit = 5;

    const [contacts, companies, properties, deals] = await Promise.all([
      db.select({
        id: crmContacts.id,
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
        email: crmContacts.email,
        position: crmContacts.position,
        contactTag: crmContacts.contactTag,
      }).from(crmContacts)
        .where(and(
          eq(crmContacts.orgId, orgId),
          or(
            ilike(crmContacts.firstName, pattern),
            ilike(crmContacts.lastName, pattern),
            ilike(crmContacts.email, pattern),
            ilike(sql`coalesce(${crmContacts.company}, '')`, pattern),
          )
        )).limit(limit),

      db.select({
        id: crmCompanies.id,
        name: crmCompanies.name,
        industry: crmCompanies.industry,
        city: crmCompanies.city,
        state: crmCompanies.state,
      }).from(crmCompanies)
        .where(and(
          eq(crmCompanies.orgId, orgId),
          or(
            ilike(crmCompanies.name, pattern),
            ilike(sql`coalesce(${crmCompanies.city}, '')`, pattern),
          )
        )).limit(limit),

      db.select({
        id: crmProperties.id,
        title: crmProperties.title,
        type: crmProperties.type,
        status: crmProperties.status,
        city: crmProperties.city,
        state: crmProperties.state,
      }).from(crmProperties)
        .where(and(
          eq(crmProperties.orgId, orgId),
          or(
            ilike(crmProperties.title, pattern),
            ilike(sql`coalesce(${crmProperties.city}, '')`, pattern),
            ilike(sql`coalesce(${crmProperties.address}, '')`, pattern),
          )
        )).limit(limit),

      db.select({
        id: crmDeals.id,
        name: crmDeals.title,
        stage: crmDeals.stage,
        value: crmDeals.value,
      }).from(crmDeals)
        .where(and(
          eq(crmDeals.orgId, orgId),
          or(
            ilike(crmDeals.title, pattern),
            ilike(sql`coalesce(${crmDeals.marinaName}, '')`, pattern),
          )
        )).limit(limit),
    ]);

    res.json({
      contacts: contacts.map(c => ({ ...c, _type: 'contact', label: `${c.firstName} ${c.lastName}`, sub: c.email })),
      companies: companies.map(c => ({ ...c, _type: 'company', label: c.name, sub: [c.city, c.state].filter(Boolean).join(', ') })),
      properties: properties.map(p => ({ ...p, _type: 'property', label: p.title, sub: [p.city, p.state].filter(Boolean).join(', ') })),
      deals: deals.map(d => ({ ...d, _type: 'deal', label: d.name, sub: d.stage })),
    });
  } catch (error) {
    console.error('Error in CRM search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
