import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// OwnerRez API (short-term rental)
// Base: https://api.ownerrez.com/v2
// Auth: Basic auth (username = email, password = API token)
// Entities: /properties, /bookings, /guests, /financials, /channels
// Rate limit: 120 requests/minute

interface OwnerRezProperty {
  id: number;
  name: string;
  headline: string;
  property_type: 'house' | 'apartment' | 'condo' | 'cabin' | 'cottage' | 'rv' | 'tent';
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  address: {
    line1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  base_rate: number;
  cleaning_fee: number;
  tax_rate: number;
  currency: string;
  active: boolean;
  channels: string[];
  check_in_time: string;
  check_out_time: string;
  min_stay: number;
}

interface OwnerRezBooking {
  id: number;
  property_id: number;
  guest_id: number;
  channel: string;
  channel_booking_id?: string;
  arrival: string;
  departure: string;
  nights: number;
  adults: number;
  children: number;
  pets: number;
  subtotal: number;
  taxes: number;
  fees: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  currency: string;
  status: 'confirmed' | 'provisional' | 'cancelled' | 'declined' | 'closed';
  notes?: string;
  created_at: string;
}

interface OwnerRezGuest {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address?: {
    line1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  total_bookings: number;
  total_spent: number;
  is_blocked: boolean;
  notes?: string;
  created_at: string;
}

interface OwnerRezFinancial {
  id: number;
  booking_id: number;
  type: 'charge' | 'payment' | 'refund' | 'payout' | 'fee';
  category: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  payment_method?: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
}

interface OwnerRezChannel {
  id: number;
  property_id: number;
  channel_name: string;
  listing_url: string;
  listing_id: string;
  sync_enabled: boolean;
  last_sync_at?: string;
  sync_status: 'active' | 'error' | 'paused';
}

export class OwnerRezConnector extends BaseConnector {
  private baseUrl = 'https://api.ownerrez.com/v2';

  constructor(config: ConnectorConfig) {
    super(config);
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ items: any[]; total_count: number }>(
        '/properties?limit=1'
      );
      return {
        connected: true,
        message: `Connected to OwnerRez - ${response.total_count || 0} properties found`,
        details: { propertyCount: response.total_count },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'properties', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'bookings', targetEntity: 'reservations', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 50 },
      { sourceEntity: 'guests', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'financials', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'channels', targetEntity: 'channels', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const sinceParam = options?.since ? `&since=${options.since.toISOString()}` : '';

    const endpointMap: Record<string, string> = {
      properties: '/properties',
      bookings: '/bookings',
      guests: '/guests',
      financials: '/financials',
      channels: '/channels',
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ items: any[]; total_count: number }>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = response.items || [];
    const total = response.total_count || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: offset + records.length < total, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'properties': {
        const p = record as OwnerRezProperty;
        return {
          externalId: String(p.id), name: p.name, headline: p.headline,
          propertyType: p.property_type, bedrooms: p.bedrooms, bathrooms: p.bathrooms,
          maxGuests: p.max_guests, address: p.address, baseRate: p.base_rate,
          cleaningFee: p.cleaning_fee, taxRate: p.tax_rate, currency: p.currency,
          active: p.active, channels: p.channels, checkInTime: p.check_in_time,
          checkOutTime: p.check_out_time, minStay: p.min_stay,
          integrationSource: 'ownerrez',
        };
      }
      case 'bookings': {
        const b = record as OwnerRezBooking;
        return {
          externalId: String(b.id), propertyExternalId: String(b.property_id),
          guestExternalId: String(b.guest_id), channel: b.channel,
          channelBookingId: b.channel_booking_id, arrival: b.arrival,
          departure: b.departure, nights: b.nights, adults: b.adults,
          children: b.children, pets: b.pets, subtotal: b.subtotal,
          taxes: b.taxes, fees: b.fees, total: b.total,
          amountPaid: b.amount_paid, balanceDue: b.balance_due,
          currency: b.currency, status: b.status, notes: b.notes,
          integrationSource: 'ownerrez',
        };
      }
      case 'guests': {
        const g = record as OwnerRezGuest;
        return {
          externalId: String(g.id), firstName: g.first_name, lastName: g.last_name,
          email: g.email, phone: g.phone, address: g.address,
          totalBookings: g.total_bookings, totalSpent: g.total_spent,
          isBlocked: g.is_blocked, notes: g.notes, integrationSource: 'ownerrez',
        };
      }
      case 'financials': {
        const f = record as OwnerRezFinancial;
        return {
          externalId: String(f.id), bookingExternalId: String(f.booking_id),
          type: f.type, category: f.category, description: f.description,
          amount: f.amount, currency: f.currency, date: f.date,
          paymentMethod: f.payment_method, status: f.status,
          integrationSource: 'ownerrez',
        };
      }
      case 'channels': {
        const c = record as OwnerRezChannel;
        return {
          externalId: String(c.id), propertyExternalId: String(c.property_id),
          channelName: c.channel_name, listingUrl: c.listing_url,
          listingId: c.listing_id, syncEnabled: c.sync_enabled,
          lastSyncAt: c.last_sync_at, syncStatus: c.sync_status,
          integrationSource: 'ownerrez',
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
    if (entityType === 'reservations' || entityType === 'bookings') {
      const endpoint = data.externalId ? `/bookings/${data.externalId}` : '/bookings';
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
    const email = this.getCredential('apiKey');
    const token = this.getCredential('apiSecret');
    const credentials = Buffer.from(`${email}:${token}`).toString('base64');

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
