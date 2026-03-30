import { Router } from 'express';
import { db } from '../db';
import {
  crmDeals,
  crmTasks,
  crmActivities,
  crmPipelineStages,
  crmDealStageHistory,
  crmContacts,
  crmCompanies,
  crmRedFlags,
  crmPhaseGateApprovals,
  crmDealPlaybookProgress,
  crmTimelineEvents,
} from '@shared/schema';
import { eq, and, desc, sql, inArray, isNotNull, count, max } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export const crmPipelineEnhancementsRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────

function urgencyColor(date: Date | null | undefined): { color: string; label: string } {
  if (!date) return { color: '#9CA3AF', label: 'no_date' }; // grey
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return { color: '#DC2626', label: 'OVERDUE' };
  if (diffDays < 3) return { color: '#EF4444', label: 'critical' };
  if (diffDays < 7) return { color: '#F97316', label: 'urgent' };
  if (diffDays < 14) return { color: '#EAB308', label: 'warning' };
  return { color: '#9CA3AF', label: 'normal' };
}

interface BuildTimelineOptions {
  includeRedFlags?: boolean;
  includeMilestones?: boolean;
  includePlaybook?: boolean;
  includeActivities?: boolean;
}

function buildTimelineEventsForDeal(
  deal: any,
  tasks: any[],
  stageHistory: any[],
  extras?: {
    redFlags?: any[];
    phaseGates?: any[];
    playbookItems?: any[];
    activities?: any[];
  },
) {
  const events: any[] = [];

  // Key dates from deal
  const keyDateFields: { field: string; label: string; color: string }[] = [
    { field: 'closingDate', label: 'Closing Date', color: '#10B981' },
    { field: 'expectedCloseDate', label: 'Expected Close', color: '#3B82F6' },
    { field: 'ddExpirationDate', label: 'DD Deadline', color: '#F59E0B' },
    { field: 'psaSignedDate', label: 'PSA Signed', color: '#8B5CF6' },
    { field: 'firstDepositDueDate', label: 'First Deposit Due', color: '#EC4899' },
    { field: 'secondDepositDueDate', label: 'Second Deposit Due', color: '#EC4899' },
  ];

  for (const kd of keyDateFields) {
    const dateVal = deal[kd.field];
    if (dateVal) {
      events.push({
        id: `${deal.id}-${kd.field}`,
        dealId: deal.id,
        dealName: deal.title,
        eventType: 'key_date',
        title: kd.label,
        startDate: dateVal,
        endDate: dateVal,
        status: new Date(dateVal) < new Date() ? 'past' : 'upcoming',
        color: kd.color,
      });
    }
  }

  // Custom deadlines
  const customDeadlines = (deal.customDeadlines as any[]) || [];
  for (const cd of customDeadlines) {
    if (cd.date && cd.showOnTimeline !== false) {
      events.push({
        id: `${deal.id}-custom-${cd.label}`,
        dealId: deal.id,
        dealName: deal.title,
        eventType: 'custom_deadline',
        title: cd.label,
        startDate: cd.date,
        endDate: cd.date,
        status: new Date(cd.date) < new Date() ? 'past' : 'upcoming',
        color: '#6366F1',
      });
    }
  }

  // Tasks as timeline bars
  for (const task of tasks) {
    events.push({
      id: `task-${task.id}`,
      dealId: deal.id,
      dealName: deal.title,
      eventType: 'task',
      title: task.title,
      startDate: task.createdAt,
      endDate: task.dueDate || task.createdAt,
      status: task.status,
      color: task.priority === 'urgent' ? '#EF4444' : task.priority === 'high' ? '#F97316' : '#3B82F6',
      metadata: { priority: task.priority },
    });
  }

  // Stage history
  for (const sh of stageHistory) {
    events.push({
      id: `stage-${sh.id}`,
      dealId: deal.id,
      dealName: deal.title,
      eventType: 'stage_change',
      title: `Stage: ${sh.stageName}`,
      startDate: sh.enteredAt,
      endDate: sh.exitedAt || new Date(),
      status: sh.isCurrentStage ? 'active' : 'completed',
      color: '#4A6FA5',
    });
  }

  // Red flags
  if (extras?.redFlags) {
    const severityColors: Record<string, string> = {
      critical: '#DC2626', high: '#EF4444', medium: '#F97316', low: '#EAB308',
    };
    for (const rf of extras.redFlags) {
      events.push({
        id: `redflag-${rf.id}`,
        dealId: deal.id,
        dealName: deal.title,
        eventType: 'red_flag',
        title: rf.title,
        startDate: rf.raisedAt || rf.createdAt,
        endDate: rf.raisedAt || rf.createdAt,
        status: rf.status,
        color: severityColors[rf.severity] || '#F97316',
        metadata: { severity: rf.severity, category: rf.category },
      });
    }
  }

  // Phase gate approvals (milestones)
  if (extras?.phaseGates) {
    for (const pg of extras.phaseGates) {
      events.push({
        id: `milestone-${pg.id}`,
        dealId: deal.id,
        dealName: deal.title,
        eventType: 'milestone',
        title: `Approval: ${pg.status}`,
        startDate: pg.requestedAt || pg.createdAt,
        endDate: pg.reviewedAt || pg.requestedAt || pg.createdAt,
        status: pg.status,
        color: pg.status === 'approved' ? '#10B981' : pg.status === 'rejected' ? '#EF4444' : '#6366F1',
        metadata: { fromStageId: pg.fromStageId, toStageId: pg.toStageId },
      });
    }
  }

  // Playbook items
  if (extras?.playbookItems) {
    for (const pb of extras.playbookItems) {
      if (pb.completedAt || pb.dueDate) {
        events.push({
          id: `playbook-${pb.id}`,
          dealId: deal.id,
          dealName: deal.title,
          eventType: 'playbook',
          title: `Playbook: ${pb.status}`,
          startDate: pb.completedAt || pb.dueDate || pb.createdAt,
          endDate: pb.completedAt || pb.dueDate || pb.createdAt,
          status: pb.status,
          color: pb.status === 'completed' ? '#10B981' : '#94A3B8',
        });
      }
    }
  }

  // Activity events
  if (extras?.activities) {
    for (const act of extras.activities) {
      events.push({
        id: `activity-${act.id}`,
        dealId: deal.id,
        dealName: deal.title,
        eventType: 'activity',
        title: act.title || act.subject || act.eventType,
        startDate: act.occurredAt || act.createdAt,
        endDate: act.occurredAt || act.createdAt,
        status: 'completed',
        color: '#94A3B8',
        metadata: { eventType: act.eventType },
      });
    }
  }

  return events;
}

function computeSlaStatus(deal: any, stage: any): 'ok' | 'warning' | 'overdue' {
  if (!stage || !deal.currentStageEnteredAt) return 'ok';
  const daysInStage = Math.floor(
    (Date.now() - new Date(deal.currentStageEnteredAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const slaMax = stage.slaMaxDays ?? stage.sla_max_days;
  const slaWarn = stage.slaWarningDays ?? stage.sla_warning_days;
  if (slaMax && daysInStage > slaMax) return 'overdue';
  if (slaWarn && daysInStage > slaWarn) return 'warning';
  return 'ok';
}

// ─── 10.2  Deal Timeline / Gantt ────────────────────────────────────

crmPipelineEnhancementsRouter.get('/timeline', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      pipelineId,
      stageIds: stageIdsParam,
      ownerId,
      startDate: startDateParam,
      endDate: endDateParam,
      includeTasks: includeTasksParam,
      includeActivities: includeActivitiesParam,
      groupBy = 'deal',
    } = req.query as Record<string, string | undefined>;

    const includeTasks = includeTasksParam !== 'false';
    const includeActivities = includeActivitiesParam === 'true';

    // Default time window: ±90 days
    const now = new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(now.getTime() - 90 * 86400000);
    const endDate = endDateParam ? new Date(endDateParam) : new Date(now.getTime() + 90 * 86400000);

    // Build deal filter conditions
    const dealConditions: any[] = [eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, false)];
    if (pipelineId) dealConditions.push(eq(crmDeals.pipelineId, pipelineId));
    if (ownerId) dealConditions.push(eq(crmDeals.ownerId, ownerId));

    const stageIdsFilter = stageIdsParam ? stageIdsParam.split(',').filter(Boolean) : null;
    if (stageIdsFilter?.length) dealConditions.push(inArray(crmDeals.stageId, stageIdsFilter));

    const deals = await db.select().from(crmDeals).where(and(...dealConditions));
    if (deals.length === 0) {
      return res.json({ deals: [], events: [], timeRange: { start: startDate.toISOString(), end: endDate.toISOString() } });
    }

    const dealIds = deals.map((d) => d.id);

    // Fetch all stage metadata
    const allStages = await db.select().from(crmPipelineStages).where(eq(crmPipelineStages.orgId, orgId));
    const stageMap = new Map(allStages.map((s) => [s.id, s]));

    // Fetch parallel data
    const queries: Promise<any>[] = [
      db.select().from(crmDealStageHistory).where(and(eq(crmDealStageHistory.orgId, orgId), inArray(crmDealStageHistory.dealId, dealIds))).orderBy(crmDealStageHistory.enteredAt),
    ];
    if (includeTasks) {
      queries.push(db.select().from(crmTasks).where(and(eq(crmTasks.orgId, orgId), inArray(crmTasks.dealId, dealIds))));
    } else {
      queries.push(Promise.resolve([]));
    }

    const [stageHistory, tasks] = await Promise.all(queries);

    // Group by deal
    const tasksByDeal = new Map<string, any[]>();
    for (const t of tasks) {
      if (!t.dealId) continue;
      if (!tasksByDeal.has(t.dealId)) tasksByDeal.set(t.dealId, []);
      tasksByDeal.get(t.dealId)!.push(t);
    }
    const historyByDeal = new Map<string, any[]>();
    for (const h of stageHistory) {
      if (!historyByDeal.has(h.dealId)) historyByDeal.set(h.dealId, []);
      historyByDeal.get(h.dealId)!.push(h);
    }

    // Build response
    const dealSummaries: any[] = [];
    const allEvents: any[] = [];

    for (const deal of deals) {
      const stage = deal.stageId ? stageMap.get(deal.stageId) : null;
      const slaStatus = computeSlaStatus(deal, stage);
      const daysInCurrentStage = deal.currentStageEnteredAt
        ? Math.floor((Date.now() - new Date(deal.currentStageEnteredAt).getTime()) / 86400000)
        : deal.daysInCurrentStage || 0;

      dealSummaries.push({
        id: deal.id,
        title: deal.title,
        stage: deal.stage,
        stageName: stage?.name || deal.stage || '',
        stageColor: (stage as any)?.color || '#4A6FA5',
        owner: deal.ownerId ? { id: deal.ownerId, name: (deal as any).ownerName || '' } : null,
        priority: deal.priority,
        probability: deal.probability,
        value: deal.value || deal.amount,
        expectedCloseDate: deal.expectedCloseDate,
        daysInCurrentStage,
        slaStatus,
      });

      const dealTasks = tasksByDeal.get(deal.id) || [];
      const dealHistory = historyByDeal.get(deal.id) || [];
      allEvents.push(...buildTimelineEventsForDeal(deal, dealTasks, dealHistory));
    }

    return res.json({
      deals: dealSummaries,
      events: allEvents,
      timeRange: { start: startDate.toISOString(), end: endDate.toISOString() },
    });
  } catch (error: any) {
    console.error('Error fetching timeline:', error);
    return res.status(500).json({ error: 'Failed to fetch timeline events' });
  }
});

crmPipelineEnhancementsRouter.get('/timeline/:dealId', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId } = req.params;
    const includeParam = (req.query.include as string) || 'key_dates,stages,tasks';
    const includes = new Set(includeParam.split(',').map((s) => s.trim()));

    const [dealRows] = await Promise.all([
      db.select().from(crmDeals).where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId))),
    ]);

    if (dealRows.length === 0) return res.status(404).json({ error: 'Deal not found' });
    const deal = dealRows[0];

    // Always fetch stage history and tasks (unless excluded)
    const queries: Record<string, Promise<any[]>> = {};
    if (includes.has('stages') || includes.has('key_dates')) {
      queries.stageHistory = db.select().from(crmDealStageHistory)
        .where(and(eq(crmDealStageHistory.dealId, dealId), eq(crmDealStageHistory.orgId, orgId)))
        .orderBy(crmDealStageHistory.enteredAt);
    }
    if (includes.has('tasks')) {
      queries.tasks = db.select().from(crmTasks)
        .where(and(eq(crmTasks.dealId, dealId), eq(crmTasks.orgId, orgId)));
    }
    if (includes.has('red_flags')) {
      queries.redFlags = db.select().from(crmRedFlags)
        .where(and(eq(crmRedFlags.dealId, dealId), eq(crmRedFlags.orgId, orgId)));
    }
    if (includes.has('milestones')) {
      queries.phaseGates = db.select().from(crmPhaseGateApprovals)
        .where(and(eq(crmPhaseGateApprovals.dealId, dealId), eq(crmPhaseGateApprovals.orgId, orgId)));
    }
    if (includes.has('playbook')) {
      queries.playbookItems = db.select().from(crmDealPlaybookProgress)
        .where(and(eq(crmDealPlaybookProgress.dealId, dealId), eq(crmDealPlaybookProgress.orgId, orgId)));
    }
    if (includes.has('activities')) {
      queries.activities = db.select().from(crmTimelineEvents)
        .where(and(eq(crmTimelineEvents.entityType, 'deal'), eq(crmTimelineEvents.entityId, dealId), eq(crmTimelineEvents.orgId, orgId)));
    }

    const keys = Object.keys(queries);
    const results = await Promise.all(Object.values(queries));
    const data: Record<string, any[]> = {};
    keys.forEach((k, i) => { data[k] = results[i]; });

    const events = buildTimelineEventsForDeal(
      deal,
      data.tasks || [],
      data.stageHistory || [],
      {
        redFlags: data.redFlags,
        phaseGates: data.phaseGates,
        playbookItems: data.playbookItems,
        activities: data.activities,
      },
    );

    return res.json(events);
  } catch (error: any) {
    console.error('Error fetching deal timeline:', error);
    return res.status(500).json({ error: 'Failed to fetch deal timeline' });
  }
});

// ─── 10.3  Deal Comparison ──────────────────────────────────────────

crmPipelineEnhancementsRouter.post('/compare', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { dealIds } = req.body as { dealIds: string[] };
    if (!dealIds || dealIds.length < 2 || dealIds.length > 5) {
      return res.status(400).json({ error: 'Provide between 2 and 5 deal IDs' });
    }

    const deals = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.orgId, orgId), inArray(crmDeals.id, dealIds)));

    if (deals.length < 2) {
      return res.status(404).json({ error: 'Could not find enough deals to compare' });
    }

    // Fetch stage names for each deal
    const stageIds = deals.map((d) => d.stageId).filter(Boolean) as string[];
    const stages = stageIds.length > 0
      ? await db.select().from(crmPipelineStages).where(inArray(crmPipelineStages.id, stageIds))
      : [];
    const stageMap = new Map(stages.map((s) => [s.id, s]));

    // Build comparison matrix
    const comparison = deals.map((deal) => {
      const stage = deal.stageId ? stageMap.get(deal.stageId) : null;
      const value = deal.value ? parseFloat(deal.value) : null;
      const amount = deal.amount ? parseFloat(deal.amount) : null;
      const commission = deal.commissionAmount ? parseFloat(deal.commissionAmount) : null;
      const commissionRate = deal.commissionRate ? parseFloat(deal.commissionRate) : null;

      return {
        dealId: deal.id,
        dealName: deal.title,
        categories: {
          overview: {
            title: deal.title,
            type: deal.type,
            assetClass: deal.assetClass,
            stage: stage?.name || deal.stage,
            probability: deal.probability,
            priority: deal.priority,
            marinaName: deal.marinaName,
            city: deal.city,
            state: deal.state,
          },
          priceValuation: {
            value,
            amount,
            dealSource: deal.dealSource,
            leadSource: deal.leadSource,
          },
          financial: {
            commissionAmount: commission,
            commissionRate,
            commissionType: deal.commissionType,
            firstDepositAmount: deal.firstDepositAmount ? parseFloat(deal.firstDepositAmount) : null,
            secondDepositAmount: deal.secondDepositAmount ? parseFloat(deal.secondDepositAmount) : null,
          },
          underwriting: {
            boatLength: deal.boatLength ? parseFloat(deal.boatLength) : null,
            boatType: deal.boatType,
            propertyType: deal.propertyType,
            leaseTermMonths: deal.leaseTermMonths,
          },
          capitalStructure: {
            firstDepositAmount: deal.firstDepositAmount ? parseFloat(deal.firstDepositAmount) : null,
            secondDepositAmount: deal.secondDepositAmount ? parseFloat(deal.secondDepositAmount) : null,
            lender: deal.lender,
          },
          risk: {
            probability: deal.probability,
            daysInCurrentStage: deal.daysInCurrentStage,
            forecastCategory: deal.forecastCategory,
            lostReason: deal.lostReason,
          },
          timeline: {
            createdAt: deal.createdAt,
            expectedCloseDate: deal.expectedCloseDate,
            closingDate: deal.closingDate,
            ddExpirationDate: deal.ddExpirationDate,
            psaSignedDate: deal.psaSignedDate,
            ddPeriodDays: deal.ddPeriodDays,
            daysToClosing: deal.daysToClosing,
          },
        },
      };
    });

    // Compute rankings
    const rankings: Record<string, Record<string, string>> = {};
    const values = deals.map((d) => ({ id: d.id, val: d.value ? parseFloat(d.value) : 0 }));
    values.sort((a, b) => b.val - a.val);
    rankings['value'] = {};
    if (values.length > 0 && values[0].val > 0) rankings['value'][values[0].id] = 'best';
    if (values.length > 1 && values[values.length - 1].val >= 0) rankings['value'][values[values.length - 1].id] = 'worst';

    const probs = deals.map((d) => ({ id: d.id, val: d.probability || 0 }));
    probs.sort((a, b) => b.val - a.val);
    rankings['probability'] = {};
    if (probs.length > 0) rankings['probability'][probs[0].id] = 'best';
    if (probs.length > 1) rankings['probability'][probs[probs.length - 1].id] = 'worst';

    const stageDays = deals.map((d) => ({ id: d.id, val: d.daysInCurrentStage || 0 }));
    stageDays.sort((a, b) => a.val - b.val); // fewer days is better
    rankings['daysInCurrentStage'] = {};
    if (stageDays.length > 0) rankings['daysInCurrentStage'][stageDays[0].id] = 'best';
    if (stageDays.length > 1) rankings['daysInCurrentStage'][stageDays[stageDays.length - 1].id] = 'worst';

    return res.json({ comparison, rankings });
  } catch (error: any) {
    console.error('Error comparing deals:', error);
    return res.status(500).json({ error: 'Failed to compare deals' });
  }
});

// ─── 10.4  Key Dates on Kanban ──────────────────────────────────────

crmPipelineEnhancementsRouter.get('/kanban-dates', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const deals = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, false)));

    const priorityDateFields: { field: string; label: string }[] = [
      { field: 'closingDate', label: 'Closing Date' },
      { field: 'ddExpirationDate', label: 'DD Deadline' },
      { field: 'expectedCloseDate', label: 'Expected Close' },
      { field: 'psaSignedDate', label: 'PSA Signing' },
    ];

    const result = deals.map((deal) => {
      let nextDate: { label: string; date: Date } | null = null;

      // Priority order: closingDate > ddExpirationDate > expectedCloseDate > psaSignedDate
      // But we pick the earliest *future* date, respecting priority for ties
      for (const pf of priorityDateFields) {
        const val = (deal as any)[pf.field];
        if (val) {
          const d = new Date(val);
          // Include both future dates and recent overdue dates
          if (!nextDate || d.getTime() < nextDate.date.getTime()) {
            nextDate = { label: pf.label, date: d };
          }
        }
      }

      const urg = urgencyColor(nextDate?.date || null);

      return {
        dealId: deal.id,
        dealName: deal.title,
        stageId: deal.stageId,
        stage: deal.stage,
        nextKeyDate: nextDate
          ? {
              label: nextDate.label,
              date: nextDate.date,
              urgency: urg.label,
              color: urg.color,
            }
          : null,
      };
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Error fetching kanban dates:', error);
    return res.status(500).json({ error: 'Failed to fetch kanban dates' });
  }
});

// ─── 10.5  Activity Feed ────────────────────────────────────────────

crmPipelineEnhancementsRouter.get('/activity-feed', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      dealId,
      contactId,
      activityType,
      userId,
      startDate,
      endDate,
    } = req.query as Record<string, string | undefined>;

    const limit = parseInt((req.query.limit as string) || '50');
    const offset = parseInt((req.query.offset as string) || '0');

    const conditions: any[] = [eq(crmActivities.orgId, orgId)];

    if (dealId) {
      conditions.push(eq(crmActivities.entityType, 'deal'));
      conditions.push(eq(crmActivities.entityId, dealId));
    }
    if (contactId) {
      conditions.push(eq(crmActivities.entityType, 'contact'));
      conditions.push(eq(crmActivities.entityId, contactId));
    }
    if (activityType) {
      conditions.push(eq(crmActivities.type, activityType));
    }
    if (userId) {
      conditions.push(eq(crmActivities.userId, userId));
    }
    if (startDate) {
      conditions.push(sql`${crmActivities.createdAt} >= ${new Date(startDate)}`);
    }
    if (endDate) {
      conditions.push(sql`${crmActivities.createdAt} <= ${new Date(endDate)}`);
    }

    const activities = await db
      .select()
      .from(crmActivities)
      .where(and(...conditions))
      .orderBy(desc(crmActivities.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json(activities);
  } catch (error: any) {
    console.error('Error fetching activity feed:', error);
    return res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

crmPipelineEnhancementsRouter.post('/activity-feed', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const currentUserId = req.user?.userId;
    if (!orgId || !currentUserId) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId, contactId, activityType, title, body, isPinned } = req.body as {
      dealId?: string;
      contactId?: string;
      activityType: string;
      title: string;
      body?: string;
      isPinned?: boolean;
    };

    if (!activityType || !title) {
      return res.status(400).json({ error: 'activityType and title are required' });
    }

    const entityType = dealId ? 'deal' : contactId ? 'contact' : 'general';
    const entityId = dealId || contactId || undefined;

    const [activity] = await db
      .insert(crmActivities)
      .values({
        type: activityType,
        subject: title,
        description: body || title,
        entityType,
        entityId,
        userId: currentUserId,
        orgId,
        status: 'completed',
        metadata: { isPinned: isPinned || false },
      })
      .returning();

    return res.status(201).json(activity);
  } catch (error: any) {
    console.error('Error creating activity:', error);
    return res.status(500).json({ error: 'Failed to create activity' });
  }
});

crmPipelineEnhancementsRouter.put('/activity-feed/:id', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { body, isPinned } = req.body as { body?: string; isPinned?: boolean };

    const updates: Record<string, any> = {};
    if (body !== undefined) updates.description = body;
    if (isPinned !== undefined) {
      updates.metadata = sql`COALESCE(${crmActivities.metadata}, '{}'::jsonb) || ${JSON.stringify({ isPinned })}::jsonb`;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const [updated] = await db
      .update(crmActivities)
      .set(updates)
      .where(and(eq(crmActivities.id, id), eq(crmActivities.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Activity not found' });
    return res.json(updated);
  } catch (error: any) {
    console.error('Error updating activity:', error);
    return res.status(500).json({ error: 'Failed to update activity' });
  }
});

crmPipelineEnhancementsRouter.post('/activity-feed/:id/reactions', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { emoji, userId } = req.body as { emoji: string; userId: string };

    if (!emoji || !userId) {
      return res.status(400).json({ error: 'emoji and userId are required' });
    }

    // Add reaction to metadata.reactions array
    const [updated] = await db
      .update(crmActivities)
      .set({
        metadata: sql`jsonb_set(
          COALESCE(${crmActivities.metadata}, '{}'::jsonb),
          '{reactions}',
          COALESCE(${crmActivities.metadata}->'reactions', '[]'::jsonb) || ${JSON.stringify({ emoji, userId, createdAt: new Date().toISOString() })}::jsonb
        )`,
      })
      .where(and(eq(crmActivities.id, id), eq(crmActivities.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Activity not found' });
    return res.json(updated);
  } catch (error: any) {
    console.error('Error adding reaction:', error);
    return res.status(500).json({ error: 'Failed to add reaction' });
  }
});

crmPipelineEnhancementsRouter.post('/activity-feed/:id/replies', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    const currentUserId = req.user?.userId;
    if (!orgId || !currentUserId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { body } = req.body as { body: string };

    if (!body) {
      return res.status(400).json({ error: 'body is required' });
    }

    // Verify parent activity exists
    const [parent] = await db
      .select()
      .from(crmActivities)
      .where(and(eq(crmActivities.id, id), eq(crmActivities.orgId, orgId)));

    if (!parent) return res.status(404).json({ error: 'Parent activity not found' });

    // Create reply as a new activity linked via metadata
    const [reply] = await db
      .insert(crmActivities)
      .values({
        type: 'note',
        subject: `Reply to: ${parent.subject || ''}`,
        description: body,
        entityType: parent.entityType,
        entityId: parent.entityId,
        userId: currentUserId,
        orgId,
        status: 'completed',
        metadata: { parentActivityId: id, isReply: true },
      })
      .returning();

    // Also update parent to track reply count
    await db
      .update(crmActivities)
      .set({
        metadata: sql`jsonb_set(
          COALESCE(${crmActivities.metadata}, '{}'::jsonb),
          '{replyCount}',
          to_jsonb(COALESCE((${crmActivities.metadata}->>'replyCount')::int, 0) + 1)
        )`,
      })
      .where(eq(crmActivities.id, id));

    return res.status(201).json(reply);
  } catch (error: any) {
    console.error('Error creating reply:', error);
    return res.status(500).json({ error: 'Failed to create reply' });
  }
});

// ─── 10.5  AI Activity Summarization ────────────────────────────────

crmPipelineEnhancementsRouter.post('/activity-feed/summarize/:dealId', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { dealId } = req.params;

    // Verify deal belongs to org
    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId)));

    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    // Fetch last 30 days of activities
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activities = await db
      .select()
      .from(crmActivities)
      .where(
        and(
          eq(crmActivities.orgId, orgId),
          eq(crmActivities.entityType, 'deal'),
          eq(crmActivities.entityId, dealId),
          sql`${crmActivities.createdAt} >= ${thirtyDaysAgo}`
        )
      )
      .orderBy(desc(crmActivities.createdAt));

    if (activities.length === 0) {
      return res.json({ summary: 'No activity recorded for this deal in the last 30 days.' });
    }

    // Build context for AI
    const activityText = activities
      .map(
        (a) =>
          `[${a.createdAt?.toISOString().split('T')[0]}] ${a.type}: ${a.subject || ''} - ${a.description || ''}`
      )
      .join('\n');

    const anthropic = new Anthropic();

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `You are summarizing recent CRM activity for a commercial real estate deal titled "${deal.title}".

Here are the activities from the last 30 days:

${activityText}

Provide exactly 3 concise bullet points summarizing the key developments, actions taken, and current status. Be specific and actionable. Format as a markdown bulleted list.`,
        },
      ],
    });

    const summaryBlock = message.content.find((b) => b.type === 'text');
    const summary = summaryBlock ? summaryBlock.text : 'Unable to generate summary.';

    return res.json({ dealId, dealName: deal.title, summary, activityCount: activities.length });
  } catch (error: any) {
    console.error('Error summarizing activities:', error);
    return res.status(500).json({ error: 'Failed to summarize deal activities' });
  }
});

// GET /deals/enriched — deals list with activity counts + last-activity-date
// Used by the Pipeline Kanban to show activity badges on deal cards
crmPipelineEnhancementsRouter.get('/deals/enriched', async (req, res) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Activity counts + last activity date per deal
    const activityStats = await db
      .select({
        dealId: crmActivities.dealId,
        activityCount: count(crmActivities.id).as('activityCount'),
        lastActivityDate: max(crmActivities.createdAt).as('lastActivityDate'),
      })
      .from(crmActivities)
      .where(and(
        eq(crmActivities.orgId, orgId),
        isNotNull(crmActivities.dealId)
      ))
      .groupBy(crmActivities.dealId);

    // Build lookup map
    const statsMap = new Map(
      activityStats.map(s => [s.dealId, { activityCount: Number(s.activityCount), lastActivityDate: s.lastActivityDate }])
    );

    // Fetch deals with contact + company
    const deals = await db
      .select({
        deal: crmDeals,
        contact: crmContacts,
        company: crmCompanies,
      })
      .from(crmDeals)
      .leftJoin(crmContacts, eq(crmDeals.primaryContactId, crmContacts.id))
      .leftJoin(crmCompanies, eq(crmDeals.companyId, crmCompanies.id))
      .where(eq(crmDeals.orgId, orgId))
      .orderBy(desc(crmDeals.updatedAt));

    // Merge activity stats
    const enriched = deals.map(({ deal, contact, company }) => ({
      ...deal,
      contact: contact || null,
      company: company || null,
      activityCount: statsMap.get(deal.id)?.activityCount || 0,
      lastActivityDate: statsMap.get(deal.id)?.lastActivityDate || null,
    }));

    return res.json(enriched);
  } catch (error) {
    console.error('Error fetching enriched deals:', error);
    return res.status(500).json({ error: 'Failed to fetch enriched deals' });
  }
});

