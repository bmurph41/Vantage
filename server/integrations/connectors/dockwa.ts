import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

const DOCKWA_API_URL = 'https://api.dockwa.com/v1';

interface DockwaSlip {
  id: string;
  name: string;
  dock_name: string;
  length: number;
  width: number;
  depth: number;
  status: 'available' | 'occupied' | 'maintenance';
  rate_daily?: number;
  rate_weekly?: number;
  rate_monthly?: number;
  rate_seasonal?: number;
  rate_annual?: number;
  amenities?: string[];
  power_type?: string;
  water_available?: boolean;
}

interface DockwaReservation {
  id: string;
  slip_id: string;
  slip_name: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  vessel: {
    name: string;
    length: number;
    beam: number;
    draft: number;
    type: string;
  };
  check_in: string;
  check_out: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'checked_in' | 'checked_out';
  total_amount: number;
  created_at: string;
}

interface DockwaCustomer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  vessels: Array<{
    id: string;
    name: string;
    length: number;
    beam: number;
    type: string;
  }>;
  lifetime_revenue: number;
  total_stays: number;
  created_at: string;
}

export class DockwaConnector extends BaseConnector {
  private apiKey: string;
  private marinaId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.apiKey = this.getCredential('apiKey');
    this.marinaId = this.getCredential('marinaId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ marina: { name: string; id: string } }>(
        `/marinas/${this.marinaId}`
      );

      return {
        connected: true,
        message: `Connected to ${response.marina?.name || 'Dockwa Marina'}`,
        details: {
          marinaName: response.marina?.name,
          marinaId: response.marina?.id,
        },
      };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      {
        sourceEntity: 'slips',
        targetEntity: 'storageLocations',
        targetModule: 'rentRoll',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'reservations',
        targetEntity: 'leases',
        targetModule: 'rentRoll',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'customers',
        targetEntity: 'tenants',
        targetModule: 'rentRoll',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'customers',
        targetEntity: 'contacts',
        targetModule: 'crm',
        syncDirection: 'read',
        batchSize: 100,
      },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    switch (entityType) {
      case 'slips':
        return this.fetchSlips(options);
      case 'reservations':
        return this.fetchReservations(options);
      case 'customers':
        return this.fetchCustomers(options);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async fetchSlips(options?: { limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const response = await this.makeAuthenticatedRequest<{ slips: DockwaSlip[]; meta: { total: number } }>(
      `/marinas/${this.marinaId}/slips`,
      { limit: limit.toString(), offset: offset.toString() }
    );

    const slips = response.slips || [];
    const total = response.meta?.total || slips.length;

    const transformed = slips.map(slip => ({
      externalId: slip.id,
      name: slip.name,
      code: slip.name,
      description: `${slip.dock_name} - ${slip.length}' x ${slip.width}'`,
      storageType: 'wet_slip',
      lengthFeet: slip.length,
      widthFeet: slip.width,
      depthFeet: slip.depth,
      capacity: 1,
      postedRate: slip.rate_monthly?.toString(),
      postedRateType: 'monthly',
      isActive: slip.status !== 'maintenance',
      amenities: slip.amenities,
      powerType: slip.power_type,
      waterAvailable: slip.water_available,
      integrationSource: 'dockwa',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + slips.length < total,
      total,
    };
  }

  private async fetchReservations(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      limit: limit.toString(),
      offset: offset.toString(),
    };

    if (options?.since) {
      params.since = options.since.toISOString();
    }

    const response = await this.makeAuthenticatedRequest<{ reservations: DockwaReservation[]; meta: { total: number } }>(
      `/marinas/${this.marinaId}/reservations`,
      params
    );

    const reservations = response.reservations || [];
    const total = response.meta?.total || reservations.length;

    const transformed = reservations.map(res => ({
      externalId: res.id,
      tenantExternalId: res.customer.id,
      locationExternalId: res.slip_id,
      tenantName: `${res.customer.first_name} ${res.customer.last_name}`,
      tenantEmail: res.customer.email,
      tenantPhone: res.customer.phone,
      vesselName: res.vessel.name,
      vesselLength: res.vessel.length,
      vesselBeam: res.vessel.beam,
      vesselDraft: res.vessel.draft,
      vesselType: res.vessel.type,
      startDate: res.check_in,
      endDate: res.check_out,
      status: this.mapReservationStatus(res.status),
      totalAmount: res.total_amount,
      createdAt: res.created_at,
      integrationSource: 'dockwa',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + reservations.length < total,
      total,
    };
  }

  private async fetchCustomers(options?: { limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const response = await this.makeAuthenticatedRequest<{ customers: DockwaCustomer[]; meta: { total: number } }>(
      `/marinas/${this.marinaId}/customers`,
      { limit: limit.toString(), offset: offset.toString() }
    );

    const customers = response.customers || [];
    const total = response.meta?.total || customers.length;

    const transformed = customers.map(cust => ({
      externalId: cust.id,
      firstName: cust.first_name,
      lastName: cust.last_name,
      displayName: `${cust.first_name} ${cust.last_name}`,
      email: cust.email,
      phone: cust.phone,
      address: cust.address ? {
        street: cust.address.street,
        city: cust.address.city,
        state: cust.address.state,
        zip: cust.address.zip,
        country: cust.address.country,
      } : null,
      vessels: cust.vessels,
      lifetimeRevenue: cust.lifetime_revenue,
      totalStays: cust.total_stays,
      createdAt: cust.created_at,
      integrationSource: 'dockwa',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + customers.length < total,
      total,
    };
  }

  private mapReservationStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'confirmed': 'active',
      'pending': 'pending',
      'cancelled': 'cancelled',
      'checked_in': 'active',
      'checked_out': 'completed',
    };
    return statusMap[status] || 'unknown';
  }

  protected async saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }> {
    switch (entityType) {
      case 'storageLocations':
        return this.saveStorageLocation(data);
      case 'leases':
        return this.saveLease(data);
      case 'tenants':
        return this.saveTenant(data);
      case 'contacts':
        return this.saveContact(data);
      default:
        throw new Error(`Cannot save entity type: ${entityType}`);
    }
  }

  private async saveStorageLocation(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `loc_${data.externalId}` };
  }

  private async saveLease(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `lease_${data.externalId}` };
  }

  private async saveTenant(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `tenant_${data.externalId}` };
  }

  private async saveContact(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `contact_${data.externalId}` };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${DOCKWA_API_URL}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new Error('Dockwa API key is invalid or expired. Please update your credentials.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dockwa API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }
}
