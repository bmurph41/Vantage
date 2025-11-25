import { db } from '../db';
import { 
  quickbooksIntegrations,
  quickbooksSyncLogs,
  modelingActuals,
  organizations
} from '@shared/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import axios from 'axios';
import crypto from 'crypto';

const QB_OAUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_SANDBOX_API = 'https://sandbox-quickbooks.api.intuit.com/v3/company';
const QB_PRODUCTION_API = 'https://quickbooks.api.intuit.com/v3/company';

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  useSandbox?: boolean;
}

export interface QuickBooksTokens {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  expiresAt: Date;
}

export interface ChartOfAccountsMapping {
  [qbAccountId: string]: {
    category: string;
    subcategory: string;
    description?: string;
  };
}

export interface ProfitAndLossReport {
  startDate: string;
  endDate: string;
  rows: Array<{
    account: string;
    accountId: string;
    type: 'Income' | 'Expense' | 'COGS' | 'Other';
    amount: number;
    group?: string;
  }>;
  totalIncome: number;
  totalExpenses: number;
  totalCOGS: number;
  netIncome: number;
}

export class QuickBooksService {
  private config: QuickBooksConfig;
  private encryptionKey: string;

  constructor() {
    this.config = {
      clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'https://your-app.replit.app/api/quickbooks/callback',
      useSandbox: process.env.NODE_ENV !== 'production'
    };
    this.encryptionKey = process.env.QB_ENCRYPTION_KEY || 'default-encryption-key-change-me';
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(text: string): string {
    try {
      const [ivHex, encrypted] = text.split(':');
      if (!ivHex || !encrypted) return text;
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return text;
    }
  }

  getAuthorizationUrl(orgId: string, state?: string): string {
    const scopes = 'com.intuit.quickbooks.accounting';
    const stateParam = state || crypto.randomBytes(16).toString('hex');
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: scopes,
      state: `${orgId}:${stateParam}`
    });

    return `${QB_OAUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string, realmId: string, state: string): Promise<{ orgId: string; integration: any }> {
    const [orgId] = state.split(':');
    
    if (!orgId) {
      throw new Error('Invalid state parameter');
    }

    const authHeader = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

    const response = await axios.post(
      QB_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri
      }),
      {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    const existingIntegration = await db.select()
      .from(quickbooksIntegrations)
      .where(eq(quickbooksIntegrations.orgId, orgId))
      .limit(1);

    let integration;
    if (existingIntegration.length > 0) {
      [integration] = await db.update(quickbooksIntegrations)
        .set({
          accessToken: this.encrypt(access_token),
          refreshToken: this.encrypt(refresh_token),
          realmId,
          tokenExpiresAt: expiresAt,
          isConnected: true,
          updatedAt: new Date()
        })
        .where(eq(quickbooksIntegrations.orgId, orgId))
        .returning();
    } else {
      [integration] = await db.insert(quickbooksIntegrations)
        .values({
          orgId,
          accessToken: this.encrypt(access_token),
          refreshToken: this.encrypt(refresh_token),
          realmId,
          tokenExpiresAt: expiresAt,
          isConnected: true
        })
        .returning();
    }

    return { orgId, integration };
  }

  async refreshTokens(orgId: string): Promise<QuickBooksTokens | null> {
    const [integration] = await db.select()
      .from(quickbooksIntegrations)
      .where(eq(quickbooksIntegrations.orgId, orgId))
      .limit(1);

    if (!integration || !integration.refreshToken) {
      return null;
    }

    const authHeader = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const decryptedRefreshToken = this.decrypt(integration.refreshToken);

    try {
      const response = await axios.post(
        QB_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: decryptedRefreshToken
        }),
        {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const expiresAt = new Date(Date.now() + expires_in * 1000);

      await db.update(quickbooksIntegrations)
        .set({
          accessToken: this.encrypt(access_token),
          refreshToken: this.encrypt(refresh_token),
          tokenExpiresAt: expiresAt,
          updatedAt: new Date()
        })
        .where(eq(quickbooksIntegrations.orgId, orgId));

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        realmId: integration.realmId || '',
        expiresAt
      };
    } catch (error: any) {
      console.error('Failed to refresh QuickBooks tokens:', error.response?.data || error.message);
      
      await db.update(quickbooksIntegrations)
        .set({
          isConnected: false,
          updatedAt: new Date()
        })
        .where(eq(quickbooksIntegrations.orgId, orgId));

      return null;
    }
  }

  async getValidAccessToken(orgId: string): Promise<string | null> {
    const [integration] = await db.select()
      .from(quickbooksIntegrations)
      .where(eq(quickbooksIntegrations.orgId, orgId))
      .limit(1);

    if (!integration || !integration.accessToken || !integration.isConnected) {
      return null;
    }

    const tokenExpiry = integration.tokenExpiresAt;
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (tokenExpiry && tokenExpiry < fiveMinutesFromNow) {
      const refreshed = await this.refreshTokens(orgId);
      if (!refreshed) return null;
      return refreshed.accessToken;
    }

    return this.decrypt(integration.accessToken);
  }

  async disconnect(orgId: string): Promise<void> {
    await db.update(quickbooksIntegrations)
      .set({
        accessToken: null,
        refreshToken: null,
        realmId: null,
        tokenExpiresAt: null,
        isConnected: false,
        updatedAt: new Date()
      })
      .where(eq(quickbooksIntegrations.orgId, orgId));
  }

  async getConnectionStatus(orgId: string): Promise<{ 
    isConnected: boolean; 
    lastSyncAt: Date | null;
    companyName?: string;
    realmId?: string;
  }> {
    const [integration] = await db.select()
      .from(quickbooksIntegrations)
      .where(eq(quickbooksIntegrations.orgId, orgId))
      .limit(1);

    if (!integration) {
      return { isConnected: false, lastSyncAt: null };
    }

    return {
      isConnected: integration.isConnected,
      lastSyncAt: integration.lastSyncAt,
      realmId: integration.realmId || undefined
    };
  }

  private getApiBaseUrl(): string {
    return this.config.useSandbox ? QB_SANDBOX_API : QB_PRODUCTION_API;
  }

  async getCompanyInfo(orgId: string): Promise<any> {
    const accessToken = await this.getValidAccessToken(orgId);
    if (!accessToken) throw new Error('Not connected to QuickBooks');

    const [integration] = await db.select()
      .from(quickbooksIntegrations)
      .where(eq(quickbooksIntegrations.orgId, orgId))
      .limit(1);

    if (!integration?.realmId) throw new Error('No realm ID found');

    const response = await axios.get(
      `${this.getApiBaseUrl()}/${integration.realmId}/companyinfo/${integration.realmId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    return response.data.CompanyInfo;
  }

  async getChartOfAccounts(orgId: string): Promise<any[]> {
    const accessToken = await this.getValidAccessToken(orgId);
    if (!accessToken) throw new Error('Not connected to QuickBooks');

    const [integration] = await db.select()
      .from(quickbooksIntegrations)
      .where(eq(quickbooksIntegrations.orgId, orgId))
      .limit(1);

    if (!integration?.realmId) throw new Error('No realm ID found');

    const query = "SELECT * FROM Account WHERE Active = true";
    const response = await axios.get(
      `${this.getApiBaseUrl()}/${integration.realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    return response.data.QueryResponse?.Account || [];
  }

  async getProfitAndLoss(orgId: string, startDate: string, endDate: string): Promise<ProfitAndLossReport> {
    const accessToken = await this.getValidAccessToken(orgId);
    if (!accessToken) throw new Error('Not connected to QuickBooks');

    const [integration] = await db.select()
      .from(quickbooksIntegrations)
      .where(eq(quickbooksIntegrations.orgId, orgId))
      .limit(1);

    if (!integration?.realmId) throw new Error('No realm ID found');

    const response = await axios.get(
      `${this.getApiBaseUrl()}/${integration.realmId}/reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );

    return this.parseProfitAndLossReport(response.data, startDate, endDate);
  }

  private parseProfitAndLossReport(reportData: any, startDate: string, endDate: string): ProfitAndLossReport {
    const rows: ProfitAndLossReport['rows'] = [];
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalCOGS = 0;

    const processRows = (section: any, type: 'Income' | 'Expense' | 'COGS' | 'Other', group?: string) => {
      if (!section?.Row) return;

      for (const row of section.Row) {
        if (row.type === 'Section') {
          const subGroup = row.Header?.ColData?.[0]?.value || group;
          processRows(row, type, subGroup);
        } else if (row.type === 'Data' || row.ColData) {
          const colData = row.ColData || [];
          const account = colData[0]?.value || 'Unknown';
          const amount = parseFloat(colData[1]?.value || '0');
          
          if (account && amount !== 0) {
            rows.push({
              account,
              accountId: colData[0]?.id || '',
              type,
              amount,
              group
            });

            if (type === 'Income') totalIncome += amount;
            else if (type === 'Expense') totalExpenses += amount;
            else if (type === 'COGS') totalCOGS += amount;
          }
        }
      }
    };

    const report = reportData?.Rows?.Row || [];
    for (const section of report) {
      const sectionName = section.Header?.ColData?.[0]?.value?.toLowerCase() || '';
      
      if (sectionName.includes('income') || sectionName.includes('revenue')) {
        processRows(section, 'Income');
      } else if (sectionName.includes('cost of goods') || sectionName.includes('cogs')) {
        processRows(section, 'COGS');
      } else if (sectionName.includes('expense')) {
        processRows(section, 'Expense');
      }
    }

    return {
      startDate,
      endDate,
      rows,
      totalIncome,
      totalExpenses,
      totalCOGS,
      netIncome: totalIncome - totalExpenses - totalCOGS
    };
  }

  async syncProfitAndLossToActuals(
    orgId: string, 
    modelingProjectId: string,
    startDate: string,
    endDate: string
  ): Promise<{ success: boolean; syncLog: any }> {
    const [integration] = await db.select()
      .from(quickbooksIntegrations)
      .where(eq(quickbooksIntegrations.orgId, orgId))
      .limit(1);

    if (!integration || !integration.isConnected) {
      throw new Error('QuickBooks not connected');
    }

    const [syncLog] = await db.insert(quickbooksSyncLogs)
      .values({
        orgId,
        integrationId: integration.id,
        modelingProjectId,
        syncType: 'manual',
        status: 'in_progress',
        periodStart: startDate,
        periodEnd: endDate,
        startedAt: new Date()
      })
      .returning();

    try {
      const plReport = await this.getProfitAndLoss(orgId, startDate, endDate);

      const startDateObj = new Date(startDate);
      const year = startDateObj.getFullYear();
      const month = startDateObj.getMonth() + 1;

      await db.delete(modelingActuals)
        .where(and(
          eq(modelingActuals.modelingProjectId, modelingProjectId),
          eq(modelingActuals.year, year),
          eq(modelingActuals.month, month),
          eq(modelingActuals.dataSource, 'quickbooks')
        ));

      let transactionsProcessed = 0;
      let transactionsImported = 0;

      for (const row of plReport.rows) {
        transactionsProcessed++;

        const categoryMapping = this.mapQuickBooksAccountToCategory(row.account, row.type);
        
        await db.insert(modelingActuals).values({
          orgId,
          modelingProjectId,
          year,
          month,
          category: categoryMapping.category,
          subcategory: categoryMapping.subcategory,
          description: row.account,
          amount: row.amount.toString(),
          dataSource: 'quickbooks',
          sourceReference: row.accountId,
          confidence: 95,
          isVerified: true,
          notes: `Synced from QuickBooks: ${row.group || row.type}`
        });

        transactionsImported++;
      }

      await db.update(quickbooksSyncLogs)
        .set({
          status: 'completed',
          transactionsProcessed,
          transactionsImported,
          completedAt: new Date()
        })
        .where(eq(quickbooksSyncLogs.id, syncLog.id));

      await db.update(quickbooksIntegrations)
        .set({
          lastSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(quickbooksIntegrations.orgId, orgId));

      const [updatedLog] = await db.select()
        .from(quickbooksSyncLogs)
        .where(eq(quickbooksSyncLogs.id, syncLog.id))
        .limit(1);

      return { success: true, syncLog: updatedLog };

    } catch (error: any) {
      await db.update(quickbooksSyncLogs)
        .set({
          status: 'failed',
          errorLog: [{ error: error.message, timestamp: new Date().toISOString() }],
          completedAt: new Date()
        })
        .where(eq(quickbooksSyncLogs.id, syncLog.id));

      const [failedLog] = await db.select()
        .from(quickbooksSyncLogs)
        .where(eq(quickbooksSyncLogs.id, syncLog.id))
        .limit(1);

      throw error;
    }
  }

  private mapQuickBooksAccountToCategory(accountName: string, type: string): { category: string; subcategory: string } {
    const lowerName = accountName.toLowerCase();

    if (type === 'Income') {
      if (lowerName.includes('fuel')) return { category: 'Revenue', subcategory: 'Fuel Sales' };
      if (lowerName.includes('slip') || lowerName.includes('dock')) return { category: 'Revenue', subcategory: 'Wet Slips' };
      if (lowerName.includes('dry') || lowerName.includes('storage')) return { category: 'Revenue', subcategory: 'Dry Storage' };
      if (lowerName.includes('store') || lowerName.includes('retail')) return { category: 'Revenue', subcategory: 'Ship Store' };
      if (lowerName.includes('service') || lowerName.includes('repair')) return { category: 'Revenue', subcategory: 'Service & Repair' };
      if (lowerName.includes('lease') || lowerName.includes('rent')) return { category: 'Revenue', subcategory: 'Third-Party Leases' };
      return { category: 'Revenue', subcategory: 'Other Revenue' };
    }

    if (type === 'COGS') {
      if (lowerName.includes('fuel')) return { category: 'COGS', subcategory: 'Fuel Cost' };
      if (lowerName.includes('store') || lowerName.includes('merchandise')) return { category: 'COGS', subcategory: 'Ship Store Cost' };
      return { category: 'COGS', subcategory: 'Other COGS' };
    }

    if (lowerName.includes('payroll') || lowerName.includes('wage') || lowerName.includes('salary')) 
      return { category: 'Expenses', subcategory: 'Payroll & Benefits' };
    if (lowerName.includes('utilit')) 
      return { category: 'Expenses', subcategory: 'Utilities' };
    if (lowerName.includes('insurance')) 
      return { category: 'Expenses', subcategory: 'Insurance' };
    if (lowerName.includes('repair') || lowerName.includes('maintenance')) 
      return { category: 'Expenses', subcategory: 'Repairs & Maintenance' };
    if (lowerName.includes('marketing') || lowerName.includes('advertising')) 
      return { category: 'Expenses', subcategory: 'Marketing' };
    if (lowerName.includes('professional') || lowerName.includes('legal') || lowerName.includes('accounting')) 
      return { category: 'Expenses', subcategory: 'Professional Fees' };
    if (lowerName.includes('tax') && lowerName.includes('property')) 
      return { category: 'Expenses', subcategory: 'Property Taxes' };
    if (lowerName.includes('management')) 
      return { category: 'Expenses', subcategory: 'Management Fees' };
    
    return { category: 'Expenses', subcategory: 'Other Expenses' };
  }

  async updateAccountMapping(orgId: string, mapping: ChartOfAccountsMapping): Promise<void> {
    await db.update(quickbooksIntegrations)
      .set({
        chartOfAccountsMapping: mapping,
        updatedAt: new Date()
      })
      .where(eq(quickbooksIntegrations.orgId, orgId));
  }

  async getSyncHistory(orgId: string, limit = 20): Promise<any[]> {
    return db.select()
      .from(quickbooksSyncLogs)
      .where(eq(quickbooksSyncLogs.orgId, orgId))
      .orderBy(desc(quickbooksSyncLogs.createdAt))
      .limit(limit);
  }
}

export const quickBooksService = new QuickBooksService();
