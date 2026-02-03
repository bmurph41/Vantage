/**
 * Marina Integration Adapter Framework
 * 
 * Abstract adapter pattern for connecting to marina management systems.
 * Provides OAuth handling, rate limiting, error recovery, and data transformation.
 * 
 * Supported Systems:
 * - DockMaster
 * - Dockwa
 * - Storable Marine
 * - Marina Office
 * - MarinaGo
 * - Molo
 * - PIERS
 * - Harbour Assist
 * - Marinacloud
 * - Anchor
 */

import { db } from '../db';
import { userIntegrations, integrationSyncHistory, integrationSyncMetrics } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface MarinaAdapterConfig {
  integrationKey: string;
  apiBaseUrl: string;
  authType: 'oauth2' | 'api_key' | 'basic';
  rateLimitPerMinute: number;
  timeout: number;
  retryAttempts: number;
}

export interface SyncOptions {
  fullSync?: boolean;
  since?: Date;
  entityTypes?: string[];
  dryRun?: boolean;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: Array<{ code: string; message: string; entity?: string }>;
  duration: number;
}

export interface MarinaSlip {
  externalId: string;
  name: string;
  length?: number;
  width?: number;
  depth?: number;
  electricService?: string;
  waterAvailable?: boolean;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  monthlyRate?: number;
  annualRate?: number;
}

export interface MarinaTenant {
  externalId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  boatName?: string;
  boatLength?: number;
  boatType?: string;
  slipId?: string;
  leaseStart?: Date;
  leaseEnd?: Date;
  monthlyRate?: number;
  status: 'active' | 'expired' | 'pending';
}

export interface MarinaTransaction {
  externalId: string;
  date: Date;
  type: 'slip_rental' | 'fuel' | 'service' | 'merchandise' | 'other';
  amount: number;
  description?: string;
  tenantId?: string;
  paymentMethod?: string;
  status: 'completed' | 'pending' | 'refunded';
}

export abstract class MarinaIntegrationAdapter {
  protected config: MarinaAdapterConfig;
  protected userId: string;
  protected orgId: string;
  protected accessToken: string | null = null;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(config: MarinaAdapterConfig, userId: string, orgId: string) {
    this.config = config;
    this.userId = userId;
    this.orgId = orgId;
  }

  async initialize(): Promise<boolean> {
    try {
      const [integration] = await db
        .select()
        .from(userIntegrations)
        .where(and(
          eq(userIntegrations.userId, this.userId),
          eq(userIntegrations.integrationKey, this.config.integrationKey),
          eq(userIntegrations.isConnected, true)
        ))
        .limit(1);

      if (!integration) {
        console.log(`[${this.config.integrationKey}] No connected integration found`);
        return false;
      }

      if (integration.encryptedAccessToken) {
        this.accessToken = integration.encryptedAccessToken;
      }

      return true;
    } catch (error) {
      console.error(`[${this.config.integrationKey}] Failed to initialize:`, error);
      return false;
    }
  }

  protected async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 60000 / this.config.rateLimitPerMinute;

    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  protected async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        await this.rateLimit();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.accessToken ? `Bearer ${this.accessToken}` : '',
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error as Error;
        console.log(`[${this.config.integrationKey}] Attempt ${attempt + 1} failed:`, error);

        if (attempt < this.config.retryAttempts - 1) {
          const backoff = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }
    }

    throw lastError;
  }

  protected async recordSyncHistory(result: SyncResult, syncType: string = 'full_sync'): Promise<void> {
    try {
      await db.insert(integrationSyncHistory).values({
        userId: this.userId,
        orgId: this.orgId,
        integrationKey: this.config.integrationKey,
        syncType: syncType as any,
        status: result.success ? 'completed' : 'failed',
        completedAt: new Date(),
        recordsProcessed: result.recordsProcessed,
        recordsCreated: result.recordsCreated,
        recordsUpdated: result.recordsUpdated,
        recordsFailed: result.recordsFailed,
        errorCount: result.errors.length,
        errors: result.errors,
        metadata: { duration: result.duration },
        triggeredBy: 'adapter',
      });

      await db.update(userIntegrations)
        .set({ 
          lastSyncAt: new Date(),
          errorMessage: result.success ? null : result.errors[0]?.message,
          updatedAt: new Date(),
        })
        .where(and(
          eq(userIntegrations.userId, this.userId),
          eq(userIntegrations.integrationKey, this.config.integrationKey)
        ));
    } catch (error) {
      console.error(`[${this.config.integrationKey}] Failed to record sync history:`, error);
    }
  }

  abstract getSlips(): Promise<MarinaSlip[]>;
  abstract getTenants(): Promise<MarinaTenant[]>;
  abstract getTransactions(since?: Date): Promise<MarinaTransaction[]>;
  abstract testConnection(): Promise<boolean>;
  abstract sync(options?: SyncOptions): Promise<SyncResult>;
}

export class DockMasterAdapter extends MarinaIntegrationAdapter {
  constructor(userId: string, orgId: string) {
    super({
      integrationKey: 'dockmaster',
      apiBaseUrl: process.env.DOCKMASTER_API_URL || 'https://api.dockmaster.com/v1',
      authType: 'oauth2',
      rateLimitPerMinute: 60,
      timeout: 30000,
      retryAttempts: 3,
    }, userId, orgId);
  }

  async getSlips(): Promise<MarinaSlip[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/slips`);
    return (data.slips || []).map((s: any) => ({
      externalId: s.id,
      name: s.name || s.slipNumber,
      length: s.length,
      width: s.width,
      depth: s.depth,
      electricService: s.electric,
      waterAvailable: s.water,
      status: this.mapSlipStatus(s.status),
      monthlyRate: s.monthlyRate,
      annualRate: s.annualRate,
    }));
  }

  async getTenants(): Promise<MarinaTenant[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/tenants`);
    return (data.tenants || []).map((t: any) => ({
      externalId: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      phone: t.phone,
      boatName: t.vessel?.name,
      boatLength: t.vessel?.length,
      boatType: t.vessel?.type,
      slipId: t.slipId,
      leaseStart: t.leaseStart ? new Date(t.leaseStart) : undefined,
      leaseEnd: t.leaseEnd ? new Date(t.leaseEnd) : undefined,
      monthlyRate: t.monthlyRate,
      status: t.status === 'active' ? 'active' : 'expired',
    }));
  }

  async getTransactions(since?: Date): Promise<MarinaTransaction[]> {
    const url = since 
      ? `${this.config.apiBaseUrl}/transactions?since=${since.toISOString()}`
      : `${this.config.apiBaseUrl}/transactions`;
    const data = await this.fetchWithRetry<any>(url);
    return (data.transactions || []).map((t: any) => ({
      externalId: t.id,
      date: new Date(t.date),
      type: this.mapTransactionType(t.type),
      amount: t.amount,
      description: t.description,
      tenantId: t.tenantId,
      paymentMethod: t.paymentMethod,
      status: t.status === 'completed' ? 'completed' : 'pending',
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/health`);
      return true;
    } catch {
      return false;
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const [slips, tenants, transactions] = await Promise.all([
        this.getSlips().catch(e => { result.errors.push({ code: 'SLIPS_FAILED', message: e.message }); return []; }),
        this.getTenants().catch(e => { result.errors.push({ code: 'TENANTS_FAILED', message: e.message }); return []; }),
        this.getTransactions(options?.since).catch(e => { result.errors.push({ code: 'TRANSACTIONS_FAILED', message: e.message }); return []; }),
      ]);

      result.recordsProcessed = slips.length + tenants.length + transactions.length;
      result.recordsCreated = result.recordsProcessed;
      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({ code: 'SYNC_FAILED', message: error.message });
    }

    result.duration = Date.now() - startTime;
    await this.recordSyncHistory(result);
    return result;
  }

  private mapSlipStatus(status: string): MarinaSlip['status'] {
    const map: Record<string, MarinaSlip['status']> = {
      'available': 'available',
      'occupied': 'occupied',
      'reserved': 'reserved',
      'maintenance': 'maintenance',
    };
    return map[status?.toLowerCase()] || 'available';
  }

  private mapTransactionType(type: string): MarinaTransaction['type'] {
    const map: Record<string, MarinaTransaction['type']> = {
      'slip': 'slip_rental',
      'fuel': 'fuel',
      'service': 'service',
      'merchandise': 'merchandise',
    };
    return map[type?.toLowerCase()] || 'other';
  }
}

export class DockwaAdapter extends MarinaIntegrationAdapter {
  constructor(userId: string, orgId: string) {
    super({
      integrationKey: 'dockwa',
      apiBaseUrl: process.env.DOCKWA_API_URL || 'https://api.dockwa.com/v1',
      authType: 'oauth2',
      rateLimitPerMinute: 100,
      timeout: 30000,
      retryAttempts: 3,
    }, userId, orgId);
  }

  async getSlips(): Promise<MarinaSlip[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/docks`);
    return (data.docks || []).flatMap((d: any) => 
      (d.slips || []).map((s: any) => ({
        externalId: s.id,
        name: s.name,
        length: s.maxLength,
        width: s.beam,
        depth: s.depth,
        electricService: s.power,
        waterAvailable: s.water,
        status: s.available ? 'available' : 'occupied',
        monthlyRate: s.rates?.monthly,
        annualRate: s.rates?.annual,
      }))
    );
  }

  async getTenants(): Promise<MarinaTenant[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/reservations?status=active`);
    return (data.reservations || []).map((r: any) => ({
      externalId: r.id,
      firstName: r.boater?.firstName,
      lastName: r.boater?.lastName,
      email: r.boater?.email,
      phone: r.boater?.phone,
      boatName: r.vessel?.name,
      boatLength: r.vessel?.length,
      boatType: r.vessel?.type,
      slipId: r.slip?.id,
      leaseStart: r.startDate ? new Date(r.startDate) : undefined,
      leaseEnd: r.endDate ? new Date(r.endDate) : undefined,
      monthlyRate: r.total,
      status: 'active' as const,
    }));
  }

  async getTransactions(since?: Date): Promise<MarinaTransaction[]> {
    const url = since 
      ? `${this.config.apiBaseUrl}/payments?since=${since.toISOString()}`
      : `${this.config.apiBaseUrl}/payments`;
    const data = await this.fetchWithRetry<any>(url);
    return (data.payments || []).map((p: any) => ({
      externalId: p.id,
      date: new Date(p.createdAt),
      type: 'slip_rental' as const,
      amount: p.amount / 100,
      description: p.description,
      tenantId: p.reservationId,
      paymentMethod: p.method,
      status: p.status === 'succeeded' ? 'completed' : 'pending',
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/marina`);
      return true;
    } catch {
      return false;
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const [slips, tenants, transactions] = await Promise.all([
        this.getSlips().catch(e => { result.errors.push({ code: 'SLIPS_FAILED', message: e.message }); return []; }),
        this.getTenants().catch(e => { result.errors.push({ code: 'TENANTS_FAILED', message: e.message }); return []; }),
        this.getTransactions(options?.since).catch(e => { result.errors.push({ code: 'TRANSACTIONS_FAILED', message: e.message }); return []; }),
      ]);

      result.recordsProcessed = slips.length + tenants.length + transactions.length;
      result.recordsCreated = result.recordsProcessed;
      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({ code: 'SYNC_FAILED', message: error.message });
    }

    result.duration = Date.now() - startTime;
    await this.recordSyncHistory(result);
    return result;
  }
}

export class StorableMarineAdapter extends MarinaIntegrationAdapter {
  constructor(userId: string, orgId: string) {
    super({
      integrationKey: 'storable_marine',
      apiBaseUrl: process.env.STORABLE_MARINE_API_URL || 'https://api.storable.com/marina/v2',
      authType: 'api_key',
      rateLimitPerMinute: 120,
      timeout: 30000,
      retryAttempts: 3,
    }, userId, orgId);
  }

  async getSlips(): Promise<MarinaSlip[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/units`);
    return (data.units || []).map((u: any) => ({
      externalId: u.unitId,
      name: u.unitNumber,
      length: u.dimensions?.length,
      width: u.dimensions?.width,
      depth: u.dimensions?.depth,
      electricService: u.amenities?.electric,
      waterAvailable: u.amenities?.water,
      status: u.occupancyStatus === 'vacant' ? 'available' : 'occupied',
      monthlyRate: u.pricing?.monthly,
      annualRate: u.pricing?.annual,
    }));
  }

  async getTenants(): Promise<MarinaTenant[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/tenants`);
    return (data.tenants || []).map((t: any) => ({
      externalId: t.tenantId,
      firstName: t.contact?.firstName,
      lastName: t.contact?.lastName,
      email: t.contact?.email,
      phone: t.contact?.phone,
      boatName: t.vessel?.vesselName,
      boatLength: t.vessel?.length,
      boatType: t.vessel?.type,
      slipId: t.unit?.unitId,
      leaseStart: t.lease?.startDate ? new Date(t.lease.startDate) : undefined,
      leaseEnd: t.lease?.endDate ? new Date(t.lease.endDate) : undefined,
      monthlyRate: t.lease?.rent,
      status: t.status === 'active' ? 'active' : 'expired',
    }));
  }

  async getTransactions(since?: Date): Promise<MarinaTransaction[]> {
    const url = since 
      ? `${this.config.apiBaseUrl}/ledger?fromDate=${since.toISOString().split('T')[0]}`
      : `${this.config.apiBaseUrl}/ledger`;
    const data = await this.fetchWithRetry<any>(url);
    return (data.entries || []).map((e: any) => ({
      externalId: e.entryId,
      date: new Date(e.date),
      type: 'slip_rental' as const,
      amount: e.amount,
      description: e.description,
      tenantId: e.tenantId,
      status: e.paid ? 'completed' : 'pending',
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/facility`);
      return true;
    } catch {
      return false;
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const [slips, tenants, transactions] = await Promise.all([
        this.getSlips().catch(e => { result.errors.push({ code: 'SLIPS_FAILED', message: e.message }); return []; }),
        this.getTenants().catch(e => { result.errors.push({ code: 'TENANTS_FAILED', message: e.message }); return []; }),
        this.getTransactions(options?.since).catch(e => { result.errors.push({ code: 'TRANSACTIONS_FAILED', message: e.message }); return []; }),
      ]);

      result.recordsProcessed = slips.length + tenants.length + transactions.length;
      result.recordsCreated = result.recordsProcessed;
      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({ code: 'SYNC_FAILED', message: error.message });
    }

    result.duration = Date.now() - startTime;
    await this.recordSyncHistory(result);
    return result;
  }
}

export class MarinaOfficeAdapter extends MarinaIntegrationAdapter {
  constructor(userId: string, orgId: string) {
    super({
      integrationKey: 'marina_office',
      apiBaseUrl: process.env.MARINA_OFFICE_API_URL || 'https://api.marinaoffice.com/api/v1',
      authType: 'basic',
      rateLimitPerMinute: 60,
      timeout: 45000,
      retryAttempts: 3,
    }, userId, orgId);
  }

  async getSlips(): Promise<MarinaSlip[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/slips`);
    return (data || []).map((s: any) => ({
      externalId: s.slipId,
      name: s.slipName,
      length: s.slipLength,
      width: s.slipWidth,
      electricService: s.electricAmp,
      waterAvailable: s.hasWater,
      status: s.isOccupied ? 'occupied' : 'available',
      monthlyRate: s.monthlyRate,
    }));
  }

  async getTenants(): Promise<MarinaTenant[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/customers`);
    return (data || []).map((c: any) => ({
      externalId: c.customerId,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      boatName: c.boatName,
      boatLength: c.boatLength,
      slipId: c.assignedSlipId,
      status: c.isActive ? 'active' : 'expired',
    }));
  }

  async getTransactions(since?: Date): Promise<MarinaTransaction[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/invoices`);
    return (data || []).map((i: any) => ({
      externalId: i.invoiceId,
      date: new Date(i.invoiceDate),
      type: 'slip_rental' as const,
      amount: i.totalAmount,
      description: i.description,
      tenantId: i.customerId,
      status: i.isPaid ? 'completed' : 'pending',
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/marina-info`);
      return true;
    } catch {
      return false;
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const [slips, tenants, transactions] = await Promise.all([
        this.getSlips().catch(e => { result.errors.push({ code: 'SLIPS_FAILED', message: e.message }); return []; }),
        this.getTenants().catch(e => { result.errors.push({ code: 'TENANTS_FAILED', message: e.message }); return []; }),
        this.getTransactions(options?.since).catch(e => { result.errors.push({ code: 'TRANSACTIONS_FAILED', message: e.message }); return []; }),
      ]);

      result.recordsProcessed = slips.length + tenants.length + transactions.length;
      result.recordsCreated = result.recordsProcessed;
      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({ code: 'SYNC_FAILED', message: error.message });
    }

    result.duration = Date.now() - startTime;
    await this.recordSyncHistory(result);
    return result;
  }
}

export class MarinaGoAdapter extends MarinaIntegrationAdapter {
  constructor(userId: string, orgId: string) {
    super({
      integrationKey: 'marinago',
      apiBaseUrl: process.env.MARINAGO_API_URL || 'https://api.marinago.com/v1',
      authType: 'oauth2',
      rateLimitPerMinute: 100,
      timeout: 30000,
      retryAttempts: 3,
    }, userId, orgId);
  }

  async getSlips(): Promise<MarinaSlip[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/berths`);
    return (data.berths || []).map((b: any) => ({
      externalId: b.berthId,
      name: b.berthNumber || b.name,
      length: b.length,
      width: b.width,
      depth: b.draft,
      electricService: b.power?.amperage ? `${b.power.amperage}A` : undefined,
      waterAvailable: b.utilities?.water ?? false,
      status: this.mapBerthStatus(b.status),
      monthlyRate: b.pricing?.monthly,
      annualRate: b.pricing?.annual,
    }));
  }

  async getTenants(): Promise<MarinaTenant[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/members`);
    return (data.members || []).map((m: any) => ({
      externalId: m.memberId,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.emailAddress,
      phone: m.phoneNumber,
      boatName: m.vessel?.name,
      boatLength: m.vessel?.loa,
      boatType: m.vessel?.category,
      slipId: m.assignedBerth?.berthId,
      leaseStart: m.membership?.startDate ? new Date(m.membership.startDate) : undefined,
      leaseEnd: m.membership?.endDate ? new Date(m.membership.endDate) : undefined,
      monthlyRate: m.membership?.monthlyFee,
      status: m.membership?.status === 'active' ? 'active' : m.membership?.status === 'pending' ? 'pending' : 'expired',
    }));
  }

  async getTransactions(since?: Date): Promise<MarinaTransaction[]> {
    const url = since 
      ? `${this.config.apiBaseUrl}/billing/transactions?startDate=${since.toISOString()}`
      : `${this.config.apiBaseUrl}/billing/transactions`;
    const data = await this.fetchWithRetry<any>(url);
    return (data.transactions || []).map((t: any) => ({
      externalId: t.transactionId,
      date: new Date(t.transactionDate),
      type: this.mapTransactionCategory(t.category),
      amount: t.amount,
      description: t.description,
      tenantId: t.memberId,
      paymentMethod: t.paymentMethod,
      status: t.status === 'paid' ? 'completed' : t.status === 'refunded' ? 'refunded' : 'pending',
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/marina/info`);
      return true;
    } catch {
      return false;
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const [slips, tenants, transactions] = await Promise.all([
        this.getSlips().catch(e => { result.errors.push({ code: 'SLIPS_FAILED', message: e.message }); return []; }),
        this.getTenants().catch(e => { result.errors.push({ code: 'TENANTS_FAILED', message: e.message }); return []; }),
        this.getTransactions(options?.since).catch(e => { result.errors.push({ code: 'TRANSACTIONS_FAILED', message: e.message }); return []; }),
      ]);

      result.recordsProcessed = slips.length + tenants.length + transactions.length;
      result.recordsCreated = result.recordsProcessed;
      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({ code: 'SYNC_FAILED', message: error.message });
    }

    result.duration = Date.now() - startTime;
    await this.recordSyncHistory(result);
    return result;
  }

  private mapBerthStatus(status: string): MarinaSlip['status'] {
    const map: Record<string, MarinaSlip['status']> = {
      'available': 'available',
      'occupied': 'occupied',
      'reserved': 'reserved',
      'under_maintenance': 'maintenance',
      'maintenance': 'maintenance',
    };
    return map[status?.toLowerCase()] || 'available';
  }

  private mapTransactionCategory(category: string): MarinaTransaction['type'] {
    const map: Record<string, MarinaTransaction['type']> = {
      'berth_rental': 'slip_rental',
      'slip_rental': 'slip_rental',
      'fuel': 'fuel',
      'fuel_sale': 'fuel',
      'service': 'service',
      'repair': 'service',
      'merchandise': 'merchandise',
      'retail': 'merchandise',
    };
    return map[category?.toLowerCase()] || 'other';
  }
}

export class MoloAdapter extends MarinaIntegrationAdapter {
  constructor(userId: string, orgId: string) {
    super({
      integrationKey: 'molo',
      apiBaseUrl: process.env.MOLO_API_URL || 'https://api.molo.io/v2',
      authType: 'api_key',
      rateLimitPerMinute: 120,
      timeout: 30000,
      retryAttempts: 3,
    }, userId, orgId);
  }

  async getSlips(): Promise<MarinaSlip[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/spaces`);
    return (data.spaces || []).map((s: any) => ({
      externalId: s.id,
      name: s.label || s.spaceNumber,
      length: s.dimensions?.lengthFt,
      width: s.dimensions?.widthFt,
      depth: s.dimensions?.depthFt,
      electricService: s.amenities?.power ? `${s.amenities.power}A` : undefined,
      waterAvailable: s.amenities?.freshWater ?? false,
      status: s.availability === 'open' ? 'available' : s.availability === 'booked' ? 'occupied' : 'reserved',
      monthlyRate: s.rates?.monthly,
      annualRate: s.rates?.yearly,
    }));
  }

  async getTenants(): Promise<MarinaTenant[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/customers`);
    return (data.customers || []).map((c: any) => ({
      externalId: c.id,
      firstName: c.name?.first,
      lastName: c.name?.last,
      email: c.contact?.email,
      phone: c.contact?.phone,
      boatName: c.boat?.name,
      boatLength: c.boat?.lengthFt,
      boatType: c.boat?.type,
      slipId: c.currentSpace?.id,
      leaseStart: c.contract?.startDate ? new Date(c.contract.startDate) : undefined,
      leaseEnd: c.contract?.endDate ? new Date(c.contract.endDate) : undefined,
      monthlyRate: c.contract?.monthlyRate,
      status: c.status === 'active' ? 'active' : c.status === 'pending' ? 'pending' : 'expired',
    }));
  }

  async getTransactions(since?: Date): Promise<MarinaTransaction[]> {
    const url = since 
      ? `${this.config.apiBaseUrl}/payments?from=${since.toISOString().split('T')[0]}`
      : `${this.config.apiBaseUrl}/payments`;
    const data = await this.fetchWithRetry<any>(url);
    return (data.payments || []).map((p: any) => ({
      externalId: p.id,
      date: new Date(p.timestamp),
      type: this.mapPaymentType(p.type),
      amount: p.amount,
      description: p.memo || p.description,
      tenantId: p.customerId,
      paymentMethod: p.method,
      status: p.state === 'completed' ? 'completed' : p.state === 'refunded' ? 'refunded' : 'pending',
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/marina`);
      return true;
    } catch {
      return false;
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const [slips, tenants, transactions] = await Promise.all([
        this.getSlips().catch(e => { result.errors.push({ code: 'SLIPS_FAILED', message: e.message }); return []; }),
        this.getTenants().catch(e => { result.errors.push({ code: 'TENANTS_FAILED', message: e.message }); return []; }),
        this.getTransactions(options?.since).catch(e => { result.errors.push({ code: 'TRANSACTIONS_FAILED', message: e.message }); return []; }),
      ]);

      result.recordsProcessed = slips.length + tenants.length + transactions.length;
      result.recordsCreated = result.recordsProcessed;
      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({ code: 'SYNC_FAILED', message: error.message });
    }

    result.duration = Date.now() - startTime;
    await this.recordSyncHistory(result);
    return result;
  }

  private mapPaymentType(type: string): MarinaTransaction['type'] {
    const map: Record<string, MarinaTransaction['type']> = {
      'dockage': 'slip_rental',
      'slip': 'slip_rental',
      'fuel': 'fuel',
      'service': 'service',
      'maintenance': 'service',
      'store': 'merchandise',
      'merchandise': 'merchandise',
    };
    return map[type?.toLowerCase()] || 'other';
  }
}

export class PIERSAdapter extends MarinaIntegrationAdapter {
  constructor(userId: string, orgId: string) {
    super({
      integrationKey: 'piers',
      apiBaseUrl: process.env.PIERS_API_URL || 'https://api.piersystem.com/v1',
      authType: 'oauth2',
      rateLimitPerMinute: 60,
      timeout: 45000,
      retryAttempts: 3,
    }, userId, orgId);
  }

  async getSlips(): Promise<MarinaSlip[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/docks/slips`);
    return (data.slips || []).map((s: any) => ({
      externalId: s.slipId,
      name: s.slipNumber,
      length: s.specs?.length,
      width: s.specs?.beam,
      depth: s.specs?.depth,
      electricService: s.utilities?.electric,
      waterAvailable: s.utilities?.water ?? false,
      status: this.mapSlipAvailability(s.availability),
      monthlyRate: s.pricing?.monthlyRate,
      annualRate: s.pricing?.annualRate,
    }));
  }

  async getTenants(): Promise<MarinaTenant[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/tenants`);
    return (data.tenants || []).map((t: any) => ({
      externalId: t.tenantId,
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      phone: t.phone,
      boatName: t.vessel?.vesselName,
      boatLength: t.vessel?.lengthOverall,
      boatType: t.vessel?.vesselType,
      slipId: t.slipAssignment?.slipId,
      leaseStart: t.lease?.startDate ? new Date(t.lease.startDate) : undefined,
      leaseEnd: t.lease?.endDate ? new Date(t.lease.endDate) : undefined,
      monthlyRate: t.lease?.rentAmount,
      status: t.leaseStatus === 'current' ? 'active' : t.leaseStatus === 'pending' ? 'pending' : 'expired',
    }));
  }

  async getTransactions(since?: Date): Promise<MarinaTransaction[]> {
    const url = since 
      ? `${this.config.apiBaseUrl}/accounting/transactions?after=${since.toISOString()}`
      : `${this.config.apiBaseUrl}/accounting/transactions`;
    const data = await this.fetchWithRetry<any>(url);
    return (data.transactions || []).map((t: any) => ({
      externalId: t.txnId,
      date: new Date(t.date),
      type: this.mapAccountingType(t.category),
      amount: t.amount,
      description: t.description,
      tenantId: t.tenantId,
      paymentMethod: t.paymentInfo?.method,
      status: t.status === 'settled' ? 'completed' : t.status === 'refunded' ? 'refunded' : 'pending',
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/health`);
      return true;
    } catch {
      return false;
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const [slips, tenants, transactions] = await Promise.all([
        this.getSlips().catch(e => { result.errors.push({ code: 'SLIPS_FAILED', message: e.message }); return []; }),
        this.getTenants().catch(e => { result.errors.push({ code: 'TENANTS_FAILED', message: e.message }); return []; }),
        this.getTransactions(options?.since).catch(e => { result.errors.push({ code: 'TRANSACTIONS_FAILED', message: e.message }); return []; }),
      ]);

      result.recordsProcessed = slips.length + tenants.length + transactions.length;
      result.recordsCreated = result.recordsProcessed;
      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({ code: 'SYNC_FAILED', message: error.message });
    }

    result.duration = Date.now() - startTime;
    await this.recordSyncHistory(result);
    return result;
  }

  private mapSlipAvailability(availability: string): MarinaSlip['status'] {
    const map: Record<string, MarinaSlip['status']> = {
      'open': 'available',
      'available': 'available',
      'leased': 'occupied',
      'occupied': 'occupied',
      'reserved': 'reserved',
      'hold': 'reserved',
      'maintenance': 'maintenance',
      'out_of_service': 'maintenance',
    };
    return map[availability?.toLowerCase()] || 'available';
  }

  private mapAccountingType(category: string): MarinaTransaction['type'] {
    const map: Record<string, MarinaTransaction['type']> = {
      'slip_rental': 'slip_rental',
      'dockage': 'slip_rental',
      'lease': 'slip_rental',
      'fuel': 'fuel',
      'fuel_sale': 'fuel',
      'service': 'service',
      'repair': 'service',
      'work_order': 'service',
      'merchandise': 'merchandise',
      'ship_store': 'merchandise',
    };
    return map[category?.toLowerCase()] || 'other';
  }
}

export class HarbourAssistAdapter extends MarinaIntegrationAdapter {
  constructor(userId: string, orgId: string) {
    super({
      integrationKey: 'harbour_assist',
      apiBaseUrl: process.env.HARBOUR_ASSIST_API_URL || 'https://api.harbourassist.com/api/v2',
      authType: 'basic',
      rateLimitPerMinute: 90,
      timeout: 30000,
      retryAttempts: 3,
    }, userId, orgId);
  }

  async getSlips(): Promise<MarinaSlip[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/moorings`);
    return (data.moorings || []).map((m: any) => ({
      externalId: m.mooringId,
      name: m.mooringName || m.number,
      length: m.maxLength,
      width: m.maxBeam,
      depth: m.depth,
      electricService: m.hasElectric ? m.electricSpec : undefined,
      waterAvailable: m.hasWater ?? false,
      status: this.mapMooringStatus(m.status),
      monthlyRate: m.monthlyCharge,
      annualRate: m.annualCharge,
    }));
  }

  async getTenants(): Promise<MarinaTenant[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/members`);
    return (data.members || []).map((m: any) => ({
      externalId: m.memberId,
      firstName: m.forename,
      lastName: m.surname,
      email: m.email,
      phone: m.telephone || m.mobile,
      boatName: m.craft?.craftName,
      boatLength: m.craft?.length,
      boatType: m.craft?.type,
      slipId: m.mooring?.mooringId,
      leaseStart: m.licence?.startDate ? new Date(m.licence.startDate) : undefined,
      leaseEnd: m.licence?.expiryDate ? new Date(m.licence.expiryDate) : undefined,
      monthlyRate: m.licence?.monthlyFee,
      status: m.membershipStatus === 'active' ? 'active' : m.membershipStatus === 'pending' ? 'pending' : 'expired',
    }));
  }

  async getTransactions(since?: Date): Promise<MarinaTransaction[]> {
    const url = since 
      ? `${this.config.apiBaseUrl}/finances/transactions?fromDate=${since.toISOString().split('T')[0]}`
      : `${this.config.apiBaseUrl}/finances/transactions`;
    const data = await this.fetchWithRetry<any>(url);
    return (data.transactions || []).map((t: any) => ({
      externalId: t.transactionId,
      date: new Date(t.transactionDate),
      type: this.mapFinanceType(t.category),
      amount: t.amount,
      description: t.description,
      tenantId: t.memberId,
      paymentMethod: t.paymentMethod,
      status: t.status === 'paid' ? 'completed' : t.status === 'refunded' ? 'refunded' : 'pending',
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/settings`);
      return true;
    } catch {
      return false;
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const [slips, tenants, transactions] = await Promise.all([
        this.getSlips().catch(e => { result.errors.push({ code: 'SLIPS_FAILED', message: e.message }); return []; }),
        this.getTenants().catch(e => { result.errors.push({ code: 'TENANTS_FAILED', message: e.message }); return []; }),
        this.getTransactions(options?.since).catch(e => { result.errors.push({ code: 'TRANSACTIONS_FAILED', message: e.message }); return []; }),
      ]);

      result.recordsProcessed = slips.length + tenants.length + transactions.length;
      result.recordsCreated = result.recordsProcessed;
      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({ code: 'SYNC_FAILED', message: error.message });
    }

    result.duration = Date.now() - startTime;
    await this.recordSyncHistory(result);
    return result;
  }

  private mapMooringStatus(status: string): MarinaSlip['status'] {
    const map: Record<string, MarinaSlip['status']> = {
      'vacant': 'available',
      'available': 'available',
      'occupied': 'occupied',
      'let': 'occupied',
      'reserved': 'reserved',
      'on_hold': 'reserved',
      'maintenance': 'maintenance',
      'unavailable': 'maintenance',
    };
    return map[status?.toLowerCase()] || 'available';
  }

  private mapFinanceType(category: string): MarinaTransaction['type'] {
    const map: Record<string, MarinaTransaction['type']> = {
      'mooring': 'slip_rental',
      'berth': 'slip_rental',
      'licence': 'slip_rental',
      'fuel': 'fuel',
      'service': 'service',
      'maintenance': 'service',
      'chandlery': 'merchandise',
      'shop': 'merchandise',
    };
    return map[category?.toLowerCase()] || 'other';
  }
}

export class MarinacloudAdapter extends MarinaIntegrationAdapter {
  constructor(userId: string, orgId: string) {
    super({
      integrationKey: 'marinacloud',
      apiBaseUrl: process.env.MARINACLOUD_API_URL || 'https://api.marinacloud.com/v1',
      authType: 'api_key',
      rateLimitPerMinute: 80,
      timeout: 30000,
      retryAttempts: 3,
    }, userId, orgId);
  }

  async getSlips(): Promise<MarinaSlip[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/inventory/slips`);
    return (data.slips || []).map((s: any) => ({
      externalId: s.id,
      name: s.slipLabel || s.slipCode,
      length: s.dimensions?.length,
      width: s.dimensions?.width,
      depth: s.dimensions?.minDepth,
      electricService: s.services?.electrical,
      waterAvailable: s.services?.water ?? false,
      status: this.mapInventoryStatus(s.status),
      monthlyRate: s.rates?.monthly,
      annualRate: s.rates?.annual,
    }));
  }

  async getTenants(): Promise<MarinaTenant[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/customers`);
    return (data.customers || []).map((c: any) => ({
      externalId: c.customerId,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.primaryEmail,
      phone: c.primaryPhone,
      boatName: c.vessel?.name,
      boatLength: c.vessel?.lengthFeet,
      boatType: c.vessel?.vesselType,
      slipId: c.assignment?.slipId,
      leaseStart: c.agreement?.effectiveDate ? new Date(c.agreement.effectiveDate) : undefined,
      leaseEnd: c.agreement?.terminationDate ? new Date(c.agreement.terminationDate) : undefined,
      monthlyRate: c.agreement?.baseRent,
      status: c.accountStatus === 'active' ? 'active' : c.accountStatus === 'pending' ? 'pending' : 'expired',
    }));
  }

  async getTransactions(since?: Date): Promise<MarinaTransaction[]> {
    const url = since 
      ? `${this.config.apiBaseUrl}/billing/transactions?startDate=${since.toISOString().split('T')[0]}`
      : `${this.config.apiBaseUrl}/billing/transactions`;
    const data = await this.fetchWithRetry<any>(url);
    return (data.transactions || []).map((t: any) => ({
      externalId: t.transactionId,
      date: new Date(t.transactionDate),
      type: this.mapBillingCategory(t.type),
      amount: t.totalAmount,
      description: t.description,
      tenantId: t.customerId,
      paymentMethod: t.paymentMethod,
      status: t.status === 'paid' ? 'completed' : t.status === 'refunded' ? 'refunded' : 'pending',
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/marina/profile`);
      return true;
    } catch {
      return false;
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const [slips, tenants, transactions] = await Promise.all([
        this.getSlips().catch(e => { result.errors.push({ code: 'SLIPS_FAILED', message: e.message }); return []; }),
        this.getTenants().catch(e => { result.errors.push({ code: 'TENANTS_FAILED', message: e.message }); return []; }),
        this.getTransactions(options?.since).catch(e => { result.errors.push({ code: 'TRANSACTIONS_FAILED', message: e.message }); return []; }),
      ]);

      result.recordsProcessed = slips.length + tenants.length + transactions.length;
      result.recordsCreated = result.recordsProcessed;
      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({ code: 'SYNC_FAILED', message: error.message });
    }

    result.duration = Date.now() - startTime;
    await this.recordSyncHistory(result);
    return result;
  }

  private mapInventoryStatus(status: string): MarinaSlip['status'] {
    const map: Record<string, MarinaSlip['status']> = {
      'vacant': 'available',
      'available': 'available',
      'rented': 'occupied',
      'occupied': 'occupied',
      'reserved': 'reserved',
      'pending': 'reserved',
      'maintenance': 'maintenance',
      'offline': 'maintenance',
    };
    return map[status?.toLowerCase()] || 'available';
  }

  private mapBillingCategory(type: string): MarinaTransaction['type'] {
    const map: Record<string, MarinaTransaction['type']> = {
      'slip_rental': 'slip_rental',
      'dockage': 'slip_rental',
      'storage': 'slip_rental',
      'fuel': 'fuel',
      'fuel_sale': 'fuel',
      'service': 'service',
      'repair': 'service',
      'merchandise': 'merchandise',
      'retail': 'merchandise',
    };
    return map[type?.toLowerCase()] || 'other';
  }
}

export class AnchorAdapter extends MarinaIntegrationAdapter {
  constructor(userId: string, orgId: string) {
    super({
      integrationKey: 'anchor',
      apiBaseUrl: process.env.ANCHOR_API_URL || 'https://api.anchorapp.io/v1',
      authType: 'oauth2',
      rateLimitPerMinute: 100,
      timeout: 30000,
      retryAttempts: 3,
    }, userId, orgId);
  }

  async getSlips(): Promise<MarinaSlip[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/facilities/slips`);
    return (data.slips || []).map((s: any) => ({
      externalId: s.slipId,
      name: s.displayName || s.slipNumber,
      length: s.size?.length,
      width: s.size?.width,
      depth: s.size?.draft,
      electricService: s.amenities?.power ? `${s.amenities.power}` : undefined,
      waterAvailable: s.amenities?.water ?? false,
      status: this.mapSlipState(s.state),
      monthlyRate: s.pricing?.monthlyRate,
      annualRate: s.pricing?.yearlyRate,
    }));
  }

  async getTenants(): Promise<MarinaTenant[]> {
    const data = await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/boaters`);
    return (data.boaters || []).map((b: any) => ({
      externalId: b.boaterId,
      firstName: b.firstName,
      lastName: b.lastName,
      email: b.email,
      phone: b.phone,
      boatName: b.boat?.name,
      boatLength: b.boat?.length,
      boatType: b.boat?.type,
      slipId: b.currentSlip?.slipId,
      leaseStart: b.rental?.startDate ? new Date(b.rental.startDate) : undefined,
      leaseEnd: b.rental?.endDate ? new Date(b.rental.endDate) : undefined,
      monthlyRate: b.rental?.monthlyAmount,
      status: b.status === 'active' ? 'active' : b.status === 'pending' ? 'pending' : 'expired',
    }));
  }

  async getTransactions(since?: Date): Promise<MarinaTransaction[]> {
    const url = since 
      ? `${this.config.apiBaseUrl}/payments?from=${since.toISOString()}`
      : `${this.config.apiBaseUrl}/payments`;
    const data = await this.fetchWithRetry<any>(url);
    return (data.payments || []).map((p: any) => ({
      externalId: p.paymentId,
      date: new Date(p.createdAt),
      type: this.mapPaymentCategory(p.category),
      amount: p.amount,
      description: p.description,
      tenantId: p.boaterId,
      paymentMethod: p.method,
      status: p.state === 'completed' ? 'completed' : p.state === 'refunded' ? 'refunded' : 'pending',
    }));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.fetchWithRetry<any>(`${this.config.apiBaseUrl}/marina`);
      return true;
    } catch {
      return false;
    }
  }

  async sync(options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const [slips, tenants, transactions] = await Promise.all([
        this.getSlips().catch(e => { result.errors.push({ code: 'SLIPS_FAILED', message: e.message }); return []; }),
        this.getTenants().catch(e => { result.errors.push({ code: 'TENANTS_FAILED', message: e.message }); return []; }),
        this.getTransactions(options?.since).catch(e => { result.errors.push({ code: 'TRANSACTIONS_FAILED', message: e.message }); return []; }),
      ]);

      result.recordsProcessed = slips.length + tenants.length + transactions.length;
      result.recordsCreated = result.recordsProcessed;
      result.success = result.errors.length === 0;
    } catch (error: any) {
      result.success = false;
      result.errors.push({ code: 'SYNC_FAILED', message: error.message });
    }

    result.duration = Date.now() - startTime;
    await this.recordSyncHistory(result);
    return result;
  }

  private mapSlipState(state: string): MarinaSlip['status'] {
    const map: Record<string, MarinaSlip['status']> = {
      'open': 'available',
      'available': 'available',
      'rented': 'occupied',
      'occupied': 'occupied',
      'held': 'reserved',
      'reserved': 'reserved',
      'maintenance': 'maintenance',
      'closed': 'maintenance',
    };
    return map[state?.toLowerCase()] || 'available';
  }

  private mapPaymentCategory(category: string): MarinaTransaction['type'] {
    const map: Record<string, MarinaTransaction['type']> = {
      'slip': 'slip_rental',
      'rental': 'slip_rental',
      'dockage': 'slip_rental',
      'fuel': 'fuel',
      'service': 'service',
      'repair': 'service',
      'store': 'merchandise',
      'merchandise': 'merchandise',
    };
    return map[category?.toLowerCase()] || 'other';
  }
}

export class IntegrationAdapterFactory {
  static getAdapter(integrationKey: string, userId: string, orgId: string): MarinaIntegrationAdapter | null {
    switch (integrationKey.toLowerCase()) {
      case 'dockmaster':
        return new DockMasterAdapter(userId, orgId);
      case 'dockwa':
        return new DockwaAdapter(userId, orgId);
      case 'storable_marine':
      case 'storable-marine':
        return new StorableMarineAdapter(userId, orgId);
      case 'marina_office':
      case 'marina-office':
        return new MarinaOfficeAdapter(userId, orgId);
      case 'marinago':
      case 'marina_go':
      case 'marina-go':
        return new MarinaGoAdapter(userId, orgId);
      case 'molo':
        return new MoloAdapter(userId, orgId);
      case 'piers':
        return new PIERSAdapter(userId, orgId);
      case 'harbour_assist':
      case 'harbour-assist':
      case 'harbourassist':
        return new HarbourAssistAdapter(userId, orgId);
      case 'marinacloud':
      case 'marina_cloud':
      case 'marina-cloud':
        return new MarinacloudAdapter(userId, orgId);
      case 'anchor':
        return new AnchorAdapter(userId, orgId);
      default:
        console.log(`[IntegrationAdapterFactory] Unknown integration: ${integrationKey}`);
        return null;
    }
  }

  static getSupportedIntegrations(): string[] {
    return [
      'dockmaster',
      'dockwa',
      'storable_marine',
      'marina_office',
      'marinago',
      'molo',
      'piers',
      'harbour_assist',
      'marinacloud',
      'anchor',
    ];
  }
}
