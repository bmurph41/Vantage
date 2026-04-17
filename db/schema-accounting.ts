/**
 * Accounting / Financial Integration schema
 *
 * Tables in this file are the target of accounting-system sync connectors
 * (Xero, Sage Intacct, QuickBooks) and are also used for GL reconciliation,
 * rent-roll reporting, and budget tracking.
 *
 * Promoted from db/schema-orphan-tables.ts — these are confirmed active tables.
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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── AP / Bills ───────────────────────────────────────────────────────────────

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

// ── AR / Invoices ────────────────────────────────────────────────────────────

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

// ── Bank ─────────────────────────────────────────────────────────────────────

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

// ── GL ───────────────────────────────────────────────────────────────────────

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

// ── Journal Entries ──────────────────────────────────────────────────────────

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

// ── Month-End Close ──────────────────────────────────────────────────────────

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

// ── Fund & Period ────────────────────────────────────────────────────────────

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

// ── Intercompany ─────────────────────────────────────────────────────────────

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

// ── Revenue Recognition ──────────────────────────────────────────────────────

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

// ── Account Balances ─────────────────────────────────────────────────────────

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

// ── Reconciliation & Rent Roll ───────────────────────────────────────────────

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
