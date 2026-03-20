/**
 * DD Status Report Routes
 *
 * Auto-generated due diligence status report with completion percentages,
 * by-category breakdown, outstanding items, and risk flags.
 */
import { Router, Request, Response } from 'express';
import { eq, and, sql, desc } from 'drizzle-orm';

const router = Router();

async function getDb() {
  const { db } = await import('../db');
  return db;
}

function getOrgId(req: Request): string | null {
  return (req as any).orgId || (req as any).user?.orgId || null;
}

// GET /projects/:projectId/status-report
router.get('/projects/:projectId/status-report', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { projectId } = req.params;
    const db = await getDb();

    // Get project info
    const projectResult = await db.execute(sql`
      SELECT id, name, status, dd_expiration, closing_date, created_at
      FROM projects
      WHERE id = ${projectId} AND org_id = ${orgId}
      LIMIT 1
    `);

    if (!projectResult.rows[0]) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectResult.rows[0] as any;

    // Get all tasks for this project
    const tasksResult = await db.execute(sql`
      SELECT
        id, title, status, dd_category as category, priority, assignee as assigned_to,
        deadline as due_date, completed_at, created_at
      FROM tasks
      WHERE project_id = ${projectId}
      ORDER BY dd_category, created_at
    `);

    const tasks = tasksResult.rows as any[];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const overallCompletion = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Group by category
    const categoryMap = new Map<string, { total: number; completed: number; items: any[] }>();
    for (const task of tasks) {
      const cat = task.category || 'other';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { total: 0, completed: 0, items: [] });
      }
      const group = categoryMap.get(cat)!;
      group.total++;
      if (task.status === 'completed') group.completed++;
      group.items.push(task);
    }

    const categories = Array.from(categoryMap.entries()).map(([name, data]) => ({
      name,
      totalItems: data.total,
      completedItems: data.completed,
      completionPercent: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      items: data.items,
    }));

    // Outstanding items (not completed)
    const now = new Date();
    const outstandingItems = tasks
      .filter(t => t.status !== 'completed')
      .map(t => ({
        id: t.id,
        title: t.title,
        category: t.category || 'other',
        status: t.status,
        priority: t.priority,
        assignedTo: t.assigned_to,
        dueDate: t.due_date,
        isOverdue: t.due_date ? new Date(t.due_date) < now : false,
      }));

    // Risk flags
    const overdueItems = outstandingItems.filter(i => i.isOverdue);
    const highPriorityOutstanding = outstandingItems.filter(i => i.priority === 'high' || i.priority === 'critical');
    const unassignedItems = outstandingItems.filter(i => !i.assignedTo);

    const riskFlags = [];
    if (overdueItems.length > 0) {
      riskFlags.push({
        type: 'overdue',
        severity: 'high',
        message: `${overdueItems.length} overdue item${overdueItems.length > 1 ? 's' : ''}`,
        count: overdueItems.length,
      });
    }
    if (highPriorityOutstanding.length > 0) {
      riskFlags.push({
        type: 'high_priority_pending',
        severity: 'medium',
        message: `${highPriorityOutstanding.length} high/critical priority item${highPriorityOutstanding.length > 1 ? 's' : ''} still outstanding`,
        count: highPriorityOutstanding.length,
      });
    }
    if (unassignedItems.length > 0) {
      riskFlags.push({
        type: 'unassigned',
        severity: 'low',
        message: `${unassignedItems.length} item${unassignedItems.length > 1 ? 's' : ''} without assignee`,
        count: unassignedItems.length,
      });
    }
    if (project.dd_expiration) {
      const ddExp = new Date(project.dd_expiration);
      const daysUntilExpiry = Math.ceil((ddExp.getTime() - now.getTime()) / 86400000);
      if (daysUntilExpiry < 0) {
        riskFlags.push({
          type: 'dd_expired',
          severity: 'critical',
          message: `DD period expired ${Math.abs(daysUntilExpiry)} days ago`,
          count: Math.abs(daysUntilExpiry),
        });
      } else if (daysUntilExpiry <= 7) {
        riskFlags.push({
          type: 'dd_expiring_soon',
          severity: 'high',
          message: `DD period expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
          count: daysUntilExpiry,
        });
      }
    }

    res.json({
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        ddExpiration: project.dd_expiration,
        closingDate: project.closing_date,
      },
      overallCompletion,
      totalTasks,
      completedTasks,
      categories,
      outstandingItems,
      riskFlags,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating DD status report:', error);
    res.status(500).json({ error: 'Failed to generate status report' });
  }
});

export default router;
