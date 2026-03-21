import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// AppFolio API endpoints
// Base: https://{subdomain}.appfolio.com/api/v2
// Auth: API key + client secret in Authorization header
// Entities: /properties, /units, /tenants, /leases, /bills, /work-orders
// Rate limit: 60 requests/minute

interface AppFolioUnit {
  id: string;
  property_id: string;
  name: string;
  address: string;
  unit_type: string;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  market_rent: number;
  status: 'vacant' | 'occupied' | 'pending';
  amenities: string[];
}

interface AppFolioTenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_numbers: Array<{ type: string; number: string }>;
  move_in_date: string;
  move_out_date?: string;
  balance: number;
  status: 'current' | 'past' | 'applicant' | 'future';
}

interface AppFolioLease {
  id: string;
  unit_id: string;
  tenant_ids: string[];
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number;
  status: 'active' | 'expired' | 'future' | 'month_to_month';
  recurring_charges: Array<{ description: string; amount: number }>;
}

interface AppFolioBill {
  id: string;
  vendor_id: string;
  property_id: string;
  amount: number;
  date: string;
  due_date: string;
  description: string;
  status: 'open' | 'paid' | 'overdue' | 'void';
  category: string;
}

interface AppFolioWorkOrder {
  id: string;
  unit_id: string;
  tenant_id?: string;
  description: string;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  completed_at?: string;
  assigned_vendor_id?: string;
  cost?: number;
}

export class AppFolioConnector extends BaseConnector {
  private baseUrl: string;

  constructor(config: ConnectorConfig) {
    super(config);
    const subdomain = this.getSetting('subdomain', '');
    this.baseUrl = `https://${subdomain}.appfolio.com/api/v2`;
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ company: { name: string; id: string } }>(
        '/company'
      );
      return {
        connected: true,
        message: `Connected to AppFolio - ${response.company?.name || 'Unknown'}`,
        details: { companyName: response.company?.name },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'units', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'tenants', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'leases', targetEntity: 'leases', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'bills', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'workOrders', targetEntity: 'workOrders', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 50 },
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
      units: '/units',
      tenants: '/tenants',
      leases: '/leases',
      bills: '/bills',
      workOrders: '/work-orders',
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ data: any[]; pagination: { total: number; has_more: boolean } }>(
      `${endpoint}?per_page=${limit}&page=${Math.floor(offset / limit) + 1}${sinceParam}`
    );

    const records = response.data || [];
    const total = response.pagination?.total || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: response.pagination?.has_more || false, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'units': {
        const u = record as AppFolioUnit;
        return {
          externalId: u.id, propertyExternalId: u.property_id, name: u.name,
          address: u.address, unitType: u.unit_type, bedrooms: u.bedrooms,
          bathrooms: u.bathrooms, squareFeet: u.square_feet, marketRent: u.market_rent,
          status: u.status, amenities: u.amenities, integrationSource: 'appfolio',
        };
      }
      case 'tenants': {
        const t = record as AppFolioTenant;
        return {
          externalId: t.id, firstName: t.first_name, lastName: t.last_name,
          email: t.email, phone: t.phone_numbers?.[0]?.number,
          moveInDate: t.move_in_date, moveOutDate: t.move_out_date,
          balance: t.balance, status: t.status, integrationSource: 'appfolio',
        };
      }
      case 'leases': {
        const l = record as AppFolioLease;
        return {
          externalId: l.id, unitExternalId: l.unit_id, tenantExternalIds: l.tenant_ids,
          startDate: l.start_date, endDate: l.end_date, monthlyRent: l.monthly_rent,
          securityDeposit: l.security_deposit, status: l.status,
          recurringCharges: l.recurring_charges, integrationSource: 'appfolio',
        };
      }
      case 'bills': {
        const b = record as AppFolioBill;
        return {
          externalId: b.id, vendorExternalId: b.vendor_id, propertyExternalId: b.property_id,
          amount: b.amount, date: b.date, dueDate: b.due_date,
          description: b.description, status: b.status, category: b.category,
          integrationSource: 'appfolio',
        };
      }
      case 'workOrders': {
        const w = record as AppFolioWorkOrder;
        return {
          externalId: w.id, unitExternalId: w.unit_id, tenantExternalId: w.tenant_id,
          description: w.description, category: w.category, priority: w.priority,
          status: w.status, createdAt: w.created_at, completedAt: w.completed_at,
          assignedVendorId: w.assigned_vendor_id, cost: w.cost,
          integrationSource: 'appfolio',
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
      const endpoint = data.externalId ? `/work-orders/${data.externalId}` : '/work-orders';
      const method = data.externalId ? 'PATCH' : 'POST';

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
