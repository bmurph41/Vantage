import { db } from '../db';
import { 
  modelingCommentThreads,
  modelingComments,
  modelingAuditLog,
  users
} from '@shared/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

export interface CreateThreadInput {
  scenarioVersionId?: string;
  targetType: 'scenario' | 'metric' | 'assumption' | 'line_item';
  targetId?: string;
  targetLabel?: string;
  initialComment: string;
}

export interface AddCommentInput {
  threadId: string;
  content: string;
  mentions?: string[];
}

export interface ThreadWithComments {
  id: string;
  scenarioVersionId?: string;
  targetType: string;
  targetId?: string;
  targetLabel?: string;
  status: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  comments: Array<{
    id: string;
    content: string;
    mentions?: string[];
    isEdited: boolean;
    editedAt?: string;
    createdBy: string;
    createdByName?: string;
    createdAt: string;
  }>;
  commentCount: number;
}

export class CommentThreadsService {
  async createThread(
    projectId: string,
    orgId: string,
    userId: string,
    input: CreateThreadInput
  ): Promise<string> {
    const [thread] = await db.insert(modelingCommentThreads).values({
      orgId,
      modelingProjectId: projectId,
      scenarioVersionId: input.scenarioVersionId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel,
      createdBy: userId,
      status: 'open'
    }).returning();

    await db.insert(modelingComments).values({
      threadId: thread.id,
      content: input.initialComment,
      createdBy: userId
    });

    await this.logAuditEvent(projectId, orgId, userId, 'comment_thread_created', {
      threadId: thread.id,
      targetType: input.targetType,
      targetLabel: input.targetLabel
    });

    return thread.id;
  }

  async addComment(
    orgId: string,
    userId: string,
    input: AddCommentInput
  ): Promise<string> {
    const [thread] = await db.select()
      .from(modelingCommentThreads)
      .where(and(
        eq(modelingCommentThreads.id, input.threadId),
        eq(modelingCommentThreads.orgId, orgId)
      ))
      .limit(1);

    if (!thread) {
      throw new Error('Thread not found');
    }

    if (thread.status === 'archived') {
      throw new Error('Cannot add comments to archived thread');
    }

    const [comment] = await db.insert(modelingComments).values({
      threadId: input.threadId,
      content: input.content,
      mentions: input.mentions,
      createdBy: userId
    }).returning();

    await db.update(modelingCommentThreads)
      .set({ updatedAt: new Date() })
      .where(eq(modelingCommentThreads.id, input.threadId));

    return comment.id;
  }

  async editComment(
    commentId: string,
    orgId: string,
    userId: string,
    newContent: string
  ): Promise<void> {
    const [comment] = await db.select({
      comment: modelingComments,
      thread: modelingCommentThreads
    })
      .from(modelingComments)
      .innerJoin(modelingCommentThreads, eq(modelingComments.threadId, modelingCommentThreads.id))
      .where(and(
        eq(modelingComments.id, commentId),
        eq(modelingCommentThreads.orgId, orgId)
      ))
      .limit(1);

    if (!comment) {
      throw new Error('Comment not found');
    }

    if (comment.comment.createdBy !== userId) {
      throw new Error('You can only edit your own comments');
    }

    await db.update(modelingComments)
      .set({
        content: newContent,
        isEdited: true,
        editedAt: new Date()
      })
      .where(eq(modelingComments.id, commentId));
  }

  async resolveThread(
    threadId: string,
    orgId: string,
    userId: string
  ): Promise<void> {
    const [thread] = await db.select()
      .from(modelingCommentThreads)
      .where(and(
        eq(modelingCommentThreads.id, threadId),
        eq(modelingCommentThreads.orgId, orgId)
      ))
      .limit(1);

    if (!thread) {
      throw new Error('Thread not found');
    }

    await db.update(modelingCommentThreads)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(modelingCommentThreads.id, threadId));

    await this.logAuditEvent(thread.modelingProjectId, orgId, userId, 'comment_thread_resolved', {
      threadId,
      targetType: thread.targetType,
      targetLabel: thread.targetLabel
    });
  }

  async reopenThread(
    threadId: string,
    orgId: string,
    userId: string
  ): Promise<void> {
    await db.update(modelingCommentThreads)
      .set({
        status: 'open',
        resolvedBy: null,
        resolvedAt: null,
        updatedAt: new Date()
      })
      .where(and(
        eq(modelingCommentThreads.id, threadId),
        eq(modelingCommentThreads.orgId, orgId)
      ));
  }

  async archiveThread(
    threadId: string,
    orgId: string,
    userId: string
  ): Promise<void> {
    await db.update(modelingCommentThreads)
      .set({
        status: 'archived',
        updatedAt: new Date()
      })
      .where(and(
        eq(modelingCommentThreads.id, threadId),
        eq(modelingCommentThreads.orgId, orgId)
      ));
  }

  async getThread(
    threadId: string,
    orgId: string
  ): Promise<ThreadWithComments | null> {
    const [thread] = await db.select({
      thread: modelingCommentThreads,
      creatorName: users.username
    })
      .from(modelingCommentThreads)
      .leftJoin(users, eq(modelingCommentThreads.createdBy, users.id))
      .where(and(
        eq(modelingCommentThreads.id, threadId),
        eq(modelingCommentThreads.orgId, orgId)
      ))
      .limit(1);

    if (!thread) return null;

    const comments = await db.select({
      comment: modelingComments,
      creatorName: users.username
    })
      .from(modelingComments)
      .leftJoin(users, eq(modelingComments.createdBy, users.id))
      .where(eq(modelingComments.threadId, threadId))
      .orderBy(modelingComments.createdAt);

    return {
      id: thread.thread.id,
      scenarioVersionId: thread.thread.scenarioVersionId || undefined,
      targetType: thread.thread.targetType,
      targetId: thread.thread.targetId || undefined,
      targetLabel: thread.thread.targetLabel || undefined,
      status: thread.thread.status,
      resolvedBy: thread.thread.resolvedBy || undefined,
      resolvedAt: thread.thread.resolvedAt?.toISOString(),
      createdBy: thread.thread.createdBy,
      createdByName: thread.creatorName || undefined,
      createdAt: thread.thread.createdAt.toISOString(),
      comments: comments.map(c => ({
        id: c.comment.id,
        content: c.comment.content,
        mentions: (c.comment.mentions as string[]) || undefined,
        isEdited: c.comment.isEdited || false,
        editedAt: c.comment.editedAt?.toISOString(),
        createdBy: c.comment.createdBy,
        createdByName: c.creatorName || undefined,
        createdAt: c.comment.createdAt.toISOString()
      })),
      commentCount: comments.length
    };
  }

  async getProjectThreads(
    projectId: string,
    orgId: string,
    options?: { 
      scenarioVersionId?: string; 
      status?: 'open' | 'resolved' | 'archived';
      targetType?: string;
    }
  ): Promise<ThreadWithComments[]> {
    let query = db.select({
      thread: modelingCommentThreads,
      creatorName: users.username
    })
      .from(modelingCommentThreads)
      .leftJoin(users, eq(modelingCommentThreads.createdBy, users.id))
      .where(and(
        eq(modelingCommentThreads.modelingProjectId, projectId),
        eq(modelingCommentThreads.orgId, orgId)
      ))
      .orderBy(desc(modelingCommentThreads.updatedAt));

    const threads = await query;

    const results: ThreadWithComments[] = [];
    
    for (const t of threads) {
      if (options?.scenarioVersionId && t.thread.scenarioVersionId !== options.scenarioVersionId) continue;
      if (options?.status && t.thread.status !== options.status) continue;
      if (options?.targetType && t.thread.targetType !== options.targetType) continue;

      const full = await this.getThread(t.thread.id, orgId);
      if (full) results.push(full);
    }

    return results;
  }

  async getThreadsForScenario(
    scenarioVersionId: string,
    orgId: string
  ): Promise<ThreadWithComments[]> {
    const threads = await db.select()
      .from(modelingCommentThreads)
      .where(and(
        eq(modelingCommentThreads.scenarioVersionId, scenarioVersionId),
        eq(modelingCommentThreads.orgId, orgId)
      ))
      .orderBy(desc(modelingCommentThreads.updatedAt));

    const results: ThreadWithComments[] = [];
    for (const thread of threads) {
      const full = await this.getThread(thread.id, orgId);
      if (full) results.push(full);
    }

    return results;
  }

  async getUnresolvedCount(
    projectId: string,
    orgId: string
  ): Promise<{ total: number; byScenario: Record<string, number> }> {
    const threads = await db.select()
      .from(modelingCommentThreads)
      .where(and(
        eq(modelingCommentThreads.modelingProjectId, projectId),
        eq(modelingCommentThreads.orgId, orgId),
        eq(modelingCommentThreads.status, 'open')
      ));

    const byScenario: Record<string, number> = {};
    for (const thread of threads) {
      if (thread.scenarioVersionId) {
        byScenario[thread.scenarioVersionId] = (byScenario[thread.scenarioVersionId] || 0) + 1;
      }
    }

    return {
      total: threads.length,
      byScenario
    };
  }

  private async logAuditEvent(
    projectId: string,
    orgId: string,
    userId: string,
    eventType: string,
    details: any
  ): Promise<void> {
    await db.insert(modelingAuditLog).values({
      orgId,
      modelingProjectId: projectId,
      eventType,
      entityType: 'comment',
      entityId: details.threadId,
      newValue: details,
      userId
    });
  }
}

export const commentThreadsService = new CommentThreadsService();
