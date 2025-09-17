import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, PieChart, BarChart3 } from "lucide-react";
import ReportSection from "../ReportSection";
import ReportTwoCol from "../ReportTwoCol";
import KPIStat from "../KPIStat";
import FinancialTable from "../FinancialTable";
import type { OfferingMemorandum } from "@shared/reportSchema";

interface FinancialSummaryProps {
  data: OfferingMemorandum;
  className?: string;
}

export function FinancialSummary({ data, className }: FinancialSummaryProps) {
  const { financial, unitMix, financialAnalysis } = data;
  
  // Calculate additional metrics
  const totalRentableUnits = unitMix.reduce((sum, mix) => sum + mix.count, 0);
  const averageUnitRent = unitMix.reduce((sum, mix) => sum + (mix.avgRent * mix.count), 0) / totalRentableUnits;
  const grossRentMultiplier = financial.askingPrice / (averageUnitRent * totalRentableUnits * 12);
  
  // Key financial metrics
  const financialMetrics = [
    {
      label: "Asking Price",
      value: financial.askingPrice,
      format: "currency" as const,
    },
    {
      label: "Current NOI",
      value: financial.currentNOI,
      format: "currency" as const,
    },
    {
      label: "Pro Forma NOI",
      value: financial.proFormaNOI || 0,
      format: "currency" as const,
    },
    {
      label: "Cap Rate",
      value: financial.capRate,
      format: "percentage" as const,
    },
    {
      label: "Price per SF",
      value: financial.pricePerSqFt,
      format: "currency" as const,
    },
    {
      label: "Price per Unit",
      value: financial.pricePerUnit || 0,
      format: "currency" as const,
    },
  ];

  // Sample financial data for the table
  const financialData = [
    {
      item: "Gross Rental Income",
      current: averageUnitRent * totalRentableUnits * 12 * (financial.occupancy / 100),
      proForma: averageUnitRent * totalRentableUnits * 12 * 0.95,
    },
    {
      item: "Other Income",
      current: financial.currentNOI * 0.05,
      proForma: (financial.proFormaNOI || financial.currentNOI) * 0.05,
    },
    {
      item: "Effective Gross Income",
      current: averageUnitRent * totalRentableUnits * 12 * (financial.occupancy / 100) * 1.05,
      proForma: averageUnitRent * totalRentableUnits * 12 * 0.95 * 1.05,
    },
    {
      item: "Operating Expenses",
      current: (averageUnitRent * totalRentableUnits * 12 * (financial.occupancy / 100) * 1.05) - financial.currentNOI,
      proForma: (averageUnitRent * totalRentableUnits * 12 * 0.95 * 1.05) - (financial.proFormaNOI || financial.currentNOI),
    },
    {
      item: "Net Operating Income",
      current: financial.currentNOI,
      proForma: financial.proFormaNOI || financial.currentNOI,
    },
  ];

  return (
    <ReportSection
      title="Financial Summary"
      index={5}
      className={cn("space-y-8", className)}
      data-testid="financial-summary"
    >
      {/* Key Financial Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {financialMetrics.map((metric) => (
          <KPIStat
            key={metric.label}
            label={metric.label}
            value={metric.value}
            format={metric.format}
            size="md"
          />
        ))}
      </div>

      {/* Financial Analysis */}
      <ReportTwoCol leftWidth="2/3" gap="lg" alignTop>
        <div className="space-y-6">
          {/* Financial Analysis Text */}
          {financialAnalysis && (
            <div className="prose prose-neutral max-w-none">
              <h4 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                Financial Analysis
              </h4>
              {financialAnalysis.split('\n\n').map((paragraph, index) => (
                <p key={index} className="text-base leading-relaxed text-neutral-700">
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {/* Income & Expense Summary Table */}
          <FinancialTable
            data={financialData}
            title="Income & Expense Summary"
            showVariance={true}
            showNotes={false}
          />
        </div>

        {/* Financial Sidebar */}
        <div className="space-y-6">
          {/* Investment Returns */}
          <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
            <h5 className="font-semibold text-emerald-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Investment Returns
            </h5>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-emerald-700">Current Cap Rate:</dt>
                <dd className="font-semibold text-emerald-900 tabular-nums">
                  {financial.capRate.toFixed(2)}%
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-emerald-700">Pro Forma Cap Rate:</dt>
                <dd className="font-semibold text-emerald-900 tabular-nums">
                  {((financial.proFormaNOI || financial.currentNOI) / financial.askingPrice * 100).toFixed(2)}%
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-emerald-700">Gross Rent Multiple:</dt>
                <dd className="font-semibold text-emerald-900 tabular-nums">
                  {grossRentMultiplier.toFixed(1)}x
                </dd>
              </div>
              {financial.grossYield && (
                <div className="flex justify-between">
                  <dt className="text-emerald-700">Gross Yield:</dt>
                  <dd className="font-semibold text-emerald-900 tabular-nums">
                    {financial.grossYield.toFixed(2)}%
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Occupancy & Rent Info */}
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h5 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-600" />
              Occupancy & Rent
            </h5>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-blue-700">Current Occupancy:</dt>
                <dd className="font-semibold text-blue-900 tabular-nums">
                  {financial.occupancy.toFixed(1)}%
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-blue-700">Average Rent:</dt>
                <dd className="font-semibold text-blue-900 tabular-nums">
                  ${financial.averageRent?.toLocaleString() || averageUnitRent.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-blue-700">Rent per SF:</dt>
                <dd className="font-semibold text-blue-900 tabular-nums">
                  ${financial.rentPSF?.toFixed(2) || (averageUnitRent / (data.property.totalSqFt / totalRentableUnits)).toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-blue-700">Total Units:</dt>
                <dd className="font-semibold text-blue-900 tabular-nums">
                  {totalRentableUnits}
                </dd>
              </div>
            </dl>
          </div>

          {/* Unit Mix Breakdown */}
          <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
            <h5 className="font-semibold text-neutral-900 mb-4">Unit Mix by Rent</h5>
            <div className="space-y-3">
              {unitMix.map((mix, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-neutral-600 capitalize">
                    {mix.unitType === "1br" ? "1 Bedroom" : 
                     mix.unitType === "2br" ? "2 Bedroom" :
                     mix.unitType === "3br" ? "3 Bedroom" :
                     mix.unitType.charAt(0).toUpperCase() + mix.unitType.slice(1)}
                  </span>
                  <div className="text-right">
                    <div className="font-semibold text-neutral-900 tabular-nums">
                      ${mix.avgRent.toLocaleString()}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {mix.count} units
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ReportTwoCol>
    </ReportSection>
  );
}

export default FinancialSummary;