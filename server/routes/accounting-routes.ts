/**
 * MarinaMatch Accounting Engine Routes
 * Full double-entry: JE, AR, AP, Bank Rec, Trial Balance, Cash Flow,
 * Month-End Close, 1099, Revenue Recognition, Intercompany
 */

import { Router, Request, Response } from 'express';
import { accountingEngine } from '../services/accounting-engine';

export const accountingRouter = Router();

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || null;
}

function getUserId(req: Request): string {
  return (req as any).user?.id || '';
}

// ─── Journal Entries ─────────────────────────────────────────────────────────

accountingRouter.post('/journal-entries', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const entry = await accountingEngine.createJournalEntry(orgId, req.body, getUserId(req));
    res.json(entry);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.get('/journal-entries', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await accountingEngine.listJournalEntries(orgId, {
      status: req.query.status as any,
      source: req.query.source as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      accountId: req.query.accountId as string,
      search: req.query.search as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

accountingRouter.get('/journal-entries/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const entry = await accountingEngine.getJournalEntry(orgId, req.params.id);
    const lines = await accountingEngine.getJournalEntryLines(orgId, req.params.id);
    res.json({ ...entry, lines });
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

accountingRouter.post('/journal-entries/:id/post', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const entry = await accountingEngine.postJournalEntry(orgId, req.params.id, getUserId(req));
    res.json(entry);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.post('/journal-entries/:id/reverse', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const reversal = await accountingEngine.reverseJournalEntry(orgId, req.params.id, req.body.reversalDate, getUserId(req));
    res.json(reversal);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.post('/journal-entries/:id/void', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    await accountingEngine.voidJournalEntry(orgId, req.params.id, getUserId(req));
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Accounts Receivable ─────────────────────────────────────────────────────

accountingRouter.post('/invoices', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const invoice = await accountingEngine.createInvoice(orgId, req.body, getUserId(req));
    res.json(invoice);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.get('/invoices', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await accountingEngine.listInvoices(orgId, {
      status: req.query.status as any,
      customerId: req.query.customerId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

accountingRouter.get('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const invoice = await accountingEngine.getInvoice(orgId, req.params.id);
    res.json(invoice);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

accountingRouter.post('/invoices/:id/send', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const invoice = await accountingEngine.sendInvoice(orgId, req.params.id, getUserId(req));
    res.json(invoice);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.post('/invoices/:id/payments', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const payment = await accountingEngine.recordARPayment(orgId, { ...req.body, invoiceId: req.params.id }, getUserId(req));
    res.json(payment);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.get('/ar/aging', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const report = await accountingEngine.getARAgingReport(orgId, req.query.asOfDate as string);
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Accounts Payable ────────────────────────────────────────────────────────

accountingRouter.post('/bills', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const bill = await accountingEngine.createBill(orgId, req.body, getUserId(req));
    res.json(bill);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.get('/bills', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await accountingEngine.listBills(orgId, {
      status: req.query.status as any,
      vendorId: req.query.vendorId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      is1099Eligible: req.query.is1099Eligible === 'true' ? true : req.query.is1099Eligible === 'false' ? false : undefined,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

accountingRouter.get('/bills/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const bill = await accountingEngine.getBill(orgId, req.params.id);
    res.json(bill);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

accountingRouter.post('/bills/:id/approve', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const bill = await accountingEngine.approveBill(orgId, req.params.id, getUserId(req));
    res.json(bill);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.post('/bills/:id/payments', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const payment = await accountingEngine.recordAPPayment(orgId, { ...req.body, billId: req.params.id }, getUserId(req));
    res.json(payment);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.get('/ap/aging', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const report = await accountingEngine.getAPAgingReport(orgId, req.query.asOfDate as string);
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

accountingRouter.get('/1099-summary/:taxYear', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const summary = await accountingEngine.get1099Summary(orgId, parseInt(req.params.taxYear));
    res.json(summary);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Bank Reconciliation ─────────────────────────────────────────────────────

accountingRouter.post('/bank/import', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const { bankAccountId, transactions } = req.body;
    const result = await accountingEngine.importBankTransactions(orgId, bankAccountId, transactions, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.post('/bank/auto-match', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await accountingEngine.autoMatchBankTransactions(orgId, req.body.bankAccountId);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

accountingRouter.post('/bank/reconciliation', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const recon = await accountingEngine.startReconciliation(orgId, req.body, getUserId(req));
    res.json(recon);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.get('/bank/reconciliation/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const recon = await accountingEngine.getReconciliation(orgId, req.params.id);
    res.json(recon);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

accountingRouter.post('/bank/reconciliation/:id/complete', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const recon = await accountingEngine.completeReconciliation(orgId, req.params.id, getUserId(req));
    res.json(recon);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Financial Reports ───────────────────────────────────────────────────────

accountingRouter.get('/reports/trial-balance', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const tb = await accountingEngine.generateTrialBalance(orgId, req.query.asOfDate as string || new Date().toISOString().split('T')[0]);
    res.json(tb);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

accountingRouter.get('/reports/income-statement', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const report = await accountingEngine.generateIncomeStatement(orgId, req.query.startDate as string, req.query.endDate as string);
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

accountingRouter.get('/reports/balance-sheet', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const report = await accountingEngine.generateBalanceSheet(orgId, req.query.asOfDate as string || new Date().toISOString().split('T')[0]);
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

accountingRouter.get('/reports/cash-flow', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const report = await accountingEngine.generateCashFlowStatement(orgId, req.query.startDate as string, req.query.endDate as string);
    res.json(report);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Month-End Close ─────────────────────────────────────────────────────────

accountingRouter.post('/month-end-close', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const close = await accountingEngine.initializeMonthEndClose(orgId, req.body.periodLabel, req.body.periodStart, req.body.periodEnd, getUserId(req));
    res.json(close);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.get('/month-end-close', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const closes = await accountingEngine.listMonthEndCloses(orgId);
    res.json(closes);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

accountingRouter.get('/month-end-close/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const close = await accountingEngine.getMonthEndClose(orgId, req.params.id);
    res.json(close);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

accountingRouter.patch('/month-end-close/:closeId/steps/:stepId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const step = await accountingEngine.updateCloseStep(orgId, req.params.closeId, req.params.stepId, req.body, getUserId(req));
    res.json(step);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.post('/month-end-close/:closeId/steps/:stepId/approve', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const step = await accountingEngine.approveCloseStep(orgId, req.params.closeId, req.params.stepId, getUserId(req));
    res.json(step);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.post('/month-end-close/:id/finalize', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const close = await accountingEngine.finalizeMonthEndClose(orgId, req.params.id, getUserId(req));
    res.json(close);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.post('/month-end-close/:id/reopen', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const close = await accountingEngine.reopenMonthEndClose(orgId, req.params.id, req.body.reason, getUserId(req));
    res.json(close);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Revenue Recognition ─────────────────────────────────────────────────────

accountingRouter.post('/revenue-contracts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const contract = await accountingEngine.createRevenueContract(orgId, req.body, getUserId(req));
    res.json(contract);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.get('/revenue-contracts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await accountingEngine.listRevenueContracts(orgId, {
      status: req.query.status as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

accountingRouter.get('/revenue-contracts/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const contract = await accountingEngine.getRevenueContract(orgId, req.params.id);
    res.json(contract);
  } catch (e: any) { res.status(404).json({ error: e.message }); }
});

accountingRouter.post('/revenue-contracts/:id/recognize', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await accountingEngine.recognizeRevenue(orgId, req.params.id, req.body, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ─── Intercompany ────────────────────────────────────────────────────────────

accountingRouter.post('/intercompany', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const txn = await accountingEngine.recordIntercompanyTransaction(orgId, req.body, getUserId(req));
    res.json(txn);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

accountingRouter.get('/intercompany', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const txns = await accountingEngine.listIntercompanyTransactions(orgId, {
      isEliminated: req.query.isEliminated === 'true' ? true : req.query.isEliminated === 'false' ? false : undefined,
      entityId: req.query.entityId as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    });
    res.json(txns);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

accountingRouter.post('/intercompany/eliminate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Authentication required' });
    const result = await accountingEngine.eliminateIntercompanyTransactions(orgId, req.body.transactionIds, getUserId(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
