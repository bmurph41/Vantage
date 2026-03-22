import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { getSendGridClient } from '../services/email-service';

const router = Router();

router.post('/bulk-email/send', async (req: Request, res: Response) => {
  try {
    const { contactIds, templateId, subject, htmlBody, fromName } = req.body as {
      contactIds: string[];
      templateId?: string;
      subject: string;
      htmlBody: string;
      fromName?: string;
    };

    if (!contactIds?.length || !subject || !htmlBody) {
      return res.status(400).json({ error: 'contactIds, subject, and htmlBody are required' });
    }

    const { client: sgMail, fromEmail } = await getSendGridClient();

    const result = await db.execute(
      sql`SELECT id, email, first_name, last_name FROM crm_contacts WHERE id = ANY(${contactIds})`
    );
    const contacts = result.rows as Array<{ id: string; email: string; first_name: string; last_name: string }>;

    let sent = 0;
    let failed = 0;
    const errors: Array<{ contactId: string; error: string }> = [];

    for (const contact of contacts) {
      if (!contact.email) {
        failed++;
        errors.push({ contactId: contact.id, error: 'No email address' });
        continue;
      }

      try {
        await sgMail.send({
          to: contact.email,
          from: {
            email: fromEmail,
            name: fromName || 'MarinaMatch',
          },
          subject,
          html: htmlBody,
        });
        sent++;
      } catch (err: any) {
        failed++;
        errors.push({ contactId: contact.id, error: err.message || 'Send failed' });
      }
    }

    const missingIds = contactIds.filter(id => !contacts.find(c => c.id === id));
    for (const id of missingIds) {
      failed++;
      errors.push({ contactId: id, error: 'Contact not found' });
    }

    // Log the bulk email send
    try {
      await db.execute(
        sql`INSERT INTO crm_bulk_email_logs (id, org_id, sent_by_id, subject, body, recipient_count, sent_count, failed_count, status, error_details, created_at)
            VALUES (gen_random_uuid(), 'org-1', NULL, ${subject}, ${htmlBody}, ${contactIds.length}, ${sent}, ${failed}, 'completed', ${JSON.stringify(errors)}::jsonb, NOW())`
      );
    } catch (_logErr) {
      // Log table may not exist yet; non-critical
    }

    res.json({ sent, failed, errors });
  } catch (error: any) {
    console.error('Bulk email send error:', error);
    res.status(500).json({ error: 'Failed to send bulk email' });
  }
});

router.post('/bulk-email/preview', async (req: Request, res: Response) => {
  try {
    const { contactIds } = req.body as { contactIds: string[] };

    if (!contactIds?.length) {
      return res.status(400).json({ error: 'contactIds is required' });
    }

    const result = await db.execute(
      sql`SELECT id, email FROM crm_contacts WHERE id = ANY(${contactIds})`
    );
    const contacts = result.rows as Array<{ id: string; email: string }>;

    const validEmails = contacts.filter(c => c.email).length;
    const missingEmails = contacts.filter(c => !c.email).length;
    const notFound = contactIds.length - contacts.length;

    res.json({
      total: contactIds.length,
      validEmails,
      missingEmails,
      notFound,
    });
  } catch (error: any) {
    console.error('Bulk email preview error:', error);
    res.status(500).json({ error: 'Failed to preview bulk email' });
  }
});

router.get('/email-templates', async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(
      sql`SELECT id, name, subject, content AS body, created_at AS "createdAt" FROM crm_email_templates ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error('Fetch email templates error:', error);
    res.status(500).json({ error: 'Failed to fetch email templates' });
  }
});

router.post('/email-templates', async (req: Request, res: Response) => {
  try {
    const { name, subject, body } = req.body as { name: string; subject: string; body: string };

    if (!name || !subject || !body) {
      return res.status(400).json({ error: 'name, subject, and body are required' });
    }

    const result = await db.execute(
      sql`INSERT INTO crm_email_templates (name, subject, content, created_by_id, org_id)
          VALUES (${name}, ${subject}, ${body}, 'user-1', 'org-1')
          RETURNING id, name, subject, content AS body, created_at AS "createdAt"`
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Create email template error:', error);
    res.status(500).json({ error: 'Failed to create email template' });
  }
});

export default router;
