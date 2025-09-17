import { cn } from "@/lib/utils";
import ReportSection from "../ReportSection";
import ReportTwoCol from "../ReportTwoCol";
import KPIStat from "../KPIStat";
import type { OfferingMemorandum } from "@shared/reportSchema";

interface ExecutiveSummaryProps {
  data: OfferingMemorandum;
  className?: string;
}

export function ExecutiveSummary({ data, className }: ExecutiveSummaryProps) {
  const keyMetrics = [
    {
      label: "Asking Price",
      value: data.financial.askingPrice,
      format: "currency" as const,
    },
    {
      label: "Price per SF",
      value: data.financial.pricePerSqFt,
      format: "currency" as const,
    },
    {
      label: "Cap Rate",
      value: data.financial.capRate,
      format: "percentage" as const,
    },
    {
      label: "Total Units",
      value: data.property.totalUnits,
      format: "number" as const,
    },
    {
      label: "Total SF",
      value: data.property.totalSqFt,
      format: "number" as const,
    },
    {
      label: "Year Built",
      value: data.property.yearBuilt,
      format: "number" as const,
    },
  ];

  return (
    <ReportSection
      title="Executive Summary"
      index={1}
      className={cn("space-y-8", className)}
      data-testid="executive-summary"
    >
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {keyMetrics.map((metric) => (
          <KPIStat
            key={metric.label}
            label={metric.label}
            value={metric.value}
            format={metric.format}
            size="md"
          />
        ))}
      </div>

      {/* Executive Summary Content */}
      <ReportTwoCol leftWidth="2/3" gap="lg" alignTop>
        <div className="space-y-6">
          {/* Main Summary Text */}
          <div className="prose prose-neutral max-w-none">
            {data.executiveSummary.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-base leading-relaxed text-neutral-700">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Quick Facts Sidebar */}
        <div className="space-y-6">
          <div className="bg-neutral-50 rounded-lg p-6">
            <h4 className="font-semibold text-neutral-900 mb-4">Property Quick Facts</h4>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-600">Property Type:</dt>
                <dd className="font-medium text-neutral-900 capitalize">
                  {data.property.propertyType.replace('_', ' ')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">Stories:</dt>
                <dd className="font-medium text-neutral-900">{data.property.stories}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">Parking:</dt>
                <dd className="font-medium text-neutral-900">
                  {data.property.parkingSpaces || 'N/A'} spaces
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">Lot Size:</dt>
                <dd className="font-medium text-neutral-900">
                  {data.property.lotSize.toFixed(2)} acres
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">Occupancy:</dt>
                <dd className="font-medium text-neutral-900">
                  {data.financial.occupancy.toFixed(1)}%
                </dd>
              </div>
            </dl>
          </div>

          {/* Investment Highlights Preview */}
          <div className="bg-emerald-50 rounded-lg p-6">
            <h4 className="font-semibold text-emerald-900 mb-4">Investment Highlights</h4>
            <ul className="space-y-2 text-sm">
              {data.investmentHighlights.slice(0, 3).map((highlight, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-emerald-800">{highlight.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ReportTwoCol>
    </ReportSection>
  );
}

export default ExecutiveSummary;