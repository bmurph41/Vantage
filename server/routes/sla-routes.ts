import { Router } from 'express';
import { db } from '@db';
import { 
  slaConfigs, slaTracking, slaEscalations, slaAssignmentHistory,
  insertSlaConfigSchema, updateSlaConfigSchema, insertSlaTrackingSchema,
  users, tasks, crmTasks
} from '@shared/schema';
import { eq, and, desc, lt, lte, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

function getSlaRouter() {
  router.get('/configs', async (req, res) => {
    try {
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      const configs = await db.query.slaConfigs.findMany({
        where: eq(slaConfigs.orgId, orgId),
        orderBy: [desc(slaConfigs.createdAt)],
        with: {
          creator: { columns: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      res.json(configs);
    } catch (error) {
      console.error('Error fetching SLA configs:', error);
      res.status(500).json({ error: 'Failed to fetch SLA configs' });
    }
  });

  router.get('/configs/:configId', async (req, res) => {
    try {
      const { configId } = req.params;
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      const config = await db.query.slaConfigs.findFirst({
        where: and(eq(slaConfigs.id, configId), eq(slaConfigs.orgId, orgId)),
        with: {
          creator: { columns: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
      if (!config) {
        return res.status(404).json({ error: 'SLA config not found' });
      }
      res.json(config);
    } catch (error) {
      console.error('Error fetching SLA config:', error);
      res.status(500).json({ error: 'Failed to fetch SLA config' });
    }
  });

  router.post('/configs', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string || 'system';
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      const validatedData = insertSlaConfigSchema.parse({
        ...req.body,
        orgId,
        createdBy: userId,
      });
      const [newConfig] = await db.insert(slaConfigs).values(validatedData).returning();
      res.status(201).json(newConfig);
    } catch (error) {
      console.error('Error creating SLA config:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create SLA config' });
    }
  });

  router.patch('/configs/:configId', async (req, res) => {
    try {
      const { configId } = req.params;
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      const validatedData = updateSlaConfigSchema.parse(req.body);
      const [updated] = await db.update(slaConfigs)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(and(eq(slaConfigs.id, configId), eq(slaConfigs.orgId, orgId)))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: 'SLA config not found' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error updating SLA config:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update SLA config' });
    }
  });

  router.delete('/configs/:configId', async (req, res) => {
    try {
      const { configId } = req.params;
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      const [deleted] = await db.delete(slaConfigs)
        .where(and(eq(slaConfigs.id, configId), eq(slaConfigs.orgId, orgId)))
        .returning();
      if (!deleted) {
        return res.status(404).json({ error: 'SLA config not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting SLA config:', error);
      res.status(500).json({ error: 'Failed to delete SLA config' });
    }
  });

  router.get('/tracking', async (req, res) => {
    try {
      const { status, assigneeId, entityType } = req.query;
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      
      const trackings = await db.query.slaTracking.findMany({
        orderBy: [desc(slaTracking.slaDueTime)],
        with: {
          config: true,
          currentAssignee: { columns: { id: true, firstName: true, lastName: true, email: true } },
        },
        limit: 100,
      });
      
      let filtered = trackings.filter(t => t.config?.orgId === orgId);
      if (status) {
        filtered = filtered.filter(t => t.currentStatus === status);
      }
      if (assigneeId) {
        filtered = filtered.filter(t => t.currentAssigneeId === assigneeId);
      }
      if (entityType) {
        filtered = filtered.filter(t => t.entityType === entityType);
      }
      
      res.json(filtered);
    } catch (error) {
      console.error('Error fetching SLA tracking:', error);
      res.status(500).json({ error: 'Failed to fetch SLA tracking' });
    }
  });

  router.get('/tracking/my-slas', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }
      
      const trackings = await db.query.slaTracking.findMany({
        where: and(
          eq(slaTracking.currentAssigneeId, userId),
          isNull(slaTracking.resolvedAt)
        ),
        orderBy: [desc(slaTracking.slaDueTime)],
        with: {
          config: true,
        },
      });
      
      const filtered = trackings.filter(t => t.config?.orgId === orgId);
      res.json(filtered);
    } catch (error) {
      console.error('Error fetching my SLAs:', error);
      res.status(500).json({ error: 'Failed to fetch my SLAs' });
    }
  });

  router.get('/tracking/:trackingId', async (req, res) => {
    try {
      const { trackingId } = req.params;
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      const tracking = await db.query.slaTracking.findFirst({
        where: eq(slaTracking.id, trackingId),
        with: {
          config: true,
          currentAssignee: { columns: { id: true, firstName: true, lastName: true, email: true } },
          escalations: {
            orderBy: [desc(slaEscalations.createdAt)],
            with: {
              escalatedTo: { columns: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
          assignmentHistory: {
            orderBy: [desc(slaAssignmentHistory.assignedAt)],
            with: {
              toUser: { columns: { id: true, firstName: true, lastName: true, email: true } },
              fromUser: { columns: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      });
      if (!tracking || tracking.config?.orgId !== orgId) {
        return res.status(404).json({ error: 'SLA tracking not found' });
      }
      res.json(tracking);
    } catch (error) {
      console.error('Error fetching SLA tracking:', error);
      res.status(500).json({ error: 'Failed to fetch SLA tracking' });
    }
  });

  async function getTrackingWithOrgCheck(trackingId: string, orgId: string) {
    const tracking = await db.query.slaTracking.findFirst({
      where: eq(slaTracking.id, trackingId),
      with: { config: true },
    });
    if (!tracking || tracking.config?.orgId !== orgId) {
      return null;
    }
    return tracking;
  }

  router.post('/tracking', async (req, res) => {
    try {
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      const { slaConfigId } = req.body;
      
      const config = await db.query.slaConfigs.findFirst({
        where: and(eq(slaConfigs.id, slaConfigId), eq(slaConfigs.orgId, orgId)),
      });
      if (!config) {
        return res.status(400).json({ error: 'Invalid SLA config or unauthorized' });
      }
      
      const validatedData = insertSlaTrackingSchema.parse(req.body);
      const [newTracking] = await db.insert(slaTracking).values(validatedData).returning();
      res.status(201).json(newTracking);
    } catch (error) {
      console.error('Error creating SLA tracking:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create SLA tracking' });
    }
  });

  router.post('/tracking/:trackingId/assign', async (req, res) => {
    try {
      const { trackingId } = req.params;
      const { toUserId, reason } = req.body;
      const userId = req.headers['x-user-id'] as string;
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      
      const tracking = await getTrackingWithOrgCheck(trackingId, orgId);
      if (!tracking) {
        return res.status(404).json({ error: 'SLA tracking not found' });
      }
      
      await db.insert(slaAssignmentHistory).values({
        slaTrackingId: trackingId,
        fromUserId: tracking.currentAssigneeId,
        toUserId,
        assignmentReason: reason || 'manual',
        assignedBy: userId,
      });
      
      const [updated] = await db.update(slaTracking)
        .set({
          previousAssigneeId: tracking.currentAssigneeId,
          currentAssigneeId: toUserId,
          reassignmentCount: (tracking.reassignmentCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(slaTracking.id, trackingId))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error('Error assigning SLA:', error);
      res.status(500).json({ error: 'Failed to assign SLA' });
    }
  });

  router.post('/tracking/:trackingId/resolve', async (req, res) => {
    try {
      const { trackingId } = req.params;
      const { resolutionNotes } = req.body;
      const userId = req.headers['x-user-id'] as string;
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      
      const tracking = await getTrackingWithOrgCheck(trackingId, orgId);
      if (!tracking) {
        return res.status(404).json({ error: 'SLA tracking not found' });
      }
      
      const resolutionTime = Math.round(
        (new Date().getTime() - new Date(tracking.slaStartTime).getTime()) / 60000
      );
      
      const [updated] = await db.update(slaTracking)
        .set({
          resolvedAt: new Date(),
          resolvedBy: userId,
          resolutionNotes,
          currentStatus: 'resolved',
          totalResolutionTime: resolutionTime,
          updatedAt: new Date(),
        })
        .where(eq(slaTracking.id, trackingId))
        .returning();
      
      res.json(updated);
    } catch (error) {
      console.error('Error resolving SLA:', error);
      res.status(500).json({ error: 'Failed to resolve SLA' });
    }
  });

  router.post('/tracking/:trackingId/escalate', async (req, res) => {
    try {
      const { trackingId } = req.params;
      const { escalateToId, reason } = req.body;
      const userId = req.headers['x-user-id'] as string;
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      
      const tracking = await getTrackingWithOrgCheck(trackingId, orgId);
      if (!tracking) {
        return res.status(404).json({ error: 'SLA tracking not found' });
      }
      
      const newLevel = (tracking.currentEscalationLevel || 0) + 1;
      
      const [escalation] = await db.insert(slaEscalations).values({
        slaTrackingId: trackingId,
        escalationLevel: newLevel,
        escalatedToId: escalateToId,
        escalatedById: userId,
        reason: reason || 'Manual escalation',
        notifiedAt: new Date(),
      }).returning();
      
      await db.update(slaTracking)
        .set({
          currentEscalationLevel: newLevel,
          escalationCount: (tracking.escalationCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(slaTracking.id, trackingId));
      
      res.json(escalation);
    } catch (error) {
      console.error('Error escalating SLA:', error);
      res.status(500).json({ error: 'Failed to escalate SLA' });
    }
  });

  router.get('/summary', async (req, res) => {
    try {
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      
      const allTrackings = await db.query.slaTracking.findMany({
        where: isNull(slaTracking.resolvedAt),
        with: {
          config: {
            where: eq(slaConfigs.orgId, orgId),
          },
        },
      });
      
      const now = new Date();
      const summary = {
        total: allTrackings.length,
        byStatus: {
          on_track: 0,
          warning: 0,
          critical: 0,
          breached: 0,
        },
        byEntityType: {} as Record<string, number>,
        upcomingDeadlines: [] as any[],
        breached: [] as any[],
      };
      
      for (const t of allTrackings) {
        const dueTime = new Date(t.slaDueTime);
        const warningTime = t.warningTime ? new Date(t.warningTime) : null;
        const criticalTime = t.criticalTime ? new Date(t.criticalTime) : null;
        
        let status = 'on_track';
        if (now > dueTime) {
          status = 'breached';
          summary.breached.push(t);
        } else if (criticalTime && now > criticalTime) {
          status = 'critical';
        } else if (warningTime && now > warningTime) {
          status = 'warning';
        }
        
        summary.byStatus[status as keyof typeof summary.byStatus]++;
        
        summary.byEntityType[t.entityType] = (summary.byEntityType[t.entityType] || 0) + 1;
        
        const hoursUntilDue = (dueTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilDue > 0 && hoursUntilDue <= 24) {
          summary.upcomingDeadlines.push({ ...t, hoursUntilDue: Math.round(hoursUntilDue * 10) / 10 });
        }
      }
      
      summary.upcomingDeadlines.sort((a, b) => a.hoursUntilDue - b.hoursUntilDue);
      summary.upcomingDeadlines = summary.upcomingDeadlines.slice(0, 10);
      
      res.json(summary);
    } catch (error) {
      console.error('Error fetching SLA summary:', error);
      res.status(500).json({ error: 'Failed to fetch SLA summary' });
    }
  });

  router.post('/check-slas', async (req, res) => {
    try {
      const now = new Date();
      
      const activeTrackings = await db.query.slaTracking.findMany({
        where: isNull(slaTracking.resolvedAt),
        with: {
          config: true,
        },
      });
      
      const updates: { id: string; newStatus: string }[] = [];
      const escalationsNeeded: { trackingId: string; config: any }[] = [];
      
      for (const tracking of activeTrackings) {
        if (!tracking.config) continue;
        
        const dueTime = new Date(tracking.slaDueTime);
        const warningTime = tracking.warningTime ? new Date(tracking.warningTime) : null;
        const criticalTime = tracking.criticalTime ? new Date(tracking.criticalTime) : null;
        
        let newStatus = 'on_track';
        if (now > dueTime) {
          newStatus = 'breached';
        } else if (criticalTime && now > criticalTime) {
          newStatus = 'critical';
        } else if (warningTime && now > warningTime) {
          newStatus = 'warning';
        }
        
        if (newStatus !== tracking.currentStatus) {
          updates.push({ id: tracking.id, newStatus });
          
          if ((newStatus === 'critical' || newStatus === 'breached') && 
              tracking.config.escalationChain && 
              tracking.config.escalationChain.length > tracking.currentEscalationLevel) {
            escalationsNeeded.push({ trackingId: tracking.id, config: tracking.config });
          }
        }
      }
      
      for (const update of updates) {
        await db.update(slaTracking)
          .set({ currentStatus: update.newStatus, updatedAt: new Date() })
          .where(eq(slaTracking.id, update.id));
      }
      
      for (const esc of escalationsNeeded) {
        const tracking = await db.query.slaTracking.findFirst({
          where: eq(slaTracking.id, esc.trackingId),
        });
        if (!tracking) continue;
        
        const nextLevel = tracking.currentEscalationLevel + 1;
        const escalateToId = esc.config.escalationChain[tracking.currentEscalationLevel];
        
        if (escalateToId) {
          await db.insert(slaEscalations).values({
            slaTrackingId: esc.trackingId,
            escalationLevel: nextLevel,
            escalatedToId,
            reason: `Auto-escalation: SLA status changed to ${tracking.currentStatus}`,
            notifiedAt: new Date(),
          });
          
          await db.update(slaTracking)
            .set({
              currentEscalationLevel: nextLevel,
              escalationCount: (tracking.escalationCount || 0) + 1,
              updatedAt: new Date(),
            })
            .where(eq(slaTracking.id, esc.trackingId));
        }
      }
      
      res.json({
        checked: activeTrackings.length,
        updated: updates.length,
        escalated: escalationsNeeded.length,
      });
    } catch (error) {
      console.error('Error checking SLAs:', error);
      res.status(500).json({ error: 'Failed to check SLAs' });
    }
  });

  router.get('/metrics', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const orgId = req.headers['x-org-id'] as string || 'default-org';
      
      const resolvedTrackings = await db.query.slaTracking.findMany({
        with: {
          config: {
            where: eq(slaConfigs.orgId, orgId),
          },
        },
      });
      
      const resolved = resolvedTrackings.filter(t => t.resolvedAt && t.config);
      
      const metrics = {
        totalResolved: resolved.length,
        avgResolutionTime: 0,
        avgFirstResponseTime: 0,
        slaComplianceRate: 0,
        avgEscalations: 0,
        avgReassignments: 0,
        byStatus: {
          on_time: 0,
          breached: 0,
        },
      };
      
      if (resolved.length > 0) {
        let totalResTime = 0;
        let totalFirstResp = 0;
        let firstRespCount = 0;
        let totalEsc = 0;
        let totalReassign = 0;
        
        for (const t of resolved) {
          if (t.totalResolutionTime) {
            totalResTime += t.totalResolutionTime;
          }
          if (t.timeToFirstResponse) {
            totalFirstResp += t.timeToFirstResponse;
            firstRespCount++;
          }
          totalEsc += t.escalationCount || 0;
          totalReassign += t.reassignmentCount || 0;
          
          const dueTime = new Date(t.slaDueTime);
          const resolvedTime = new Date(t.resolvedAt!);
          if (resolvedTime <= dueTime) {
            metrics.byStatus.on_time++;
          } else {
            metrics.byStatus.breached++;
          }
        }
        
        metrics.avgResolutionTime = Math.round(totalResTime / resolved.length);
        metrics.avgFirstResponseTime = firstRespCount > 0 ? Math.round(totalFirstResp / firstRespCount) : 0;
        metrics.slaComplianceRate = Math.round((metrics.byStatus.on_time / resolved.length) * 100);
        metrics.avgEscalations = Math.round((totalEsc / resolved.length) * 10) / 10;
        metrics.avgReassignments = Math.round((totalReassign / resolved.length) * 10) / 10;
      }
      
      res.json(metrics);
    } catch (error) {
      console.error('Error fetching SLA metrics:', error);
      res.status(500).json({ error: 'Failed to fetch SLA metrics' });
    }
  });

  return router;
}

export { getSlaRouter };
