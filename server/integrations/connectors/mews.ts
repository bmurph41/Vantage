import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Mews Connector API (hotel PMS)
// Base: https://api.mews.com/api/connector/v1
// Auth: Client token + Access token in request body
// Entities: /reservations, /customers, /spaces, /accountingItems, /services
// Rate limit: 500 requests/minute (generous but bursty)

interface MewsReservation {
  Id: string;
  ServiceId: string;
  CustomerId: string;
  AssignedSpaceId?: string;
  Number: string;
  StartUtc: string;
  EndUtc: string;
  AdultCount: number;
  ChildCount: number;
  State: 'Confirmed' | 'Started' | 'Processed' | 'Canceled' | 'Optional';
  Origin: 'Connector' | 'ChannelManager' | 'Commander' | 'Import' | 'Email';
  RateId: string;
  TotalAmount: { Value: number; Currency: string };
  Notes?: string;
}

interface MewsCustomer {
  Id: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  NationalityCode?: string;
  LanguageCode?: string;
  LoyaltyCode?: string;
  Classifications: string[];
  Address?: {
    Line1: string;
    City: string;
    PostalCode: string;
    CountryCode: string;
  };
  CreatedUtc: string;
  UpdatedUtc: string;
}

interface MewsSpace {
  Id: string;
  Number: string;
  FloorNumber: string;
  ParentSpaceId?: string;
  CategoryId: string;
  State: 'Dirty' | 'Clean' | 'Inspected' | 'OutOfService' | 'OutOfOrder';
  IsActive: boolean;
  Type: 'Room' | 'Bed' | 'Dorm';
  BuildingNumber?: string;
}

interface MewsAccountingItem {
  Id: string;
  CustomerId: string;
  OrderId: string;
  ServiceId: string;
  Name: string;
  Type: 'ServiceRevenue' | 'ProductRevenue' | 'Payment' | 'CancellationFee' | 'Deposit';
  Amount: { Value: number; Currency: string };
  ConsumptionUtc: string;
  ClosedUtc?: string;
  State: 'Open' | 'Closed';
  AccountingCategory?: string;
}

interface MewsService {
  Id: string;
  Name: string;
  Type: 'Bookable' | 'Orderable';
  IsActive: boolean;
  StartTime: string;
  EndTime: string;
  Pricing: { Value: number; Currency: string };
}

export class MewsConnector extends BaseConnector {
  private baseUrl = 'https://api.mews.com/api/connector/v1';
  private clientToken: string;
  private accessToken: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.clientToken = this.getCredential('apiKey');
    this.accessToken = this.getCredential('accessToken');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ Enterprises: Array<{ Name: string; Id: string }> }>(
        '/enterprises/getAll', {}
      );
      const enterprise = response.Enterprises?.[0];
      return {
        connected: true,
        message: `Connected to Mews - ${enterprise?.Name || 'Unknown Property'}`,
        details: { enterpriseName: enterprise?.Name, enterpriseId: enterprise?.Id },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'reservations', targetEntity: 'reservations', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 50 },
      { sourceEntity: 'customers', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'spaces', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'accountingItems', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'services', targetEntity: 'services', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const sinceFilter = options?.since ? { UpdatedUtc: { StartUtc: options.since.toISOString() } } : {};

    // Mews uses POST for all reads with body-based pagination
    const endpointMap: Record<string, string> = {
      reservations: '/reservations/getAll',
      customers: '/customers/getAll',
      spaces: '/spaces/getAll',
      accountingItems: '/accountingItems/getAll',
      services: '/services/getAll',
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const body: Record<string, any> = {
      Limitation: { Count: limit, Cursor: options?.offset ? String(options.offset) : undefined },
      ...sinceFilter,
    };

    const response = await this.makeAuthenticatedRequest<{ [key: string]: any[]; Cursor?: string }>(
      endpoint, body
    );

    // Mews returns entity arrays by plural name (Reservations, Customers, etc.)
    const dataKey = Object.keys(response).find(k => Array.isArray(response[k])) || entityType;
    const records = response[dataKey] || [];
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: !!response.Cursor, total: undefined };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'reservations': {
        const r = record as MewsReservation;
        return {
          externalId: r.Id, confirmationNumber: r.Number, guestExternalId: r.CustomerId,
          roomExternalId: r.AssignedSpaceId, startDate: r.StartUtc, endDate: r.EndUtc,
          adults: r.AdultCount, children: r.ChildCount, status: r.State,
          origin: r.Origin, rateId: r.RateId,
          totalAmount: r.TotalAmount?.Value, currency: r.TotalAmount?.Currency,
          notes: r.Notes, integrationSource: 'mews',
        };
      }
      case 'customers': {
        const c = record as MewsCustomer;
        return {
          externalId: c.Id, firstName: c.FirstName, lastName: c.LastName,
          email: c.Email, phone: c.Phone, nationality: c.NationalityCode,
          language: c.LanguageCode, loyaltyCode: c.LoyaltyCode,
          classifications: c.Classifications, address: c.Address,
          integrationSource: 'mews',
        };
      }
      case 'spaces': {
        const s = record as MewsSpace;
        return {
          externalId: s.Id, roomNumber: s.Number, floor: s.FloorNumber,
          categoryId: s.CategoryId, status: s.State, isActive: s.IsActive,
          type: s.Type, building: s.BuildingNumber, integrationSource: 'mews',
        };
      }
      case 'accountingItems': {
        const a = record as MewsAccountingItem;
        return {
          externalId: a.Id, guestExternalId: a.CustomerId, orderId: a.OrderId,
          name: a.Name, type: a.Type, amount: a.Amount?.Value,
          currency: a.Amount?.Currency, consumptionDate: a.ConsumptionUtc,
          status: a.State, category: a.AccountingCategory,
          integrationSource: 'mews',
        };
      }
      case 'services': {
        const s = record as MewsService;
        return {
          externalId: s.Id, name: s.Name, type: s.Type, isActive: s.IsActive,
          startTime: s.StartTime, endTime: s.EndTime,
          price: s.Pricing?.Value, currency: s.Pricing?.Currency,
          integrationSource: 'mews',
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
    if (entityType === 'reservations') {
      const endpoint = data.externalId ? '/reservations/update' : '/reservations/add';
      const response = await this.makeAuthenticatedRequest<{ Reservations: Array<{ Id: string }> }>(
        endpoint, data
      );
      const id = response.Reservations?.[0]?.Id || data.externalId;
      return { created: !data.externalId, updated: !!data.externalId, id };
    }
    return { created: false, updated: false };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    body: Record<string, any>
  ): Promise<T> {
    return this.makeRequest<T>(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ClientToken: this.clientToken,
        AccessToken: this.accessToken,
        ...body,
      }),
    });
  }
}
