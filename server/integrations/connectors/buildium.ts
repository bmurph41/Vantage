import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Buildium API (residential property management)
// Base: https://api.buildium.com/v1
// Auth: API key + secret in Basic auth
// Entities: /rentals/units, /leases, /tenants, /accounting, /workorders, /owners
// Rate limit: 100 requests/minute

interface BuildiumUnit {
  Id: number;
  PropertyId: number;
  UnitNumber: string;
  Address: { AddressLine1: string; City: string; State: string; PostalCode: string };
  UnitBedrooms: string;
  UnitBathrooms: string;
  UnitSize: number;
  MarketRent: number;
  Description?: string;
  IsOccupied: boolean;
}

interface BuildiumLease {
  Id: number;
  UnitId: number;
  TenantIds: number[];
  LeaseFromDate: string;
  LeaseToDate: string;
  LeaseType: 'Fixed' | 'AtWill' | 'MonthToMonth';
  MonthlyRent: number;
  SecurityDeposit: number;
  RentDueDay: number;
  LateFeeAmount?: number;
  Status: 'Active' | 'Past' | 'Future';
  Cosigners?: Array<{ Name: string; Phone: string; Email: string }>;
  AutoCharges: Array<{ GLAccountId: number; Amount: number; Memo: string }>;
}

interface BuildiumTenant {
  Id: number;
  FirstName: string;
  LastName: string;
  Email: string;
  PhoneNumbers: Array<{ Type: string; Number: string }>;
  DateOfBirth?: string;
  EmergencyContact?: { FirstName: string; LastName: string; Phone: string };
  MailingAddress?: { AddressLine1: string; City: string; State: string; PostalCode: string };
  Balance: number;
  CreatedDateTime: string;
}

interface BuildiumTransaction {
  Id: number;
  Date: string;
  EntryDate: string;
  GLAccountId: number;
  Amount: number;
  Memo: string;
  ReferenceNumber?: string;
  TransactionType: 'Charge' | 'Payment' | 'Credit' | 'Refund' | 'Adjustment' | 'WriteOff';
  PaymentMethod?: 'Cash' | 'Check' | 'CreditCard' | 'ACH' | 'MoneyOrder' | 'Other';
  Status: 'Posted' | 'Pending' | 'Void';
  UnitId?: number;
  TenantId?: number;
}

interface BuildiumWorkOrder {
  Id: number;
  UnitId: number;
  TenantId?: number;
  Title: string;
  Description: string;
  CategoryId: number;
  Priority: 'Low' | 'Normal' | 'High' | 'Emergency';
  Status: 'New' | 'InProgress' | 'Completed' | 'Closed' | 'Deferred';
  AssignedToUserId?: number;
  VendorId?: number;
  EntryAllowed: boolean;
  CreatedDateTime: string;
  CompletedDateTime?: string;
  DueDate?: string;
  TaskCost?: number;
}

interface BuildiumOwner {
  Id: number;
  FirstName: string;
  LastName: string;
  CompanyName?: string;
  Email: string;
  PhoneNumbers: Array<{ Type: string; Number: string }>;
  IsCompany: boolean;
  ManagementAgreementEndDate?: string;
  Comment?: string;
}

export class BuildiumConnector extends BaseConnector {
  private baseUrl = 'https://api.buildium.com/v1';

  constructor(config: ConnectorConfig) {
    super(config);
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<any[]>('/rentals?limit=1');
      return {
        connected: true,
        message: 'Connected to Buildium successfully',
        details: { connectionVerified: true },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'units', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'leases', targetEntity: 'leases', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'tenants', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'transactions', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'workOrders', targetEntity: 'workOrders', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 50 },
      { sourceEntity: 'owners', targetEntity: 'owners', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const sinceParam = options?.since ? `&lastupdatedfrom=${options.since.toISOString().split('T')[0]}` : '';

    const endpointMap: Record<string, string> = {
      units: '/rentals/units',
      leases: '/leases',
      tenants: '/tenants',
      transactions: '/generalledger/transactions',
      workOrders: '/workorders',
      owners: '/associations/owners',
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<any[]>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = Array.isArray(response) ? response : [];
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: records.length === limit };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'units': {
        const u = record as BuildiumUnit;
        return {
          externalId: String(u.Id), propertyExternalId: String(u.PropertyId),
          unitNumber: u.UnitNumber, address: u.Address?.AddressLine1,
          city: u.Address?.City, state: u.Address?.State, zip: u.Address?.PostalCode,
          bedrooms: u.UnitBedrooms, bathrooms: u.UnitBathrooms, squareFeet: u.UnitSize,
          marketRent: u.MarketRent, description: u.Description, isOccupied: u.IsOccupied,
          integrationSource: 'buildium',
        };
      }
      case 'leases': {
        const l = record as BuildiumLease;
        return {
          externalId: String(l.Id), unitExternalId: String(l.UnitId),
          tenantExternalIds: l.TenantIds.map(String), startDate: l.LeaseFromDate,
          endDate: l.LeaseToDate, leaseType: l.LeaseType, monthlyRent: l.MonthlyRent,
          securityDeposit: l.SecurityDeposit, rentDueDay: l.RentDueDay,
          lateFeeAmount: l.LateFeeAmount, status: l.Status,
          cosigners: l.Cosigners, autoCharges: l.AutoCharges,
          integrationSource: 'buildium',
        };
      }
      case 'tenants': {
        const t = record as BuildiumTenant;
        return {
          externalId: String(t.Id), firstName: t.FirstName, lastName: t.LastName,
          email: t.Email, phone: t.PhoneNumbers?.[0]?.Number,
          dateOfBirth: t.DateOfBirth, emergencyContact: t.EmergencyContact,
          mailingAddress: t.MailingAddress, balance: t.Balance,
          integrationSource: 'buildium',
        };
      }
      case 'transactions': {
        const tx = record as BuildiumTransaction;
        return {
          externalId: String(tx.Id), date: tx.Date, amount: tx.Amount,
          memo: tx.Memo, referenceNumber: tx.ReferenceNumber,
          transactionType: tx.TransactionType, paymentMethod: tx.PaymentMethod,
          status: tx.Status, unitExternalId: tx.UnitId ? String(tx.UnitId) : undefined,
          tenantExternalId: tx.TenantId ? String(tx.TenantId) : undefined,
          integrationSource: 'buildium',
        };
      }
      case 'workOrders': {
        const w = record as BuildiumWorkOrder;
        return {
          externalId: String(w.Id), unitExternalId: String(w.UnitId),
          tenantExternalId: w.TenantId ? String(w.TenantId) : undefined,
          title: w.Title, description: w.Description, priority: w.Priority,
          status: w.Status, vendorId: w.VendorId ? String(w.VendorId) : undefined,
          entryAllowed: w.EntryAllowed, createdDate: w.CreatedDateTime,
          completedDate: w.CompletedDateTime, dueDate: w.DueDate,
          taskCost: w.TaskCost, integrationSource: 'buildium',
        };
      }
      case 'owners': {
        const o = record as BuildiumOwner;
        return {
          externalId: String(o.Id), firstName: o.FirstName, lastName: o.LastName,
          companyName: o.CompanyName, email: o.Email,
          phone: o.PhoneNumbers?.[0]?.Number, isCompany: o.IsCompany,
          managementAgreementEndDate: o.ManagementAgreementEndDate,
          comment: o.Comment, integrationSource: 'buildium',
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
    if (entityType === 'workOrders') {
      const endpoint = data.externalId ? `/workorders/${data.externalId}` : '/workorders';
      const method = data.externalId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest<{ Id: number }>(
        endpoint, { method, body: data }
      );
      return { created: !data.externalId, updated: !!data.externalId, id: String(response.Id) };
    }
    return { created: false, updated: false };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options?: { method?: string; body?: any }
  ): Promise<T> {
    const apiKey = this.getCredential('apiKey');
    const apiSecret = this.getCredential('apiSecret');
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    return this.makeRequest<T>(`${this.baseUrl}${endpoint}`, {
      method: options?.method || 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
