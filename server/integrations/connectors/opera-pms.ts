import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Oracle OPERA PMS API endpoints (hotel)
// Base: https://{host}/opera/v1
// Auth: OAuth 2.0 client credentials with x-app-key
// Entities: /reservations, /guests, /rooms, /folios, /housekeeping
// Rate limit: 200 requests/minute

interface OperaReservation {
  reservationId: string;
  confirmationNumber: string;
  guestId: string;
  roomId?: string;
  roomType: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  rateCode: string;
  rateAmount: number;
  totalAmount: number;
  status: 'reserved' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  channel: string;
  specialRequests?: string[];
  guaranteeType?: string;
}

interface OperaGuest {
  guestId: string;
  profileType: 'individual' | 'company' | 'travel_agent' | 'group';
  title?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality?: string;
  vipStatus?: string;
  membershipLevel?: string;
  membershipNumber?: string;
  totalStays: number;
  totalRevenue: number;
  preferences: Array<{ category: string; value: string }>;
}

interface OperaRoom {
  roomId: string;
  roomNumber: string;
  roomType: string;
  roomClass: string;
  floor: number;
  bedType: string;
  maxOccupancy: number;
  status: 'clean' | 'dirty' | 'inspected' | 'out_of_order' | 'out_of_service';
  occupancyStatus: 'vacant' | 'occupied';
  isSmokingAllowed: boolean;
  connectingRooms?: string[];
  features: string[];
}

interface OperaFolio {
  folioId: string;
  reservationId: string;
  guestId: string;
  folioNumber: string;
  windowNumber: number;
  charges: Array<{
    transactionId: string;
    transactionCode: string;
    description: string;
    amount: number;
    date: string;
    type: 'charge' | 'payment' | 'adjustment';
  }>;
  balance: number;
  status: 'open' | 'settled' | 'void';
}

interface OperaHousekeeping {
  roomId: string;
  roomNumber: string;
  status: 'clean' | 'dirty' | 'pickup' | 'inspected' | 'out_of_order';
  assignedTo?: string;
  priority: 'normal' | 'vip' | 'rush' | 'departure' | 'arrival';
  inspectedBy?: string;
  inspectedAt?: string;
  notes?: string;
  taskType: 'daily' | 'checkout' | 'deep_clean' | 'turndown';
}

export class OperaPmsConnector extends BaseConnector {
  private baseUrl: string;
  private hotelId: string;
  private appKey: string;

  constructor(config: ConnectorConfig) {
    super(config);
    const host = this.getSetting('host', 'api.oracle-hospitality.com');
    this.baseUrl = `https://${host}/opera/v1`;
    this.hotelId = this.getCredential('siteId');
    this.appKey = this.getCredential('apiKey');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ hotel: { hotelName: string; hotelId: string; roomCount: number } }>(
        `/hotels/${this.hotelId}`
      );
      return {
        connected: true,
        message: `Connected to OPERA PMS - ${response.hotel?.hotelName || 'Unknown Hotel'}`,
        details: { hotelName: response.hotel?.hotelName, roomCount: response.hotel?.roomCount },
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
      { sourceEntity: 'folios', targetEntity: 'transactions', targetModule: 'accounting', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'housekeeping', targetEntity: 'housekeeping', targetModule: 'operations', syncDirection: 'bidirectional', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;
    const sinceParam = options?.since ? `&lastModified=${options.since.toISOString()}` : '';

    const endpointMap: Record<string, string> = {
      reservations: `/hotels/${this.hotelId}/reservations`,
      guests: `/hotels/${this.hotelId}/guests`,
      rooms: `/hotels/${this.hotelId}/rooms`,
      folios: `/hotels/${this.hotelId}/folios`,
      housekeeping: `/hotels/${this.hotelId}/housekeeping`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    const response = await this.makeAuthenticatedRequest<{ results: any[]; count: number; hasMore: boolean }>(
      `${endpoint}?limit=${limit}&offset=${offset}${sinceParam}`
    );

    const records = response.results || [];
    const total = response.count || records.length;
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: response.hasMore || false, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'reservations': {
        const r = record as OperaReservation;
        return {
          externalId: r.reservationId, confirmationNumber: r.confirmationNumber,
          guestExternalId: r.guestId, roomExternalId: r.roomId, roomType: r.roomType,
          arrivalDate: r.arrivalDate, departureDate: r.departureDate,
          adults: r.adults, children: r.children, rateCode: r.rateCode,
          rateAmount: r.rateAmount, totalAmount: r.totalAmount, status: r.status,
          channel: r.channel, specialRequests: r.specialRequests,
          integrationSource: 'opera_pms',
        };
      }
      case 'guests': {
        const g = record as OperaGuest;
        return {
          externalId: g.guestId, profileType: g.profileType, title: g.title,
          firstName: g.firstName, lastName: g.lastName, email: g.email,
          phone: g.phone, nationality: g.nationality, vipStatus: g.vipStatus,
          membershipLevel: g.membershipLevel, membershipNumber: g.membershipNumber,
          totalStays: g.totalStays, totalRevenue: g.totalRevenue,
          preferences: g.preferences, integrationSource: 'opera_pms',
        };
      }
      case 'rooms': {
        const rm = record as OperaRoom;
        return {
          externalId: rm.roomId, roomNumber: rm.roomNumber, roomType: rm.roomType,
          roomClass: rm.roomClass, floor: rm.floor, bedType: rm.bedType,
          maxOccupancy: rm.maxOccupancy, status: rm.status,
          occupancyStatus: rm.occupancyStatus, features: rm.features,
          integrationSource: 'opera_pms',
        };
      }
      case 'folios': {
        const f = record as OperaFolio;
        return {
          externalId: f.folioId, reservationExternalId: f.reservationId,
          guestExternalId: f.guestId, folioNumber: f.folioNumber,
          windowNumber: f.windowNumber, charges: f.charges,
          balance: f.balance, status: f.status, integrationSource: 'opera_pms',
        };
      }
      case 'housekeeping': {
        const h = record as OperaHousekeeping;
        return {
          roomExternalId: h.roomId, roomNumber: h.roomNumber, status: h.status,
          assignedTo: h.assignedTo, priority: h.priority, taskType: h.taskType,
          inspectedBy: h.inspectedBy, inspectedAt: h.inspectedAt,
          notes: h.notes, integrationSource: 'opera_pms',
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
        ? `/hotels/${this.hotelId}/reservations/${data.externalId}`
        : `/hotels/${this.hotelId}/reservations`;
      const method = data.externalId ? 'PUT' : 'POST';

      const response = await this.makeAuthenticatedRequest<{ reservationId: string }>(endpoint, { method, body: data });
      return { created: !data.externalId, updated: !!data.externalId, id: response.reservationId };
    }
    if (entityType === 'housekeeping') {
      await this.makeAuthenticatedRequest<void>(
        `/hotels/${this.hotelId}/rooms/${data.roomExternalId}/housekeeping`,
        { method: 'PUT', body: { status: data.status, notes: data.notes } }
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
        'x-app-key': this.appKey,
        'x-hotelid': this.hotelId,
        'Accept': 'application/json',
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
