/**
 * React Query hooks for the Accounting Engine
 * AR, AP, JE, Bank Rec, Trial Balance, Cash Flow, Month-End Close,
 * Revenue Recognition, Intercompany
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Query Key Factories ─────────────────────────────────────────────────────

export const accountingKeys = {
  all: ['accounting'] as const,
  journalEntries: () => [...accountingKeys.all, 'journal-entries'] as const,
  journalEntry: (id: string) => [...accountingKeys.all, 'journal-entries', id] as const,
  invoices: () => [...accountingKeys.all, 'invoices'] as const,
  invoice: (id: string) => [...accountingKeys.all, 'invoices', id] as const,
  arAging: () => [...accountingKeys.all, 'ar-aging'] as const,
  bills: () => [...accountingKeys.all, 'bills'] as const,
  bill: (id: string) => [...accountingKeys.all, 'bills', id] as const,
  apAging: () => [...accountingKeys.all, 'ap-aging'] as const,
  form1099: (year: number) => [...accountingKeys.all, '1099', year] as const,
  bankTransactions: () => [...accountingKeys.all, 'bank-transactions'] as const,
  reconciliation: (id: string) => [...accountingKeys.all, 'reconciliation', id] as const,
  trialBalance: (date: string) => [...accountingKeys.all, 'trial-balance', date] as const,
  incomeStatement: (start: string, end: string) => [...accountingKeys.all, 'income-statement', start, end] as const,
  balanceSheet: (date: string) => [...accountingKeys.all, 'balance-sheet', date] as const,
  cashFlow: (start: string, end: string) => [...accountingKeys.all, 'cash-flow', start, end] as const,
  monthEndCloses: () => [...accountingKeys.all, 'month-end-closes'] as const,
  monthEndClose: (id: string) => [...accountingKeys.all, 'month-end-close', id] as const,
  revenueContracts: () => [...accountingKeys.all, 'revenue-contracts'] as const,
  revenueContract: (id: string) => [...accountingKeys.all, 'revenue-contract', id] as const,
  intercompany: () => [...accountingKeys.all, 'intercompany'] as const,
};

// ─── Journal Entries ─────────────────────────────────────────────────────────

export function useJournalEntries(filters?: Record<string, any>) {
  const params = new URLSearchParams(filters || {}).toString();
  return useQuery({
    queryKey: [...accountingKeys.journalEntries(), filters],
    queryFn: () => fetchApi<any>(`/api/accounting/journal-entries${params ? `?${params}` : ''}`),
  });
}

export function useJournalEntry(id: string | undefined) {
  return useQuery({
    queryKey: accountingKeys.journalEntry(id!),
    queryFn: () => fetchApi<any>(`/api/accounting/journal-entries/${id}`),
    enabled: !!id,
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/accounting/journal-entries', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.journalEntries() }); },
  });
}

export function usePostJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/accounting/journal-entries/${id}/post`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountingKeys.journalEntries() });
      qc.invalidateQueries({ queryKey: accountingKeys.all });
    },
  });
}

export function useReverseJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reversalDate }: { id: string; reversalDate: string }) =>
      fetchApi(`/api/accounting/journal-entries/${id}/reverse`, { method: 'POST', body: JSON.stringify({ reversalDate }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.journalEntries() }); },
  });
}

// ─── Accounts Receivable ─────────────────────────────────────────────────────

export function useInvoices(filters?: Record<string, any>) {
  const params = new URLSearchParams(filters || {}).toString();
  return useQuery({
    queryKey: [...accountingKeys.invoices(), filters],
    queryFn: () => fetchApi<any>(`/api/accounting/invoices${params ? `?${params}` : ''}`),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: accountingKeys.invoice(id!),
    queryFn: () => fetchApi<any>(`/api/accounting/invoices/${id}`),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/accounting/invoices', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.invoices() }); },
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/accounting/invoices/${id}/send`, { method: 'POST' }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: accountingKeys.invoice(id) });
      qc.invalidateQueries({ queryKey: accountingKeys.journalEntries() });
    },
  });
}

export function useRecordARPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...data }: any) =>
      fetchApi(`/api/accounting/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountingKeys.invoices() });
      qc.invalidateQueries({ queryKey: accountingKeys.arAging() });
      qc.invalidateQueries({ queryKey: accountingKeys.journalEntries() });
    },
  });
}

export function useARAgingReport(asOfDate?: string) {
  return useQuery({
    queryKey: accountingKeys.arAging(),
    queryFn: () => fetchApi<any>(`/api/accounting/ar/aging${asOfDate ? `?asOfDate=${asOfDate}` : ''}`),
  });
}

// ─── Accounts Payable ────────────────────────────────────────────────────────

export function useBills(filters?: Record<string, any>) {
  const params = new URLSearchParams(filters || {}).toString();
  return useQuery({
    queryKey: [...accountingKeys.bills(), filters],
    queryFn: () => fetchApi<any>(`/api/accounting/bills${params ? `?${params}` : ''}`),
  });
}

export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: accountingKeys.bill(id!),
    queryFn: () => fetchApi<any>(`/api/accounting/bills/${id}`),
    enabled: !!id,
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/accounting/bills', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.bills() }); },
  });
}

export function useApproveBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/accounting/bills/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountingKeys.bills() });
      qc.invalidateQueries({ queryKey: accountingKeys.journalEntries() });
    },
  });
}

export function useRecordAPPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ billId, ...data }: any) =>
      fetchApi(`/api/accounting/bills/${billId}/payments`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountingKeys.bills() });
      qc.invalidateQueries({ queryKey: accountingKeys.apAging() });
      qc.invalidateQueries({ queryKey: accountingKeys.journalEntries() });
    },
  });
}

export function useAPAgingReport(asOfDate?: string) {
  return useQuery({
    queryKey: accountingKeys.apAging(),
    queryFn: () => fetchApi<any>(`/api/accounting/ap/aging${asOfDate ? `?asOfDate=${asOfDate}` : ''}`),
  });
}

export function use1099Summary(taxYear: number) {
  return useQuery({
    queryKey: accountingKeys.form1099(taxYear),
    queryFn: () => fetchApi<any>(`/api/accounting/1099-summary/${taxYear}`),
  });
}

// ─── Bank Reconciliation ─────────────────────────────────────────────────────

export function useImportBankTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/accounting/bank/import', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.bankTransactions() }); },
  });
}

export function useAutoMatchBankTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bankAccountId: string) =>
      fetchApi('/api/accounting/bank/auto-match', { method: 'POST', body: JSON.stringify({ bankAccountId }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.bankTransactions() }); },
  });
}

export function useStartReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/accounting/bank/reconciliation', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.all }); },
  });
}

export function useReconciliation(id: string | undefined) {
  return useQuery({
    queryKey: accountingKeys.reconciliation(id!),
    queryFn: () => fetchApi<any>(`/api/accounting/bank/reconciliation/${id}`),
    enabled: !!id,
  });
}

export function useCompleteReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/accounting/bank/reconciliation/${id}/complete`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.all }); },
  });
}

// ─── Financial Reports ───────────────────────────────────────────────────────

export function useTrialBalance(asOfDate: string) {
  return useQuery({
    queryKey: accountingKeys.trialBalance(asOfDate),
    queryFn: () => fetchApi<any>(`/api/accounting/reports/trial-balance?asOfDate=${asOfDate}`),
    enabled: !!asOfDate,
  });
}

export function useIncomeStatement(startDate: string, endDate: string) {
  return useQuery({
    queryKey: accountingKeys.incomeStatement(startDate, endDate),
    queryFn: () => fetchApi<any>(`/api/accounting/reports/income-statement?startDate=${startDate}&endDate=${endDate}`),
    enabled: !!startDate && !!endDate,
  });
}

export function useBalanceSheet(asOfDate: string) {
  return useQuery({
    queryKey: accountingKeys.balanceSheet(asOfDate),
    queryFn: () => fetchApi<any>(`/api/accounting/reports/balance-sheet?asOfDate=${asOfDate}`),
    enabled: !!asOfDate,
  });
}

export function useCashFlowStatement(startDate: string, endDate: string) {
  return useQuery({
    queryKey: accountingKeys.cashFlow(startDate, endDate),
    queryFn: () => fetchApi<any>(`/api/accounting/reports/cash-flow?startDate=${startDate}&endDate=${endDate}`),
    enabled: !!startDate && !!endDate,
  });
}

// ─── Month-End Close ─────────────────────────────────────────────────────────

export function useMonthEndCloses() {
  return useQuery({
    queryKey: accountingKeys.monthEndCloses(),
    queryFn: () => fetchApi<any>('/api/accounting/month-end-close'),
  });
}

export function useMonthEndClose(id: string | undefined) {
  return useQuery({
    queryKey: accountingKeys.monthEndClose(id!),
    queryFn: () => fetchApi<any>(`/api/accounting/month-end-close/${id}`),
    enabled: !!id,
  });
}

export function useInitializeMonthEndClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/accounting/month-end-close', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.monthEndCloses() }); },
  });
}

export function useUpdateCloseStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ closeId, stepId, ...data }: any) =>
      fetchApi(`/api/accounting/month-end-close/${closeId}/steps/${stepId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: accountingKeys.monthEndClose(vars.closeId) }); },
  });
}

export function useApproveCloseStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ closeId, stepId }: { closeId: string; stepId: string }) =>
      fetchApi(`/api/accounting/month-end-close/${closeId}/steps/${stepId}/approve`, { method: 'POST' }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: accountingKeys.monthEndClose(vars.closeId) }); },
  });
}

export function useFinalizeMonthEndClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/accounting/month-end-close/${id}/finalize`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.monthEndCloses() }); },
  });
}

export function useReopenMonthEndClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fetchApi(`/api/accounting/month-end-close/${id}/reopen`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.monthEndCloses() }); },
  });
}

// ─── Revenue Recognition ─────────────────────────────────────────────────────

export function useRevenueContracts(filters?: Record<string, any>) {
  const params = new URLSearchParams(filters || {}).toString();
  return useQuery({
    queryKey: [...accountingKeys.revenueContracts(), filters],
    queryFn: () => fetchApi<any>(`/api/accounting/revenue-contracts${params ? `?${params}` : ''}`),
  });
}

export function useRevenueContract(id: string | undefined) {
  return useQuery({
    queryKey: accountingKeys.revenueContract(id!),
    queryFn: () => fetchApi<any>(`/api/accounting/revenue-contracts/${id}`),
    enabled: !!id,
  });
}

export function useCreateRevenueContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/accounting/revenue-contracts', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: accountingKeys.revenueContracts() }); },
  });
}

export function useRecognizeRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contractId, ...data }: any) =>
      fetchApi(`/api/accounting/revenue-contracts/${contractId}/recognize`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountingKeys.revenueContracts() });
      qc.invalidateQueries({ queryKey: accountingKeys.journalEntries() });
    },
  });
}

// ─── Intercompany ────────────────────────────────────────────────────────────

export function useIntercompanyTransactions(filters?: Record<string, any>) {
  const params = new URLSearchParams(filters || {}).toString();
  return useQuery({
    queryKey: [...accountingKeys.intercompany(), filters],
    queryFn: () => fetchApi<any>(`/api/accounting/intercompany${params ? `?${params}` : ''}`),
  });
}

export function useRecordIntercompanyTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/accounting/intercompany', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountingKeys.intercompany() });
      qc.invalidateQueries({ queryKey: accountingKeys.journalEntries() });
    },
  });
}

export function useEliminateIntercompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transactionIds: string[]) =>
      fetchApi('/api/accounting/intercompany/eliminate', { method: 'POST', body: JSON.stringify({ transactionIds }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accountingKeys.intercompany() });
      qc.invalidateQueries({ queryKey: accountingKeys.journalEntries() });
    },
  });
}
