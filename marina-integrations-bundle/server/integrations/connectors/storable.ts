import { BaseConnector, ConnectorConfig, FetchResult, SaveResult, TransformResult } from './base';
import { db } from '../../db';
import { storageLocations, marinaTenants, marinaLeases, marinaContacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface StorableSlip {
  id: string;
  name: string;
  dock: string;
  slipType: 'wet' | 'dry' | 'mooring' | 'covered';
  length: number;
  width: number;
  depth?: number;
  power?: string;
  water: boolean;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  rates: {
    daily?: number;
    weekly?: number;
    monthly?: number;
    seasonal?: number;
    annual?: number;
  };
  amenities?: string[];
}

interface StorableTenant {
  id: string;
  accountNumber: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  vessel?: {
    name: string;
    type: string;
    length: number;
    beam: number;
    draft: number;
    make?: string;
    model?: string;
    year?: number;
    registration?: string;
  };
  status: 'active' | 'inactive' | 'pending';
  balance: number;
  createdAt: string;
}

interface StorableLease {
  id: string;
  slipId: string;
  tenantId: string;
  leaseType: 'annual' | 'seasonal' | 'monthly' | 'transient';
  startDate: string;
  endDate: string;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  rate: number;
  rateFrequency: 'daily' | 'weekly' | 'monthly' | 'annually';
  deposit?: number;
  notes?: string;
  autoRenew: boolean;
}

interface StorableTransaction {
  id: string;
  tenantId: string;
  type: 'payment' | 'charge' | 'credit' | 'refund';
  category: 'slip_rental' | 'fuel' | 'store' | 'service' | 'electric' | 'other';
  amount: number;
  date: string;
  description: string;
  paymentMethod?: string;
  invoiceNumber?: string;
}

export class StorableMarineConnector extends BaseConnector {
  private apiKey: string;
  private apiSecret: string;
  private facilityId: string;
  private baseUrl: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.apiKey = this.getCredential('apiKey');
    this.apiSecret = this.getCredential('apiSecret');
    this.facilityId = this.getCredential('facilityId');
    this.baseUrl = this.getSetting('baseUrl', 'https://api.storable.com/marine/v1');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ facility: { name: string; id: string } }>(
        `/facilities/${this.facilityId}`
      );

      return {
        connected: true,
        message: `Connected to ${response.facility?.name || 'Storable Marine'}`,
        details: {
          facilityName: response.facility?.name,
          facilityId: response.facility?.id,
        }
      };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(timestamp);
    
    return {
      'X-Api-Key': this.apiKey,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
      'X-Facility-Id': this.facilityId,
      'Content-Type': 'application/json',
    };
  }

  private generateSignature(timestamp: string): string {
    const crypto = require('crypto');
    const message = `${this.apiKey}${timestamp}${this.facilityId}`;
    return crypto.createHmac('sha256', this.apiSecret).update(message).digest('hex');
  }

  async fetchEntity(entityType: string, options?: { since?: Date; limit?: number }): Promise<FetchResult> {
    const limit = options?.limit || 500;
    const since = options?.since ? options.since.toISOString() : undefined;
    
    try {
      switch (entityType) {
        case 'slips':
          return this.fetchSlips(limit, since);
        case 'tenants':
          return this.fetchTenants(limit, since);
        case 'leases':
          return this.fetchLeases(limit, since);
        case 'transactions':
          return this.fetchTransactions(limit, since);
        default:
          return { success: false, data: [], error: `Unknown entity type: ${entityType}` };
      }
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Fetch failed',
      };
    }
  }

  private async fetchSlips(limit: number, since?: string): Promise<FetchResult> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (since) params.append('updated_since', since);

    const response = await this.makeAuthenticatedRequest<{ slips: StorableSlip[]; hasMore: boolean }>(
      `/facilities/${this.facilityId}/slips?${params}`
    );

    return {
      success: true,
      data: response.slips || [],
      hasMore: response.hasMore,
      count: response.slips?.length || 0,
    };
  }

  private async fetchTenants(limit: number, since?: string): Promise<FetchResult> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (since) params.append('updated_since', since);

    const response = await this.makeAuthenticatedRequest<{ tenants: StorableTenant[]; hasMore: boolean }>(
      `/facilities/${this.facilityId}/tenants?${params}`
    );

    return {
      success: true,
      data: response.tenants || [],
      hasMore: response.hasMore,
      count: response.tenants?.length || 0,
    };
  }

  private async fetchLeases(limit: number, since?: string): Promise<FetchResult> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (since) params.append('updated_since', since);

    const response = await this.makeAuthenticatedRequest<{ leases: StorableLease[]; hasMore: boolean }>(
      `/facilities/${this.facilityId}/leases?${params}`
    );

    return {
      success: true,
      data: response.leases || [],
      hasMore: response.hasMore,
      count: response.leases?.length || 0,
    };
  }

  private async fetchTransactions(limit: number, since?: string): Promise<FetchResult> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (since) params.append('since', since);

    const response = await this.makeAuthenticatedRequest<{ transactions: StorableTransaction[]; hasMore: boolean }>(
      `/facilities/${this.facilityId}/transactions?${params}`
    );

    return {
      success: true,
      data: response.transactions || [],
      hasMore: response.hasMore,
      count: response.transactions?.length || 0,
    };
  }

  transformRecord(entityType: string, record: any): TransformResult {
    switch (entityType) {
      case 'slips':
        return this.transformSlip(record as StorableSlip);
      case 'tenants':
        return this.transformTenant(record as StorableTenant);
      case 'leases':
        return this.transformLease(record as StorableLease);
      case 'transactions':
        return this.transformTransaction(record as StorableTransaction);
      default:
        return { success: false, error: `Unknown entity type: ${entityType}` };
    }
  }

  private transformSlip(slip: StorableSlip): TransformResult {
    return {
      success: true,
      data: {
        externalId: slip.id,
        integrationSource: 'storable_marine',
        name: slip.name,
        locationCode: `${slip.dock}-${slip.name}`,
        locationType: this.mapSlipType(slip.slipType),
        length: slip.length,
        width: slip.width,
        depth: slip.depth,
        power: slip.power,
        water: slip.water,
        status: this.mapStatus(slip.status),
        monthlyRate: slip.rates.monthly,
        annualRate: slip.rates.annual,
        seasonalRate: slip.rates.seasonal,
        dailyRate: slip.rates.daily,
        weeklyRate: slip.rates.weekly,
        amenities: slip.amenities,
        metadata: { dock: slip.dock, originalType: slip.slipType },
      }
    };
  }

  private transformTenant(tenant: StorableTenant): TransformResult {
    return {
      success: true,
      data: {
        externalId: tenant.id,
        integrationSource: 'storable_marine',
        accountNumber: tenant.accountNumber,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        companyName: tenant.companyName,
        email: tenant.email,
        phone: tenant.phone,
        address: tenant.address ? [
          tenant.address.street1,
          tenant.address.street2,
          `${tenant.address.city}, ${tenant.address.state} ${tenant.address.zip}`
        ].filter(Boolean).join('\n') : null,
        vesselName: tenant.vessel?.name,
        vesselType: tenant.vessel?.type,
        vesselLength: tenant.vessel?.length,
        vesselBeam: tenant.vessel?.beam,
        vesselDraft: tenant.vessel?.draft,
        vesselMake: tenant.vessel?.make,
        vesselModel: tenant.vessel?.model,
        vesselYear: tenant.vessel?.year,
        vesselRegistration: tenant.vessel?.registration,
        status: tenant.status,
        balance: tenant.balance,
        metadata: { importedAt: new Date().toISOString() },
      }
    };
  }

  private transformLease(lease: StorableLease): TransformResult {
    return {
      success: true,
      data: {
        externalId: lease.id,
        integrationSource: 'storable_marine',
        externalSlipId: lease.slipId,
        externalTenantId: lease.tenantId,
        leaseType: lease.leaseType,
        startDate: new Date(lease.startDate),
        endDate: new Date(lease.endDate),
        status: lease.status,
        rate: lease.rate,
        rateFrequency: lease.rateFrequency,
        deposit: lease.deposit,
        notes: lease.notes,
        autoRenew: lease.autoRenew,
        metadata: { originalLeaseType: lease.leaseType },
      }
    };
  }

  private transformTransaction(tx: StorableTransaction): TransformResult {
    return {
      success: true,
      data: {
        externalId: tx.id,
        integrationSource: 'storable_marine',
        externalTenantId: tx.tenantId,
        transactionType: tx.type,
        category: tx.category,
        amount: tx.amount,
        date: new Date(tx.date),
        description: tx.description,
        paymentMethod: tx.paymentMethod,
        invoiceNumber: tx.invoiceNumber,
        metadata: {},
      }
    };
  }

  private mapSlipType(type: string): string {
    const mapping: Record<string, string> = {
      'wet': 'wet_slip',
      'dry': 'dry_storage',
      'mooring': 'mooring',
      'covered': 'covered_slip',
    };
    return mapping[type] || 'wet_slip';
  }

  private mapStatus(status: string): string {
    const mapping: Record<string, string> = {
      'available': 'available',
      'occupied': 'occupied',
      'reserved': 'reserved',
      'maintenance': 'out_of_service',
    };
    return mapping[status] || 'available';
  }

  async saveEntity(entityType: string, data: any): Promise<SaveResult> {
    const { orgId, userId } = this.config;

    try {
      switch (entityType) {
        case 'slips':
          return this.saveSlip(data, orgId);
        case 'tenants':
          return this.saveTenant(data, orgId);
        case 'leases':
          return this.saveLease(data, orgId);
        case 'transactions':
          return { created: false, updated: false, id: data.externalId };
        default:
          return { created: false, updated: false, error: `Unknown entity: ${entityType}` };
      }
    } catch (error) {
      return {
        created: false,
        updated: false,
        error: error instanceof Error ? error.message : 'Save failed',
      };
    }
  }

  private async saveSlip(data: any, orgId: string): Promise<SaveResult> {
    const existing = await db.query.storageLocations.findFirst({
      where: and(
        eq(storageLocations.orgId, orgId),
        eq(storageLocations.externalId, data.externalId),
        eq(storageLocations.integrationSource, 'storable_marine')
      )
    });

    if (existing) {
      await db.update(storageLocations)
        .set({
          name: data.name,
          locationCode: data.locationCode,
          locationType: data.locationType,
          length: data.length,
          width: data.width,
          depth: data.depth,
          status: data.status,
          monthlyRate: data.monthlyRate?.toString(),
          annualRate: data.annualRate?.toString(),
          metadata: data.metadata,
          updatedAt: new Date(),
        })
        .where(eq(storageLocations.id, existing.id));

      return { created: false, updated: true, id: existing.id };
    } else {
      const [inserted] = await db.insert(storageLocations).values({
        orgId,
        externalId: data.externalId,
        integrationSource: 'storable_marine',
        name: data.name,
        locationCode: data.locationCode,
        locationType: data.locationType,
        length: data.length,
        width: data.width,
        depth: data.depth,
        status: data.status,
        monthlyRate: data.monthlyRate?.toString(),
        annualRate: data.annualRate?.toString(),
        metadata: data.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning({ id: storageLocations.id });

      return { created: true, updated: false, id: inserted.id };
    }
  }

  private async saveTenant(data: any, orgId: string): Promise<SaveResult> {
    const existing = await db.query.marinaTenants.findFirst({
      where: and(
        eq(marinaTenants.orgId, orgId),
        eq(marinaTenants.externalId, data.externalId),
        eq(marinaTenants.integrationSource, 'storable_marine')
      )
    });

    const tenantData = {
      firstName: data.firstName,
      lastName: data.lastName,
      companyName: data.companyName,
      email: data.email,
      phone: data.phone,
      address: data.address,
      vesselName: data.vesselName,
      vesselType: data.vesselType,
      vesselLength: data.vesselLength,
      vesselBeam: data.vesselBeam,
      vesselDraft: data.vesselDraft,
      status: data.status,
      metadata: data.metadata,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(marinaTenants).set(tenantData).where(eq(marinaTenants.id, existing.id));
      return { created: false, updated: true, id: existing.id };
    } else {
      const [inserted] = await db.insert(marinaTenants).values({
        orgId,
        externalId: data.externalId,
        integrationSource: 'storable_marine',
        ...tenantData,
        createdAt: new Date(),
      }).returning({ id: marinaTenants.id });

      return { created: true, updated: false, id: inserted.id };
    }
  }

  private async saveLease(data: any, orgId: string): Promise<SaveResult> {
    const slip = await db.query.storageLocations.findFirst({
      where: and(
        eq(storageLocations.orgId, orgId),
        eq(storageLocations.externalId, data.externalSlipId),
        eq(storageLocations.integrationSource, 'storable_marine')
      )
    });

    const tenant = await db.query.marinaTenants.findFirst({
      where: and(
        eq(marinaTenants.orgId, orgId),
        eq(marinaTenants.externalId, data.externalTenantId),
        eq(marinaTenants.integrationSource, 'storable_marine')
      )
    });

    if (!slip || !tenant) {
      return { created: false, updated: false, error: 'Slip or tenant not found' };
    }

    const existing = await db.query.marinaLeases.findFirst({
      where: and(
        eq(marinaLeases.orgId, orgId),
        eq(marinaLeases.externalId, data.externalId),
        eq(marinaLeases.integrationSource, 'storable_marine')
      )
    });

    const leaseData = {
      storageLocationId: slip.id,
      tenantId: tenant.id,
      leaseType: data.leaseType,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      rate: data.rate?.toString(),
      rateFrequency: data.rateFrequency,
      metadata: data.metadata,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(marinaLeases).set(leaseData).where(eq(marinaLeases.id, existing.id));
      return { created: false, updated: true, id: existing.id };
    } else {
      const [inserted] = await db.insert(marinaLeases).values({
        orgId,
        externalId: data.externalId,
        integrationSource: 'storable_marine',
        ...leaseData,
        createdAt: new Date(),
      }).returning({ id: marinaLeases.id });

      return { created: true, updated: false, id: inserted.id };
    }
  }
}
