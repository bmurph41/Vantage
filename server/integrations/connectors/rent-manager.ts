import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Rent Manager API (residential property management)
// Base: https://{subdomain}.rentmanager.com/api/v1
// Auth: API key in X-RM-ApiKey header
// Entities: /Units, /Leases, /Tenants, /Charges, /WorkOrders, /Properties
// Rate limit: 120 requests/minute

interface RentManagerUnit {
  UnitID: number;
  PropertyID: number;
  Name: string;
  UnitTypeID: number;
  UnitTypeName: string;
  Bedrooms: number;
  Bathrooms: number;
  SquareFeet: number;
  MarketRent: number;
  Address: string;
  City: string;
  State: string;
  Zip: string;
  Status: 'Vacant' | 'Occupied' | 'OnNotice' | 'Down' | 'Model';
  IsActive: boolean;
}

interface RentManagerLease {
  LeaseID: number;
  UnitID: number;
  TenantID: number;
  StartDate: string;
  EndDate: string;
  Rent: number;
  SecurityDeposit: number;
  LeaseType: 'Standard' | 'MonthToMonth' | 'Section8' | 'Corporate';
  Status: 'Active' | 'Past' | 'Future' | 'Eviction';
  LateFee: number;
  GracePeriodDays: number;
  RenewalDate?: string;
  RecurringCharges: Array<{ ChargeTypeID: number; Description: string; Amount: number }>;
}

interface RentManagerTenant {
  TenantID: number;
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  AlternatePhone?: string;
  SSN_Last4?: string;
  DateOfBirth?: string;
  EmergencyContactName?: string;
  EmergencyContactPhone?: string;
  Balance: number;
  MoveInDate: string;
  MoveOutDate?: string;
  Status: 'Current' | 'Past' | 'Applicant' | 'Eviction';
}

interface RentManagerCharge {
  ChargeID: number;
  TenantID: number;
  LeaseID: number;
  ChargeTypeID: number;
  Description: string;
  Amount: number;
  DateCharged: string;
  DateDue: string;
  DatePaid?: string;
  AmountPaid: number;
  Balance: number;
  GLAccountID: number;
  Status: 'Open' | 'Paid' | 'Partial' | 'WriteOff' | 'Void';
}

interface RentManagerWorkOrder {
  WorkOrderID: number;
  UnitID: number;
  TenantID?: number;
  VendorID?: number;
  Category: string;
  Priority: 'Low' | 'Normal' | 'High' | 'Emergency';
  Description: string;
  Status: 'Open' | 'Assigned' | 'InProgress' | 'OnHold' | 'Complete' | 'Cancelled';
  EntryPermission: boolean;
  CreateDate: string;
  CompleteDate?: string;
  ScheduledDate?: string;
  EstimatedCost?: number;
  ActualCost?: number;
  Notes?: string;
}

interface RentManagerProperty {
  PropertyID: number;
  Name: string;
  Address: string;
  City: string;
  State: string;
  Zip: string;
  PropertyType: 'SingleFamily' | 'MultiFamily' | 'Commercial' | 'Mixed';
  UnitCount: number;
  YearBuilt?: number;
  OwnerID?: number;
  ManagementFee?: number;
  IsActive: boolean;
}

export class RentManagerConnector extends BaseConnector {
  private baseUrl: string;

  constructor(config: ConnectorConfig) {
    super(config);
    const subdomain = this.getSetting('subdomain', '');
    this.baseUrl = `https://${subdomain}.rentmanager.com/api/v1`;
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<RentManagerProperty[]>(
        '/Properties?pageSize=1'
      );
      const property = response?.[0];
      return {
        connected: true,
        message: `Connected to Rent Manager - ${property?.Name || 'Portfolio'}`,
        details: { propertyName: property?.Name },
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
      { sourceEntity: 'charges', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'workOrders', targetEntity: 'workOrders', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 50 },
      { sourceEntity: 'properties', targetEntity: 'properties', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
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
      units: '/Units',
      leases: '/Leases',
      tenants: '/Tenants',
      charges: '/Charges',
      workOrders: '/WorkOrders',
      properties: '/Properties',
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<any[]>(
      `${endpoint}?pageSize=${limit}&pageNumber=${Math.floor(offset / limit) + 1}${sinceParam}`
    );

    const records = Array.isArray(response) ? response : [];
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: records.length === limit };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'units': {
        const u = record as RentManagerUnit;
        return {
          externalId: String(u.UnitID), propertyExternalId: String(u.PropertyID),
          name: u.Name, unitType: u.UnitTypeName, bedrooms: u.Bedrooms,
          bathrooms: u.Bathrooms, squareFeet: u.SquareFeet, marketRent: u.MarketRent,
          address: u.Address, city: u.City, state: u.State, zip: u.Zip,
          status: u.Status, isActive: u.IsActive, integrationSource: 'rent_manager',
        };
      }
      case 'leases': {
        const l = record as RentManagerLease;
        return {
          externalId: String(l.LeaseID), unitExternalId: String(l.UnitID),
          tenantExternalId: String(l.TenantID), startDate: l.StartDate,
          endDate: l.EndDate, rent: l.Rent, securityDeposit: l.SecurityDeposit,
          leaseType: l.LeaseType, status: l.Status, lateFee: l.LateFee,
          gracePeriodDays: l.GracePeriodDays, renewalDate: l.RenewalDate,
          recurringCharges: l.RecurringCharges, integrationSource: 'rent_manager',
        };
      }
      case 'tenants': {
        const t = record as RentManagerTenant;
        return {
          externalId: String(t.TenantID), firstName: t.FirstName, lastName: t.LastName,
          email: t.Email, phone: t.Phone, alternatePhone: t.AlternatePhone,
          emergencyContactName: t.EmergencyContactName,
          emergencyContactPhone: t.EmergencyContactPhone, balance: t.Balance,
          moveInDate: t.MoveInDate, moveOutDate: t.MoveOutDate, status: t.Status,
          integrationSource: 'rent_manager',
        };
      }
      case 'charges': {
        const c = record as RentManagerCharge;
        return {
          externalId: String(c.ChargeID), tenantExternalId: String(c.TenantID),
          leaseExternalId: String(c.LeaseID), description: c.Description,
          amount: c.Amount, dateCharged: c.DateCharged, dateDue: c.DateDue,
          datePaid: c.DatePaid, amountPaid: c.AmountPaid, balance: c.Balance,
          status: c.Status, integrationSource: 'rent_manager',
        };
      }
      case 'workOrders': {
        const w = record as RentManagerWorkOrder;
        return {
          externalId: String(w.WorkOrderID), unitExternalId: String(w.UnitID),
          tenantExternalId: w.TenantID ? String(w.TenantID) : undefined,
          category: w.Category, priority: w.Priority, description: w.Description,
          status: w.Status, entryPermission: w.EntryPermission,
          createDate: w.CreateDate, completeDate: w.CompleteDate,
          scheduledDate: w.ScheduledDate, estimatedCost: w.EstimatedCost,
          actualCost: w.ActualCost, notes: w.Notes,
          integrationSource: 'rent_manager',
        };
      }
      case 'properties': {
        const p = record as RentManagerProperty;
        return {
          externalId: String(p.PropertyID), name: p.Name, address: p.Address,
          city: p.City, state: p.State, zip: p.Zip, propertyType: p.PropertyType,
          unitCount: p.UnitCount, yearBuilt: p.YearBuilt, isActive: p.IsActive,
          integrationSource: 'rent_manager',
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
      const endpoint = data.externalId ? `/WorkOrders/${data.externalId}` : '/WorkOrders';
      const method = data.externalId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest<{ WorkOrderID: number }>(
        endpoint, { method, body: data }
      );
      return { created: !data.externalId, updated: !!data.externalId, id: String(response.WorkOrderID) };
    }
    return { created: false, updated: false };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options?: { method?: string; body?: any }
  ): Promise<T> {
    const apiKey = this.getCredential('apiKey');
    return this.makeRequest<T>(`${this.baseUrl}${endpoint}`, {
      method: options?.method || 'GET',
      headers: {
        'X-RM-ApiKey': apiKey,
        'Accept': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
