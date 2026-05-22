import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';
import { db } from '../../db';
import { storageLocations, marinaTenants, marinaLeases, marinaProjects, crmContacts, actualsFacts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { recordConflict } from '../conflict-store';

const HAVENSTAR_API_URL = 'https://api.havenstar.com/v2';

interface HavenstarSlip {
  slip_id: string;
  slip_number: string;
  dock_section: string;
  slip_length: number;
  slip_width: number;
  water_depth: number;
  slip_type: 'wet_slip' | 'dry_storage' | 'side_tie' | 'end_tie';
  status: 'available' | 'occupied' | 'reserved' | 'out_of_service';
  monthly_rate?: number;
  seasonal_rate?: number;
  annual_rate?: number;
  electric_service?: '30amp' | '50amp' | '100amp' | 'none';
  features?: string[];
}

interface HavenstarCustomer {
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  mobile?: string;
  mailing_address?: {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  vessels: Array<{
    vessel_id: string;
    vessel_name: string;
    vessel_type: string;
    length_overall: number;
    beam: number;
    draft: number;
    registration_number?: string;
    hailing_port?: string;
  }>;
  account_balance: number;
  created_date: string;
  last_activity_date?: string;
}

interface HavenstarBillingRecord {
  invoice_id: string;
  customer_id: string;
  slip_id: string;
  invoice_date: string;
  due_date: string;
  period_start: string;
  period_end: string;
  line_items: Array<{
    description: string;
    amount: number;
    category: 'slip_rent' | 'electricity' | 'water' | 'fuel' | 'service' | 'other';
  }>;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
}

interface HavenstarLease {
  lease_id: string;
  customer_id: string;
  slip_id: string;
  lease_type: 'annual' | 'seasonal' | 'monthly' | 'transient';
  start_date: string;
  end_date: string;
  monthly_amount: number;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  auto_renew: boolean;
  created_date: string;
}

export class HavenstarConnector extends BaseConnector {
  private apiKey: string;
  private facilityId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.apiKey = this.getCredential('apiKey');
    this.facilityId = this.getCredential('facilityId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ facility: { name: string; id: string; total_slips: number } }>(
        `/facilities/${this.facilityId}`
      );

      return {
        connected: true,
        message: `Connected to ${response.facility?.name || 'Havenstar Marina'}`,
        details: {
          facilityName: response.facility?.name,
          facilityId: response.facility?.id,
          totalSlips: response.facility?.total_slips,
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
        sourceEntity: 'leases',
        targetEntity: 'leases',
        targetModule: 'rentRoll',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'billing',
        targetEntity: 'revenue',
        targetModule: 'financials',
        syncDirection: 'read',
        batchSize: 50,
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
      case 'customers':
        return this.fetchCustomers(options);
      case 'leases':
        return this.fetchLeases(options);
      case 'billing':
        return this.fetchBillingRecords(options);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async fetchSlips(options?: { limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const response = await this.makeAuthenticatedRequest<{ slips: HavenstarSlip[]; pagination: { total: number; page: number; per_page: number } }>(
      `/facilities/${this.facilityId}/slips`,
      { limit: limit.toString(), offset: offset.toString() }
    );

    const slips = response.slips || [];
    const total = response.pagination?.total || slips.length;

    const transformed = slips.map(slip => ({
      externalId: slip.slip_id,
      name: `${slip.dock_section}-${slip.slip_number}`,
      code: slip.slip_number,
      description: `${slip.dock_section} - ${slip.slip_length}' x ${slip.slip_width}'`,
      storageType: slip.slip_type,
      lengthFeet: slip.slip_length,
      widthFeet: slip.slip_width,
      depthFeet: slip.water_depth,
      capacity: 1,
      postedRate: slip.monthly_rate?.toString(),
      postedRateType: 'monthly',
      isActive: slip.status !== 'out_of_service',
      electricService: slip.electric_service,
      amenities: slip.features,
      integrationSource: 'havenstar',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + slips.length < total,
      total,
    };
  }

  private async fetchCustomers(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      limit: limit.toString(),
      offset: offset.toString(),
    };
    if (options?.since) {
      params.modified_since = options.since.toISOString().split('T')[0];
    }

    const response = await this.makeAuthenticatedRequest<{ customers: HavenstarCustomer[]; pagination: { total: number } }>(
      `/facilities/${this.facilityId}/customers`,
      params
    );

    const customers = response.customers || [];
    const total = response.pagination?.total || customers.length;

    const transformed = customers.map(cust => ({
      externalId: cust.customer_id,
      firstName: cust.first_name,
      lastName: cust.last_name,
      displayName: `${cust.first_name} ${cust.last_name}`,
      email: cust.email,
      phone: cust.phone || cust.mobile,
      address: cust.mailing_address ? {
        street: cust.mailing_address.address1,
        city: cust.mailing_address.city,
        state: cust.mailing_address.state,
        zip: cust.mailing_address.postal_code,
        country: cust.mailing_address.country,
      } : null,
      vessels: (cust.vessels || []).map(v => ({
        vesselId: v.vessel_id,
        name: v.vessel_name,
        type: v.vessel_type,
        length: v.length_overall,
        beam: v.beam,
        draft: v.draft,
        registrationNumber: v.registration_number,
        hailingPort: v.hailing_port,
      })),
      accountBalance: cust.account_balance,
      createdAt: cust.created_date,
      lastActivity: cust.last_activity_date,
      integrationSource: 'havenstar',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + customers.length < total,
      total,
    };
  }

  private async fetchLeases(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      limit: limit.toString(),
      offset: offset.toString(),
      status: 'active',
    };

    const response = await this.makeAuthenticatedRequest<{ leases: HavenstarLease[]; pagination: { total: number } }>(
      `/facilities/${this.facilityId}/leases`,
      params
    );

    const leases = response.leases || [];
    const total = response.pagination?.total || leases.length;

    const transformed = leases.map(lease => ({
      externalId: lease.lease_id,
      tenantExternalId: lease.customer_id,
      locationExternalId: lease.slip_id,
      leaseType: lease.lease_type,
      startDate: lease.start_date,
      endDate: lease.end_date,
      monthlyAmount: lease.monthly_amount,
      status: lease.status,
      autoRenew: lease.auto_renew,
      createdAt: lease.created_date,
      integrationSource: 'havenstar',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + leases.length < total,
      total,
    };
  }

  private async fetchBillingRecords(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      limit: limit.toString(),
      offset: offset.toString(),
    };
    if (options?.since) {
      params.invoice_date_from = options.since.toISOString().split('T')[0];
    }

    const response = await this.makeAuthenticatedRequest<{ invoices: HavenstarBillingRecord[]; pagination: { total: number } }>(
      `/facilities/${this.facilityId}/invoices`,
      params
    );

    const invoices = response.invoices || [];
    const total = response.pagination?.total || invoices.length;

    const transformed = invoices.map(inv => ({
      externalId: inv.invoice_id,
      tenantExternalId: inv.customer_id,
      locationExternalId: inv.slip_id,
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date,
      periodStart: inv.period_start,
      periodEnd: inv.period_end,
      lineItems: inv.line_items,
      totalAmount: inv.total_amount,
      amountPaid: inv.amount_paid,
      balanceDue: inv.balance_due,
      status: inv.status,
      integrationSource: 'havenstar',
      lastSyncedAt: new Date().toISOString(),
    }));

    return {
      data: transformed,
      hasMore: offset + invoices.length < total,
      total,
    };
  }

  protected async saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }> {
    switch (entityType) {
      case 'storageLocations':
        return this.saveStorageLocation(data);
      case 'tenants':
        return this.saveTenant(data);
      case 'leases':
        return this.saveLease(data);
      case 'revenue':
        return this.saveBillingRecord(data);
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
        eq(storageLocations.integrationSource, 'havenstar')
      )
    });

    if (existing) {
      const existingRate = parseFloat(existing.monthlyRate || '0');
      const pmsRate = parseFloat(data.postedRate || '0');
      if (existingRate > 0 && pmsRate > 0 && Math.abs(pmsRate - existingRate) / existingRate > 0.01) {
        recordConflict({
          orgId: this.config.orgId,
          integrationKey: this.integrationKey,
          pmsSource: 'havenstar',
          entityType: 'slip',
          entityId: data.externalId,
          fieldName: 'monthlyRate',
          pmsValue: pmsRate.toString(),
          manualValue: existingRate.toString(),
        });
      }
      await db.update(storageLocations)
        .set({
          name: data.name || data.code,
          code: data.code,
          locationType: data.storageType || 'wet_slip',
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
      locationType: data.storageType || 'wet_slip',
      length: data.lengthFeet?.toString(),
      width: data.widthFeet?.toString(),
      depth: data.depthFeet?.toString(),
      monthlyRate: data.postedRate?.toString(),
      isAvailable: data.isActive,
      externalId: data.externalId,
      integrationSource: 'havenstar',
      lastSyncedAt: new Date(),
    }).returning({ id: storageLocations.id });

    return { created: true, updated: false, id: inserted.id };
  }

  private async saveTenant(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    const existing = await db.query.marinaTenants.findFirst({
      where: and(
        eq(marinaTenants.orgId, this.config.orgId),
        eq(marinaTenants.externalId, data.externalId),
        eq(marinaTenants.integrationSource, 'havenstar')
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
      integrationSource: 'havenstar',
      lastSyncedAt: new Date(),
    }).returning({ id: marinaTenants.id });

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
        eq(marinaTenants.integrationSource, 'havenstar')
      )
    });

    if (!tenant) {
      console.log(`[Havenstar] Tenant not found for lease: ${data.externalId}`);
      return { created: false, updated: false };
    }

    const location = await db.query.storageLocations.findFirst({
      where: and(
        eq(storageLocations.orgId, this.config.orgId),
        eq(storageLocations.externalId, data.locationExternalId),
        eq(storageLocations.integrationSource, 'havenstar')
      )
    });

    const existing = await db.query.marinaLeases.findFirst({
      where: and(
        eq(marinaLeases.orgId, this.config.orgId),
        eq(marinaLeases.externalId, data.externalId),
        eq(marinaLeases.integrationSource, 'havenstar')
      )
    });

    const termGroupMap: Record<string, string> = {
      annual: 'long_term',
      seasonal: 'seasonal',
      monthly: 'month_to_month',
      transient: 'short_term',
    };

    const leaseData = {
      orgId: this.config.orgId,
      marinaProjectId: marinaProject.id,
      tenantId: tenant.id,
      storageLocationId: location?.id || null,
      leaseNumber: data.externalId,
      status: data.status === 'active' ? 'active' : 'expired',
      contractTermGroup: (termGroupMap[data.leaseType] || 'short_term') as any,
      startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      monthlyRent: (data.monthlyAmount || 0).toString(),
      externalId: data.externalId,
      integrationSource: 'havenstar',
      lastSyncedAt: new Date(),
    };

    if (existing) {
      const existingRent = parseFloat(existing.monthlyRent || '0');
      const pmsRent = parseFloat(data.monthlyAmount || '0');
      if (existingRent > 0 && pmsRent > 0 && Math.abs(pmsRent - existingRent) / existingRent > 0.01) {
        recordConflict({
          orgId: this.config.orgId,
          integrationKey: this.integrationKey,
          pmsSource: 'havenstar',
          entityType: 'lease',
          entityId: data.externalId,
          fieldName: 'monthlyRent',
          pmsValue: pmsRent.toString(),
          manualValue: existingRent.toString(),
        });
      }
      await db.update(marinaLeases)
        .set({ ...leaseData, updatedAt: new Date() })
        .where(eq(marinaLeases.id, existing.id));
      return { created: false, updated: true, id: existing.id };
    }

    const [inserted] = await db.insert(marinaLeases).values(leaseData as any).returning({ id: marinaLeases.id });
    return { created: true, updated: false, id: inserted.id };
  }

  private async saveBillingRecord(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    const periodStart = data.periodStart
      ? new Date(data.periodStart).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const accountKeyMap: Record<string, string> = {
      slip_rent: 'marina.revenue.wet_slips',
      electricity: 'marina.revenue.electric_revenue',
      water: 'marina.revenue.water_revenue',
      fuel: 'marina.revenue.fuel_sales',
      service: 'marina.revenue.service_repair',
      other: 'marina.revenue.other_revenue',
    };

    const lineItems: Array<{ description: string; amount: number; category: string }> =
      data.lineItems && data.lineItems.length > 0
        ? data.lineItems
        : [{ description: 'Invoice total', amount: data.totalAmount || 0, category: 'other' }];

    let created = 0;
    let updated = 0;

    for (const item of lineItems) {
      const accountKey = accountKeyMap[item.category] || 'marina.revenue.other_revenue';
      const sourceRef = `havenstar:${data.externalId}:${item.category}`;

      const existing = await db.query.actualsFacts.findFirst({
        where: and(
          eq(actualsFacts.orgId, this.config.orgId),
          eq(actualsFacts.sourceRef, sourceRef)
        ),
      });

      if (existing) {
        await db.update(actualsFacts)
          .set({ amount: item.amount.toString(), updatedAt: new Date() })
          .where(eq(actualsFacts.id, existing.id));
        updated++;
      } else {
        await db.insert(actualsFacts).values({
          userId: this.config.userId,
          orgId: this.config.orgId,
          periodStart,
          lineType: 'REVENUE',
          accountKey,
          amount: item.amount.toString(),
          source: 'UPLOAD',
          sourceRef,
        });
        created++;
      }
    }

    return { created: created > 0, updated: updated > 0 };
  }

  private async saveContact(data: any): Promise<{ created: boolean; updated: boolean; id?: string }> {
    const existing = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.orgId, this.config.orgId),
        eq(crmContacts.externalId, data.externalId),
        eq(crmContacts.integrationSource, 'havenstar')
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
      integrationSource: 'havenstar',
    }).returning({ id: crmContacts.id });

    return { created: true, updated: false, id: inserted.id };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${HAVENSTAR_API_URL}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-API-Key': this.apiKey,
        'X-Facility-ID': this.facilityId,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new Error('Havenstar API key is invalid or expired. Please update your credentials.');
    }

    if (response.status === 403) {
      throw new Error('Access denied. Check your Havenstar API permissions.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Havenstar API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }
}
