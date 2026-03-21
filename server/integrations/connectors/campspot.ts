import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Campspot API (RV park / campground PMS)
// Base: https://api.campspot.com/v1
// Auth: API key in X-Api-Key header
// Entities: /sites, /reservations, /guests, /payments, /availability
// Rate limit: 60 requests/minute

interface CampspotSite {
  siteId: string;
  campgroundId: string;
  siteName: string;
  siteNumber: string;
  siteType: 'rv_full' | 'rv_partial' | 'tent' | 'cabin' | 'glamping' | 'yurt' | 'treehouse' | 'lodging';
  maxLength: number;
  maxWidth: number;
  hookups: {
    electric: '30amp' | '50amp' | '30_50amp' | 'none';
    water: boolean;
    sewer: boolean;
  };
  amenities: string[];
  dailyRate: number;
  weeklyRate?: number;
  monthlyRate?: number;
  seasonalRate?: number;
  status: 'available' | 'reserved' | 'occupied' | 'maintenance' | 'seasonal';
  maxOccupants: number;
  petsAllowed: boolean;
  slideOutFriendly: boolean;
  isWaterfront: boolean;
}

interface CampspotReservation {
  reservationId: string;
  siteId: string;
  guestId: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  adults: number;
  children: number;
  pets: number;
  vehicles: Array<{ type: string; length: number; licensePlate?: string }>;
  totalAmount: number;
  depositPaid: number;
  balanceDue: number;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'pending' | 'waitlisted';
  source: 'website' | 'phone' | 'walk_in' | 'ota' | 'returning';
  specialRequests?: string;
  addOns: Array<{ name: string; quantity: number; price: number }>;
  createdAt: string;
}

interface CampspotGuest {
  guestId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  membershipLevel?: string;
  totalStays: number;
  totalSpent: number;
  vehicleInfo?: { type: string; make: string; model: string; length: number };
  emergencyContact?: { name: string; phone: string };
  preferences: string[];
}

interface CampspotPayment {
  paymentId: string;
  reservationId: string;
  guestId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'credit_card' | 'cash' | 'check' | 'gift_card' | 'loyalty_points';
  status: 'completed' | 'pending' | 'refunded' | 'failed';
  transactionId?: string;
  description: string;
}

export class CampspotConnector extends BaseConnector {
  private baseUrl = 'https://api.campspot.com/v1';
  private campgroundId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.campgroundId = this.getCredential('siteId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ campground: { name: string; id: string; siteCount: number } }>(
        `/campgrounds/${this.campgroundId}`
      );
      return {
        connected: true,
        message: `Connected to Campspot - ${response.campground?.name || 'Unknown'}`,
        details: { campgroundName: response.campground?.name, siteCount: response.campground?.siteCount },
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
      { sourceEntity: 'payments', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
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
      sites: `/campgrounds/${this.campgroundId}/sites`,
      reservations: `/campgrounds/${this.campgroundId}/reservations`,
      guests: `/campgrounds/${this.campgroundId}/guests`,
      payments: `/campgrounds/${this.campgroundId}/payments`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ data: any[]; pagination: { total: number; hasMore: boolean } }>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = response.data || [];
    const total = response.pagination?.total || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: response.pagination?.hasMore || false, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'sites': {
        const s = record as CampspotSite;
        return {
          externalId: s.siteId, siteName: s.siteName, siteNumber: s.siteNumber,
          siteType: s.siteType, maxLength: s.maxLength, maxWidth: s.maxWidth,
          hookups: s.hookups, amenities: s.amenities, dailyRate: s.dailyRate,
          weeklyRate: s.weeklyRate, monthlyRate: s.monthlyRate,
          status: s.status, maxOccupants: s.maxOccupants, petsAllowed: s.petsAllowed,
          slideOutFriendly: s.slideOutFriendly, isWaterfront: s.isWaterfront,
          integrationSource: 'campspot',
        };
      }
      case 'reservations': {
        const r = record as CampspotReservation;
        return {
          externalId: r.reservationId, siteExternalId: r.siteId, guestExternalId: r.guestId,
          arrivalDate: r.arrivalDate, departureDate: r.departureDate, nights: r.nights,
          adults: r.adults, children: r.children, pets: r.pets, vehicles: r.vehicles,
          totalAmount: r.totalAmount, depositPaid: r.depositPaid, balanceDue: r.balanceDue,
          status: r.status, source: r.source, specialRequests: r.specialRequests,
          addOns: r.addOns, integrationSource: 'campspot',
        };
      }
      case 'guests': {
        const g = record as CampspotGuest;
        return {
          externalId: g.guestId, firstName: g.firstName, lastName: g.lastName,
          email: g.email, phone: g.phone, address: g.address,
          membershipLevel: g.membershipLevel, totalStays: g.totalStays,
          totalSpent: g.totalSpent, vehicleInfo: g.vehicleInfo,
          emergencyContact: g.emergencyContact, preferences: g.preferences,
          integrationSource: 'campspot',
        };
      }
      case 'payments': {
        const p = record as CampspotPayment;
        return {
          externalId: p.paymentId, reservationExternalId: p.reservationId,
          guestExternalId: p.guestId, amount: p.amount, paymentDate: p.paymentDate,
          paymentMethod: p.paymentMethod, status: p.status,
          transactionId: p.transactionId, description: p.description,
          integrationSource: 'campspot',
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
        ? `/campgrounds/${this.campgroundId}/reservations/${data.externalId}`
        : `/campgrounds/${this.campgroundId}/reservations`;
      const method = data.externalId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest<{ reservationId: string }>(
        endpoint, { method, body: data }
      );
      return { created: !data.externalId, updated: !!data.externalId, id: response.reservationId };
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
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
