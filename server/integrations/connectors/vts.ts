import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// VTS API (commercial real estate leasing & asset management)
// Base: https://api.vts.com/api/v2
// Auth: OAuth 2.0 Bearer token
// Entities: /spaces, /leases, /tenants, /deals, /stacking-plans
// Rate limit: 100 requests/minute

interface VtsSpace {
  id: string;
  building_id: string;
  floor: number;
  suite: string;
  square_feet: number;
  space_type: 'office' | 'retail' | 'industrial' | 'flex' | 'storage' | 'common';
  availability_status: 'available' | 'leased' | 'pending' | 'sublet_available' | 'shadow_available';
  availability_date?: string;
  asking_rent: number;
  condition: 'raw' | 'cold_dark' | 'warm_lit' | 'pre_built' | 'fully_built' | 'turnkey';
  max_contiguous?: number;
  frontage?: number;
  ceiling_height?: number;
  amenities: string[];
}

interface VtsLease {
  id: string;
  space_id: string;
  tenant_id: string;
  building_id: string;
  lease_type: 'direct' | 'sublease' | 'assignment';
  commencement_date: string;
  expiration_date: string;
  base_rent: number;
  effective_rent: number;
  free_rent_months: number;
  tenant_improvement_allowance: number;
  security_deposit: number;
  square_feet: number;
  escalation_type: 'fixed' | 'cpi' | 'market';
  escalation_rate: number;
  status: 'executed' | 'expired' | 'in_negotiation' | 'terminated';
  options: Array<{ type: string; date: string; notice_period_days: number }>;
}

interface VtsTenant {
  id: string;
  company_name: string;
  industry: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  credit_rating?: string;
  employee_count?: number;
  annual_revenue?: number;
  parent_company?: string;
  website?: string;
  status: 'active' | 'prospect' | 'former';
}

interface VtsDeal {
  id: string;
  tenant_id: string;
  space_id: string;
  building_id: string;
  deal_type: 'new' | 'renewal' | 'expansion' | 'relocation' | 'sublease';
  stage: 'prospect' | 'tour' | 'proposal' | 'negotiation' | 'loi' | 'lease_execution' | 'closed_won' | 'closed_lost';
  square_feet_requested: number;
  asking_rent: number;
  proposed_rent?: number;
  proposed_term_months?: number;
  broker?: string;
  probability: number;
  expected_close_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface VtsStackingPlan {
  building_id: string;
  floors: Array<{
    floor_number: number;
    total_square_feet: number;
    spaces: Array<{
      space_id: string;
      suite: string;
      square_feet: number;
      tenant_name?: string;
      lease_expiration?: string;
      status: string;
    }>;
  }>;
}

export class VtsConnector extends BaseConnector {
  private baseUrl = 'https://api.vts.com/api/v2';
  private buildingId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.buildingId = this.getCredential('siteId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ building: { name: string; id: string; total_sqft: number } }>(
        `/buildings/${this.buildingId}`
      );
      return {
        connected: true,
        message: `Connected to VTS - ${response.building?.name || 'Unknown Building'}`,
        details: { buildingName: response.building?.name, totalSqft: response.building?.total_sqft },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'spaces', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'leases', targetEntity: 'leases', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'tenants', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'deals', targetEntity: 'deals', targetModule: 'pipeline', syncDirection: 'bidirectional', batchSize: 50 },
      { sourceEntity: 'stackingPlans', targetEntity: 'stackingPlans', targetModule: 'operations', syncDirection: 'read', batchSize: 10 },
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
      spaces: `/buildings/${this.buildingId}/spaces`,
      leases: `/buildings/${this.buildingId}/leases`,
      tenants: `/buildings/${this.buildingId}/tenants`,
      deals: `/buildings/${this.buildingId}/deals`,
      stackingPlans: `/buildings/${this.buildingId}/stacking-plan`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ data: any[]; meta: { total: number; has_more: boolean } }>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = response.data || [];
    const total = response.meta?.total || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: response.meta?.has_more || false, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'spaces': {
        const s = record as VtsSpace;
        return {
          externalId: s.id, floor: s.floor, suite: s.suite, squareFeet: s.square_feet,
          spaceType: s.space_type, availabilityStatus: s.availability_status,
          availabilityDate: s.availability_date, askingRent: s.asking_rent,
          condition: s.condition, maxContiguous: s.max_contiguous,
          ceilingHeight: s.ceiling_height, amenities: s.amenities,
          integrationSource: 'vts',
        };
      }
      case 'leases': {
        const l = record as VtsLease;
        return {
          externalId: l.id, spaceExternalId: l.space_id, tenantExternalId: l.tenant_id,
          leaseType: l.lease_type, commencementDate: l.commencement_date,
          expirationDate: l.expiration_date, baseRent: l.base_rent,
          effectiveRent: l.effective_rent, freeRentMonths: l.free_rent_months,
          tenantImprovementAllowance: l.tenant_improvement_allowance,
          securityDeposit: l.security_deposit, squareFeet: l.square_feet,
          escalationType: l.escalation_type, escalationRate: l.escalation_rate,
          status: l.status, options: l.options, integrationSource: 'vts',
        };
      }
      case 'tenants': {
        const t = record as VtsTenant;
        return {
          externalId: t.id, companyName: t.company_name, industry: t.industry,
          contactName: t.primary_contact_name, email: t.primary_contact_email,
          phone: t.primary_contact_phone, creditRating: t.credit_rating,
          employeeCount: t.employee_count, annualRevenue: t.annual_revenue,
          parentCompany: t.parent_company, website: t.website, status: t.status,
          integrationSource: 'vts',
        };
      }
      case 'deals': {
        const d = record as VtsDeal;
        return {
          externalId: d.id, tenantExternalId: d.tenant_id, spaceExternalId: d.space_id,
          dealType: d.deal_type, stage: d.stage, squareFeetRequested: d.square_feet_requested,
          askingRent: d.asking_rent, proposedRent: d.proposed_rent,
          proposedTermMonths: d.proposed_term_months, broker: d.broker,
          probability: d.probability, expectedCloseDate: d.expected_close_date,
          notes: d.notes, integrationSource: 'vts',
        };
      }
      case 'stackingPlans': {
        const sp = record as VtsStackingPlan;
        return {
          buildingExternalId: sp.building_id, floors: sp.floors,
          integrationSource: 'vts',
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
    if (entityType === 'deals') {
      const endpoint = data.externalId
        ? `/buildings/${this.buildingId}/deals/${data.externalId}`
        : `/buildings/${this.buildingId}/deals`;
      const method = data.externalId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest<{ id: string }>(
        endpoint, { method, body: data }
      );
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
