import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// RealPage API endpoints
// Base: https://api.realpage.com/v2
// Auth: OAuth 2.0 with client_credentials grant
// Entities: /units, /leases, /residents, /payments, /prospects, /amenities
// Rate limit: 100 requests/minute

interface RealPageUnit {
  unitId: string;
  propertyId: string;
  unitNumber: string;
  unitType: string;
  floorPlan: string;
  beds: number;
  baths: number;
  sqft: number;
  marketRent: number;
  effectiveRent?: number;
  status: 'available' | 'occupied' | 'notice' | 'vacant_ready' | 'vacant_not_ready' | 'down';
  makeReadyDate?: string;
}

interface RealPageLease {
  leaseId: string;
  unitId: string;
  residentId: string;
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRent: number;
  deposit: number;
  status: 'active' | 'expired' | 'future' | 'cancelled';
  renewalStatus?: 'offered' | 'accepted' | 'declined' | 'pending';
}

interface RealPageResident {
  residentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  moveIn: string;
  moveOut?: string;
  balance: number;
  status: 'current' | 'former' | 'applicant';
  creditScore?: number;
}

interface RealPagePayment {
  paymentId: string;
  residentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'check' | 'ach' | 'credit_card' | 'money_order' | 'cash';
  status: 'posted' | 'pending' | 'returned' | 'void';
  referenceNumber?: string;
}

interface RealPageProspect {
  prospectId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  desiredMoveIn: string;
  desiredBeds?: number;
  desiredRentMax?: number;
  source: string;
  status: 'new' | 'contacted' | 'toured' | 'applied' | 'approved' | 'denied' | 'lost';
}

export class RealPageConnector extends BaseConnector {
  private baseUrl = 'https://api.realpage.com/v2';
  private propertyId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.propertyId = this.getCredential('siteId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ property: { name: string; id: string; unitCount: number } }>(
        `/properties/${this.propertyId}`
      );
      return {
        connected: true,
        message: `Connected to RealPage - ${response.property?.name || 'Unknown'}`,
        details: { propertyName: response.property?.name, unitCount: response.property?.unitCount },
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
      { sourceEntity: 'payments', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'prospects', targetEntity: 'leads', targetModule: 'crm', syncDirection: 'bidirectional', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const sinceParam = options?.since ? `&updatedAfter=${options.since.toISOString()}` : '';

    const endpointMap: Record<string, string> = {
      units: `/properties/${this.propertyId}/units`,
      leases: `/properties/${this.propertyId}/leases`,
      residents: `/properties/${this.propertyId}/residents`,
      payments: `/properties/${this.propertyId}/payments`,
      prospects: `/properties/${this.propertyId}/prospects`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ results: any[]; totalCount: number; pageSize: number }>(
      `${endpoint}?pageSize=${limit}&page=${Math.floor(offset / limit) + 1}${sinceParam}`
    );

    const records = response.results || [];
    const total = response.totalCount || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: offset + records.length < total, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'units': {
        const u = record as RealPageUnit;
        return {
          externalId: u.unitId, unitNumber: u.unitNumber, unitType: u.unitType,
          floorPlan: u.floorPlan, bedrooms: u.beds, bathrooms: u.baths,
          squareFeet: u.sqft, marketRent: u.marketRent, effectiveRent: u.effectiveRent,
          status: u.status, makeReadyDate: u.makeReadyDate, integrationSource: 'realpage',
        };
      }
      case 'leases': {
        const l = record as RealPageLease;
        return {
          externalId: l.leaseId, unitExternalId: l.unitId, tenantExternalId: l.residentId,
          startDate: l.leaseStartDate, endDate: l.leaseEndDate, monthlyRent: l.monthlyRent,
          deposit: l.deposit, status: l.status, renewalStatus: l.renewalStatus,
          integrationSource: 'realpage',
        };
      }
      case 'residents': {
        const r = record as RealPageResident;
        return {
          externalId: r.residentId, firstName: r.firstName, lastName: r.lastName,
          email: r.email, phone: r.phone, moveInDate: r.moveIn, moveOutDate: r.moveOut,
          balance: r.balance, status: r.status, integrationSource: 'realpage',
        };
      }
      case 'payments': {
        const p = record as RealPagePayment;
        return {
          externalId: p.paymentId, tenantExternalId: p.residentId, amount: p.amount,
          paymentDate: p.paymentDate, paymentMethod: p.paymentMethod, status: p.status,
          referenceNumber: p.referenceNumber, integrationSource: 'realpage',
        };
      }
      case 'prospects': {
        const pr = record as RealPageProspect;
        return {
          externalId: pr.prospectId, firstName: pr.firstName, lastName: pr.lastName,
          email: pr.email, phone: pr.phone, desiredMoveIn: pr.desiredMoveIn,
          desiredBeds: pr.desiredBeds, desiredRentMax: pr.desiredRentMax,
          source: pr.source, status: pr.status, integrationSource: 'realpage',
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

      const response = await this.makeAuthenticatedRequest<{ prospectId: string }>(
        endpoint, { method, body: data }
      );
      return { created: !data.externalId, updated: !!data.externalId, id: response.prospectId };
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
        'X-RealPage-Property-Id': this.propertyId,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
