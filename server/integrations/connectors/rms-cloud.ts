import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// RMS Cloud API (RV park / hospitality PMS)
// Base: https://api.rmscloud.com/v1
// Auth: OAuth 2.0 Bearer token with API key header
// Entities: /sites, /reservations, /guests, /accounts, /rates
// Rate limit: 100 requests/minute

interface RmsCloudSite {
  SiteId: string;
  ParkId: string;
  SiteName: string;
  SiteNumber: string;
  SiteCategory: 'powered' | 'unpowered' | 'cabin' | 'villa' | 'glamping' | 'ensuite';
  MaxLength: number;
  MaxWidth: number;
  Powered: boolean;
  WaterConnection: boolean;
  SewerConnection: boolean;
  MaxOccupants: number;
  PetsAllowed: boolean;
  DailyRate: number;
  WeeklyRate?: number;
  MonthlyRate?: number;
  Status: 'available' | 'occupied' | 'reserved' | 'maintenance' | 'closed';
  Zone?: string;
  Features: string[];
}

interface RmsCloudReservation {
  ReservationId: string;
  SiteId: string;
  GuestId: string;
  ArrivalDate: string;
  DepartureDate: string;
  Nights: number;
  Adults: number;
  Children: number;
  Infants: number;
  Vehicles: number;
  TotalAmount: number;
  DepositAmount: number;
  BalanceDue: number;
  Status: 'confirmed' | 'provisional' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  Source: string;
  RateType: string;
  Notes?: string;
  Extras: Array<{ Name: string; Quantity: number; UnitPrice: number }>;
  CreatedAt: string;
}

interface RmsCloudGuest {
  GuestId: string;
  Title?: string;
  FirstName: string;
  LastName: string;
  Email: string;
  MobilePhone: string;
  HomePhone?: string;
  Address: {
    Street: string;
    City: string;
    State: string;
    PostCode: string;
    Country: string;
  };
  MembershipNumber?: string;
  MembershipType?: string;
  TotalStays: number;
  TotalSpent: number;
  VehicleRegistration?: string;
  Preferences: string[];
  MarketingOptIn: boolean;
}

interface RmsCloudAccount {
  AccountId: string;
  ReservationId: string;
  GuestId: string;
  Type: 'charge' | 'payment' | 'refund' | 'deposit' | 'adjustment';
  Description: string;
  Amount: number;
  Date: string;
  PaymentMethod?: string;
  GLCode?: string;
  Status: 'posted' | 'pending' | 'reversed';
}

interface RmsCloudRate {
  RateId: string;
  RateName: string;
  SiteCategory: string;
  DailyRate: number;
  WeeklyRate?: number;
  MonthlyRate?: number;
  SeasonalRate?: number;
  ValidFrom: string;
  ValidTo: string;
  MinStay: number;
  MaxStay?: number;
  IsActive: boolean;
}

export class RmsCloudConnector extends BaseConnector {
  private baseUrl = 'https://api.rmscloud.com/v1';
  private parkId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.parkId = this.getCredential('siteId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ park: { Name: string; Id: string; TotalSites: number } }>(
        `/parks/${this.parkId}`
      );
      return {
        connected: true,
        message: `Connected to RMS Cloud - ${response.park?.Name || 'Unknown Park'}`,
        details: { parkName: response.park?.Name, totalSites: response.park?.TotalSites },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'sites', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'reservations', targetEntity: 'reservations', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 50 },
      { sourceEntity: 'guests', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'accounts', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'rates', targetEntity: 'rates', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
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
      sites: `/parks/${this.parkId}/sites`,
      reservations: `/parks/${this.parkId}/reservations`,
      guests: `/parks/${this.parkId}/guests`,
      accounts: `/parks/${this.parkId}/accounts`,
      rates: `/parks/${this.parkId}/rates`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ Data: any[]; TotalCount: number; HasMore: boolean }>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = response.Data || [];
    const total = response.TotalCount || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: response.HasMore || false, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'sites': {
        const s = record as RmsCloudSite;
        return {
          externalId: s.SiteId, siteName: s.SiteName, siteNumber: s.SiteNumber,
          siteCategory: s.SiteCategory, maxLength: s.MaxLength, maxWidth: s.MaxWidth,
          powered: s.Powered, waterConnection: s.WaterConnection,
          sewerConnection: s.SewerConnection, maxOccupants: s.MaxOccupants,
          petsAllowed: s.PetsAllowed, dailyRate: s.DailyRate,
          weeklyRate: s.WeeklyRate, monthlyRate: s.MonthlyRate,
          status: s.Status, zone: s.Zone, features: s.Features,
          integrationSource: 'rms_cloud',
        };
      }
      case 'reservations': {
        const r = record as RmsCloudReservation;
        return {
          externalId: r.ReservationId, siteExternalId: r.SiteId, guestExternalId: r.GuestId,
          arrivalDate: r.ArrivalDate, departureDate: r.DepartureDate, nights: r.Nights,
          adults: r.Adults, children: r.Children, infants: r.Infants,
          totalAmount: r.TotalAmount, depositAmount: r.DepositAmount,
          balanceDue: r.BalanceDue, status: r.Status, source: r.Source,
          rateType: r.RateType, notes: r.Notes, extras: r.Extras,
          integrationSource: 'rms_cloud',
        };
      }
      case 'guests': {
        const g = record as RmsCloudGuest;
        return {
          externalId: g.GuestId, title: g.Title, firstName: g.FirstName,
          lastName: g.LastName, email: g.Email, phone: g.MobilePhone,
          address: g.Address, membershipNumber: g.MembershipNumber,
          membershipType: g.MembershipType, totalStays: g.TotalStays,
          totalSpent: g.TotalSpent, vehicleRegistration: g.VehicleRegistration,
          preferences: g.Preferences, marketingOptIn: g.MarketingOptIn,
          integrationSource: 'rms_cloud',
        };
      }
      case 'accounts': {
        const a = record as RmsCloudAccount;
        return {
          externalId: a.AccountId, reservationExternalId: a.ReservationId,
          guestExternalId: a.GuestId, type: a.Type, description: a.Description,
          amount: a.Amount, date: a.Date, paymentMethod: a.PaymentMethod,
          glCode: a.GLCode, status: a.Status, integrationSource: 'rms_cloud',
        };
      }
      case 'rates': {
        const r = record as RmsCloudRate;
        return {
          externalId: r.RateId, rateName: r.RateName, siteCategory: r.SiteCategory,
          dailyRate: r.DailyRate, weeklyRate: r.WeeklyRate, monthlyRate: r.MonthlyRate,
          seasonalRate: r.SeasonalRate, validFrom: r.ValidFrom, validTo: r.ValidTo,
          minStay: r.MinStay, maxStay: r.MaxStay, isActive: r.IsActive,
          integrationSource: 'rms_cloud',
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
        ? `/parks/${this.parkId}/reservations/${data.externalId}`
        : `/parks/${this.parkId}/reservations`;
      const method = data.externalId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest<{ ReservationId: string }>(
        endpoint, { method, body: data }
      );
      return { created: !data.externalId, updated: !!data.externalId, id: response.ReservationId };
    }
    return { created: false, updated: false };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options?: { method?: string; body?: any }
  ): Promise<T> {
    const accessToken = this.getCredential('accessToken');
    const apiKey = this.getCredential('apiKey');
    return this.makeRequest<T>(`${this.baseUrl}${endpoint}`, {
      method: options?.method || 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
