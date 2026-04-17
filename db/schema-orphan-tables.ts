/**
 * Orphan table declarations — tables that exist in the live database but had no
 * Drizzle schema definition. Declared here to eliminate EXTRA TABLE drift warnings.
 *
 * These are read-only stubs: they declare the shape of each table so the drift
 * checker recognises them. Application code may or may not use them directly.
 *
 * MAINTAINER NOTES
 * ─────────────────
 * Ownership: The team that owns a given feature domain owns the stub for that table.
 *
 * When the live DB schema changes (column added/removed), you MUST update the
 * corresponding stub here so the drift check continues to return RESULT: PASS.
 * Run `npx tsx scripts/check-schema-drift.ts` to verify after any edit.
 *
 * Lifecycle:
 *  • If a stub table is fully adopted by the codebase, move its definition into
 *    the appropriate domain schema file (e.g. shared/schema.ts or a db/schema-*.ts)
 *    and remove it from this file.
 *  • If a stub table is confirmed stale / unused, write a DROP TABLE migration
 *    in server/db-startup-migrations.ts and remove the stub from this file.
 *
 * Do NOT add new application logic or relations that reference these stubs —
 * treat each stub as a temporary placeholder until it is promoted or dropped.
 */

import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  uuid,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Financial / Accounting ──────────────────────────────────────────────────

export const accountBalances = pgTable("account_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  accountId: varchar("account_id"),
  periodStart: date("period_start"),
  debitTotal: numeric("debit_total"),
  creditTotal: numeric("credit_total"),
  netBalance: numeric("net_balance"),
  updatedAt: timestamp("updated_at"),
});

export const apBills = pgTable("ap_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  billNumber: varchar("bill_number"),
  vendorId: varchar("vendor_id"),
  vendorName: varchar("vendor_name"),
  vendorTaxId: varchar("vendor_tax_id"),
  issueDate: date("issue_date"),
  dueDate: date("due_date"),
  terms: varchar("terms"),
  subtotal: numeric("subtotal"),
  taxAmount: numeric("tax_amount"),
  totalAmount: numeric("total_amount"),
  amountPaid: numeric("amount_paid"),
  balanceDue: numeric("balance_due"),
  status: varchar("status"),
  currencyCode: varchar("currency_code"),
  memo: text("memo"),
  journalEntryId: varchar("journal_entry_id"),
  is1099Eligible: boolean("is_1099_eligible"),
  form1099Type: varchar("form_1099_type"),
  form1099Box: varchar("form_1099_box"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const apBillLines = pgTable("ap_bill_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  billId: varchar("bill_id"),
  lineNumber: integer("line_number"),
  description: text("description"),
  quantity: numeric("quantity"),
  unitPrice: numeric("unit_price"),
  amount: numeric("amount"),
  accountId: varchar("account_id"),
  departmentId: varchar("department_id"),
});

export const apPayments = pgTable("ap_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  billId: varchar("bill_id"),
  paymentDate: date("payment_date"),
  amount: numeric("amount"),
  paymentMethod: varchar("payment_method"),
  checkNumber: varchar("check_number"),
  bankAccountId: varchar("bank_account_id"),
  journalEntryId: varchar("journal_entry_id"),
  memo: text("memo"),
  createdAt: timestamp("created_at"),
});

export const arInvoices = pgTable("ar_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  invoiceNumber: varchar("invoice_number"),
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name"),
  issueDate: date("issue_date"),
  dueDate: date("due_date"),
  terms: varchar("terms"),
  subtotal: numeric("subtotal"),
  taxAmount: numeric("tax_amount"),
  totalAmount: numeric("total_amount"),
  amountPaid: numeric("amount_paid"),
  balanceDue: numeric("balance_due"),
  status: varchar("status"),
  currencyCode: varchar("currency_code"),
  memo: text("memo"),
  journalEntryId: varchar("journal_entry_id"),
  recurringScheduleId: varchar("recurring_schedule_id"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const arInvoiceLines = pgTable("ar_invoice_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id"),
  lineNumber: integer("line_number"),
  description: text("description"),
  quantity: numeric("quantity"),
  unitPrice: numeric("unit_price"),
  amount: numeric("amount"),
  accountId: varchar("account_id"),
  taxRate: numeric("tax_rate"),
  taxAmount: numeric("tax_amount"),
});

export const arPayments = pgTable("ar_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  invoiceId: varchar("invoice_id"),
  paymentDate: date("payment_date"),
  amount: numeric("amount"),
  paymentMethod: varchar("payment_method"),
  referenceNumber: varchar("reference_number"),
  depositAccountId: varchar("deposit_account_id"),
  journalEntryId: varchar("journal_entry_id"),
  memo: text("memo"),
  createdAt: timestamp("created_at"),
});

export const bankReconciliations = pgTable("bank_reconciliations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  bankAccountId: varchar("bank_account_id"),
  statementDate: date("statement_date"),
  statementBalance: numeric("statement_balance"),
  bookBalance: numeric("book_balance"),
  adjustedBankBalance: numeric("adjusted_bank_balance"),
  adjustedBookBalance: numeric("adjusted_book_balance"),
  difference: numeric("difference"),
  status: varchar("status"),
  reconciledBy: varchar("reconciled_by"),
  reconciledAt: timestamp("reconciled_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const bankReconciliationItems = pgTable("bank_reconciliation_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reconciliationId: varchar("reconciliation_id"),
  bankTransactionId: varchar("bank_transaction_id"),
  journalEntryLineId: varchar("journal_entry_line_id"),
  amount: numeric("amount"),
  itemType: varchar("item_type"),
  description: text("description"),
  isCleared: boolean("is_cleared"),
  createdAt: timestamp("created_at"),
});

export const bankTransactions = pgTable("bank_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  bankAccountId: varchar("bank_account_id"),
  transactionDate: date("transaction_date"),
  postDate: date("post_date"),
  description: text("description"),
  amount: numeric("amount"),
  runningBalance: numeric("running_balance"),
  transactionType: varchar("transaction_type"),
  checkNumber: varchar("check_number"),
  referenceNumber: varchar("reference_number"),
  category: varchar("category"),
  reconciliationStatus: varchar("reconciliation_status"),
  matchedJournalEntryId: varchar("matched_journal_entry_id"),
  matchedInvoiceId: varchar("matched_invoice_id"),
  matchedBillPaymentId: varchar("matched_bill_payment_id"),
  importBatchId: varchar("import_batch_id"),
  plaidTransactionId: varchar("plaid_transaction_id"),
  createdAt: timestamp("created_at"),
});

export const budgetTreeAccounts = pgTable("budget_tree_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  budgetVersionId: varchar("budget_version_id"),
  accountKey: text("account_key"),
  displayName: text("display_name"),
  parentKey: text("parent_key"),
  lineType: text("line_type"),
  sortOrder: integer("sort_order"),
  isParent: boolean("is_parent"),
  assetClass: text("asset_class"),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export const financialAuditLog = pgTable("financial_audit_log", {
  id: varchar("id").primaryKey(),
  orgId: varchar("org_id"),
  fundId: varchar("fund_id"),
  investorId: varchar("investor_id"),
  eventType: varchar("event_type"),
  actorUserId: varchar("actor_user_id"),
  actorEmail: varchar("actor_email"),
  actorRole: varchar("actor_role"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  amount: numeric("amount"),
  currency: varchar("currency"),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at"),
});

export const fundPeriodLocks = pgTable("fund_period_locks", {
  id: varchar("id").primaryKey(),
  orgId: varchar("org_id"),
  fundId: varchar("fund_id"),
  periodLabel: varchar("period_label"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by"),
  unlockedAt: timestamp("unlocked_at"),
  unlockedBy: varchar("unlocked_by"),
  unlockReason: text("unlock_reason"),
  isLocked: boolean("is_locked"),
});

export const glAccounts = pgTable("gl_accounts", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  accountCode: text("account_code"),
  accountName: text("account_name"),
  category: text("category"),
  description: text("description"),
  isActive: boolean("is_active"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const glMappings = pgTable("gl_mappings", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  glAccountId: text("gl_account_id"),
  chargeType: text("charge_type"),
  projectId: text("project_id"),
  storageLocationId: text("storage_location_id"),
  isActive: boolean("is_active"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const intercompanyTransactions = pgTable("intercompany_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  fromEntityId: varchar("from_entity_id"),
  fromEntityName: varchar("from_entity_name"),
  toEntityId: varchar("to_entity_id"),
  toEntityName: varchar("to_entity_name"),
  transactionDate: date("transaction_date"),
  amount: numeric("amount"),
  description: text("description"),
  fromJournalEntryId: varchar("from_journal_entry_id"),
  toJournalEntryId: varchar("to_journal_entry_id"),
  eliminationJournalEntryId: varchar("elimination_journal_entry_id"),
  isEliminated: boolean("is_eliminated"),
  createdAt: timestamp("created_at"),
});

export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  entryNumber: varchar("entry_number"),
  entryDate: date("entry_date"),
  postDate: timestamp("post_date"),
  memo: text("memo"),
  status: varchar("status"),
  source: varchar("source"),
  sourceRef: varchar("source_ref"),
  reversalOfId: varchar("reversal_of_id"),
  autoReversalDate: date("auto_reversal_date"),
  entityId: varchar("entity_id"),
  entityType: varchar("entity_type"),
  createdBy: varchar("created_by"),
  approvedBy: varchar("approved_by"),
  postedBy: varchar("posted_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const journalEntryLines = pgTable("journal_entry_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journalEntryId: varchar("journal_entry_id"),
  lineNumber: integer("line_number"),
  accountId: varchar("account_id"),
  accountCode: varchar("account_code"),
  accountName: varchar("account_name"),
  departmentId: varchar("department_id"),
  profitCenterId: varchar("profit_center_id"),
  description: text("description"),
  debit: numeric("debit"),
  credit: numeric("credit"),
  entityId: varchar("entity_id"),
  entityType: varchar("entity_type"),
});

export const monthEndCloses = pgTable("month_end_closes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  periodLabel: varchar("period_label"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  status: varchar("status"),
  closedBy: varchar("closed_by"),
  closedAt: timestamp("closed_at"),
  reopenedBy: varchar("reopened_by"),
  reopenedAt: timestamp("reopened_at"),
  reopenReason: text("reopen_reason"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const monthEndCloseSteps = pgTable("month_end_close_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  closeId: varchar("close_id"),
  stepOrder: integer("step_order"),
  stepName: varchar("step_name"),
  stepDescription: text("step_description"),
  status: varchar("status"),
  assignedTo: varchar("assigned_to"),
  completedBy: varchar("completed_by"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  requiredApproval: boolean("required_approval"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const reconciliationRecords = pgTable("reconciliation_records", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  projectId: text("project_id"),
  periodMonth: integer("period_month"),
  periodYear: integer("period_year"),
  status: text("status"),
  rentRollTotal: numeric("rent_roll_total"),
  glTotal: numeric("gl_total"),
  varianceAmount: numeric("variance_amount"),
  variancePercent: numeric("variance_percent"),
  notes: text("notes"),
  reconciledBy: text("reconciled_by"),
  reconciledAt: timestamp("reconciled_at"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const revenueContracts = pgTable("revenue_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  contractNumber: varchar("contract_number"),
  customerName: varchar("customer_name"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  totalContractValue: numeric("total_contract_value"),
  recognitionMethod: varchar("recognition_method"),
  recognizedToDate: numeric("recognized_to_date"),
  deferredRevenue: numeric("deferred_revenue"),
  status: varchar("status"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const revenuePerformanceObligations = pgTable("revenue_performance_obligations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id"),
  description: text("description"),
  standaloneSellingPrice: numeric("standalone_selling_price"),
  allocatedPrice: numeric("allocated_price"),
  recognitionMethod: varchar("recognition_method"),
  progressMeasure: varchar("progress_measure"),
  percentComplete: numeric("percent_complete"),
  recognizedAmount: numeric("recognized_amount"),
  deferredAmount: numeric("deferred_amount"),
  createdAt: timestamp("created_at"),
});

// ── AI & Knowledge ──────────────────────────────────────────────────────────

export const aiAnomalies = pgTable("ai_anomalies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  entityType: varchar("entity_type"),
  entityId: varchar("entity_id"),
  anomalyType: varchar("anomaly_type"),
  severity: varchar("severity"),
  description: text("description"),
  expectedValue: varchar("expected_value"),
  actualValue: varchar("actual_value"),
  deviationPercent: numeric("deviation_percent"),
  detectedAt: timestamp("detected_at"),
  isAcknowledged: boolean("is_acknowledged"),
  acknowledgedBy: varchar("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
});

export const aiConversationSessions = pgTable("ai_conversation_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  userId: varchar("user_id"),
  context: jsonb("context"),
  createdAt: timestamp("created_at"),
  lastActiveAt: timestamp("last_active_at"),
});

export const aiConversationMessages = pgTable("ai_conversation_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id"),
  role: varchar("role"),
  content: text("content"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at"),
});

export const aiDealScores = pgTable("ai_deal_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  dealId: varchar("deal_id"),
  overallScore: integer("overall_score"),
  factors: jsonb("factors"),
  riskFlags: jsonb("risk_flags"),
  recommendation: varchar("recommendation"),
  confidence: numeric("confidence"),
  scoredAt: timestamp("scored_at"),
});

export const aiGlobalKnowledge = pgTable("ai_global_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: text("question"),
  answer: text("answer"),
  advisoryMode: text("advisory_mode"),
  assetContext: text("asset_context"),
  qualityScore: numeric("quality_score"),
  useCount: integer("use_count"),
  embedding: jsonb("embedding"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const aiKnowledgeDocuments = pgTable("ai_knowledge_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: text("org_id"),
  userId: text("user_id"),
  title: text("title"),
  description: text("description"),
  contentText: text("content_text"),
  sourceType: text("source_type"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  status: text("status"),
  chunkCount: integer("chunk_count"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const aiKnowledgeChunks = pgTable("ai_knowledge_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id"),
  orgId: text("org_id"),
  chunkIndex: integer("chunk_index"),
  content: text("content"),
  embedding: jsonb("embedding"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

// ── CRM Extensions ──────────────────────────────────────────────────────────

export const companyHierarchies = pgTable("company_hierarchies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  companyId: varchar("company_id"),
  parentCompanyId: varchar("parent_company_id"),
  hierarchyLevel: integer("hierarchy_level"),
  createdAt: timestamp("created_at"),
});

export const contactRelationshipScores = pgTable("contact_relationship_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  contactId: varchar("contact_id"),
  score: integer("score"),
  factors: jsonb("factors"),
  scoredAt: timestamp("scored_at"),
});

export const crmCustomFieldDefinitions = pgTable("crm_custom_field_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  entityType: text("entity_type"),
  fieldKey: text("field_key"),
  fieldLabel: text("field_label"),
  fieldType: text("field_type"),
  description: text("description"),
  isRequired: boolean("is_required"),
  defaultValue: text("default_value"),
  options: jsonb("options"),
  sortOrder: integer("sort_order"),
  isActive: boolean("is_active"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const crmForecastSnapshots = pgTable("crm_forecast_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  snapshotDate: date("snapshot_date"),
  pipelineId: varchar("pipeline_id"),
  period: text("period"),
  totalWeightedValue: numeric("total_weighted_value"),
  totalUnweightedValue: numeric("total_unweighted_value"),
  dealCount: integer("deal_count"),
  wonValue: numeric("won_value"),
  wonCount: integer("won_count"),
  lostValue: numeric("lost_value"),
  lostCount: integer("lost_count"),
  stageBreakdown: jsonb("stage_breakdown"),
  createdAt: timestamp("created_at"),
});

export const dealComparisons = pgTable("deal_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: varchar("name"),
  dealIds: jsonb("deal_ids"),
  comparisonData: jsonb("comparison_data"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
});

// ── Commercial Leases (CL module) ───────────────────────────────────────────

export const commercialLeases = pgTable("commercial_leases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id"),
  tenantName: text("tenant_name"),
  leaseType: text("lease_type"),
  suite: text("suite"),
  sf: numeric("sf"),
  units: integer("units"),
  active: boolean("active"),
  commencementDate: date("commencement_date"),
  rentCommencementDate: date("rent_commencement_date"),
  expirationDate: date("expiration_date"),
  securityDeposit: numeric("security_deposit"),
  fiscalYearEndMonth: integer("fiscal_year_end_month"),
  notes: text("notes"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  orgId: varchar("org_id"),
  propertyId: varchar("property_id"),
  sourceLeaseId: varchar("source_lease_id"),
  leaseContext: text("lease_context"),
});

export const leaseAbatements = pgTable("lease_abatements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaseId: varchar("lease_id"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  abatementType: text("abatement_type"),
  value: numeric("value"),
  appliesTo: text("applies_to"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const leaseChargeLines = pgTable("lease_charge_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaseId: varchar("lease_id"),
  lineName: text("line_name"),
  lineType: text("line_type"),
  amountMode: text("amount_mode"),
  amountValue: numeric("amount_value"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  escalationType: text("escalation_type"),
  escalationValue: numeric("escalation_value"),
  escalationCycleMonths: integer("escalation_cycle_months"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const leaseMonthlyCashflows = pgTable("lease_monthly_cashflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaseId: varchar("lease_id"),
  monthEnd: date("month_end"),
  baseRent: numeric("base_rent"),
  recoveriesCam: numeric("recoveries_cam"),
  recoveriesTax: numeric("recoveries_tax"),
  recoveriesInsurance: numeric("recoveries_insurance"),
  recoveriesUtilities: numeric("recoveries_utilities"),
  miscIncome: numeric("misc_income"),
  discounts: numeric("discounts"),
  percentRent: numeric("percent_rent"),
  tiLandlordCapex: numeric("ti_landlord_capex"),
  tiTenantContribution: numeric("ti_tenant_contribution"),
  tiAmortizationCharge: numeric("ti_amortization_charge"),
  totalRent: numeric("total_rent"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const leasePercentRentRules = pgTable("lease_percent_rent_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaseId: varchar("lease_id"),
  timing: text("timing"),
  breakpointType: text("breakpoint_type"),
  artificialBreakpointAmount: numeric("artificial_breakpoint_amount"),
  tiersJson: jsonb("tiers_json"),
  trueupYearBasis: text("trueup_year_basis"),
  salesGrowthRate: numeric("sales_growth_rate"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const leaseRecoveryCategories = pgTable("lease_recovery_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recoveryModelId: varchar("recovery_model_id"),
  category: text("category"),
  stopType: text("stop_type"),
  baseYearAmountTotal: numeric("base_year_amount_total"),
  expenseStopPerSf: numeric("expense_stop_per_sf"),
  annualExpenseForecast: jsonb("annual_expense_forecast"),
  annualGrowthRate: numeric("annual_growth_rate"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const leaseRecoveryModels = pgTable("lease_recovery_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaseId: varchar("lease_id"),
  totalPropertyNraSf: numeric("total_property_nra_sf"),
  tenantShareMode: text("tenant_share_mode"),
  tenantSharePercent: numeric("tenant_share_percent"),
  billingTiming: text("billing_timing"),
  stopYearBasis: text("stop_year_basis"),
  baseYear: integer("base_year"),
  grossupEnabled: boolean("grossup_enabled"),
  grossupOccupancyThreshold: numeric("grossup_occupancy_threshold"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const leaseSales = pgTable("lease_sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaseId: varchar("lease_id"),
  monthEnd: date("month_end"),
  salesAmount: numeric("sales_amount"),
  source: text("source"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const leaseTerms = pgTable("lease_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaseId: varchar("lease_id"),
  termIndex: integer("term_index"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  baseRentMode: text("base_rent_mode"),
  baseRentValue: numeric("base_rent_value"),
  escalationType: text("escalation_type"),
  escalationValue: numeric("escalation_value"),
  escalationCycleMonths: integer("escalation_cycle_months"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const leaseTiDraws = pgTable("lease_ti_draws", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tiProgramId: varchar("ti_program_id"),
  drawDate: date("draw_date"),
  amount: numeric("amount"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const leaseTiPrograms = pgTable("lease_ti_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leaseId: varchar("lease_id"),
  allowanceMode: text("allowance_mode"),
  allowanceValue: numeric("allowance_value"),
  landlordCapTotal: numeric("landlord_cap_total"),
  tenantParticipationMode: text("tenant_participation_mode"),
  tenantParticipationValue: numeric("tenant_participation_value"),
  tenantFixedContribution: numeric("tenant_fixed_contribution"),
  amortizeEnabled: boolean("amortize_enabled"),
  amortizeAmountBasis: text("amortize_amount_basis"),
  amortizeRateAnnual: numeric("amortize_rate_annual"),
  amortizeTermMonths: integer("amortize_term_months"),
  amortizeStartMonthEnd: date("amortize_start_month_end"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ── LP / Investor Portal ─────────────────────────────────────────────────────

export const distributionApprovals = pgTable("distribution_approvals", {
  id: varchar("id").primaryKey(),
  orgId: varchar("org_id"),
  fundId: varchar("fund_id"),
  status: varchar("status"),
  totalProceeds: numeric("total_proceeds"),
  distributionType: varchar("distribution_type"),
  dealAllocationId: varchar("deal_allocation_id"),
  notes: text("notes"),
  yearsHeld: numeric("years_held"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  submittedForApprovalAt: timestamp("submitted_for_approval_at"),
  submittedBy: varchar("submitted_by"),
  approvalsJson: jsonb("approvals_json"),
  requiredApprovals: integer("required_approvals"),
  rejectedBy: varchar("rejected_by"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  executedAt: timestamp("executed_at"),
  executedBy: varchar("executed_by"),
  waterfallResult: jsonb("waterfall_result"),
  investorAllocations: jsonb("investor_allocations"),
});

export const investorLetterTemplates = pgTable("investor_letter_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: varchar("name"),
  templateType: varchar("template_type"),
  subject: text("subject"),
  bodyTemplate: text("body_template"),
  tokens: jsonb("tokens"),
  isDefault: boolean("is_default"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
});

export const kpiDashboards = pgTable("kpi_dashboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: varchar("name"),
  description: text("description"),
  widgets: jsonb("widgets"),
  layout: jsonb("layout"),
  isDefault: boolean("is_default"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const kycVerifications = pgTable("kyc_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  investorId: varchar("investor_id"),
  verificationType: varchar("verification_type"),
  status: varchar("status"),
  provider: varchar("provider"),
  providerReference: varchar("provider_reference"),
  verificationData: jsonb("verification_data"),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
});

export const loanPackages = pgTable("loan_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  dealId: varchar("deal_id"),
  dealName: varchar("deal_name"),
  lenderName: varchar("lender_name"),
  packageType: varchar("package_type"),
  documents: jsonb("documents"),
  status: varchar("status"),
  submittedAt: timestamp("submitted_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const lpPortalSessions = pgTable("lp_portal_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  sessionHash: varchar("session_hash"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
});

export const lpPortalUsers = pgTable("lp_portal_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  investorId: varchar("investor_id"),
  email: varchar("email"),
  name: varchar("name"),
  passwordHash: varchar("password_hash"),
  inviteTokenHash: varchar("invite_token_hash"),
  mfaEnabled: boolean("mfa_enabled"),
  mfaSecret: varchar("mfa_secret"),
  lastLogin: timestamp("last_login"),
  status: varchar("status"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const lpStatements = pgTable("lp_statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  fundId: varchar("fund_id"),
  investorId: varchar("investor_id"),
  statementType: varchar("statement_type"),
  periodLabel: varchar("period_label"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  data: jsonb("data"),
  pdfUrl: text("pdf_url"),
  generatedAt: timestamp("generated_at"),
  deliveredAt: timestamp("delivered_at"),
  deliveryMethod: varchar("delivery_method"),
});

// ── OM Builder ───────────────────────────────────────────────────────────────

export const omBindingCache = pgTable("om_binding_cache", {
  id: varchar("id").primaryKey(),
  documentId: varchar("document_id"),
  bindingKey: varchar("binding_key"),
  source: text("source"),
  field: varchar("field"),
  resolvedValue: jsonb("resolved_value"),
  resolvedAt: timestamp("resolved_at"),
  expiresAt: timestamp("expires_at"),
});

export const omBuilderDocuments = pgTable("om_builder_documents", {
  id: varchar("id").primaryKey(),
  dealId: varchar("deal_id"),
  documentType: text("document_type"),
  title: text("title"),
  audience: text("audience"),
  assetClass: text("asset_class"),
  themeId: varchar("theme_id"),
  templateId: varchar("template_id"),
  brandKitId: varchar("brand_kit_id"),
  status: text("status"),
  config: jsonb("config"),
  metadata: jsonb("metadata"),
  workingSnapshot: jsonb("working_snapshot"),
  completionStatus: jsonb("completion_status"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const omDocumentSections = pgTable("om_document_sections", {
  id: varchar("id").primaryKey(),
  documentId: varchar("document_id"),
  sectionKey: varchar("section_key"),
  order: integer("order"),
  enabled: boolean("enabled"),
  customTitle: text("custom_title"),
  dataBindings: jsonb("data_bindings"),
  media: jsonb("media"),
  content: jsonb("content"),
  aiGenerated: boolean("ai_generated"),
  lastAiGeneratedAt: timestamp("last_ai_generated_at"),
  completionStatus: jsonb("completion_status"),
  pageIds: jsonb("page_ids"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  renderedContent: text("rendered_content"),
});

export const omExemplars = pgTable("om_exemplars", {
  id: varchar("id").primaryKey(),
  name: text("name"),
  description: text("description"),
  documentType: text("document_type"),
  assetClass: text("asset_class"),
  uploadedFileUrl: text("uploaded_file_url"),
  uploadedFileName: text("uploaded_file_name"),
  fileSizeBytes: integer("file_size_bytes"),
  extractedStructure: jsonb("extracted_structure"),
  extractedStyles: jsonb("extracted_styles"),
  embeddings: jsonb("embeddings"),
  organizationId: varchar("organization_id"),
  userId: varchar("user_id"),
  isPublic: boolean("is_public"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const omExportJobs = pgTable("om_export_jobs", {
  id: varchar("id").primaryKey(),
  documentId: varchar("document_id"),
  format: text("format"),
  status: text("status"),
  outputUrl: text("output_url"),
  outputFileName: text("output_file_name"),
  fileSizeBytes: integer("file_size_bytes"),
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  options: jsonb("options"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at"),
});

export const omSectionLibrary = pgTable("om_section_library", {
  id: varchar("id").primaryKey(),
  sectionKey: varchar("section_key"),
  name: text("name"),
  description: text("description"),
  category: varchar("category"),
  supportedDocTypes: jsonb("supported_doc_types"),
  requiredDataBindings: jsonb("required_data_bindings"),
  optionalDataBindings: jsonb("optional_data_bindings"),
  requiredMedia: jsonb("required_media"),
  optionalMedia: jsonb("optional_media"),
  schema: jsonb("schema"),
  defaultLayouts: jsonb("default_layouts"),
  aiPromptTemplates: jsonb("ai_prompt_templates"),
  completionRules: jsonb("completion_rules"),
  estimatedPages: integer("estimated_pages"),
  marinaSpecific: boolean("marina_specific"),
  isSystemDefault: boolean("is_system_default"),
  organizationId: varchar("organization_id"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ── Document Management ──────────────────────────────────────────────────────

export const documentRenders = pgTable("document_renders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  documentId: varchar("document_id"),
  templateId: varchar("template_id"),
  dealId: varchar("deal_id"),
  projectId: varchar("project_id"),
  format: varchar("format"),
  status: varchar("status"),
  renderedHtml: text("rendered_html"),
  renderedJson: jsonb("rendered_json"),
  outputUrl: text("output_url"),
  outputFileName: text("output_file_name"),
  fileSizeBytes: integer("file_size_bytes"),
  tokenSnapshot: jsonb("token_snapshot"),
  tokenStats: jsonb("token_stats"),
  overrides: jsonb("overrides"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: varchar("name"),
  documentType: varchar("document_type"),
  description: text("description"),
  sections: jsonb("sections"),
  styles: jsonb("styles"),
  tokenDefaults: jsonb("token_defaults"),
  isGlobal: boolean("is_global"),
  isArchived: boolean("is_archived"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const documentVersions = pgTable("document_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  documentId: varchar("document_id"),
  versionNumber: integer("version_number"),
  renderedHtml: text("rendered_html"),
  renderedJson: jsonb("rendered_json"),
  tokenSnapshot: jsonb("token_snapshot"),
  changeDescription: text("change_description"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
});

export const esignatureRequests = pgTable("esignature_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  documentId: varchar("document_id"),
  documentTitle: varchar("document_title"),
  signers: jsonb("signers"),
  status: varchar("status"),
  provider: varchar("provider"),
  externalEnvelopeId: varchar("external_envelope_id"),
  message: text("message"),
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const reportSchedules = pgTable("report_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: varchar("name"),
  reportType: varchar("report_type"),
  filters: jsonb("filters"),
  cronExpression: varchar("cron_expression"),
  deliveryMethod: varchar("delivery_method"),
  recipients: jsonb("recipients"),
  format: varchar("format"),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  status: varchar("status"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
});

// ── Security ─────────────────────────────────────────────────────────────────

export const securityAuditLogs = pgTable("security_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: integer("org_id"),
  actorUserId: varchar("actor_user_id"),
  actorType: varchar("actor_type"),
  action: varchar("action"),
  resourceType: varchar("resource_type"),
  resourceId: varchar("resource_id"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  requestId: varchar("request_id"),
  previousLogHash: varchar("previous_log_hash"),
  logHash: varchar("log_hash"),
  createdAt: timestamp("created_at"),
});

export const securityDocuments = pgTable("security_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: integer("org_id"),
  uploadedBy: varchar("uploaded_by"),
  originalFilename: varchar("original_filename"),
  storagePath: varchar("storage_path"),
  mimeType: varchar("mime_type"),
  sizeBytes: numeric("size_bytes"),
  checksumSha256: varchar("checksum_sha256"),
  documentType: varchar("document_type"),
  classification: varchar("classification"),
  status: varchar("status"),
  quarantineReason: text("quarantine_reason"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  version: integer("version"),
  previousVersionId: varchar("previous_version_id"),
  metadata: jsonb("metadata"),
  retentionExpiresAt: timestamp("retention_expires_at"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  deletedAt: timestamp("deleted_at"),
});

export const securityIntegrations = pgTable("security_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: integer("org_id"),
  type: varchar("type"),
  status: varchar("status"),
  externalId: varchar("external_id"),
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: jsonb("scopes"),
  connectedBy: integer("connected_by"),
  connectedAt: timestamp("connected_at"),
  lastSyncAt: timestamp("last_sync_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const securityPermissions = pgTable("security_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name"),
  description: text("description"),
  resource: varchar("resource"),
  action: varchar("action"),
  createdAt: timestamp("created_at"),
});

export const securityRoles = pgTable("security_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: integer("org_id"),
  name: varchar("name"),
  description: text("description"),
  isSystem: boolean("is_system"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const securityRolePermissions = pgTable("security_role_permissions", {
  roleId: varchar("role_id").notNull(),
  permissionId: varchar("permission_id").notNull(),
  createdAt: timestamp("created_at"),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}));

export const securitySessions = pgTable("security_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  orgId: integer("org_id"),
  tokenHash: varchar("token_hash"),
  csrfToken: varchar("csrf_token"),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
  lastActivityAt: timestamp("last_activity_at"),
});

export const securityUserRoles = pgTable("security_user_roles", {
  userId: varchar("user_id").notNull(),
  roleId: varchar("role_id").notNull(),
  assignedBy: varchar("assigned_by"),
  assignedAt: timestamp("assigned_at"),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
}));

// ── Compliance & Privacy ─────────────────────────────────────────────────────

export const dataRetentionPolicies = pgTable("data_retention_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  dataType: varchar("data_type"),
  retentionDays: integer("retention_days"),
  isActive: boolean("is_active"),
  createdAt: timestamp("created_at"),
});

export const encryptedFields = pgTable("encrypted_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  tableName: varchar("table_name"),
  fieldName: varchar("field_name"),
  recordId: varchar("record_id"),
  encryptedValue: text("encrypted_value"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const gdprConsentRecords = pgTable("gdpr_consent_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  orgId: varchar("org_id"),
  consentType: varchar("consent_type"),
  granted: boolean("granted"),
  ipAddress: varchar("ip_address"),
  grantedAt: timestamp("granted_at"),
  revokedAt: timestamp("revoked_at"),
});

export const ipAllowlists = pgTable("ip_allowlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  cidr: varchar("cidr"),
  description: varchar("description"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
});

// ── Settings & Preferences ───────────────────────────────────────────────────

export const organizationSettings = pgTable("organization_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  settingKey: varchar("setting_key"),
  settingValue: text("setting_value"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const personalAccessTokens = pgTable("personal_access_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  name: text("name"),
  tokenHash: text("token_hash"),
  tokenPrefix: text("token_prefix"),
  scopes: jsonb("scopes"),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at"),
  revokedAt: timestamp("revoked_at"),
});

export const settingsAuditLog = pgTable("settings_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  action: text("action"),
  category: text("category"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at"),
});

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  autoSave: boolean("auto_save"),
  timezone: text("timezone"),
  locale: text("locale"),
  currency: text("currency"),
  defaultLanding: text("default_landing"),
  theme: text("theme"),
  density: text("density"),
  reducedMotion: boolean("reduced_motion"),
  stickyHeaders: boolean("sticky_headers"),
  numberFormat: text("number_format"),
  decimalPrecision: integer("decimal_precision"),
  notificationPreferences: jsonb("notification_preferences"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ── Communication ─────────────────────────────────────────────────────────────

export const emailTrackingEvents = pgTable("email_tracking_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  emailId: varchar("email_id"),
  trackingId: varchar("tracking_id"),
  eventType: varchar("event_type"),
  recipientEmail: varchar("recipient_email"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  linkUrl: text("link_url"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at"),
});

export const emailUnsubscribes = pgTable("email_unsubscribes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  contactId: varchar("contact_id"),
  email: varchar("email"),
  reason: varchar("reason"),
  unsubscribedAt: timestamp("unsubscribed_at"),
});

// ── Rent Roll ────────────────────────────────────────────────────────────────

export const rentRollProjects = pgTable("rent_roll_projects", {
  id: varchar("id").primaryKey(),
  orgId: varchar("org_id"),
  name: text("name"),
  code: varchar("code"),
  description: text("description"),
  status: varchar("status"),
  projectType: varchar("project_type"),
  seasonType: varchar("season_type"),
  capacity: integer("capacity"),
  isActive: boolean("is_active"),
  targetNoi: numeric("target_noi"),
  includeInExecutive: boolean("include_in_executive"),
  seasonStartDate: date("season_start_date"),
  seasonEndDate: date("season_end_date"),
  winterStartDate: date("winter_start_date"),
  winterEndDate: date("winter_end_date"),
  budgetedRevenue: numeric("budgeted_revenue"),
  budgetedOccupancy: numeric("budgeted_occupancy"),
  budgetedExpenses: numeric("budgeted_expenses"),
  budgetYear: integer("budget_year"),
  storageMix: jsonb("storage_mix"),
  baseRent1Label: text("base_rent1_label"),
  baseRent2Label: text("base_rent2_label"),
  baseRent3Label: text("base_rent3_label"),
  charge1Label: text("charge1_label"),
  charge2Label: text("charge2_label"),
  charge3Label: text("charge3_label"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
  autoSyncEnabled: boolean("auto_sync_enabled"),
  lastSyncAt: timestamp("last_sync_at"),
});

export const rraReportPackages = pgTable("rra_report_packages", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  name: text("name"),
  description: text("description"),
  packageType: text("package_type"),
  status: text("status"),
  projectId: text("project_id"),
  periodStartDate: date("period_start_date"),
  periodEndDate: date("period_end_date"),
  asOfDate: date("as_of_date"),
  snapshotId: text("snapshot_id"),
  generatedAt: timestamp("generated_at"),
  reportUrl: text("report_url"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ── Extraction Config ────────────────────────────────────────────────────────

export const extractionOrgConfig = pgTable("extraction_org_config", {
  orgId: varchar("org_id").primaryKey(),
  confidenceHigh: numeric("confidence_high"),
  confidenceMedium: numeric("confidence_medium"),
  updatedAt: timestamp("updated_at"),
});

// ── Docket Users ─────────────────────────────────────────────────────────────

export const docketUsers = pgTable("docket_users", {
  id: varchar("id").primaryKey(),
  marinaUserId: varchar("marina_user_id"),
  orgId: varchar("org_id"),
  username: text("username"),
  password: text("password"),
  email: text("email"),
  role: varchar("role"),
  subscriptionTier: varchar("subscription_tier"),
  isActive: boolean("is_active"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ── Workflow Engine ───────────────────────────────────────────────────────────

export const workflowRules = pgTable("workflow_rules", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  name: text("name"),
  description: text("description"),
  isActive: boolean("is_active"),
  runOrder: integer("run_order"),
  triggerType: text("trigger_type"),
  triggerConfig: jsonb("trigger_config"),
  conditions: jsonb("conditions"),
  actions: jsonb("actions"),
  timesTriggered: integer("times_triggered"),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const workflowExecutions = pgTable("workflow_executions", {
  id: text("id").primaryKey(),
  ruleId: text("rule_id"),
  orgId: text("org_id"),
  triggerType: text("trigger_type"),
  dealId: text("deal_id"),
  dealName: text("deal_name"),
  triggerData: jsonb("trigger_data"),
  status: text("status"),
  skippedReason: text("skipped_reason"),
  actionsRun: jsonb("actions_run"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
});

export const workflowTasks = pgTable("workflow_tasks", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  dealId: text("deal_id"),
  createdByRuleId: text("created_by_rule_id"),
  createdByExecutionId: text("created_by_execution_id"),
  title: text("title"),
  description: text("description"),
  assigneeId: text("assignee_id"),
  assigneeName: text("assignee_name"),
  dueDate: date("due_date"),
  priority: text("priority"),
  status: text("status"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const workflowNotifications = pgTable("workflow_notifications", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  userId: text("user_id"),
  dealId: text("deal_id"),
  ruleId: text("rule_id"),
  executionId: text("execution_id"),
  title: text("title"),
  body: text("body"),
  link: text("link"),
  isRead: boolean("is_read"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export const workflowEmailTemplates = pgTable("workflow_email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: varchar("name"),
  subject: varchar("subject"),
  bodyHtml: text("body_html"),
  bodyText: text("body_text"),
  category: varchar("category"),
  tokensUsed: text("tokens_used").array(),
  isActive: boolean("is_active"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const workflowEmailLog = pgTable("workflow_email_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  ruleId: varchar("rule_id"),
  executionId: varchar("execution_id"),
  templateId: varchar("template_id"),
  recipientEmail: varchar("recipient_email"),
  recipientName: varchar("recipient_name"),
  recipientType: varchar("recipient_type"),
  subject: varchar("subject"),
  bodyPreview: text("body_preview"),
  status: varchar("status"),
  provider: varchar("provider"),
  providerId: varchar("provider_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export const workflowWebhooks = pgTable("workflow_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: varchar("name"),
  url: text("url"),
  secret: varchar("secret"),
  eventTypes: jsonb("event_types"),
  isActive: boolean("is_active"),
  createdAt: timestamp("created_at"),
});

export const workflowWebhookDeliveries = pgTable("workflow_webhook_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookId: varchar("webhook_id"),
  eventType: varchar("event_type"),
  payload: jsonb("payload"),
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  attemptNumber: integer("attempt_number"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at"),
});

export const workflowPipelines = pgTable("workflow_pipelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: varchar("name"),
  description: text("description"),
  steps: jsonb("steps"),
  isActive: boolean("is_active"),
  createdAt: timestamp("created_at"),
});

export const workflowPipelineExecutions = pgTable("workflow_pipeline_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pipelineId: varchar("pipeline_id"),
  orgId: varchar("org_id"),
  context: jsonb("context"),
  currentStep: integer("current_step"),
  status: varchar("status"),
  stepResults: jsonb("step_results"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const workflowApprovalRequests = pgTable("workflow_approval_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  executionId: varchar("execution_id"),
  stepIndex: integer("step_index"),
  title: varchar("title"),
  description: text("description"),
  requestedBy: varchar("requested_by"),
  assignedTo: varchar("assigned_to"),
  status: varchar("status"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectedReason: text("rejected_reason"),
  escalationDeadline: timestamp("escalation_deadline"),
  createdAt: timestamp("created_at"),
});

export const workflowScheduledTriggers = pgTable("workflow_scheduled_triggers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id"),
  name: varchar("name"),
  cronExpression: varchar("cron_expression"),
  workflowRuleId: varchar("workflow_rule_id"),
  actionConfig: jsonb("action_config"),
  isActive: boolean("is_active"),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at"),
});
