/**
 * Breakdown Display Components for Exit Scenario Results
 * 
 * Three cards that render the detailed breakdown data from the exit-scenario-engine:
 * 1. ClosingCostsBreakdownCard - Itemized selling costs waterfall
 * 2. GainBreakdownCard - Capital gain vs depreciation recapture decomposition
 * 3. TaxDeferredBreakdownCard - Tax savings breakdown by category (1031 only)
 * 
 * Plus a composed ExchangeBreakdownPanel that renders all three together.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DollarSign,
  TrendingDown,
  ShieldCheck,
  PieChart,
  Building,
  Info,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import type {
  ClosingCostsBreakdown,
  GainBreakdown,
  TaxDeferredBreakdown,
} from "@shared/exit/exit-scenario-engine";

// ============================================================================
// Shared Helpers
// ============================================================================

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/** A single waterfall row: label on left, value on right */
function WaterfallRow({
  label,
  value,
  variant = 'default',
  indent = false,
  bold = false,
  tooltip,
  testId,
}: {
  label: string;
  value: number;
  variant?: 'default' | 'deduction' | 'addition' | 'subtotal' | 'total';
  indent?: boolean;
  bold?: boolean;
  tooltip?: string;
  testId?: string;
}) {
  const colorClass =
    variant === 'deduction' ? 'text-red-500' :
    variant === 'addition' ? 'text-green-600' :
    variant === 'total' ? 'text-foreground' :
    variant === 'subtotal' ? 'text-foreground' :
    'text-muted-foreground';

  const prefix =
    variant === 'deduction' ? '−' :
    variant === 'addition' ? '+' :
    '';

  const fontClass =
    variant === 'total' ? 'text-lg font-bold' :
    variant === 'subtotal' || bold ? 'font-semibold' :
    'font-medium';

  const labelFontClass =
    variant === 'total' ? 'font-semibold' :
    variant === 'subtotal' || bold ? 'font-medium' :
    'text-muted-foreground';

  return (
    <div className={`flex justify-between items-center ${indent ? 'pl-4' : ''}`}>
      <span className={`${indent ? 'text-sm' : ''} ${labelFontClass} flex items-center gap-1.5`}>
        {label}
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
      <span className={`${fontClass} ${colorClass} tabular-nums`} data-testid={testId}>
        {prefix}{fmt(Math.abs(value))}
      </span>
    </div>
  );
}

/** Horizontal stacked bar for gain decomposition */
function GainBar({
  recapture,
  capitalGain,
  section1245,
  total,
}: {
  recapture: number;
  capitalGain: number;
  section1245: number;
  total: number;
}) {
  if (total <= 0) return null;
  const recapturePct = (recapture / total) * 100;
  const capitalGainPct = (capitalGain / total) * 100;
  const s1245Pct = (section1245 / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden border">
        {recapturePct > 0 && (
          <div
            className="bg-amber-500 transition-all duration-500"
            style={{ width: `${recapturePct}%` }}
            title={`§1250 Recapture: ${fmt(recapture)} (${recapturePct.toFixed(1)}%)`}
          />
        )}
        {s1245Pct > 0 && (
          <div
            className="bg-orange-600 transition-all duration-500"
            style={{ width: `${s1245Pct}%` }}
            title={`§1245 Recapture: ${fmt(section1245)} (${s1245Pct.toFixed(1)}%)`}
          />
        )}
        {capitalGainPct > 0 && (
          <div
            className="bg-blue-500 transition-all duration-500"
            style={{ width: `${capitalGainPct}%` }}
            title={`Capital Gain: ${fmt(capitalGain)} (${capitalGainPct.toFixed(1)}%)`}
          />
        )}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        {recapturePct > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            <span>§1250 Recapture ({recapturePct.toFixed(0)}%)</span>
          </div>
        )}
        {s1245Pct > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-orange-600" />
            <span>§1245 ({s1245Pct.toFixed(0)}%)</span>
          </div>
        )}
        {capitalGainPct > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
            <span>Capital Gain ({capitalGainPct.toFixed(0)}%)</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Horizontal stacked bar for tax savings decomposition */
function TaxSavingsBar({
  recapture,
  capitalGains,
  state,
  niit,
  total,
}: {
  recapture: number;
  capitalGains: number;
  state: number;
  niit: number;
  total: number;
}) {
  if (total <= 0) return null;
  const segments = [
    { value: recapture, label: 'Recapture', color: 'bg-amber-500' },
    { value: capitalGains, label: 'Fed LTCG', color: 'bg-blue-500' },
    { value: state, label: 'State', color: 'bg-emerald-500' },
    { value: niit, label: 'NIIT', color: 'bg-purple-500' },
  ].filter(s => s.value > 0);

  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden border">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all duration-500`}
            style={{ width: `${(seg.value / total) * 100}%` }}
            title={`${seg.label}: ${fmt(seg.value)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${seg.color}`} />
            <span>{seg.label} ({((seg.value / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 1. Closing Costs Breakdown Card
// ============================================================================

interface ClosingCostsBreakdownCardProps {
  data: ClosingCostsBreakdown;
  grossSalePrice: number;
}

export function ClosingCostsBreakdownCard({ data, grossSalePrice }: ClosingCostsBreakdownCardProps) {
  const costRatio = grossSalePrice > 0 ? data.totalClosingCosts / grossSalePrice : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          Closing Costs Breakdown
        </CardTitle>
        <CardDescription>
          Itemized selling costs — {pct(costRatio)} of gross sale price
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <WaterfallRow
          label="Broker Commission"
          value={data.brokerCommission}
          variant="deduction"
          testId="cc-broker"
          tooltip={`${pct(data.brokerCommissionRate)} of ${fmt(grossSalePrice)}`}
        />
        <WaterfallRow label="Title & Escrow" value={data.titleAndEscrow} variant="deduction" indent testId="cc-title" />
        <WaterfallRow label="Transfer Tax" value={data.transferTax} variant="deduction" indent testId="cc-transfer" />
        <WaterfallRow label="Doc Stamps" value={data.docStamps} variant="deduction" indent testId="cc-doc-stamps" />
        <WaterfallRow label="Recording Fees" value={data.recordingFees} variant="deduction" indent testId="cc-recording" />
        <WaterfallRow label="Legal Fees" value={data.legalFees} variant="deduction" indent testId="cc-legal" />
        {data.otherClosingCosts > 0 && (
          <WaterfallRow label="Other" value={data.otherClosingCosts} variant="deduction" indent testId="cc-other" />
        )}
        <Separator />
        <WaterfallRow label="Total Closing Costs" value={data.totalClosingCosts} variant="total" testId="cc-total" />

        {data.lineItems.length > 0 && data.lineItems.some(li => li.category !== 'broker') && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground italic mb-1">
              Non-broker costs are estimated from lump sum using typical commercial allocations.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 2. Gain Breakdown Card
// ============================================================================

interface GainBreakdownCardProps {
  data: GainBreakdown;
}

export function GainBreakdownCard({ data }: GainBreakdownCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PieChart className="h-5 w-5 text-muted-foreground" />
          Gain Decomposition
        </CardTitle>
        <CardDescription>
          Realized gain split by tax treatment —{' '}
          <Badge variant="outline" className="text-xs ml-1">
            {data.isLongTerm ? 'Long-Term' : 'Short-Term'}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Waterfall: sale → net → gain */}
        <div className="space-y-2">
          <WaterfallRow label="Gross Sale Price" value={data.grossSalePrice} variant="default" testId="gb-gross" />
          <WaterfallRow label="Less: Closing Costs" value={data.totalClosingCosts} variant="deduction" indent testId="gb-costs" />
          <Separator />
          <WaterfallRow label="Net Sale Proceeds" value={data.netSaleProceeds} variant="subtotal" testId="gb-net" />
          <WaterfallRow label="Less: Adjusted Basis" value={data.adjustedBasis} variant="deduction" indent testId="gb-basis" />
          <Separator />
          <WaterfallRow label="Total Realized Gain" value={data.totalRealizedGain} variant="total" testId="gb-total-gain" />
        </div>

        <Separator />

        {/* Gain decomposition bar */}
        <GainBar
          recapture={data.depreciationRecapture}
          capitalGain={data.capitalGain}
          section1245={data.section1245Recapture}
          total={data.totalRealizedGain}
        />

        {/* Decomposition detail */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
              §1250 Depreciation Recapture
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">Taxed at max {pct(data.depreciationRecaptureRate)} federal rate for unrecaptured §1250 gain on real property</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <span className="font-medium tabular-nums text-amber-600" data-testid="gb-recapture">
              {fmt(data.depreciationRecapture)}
            </span>
          </div>

          {data.section1245Recapture > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-orange-600" />
                §1245 Recapture (Personal Property)
              </span>
              <span className="font-medium tabular-nums text-orange-600" data-testid="gb-s1245">
                {fmt(data.section1245Recapture)}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              {data.isLongTerm ? 'Long-Term' : 'Short-Term'} Capital Gain
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      {data.isLongTerm
                        ? `Taxed at preferential LTCG rate (max ${pct(data.capitalGainRate)})`
                        : 'Taxed at ordinary income rates (holding period < 12 months)'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <span className="font-medium tabular-nums text-blue-600" data-testid="gb-capital-gain">
              {fmt(data.capitalGain)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 3. Tax Deferred Breakdown Card (1031 only)
// ============================================================================

interface TaxDeferredBreakdownCardProps {
  data: TaxDeferredBreakdown;
  deferredGain: number;
  isFullyDeferred: boolean;
}

export function TaxDeferredBreakdownCard({ data, deferredGain, isFullyDeferred }: TaxDeferredBreakdownCardProps) {
  return (
    <Card className={isFullyDeferred ? 'border-green-500/30' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Tax Deferred via 1031 Exchange
          </CardTitle>
          {isFullyDeferred && (
            <Badge className="bg-green-500/10 text-green-700 border-green-500/30 hover:bg-green-500/20">
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Full Deferral
            </Badge>
          )}
        </div>
        <CardDescription>
          Taxes avoided by deferring {fmt(deferredGain)} in realized gain
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tax savings bar */}
        <TaxSavingsBar
          recapture={data.recaptureTaxAvoided}
          capitalGains={data.capitalGainsTaxAvoided}
          state={data.stateTaxAvoided}
          niit={data.niitAvoided}
          total={data.totalTaxDeferred}
        />

        {/* Itemized tax savings */}
        <div className="space-y-2">
          <WaterfallRow
            label="Federal Recapture Tax Avoided"
            value={data.recaptureTaxAvoided}
            variant="addition"
            testId="td-recapture"
            tooltip="25% max rate on unrecaptured §1250 gain"
          />
          <WaterfallRow
            label="Federal LTCG Tax Avoided"
            value={data.capitalGainsTaxAvoided}
            variant="addition"
            testId="td-ltcg"
            tooltip="15% or 20% long-term capital gains rate"
          />
          {data.stateTaxAvoided > 0 && (
            <WaterfallRow
              label="State Tax Avoided"
              value={data.stateTaxAvoided}
              variant="addition"
              testId="td-state"
            />
          )}
          {data.niitAvoided > 0 && (
            <WaterfallRow
              label="NIIT Avoided"
              value={data.niitAvoided}
              variant="addition"
              testId="td-niit"
              tooltip="3.8% Net Investment Income Tax"
            />
          )}
          <Separator />
          <WaterfallRow
            label="Total Tax Deferred"
            value={data.totalTaxDeferred}
            variant="total"
            testId="td-total"
          />
        </div>

        <Separator />

        {/* Carryover basis section */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Building className="h-4 w-4 text-muted-foreground" />
            Replacement Property Basis
          </h4>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">New Carryover Basis</span>
            <span className="font-semibold tabular-nums" data-testid="td-new-basis">
              {fmt(data.newCarryoverBasis)}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              Embedded Deferred Gain
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      This gain will be recognized when the replacement property is eventually sold
                      (unless deferred again via another 1031 exchange or eliminated at death via stepped-up basis).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
            <span className="font-semibold tabular-nums text-amber-600" data-testid="td-embedded">
              {fmt(data.embeddedGain)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 4. Composed Panel: All Breakdowns Together
// ============================================================================

interface ExchangeBreakdownPanelProps {
  closingCosts: ClosingCostsBreakdown;
  gainBreakdown: GainBreakdown;
  taxDeferredBreakdown?: TaxDeferredBreakdown;
  grossSalePrice: number;
  deferredGain: number;
  isFullyDeferred: boolean;
}

/**
 * Renders all three breakdown cards in a responsive grid.
 * Drop this into any page that has an ExitScenarioResult:
 * 
 * ```tsx
 * <ExchangeBreakdownPanel
 *   closingCosts={result.closingCostsBreakdown}
 *   gainBreakdown={result.gainBreakdown}
 *   taxDeferredBreakdown={result.taxDeferredBreakdown}
 *   grossSalePrice={result.grossSaleProceeds}
 *   deferredGain={result.comparisonMetrics.deferredGain}
 *   isFullyDeferred={result.exchange1031Result?.isFullyDeferred ?? false}
 * />
 * ```
 */
export function ExchangeBreakdownPanel({
  closingCosts,
  gainBreakdown,
  taxDeferredBreakdown,
  grossSalePrice,
  deferredGain,
  isFullyDeferred,
}: ExchangeBreakdownPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClosingCostsBreakdownCard data={closingCosts} grossSalePrice={grossSalePrice} />
        <GainBreakdownCard data={gainBreakdown} />
      </div>

      {taxDeferredBreakdown && (
        <TaxDeferredBreakdownCard
          data={taxDeferredBreakdown}
          deferredGain={deferredGain}
          isFullyDeferred={isFullyDeferred}
        />
      )}
    </div>
  );
}
