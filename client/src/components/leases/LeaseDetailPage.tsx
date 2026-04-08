/**
 * Lease Detail Page
 * =================
 * Full tabbed detail view for a single commercial lease.
 * 8 tabs as specified: Summary, Terms & Options, Charges, Abatements,
 * Sales & % Rent, TI Program, Recoveries/Stops, Monthly Schedule.
 *
 * Usage:
 *   <LeaseDetailPage leaseId={selectedLeaseId} onBack={() => setView("list")} />
 */

import React, { useState, useMemo } from "react";
import { useLeaseDetail, useCashflows, useLeaseMutations } from "@/hooks/use-leases";
import type {
  LeaseTerm,
  LeaseChargeLine,
  LeaseAbatement,
  LeaseMonthlyCashflow,
  LeasePercentRentRule,
  LeaseTiProgram,
  LeaseTiDraw,
  LeaseRecoveryModel,
  LeaseRecoveryCategoryRow,
  BaseRentMode,
  EscalationType,
  ChargeLineType,
  ChargeAmountMode,
  AbatementType,
  AbatementAppliesTo,
  PercentRentTiming,
  BreakpointType,
  YearBasis,
  TiAllowanceMode,
  TiParticipationMode,
  RecoveryCategory,
  RecoveryStopType,
} from "@shared/commercial-lease-types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(v: string | number | null): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (n == null || isNaN(n)) return "$0.00";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  return new Date(v + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const TABS = [
  "Summary",
  "Terms & Options",
  "Charges",
  "Abatements",
  "Sales & % Rent",
  "TI Program",
  "Recoveries / Stops",
  "Monthly Schedule",
] as const;

type Tab = (typeof TABS)[number];

// ─── Component ───────────────────────────────────────────────────────────────

interface LeaseDetailPageProps {
  leaseId: string;
  onBack?: () => void;
}

export default function LeaseDetailPage({ leaseId, onBack }: LeaseDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Summary");
  const { detail, loading, error, refetch } = useLeaseDetail(leaseId);
  const { cashflows, loading: cfLoading, refetch: cfRefetch } = useCashflows(leaseId);
  const mutations = useLeaseMutations(() => { refetch(); cfRefetch(); });

  if (loading) return <div className="p-8 text-center text-gray-500">Loading lease details...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  if (!detail) return <div className="p-8 text-center text-gray-400">Lease not found.</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        {onBack && (
          <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{detail.tenantName}</h1>
          <p className="text-sm text-gray-500">
            {detail.leaseType.charAt(0).toUpperCase() + detail.leaseType.slice(1)} · Suite {detail.suite || "N/A"} · {parseFloat(detail.sf).toLocaleString()} SF
          </p>
        </div>
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${detail.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {detail.active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex -mb-px space-x-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "Summary" && <SummaryTab detail={detail} cashflows={cashflows} />}
        {activeTab === "Terms & Options" && <TermsTab detail={detail} mutations={mutations} />}
        {activeTab === "Charges" && <ChargesTab detail={detail} mutations={mutations} />}
        {activeTab === "Abatements" && <AbatementsTab detail={detail} mutations={mutations} />}
        {activeTab === "Sales & % Rent" && <SalesTab detail={detail} mutations={mutations} />}
        {activeTab === "TI Program" && <TiTab detail={detail} mutations={mutations} />}
        {activeTab === "Recoveries / Stops" && <RecoveriesTab detail={detail} mutations={mutations} />}
        {activeTab === "Monthly Schedule" && <ScheduleTab leaseId={leaseId} cashflows={cashflows} loading={cfLoading} />}
      </div>
    </div>
  );
}

// ─── TAB 1: Summary ──────────────────────────────────────────────────────────

function SummaryTab({ detail, cashflows }: { detail: any; cashflows: LeaseMonthlyCashflow[] }) {
  const totals = useMemo(() => {
    let base = 0, rec = 0, pct = 0, misc = 0, disc = 0, ti = 0, total = 0;
    for (const cf of cashflows) {
      base += parseFloat(cf.baseRent);
      rec += parseFloat(cf.recoveriesCam) + parseFloat(cf.recoveriesTax) + parseFloat(cf.recoveriesInsurance) + parseFloat(cf.recoveriesUtilities);
      pct += parseFloat(cf.percentRent);
      misc += parseFloat(cf.miscIncome);
      disc += parseFloat(cf.discounts);
      ti += parseFloat(cf.tiLandlordCapex);
      total += parseFloat(cf.totalRent);
    }
    return { base, rec, pct, misc, disc, ti, total, months: cashflows.length };
  }, [cashflows]);

  const kpis = [
    { label: "Total Base Rent", value: fmt$(totals.base), color: "text-blue-600" },
    { label: "Total Recoveries", value: fmt$(totals.rec), color: "text-green-600" },
    { label: "Percent Rent", value: fmt$(totals.pct), color: "text-purple-600" },
    { label: "TI Landlord CapEx", value: fmt$(totals.ti), color: "text-orange-600" },
    { label: "Net Total Rent", value: fmt$(totals.total), color: "text-gray-900" },
    { label: "Schedule Months", value: String(totals.months), color: "text-gray-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white border rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">{kpi.label}</p>
            <p className={`mt-1 text-xl font-semibold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white border rounded-lg p-4 space-y-2">
        <h3 className="font-medium text-gray-900">Lease Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p><span className="text-gray-500">Commencement:</span> {fmtDate(detail.commencementDate)}</p>
          <p><span className="text-gray-500">Expiration:</span> {fmtDate(detail.expirationDate)}</p>
          <p><span className="text-gray-500">Rent Commencement:</span> {fmtDate(detail.rentCommencementDate)}</p>
          <p><span className="text-gray-500">FY End Month:</span> {detail.fiscalYearEndMonth}</p>
          <p><span className="text-gray-500">Security Deposit:</span> {fmt$(detail.securityDeposit)}</p>
          <p><span className="text-gray-500">Terms:</span> {detail.terms?.length || 0}</p>
        </div>
        {detail.notes && (
          <p className="text-sm text-gray-600 mt-2 pt-2 border-t">{detail.notes}</p>
        )}
      </div>
    </div>
  );
}

// ─── TAB 2: Terms & Options ──────────────────────────────────────────────────

function TermsTab({ detail, mutations }: { detail: any; mutations: any }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    termIndex: (detail.terms?.length || 0),
    startDate: "",
    endDate: "",
    baseRentMode: "PER_SF_YEAR" as BaseRentMode,
    baseRentValue: "",
    escalationType: "NONE" as EscalationType,
    escalationValue: "0",
    escalationCycleMonths: 12,
  });

  const handleAdd = async () => {
    await mutations.createTerm(detail.id, form);
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-900">Terms & Options ({detail.terms?.length || 0})</h3>
        <button onClick={() => setShowForm(!showForm)} className="text-sm text-blue-600 hover:text-blue-800">
          {showForm ? "Cancel" : "+ Add Term"}
        </button>
      </div>
      {showForm && (
        <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Term Index</label>
              <input type="number" value={form.termIndex} onChange={(e) => setForm({ ...form, termIndex: Number(e.target.value) })} className="w-full px-2 py-1.5 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rent Mode</label>
              <select value={form.baseRentMode} onChange={(e) => setForm({ ...form, baseRentMode: e.target.value as BaseRentMode })} className="w-full px-2 py-1.5 border rounded text-sm">
                <option value="PER_SF_YEAR">$/SF/Year</option>
                <option value="PER_MONTH">$/Month</option>
                <option value="PER_YEAR">$/Year</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rent Value</label>
              <input type="number" step="0.01" value={form.baseRentValue} onChange={(e) => setForm({ ...form, baseRentValue: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Escalation Type</label>
              <select value={form.escalationType} onChange={(e) => setForm({ ...form, escalationType: e.target.value as EscalationType })} className="w-full px-2 py-1.5 border rounded text-sm">
                <option value="NONE">None</option>
                <option value="PERCENT">Percent</option>
                <option value="FIXED_DOLLAR">Fixed Dollar</option>
                <option value="FIXED_PER_SF">Fixed $/SF</option>
                <option value="CPI">CPI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Esc. Value</label>
              <input type="number" step="0.001" value={form.escalationValue} onChange={(e) => setForm({ ...form, escalationValue: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Esc. Cycle (mo)</label>
              <input type="number" value={form.escalationCycleMonths} onChange={(e) => setForm({ ...form, escalationCycleMonths: Number(e.target.value) })} className="w-full px-2 py-1.5 border rounded text-sm" />
            </div>
          </div>
          <button onClick={handleAdd} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">Save Term</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Start</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">End</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Mode</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Rate</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Escalation</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Esc. Value</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Cycle</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(detail.terms || []).map((t: LeaseTerm) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-medium">{t.termIndex === 0 ? "Initial" : `Opt ${t.termIndex}`}</td>
                <td className="px-3 py-2">{fmtDate(t.startDate)}</td>
                <td className="px-3 py-2">{fmtDate(t.endDate)}</td>
                <td className="px-3 py-2">{t.baseRentMode}</td>
                <td className="px-3 py-2 text-right">{fmt$(t.baseRentValue)}</td>
                <td className="px-3 py-2">{t.escalationType}</td>
                <td className="px-3 py-2 text-right">{t.escalationType === "PERCENT" ? `${(parseFloat(t.escalationValue) * 100).toFixed(1)}%` : t.escalationValue}</td>
                <td className="px-3 py-2 text-right">{t.escalationCycleMonths}mo</td>
                <td className="px-3 py-2">
                  <button onClick={() => mutations.deleteTerm(detail.id, t.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB 3: Charges ──────────────────────────────────────────────────────────

function ChargesTab({ detail, mutations }: { detail: any; mutations: any }) {
  const chargeLines: LeaseChargeLine[] = detail.chargeLines || [];
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-900">Charge Lines ({chargeLines.length})</h3>
        <p className="text-xs text-gray-500">CAM/NNN/Misc/Discounts/TI Amortization</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Mode</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Start</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">End</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {chargeLines.map((cl) => (
              <tr key={cl.id}>
                <td className="px-3 py-2 font-medium">{cl.lineName}</td>
                <td className="px-3 py-2">{cl.lineType}</td>
                <td className="px-3 py-2">{cl.amountMode}</td>
                <td className="px-3 py-2 text-right">{fmt$(cl.amountValue)}</td>
                <td className="px-3 py-2">{fmtDate(cl.startDate)}</td>
                <td className="px-3 py-2">{fmtDate(cl.endDate)}</td>
                <td className="px-3 py-2">
                  <button onClick={() => mutations.deleteChargeLine(detail.id, cl.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {!chargeLines.length && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-400">No charge lines configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB 4: Abatements ──────────────────────────────────────────────────────

function AbatementsTab({ detail, mutations }: { detail: any; mutations: any }) {
  const abatements: LeaseAbatement[] = detail.abatements || [];
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900">Abatements ({abatements.length})</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Start</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">End</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Value</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Applies To</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {abatements.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-2">{a.abatementType}</td>
                <td className="px-3 py-2">{fmtDate(a.startDate)}</td>
                <td className="px-3 py-2">{fmtDate(a.endDate)}</td>
                <td className="px-3 py-2 text-right">{a.abatementType === "PERCENT_DISCOUNT" ? `${(parseFloat(a.value) * 100).toFixed(0)}%` : fmt$(a.value)}</td>
                <td className="px-3 py-2">{a.appliesTo}</td>
                <td className="px-3 py-2">
                  <button onClick={() => mutations.deleteAbatement(detail.id, a.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {!abatements.length && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">No abatements configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB 5: Sales & % Rent ──────────────────────────────────────────────────

function SalesTab({ detail, mutations }: { detail: any; mutations: any }) {
  const rules: LeasePercentRentRule[] = detail.percentRentRules || [];
  const sales = detail.sales || [];
  const rule = rules[0];

  return (
    <div className="space-y-6">
      {/* Percent Rent Config */}
      <div className="bg-white border rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-gray-900">Percentage Rent Configuration</h3>
        {rule ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Timing</p>
              <p className="font-medium">{rule.timing}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Breakpoint Type</p>
              <p className="font-medium">{rule.breakpointType}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Breakpoint Amount</p>
              <p className="font-medium">{rule.breakpointType === "ARTIFICIAL" ? fmt$(rule.artificialBreakpointAmount) : "Natural"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Year Basis</p>
              <p className="font-medium">{rule.trueupYearBasis} (FY end: month {detail.fiscalYearEndMonth})</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Tiers</p>
              <div className="space-y-1 mt-1">
                {(rule.tiersJson as any[]).map((tier: any, i: number) => (
                  <p key={i} className="font-medium">
                    Above {fmt$(tier.threshold)}: {(tier.rate * 100).toFixed(1)}%
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No percent rent rules configured.</p>
        )}
      </div>

      {/* Sales Data */}
      <div>
        <h3 className="font-medium text-gray-900 mb-2">Monthly Sales ({sales.length} entries)</h3>
        <div className="max-h-[300px] overflow-y-auto border rounded-lg">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Month End</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Sales Amount</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sales.slice(0, 60).map((s: any) => (
                <tr key={s.id}>
                  <td className="px-3 py-1.5">{fmtDate(s.monthEnd)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmt$(s.salesAmount)}</td>
                  <td className="px-3 py-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${s.source === "ACTUAL" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {s.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 6: TI Program ──────────────────────────────────────────────────────

function TiTab({ detail, mutations }: { detail: any; mutations: any }) {
  const programs: LeaseTiProgram[] = detail.tiPrograms || [];
  const prog = programs[0];
  const draws: LeaseTiDraw[] = prog ? ((prog as any).draws || []) : [];

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-3">TI Program</h3>
        {prog ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><p className="text-xs text-gray-500">Allowance Mode</p><p className="font-medium">{prog.allowanceMode}</p></div>
            <div><p className="text-xs text-gray-500">Allowance Value</p><p className="font-medium">{prog.allowanceMode === "PER_SF" ? `$${prog.allowanceValue}/SF` : fmt$(prog.allowanceValue)}</p></div>
            <div><p className="text-xs text-gray-500">Landlord Cap</p><p className="font-medium">{prog.landlordCapTotal ? fmt$(prog.landlordCapTotal) : "None"}</p></div>
            <div><p className="text-xs text-gray-500">Tenant Participation</p><p className="font-medium">{prog.tenantParticipationMode}</p></div>
            <div><p className="text-xs text-gray-500">Amortization</p><p className="font-medium">{prog.amortizeEnabled ? `${prog.amortizeTermMonths}mo @ ${((parseFloat(prog.amortizeRateAnnual || "0")) * 100).toFixed(1)}%` : "Disabled"}</p></div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No TI program configured.</p>
        )}
      </div>
      <div>
        <h3 className="font-medium text-gray-900 mb-2">TI Draws ({draws.length})</h3>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Draw Date</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {draws.map((d: any) => (
                <tr key={d.id}>
                  <td className="px-3 py-2">{fmtDate(d.drawDate)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt$(d.amount)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => mutations.deleteTiDraw(detail.id, d.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {!draws.length && <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400">No TI draws.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 7: Recoveries / Stops ──────────────────────────────────────────────

function RecoveriesTab({ detail, mutations }: { detail: any; mutations: any }) {
  const models: (LeaseRecoveryModel & { categories: LeaseRecoveryCategoryRow[] })[] = detail.recoveryModels || [];
  const model = models[0];

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-3">Recovery Model</h3>
        {model ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><p className="text-xs text-gray-500">Property NRA</p><p className="font-medium">{parseFloat(model.totalPropertyNraSf || "0").toLocaleString()} SF</p></div>
            <div><p className="text-xs text-gray-500">Tenant Share</p><p className="font-medium">{model.tenantShareMode === "BY_SF" ? "By SF" : `${((parseFloat(model.tenantSharePercent || "0")) * 100).toFixed(1)}%`}</p></div>
            <div><p className="text-xs text-gray-500">Base Year</p><p className="font-medium">{model.baseYear || "N/A"}</p></div>
            <div><p className="text-xs text-gray-500">Billing Timing</p><p className="font-medium">{model.billingTiming}</p></div>
            <div><p className="text-xs text-gray-500">Gross-Up</p><p className="font-medium">{model.grossupEnabled ? `${((parseFloat(model.grossupOccupancyThreshold || "0")) * 100).toFixed(0)}% occupancy` : "Disabled"}</p></div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No recovery model configured.</p>
        )}
      </div>
      {model && (
        <div>
          <h3 className="font-medium text-gray-900 mb-2">Recovery Categories</h3>
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Category</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Stop Type</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Base Year Total</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Stop $/SF</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Growth Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(model.categories || []).map((cat) => (
                  <tr key={cat.id}>
                    <td className="px-3 py-2 font-medium">{cat.category}</td>
                    <td className="px-3 py-2">{cat.stopType}</td>
                    <td className="px-3 py-2 text-right">{fmt$(cat.baseYearAmountTotal)}</td>
                    <td className="px-3 py-2 text-right">{cat.expenseStopPerSf ? `$${cat.expenseStopPerSf}` : "—"}</td>
                    <td className="px-3 py-2 text-right">{cat.annualGrowthRate ? `${(parseFloat(cat.annualGrowthRate) * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB 8: Monthly Schedule ─────────────────────────────────────────────────

function ScheduleTab({ leaseId, cashflows, loading }: { leaseId: string; cashflows: LeaseMonthlyCashflow[]; loading: boolean }) {
  const handleExportCSV = () => {
    window.open(`/api/leases/${leaseId}/cashflows/export-csv`, "_blank");
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading schedule...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-900">Monthly Cashflow Schedule ({cashflows.length} months)</h3>
        <button onClick={handleExportCSV} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>
      <div className="overflow-auto max-h-[500px] border rounded-lg">
        <table className="min-w-full text-xs divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-50 z-10">Month</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500">Base Rent</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500">CAM</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500">Tax</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500">Insurance</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500">Utilities</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500">Misc</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500">Discounts</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500">% Rent</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500">TI CapEx</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500">TI Amort</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500 bg-blue-50">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cashflows.map((cf) => (
              <tr key={cf.monthEnd} className="hover:bg-blue-50/50">
                <td className="px-2 py-1.5 font-mono sticky left-0 bg-white">{cf.monthEnd}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmt$(cf.baseRent)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmt$(cf.recoveriesCam)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmt$(cf.recoveriesTax)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmt$(cf.recoveriesInsurance)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmt$(cf.recoveriesUtilities)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{fmt$(cf.miscIncome)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-red-600">{fmt$(cf.discounts)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-purple-600">{parseFloat(cf.percentRent) > 0 ? fmt$(cf.percentRent) : "—"}</td>
                <td className="px-2 py-1.5 text-right font-mono text-orange-600">{parseFloat(cf.tiLandlordCapex) > 0 ? fmt$(cf.tiLandlordCapex) : "—"}</td>
                <td className="px-2 py-1.5 text-right font-mono">{parseFloat(cf.tiAmortizationCharge) > 0 ? fmt$(cf.tiAmortizationCharge) : "—"}</td>
                <td className="px-2 py-1.5 text-right font-mono font-semibold bg-blue-50">{fmt$(cf.totalRent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
