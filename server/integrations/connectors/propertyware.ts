import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Propertyware API (residential property management)
// Base: https://api.propertyware.com/pw/api/rest/v1
// Auth: API key + password in Basic auth
// Entities: /units, /leases, /contacts, /bills, /workorders, /owners
// Rate limit: 60 requests/minute

interface PropertywareUnit {
  id: number;
  buildingId: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: 'residential' | 'commercial' | 'mixed';
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  marketRent: number;
  targetDeposit: number;
  status: 'vacant' | 'occupied' | 'notice' | 'down' | 'model';
  lastMoveOut?: string;
  isActive: boolean;
}

interface PropertywareLease {
  id: number;
  unitId: number;
  tenantId: number;
  startDate: string;
  endDate: string;
  rent: number;
  securityDeposit: number;
  lateFee: number;
  gracePeriod: number;
  status: 'active' | 'expired' | 'future' | 'eviction' | 'month_to_month';
  leaseType: 'fixed' | 'month_to_month' | 'weekly';
  moveInDate: string;
  moveOutDate?: string;
  recurringCharges: Array<{ description: string; amount: number; glAccount: string }>;
}

interface PropertywareContact {
  id: number;
  firstName: string;
  lastName: string;
  companyName?: string;
  email: string;
  homePhone?: string;
  workPhone?: string;
  cellPhone?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: 'tenant' | 'owner' | 'vendor' | 'prospect';
  balance: number;
  isActive: boolean;
}

interface PropertywareBill {
  id: number;
  vendorId: number;
  buildingId: number;
  amount: number;
  date: string;
  dueDate: string;
  description: string;
  glAccount: string;
  status: 'open' | 'paid' | 'partial' | 'void';
  checkNumber?: string;
  paidDate?: string;
}

interface PropertywareWorkOrder {
  id: number;
  unitId: number;
  contactId?: number;
  category: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  status: 'new' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  assignedVendorId?: number;
  createdDate: string;
  completedDate?: string;
  estimatedCost?: number;
  actualCost?: number;
  entryPermission: boolean;
}

interface PropertywareOwner {
  id: number;
  firstName: string;
  lastName: string;
  companyName?: string;
  email: string;
  phone: string;
  ownershipPercentage: number;
  managementFeePercent: number;
  distributionMethod: 'ach' | 'check' | 'hold';
  properties: number[];
  isActive: boolean;
}

export class PropertywareConnector extends BaseConnector {
  private baseUrl = 'https://api.propertyware.com/pw/api/rest/v1';

  constructor(config: ConnectorConfig) {
    super(config);
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ id: number; name: string; unitCount: number }>(
        '/buildings?limit=1'
      );
      return {
        connected: true,
        message: 'Connected to Propertyware successfully',
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
      { sourceEntity: 'contacts', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'bills', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
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
    const sinceParam = options?.since ? `&lastModifiedDateTimeStart=${options.since.toISOString()}` : '';

    const endpointMap: Record<string, string> = {
      units: '/units',
      leases: '/leases',
      contacts: '/contacts',
      bills: '/bills',
      workOrders: '/workorders',
      owners: '/owners',
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<any[]>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = Array.isArray(response) ? response : [];
    const transformed = records.map(record => this.transformRecord(entityType, record));
    // Propertyware returns arrays without total count; hasMore if full page returned
    return { data: transformed, hasMore: records.length === limit };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'units': {
        const u = record as PropertywareUnit;
        return {
          externalId: String(u.id), name: u.name, address: u.address,
          city: u.city, state: u.state, zip: u.zip, unitType: u.type,
          bedrooms: u.bedrooms, bathrooms: u.bathrooms, squareFeet: u.squareFeet,
          marketRent: u.marketRent, targetDeposit: u.targetDeposit, status: u.status,
          isActive: u.isActive, integrationSource: 'propertyware',
        };
      }
      case 'leases': {
        const l = record as PropertywareLease;
        return {
          externalId: String(l.id), unitExternalId: String(l.unitId),
          tenantExternalId: String(l.tenantId), startDate: l.startDate,
          endDate: l.endDate, rent: l.rent, securityDeposit: l.securityDeposit,
          lateFee: l.lateFee, gracePeriod: l.gracePeriod, status: l.status,
          leaseType: l.leaseType, moveInDate: l.moveInDate, moveOutDate: l.moveOutDate,
          recurringCharges: l.recurringCharges, integrationSource: 'propertyware',
        };
      }
      case 'contacts': {
        const c = record as PropertywareContact;
        return {
          externalId: String(c.id), firstName: c.firstName, lastName: c.lastName,
          companyName: c.companyName, email: c.email,
          phone: c.cellPhone || c.homePhone || c.workPhone,
          address: c.address, city: c.city, state: c.state, zip: c.zip,
          contactType: c.type, balance: c.balance, isActive: c.isActive,
          integrationSource: 'propertyware',
        };
      }
      case 'bills': {
        const b = record as PropertywareBill;
        return {
          externalId: String(b.id), vendorExternalId: String(b.vendorId),
          amount: b.amount, date: b.date, dueDate: b.dueDate,
          description: b.description, glAccount: b.glAccount, status: b.status,
          checkNumber: b.checkNumber, paidDate: b.paidDate,
          integrationSource: 'propertyware',
        };
      }
      case 'workOrders': {
        const w = record as PropertywareWorkOrder;
        return {
          externalId: String(w.id), unitExternalId: String(w.unitId),
          contactExternalId: w.contactId ? String(w.contactId) : undefined,
          category: w.category, description: w.description, priority: w.priority,
          status: w.status, assignedVendorId: w.assignedVendorId ? String(w.assignedVendorId) : undefined,
          createdDate: w.createdDate, completedDate: w.completedDate,
          estimatedCost: w.estimatedCost, actualCost: w.actualCost,
          entryPermission: w.entryPermission, integrationSource: 'propertyware',
        };
      }
      case 'owners': {
        const o = record as PropertywareOwner;
        return {
          externalId: String(o.id), firstName: o.firstName, lastName: o.lastName,
          companyName: o.companyName, email: o.email, phone: o.phone,
          ownershipPercentage: o.ownershipPercentage,
          managementFeePercent: o.managementFeePercent,
          distributionMethod: o.distributionMethod,
          properties: o.properties.map(String), isActive: o.isActive,
          integrationSource: 'propertyware',
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

      const response = await this.makeAuthenticatedRequest<{ id: number }>(
        endpoint, { method, body: data }
      );
      return { created: !data.externalId, updated: !!data.externalId, id: String(response.id) };
    }
    return { created: false, updated: false };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options?: { method?: string; body?: any }
  ): Promise<T> {
    const apiKey = this.getCredential('apiKey');
    const password = this.getCredential('apiSecret');
    const credentials = Buffer.from(`${apiKey}:${password}`).toString('base64');

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
