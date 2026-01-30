import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { crmAssociations, companies, contacts, properties, crmDeals, projects, users } from '@shared/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { createTimelineEvent } from '../services/timeline-event-service';

const router = Router();

const associationTypeSchema = z.enum([
  'company_contact',
  'company_property',
  'company_deal',
  'contact_deal',
  'contact_property',
  'property_deal',
  'deal_project',
]);

const createAssociationSchema = z.object({
  associationType: associationTypeSchema,
  sourceEntityType: z.string(),
  sourceEntityId: z.string(),
  targetEntityType: z.string(),
  targetEntityId: z.string(),
  metadata: z.record(z.any()).optional(),
});

router.get('/', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const entityType = req.query.entityType as string;
    const entityId = req.query.entityId as string;
    
    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required' });
    }
    
    const associations = await db
      .select({
        id: crmAssociations.id,
        associationType: crmAssociations.associationType,
        sourceEntityType: crmAssociations.sourceEntityType,
        sourceEntityId: crmAssociations.sourceEntityId,
        targetEntityType: crmAssociations.targetEntityType,
        targetEntityId: crmAssociations.targetEntityId,
        metadata: crmAssociations.metadata,
        createdAt: crmAssociations.createdAt,
        createdBy: {
          id: users.id,
          name: users.displayName,
        }
      })
      .from(crmAssociations)
      .leftJoin(users, eq(crmAssociations.createdById, users.id))
      .where(and(
        eq(crmAssociations.orgId, orgId),
        or(
          and(
            eq(crmAssociations.sourceEntityType, entityType),
            eq(crmAssociations.sourceEntityId, entityId)
          ),
          and(
            eq(crmAssociations.targetEntityType, entityType),
            eq(crmAssociations.targetEntityId, entityId)
          )
        )
      ))
      .orderBy(desc(crmAssociations.createdAt));
    
    res.json(associations);
  } catch (error) {
    console.error('Error fetching associations:', error);
    res.status(500).json({ error: 'Failed to fetch associations' });
  }
});

router.get('/:entityType/:entityId/linked', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const { entityType, entityId } = req.params;
    const targetType = req.query.targetType as string;
    
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const associations = await db
      .select()
      .from(crmAssociations)
      .where(and(
        eq(crmAssociations.orgId, orgId),
        or(
          and(
            eq(crmAssociations.sourceEntityType, entityType),
            eq(crmAssociations.sourceEntityId, entityId)
          ),
          and(
            eq(crmAssociations.targetEntityType, entityType),
            eq(crmAssociations.targetEntityId, entityId)
          )
        )
      ));
    
    const linkedEntities: any[] = [];
    
    for (const assoc of associations) {
      const isSource = assoc.sourceEntityType === entityType && assoc.sourceEntityId === entityId;
      const linkedType = isSource ? assoc.targetEntityType : assoc.sourceEntityType;
      const linkedId = isSource ? assoc.targetEntityId : assoc.sourceEntityId;
      
      if (targetType && linkedType !== targetType) continue;
      
      let entity = null;
      
      switch (linkedType) {
        case 'company':
          const [company] = await db
            .select({ id: companies.id, name: companies.name, industry: companies.industry })
            .from(companies)
            .where(eq(companies.id, linkedId))
            .limit(1);
          entity = company ? { ...company, entityType: 'company' } : null;
          break;
        case 'contact':
          const [contact] = await db
            .select({ 
              id: contacts.id, 
              firstName: contacts.firstName, 
              lastName: contacts.lastName,
              email: contacts.email 
            })
            .from(contacts)
            .where(eq(contacts.id, linkedId))
            .limit(1);
          entity = contact ? { 
            ...contact, 
            name: `${contact.firstName} ${contact.lastName}`,
            entityType: 'contact' 
          } : null;
          break;
        case 'property':
          const [property] = await db
            .select({ id: properties.id, name: properties.name, address: properties.address })
            .from(properties)
            .where(eq(properties.id, linkedId))
            .limit(1);
          entity = property ? { ...property, entityType: 'property' } : null;
          break;
        case 'deal':
          const [deal] = await db
            .select({ id: crmDeals.id, name: crmDeals.name, value: crmDeals.value, stage: crmDeals.stage })
            .from(crmDeals)
            .where(eq(crmDeals.id, linkedId))
            .limit(1);
          entity = deal ? { ...deal, entityType: 'deal' } : null;
          break;
        case 'project':
          const [project] = await db
            .select({ id: projects.id, name: projects.name, status: projects.status })
            .from(projects)
            .where(eq(projects.id, linkedId))
            .limit(1);
          entity = project ? { ...project, entityType: 'project' } : null;
          break;
      }
      
      if (entity) {
        linkedEntities.push({
          associationId: assoc.id,
          associationType: assoc.associationType,
          ...entity,
        });
      }
    }
    
    res.json(linkedEntities);
  } catch (error) {
    console.error('Error fetching linked entities:', error);
    res.status(500).json({ error: 'Failed to fetch linked entities' });
  }
});

router.post('/', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    
    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const parsed = createAssociationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request body', details: parsed.error.errors });
    }
    
    const { associationType, sourceEntityType, sourceEntityId, targetEntityType, targetEntityId, metadata } = parsed.data;
    
    const existing = await db
      .select()
      .from(crmAssociations)
      .where(and(
        eq(crmAssociations.orgId, orgId),
        eq(crmAssociations.sourceEntityType, sourceEntityType),
        eq(crmAssociations.sourceEntityId, sourceEntityId),
        eq(crmAssociations.targetEntityType, targetEntityType),
        eq(crmAssociations.targetEntityId, targetEntityId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Association already exists' });
    }
    
    const [association] = await db
      .insert(crmAssociations)
      .values({
        orgId,
        associationType,
        sourceEntityType,
        sourceEntityId,
        targetEntityType,
        targetEntityId,
        metadata: metadata || null,
        createdById: userId,
      })
      .returning();
    
    await createTimelineEvent({
      orgId,
      actorId: userId,
      entityType: sourceEntityType as any,
      entityId: sourceEntityId,
      eventType: 'association_created',
      title: `Linked ${targetEntityType}`,
      description: `Created association with ${targetEntityType}`,
      metadata: { associationId: association.id, targetType: targetEntityType, targetId: targetEntityId },
    });
    
    res.status(201).json(association);
  } catch (error) {
    console.error('Error creating association:', error);
    res.status(500).json({ error: 'Failed to create association' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.userId;
    const { id } = req.params;
    
    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const [association] = await db
      .select()
      .from(crmAssociations)
      .where(and(
        eq(crmAssociations.id, id),
        eq(crmAssociations.orgId, orgId)
      ))
      .limit(1);
    
    if (!association) {
      return res.status(404).json({ error: 'Association not found' });
    }
    
    await db
      .delete(crmAssociations)
      .where(eq(crmAssociations.id, id));
    
    await createTimelineEvent({
      orgId,
      actorId: userId,
      entityType: association.sourceEntityType as any,
      entityId: association.sourceEntityId,
      eventType: 'association_removed',
      title: `Unlinked ${association.targetEntityType}`,
      description: `Removed association with ${association.targetEntityType}`,
      metadata: { targetType: association.targetEntityType, targetId: association.targetEntityId },
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting association:', error);
    res.status(500).json({ error: 'Failed to delete association' });
  }
});

export default router;
