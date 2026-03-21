import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// ResMan API endpoints
// Base: https://api.myresman.com/v2
// Auth: OAuth 2.0 with API key + secret
// Entities: /units, /leases, /residents, /ledger, /prospects, /maintenance
// Rate limit: 90 requests/minute

interface ResManUnit {
  UnitId: string;
  PropertyId: string;
  UnitNumber: string;
  FloorPlanId: string;
  FloorPlanName: string;
  Beds: number;
  Baths: number;
  SqFt: number;
  MarketRent: number;
  Status: 'occupied' | 'vacant_ready' | 'vacant_not_ready' | 'down' | 'model' | 'notice';
  MakeReadyStatus?: string;
}

interface ResManLease {
  LeaseId: string;
  UnitId: string;
  ResidentId: string;
  StartDate: string;
  EndDate: string;
  Rent: number;
  Deposit: number;
  Status: 'active' | 'expired' | 'future' | 'eviction';
  AutoRenew: boolean;
}

interface ResManResident {
  ResidentId: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  MoveIn: string;
  MoveOut?: string;
  Balance: number;
  Status: 'current' | 'former' | 'applicant';
}

interface ResManLedgerEntry {
  EntryId: string;
  ResidentId: string;
  TransactionType: 'charge' | 'payment' | 'credit' | 'adjustment';
  Amount: number;
  Date: string;
  Description: string;
  GLCode: string;
  Status: 'posted' | 'pending' | 'void';
}

interface ResManProspect {
  ProspectId: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  DesiredMoveIn: string;
  Source: string;
  Status: 'new' | 'contacted' | 'toured' | 'applied' | 'approved' | 'lost';
  PreferredFloorPlan?: string;
}

export class ResManConnector extends BaseConnector {
  private baseUrl = 'https://api.myresman.com/v2';
  private propertyId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.propertyId = this.getCredential('siteId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ property: { Name: string; Id: string; UnitCount: number } }>(
        `/properties/${this.propertyId}`
      );
      return {
        connected: true,
        message: `Connected to ResMan - ${response.property?.Name || 'Unknown'}`,
        details: { propertyName: response.property?.Name, unitCount: response.property?.UnitCount },
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
      { sourceEntity: 'ledger', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'prospects', targetEntity: 'leads', targetModule: 'crm', syncDirection: 'bidirectional', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const sinceParam = options?.since ? `&modifiedAfter=${options.since.toISOString()}` : '';

    const endpointMap: Record<string, string> = {
      units: `/properties/${this.propertyId}/units`,
      leases: `/properties/${this.propertyId}/leases`,
      residents: `/properties/${this.propertyId}/residents`,
      ledger: `/properties/${this.propertyId}/ledger`,
      prospects: `/properties/${this.propertyId}/prospects`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ data: any[]; meta: { total: number; hasMore: boolean } }>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = response.data || [];
    const total = response.meta?.total || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: response.meta?.hasMore || false, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'units': {
        const u = record as ResManUnit;
        return {
          externalId: u.UnitId, unitNumber: u.UnitNumber, floorPlan: u.FloorPlanName,
          bedrooms: u.Beds, bathrooms: u.Baths, squareFeet: u.SqFt,
          marketRent: u.MarketRent, status: u.Status, makeReadyStatus: u.MakeReadyStatus,
          integrationSource: 'resman',
        };
      }
      case 'leases': {
        const l = record as ResManLease;
        return {
          externalId: l.LeaseId, unitExternalId: l.UnitId, tenantExternalId: l.ResidentId,
          startDate: l.StartDate, endDate: l.EndDate, monthlyRent: l.Rent,
          deposit: l.Deposit, status: l.Status, autoRenew: l.AutoRenew,
          integrationSource: 'resman',
        };
      }
      case 'residents': {
        const r = record as ResManResident;
        return {
          externalId: r.ResidentId, firstName: r.FirstName, lastName: r.LastName,
          email: r.Email, phone: r.Phone, moveInDate: r.MoveIn,
          moveOutDate: r.MoveOut, balance: r.Balance, status: r.Status,
          integrationSource: 'resman',
        };
      }
      case 'ledger': {
        const e = record as ResManLedgerEntry;
        return {
          externalId: e.EntryId, tenantExternalId: e.ResidentId,
          transactionType: e.TransactionType, amount: e.Amount, date: e.Date,
          description: e.Description, glCode: e.GLCode, status: e.Status,
          integrationSource: 'resman',
        };
      }
      case 'prospects': {
        const p = record as ResManProspect;
        return {
          externalId: p.ProspectId, firstName: p.FirstName, lastName: p.LastName,
          email: p.Email, phone: p.Phone, desiredMoveIn: p.DesiredMoveIn,
          source: p.Source, status: p.Status, preferredFloorPlan: p.PreferredFloorPlan,
          integrationSource: 'resman',
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
    if (entityType === 'leads' || entityType === 'prospects') {
      const endpoint = data.externalId
        ? `/properties/${this.propertyId}/prospects/${data.externalId}`
        : `/properties/${this.propertyId}/prospects`;
      const method = data.externalId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest<{ ProspectId: string }>(
        endpoint, { method, body: data }
      );
      return { created: !data.externalId, updated: !!data.externalId, id: response.ProspectId };
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
        'Accept': 'application/json',
        'X-ResMan-Property-Id': this.propertyId,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
