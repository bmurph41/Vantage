import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';
import { db } from '../../db';
import { storageLocations, marinaTenants, marinaLeases, marinaProjects, crmContacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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
    const [marinaProject] = await db.select()
      .from(marinaProjects)
      .where(eq(marinaProjects.orgId, this.config.orgId))
      .limit(1);

    if (!marinaProject) {
      throw new Error('No marina project found for this organization');
    }

    const existing = await db.query.storageLocations.findFirst({
      where: and(
        eq(storageLocations.orgId, this.config.orgId),
        eq(storageLocations.externalId, data.externalId),
        eq(storageLocations.integrationSource, 'dockwa')
      )
    });

    if (existing) {
      await db.update(storageLocations)
        .set({
          name: data.name || data.code,
          code: data.code,
          locationType: 'wet_slip',
          length: data.lengthFeet?.toString(),
          width: data.widthFeet?.toString(),
          depth: data.depthFeet?.toString(),
          monthlyRate: data.postedRate?.toString(),
          isAvailable: data.isActive,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(storageLocations.id, existing.id));
      return { created: false, updated: true, id: existing.id };
    }

    const [inserted] = await db.insert(storageLocations).values({
      orgId: this.config.orgId,
      marinaProjectId: marinaProject.id,
      name: data.name || data.code,
      code: data.code || data.externalId,
      locationType: 'wet_slip',
      length: data.lengthFeet?.toString(),
      width: data.widthFeet?.toString(),
      depth: data.depthFeet?.toString(),
      monthlyRate: data.postedRate?.toString(),
      isAvailable: data.isActive,
      externalId: data.externalId,
      integrationSource: 'dockwa',
      lastSyncedAt: new Date(),
    }).returning({ id: storageLocations.id });

    return { created: true, updated: false, id: inserted.id };
  }

  private async saveLease(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    const [marinaProject] = await db.select()
      .from(marinaProjects)
      .where(eq(marinaProjects.orgId, this.config.orgId))
      .limit(1);

    if (!marinaProject) {
      throw new Error('No marina project found for this organization');
    }

    const tenant = await db.query.marinaTenants.findFirst({
      where: and(
        eq(marinaTenants.orgId, this.config.orgId),
        eq(marinaTenants.externalId, data.tenantExternalId),
        eq(marinaTenants.integrationSource, 'dockwa')
      )
    });

    if (!tenant) {
      console.log(`[Dockwa] Tenant not found for lease: ${data.externalId}`);
      return { created: false, updated: false };
    }

    const location = await db.query.storageLocations.findFirst({
      where: and(
        eq(storageLocations.orgId, this.config.orgId),
        eq(storageLocations.externalId, data.locationExternalId),
        eq(storageLocations.integrationSource, 'dockwa')
      )
    });

    const existing = await db.query.marinaLeases.findFirst({
      where: and(
        eq(marinaLeases.orgId, this.config.orgId),
        eq(marinaLeases.externalId, data.externalId),
        eq(marinaLeases.integrationSource, 'dockwa')
      )
    });

    const leaseData = {
      orgId: this.config.orgId,
      marinaProjectId: marinaProject.id,
      tenantId: tenant.id,
      storageLocationId: location?.id || null,
      leaseNumber: data.externalId,
      status: data.status === 'active' ? 'active' : 'expired',
      contractTermGroup: 'short_term' as const,
      startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      monthlyRent: (data.totalAmount || 0).toString(),
      externalId: data.externalId,
      integrationSource: 'dockwa',
      lastSyncedAt: new Date(),
    };

    if (existing) {
      await db.update(marinaLeases)
        .set({ ...leaseData, updatedAt: new Date() })
        .where(eq(marinaLeases.id, existing.id));
      return { created: false, updated: true, id: existing.id };
    }

    const [inserted] = await db.insert(marinaLeases).values(leaseData as any).returning({ id: marinaLeases.id });
    return { created: true, updated: false, id: inserted.id };
  }

  private async saveTenant(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    const existing = await db.query.marinaTenants.findFirst({
      where: and(
        eq(marinaTenants.orgId, this.config.orgId),
        eq(marinaTenants.externalId, data.externalId),
        eq(marinaTenants.integrationSource, 'dockwa')
      )
    });

    if (existing) {
      await db.update(marinaTenants)
        .set({
          firstName: data.firstName || existing.firstName,
          lastName: data.lastName || existing.lastName,
          email: data.email,
          phone: data.phone,
          address: data.address?.street,
          city: data.address?.city,
          state: data.address?.state,
          zipCode: data.address?.zip,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(marinaTenants.id, existing.id));
      return { created: false, updated: true, id: existing.id };
    }

    const [inserted] = await db.insert(marinaTenants).values({
      orgId: this.config.orgId,
      firstName: data.firstName || 'Unknown',
      lastName: data.lastName || 'Tenant',
      email: data.email,
      phone: data.phone,
      address: data.address?.street,
      city: data.address?.city,
      state: data.address?.state,
      zipCode: data.address?.zip,
      externalId: data.externalId,
      integrationSource: 'dockwa',
      lastSyncedAt: new Date(),
    }).returning({ id: marinaTenants.id });

    return { created: true, updated: false, id: inserted.id };
  }

  private async saveContact(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    const existing = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.orgId, this.config.orgId),
        eq(crmContacts.externalId, data.externalId),
        eq(crmContacts.integrationSource, 'dockwa')
      )
    });

    if (existing) {
      await db.update(crmContacts)
        .set({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          updatedAt: new Date(),
        })
        .where(eq(crmContacts.id, existing.id));
      return { created: false, updated: true, id: existing.id };
    }

    const [inserted] = await db.insert(crmContacts).values({
      orgId: this.config.orgId,
      firstName: data.firstName || 'Unknown',
      lastName: data.lastName || 'Contact',
      email: data.email,
      phone: data.phone,
      externalId: data.externalId,
      integrationSource: 'dockwa',
    }).returning({ id: crmContacts.id });

    return { created: true, updated: false, id: inserted.id };
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
