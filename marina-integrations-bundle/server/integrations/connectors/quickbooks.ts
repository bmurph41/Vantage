import { BaseConnector, ConnectorConfig, EntitySyncConfig, SyncResult } from './base';
import { db } from '../../db';

const QBO_BASE_URL = 'https://quickbooks.api.intuit.com/v3';
const QBO_SANDBOX_URL = 'https://sandbox-quickbooks.api.intuit.com/v3';

interface QBOProfitAndLoss {
  Header: {
    Time: string;
    ReportName: string;
    DateMacro: string;
    StartPeriod: string;
    EndPeriod: string;
    Currency: string;
  };
  Columns: { Column: Array<{ ColTitle: string; ColType: string }> };
  Rows: { Row: QBORow[] };
}

interface QBORow {
  type?: string;
  group?: string;
  Header?: { ColData: Array<{ value: string }> };
  Rows?: { Row: QBORow[] };
  Summary?: { ColData: Array<{ value: string }> };
  ColData?: Array<{ value: string; id?: string }>;
}

interface QBOAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  CurrentBalance: number;
  Active: boolean;
}

interface QBOCustomer {
  Id: string;
  DisplayName: string;
  PrimaryPhone?: { FreeFormNumber: string };
  PrimaryEmailAddr?: { Address: string };
  BillAddr?: {
    Line1?: string;
    City?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  Balance: number;
  Active: boolean;
}

export class QuickBooksConnector extends BaseConnector {
  private baseUrl: string;
  private companyId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    const useSandbox = this.getSetting('useSandbox', false);
    this.baseUrl = useSandbox ? QBO_SANDBOX_URL : QBO_BASE_URL;
    this.companyId = this.getCredential('companyId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const accessToken = this.getCredential('accessToken');
      const response = await this.makeAuthenticatedRequest<{ CompanyInfo: any }>(
        `/company/${this.companyId}/companyinfo/${this.companyId}`
      );

      return {
        connected: true,
        message: `Connected to ${response.CompanyInfo?.CompanyName || 'QuickBooks'}`,
        details: {
          companyName: response.CompanyInfo?.CompanyName,
          country: response.CompanyInfo?.Country,
        },
      };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      {
        sourceEntity: 'profit_and_loss',
        targetEntity: 'financialStatements',
        targetModule: 'modeling',
        syncDirection: 'read',
        batchSize: 1,
      },
      {
        sourceEntity: 'accounts',
        targetEntity: 'chartOfAccounts',
        targetModule: 'modeling',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'customers',
        targetEntity: 'contacts',
        targetModule: 'crm',
        syncDirection: 'read',
        batchSize: 100,
      },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    switch (entityType) {
      case 'profit_and_loss':
        return this.fetchProfitAndLoss(options);
      case 'accounts':
        return this.fetchAccounts(options);
      case 'customers':
        return this.fetchCustomers(options);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async fetchProfitAndLoss(options?: { since?: Date }): Promise<{ data: any[]; hasMore: boolean }> {
    const startDate = options?.since
      ? options.since.toISOString().split('T')[0]
      : new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const report = await this.makeAuthenticatedRequest<QBOProfitAndLoss>(
      `/company/${this.companyId}/reports/ProfitAndLoss`,
      {
        start_date: startDate,
        end_date: endDate,
        summarize_column_by: 'Month',
      }
    );

    const parsed = this.parseProfitAndLoss(report);
    return { data: [parsed], hasMore: false };
  }

  private parseProfitAndLoss(report: QBOProfitAndLoss): any {
    const lineItems: any[] = [];

    const processRow = (row: QBORow, category: string, depth: number = 0) => {
      if (row.ColData) {
        const accountName = row.ColData[0]?.value || '';
        const values = row.ColData.slice(1).map(col => parseFloat(col.value) || 0);
        
        if (accountName && values.some(v => v !== 0)) {
          lineItems.push({
            category,
            accountName,
            values,
            depth,
            accountId: row.ColData[0]?.id,
          });
        }
      }

      if (row.Rows?.Row) {
        const subCategory = row.Header?.ColData?.[0]?.value || category;
        row.Rows.Row.forEach(subRow => processRow(subRow, subCategory, depth + 1));
      }

      if (row.Summary?.ColData) {
        const summaryName = row.Summary.ColData[0]?.value || '';
        const summaryValues = row.Summary.ColData.slice(1).map(col => parseFloat(col.value) || 0);
        
        if (summaryName.startsWith('Total') && summaryValues.some(v => v !== 0)) {
          lineItems.push({
            category,
            accountName: summaryName,
            values: summaryValues,
            depth,
            isTotal: true,
          });
        }
      }
    };

    report.Rows?.Row?.forEach(row => {
      const category = row.Header?.ColData?.[0]?.value || row.group || 'Other';
      processRow(row, category);
    });

    return {
      reportType: 'profit_and_loss',
      startDate: report.Header?.StartPeriod,
      endDate: report.Header?.EndPeriod,
      currency: report.Header?.Currency || 'USD',
      columns: report.Columns?.Column?.map(c => c.ColTitle) || [],
      lineItems,
      metadata: {
        generatedAt: report.Header?.Time,
        source: 'quickbooks',
      },
    };
  }

  private async fetchAccounts(options?: { limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const query = `SELECT * FROM Account WHERE Active = true STARTPOSITION ${offset + 1} MAXRESULTS ${limit}`;
    const response = await this.makeAuthenticatedRequest<{ QueryResponse: { Account: QBOAccount[]; totalCount: number } }>(
      `/company/${this.companyId}/query`,
      { query }
    );

    const accounts = response.QueryResponse?.Account || [];
    const total = response.QueryResponse?.totalCount || accounts.length;

    const transformed = accounts.map(acc => ({
      externalId: acc.Id,
      name: acc.Name,
      accountType: acc.AccountType,
      accountSubType: acc.AccountSubType,
      balance: acc.CurrentBalance,
      isActive: acc.Active,
      integrationSource: 'quickbooks',
    }));

    return {
      data: transformed,
      hasMore: offset + accounts.length < total,
      total,
    };
  }

  private async fetchCustomers(options?: { limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const query = `SELECT * FROM Customer WHERE Active = true STARTPOSITION ${offset + 1} MAXRESULTS ${limit}`;
    const response = await this.makeAuthenticatedRequest<{ QueryResponse: { Customer: QBOCustomer[]; totalCount: number } }>(
      `/company/${this.companyId}/query`,
      { query }
    );

    const customers = response.QueryResponse?.Customer || [];
    const total = response.QueryResponse?.totalCount || customers.length;

    const transformed = customers.map(cust => ({
      externalId: cust.Id,
      displayName: cust.DisplayName,
      phone: cust.PrimaryPhone?.FreeFormNumber,
      email: cust.PrimaryEmailAddr?.Address,
      address: cust.BillAddr ? {
        line1: cust.BillAddr.Line1,
        city: cust.BillAddr.City,
        state: cust.BillAddr.CountrySubDivisionCode,
        postalCode: cust.BillAddr.PostalCode,
      } : null,
      balance: cust.Balance,
      isActive: cust.Active,
      integrationSource: 'quickbooks',
    }));

    return {
      data: transformed,
      hasMore: offset + customers.length < total,
      total,
    };
  }

  protected async saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }> {
    switch (entityType) {
      case 'financialStatements':
        return this.saveProfitAndLoss(data);
      case 'chartOfAccounts':
        return this.saveAccount(data);
      case 'contacts':
        return this.saveContact(data);
      default:
        throw new Error(`Cannot save entity type: ${entityType}`);
    }
  }

  private async saveProfitAndLoss(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `pl_${Date.now()}` };
  }

  private async saveAccount(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `acc_${data.externalId}` };
  }

  private async saveContact(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `contact_${data.externalId}` };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const accessToken = this.getCredential('accessToken');
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new Error('QuickBooks access token expired. Please reconnect.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }
}
