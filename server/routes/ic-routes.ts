/**
 * Investment Committee Routes
 *
 * CRUD APIs for IC committee members, memos, votes, and comments.
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

const router = Router();

async function getDb() {
  const { db } = await import('../db');
  return db;
}

async function getSchema() {
  return import('@shared/schema');
}

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.claims?.sub || null;
}

function getOrgId(req: Request): string | null {
  return (req as any).orgId || (req as any).user?.orgId || null;
}

// ============================================================================
// COMMITTEE MEMBERS
// ============================================================================

// GET /members - list committee members for org
router.get('/members', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const activeOnly = req.query.active !== 'false';
    const conditions = [eq(schema.icCommitteeMembers.orgId, orgId)];
    if (activeOnly) {
      conditions.push(eq(schema.icCommitteeMembers.isActive, true));
    }

    const members = await db
      .select()
      .from(schema.icCommitteeMembers)
      .where(and(...conditions))
      .orderBy(asc(schema.icCommitteeMembers.role));

    res.json(members);
  } catch (error) {
    console.error('Error fetching IC members:', error);
    res.status(500).json({ error: 'Failed to fetch committee members' });
  }
});

// POST /members - add member
router.post('/members', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [member] = await db
      .insert(schema.icCommitteeMembers)
      .values({
        ...req.body,
        orgId,
      })
      .returning();

    res.status(201).json(member);
  } catch (error) {
    console.error('Error creating IC member:', error);
    res.status(500).json({ error: 'Failed to create committee member' });
  }
});

// PATCH /members/:id - update member
router.patch('/members/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.icCommitteeMembers)
      .set({ ...req.body, updatedAt: new Date() })
      .where(
        and(
          eq(schema.icCommitteeMembers.id, req.params.id),
          eq(schema.icCommitteeMembers.orgId, orgId)
        )
      )
      .returning();

    if (!updated) return res.status(404).json({ error: 'Member not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating IC member:', error);
    res.status(500).json({ error: 'Failed to update committee member' });
  }
});

// DELETE /members/:id - deactivate member (soft delete)
router.delete('/members/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [deactivated] = await db
      .update(schema.icCommitteeMembers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(schema.icCommitteeMembers.id, req.params.id),
          eq(schema.icCommitteeMembers.orgId, orgId)
        )
      )
      .returning();

    if (!deactivated) return res.status(404).json({ error: 'Member not found' });
    res.json({ success: true, member: deactivated });
  } catch (error) {
    console.error('Error deactivating IC member:', error);
    res.status(500).json({ error: 'Failed to deactivate committee member' });
  }
});

// ============================================================================
// MEMOS
// ============================================================================

// GET /memos - list memos (filter by status, project)
router.get('/memos', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const conditions = [eq(schema.icMemos.orgId, orgId)];

    if (req.query.status) {
      conditions.push(eq(schema.icMemos.status, req.query.status as string));
    }
    if (req.query.projectId) {
      conditions.push(eq(schema.icMemos.modelingProjectId, req.query.projectId as string));
    }

    const memos = await db
      .select()
      .from(schema.icMemos)
      .where(and(...conditions))
      .orderBy(desc(schema.icMemos.createdAt));

    res.json(memos);
  } catch (error) {
    console.error('Error fetching IC memos:', error);
    res.status(500).json({ error: 'Failed to fetch memos' });
  }
});

// POST /memos - create memo
router.post('/memos', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const parsed = schema.insertIcMemoSchema.parse(req.body);

    // Generate memo number
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.icMemos)
      .where(eq(schema.icMemos.orgId, orgId));

    const memoNumber = `IC-${new Date().getFullYear()}-${String((countResult?.count || 0) + 1).padStart(3, '0')}`;

    const [memo] = await db
      .insert(schema.icMemos)
      .values({
        ...parsed,
        orgId,
        createdBy: userId,
        memoNumber,
      })
      .returning();

    res.status(201).json(memo);
  } catch (error) {
    console.error('Error creating IC memo:', error);
    res.status(500).json({ error: 'Failed to create memo' });
  }
});

// GET /memos/:id - get memo with votes and comments
router.get('/memos/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [memo] = await db
      .select()
      .from(schema.icMemos)
      .where(
        and(
          eq(schema.icMemos.id, req.params.id),
          eq(schema.icMemos.orgId, orgId)
        )
      );

    if (!memo) return res.status(404).json({ error: 'Memo not found' });

    const votes = await db
      .select()
      .from(schema.icVotes)
      .where(
        and(
          eq(schema.icVotes.memoId, req.params.id),
          eq(schema.icVotes.orgId, orgId)
        )
      )
      .orderBy(desc(schema.icVotes.votedAt));

    const comments = await db
      .select()
      .from(schema.icComments)
      .where(
        and(
          eq(schema.icComments.memoId, req.params.id),
          eq(schema.icComments.orgId, orgId)
        )
      )
      .orderBy(asc(schema.icComments.createdAt));

    res.json({ ...memo, votes, comments });
  } catch (error) {
    console.error('Error fetching IC memo:', error);
    res.status(500).json({ error: 'Failed to fetch memo' });
  }
});

// PATCH /memos/:id - update memo
router.patch('/memos/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const parsed = schema.updateIcMemoSchema.parse(req.body);

    const [updated] = await db
      .update(schema.icMemos)
      .set({ ...parsed, updatedAt: new Date() })
      .where(
        and(
          eq(schema.icMemos.id, req.params.id),
          eq(schema.icMemos.orgId, orgId)
        )
      )
      .returning();

    if (!updated) return res.status(404).json({ error: 'Memo not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating IC memo:', error);
    res.status(500).json({ error: 'Failed to update memo' });
  }
});

// POST /memos/:id/submit - submit memo for review
router.post('/memos/:id/submit', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    // Verify memo exists and is in draft status
    const [memo] = await db
      .select()
      .from(schema.icMemos)
      .where(
        and(
          eq(schema.icMemos.id, req.params.id),
          eq(schema.icMemos.orgId, orgId)
        )
      );

    if (!memo) return res.status(404).json({ error: 'Memo not found' });
    if (memo.status !== 'draft' && memo.status !== 'revision_requested') {
      return res.status(400).json({ error: `Cannot submit memo with status '${memo.status}'` });
    }

    // Set review deadline (default 7 days from now)
    const reviewDeadline = req.body.reviewDeadline
      ? new Date(req.body.reviewDeadline)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [updated] = await db
      .update(schema.icMemos)
      .set({
        status: 'pending_review',
        submittedAt: new Date(),
        submittedBy: userId,
        reviewDeadline,
        updatedAt: new Date(),
      })
      .where(eq(schema.icMemos.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error submitting IC memo:', error);
    res.status(500).json({ error: 'Failed to submit memo' });
  }
});

// ============================================================================
// VOTES
// ============================================================================

// POST /memos/:id/votes - cast vote
router.post('/memos/:id/votes', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    // Verify memo is under review
    const [memo] = await db
      .select()
      .from(schema.icMemos)
      .where(
        and(
          eq(schema.icMemos.id, req.params.id),
          eq(schema.icMemos.orgId, orgId)
        )
      );

    if (!memo) return res.status(404).json({ error: 'Memo not found' });
    if (memo.status !== 'pending_review' && memo.status !== 'under_review') {
      return res.status(400).json({ error: 'Memo is not open for voting' });
    }

    const parsed = schema.insertIcVoteSchema.parse({
      ...req.body,
      memoId: req.params.id,
      userId,
    });

    const [vote] = await db
      .insert(schema.icVotes)
      .values({
        ...parsed,
        orgId,
      })
      .onConflictDoUpdate({
        target: [schema.icVotes.memoId, schema.icVotes.memberId],
        set: {
          vote: parsed.vote,
          comments: parsed.comments,
          conditions: parsed.conditions,
          votedAt: new Date(),
        },
      })
      .returning();

    // Update memo status to under_review if first vote
    if (memo.status === 'pending_review') {
      await db
        .update(schema.icMemos)
        .set({ status: 'under_review', updatedAt: new Date() })
        .where(eq(schema.icMemos.id, req.params.id));
    }

    // Check if voting is complete (all required members voted or enough approvals)
    const allVotes = await db
      .select()
      .from(schema.icVotes)
      .where(eq(schema.icVotes.memoId, req.params.id));

    const approvals = allVotes.filter(
      (v) => v.vote === 'approve' || v.vote === 'conditional_approve'
    ).length;
    const rejections = allVotes.filter((v) => v.vote === 'reject').length;

    if (approvals >= (memo.approvalsRequired || 2)) {
      await db
        .update(schema.icMemos)
        .set({ status: 'approved', approvedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.icMemos.id, req.params.id));
    } else if (rejections > allVotes.length - (memo.approvalsRequired || 2)) {
      await db
        .update(schema.icMemos)
        .set({ status: 'rejected', rejectedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.icMemos.id, req.params.id));
    }

    res.status(201).json(vote);
  } catch (error) {
    console.error('Error casting IC vote:', error);
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

// GET /memos/:id/votes - get votes for memo
router.get('/memos/:id/votes', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const votes = await db
      .select()
      .from(schema.icVotes)
      .where(
        and(
          eq(schema.icVotes.memoId, req.params.id),
          eq(schema.icVotes.orgId, orgId)
        )
      )
      .orderBy(desc(schema.icVotes.votedAt));

    res.json(votes);
  } catch (error) {
    console.error('Error fetching IC votes:', error);
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// ============================================================================
// COMMENTS
// ============================================================================

// POST /memos/:id/comments - add comment
router.post('/memos/:id/comments', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const parsed = schema.insertIcCommentSchema.parse({
      ...req.body,
      memoId: req.params.id,
      userId,
    });

    const [comment] = await db
      .insert(schema.icComments)
      .values({
        ...parsed,
        orgId,
      })
      .returning();

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating IC comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// GET /memos/:id/comments - list comments for memo
router.get('/memos/:id/comments', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const comments = await db
      .select()
      .from(schema.icComments)
      .where(
        and(
          eq(schema.icComments.memoId, req.params.id),
          eq(schema.icComments.orgId, orgId)
        )
      )
      .orderBy(asc(schema.icComments.createdAt));

    res.json(comments);
  } catch (error) {
    console.error('Error fetching IC comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// PATCH /comments/:id/resolve - resolve comment
router.patch('/comments/:id/resolve', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [resolved] = await db
      .update(schema.icComments)
      .set({
        isResolved: true,
        resolvedBy: userId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.icComments.id, req.params.id),
          eq(schema.icComments.orgId, orgId)
        )
      )
      .returning();

    if (!resolved) return res.status(404).json({ error: 'Comment not found' });
    res.json(resolved);
  } catch (error) {
    console.error('Error resolving IC comment:', error);
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

export default router;
