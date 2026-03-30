import { Router } from 'express';
import { db } from '../db';
import { 
  crmCommentThreads, 
  crmComments, 
  crmNotifications,
  crmNotificationPreferences,
  users,
  insertCrmCommentThreadSchema,
  updateCrmCommentThreadSchema,
  insertCrmCommentSchema,
  updateCrmCommentSchema,
  insertCrmNotificationSchema,
} from '@shared/schema';
import { eq, and, desc, isNull, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';

export function registerCommentRoutes(app: Router) {
  const router = Router();

  // Thread routes
  router.get('/threads', async (req, res) => {
    try {
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;
      const { entityType, entityId, status } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const threads = await db.query.crmCommentThreads.findMany({
        where: and(
          eq(crmCommentThreads.orgId, orgId),
          entityType ? eq(crmCommentThreads.entityType, entityType as string) : undefined,
          entityId ? eq(crmCommentThreads.entityId, entityId as string) : undefined,
          status ? eq(crmCommentThreads.status, status as string) : undefined
        ),
        orderBy: [desc(crmCommentThreads.isPinned), desc(crmCommentThreads.updatedAt)],
        with: {
          creator: { columns: { id: true, firstName: true, lastName: true, email: true } },
          comments: {
            orderBy: [desc(crmComments.createdAt)],
            limit: 1,
            with: {
              creator: { columns: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
        limit: 100,
      });

      const threadsWithCounts = await Promise.all(threads.map(async (thread) => {
        const countResult = await db.select({ count: sql<number>`count(*)::int` })
          .from(crmComments)
          .where(eq(crmComments.threadId, thread.id));
        return {
          ...thread,
          commentCount: countResult[0]?.count || 0,
        };
      }));

      res.json(threadsWithCounts);
    } catch (error) {
      console.error('Error fetching comment threads:', error);
      res.status(500).json({ error: 'Failed to fetch comment threads' });
    }
  });

  router.get('/threads/:threadId', async (req, res) => {
    try {
      const { threadId } = req.params;
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const thread = await db.query.crmCommentThreads.findFirst({
        where: and(eq(crmCommentThreads.id, threadId), eq(crmCommentThreads.orgId, orgId)),
        with: {
          creator: { columns: { id: true, firstName: true, lastName: true, email: true } },
          resolver: { columns: { id: true, firstName: true, lastName: true, email: true } },
          comments: {
            orderBy: [desc(crmComments.createdAt)],
            with: {
              creator: { columns: { id: true, firstName: true, lastName: true, email: true } },
            },
          },
        },
      });

      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json(thread);
    } catch (error) {
      console.error('Error fetching thread:', error);
      res.status(500).json({ error: 'Failed to fetch thread' });
    }
  });

  router.post('/threads', async (req, res) => {
    try {
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const validatedData = insertCrmCommentThreadSchema.parse({
        ...req.body,
        orgId,
        createdBy: userId,
      });

      const [thread] = await db.insert(crmCommentThreads).values(validatedData).returning();
      res.status(201).json(thread);
    } catch (error) {
      console.error('Error creating thread:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create thread' });
    }
  });

  router.patch('/threads/:threadId', async (req, res) => {
    try {
      const { threadId } = req.params;
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validatedData = updateCrmCommentThreadSchema.parse(req.body);

      const [updated] = await db.update(crmCommentThreads)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(and(eq(crmCommentThreads.id, threadId), eq(crmCommentThreads.orgId, orgId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating thread:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update thread' });
    }
  });

  router.post('/threads/:threadId/resolve', async (req, res) => {
    try {
      const { threadId } = req.params;
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const [updated] = await db.update(crmCommentThreads)
        .set({
          status: 'resolved',
          resolvedBy: userId,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(crmCommentThreads.id, threadId), eq(crmCommentThreads.orgId, orgId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error resolving thread:', error);
      res.status(500).json({ error: 'Failed to resolve thread' });
    }
  });

  router.post('/threads/:threadId/reopen', async (req, res) => {
    try {
      const { threadId } = req.params;
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const [updated] = await db.update(crmCommentThreads)
        .set({
          status: 'open',
          resolvedBy: null,
          resolvedAt: null,
          updatedAt: new Date(),
        })
        .where(and(eq(crmCommentThreads.id, threadId), eq(crmCommentThreads.orgId, orgId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error reopening thread:', error);
      res.status(500).json({ error: 'Failed to reopen thread' });
    }
  });

  router.post('/threads/:threadId/pin', async (req, res) => {
    try {
      const { threadId } = req.params;
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;
      const { isPinned } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const [updated] = await db.update(crmCommentThreads)
        .set({ isPinned, updatedAt: new Date() })
        .where(and(eq(crmCommentThreads.id, threadId), eq(crmCommentThreads.orgId, orgId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error pinning thread:', error);
      res.status(500).json({ error: 'Failed to pin thread' });
    }
  });

  // Comment routes
  router.get('/threads/:threadId/comments', async (req, res) => {
    try {
      const { threadId } = req.params;
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const thread = await db.query.crmCommentThreads.findFirst({
        where: and(eq(crmCommentThreads.id, threadId), eq(crmCommentThreads.orgId, orgId)),
      });

      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      const comments = await db.query.crmComments.findMany({
        where: eq(crmComments.threadId, threadId),
        orderBy: [desc(crmComments.createdAt)],
        with: {
          creator: { columns: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      res.json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  router.post('/threads/:threadId/comments', async (req, res) => {
    try {
      const { threadId } = req.params;
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const thread = await db.query.crmCommentThreads.findFirst({
        where: and(eq(crmCommentThreads.id, threadId), eq(crmCommentThreads.orgId, orgId)),
      });

      if (!thread) {
        return res.status(404).json({ error: 'Thread not found or access denied' });
      }

      const validatedData = insertCrmCommentSchema.parse({
        ...req.body,
        threadId,
        createdBy: userId,
      });

      const [comment] = await db.insert(crmComments).values(validatedData).returning();

      await db.update(crmCommentThreads)
        .set({ updatedAt: new Date() })
        .where(eq(crmCommentThreads.id, threadId));

      const mentions = (validatedData.mentions || []) as Array<{ userId: string; displayName: string }>;
      if (mentions.length > 0) {
        const notificationPromises = mentions.map(async (mention: { userId: string; displayName: string }) => {
          return db.insert(crmNotifications).values({
            orgId,
            userId: mention.userId,
            type: 'mention',
            title: 'You were mentioned in a comment',
            message: `Someone mentioned you in a discussion`,
            entityType: thread.entityType,
            entityId: thread.entityId,
            threadId,
            commentId: comment.id,
            triggeredBy: userId,
          });
        });
        await Promise.all(notificationPromises);
      }

      res.status(201).json(comment);
    } catch (error) {
      console.error('Error creating comment:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  router.patch('/comments/:commentId', async (req, res) => {
    try {
      const { commentId } = req.params;
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const comment = await db.query.crmComments.findFirst({
        where: eq(crmComments.id, commentId),
        with: { thread: true },
      });

      if (!comment || comment.thread?.orgId !== orgId) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.createdBy !== userId) {
        return res.status(403).json({ error: 'Not authorized to edit this comment' });
      }

      const validatedData = updateCrmCommentSchema.parse(req.body);

      const [updated] = await db.update(crmComments)
        .set({ ...validatedData, isEdited: true, editedAt: new Date() })
        .where(eq(crmComments.id, commentId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Error updating comment:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update comment' });
    }
  });

  router.delete('/comments/:commentId', async (req, res) => {
    try {
      const { commentId } = req.params;
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const comment = await db.query.crmComments.findFirst({
        where: eq(crmComments.id, commentId),
        with: { thread: true },
      });

      if (!comment || comment.thread?.orgId !== orgId) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      if (comment.createdBy !== userId) {
        return res.status(403).json({ error: 'Not authorized to delete this comment' });
      }

      await db.delete(crmComments).where(eq(crmComments.id, commentId));
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  });

  // Notification routes
  router.get('/notifications', async (req, res) => {
    try {
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;
      const { unreadOnly, type, limit: limitParam } = req.query;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const notifications = await db.query.crmNotifications.findMany({
        where: and(
          eq(crmNotifications.orgId, orgId),
          eq(crmNotifications.userId, userId),
          unreadOnly === 'true' ? eq(crmNotifications.isRead, false) : undefined,
          type ? eq(crmNotifications.type, type as string) : undefined
        ),
        orderBy: [desc(crmNotifications.createdAt)],
        with: {
          triggerer: { columns: { id: true, firstName: true, lastName: true, email: true } },
        },
        limit: parseInt(limitParam as string) || 50,
      });

      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  router.get('/notifications/unread-count', async (req, res) => {
    try {
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const result = await db.select({ count: sql<number>`count(*)::int` })
        .from(crmNotifications)
        .where(and(
          eq(crmNotifications.orgId, orgId),
          eq(crmNotifications.userId, userId),
          eq(crmNotifications.isRead, false)
        ));

      res.json({ unreadCount: result[0]?.count || 0 });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  router.post('/notifications/:notificationId/read', async (req, res) => {
    try {
      const { notificationId } = req.params;
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      const [updated] = await db.update(crmNotifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(crmNotifications.id, notificationId),
          eq(crmNotifications.orgId, orgId),
          eq(crmNotifications.userId, userId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  router.post('/notifications/mark-all-read', async (req, res) => {
    try {
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      await db.update(crmNotifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(crmNotifications.orgId, orgId),
          eq(crmNotifications.userId, userId),
          eq(crmNotifications.isRead, false)
        ));

      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  // User search for @mentions
  router.get('/users/search', async (req, res) => {
    try {
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const { q } = req.query;

      if (!q || (q as string).length < 2) {
        return res.json([]);
      }

      const searchTerm = `%${(q as string).toLowerCase()}%`;
      const foundUsers = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
        .from(users)
        .where(sql`(LOWER(${users.firstName}) LIKE ${searchTerm} OR LOWER(${users.lastName}) LIKE ${searchTerm} OR LOWER(${users.email}) LIKE ${searchTerm})`)
        .limit(10);

      res.json(foundUsers);
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  // Notification preferences
  router.get('/notification-preferences', async (req, res) => {
    try {
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const preferences = await db.query.crmNotificationPreferences.findMany({
        where: and(
          eq(crmNotificationPreferences.orgId, orgId),
          eq(crmNotificationPreferences.userId, userId)
        ),
      });

      res.json(preferences);
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      res.status(500).json({ error: 'Failed to fetch notification preferences' });
    }
  });

  router.put('/notification-preferences', async (req, res) => {
    try {
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || req.headers['x-org-id'] as string || null;
      const userId = req.headers['x-user-id'] as string;
      const { notificationType, inApp, email, emailDigest } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const existing = await db.query.crmNotificationPreferences.findFirst({
        where: and(
          eq(crmNotificationPreferences.orgId, orgId),
          eq(crmNotificationPreferences.userId, userId),
          eq(crmNotificationPreferences.notificationType, notificationType)
        ),
      });

      if (existing) {
        const [updated] = await db.update(crmNotificationPreferences)
          .set({ inApp, email, emailDigest, updatedAt: new Date() })
          .where(eq(crmNotificationPreferences.id, existing.id))
          .returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(crmNotificationPreferences)
          .values({ orgId, userId, notificationType, inApp, email, emailDigest })
          .returning();
        res.status(201).json(created);
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({ error: 'Failed to update notification preferences' });
    }
  });

  app.use('/api/comments', router);
}
