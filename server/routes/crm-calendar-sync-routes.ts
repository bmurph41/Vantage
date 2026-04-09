/**
 * CRM Calendar Sync Routes — 2-way sync between CRM activities and Google Calendar
 */
import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { getUncachableGoogleCalendarClient, createCalendarEvent } from '../lib/google-calendar';

export const crmCalendarSyncRouter = Router();

// Push a CRM activity to Google Calendar
crmCalendarSyncRouter.post('/activities/:activityId/sync-to-calendar', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows: [activity] } = await pool.query(
      `SELECT a.*, c.email as contact_email, c.first_name as contact_first_name, c.last_name as contact_last_name
       FROM crm_activities a
       LEFT JOIN crm_contacts c ON a.entity_type = 'contact' AND a.entity_id = c.id
       WHERE a.id = $1 AND a.org_id = $2`,
      [req.params.activityId, orgId]
    );

    if (!activity) return res.status(404).json({ error: 'Activity not found' });

    if (activity.calendar_event_id) {
      return res.status(409).json({ error: 'Activity already synced', calendarEventId: activity.calendar_event_id });
    }

    const startDate = activity.scheduled_at || new Date().toISOString();
    const durationMs = (activity.duration || 60) * 60000;
    const endDate = new Date(new Date(startDate).getTime() + durationMs).toISOString();

    const attendees = activity.contact_email ? [activity.contact_email] : [];

    const calEvent = await createCalendarEvent({
      title: activity.subject || `${activity.type} - CRM Activity`,
      description: activity.description || '',
      startDate,
      endDate,
      attendees,
    });

    // Store calendar event ID back on the activity
    await pool.query(
      `UPDATE crm_activities SET calendar_event_id = $1, synced_to_calendar = true WHERE id = $2`,
      [calEvent.id, activity.id]
    );

    res.json({
      success: true,
      calendarEventId: calEvent.id,
      calendarLink: calEvent.htmlLink,
    });
  } catch (err: any) {
    console.error('Sync to calendar error:', err);
    if (err.message?.includes('not connected')) {
      return res.status(503).json({ error: 'Google Calendar not connected. Please connect via Settings.' });
    }
    res.status(500).json({ error: 'Failed to sync to calendar' });
  }
});

// Pull events from Google Calendar into CRM activities
crmCalendarSyncRouter.post('/pull-from-calendar', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const calendar = await getUncachableGoogleCalendarClient();

    const timeMin = req.body.timeMin || new Date().toISOString();
    const timeMax = req.body.timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const events = response.data.items || [];
    let imported = 0;
    let skipped = 0;

    for (const event of events) {
      if (!event.id || !event.summary) { skipped++; continue; }

      // Check if already imported
      const { rows: existing } = await pool.query(
        `SELECT id FROM crm_activities WHERE calendar_event_id = $1 AND org_id = $2`,
        [event.id, orgId]
      );

      if (existing.length > 0) { skipped++; continue; }

      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;
      const durationMinutes = startTime && endTime
        ? Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
        : 60;

      await pool.query(
        `INSERT INTO crm_activities
         (type, subject, description, status, scheduled_at, completed_at, duration,
          calendar_event_id, synced_to_calendar, user_id, org_id)
         VALUES ('meeting', $1, $2, $3, $4, $5, $6, $7, true, $8, $9)`,
        [
          event.summary,
          event.description || '',
          event.status === 'confirmed' ? 'scheduled' : 'cancelled',
          startTime,
          event.status === 'confirmed' ? null : endTime,
          durationMinutes,
          event.id,
          userId,
          orgId,
        ]
      );
      imported++;
    }

    res.json({ imported, skipped, total: events.length });
  } catch (err: any) {
    console.error('Pull from calendar error:', err);
    if (err.message?.includes('not connected')) {
      return res.status(503).json({ error: 'Google Calendar not connected' });
    }
    res.status(500).json({ error: 'Failed to pull from calendar' });
  }
});

// Update a synced activity back to Google Calendar
crmCalendarSyncRouter.put('/activities/:activityId/update-calendar', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows: [activity] } = await pool.query(
      `SELECT * FROM crm_activities WHERE id = $1 AND org_id = $2 AND calendar_event_id IS NOT NULL`,
      [req.params.activityId, orgId]
    );

    if (!activity) return res.status(404).json({ error: 'Synced activity not found' });

    const calendar = await getUncachableGoogleCalendarClient();

    const startDate = activity.scheduled_at || new Date().toISOString();
    const durationMs = (activity.duration || 60) * 60000;

    await calendar.events.update({
      calendarId: 'primary',
      eventId: activity.calendar_event_id,
      requestBody: {
        summary: activity.subject,
        description: activity.description,
        start: { dateTime: new Date(startDate).toISOString(), timeZone: 'America/New_York' },
        end: { dateTime: new Date(new Date(startDate).getTime() + durationMs).toISOString(), timeZone: 'America/New_York' },
      },
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Update calendar error:', err);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// Remove an activity from Google Calendar
crmCalendarSyncRouter.delete('/activities/:activityId/unsync-calendar', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows: [activity] } = await pool.query(
      `SELECT calendar_event_id FROM crm_activities WHERE id = $1 AND org_id = $2`,
      [req.params.activityId, orgId]
    );

    if (!activity?.calendar_event_id) return res.status(404).json({ error: 'No calendar sync found' });

    try {
      const calendar = await getUncachableGoogleCalendarClient();
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: activity.calendar_event_id,
      });
    } catch (_calErr) {
      // Event may already be deleted on calendar side — continue cleanup
    }

    await pool.query(
      `UPDATE crm_activities SET calendar_event_id = NULL, synced_to_calendar = false WHERE id = $1`,
      [req.params.activityId]
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('Unsync calendar error:', err);
    res.status(500).json({ error: 'Failed to unsync calendar event' });
  }
});

// Check Google Calendar connection status
crmCalendarSyncRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const calendar = await getUncachableGoogleCalendarClient();
    const response = await calendar.calendarList.list({ maxResults: 1 });
    const connected = !!response.data.items?.length;
    const primaryCalendar = response.data.items?.[0];
    res.json({
      connected,
      email: primaryCalendar?.id,
      name: primaryCalendar?.summary,
    });
  } catch (err: any) {
    res.json({ connected: false, error: err.message });
  }
});

export default crmCalendarSyncRouter;
