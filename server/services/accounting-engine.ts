/**
 * Vantage Accounting Engine
 * Full double-entry accounting: AR, AP, JE, Bank Reconciliation,
 * Trial Balance, Cash Flow Statement, Month-End Close, 1099 Tracking,
 * Intercompany Eliminations, Revenue Recognition (ASC 606)
 */

import { db } from '../db';
import { sql, eq, and, gte, lte, desc, asc, inArray, isNull, or } from 'drizzle-orm';
import Decimal from 'decimal.js';
import crypto from 'crypto';
import { financialAuditService } from './financial-audit-service';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'contra_asset' | 'contra_revenue' | 'contra_expense';
export type JournalEntryStatus = 'draft' | 'posted' | 'reversed' | 'void';
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void' | 'write_off';
export type BillStatus = 'draft' | 'approved' | 'partial' | 'paid' | 'overdue' | 'void';
export type ReconciliationStatus = 'unreconciled' | 'matched' | 'reconciled' | 'exception';
export type CloseStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type RevenueRecognitionMethod = 'point_in_time' | 'over_time_input' | 'over_time_output' | 'straight_line';

export interface JournalEntry {
  id: string;
  orgId: string;
  entryNumber: string;
  entryDate: Date;
  postDate: Date | null;
  memo: string;
  status: JournalEntryStatus;
  source: string;
  sourceRef: string | null;
  reversalOfId: string | null;
  autoReversalDate: Date | null;
  entityId: string | null;
  entityType: string | null;
  createdBy: string;
  approvedBy: string | null;
  postedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  lineNumber: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  departmentId: string | null;
  profitCenterId: string | null;
  description: string;
  debit: string;
  credit: string;
  entityId: string | null;
  entityType: string | null;
}

export interface ARInvoice {
  id: string;
  orgId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  issueDate: Date;
  dueDate: Date;
  terms: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  status: InvoiceStatus;
  currencyCode: string;
  memo: string | null;
  journalEntryId: string | null;
  recurringScheduleId: string | null;
  lineItems: ARInvoiceLine[];
  payments: ARPayment[];
}

export interface ARInvoiceLine {
  id: string;
  invoiceId: string;
  lineNumber: number;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  accountId: string;
  taxRate: string;
  taxAmount: string;
}

export interface ARPayment {
  id: string;
  orgId: string;
  invoiceId: string;
  paymentDate: Date;
  amount: string;
  paymentMethod: string;
  referenceNumber: string | null;
  depositAccountId: string;
  journalEntryId: string | null;
  memo: string | null;
}

export interface APBill {
  id: string;
  orgId: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  vendorTaxId: string | null;
  issueDate: Date;
  dueDate: Date;
  terms: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  status: BillStatus;
  currencyCode: string;
  memo: string | null;
  journalEntryId: string | null;
  is1099Eligible: boolean;
  form1099Type: string | null;
  form1099Box: string | null;
  lineItems: APBillLine[];
  payments: APPayment[];
}

export interface APBillLine {
  id: string;
  billId: string;
  lineNumber: number;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  accountId: string;
  departmentId: string | null;
}

export interface APPayment {
  id: string;
  orgId: string;
  billId: string;
  paymentDate: Date;
  amount: string;
  paymentMethod: string;
  checkNumber: string | null;
  bankAccountId: string;
  journalEntryId: string | null;
  memo: string | null;
}

export interface BankTransaction {
  id: string;
  orgId: string;
  bankAccountId: string;
  transactionDate: Date;
  postDate: Date;
  description: string;
  amount: string;
  runningBalance: string;
  transactionType: 'debit' | 'credit';
  checkNumber: string | null;
  referenceNumber: string | null;
  category: string | null;
  reconciliationStatus: ReconciliationStatus;
  matchedJournalEntryId: string | null;
  matchedInvoiceId: string | null;
  matchedBillPaymentId: string | null;
  importBatchId: string | null;
  plaidTransactionId: string | null;
}

export interface BankReconciliation {
  id: string;
  orgId: string;
  bankAccountId: string;
  statementDate: Date;
  statementBalance: string;
  bookBalance: string;
  adjustedBankBalance: string;
  adjustedBookBalance: string;
  difference: string;
  status: 'in_progress' | 'balanced' | 'completed';
  reconciledBy: string | null;
  reconciledAt: Date | null;
  items: BankReconciliationItem[];
}

export interface BankReconciliationItem {
  id: string;
  reconciliationId: string;
  bankTransactionId: string | null;
  journalEntryLineId: string | null;
  amount: string;
  itemType: 'outstanding_check' | 'deposit_in_transit' | 'bank_charge' | 'interest' | 'nsf' | 'adjustment';
  description: string;
  isCleared: boolean;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  debitBalance: string;
  creditBalance: string;
  netBalance: string;
}

export interface CashFlowStatement {
  period: { start: Date; end: Date };
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: string;
  beginningCash: string;
  endingCash: string;
}

export interface CashFlowSection {
  label: string;
  items: { description: string; amount: string }[];
  total: string;
}

export interface MonthEndClose {
  id: string;
  orgId: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  status: 'open' | 'in_progress' | 'review' | 'closed';
  steps: MonthEndCloseStep[];
  closedBy: string | null;
  closedAt: Date | null;
  reopenedBy: string | null;
  reopenedAt: Date | null;
  reopenReason: string | null;
}

export interface MonthEndCloseStep {
  id: string;
  closeId: string;
  stepOrder: number;
  stepName: string;
  stepDescription: string;
  status: CloseStepStatus;
  assignedTo: string | null;
  completedBy: string | null;
  completedAt: Date | null;
  notes: string | null;
  requiredApproval: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
}

export interface Vendor1099Summary {
  vendorId: string;
  vendorName: string;
  vendorTaxId: string;
  form1099Type: string;
  totalPayments: string;
  boxes: Record<string, string>;
  requiresFiling: boolean;
  filingThreshold: string;
}

export interface RevenueContract {
  id: string;
  orgId: string;
  contractNumber: string;
  customerName: string;
  startDate: Date;
  endDate: Date;
  totalContractValue: string;
  recognitionMethod: RevenueRecognitionMethod;
  performanceObligations: PerformanceObligation[];
  recognizedToDate: string;
  deferredRevenue: string;
  status: 'active' | 'completed' | 'terminated';
}

export interface PerformanceObligation {
  id: string;
  contractId: string;
  description: string;
  standaloneSellingPrice: string;
  allocatedPrice: string;
  recognitionMethod: RevenueRecognitionMethod;
  progressMeasure: string | null;
  percentComplete: string;
  recognizedAmount: string;
  deferredAmount: string;
}

export interface IntercompanyTransaction {
  id: string;
  orgId: string;
  fromEntityId: string;
  fromEntityName: string;
  toEntityId: string;
  toEntityName: string;
  transactionDate: Date;
  amount: string;
  description: string;
  fromJournalEntryId: string;
  toJournalEntryId: string;
  eliminationJournalEntryId: string | null;
  isEliminated: boolean;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function d(val: any): Decimal {
  return new Decimal(val?.toString() || '0');
}

function mapRow(row: any, mapping: Record<string, string>): any {
  const result: any = {};
  for (const [camel, snake] of Object.entries(mapping)) {
    const val = row[snake];
    result[camel] = val instanceof Date ? val : val;
  }
  return result;
}

function generateEntryNumber(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

// ─── Accounting Engine ───────────────────────────────────────────────────────

class AccountingEngine {

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNAL ENTRIES — Double-Entry Bookkeeping
  // ═══════════════════════════════════════════════════════════════════════════

  async createJournalEntry(orgId: string, data: {
    entryDate: string;
    memo: string;
    source?: string;
    sourceRef?: string;
    autoReversalDate?: string;
    entityId?: string;
    entityType?: string;
    lines: {
      accountId: string;
      accountCode: string;
      accountName: string;
      description: string;
      debit: string;
      credit: string;
      departmentId?: string;
      profitCenterId?: string;
      entityId?: string;
      entityType?: string;
    }[];
  }, userId: string): Promise<JournalEntry> {
    const id = crypto.randomUUID();
    const entryNumber = generateEntryNumber('JE');
    const now = new Date();

    // Validate debits = credits
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);
    for (const line of data.lines) {
      totalDebits = totalDebits.plus(d(line.debit));
      totalCredits = totalCredits.plus(d(line.credit));
    }
    if (!totalDebits.equals(totalCredits)) {
      throw new Error(`Journal entry out of balance: debits ${totalDebits.toFixed(2)} ≠ credits ${totalCredits.toFixed(2)}`);
    }
    if (totalDebits.isZero()) {
      throw new Error('Journal entry cannot have zero total');
    }

    await db.execute(sql`
      INSERT INTO journal_entries (
        id, org_id, entry_number, entry_date, memo, status, source, source_ref,
        auto_reversal_date, entity_id, entity_type, created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${orgId}, ${entryNumber}, ${data.entryDate}::date, ${data.memo},
        'draft', ${data.source || 'MANUAL'}, ${data.sourceRef || null},
        ${data.autoReversalDate ? data.autoReversalDate : null}::date,
        ${data.entityId || null}, ${data.entityType || null},
        ${userId}, ${now}, ${now}
      )
    `);

    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i];
      const lineId = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO journal_entry_lines (
          id, journal_entry_id, line_number, account_id, account_code, account_name,
          department_id, profit_center_id, description, debit, credit,
          entity_id, entity_type
        ) VALUES (
          ${lineId}, ${id}, ${i + 1}, ${line.accountId}, ${line.accountCode}, ${line.accountName},
          ${line.departmentId || null}, ${line.profitCenterId || null},
          ${line.description}, ${d(line.debit).toFixed(2)}, ${d(line.credit).toFixed(2)},
          ${line.entityId || null}, ${line.entityType || null}
        )
      `);
    }

    return this.getJournalEntry(orgId, id);
  }

  async postJournalEntry(orgId: string, entryId: string, userId: string): Promise<JournalEntry> {
    const now = new Date();
    const result = await db.execute(sql`
      UPDATE journal_entries
      SET status = 'posted', post_date = ${now}, posted_by = ${userId}, updated_at = ${now}
      WHERE id = ${entryId} AND org_id = ${orgId} AND status = 'draft'
      RETURNING *
    `);
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Journal entry not found or not in draft status');

    // Update GL account balances
    await this.updateAccountBalancesFromEntry(orgId, entryId);

    await financialAuditService.log({
      orgId, fundId: null, eventType: 'journal_entry_posted' as any,
      actorUserId: userId, actorEmail: '', actorRole: '',
      description: `Posted journal entry ${row.entry_number}`,
      metadata: { entryId, entryNumber: row.entry_number },
      ipAddress: '', userAgent: ''
    });

    return this.getJournalEntry(orgId, entryId);
  }

  async reverseJournalEntry(orgId: string, entryId: string, reversalDate: string, userId: string): Promise<JournalEntry> {
    const original = await this.getJournalEntry(orgId, entryId);
    if (original.status !== 'posted') throw new Error('Can only reverse posted entries');

    const lines = await this.getJournalEntryLines(orgId, entryId);
    const reversalLines = lines.map(l => ({
      accountId: l.accountId,
      accountCode: l.accountCode,
      accountName: l.accountName,
      description: `Reversal: ${l.description}`,
      debit: l.credit,
      credit: l.debit,
      departmentId: l.departmentId || undefined,
      profitCenterId: l.profitCenterId || undefined,
    }));

    const reversal = await this.createJournalEntry(orgId, {
      entryDate: reversalDate,
      memo: `Reversal of ${original.entryNumber}: ${original.memo}`,
      source: 'REVERSAL',
      sourceRef: entryId,
      lines: reversalLines,
    }, userId);

    await db.execute(sql`
      UPDATE journal_entries SET reversal_of_id = ${entryId} WHERE id = ${reversal.id} AND org_id = ${orgId}
    `);
    await db.execute(sql`
      UPDATE journal_entries SET status = 'reversed', updated_at = ${new Date()} WHERE id = ${entryId} AND org_id = ${orgId}
    `);

    // Auto-post the reversal
    await this.postJournalEntry(orgId, reversal.id, userId);
    return reversal;
  }

  async voidJournalEntry(orgId: string, entryId: string, userId: string): Promise<void> {
    await db.execute(sql`
      UPDATE journal_entries SET status = 'void', updated_at = ${new Date()}
      WHERE id = ${entryId} AND org_id = ${orgId} AND status = 'draft'
    `);
  }

  async getJournalEntry(orgId: string, entryId: string): Promise<JournalEntry> {
    const result = await db.execute(sql`
      SELECT * FROM journal_entries WHERE id = ${entryId} AND org_id = ${orgId}
    `);
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Journal entry not found');
    return this.mapJournalEntry(row);
  }

  async getJournalEntryLines(orgId: string, entryId: string): Promise<JournalEntryLine[]> {
    const result = await db.execute(sql`
      SELECT jel.* FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.id = ${entryId} AND je.org_id = ${orgId}
      ORDER BY jel.line_number
    `);
    return (result.rows as any[]).map(r => this.mapJournalEntryLine(r));
  }

  async listJournalEntries(orgId: string, filters: {
    status?: JournalEntryStatus;
    source?: string;
    startDate?: string;
    endDate?: string;
    accountId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: JournalEntry[]; total: number }> {
    const conditions: string[] = [`je.org_id = '${orgId}'`];
    if (filters.status) conditions.push(`je.status = '${filters.status}'`);
    if (filters.source) conditions.push(`je.source = '${filters.source}'`);
    if (filters.startDate) conditions.push(`je.entry_date >= '${filters.startDate}'::date`);
    if (filters.endDate) conditions.push(`je.entry_date <= '${filters.endDate}'::date`);
    if (filters.search) conditions.push(`(je.memo ILIKE '%${filters.search}%' OR je.entry_number ILIKE '%${filters.search}%')`);
    if (filters.accountId) {
      conditions.push(`EXISTS (SELECT 1 FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id AND jel.account_id = '${filters.accountId}')`);
    }

    const where = conditions.join(' AND ');
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [entries, countResult] = await Promise.all([
      db.execute(sql.raw(`SELECT je.* FROM journal_entries je WHERE ${where} ORDER BY je.entry_date DESC, je.created_at DESC LIMIT ${limit} OFFSET ${offset}`)),
      db.execute(sql.raw(`SELECT count(*)::int as total FROM journal_entries je WHERE ${where}`)),
    ]);

    return {
      entries: (entries.rows as any[]).map(r => this.mapJournalEntry(r)),
      total: (countResult.rows as any[])?.[0]?.total || 0,
    };
  }

  private async updateAccountBalancesFromEntry(orgId: string, entryId: string): Promise<void> {
    // Aggregate net changes per account from this entry
    await db.execute(sql`
      INSERT INTO account_balances (id, org_id, account_id, period_start, debit_total, credit_total, net_balance, updated_at)
      SELECT
        gen_random_uuid(),
        ${orgId},
        jel.account_id,
        date_trunc('month', je.entry_date)::date,
        SUM(jel.debit::numeric),
        SUM(jel.credit::numeric),
        SUM(jel.debit::numeric) - SUM(jel.credit::numeric),
        now()
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.id = ${entryId} AND je.org_id = ${orgId}
      GROUP BY jel.account_id, date_trunc('month', je.entry_date)
      ON CONFLICT (org_id, account_id, period_start)
      DO UPDATE SET
        debit_total = account_balances.debit_total + EXCLUDED.debit_total,
        credit_total = account_balances.credit_total + EXCLUDED.credit_total,
        net_balance = account_balances.net_balance + EXCLUDED.net_balance,
        updated_at = now()
    `);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTS RECEIVABLE
  // ═══════════════════════════════════════════════════════════════════════════

  async createInvoice(orgId: string, data: {
    customerId: string;
    customerName: string;
    issueDate: string;
    dueDate: string;
    terms?: string;
    currencyCode?: string;
    memo?: string;
    lineItems: {
      description: string;
      quantity: string;
      unitPrice: string;
      accountId: string;
      taxRate?: string;
    }[];
  }, userId: string): Promise<ARInvoice> {
    const id = crypto.randomUUID();
    const invoiceNumber = generateEntryNumber('INV');
    const now = new Date();

    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);
    const processedLines: any[] = [];

    for (let i = 0; i < data.lineItems.length; i++) {
      const item = data.lineItems[i];
      const qty = d(item.quantity);
      const price = d(item.unitPrice);
      const lineAmount = qty.times(price);
      const taxRate = d(item.taxRate || '0');
      const lineTax = lineAmount.times(taxRate).dividedBy(100);

      subtotal = subtotal.plus(lineAmount);
      taxTotal = taxTotal.plus(lineTax);

      processedLines.push({
        id: crypto.randomUUID(),
        lineNumber: i + 1,
        description: item.description,
        quantity: qty.toFixed(2),
        unitPrice: price.toFixed(2),
        amount: lineAmount.toFixed(2),
        accountId: item.accountId,
        taxRate: taxRate.toFixed(4),
        taxAmount: lineTax.toFixed(2),
      });
    }

    const totalAmount = subtotal.plus(taxTotal);

    await db.execute(sql`
      INSERT INTO ar_invoices (
        id, org_id, invoice_number, customer_id, customer_name,
        issue_date, due_date, terms, subtotal, tax_amount, total_amount,
        amount_paid, balance_due, status, currency_code, memo, created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${orgId}, ${invoiceNumber}, ${data.customerId}, ${data.customerName},
        ${data.issueDate}::date, ${data.dueDate}::date, ${data.terms || 'Net 30'},
        ${subtotal.toFixed(2)}, ${taxTotal.toFixed(2)}, ${totalAmount.toFixed(2)},
        '0.00', ${totalAmount.toFixed(2)}, 'draft', ${data.currencyCode || 'USD'},
        ${data.memo || null}, ${userId}, ${now}, ${now}
      )
    `);

    for (const line of processedLines) {
      await db.execute(sql`
        INSERT INTO ar_invoice_lines (
          id, invoice_id, line_number, description, quantity, unit_price,
          amount, account_id, tax_rate, tax_amount
        ) VALUES (
          ${line.id}, ${id}, ${line.lineNumber}, ${line.description},
          ${line.quantity}, ${line.unitPrice}, ${line.amount},
          ${line.accountId}, ${line.taxRate}, ${line.taxAmount}
        )
      `);
    }

    return this.getInvoice(orgId, id);
  }

  async sendInvoice(orgId: string, invoiceId: string, userId: string): Promise<ARInvoice> {
    await db.execute(sql`
      UPDATE ar_invoices SET status = 'sent', updated_at = ${new Date()}
      WHERE id = ${invoiceId} AND org_id = ${orgId} AND status = 'draft'
    `);

    // Create the receivable journal entry
    const invoice = await this.getInvoice(orgId, invoiceId);
    const je = await this.createJournalEntry(orgId, {
      entryDate: invoice.issueDate.toISOString().split('T')[0],
      memo: `Invoice ${invoice.invoiceNumber} — ${invoice.customerName}`,
      source: 'AR_INVOICE',
      sourceRef: invoiceId,
      lines: [
        {
          accountId: 'ar-default', accountCode: '1200', accountName: 'Accounts Receivable',
          description: `AR — ${invoice.customerName}`, debit: invoice.totalAmount, credit: '0',
        },
        ...invoice.lineItems.map(li => ({
          accountId: li.accountId, accountCode: '', accountName: '',
          description: li.description, debit: '0', credit: li.amount,
        })),
        ...(d(invoice.taxAmount).greaterThan(0) ? [{
          accountId: 'tax-payable', accountCode: '2100', accountName: 'Sales Tax Payable',
          description: 'Sales tax', debit: '0', credit: invoice.taxAmount,
        }] : []),
      ],
    }, userId);

    await this.postJournalEntry(orgId, je.id, userId);
    await db.execute(sql`
      UPDATE ar_invoices SET journal_entry_id = ${je.id}, updated_at = ${new Date()}
      WHERE id = ${invoiceId} AND org_id = ${orgId}
    `);

    return this.getInvoice(orgId, invoiceId);
  }

  async recordARPayment(orgId: string, data: {
    invoiceId: string;
    paymentDate: string;
    amount: string;
    paymentMethod: string;
    referenceNumber?: string;
    depositAccountId: string;
    memo?: string;
  }, userId: string): Promise<ARPayment> {
    const paymentId = crypto.randomUUID();
    const now = new Date();
    const paymentAmount = d(data.amount);

    const invoice = await this.getInvoice(orgId, data.invoiceId);
    const balanceDue = d(invoice.balanceDue);

    if (paymentAmount.greaterThan(balanceDue)) {
      throw new Error(`Payment ${paymentAmount.toFixed(2)} exceeds balance due ${balanceDue.toFixed(2)}`);
    }

    // Journal entry: debit cash, credit AR
    const je = await this.createJournalEntry(orgId, {
      entryDate: data.paymentDate,
      memo: `Payment on Invoice ${invoice.invoiceNumber}`,
      source: 'AR_PAYMENT',
      sourceRef: paymentId,
      lines: [
        {
          accountId: data.depositAccountId, accountCode: '1000', accountName: 'Cash',
          description: `Payment received — ${invoice.customerName}`,
          debit: paymentAmount.toFixed(2), credit: '0',
        },
        {
          accountId: 'ar-default', accountCode: '1200', accountName: 'Accounts Receivable',
          description: `AR payment — Invoice ${invoice.invoiceNumber}`,
          debit: '0', credit: paymentAmount.toFixed(2),
        },
      ],
    }, userId);
    await this.postJournalEntry(orgId, je.id, userId);

    await db.execute(sql`
      INSERT INTO ar_payments (
        id, org_id, invoice_id, payment_date, amount, payment_method,
        reference_number, deposit_account_id, journal_entry_id, memo, created_at
      ) VALUES (
        ${paymentId}, ${orgId}, ${data.invoiceId}, ${data.paymentDate}::date,
        ${paymentAmount.toFixed(2)}, ${data.paymentMethod},
        ${data.referenceNumber || null}, ${data.depositAccountId},
        ${je.id}, ${data.memo || null}, ${now}
      )
    `);

    const newPaid = d(invoice.amountPaid).plus(paymentAmount);
    const newBalance = d(invoice.totalAmount).minus(newPaid);
    const newStatus = newBalance.isZero() ? 'paid' : 'partial';

    await db.execute(sql`
      UPDATE ar_invoices
      SET amount_paid = ${newPaid.toFixed(2)}, balance_due = ${newBalance.toFixed(2)},
          status = ${newStatus}, updated_at = ${now}
      WHERE id = ${data.invoiceId} AND org_id = ${orgId}
    `);

    return {
      id: paymentId, orgId, invoiceId: data.invoiceId,
      paymentDate: new Date(data.paymentDate), amount: paymentAmount.toFixed(2),
      paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber || null,
      depositAccountId: data.depositAccountId, journalEntryId: je.id,
      memo: data.memo || null,
    };
  }

  async getARAgingReport(orgId: string, asOfDate?: string): Promise<{
    current: { invoices: any[]; total: string };
    days1to30: { invoices: any[]; total: string };
    days31to60: { invoices: any[]; total: string };
    days61to90: { invoices: any[]; total: string };
    over90: { invoices: any[]; total: string };
    grandTotal: string;
  }> {
    const asOf = asOfDate || new Date().toISOString().split('T')[0];
    const result = await db.execute(sql`
      SELECT *,
        (${asOf}::date - due_date) as days_overdue,
        CASE
          WHEN ${asOf}::date <= due_date THEN 'current'
          WHEN ${asOf}::date - due_date <= 30 THEN '1-30'
          WHEN ${asOf}::date - due_date <= 60 THEN '31-60'
          WHEN ${asOf}::date - due_date <= 90 THEN '61-90'
          ELSE 'over90'
        END as aging_bucket
      FROM ar_invoices
      WHERE org_id = ${orgId} AND status IN ('sent', 'partial', 'overdue')
      ORDER BY due_date ASC
    `);

    const buckets: any = {
      current: { invoices: [], total: new Decimal(0) },
      days1to30: { invoices: [], total: new Decimal(0) },
      days31to60: { invoices: [], total: new Decimal(0) },
      days61to90: { invoices: [], total: new Decimal(0) },
      over90: { invoices: [], total: new Decimal(0) },
    };

    for (const row of (result.rows as any[])) {
      const balance = d(row.balance_due);
      const mapped = {
        invoiceNumber: row.invoice_number,
        customerName: row.customer_name,
        issueDate: row.issue_date,
        dueDate: row.due_date,
        totalAmount: row.total_amount,
        balanceDue: row.balance_due,
        daysOverdue: row.days_overdue,
      };

      const bucket = row.aging_bucket;
      if (bucket === 'current') { buckets.current.invoices.push(mapped); buckets.current.total = buckets.current.total.plus(balance); }
      else if (bucket === '1-30') { buckets.days1to30.invoices.push(mapped); buckets.days1to30.total = buckets.days1to30.total.plus(balance); }
      else if (bucket === '31-60') { buckets.days31to60.invoices.push(mapped); buckets.days31to60.total = buckets.days31to60.total.plus(balance); }
      else if (bucket === '61-90') { buckets.days61to90.invoices.push(mapped); buckets.days61to90.total = buckets.days61to90.total.plus(balance); }
      else { buckets.over90.invoices.push(mapped); buckets.over90.total = buckets.over90.total.plus(balance); }
    }

    const grandTotal = buckets.current.total.plus(buckets.days1to30.total).plus(buckets.days31to60.total)
      .plus(buckets.days61to90.total).plus(buckets.over90.total);

    return {
      current: { invoices: buckets.current.invoices, total: buckets.current.total.toFixed(2) },
      days1to30: { invoices: buckets.days1to30.invoices, total: buckets.days1to30.total.toFixed(2) },
      days31to60: { invoices: buckets.days31to60.invoices, total: buckets.days31to60.total.toFixed(2) },
      days61to90: { invoices: buckets.days61to90.invoices, total: buckets.days61to90.total.toFixed(2) },
      over90: { invoices: buckets.over90.invoices, total: buckets.over90.total.toFixed(2) },
      grandTotal: grandTotal.toFixed(2),
    };
  }

  async getInvoice(orgId: string, invoiceId: string): Promise<ARInvoice> {
    const result = await db.execute(sql`
      SELECT * FROM ar_invoices WHERE id = ${invoiceId} AND org_id = ${orgId}
    `);
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Invoice not found');

    const linesResult = await db.execute(sql`
      SELECT * FROM ar_invoice_lines WHERE invoice_id = ${invoiceId} ORDER BY line_number
    `);
    const paymentsResult = await db.execute(sql`
      SELECT * FROM ar_payments WHERE invoice_id = ${invoiceId} ORDER BY payment_date
    `);

    return {
      ...this.mapARInvoice(row),
      lineItems: (linesResult.rows as any[]).map(r => this.mapARInvoiceLine(r)),
      payments: (paymentsResult.rows as any[]).map(r => this.mapARPayment(r)),
    };
  }

  async listInvoices(orgId: string, filters: {
    status?: InvoiceStatus;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ invoices: ARInvoice[]; total: number }> {
    const conditions: string[] = [`org_id = '${orgId}'`];
    if (filters.status) conditions.push(`status = '${filters.status}'`);
    if (filters.customerId) conditions.push(`customer_id = '${filters.customerId}'`);
    if (filters.startDate) conditions.push(`issue_date >= '${filters.startDate}'::date`);
    if (filters.endDate) conditions.push(`issue_date <= '${filters.endDate}'::date`);

    const where = conditions.join(' AND ');
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [invoices, countResult] = await Promise.all([
      db.execute(sql.raw(`SELECT * FROM ar_invoices WHERE ${where} ORDER BY issue_date DESC LIMIT ${limit} OFFSET ${offset}`)),
      db.execute(sql.raw(`SELECT count(*)::int as total FROM ar_invoices WHERE ${where}`)),
    ]);

    return {
      invoices: (invoices.rows as any[]).map(r => ({ ...this.mapARInvoice(r), lineItems: [], payments: [] })),
      total: (countResult.rows as any[])?.[0]?.total || 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTS PAYABLE
  // ═══════════════════════════════════════════════════════════════════════════

  async createBill(orgId: string, data: {
    vendorId: string;
    vendorName: string;
    vendorTaxId?: string;
    issueDate: string;
    dueDate: string;
    terms?: string;
    currencyCode?: string;
    memo?: string;
    is1099Eligible?: boolean;
    form1099Type?: string;
    form1099Box?: string;
    lineItems: {
      description: string;
      quantity: string;
      unitPrice: string;
      accountId: string;
      departmentId?: string;
    }[];
  }, userId: string): Promise<APBill> {
    const id = crypto.randomUUID();
    const billNumber = generateEntryNumber('BILL');
    const now = new Date();

    let subtotal = new Decimal(0);
    const processedLines: any[] = [];

    for (let i = 0; i < data.lineItems.length; i++) {
      const item = data.lineItems[i];
      const qty = d(item.quantity);
      const price = d(item.unitPrice);
      const lineAmount = qty.times(price);
      subtotal = subtotal.plus(lineAmount);

      processedLines.push({
        id: crypto.randomUUID(),
        lineNumber: i + 1,
        description: item.description,
        quantity: qty.toFixed(2),
        unitPrice: price.toFixed(2),
        amount: lineAmount.toFixed(2),
        accountId: item.accountId,
        departmentId: item.departmentId || null,
      });
    }

    await db.execute(sql`
      INSERT INTO ap_bills (
        id, org_id, bill_number, vendor_id, vendor_name, vendor_tax_id,
        issue_date, due_date, terms, subtotal, tax_amount, total_amount,
        amount_paid, balance_due, status, currency_code, memo,
        is_1099_eligible, form_1099_type, form_1099_box,
        created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${orgId}, ${billNumber}, ${data.vendorId}, ${data.vendorName},
        ${data.vendorTaxId || null}, ${data.issueDate}::date, ${data.dueDate}::date,
        ${data.terms || 'Net 30'}, ${subtotal.toFixed(2)}, '0.00', ${subtotal.toFixed(2)},
        '0.00', ${subtotal.toFixed(2)}, 'draft', ${data.currencyCode || 'USD'},
        ${data.memo || null}, ${data.is1099Eligible || false},
        ${data.form1099Type || null}, ${data.form1099Box || null},
        ${userId}, ${now}, ${now}
      )
    `);

    for (const line of processedLines) {
      await db.execute(sql`
        INSERT INTO ap_bill_lines (
          id, bill_id, line_number, description, quantity, unit_price,
          amount, account_id, department_id
        ) VALUES (
          ${line.id}, ${id}, ${line.lineNumber}, ${line.description},
          ${line.quantity}, ${line.unitPrice}, ${line.amount},
          ${line.accountId}, ${line.departmentId}
        )
      `);
    }

    return this.getBill(orgId, id);
  }

  async approveBill(orgId: string, billId: string, userId: string): Promise<APBill> {
    const now = new Date();
    await db.execute(sql`
      UPDATE ap_bills SET status = 'approved', approved_by = ${userId}, approved_at = ${now}, updated_at = ${now}
      WHERE id = ${billId} AND org_id = ${orgId} AND status = 'draft'
    `);

    // Create AP journal entry: debit expense, credit AP
    const bill = await this.getBill(orgId, billId);
    const expenseLines = bill.lineItems.map(li => ({
      accountId: li.accountId, accountCode: '', accountName: '',
      description: li.description, debit: li.amount, credit: '0',
      departmentId: li.departmentId || undefined,
    }));

    const je = await this.createJournalEntry(orgId, {
      entryDate: bill.issueDate.toISOString().split('T')[0],
      memo: `Bill ${bill.billNumber} — ${bill.vendorName}`,
      source: 'AP_BILL',
      sourceRef: billId,
      lines: [
        ...expenseLines,
        {
          accountId: 'ap-default', accountCode: '2000', accountName: 'Accounts Payable',
          description: `AP — ${bill.vendorName}`, debit: '0', credit: bill.totalAmount,
        },
      ],
    }, userId);
    await this.postJournalEntry(orgId, je.id, userId);

    await db.execute(sql`
      UPDATE ap_bills SET journal_entry_id = ${je.id}, updated_at = ${now}
      WHERE id = ${billId} AND org_id = ${orgId}
    `);

    return this.getBill(orgId, billId);
  }

  async recordAPPayment(orgId: string, data: {
    billId: string;
    paymentDate: string;
    amount: string;
    paymentMethod: string;
    checkNumber?: string;
    bankAccountId: string;
    memo?: string;
  }, userId: string): Promise<APPayment> {
    const paymentId = crypto.randomUUID();
    const now = new Date();
    const paymentAmount = d(data.amount);

    const bill = await this.getBill(orgId, data.billId);
    const balanceDue = d(bill.balanceDue);

    if (paymentAmount.greaterThan(balanceDue)) {
      throw new Error(`Payment ${paymentAmount.toFixed(2)} exceeds balance due ${balanceDue.toFixed(2)}`);
    }

    // Journal entry: debit AP, credit cash
    const je = await this.createJournalEntry(orgId, {
      entryDate: data.paymentDate,
      memo: `Payment on Bill ${bill.billNumber} — ${bill.vendorName}`,
      source: 'AP_PAYMENT',
      sourceRef: paymentId,
      lines: [
        {
          accountId: 'ap-default', accountCode: '2000', accountName: 'Accounts Payable',
          description: `AP payment — ${bill.vendorName}`,
          debit: paymentAmount.toFixed(2), credit: '0',
        },
        {
          accountId: data.bankAccountId, accountCode: '1000', accountName: 'Cash',
          description: `Check/Payment — Bill ${bill.billNumber}`,
          debit: '0', credit: paymentAmount.toFixed(2),
        },
      ],
    }, userId);
    await this.postJournalEntry(orgId, je.id, userId);

    await db.execute(sql`
      INSERT INTO ap_payments (
        id, org_id, bill_id, payment_date, amount, payment_method,
        check_number, bank_account_id, journal_entry_id, memo, created_at
      ) VALUES (
        ${paymentId}, ${orgId}, ${data.billId}, ${data.paymentDate}::date,
        ${paymentAmount.toFixed(2)}, ${data.paymentMethod},
        ${data.checkNumber || null}, ${data.bankAccountId},
        ${je.id}, ${data.memo || null}, ${now}
      )
    `);

    const newPaid = d(bill.amountPaid).plus(paymentAmount);
    const newBalance = d(bill.totalAmount).minus(newPaid);
    const newStatus = newBalance.isZero() ? 'paid' : 'partial';

    await db.execute(sql`
      UPDATE ap_bills
      SET amount_paid = ${newPaid.toFixed(2)}, balance_due = ${newBalance.toFixed(2)},
          status = ${newStatus}, updated_at = ${now}
      WHERE id = ${data.billId} AND org_id = ${orgId}
    `);

    return {
      id: paymentId, orgId, billId: data.billId,
      paymentDate: new Date(data.paymentDate), amount: paymentAmount.toFixed(2),
      paymentMethod: data.paymentMethod, checkNumber: data.checkNumber || null,
      bankAccountId: data.bankAccountId, journalEntryId: je.id,
      memo: data.memo || null,
    };
  }

  async getAPAgingReport(orgId: string, asOfDate?: string): Promise<{
    current: { bills: any[]; total: string };
    days1to30: { bills: any[]; total: string };
    days31to60: { bills: any[]; total: string };
    days61to90: { bills: any[]; total: string };
    over90: { bills: any[]; total: string };
    grandTotal: string;
  }> {
    const asOf = asOfDate || new Date().toISOString().split('T')[0];
    const result = await db.execute(sql`
      SELECT *,
        (${asOf}::date - due_date) as days_overdue,
        CASE
          WHEN ${asOf}::date <= due_date THEN 'current'
          WHEN ${asOf}::date - due_date <= 30 THEN '1-30'
          WHEN ${asOf}::date - due_date <= 60 THEN '31-60'
          WHEN ${asOf}::date - due_date <= 90 THEN '61-90'
          ELSE 'over90'
        END as aging_bucket
      FROM ap_bills
      WHERE org_id = ${orgId} AND status IN ('approved', 'partial', 'overdue')
      ORDER BY due_date ASC
    `);

    const buckets: any = {
      current: { bills: [], total: new Decimal(0) },
      days1to30: { bills: [], total: new Decimal(0) },
      days31to60: { bills: [], total: new Decimal(0) },
      days61to90: { bills: [], total: new Decimal(0) },
      over90: { bills: [], total: new Decimal(0) },
    };

    for (const row of (result.rows as any[])) {
      const balance = d(row.balance_due);
      const mapped = {
        billNumber: row.bill_number, vendorName: row.vendor_name,
        issueDate: row.issue_date, dueDate: row.due_date,
        totalAmount: row.total_amount, balanceDue: row.balance_due,
        daysOverdue: row.days_overdue,
      };
      const bucket = row.aging_bucket;
      const key = bucket === 'current' ? 'current' : bucket === '1-30' ? 'days1to30'
        : bucket === '31-60' ? 'days31to60' : bucket === '61-90' ? 'days61to90' : 'over90';
      buckets[key].bills.push(mapped);
      buckets[key].total = buckets[key].total.plus(balance);
    }

    const grandTotal = Object.values(buckets).reduce((sum: Decimal, b: any) => sum.plus(b.total), new Decimal(0));

    return {
      current: { bills: buckets.current.bills, total: buckets.current.total.toFixed(2) },
      days1to30: { bills: buckets.days1to30.bills, total: buckets.days1to30.total.toFixed(2) },
      days31to60: { bills: buckets.days31to60.bills, total: buckets.days31to60.total.toFixed(2) },
      days61to90: { bills: buckets.days61to90.bills, total: buckets.days61to90.total.toFixed(2) },
      over90: { bills: buckets.over90.bills, total: buckets.over90.total.toFixed(2) },
      grandTotal: (grandTotal as Decimal).toFixed(2),
    };
  }

  async getBill(orgId: string, billId: string): Promise<APBill> {
    const result = await db.execute(sql`
      SELECT * FROM ap_bills WHERE id = ${billId} AND org_id = ${orgId}
    `);
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Bill not found');

    const linesResult = await db.execute(sql`
      SELECT * FROM ap_bill_lines WHERE bill_id = ${billId} ORDER BY line_number
    `);
    const paymentsResult = await db.execute(sql`
      SELECT * FROM ap_payments WHERE bill_id = ${billId} ORDER BY payment_date
    `);

    return {
      ...this.mapAPBill(row),
      lineItems: (linesResult.rows as any[]).map(r => this.mapAPBillLine(r)),
      payments: (paymentsResult.rows as any[]).map(r => this.mapAPPayment(r)),
    };
  }

  async listBills(orgId: string, filters: {
    status?: BillStatus;
    vendorId?: string;
    startDate?: string;
    endDate?: string;
    is1099Eligible?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ bills: APBill[]; total: number }> {
    const conditions: string[] = [`org_id = '${orgId}'`];
    if (filters.status) conditions.push(`status = '${filters.status}'`);
    if (filters.vendorId) conditions.push(`vendor_id = '${filters.vendorId}'`);
    if (filters.startDate) conditions.push(`issue_date >= '${filters.startDate}'::date`);
    if (filters.endDate) conditions.push(`issue_date <= '${filters.endDate}'::date`);
    if (filters.is1099Eligible !== undefined) conditions.push(`is_1099_eligible = ${filters.is1099Eligible}`);

    const where = conditions.join(' AND ');
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [bills, countResult] = await Promise.all([
      db.execute(sql.raw(`SELECT * FROM ap_bills WHERE ${where} ORDER BY issue_date DESC LIMIT ${limit} OFFSET ${offset}`)),
      db.execute(sql.raw(`SELECT count(*)::int as total FROM ap_bills WHERE ${where}`)),
    ]);

    return {
      bills: (bills.rows as any[]).map(r => ({ ...this.mapAPBill(r), lineItems: [], payments: [] })),
      total: (countResult.rows as any[])?.[0]?.total || 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1099 TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  async get1099Summary(orgId: string, taxYear: number): Promise<Vendor1099Summary[]> {
    const result = await db.execute(sql`
      SELECT
        b.vendor_id,
        b.vendor_name,
        b.vendor_tax_id,
        b.form_1099_type,
        SUM(p.amount::numeric) as total_payments
      FROM ap_bills b
      JOIN ap_payments p ON p.bill_id = b.id
      WHERE b.org_id = ${orgId}
        AND b.is_1099_eligible = true
        AND EXTRACT(YEAR FROM p.payment_date) = ${taxYear}
        AND b.status IN ('paid', 'partial')
      GROUP BY b.vendor_id, b.vendor_name, b.vendor_tax_id, b.form_1099_type
      ORDER BY total_payments DESC
    `);

    return (result.rows as any[]).map(row => {
      const total = d(row.total_payments);
      const threshold = row.form_1099_type === 'NEC' ? new Decimal(600) : new Decimal(600);
      return {
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        vendorTaxId: row.vendor_tax_id || 'MISSING',
        form1099Type: row.form_1099_type || 'NEC',
        totalPayments: total.toFixed(2),
        boxes: { '1': total.toFixed(2) },
        requiresFiling: total.gte(threshold),
        filingThreshold: threshold.toFixed(2),
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BANK RECONCILIATION
  // ═══════════════════════════════════════════════════════════════════════════

  async importBankTransactions(orgId: string, bankAccountId: string, transactions: {
    transactionDate: string;
    postDate: string;
    description: string;
    amount: string;
    transactionType: 'debit' | 'credit';
    checkNumber?: string;
    referenceNumber?: string;
    category?: string;
    plaidTransactionId?: string;
  }[], userId: string): Promise<{ imported: number; duplicates: number }> {
    const batchId = crypto.randomUUID();
    let imported = 0;
    let duplicates = 0;

    for (const txn of transactions) {
      // Deduplicate by plaidTransactionId or by date+amount+description
      if (txn.plaidTransactionId) {
        const existing = await db.execute(sql`
          SELECT id FROM bank_transactions
          WHERE org_id = ${orgId} AND plaid_transaction_id = ${txn.plaidTransactionId}
          LIMIT 1
        `);
        if ((existing.rows as any[]).length > 0) { duplicates++; continue; }
      }

      const id = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO bank_transactions (
          id, org_id, bank_account_id, transaction_date, post_date,
          description, amount, transaction_type, check_number, reference_number,
          category, reconciliation_status, import_batch_id, plaid_transaction_id, created_at
        ) VALUES (
          ${id}, ${orgId}, ${bankAccountId}, ${txn.transactionDate}::date,
          ${txn.postDate}::date, ${txn.description}, ${d(txn.amount).toFixed(2)},
          ${txn.transactionType}, ${txn.checkNumber || null}, ${txn.referenceNumber || null},
          ${txn.category || null}, 'unreconciled', ${batchId},
          ${txn.plaidTransactionId || null}, ${new Date()}
        )
      `);
      imported++;
    }

    return { imported, duplicates };
  }

  async autoMatchBankTransactions(orgId: string, bankAccountId: string): Promise<{ matched: number }> {
    // Match by check number
    const checkMatches = await db.execute(sql`
      UPDATE bank_transactions bt
      SET reconciliation_status = 'matched',
          matched_journal_entry_id = (
            SELECT je.id FROM journal_entries je
            JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
            WHERE je.org_id = bt.org_id AND je.status = 'posted'
              AND jel.account_id = bt.bank_account_id
              AND ABS(jel.credit::numeric - bt.amount::numeric) < 0.01
            LIMIT 1
          )
      WHERE bt.org_id = ${orgId} AND bt.bank_account_id = ${bankAccountId}
        AND bt.reconciliation_status = 'unreconciled'
        AND bt.check_number IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM journal_entries je
          JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
          WHERE je.org_id = bt.org_id AND je.status = 'posted'
            AND jel.account_id = bt.bank_account_id
            AND ABS(jel.credit::numeric - bt.amount::numeric) < 0.01
        )
    `);

    // Match by exact amount + date within 3 days
    const amountMatches = await db.execute(sql`
      UPDATE bank_transactions bt
      SET reconciliation_status = 'matched',
          matched_journal_entry_id = sub.je_id
      FROM (
        SELECT DISTINCT ON (bt2.id)
          bt2.id as bt_id, je.id as je_id
        FROM bank_transactions bt2
        JOIN journal_entries je ON je.org_id = bt2.org_id AND je.status = 'posted'
        JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
        WHERE bt2.org_id = ${orgId} AND bt2.bank_account_id = ${bankAccountId}
          AND bt2.reconciliation_status = 'unreconciled'
          AND jel.account_id = bt2.bank_account_id
          AND ABS(
            CASE WHEN bt2.transaction_type = 'debit' THEN jel.credit::numeric ELSE jel.debit::numeric END
            - bt2.amount::numeric
          ) < 0.01
          AND ABS(je.entry_date - bt2.transaction_date) <= 3
        ORDER BY bt2.id, ABS(je.entry_date - bt2.transaction_date)
      ) sub
      WHERE bt.id = sub.bt_id AND bt.reconciliation_status = 'unreconciled'
    `);

    const matchedCount = (checkMatches.rowCount || 0) + (amountMatches.rowCount || 0);
    return { matched: matchedCount };
  }

  async startReconciliation(orgId: string, data: {
    bankAccountId: string;
    statementDate: string;
    statementBalance: string;
  }, userId: string): Promise<BankReconciliation> {
    const id = crypto.randomUUID();
    const now = new Date();

    // Calculate book balance from posted JE lines for this account
    const bookBalResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(jel.debit::numeric), 0) - COALESCE(SUM(jel.credit::numeric), 0) as book_balance
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.org_id = ${orgId} AND je.status = 'posted'
        AND jel.account_id = ${data.bankAccountId}
        AND je.entry_date <= ${data.statementDate}::date
    `);
    const bookBalance = d((bookBalResult.rows as any[])?.[0]?.book_balance || '0');

    await db.execute(sql`
      INSERT INTO bank_reconciliations (
        id, org_id, bank_account_id, statement_date, statement_balance,
        book_balance, adjusted_bank_balance, adjusted_book_balance,
        difference, status, created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${orgId}, ${data.bankAccountId}, ${data.statementDate}::date,
        ${d(data.statementBalance).toFixed(2)}, ${bookBalance.toFixed(2)},
        ${d(data.statementBalance).toFixed(2)}, ${bookBalance.toFixed(2)},
        ${d(data.statementBalance).minus(bookBalance).toFixed(2)},
        'in_progress', ${userId}, ${now}, ${now}
      )
    `);

    return this.getReconciliation(orgId, id);
  }

  async completeReconciliation(orgId: string, reconId: string, userId: string): Promise<BankReconciliation> {
    const recon = await this.getReconciliation(orgId, reconId);
    if (d(recon.difference).abs().greaterThan(new Decimal('0.01'))) {
      throw new Error(`Reconciliation out of balance by ${recon.difference}. Must be balanced to complete.`);
    }

    const now = new Date();
    await db.execute(sql`
      UPDATE bank_reconciliations
      SET status = 'completed', reconciled_by = ${userId}, reconciled_at = ${now}, updated_at = ${now}
      WHERE id = ${reconId} AND org_id = ${orgId}
    `);

    // Mark matched transactions as reconciled
    await db.execute(sql`
      UPDATE bank_transactions
      SET reconciliation_status = 'reconciled'
      WHERE org_id = ${orgId} AND bank_account_id = (
        SELECT bank_account_id FROM bank_reconciliations WHERE id = ${reconId}
      ) AND reconciliation_status = 'matched'
      AND transaction_date <= (
        SELECT statement_date FROM bank_reconciliations WHERE id = ${reconId}
      )
    `);

    return this.getReconciliation(orgId, reconId);
  }

  async getReconciliation(orgId: string, reconId: string): Promise<BankReconciliation> {
    const result = await db.execute(sql`
      SELECT * FROM bank_reconciliations WHERE id = ${reconId} AND org_id = ${orgId}
    `);
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Reconciliation not found');

    const itemsResult = await db.execute(sql`
      SELECT * FROM bank_reconciliation_items WHERE reconciliation_id = ${reconId} ORDER BY created_at
    `);

    return {
      id: row.id, orgId: row.org_id, bankAccountId: row.bank_account_id,
      statementDate: row.statement_date, statementBalance: row.statement_balance,
      bookBalance: row.book_balance, adjustedBankBalance: row.adjusted_bank_balance,
      adjustedBookBalance: row.adjusted_book_balance, difference: row.difference,
      status: row.status, reconciledBy: row.reconciled_by,
      reconciledAt: row.reconciled_at ? new Date(row.reconciled_at) : null,
      items: (itemsResult.rows as any[]).map(r => ({
        id: r.id, reconciliationId: r.reconciliation_id,
        bankTransactionId: r.bank_transaction_id, journalEntryLineId: r.journal_entry_line_id,
        amount: r.amount, itemType: r.item_type, description: r.description,
        isCleared: r.is_cleared,
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRIAL BALANCE
  // ═══════════════════════════════════════════════════════════════════════════

  async generateTrialBalance(orgId: string, asOfDate: string): Promise<{
    rows: TrialBalanceRow[];
    totalDebits: string;
    totalCredits: string;
    isBalanced: boolean;
  }> {
    const result = await db.execute(sql`
      SELECT
        jel.account_id,
        jel.account_code,
        jel.account_name,
        COALESCE(SUM(jel.debit::numeric), 0) as total_debits,
        COALESCE(SUM(jel.credit::numeric), 0) as total_credits,
        COALESCE(SUM(jel.debit::numeric), 0) - COALESCE(SUM(jel.credit::numeric), 0) as net_balance
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.org_id = ${orgId} AND je.status = 'posted'
        AND je.entry_date <= ${asOfDate}::date
      GROUP BY jel.account_id, jel.account_code, jel.account_name
      ORDER BY jel.account_code
    `);

    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    const rows: TrialBalanceRow[] = (result.rows as any[]).map(row => {
      const debits = d(row.total_debits);
      const credits = d(row.total_credits);
      const net = d(row.net_balance);

      // For trial balance, show debit/credit balances based on account normal balance
      const debitBalance = net.greaterThan(0) ? net : new Decimal(0);
      const creditBalance = net.lessThan(0) ? net.abs() : new Decimal(0);

      totalDebits = totalDebits.plus(debitBalance);
      totalCredits = totalCredits.plus(creditBalance);

      return {
        accountId: row.account_id,
        accountCode: row.account_code,
        accountName: row.account_name,
        accountType: 'asset' as AccountType,
        debitBalance: debitBalance.toFixed(2),
        creditBalance: creditBalance.toFixed(2),
        netBalance: net.toFixed(2),
      };
    });

    return {
      rows,
      totalDebits: totalDebits.toFixed(2),
      totalCredits: totalCredits.toFixed(2),
      isBalanced: totalDebits.minus(totalCredits).abs().lessThan(new Decimal('0.01')),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CASH FLOW STATEMENT (Indirect Method)
  // ═══════════════════════════════════════════════════════════════════════════

  async generateCashFlowStatement(orgId: string, startDate: string, endDate: string): Promise<CashFlowStatement> {
    // Net income from P&L
    const plResult = await db.execute(sql`
      SELECT
        SUM(CASE WHEN jel.account_code LIKE '4%' THEN jel.credit::numeric - jel.debit::numeric ELSE 0 END) as total_revenue,
        SUM(CASE WHEN jel.account_code LIKE '5%' OR jel.account_code LIKE '6%' THEN jel.debit::numeric - jel.credit::numeric ELSE 0 END) as total_expenses
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.org_id = ${orgId} AND je.status = 'posted'
        AND je.entry_date BETWEEN ${startDate}::date AND ${endDate}::date
    `);
    const revenue = d((plResult.rows as any[])?.[0]?.total_revenue || '0');
    const expenses = d((plResult.rows as any[])?.[0]?.total_expenses || '0');
    const netIncome = revenue.minus(expenses);

    // Changes in working capital (AR, AP, prepaid, accrued)
    const wcResult = await db.execute(sql`
      SELECT
        jel.account_code,
        SUM(jel.debit::numeric) - SUM(jel.credit::numeric) as net_change
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.org_id = ${orgId} AND je.status = 'posted'
        AND je.entry_date BETWEEN ${startDate}::date AND ${endDate}::date
        AND (jel.account_code LIKE '12%' OR jel.account_code LIKE '13%'
             OR jel.account_code LIKE '20%' OR jel.account_code LIKE '21%')
      GROUP BY jel.account_code
    `);

    let arChange = new Decimal(0);
    let apChange = new Decimal(0);
    let otherWcChange = new Decimal(0);

    for (const row of (wcResult.rows as any[])) {
      const change = d(row.net_change);
      if (row.account_code?.startsWith('12')) arChange = arChange.plus(change);
      else if (row.account_code?.startsWith('20')) apChange = apChange.plus(change);
      else otherWcChange = otherWcChange.plus(change);
    }

    // Depreciation add-back
    const depResult = await db.execute(sql`
      SELECT COALESCE(SUM(jel.debit::numeric), 0) as depreciation
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.org_id = ${orgId} AND je.status = 'posted'
        AND je.entry_date BETWEEN ${startDate}::date AND ${endDate}::date
        AND jel.account_name ILIKE '%depreciation%'
    `);
    const depreciation = d((depResult.rows as any[])?.[0]?.depreciation || '0');

    const operatingItems = [
      { description: 'Net Income', amount: netIncome.toFixed(2) },
      { description: 'Depreciation & Amortization', amount: depreciation.toFixed(2) },
      { description: 'Change in Accounts Receivable', amount: arChange.negated().toFixed(2) },
      { description: 'Change in Accounts Payable', amount: apChange.toFixed(2) },
      { description: 'Other Working Capital Changes', amount: otherWcChange.negated().toFixed(2) },
    ];
    const operatingTotal = netIncome.plus(depreciation).minus(arChange).plus(apChange).minus(otherWcChange);

    // Investing: fixed asset purchases/sales
    const investResult = await db.execute(sql`
      SELECT COALESCE(SUM(jel.debit::numeric) - SUM(jel.credit::numeric), 0) as net_investing
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.org_id = ${orgId} AND je.status = 'posted'
        AND je.entry_date BETWEEN ${startDate}::date AND ${endDate}::date
        AND (jel.account_code LIKE '15%' OR jel.account_code LIKE '16%')
    `);
    const investingTotal = d((investResult.rows as any[])?.[0]?.net_investing || '0').negated();

    // Financing: debt proceeds/payments, equity
    const finResult = await db.execute(sql`
      SELECT COALESCE(SUM(jel.credit::numeric) - SUM(jel.debit::numeric), 0) as net_financing
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.org_id = ${orgId} AND je.status = 'posted'
        AND je.entry_date BETWEEN ${startDate}::date AND ${endDate}::date
        AND (jel.account_code LIKE '22%' OR jel.account_code LIKE '23%'
             OR jel.account_code LIKE '3%')
    `);
    const financingTotal = d((finResult.rows as any[])?.[0]?.net_financing || '0');

    const netCashChange = operatingTotal.plus(investingTotal).plus(financingTotal);

    // Beginning cash
    const beginCashResult = await db.execute(sql`
      SELECT COALESCE(SUM(jel.debit::numeric) - SUM(jel.credit::numeric), 0) as cash_balance
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.org_id = ${orgId} AND je.status = 'posted'
        AND je.entry_date < ${startDate}::date
        AND jel.account_code LIKE '10%'
    `);
    const beginningCash = d((beginCashResult.rows as any[])?.[0]?.cash_balance || '0');

    return {
      period: { start: new Date(startDate), end: new Date(endDate) },
      operating: {
        label: 'Cash Flows from Operating Activities',
        items: operatingItems,
        total: operatingTotal.toFixed(2),
      },
      investing: {
        label: 'Cash Flows from Investing Activities',
        items: [{ description: 'Capital Expenditures / Asset Purchases', amount: investingTotal.toFixed(2) }],
        total: investingTotal.toFixed(2),
      },
      financing: {
        label: 'Cash Flows from Financing Activities',
        items: [{ description: 'Net Debt Proceeds / Payments', amount: financingTotal.toFixed(2) }],
        total: financingTotal.toFixed(2),
      },
      netCashChange: netCashChange.toFixed(2),
      beginningCash: beginningCash.toFixed(2),
      endingCash: beginningCash.plus(netCashChange).toFixed(2),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MONTH-END CLOSE
  // ═══════════════════════════════════════════════════════════════════════════

  async initializeMonthEndClose(orgId: string, periodLabel: string, periodStart: string, periodEnd: string, userId: string): Promise<MonthEndClose> {
    const id = crypto.randomUUID();
    const now = new Date();

    const defaultSteps = [
      { order: 1, name: 'Review & Post Pending Journal Entries', description: 'Ensure all JEs for the period are posted', requiredApproval: false },
      { order: 2, name: 'Record Accrued Expenses', description: 'Accrue unpaid expenses incurred in the period', requiredApproval: false },
      { order: 3, name: 'Record Prepaid Expense Amortization', description: 'Amortize prepaid expenses for the period', requiredApproval: false },
      { order: 4, name: 'Record Depreciation', description: 'Post monthly depreciation entries', requiredApproval: false },
      { order: 5, name: 'Reconcile Bank Accounts', description: 'Complete bank reconciliation for all accounts', requiredApproval: false },
      { order: 6, name: 'Reconcile Accounts Receivable', description: 'Verify AR subledger ties to GL', requiredApproval: false },
      { order: 7, name: 'Reconcile Accounts Payable', description: 'Verify AP subledger ties to GL', requiredApproval: false },
      { order: 8, name: 'Review Revenue Recognition', description: 'Ensure revenue is recognized per ASC 606', requiredApproval: false },
      { order: 9, name: 'Reconcile Intercompany', description: 'Eliminate intercompany balances', requiredApproval: false },
      { order: 10, name: 'Generate Trial Balance', description: 'Verify TB is balanced', requiredApproval: false },
      { order: 11, name: 'Review Financial Statements', description: 'Review P&L, Balance Sheet, Cash Flow', requiredApproval: true },
      { order: 12, name: 'Management Sign-Off', description: 'Final approval to close the period', requiredApproval: true },
    ];

    await db.execute(sql`
      INSERT INTO month_end_closes (
        id, org_id, period_label, period_start, period_end, status,
        created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${orgId}, ${periodLabel}, ${periodStart}::date, ${periodEnd}::date,
        'open', ${userId}, ${now}, ${now}
      )
    `);

    for (const step of defaultSteps) {
      await db.execute(sql`
        INSERT INTO month_end_close_steps (
          id, close_id, step_order, step_name, step_description, status,
          required_approval, created_at
        ) VALUES (
          ${crypto.randomUUID()}, ${id}, ${step.order}, ${step.name},
          ${step.description}, 'pending', ${step.requiredApproval}, ${now}
        )
      `);
    }

    return this.getMonthEndClose(orgId, id);
  }

  async updateCloseStep(orgId: string, closeId: string, stepId: string, data: {
    status?: CloseStepStatus;
    notes?: string;
    assignedTo?: string;
  }, userId: string): Promise<MonthEndCloseStep> {
    const now = new Date();
    const updates: string[] = [`updated_at = '${now.toISOString()}'`];

    if (data.status) {
      updates.push(`status = '${data.status}'`);
      if (data.status === 'completed') {
        updates.push(`completed_by = '${userId}'`);
        updates.push(`completed_at = '${now.toISOString()}'`);
      }
    }
    if (data.notes !== undefined) updates.push(`notes = '${data.notes}'`);
    if (data.assignedTo !== undefined) updates.push(`assigned_to = '${data.assignedTo}'`);

    await db.execute(sql.raw(`
      UPDATE month_end_close_steps
      SET ${updates.join(', ')}
      WHERE id = '${stepId}' AND close_id = '${closeId}'
    `));

    const result = await db.execute(sql`
      SELECT * FROM month_end_close_steps WHERE id = ${stepId} AND close_id = ${closeId}
    `);
    const row = (result.rows as any[])?.[0];
    return this.mapCloseStep(row);
  }

  async approveCloseStep(orgId: string, closeId: string, stepId: string, userId: string): Promise<MonthEndCloseStep> {
    const now = new Date();
    await db.execute(sql`
      UPDATE month_end_close_steps
      SET approved_by = ${userId}, approved_at = ${now}
      WHERE id = ${stepId} AND close_id = ${closeId} AND required_approval = true
    `);
    return this.updateCloseStep(orgId, closeId, stepId, { status: 'completed' }, userId);
  }

  async finalizeMonthEndClose(orgId: string, closeId: string, userId: string): Promise<MonthEndClose> {
    const close = await this.getMonthEndClose(orgId, closeId);

    const incompletSteps = close.steps.filter(s => s.status !== 'completed' && s.status !== 'skipped');
    if (incompletSteps.length > 0) {
      throw new Error(`Cannot close period: ${incompletSteps.length} steps incomplete — ${incompletSteps.map(s => s.stepName).join(', ')}`);
    }

    const unapprovedSteps = close.steps.filter(s => s.requiredApproval && !s.approvedBy);
    if (unapprovedSteps.length > 0) {
      throw new Error(`Cannot close period: ${unapprovedSteps.length} steps require approval`);
    }

    const now = new Date();
    await db.execute(sql`
      UPDATE month_end_closes
      SET status = 'closed', closed_by = ${userId}, closed_at = ${now}, updated_at = ${now}
      WHERE id = ${closeId} AND org_id = ${orgId}
    `);

    await financialAuditService.log({
      orgId, fundId: null, eventType: 'period_closed' as any,
      actorUserId: userId, actorEmail: '', actorRole: '',
      description: `Closed period ${close.periodLabel}`,
      metadata: { closeId, periodLabel: close.periodLabel, periodStart: close.periodStart, periodEnd: close.periodEnd },
      ipAddress: '', userAgent: ''
    });

    return this.getMonthEndClose(orgId, closeId);
  }

  async reopenMonthEndClose(orgId: string, closeId: string, reason: string, userId: string): Promise<MonthEndClose> {
    const now = new Date();
    await db.execute(sql`
      UPDATE month_end_closes
      SET status = 'open', reopened_by = ${userId}, reopened_at = ${now},
          reopen_reason = ${reason}, closed_by = NULL, closed_at = NULL, updated_at = ${now}
      WHERE id = ${closeId} AND org_id = ${orgId} AND status = 'closed'
    `);
    return this.getMonthEndClose(orgId, closeId);
  }

  async getMonthEndClose(orgId: string, closeId: string): Promise<MonthEndClose> {
    const result = await db.execute(sql`
      SELECT * FROM month_end_closes WHERE id = ${closeId} AND org_id = ${orgId}
    `);
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Month-end close not found');

    const stepsResult = await db.execute(sql`
      SELECT * FROM month_end_close_steps WHERE close_id = ${closeId} ORDER BY step_order
    `);

    return {
      id: row.id, orgId: row.org_id, periodLabel: row.period_label,
      periodStart: row.period_start, periodEnd: row.period_end,
      status: row.status, closedBy: row.closed_by,
      closedAt: row.closed_at ? new Date(row.closed_at) : null,
      reopenedBy: row.reopened_by, reopenedAt: row.reopened_at ? new Date(row.reopened_at) : null,
      reopenReason: row.reopen_reason,
      steps: (stepsResult.rows as any[]).map(r => this.mapCloseStep(r)),
    };
  }

  async listMonthEndCloses(orgId: string): Promise<MonthEndClose[]> {
    const result = await db.execute(sql`
      SELECT * FROM month_end_closes WHERE org_id = ${orgId} ORDER BY period_start DESC
    `);
    const closes: MonthEndClose[] = [];
    for (const row of (result.rows as any[])) {
      closes.push(await this.getMonthEndClose(orgId, row.id));
    }
    return closes;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REVENUE RECOGNITION (ASC 606)
  // ═══════════════════════════════════════════════════════════════════════════

  async createRevenueContract(orgId: string, data: {
    contractNumber: string;
    customerName: string;
    startDate: string;
    endDate: string;
    totalContractValue: string;
    recognitionMethod: RevenueRecognitionMethod;
    performanceObligations: {
      description: string;
      standaloneSellingPrice: string;
      recognitionMethod: RevenueRecognitionMethod;
      progressMeasure?: string;
    }[];
  }, userId: string): Promise<RevenueContract> {
    const id = crypto.randomUUID();
    const now = new Date();
    const totalValue = d(data.totalContractValue);

    // Allocate transaction price to performance obligations based on relative SSP
    const totalSSP = data.performanceObligations.reduce((sum, po) => sum.plus(d(po.standaloneSellingPrice)), new Decimal(0));

    await db.execute(sql`
      INSERT INTO revenue_contracts (
        id, org_id, contract_number, customer_name, start_date, end_date,
        total_contract_value, recognition_method, recognized_to_date, deferred_revenue,
        status, created_by, created_at, updated_at
      ) VALUES (
        ${id}, ${orgId}, ${data.contractNumber}, ${data.customerName},
        ${data.startDate}::date, ${data.endDate}::date,
        ${totalValue.toFixed(2)}, ${data.recognitionMethod},
        '0.00', ${totalValue.toFixed(2)}, 'active', ${userId}, ${now}, ${now}
      )
    `);

    for (const po of data.performanceObligations) {
      const poId = crypto.randomUUID();
      const ssp = d(po.standaloneSellingPrice);
      const allocatedPrice = totalSSP.isZero() ? new Decimal(0) : totalValue.times(ssp).dividedBy(totalSSP);

      await db.execute(sql`
        INSERT INTO revenue_performance_obligations (
          id, contract_id, description, standalone_selling_price, allocated_price,
          recognition_method, progress_measure, percent_complete,
          recognized_amount, deferred_amount, created_at
        ) VALUES (
          ${poId}, ${id}, ${po.description}, ${ssp.toFixed(2)}, ${allocatedPrice.toFixed(2)},
          ${po.recognitionMethod}, ${po.progressMeasure || null}, '0.00',
          '0.00', ${allocatedPrice.toFixed(2)}, ${now}
        )
      `);
    }

    return this.getRevenueContract(orgId, id);
  }

  async recognizeRevenue(orgId: string, contractId: string, data: {
    obligationId: string;
    percentComplete: string;
    recognitionDate: string;
  }, userId: string): Promise<{ recognized: string; journalEntryId: string }> {
    const contract = await this.getRevenueContract(orgId, contractId);
    const obligation = contract.performanceObligations.find(po => po.id === data.obligationId);
    if (!obligation) throw new Error('Performance obligation not found');

    const newPct = d(data.percentComplete);
    const oldPct = d(obligation.percentComplete);
    const allocatedPrice = d(obligation.allocatedPrice);
    const incrementalPct = newPct.minus(oldPct);

    if (incrementalPct.lessThanOrEqualTo(0)) {
      throw new Error('New percent complete must be greater than current');
    }

    const incrementalRevenue = allocatedPrice.times(incrementalPct).dividedBy(100);

    // Journal entry: debit deferred revenue, credit revenue
    const je = await this.createJournalEntry(orgId, {
      entryDate: data.recognitionDate,
      memo: `Revenue recognition — ${contract.contractNumber} — ${obligation.description}`,
      source: 'REV_REC',
      sourceRef: contractId,
      lines: [
        {
          accountId: 'deferred-revenue', accountCode: '2300', accountName: 'Deferred Revenue',
          description: `Deferred revenue release — ${contract.customerName}`,
          debit: incrementalRevenue.toFixed(2), credit: '0',
        },
        {
          accountId: 'revenue', accountCode: '4000', accountName: 'Revenue',
          description: `Revenue recognized — ${obligation.description}`,
          debit: '0', credit: incrementalRevenue.toFixed(2),
        },
      ],
    }, userId);
    await this.postJournalEntry(orgId, je.id, userId);

    // Update obligation progress
    const newRecognized = d(obligation.recognizedAmount).plus(incrementalRevenue);
    const newDeferred = allocatedPrice.minus(newRecognized);
    await db.execute(sql`
      UPDATE revenue_performance_obligations
      SET percent_complete = ${newPct.toFixed(2)},
          recognized_amount = ${newRecognized.toFixed(2)},
          deferred_amount = ${newDeferred.toFixed(2)}
      WHERE id = ${data.obligationId} AND contract_id = ${contractId}
    `);

    // Update contract totals
    const totalRecognized = contract.performanceObligations.reduce(
      (sum, po) => sum.plus(po.id === data.obligationId ? newRecognized : d(po.recognizedAmount)),
      new Decimal(0)
    );
    const totalDeferred = d(contract.totalContractValue).minus(totalRecognized);
    const isComplete = totalRecognized.gte(d(contract.totalContractValue).minus(new Decimal('0.01')));

    await db.execute(sql`
      UPDATE revenue_contracts
      SET recognized_to_date = ${totalRecognized.toFixed(2)},
          deferred_revenue = ${totalDeferred.toFixed(2)},
          status = ${isComplete ? 'completed' : 'active'},
          updated_at = ${new Date()}
      WHERE id = ${contractId} AND org_id = ${orgId}
    `);

    return { recognized: incrementalRevenue.toFixed(2), journalEntryId: je.id };
  }

  async getRevenueContract(orgId: string, contractId: string): Promise<RevenueContract> {
    const result = await db.execute(sql`
      SELECT * FROM revenue_contracts WHERE id = ${contractId} AND org_id = ${orgId}
    `);
    const row = (result.rows as any[])?.[0];
    if (!row) throw new Error('Revenue contract not found');

    const posResult = await db.execute(sql`
      SELECT * FROM revenue_performance_obligations WHERE contract_id = ${contractId}
    `);

    return {
      id: row.id, orgId: row.org_id, contractNumber: row.contract_number,
      customerName: row.customer_name, startDate: row.start_date, endDate: row.end_date,
      totalContractValue: row.total_contract_value, recognitionMethod: row.recognition_method,
      recognizedToDate: row.recognized_to_date, deferredRevenue: row.deferred_revenue,
      status: row.status,
      performanceObligations: (posResult.rows as any[]).map(r => ({
        id: r.id, contractId: r.contract_id, description: r.description,
        standaloneSellingPrice: r.standalone_selling_price, allocatedPrice: r.allocated_price,
        recognitionMethod: r.recognition_method, progressMeasure: r.progress_measure,
        percentComplete: r.percent_complete, recognizedAmount: r.recognized_amount,
        deferredAmount: r.deferred_amount,
      })),
    };
  }

  async listRevenueContracts(orgId: string, filters?: {
    status?: string; limit?: number; offset?: number;
  }): Promise<{ contracts: RevenueContract[]; total: number }> {
    const conditions: string[] = [`org_id = '${orgId}'`];
    if (filters?.status) conditions.push(`status = '${filters.status}'`);
    const where = conditions.join(' AND ');
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const [contracts, countResult] = await Promise.all([
      db.execute(sql.raw(`SELECT * FROM revenue_contracts WHERE ${where} ORDER BY start_date DESC LIMIT ${limit} OFFSET ${offset}`)),
      db.execute(sql.raw(`SELECT count(*)::int as total FROM revenue_contracts WHERE ${where}`)),
    ]);

    const results: RevenueContract[] = [];
    for (const row of (contracts.rows as any[])) {
      results.push(await this.getRevenueContract(orgId, row.id));
    }

    return { contracts: results, total: (countResult.rows as any[])?.[0]?.total || 0 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERCOMPANY ELIMINATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async recordIntercompanyTransaction(orgId: string, data: {
    fromEntityId: string;
    fromEntityName: string;
    toEntityId: string;
    toEntityName: string;
    transactionDate: string;
    amount: string;
    description: string;
    fromAccountId: string;
    toAccountId: string;
  }, userId: string): Promise<IntercompanyTransaction> {
    const id = crypto.randomUUID();
    const amount = d(data.amount);

    // Create JE on the "from" entity (intercompany receivable / expense)
    const fromJE = await this.createJournalEntry(orgId, {
      entryDate: data.transactionDate,
      memo: `IC to ${data.toEntityName}: ${data.description}`,
      source: 'INTERCOMPANY',
      sourceRef: id,
      entityId: data.fromEntityId, entityType: 'entity',
      lines: [
        {
          accountId: data.fromAccountId, accountCode: '', accountName: '',
          description: data.description, debit: amount.toFixed(2), credit: '0',
        },
        {
          accountId: 'ic-receivable', accountCode: '1250', accountName: 'Intercompany Receivable',
          description: `IC receivable from ${data.toEntityName}`, debit: '0', credit: amount.toFixed(2),
        },
      ],
    }, userId);
    await this.postJournalEntry(orgId, fromJE.id, userId);

    // Create JE on the "to" entity (intercompany payable / revenue)
    const toJE = await this.createJournalEntry(orgId, {
      entryDate: data.transactionDate,
      memo: `IC from ${data.fromEntityName}: ${data.description}`,
      source: 'INTERCOMPANY',
      sourceRef: id,
      entityId: data.toEntityId, entityType: 'entity',
      lines: [
        {
          accountId: 'ic-payable', accountCode: '2050', accountName: 'Intercompany Payable',
          description: `IC payable to ${data.fromEntityName}`, debit: amount.toFixed(2), credit: '0',
        },
        {
          accountId: data.toAccountId, accountCode: '', accountName: '',
          description: data.description, debit: '0', credit: amount.toFixed(2),
        },
      ],
    }, userId);
    await this.postJournalEntry(orgId, toJE.id, userId);

    await db.execute(sql`
      INSERT INTO intercompany_transactions (
        id, org_id, from_entity_id, from_entity_name, to_entity_id, to_entity_name,
        transaction_date, amount, description, from_journal_entry_id, to_journal_entry_id,
        is_eliminated, created_at
      ) VALUES (
        ${id}, ${orgId}, ${data.fromEntityId}, ${data.fromEntityName},
        ${data.toEntityId}, ${data.toEntityName}, ${data.transactionDate}::date,
        ${amount.toFixed(2)}, ${data.description}, ${fromJE.id}, ${toJE.id},
        false, ${new Date()}
      )
    `);

    return {
      id, orgId, fromEntityId: data.fromEntityId, fromEntityName: data.fromEntityName,
      toEntityId: data.toEntityId, toEntityName: data.toEntityName,
      transactionDate: new Date(data.transactionDate), amount: amount.toFixed(2),
      description: data.description, fromJournalEntryId: fromJE.id,
      toJournalEntryId: toJE.id, eliminationJournalEntryId: null, isEliminated: false,
    };
  }

  async eliminateIntercompanyTransactions(orgId: string, transactionIds: string[], userId: string): Promise<{ eliminated: number }> {
    let eliminated = 0;

    for (const txnId of transactionIds) {
      const result = await db.execute(sql`
        SELECT * FROM intercompany_transactions
        WHERE id = ${txnId} AND org_id = ${orgId} AND is_eliminated = false
      `);
      const txn = (result.rows as any[])?.[0];
      if (!txn) continue;

      const amount = d(txn.amount);

      // Create elimination JE
      const elimJE = await this.createJournalEntry(orgId, {
        entryDate: txn.transaction_date.toISOString().split('T')[0],
        memo: `IC elimination: ${txn.from_entity_name} ↔ ${txn.to_entity_name}`,
        source: 'IC_ELIMINATION',
        sourceRef: txnId,
        lines: [
          {
            accountId: 'ic-payable', accountCode: '2050', accountName: 'Intercompany Payable',
            description: 'Eliminate IC payable', debit: '0', credit: amount.toFixed(2),
          },
          {
            accountId: 'ic-receivable', accountCode: '1250', accountName: 'Intercompany Receivable',
            description: 'Eliminate IC receivable', debit: amount.toFixed(2), credit: '0',
          },
        ],
      }, userId);
      await this.postJournalEntry(orgId, elimJE.id, userId);

      await db.execute(sql`
        UPDATE intercompany_transactions
        SET is_eliminated = true, elimination_journal_entry_id = ${elimJE.id}
        WHERE id = ${txnId} AND org_id = ${orgId}
      `);
      eliminated++;
    }

    return { eliminated };
  }

  async listIntercompanyTransactions(orgId: string, filters?: {
    isEliminated?: boolean;
    entityId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<IntercompanyTransaction[]> {
    const conditions: string[] = [`org_id = '${orgId}'`];
    if (filters?.isEliminated !== undefined) conditions.push(`is_eliminated = ${filters.isEliminated}`);
    if (filters?.entityId) conditions.push(`(from_entity_id = '${filters.entityId}' OR to_entity_id = '${filters.entityId}')`);
    if (filters?.startDate) conditions.push(`transaction_date >= '${filters.startDate}'::date`);
    if (filters?.endDate) conditions.push(`transaction_date <= '${filters.endDate}'::date`);

    const result = await db.execute(sql.raw(
      `SELECT * FROM intercompany_transactions WHERE ${conditions.join(' AND ')} ORDER BY transaction_date DESC`
    ));

    return (result.rows as any[]).map(row => ({
      id: row.id, orgId: row.org_id,
      fromEntityId: row.from_entity_id, fromEntityName: row.from_entity_name,
      toEntityId: row.to_entity_id, toEntityName: row.to_entity_name,
      transactionDate: row.transaction_date, amount: row.amount,
      description: row.description, fromJournalEntryId: row.from_journal_entry_id,
      toJournalEntryId: row.to_journal_entry_id,
      eliminationJournalEntryId: row.elimination_journal_entry_id,
      isEliminated: row.is_eliminated,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL STATEMENTS PACKAGE
  // ═══════════════════════════════════════════════════════════════════════════

  async generateIncomeStatement(orgId: string, startDate: string, endDate: string): Promise<{
    revenue: { items: { accountName: string; amount: string }[]; total: string };
    costOfGoodsSold: { items: { accountName: string; amount: string }[]; total: string };
    grossProfit: string;
    operatingExpenses: { items: { accountName: string; amount: string }[]; total: string };
    operatingIncome: string;
    otherIncome: { items: { accountName: string; amount: string }[]; total: string };
    otherExpenses: { items: { accountName: string; amount: string }[]; total: string };
    netIncome: string;
  }> {
    const result = await db.execute(sql`
      SELECT
        jel.account_code,
        jel.account_name,
        SUM(jel.credit::numeric) - SUM(jel.debit::numeric) as net_credit,
        SUM(jel.debit::numeric) - SUM(jel.credit::numeric) as net_debit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.org_id = ${orgId} AND je.status = 'posted'
        AND je.entry_date BETWEEN ${startDate}::date AND ${endDate}::date
        AND (jel.account_code LIKE '4%' OR jel.account_code LIKE '5%'
             OR jel.account_code LIKE '6%' OR jel.account_code LIKE '7%' OR jel.account_code LIKE '8%')
      GROUP BY jel.account_code, jel.account_name
      ORDER BY jel.account_code
    `);

    const sections: any = { revenue: [], cogs: [], opex: [], otherIncome: [], otherExpenses: [] };

    for (const row of (result.rows as any[])) {
      const code = row.account_code || '';
      const item = { accountName: row.account_name, amount: '' };

      if (code.startsWith('4')) {
        item.amount = d(row.net_credit).toFixed(2);
        sections.revenue.push(item);
      } else if (code.startsWith('50')) {
        item.amount = d(row.net_debit).toFixed(2);
        sections.cogs.push(item);
      } else if (code.startsWith('5') || code.startsWith('6')) {
        item.amount = d(row.net_debit).toFixed(2);
        sections.opex.push(item);
      } else if (code.startsWith('7')) {
        item.amount = d(row.net_credit).toFixed(2);
        sections.otherIncome.push(item);
      } else if (code.startsWith('8')) {
        item.amount = d(row.net_debit).toFixed(2);
        sections.otherExpenses.push(item);
      }
    }

    const totalRevenue = sections.revenue.reduce((s: Decimal, i: any) => s.plus(d(i.amount)), new Decimal(0));
    const totalCOGS = sections.cogs.reduce((s: Decimal, i: any) => s.plus(d(i.amount)), new Decimal(0));
    const grossProfit = totalRevenue.minus(totalCOGS);
    const totalOpex = sections.opex.reduce((s: Decimal, i: any) => s.plus(d(i.amount)), new Decimal(0));
    const operatingIncome = grossProfit.minus(totalOpex);
    const totalOtherIncome = sections.otherIncome.reduce((s: Decimal, i: any) => s.plus(d(i.amount)), new Decimal(0));
    const totalOtherExpenses = sections.otherExpenses.reduce((s: Decimal, i: any) => s.plus(d(i.amount)), new Decimal(0));
    const netIncome = operatingIncome.plus(totalOtherIncome).minus(totalOtherExpenses);

    return {
      revenue: { items: sections.revenue, total: totalRevenue.toFixed(2) },
      costOfGoodsSold: { items: sections.cogs, total: totalCOGS.toFixed(2) },
      grossProfit: grossProfit.toFixed(2),
      operatingExpenses: { items: sections.opex, total: totalOpex.toFixed(2) },
      operatingIncome: operatingIncome.toFixed(2),
      otherIncome: { items: sections.otherIncome, total: totalOtherIncome.toFixed(2) },
      otherExpenses: { items: sections.otherExpenses, total: totalOtherExpenses.toFixed(2) },
      netIncome: netIncome.toFixed(2),
    };
  }

  async generateBalanceSheet(orgId: string, asOfDate: string): Promise<{
    assets: { current: any[]; longTerm: any[]; totalAssets: string };
    liabilities: { current: any[]; longTerm: any[]; totalLiabilities: string };
    equity: { items: any[]; totalEquity: string };
    totalLiabilitiesAndEquity: string;
    isBalanced: boolean;
  }> {
    const result = await db.execute(sql`
      SELECT
        jel.account_code,
        jel.account_name,
        SUM(jel.debit::numeric) - SUM(jel.credit::numeric) as net_balance
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.org_id = ${orgId} AND je.status = 'posted'
        AND je.entry_date <= ${asOfDate}::date
        AND (jel.account_code LIKE '1%' OR jel.account_code LIKE '2%' OR jel.account_code LIKE '3%')
      GROUP BY jel.account_code, jel.account_name
      ORDER BY jel.account_code
    `);

    const assets: any = { current: [], longTerm: [] };
    const liabilities: any = { current: [], longTerm: [] };
    const equity: any[] = [];

    for (const row of (result.rows as any[])) {
      const code = row.account_code || '';
      const item = { accountCode: code, accountName: row.account_name, balance: d(row.net_balance).toFixed(2) };

      if (code.startsWith('1')) {
        if (code < '15') assets.current.push(item);
        else assets.longTerm.push(item);
      } else if (code.startsWith('2')) {
        if (code < '22') liabilities.current.push(item);
        else liabilities.longTerm.push(item);
      } else if (code.startsWith('3')) {
        equity.push(item);
      }
    }

    const totalCurrentAssets = assets.current.reduce((s: Decimal, i: any) => s.plus(d(i.balance)), new Decimal(0));
    const totalLongTermAssets = assets.longTerm.reduce((s: Decimal, i: any) => s.plus(d(i.balance)), new Decimal(0));
    const totalAssets = totalCurrentAssets.plus(totalLongTermAssets);

    const totalCurrentLiab = liabilities.current.reduce((s: Decimal, i: any) => s.plus(d(i.balance).abs()), new Decimal(0));
    const totalLongTermLiab = liabilities.longTerm.reduce((s: Decimal, i: any) => s.plus(d(i.balance).abs()), new Decimal(0));
    const totalLiabilities = totalCurrentLiab.plus(totalLongTermLiab);

    const totalEquity = equity.reduce((s: Decimal, i: any) => s.plus(d(i.balance).abs()), new Decimal(0));
    const totalLE = totalLiabilities.plus(totalEquity);

    return {
      assets: {
        current: assets.current, longTerm: assets.longTerm,
        totalAssets: totalAssets.toFixed(2),
      },
      liabilities: {
        current: liabilities.current, longTerm: liabilities.longTerm,
        totalLiabilities: totalLiabilities.toFixed(2),
      },
      equity: { items: equity, totalEquity: totalEquity.toFixed(2) },
      totalLiabilitiesAndEquity: totalLE.toFixed(2),
      isBalanced: totalAssets.minus(totalLE).abs().lessThan(new Decimal('0.01')),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Row Mappers
  // ═══════════════════════════════════════════════════════════════════════════

  private mapJournalEntry(row: any): JournalEntry {
    return {
      id: row.id, orgId: row.org_id, entryNumber: row.entry_number,
      entryDate: row.entry_date, postDate: row.post_date || null,
      memo: row.memo, status: row.status, source: row.source,
      sourceRef: row.source_ref || null, reversalOfId: row.reversal_of_id || null,
      autoReversalDate: row.auto_reversal_date || null,
      entityId: row.entity_id || null, entityType: row.entity_type || null,
      createdBy: row.created_by, approvedBy: row.approved_by || null,
      postedBy: row.posted_by || null,
      createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
    };
  }

  private mapJournalEntryLine(row: any): JournalEntryLine {
    return {
      id: row.id, journalEntryId: row.journal_entry_id, lineNumber: row.line_number,
      accountId: row.account_id, accountCode: row.account_code, accountName: row.account_name,
      departmentId: row.department_id || null, profitCenterId: row.profit_center_id || null,
      description: row.description, debit: row.debit, credit: row.credit,
      entityId: row.entity_id || null, entityType: row.entity_type || null,
    };
  }

  private mapARInvoice(row: any): Omit<ARInvoice, 'lineItems' | 'payments'> {
    return {
      id: row.id, orgId: row.org_id, invoiceNumber: row.invoice_number,
      customerId: row.customer_id, customerName: row.customer_name,
      issueDate: row.issue_date, dueDate: row.due_date, terms: row.terms,
      subtotal: row.subtotal, taxAmount: row.tax_amount, totalAmount: row.total_amount,
      amountPaid: row.amount_paid, balanceDue: row.balance_due,
      status: row.status, currencyCode: row.currency_code,
      memo: row.memo || null, journalEntryId: row.journal_entry_id || null,
      recurringScheduleId: row.recurring_schedule_id || null,
    };
  }

  private mapARInvoiceLine(row: any): ARInvoiceLine {
    return {
      id: row.id, invoiceId: row.invoice_id, lineNumber: row.line_number,
      description: row.description, quantity: row.quantity, unitPrice: row.unit_price,
      amount: row.amount, accountId: row.account_id,
      taxRate: row.tax_rate, taxAmount: row.tax_amount,
    };
  }

  private mapARPayment(row: any): ARPayment {
    return {
      id: row.id, orgId: row.org_id, invoiceId: row.invoice_id,
      paymentDate: row.payment_date, amount: row.amount,
      paymentMethod: row.payment_method, referenceNumber: row.reference_number || null,
      depositAccountId: row.deposit_account_id, journalEntryId: row.journal_entry_id || null,
      memo: row.memo || null,
    };
  }

  private mapAPBill(row: any): Omit<APBill, 'lineItems' | 'payments'> {
    return {
      id: row.id, orgId: row.org_id, billNumber: row.bill_number,
      vendorId: row.vendor_id, vendorName: row.vendor_name,
      vendorTaxId: row.vendor_tax_id || null,
      issueDate: row.issue_date, dueDate: row.due_date, terms: row.terms,
      subtotal: row.subtotal, taxAmount: row.tax_amount, totalAmount: row.total_amount,
      amountPaid: row.amount_paid, balanceDue: row.balance_due,
      status: row.status, currencyCode: row.currency_code,
      memo: row.memo || null, journalEntryId: row.journal_entry_id || null,
      is1099Eligible: row.is_1099_eligible, form1099Type: row.form_1099_type || null,
      form1099Box: row.form_1099_box || null,
    };
  }

  private mapAPBillLine(row: any): APBillLine {
    return {
      id: row.id, billId: row.bill_id, lineNumber: row.line_number,
      description: row.description, quantity: row.quantity, unitPrice: row.unit_price,
      amount: row.amount, accountId: row.account_id,
      departmentId: row.department_id || null,
    };
  }

  private mapAPPayment(row: any): APPayment {
    return {
      id: row.id, orgId: row.org_id, billId: row.bill_id,
      paymentDate: row.payment_date, amount: row.amount,
      paymentMethod: row.payment_method, checkNumber: row.check_number || null,
      bankAccountId: row.bank_account_id, journalEntryId: row.journal_entry_id || null,
      memo: row.memo || null,
    };
  }

  private mapCloseStep(row: any): MonthEndCloseStep {
    return {
      id: row.id, closeId: row.close_id, stepOrder: row.step_order,
      stepName: row.step_name, stepDescription: row.step_description,
      status: row.status, assignedTo: row.assigned_to || null,
      completedBy: row.completed_by || null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      notes: row.notes || null, requiredApproval: row.required_approval,
      approvedBy: row.approved_by || null,
      approvedAt: row.approved_at ? new Date(row.approved_at) : null,
    };
  }
}

export const accountingEngine = new AccountingEngine();
