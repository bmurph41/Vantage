import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// StorEdge API endpoints (self-storage PMS)
// Base: https://api.storedge.com/v1
// Auth: Bearer token via OAuth 2.0
// Entities: /facilities/{id}/units, /tenants, /ledger, /reservations, /move-ins, /insurance-plans
// Rate limit: 120 requests/minute

interface StorEdgeUnit {
  id: string;
  facility_id: string;
  unit_number: string;
  unit_group_name: string;
  width: number;
  length: number;
  area: number;
  standard_rate: number;
  street_rate?: number;
  climate_controlled: boolean;
  floor: string;
  status: 'available' | 'rented' | 'reserved' | 'offline' | 'damaged';
  door_type: 'roll_up' | 'swing' | 'none';
  vehicle_accessible: boolean;
}

interface StorEdgeTenant {
  id: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  email: string;
  phone: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  balance: number;
  autopay_enabled: boolean;
  status: 'active' | 'delinquent' | 'pre_lien' | 'lien' | 'moved_out';
  gate_code?: string;
}

interface StorEdgeLedgerEntry {
  id: string;
  tenant_id: string;
  type: 'charge' | 'payment' | 'credit' | 'write_off' | 'late_fee';
  amount: number;
  date: string;
  description: string;
  payment_method?: string;
  status: 'posted' | 'pending' | 'reversed';
}

interface StorEdgeReservation {
  id: string;
  unit_id: string;
  tenant_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  desired_move_in: string;
  unit_group_preference?: string;
  status: 'active' | 'converted' | 'cancelled' | 'expired';
  source: string;
  created_at: string;
}

interface StorEdgeInsurance {
  id: string;
  tenant_id: string;
  plan_name: string;
  coverage_amount: number;
  monthly_premium: number;
  effective_date: string;
  expiration_date?: string;
  status: 'active' | 'cancelled' | 'lapsed';
}

export class StorEdgeConnector extends BaseConnector {
  private baseUrl = 'https://api.storedge.com/v1';
  private facilityId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.facilityId = this.getCredential('siteId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ facility: { name: string; id: string; total_units: number } }>(
        `/facilities/${this.facilityId}`
      );
      return {
        connected: true,
        message: `Connected to StorEdge - ${response.facility?.name || 'Unknown'}`,
        details: { facilityName: response.facility?.name, totalUnits: response.facility?.total_units },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'units', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'tenants', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'ledger', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'reservations', targetEntity: 'reservations', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 100 },
      { sourceEntity: 'insurance', targetEntity: 'insurance', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const sinceParam = options?.since ? `&updated_since=${options.since.toISOString()}` : '';

    const endpointMap: Record<string, string> = {
      units: `/facilities/${this.facilityId}/units`,
      tenants: `/facilities/${this.facilityId}/tenants`,
      ledger: `/facilities/${this.facilityId}/ledger`,
      reservations: `/facilities/${this.facilityId}/reservations`,
      insurance: `/facilities/${this.facilityId}/insurance-plans`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ data: any[]; meta: { total: number; per_page: number } }>(
      `${endpoint}?per_page=${limit}&page=${Math.floor(offset / limit) + 1}${sinceParam}`
    );

    const records = response.data || [];
    const total = response.meta?.total || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: offset + records.length < total, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'units': {
        const u = record as StorEdgeUnit;
        return {
          externalId: u.id, unitNumber: u.unit_number, unitGroup: u.unit_group_name,
          width: u.width, length: u.length, area: u.area, standardRate: u.standard_rate,
          streetRate: u.street_rate, climateControlled: u.climate_controlled,
          floor: u.floor, status: u.status, doorType: u.door_type,
          vehicleAccessible: u.vehicle_accessible, integrationSource: 'storedge',
        };
      }
      case 'tenants': {
        const t = record as StorEdgeTenant;
        return {
          externalId: t.id, firstName: t.first_name, lastName: t.last_name,
          companyName: t.company_name, email: t.email, phone: t.phone,
          address: t.address_line1, city: t.city, state: t.state, zip: t.postal_code,
          balance: t.balance, autopayEnabled: t.autopay_enabled, status: t.status,
          gateCode: t.gate_code, integrationSource: 'storedge',
        };
      }
      case 'ledger': {
        const l = record as StorEdgeLedgerEntry;
        return {
          externalId: l.id, tenantExternalId: l.tenant_id, transactionType: l.type,
          amount: l.amount, date: l.date, description: l.description,
          paymentMethod: l.payment_method, status: l.status, integrationSource: 'storedge',
        };
      }
      case 'reservations': {
        const r = record as StorEdgeReservation;
        return {
          externalId: r.id, unitExternalId: r.unit_id, tenantExternalId: r.tenant_id,
          firstName: r.first_name, lastName: r.last_name, email: r.email,
          phone: r.phone, desiredMoveIn: r.desired_move_in, status: r.status,
          source: r.source, createdAt: r.created_at, integrationSource: 'storedge',
        };
      }
      case 'insurance': {
        const i = record as StorEdgeInsurance;
        return {
          externalId: i.id, tenantExternalId: i.tenant_id, planName: i.plan_name,
          coverageAmount: i.coverage_amount, monthlyPremium: i.monthly_premium,
          effectiveDate: i.effective_date, expirationDate: i.expiration_date,
          status: i.status, integrationSource: 'storedge',
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
      const endpoint = data.externalId
        ? `/facilities/${this.facilityId}/reservations/${data.externalId}`
        : `/facilities/${this.facilityId}/reservations`;
      const method = data.externalId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest<{ id: string }>(endpoint, { method, body: data });
      return { created: !data.externalId, updated: !!data.externalId, id: response.id };
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
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
