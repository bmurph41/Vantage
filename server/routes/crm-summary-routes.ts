import { Router } from 'express';
import { db } from '../db';
import { 
  crmCompanies, crmContacts, crmProperties, crmDeals, 
  crmActivities, crmTimelineEvents, users, crmNotes, projects
} from '@shared/schema';
import { eq, and, or, desc, asc, sql, gte, lt, inArray } from 'drizzle-orm';

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
    
    const [company] = await db
      .select({
        company: companies,
        owner: {
          id: users.id,
          name: users.displayName,
          email: users.email,
        }
      })
      .from(crmCompanies)
      .leftJoin(users, eq(crmCompanies.ownerId, users.id))
      .where(and(
        eq(crmCompanies.id, id),
        eq(crmCompanies.orgId, orgId)
      ))
      .limit(1);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    const [activitySummary, recentTimeline] = await Promise.all([
      getActivitySummary(orgId, 'company', id),
      getRecentTimeline(orgId, 'company', id),
    ]);
    
    const [contactsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmContacts)
      .where(and(
        eq(crmContacts.orgId, orgId),
        eq(crmContacts.companyId, id)
      ));
    
    const [dealsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmDeals)
      .where(and(
        eq(crmDeals.orgId, orgId),
        eq(crmDeals.companyId, id)
      ));
    
    res.json({
      id: company.company.id,
      name: company.company.name,
      industry: company.company.industry,
      website: company.company.website,
      phone: company.company.phone,
      size: company.company.size,
      owner: company.owner,
      activities: activitySummary,
      timeline: recentTimeline,
      associations: {
        contacts: contactsCount?.count || 0,
        deals: dealsCount?.count || 0,
      },
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
    
    const [contact] = await db
      .select({
        contact: contacts,
        owner: {
          id: users.id,
          name: users.displayName,
          email: users.email,
        },
        company: {
          id: crmCompanies.id,
          name: crmCompanies.name,
        }
      })
      .from(crmContacts)
      .leftJoin(users, eq(crmContacts.ownerId, users.id))
      .leftJoin(companies, eq(crmContacts.companyId, crmCompanies.id))
      .where(and(
        eq(crmContacts.id, id),
        eq(crmContacts.orgId, orgId)
      ))
      .limit(1);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    const [activitySummary, recentTimeline] = await Promise.all([
      getActivitySummary(orgId, 'contact', id),
      getRecentTimeline(orgId, 'contact', id),
    ]);
    
    const [dealsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmDeals)
      .where(and(
        eq(crmDeals.orgId, orgId),
        eq(crmDeals.contactId, id)
      ));
    
    res.json({
      id: contact.contact.id,
      firstName: contact.contact.firstName,
      lastName: contact.contact.lastName,
      email: contact.contact.email,
      phone: contact.contact.phone,
      title: contact.contact.title,
      owner: contact.owner,
      company: contact.company,
      activities: activitySummary,
      timeline: recentTimeline,
      associations: {
        deals: dealsCount?.count || 0,
      },
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
    
    const [property] = await db
      .select({
        property: properties,
        owner: {
          id: users.id,
          name: users.displayName,
          email: users.email,
        }
      })
      .from(crmProperties)
      .leftJoin(users, eq(crmProperties.ownerId, users.id))
      .where(and(
        eq(crmProperties.id, id),
        eq(crmProperties.orgId, orgId)
      ))
      .limit(1);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    const [activitySummary, recentTimeline] = await Promise.all([
      getActivitySummary(orgId, 'property', id),
      getRecentTimeline(orgId, 'property', id),
    ]);
    
    const [dealsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmDeals)
      .where(and(
        eq(crmDeals.orgId, orgId),
        eq(crmDeals.propertyId, id)
      ));
    
    res.json({
      id: property.property.id,
      name: property.property.name,
      address: property.property.address,
      city: property.property.city,
      state: property.property.state,
      zipCode: property.property.zipCode,
      propertyType: property.property.propertyType,
      status: property.property.status,
      owner: property.owner,
      activities: activitySummary,
      timeline: recentTimeline,
      associations: {
        deals: dealsCount?.count || 0,
      },
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

export default router;
