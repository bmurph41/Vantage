/**
 * Quarterly LP Statement Delivery
 *
 * Called by a cron job on the first day of each quarter (Jan 1, Apr 1, Jul 1,
 * Oct 1). For each active fund in every org, generates a capital account
 * statement PDF for each investor and emails it via the existing sendEmail()
 * transport. The PDF is the same output as the manual
 * GET /api/funds/:fundId/investors/:investorId/statement/pdf endpoint.
 *
 * Delivery is idempotent: writes to `lp_statement_deliveries` (created inline
 * if it doesn't exist) so the same quarter is never double-delivered.
 */

import { pool } from "../db";
import { sendEmail } from "./email-service";
import { logger } from "../lib/logger";

export async function runQuarterlyLPDelivery(): Promise<{
  funds: number;
  investors: number;
  sent: number;
  failed: number;
}> {
  // Compute which quarter just ended
  const now = new Date();
  const q = Math.floor((now.getMonth() - 1) / 3); // 0-based quarter that just ended
  const year = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
  const quarter = q < 0 ? 4 : q + 1;
  const quarterLabel = `Q${quarter} ${year}`;
  const periodEnd = new Date(year, quarter * 3, 0); // last day of the quarter
  const periodStart = new Date(year, (quarter - 1) * 3, 1);

  logger.info({ quarterLabel }, "[lp-delivery] starting quarterly statement run");

  // Ensure tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lp_statement_deliveries (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      org_id VARCHAR NOT NULL,
      fund_id VARCHAR NOT NULL,
      investor_id VARCHAR NOT NULL,
      quarter_label VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'sent',
      sent_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (fund_id, investor_id, quarter_label)
    )
  `);

  // Find active funds with investors
  const { rows: funds } = await pool.query(`
    SELECT DISTINCT f.id AS fund_id, f.name AS fund_name, f.org_id
      FROM fund_investors fi
      JOIN modeling_projects f ON f.id = fi.fund_id
     WHERE fi.is_active = true
  `);

  let totalInvestors = 0;
  let sent = 0;
  let failed = 0;

  for (const fund of funds) {
    // Find investors for this fund
    const { rows: investors } = await pool.query(
      `SELECT fi.id, fi.investor_name, fi.investor_type
         FROM fund_investors fi
        WHERE fi.fund_id = $1 AND fi.is_active = true`,
      [fund.fund_id],
    );

    for (const inv of investors) {
      totalInvestors++;

      // Idempotency check
      const { rowCount: already } = await pool.query(
        `SELECT 1 FROM lp_statement_deliveries
          WHERE fund_id = $1 AND investor_id = $2 AND quarter_label = $3`,
        [fund.fund_id, inv.id, quarterLabel],
      );
      if (already && already > 0) continue;

      try {
        // Generate statement
        const { fundService } = await import("./fund-service");
        const statement = await fundService.generateInvestorStatement(
          fund.org_id,
          fund.fund_id,
          inv.id,
          { periodStart, periodEnd, asOfDate: periodEnd },
        );

        // Generate PDF
        const { generateStatementPDF } = await import("./lp-statement-pdf");
        const pdfBytes = await generateStatementPDF(statement, periodEnd);

        // Resolve investor email — check lp_portal_users first, then lp_investors
        let email: string | null = null;
        const { rows: portalRows } = await pool.query(
          `SELECT email FROM lp_portal_users WHERE investor_id = $1 AND status = 'active' LIMIT 1`,
          [inv.id],
        ).catch(() => ({ rows: [] as any[] }));
        if (portalRows.length) email = portalRows[0].email;

        if (!email) {
          const { rows: lpRows } = await pool.query(
            `SELECT email FROM lp_investors WHERE id = $1 LIMIT 1`,
            [inv.id],
          ).catch(() => ({ rows: [] as any[] }));
          if (lpRows.length) email = lpRows[0].email;
        }

        if (!email) {
          logger.warn({ investorId: inv.id }, "[lp-delivery] no email found, skipping");
          continue;
        }

        // Send via existing email service
        const filename = `${fund.fund_name.replace(/[^a-zA-Z0-9]/g, "_")}_${quarterLabel}_Statement.pdf`;
        const ok = await sendEmail({
          to: email,
          subject: `${fund.fund_name} — ${quarterLabel} Capital Account Statement`,
          html: `<p>Dear ${inv.investor_name},</p>
<p>Please find attached your ${quarterLabel} capital account statement for <strong>${fund.fund_name}</strong>.</p>
<p>You can also view your full statement history in the <a href="${process.env.APP_URL || "https://app.marinalytics.com"}/lp-portal">LP Portal</a>.</p>
<p>Regards,<br/>Vantage Capital Management</p>`,
          attachments: [
            {
              content: Buffer.from(pdfBytes).toString("base64"),
              filename,
              type: "application/pdf",
              disposition: "attachment",
            },
          ],
        });

        if (ok) {
          await pool.query(
            `INSERT INTO lp_statement_deliveries (org_id, fund_id, investor_id, quarter_label, status)
             VALUES ($1, $2, $3, $4, 'sent')
             ON CONFLICT (fund_id, investor_id, quarter_label) DO NOTHING`,
            [fund.org_id, fund.fund_id, inv.id, quarterLabel],
          );
          sent++;
        } else {
          failed++;
        }
      } catch (err) {
        logger.error({ err, investorId: inv.id, fundId: fund.fund_id }, "[lp-delivery] delivery failed");
        failed++;
      }
    }
  }

  logger.info(
    { quarterLabel, funds: funds.length, investors: totalInvestors, sent, failed },
    "[lp-delivery] quarterly run complete",
  );

  return { funds: funds.length, investors: totalInvestors, sent, failed };
}
