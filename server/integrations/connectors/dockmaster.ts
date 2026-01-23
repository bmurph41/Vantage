import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

interface DockMasterTenant {
  tenant_id: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  mobile?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  status: 'active' | 'inactive' | 'pending';
  created_date: string;
  modified_date: string;
}

interface DockMasterSlip {
  slip_id: string;
  slip_number: string;
  dock_name: string;
  marina_section: string;
  slip_type: 'wet' | 'dry' | 'mooring' | 'storage';
  length: number;
  width: number;
  depth?: number;
  power_amps?: number;
  power_voltage?: number;
  water: boolean;
  wifi: boolean;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  current_tenant_id?: string;
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  annual_rate?: number;
}

interface DockMasterLease {
  lease_id: string;
  tenant_id: string;
  slip_id: string;
  lease_type: 'transient' | 'seasonal' | 'annual' | 'liveaboard';
  start_date: string;
  end_date: string;
  rent_amount: number;
  rent_frequency: 'daily' | 'weekly' | 'monthly' | 'annual';
  security_deposit?: number;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  auto_renew: boolean;
  vessel_name?: string;
  vessel_length?: number;
  vessel_beam?: number;
  vessel_draft?: number;
  vessel_make?: string;
  vessel_year?: number;
  created_date: string;
  modified_date: string;
}

interface DockMasterReceivable {
  invoice_id: string;
  tenant_id: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  balance: number;
  status: 'open' | 'paid' | 'overdue' | 'void';
  line_items: Array<{
    description: string;
    amount: number;
    category: string;
  }>;
}

export class DockMasterConnector extends BaseConnector {
  private apiKey: string;
  private siteId: string;
  private baseUrl: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.apiKey = this.getCredential('apiKey');
    this.siteId = this.getCredential('siteId');
    this.baseUrl = this.getSetting('baseUrl', 'https://api.dockmaster.com/v1');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ site: { name: string; id: string; status: string } }>(
        `/sites/${this.siteId}`
      );

      return {
        connected: true,
        message: `Connected to ${response.site?.name || 'DockMaster'}`,
        details: {
          siteName: response.site?.name,
          siteId: response.site?.id,
          status: response.site?.status,
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
        sourceEntity: 'tenants',
        targetEntity: 'tenants',
        targetModule: 'rentRoll',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'slips',
        targetEntity: 'storageLocations',
        targetModule: 'rentRoll',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'leases',
        targetEntity: 'leases',
        targetModule: 'rentRoll',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'tenants',
        targetEntity: 'contacts',
        targetModule: 'crm',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'receivables',
        targetEntity: 'receivables',
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
      case 'tenants':
        return this.fetchTenants(options);
      case 'slips':
        return this.fetchSlips(options);
      case 'leases':
        return this.fetchLeases(options);
      case 'receivables':
        return this.fetchReceivables(options);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async fetchTenants(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      limit: limit.toString(),
      offset: offset.toString(),
    };

    if (options?.since) {
      params.modified_since = options.since.toISOString();
    }

    const response = await this.makeAuthenticatedRequest<{ tenants: DockMasterTenant[]; total: number }>(
      `/sites/${this.siteId}/tenants`,
      params
    );

    const tenants = response.tenants || [];
    const total = response.total || tenants.length;

    const transformed = tenants.map(tenant => ({
      externalId: tenant.tenant_id,
      firstName: tenant.first_name,
      lastName: tenant.last_name,
      displayName: tenant.company_name || `${tenant.first_name} ${tenant.last_name}`,
      companyName: tenant.company_name,
      email: tenant.email,
      phone: tenant.phone,
      mobile: tenant.mobile,
      address: {
        line1: tenant.address1,
        line2: tenant.address2,
        city: tenant.city,
        state: tenant.state,
        postalCode: tenant.zip,
        country: tenant.country,
      },
      status: tenant.status,
      createdAt: tenant.created_date,
      updatedAt: tenant.modified_date,
      integrationSource: 'dockmaster',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + tenants.length < total,
      total,
    };
  }

  private async fetchSlips(options?: { limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const response = await this.makeAuthenticatedRequest<{ slips: DockMasterSlip[]; total: number }>(
      `/sites/${this.siteId}/slips`,
      { limit: limit.toString(), offset: offset.toString() }
    );

    const slips = response.slips || [];
    const total = response.total || slips.length;

    const transformed = slips.map(slip => ({
      externalId: slip.slip_id,
      name: slip.slip_number,
      code: slip.slip_number,
      description: `${slip.dock_name} - ${slip.marina_section}`,
      storageType: this.mapSlipType(slip.slip_type),
      lengthFeet: slip.length,
      widthFeet: slip.width,
      depthFeet: slip.depth,
      capacity: 1,
      powerAmps: slip.power_amps,
      powerVoltage: slip.power_voltage,
      hasWater: slip.water,
      hasWifi: slip.wifi,
      status: slip.status,
      currentTenantId: slip.current_tenant_id,
      postedRate: slip.monthly_rate?.toString(),
      postedRateType: 'monthly',
      dailyRate: slip.daily_rate,
      weeklyRate: slip.weekly_rate,
      monthlyRate: slip.monthly_rate,
      annualRate: slip.annual_rate,
      isActive: slip.status !== 'maintenance',
      integrationSource: 'dockmaster',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + slips.length < total,
      total,
    };
  }

  private async fetchLeases(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      limit: limit.toString(),
      offset: offset.toString(),
    };

    if (options?.since) {
      params.modified_since = options.since.toISOString();
    }

    const response = await this.makeAuthenticatedRequest<{ leases: DockMasterLease[]; total: number }>(
      `/sites/${this.siteId}/leases`,
      params
    );

    const leases = response.leases || [];
    const total = response.total || leases.length;

    const transformed = leases.map(lease => ({
      externalId: lease.lease_id,
      tenantExternalId: lease.tenant_id,
      locationExternalId: lease.slip_id,
      leaseType: this.mapLeaseType(lease.lease_type),
      startDate: lease.start_date,
      endDate: lease.end_date,
      rentAmount: lease.rent_amount,
      rentFrequency: lease.rent_frequency,
      securityDeposit: lease.security_deposit,
      status: lease.status,
      autoRenew: lease.auto_renew,
      vesselName: lease.vessel_name,
      vesselLength: lease.vessel_length,
      vesselBeam: lease.vessel_beam,
      vesselDraft: lease.vessel_draft,
      vesselMake: lease.vessel_make,
      vesselYear: lease.vessel_year,
      createdAt: lease.created_date,
      updatedAt: lease.modified_date,
      integrationSource: 'dockmaster',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + leases.length < total,
      total,
    };
  }

  private async fetchReceivables(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const response = await this.makeAuthenticatedRequest<{ invoices: DockMasterReceivable[]; total: number }>(
      `/sites/${this.siteId}/invoices`,
      { limit: limit.toString(), offset: offset.toString(), status: 'open,overdue' }
    );

    const invoices = response.invoices || [];
    const total = response.total || invoices.length;

    const transformed = invoices.map(inv => ({
      externalId: inv.invoice_id,
      tenantExternalId: inv.tenant_id,
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date,
      amount: inv.amount,
      balance: inv.balance,
      status: inv.status,
      lineItems: inv.line_items,
      integrationSource: 'dockmaster',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + invoices.length < total,
      total,
    };
  }

  private mapSlipType(type: string): string {
    const typeMap: Record<string, string> = {
      'wet': 'wet_slip',
      'dry': 'dry_storage',
      'mooring': 'mooring',
      'storage': 'dry_storage',
    };
    return typeMap[type] || 'wet_slip';
  }

  private mapLeaseType(type: string): string {
    const typeMap: Record<string, string> = {
      'transient': 'short_term',
      'seasonal': 'seasonal',
      'annual': 'annual',
      'liveaboard': 'annual',
    };
    return typeMap[type] || 'annual';
  }

  protected async saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }> {
    switch (entityType) {
      case 'tenants':
        return this.saveTenant(data);
      case 'storageLocations':
        return this.saveStorageLocation(data);
      case 'leases':
        return this.saveLease(data);
      case 'contacts':
        return this.saveContact(data);
      case 'receivables':
        return this.saveReceivable(data);
      default:
        throw new Error(`Cannot save entity type: ${entityType}`);
    }
  }

  private async saveTenant(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `tenant_${data.externalId}` };
  }

  private async saveStorageLocation(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `loc_${data.externalId}` };
  }

  private async saveLease(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `lease_${data.externalId}` };
  }

  private async saveContact(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `contact_${data.externalId}` };
  }

  private async saveReceivable(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    return { created: true, updated: false, id: `recv_${data.externalId}` };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-API-Key': this.apiKey,
        'X-Site-ID': this.siteId,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new Error('DockMaster API key is invalid. Please update your credentials.');
    }

    if (response.status === 403) {
      throw new Error('DockMaster API access denied. Check your site permissions.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DockMaster API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }
}
