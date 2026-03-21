import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Cloudbeds API (hotel/STR PMS)
// Base: https://api.cloudbeds.com/api/v1.2
// Auth: OAuth 2.0 Bearer token
// Entities: /getReservations, /getGuests, /getRooms, /getTransactions, /getHousekeepingStatus
// Rate limit: 150 requests/minute

interface CloudbedsReservation {
  reservationID: string;
  propertyID: string;
  guestID: string;
  roomID: string;
  roomTypeName: string;
  startDate: string;
  endDate: string;
  adults: number;
  children: number;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'canceled' | 'no_show';
  source: string;
  totalAmount: number;
  balanceDue: number;
  currency: string;
  notes?: string;
  specialRequests?: string;
  ratePlanName: string;
}

interface CloudbedsGuest {
  guestID: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  guestCountry?: string;
  guestCity?: string;
  guestState?: string;
  guestZip?: string;
  guestAddress?: string;
  guestDocumentType?: string;
  guestDocumentNumber?: string;
  isMainGuest: boolean;
  totalStays: number;
}

interface CloudbedsRoom {
  roomID: string;
  roomName: string;
  roomTypeName: string;
  roomDescription: string;
  maxGuests: number;
  isPrivate: boolean;
  roomStatus: 'available' | 'occupied' | 'out_of_service' | 'blocked';
  housekeepingStatus: 'clean' | 'dirty' | 'inspected';
  roomRate: number;
  roomFloor?: string;
  roomAmenities: string[];
}

interface CloudbedsTransaction {
  transactionID: string;
  reservationID: string;
  guestID: string;
  transactionType: 'charge' | 'payment' | 'refund' | 'adjustment';
  category: string;
  description: string;
  amount: number;
  currency: string;
  transactionDate: string;
  paymentMethod?: string;
  status: 'posted' | 'pending' | 'void';
}

interface CloudbedsHousekeeping {
  roomID: string;
  roomName: string;
  housekeepingStatus: 'clean' | 'dirty' | 'inspected' | 'out_of_order';
  assignedTo?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  doNotDisturb: boolean;
  lastCleaned?: string;
  notes?: string;
}

export class CloudbedsConnector extends BaseConnector {
  private baseUrl = 'https://api.cloudbeds.com/api/v1.2';
  private propertyId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.propertyId = this.getCredential('siteId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ success: boolean; data: { propertyName: string; propertyID: string } }>(
        '/getHotelDetails'
      );
      return {
        connected: true,
        message: `Connected to Cloudbeds - ${response.data?.propertyName || 'Unknown'}`,
        details: { propertyName: response.data?.propertyName },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'reservations', targetEntity: 'reservations', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 50 },
      { sourceEntity: 'guests', targetEntity: 'contacts', targetModule: 'crm', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'rooms', targetEntity: 'units', targetModule: 'operations', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'transactions', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 200 },
      { sourceEntity: 'housekeeping', targetEntity: 'housekeeping', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const endpointMap: Record<string, string> = {
      reservations: '/getReservations',
      guests: '/getGuestList',
      rooms: '/getRooms',
      transactions: '/getTransactions',
      housekeeping: '/getHousekeepingStatus',
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const params: Record<string, string> = {
      propertyID: this.propertyId,
      pageSize: String(limit),
      pageNumber: String(Math.floor(offset / limit) + 1),
    };
    if (options?.since) params.modifiedFrom = options.since.toISOString().split('T')[0];

    const queryString = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

    const response = await this.makeAuthenticatedRequest<{ success: boolean; data: any[]; count: number; total: number }>(
      `${endpoint}?${queryString}`
    );

    const records = Array.isArray(response.data) ? response.data : [];
    const total = response.total || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: offset + records.length < total, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'reservations': {
        const r = record as CloudbedsReservation;
        return {
          externalId: r.reservationID, guestExternalId: r.guestID, roomExternalId: r.roomID,
          roomType: r.roomTypeName, startDate: r.startDate, endDate: r.endDate,
          adults: r.adults, children: r.children, status: r.status, source: r.source,
          totalAmount: r.totalAmount, balanceDue: r.balanceDue, currency: r.currency,
          ratePlan: r.ratePlanName, notes: r.notes, integrationSource: 'cloudbeds',
        };
      }
      case 'guests': {
        const g = record as CloudbedsGuest;
        return {
          externalId: g.guestID, firstName: g.guestFirstName, lastName: g.guestLastName,
          email: g.guestEmail, phone: g.guestPhone, country: g.guestCountry,
          city: g.guestCity, state: g.guestState, zip: g.guestZip,
          address: g.guestAddress, isMainGuest: g.isMainGuest,
          totalStays: g.totalStays, integrationSource: 'cloudbeds',
        };
      }
      case 'rooms': {
        const rm = record as CloudbedsRoom;
        return {
          externalId: rm.roomID, roomName: rm.roomName, roomType: rm.roomTypeName,
          description: rm.roomDescription, maxGuests: rm.maxGuests, isPrivate: rm.isPrivate,
          status: rm.roomStatus, housekeepingStatus: rm.housekeepingStatus,
          rate: rm.roomRate, floor: rm.roomFloor, amenities: rm.roomAmenities,
          integrationSource: 'cloudbeds',
        };
      }
      case 'transactions': {
        const t = record as CloudbedsTransaction;
        return {
          externalId: t.transactionID, reservationExternalId: t.reservationID,
          guestExternalId: t.guestID, type: t.transactionType, category: t.category,
          description: t.description, amount: t.amount, currency: t.currency,
          date: t.transactionDate, paymentMethod: t.paymentMethod, status: t.status,
          integrationSource: 'cloudbeds',
        };
      }
      case 'housekeeping': {
        const h = record as CloudbedsHousekeeping;
        return {
          roomExternalId: h.roomID, roomName: h.roomName, status: h.housekeepingStatus,
          assignedTo: h.assignedTo, priority: h.priority, doNotDisturb: h.doNotDisturb,
          lastCleaned: h.lastCleaned, notes: h.notes, integrationSource: 'cloudbeds',
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
      const endpoint = data.externalId ? '/putReservation' : '/postReservation';
      const method = data.externalId ? 'PUT' : 'POST';
      const response = await this.makeAuthenticatedRequest<{ success: boolean; data: { reservationID: string } }>(
        endpoint, { method, body: data }
      );
      return { created: !data.externalId, updated: !!data.externalId, id: response.data?.reservationID };
    }
    if (entityType === 'housekeeping') {
      await this.makeAuthenticatedRequest<{ success: boolean }>(
        '/putHousekeepingStatus', { method: 'PUT', body: data }
      );
      return { created: false, updated: true, id: data.roomExternalId };
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
