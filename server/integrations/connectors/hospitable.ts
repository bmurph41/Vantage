import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Hospitable (formerly Smartbnb) API (STR automation)
// Base: https://api.hospitable.com/v1
// Auth: Bearer token
// Entities: /properties, /reservations, /guests, /messages, /reviews
// Rate limit: 60 requests/minute

interface HospitableProperty {
  id: string;
  name: string;
  nickname: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  propertyType: 'apartment' | 'house' | 'condo' | 'cabin' | 'villa' | 'studio';
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  channels: Array<{ name: string; listingId: string; active: boolean }>;
  cleaningFee: number;
  baseRate: number;
  currency: string;
  status: 'active' | 'inactive' | 'unlisted';
  automationEnabled: boolean;
}

interface HospitableReservation {
  id: string;
  propertyId: string;
  guestId: string;
  channel: string;
  channelReservationId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  totalAmount: number;
  payoutAmount: number;
  currency: string;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'canceled' | 'pending';
  autoMessagingEnabled: boolean;
  specialRequests?: string;
  createdAt: string;
}

interface HospitableGuest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  channel: string;
  verificationStatus: 'verified' | 'unverified';
  previousStays: number;
  averageRating?: number;
  language?: string;
  country?: string;
  tags: string[];
}

interface HospitableMessage {
  id: string;
  reservationId: string;
  guestId: string;
  direction: 'inbound' | 'outbound';
  channel: string;
  content: string;
  type: 'manual' | 'automated' | 'template';
  templateName?: string;
  sentAt: string;
  readAt?: string;
  deliveryStatus: 'sent' | 'delivered' | 'failed' | 'read';
}

interface HospitableReview {
  id: string;
  reservationId: string;
  propertyId: string;
  guestId: string;
  rating: number;
  reviewText?: string;
  hostResponseText?: string;
  channel: string;
  createdAt: string;
  isPublic: boolean;
}

export class HospitableConnector extends BaseConnector {
  private baseUrl = 'https://api.hospitable.com/v1';

  constructor(config: ConnectorConfig) {
    super(config);
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ data: any[]; meta: { total: number } }>(
        '/properties?limit=1'
      );
      return {
        connected: true,
        message: `Connected to Hospitable - ${response.meta?.total || 0} properties found`,
        details: { propertyCount: response.meta?.total },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'properties', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'reservations', targetEntity: 'reservations', targetModule: 'operations', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'guests', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'messages', targetEntity: 'messages', targetModule: 'crm', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'reviews', targetEntity: 'reviews', targetModule: 'operations', syncDirection: 'read', batchSize: 100 },
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
      reservations: '/reservations',
      guests: '/guests',
      messages: '/messages',
      reviews: '/reviews',
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ data: any[]; meta: { total: number; hasMore: boolean } }>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = response.data || [];
    const total = response.meta?.total || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: response.meta?.hasMore || false, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'properties': {
        const p = record as HospitableProperty;
        return {
          externalId: p.id, name: p.name, nickname: p.nickname, address: p.address,
          propertyType: p.propertyType, bedrooms: p.bedrooms, bathrooms: p.bathrooms,
          maxGuests: p.maxGuests, channels: p.channels, cleaningFee: p.cleaningFee,
          baseRate: p.baseRate, currency: p.currency, status: p.status,
          automationEnabled: p.automationEnabled, integrationSource: 'hospitable',
        };
      }
      case 'reservations': {
        const r = record as HospitableReservation;
        return {
          externalId: r.id, propertyExternalId: r.propertyId, guestExternalId: r.guestId,
          channel: r.channel, channelReservationId: r.channelReservationId,
          checkIn: r.checkIn, checkOut: r.checkOut, nights: r.nights,
          guests: r.guests, totalAmount: r.totalAmount, payoutAmount: r.payoutAmount,
          currency: r.currency, status: r.status, specialRequests: r.specialRequests,
          integrationSource: 'hospitable',
        };
      }
      case 'guests': {
        const g = record as HospitableGuest;
        return {
          externalId: g.id, firstName: g.firstName, lastName: g.lastName,
          email: g.email, phone: g.phone, channel: g.channel,
          verificationStatus: g.verificationStatus, previousStays: g.previousStays,
          averageRating: g.averageRating, language: g.language,
          country: g.country, tags: g.tags, integrationSource: 'hospitable',
        };
      }
      case 'messages': {
        const m = record as HospitableMessage;
        return {
          externalId: m.id, reservationExternalId: m.reservationId,
          guestExternalId: m.guestId, direction: m.direction, channel: m.channel,
          content: m.content, type: m.type, templateName: m.templateName,
          sentAt: m.sentAt, readAt: m.readAt, deliveryStatus: m.deliveryStatus,
          integrationSource: 'hospitable',
        };
      }
      case 'reviews': {
        const rv = record as HospitableReview;
        return {
          externalId: rv.id, reservationExternalId: rv.reservationId,
          propertyExternalId: rv.propertyId, guestExternalId: rv.guestId,
          rating: rv.rating, reviewText: rv.reviewText,
          hostResponseText: rv.hostResponseText, channel: rv.channel,
          isPublic: rv.isPublic, integrationSource: 'hospitable',
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
    // Hospitable is primarily read-only; messages can be sent via webhook
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
