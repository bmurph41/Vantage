/**
 * Platform Background Jobs / Cron System
 *
 * Scheduled tasks for operational monitoring:
 *   1. Lease expiry alerts (daily at 7 AM)
 *   2. DD deadline monitoring (every 4 hours)
 *   3. Compliance/insurance expiry checks (daily at 8 AM)
 *   4. Integration auto-sync (configurable per connection)
 *   5. Subscription renewal warnings (daily at 9 AM)
 *   6. Rent payment reconciliation (nightly at 1 AM)
 *   7. Stale deal detection (weekly Monday 6 AM)
 *   8. Exchange rate refresh (daily at 6 AM)
 */

import cron from "node-cron";
import { db } from "../db";
import {
  leaseRenewalOpportunities,
  crmDeals,
  crmNotifications,
  insurancePolicies,
  regulatoryObligations,
  organizationPacks,
  rentPayments,
  integrationConnections,
  crmActivities,
  organizations,
  users,
} from "@shared/schema";
import { eq, and, desc, sql, lt, gte, lte, count, or } from "drizzle-orm";
import { logger } from "../lib/logger";
import { sendTrialDay3Email, sendTrialDay5Email, sendTrialLastDayEmail } from "../services/email-service";
import { runEmailSchedulerTick } from "../services/email-scheduler";

let jobsStarted = false;

export function startPlatformCronJobs() {
  if (jobsStarted) {
    logger.info("Platform cron jobs already running");
    return;
  }
  jobsStarted = true;
  logger.info("Starting platform background jobs...");

  // ─── 0. Scheduled email dispatch — every minute ───────────────────────
  // Polls email_messages for status='scheduled' rows whose scheduled_at is
  // due and dispatches them via sendEmail(). See server/services/email-scheduler.ts
  cron.schedule("* * * * *", async () => {
    try {
      await runEmailSchedulerTick();
    } catch (err) {
      logger.error({ err }, "[CRON] email scheduler tick failed");
    }
  });

  // ─── 1. Lease Expiry Alerts — daily at 7:00 AM ────────────────────────
  cron.schedule("0 7 * * *", async () => {
    logger.info("[CRON] Running lease expiry alert scan");
    try {
      const horizons = [
        { days: 180, urgency: "info" },
        { days: 120, urgency: "info" },
        { days: 90, urgency: "warning" },
        { days: 60, urgency: "warning" },
        { days: 30, urgency: "critical" },
      ];

      for (const { days, urgency } of horizons) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + days);
        const dateStr = targetDate.toISOString().split("T")[0];

        // Find renewals expiring near this horizon that are still monitoring
        const expiring = await db
          .select()
          .from(leaseRenewalOpportunities)
          .where(
            and(
              eq(leaseRenewalOpportunities.status, "monitoring"),
              eq(leaseRenewalOpportunities.leaseExpiryDate, dateStr),
            ),
          );

        for (const renewal of expiring) {
          // Notify all org owners
          const orgUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.orgId, renewal.orgId), eq(users.role, "owner")));

          for (const user of orgUsers) {
            await db.insert(crmNotifications).values({
              orgId: renewal.orgId,
              userId: user.id,
              type: "deadline",
              title: `Lease expires in ${days} days`,
              message: `Lease renewal opportunity for deal ${renewal.dealId} — current rent $${renewal.currentRent}/mo. Expiry: ${renewal.leaseExpiryDate}`,
              entityType: "deal",
              entityId: renewal.dealId || undefined,
            });
          }
        }

        if (expiring.length > 0) {
          logger.info(`[CRON] Lease alerts: ${expiring.length} leases expiring in ${days} days (${urgency})`);
        }
      }
    } catch (error) {
      logger.error({ error }, "[CRON] Lease expiry scan failed");
    }
  });

  // ─── 2. DD Deadline Monitoring — every 4 hours ─────────────────────────
  cron.schedule("0 */4 * * *", async () => {
    logger.info("[CRON] Running DD deadline monitor");
    try {
      // Find deals with DD expiration in next 7 days
      const sevenDaysOut = new Date();
      sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

      const urgentDeals = await db
        .select({
          id: crmDeals.id,
          title: crmDeals.title,
          orgId: crmDeals.orgId,
          ddExpirationDate: crmDeals.ddExpirationDate,
          ownerId: crmDeals.ownerId,
        })
        .from(crmDeals)
        .where(
          and(
            eq(crmDeals.isClosed, false),
            sql`${crmDeals.ddExpirationDate}::date <= ${sevenDaysOut.toISOString().split("T")[0]}`,
            sql`${crmDeals.ddExpirationDate}::date >= ${new Date().toISOString().split("T")[0]}`,
          ),
        );

      for (const deal of urgentDeals) {
        if (!deal.ddExpirationDate || !deal.ownerId) continue;

        const daysUntil = Math.ceil(
          (new Date(deal.ddExpirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        await db.insert(crmNotifications).values({
          orgId: deal.orgId!,
          userId: deal.ownerId,
          type: "deadline",
          title: `DD expires in ${daysUntil} days: ${deal.title}`,
          message: `Due diligence period for "${deal.title}" expires on ${deal.ddExpirationDate}. ${daysUntil <= 3 ? "URGENT — take action immediately." : "Review remaining items."}`,
          entityType: "deal",
          entityId: deal.id,
        });
      }

      if (urgentDeals.length > 0) {
        logger.info(`[CRON] DD deadline alerts: ${urgentDeals.length} deals with DD expiring within 7 days`);
      }
    } catch (error) {
      logger.error({ error }, "[CRON] DD deadline monitor failed");
    }
  });

  // ─── 3. Compliance / Insurance Expiry — daily at 8:00 AM ──────────────
  cron.schedule("0 8 * * *", async () => {
    logger.info("[CRON] Running compliance/insurance expiry check");
    try {
      const sixtyDaysOut = new Date();
      sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);
      const today = new Date().toISOString().split("T")[0];

      // Insurance policies expiring within 60 days
      const expiringPolicies = await db
        .select()
        .from(insurancePolicies)
        .where(
          and(
            eq(insurancePolicies.status, "active"),
            sql`${insurancePolicies.expirationDate}::date <= ${sixtyDaysOut.toISOString().split("T")[0]}`,
            sql`${insurancePolicies.expirationDate}::date >= ${today}`,
          ),
        );

      for (const policy of expiringPolicies) {
        const daysUntil = Math.ceil(
          (new Date(policy.expirationDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        const orgUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.orgId, policy.orgId), eq(users.role, "owner")));

        for (const user of orgUsers) {
          await db.insert(crmNotifications).values({
            orgId: policy.orgId,
            userId: user.id,
            type: "deadline",
            title: `Insurance policy expires in ${daysUntil} days`,
            message: `${policy.policyType} policy #${policy.policyNumber} (${policy.carrier}) expires on ${policy.expirationDate}. Coverage: $${Number(policy.coverageAmount || 0).toLocaleString()}.`,
            entityType: "deal",
            entityId: policy.dealId || undefined,
          });
        }
      }

      // Regulatory obligations due within 30 days
      const thirtyDaysOut = new Date();
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

      const dueObligations = await db
        .select()
        .from(regulatoryObligations)
        .where(
          and(
            eq(regulatoryObligations.status, "upcoming"),
            sql`${regulatoryObligations.dueDate}::date <= ${thirtyDaysOut.toISOString().split("T")[0]}`,
            sql`${regulatoryObligations.dueDate}::date >= ${today}`,
          ),
        );

      for (const obligation of dueObligations) {
        const orgUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.orgId, obligation.orgId), eq(users.role, "owner")));

        for (const user of orgUsers) {
          await db.insert(crmNotifications).values({
            orgId: obligation.orgId,
            userId: user.id,
            type: "deadline",
            title: `Regulatory obligation due: ${obligation.title}`,
            message: `"${obligation.title}" (${obligation.authority}) is due on ${obligation.dueDate}.`,
          });
        }
      }

      logger.info(`[CRON] Compliance: ${expiringPolicies.length} insurance, ${dueObligations.length} regulatory alerts`);
    } catch (error) {
      logger.error({ error }, "[CRON] Compliance check failed");
    }
  });

  // ─── 4. Integration Auto-Sync — every 30 minutes ──────────────────────
  cron.schedule("*/30 * * * *", async () => {
    logger.info("[CRON] Running integration auto-sync check");
    try {
      // Find connections due for sync
      const connections = await db
        .select()
        .from(integrationConnections)
        .where(
          and(
            eq(integrationConnections.isEnabled, true),
            eq(integrationConnections.autoSyncEnabled, true),
          ),
        );

      let synced = 0;
      for (const conn of connections) {
        const freq = conn.syncFrequencyMinutes || 60;
        const lastSync = conn.lastSyncAt ? new Date(conn.lastSyncAt).getTime() : 0;
        const minutesSinceSync = (Date.now() - lastSync) / (1000 * 60);

        if (minutesSinceSync >= freq) {
          // Mark as syncing
          await db
            .update(integrationConnections)
            .set({ lastSyncStatus: "in_progress", updatedAt: new Date() })
            .where(eq(integrationConnections.id, conn.id));

          try {
            // Dynamic connector load via factory
            const { ConnectorFactory } = await import("../integrations/connectors/base");
            if (ConnectorFactory.isRegistered(conn.integrationKey)) {
              const connector = ConnectorFactory.create({
                integrationKey: conn.integrationKey,
                credentials: (conn.credentials as any) || {},
                settings: (conn.settings as any) || {},
                userId: "",
                orgId: conn.orgId,
              });

              const results = await connector.syncAll();
              const totalRecords = Array.from(results.values()).reduce(
                (sum, r) => sum + r.recordsProcessed,
                0,
              );

              await db
                .update(integrationConnections)
                .set({
                  lastSyncAt: new Date(),
                  lastSyncStatus: "completed",
                  lastSyncMessage: `Synced ${totalRecords} records`,
                  recordsSyncedTotal: sql`coalesce(${integrationConnections.recordsSyncedTotal}, 0) + ${totalRecords}`,
                  updatedAt: new Date(),
                })
                .where(eq(integrationConnections.id, conn.id));

              synced++;
            }
          } catch (syncError: any) {
            await db
              .update(integrationConnections)
              .set({
                lastSyncStatus: "failed",
                lastSyncMessage: syncError.message,
                updatedAt: new Date(),
              })
              .where(eq(integrationConnections.id, conn.id));
          }
        }
      }

      if (synced > 0) {
        logger.info(`[CRON] Auto-sync: ${synced} integrations synced`);
      }
    } catch (error) {
      logger.error({ error }, "[CRON] Integration auto-sync failed");
    }
  });

  // ─── 5. Subscription Renewal Warnings — daily at 9:00 AM ──────────────
  cron.schedule("0 9 * * *", async () => {
    logger.info("[CRON] Running subscription renewal check");
    try {
      const sevenDaysOut = new Date();
      sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

      const expiringPacks = await db
        .select()
        .from(organizationPacks)
        .where(
          and(
            eq(organizationPacks.status, "active"),
            sql`${organizationPacks.currentPeriodEnd} is not null`,
            sql`${organizationPacks.currentPeriodEnd} <= ${sevenDaysOut}`,
            sql`${organizationPacks.currentPeriodEnd} >= now()`,
          ),
        );

      for (const pack of expiringPacks) {
        if (!pack.orgId) continue;
        const orgUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.orgId, pack.orgId), eq(users.role, "owner")));

        for (const user of orgUsers) {
          await db.insert(crmNotifications).values({
            orgId: pack.orgId,
            userId: user.id,
            type: "system",
            title: `Pack "${pack.packType}" renews soon`,
            message: `Your "${pack.packType}" pack ${pack.cancelAtPeriodEnd ? "expires" : "renews"} on ${new Date(pack.currentPeriodEnd!).toLocaleDateString()}.`,
          });
        }
      }

      // Trial expirations
      const trialPacks = await db
        .select()
        .from(organizationPacks)
        .where(
          and(
            eq(organizationPacks.status, "trial"),
            sql`${organizationPacks.trialEndsAt} <= ${sevenDaysOut}`,
            sql`${organizationPacks.trialEndsAt} >= now()`,
          ),
        );

      for (const pack of trialPacks) {
        if (!pack.orgId) continue;
        const orgUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.orgId, pack.orgId), eq(users.role, "owner")));

        for (const user of orgUsers) {
          await db.insert(crmNotifications).values({
            orgId: pack.orgId,
            userId: user.id,
            type: "system",
            title: `Trial ending: "${pack.packType}"`,
            message: `Your trial for "${pack.packType}" ends on ${new Date(pack.trialEndsAt!).toLocaleDateString()}. Subscribe to keep access.`,
          });
        }
      }

      logger.info(`[CRON] Subscription alerts: ${expiringPacks.length} renewals, ${trialPacks.length} trials`);
    } catch (error) {
      logger.error({ error }, "[CRON] Subscription renewal check failed");
    }
  });

  // ─── 6. Rent Payment Reconciliation — nightly at 1:00 AM ──────────────
  cron.schedule("0 1 * * *", async () => {
    logger.info("[CRON] Running rent payment reconciliation");
    try {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

      // Find pending payments older than 48h
      const stalePayments = await db
        .select({ count: count() })
        .from(rentPayments)
        .where(
          and(
            eq(rentPayments.status, "pending"),
            lt(rentPayments.createdAt, cutoff),
          ),
        );

      if ((stalePayments[0]?.count || 0) > 0) {
        logger.info(`[CRON] Rent reconciliation: ${stalePayments[0].count} stale pending payments found`);
      }

      // Find overdue rent (period ended but not paid)
      const overdue = await db
        .select({
          orgId: rentPayments.orgId,
          dealId: rentPayments.dealId,
          count: count(),
        })
        .from(rentPayments)
        .where(
          and(
            eq(rentPayments.status, "pending"),
            sql`${rentPayments.periodEnd}::date < now()`,
          ),
        )
        .groupBy(rentPayments.orgId, rentPayments.dealId);

      for (const group of overdue) {
        if (!group.orgId) continue;
        const orgUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.orgId, group.orgId), eq(users.role, "owner")));

        for (const user of orgUsers) {
          await db.insert(crmNotifications).values({
            orgId: group.orgId,
            userId: user.id,
            type: "red_flag",
            title: `${group.count} overdue rent payments`,
            message: `Deal ${group.dealId} has ${group.count} overdue rent payment(s). Review and follow up with tenants.`,
            entityType: "deal",
            entityId: group.dealId || undefined,
          });
        }
      }
    } catch (error) {
      logger.error({ error }, "[CRON] Rent reconciliation failed");
    }
  });

  // ─── 7. Stale Deal Detection — weekly Monday at 6:00 AM ───────────────
  cron.schedule("0 6 * * 1", async () => {
    logger.info("[CRON] Running stale deal detection");
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find open deals with no activity in 30+ days
      const staleDeals = await db
        .select({
          id: crmDeals.id,
          title: crmDeals.title,
          orgId: crmDeals.orgId,
          ownerId: crmDeals.ownerId,
          stage: crmDeals.stage,
          updatedAt: crmDeals.updatedAt,
        })
        .from(crmDeals)
        .where(
          and(
            eq(crmDeals.isClosed, false),
            lt(crmDeals.updatedAt, thirtyDaysAgo),
          ),
        );

      for (const deal of staleDeals) {
        if (!deal.ownerId || !deal.orgId) continue;

        const daysSinceUpdate = Math.floor(
          (Date.now() - new Date(deal.updatedAt!).getTime()) / (1000 * 60 * 60 * 24),
        );

        await db.insert(crmNotifications).values({
          orgId: deal.orgId,
          userId: deal.ownerId,
          type: "red_flag",
          title: `Stale deal: ${deal.title}`,
          message: `"${deal.title}" (${deal.stage}) has had no activity in ${daysSinceUpdate} days. Consider updating or archiving.`,
          entityType: "deal",
          entityId: deal.id,
        });
      }

      logger.info(`[CRON] Stale deals: ${staleDeals.length} deals with no activity in 30+ days`);
    } catch (error) {
      logger.error({ error }, "[CRON] Stale deal detection failed");
    }
  });

  // ─── 8. Exchange Rate Refresh — daily at 6:00 AM ───────────────────────
  cron.schedule("0 6 * * *", async () => {
    logger.info("[CRON] Running exchange rate refresh");
    try {
      const apiKey = process.env.OPEN_EXCHANGE_RATES_APP_ID;
      if (!apiKey) return;

      const response = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD`,
      );
      if (!response.ok) return;

      const data = await response.json();
      const rates = data.rates || {};
      const rateDate = new Date().toISOString().split("T")[0];
      const { exchangeRates } = await import("@shared/schema");

      const currencies = ["EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "CNY", "MXN", "BRL", "INR"];
      for (const currency of currencies) {
        if (!rates[currency]) continue;
        await db
          .delete(exchangeRates)
          .where(and(eq(exchangeRates.targetCurrency, currency), eq(exchangeRates.rateDate, rateDate)));
        await db.insert(exchangeRates).values({
          baseCurrency: "USD",
          targetCurrency: currency,
          rate: String(rates[currency]),
          source: "openexchangerates",
          rateDate,
        });
      }

      logger.info(`[CRON] Exchange rates refreshed for ${currencies.length} currencies`);
    } catch (error) {
      logger.error({ error }, "[CRON] Exchange rate refresh failed");
    }
  });

  // ─── 9. Trial Reminder Emails — daily at 8:30 AM ─────────────────────
  cron.schedule("30 8 * * *", async () => {
    logger.info("[CRON] Running trial reminder email check");
    try {
      // Find orgs on trial by checking organizationPacks with status='trial'
      const trialPacks = await db
        .select({
          orgId: organizationPacks.orgId,
          trialEndsAt: organizationPacks.trialEndsAt,
          packType: organizationPacks.packType,
        })
        .from(organizationPacks)
        .where(
          and(
            eq(organizationPacks.status, "trial"),
            sql`${organizationPacks.trialEndsAt} IS NOT NULL`,
          ),
        );

      // Group by org — use the earliest trial end date
      const orgTrials = new Map<string, Date>();
      for (const pack of trialPacks) {
        if (!pack.orgId || !pack.trialEndsAt) continue;
        const endDate = new Date(pack.trialEndsAt);
        const existing = orgTrials.get(pack.orgId);
        if (!existing || endDate < existing) {
          orgTrials.set(pack.orgId, endDate);
        }
      }

      let day3Sent = 0, day5Sent = 0, day7Sent = 0;

      for (const [orgId, trialEnd] of orgTrials) {
        const now = new Date();
        const daysUntilEnd = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Determine which reminder to send
        let sendFn: ((to: string, name?: string) => Promise<boolean>) | null = null;
        if (daysUntilEnd === 4) sendFn = sendTrialDay3Email;  // Day 3 of trial (4 days left)
        else if (daysUntilEnd === 2) sendFn = sendTrialDay5Email;  // Day 5 of trial (2 days left)
        else if (daysUntilEnd === 0 || daysUntilEnd === 1) sendFn = sendTrialLastDayEmail;  // Day 7 — last day
        else continue;

        // Get org owners to email
        const orgOwners = await db
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(
            and(
              eq(users.orgId, orgId),
              eq(users.role, "owner"),
              eq(users.isDisabled, false),
            ),
          );

        for (const owner of orgOwners) {
          if (!owner.email) continue;
          try {
            await sendFn(owner.email, owner.name || undefined);
            if (daysUntilEnd === 4) day3Sent++;
            else if (daysUntilEnd === 2) day5Sent++;
            else day7Sent++;
          } catch (emailError: any) {
            logger.error({ error: emailError.message, to: owner.email }, "[CRON] Trial reminder email failed");
          }
        }
      }

      if (day3Sent + day5Sent + day7Sent > 0) {
        logger.info(`[CRON] Trial reminders sent: ${day3Sent} day-3, ${day5Sent} day-5, ${day7Sent} last-day`);
      }
    } catch (error) {
      logger.error({ error }, "[CRON] Trial reminder check failed");
    }
  });

  logger.info("All platform background jobs scheduled successfully");
}

export function getPlatformJobStatus(): {
  started: boolean;
  jobs: Array<{ name: string; schedule: string; description: string }>;
} {
  return {
    started: jobsStarted,
    jobs: [
      { name: "lease_expiry_alerts", schedule: "0 7 * * *", description: "Lease expiry alerts (daily 7 AM)" },
      { name: "dd_deadline_monitor", schedule: "0 */4 * * *", description: "DD deadline monitoring (every 4h)" },
      { name: "compliance_expiry", schedule: "0 8 * * *", description: "Insurance/regulatory expiry (daily 8 AM)" },
      { name: "integration_auto_sync", schedule: "*/30 * * * *", description: "Integration auto-sync (every 30 min)" },
      { name: "subscription_warnings", schedule: "0 9 * * *", description: "Subscription renewal warnings (daily 9 AM)" },
      { name: "rent_reconciliation", schedule: "0 1 * * *", description: "Rent payment reconciliation (nightly 1 AM)" },
      { name: "stale_deal_detection", schedule: "0 6 * * 1", description: "Stale deal detection (Monday 6 AM)" },
      { name: "exchange_rate_refresh", schedule: "0 6 * * *", description: "Exchange rate refresh (daily 6 AM)" },
      { name: "trial_reminders", schedule: "30 8 * * *", description: "Trial reminder emails (daily 8:30 AM)" },
    ],
  };
}
