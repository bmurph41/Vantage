import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Entrata API endpoints
// Base: https://{subdomain}.entrata.com/api/v1
// Auth: Basic auth (username:password) with X-Entrata-Property header
// Entities: /properties, /units, /leases, /residents, /invoices, /maintenance
// Rate limit: 180 requests/minute

interface EntrataUnit {
  UnitID: string;
  PropertyID: string;
  UnitNumber: string;
  UnitSpaceType: string;
  FloorPlanName: string;
  Bedrooms: number;
  Bathrooms: number;
  SquareFootage: number;
  MarketRent: number;
  UnitStatus: 'occupied' | 'vacant' | 'down' | 'model' | 'notice';
  AvailableDate?: string;
}

interface EntrataLease {
  LeaseID: string;
  UnitID: string;
  ResidentID: string;
  LeaseFromDate: string;
  LeaseToDate: string;
  TotalRent: number;
  SecurityDeposit: number;
  LeaseStatus: 'current' | 'past' | 'future' | 'applicant' | 'cancelled';
  LeaseType: 'standard' | 'corporate' | 'student' | 'affordable';
}

interface EntrataResident {
  ResidentID: string;
  FirstName: string;
  LastName: string;
  Email: string;
  CellPhone: string;
  HomePhone?: string;
  MoveInDate: string;
  MoveOutDate?: string;
  Balance: number;
  ResidentStatus: 'current' | 'past' | 'applicant' | 'approved' | 'denied';
}

interface EntrataInvoice {
  InvoiceID: string;
  VendorID: string;
  PropertyID: string;
  Amount: number;
  InvoiceDate: string;
  DueDate: string;
  Description: string;
  Status: 'pending' | 'approved' | 'paid' | 'void';
  GLAccountCode: string;
}

interface EntrataMaintenanceRequest {
  RequestID: string;
  UnitID: string;
  ResidentID?: string;
  Category: string;
  SubCategory: string;
  Priority: 'low' | 'medium' | 'high' | 'emergency';
  Description: string;
  Status: 'open' | 'scheduled' | 'in_progress' | 'complete' | 'cancelled';
  RequestDate: string;
  CompletedDate?: string;
  TechnicianID?: string;
  Parts?: Array<{ name: string; cost: number }>;
}

export class EntrataConnector extends BaseConnector {
  private baseUrl: string;
  private propertyId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    const subdomain = this.getSetting('subdomain', '');
    this.baseUrl = `https://${subdomain}.entrata.com/api/v1`;
    this.propertyId = this.getCredential('siteId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ response: { result: { properties: { property: Array<{ name: string }> } } } }>(
        '/properties', { method: 'POST', body: { method: { name: 'getProperties', params: {} } } }
      );
      const propertyName = response.response?.result?.properties?.property?.[0]?.name;
      return {
        connected: true,
        message: `Connected to Entrata - ${propertyName || 'Unknown'}`,
        details: { propertyName },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'units', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'leases', targetEntity: 'leases', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'residents', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'invoices', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'maintenance', targetEntity: 'workOrders', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 50 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const methodMap: Record<string, string> = {
      units: 'getUnits',
      leases: 'getLeases',
      residents: 'getResidents',
      invoices: 'getInvoices',
      maintenance: 'getMaintenanceRequests',
    };

    const methodName = methodMap[entityType];
    if (!methodName) throw new Error(`Unsupported entity type: ${entityType}`);

    const params: Record<string, any> = {
      propertyId: this.propertyId,
      pageSize: limit,
      pageIndex: Math.floor(offset / limit),
    };
    if (options?.since) params.modifiedSince = options.since.toISOString();

    const response = await this.makeAuthenticatedRequest<{
      response: { result: { records: any[]; totalCount: number } }
    }>(`/${entityType}`, {
      method: 'POST',
      body: { method: { name: methodName, params } },
    });

    const records = response.response?.result?.records || [];
    const total = response.response?.result?.totalCount || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: offset + records.length < total, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'units': {
        const u = record as EntrataUnit;
        return {
          externalId: u.UnitID, unitNumber: u.UnitNumber, unitType: u.UnitSpaceType,
          floorPlan: u.FloorPlanName, bedrooms: u.Bedrooms, bathrooms: u.Bathrooms,
          squareFeet: u.SquareFootage, marketRent: u.MarketRent, status: u.UnitStatus,
          availableDate: u.AvailableDate, integrationSource: 'entrata',
        };
      }
      case 'leases': {
        const l = record as EntrataLease;
        return {
          externalId: l.LeaseID, unitExternalId: l.UnitID, tenantExternalId: l.ResidentID,
          startDate: l.LeaseFromDate, endDate: l.LeaseToDate, monthlyRent: l.TotalRent,
          securityDeposit: l.SecurityDeposit, status: l.LeaseStatus, leaseType: l.LeaseType,
          integrationSource: 'entrata',
        };
      }
      case 'residents': {
        const r = record as EntrataResident;
        return {
          externalId: r.ResidentID, firstName: r.FirstName, lastName: r.LastName,
          email: r.Email, phone: r.CellPhone || r.HomePhone, moveInDate: r.MoveInDate,
          moveOutDate: r.MoveOutDate, balance: r.Balance, status: r.ResidentStatus,
          integrationSource: 'entrata',
        };
      }
      case 'invoices': {
        const i = record as EntrataInvoice;
        return {
          externalId: i.InvoiceID, vendorExternalId: i.VendorID, amount: i.Amount,
          invoiceDate: i.InvoiceDate, dueDate: i.DueDate, description: i.Description,
          status: i.Status, glAccountCode: i.GLAccountCode, integrationSource: 'entrata',
        };
      }
      case 'maintenance': {
        const m = record as EntrataMaintenanceRequest;
        return {
          externalId: m.RequestID, unitExternalId: m.UnitID, tenantExternalId: m.ResidentID,
          category: m.Category, subCategory: m.SubCategory, priority: m.Priority,
          description: m.Description, status: m.Status, requestDate: m.RequestDate,
          completedDate: m.CompletedDate, technicianId: m.TechnicianID,
          parts: m.Parts, integrationSource: 'entrata',
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
    if (entityType === 'workOrders' || entityType === 'maintenance') {
      const methodName = data.externalId ? 'updateMaintenanceRequest' : 'createMaintenanceRequest';
      const response = await this.makeAuthenticatedRequest<{ response: { result: { requestId: string } } }>(
        '/maintenance', {
          method: 'POST',
          body: { method: { name: methodName, params: { propertyId: this.propertyId, ...data } } },
        }
      );
      return {
        created: !data.externalId,
        updated: !!data.externalId,
        id: response.response?.result?.requestId || data.externalId,
      };
    }
    return { created: false, updated: false };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options?: { method?: string; body?: any }
  ): Promise<T> {
    const username = this.getCredential('apiKey');
    const password = this.getCredential('apiSecret');
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    return this.makeRequest<T>(`${this.baseUrl}${endpoint}`, {
      method: options?.method || 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
        'X-Entrata-Property': this.propertyId,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
