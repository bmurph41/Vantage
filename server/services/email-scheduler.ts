/**
 * Email Scheduler
 *
 * Polls `email_messages` for rows with `status='scheduled'` and
 * `scheduled_at <= NOW()`, dispatches them via the shared `sendEmail()`
 * service, and updates their status. Called from the platform cron
 * scheduler every minute.
 *
 * Failure handling: on send failure the row is flipped to `status='failed'`
 * so the scheduler doesn't retry forever. A future pass can add exponential
 * backoff + a retry counter column if needed.
 */

import { pool } from "../db";
import { sendEmail } from "./email-service";
import { logger } from "../lib/logger";

const BATCH_LIMIT = 50;

export async function runEmailSchedulerTick(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const { rows: due } = await pool.query(
    `SELECT id, org_id, deal_id, from_user_id, to_contact_id, to_email,
            subject, body_html, body_text, template_id
       FROM email_messages
      WHERE status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT $1`,
    [BATCH_LIMIT],
  );

  if (due.length === 0) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const row of due) {
    // Optimistic lock — only send if we can flip the row to 'sending'
    const { rowCount: locked } = await pool.query(
      `UPDATE email_messages
          SET status = 'sending'
        WHERE id = $1 AND status = 'scheduled'`,
      [row.id],
    );
    if (!locked) continue;

    try {
      const ok = await sendEmail({
        to: row.to_email,
        subject: row.subject,
        html: row.body_html,
        text: row.body_text,
      });

      if (ok) {
        await pool.query(
          `UPDATE email_messages
              SET status = 'sent', sent_at = NOW()
            WHERE id = $1`,
          [row.id],
        );
        sent++;

        // Mirror to crm_activities if tied to a deal/contact (matches
        // the behavior of /compose-send for consistency)
        if (row.deal_id || row.to_contact_id) {
          await pool.query(
            `INSERT INTO crm_activities (type, subject, description, direction, entity_type, entity_id, org_id, user_id, created_at)
             VALUES ('email', $1, $2, 'outbound', $3, $4, $5, $6, NOW())`,
            [
              row.subject,
              `Scheduled send to ${row.to_email}`,
              row.deal_id ? "deal" : "contact",
              row.deal_id || row.to_contact_id,
              row.org_id,
              row.from_user_id,
            ],
          );
        }
      } else {
        await pool.query(
          `UPDATE email_messages
              SET status = 'failed'
            WHERE id = $1`,
          [row.id],
        );
        failed++;
      }
    } catch (err) {
      logger.error({ err, messageId: row.id }, "[email-scheduler] send threw");
      await pool.query(
        `UPDATE email_messages
            SET status = 'failed'
          WHERE id = $1`,
        [row.id],
      );
      failed++;
    }
  }

  if (sent + failed > 0) {
    logger.info(
      { processed: due.length, sent, failed },
      "[email-scheduler] tick complete",
    );
  }

  return { processed: due.length, sent, failed };
}
