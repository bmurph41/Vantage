import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Xero API (accounting)
// Base: https://api.xero.com/api.xro/2.0
// Auth: OAuth 2.0 with tenant ID header
// Entities: /Accounts, /Invoices, /Contacts, /BankTransactions, /Reports/ProfitAndLoss
// Rate limit: 60 requests/minute (per tenant)

interface XeroAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type: 'BANK' | 'CURRENT' | 'CURRLIAB' | 'DEPRECIATN' | 'DIRECTCOSTS' | 'EQUITY' | 'EXPENSE' | 'FIXED' | 'LIABILITY' | 'NONCURRENT' | 'OTHERINCOME' | 'OVERHEADS' | 'PREPAYMENT' | 'REVENUE' | 'SALES' | 'TERMLIAB' | 'PAYGLIABILITY' | 'SUPERANNUATIONEXPENSE' | 'SUPERANNUATIONLIABILITY' | 'WAGESEXPENSE';
  Status: 'ACTIVE' | 'ARCHIVED';
  TaxType: string;
  Class: 'ASSET' | 'EQUITY' | 'EXPENSE' | 'LIABILITY' | 'REVENUE';
  EnablePaymentsToAccount: boolean;
  BankAccountNumber?: string;
  CurrencyCode: string;
  Description?: string;
  UpdatedDateUTC: string;
}

interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  ContactID: string;
  ContactName: string;
  Type: 'ACCPAY' | 'ACCREC';
  Status: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED' | 'DELETED';
  Date: string;
  DueDate: string;
  SubTotal: number;
  TotalTax: number;
  Total: number;
  AmountDue: number;
  AmountPaid: number;
  CurrencyCode: string;
  LineItems: Array<{
    LineItemID: string;
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    TaxType: string;
    LineAmount: number;
  }>;
  Reference?: string;
  UpdatedDateUTC: string;
}

interface XeroContact {
  ContactID: string;
  ContactNumber?: string;
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  Phones: Array<{ PhoneType: string; PhoneNumber: string; PhoneAreaCode?: string; PhoneCountryCode?: string }>;
  Addresses: Array<{
    AddressType: 'POBOX' | 'STREET' | 'DELIVERY';
    AddressLine1?: string;
    City?: string;
    Region?: string;
    PostalCode?: string;
    Country?: string;
  }>;
  IsCustomer: boolean;
  IsSupplier: boolean;
  TaxNumber?: string;
  AccountsReceivableTaxType?: string;
  AccountsPayableTaxType?: string;
  DefaultCurrency?: string;
  ContactStatus: 'ACTIVE' | 'ARCHIVED';
  Balances?: {
    AccountsReceivable: { Outstanding: number; Overdue: number };
    AccountsPayable: { Outstanding: number; Overdue: number };
  };
  UpdatedDateUTC: string;
}

interface XeroBankTransaction {
  BankTransactionID: string;
  ContactID?: string;
  ContactName?: string;
  BankAccountID: string;
  Type: 'RECEIVE' | 'SPEND' | 'RECEIVE-OVERPAYMENT' | 'RECEIVE-PREPAYMENT' | 'SPEND-OVERPAYMENT' | 'SPEND-PREPAYMENT';
  Status: 'AUTHORISED' | 'DELETED';
  Date: string;
  SubTotal: number;
  TotalTax: number;
  Total: number;
  CurrencyCode: string;
  LineItems: Array<{
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    LineAmount: number;
  }>;
  Reference?: string;
  IsReconciled: boolean;
  UpdatedDateUTC: string;
}

interface XeroProfitAndLoss {
  ReportName: string;
  ReportDate: string;
  Rows: Array<{
    RowType: 'Header' | 'Section' | 'Row' | 'SummaryRow';
    Title?: string;
    Cells: Array<{ Value: string; Attributes?: Array<{ Value: string; Id: string }> }>;
    Rows?: Array<any>;
  }>;
}

export class XeroConnector extends BaseConnector {
  private baseUrl = 'https://api.xero.com/api.xro/2.0';
  private tenantId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.tenantId = this.getCredential('companyId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ Organisations: Array<{ Name: string; OrganisationID: string; CountryCode: string }> }>(
        '/Organisation'
      );
      const org = response.Organisations?.[0];
      return {
        connected: true,
        message: `Connected to Xero - ${org?.Name || 'Unknown Organization'}`,
        details: { organizationName: org?.Name, countryCode: org?.CountryCode },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'accounts', targetEntity: 'chartOfAccounts', targetModule: 'accounting', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'invoices', targetEntity: 'invoices', targetModule: 'accounting', syncDirection: 'bidirectional', batchSize: 50 },
      { sourceEntity: 'contacts', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'bidirectional', batchSize: 100 },
      { sourceEntity: 'bankTransactions', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'profitAndLoss', targetEntity: 'financialStatements', targetModule: 'modeling', syncDirection: 'read', batchSize: 1 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    if (entityType === 'profitAndLoss') {
      return this.fetchProfitAndLoss(options);
    }

    const endpointMap: Record<string, string> = {
      accounts: '/Accounts',
      invoices: '/Invoices',
      contacts: '/Contacts',
      bankTransactions: '/BankTransactions',
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    let queryParams = `?page=${Math.floor(offset / limit) + 1}`;
    if (options?.since) queryParams += `&where=UpdatedDateUTC>=DateTime(${options.since.getFullYear()},${options.since.getMonth() + 1},${options.since.getDate()})`;

    const response = await this.makeAuthenticatedRequest<any>(`${endpoint}${queryParams}`);

    // Xero returns entities in PascalCase plural keys
    const dataKey = Object.keys(response).find(k => Array.isArray(response[k]));
    const records = dataKey ? response[dataKey] : [];
    const transformed = records.map((record: any) => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: records.length === 100 }; // Xero pages at 100
  }

  private async fetchProfitAndLoss(options?: { since?: Date }): Promise<{ data: any[]; hasMore: boolean }> {
    const fromDate = options?.since
      ? options.since.toISOString().split('T')[0]
      : `${new Date().getFullYear()}-01-01`;
    const toDate = new Date().toISOString().split('T')[0];

    const response = await this.makeAuthenticatedRequest<{ Reports: XeroProfitAndLoss[] }>(
      `/Reports/ProfitAndLoss?fromDate=${fromDate}&toDate=${toDate}`
    );

    const report = response.Reports?.[0];
    if (!report) return { data: [], hasMore: false };

    return {
      data: [{
        reportType: 'profit_and_loss',
        reportName: report.ReportName,
        reportDate: report.ReportDate,
        rows: report.Rows,
        source: 'xero',
        integrationSource: 'xero',
      }],
      hasMore: false,
    };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'accounts': {
        const a = record as XeroAccount;
        return {
          externalId: a.AccountID, code: a.Code, name: a.Name,
          accountType: a.Type, status: a.Status, taxType: a.TaxType,
          accountClass: a.Class, enablePayments: a.EnablePaymentsToAccount,
          bankAccountNumber: a.BankAccountNumber, currency: a.CurrencyCode,
          description: a.Description, integrationSource: 'xero',
        };
      }
      case 'invoices': {
        const inv = record as XeroInvoice;
        return {
          externalId: inv.InvoiceID, invoiceNumber: inv.InvoiceNumber,
          contactExternalId: inv.ContactID, contactName: inv.ContactName,
          invoiceType: inv.Type, status: inv.Status, date: inv.Date,
          dueDate: inv.DueDate, subtotal: inv.SubTotal, totalTax: inv.TotalTax,
          total: inv.Total, amountDue: inv.AmountDue, amountPaid: inv.AmountPaid,
          currency: inv.CurrencyCode, lineItems: inv.LineItems,
          reference: inv.Reference, integrationSource: 'xero',
        };
      }
      case 'contacts': {
        const c = record as XeroContact;
        return {
          externalId: c.ContactID, contactNumber: c.ContactNumber,
          name: c.Name, firstName: c.FirstName, lastName: c.LastName,
          email: c.EmailAddress,
          phone: c.Phones?.find(p => p.PhoneNumber)?.PhoneNumber,
          addresses: c.Addresses, isCustomer: c.IsCustomer,
          isSupplier: c.IsSupplier, taxNumber: c.TaxNumber,
          status: c.ContactStatus, currency: c.DefaultCurrency,
          balances: c.Balances, integrationSource: 'xero',
        };
      }
      case 'bankTransactions': {
        const bt = record as XeroBankTransaction;
        return {
          externalId: bt.BankTransactionID, contactExternalId: bt.ContactID,
          contactName: bt.ContactName, bankAccountExternalId: bt.BankAccountID,
          type: bt.Type, status: bt.Status, date: bt.Date,
          subtotal: bt.SubTotal, totalTax: bt.TotalTax, total: bt.Total,
          currency: bt.CurrencyCode, lineItems: bt.LineItems,
          reference: bt.Reference, isReconciled: bt.IsReconciled,
          integrationSource: 'xero',
        };
      }
      default:
        return record;
    }
  }

  protected async saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }> {
    if (entityType === 'invoices') {
      const endpoint = '/Invoices';
      const response = await this.makeAuthenticatedRequest<{ Invoices: Array<{ InvoiceID: string }> }>(
        endpoint, { method: data.externalId ? 'POST' : 'PUT', body: { Invoices: [data] } }
      );
      const id = response.Invoices?.[0]?.InvoiceID;
      return { created: !data.externalId, updated: !!data.externalId, id };
    }
    if (entityType === 'contacts') {
      const response = await this.makeAuthenticatedRequest<{ Contacts: Array<{ ContactID: string }> }>(
        '/Contacts', { method: 'POST', body: { Contacts: [data] } }
      );
      const id = response.Contacts?.[0]?.ContactID;
      return { created: !data.externalId, updated: !!data.externalId, id };
    }
    return { created: false, updated: false };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options?: { method?: string; body?: any }
  ): Promise<T> {
    const accessToken = this.getCredential('accessToken');
    return this.makeRequest<T>(`${this.baseUrl}${endpoint}`, {
      method: options?.method || 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'xero-tenant-id': this.tenantId,
        'Accept': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
