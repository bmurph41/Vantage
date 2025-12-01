import { 
  type Customer, type InsertCustomer,
  type Boat, type InsertBoat,
  type Slip, type InsertSlip,
  type Lease, type InsertLease,
  type Launch, type InsertLaunch,
  type Payment, type InsertPayment,
  type Integration, type InsertIntegration,
  type Communication, type InsertCommunication,
  type ImportJob, type InsertImportJob,
  type ImportError, type InsertImportError,
  type MarinaLayout, type InsertMarinaLayout,
  type Reservation, type InsertReservation,
  type PricingRule, type InsertPricingRule,
  type SlipPricing, type InsertSlipPricing,
  type Marina, type InsertMarina,
  type MessageThread, type InsertMessageThread,
  type Message, type InsertMessage,
  type User, type UpsertUser,
  type Organization, type InsertOrganization,
  type AnalyticsSnapshot, type InsertAnalyticsSnapshot,
  type Contract, type InsertContract,
  type ContractTemplate, type InsertContractTemplate,
  type AuditLog, type InsertAuditLog,
  type ApiKey, type InsertApiKey,
  type Webhook, type InsertWebhook,
  type WebhookDelivery, type InsertWebhookDelivery,
  customers, boats, slips, leases, launches, payments, integrations, communications,
  importJobs, importErrors, marinaLayouts, reservations, pricingRules, slipPricing, marinas,
  messageThreads, messages, users, organizations, analyticsSnapshots, contracts, contractTemplates, auditLogs,
  apiKeys, webhooks, webhookDeliveries
} from "../shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql, desc, asc, or, not } from "drizzle-orm";

export interface IStorage {
  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizations(): Promise<Organization[]>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization | undefined>;
  
  // Marinas
  getMarina(id: string): Promise<Marina | undefined>;
  getMarinas(): Promise<Marina[]>;
  getMarinasByOrganization(organizationId: string): Promise<Marina[]>;
  createMarina(marina: InsertMarina): Promise<Marina>;
  updateMarina(id: string, updates: Partial<InsertMarina>): Promise<Marina | undefined>;

  // Customers
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomers(): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, updates: Partial<InsertCustomer> & { lastLaunchDate?: Date }): Promise<Customer | undefined>;
  updateCustomerStripeInfo(id: string, stripeCustomerId: string): Promise<Customer | undefined>;
  
  // Boats
  getBoat(id: string): Promise<Boat | undefined>;
  getBoats(): Promise<Boat[]>;
  getBoatsByCustomer(customerId: string): Promise<Boat[]>;
  createBoat(boat: InsertBoat): Promise<Boat>;
  updateBoat(id: string, updates: Partial<InsertBoat>): Promise<Boat | undefined>;
  
  // Slips
  getSlip(id: string): Promise<Slip | undefined>;
  getSlips(): Promise<Slip[]>;
  getAvailableSlips(): Promise<Slip[]>;
  createSlip(slip: InsertSlip): Promise<Slip>;
  updateSlip(id: string, updates: Partial<InsertSlip>): Promise<Slip | undefined>;
  
  // Leases
  getLease(id: string): Promise<Lease | undefined>;
  getLeases(): Promise<Lease[]>;
  getActiveLeases(): Promise<Lease[]>;
  getLeasesByCustomer(customerId: string): Promise<Lease[]>;
  createLease(lease: InsertLease): Promise<Lease>;
  updateLease(id: string, updates: Partial<InsertLease>): Promise<Lease | undefined>;
  
  // Launches
  getLaunch(id: string): Promise<Launch | undefined>;
  getLaunches(): Promise<Launch[]>;
  getTodaysLaunches(): Promise<Launch[]>;
  getUpcomingLaunches(): Promise<Launch[]>;
  createLaunch(launch: InsertLaunch): Promise<Launch>;
  updateLaunch(id: string, updates: Partial<InsertLaunch>): Promise<Launch | undefined>;
  updateLaunchWithConflictCheck(id: string, updates: Partial<InsertLaunch>): Promise<Launch | undefined>;
  // SpeedyDock-style queue management
  getQueueLength(): Promise<number>;
  getLaunchQueue(): Promise<Launch[]>;
  checkInLaunch(launchId: string, checkInData: { customerLocation: any; timestamp: number }): Promise<Launch>;
  getLaunchesByCustomer(customerId: string, status?: string): Promise<Launch[]>;
  
  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  getPayments(): Promise<Payment[]>;
  getOverduePayments(): Promise<Payment[]>;
  getPaymentsByCustomer(customerId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment | undefined>;
  
  // Integrations
  getIntegrations(): Promise<Integration[]>;
  getIntegration(platform: string): Promise<Integration | undefined>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegration(id: string, updates: Partial<InsertIntegration>): Promise<Integration | undefined>;
  
  // Communications
  getCommunications(): Promise<Communication[]>;
  getCommunicationsByCustomer(customerId: string): Promise<Communication[]>;
  createCommunication(communication: InsertCommunication): Promise<Communication>;
  updateCommunication(id: string, updates: Partial<InsertCommunication>): Promise<Communication | undefined>;
  
  // Import Jobs
  getImportJob(id: string): Promise<ImportJob | undefined>;
  getImportJobs(): Promise<ImportJob[]>;
  getRecentImportJobs(limit?: number): Promise<ImportJob[]>;
  createImportJob(importJob: InsertImportJob): Promise<ImportJob>;
  updateImportJob(id: string, updates: Partial<InsertImportJob>): Promise<ImportJob | undefined>;
  
  // Import Errors
  getImportError(id: string): Promise<ImportError | undefined>;
  getImportErrors(): Promise<ImportError[]>;
  getImportErrorsByJob(jobId: string): Promise<ImportError[]>;
  createImportError(importError: InsertImportError): Promise<ImportError>;
  clearImportErrors(jobId: string): Promise<void>;
  
  // Marina map data
  getMarinaMapData(): Promise<{
    slips: Array<{
      id: string;
      number: string;
      type: string;
      section: string;
      maxLength: string;
      maxBeam: string;
      maxDraft: string | null;
      utilities: string[] | null;
      monthlyRate: string;
      isOccupied: boolean;
      currentBoatId: string | null;
      customer: Customer | null;
      boat: Boat | null;
      lease: Lease | null;
      paymentStatus: string | null;
      lastPaymentDate: Date | null;
      launchCount: number;
    }>;
    stats: {
      totalSlips: number;
      occupiedSlips: number;
      availableSlips: number;
      occupancyRate: number;
      slipsBySection: Record<string, number>;
      slipsByType: Record<string, number>;
    };
  }>;

  // Dashboard analytics
  getDashboardStats(): Promise<{
    todaysLaunches: number;
    availableSlips: number;
    totalSlips: number;
    monthlyRevenue: number;
    occupancyRate: number;
    occupiedSlips: number;
    overduePayments: number;
  }>;

  // Marina layout management
  getMarinaLayouts(): Promise<MarinaLayout[]>;
  getMarinaLayoutById(id: string): Promise<MarinaLayout | null>;
  createMarinaLayout(data: InsertMarinaLayout): Promise<MarinaLayout>;
  updateMarinaLayout(id: string, data: Partial<InsertMarinaLayout>): Promise<MarinaLayout>;
  deleteMarinaLayout(id: string): Promise<void>;
  setActiveLayout(id: string): Promise<void>;
  
  // Transient Reservations
  getReservation(id: string): Promise<Reservation | undefined>;
  getReservations(): Promise<Reservation[]>;
  getReservationsByDateRange(startDate: Date, endDate: Date): Promise<Reservation[]>;
  getReservationsByCustomer(customerId: string): Promise<Reservation[]>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: string, updates: Partial<InsertReservation>): Promise<Reservation | undefined>;
  cancelReservation(id: string): Promise<Reservation | undefined>;
  checkSlipAvailability(slipId: string, checkInDate: Date, checkOutDate: Date): Promise<boolean>;
  findAvailableSlips(marinaId: string, checkInDate: Date, checkOutDate: Date, boatLength: number, boatBeam: number): Promise<Slip[]>;
  
  // Pricing Rules
  getPricingRules(): Promise<PricingRule[]>;
  getPricingRule(id: string): Promise<PricingRule | undefined>;
  getActivePricingRule(marinaId: string, date: Date): Promise<PricingRule | undefined>;
  createPricingRule(rule: InsertPricingRule): Promise<PricingRule>;
  updatePricingRule(id: string, updates: Partial<InsertPricingRule>): Promise<PricingRule | undefined>;
  deletePricingRule(id: string): Promise<boolean>;
  
  // Slip Pricing
  getAllSlipPricing(): Promise<SlipPricing[]>;
  getSlipPricing(slipId: string): Promise<SlipPricing | undefined>;
  createSlipPricing(pricing: InsertSlipPricing): Promise<SlipPricing>;
  updateSlipPricing(id: string, updates: Partial<InsertSlipPricing>): Promise<SlipPricing | undefined>;
  
  // Messaging - Message Threads
  getMessageThread(id: string): Promise<MessageThread | undefined>;
  getMessageThreads(marinaId?: string): Promise<MessageThread[]>;
  getMessageThreadsByCustomer(customerId: string): Promise<MessageThread[]>;
  getMessageThreadParticipants(threadId: string): Promise<string[]>;
  createMessageThread(thread: InsertMessageThread): Promise<MessageThread>;
  updateMessageThread(id: string, updates: Partial<InsertMessageThread>): Promise<MessageThread | undefined>;
  
  // Messaging - Messages
  getMessage(id: string): Promise<Message | undefined>;
  getMessages(threadId: string): Promise<Message[]>;
  getUnreadMessageCount(userId: string, userType: string): Promise<number>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(messageId: string): Promise<Message | undefined>;
  markThreadAsRead(threadId: string, userId: string): Promise<void>;
  
  // User operations for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  
  // Analytics
  getAnalyticsSnapshots(marinaId?: string, period?: string, startDate?: Date, endDate?: Date): Promise<AnalyticsSnapshot[]>;
  getLatestAnalyticsSnapshot(marinaId: string): Promise<AnalyticsSnapshot | undefined>;
  createAnalyticsSnapshot(snapshot: InsertAnalyticsSnapshot): Promise<AnalyticsSnapshot>;
  
  // Contracts and E-signatures
  getContract(id: string): Promise<Contract | undefined>;
  getContracts(marinaId?: string): Promise<Contract[]>;
  getContractsByCustomer(customerId: string): Promise<Contract[]>;
  getContractsByStatus(status: string, marinaId?: string): Promise<Contract[]>;
  getPendingContracts(expiringWithinDays?: number): Promise<Contract[]>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, updates: Partial<InsertContract>): Promise<Contract | undefined>;
  signContract(id: string, signatureData: { signedBy: string; ipAddress: string; userAgent: string; signatureImageUrl?: string }): Promise<Contract | undefined>;
  
  // Contract Templates
  getContractTemplate(id: string): Promise<ContractTemplate | undefined>;
  getContractTemplates(marinaId?: string): Promise<ContractTemplate[]>;
  getDefaultTemplates(): Promise<ContractTemplate[]>;
  createContractTemplate(template: InsertContractTemplate): Promise<ContractTemplate>;
  updateContractTemplate(id: string, updates: Partial<InsertContractTemplate>): Promise<ContractTemplate | undefined>;
  deleteContractTemplate(id: string): Promise<boolean>;
  
  // Audit Logs
  getAuditLog(id: string): Promise<AuditLog | undefined>;
  getAuditLogs(options?: {
    marinaId?: string;
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogStats(marinaId?: string, startDate?: Date, endDate?: Date): Promise<{
    totalLogs: number;
    actionCounts: Record<string, number>;
    entityCounts: Record<string, number>;
    userCounts: Record<string, number>;
  }>;
  
  // API Keys
  getApiKey(id: string): Promise<ApiKey | undefined>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  getApiKeys(organizationId: string): Promise<ApiKey[]>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: string, updates: Partial<InsertApiKey>): Promise<ApiKey | undefined>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  deleteApiKey(id: string): Promise<boolean>;
  revokeApiKey(id: string): Promise<boolean>;
  
  // Webhooks
  getWebhook(id: string): Promise<Webhook | undefined>;
  getWebhooks(organizationId: string): Promise<Webhook[]>;
  getWebhooksByMarina(marinaId: string): Promise<Webhook[]>;
  getActiveWebhooksForEvent(event: string, marinaId?: string): Promise<Webhook[]>;
  createWebhook(webhook: InsertWebhook): Promise<Webhook>;
  updateWebhook(id: string, updates: Partial<InsertWebhook>): Promise<Webhook | undefined>;
  deleteWebhook(id: string): Promise<boolean>;
  incrementWebhookFailure(id: string): Promise<void>;
  resetWebhookFailures(id: string): Promise<void>;
  
  // Webhook Deliveries
  getWebhookDelivery(id: string): Promise<WebhookDelivery | undefined>;
  getWebhookDeliveries(webhookId: string, limit?: number): Promise<WebhookDelivery[]>;
  getRecentDeliveries(webhookId: string, limit?: number): Promise<WebhookDelivery[]>;
  getPendingDeliveries(): Promise<WebhookDelivery[]>;
  getFailedDeliveries(webhookId?: string): Promise<WebhookDelivery[]>;
  createWebhookDelivery(delivery: InsertWebhookDelivery): Promise<WebhookDelivery>;
  updateWebhookDelivery(id: string, updates: Partial<InsertWebhookDelivery>): Promise<WebhookDelivery | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Organizations
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org || undefined;
  }

  async getOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations).orderBy(asc(organizations.name));
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    const [org] = await db
      .insert(organizations)
      .values(insertOrg)
      .returning();
    return org;
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [org] = await db
      .update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return org || undefined;
  }

  // Marinas
  async getMarina(id: string): Promise<Marina | undefined> {
    const [marina] = await db.select().from(marinas).where(eq(marinas.id, id));
    return marina || undefined;
  }

  async getMarinas(): Promise<Marina[]> {
    return await db.select().from(marinas);
  }

  async getMarinasByOrganization(organizationId: string): Promise<Marina[]> {
    return await db.select().from(marinas).where(eq(marinas.organizationId, organizationId)).orderBy(asc(marinas.name));
  }

  async createMarina(insertMarina: InsertMarina): Promise<Marina> {
    const [marina] = await db
      .insert(marinas)
      .values(insertMarina)
      .returning();
    return marina;
  }

  async updateMarina(id: string, updates: Partial<InsertMarina>): Promise<Marina | undefined> {
    const [marina] = await db
      .update(marinas)
      .set(updates)
      .where(eq(marinas.id, id))
      .returning();
    return marina || undefined;
  }

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db
      .insert(customers)
      .values(insertCustomer)
      .returning();
    return customer;
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer> & { lastLaunchDate?: Date }): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set(updates)
      .where(eq(customers.id, id))
      .returning();
    return customer || undefined;
  }

  async updateCustomerStripeInfo(id: string, stripeCustomerId: string): Promise<Customer | undefined> {
    const [customer] = await db
      .update(customers)
      .set({ stripeCustomerId })
      .where(eq(customers.id, id))
      .returning();
    return customer || undefined;
  }

  // Boats
  async getBoat(id: string): Promise<Boat | undefined> {
    const [boat] = await db.select().from(boats).where(eq(boats.id, id));
    return boat || undefined;
  }

  async getBoats(): Promise<Boat[]> {
    return await db.select().from(boats);
  }

  async getBoatsByCustomer(customerId: string): Promise<Boat[]> {
    return await db.select().from(boats).where(eq(boats.customerId, customerId));
  }

  async createBoat(insertBoat: InsertBoat): Promise<Boat> {
    const [boat] = await db
      .insert(boats)
      .values(insertBoat)
      .returning();
    return boat;
  }

  async updateBoat(id: string, updates: Partial<InsertBoat>): Promise<Boat | undefined> {
    const [boat] = await db
      .update(boats)
      .set(updates)
      .where(eq(boats.id, id))
      .returning();
    return boat || undefined;
  }

  // Slips
  async getSlip(id: string): Promise<Slip | undefined> {
    const [slip] = await db.select().from(slips).where(eq(slips.id, id));
    return slip || undefined;
  }

  async getSlips(): Promise<Slip[]> {
    return await db.select().from(slips);
  }

  async getAvailableSlips(): Promise<Slip[]> {
    return await db.select().from(slips).where(eq(slips.isOccupied, false));
  }

  async createSlip(insertSlip: InsertSlip): Promise<Slip> {
    const [slip] = await db
      .insert(slips)
      .values(insertSlip)
      .returning();
    return slip;
  }

  async updateSlip(id: string, updates: Partial<InsertSlip>): Promise<Slip | undefined> {
    const [slip] = await db
      .update(slips)
      .set(updates)
      .where(eq(slips.id, id))
      .returning();
    return slip || undefined;
  }

  // Leases
  async getLease(id: string): Promise<Lease | undefined> {
    const [lease] = await db.select().from(leases).where(eq(leases.id, id));
    return lease || undefined;
  }

  async getLeases(): Promise<Lease[]> {
    return await db.select().from(leases);
  }

  async getActiveLeases(): Promise<Lease[]> {
    return await db.select().from(leases).where(eq(leases.status, "active"));
  }

  async getLeasesByCustomer(customerId: string): Promise<Lease[]> {
    return await db.select().from(leases).where(eq(leases.customerId, customerId));
  }

  async createLease(insertLease: InsertLease): Promise<Lease> {
    const [lease] = await db
      .insert(leases)
      .values(insertLease)
      .returning();
    
    // Update slip occupancy
    await db
      .update(slips)
      .set({
        isOccupied: true,
        currentBoatId: insertLease.boatId,
      })
      .where(eq(slips.id, insertLease.slipId));
    
    return lease;
  }

  async updateLease(id: string, updates: Partial<InsertLease>): Promise<Lease | undefined> {
    const [lease] = await db
      .update(leases)
      .set(updates)
      .where(eq(leases.id, id))
      .returning();
    
    if (lease && (updates.status === "terminated" || updates.status === "expired")) {
      // Update slip occupancy
      await db
        .update(slips)
        .set({
          isOccupied: false,
          currentBoatId: null,
        })
        .where(eq(slips.id, lease.slipId));
    }
    
    return lease || undefined;
  }

  // Launches
  async getLaunch(id: string): Promise<Launch | undefined> {
    const [launch] = await db.select().from(launches).where(eq(launches.id, id));
    return launch || undefined;
  }

  async getLaunches(): Promise<Launch[]> {
    return await db.select().from(launches);
  }

  async getTodaysLaunches(): Promise<Launch[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return await db.select().from(launches).where(
      and(
        gte(launches.scheduledTime, today),
        lte(launches.scheduledTime, tomorrow)
      )
    );
  }

  async getUpcomingLaunches(): Promise<Launch[]> {
    const now = new Date();
    return await db.select().from(launches).where(
      and(
        gte(launches.scheduledTime, now),
        eq(launches.status, "scheduled")
      )
    );
  }

  async createLaunch(insertLaunch: InsertLaunch): Promise<Launch> {
    const [launch] = await db
      .insert(launches)
      .values([insertLaunch as any])
      .returning();
    return launch;
  }

  // Atomic launch creation with conflict checking to prevent double-booking
  async createLaunchWithConflictCheck(insertLaunch: InsertLaunch): Promise<Launch> {
    return await db.transaction(async (tx) => {
      // Check for conflicts within the transaction
      const scheduledTime = new Date(insertLaunch.scheduledTime);
      const bufferHours = 1;
      const startBuffer = new Date(scheduledTime.getTime() - (bufferHours * 60 * 60 * 1000));
      const endBuffer = new Date(scheduledTime.getTime() + (bufferHours * 60 * 60 * 1000));
      
      // Query for conflicting launches atomically
      const conflictingLaunches = await tx.select().from(launches).where(
        and(
          eq(launches.boatId, insertLaunch.boatId),
          gte(launches.scheduledTime, startBuffer),
          lte(launches.scheduledTime, endBuffer),
          not(eq(launches.status, 'cancelled')),
          not(eq(launches.status, 'retrieved'))
        )
      );
      
      if (conflictingLaunches.length > 0) {
        throw new Error('SCHEDULING_CONFLICT: This boat is already scheduled for launch at this time.');
      }
      
      // No conflicts found, create the launch atomically
      const [launch] = await tx
        .insert(launches)
        .values([insertLaunch as any])
        .returning();
        
      return launch;
    });
  }

  async updateLaunch(id: string, updates: Partial<InsertLaunch>): Promise<Launch | undefined> {
    const [launch] = await db
      .update(launches)
      .set(updates as any)
      .where(eq(launches.id, id))
      .returning();
    return launch || undefined;
  }

  async updateLaunchWithConflictCheck(id: string, updates: Partial<InsertLaunch>): Promise<Launch | undefined> {
    return await db.transaction(async (tx) => {
      // Get existing launch
      const [existing] = await tx.select().from(launches).where(eq(launches.id, id));
      if (!existing) return undefined;
      
      // Only check conflicts if scheduledTime or boatId is being updated
      if (updates.scheduledTime || updates.boatId) {
        const newTime = updates.scheduledTime || existing.scheduledTime;
        const newBoatId = updates.boatId || existing.boatId;
        
        // Check for conflicts (excluding current launch)
        const bufferHours = 1;
        const scheduledTime = new Date(newTime);
        const startBuffer = new Date(scheduledTime.getTime() - (bufferHours * 60 * 60 * 1000));
        const endBuffer = new Date(scheduledTime.getTime() + (bufferHours * 60 * 60 * 1000));
        
        const conflictingLaunches = await tx.select().from(launches).where(
          and(
            eq(launches.boatId, newBoatId),
            gte(launches.scheduledTime, startBuffer),
            lte(launches.scheduledTime, endBuffer),
            not(eq(launches.id, id)), // Exclude current launch
            not(eq(launches.status, 'cancelled')),
            not(eq(launches.status, 'retrieved'))
          )
        );
        
        if (conflictingLaunches.length > 0) {
          throw new Error('SCHEDULING_CONFLICT: This boat is already scheduled for launch at this time.');
        }
      }
      
      // No conflicts, perform update
      const [launch] = await tx
        .update(launches)
        .set(updates as any)
        .where(eq(launches.id, id))
        .returning();
      
      return launch || undefined;
    });
  }

  // SpeedyDock-style queue management
  async getQueueLength(): Promise<number> {
    const queuedLaunches = await db.select({
      count: sql<number>`count(*)`
    }).from(launches).where(
      or(
        eq(launches.status, "checked_in"),
        eq(launches.status, "queued"),
        eq(launches.status, "in_progress")
      )
    );
    return queuedLaunches[0]?.count || 0;
  }

  async getLaunchQueue(): Promise<Launch[]> {
    return await db.select().from(launches)
      .where(
        or(
          eq(launches.status, "checked_in"),
          eq(launches.status, "queued"),
          eq(launches.status, "in_progress")
        )
      )
      .orderBy(
        asc(launches.queuePosition),
        asc(launches.checkedInAt),
        asc(launches.scheduledTime)
      );
  }

  // Atomic check-in operation to prevent race conditions
  async checkInLaunch(launchId: string, checkInData: { customerLocation: any; timestamp: number }): Promise<Launch> {
    return await db.transaction(async (tx) => {
      // Get current launch and validate
      const [launch] = await tx.select().from(launches).where(eq(launches.id, launchId));
      if (!launch) {
        throw new Error("Launch not found");
      }
      
      if (launch.status !== 'scheduled') {
        throw new Error(`Cannot check in for launch with status: ${launch.status}`);
      }
      
      // Get current queue length atomically
      const queueResult = await tx.select({
        count: sql<number>`count(*)`
      }).from(launches).where(
        or(
          eq(launches.status, "checked_in"),
          eq(launches.status, "queued"),
          eq(launches.status, "in_progress")
        )
      );
      
      const queueLength = queueResult[0]?.count || 0;
      const estimatedWaitTime = Math.max(5, queueLength * 8); // 8 minutes per boat average
      
      // Update launch with check-in data
      const [updatedLaunch] = await tx
        .update(launches)
        .set({
          status: 'checked_in' as const,
          checkedInAt: new Date(),
          customerLocation: checkInData.customerLocation,
          queuePosition: queueLength + 1,
          estimatedWaitTime,
          lastStatusUpdate: new Date(),
        })
        .where(eq(launches.id, launchId))
        .returning();
        
      return updatedLaunch;
    });
  }

  // Get launches for a specific customer with optional status filter
  async getLaunchesByCustomer(customerId: string, status?: string): Promise<Launch[]> {
    if (status) {
      return await db.select().from(launches)
        .where(and(eq(launches.customerId, customerId), eq(launches.status, status as any)))
        .orderBy(desc(launches.scheduledTime));
    }
    
    return await db.select().from(launches)
      .where(eq(launches.customerId, customerId))
      .orderBy(desc(launches.scheduledTime));
  }

  // Payments
  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async getPayments(): Promise<Payment[]> {
    return await db.select().from(payments);
  }

  async getOverduePayments(): Promise<Payment[]> {
    const now = new Date();
    return await db.select().from(payments).where(
      and(
        eq(payments.status, "pending"),
        lte(payments.dueDate, now)
      )
    );
  }

  async getPaymentsByCustomer(customerId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.customerId, customerId));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db
      .insert(payments)
      .values([insertPayment])
      .returning();
    return payment;
  }

  async updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment | undefined> {
    const updatedData: any = { ...updates };
    if (updates.status === "paid" && !updatedData.paidDate) {
      updatedData.paidDate = new Date();
    }
    
    const [payment] = await db
      .update(payments)
      .set(updatedData)
      .where(eq(payments.id, id))
      .returning();
    return payment || undefined;
  }

  // Integrations
  async getIntegrations(): Promise<Integration[]> {
    return await db.select().from(integrations);
  }

  async getIntegration(platform: string): Promise<Integration | undefined> {
    const [integration] = await db.select().from(integrations).where(eq(integrations.platform, platform));
    return integration || undefined;
  }

  async createIntegration(insertIntegration: InsertIntegration): Promise<Integration> {
    const [integration] = await db
      .insert(integrations)
      .values(insertIntegration)
      .returning();
    return integration;
  }

  async updateIntegration(id: string, updates: Partial<InsertIntegration>): Promise<Integration | undefined> {
    const updatedData: any = { ...updates };
    if (updates.syncStatus === "connected") {
      updatedData.lastSync = new Date();
    }
    
    const [integration] = await db
      .update(integrations)
      .set(updatedData)
      .where(eq(integrations.id, id))
      .returning();
    return integration || undefined;
  }

  // Communications
  async getCommunications(): Promise<Communication[]> {
    return await db.select().from(communications);
  }

  async getCommunicationsByCustomer(customerId: string): Promise<Communication[]> {
    return await db.select().from(communications).where(eq(communications.customerId, customerId));
  }

  async createCommunication(insertCommunication: InsertCommunication): Promise<Communication> {
    const [communication] = await db
      .insert(communications)
      .values(insertCommunication)
      .returning();
    return communication;
  }

  async updateCommunication(id: string, updates: Partial<InsertCommunication>): Promise<Communication | undefined> {
    const updatedData: any = { ...updates };
    if (updates.status === "sent" && !updatedData.sentAt) {
      updatedData.sentAt = new Date();
    }
    
    const [communication] = await db
      .update(communications)
      .set(updatedData)
      .where(eq(communications.id, id))
      .returning();
    return communication || undefined;
  }

  // Import Jobs
  async getImportJob(id: string): Promise<ImportJob | undefined> {
    const [importJob] = await db.select().from(importJobs).where(eq(importJobs.id, id));
    return importJob || undefined;
  }

  async getImportJobs(): Promise<ImportJob[]> {
    return await db.select().from(importJobs);
  }

  async getRecentImportJobs(limit = 10): Promise<ImportJob[]> {
    return await db.select().from(importJobs)
      .orderBy(sql`${importJobs.createdAt} DESC`)
      .limit(limit);
  }

  async createImportJob(insertImportJob: InsertImportJob): Promise<ImportJob> {
    const [importJob] = await db
      .insert(importJobs)
      .values([insertImportJob as any])
      .returning();
    return importJob;
  }

  async updateImportJob(id: string, updates: Partial<InsertImportJob>): Promise<ImportJob | undefined> {
    const updatedData: any = { ...updates };
    
    // Auto-set timestamps based on status changes
    if (updates.status === "running" && !updatedData.startedAt) {
      updatedData.startedAt = new Date();
    }
    if ((updates.status === "completed" || updates.status === "failed") && !updatedData.finishedAt) {
      updatedData.finishedAt = new Date();
    }
    
    const [importJob] = await db
      .update(importJobs)
      .set(updatedData)
      .where(eq(importJobs.id, id))
      .returning();
    return importJob || undefined;
  }

  // Import Errors
  async getImportError(id: string): Promise<ImportError | undefined> {
    const [importError] = await db.select().from(importErrors).where(eq(importErrors.id, id));
    return importError || undefined;
  }

  async getImportErrors(): Promise<ImportError[]> {
    return await db.select().from(importErrors);
  }

  async getImportErrorsByJob(jobId: string): Promise<ImportError[]> {
    return await db.select().from(importErrors).where(eq(importErrors.jobId, jobId));
  }

  async createImportError(insertImportError: InsertImportError): Promise<ImportError> {
    const [importError] = await db
      .insert(importErrors)
      .values(insertImportError)
      .returning();
    return importError;
  }

  async clearImportErrors(jobId: string): Promise<void> {
    await db.delete(importErrors).where(eq(importErrors.jobId, jobId));
  }

  // Marina map data
  async getMarinaMapData() {
    // Get all slips first
    const allSlips = await db
      .select()
      .from(slips)
      .orderBy(asc(slips.section), asc(slips.number));

    // Enrich each slip with related data
    const enrichedSlips = await Promise.all(
      allSlips.map(async (slip) => {
        let customer = null;
        let boat = null;
        let lease = null;
        let paymentStatus = null;
        let lastPaymentDate = null;
        let launchCount = 0;

        // Get boat information if slip is occupied
        if (slip.currentBoatId) {
          const [boatResult] = await db
            .select()
            .from(boats)
            .where(eq(boats.id, slip.currentBoatId));
          boat = boatResult || null;

          // Get customer information
          if (boat) {
            const [customerResult] = await db
              .select()
              .from(customers)
              .where(eq(customers.id, boat.customerId));
            customer = customerResult || null;

            // Get active lease information
            const [leaseResult] = await db
              .select()
              .from(leases)
              .where(and(eq(leases.slipId, slip.id), eq(leases.status, "active")));
            lease = leaseResult || null;

            // Get payment information
            if (customer && lease) {
              const recentPayments = await db
                .select()
                .from(payments)
                .where(eq(payments.customerId, customer.id))
                .orderBy(desc(payments.dueDate))
                .limit(1);
              
              if (recentPayments.length > 0) {
                const latestPayment = recentPayments[0];
                paymentStatus = latestPayment.status;
                lastPaymentDate = latestPayment.paidDate || latestPayment.dueDate;
              }
            }

            // Get launch count for boat
            const launchCountResult = await db
              .select({ count: sql<number>`count(*)`.as('count') })
              .from(launches)
              .where(eq(launches.boatId, boat.id));
            
            launchCount = launchCountResult[0]?.count || 0;
          }
        }

        return {
          id: slip.id,
          number: slip.number,
          type: slip.type,
          section: slip.section,
          maxLength: slip.maxLength,
          maxBeam: slip.maxBeam,
          maxDraft: slip.maxDraft,
          utilities: slip.utilities,
          monthlyRate: slip.monthlyRate,
          isOccupied: slip.isOccupied || false,
          currentBoatId: slip.currentBoatId,
          customer,
          boat,
          lease,
          paymentStatus,
          lastPaymentDate,
          launchCount,
        };
      })
    );

    // Calculate statistics
    const totalSlips = enrichedSlips.length;
    const occupiedSlips = enrichedSlips.filter(slip => slip.isOccupied).length;
    const availableSlips = totalSlips - occupiedSlips;
    const occupancyRate = totalSlips > 0 ? (occupiedSlips / totalSlips) * 100 : 0;

    const slipsBySection = enrichedSlips.reduce((acc, slip) => {
      acc[slip.section] = (acc[slip.section] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const slipsByType = enrichedSlips.reduce((acc, slip) => {
      acc[slip.type] = (acc[slip.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      slips: enrichedSlips,
      stats: {
        totalSlips,
        occupiedSlips,
        availableSlips,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        slipsBySection,
        slipsByType,
      },
    };
  }

  // Dashboard analytics
  async getDashboardStats() {
    const todaysLaunches = (await this.getTodaysLaunches()).length;
    const availableSlips = (await this.getAvailableSlips()).length;
    const totalSlips = (await this.getSlips()).length;
    const occupiedSlips = totalSlips - availableSlips;
    const occupancyRate = totalSlips > 0 ? (occupiedSlips / totalSlips) * 100 : 0;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const allPayments = await this.getPayments();
    const monthlyRevenue = allPayments
      .filter(payment => {
        const paymentDate = payment.paidDate || payment.dueDate;
        return paymentDate.getMonth() === currentMonth && 
               paymentDate.getFullYear() === currentYear &&
               payment.status === "paid";
      })
      .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    
    const overduePayments = (await this.getOverduePayments()).length;

    return {
      todaysLaunches,
      availableSlips,
      totalSlips,
      monthlyRevenue,
      occupancyRate: Math.round(occupancyRate * 10) / 10,
      occupiedSlips,
      overduePayments,
    };
  }

  // Marina layout management
  async getMarinaLayouts(): Promise<MarinaLayout[]> {
    return await db.select().from(marinaLayouts).orderBy(desc(marinaLayouts.updatedAt));
  }

  async getMarinaLayoutById(id: string): Promise<MarinaLayout | null> {
    const [layout] = await db.select().from(marinaLayouts).where(eq(marinaLayouts.id, id));
    return layout || null;
  }

  async createMarinaLayout(data: InsertMarinaLayout): Promise<MarinaLayout> {
    const [layout] = await db.insert(marinaLayouts).values([data as any]).returning();
    return layout;
  }

  async updateMarinaLayout(id: string, data: Partial<InsertMarinaLayout>): Promise<MarinaLayout> {
    const [layout] = await db.update(marinaLayouts)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(marinaLayouts.id, id))
      .returning();
    return layout;
  }

  async deleteMarinaLayout(id: string): Promise<void> {
    await db.delete(marinaLayouts).where(eq(marinaLayouts.id, id));
  }

  async setActiveLayout(id: string): Promise<void> {
    // First set all layouts to inactive
    await db.update(marinaLayouts).set({ isActive: false });
    
    // Then set the selected layout to active
    await db.update(marinaLayouts).set({ isActive: true }).where(eq(marinaLayouts.id, id));
  }

  // Transient Reservations
  async getReservation(id: string): Promise<Reservation | undefined> {
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id));
    return reservation || undefined;
  }

  async getReservations(): Promise<Reservation[]> {
    return await db.select().from(reservations).orderBy(desc(reservations.checkInDate));
  }

  async getReservationsByDateRange(startDate: Date, endDate: Date): Promise<Reservation[]> {
    return await db
      .select()
      .from(reservations)
      .where(
        and(
          gte(reservations.checkOutDate, startDate),
          lte(reservations.checkInDate, endDate),
          not(eq(reservations.status, "cancelled"))
        )
      )
      .orderBy(asc(reservations.checkInDate));
  }

  async getReservationById(id: string): Promise<Reservation | undefined> {
    const [reservation] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, id));
    return reservation;
  }

  async getReservationsByCustomer(customerId: string): Promise<Reservation[]> {
    return await db
      .select()
      .from(reservations)
      .where(eq(reservations.customerId, customerId))
      .orderBy(desc(reservations.checkInDate));
  }

  async findOverlappingReservations(
    slipId: string,
    checkInDate: Date,
    checkOutDate: Date,
    excludeReservationId?: string
  ): Promise<Reservation[]> {
    const conditions = [
      eq(reservations.slipId, slipId),
      or(
        and(
          gte(reservations.checkInDate, checkInDate),
          lte(reservations.checkInDate, checkOutDate)
        ),
        and(
          gte(reservations.checkOutDate, checkInDate),
          lte(reservations.checkOutDate, checkOutDate)
        ),
        and(
          lte(reservations.checkInDate, checkInDate),
          gte(reservations.checkOutDate, checkOutDate)
        )
      ),
      not(eq(reservations.status, "cancelled"))
    ];

    if (excludeReservationId) {
      conditions.push(not(eq(reservations.id, excludeReservationId)));
    }

    return await db
      .select()
      .from(reservations)
      .where(and(...conditions));
  }

  async createReservation(
    reservation: InsertReservation & { slipId: string } // slip must be assigned for pricing
  ): Promise<Reservation> {
    // Use transaction to prevent double-booking race conditions and calculate pricing atomically
    return await db.transaction(async (tx) => {
      // Double-check availability within transaction using tx handle
      const overlapping = await tx
        .select()
        .from(reservations)
        .where(
          and(
            eq(reservations.slipId, reservation.slipId),
            or(
              and(
                gte(reservations.checkInDate, reservation.checkInDate),
                lte(reservations.checkInDate, reservation.checkOutDate)
              ),
              and(
                gte(reservations.checkOutDate, reservation.checkInDate),
                lte(reservations.checkOutDate, reservation.checkOutDate)
              ),
              and(
                lte(reservations.checkInDate, reservation.checkInDate),
                gte(reservations.checkOutDate, reservation.checkOutDate)
              )
            ),
            not(eq(reservations.status, "cancelled"))
          )
        );

      if (overlapping.length > 0) {
        throw new Error("SLIP_UNAVAILABLE");
      }

      // Fetch pricing rule within transaction
      const [pricingRule] = await tx
        .select()
        .from(pricingRules)
        .where(
          and(
            eq(pricingRules.marinaId, reservation.marinaId),
            eq(pricingRules.isActive, true),
            or(
              sql`${pricingRules.validFrom} IS NULL`,
              lte(pricingRules.validFrom, reservation.checkInDate)
            ),
            or(
              sql`${pricingRules.validTo} IS NULL`,
              gte(pricingRules.validTo, reservation.checkInDate)
            )
          )
        )
        .orderBy(desc(pricingRules.priority))
        .limit(1);

      // Get base rate from slip pricing
      const [slipPricingRecord] = await tx
        .select()
        .from(slipPricing)
        .where(eq(slipPricing.slipId, reservation.slipId))
        .limit(1);

      const baseRate = slipPricingRecord?.dailyRate 
        ? parseFloat(slipPricingRecord.dailyRate) 
        : 100; // fallback rate

      // Calculate total amount with pricing rule adjustments
      let totalAmount = baseRate * reservation.numberOfNights;
      
      if (pricingRule && pricingRule.adjustment) {
        const adjustment = pricingRule.adjustment as any;
        if (adjustment.type === 'percentage') {
          totalAmount = totalAmount * (1 + adjustment.value / 100);
        } else if (adjustment.type === 'fixed') {
          totalAmount = totalAmount + adjustment.value;
        }
      }

      // Generate confirmation code
      const confirmationCode = `RES-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      const [newReservation] = await tx
        .insert(reservations)
        .values([{ 
          ...reservation, 
          baseRate: String(baseRate),
          totalAmount: String(totalAmount), 
          confirmationCode 
        } as any])
        .returning();
      
      return newReservation;
    });
  }

  async updateReservation(
    id: string, 
    updates: Partial<InsertReservation>
  ): Promise<Reservation | undefined> {
    return await db.transaction(async (tx) => {
      // Get existing reservation first
      const [existing] = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, id));

      if (!existing) {
        return undefined;
      }

      // Determine final values for validation and pricing
      const slipId = updates.slipId || existing.slipId;
      const checkInDate = updates.checkInDate || existing.checkInDate;
      const checkOutDate = updates.checkOutDate || existing.checkOutDate;
      const numberOfNights = updates.numberOfNights || existing.numberOfNights;
      const datesOrSlipChanged = 
        updates.checkInDate || updates.checkOutDate || 
        (updates.slipId && updates.slipId !== existing.slipId);

      // Check availability if dates or slip are changing
      if (datesOrSlipChanged && slipId) {
        const overlapping = await tx
          .select()
          .from(reservations)
          .where(
            and(
              eq(reservations.slipId, slipId),
              not(eq(reservations.id, id)), // exclude current reservation
              or(
                and(
                  gte(reservations.checkInDate, checkInDate),
                  lte(reservations.checkInDate, checkOutDate)
                ),
                and(
                  gte(reservations.checkOutDate, checkInDate),
                  lte(reservations.checkOutDate, checkOutDate)
                ),
                and(
                  lte(reservations.checkInDate, checkInDate),
                  gte(reservations.checkOutDate, checkOutDate)
                )
              ),
              not(eq(reservations.status, "cancelled"))
            )
          );

        if (overlapping.length > 0) {
          throw new Error("SLIP_UNAVAILABLE");
        }
      }

      // Recalculate total amount if dates, slip, or numberOfNights are changing
      if (updates.checkInDate || updates.checkOutDate || updates.slipId || updates.numberOfNights) {
        // Fetch pricing rule within transaction
        const [pricingRule] = await tx
          .select()
          .from(pricingRules)
          .where(
            and(
              eq(pricingRules.marinaId, existing.marinaId),
              eq(pricingRules.isActive, true),
              or(
                sql`${pricingRules.validFrom} IS NULL`,
                lte(pricingRules.validFrom, checkInDate)
              ),
              or(
                sql`${pricingRules.validTo} IS NULL`,
                gte(pricingRules.validTo, checkInDate)
              )
            )
          )
          .orderBy(desc(pricingRules.priority))
          .limit(1);

        // Get base rate from slip pricing
        const [slipPricingRecord] = await tx
          .select()
          .from(slipPricing)
          .where(eq(slipPricing.slipId, slipId))
          .limit(1);

        const baseRate = slipPricingRecord?.dailyRate 
          ? parseFloat(slipPricingRecord.dailyRate) 
          : parseFloat(existing.baseRate);

        // Calculate total amount with pricing rule adjustments
        let totalAmount = baseRate * numberOfNights;
        
        if (pricingRule && pricingRule.adjustment) {
          const adjustment = pricingRule.adjustment as any;
          if (adjustment.type === 'percentage') {
            totalAmount = totalAmount * (1 + adjustment.value / 100);
          } else if (adjustment.type === 'fixed') {
            totalAmount = totalAmount + adjustment.value;
          }
        }

        updates.baseRate = String(baseRate);
        updates.totalAmount = String(totalAmount);
      }

      const [updated] = await tx
        .update(reservations)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(reservations.id, id))
        .returning();

      return updated;
    });
  }


  async cancelReservation(id: string): Promise<Reservation | undefined> {
    const [reservation] = await db
      .update(reservations)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(reservations.id, id))
      .returning();
    return reservation || undefined;
  }

  async checkSlipAvailability(slipId: string, checkInDate: Date, checkOutDate: Date): Promise<boolean> {
    const overlappingReservations = await db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.slipId, slipId),
          or(
            and(
              gte(reservations.checkInDate, checkInDate),
              lte(reservations.checkInDate, checkOutDate)
            ),
            and(
              gte(reservations.checkOutDate, checkInDate),
              lte(reservations.checkOutDate, checkOutDate)
            ),
            and(
              lte(reservations.checkInDate, checkInDate),
              gte(reservations.checkOutDate, checkOutDate)
            )
          ),
          not(eq(reservations.status, "cancelled"))
        )
      );

    return overlappingReservations.length === 0;
  }

  async findAvailableSlips(
    marinaId: string, 
    checkInDate: Date, 
    checkOutDate: Date, 
    boatLength: number, 
    boatBeam: number
  ): Promise<Slip[]> {
    // Get all slips that can fit the boat
    const potentialSlips = await db
      .select()
      .from(slips)
      .where(
        and(
          eq(slips.marinaId, marinaId),
          gte(sql`CAST(${slips.maxLength} AS DECIMAL)`, boatLength),
          gte(sql`CAST(${slips.maxBeam} AS DECIMAL)`, boatBeam)
        )
      );

    // Filter out slips with overlapping reservations
    const availableSlips = [];
    for (const slip of potentialSlips) {
      const isAvailable = await this.checkSlipAvailability(slip.id, checkInDate, checkOutDate);
      if (isAvailable) {
        availableSlips.push(slip);
      }
    }

    return availableSlips;
  }

  // Pricing Rules
  async getPricingRules(): Promise<PricingRule[]> {
    return await db
      .select()
      .from(pricingRules)
      .orderBy(desc(pricingRules.priority));
  }

  async getPricingRule(id: string): Promise<PricingRule | undefined> {
    const [rule] = await db
      .select()
      .from(pricingRules)
      .where(eq(pricingRules.id, id));
    return rule || undefined;
  }

  async getActivePricingRule(marinaId: string, date: Date): Promise<PricingRule | undefined> {
    const rules = await db
      .select()
      .from(pricingRules)
      .where(
        and(
          eq(pricingRules.marinaId, marinaId),
          eq(pricingRules.isActive, true),
          or(
            sql`${pricingRules.validFrom} IS NULL`,
            lte(pricingRules.validFrom, date)
          ),
          or(
            sql`${pricingRules.validTo} IS NULL`,
            gte(pricingRules.validTo, date)
          )
        )
      )
      .orderBy(desc(pricingRules.priority))
      .limit(1);

    return rules[0] || undefined;
  }

  async createPricingRule(rule: InsertPricingRule): Promise<PricingRule> {
    const [newRule] = await db
      .insert(pricingRules)
      .values([rule as any])
      .returning();
    return newRule;
  }

  async updatePricingRule(id: string, updates: Partial<InsertPricingRule>): Promise<PricingRule | undefined> {
    const [rule] = await db
      .update(pricingRules)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(pricingRules.id, id))
      .returning();
    return rule || undefined;
  }

  async deletePricingRule(id: string): Promise<boolean> {
    const result = await db
      .delete(pricingRules)
      .where(eq(pricingRules.id, id))
      .returning();
    return result.length > 0;
  }

  // Slip Pricing
  async getAllSlipPricing(): Promise<SlipPricing[]> {
    return await db
      .select()
      .from(slipPricing);
  }

  async getSlipPricing(slipId: string): Promise<SlipPricing | undefined> {
    const [pricing] = await db
      .select()
      .from(slipPricing)
      .where(eq(slipPricing.slipId, slipId));
    return pricing || undefined;
  }

  async createSlipPricing(pricing: InsertSlipPricing): Promise<SlipPricing> {
    const [newPricing] = await db
      .insert(slipPricing)
      .values([pricing as any])
      .returning();
    return newPricing;
  }

  async updateSlipPricing(id: string, updates: Partial<InsertSlipPricing>): Promise<SlipPricing | undefined> {
    const [pricing] = await db
      .update(slipPricing)
      .set({ ...updates, lastUpdated: new Date() } as any)
      .where(eq(slipPricing.id, id))
      .returning();
    return pricing || undefined;
  }

  // Messaging - Message Threads
  async getMessageThread(id: string): Promise<MessageThread | undefined> {
    const [thread] = await db
      .select()
      .from(messageThreads)
      .where(eq(messageThreads.id, id));
    return thread || undefined;
  }

  async getMessageThreads(marinaId?: string): Promise<MessageThread[]> {
    if (marinaId) {
      return await db
        .select()
        .from(messageThreads)
        .where(eq(messageThreads.marinaId, marinaId))
        .orderBy(desc(messageThreads.lastMessageAt));
    }
    return await db
      .select()
      .from(messageThreads)
      .orderBy(desc(messageThreads.lastMessageAt));
  }

  async getMessageThreadsByCustomer(customerId: string): Promise<MessageThread[]> {
    return await db
      .select()
      .from(messageThreads)
      .where(eq(messageThreads.customerId, customerId))
      .orderBy(desc(messageThreads.lastMessageAt));
  }

  async getMessageThreadParticipants(threadId: string): Promise<string[]> {
    const thread = await this.getMessageThread(threadId);
    if (!thread) return [];
    
    const participants: string[] = [thread.customerId];
    if (thread.assignedToId) {
      participants.push(thread.assignedToId);
    }
    return participants;
  }

  async createMessageThread(thread: InsertMessageThread): Promise<MessageThread> {
    const [newThread] = await db
      .insert(messageThreads)
      .values(thread)
      .returning();
    return newThread;
  }

  async updateMessageThread(id: string, updates: Partial<InsertMessageThread>): Promise<MessageThread | undefined> {
    const [thread] = await db
      .update(messageThreads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(messageThreads.id, id))
      .returning();
    return thread || undefined;
  }

  // Messaging - Messages
  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));
    return message || undefined;
  }

  async getMessages(threadId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(asc(messages.createdAt));
  }

  async getUnreadMessageCount(userId: string, userType: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.isRead, false),
          not(eq(messages.senderId, userId)),
          not(eq(messages.senderType, userType))
        )
      );
    return result[0]?.count || 0;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    
    await db
      .update(messageThreads)
      .set({ lastMessageAt: new Date() })
      .where(eq(messageThreads.id, message.threadId));
    
    return newMessage;
  }

  async markMessageAsRead(messageId: string): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(messages.id, messageId))
      .returning();
    return message || undefined;
  }

  async markThreadAsRead(threadId: string, userId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(messages.threadId, threadId),
          eq(messages.isRead, false),
          not(eq(messages.senderId, userId))
        )
      );
  }

  // User operations for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Analytics
  async getAnalyticsSnapshots(marinaId?: string, period?: string, startDate?: Date, endDate?: Date): Promise<AnalyticsSnapshot[]> {
    let query = db.select().from(analyticsSnapshots);
    const conditions = [];
    
    if (marinaId) {
      conditions.push(eq(analyticsSnapshots.marinaId, marinaId));
    }
    if (period) {
      conditions.push(eq(analyticsSnapshots.period, period));
    }
    if (startDate) {
      conditions.push(gte(analyticsSnapshots.snapshotDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(analyticsSnapshots.snapshotDate, endDate));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return await query.orderBy(desc(analyticsSnapshots.snapshotDate));
  }

  async getLatestAnalyticsSnapshot(marinaId: string): Promise<AnalyticsSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(analyticsSnapshots)
      .where(eq(analyticsSnapshots.marinaId, marinaId))
      .orderBy(desc(analyticsSnapshots.snapshotDate))
      .limit(1);
    return snapshot || undefined;
  }

  async createAnalyticsSnapshot(snapshot: InsertAnalyticsSnapshot): Promise<AnalyticsSnapshot> {
    const [created] = await db
      .insert(analyticsSnapshots)
      .values(snapshot)
      .returning();
    return created;
  }

  // Contracts and E-signatures
  async getContract(id: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract || undefined;
  }

  async getContracts(marinaId?: string): Promise<Contract[]> {
    if (marinaId) {
      return await db.select().from(contracts)
        .where(eq(contracts.marinaId, marinaId))
        .orderBy(desc(contracts.createdAt));
    }
    return await db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }

  async getContractsByCustomer(customerId: string): Promise<Contract[]> {
    return await db.select().from(contracts)
      .where(eq(contracts.customerId, customerId))
      .orderBy(desc(contracts.createdAt));
  }

  async getContractsByStatus(status: string, marinaId?: string): Promise<Contract[]> {
    const conditions = [eq(contracts.status, status)];
    if (marinaId) {
      conditions.push(eq(contracts.marinaId, marinaId));
    }
    return await db.select().from(contracts)
      .where(and(...conditions))
      .orderBy(desc(contracts.createdAt));
  }

  async getPendingContracts(expiringWithinDays?: number): Promise<Contract[]> {
    const conditions = [eq(contracts.status, 'pending')];
    
    if (expiringWithinDays) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiringWithinDays);
      conditions.push(lte(contracts.expiresAt, expiryDate));
    }
    
    return await db.select().from(contracts)
      .where(and(...conditions))
      .orderBy(asc(contracts.expiresAt));
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const [created] = await db
      .insert(contracts)
      .values(contract)
      .returning();
    return created;
  }

  async updateContract(id: string, updates: Partial<InsertContract>): Promise<Contract | undefined> {
    const [contract] = await db
      .update(contracts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contracts.id, id))
      .returning();
    return contract || undefined;
  }

  async signContract(id: string, signatureData: { signedBy: string; ipAddress: string; userAgent: string; signatureImageUrl?: string }): Promise<Contract | undefined> {
    const now = new Date();
    const [contract] = await db
      .update(contracts)
      .set({
        status: 'signed',
        signatureData: {
          signedAt: now.toISOString(),
          signedBy: signatureData.signedBy,
          ipAddress: signatureData.ipAddress,
          userAgent: signatureData.userAgent,
          signatureImageUrl: signatureData.signatureImageUrl,
        },
        signedAt: now,
        updatedAt: now,
      })
      .where(eq(contracts.id, id))
      .returning();
    return contract || undefined;
  }

  // Contract Templates
  async getContractTemplate(id: string): Promise<ContractTemplate | undefined> {
    const [template] = await db.select().from(contractTemplates).where(eq(contractTemplates.id, id));
    return template || undefined;
  }

  async getContractTemplates(marinaId?: string): Promise<ContractTemplate[]> {
    if (marinaId) {
      return await db.select().from(contractTemplates)
        .where(or(eq(contractTemplates.marinaId, marinaId), sql`${contractTemplates.marinaId} IS NULL`))
        .orderBy(asc(contractTemplates.name));
    }
    return await db.select().from(contractTemplates).orderBy(asc(contractTemplates.name));
  }

  async getDefaultTemplates(): Promise<ContractTemplate[]> {
    return await db.select().from(contractTemplates)
      .where(eq(contractTemplates.isDefault, true))
      .orderBy(asc(contractTemplates.name));
  }

  async createContractTemplate(template: InsertContractTemplate): Promise<ContractTemplate> {
    const [created] = await db
      .insert(contractTemplates)
      .values(template)
      .returning();
    return created;
  }

  async updateContractTemplate(id: string, updates: Partial<InsertContractTemplate>): Promise<ContractTemplate | undefined> {
    const [template] = await db
      .update(contractTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contractTemplates.id, id))
      .returning();
    return template || undefined;
  }

  async deleteContractTemplate(id: string): Promise<boolean> {
    const result = await db.delete(contractTemplates).where(eq(contractTemplates.id, id));
    return true;
  }

  // Audit Logs
  async getAuditLog(id: string): Promise<AuditLog | undefined> {
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.id, id));
    return log || undefined;
  }

  async getAuditLogs(options?: {
    marinaId?: string;
    userId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    const conditions = [];
    
    if (options?.marinaId) {
      conditions.push(eq(auditLogs.marinaId, options.marinaId));
    }
    if (options?.userId) {
      conditions.push(eq(auditLogs.userId, options.userId));
    }
    if (options?.entityType) {
      conditions.push(eq(auditLogs.entityType, options.entityType));
    }
    if (options?.entityId) {
      conditions.push(eq(auditLogs.entityId, options.entityId));
    }
    if (options?.action) {
      conditions.push(eq(auditLogs.action, options.action));
    }
    if (options?.startDate) {
      conditions.push(gte(auditLogs.timestamp, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(auditLogs.timestamp, options.endDate));
    }
    
    let query = db.select().from(auditLogs);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    query = query.orderBy(desc(auditLogs.timestamp)) as typeof query;
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }
    
    return await query;
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(and(
        eq(auditLogs.entityType, entityType),
        eq(auditLogs.entityId, entityId)
      ))
      .orderBy(desc(auditLogs.timestamp));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db
      .insert(auditLogs)
      .values(log)
      .returning();
    return created;
  }

  async getAuditLogStats(marinaId?: string, startDate?: Date, endDate?: Date): Promise<{
    totalLogs: number;
    actionCounts: Record<string, number>;
    entityCounts: Record<string, number>;
    userCounts: Record<string, number>;
  }> {
    const conditions = [];
    if (marinaId) {
      conditions.push(eq(auditLogs.marinaId, marinaId));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.timestamp, startDate));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.timestamp, endDate));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const logs = whereClause 
      ? await db.select().from(auditLogs).where(whereClause)
      : await db.select().from(auditLogs);
    
    const actionCounts: Record<string, number> = {};
    const entityCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    
    for (const log of logs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      if (log.entityType) {
        entityCounts[log.entityType] = (entityCounts[log.entityType] || 0) + 1;
      }
      if (log.userId) {
        userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
      }
    }
    
    return {
      totalLogs: logs.length,
      actionCounts,
      entityCounts,
      userCounts,
    };
  }

  // API Keys
  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return key || undefined;
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    return key || undefined;
  }

  async getApiKeys(organizationId: string): Promise<ApiKey[]> {
    return await db.select().from(apiKeys)
      .where(eq(apiKeys.organizationId, organizationId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [created] = await db
      .insert(apiKeys)
      .values(apiKey)
      .returning();
    return created;
  }

  async updateApiKey(id: string, updates: Partial<InsertApiKey>): Promise<ApiKey | undefined> {
    const [updated] = await db
      .update(apiKeys)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();
    return updated || undefined;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const result = await db.delete(apiKeys).where(eq(apiKeys.id, id)).returning();
    return result.length > 0;
  }

  async revokeApiKey(id: string): Promise<boolean> {
    const [updated] = await db
      .update(apiKeys)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();
    return !!updated;
  }

  // Webhooks
  async getWebhook(id: string): Promise<Webhook | undefined> {
    const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id));
    return webhook || undefined;
  }

  async getWebhooks(organizationId: string): Promise<Webhook[]> {
    return await db.select().from(webhooks)
      .where(eq(webhooks.organizationId, organizationId))
      .orderBy(desc(webhooks.createdAt));
  }

  async getWebhooksByMarina(marinaId: string): Promise<Webhook[]> {
    return await db.select().from(webhooks)
      .where(eq(webhooks.marinaId, marinaId))
      .orderBy(desc(webhooks.createdAt));
  }

  async getActiveWebhooksForEvent(event: string, marinaId?: string): Promise<Webhook[]> {
    const conditions = [eq(webhooks.isActive, true)];
    
    if (marinaId) {
      conditions.push(
        or(
          eq(webhooks.marinaId, marinaId),
          sql`${webhooks.marinaId} IS NULL`
        ) as any
      );
    }
    
    const allWebhooks = await db.select().from(webhooks)
      .where(and(...conditions));
    
    // Filter webhooks that have this event in their events array
    return allWebhooks.filter(webhook => 
      webhook.events && webhook.events.includes(event)
    );
  }

  async createWebhook(webhook: InsertWebhook): Promise<Webhook> {
    const [created] = await db
      .insert(webhooks)
      .values(webhook)
      .returning();
    return created;
  }

  async updateWebhook(id: string, updates: Partial<InsertWebhook>): Promise<Webhook | undefined> {
    const [updated] = await db
      .update(webhooks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(webhooks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteWebhook(id: string): Promise<boolean> {
    // First delete all deliveries for this webhook
    await db.delete(webhookDeliveries).where(eq(webhookDeliveries.webhookId, id));
    // Then delete the webhook
    const result = await db.delete(webhooks).where(eq(webhooks.id, id)).returning();
    return result.length > 0;
  }

  async incrementWebhookFailure(id: string): Promise<void> {
    await db
      .update(webhooks)
      .set({ 
        failureCount: sql`${webhooks.failureCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(webhooks.id, id));
  }

  async resetWebhookFailures(id: string): Promise<void> {
    await db
      .update(webhooks)
      .set({ 
        failureCount: 0,
        updatedAt: new Date()
      })
      .where(eq(webhooks.id, id));
  }

  // Webhook Deliveries
  async getWebhookDelivery(id: string): Promise<WebhookDelivery | undefined> {
    const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id));
    return delivery || undefined;
  }

  async getWebhookDeliveries(webhookId: string, limit?: number): Promise<WebhookDelivery[]> {
    let query = db.select().from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.createdAt));
    
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    
    return await query;
  }

  async getRecentDeliveries(webhookId: string, limit: number = 10): Promise<WebhookDelivery[]> {
    return await db.select().from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
  }

  async getPendingDeliveries(): Promise<WebhookDelivery[]> {
    return await db.select().from(webhookDeliveries)
      .where(eq(webhookDeliveries.status, 'pending'))
      .orderBy(asc(webhookDeliveries.createdAt));
  }

  async getFailedDeliveries(webhookId?: string): Promise<WebhookDelivery[]> {
    if (webhookId) {
      return await db.select().from(webhookDeliveries)
        .where(and(
          eq(webhookDeliveries.webhookId, webhookId),
          eq(webhookDeliveries.status, 'failed')
        ))
        .orderBy(desc(webhookDeliveries.createdAt));
    }
    
    return await db.select().from(webhookDeliveries)
      .where(eq(webhookDeliveries.status, 'failed'))
      .orderBy(desc(webhookDeliveries.createdAt));
  }

  async createWebhookDelivery(delivery: InsertWebhookDelivery): Promise<WebhookDelivery> {
    const [created] = await db
      .insert(webhookDeliveries)
      .values(delivery)
      .returning();
    return created;
  }

  async updateWebhookDelivery(id: string, updates: Partial<InsertWebhookDelivery>): Promise<WebhookDelivery | undefined> {
    const [updated] = await db
      .update(webhookDeliveries)
      .set(updates)
      .where(eq(webhookDeliveries.id, id))
      .returning();
    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();