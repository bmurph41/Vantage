import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Yardi Voyager API endpoints
// Base: https://{server}.yardi.com/api/v1
// Auth: OAuth 2.0 client credentials
// Entities: /residents, /units, /leases, /charges, /workorders, /vendors
// Rate limit: 120 requests/minute

interface YardiUnit {
  UnitId: string;
  PropertyId: string;
  UnitCode: string;
  UnitType: string;
  Bedrooms: number;
  Bathrooms: number;
  SquareFeet: number;
  MarketRent: number;
  Status: 'vacant' | 'occupied' | 'down' | 'model';
  FloorPlan: string;
  Building: string;
  MoveInDate?: string;
}

interface YardiLease {
  LeaseId: string;
  UnitId: string;
  ResidentId: string;
  LeaseFrom: string;
  LeaseTo: string;
  MonthlyRent: number;
  SecurityDeposit: number;
  Status: 'current' | 'past' | 'future' | 'eviction' | 'month-to-month';
  LeaseType: string;
}

interface YardiTenant {
  ResidentId: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  MoveInDate: string;
  MoveOutDate?: string;
  Balance: number;
  Status: 'current' | 'past' | 'applicant' | 'denied';
}

interface YardiCharge {
  ChargeId: string;
  ResidentId: string;
  LeaseId: string;
  ChargeCode: string;
  Description: string;
  Amount: number;
  DatePosted: string;
  DateDue: string;
  Status: 'open' | 'paid' | 'partial' | 'void';
}

interface YardiWorkOrder {
  WorkOrderId: string;
  UnitId: string;
  ResidentId?: string;
  Category: string;
  Priority: 'low' | 'medium' | 'high' | 'emergency';
  Description: string;
  Status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  CreatedDate: string;
  CompletedDate?: string;
  AssignedTo?: string;
  Cost?: number;
}

interface YardiVendor {
  VendorId: string;
  Name: string;
  ContactName: string;
  Email: string;
  Phone: string;
  Category: string;
  TaxId?: string;
  IsActive: boolean;
}

export class YardiConnector extends BaseConnector {
  private baseUrl: string;
  private propertyId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    const server = this.getSetting('server', 'www');
    this.baseUrl = `https://${server}.yardi.com/api/v1`;
    this.propertyId = this.getCredential('siteId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ Property: { Name: string; Id: string } }>(
        `/properties/${this.propertyId}`
      );
      return {
        connected: true,
        message: `Connected to Yardi Voyager - ${response.Property?.Name || 'Unknown Property'}`,
        details: { propertyName: response.Property?.Name, propertyId: response.Property?.Id },
      };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Failed to connect to Yardi Voyager',
      };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'units', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'leases', targetEntity: 'leases', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'tenants', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'charges', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'workOrders', targetEntity: 'workOrders', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 50 },
      { sourceEntity: 'vendors', targetEntity: 'vendors', targetModule: 'accounting', syncDirection: 'read', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const sinceParam = options?.since ? `&modifiedSince=${options.since.toISOString()}` : '';

    const endpointMap: Record<string, string> = {
      units: `/properties/${this.propertyId}/units`,
      leases: `/properties/${this.propertyId}/leases`,
      tenants: `/properties/${this.propertyId}/residents`,
      charges: `/properties/${this.propertyId}/charges`,
      workOrders: `/properties/${this.propertyId}/workorders`,
      vendors: `/properties/${this.propertyId}/vendors`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ data: any[]; total: number }>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = response.data || [];
    const total = response.total || records.length;

    const transformed = records.map(record => this.transformRecord(entityType, record));
    return { data: transformed, hasMore: offset + records.length < total, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'units':
        return this.transformUnit(record as YardiUnit);
      case 'leases':
        return this.transformLease(record as YardiLease);
      case 'tenants':
        return this.transformTenant(record as YardiTenant);
      case 'charges':
        return this.transformCharge(record as YardiCharge);
      case 'workOrders':
        return this.transformWorkOrder(record as YardiWorkOrder);
      case 'vendors':
        return this.transformVendor(record as YardiVendor);
      default:
        return record;
    }
  }

  private transformUnit(unit: YardiUnit): any {
    return {
      externalId: unit.UnitId,
      unitCode: unit.UnitCode,
      unitType: unit.UnitType,
      bedrooms: unit.Bedrooms,
      bathrooms: unit.Bathrooms,
      squareFeet: unit.SquareFeet,
      marketRent: unit.MarketRent,
      status: unit.Status,
      floorPlan: unit.FloorPlan,
      building: unit.Building,
      integrationSource: 'yardi',
    };
  }

  private transformLease(lease: YardiLease): any {
    return {
      externalId: lease.LeaseId,
      unitExternalId: lease.UnitId,
      tenantExternalId: lease.ResidentId,
      startDate: lease.LeaseFrom,
      endDate: lease.LeaseTo,
      monthlyRent: lease.MonthlyRent,
      securityDeposit: lease.SecurityDeposit,
      status: lease.Status,
      leaseType: lease.LeaseType,
      integrationSource: 'yardi',
    };
  }

  private transformTenant(tenant: YardiTenant): any {
    return {
      externalId: tenant.ResidentId,
      firstName: tenant.FirstName,
      lastName: tenant.LastName,
      email: tenant.Email,
      phone: tenant.Phone,
      moveInDate: tenant.MoveInDate,
      moveOutDate: tenant.MoveOutDate,
      balance: tenant.Balance,
      status: tenant.Status,
      integrationSource: 'yardi',
    };
  }

  private transformCharge(charge: YardiCharge): any {
    return {
      externalId: charge.ChargeId,
      tenantExternalId: charge.ResidentId,
      leaseExternalId: charge.LeaseId,
      chargeCode: charge.ChargeCode,
      description: charge.Description,
      amount: charge.Amount,
      datePosted: charge.DatePosted,
      dateDue: charge.DateDue,
      status: charge.Status,
      integrationSource: 'yardi',
    };
  }

  private transformWorkOrder(wo: YardiWorkOrder): any {
    return {
      externalId: wo.WorkOrderId,
      unitExternalId: wo.UnitId,
      tenantExternalId: wo.ResidentId,
      category: wo.Category,
      priority: wo.Priority,
      description: wo.Description,
      status: wo.Status,
      createdDate: wo.CreatedDate,
      completedDate: wo.CompletedDate,
      assignedTo: wo.AssignedTo,
      cost: wo.Cost,
      integrationSource: 'yardi',
    };
  }

  private transformVendor(vendor: YardiVendor): any {
    return {
      externalId: vendor.VendorId,
      name: vendor.Name,
      contactName: vendor.ContactName,
      email: vendor.Email,
      phone: vendor.Phone,
      category: vendor.Category,
      taxId: vendor.TaxId,
      isActive: vendor.IsActive,
      integrationSource: 'yardi',
    };
  }

  protected async saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }> {
    // Yardi supports write-back for work orders and limited tenant updates
    if (entityType === 'workOrders') {
      const endpoint = data.externalId
        ? `/properties/${this.propertyId}/workorders/${data.externalId}`
        : `/properties/${this.propertyId}/workorders`;
      const method = data.externalId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest<{ WorkOrderId: string }>(
        endpoint, { method, body: data }
      );
      return {
        created: !data.externalId,
        updated: !!data.externalId,
        id: response.WorkOrderId || data.externalId,
      };
    }

    // Most Yardi entities are read-only via API
    return { created: false, updated: false };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options?: { method?: string; body?: any }
  ): Promise<T> {
    const accessToken = this.getCredential('accessToken');
    const url = `${this.baseUrl}${endpoint}`;

    return this.makeRequest<T>(url, {
      method: options?.method || 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'X-Yardi-Property': this.propertyId,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
