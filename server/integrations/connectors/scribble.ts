import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';
import { db } from '../../db';
import { storageLocations, marinaTenants, marinaLeases, marinaProjects, crmContacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const SCRIBBLE_API_URL = 'https://api.scribblesoftware.com/v1';

interface ScribbleSlip {
  slipId: string;
  slipName: string;
  dockName: string;
  slipType: 'wet' | 'dry' | 'mooring' | 'rack';
  length: number;
  width: number;
  depth?: number;
  electricAmp?: number;
  hasWater: boolean;
  status: 'available' | 'occupied' | 'reserved' | 'outOfService';
  monthlyRate?: number;
  annualRate?: number;
  seasonalRate?: number;
}

interface ScribbleCustomer {
  customerId: string;
  firstName: string;
  lastName: string;
  company?: string;
  email?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  vesselName?: string;
  vesselLength?: number;
  vesselMake?: string;
  vesselYear?: number;
  isActive: boolean;
}

interface ScribbleReservation {
  reservationId: string;
  customerId: string;
  slipId: string;
  reservationType: 'transient' | 'seasonal' | 'annual' | 'monthly';
  checkIn: string;
  checkOut: string;
  status: 'confirmed' | 'checkedIn' | 'checkedOut' | 'cancelled';
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
}

interface ScribbleTransaction {
  transactionId: string;
  customerId: string;
  date: string;
  type: 'rental' | 'fuel' | 'service' | 'merchandise' | 'fee';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'refunded';
}

export class ScribbleConnector extends BaseConnector {
  private apiKey: string;
  private siteCode: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.apiKey = this.getCredential('apiKey');
    this.siteCode = this.getCredential('siteCode');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ marina: { name: string; id: string; status: string } }>(
        `/sites/${this.siteCode}`
      );

      return {
        connected: true,
        message: `Connected to ${response.marina?.name || 'Scribble Marina'}`,
        details: {
          marinaName: response.marina?.name,
          siteCode: response.marina?.id,
          status: response.marina?.status,
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
        sourceEntity: 'customers',
        targetEntity: 'tenants',
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
        targetEntity: 'contacts',
        targetModule: 'crm',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'transactions',
        targetEntity: 'transactions',
        targetModule: 'financials',
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
      case 'customers':
        return this.fetchCustomers(options);
      case 'reservations':
        return this.fetchReservations(options);
      case 'transactions':
        return this.fetchTransactions(options);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async fetchSlips(options?: { limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const response = await this.makeAuthenticatedRequest<{ slips: ScribbleSlip[]; total: number }>(
      `/sites/${this.siteCode}/slips`,
      { limit: limit.toString(), offset: offset.toString() }
    );

    const slips = response.slips || [];
    const total = response.total || slips.length;

    const transformed = slips.map(slip => ({
      externalId: slip.slipId,
      name: slip.slipName,
      code: slip.slipName,
      description: `${slip.dockName} - ${slip.length}' x ${slip.width}'`,
      storageType: this.mapSlipType(slip.slipType),
      lengthFeet: slip.length,
      widthFeet: slip.width,
      depthFeet: slip.depth,
      capacity: 1,
      powerAmps: slip.electricAmp,
      hasWater: slip.hasWater,
      status: this.mapSlipStatus(slip.status),
      postedRate: slip.monthlyRate?.toString(),
      postedRateType: 'monthly',
      monthlyRate: slip.monthlyRate,
      annualRate: slip.annualRate,
      seasonalRate: slip.seasonalRate,
      isActive: slip.status !== 'outOfService',
      integrationSource: 'scribble',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + slips.length < total,
      total,
    };
  }

  private async fetchCustomers(options?: { limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const response = await this.makeAuthenticatedRequest<{ customers: ScribbleCustomer[]; total: number }>(
      `/sites/${this.siteCode}/customers`,
      { limit: limit.toString(), offset: offset.toString() }
    );

    const customers = response.customers || [];
    const total = response.total || customers.length;

    const transformed = customers.map(cust => ({
      externalId: cust.customerId,
      firstName: cust.firstName,
      lastName: cust.lastName,
      displayName: cust.company || `${cust.firstName} ${cust.lastName}`,
      companyName: cust.company,
      email: cust.email,
      phone: cust.phone,
      address: {
        line1: cust.address1,
        line2: cust.address2,
        city: cust.city,
        state: cust.state,
        postalCode: cust.zip,
      },
      boatName: cust.vesselName,
      boatLength: cust.vesselLength,
      boatMake: cust.vesselMake,
      boatYear: cust.vesselYear,
      isActive: cust.isActive,
      integrationSource: 'scribble',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + customers.length < total,
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

    const response = await this.makeAuthenticatedRequest<{ reservations: ScribbleReservation[]; total: number }>(
      `/sites/${this.siteCode}/reservations`,
      params
    );

    const reservations = response.reservations || [];
    const total = response.total || reservations.length;

    const transformed = reservations.map(res => ({
      externalId: res.reservationId,
      tenantExternalId: res.customerId,
      locationExternalId: res.slipId,
      leaseType: this.mapReservationType(res.reservationType),
      startDate: res.checkIn,
      endDate: res.checkOut,
      status: this.mapReservationStatus(res.status),
      totalAmount: res.totalAmount,
      paidAmount: res.paidAmount,
      createdAt: res.createdAt,
      integrationSource: 'scribble',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + reservations.length < total,
      total,
    };
  }

  private async fetchTransactions(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      limit: limit.toString(),
      offset: offset.toString(),
    };

    if (options?.since) {
      params.since = options.since.toISOString();
    }

    const response = await this.makeAuthenticatedRequest<{ transactions: ScribbleTransaction[]; total: number }>(
      `/sites/${this.siteCode}/transactions`,
      params
    );

    const transactions = response.transactions || [];
    const total = response.total || transactions.length;

    const transformed = transactions.map(txn => ({
      externalId: txn.transactionId,
      tenantExternalId: txn.customerId,
      date: txn.date,
      type: this.mapTransactionType(txn.type),
      amount: txn.amount,
      description: txn.description,
      status: txn.status,
      integrationSource: 'scribble',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + transactions.length < total,
      total,
    };
  }

  private mapSlipType(type: string): string {
    const typeMap: Record<string, string> = {
      'wet': 'wet_slip',
      'dry': 'dry_storage',
      'mooring': 'mooring',
      'rack': 'dry_storage',
    };
    return typeMap[type] || 'wet_slip';
  }

  private mapSlipStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'available': 'available',
      'occupied': 'occupied',
      'reserved': 'reserved',
      'outOfService': 'maintenance',
    };
    return statusMap[status] || 'available';
  }

  private mapReservationType(type: string): string {
    const typeMap: Record<string, string> = {
      'transient': 'short_term',
      'seasonal': 'seasonal',
      'annual': 'annual',
      'monthly': 'annual',
    };
    return typeMap[type] || 'annual';
  }

  private mapReservationStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'confirmed': 'active',
      'checkedIn': 'active',
      'checkedOut': 'completed',
      'cancelled': 'cancelled',
    };
    return statusMap[status] || 'unknown';
  }

  private mapTransactionType(type: string): string {
    const typeMap: Record<string, string> = {
      'rental': 'slip_rental',
      'fuel': 'fuel',
      'service': 'service',
      'merchandise': 'merchandise',
      'fee': 'other',
    };
    return typeMap[type] || 'other';
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
      case 'transactions':
        return { created: false, updated: false, id: data.externalId };
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
        eq(storageLocations.integrationSource, 'scribble')
      )
    });

    if (existing) {
      await db.update(storageLocations)
        .set({
          name: data.name || data.code,
          code: data.code,
          locationType: data.storageType || 'wet_slip',
          length: data.lengthFeet?.toString(),
          width: data.widthFeet?.toString(),
          depth: data.depthFeet?.toString(),
          hasElectric: !!data.powerAmps,
          electricAmps: data.powerAmps,
          hasWater: data.hasWater,
          monthlyRate: data.monthlyRate?.toString(),
          annualRate: data.annualRate?.toString(),
          seasonalRate: data.seasonalRate?.toString(),
          isAvailable: data.status === 'available',
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
      locationType: data.storageType || 'wet_slip',
      length: data.lengthFeet?.toString(),
      width: data.widthFeet?.toString(),
      depth: data.depthFeet?.toString(),
      hasElectric: !!data.powerAmps,
      electricAmps: data.powerAmps,
      hasWater: data.hasWater,
      monthlyRate: data.monthlyRate?.toString(),
      annualRate: data.annualRate?.toString(),
      seasonalRate: data.seasonalRate?.toString(),
      isAvailable: data.status === 'available',
      externalId: data.externalId,
      integrationSource: 'scribble',
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
        eq(marinaTenants.integrationSource, 'scribble')
      )
    });

    if (!tenant) {
      console.log(`[Scribble] Tenant not found for lease: ${data.externalId}`);
      return { created: false, updated: false };
    }

    const location = await db.query.storageLocations.findFirst({
      where: and(
        eq(storageLocations.orgId, this.config.orgId),
        eq(storageLocations.externalId, data.locationExternalId),
        eq(storageLocations.integrationSource, 'scribble')
      )
    });

    const existing = await db.query.marinaLeases.findFirst({
      where: and(
        eq(marinaLeases.orgId, this.config.orgId),
        eq(marinaLeases.externalId, data.externalId),
        eq(marinaLeases.integrationSource, 'scribble')
      )
    });

    const termGroup = this.mapLeaseTypeToTermGroup(data.leaseType);
    const leaseData = {
      orgId: this.config.orgId,
      marinaProjectId: marinaProject.id,
      tenantId: tenant.id,
      storageLocationId: location?.id || null,
      leaseNumber: data.externalId,
      status: data.status === 'active' ? 'active' : 'expired',
      contractTermGroup: termGroup,
      startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      monthlyRent: (data.totalAmount || 0).toString(),
      externalId: data.externalId,
      integrationSource: 'scribble',
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

  private mapLeaseTypeToTermGroup(leaseType: string): 'annual' | 'seasonal' | 'winter' | 'short_term' {
    const map: Record<string, 'annual' | 'seasonal' | 'winter' | 'short_term'> = {
      'annual': 'annual',
      'seasonal': 'seasonal',
      'short_term': 'short_term',
    };
    return map[leaseType] || 'annual';
  }

  private async saveTenant(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    const existing = await db.query.marinaTenants.findFirst({
      where: and(
        eq(marinaTenants.orgId, this.config.orgId),
        eq(marinaTenants.externalId, data.externalId),
        eq(marinaTenants.integrationSource, 'scribble')
      )
    });

    if (existing) {
      await db.update(marinaTenants)
        .set({
          firstName: data.firstName || existing.firstName,
          lastName: data.lastName || existing.lastName,
          companyName: data.companyName,
          email: data.email,
          phone: data.phone,
          address: data.address?.line1,
          city: data.address?.city,
          state: data.address?.state,
          zipCode: data.address?.postalCode,
          boatName: data.boatName,
          boatLength: data.boatLength?.toString(),
          boatMake: data.boatMake,
          boatYear: data.boatYear,
          isActive: data.isActive,
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
      companyName: data.companyName,
      email: data.email,
      phone: data.phone,
      address: data.address?.line1,
      city: data.address?.city,
      state: data.address?.state,
      zipCode: data.address?.postalCode,
      boatName: data.boatName,
      boatLength: data.boatLength?.toString(),
      boatMake: data.boatMake,
      boatYear: data.boatYear,
      isActive: data.isActive ?? true,
      externalId: data.externalId,
      integrationSource: 'scribble',
      lastSyncedAt: new Date(),
    }).returning({ id: marinaTenants.id });

    return { created: true, updated: false, id: inserted.id };
  }

  private async saveContact(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    const existing = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.orgId, this.config.orgId),
        eq(crmContacts.externalId, data.externalId),
        eq(crmContacts.integrationSource, 'scribble')
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
      integrationSource: 'scribble',
    }).returning({ id: crmContacts.id });

    return { created: true, updated: false, id: inserted.id };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const baseUrl = this.getSetting('baseUrl', SCRIBBLE_API_URL);
    const url = new URL(`${baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Site-Code': this.siteCode,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new Error('Scribble API key is invalid or expired. Please update your credentials.');
    }

    if (response.status === 403) {
      throw new Error('Scribble API access denied. Check your site permissions.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Scribble API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }
}
