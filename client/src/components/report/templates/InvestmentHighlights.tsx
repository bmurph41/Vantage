import { cn } from "@/lib/utils";
import { MapPin, Building, TrendingUp, Users, Star, Bus, DollarSign, Shield } from "lucide-react";
import ReportSection from "../ReportSection";
import ReportThreeCol from "../ReportThreeCol";
import type { OfferingMemorandum } from "@shared/reportSchema";

interface InvestmentHighlightsProps {
  data: OfferingMemorandum;
  className?: string;
}

// Icon mapping for investment highlights
const iconMap = {
  "map-pin": MapPin,
  "building": Building,
  "trending-up": TrendingUp,
  "users": Users,
  "star": Star,
  "bus": Bus,
  "dollar-sign": DollarSign,
  "shield": Shield,
};

export function InvestmentHighlights({ data, className }: InvestmentHighlightsProps) {
  // Sort highlights by priority
  const sortedHighlights = [...data.investmentHighlights].sort((a, b) => a.priority - b.priority);

  return (
    <ReportSection
      title="Investment Highlights"
      index={2}
      className={cn("space-y-8", className)}
      data-testid="investment-highlights"
    >
      <ReportThreeCol gap="lg" responsive alignTop>
        {sortedHighlights.map((highlight, index) => {
          const IconComponent = highlight.icon && iconMap[highlight.icon as keyof typeof iconMap] 
            ? iconMap[highlight.icon as keyof typeof iconMap] 
            : Star;

          return (
            <div
              key={index}
              className={cn(
                "group relative bg-white border border-neutral-200 rounded-lg p-6",
                "hover:border-emerald-300 hover:shadow-md transition-all duration-200",
                "no-break" // Prevent page breaks within highlights
              )}
              data-testid={`investment-highlight-${index}`}
            >
              {/* Priority Indicator */}
              <div className="absolute top-4 right-4">
                <span className="text-xs font-medium text-neutral-400 bg-neutral-100 px-2 py-1 rounded">
                  #{highlight.priority}
                </span>
              </div>

              {/* Icon */}
              <div className="mb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <IconComponent className="w-6 h-6 text-emerald-600" />
                </div>
              </div>

              {/* Content */}
              <div className="space-y-3">
                <h4 className="font-semibold text-lg text-neutral-900 leading-tight">
                  {highlight.title}
                </h4>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  {highlight.description}
                </p>
              </div>

              {/* Visual Enhancement */}
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          );
        })}
      </ReportThreeCol>

      {/* Summary Stats */}
      <div className="mt-8 p-6 bg-neutral-50 rounded-lg border border-neutral-200">
        <h4 className="font-semibold text-neutral-900 mb-4 text-center">
          Why This Investment Stands Out
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-emerald-600 mb-1">
              {data.property.yearBuilt}
            </div>
            <div className="text-sm text-neutral-600">Construction Year</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 mb-1">
              {data.financial.capRate.toFixed(2)}%
            </div>
            <div className="text-sm text-neutral-600">Market Cap Rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 mb-1">
              {data.financial.occupancy.toFixed(1)}%
            </div>
            <div className="text-sm text-neutral-600">Current Occupancy</div>
          </div>
        </div>
      </div>
    </ReportSection>
  );
}

export default InvestmentHighlights;