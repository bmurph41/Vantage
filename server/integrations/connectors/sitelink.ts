import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// SiteLink API endpoints (self-storage PMS)
// Base: https://api.sitelink.com/v2
// Auth: API key + corp code in headers
// Entities: /units, /tenants, /payments, /move-ins, /move-outs, /insurance
// Rate limit: 60 requests/minute

interface SiteLinkUnit {
  UnitID: string;
  SiteID: string;
  UnitNumber: string;
  Width: number;
  Depth: number;
  SquareFeet: number;
  UnitType: 'standard' | 'climate_controlled' | 'drive_up' | 'vehicle' | 'locker' | 'outdoor';
  Floor: number;
  StandardRate: number;
  WebRate?: number;
  Status: 'available' | 'rented' | 'reserved' | 'unavailable' | 'damaged';
  IsClimateControlled: boolean;
  HasPower: boolean;
  HasAlarm: boolean;
}

interface SiteLinkTenant {
  TenantID: string;
  FirstName: string;
  LastName: string;
  CompanyName?: string;
  Email: string;
  Phone: string;
  Address: string;
  City: string;
  State: string;
  Zip: string;
  Balance: number;
  AutoPay: boolean;
  Status: 'current' | 'delinquent' | 'lien' | 'auction' | 'moved_out';
  MoveInDate: string;
  MoveOutDate?: string;
}

interface SiteLinkPayment {
  PaymentID: string;
  TenantID: string;
  Amount: number;
  PaymentDate: string;
  PaymentType: 'cash' | 'check' | 'credit_card' | 'ach' | 'money_order' | 'auto_pay';
  Status: 'applied' | 'pending' | 'returned' | 'void';
  ReceiptNumber: string;
  PeriodCovered: string;
}

interface SiteLinkMoveIn {
  MoveInID: string;
  TenantID: string;
  UnitID: string;
  MoveInDate: string;
  RentalRate: number;
  DepositAmount: number;
  PromoApplied?: string;
  InsuranceRequired: boolean;
  AccessCode?: string;
}

interface SiteLinkMoveOut {
  MoveOutID: string;
  TenantID: string;
  UnitID: string;
  MoveOutDate: string;
  FinalBalance: number;
  DepositRefund: number;
  DamageCharges?: number;
  CleaningCharges?: number;
}

interface SiteLinkInsurance {
  InsuranceID: string;
  TenantID: string;
  Provider: string;
  CoverageAmount: number;
  MonthlyPremium: number;
  StartDate: string;
  EndDate: string;
  PolicyNumber: string;
  Status: 'active' | 'cancelled' | 'expired' | 'pending';
}

export class SiteLinkConnector extends BaseConnector {
  private baseUrl = 'https://api.sitelink.com/v2';
  private siteId: string;
  private corpCode: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.siteId = this.getCredential('siteId');
    this.corpCode = this.getCredential('companyId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ site: { SiteName: string; SiteID: string; TotalUnits: number } }>(
        `/sites/${this.siteId}`
      );
      return {
        connected: true,
        message: `Connected to SiteLink - ${response.site?.SiteName || 'Unknown Facility'}`,
        details: { siteName: response.site?.SiteName, totalUnits: response.site?.TotalUnits },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'units', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'tenants', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'payments', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'moveIns', targetEntity: 'moveIns', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'moveOuts', targetEntity: 'moveOuts', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'insurance', targetEntity: 'insurance', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const sinceParam = options?.since ? `&changedSince=${options.since.toISOString()}` : '';

    const endpointMap: Record<string, string> = {
      units: `/sites/${this.siteId}/units`,
      tenants: `/sites/${this.siteId}/tenants`,
      payments: `/sites/${this.siteId}/payments`,
      moveIns: `/sites/${this.siteId}/move-ins`,
      moveOuts: `/sites/${this.siteId}/move-outs`,
      insurance: `/sites/${this.siteId}/insurance`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ Records: any[]; TotalCount: number }>(
      `${endpoint}?maxResults=${limit}&startPosition=${offset}${sinceParam}`
    );

    const records = response.Records || [];
    const total = response.TotalCount || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: offset + records.length < total, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'units': {
        const u = record as SiteLinkUnit;
        return {
          externalId: u.UnitID, unitNumber: u.UnitNumber, width: u.Width, depth: u.Depth,
          squareFeet: u.SquareFeet, unitType: u.UnitType, floor: u.Floor,
          standardRate: u.StandardRate, webRate: u.WebRate, status: u.Status,
          isClimateControlled: u.IsClimateControlled, hasPower: u.HasPower,
          hasAlarm: u.HasAlarm, integrationSource: 'sitelink',
        };
      }
      case 'tenants': {
        const t = record as SiteLinkTenant;
        return {
          externalId: t.TenantID, firstName: t.FirstName, lastName: t.LastName,
          companyName: t.CompanyName, email: t.Email, phone: t.Phone,
          address: t.Address, city: t.City, state: t.State, zip: t.Zip,
          balance: t.Balance, autoPay: t.AutoPay, status: t.Status,
          moveInDate: t.MoveInDate, moveOutDate: t.MoveOutDate,
          integrationSource: 'sitelink',
        };
      }
      case 'payments': {
        const p = record as SiteLinkPayment;
        return {
          externalId: p.PaymentID, tenantExternalId: p.TenantID, amount: p.Amount,
          paymentDate: p.PaymentDate, paymentType: p.PaymentType, status: p.Status,
          receiptNumber: p.ReceiptNumber, periodCovered: p.PeriodCovered,
          integrationSource: 'sitelink',
        };
      }
      case 'moveIns': {
        const m = record as SiteLinkMoveIn;
        return {
          externalId: m.MoveInID, tenantExternalId: m.TenantID, unitExternalId: m.UnitID,
          moveInDate: m.MoveInDate, rentalRate: m.RentalRate, depositAmount: m.DepositAmount,
          promoApplied: m.PromoApplied, insuranceRequired: m.InsuranceRequired,
          accessCode: m.AccessCode, integrationSource: 'sitelink',
        };
      }
      case 'moveOuts': {
        const m = record as SiteLinkMoveOut;
        return {
          externalId: m.MoveOutID, tenantExternalId: m.TenantID, unitExternalId: m.UnitID,
          moveOutDate: m.MoveOutDate, finalBalance: m.FinalBalance,
          depositRefund: m.DepositRefund, damageCharges: m.DamageCharges,
          cleaningCharges: m.CleaningCharges, integrationSource: 'sitelink',
        };
      }
      case 'insurance': {
        const i = record as SiteLinkInsurance;
        return {
          externalId: i.InsuranceID, tenantExternalId: i.TenantID, provider: i.Provider,
          coverageAmount: i.CoverageAmount, monthlyPremium: i.MonthlyPremium,
          startDate: i.StartDate, endDate: i.EndDate, policyNumber: i.PolicyNumber,
          status: i.Status, integrationSource: 'sitelink',
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
    // SiteLink is primarily read-only via API; limited write support for payments
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
        'Authorization': `SLApi ${apiKey}`,
        'Accept': 'application/json',
        'X-SiteLink-Corp-Code': this.corpCode,
        'X-SiteLink-Site-Id': this.siteId,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
