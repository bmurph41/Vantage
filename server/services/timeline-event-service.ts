import { db } from '../db';
import { crmTimelineEvents } from '@shared/schema';

interface CreateTimelineEventParams {
  orgId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  eventType: 'activity_created' | 'activity_completed' | 'activity_reopened' | 'note_created' | 'note_updated' | 'file_uploaded' | 'stage_changed' | 'email_logged' | 'call_logged' | 'comment_created' | 'deal_created' | 'deal_updated' | 'contact_linked' | 'company_linked';
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function createTimelineEvent(params: CreateTimelineEventParams) {
  const [event] = await db.insert(crmTimelineEvents).values({
    orgId: params.orgId,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    relatedEntityType: params.relatedEntityType,
    relatedEntityId: params.relatedEntityId,
    title: params.title,
    description: params.description,
    metadata: params.metadata || {},
    createdBy: params.actorId,
  }).returning();
  
  return event;
}

export async function getTimelineEvents(params: {
  orgId: string;
  entityType: string;
  entityId: string;
  limit?: number;
  offset?: number;
  filter?: string;
}) {
  const { orgId, entityType, entityId, limit = 50, offset = 0 } = params;
  
  const events = await db.query.crmTimelineEvents.findMany({
    where: (events, { eq, and }) => and(
      eq(events.orgId, orgId),
      eq(events.entityType, entityType),
      eq(events.entityId, entityId)
    ),
    orderBy: (events, { desc }) => [desc(events.occurredAt)],
    limit,
    offset,
  });
  
  return events;
}

export const timelineEventService = {
  createTimelineEvent,
  getTimelineEvents,
};
