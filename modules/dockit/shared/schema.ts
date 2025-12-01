import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Dockit - uses main app's sessions
// Note: Dockit shares the session table with the main MarinaMatch app
export const dockitSessions = pgTable(
  "dockit_sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_dockit_session_expire").on(table.expire)],
);

export const customers = pgTable("dockit_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  address: text("address"),
  emergencyContact: jsonb("emergency_contact").$type<{
    name: string;
    phone: string;
    relationship: string;
  }>(),
  lastLaunchDate: timestamp("last_launch_date"),
  stripeCustomerId: text("stripe_customer_id"),
  autopayEnabled: boolean("autopay_enabled").default(false),
  accountStatus: text("account_status").default("active"),
  crmContactId: integer("crm_contact_id"),
  crmCompanyId: integer("crm_company_id"),
  syncedFromCrm: boolean("synced_from_crm").default(false),
  lastCrmSync: timestamp("last_crm_sync"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const boats = pgTable("dockit_boats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  name: text("name").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  length: decimal("length", { precision: 5, scale: 2 }).notNull(),
  beam: decimal("beam", { precision: 5, scale: 2 }).notNull(),
  draft: decimal("draft", { precision: 5, scale: 2 }),
  hullId: text("hull_id"),
  registrationNumber: text("registration_number"),
  insuranceInfo: jsonb("insurance_info").$type<{
    provider: string;
    policyNumber: string;
    expirationDate: string;
  }>(),
});

// Launches definition moved after dependencies

export const launches = pgTable("dockit_launches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  boatId: varchar("boat_id").notNull().references(() => boats.id),
  scheduledTime: timestamp("scheduled_time").notNull(),
  actualLaunchTime: timestamp("actual_launch_time"),
  retrievalTime: timestamp("retrieval_time"),
  // SpeedyDock-inspired enhancements
  checkedInAt: timestamp("checked_in_at"),
  queuePosition: integer("queue_position"),
  estimatedWaitTime: integer("estimated_wait_time"), // in minutes
  status: text("status").notNull().default("scheduled"), // "scheduled", "checked_in", "queued", "in_progress", "launched", "retrieved", "cancelled"
  notes: text("notes"),
  staffAssigned: text("staff_assigned"),
  // Additional services integration
  fuelRequested: boolean("fuel_requested").default(false),
  fuelAmount: decimal("fuel_amount", { precision: 5, scale: 2 }),
  suppliesRequested: jsonb("supplies_requested").$type<{
    items: Array<{
      name: string;
      quantity: number;
      price?: number;
    }>;
  }>(),
  // Customer communication preferences
  notificationPreference: text("notification_preference").default("sms"), // "sms", "email", "push", "none"
  customerLocation: jsonb("customer_location").$type<{
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    timestamp?: number;
  }>(),
  // Staff workflow tracking
  assignedStaffId: varchar("assigned_staff_id"),
  priorityLevel: text("priority_level").default("normal"), // "low", "normal", "high", "urgent"
  // Real-time updates
  lastStatusUpdate: timestamp("last_status_update").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("dockit_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  leaseId: varchar("lease_id").references(() => leases.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  transactionId: text("transaction_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  description: text("description"),
  category: text("category"),
  billingScheduleId: varchar("billing_schedule_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const billingSchedules = pgTable("dockit_billing_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  leaseId: varchar("lease_id").references(() => leases.id),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: text("frequency").notNull(),
  dayOfMonth: integer("day_of_month").default(1),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  nextBillingDate: timestamp("next_billing_date").notNull(),
  lastBilledDate: timestamp("last_billed_date"),
  status: text("status").notNull().default("active"),
  autopayEnabled: boolean("autopay_enabled").default(false),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  paymentMethod: text("payment_method"),
  gracePeriodDays: integer("grace_period_days").default(5),
  category: text("category"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const integrations = pgTable("dockit_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platform: text("platform").notNull(), // "speedydock", "dockwa", "snag_a_slip"
  isEnabled: boolean("is_enabled").default(false),
  credentials: jsonb("credentials").$type<Record<string, string>>(),
  lastSync: timestamp("last_sync"),
  syncStatus: text("sync_status").default("disconnected"), // "connected", "disconnected", "error"
  config: jsonb("config").$type<Record<string, any>>(),
});

export const communications = pgTable("dockit_communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  type: text("type").notNull(), // "email", "sms", "push"
  subject: text("subject"),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"), // "pending", "sent", "delivered", "failed"
  sentAt: timestamp("sent_at"),
  scheduledFor: timestamp("scheduled_for"),
});

// Multi-marina support
export const organizations = pgTable("dockit_organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  logo: text("logo"),
  settings: jsonb("settings").$type<{
    timeZone?: string;
    currency?: string;
    defaultPricingTier?: string;
    autoConfirm?: boolean;
    requireDeposit?: boolean;
    cancellationPolicy?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marinas = pgTable("dockit_marinas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  location: text("location").notNull(),
  address: text("address"),
  coordinates: jsonb("coordinates").$type<{
    latitude: number;
    longitude: number;
  }>(),
  amenities: text("amenities").array(),
  description: text("description"),
  capacity: jsonb("capacity").$type<{
    wetSlips: number;
    drySlips: number;
    moorings: number;
    yardStorage: number;
  }>(),
  operatingHours: jsonb("operating_hours").$type<{
    monday: { open: string; close: string; };
    tuesday: { open: string; close: string; };
    wednesday: { open: string; close: string; };
    thursday: { open: string; close: string; };
    friday: { open: string; close: string; };
    saturday: { open: string; close: string; };
    sunday: { open: string; close: string; };
  }>(),
  contactInfo: jsonb("contact_info").$type<{
    phone?: string;
    email?: string;
    emergencyPhone?: string;
  }>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Now define slips table after marinas
export const slips = pgTable("dockit_slips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  number: text("number").notNull(),
  type: text("type").notNull(), // "wet", "dry_stack", "trailer"
  section: text("section").notNull(),
  maxLength: decimal("max_length", { precision: 5, scale: 2 }).notNull(),
  maxBeam: decimal("max_beam", { precision: 5, scale: 2 }).notNull(),
  maxDraft: decimal("max_draft", { precision: 5, scale: 2 }),
  utilities: text("utilities").array(),
  monthlyRate: decimal("monthly_rate", { precision: 10, scale: 2 }).notNull(),
  isOccupied: boolean("is_occupied").default(false),
  currentBoatId: varchar("current_boat_id").references(() => boats.id),
}, (table) => ({
  marinaNumberUnique: uniqueIndex("slips_marina_number_unique").on(table.marinaId, table.number),
}));

export const leases = pgTable("dockit_leases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  boatId: varchar("boat_id").notNull().references(() => boats.id),
  slipId: varchar("slip_id").notNull().references(() => slips.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  monthlyRate: decimal("monthly_rate", { precision: 10, scale: 2 }).notNull(),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("active"), // "active", "terminated", "expired"
  autoRenew: boolean("auto_renew").default(false),
});

// User roles and permissions system
// Roles: corporate_admin, regional_manager, site_manager, dockmaster, staff, customer, guest
export const users = pgTable("dockit_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  profileImageUrl: text("profile_image_url"),
  role: text("role").notNull().default("customer"), // "corporate_admin", "regional_manager", "site_manager", "dockmaster", "staff", "customer", "guest"
  organizationId: varchar("organization_id").references(() => organizations.id), // for corporate/regional roles
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  lastLogin: timestamp("last_login"),
  preferences: jsonb("preferences").$type<{
    notifications?: {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
    };
    language?: string;
    timezone?: string;
    defaultMarinaId?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const userMarinaRoles = pgTable("dockit_user_marina_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  role: text("role").notNull(), // "site_manager", "dockmaster", "staff", "customer"
  permissions: text("permissions").array(), // granular override permissions
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("user_marina_roles_unique").on(table.userId, table.marinaId),
]);

export type UserMarinaRole = typeof userMarinaRoles.$inferSelect;
export type InsertUserMarinaRole = typeof userMarinaRoles.$inferInsert;

// Transient reservations system
export const reservations = pgTable("dockit_reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  boatId: varchar("boat_id").notNull().references(() => boats.id),
  slipId: varchar("slip_id").references(() => slips.id), // can be null if not yet assigned
  type: text("type").notNull().default("transient"), // "transient", "seasonal", "annual", "guest"
  status: text("status").notNull().default("pending"), // "pending", "confirmed", "checked_in", "checked_out", "cancelled", "no_show"
  checkInDate: timestamp("check_in_date").notNull(),
  checkOutDate: timestamp("check_out_date").notNull(),
  actualCheckIn: timestamp("actual_check_in"),
  actualCheckOut: timestamp("actual_check_out"),
  numberOfNights: integer("number_of_nights").notNull(),
  baseRate: decimal("base_rate", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  source: text("source").default("direct"), // "direct", "dockwa", "snag_a_slip", "phone", "walk_in"
  specialRequests: text("special_requests"),
  guestPreferences: jsonb("guest_preferences").$type<{
    preferredSlipType?: string;
    powerRequirements?: string;
    accessibilityNeeds?: string;
    quietArea?: boolean;
  }>(),
  cancellationPolicy: text("cancellation_policy"),
  cancellationDeadline: timestamp("cancellation_deadline"),
  confirmationCode: text("confirmation_code").unique(),
  externalReservationId: text("external_reservation_id"), // for integrations
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Waitlist for fully booked periods
export const waitlist = pgTable("dockit_waitlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  boatId: varchar("boat_id").notNull().references(() => boats.id),
  requestedCheckIn: timestamp("requested_check_in").notNull(),
  requestedCheckOut: timestamp("requested_check_out").notNull(),
  flexibleDates: boolean("flexible_dates").default(false),
  maxRate: decimal("max_rate", { precision: 10, scale: 2 }),
  slipPreferences: jsonb("slip_preferences").$type<{
    minLength?: number;
    maxLength?: number;
    utilities?: string[];
    section?: string;
  }>(),
  priority: integer("priority").default(1), // 1 = highest priority
  status: text("status").notNull().default("active"), // "active", "notified", "converted", "expired", "cancelled"
  notificationsSent: integer("notifications_sent").default(0),
  lastNotified: timestamp("last_notified"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const importJobs = pgTable("dockit_import_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(), // "file", "dockwa", "snag_a_slip", "sharper", "molo"
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("queued"), // "queued", "running", "completed", "failed"
  totalRows: integer("total_rows"),
  processedRows: integer("processed_rows").default(0),
  successCount: integer("success_count").default(0),
  errorCount: integer("error_count").default(0),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
  config: jsonb("config").$type<{
    columnMappings?: Record<string, string>;
    duplicateHandling?: "skip" | "update" | "error";
    validationRules?: Record<string, any>;
    platformCredentials?: Record<string, string>;
    uploadPath?: string;
    internalFilePath?: string;
    originalFilename?: string;
    validateOnly?: boolean;
  }>(),
  summary: jsonb("summary").$type<{
    customersCreated?: number;
    customersUpdated?: number;
    boatsCreated?: number;
    boatsUpdated?: number;
    slipsCreated?: number;
    slipsUpdated?: number;
    leasesCreated?: number;
    leasesUpdated?: number;
  }>(),
});

export const importErrors = pgTable("dockit_import_errors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => importJobs.id),
  entity: text("entity").notNull(), // "customer", "boat", "slip", "lease"
  rowIndex: integer("row_index").notNull(),
  code: text("code").notNull(), // "VALIDATION_ERROR", "DUPLICATE_ERROR", "MAPPING_ERROR"
  message: text("message").notNull(),
  rawData: jsonb("raw_data").$type<Record<string, any>>(),
  suggestion: text("suggestion"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Marina layout configurations for physical map design
export const marinaLayouts = pgTable("dockit_marina_layouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").references(() => marinas.id),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(false),
  layoutData: jsonb("layout").$type<{
    canvas: {
      width: number;
      height: number;
      scale: number;
      offsetX: number;
      offsetY: number;
    };
    areas: Array<{
      id: string;
      type: 'wet_slips' | 'dry_stack' | 'land_storage' | 'ramp' | 'fuel_dock' | 'building';
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      config: {
        rows?: number;
        columns?: number;
        slipSize?: {
          width: number;
          height: number;
        };
        spacing?: {
          horizontal: number;
          vertical: number;
        };
        startNumber?: string;
        numbering?: 'sequential' | 'section_based';
      };
    }>;
    connections: Array<{
      id: string;
      type: 'road' | 'walkway' | 'dock';
      points: Array<{ x: number; y: number }>;
      width: number;
    }>;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Dynamic pricing system
export const pricingRules = pgTable("dockit_pricing_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  name: text("name").notNull(),
  ruleType: text("rule_type").notNull(), // "seasonal", "demand", "desirability", "event", "promotional"
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(1), // higher number = higher priority
  conditions: jsonb("conditions").$type<{
    dateRange?: { start: string; end: string; };
    occupancyThreshold?: number;
    slipTypes?: string[];
    daysOfWeek?: string[];
    minimumStay?: number;
    maximumStay?: number;
    boatLengthRange?: { min: number; max: number; };
  }>(),
  adjustment: jsonb("adjustment").$type<{
    type: 'percentage' | 'fixed' | 'override';
    value: number;
    minimumRate?: number;
    maximumRate?: number;
  }>(),
  description: text("description"),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const slipPricing = pgTable("dockit_slip_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slipId: varchar("slip_id").notNull().references(() => slips.id),
  baseRate: decimal("base_rate", { precision: 10, scale: 2 }).notNull(),
  desirabilityScore: integer("desirability_score").default(5), // 1-10 scale
  seasonalRates: jsonb("seasonal_rates").$type<{
    spring?: number;
    summer?: number;
    fall?: number;
    winter?: number;
  }>(),
  minimumStay: integer("minimum_stay").default(1),
  maximumStay: integer("maximum_stay"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Two-way messaging system
export const messageThreads = pgTable("dockit_message_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("active"), // "active", "closed", "archived"
  assignedToId: varchar("assigned_to_id").references(() => users.id), // staff member assigned
  relatedReservationId: varchar("related_reservation_id").references(() => reservations.id),
  relatedLeaseId: varchar("related_lease_id").references(() => leases.id),
  priority: text("priority").default("normal"), // "low", "normal", "high", "urgent"
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("dockit_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => messageThreads.id),
  senderId: varchar("sender_id").notNull(), // can be customer ID or user ID
  senderType: text("sender_type").notNull(), // "customer" or "staff"
  content: text("content").notNull(),
  attachments: jsonb("attachments").$type<Array<{
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  }>>(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Digital contracts and e-signature
export const contracts = pgTable("dockit_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  reservationId: varchar("reservation_id").references(() => reservations.id),
  leaseId: varchar("lease_id").references(() => leases.id),
  contractType: text("contract_type").notNull(), // "transient_agreement", "slip_lease", "dry_storage", "mooring", "winter_storage"
  templateId: varchar("template_id"),
  status: text("status").notNull().default("pending"), // "pending", "sent", "signed", "expired", "cancelled"
  contractData: jsonb("contract_data").$type<{
    customerInfo: {
      name: string;
      address?: string;
      phone?: string;
      email?: string;
    };
    boatInfo: {
      name: string;
      registration: string;
      length: number;
      beam: number;
      make: string;
      model: string;
      year: number;
    };
    terms: {
      startDate: string;
      endDate?: string;
      slipNumber?: string;
      rate: number;
      deposit?: number;
      specialTerms?: string[];
    };
    marina: {
      name: string;
      address: string;
      rules?: string[];
    };
  }>(),
  documentUrl: text("document_url"), // PDF storage location
  signatureData: jsonb("signature_data").$type<{
    signedAt?: string;
    signedBy?: string;
    ipAddress?: string;
    userAgent?: string;
    signatureImageUrl?: string;
  }>(),
  externalEnvelopeId: text("external_envelope_id"), // DocuSign envelope ID
  expiresAt: timestamp("expires_at"),
  sentAt: timestamp("sent_at"),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contractTemplates = pgTable("dockit_contract_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").references(() => marinas.id), // null for system templates
  name: text("name").notNull(),
  contractType: text("contract_type").notNull(),
  version: text("version").default("1.0"),
  template: text("template").notNull(), // HTML template with placeholders
  fields: jsonb("fields").$type<Array<{
    name: string;
    type: 'text' | 'number' | 'date' | 'boolean' | 'select';
    required: boolean;
    options?: string[];
    placeholder?: string;
  }>>(),
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notification system
export const notifications = pgTable("dockit_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  marinaId: varchar("marina_id").references(() => marinas.id),
  type: text("type").notNull(), // "payment_due", "reservation_confirmed", "launch_ready", "system_alert", etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data").$type<Record<string, any>>(), // additional context data
  priority: text("priority").default("normal"), // "low", "normal", "high", "urgent"
  channels: text("channels").array(), // "in_app", "email", "sms", "push"
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  actionUrl: text("action_url"), // URL to navigate to when clicked
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationPreferences = pgTable("dockit_notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  notificationType: text("notification_type").notNull(),
  channels: jsonb("channels").$type<{
    inApp: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  }>(),
  isEnabled: boolean("is_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Analytics and reporting tables
export const analyticsSnapshots = pgTable("dockit_analytics_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").notNull().references(() => marinas.id),
  snapshotDate: timestamp("snapshot_date").notNull(),
  period: text("period").notNull(), // "daily", "weekly", "monthly", "yearly"
  data: jsonb("data").$type<{
    occupancy: {
      wetSlips: { occupied: number; total: number; rate: number; };
      drySlips: { occupied: number; total: number; rate: number; };
      moorings: { occupied: number; total: number; rate: number; };
      overall: { occupied: number; total: number; rate: number; };
    };
    revenue: {
      dockage: number;
      storage: number;
      services: number;
      fuel: number;
      other: number;
      total: number;
    };
    customers: {
      new: number;
      returning: number;
      total: number;
      churnRate: number;
    };
    launches: {
      total: number;
      averageWaitTime: number;
      onTimePercentage: number;
    };
    utilization: {
      averageStayLength: number;
      turnoverRate: number;
      revenuePerSlip: number;
    };
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit logs
export const auditLogs = pgTable("dockit_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar("marina_id").references(() => marinas.id),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(), // "CREATE_RESERVATION", "ASSIGN_SLIP", "PROCESS_PAYMENT", etc.
  entityType: text("entity_type"), // "reservation", "slip", "payment", etc.
  entityId: text("entity_id"),
  details: jsonb("details").$type<Record<string, any>>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// API Keys for external access
export const apiKeys = pgTable("dockit_api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  marinaId: varchar("marina_id").references(() => marinas.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(), // hashed API key
  keyPrefix: text("key_prefix").notNull(), // first 8 chars for identification
  permissions: text("permissions").array(), // specific permissions granted
  rateLimit: integer("rate_limit").default(1000), // requests per hour
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Webhooks for event notifications
export const webhooks = pgTable("dockit_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id),
  marinaId: varchar("marina_id").references(() => marinas.id),
  url: text("url").notNull(),
  secret: text("secret").notNull(), // HMAC signing secret
  events: text("events").array().notNull(), // events to subscribe to
  isActive: boolean("is_active").default(true),
  description: text("description"),
  failureCount: integer("failure_count").default(0),
  lastDeliveryAt: timestamp("last_delivery_at"),
  lastDeliveryStatus: text("last_delivery_status"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Webhook delivery logs
export const webhookDeliveries = pgTable("dockit_webhook_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookId: varchar("webhook_id").notNull().references(() => webhooks.id),
  event: text("event").notNull(),
  payload: jsonb("payload").$type<Record<string, any>>(),
  status: text("status").notNull(), // "pending", "success", "failed"
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  attempts: integer("attempts").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMarinaSchema = createInsertSchema(marinas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserMarinaRoleSchema = createInsertSchema(userMarinaRoles).omit({
  id: true,
  createdAt: true,
});

export const insertReservationSchema = createInsertSchema(reservations).omit({
  id: true,
  actualCheckIn: true,
  actualCheckOut: true,
  paidAmount: true,
  confirmationCode: true,
  totalAmount: true, // calculated in storage layer based on baseRate and pricing rules
  baseRate: true, // calculated in storage layer based on slip and pricing rules
  createdAt: true,
  updatedAt: true,
});

export const insertWaitlistSchema = createInsertSchema(waitlist).omit({
  id: true,
  notificationsSent: true,
  lastNotified: true,
  createdAt: true,
});

export const insertPricingRuleSchema = createInsertSchema(pricingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSlipPricingSchema = createInsertSchema(slipPricing).omit({
  id: true,
  lastUpdated: true,
});

export const insertMessageThreadSchema = createInsertSchema(messageThreads).omit({
  id: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  isRead: true,
  readAt: true,
  createdAt: true,
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  documentUrl: true,
  signatureData: true,
  sentAt: true,
  signedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  isRead: true,
  readAt: true,
  createdAt: true,
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  updatedAt: true,
});

export const insertAnalyticsSnapshotSchema = createInsertSchema(analyticsSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWebhookSchema = createInsertSchema(webhooks).omit({
  id: true,
  failureCount: true,
  lastDeliveryAt: true,
  lastDeliveryStatus: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveries).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  lastLaunchDate: true,
});

export const insertBoatSchema = createInsertSchema(boats).omit({
  id: true,
});

export const insertSlipSchema = createInsertSchema(slips).omit({
  id: true,
});

export const insertLeaseSchema = createInsertSchema(leases).omit({
  id: true,
}).extend({
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

export const insertLaunchSchema = createInsertSchema(launches).omit({
  id: true,
  actualLaunchTime: true,
  retrievalTime: true,
  checkedInAt: true,
  queuePosition: true,
  estimatedWaitTime: true,
  lastStatusUpdate: true,
  createdAt: true,
}).extend({
  scheduledTime: z.coerce.date(),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  paidDate: true,
  createdAt: true,
}).extend({
  dueDate: z.coerce.date(),
});

export const insertBillingScheduleSchema = createInsertSchema(billingSchedules).omit({
  id: true,
  lastBilledDate: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  nextBillingDate: z.coerce.date(),
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  lastSync: true,
});

export const insertCommunicationSchema = createInsertSchema(communications).omit({
  id: true,
  sentAt: true,
});

export const insertImportJobSchema = createInsertSchema(importJobs).omit({
  id: true,
  processedRows: true,
  successCount: true,
  errorCount: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
});

export const insertImportErrorSchema = createInsertSchema(importErrors).omit({
  id: true,
  createdAt: true,
});

export const insertMarinaLayoutSchema = createInsertSchema(marinaLayouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Boat = typeof boats.$inferSelect;
export type InsertBoat = z.infer<typeof insertBoatSchema>;
export type Slip = typeof slips.$inferSelect;
export type InsertSlip = z.infer<typeof insertSlipSchema>;
export type Lease = typeof leases.$inferSelect;
export type InsertLease = z.infer<typeof insertLeaseSchema>;
export type Launch = typeof launches.$inferSelect;
export type InsertLaunch = z.infer<typeof insertLaunchSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type BillingSchedule = typeof billingSchedules.$inferSelect;
export type InsertBillingSchedule = z.infer<typeof insertBillingScheduleSchema>;
export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Communication = typeof communications.$inferSelect;
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;
export type ImportJob = typeof importJobs.$inferSelect;
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ImportError = typeof importErrors.$inferSelect;
export type InsertImportError = z.infer<typeof insertImportErrorSchema>;
export type MarinaLayout = typeof marinaLayouts.$inferSelect;
export type InsertMarinaLayout = z.infer<typeof insertMarinaLayoutSchema>;

// Multi-marina and user management types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Marina = typeof marinas.$inferSelect;
export type InsertMarina = z.infer<typeof insertMarinaSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserMarinaRole = typeof userMarinaRoles.$inferSelect;
export type InsertUserMarinaRole = z.infer<typeof insertUserMarinaRoleSchema>;

// Transient reservations and waitlist types
export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Waitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;

// Pricing system types
export type PricingRule = typeof pricingRules.$inferSelect;
export type InsertPricingRule = z.infer<typeof insertPricingRuleSchema>;
export type SlipPricing = typeof slipPricing.$inferSelect;
export type InsertSlipPricing = z.infer<typeof insertSlipPricingSchema>;

// Messaging types
export type MessageThread = typeof messageThreads.$inferSelect;
export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Contract and e-signature types
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;

// Notification system types
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;

// Analytics and audit types
export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;
export type InsertAnalyticsSnapshot = z.infer<typeof insertAnalyticsSnapshotSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// API access types
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = z.infer<typeof insertWebhookDeliverySchema>;

// Utility types for complex operations
export type ReservationWithDetails = Reservation & {
  customer: Customer;
  boat: Boat;
  slip?: Slip;
  marina: Marina;
};

export type LaunchWithDetails = Launch & {
  customer: Customer;
  boat: Boat;
  customerName?: string;
  customerPhone?: string;
  boatInfo?: string;
};

export type SlipWithPricing = Slip & {
  pricing?: SlipPricing;
  currentRate?: number;
};

export type UserWithRoles = User & {
  roles: Array<UserMarinaRole & { marina: Marina }>;
};

export type ContractWithDetails = Contract & {
  customer: Customer;
  marina: Marina;
  reservation?: Reservation;
  lease?: Lease;
};
