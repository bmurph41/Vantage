import { BaseConnector, ConnectorConfig, FetchResult, SaveResult, TransformResult } from './base';
import { db } from '../../db';
import { storageLocations, marinaTenants, marinaLeases } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface MarinaOfficeSlip {
  SlipID: number;
  SlipNumber: string;
  DockName: string;
  SlipType: string;
  Length: number;
  Width: number;
  Depth: number;
  HasElectric: boolean;
  ElectricAmps: number;
  HasWater: boolean;
  IsAvailable: boolean;
  MonthlyRate: number;
  AnnualRate: number;
  Notes: string;
}

interface MarinaOfficeTenant {
  TenantID: number;
  AccountNumber: string;
  FirstName: string;
  LastName: string;
  Company: string;
  Email: string;
  Phone: string;
  Address1: string;
  Address2: string;
  City: string;
  State: string;
  Zip: string;
  BoatName: string;
  BoatType: string;
  BoatLength: number;
  BoatBeam: number;
  BoatDraft: number;
  BoatMake: string;
  BoatModel: string;
  BoatYear: number;
  RegistrationNumber: string;
  InsuranceExpiration: string;
  Status: string;
  Balance: number;
  LastPaymentDate: string;
}

interface MarinaOfficeLease {
  LeaseID: number;
  SlipID: number;
  TenantID: number;
  LeaseType: string;
  StartDate: string;
  EndDate: string;
  Status: string;
  MonthlyRate: number;
  SecurityDeposit: number;
  AutoRenew: boolean;
  Notes: string;
}

interface MarinaOfficePayment {
  PaymentID: number;
  TenantID: number;
  Amount: number;
  PaymentDate: string;
  PaymentType: string;
  CheckNumber: string;
  Notes: string;
  Category: string;
}

export class MarinaOfficeConnector extends BaseConnector {
  private username: string;
  private password: string;
  private siteUrl: string;
  private sessionToken: string | null = null;

  constructor(config: ConnectorConfig) {
    super(config);
    this.username = this.getCredential('username');
    this.password = this.getCredential('password');
    this.siteUrl = this.getCredential('siteUrl').replace(/\/$/, '');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      await this.authenticate();
      
      const response = await this.makeAuthenticatedRequest<{ success: boolean; marineName: string }>(
        '/api/info'
      );

      return {
        connected: true,
        message: `Connected to ${response.marineName || 'Marina Office'}`,
        details: { marineName: response.marineName }
      };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  private async authenticate(): Promise<void> {
    const authUrl = `${this.siteUrl}/api/auth/login`;
    
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    if (!response.ok) {
      throw new Error('Authentication failed - check username and password');
    }

    const data = await response.json();
    this.sessionToken = data.sessionToken || data.token;
    
    if (!this.sessionToken) {
      throw new Error('No session token returned from authentication');
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    if (!this.sessionToken) {
      throw new Error('Not authenticated - call authenticate() first');
    }
    
    return {
      'Authorization': `Bearer ${this.sessionToken}`,
      'Content-Type': 'application/json',
    };
  }

  protected getBaseUrl(): string {
    return this.siteUrl;
  }

  async fetchEntity(entityType: string, options?: { since?: Date; limit?: number }): Promise<FetchResult> {
    try {
      await this.authenticate();
      
      switch (entityType) {
        case 'slips':
          return this.fetchSlips();
        case 'tenants':
          return this.fetchTenants();
        case 'leases':
          return this.fetchLeases();
        case 'payments':
          return this.fetchPayments(options?.since);
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

  private async fetchSlips(): Promise<FetchResult> {
    const response = await this.makeAuthenticatedRequest<{ slips: MarinaOfficeSlip[] }>(
      '/api/slips'
    );

    return {
      success: true,
      data: response.slips || [],
      count: response.slips?.length || 0,
    };
  }

  private async fetchTenants(): Promise<FetchResult> {
    const response = await this.makeAuthenticatedRequest<{ tenants: MarinaOfficeTenant[] }>(
      '/api/tenants'
    );

    return {
      success: true,
      data: response.tenants || [],
      count: response.tenants?.length || 0,
    };
  }

  private async fetchLeases(): Promise<FetchResult> {
    const response = await this.makeAuthenticatedRequest<{ leases: MarinaOfficeLease[] }>(
      '/api/leases'
    );

    return {
      success: true,
      data: response.leases || [],
      count: response.leases?.length || 0,
    };
  }

  private async fetchPayments(since?: Date): Promise<FetchResult> {
    let url = '/api/payments';
    if (since) {
      url += `?since=${since.toISOString().split('T')[0]}`;
    }

    const response = await this.makeAuthenticatedRequest<{ payments: MarinaOfficePayment[] }>(url);

    return {
      success: true,
      data: response.payments || [],
      count: response.payments?.length || 0,
    };
  }

  transformRecord(entityType: string, record: any): TransformResult {
    switch (entityType) {
      case 'slips':
        return this.transformSlip(record as MarinaOfficeSlip);
      case 'tenants':
        return this.transformTenant(record as MarinaOfficeTenant);
      case 'leases':
        return this.transformLease(record as MarinaOfficeLease);
      case 'payments':
        return this.transformPayment(record as MarinaOfficePayment);
      default:
        return { success: false, error: `Unknown entity type: ${entityType}` };
    }
  }

  private transformSlip(slip: MarinaOfficeSlip): TransformResult {
    return {
      success: true,
      data: {
        externalId: slip.SlipID.toString(),
        integrationSource: 'marina_office',
        name: slip.SlipNumber,
        locationCode: `${slip.DockName}-${slip.SlipNumber}`,
        locationType: this.mapSlipType(slip.SlipType),
        length: slip.Length,
        width: slip.Width,
        depth: slip.Depth,
        power: slip.HasElectric ? `${slip.ElectricAmps}A` : null,
        water: slip.HasWater,
        status: slip.IsAvailable ? 'available' : 'occupied',
        monthlyRate: slip.MonthlyRate,
        annualRate: slip.AnnualRate,
        notes: slip.Notes,
        metadata: { dock: slip.DockName, originalType: slip.SlipType },
      }
    };
  }

  private transformTenant(tenant: MarinaOfficeTenant): TransformResult {
    const fullAddress = [
      tenant.Address1,
      tenant.Address2,
      `${tenant.City}, ${tenant.State} ${tenant.Zip}`
    ].filter(Boolean).join('\n');

    return {
      success: true,
      data: {
        externalId: tenant.TenantID.toString(),
        integrationSource: 'marina_office',
        accountNumber: tenant.AccountNumber,
        firstName: tenant.FirstName,
        lastName: tenant.LastName,
        companyName: tenant.Company,
        email: tenant.Email,
        phone: tenant.Phone,
        address: fullAddress,
        vesselName: tenant.BoatName,
        vesselType: tenant.BoatType,
        vesselLength: tenant.BoatLength,
        vesselBeam: tenant.BoatBeam,
        vesselDraft: tenant.BoatDraft,
        vesselMake: tenant.BoatMake,
        vesselModel: tenant.BoatModel,
        vesselYear: tenant.BoatYear,
        vesselRegistration: tenant.RegistrationNumber,
        insuranceExpiration: tenant.InsuranceExpiration ? new Date(tenant.InsuranceExpiration) : null,
        status: tenant.Status?.toLowerCase() || 'active',
        balance: tenant.Balance,
        lastPaymentDate: tenant.LastPaymentDate ? new Date(tenant.LastPaymentDate) : null,
        metadata: { importedAt: new Date().toISOString() },
      }
    };
  }

  private transformLease(lease: MarinaOfficeLease): TransformResult {
    return {
      success: true,
      data: {
        externalId: lease.LeaseID.toString(),
        integrationSource: 'marina_office',
        externalSlipId: lease.SlipID.toString(),
        externalTenantId: lease.TenantID.toString(),
        leaseType: this.mapLeaseType(lease.LeaseType),
        startDate: new Date(lease.StartDate),
        endDate: new Date(lease.EndDate),
        status: lease.Status?.toLowerCase() || 'active',
        rate: lease.MonthlyRate,
        rateFrequency: 'monthly',
        deposit: lease.SecurityDeposit,
        autoRenew: lease.AutoRenew,
        notes: lease.Notes,
        metadata: { originalLeaseType: lease.LeaseType },
      }
    };
  }

  private transformPayment(payment: MarinaOfficePayment): TransformResult {
    return {
      success: true,
      data: {
        externalId: payment.PaymentID.toString(),
        integrationSource: 'marina_office',
        externalTenantId: payment.TenantID.toString(),
        transactionType: 'payment',
        category: this.mapPaymentCategory(payment.Category),
        amount: payment.Amount,
        date: new Date(payment.PaymentDate),
        paymentMethod: payment.PaymentType,
        checkNumber: payment.CheckNumber,
        notes: payment.Notes,
        metadata: {},
      }
    };
  }

  private mapSlipType(type: string): string {
    const normalized = type?.toLowerCase() || '';
    if (normalized.includes('dry')) return 'dry_storage';
    if (normalized.includes('moor')) return 'mooring';
    if (normalized.includes('cover')) return 'covered_slip';
    if (normalized.includes('rack')) return 'rack_storage';
    return 'wet_slip';
  }

  private mapLeaseType(type: string): string {
    const normalized = type?.toLowerCase() || '';
    if (normalized.includes('annual') || normalized.includes('year')) return 'annual';
    if (normalized.includes('season')) return 'seasonal';
    if (normalized.includes('month')) return 'monthly';
    if (normalized.includes('transit') || normalized.includes('daily')) return 'transient';
    return 'monthly';
  }

  private mapPaymentCategory(category: string): string {
    const normalized = category?.toLowerCase() || '';
    if (normalized.includes('fuel')) return 'fuel';
    if (normalized.includes('store') || normalized.includes('retail')) return 'store';
    if (normalized.includes('service') || normalized.includes('repair')) return 'service';
    if (normalized.includes('electric')) return 'electric';
    if (normalized.includes('slip') || normalized.includes('rental')) return 'slip_rental';
    return 'other';
  }

  async saveEntity(entityType: string, data: any): Promise<SaveResult> {
    const { orgId } = this.config;

    try {
      switch (entityType) {
        case 'slips':
          return this.saveSlip(data, orgId);
        case 'tenants':
          return this.saveTenant(data, orgId);
        case 'leases':
          return this.saveLease(data, orgId);
        case 'payments':
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
        eq(storageLocations.integrationSource, 'marina_office')
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
        integrationSource: 'marina_office',
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
        eq(marinaTenants.integrationSource, 'marina_office')
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
        integrationSource: 'marina_office',
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
        eq(storageLocations.integrationSource, 'marina_office')
      )
    });

    const tenant = await db.query.marinaTenants.findFirst({
      where: and(
        eq(marinaTenants.orgId, orgId),
        eq(marinaTenants.externalId, data.externalTenantId),
        eq(marinaTenants.integrationSource, 'marina_office')
      )
    });

    if (!slip || !tenant) {
      return { created: false, updated: false, error: 'Slip or tenant not found' };
    }

    const existing = await db.query.marinaLeases.findFirst({
      where: and(
        eq(marinaLeases.orgId, orgId),
        eq(marinaLeases.externalId, data.externalId),
        eq(marinaLeases.integrationSource, 'marina_office')
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
        integrationSource: 'marina_office',
        ...leaseData,
        createdAt: new Date(),
      }).returning({ id: marinaLeases.id });

      return { created: true, updated: false, id: inserted.id };
    }
  }
}
