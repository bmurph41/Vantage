/**
 * Vantage Integrations Engine
 * Unified integration framework: QuickBooks Online, Xero, Stripe, Twilio,
 * Plaid Bank Feeds, Calendar Sync (Google/Outlook), Email Tracking
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { sendEmail } from './email-service';
import { logger } from '../lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export type IntegrationProvider =
  | 'quickbooks'
  | 'xero'
  | 'stripe'
  | 'twilio'
  | 'plaid'
  | 'google_calendar'
  | 'outlook_calendar'
  | 'email_tracking';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface IntegrationRecord {
  id: string;
  orgId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  config: Record<string, any>;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTrackingEvent {
  id: string;
  orgId: string;
  trackingId: string;
  recipientEmail: string;
  subject: string;
  sentAt: Date;
  openedAt: Date | null;
  clickedAt: Date | null;
  clickedUrl: string | null;
  metadata: Record<string, any>;
}

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  externalId?: string;
}

// ─── Environment Config ─────────────────────────────────────────────────────

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID || '';
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET || '';
const QBO_REDIRECT_URI = process.env.QBO_REDIRECT_URI || 'https://vantage.com/api/integrations/qbo/callback';
const QBO_BASE_URL = process.env.QBO_SANDBOX === 'true'
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com';

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID || '';
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET || '';
const XERO_REDIRECT_URI = process.env.XERO_REDIRECT_URI || 'https://vantage.com/api/integrations/xero/callback';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || '';
const PLAID_SECRET = process.env.PLAID_SECRET || '';
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';
const PLAID_BASE_URL = PLAID_ENV === 'production'
  ? 'https://production.plaid.com'
  : PLAID_ENV === 'development'
    ? 'https://development.plaid.com'
    : 'https://sandbox.plaid.com';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://vantage.com/api/integrations/google/callback';

const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID || '';
const OUTLOOK_CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET || '';
const OUTLOOK_REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI || 'https://vantage.com/api/integrations/outlook/callback';

const APP_URL = process.env.APP_URL || 'https://vantage.com';

// ─── Integrations Engine ────────────────────────────────────────────────────

class IntegrationsEngine {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Integration Framework (Base)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Register or update an integration for an organization */
  async registerIntegration(
    orgId: string,
    provider: IntegrationProvider,
    config: {
      accessToken?: string;
      refreshToken?: string;
      tokenExpiresAt?: Date;
      apiKey?: string;
      extra?: Record<string, any>;
    }
  ): Promise<IntegrationRecord> {
    const id = crypto.randomUUID();
    const now = new Date();

    const storedConfig = { ...(config.extra || {}), apiKey: config.apiKey || null };

    const result = await db.execute(sql`
      INSERT INTO integrations (id, org_id, provider, status, config,
        access_token, refresh_token, token_expires_at, created_at, updated_at)
      VALUES (
        ${id}, ${orgId}, ${provider}, 'connected',
        ${JSON.stringify(storedConfig)}::jsonb,
        ${config.accessToken || null},
        ${config.refreshToken || null},
        ${config.tokenExpiresAt?.toISOString() || null}::timestamptz,
        ${now.toISOString()}::timestamptz,
        ${now.toISOString()}::timestamptz
      )
      ON CONFLICT (org_id, provider)
      DO UPDATE SET
        status = 'connected',
        config = ${JSON.stringify(storedConfig)}::jsonb,
        access_token = ${config.accessToken || null},
        refresh_token = ${config.refreshToken || null},
        token_expires_at = ${config.tokenExpiresAt?.toISOString() || null}::timestamptz,
        updated_at = ${now.toISOString()}::timestamptz,
        last_error = NULL
      RETURNING *
    `);

    const row = (result as any).rows[0];
    logger.info({ orgId, provider }, 'Integration registered');
    return this.mapRow(row);
  }

  /** Get integration status for a specific provider */
  async getIntegrationStatus(orgId: string, provider: IntegrationProvider): Promise<{
    status: IntegrationStatus;
    lastSyncAt: Date | null;
    lastError: string | null;
    tokenExpiresAt: Date | null;
  }> {
    const result = await db.execute(sql`
      SELECT status, last_sync_at, last_error, token_expires_at
      FROM integrations
      WHERE org_id = ${orgId} AND provider = ${provider}
    `);

    const row = (result as any).rows[0];
    if (!row) {
      return { status: 'disconnected', lastSyncAt: null, lastError: null, tokenExpiresAt: null };
    }

    // Check if token is expired
    if (row.token_expires_at && new Date(row.token_expires_at) < new Date()) {
      return {
        status: 'error',
        lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
        lastError: 'Token expired — re-authentication required',
        tokenExpiresAt: new Date(row.token_expires_at),
      };
    }

    return {
      status: row.status,
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
      lastError: row.last_error,
      tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : null,
    };
  }

  /** Refresh an OAuth token for a provider */
  async refreshOAuthToken(orgId: string, provider: IntegrationProvider): Promise<boolean> {
    const integration = await this.getIntegration(orgId, provider);
    if (!integration || !integration.refreshToken) {
      logger.warn({ orgId, provider }, 'No refresh token available');
      return false;
    }

    try {
      let tokenUrl: string;
      let clientId: string;
      let clientSecret: string;

      switch (provider) {
        case 'quickbooks':
          tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
          clientId = QBO_CLIENT_ID;
          clientSecret = QBO_CLIENT_SECRET;
          break;
        case 'xero':
          tokenUrl = 'https://identity.xero.com/connect/token';
          clientId = XERO_CLIENT_ID;
          clientSecret = XERO_CLIENT_SECRET;
          break;
        case 'google_calendar':
          tokenUrl = 'https://oauth2.googleapis.com/token';
          clientId = GOOGLE_CLIENT_ID;
          clientSecret = GOOGLE_CLIENT_SECRET;
          break;
        case 'outlook_calendar':
          tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
          clientId = OUTLOOK_CLIENT_ID;
          clientSecret = OUTLOOK_CLIENT_SECRET;
          break;
        default:
          logger.warn({ provider }, 'OAuth refresh not supported for this provider');
          return false;
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${errorBody}`);
      }

      const tokens = await response.json() as any;
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

      await db.execute(sql`
        UPDATE integrations
        SET access_token = ${tokens.access_token},
            refresh_token = ${tokens.refresh_token || integration.refreshToken},
            token_expires_at = ${expiresAt.toISOString()}::timestamptz,
            status = 'connected',
            last_error = NULL,
            updated_at = NOW()
        WHERE org_id = ${orgId} AND provider = ${provider}
      `);

      logger.info({ orgId, provider }, 'OAuth token refreshed');
      return true;
    } catch (error: any) {
      await this.setError(orgId, provider, error.message);
      logger.error({ orgId, provider, error: error.message }, 'OAuth token refresh failed');
      return false;
    }
  }

  /** Disconnect an integration and clean up stored credentials */
  async disconnectIntegration(orgId: string, provider: IntegrationProvider): Promise<void> {
    await db.execute(sql`
      UPDATE integrations
      SET status = 'disconnected',
          access_token = NULL,
          refresh_token = NULL,
          token_expires_at = NULL,
          config = '{}'::jsonb,
          last_error = NULL,
          updated_at = NOW()
      WHERE org_id = ${orgId} AND provider = ${provider}
    `);

    logger.info({ orgId, provider }, 'Integration disconnected');
  }

  /** List all integrations for an organization */
  async listIntegrations(orgId: string): Promise<IntegrationRecord[]> {
    const result = await db.execute(sql`
      SELECT * FROM integrations
      WHERE org_id = ${orgId}
      ORDER BY provider ASC
    `);

    return ((result as any).rows || []).map((r: any) => this.mapRow(r));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. QuickBooks Online
  // ═══════════════════════════════════════════════════════════════════════════

  /** Generate QuickBooks OAuth2 authorization URL */
  qboAuthUrl(orgId: string): string {
    const state = Buffer.from(JSON.stringify({ orgId, ts: Date.now() })).toString('base64url');
    const params = new URLSearchParams({
      client_id: QBO_CLIENT_ID,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: QBO_REDIRECT_URI,
      state,
    });
    return `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  }

  /** Exchange QuickBooks authorization code for tokens */
  async qboCallback(orgId: string, code: string): Promise<IntegrationRecord> {
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: QBO_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QBO token exchange failed: ${response.status} ${errorText}`);
    }

    const tokens = await response.json() as any;
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    return this.registerIntegration(orgId, 'quickbooks', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
      extra: { realmId: tokens.realmId || null },
    });
  }

  /** Sync QuickBooks chart of accounts into local chart_of_accounts table */
  async syncChartOfAccounts(orgId: string): Promise<{ synced: number }> {
    const integration = await this.requireIntegration(orgId, 'quickbooks');
    const realmId = integration.config?.realmId;
    if (!realmId) throw new Error('QBO realmId not found — re-authenticate');

    const response = await this.qboRequest(orgId, realmId, 'query', {
      query: "SELECT * FROM Account WHERE Active = true MAXRESULTS 1000",
    });

    const accounts = response?.QueryResponse?.Account || [];
    let synced = 0;

    for (const acct of accounts) {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO chart_of_accounts (id, org_id, account_code, account_name, account_type,
          parent_id, is_active, external_id, external_source, created_at, updated_at)
        VALUES (
          ${id}, ${orgId}, ${acct.AcctNum || acct.Id}, ${acct.Name},
          ${this.mapQboAccountType(acct.AccountType)},
          NULL, true, ${String(acct.Id)}, 'quickbooks',
          NOW(), NOW()
        )
        ON CONFLICT (org_id, external_id, external_source)
        DO UPDATE SET
          account_name = ${acct.Name},
          account_type = ${this.mapQboAccountType(acct.AccountType)},
          is_active = true,
          updated_at = NOW()
      `);
      synced++;
    }

    await this.updateLastSync(orgId, 'quickbooks');
    logger.info({ orgId, synced }, 'QBO chart of accounts synced');
    return { synced };
  }

  /** Pull QBO invoices into local ar_invoices table */
  async syncInvoices(orgId: string, since?: Date): Promise<{ synced: number }> {
    const integration = await this.requireIntegration(orgId, 'quickbooks');
    const realmId = integration.config?.realmId;
    if (!realmId) throw new Error('QBO realmId not found');

    let query = "SELECT * FROM Invoice MAXRESULTS 1000";
    if (since) {
      query = `SELECT * FROM Invoice WHERE MetaData.LastUpdatedTime >= '${since.toISOString()}' MAXRESULTS 1000`;
    }

    const response = await this.qboRequest(orgId, realmId, 'query', { query });
    const invoices = response?.QueryResponse?.Invoice || [];
    let synced = 0;

    for (const inv of invoices) {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO ar_invoices (id, org_id, invoice_number, customer_name, issue_date,
          due_date, total_amount, balance_due, status, external_id, external_source,
          created_at, updated_at)
        VALUES (
          ${id}, ${orgId}, ${inv.DocNumber || inv.Id},
          ${inv.CustomerRef?.name || 'Unknown'},
          ${inv.TxnDate}::date,
          ${inv.DueDate}::date,
          ${parseFloat(inv.TotalAmt || '0')},
          ${parseFloat(inv.Balance || '0')},
          ${inv.Balance === '0' ? 'paid' : 'sent'},
          ${String(inv.Id)}, 'quickbooks', NOW(), NOW()
        )
        ON CONFLICT (org_id, external_id, external_source)
        DO UPDATE SET
          total_amount = ${parseFloat(inv.TotalAmt || '0')},
          balance_due = ${parseFloat(inv.Balance || '0')},
          status = ${inv.Balance === '0' ? 'paid' : 'sent'},
          updated_at = NOW()
      `);
      synced++;
    }

    await this.updateLastSync(orgId, 'quickbooks');
    logger.info({ orgId, synced }, 'QBO invoices synced');
    return { synced };
  }

  /** Pull QBO bills into local ap_bills table */
  async syncBills(orgId: string, since?: Date): Promise<{ synced: number }> {
    const integration = await this.requireIntegration(orgId, 'quickbooks');
    const realmId = integration.config?.realmId;
    if (!realmId) throw new Error('QBO realmId not found');

    let query = "SELECT * FROM Bill MAXRESULTS 1000";
    if (since) {
      query = `SELECT * FROM Bill WHERE MetaData.LastUpdatedTime >= '${since.toISOString()}' MAXRESULTS 1000`;
    }

    const response = await this.qboRequest(orgId, realmId, 'query', { query });
    const bills = response?.QueryResponse?.Bill || [];
    let synced = 0;

    for (const bill of bills) {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO ap_bills (id, org_id, bill_number, vendor_name, issue_date,
          due_date, total_amount, balance_due, status, external_id, external_source,
          created_at, updated_at)
        VALUES (
          ${id}, ${orgId}, ${bill.DocNumber || bill.Id},
          ${bill.VendorRef?.name || 'Unknown'},
          ${bill.TxnDate}::date,
          ${bill.DueDate}::date,
          ${parseFloat(bill.TotalAmt || '0')},
          ${parseFloat(bill.Balance || '0')},
          ${bill.Balance === '0' ? 'paid' : 'approved'},
          ${String(bill.Id)}, 'quickbooks', NOW(), NOW()
        )
        ON CONFLICT (org_id, external_id, external_source)
        DO UPDATE SET
          total_amount = ${parseFloat(bill.TotalAmt || '0')},
          balance_due = ${parseFloat(bill.Balance || '0')},
          status = ${bill.Balance === '0' ? 'paid' : 'approved'},
          updated_at = NOW()
      `);
      synced++;
    }

    await this.updateLastSync(orgId, 'quickbooks');
    logger.info({ orgId, synced }, 'QBO bills synced');
    return { synced };
  }

  /** Push a local journal entry to QuickBooks */
  async pushJournalEntry(orgId: string, entryId: string): Promise<{ qboId: string }> {
    const integration = await this.requireIntegration(orgId, 'quickbooks');
    const realmId = integration.config?.realmId;
    if (!realmId) throw new Error('QBO realmId not found');

    const jeResult = await db.execute(sql`
      SELECT * FROM journal_entries WHERE id = ${entryId} AND org_id = ${orgId}
    `);
    const je = (jeResult as any).rows[0];
    if (!je) throw new Error(`Journal entry ${entryId} not found`);

    const linesResult = await db.execute(sql`
      SELECT * FROM journal_entry_lines WHERE journal_entry_id = ${entryId}
      ORDER BY line_number ASC
    `);
    const lines = (linesResult as any).rows || [];

    const qboLines = lines.map((line: any) => ({
      JournalEntryLineDetail: {
        PostingType: parseFloat(line.debit_amount || '0') > 0 ? 'Debit' : 'Credit',
        AccountRef: { value: line.external_account_id || line.account_id },
      },
      Amount: parseFloat(line.debit_amount || '0') || parseFloat(line.credit_amount || '0'),
      Description: line.memo || je.memo || '',
    }));

    const payload = {
      TxnDate: je.entry_date,
      DocNumber: je.entry_number,
      Line: qboLines,
    };

    const response = await this.qboApiCall(orgId, realmId, 'POST', '/journalentry', payload);
    const qboId = String(response?.JournalEntry?.Id || 'unknown');

    await db.execute(sql`
      UPDATE journal_entries
      SET external_id = ${qboId}, external_source = 'quickbooks', updated_at = NOW()
      WHERE id = ${entryId}
    `);

    logger.info({ orgId, entryId, qboId }, 'Journal entry pushed to QBO');
    return { qboId };
  }

  /** Sync bank transactions from QBO bank feed */
  async syncBankTransactions(orgId: string, accountId: string, since?: Date): Promise<{ synced: number }> {
    const integration = await this.requireIntegration(orgId, 'quickbooks');
    const realmId = integration.config?.realmId;
    if (!realmId) throw new Error('QBO realmId not found');

    let query = `SELECT * FROM Purchase WHERE AccountRef = '${accountId}' MAXRESULTS 500`;
    if (since) {
      query = `SELECT * FROM Purchase WHERE AccountRef = '${accountId}' AND MetaData.LastUpdatedTime >= '${since.toISOString()}' MAXRESULTS 500`;
    }

    const response = await this.qboRequest(orgId, realmId, 'query', { query });
    const txns = response?.QueryResponse?.Purchase || [];
    let synced = 0;

    for (const txn of txns) {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO bank_transactions (id, org_id, account_id, transaction_date,
          description, amount, transaction_type, external_id, external_source,
          created_at, updated_at)
        VALUES (
          ${id}, ${orgId}, ${accountId}, ${txn.TxnDate}::date,
          ${txn.PrivateNote || txn.EntityRef?.name || 'QBO Transaction'},
          ${parseFloat(txn.TotalAmt || '0')},
          ${txn.PaymentType || 'debit'},
          ${String(txn.Id)}, 'quickbooks', NOW(), NOW()
        )
        ON CONFLICT (org_id, external_id, external_source)
        DO UPDATE SET
          amount = ${parseFloat(txn.TotalAmt || '0')},
          description = ${txn.PrivateNote || txn.EntityRef?.name || 'QBO Transaction'},
          updated_at = NOW()
      `);
      synced++;
    }

    await this.updateLastSync(orgId, 'quickbooks');
    logger.info({ orgId, accountId, synced }, 'QBO bank transactions synced');
    return { synced };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Xero
  // ═══════════════════════════════════════════════════════════════════════════

  /** Generate Xero OAuth2 authorization URL */
  xeroAuthUrl(orgId: string): string {
    const state = Buffer.from(JSON.stringify({ orgId, ts: Date.now() })).toString('base64url');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: XERO_CLIENT_ID,
      redirect_uri: XERO_REDIRECT_URI,
      scope: 'openid profile email accounting.transactions accounting.contacts accounting.settings offline_access',
      state,
    });
    return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
  }

  /** Exchange Xero authorization code for tokens */
  async xeroCallback(orgId: string, code: string): Promise<IntegrationRecord> {
    const response = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: XERO_REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Xero token exchange failed: ${response.status} ${errorText}`);
    }

    const tokens = await response.json() as any;
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 1800) * 1000);

    // Fetch connected tenant ID
    let tenantId: string | null = null;
    try {
      const connResp = await fetch('https://api.xero.com/connections', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` },
      });
      const connections = await connResp.json() as any[];
      tenantId = connections?.[0]?.tenantId || null;
    } catch { /* tenant ID lookup is best-effort */ }

    return this.registerIntegration(orgId, 'xero', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
      extra: { tenantId },
    });
  }

  /** Sync Xero chart of accounts */
  async syncXeroAccounts(orgId: string): Promise<{ synced: number }> {
    const integration = await this.requireIntegration(orgId, 'xero');
    const tenantId = integration.config?.tenantId;
    if (!tenantId) throw new Error('Xero tenantId not found — re-authenticate');

    const response = await this.xeroApiCall(orgId, tenantId, 'GET', '/api.xro/2.0/Accounts');
    const accounts = response?.Accounts || [];
    let synced = 0;

    for (const acct of accounts) {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO chart_of_accounts (id, org_id, account_code, account_name, account_type,
          is_active, external_id, external_source, created_at, updated_at)
        VALUES (
          ${id}, ${orgId}, ${acct.Code || acct.AccountID},
          ${acct.Name}, ${this.mapXeroAccountType(acct.Type)},
          ${acct.Status === 'ACTIVE'}, ${acct.AccountID}, 'xero',
          NOW(), NOW()
        )
        ON CONFLICT (org_id, external_id, external_source)
        DO UPDATE SET
          account_name = ${acct.Name},
          account_type = ${this.mapXeroAccountType(acct.Type)},
          is_active = ${acct.Status === 'ACTIVE'},
          updated_at = NOW()
      `);
      synced++;
    }

    await this.updateLastSync(orgId, 'xero');
    logger.info({ orgId, synced }, 'Xero accounts synced');
    return { synced };
  }

  /** Sync Xero invoices */
  async syncXeroInvoices(orgId: string, since?: Date): Promise<{ synced: number }> {
    const integration = await this.requireIntegration(orgId, 'xero');
    const tenantId = integration.config?.tenantId;
    if (!tenantId) throw new Error('Xero tenantId not found');

    let url = '/api.xro/2.0/Invoices?page=1&pageSize=100';
    if (since) {
      url += `&where=UpdatedDateUTC>DateTime(${since.getUTCFullYear()},${since.getUTCMonth() + 1},${since.getUTCDate()})`;
    }

    const response = await this.xeroApiCall(orgId, tenantId, 'GET', url);
    const invoices = response?.Invoices || [];
    let synced = 0;

    for (const inv of invoices) {
      const id = crypto.randomUUID();
      const isReceivable = inv.Type === 'ACCREC';
      const tableName = isReceivable ? 'ar_invoices' : 'ap_bills';
      const nameField = isReceivable ? 'customer_name' : 'vendor_name';

      await db.execute(sql`
        INSERT INTO ar_invoices (id, org_id, invoice_number, customer_name, issue_date,
          due_date, total_amount, balance_due, status, external_id, external_source,
          created_at, updated_at)
        VALUES (
          ${id}, ${orgId}, ${inv.InvoiceNumber || inv.InvoiceID},
          ${inv.Contact?.Name || 'Unknown'},
          ${inv.DateString}::date,
          ${inv.DueDateString}::date,
          ${parseFloat(inv.Total || '0')},
          ${parseFloat(inv.AmountDue || '0')},
          ${this.mapXeroInvoiceStatus(inv.Status)},
          ${inv.InvoiceID}, 'xero', NOW(), NOW()
        )
        ON CONFLICT (org_id, external_id, external_source)
        DO UPDATE SET
          total_amount = ${parseFloat(inv.Total || '0')},
          balance_due = ${parseFloat(inv.AmountDue || '0')},
          status = ${this.mapXeroInvoiceStatus(inv.Status)},
          updated_at = NOW()
      `);
      synced++;
    }

    await this.updateLastSync(orgId, 'xero');
    logger.info({ orgId, synced }, 'Xero invoices synced');
    return { synced };
  }

  /** Sync Xero bills */
  async syncXeroBills(orgId: string, since?: Date): Promise<{ synced: number }> {
    const integration = await this.requireIntegration(orgId, 'xero');
    const tenantId = integration.config?.tenantId;
    if (!tenantId) throw new Error('Xero tenantId not found');

    let url = '/api.xro/2.0/Invoices?where=Type=="ACCPAY"&page=1&pageSize=100';
    if (since) {
      url += `%20AND%20UpdatedDateUTC>DateTime(${since.getUTCFullYear()},${since.getUTCMonth() + 1},${since.getUTCDate()})`;
    }

    const response = await this.xeroApiCall(orgId, tenantId, 'GET', url);
    const bills = response?.Invoices || [];
    let synced = 0;

    for (const bill of bills) {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO ap_bills (id, org_id, bill_number, vendor_name, issue_date,
          due_date, total_amount, balance_due, status, external_id, external_source,
          created_at, updated_at)
        VALUES (
          ${id}, ${orgId}, ${bill.InvoiceNumber || bill.InvoiceID},
          ${bill.Contact?.Name || 'Unknown'},
          ${bill.DateString}::date,
          ${bill.DueDateString}::date,
          ${parseFloat(bill.Total || '0')},
          ${parseFloat(bill.AmountDue || '0')},
          ${this.mapXeroInvoiceStatus(bill.Status)},
          ${bill.InvoiceID}, 'xero', NOW(), NOW()
        )
        ON CONFLICT (org_id, external_id, external_source)
        DO UPDATE SET
          total_amount = ${parseFloat(bill.Total || '0')},
          balance_due = ${parseFloat(bill.AmountDue || '0')},
          status = ${this.mapXeroInvoiceStatus(bill.Status)},
          updated_at = NOW()
      `);
      synced++;
    }

    await this.updateLastSync(orgId, 'xero');
    logger.info({ orgId, synced }, 'Xero bills synced');
    return { synced };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Stripe Billing
  // ═══════════════════════════════════════════════════════════════════════════

  /** Create or retrieve a Stripe customer for an organization */
  async ensureStripeCustomer(orgId: string, email: string): Promise<{ customerId: string }> {
    if (!STRIPE_SECRET_KEY) throw new Error('Stripe is not configured');

    // Check if we already have a Stripe customer stored
    const result = await db.execute(sql`
      SELECT config->>'stripeCustomerId' AS stripe_customer_id
      FROM integrations
      WHERE org_id = ${orgId} AND provider = 'stripe'
    `);

    const existing = (result as any).rows[0]?.stripe_customer_id;
    if (existing) return { customerId: existing };

    // Create new Stripe customer
    const response = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email,
        metadata: JSON.stringify({ orgId }),
        description: `Vantage org ${orgId}`,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Stripe customer creation failed: ${err}`);
    }

    const customer = await response.json() as any;

    await this.registerIntegration(orgId, 'stripe', {
      extra: { stripeCustomerId: customer.id, email },
    });

    logger.info({ orgId, customerId: customer.id }, 'Stripe customer created');
    return { customerId: customer.id };
  }

  /** Create a Stripe Checkout session for subscription */
  async createCheckoutSession(orgId: string, priceId: string, returnUrl: string): Promise<{ sessionUrl: string }> {
    if (!STRIPE_SECRET_KEY) throw new Error('Stripe is not configured');

    const integration = await this.getIntegration(orgId, 'stripe');
    const customerId = integration?.config?.stripeCustomerId;
    if (!customerId) throw new Error('No Stripe customer — call ensureStripeCustomer first');

    const params = new URLSearchParams({
      'customer': customerId,
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${returnUrl}?cancelled=true`,
      'metadata[orgId]': orgId,
    });

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Stripe checkout failed: ${err}`);
    }

    const session = await response.json() as any;
    logger.info({ orgId, sessionId: session.id }, 'Stripe checkout session created');
    return { sessionUrl: session.url };
  }

  /** Create a Stripe billing portal session */
  async createPortalSession(orgId: string, returnUrl: string): Promise<{ portalUrl: string }> {
    if (!STRIPE_SECRET_KEY) throw new Error('Stripe is not configured');

    const integration = await this.getIntegration(orgId, 'stripe');
    const customerId = integration?.config?.stripeCustomerId;
    if (!customerId) throw new Error('No Stripe customer found');

    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: customerId,
        return_url: returnUrl,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Stripe portal session failed: ${err}`);
    }

    const session = await response.json() as any;
    return { portalUrl: session.url };
  }

  /** Poll Stripe for current subscription status */
  async syncSubscriptionStatus(orgId: string): Promise<{
    status: string;
    planId: string | null;
    currentPeriodEnd: Date | null;
  }> {
    if (!STRIPE_SECRET_KEY) throw new Error('Stripe is not configured');

    const integration = await this.getIntegration(orgId, 'stripe');
    const customerId = integration?.config?.stripeCustomerId;
    if (!customerId) return { status: 'none', planId: null, currentPeriodEnd: null };

    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active&limit=1`,
      { headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` } }
    );

    if (!response.ok) {
      throw new Error(`Stripe subscription check failed: ${response.status}`);
    }

    const data = await response.json() as any;
    const sub = data.data?.[0];

    if (!sub) return { status: 'none', planId: null, currentPeriodEnd: null };

    const status = sub.status;
    const planId = sub.items?.data?.[0]?.price?.id || null;
    const currentPeriodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null;

    // Persist to local billing table
    await db.execute(sql`
      UPDATE billing_subscriptions
      SET status = ${status},
          stripe_subscription_id = ${sub.id},
          current_period_end = ${currentPeriodEnd?.toISOString() || null}::timestamptz,
          updated_at = NOW()
      WHERE org_id = ${orgId}
    `);

    logger.info({ orgId, status, planId }, 'Stripe subscription status synced');
    return { status, planId, currentPeriodEnd };
  }

  /** Record a usage-based billing event */
  async recordUsageEvent(orgId: string, metricType: string, quantity: number): Promise<void> {
    const id = crypto.randomUUID();

    await db.execute(sql`
      INSERT INTO billing_usage_metrics (id, org_id, metric_type, quantity, recorded_at)
      VALUES (${id}, ${orgId}, ${metricType}, ${quantity}, NOW())
    `);

    // If Stripe is configured, also report to Stripe metered billing
    if (STRIPE_SECRET_KEY) {
      try {
        const integration = await this.getIntegration(orgId, 'stripe');
        const customerId = integration?.config?.stripeCustomerId;
        if (customerId) {
          await fetch('https://api.stripe.com/v1/billing/meter_events', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              event_name: metricType,
              'payload[stripe_customer_id]': customerId,
              'payload[value]': String(quantity),
              timestamp: String(Math.floor(Date.now() / 1000)),
            }),
          });
        }
      } catch (err: any) {
        logger.warn({ orgId, metricType, error: err.message }, 'Stripe usage event reporting failed');
      }
    }

    logger.info({ orgId, metricType, quantity }, 'Usage event recorded');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Twilio SMS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Send an SMS via Twilio */
  async sendSms(to: string, body: string): Promise<{ sid: string }> {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio is not configured');
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: TWILIO_FROM_NUMBER,
          Body: body,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Twilio SMS failed: ${response.status} ${err}`);
    }

    const result = await response.json() as any;
    logger.info({ to, sid: result.sid }, 'SMS sent via Twilio');
    return { sid: result.sid };
  }

  /** Generate and send a 2FA verification code */
  async send2FACode(userId: string, phoneNumber: string): Promise<{ codeSent: boolean }> {
    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store the verification code
    await db.execute(sql`
      INSERT INTO verification_codes (id, user_id, code, phone_number, expires_at, created_at)
      VALUES (${crypto.randomUUID()}, ${userId}, ${code}, ${phoneNumber}, ${expiresAt.toISOString()}::timestamptz, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        code = ${code},
        phone_number = ${phoneNumber},
        expires_at = ${expiresAt.toISOString()}::timestamptz,
        verified = false,
        attempts = 0,
        created_at = NOW()
    `);

    await this.sendSms(phoneNumber, `Your Vantage verification code is: ${code}. It expires in 10 minutes.`);

    logger.info({ userId }, '2FA code sent');
    return { codeSent: true };
  }

  /** Verify a submitted 2FA code */
  async verify2FACode(userId: string, code: string): Promise<{ verified: boolean; error?: string }> {
    const result = await db.execute(sql`
      SELECT * FROM verification_codes
      WHERE user_id = ${userId} AND verified = false
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const record = (result as any).rows[0];
    if (!record) return { verified: false, error: 'No pending verification code' };

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      return { verified: false, error: 'Verification code expired' };
    }

    // Check attempts (max 5)
    if ((record.attempts || 0) >= 5) {
      return { verified: false, error: 'Too many failed attempts — request a new code' };
    }

    // Increment attempt count
    await db.execute(sql`
      UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ${record.id}
    `);

    if (record.code !== code) {
      return { verified: false, error: 'Invalid code' };
    }

    // Mark as verified
    await db.execute(sql`
      UPDATE verification_codes SET verified = true WHERE id = ${record.id}
    `);

    logger.info({ userId }, '2FA code verified');
    return { verified: true };
  }

  /** Send SMS to multiple recipients */
  async sendBulkSms(recipients: string[], body: string): Promise<{ sent: number; failed: number; errors: string[] }> {
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const to of recipients) {
      try {
        await this.sendSms(to, body);
        sent++;
      } catch (err: any) {
        failed++;
        errors.push(`${to}: ${err.message}`);
        logger.warn({ to, error: err.message }, 'Bulk SMS send failed for recipient');
      }
    }

    logger.info({ sent, failed, total: recipients.length }, 'Bulk SMS completed');
    return { sent, failed, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Plaid Bank Feeds
  // ═══════════════════════════════════════════════════════════════════════════

  /** Create a Plaid Link token for the frontend widget */
  async createPlaidLinkToken(orgId: string, userId: string): Promise<{ linkToken: string }> {
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) throw new Error('Plaid is not configured');

    const response = await fetch(`${PLAID_BASE_URL}/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        client_name: 'Vantage',
        user: { client_user_id: userId },
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
        webhook: `${APP_URL}/api/webhooks/plaid`,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Plaid link token creation failed: ${err}`);
    }

    const data = await response.json() as any;
    logger.info({ orgId, userId }, 'Plaid link token created');
    return { linkToken: data.link_token };
  }

  /** Exchange Plaid public token for access token */
  async exchangePlaidPublicToken(orgId: string, publicToken: string): Promise<IntegrationRecord> {
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) throw new Error('Plaid is not configured');

    const response = await fetch(`${PLAID_BASE_URL}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token: publicToken,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Plaid token exchange failed: ${err}`);
    }

    const data = await response.json() as any;

    return this.registerIntegration(orgId, 'plaid', {
      accessToken: data.access_token,
      extra: { itemId: data.item_id },
    });
  }

  /** Sync linked bank accounts from Plaid */
  async syncBankAccounts(orgId: string): Promise<{ synced: number }> {
    const integration = await this.requireIntegration(orgId, 'plaid');

    const response = await fetch(`${PLAID_BASE_URL}/accounts/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: integration.accessToken,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Plaid accounts sync failed: ${err}`);
    }

    const data = await response.json() as any;
    const accounts = data.accounts || [];
    let synced = 0;

    for (const acct of accounts) {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO bank_accounts (id, org_id, account_name, account_type, institution_name,
          mask, current_balance, available_balance, external_id, external_source,
          created_at, updated_at)
        VALUES (
          ${id}, ${orgId}, ${acct.name || acct.official_name || 'Bank Account'},
          ${acct.subtype || acct.type || 'checking'},
          ${data.item?.institution_id || 'unknown'},
          ${acct.mask || null},
          ${acct.balances?.current || 0},
          ${acct.balances?.available || 0},
          ${acct.account_id}, 'plaid', NOW(), NOW()
        )
        ON CONFLICT (org_id, external_id, external_source)
        DO UPDATE SET
          current_balance = ${acct.balances?.current || 0},
          available_balance = ${acct.balances?.available || 0},
          updated_at = NOW()
      `);
      synced++;
    }

    await this.updateLastSync(orgId, 'plaid');
    logger.info({ orgId, synced }, 'Plaid bank accounts synced');
    return { synced };
  }

  /** Pull transactions from Plaid for a specific account */
  async syncTransactions(
    orgId: string,
    accountId: string,
    startDate: string,
    endDate: string
  ): Promise<{ synced: number }> {
    const integration = await this.requireIntegration(orgId, 'plaid');

    const response = await fetch(`${PLAID_BASE_URL}/transactions/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: integration.accessToken,
        start_date: startDate,
        end_date: endDate,
        options: {
          account_ids: [accountId],
          count: 500,
          offset: 0,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Plaid transactions sync failed: ${err}`);
    }

    const data = await response.json() as any;
    const transactions = data.transactions || [];
    let synced = 0;

    for (const txn of transactions) {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO bank_transactions (id, org_id, account_id, transaction_date,
          description, amount, category, merchant_name, external_id, external_source,
          created_at, updated_at)
        VALUES (
          ${id}, ${orgId}, ${accountId}, ${txn.date}::date,
          ${txn.name || txn.merchant_name || 'Transaction'},
          ${txn.amount},
          ${txn.category?.[0] || null},
          ${txn.merchant_name || null},
          ${txn.transaction_id}, 'plaid', NOW(), NOW()
        )
        ON CONFLICT (org_id, external_id, external_source)
        DO UPDATE SET
          amount = ${txn.amount},
          description = ${txn.name || txn.merchant_name || 'Transaction'},
          category = ${txn.category?.[0] || null},
          updated_at = NOW()
      `);
      synced++;
    }

    await this.updateLastSync(orgId, 'plaid');
    logger.info({ orgId, accountId, synced }, 'Plaid transactions synced');
    return { synced };
  }

  /** Get real-time balance for a Plaid-linked account */
  async getPlaidBalance(orgId: string, accountId: string): Promise<{
    current: number;
    available: number | null;
    limit: number | null;
  }> {
    const integration = await this.requireIntegration(orgId, 'plaid');

    const response = await fetch(`${PLAID_BASE_URL}/accounts/balance/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token: integration.accessToken,
        options: { account_ids: [accountId] },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Plaid balance check failed: ${err}`);
    }

    const data = await response.json() as any;
    const acct = data.accounts?.[0];

    if (!acct) throw new Error(`Account ${accountId} not found in Plaid response`);

    return {
      current: acct.balances?.current || 0,
      available: acct.balances?.available ?? null,
      limit: acct.balances?.limit ?? null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Calendar Sync (Google Calendar + Outlook)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Generate OAuth URL for Google Calendar or Outlook */
  calendarAuthUrl(orgId: string, provider: 'google_calendar' | 'outlook_calendar'): string {
    const state = Buffer.from(JSON.stringify({ orgId, provider, ts: Date.now() })).toString('base64url');

    if (provider === 'google_calendar') {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
        access_type: 'offline',
        prompt: 'consent',
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    // Outlook
    const params = new URLSearchParams({
      client_id: OUTLOOK_CLIENT_ID,
      redirect_uri: OUTLOOK_REDIRECT_URI,
      response_type: 'code',
      scope: 'Calendars.ReadWrite offline_access',
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /** Exchange calendar OAuth code for tokens */
  async calendarCallback(
    orgId: string,
    provider: 'google_calendar' | 'outlook_calendar',
    code: string
  ): Promise<IntegrationRecord> {
    let tokenUrl: string;
    let clientId: string;
    let clientSecret: string;
    let redirectUri: string;

    if (provider === 'google_calendar') {
      tokenUrl = 'https://oauth2.googleapis.com/token';
      clientId = GOOGLE_CLIENT_ID;
      clientSecret = GOOGLE_CLIENT_SECRET;
      redirectUri = GOOGLE_REDIRECT_URI;
    } else {
      tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      clientId = OUTLOOK_CLIENT_ID;
      clientSecret = OUTLOOK_CLIENT_SECRET;
      redirectUri = OUTLOOK_REDIRECT_URI;
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Calendar token exchange failed for ${provider}: ${err}`);
    }

    const tokens = await response.json() as any;
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

    return this.registerIntegration(orgId, provider, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
    });
  }

  /** Pull calendar events into CRM tasks/meetings */
  async syncCalendarEvents(
    orgId: string,
    provider: 'google_calendar' | 'outlook_calendar',
    since?: Date
  ): Promise<{ synced: number }> {
    const integration = await this.requireIntegration(orgId, provider);
    const sinceISO = (since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString();

    let events: any[] = [];

    if (provider === 'google_calendar') {
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(sinceISO)}&maxResults=250&singleEvents=true&orderBy=startTime`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${integration.accessToken}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          await this.refreshOAuthToken(orgId, provider);
          throw new Error('Token refreshed — retry sync');
        }
        throw new Error(`Google Calendar API failed: ${response.status}`);
      }

      const data = await response.json() as any;
      events = (data.items || []).map((e: any) => ({
        externalId: e.id,
        title: e.summary || 'Untitled',
        description: e.description || '',
        startTime: e.start?.dateTime || e.start?.date,
        endTime: e.end?.dateTime || e.end?.date,
        location: e.location || null,
        attendees: (e.attendees || []).map((a: any) => a.email),
      }));
    } else {
      // Outlook
      const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(sinceISO)}&endDateTime=${encodeURIComponent(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString())}&$top=250`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${integration.accessToken}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          await this.refreshOAuthToken(orgId, provider);
          throw new Error('Token refreshed — retry sync');
        }
        throw new Error(`Outlook Calendar API failed: ${response.status}`);
      }

      const data = await response.json() as any;
      events = (data.value || []).map((e: any) => ({
        externalId: e.id,
        title: e.subject || 'Untitled',
        description: e.bodyPreview || '',
        startTime: e.start?.dateTime,
        endTime: e.end?.dateTime,
        location: e.location?.displayName || null,
        attendees: (e.attendees || []).map((a: any) => a.emailAddress?.address),
      }));
    }

    let synced = 0;
    for (const evt of events) {
      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO crm_tasks (id, org_id, title, description, task_type, status,
          due_date, start_date, location, external_id, external_source,
          created_at, updated_at)
        VALUES (
          ${id}, ${orgId}, ${evt.title}, ${evt.description}, 'meeting', 'scheduled',
          ${evt.endTime}::timestamptz,
          ${evt.startTime}::timestamptz,
          ${evt.location || null},
          ${evt.externalId}, ${provider},
          NOW(), NOW()
        )
        ON CONFLICT (org_id, external_id, external_source)
        DO UPDATE SET
          title = ${evt.title},
          description = ${evt.description},
          due_date = ${evt.endTime}::timestamptz,
          start_date = ${evt.startTime}::timestamptz,
          location = ${evt.location || null},
          updated_at = NOW()
      `);
      synced++;
    }

    await this.updateLastSync(orgId, provider);
    logger.info({ orgId, provider, synced }, 'Calendar events synced');
    return { synced };
  }

  /** Push a CRM task/meeting as a calendar event */
  async pushEvent(
    orgId: string,
    provider: 'google_calendar' | 'outlook_calendar',
    event: CalendarEvent
  ): Promise<{ externalId: string }> {
    const integration = await this.requireIntegration(orgId, provider);

    if (provider === 'google_calendar') {
      const payload = {
        summary: event.title,
        description: event.description || '',
        start: { dateTime: new Date(event.startTime).toISOString(), timeZone: 'UTC' },
        end: { dateTime: new Date(event.endTime).toISOString(), timeZone: 'UTC' },
        location: event.location || undefined,
        attendees: event.attendees?.map(e => ({ email: e })),
      };

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Google Calendar event creation failed: ${err}`);
      }

      const created = await response.json() as any;
      return { externalId: created.id };
    }

    // Outlook
    const payload = {
      subject: event.title,
      body: { contentType: 'text', content: event.description || '' },
      start: { dateTime: new Date(event.startTime).toISOString(), timeZone: 'UTC' },
      end: { dateTime: new Date(event.endTime).toISOString(), timeZone: 'UTC' },
      location: event.location ? { displayName: event.location } : undefined,
      attendees: event.attendees?.map(e => ({
        emailAddress: { address: e },
        type: 'required',
      })),
    };

    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Outlook event creation failed: ${err}`);
    }

    const created = await response.json() as any;
    return { externalId: created.id };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. Email Tracking
  // ═══════════════════════════════════════════════════════════════════════════

  /** Send an email with open/click tracking pixels */
  async sendTrackedEmail(
    orgId: string,
    to: string,
    subject: string,
    html: string,
    metadata?: Record<string, any>
  ): Promise<{ trackingId: string; sent: boolean }> {
    const trackingId = crypto.randomUUID();

    // Inject tracking pixel for open detection
    const trackingPixel = `<img src="${APP_URL}/api/tracking/open/${trackingId}" width="1" height="1" style="display:none" alt="" />`;

    // Rewrite links for click tracking
    const trackedHtml = this.injectClickTracking(html, trackingId) + trackingPixel;

    // Store tracking record
    await db.execute(sql`
      INSERT INTO email_tracking (id, org_id, tracking_id, recipient_email, subject,
        metadata, sent_at, created_at)
      VALUES (
        ${crypto.randomUUID()}, ${orgId}, ${trackingId}, ${to}, ${subject},
        ${JSON.stringify(metadata || {})}::jsonb,
        NOW(), NOW()
      )
    `);

    // Send via the existing email service
    const sent = await sendEmail({
      to,
      subject,
      text: subject, // fallback plain text
      html: trackedHtml,
    });

    if (!sent) {
      await db.execute(sql`
        UPDATE email_tracking SET bounce = true WHERE tracking_id = ${trackingId}
      `);
    }

    logger.info({ orgId, to, trackingId, sent }, 'Tracked email sent');
    return { trackingId, sent };
  }

  /** Record an email open event */
  async recordEmailOpen(trackingId: string): Promise<void> {
    await db.execute(sql`
      UPDATE email_tracking
      SET opened_at = COALESCE(opened_at, NOW()),
          open_count = COALESCE(open_count, 0) + 1
      WHERE tracking_id = ${trackingId}
    `);

    logger.info({ trackingId }, 'Email open recorded');
  }

  /** Record an email click event */
  async recordEmailClick(trackingId: string, url: string): Promise<void> {
    await db.execute(sql`
      UPDATE email_tracking
      SET clicked_at = COALESCE(clicked_at, NOW()),
          click_count = COALESCE(click_count, 0) + 1,
          last_clicked_url = ${url}
      WHERE tracking_id = ${trackingId}
    `);

    // Also log individual click event
    await db.execute(sql`
      INSERT INTO email_tracking_events (id, tracking_id, event_type, url, occurred_at)
      VALUES (${crypto.randomUUID()}, ${trackingId}, 'click', ${url}, NOW())
    `);

    logger.info({ trackingId, url }, 'Email click recorded');
  }

  /** Get email metrics with filtering */
  async getEmailMetrics(orgId: string, filters?: {
    campaignId?: string;
    contactEmail?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    recentEmails: EmailTrackingEvent[];
  }> {
    let whereClause = `org_id = '${orgId}'`;

    if (filters?.contactEmail) {
      whereClause += ` AND recipient_email = '${filters.contactEmail}'`;
    }
    if (filters?.startDate) {
      whereClause += ` AND sent_at >= '${filters.startDate.toISOString()}'`;
    }
    if (filters?.endDate) {
      whereClause += ` AND sent_at <= '${filters.endDate.toISOString()}'`;
    }
    if (filters?.campaignId) {
      whereClause += ` AND metadata->>'campaignId' = '${filters.campaignId}'`;
    }

    const statsResult = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total_sent,
        COUNT(opened_at)::int AS total_opened,
        COUNT(clicked_at)::int AS total_clicked,
        COUNT(CASE WHEN bounce = true THEN 1 END)::int AS total_bounced
      FROM email_tracking
      WHERE org_id = ${orgId}
        AND (${filters?.contactEmail || null}::text IS NULL OR recipient_email = ${filters?.contactEmail || null})
        AND (${filters?.startDate?.toISOString() || null}::timestamptz IS NULL OR sent_at >= ${filters?.startDate?.toISOString() || null}::timestamptz)
        AND (${filters?.endDate?.toISOString() || null}::timestamptz IS NULL OR sent_at <= ${filters?.endDate?.toISOString() || null}::timestamptz)
        AND (${filters?.campaignId || null}::text IS NULL OR metadata->>'campaignId' = ${filters?.campaignId || null})
    `);

    const stats = (statsResult as any).rows[0] || {};
    const totalSent = parseInt(stats.total_sent || '0');
    const totalOpened = parseInt(stats.total_opened || '0');
    const totalClicked = parseInt(stats.total_clicked || '0');
    const totalBounced = parseInt(stats.total_bounced || '0');

    const recentResult = await db.execute(sql`
      SELECT * FROM email_tracking
      WHERE org_id = ${orgId}
      ORDER BY sent_at DESC
      LIMIT 50
    `);

    const recentEmails = ((recentResult as any).rows || []).map((r: any) => ({
      id: r.id,
      orgId: r.org_id,
      trackingId: r.tracking_id,
      recipientEmail: r.recipient_email,
      subject: r.subject,
      sentAt: r.sent_at ? new Date(r.sent_at) : null,
      openedAt: r.opened_at ? new Date(r.opened_at) : null,
      clickedAt: r.clicked_at ? new Date(r.clicked_at) : null,
      clickedUrl: r.last_clicked_url || null,
      metadata: r.metadata || {},
    }));

    return {
      totalSent,
      totalOpened,
      totalClicked,
      totalBounced,
      openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 10000) / 100 : 0,
      clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 10000) / 100 : 0,
      bounceRate: totalSent > 0 ? Math.round((totalBounced / totalSent) * 10000) / 100 : 0,
      recentEmails,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get an integration record or null */
  private async getIntegration(orgId: string, provider: IntegrationProvider): Promise<IntegrationRecord | null> {
    const result = await db.execute(sql`
      SELECT * FROM integrations WHERE org_id = ${orgId} AND provider = ${provider}
    `);
    const row = (result as any).rows[0];
    return row ? this.mapRow(row) : null;
  }

  /** Get integration or throw if not connected */
  private async requireIntegration(orgId: string, provider: IntegrationProvider): Promise<IntegrationRecord> {
    const integration = await this.getIntegration(orgId, provider);
    if (!integration || integration.status === 'disconnected') {
      throw new Error(`${provider} integration is not connected for org ${orgId}`);
    }

    // Auto-refresh if token is expiring within 5 minutes
    if (integration.tokenExpiresAt) {
      const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
      if (integration.tokenExpiresAt < fiveMinFromNow) {
        const refreshed = await this.refreshOAuthToken(orgId, provider);
        if (refreshed) {
          return (await this.getIntegration(orgId, provider))!;
        }
      }
    }

    return integration;
  }

  /** Update last_sync_at timestamp */
  private async updateLastSync(orgId: string, provider: IntegrationProvider): Promise<void> {
    await db.execute(sql`
      UPDATE integrations SET last_sync_at = NOW(), updated_at = NOW()
      WHERE org_id = ${orgId} AND provider = ${provider}
    `);
  }

  /** Set error status on an integration */
  private async setError(orgId: string, provider: IntegrationProvider, error: string): Promise<void> {
    await db.execute(sql`
      UPDATE integrations
      SET status = 'error', last_error = ${error}, updated_at = NOW()
      WHERE org_id = ${orgId} AND provider = ${provider}
    `);
  }

  /** Map a database row to IntegrationRecord */
  private mapRow(row: any): IntegrationRecord {
    return {
      id: row.id,
      orgId: row.org_id,
      provider: row.provider,
      status: row.status,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {}),
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : null,
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
      lastError: row.last_error,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /** Make a QBO query request */
  private async qboRequest(orgId: string, realmId: string, type: string, params: Record<string, any>): Promise<any> {
    if (type === 'query') {
      return this.qboApiCall(orgId, realmId, 'GET', `/query?query=${encodeURIComponent(params.query)}`);
    }
    return this.qboApiCall(orgId, realmId, 'POST', `/${type}`, params);
  }

  /** Make authenticated QBO API call */
  private async qboApiCall(orgId: string, realmId: string, method: string, path: string, body?: any): Promise<any> {
    const integration = await this.requireIntegration(orgId, 'quickbooks');
    const url = `${QBO_BASE_URL}/v3/company/${realmId}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${integration.accessToken}`,
      'Accept': 'application/json',
    };

    const options: RequestInit = { method, headers };

    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (response.status === 401) {
      const refreshed = await this.refreshOAuthToken(orgId, 'quickbooks');
      if (!refreshed) throw new Error('QBO token refresh failed — re-authenticate');

      const retryIntegration = await this.requireIntegration(orgId, 'quickbooks');
      headers['Authorization'] = `Bearer ${retryIntegration.accessToken}`;
      const retryResponse = await fetch(url, { method, headers, body: options.body });

      if (!retryResponse.ok) {
        const err = await retryResponse.text();
        throw new Error(`QBO API call failed after retry: ${retryResponse.status} ${err}`);
      }
      return retryResponse.json();
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`QBO API call failed: ${response.status} ${err}`);
    }

    return response.json();
  }

  /** Make authenticated Xero API call */
  private async xeroApiCall(orgId: string, tenantId: string, method: string, path: string, body?: any): Promise<any> {
    const integration = await this.requireIntegration(orgId, 'xero');
    const url = `https://api.xero.com${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${integration.accessToken}`,
      'Xero-Tenant-Id': tenantId,
      'Accept': 'application/json',
    };

    const options: RequestInit = { method, headers };

    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (response.status === 401) {
      const refreshed = await this.refreshOAuthToken(orgId, 'xero');
      if (!refreshed) throw new Error('Xero token refresh failed — re-authenticate');

      const retryIntegration = await this.requireIntegration(orgId, 'xero');
      headers['Authorization'] = `Bearer ${retryIntegration.accessToken}`;
      const retryResponse = await fetch(url, { method, headers, body: options.body });

      if (!retryResponse.ok) {
        const err = await retryResponse.text();
        throw new Error(`Xero API call failed after retry: ${retryResponse.status} ${err}`);
      }
      return retryResponse.json();
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Xero API call failed: ${response.status} ${err}`);
    }

    return response.json();
  }

  /** Map QBO account type to local account type */
  private mapQboAccountType(qboType: string): string {
    const map: Record<string, string> = {
      'Bank': 'asset',
      'Other Current Asset': 'asset',
      'Fixed Asset': 'asset',
      'Other Asset': 'asset',
      'Accounts Receivable': 'asset',
      'Accounts Payable': 'liability',
      'Credit Card': 'liability',
      'Other Current Liability': 'liability',
      'Long Term Liability': 'liability',
      'Equity': 'equity',
      'Income': 'revenue',
      'Other Income': 'revenue',
      'Expense': 'expense',
      'Other Expense': 'expense',
      'Cost of Goods Sold': 'expense',
    };
    return map[qboType] || 'expense';
  }

  /** Map Xero account type to local account type */
  private mapXeroAccountType(xeroType: string): string {
    const map: Record<string, string> = {
      'BANK': 'asset',
      'CURRENT': 'asset',
      'CURRLIAB': 'liability',
      'TERMLIAB': 'liability',
      'FIXED': 'asset',
      'EQUITY': 'equity',
      'REVENUE': 'revenue',
      'DIRECTCOSTS': 'expense',
      'OVERHEADS': 'expense',
      'DEPRECIATN': 'expense',
      'OTHERINCOME': 'revenue',
      'EXPENSE': 'expense',
    };
    return map[xeroType] || 'expense';
  }

  /** Map Xero invoice status to local status */
  private mapXeroInvoiceStatus(xeroStatus: string): string {
    const map: Record<string, string> = {
      'DRAFT': 'draft',
      'SUBMITTED': 'sent',
      'AUTHORISED': 'sent',
      'PAID': 'paid',
      'VOIDED': 'void',
      'DELETED': 'void',
    };
    return map[xeroStatus] || 'draft';
  }

  /** Inject click tracking URLs into HTML links */
  private injectClickTracking(html: string, trackingId: string): string {
    return html.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (match, url) => {
        const trackUrl = `${APP_URL}/api/tracking/click/${trackingId}?url=${encodeURIComponent(url)}`;
        return `href="${trackUrl}"`;
      }
    );
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const integrationsEngine = new IntegrationsEngine();
