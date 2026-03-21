import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Guesty API (short-term rental PMS)
// Base: https://open-api.guesty.com/v1
// Auth: Bearer token via OAuth 2.0
// Entities: /listings, /reservations, /guests, /financials, /reviews
// Rate limit: 100 requests/minute

interface GuestyListing {
  _id: string;
  title: string;
  nickname: string;
  propertyType: 'apartment' | 'house' | 'condo' | 'townhouse' | 'villa' | 'cabin' | 'other';
  roomType: 'entire_home' | 'private_room' | 'shared_room';
  accommodates: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  address: {
    full: string;
    street: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
    lat: number;
    lng: number;
  };
  prices: { basePrice: number; weekendPrice?: number; cleaningFee?: number; currency: string };
  active: boolean;
  publishedAt?: string;
  channels: string[];
  amenities: string[];
  pictures: Array<{ url: string; caption?: string }>;
}

interface GuestyReservation {
  _id: string;
  listingId: string;
  guestId: string;
  confirmationCode: string;
  checkIn: string;
  checkOut: string;
  nightsCount: number;
  guestsCount: number;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'canceled' | 'inquiry' | 'reserved';
  source: string;
  channel: string;
  money: {
    totalPaid: number;
    balanceDue: number;
    hostPayout: number;
    fareAccommodation: number;
    fareCleaning: number;
    fareServiceFee?: number;
    currency: string;
  };
  notes?: string;
  createdAt: string;
}

interface GuestyGuest {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: { city?: string; state?: string; country?: string };
  tags: string[];
  verificationStatus: 'verified' | 'unverified' | 'pending';
  totalStays: number;
  totalSpent: number;
  averageRating?: number;
  createdAt: string;
}

interface GuestyFinancial {
  _id: string;
  reservationId: string;
  listingId: string;
  type: 'payout' | 'expense' | 'revenue' | 'refund' | 'adjustment';
  category: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  paymentMethod?: string;
}

interface GuestyReview {
  _id: string;
  reservationId: string;
  listingId: string;
  guestId: string;
  overallRating: number;
  cleanlinessRating?: number;
  communicationRating?: number;
  checkInRating?: number;
  accuracyRating?: number;
  locationRating?: number;
  valueRating?: number;
  publicReview?: string;
  privateReview?: string;
  hostResponse?: string;
  createdAt: string;
}

export class GuestyConnector extends BaseConnector {
  private baseUrl = 'https://open-api.guesty.com/v1';

  constructor(config: ConnectorConfig) {
    super(config);
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ results: any[]; count: number }>(
        '/listings?limit=1'
      );
      return {
        connected: true,
        message: `Connected to Guesty - ${response.count || 0} listings found`,
        details: { listingCount: response.count },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'listings', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'reservations', targetEntity: 'reservations', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 50 },
      { sourceEntity: 'guests', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'financials', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'reviews', targetEntity: 'reviews', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const sinceParam = options?.since ? `&updatedSince=${options.since.toISOString()}` : '';

    const endpointMap: Record<string, string> = {
      listings: '/listings',
      reservations: '/reservations',
      guests: '/guests',
      financials: '/financials/transactions',
      reviews: '/reviews',
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ results: any[]; count: number; limit: number }>(
      `${endpoint}?limit=${limit}&skip=${offset}${sinceParam}`
    );

    const records = response.results || [];
    const total = response.count || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: offset + records.length < total, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'listings': {
        const l = record as GuestyListing;
        return {
          externalId: l._id, title: l.title, nickname: l.nickname,
          propertyType: l.propertyType, roomType: l.roomType, accommodates: l.accommodates,
          bedrooms: l.bedrooms, bathrooms: l.bathrooms, beds: l.beds,
          address: l.address, basePrice: l.prices?.basePrice,
          weekendPrice: l.prices?.weekendPrice, cleaningFee: l.prices?.cleaningFee,
          currency: l.prices?.currency, active: l.active, channels: l.channels,
          amenities: l.amenities, integrationSource: 'guesty',
        };
      }
      case 'reservations': {
        const r = record as GuestyReservation;
        return {
          externalId: r._id, listingExternalId: r.listingId, guestExternalId: r.guestId,
          confirmationCode: r.confirmationCode, checkIn: r.checkIn, checkOut: r.checkOut,
          nights: r.nightsCount, guests: r.guestsCount, status: r.status,
          source: r.source, channel: r.channel,
          totalPaid: r.money?.totalPaid, balanceDue: r.money?.balanceDue,
          hostPayout: r.money?.hostPayout, accommodationFare: r.money?.fareAccommodation,
          cleaningFare: r.money?.fareCleaning, currency: r.money?.currency,
          notes: r.notes, integrationSource: 'guesty',
        };
      }
      case 'guests': {
        const g = record as GuestyGuest;
        return {
          externalId: g._id, firstName: g.firstName, lastName: g.lastName,
          email: g.email, phone: g.phone, address: g.address,
          tags: g.tags, verificationStatus: g.verificationStatus,
          totalStays: g.totalStays, totalSpent: g.totalSpent,
          averageRating: g.averageRating, integrationSource: 'guesty',
        };
      }
      case 'financials': {
        const f = record as GuestyFinancial;
        return {
          externalId: f._id, reservationExternalId: f.reservationId,
          listingExternalId: f.listingId, type: f.type, category: f.category,
          amount: f.amount, currency: f.currency, date: f.date,
          description: f.description, status: f.status,
          paymentMethod: f.paymentMethod, integrationSource: 'guesty',
        };
      }
      case 'reviews': {
        const rv = record as GuestyReview;
        return {
          externalId: rv._id, reservationExternalId: rv.reservationId,
          listingExternalId: rv.listingId, guestExternalId: rv.guestId,
          overallRating: rv.overallRating, cleanlinessRating: rv.cleanlinessRating,
          communicationRating: rv.communicationRating, checkInRating: rv.checkInRating,
          accuracyRating: rv.accuracyRating, locationRating: rv.locationRating,
          valueRating: rv.valueRating, publicReview: rv.publicReview,
          privateReview: rv.privateReview, hostResponse: rv.hostResponse,
          integrationSource: 'guesty',
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
        ? `/reservations/${data.externalId}`
        : '/reservations';
      const method = data.externalId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest<{ _id: string }>(
        endpoint, { method, body: data }
      );
      return { created: !data.externalId, updated: !!data.externalId, id: response._id };
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
