/**
 * Prospecting Time Blocks Routes
 * CRUD + Google Calendar push for broker time-block scheduling
 */
import { Router, Response } from 'express';
import { pool } from '../db';
import type { AuthenticatedRequest } from '../middleware/auth-resolver';
import { createCalendarEvent } from '../lib/google-calendar';

const router = Router();

function getOrgUser(req: AuthenticatedRequest): { orgId: string; userId: string } {
  const orgId = req.user?.orgId ?? req.orgId;
  const userId = req.user?.id;
  if (!orgId || !userId) throw new Error('Unauthorized');
  return { orgId, userId };
}

async function notifyInvitees(
  invitedUserIds: string[],
  orgId: string,
  triggeredBy: string,
  blockId: string,
  blockTitle: string
): Promise<void> {
  if (!invitedUserIds || invitedUserIds.length === 0) return;
  const values = invitedUserIds.map((uid) => [
    orgId,
    uid,
    'assignment',
    'You have been invited to a time block',
    `${blockTitle} — you were added as an invitee to this time block.`,
    'prospecting_time_block',
    blockId,
    triggeredBy,
  ]);
  for (const row of values) {
    await pool.query(
      `INSERT INTO crm_notifications
         (org_id, user_id, type, title, message, entity_type, entity_id, triggered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      row
    );
  }
}

// GET /api/prospecting/time-blocks?start=ISO&end=ISO
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orgId } = getOrgUser(req);
    const { start, end } = req.query;

    const startDate = start
      ? new Date(start as string)
      : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    const endDate = end
      ? new Date(end as string)
      : (() => { const d = new Date(startDate); d.setDate(d.getDate() + 7); return d; })();

    const { rows } = await pool.query(
      `SELECT b.*,
              u.name  AS creator_name,
              u.email AS creator_email
       FROM prospecting_time_blocks b
       JOIN users u ON u.id = b.created_by
       WHERE b.org_id = $1
         AND b.start_at < $3
         AND b.end_at   > $2
       ORDER BY b.start_at ASC`,
      [orgId, startDate.toISOString(), endDate.toISOString()]
    );

    res.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    res.status(msg === 'Unauthorized' ? 401 : 500).json({ error: msg });
  }
});

// POST /api/prospecting/time-blocks
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orgId, userId } = getOrgUser(req);
    const {
      title,
      blockType = 'prospecting_call',
      startAt,
      endAt,
      notes,
      color = '#3b82f6',
      invitedUserIds = [],
      pushToCalendar = false,
    } = req.body as {
      title: string; blockType?: string; startAt: string; endAt: string;
      notes?: string; color?: string; invitedUserIds?: string[]; pushToCalendar?: boolean;
    };

    const VALID_BLOCK_TYPES = [
      'prospecting_call', 'site_tour', 'loi_review', 'team_meeting', 'admin', 'other',
    ];
    if (!title || !startAt || !endAt) {
      return res.status(400).json({ error: 'title, startAt, endAt are required' });
    }
    const resolvedBlockType = VALID_BLOCK_TYPES.includes(blockType) ? blockType : 'other';
    const startMs = new Date(startAt).getTime();
    const endMs = new Date(endAt).getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      return res.status(400).json({ error: 'endAt must be after startAt' });
    }

    // Validate invitees belong to the same org (pre-filter to UUID-format strings)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let safeInvitees: string[] = [...invitedUserIds].filter((id) => UUID_RE.test(id));
    if (safeInvitees.length > 0) {
      const { rows: validUsers } = await pool.query(
        `SELECT id::text FROM users WHERE id::text = ANY($1::text[]) AND org_id = $2`,
        [safeInvitees, orgId]
      );
      const validIds = validUsers.map((u: { id: string }) => u.id);
      safeInvitees = safeInvitees.filter((id) => validIds.includes(id));
    }

    const { rows: [block] } = await pool.query(
      `INSERT INTO prospecting_time_blocks
         (org_id, created_by, title, block_type, start_at, end_at, notes, color, invited_user_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [orgId, userId, title, resolvedBlockType, startAt, endAt, notes ?? null, color, JSON.stringify(safeInvitees)]
    );

    // Notify invited team members
    if (safeInvitees.length > 0) {
      await notifyInvitees(safeInvitees, orgId, userId, block.id, title);
    }

    // Optionally push to Google Calendar immediately
    if (pushToCalendar) {
      try {
        const attendeeEmails = await getEmailsForUserIds(invitedUserIds, orgId);
        const calEvent = await createCalendarEvent({
          title: `[Time Block] ${title}`,
          description: notes ?? '',
          startDate: startAt,
          endDate: endAt,
          attendees: attendeeEmails,
        });
        await pool.query(
          `UPDATE prospecting_time_blocks
           SET google_calendar_event_id = $1, synced_to_calendar = true
           WHERE id = $2`,
          [calEvent.id, block.id]
        );
        block.google_calendar_event_id = calEvent.id;
        block.synced_to_calendar = true;
        block.calendar_link = calEvent.htmlLink;
      } catch (calErr) {
        console.warn('[time-blocks] Calendar push failed (non-fatal):', calErr);
      }
    }

    res.status(201).json(block);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    res.status(msg === 'Unauthorized' ? 401 : 500).json({ error: msg });
  }
});

// PATCH /api/prospecting/time-blocks/:id
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orgId, userId } = getOrgUser(req);
    const { id } = req.params;
    const { title, blockType, startAt, endAt, notes, color, invitedUserIds } = req.body as {
      title?: string; blockType?: string; startAt?: string; endAt?: string;
      notes?: string; color?: string; invitedUserIds?: string[];
    };

    const { rows: [existing] } = await pool.query(
      `SELECT id, invited_user_ids, title, start_at, end_at FROM prospecting_time_blocks WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Block not found' });

    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const addField = (col: string, val: unknown) => {
      updates.push(`${col} = $${idx++}`);
      params.push(val);
    };

    const VALID_BLOCK_TYPES = [
      'prospecting_call', 'site_tour', 'loi_review', 'team_meeting', 'admin', 'other',
    ];

    // Validate interval using effective values (incoming or existing row)
    {
      const effStart = startAt ?? existing.start_at;
      const effEnd   = endAt   ?? existing.end_at;
      const sMs = new Date(effStart).getTime();
      const eMs = new Date(effEnd).getTime();
      if (isNaN(sMs) || isNaN(eMs) || eMs <= sMs) {
        return res.status(400).json({ error: 'endAt must be after startAt' });
      }
    }

    // Validate invitees belong to the same org (pre-filter to UUID-format strings)
    const UUID_RE2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let safeInvitees = invitedUserIds
      ? [...invitedUserIds].filter((id) => UUID_RE2.test(id))
      : undefined;
    if (safeInvitees && safeInvitees.length > 0) {
      const { rows: validUsers } = await pool.query(
        `SELECT id::text FROM users WHERE id::text = ANY($1::text[]) AND org_id = $2`,
        [safeInvitees, orgId]
      );
      const validIds = validUsers.map((u: { id: string }) => u.id);
      safeInvitees = safeInvitees.filter((id) => validIds.includes(id));
    }

    if (title !== undefined) addField('title', title);
    if (blockType !== undefined) addField('block_type', VALID_BLOCK_TYPES.includes(blockType) ? blockType : 'other');
    if (startAt !== undefined) addField('start_at', startAt);
    if (endAt !== undefined) addField('end_at', endAt);
    if (notes !== undefined) addField('notes', notes);
    if (color !== undefined) addField('color', color);
    if (safeInvitees !== undefined) addField('invited_user_ids', JSON.stringify(safeInvitees));
    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    const { rows: [updated] } = await pool.query(
      `UPDATE prospecting_time_blocks SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    // Notify newly added invitees
    if (safeInvitees && safeInvitees.length > 0) {
      const prevIds: string[] = Array.isArray(existing.invited_user_ids) ? existing.invited_user_ids : [];
      const newInvitees = safeInvitees.filter((uid: string) => !prevIds.includes(uid));
      if (newInvitees.length > 0) {
        await notifyInvitees(newInvitees, orgId, userId, id, updated.title ?? existing.title);
      }
    }

    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    res.status(msg === 'Unauthorized' ? 401 : 500).json({ error: msg });
  }
});

// DELETE /api/prospecting/time-blocks/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orgId } = getOrgUser(req);
    const { rows } = await pool.query(
      `DELETE FROM prospecting_time_blocks WHERE id = $1 AND org_id = $2 RETURNING id`,
      [req.params.id, orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Block not found' });
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    res.status(msg === 'Unauthorized' ? 401 : 500).json({ error: msg });
  }
});

// POST /api/prospecting/time-blocks/:id/push-calendar
router.post('/:id/push-calendar', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orgId } = getOrgUser(req);
    const { rows: [block] } = await pool.query(
      `SELECT * FROM prospecting_time_blocks WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );
    if (!block) return res.status(404).json({ error: 'Block not found' });
    if (block.synced_to_calendar) {
      return res.status(409).json({
        error: 'Block already synced to calendar',
        calendarEventId: block.google_calendar_event_id,
      });
    }

    const invitedIds: string[] = Array.isArray(block.invited_user_ids) ? block.invited_user_ids : [];
    const attendeeEmails = await getEmailsForUserIds(invitedIds, orgId);

    const calEvent = await createCalendarEvent({
      title: `[Time Block] ${block.title}`,
      description: block.notes ?? '',
      startDate: block.start_at,
      endDate: block.end_at,
      attendees: attendeeEmails,
    });

    await pool.query(
      `UPDATE prospecting_time_blocks
       SET google_calendar_event_id = $1, synced_to_calendar = true, updated_at = NOW()
       WHERE id = $2`,
      [calEvent.id, block.id]
    );

    res.json({ success: true, calendarEventId: calEvent.id, calendarLink: calEvent.htmlLink });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    if (msg.includes('not connected')) {
      return res.status(503).json({
        error: 'Google Calendar not connected. Connect it in Settings > Integrations.',
      });
    }
    res.status(msg === 'Unauthorized' ? 401 : 500).json({ error: msg });
  }
});

// POST /api/prospecting/time-blocks/bulk-push-calendar
router.post('/bulk-push-calendar', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orgId } = getOrgUser(req);
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    const { rows: blocks } = await pool.query(
      `SELECT * FROM prospecting_time_blocks
       WHERE id = ANY($1) AND org_id = $2 AND synced_to_calendar = false`,
      [ids, orgId]
    );

    let pushed = 0;
    let failed = 0;

    for (const block of blocks) {
      try {
        const invitedIds: string[] = Array.isArray(block.invited_user_ids) ? block.invited_user_ids : [];
        const attendeeEmails = await getEmailsForUserIds(invitedIds, orgId);
        const calEvent = await createCalendarEvent({
          title: `[Time Block] ${block.title}`,
          description: block.notes ?? '',
          startDate: block.start_at,
          endDate: block.end_at,
          attendees: attendeeEmails,
        });
        await pool.query(
          `UPDATE prospecting_time_blocks
           SET google_calendar_event_id = $1, synced_to_calendar = true, updated_at = NOW()
           WHERE id = $2`,
          [calEvent.id, block.id]
        );
        pushed++;
      } catch {
        failed++;
      }
    }

    res.json({ pushed, failed, total: blocks.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    if (msg.includes('not connected')) {
      return res.status(503).json({ error: 'Google Calendar not connected.' });
    }
    res.status(msg === 'Unauthorized' ? 401 : 500).json({ error: msg });
  }
});

// ── helpers ───────────────────────────────────────────────────────────────────

async function getEmailsForUserIds(userIds: string[], orgId: string): Promise<string[]> {
  if (!userIds || userIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT email FROM users WHERE id = ANY($1) AND org_id = $2 AND email IS NOT NULL`,
    [userIds, orgId]
  );
  return (rows as { email: string }[]).map((r) => r.email).filter(Boolean);
}

export default router;
