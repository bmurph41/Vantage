import { cn } from "@/lib/utils";
import { MapPin, TrendingUp, Users, GraduationCap, Bus, DollarSign } from "lucide-react";
import ReportSection from "../ReportSection";
import ReportTwoCol from "../ReportTwoCol";
import KPIStat from "../KPIStat";
import type { OfferingMemorandum } from "@shared/reportSchema";

interface LocationMarketProps {
  data: OfferingMemorandum;
  className?: string;
}

export function LocationMarket({ data, className }: LocationMarketProps) {
  const { locationMarket, marketOverview } = data;
  
  // Prepare market metrics
  const marketMetrics = [
    {
      label: "Walk Score",
      value: locationMarket.walkScore || 0,
      format: "number" as const,
      unit: "/100",
    },
    {
      label: "Transit Score", 
      value: locationMarket.transitScore || 0,
      format: "number" as const,
      unit: "/100",
    },
    {
      label: "School Rating",
      value: locationMarket.schoolRating || 0,
      format: "number" as const,
      unit: "/10",
    },
    {
      label: "Median HH Income",
      value: locationMarket.medianHouseholdIncome || 0,
      format: "currency" as const,
    },
    {
      label: "Population Growth",
      value: locationMarket.populationGrowth || 0,
      format: "percentage" as const,
    },
    {
      label: "Unemployment Rate",
      value: locationMarket.unemploymentRate || 0,
      format: "percentage" as const,
    },
  ];

  return (
    <ReportSection
      title="Location & Market Analysis"
      index={4}
      className={cn("space-y-8", className)}
      data-testid="location-market"
    >
      {/* Market Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {marketMetrics.map((metric) => (
          <KPIStat
            key={metric.label}
            label={metric.label}
            value={metric.value}
            unit={metric.unit}
            format={metric.format}
            size="md"
          />
        ))}
      </div>

      {/* Location Overview */}
      <ReportTwoCol leftWidth="2/3" gap="lg" alignTop>
        <div className="space-y-6">
          {/* Market Overview Text */}
          {marketOverview && (
            <div className="prose prose-neutral max-w-none">
              <h4 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Market Overview
              </h4>
              {marketOverview.split('\n\n').map((paragraph, index) => (
                <p key={index} className="text-base leading-relaxed text-neutral-700">
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {/* Neighborhood Features */}
          <div>
            <h4 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              Neighborhood Profile
            </h4>
            <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
              <dl className="grid grid-cols-1 gap-4">
                <div>
                  <dt className="text-sm font-medium text-neutral-600 mb-1">Neighborhood:</dt>
                  <dd className="text-neutral-900 font-semibold">{locationMarket.neighborhood}</dd>
                </div>
                
                {locationMarket.walkScore && (
                  <div>
                    <dt className="text-sm font-medium text-neutral-600 mb-1">Walkability:</dt>
                    <dd className="text-neutral-900">
                      <span className="font-semibold">{locationMarket.walkScore}/100</span>
                      <span className="ml-2 text-sm text-neutral-600">
                        ({locationMarket.walkScore >= 90 ? "Walker's Paradise" :
                          locationMarket.walkScore >= 70 ? "Very Walkable" :
                          locationMarket.walkScore >= 50 ? "Somewhat Walkable" : "Car-Dependent"})
                      </span>
                    </dd>
                  </div>
                )}
                
                {locationMarket.transitScore && (
                  <div>
                    <dt className="text-sm font-medium text-neutral-600 mb-1">Transit Access:</dt>
                    <dd className="text-neutral-900">
                      <span className="font-semibold">{locationMarket.transitScore}/100</span>
                      <span className="ml-2 text-sm text-neutral-600">
                        ({locationMarket.transitScore >= 90 ? "Excellent Transit" :
                          locationMarket.transitScore >= 70 ? "Very Good Transit" :
                          locationMarket.transitScore >= 50 ? "Good Transit" : "Limited Transit"})
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* Demographics */}
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h5 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              Demographics
            </h5>
            <dl className="space-y-3 text-sm">
              {locationMarket.medianHouseholdIncome && (
                <div className="flex justify-between">
                  <dt className="text-blue-700">Median HH Income:</dt>
                  <dd className="font-semibold text-blue-900 tabular-nums">
                    ${locationMarket.medianHouseholdIncome.toLocaleString()}
                  </dd>
                </div>
              )}
              {locationMarket.populationGrowth && (
                <div className="flex justify-between">
                  <dt className="text-blue-700">Population Growth:</dt>
                  <dd className="font-semibold text-blue-900 tabular-nums">
                    {locationMarket.populationGrowth > 0 ? '+' : ''}{locationMarket.populationGrowth.toFixed(1)}%
                  </dd>
                </div>
              )}
              {locationMarket.unemploymentRate && (
                <div className="flex justify-between">
                  <dt className="text-blue-700">Unemployment:</dt>
                  <dd className="font-semibold text-blue-900 tabular-nums">
                    {locationMarket.unemploymentRate.toFixed(1)}%
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Major Employers */}
          {locationMarket.majorEmployers && locationMarket.majorEmployers.length > 0 && (
            <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
              <h5 className="font-semibold text-emerald-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Major Employers
              </h5>
              <ul className="space-y-2 text-sm">
                {locationMarket.majorEmployers.slice(0, 6).map((employer, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />
                    <span className="text-emerald-800">{employer}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transportation */}
          {locationMarket.publicTransportation && locationMarket.publicTransportation.length > 0 && (
            <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
              <h5 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Bus className="w-4 h-4 text-neutral-600" />
                Public Transportation
              </h5>
              <ul className="space-y-2 text-sm">
                {locationMarket.publicTransportation.map((transport, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full flex-shrink-0" />
                    <span className="text-neutral-700">{transport}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ReportTwoCol>

      {/* Nearby Amenities */}
      {locationMarket.nearbyAmenities && locationMarket.nearbyAmenities.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            Nearby Amenities
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {locationMarket.nearbyAmenities.map((amenity, index) => (
              <div
                key={index}
                className="bg-white border border-neutral-200 rounded-lg p-4 text-center"
              >
                <div className="text-sm font-medium text-neutral-900">{amenity}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ReportSection>
  );
}

export default LocationMarket;