import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// MRI Software API (commercial real estate)
// Base: https://api.mrisoftware.com/v2
// Auth: OAuth 2.0 client credentials
// Entities: /leases, /tenants, /properties, /ar-records, /ap-records, /cam-charges
// Rate limit: 150 requests/minute

interface MriLease {
  LeaseId: string;
  PropertyId: string;
  TenantId: string;
  SuiteId: string;
  LeaseType: 'gross' | 'net' | 'modified_gross' | 'triple_net' | 'percentage' | 'ground';
  CommencementDate: string;
  ExpirationDate: string;
  BaseRent: number;
  RentEscalation: number;
  EscalationType: 'fixed' | 'cpi' | 'percentage' | 'step';
  SecurityDeposit: number;
  RentableArea: number;
  UsableArea: number;
  ProRataShare: number;
  Status: 'active' | 'expired' | 'pending' | 'terminated' | 'holdover';
  Options: Array<{ type: 'renewal' | 'expansion' | 'termination' | 'right_of_first_refusal'; date: string; terms: string }>;
  CamCharges: number;
  InsuranceCharges: number;
  TaxCharges: number;
}

interface MriTenant {
  TenantId: string;
  CompanyName: string;
  ContactFirstName: string;
  ContactLastName: string;
  ContactEmail: string;
  ContactPhone: string;
  Industry: string;
  SICCode?: string;
  NAICSCode?: string;
  CreditRating?: string;
  AnnualRevenue?: number;
  EmployeeCount?: number;
  Status: 'active' | 'prospect' | 'former' | 'defaulted';
  BillingAddress: {
    Street: string;
    City: string;
    State: string;
    Zip: string;
    Country: string;
  };
}

interface MriProperty {
  PropertyId: string;
  PropertyName: string;
  PropertyType: 'office' | 'retail' | 'industrial' | 'mixed_use' | 'medical' | 'flex';
  Address: {
    Street: string;
    City: string;
    State: string;
    Zip: string;
    Country: string;
  };
  TotalArea: number;
  LeasableArea: number;
  CommonArea: number;
  Floors: number;
  YearBuilt: number;
  OccupancyRate: number;
  ParkingSpaces: number;
  Status: 'active' | 'development' | 'renovation' | 'disposed';
}

interface MriArRecord {
  RecordId: string;
  TenantId: string;
  LeaseId: string;
  ChargeType: 'base_rent' | 'cam' | 'insurance' | 'taxes' | 'utilities' | 'parking' | 'percentage_rent' | 'late_fee';
  Amount: number;
  DateDue: string;
  DatePaid?: string;
  PeriodStart: string;
  PeriodEnd: string;
  Status: 'open' | 'paid' | 'partial' | 'overdue' | 'written_off';
  GLCode: string;
}

interface MriApRecord {
  RecordId: string;
  VendorId: string;
  PropertyId: string;
  Category: 'maintenance' | 'utilities' | 'insurance' | 'taxes' | 'management_fee' | 'capital' | 'other';
  Amount: number;
  InvoiceNumber: string;
  InvoiceDate: string;
  DueDate: string;
  PaidDate?: string;
  Status: 'open' | 'approved' | 'paid' | 'void';
  GLCode: string;
  Description: string;
}

export class MriSoftwareConnector extends BaseConnector {
  private baseUrl = 'https://api.mrisoftware.com/v2';
  private portfolioId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.portfolioId = this.getCredential('companyId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ portfolio: { Name: string; Id: string; PropertyCount: number } }>(
        `/portfolios/${this.portfolioId}`
      );
      return {
        connected: true,
        message: `Connected to MRI Software - ${response.portfolio?.Name || 'Unknown Portfolio'}`,
        details: { portfolioName: response.portfolio?.Name, propertyCount: response.portfolio?.PropertyCount },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'leases', targetEntity: 'leases', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'tenants', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'properties', targetEntity: 'properties', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'arRecords', targetEntity: 'receivables', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'apRecords', targetEntity: 'payables', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
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
      leases: `/portfolios/${this.portfolioId}/leases`,
      tenants: `/portfolios/${this.portfolioId}/tenants`,
      properties: `/portfolios/${this.portfolioId}/properties`,
      arRecords: `/portfolios/${this.portfolioId}/ar`,
      apRecords: `/portfolios/${this.portfolioId}/ap`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ Records: any[]; TotalCount: number }>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = response.Records || [];
    const total = response.TotalCount || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: offset + records.length < total, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'leases': {
        const l = record as MriLease;
        return {
          externalId: l.LeaseId, propertyExternalId: l.PropertyId, tenantExternalId: l.TenantId,
          suiteId: l.SuiteId, leaseType: l.LeaseType, commencementDate: l.CommencementDate,
          expirationDate: l.ExpirationDate, baseRent: l.BaseRent,
          rentEscalation: l.RentEscalation, escalationType: l.EscalationType,
          securityDeposit: l.SecurityDeposit, rentableArea: l.RentableArea,
          usableArea: l.UsableArea, proRataShare: l.ProRataShare, status: l.Status,
          options: l.Options, camCharges: l.CamCharges,
          insuranceCharges: l.InsuranceCharges, taxCharges: l.TaxCharges,
          integrationSource: 'mri_software',
        };
      }
      case 'tenants': {
        const t = record as MriTenant;
        return {
          externalId: t.TenantId, companyName: t.CompanyName,
          firstName: t.ContactFirstName, lastName: t.ContactLastName,
          email: t.ContactEmail, phone: t.ContactPhone, industry: t.Industry,
          sicCode: t.SICCode, naicsCode: t.NAICSCode, creditRating: t.CreditRating,
          annualRevenue: t.AnnualRevenue, employeeCount: t.EmployeeCount,
          status: t.Status, billingAddress: t.BillingAddress,
          integrationSource: 'mri_software',
        };
      }
      case 'properties': {
        const p = record as MriProperty;
        return {
          externalId: p.PropertyId, propertyName: p.PropertyName,
          propertyType: p.PropertyType, address: p.Address, totalArea: p.TotalArea,
          leasableArea: p.LeasableArea, commonArea: p.CommonArea, floors: p.Floors,
          yearBuilt: p.YearBuilt, occupancyRate: p.OccupancyRate,
          parkingSpaces: p.ParkingSpaces, status: p.Status,
          integrationSource: 'mri_software',
        };
      }
      case 'arRecords': {
        const ar = record as MriArRecord;
        return {
          externalId: ar.RecordId, tenantExternalId: ar.TenantId,
          leaseExternalId: ar.LeaseId, chargeType: ar.ChargeType,
          amount: ar.Amount, dateDue: ar.DateDue, datePaid: ar.DatePaid,
          periodStart: ar.PeriodStart, periodEnd: ar.PeriodEnd,
          status: ar.Status, glCode: ar.GLCode, integrationSource: 'mri_software',
        };
      }
      case 'apRecords': {
        const ap = record as MriApRecord;
        return {
          externalId: ap.RecordId, vendorExternalId: ap.VendorId,
          propertyExternalId: ap.PropertyId, category: ap.Category,
          amount: ap.Amount, invoiceNumber: ap.InvoiceNumber,
          invoiceDate: ap.InvoiceDate, dueDate: ap.DueDate, paidDate: ap.PaidDate,
          status: ap.Status, glCode: ap.GLCode, description: ap.Description,
          integrationSource: 'mri_software',
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
    // MRI Software is primarily read-only via API for most entities
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
        'X-MRI-Portfolio-Id': this.portfolioId,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
