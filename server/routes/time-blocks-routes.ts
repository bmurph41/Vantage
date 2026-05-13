/**
 * Prospecting Time Blocks Routes
 * CRUD + Google Calendar push for broker time-block scheduling
 */
import { Router, Response } from 'express';
import { pool } from '../db';
import { AuthenticatedRequest } from '../middleware/org-guard';
import { createCalendarEvent } from '../lib/google-calendar';

const router = Router();

function getOrgUser(req: AuthenticatedRequest): { orgId: string; userId: string } {
  const orgId = (req as any).user?.orgId;
  const userId = (req as any).user?.id;
  if (!orgId || !userId) throw new Error('Unauthorized');
  return { orgId, userId };
}

// GET /api/prospecting/time-blocks?start=ISO&end=ISO
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orgId } = getOrgUser(req);
    const { start, end } = req.query;

    const startDate = start ? new Date(start as string) : (() => {
      const d = new Date(); d.setHours(0, 0, 0, 0); return d;
    })();
    const endDate = end ? new Date(end as string) : (() => {
      const d = new Date(startDate); d.setDate(d.getDate() + 7); return d;
    })();

    const { rows } = await pool.query(
      `SELECT b.*,
              u.name AS creator_name,
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
      title, blockType = 'prospecting_call', startAt, endAt,
      notes, color = '#3b82f6', invitedUserIds = [], pushToCalendar = false,
    } = req.body as {
      title: string; blockType?: string; startAt: string; endAt: string;
      notes?: string; color?: string; invitedUserIds?: string[]; pushToCalendar?: boolean;
    };

    if (!title || !startAt || !endAt) {
      return res.status(400).json({ error: 'title, startAt, endAt are required' });
    }

    const { rows: [block] } = await pool.query(
      `INSERT INTO prospecting_time_blocks
         (org_id, created_by, title, block_type, start_at, end_at, notes, color, invited_user_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [orgId, userId, title, blockType, startAt, endAt, notes || null, color, JSON.stringify(invitedUserIds)]
    );

    // Optionally push to Google Calendar immediately
    if (pushToCalendar) {
      try {
        const attendeeEmails = await getEmailsForUserIds(invitedUserIds, orgId);
        const calEvent = await createCalendarEvent({
          title: `[Time Block] ${title}`,
          description: notes || '',
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
    const { orgId } = getOrgUser(req);
    const { id } = req.params;
    const { title, blockType, startAt, endAt, notes, color, invitedUserIds } = req.body as {
      title?: string; blockType?: string; startAt?: string; endAt?: string;
      notes?: string; color?: string; invitedUserIds?: string[];
    };

    const { rows: [existing] } = await pool.query(
      `SELECT id FROM prospecting_time_blocks WHERE id = $1 AND org_id = $2`,
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

    if (title !== undefined) addField('title', title);
    if (blockType !== undefined) addField('block_type', blockType);
    if (startAt !== undefined) addField('start_at', startAt);
    if (endAt !== undefined) addField('end_at', endAt);
    if (notes !== undefined) addField('notes', notes);
    if (color !== undefined) addField('color', color);
    if (invitedUserIds !== undefined) addField('invited_user_ids', JSON.stringify(invitedUserIds));
    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    const { rows: [updated] } = await pool.query(
      `UPDATE prospecting_time_blocks SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

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
      return res.status(409).json({ error: 'Block already synced to calendar', calendarEventId: block.google_calendar_event_id });
    }

    const invitedIds: string[] = Array.isArray(block.invited_user_ids) ? block.invited_user_ids : [];
    const attendeeEmails = await getEmailsForUserIds(invitedIds, orgId);

    const calEvent = await createCalendarEvent({
      title: `[Time Block] ${block.title}`,
      description: block.notes || '',
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
      return res.status(503).json({ error: 'Google Calendar not connected. Connect it in Settings > Integrations.' });
    }
    res.status(msg === 'Unauthorized' ? 401 : 500).json({ error: msg });
  }
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function getEmailsForUserIds(userIds: string[], orgId: string): Promise<string[]> {
  if (!userIds || userIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT email FROM users WHERE id = ANY($1) AND org_id = $2 AND email IS NOT NULL`,
    [userIds, orgId]
  );
  return rows.map((r: { email: string }) => r.email).filter(Boolean);
}

export default router;
