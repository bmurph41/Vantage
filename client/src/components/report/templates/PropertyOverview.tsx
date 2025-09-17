import { cn } from "@/lib/utils";
import { Building, MapPin, Calendar, Home, Car, Navigation } from "lucide-react";
import ReportSection from "../ReportSection";
import ReportTwoCol from "../ReportTwoCol";
import Figure from "../Figure";
import type { OfferingMemorandum } from "@shared/reportSchema";

interface PropertyOverviewProps {
  data: OfferingMemorandum;
  className?: string;
}

export function PropertyOverview({ data, className }: PropertyOverviewProps) {
  const { property, propertyDescription } = data;
  
  // Get property exterior images
  const exteriorImages = data.images.filter(img => img.category === "exterior").slice(0, 2);
  
  // Format address
  const fullAddress = `${property.address.street}, ${property.address.city}, ${property.address.state} ${property.address.zipCode}`;
  
  return (
    <ReportSection
      title="Property Overview"
      index={3}
      className={cn("space-y-8", className)}
      data-testid="property-overview"
    >
      {/* Property Description */}
      <div className="prose prose-neutral max-w-none">
        {propertyDescription.split('\n\n').map((paragraph, index) => (
          <p key={index} className="text-base leading-relaxed text-neutral-700">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Property Details Grid */}
      <ReportTwoCol leftWidth="1/2" gap="lg" alignTop>
        {/* Property Specifications */}
        <div className="space-y-6">
          <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
            <h4 className="font-semibold text-neutral-900 mb-6 flex items-center gap-2">
              <Building className="w-5 h-5 text-emerald-600" />
              Property Specifications
            </h4>
            
            <dl className="grid grid-cols-1 gap-4">
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <dt className="text-neutral-600 font-medium">Property Type:</dt>
                <dd className="text-neutral-900 font-semibold capitalize">
                  {property.propertyType.replace('_', ' ')}
                </dd>
              </div>
              
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <dt className="text-neutral-600 font-medium">Year Built:</dt>
                <dd className="text-neutral-900 font-semibold">{property.yearBuilt}</dd>
              </div>
              
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <dt className="text-neutral-600 font-medium">Total Units:</dt>
                <dd className="text-neutral-900 font-semibold tabular-nums">
                  {property.totalUnits.toLocaleString()}
                </dd>
              </div>
              
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <dt className="text-neutral-600 font-medium">Gross Building Area:</dt>
                <dd className="text-neutral-900 font-semibold tabular-nums">
                  {property.totalSqFt.toLocaleString()} SF
                </dd>
              </div>
              
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <dt className="text-neutral-600 font-medium">Stories:</dt>
                <dd className="text-neutral-900 font-semibold">{property.stories}</dd>
              </div>
              
              <div className="flex justify-between py-2 border-b border-neutral-200">
                <dt className="text-neutral-600 font-medium">Lot Size:</dt>
                <dd className="text-neutral-900 font-semibold">
                  {property.lotSize.toFixed(2)} acres
                </dd>
              </div>
              
              {property.parkingSpaces && (
                <div className="flex justify-between py-2 border-b border-neutral-200">
                  <dt className="text-neutral-600 font-medium">Parking Spaces:</dt>
                  <dd className="text-neutral-900 font-semibold tabular-nums">
                    {property.parkingSpaces}
                  </dd>
                </div>
              )}
              
              {property.elevators && (
                <div className="flex justify-between py-2">
                  <dt className="text-neutral-600 font-medium">Elevators:</dt>
                  <dd className="text-neutral-900 font-semibold">{property.elevators}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Location Information */}
        <div className="space-y-6">
          <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
            <h4 className="font-semibold text-neutral-900 mb-6 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              Location Details
            </h4>
            
            <div className="space-y-4">
              <div>
                <dt className="text-sm text-neutral-600 font-medium mb-1">Property Address:</dt>
                <dd className="text-neutral-900 font-medium">{fullAddress}</dd>
              </div>
              
              {property.address.county && (
                <div>
                  <dt className="text-sm text-neutral-600 font-medium mb-1">County:</dt>
                  <dd className="text-neutral-900">{property.address.county}</dd>
                </div>
              )}
              
              <div>
                <dt className="text-sm text-neutral-600 font-medium mb-1">Neighborhood:</dt>
                <dd className="text-neutral-900">{data.locationMarket.neighborhood}</dd>
              </div>
            </div>
          </div>

          {/* Unit Mix Summary */}
          <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
            <h4 className="font-semibold text-emerald-900 mb-4 flex items-center gap-2">
              <Home className="w-5 h-5 text-emerald-600" />
              Unit Mix Summary
            </h4>
            
            <div className="space-y-3">
              {data.unitMix.map((mix, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-emerald-800 font-medium capitalize">
                    {mix.unitType === "1br" ? "1 Bedroom" : 
                     mix.unitType === "2br" ? "2 Bedroom" :
                     mix.unitType === "3br" ? "3 Bedroom" :
                     mix.unitType.charAt(0).toUpperCase() + mix.unitType.slice(1)}
                  </span>
                  <span className="text-emerald-900 font-semibold tabular-nums">
                    {mix.count} units
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-emerald-200">
              <div className="flex justify-between items-center">
                <span className="text-emerald-800 font-semibold">Total Units:</span>
                <span className="text-emerald-900 font-bold tabular-nums">
                  {data.unitMix.reduce((sum, mix) => sum + mix.count, 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ReportTwoCol>

      {/* Property Images */}
      {exteriorImages.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-semibold text-neutral-900">Property Images</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {exteriorImages.map((image, index) => (
              <Figure
                key={index}
                src={image.url}
                alt={image.caption}
                caption={image.caption}
                aspectRatio="photo"
                size="full"
              />
            ))}
          </div>
        </div>
      )}
    </ReportSection>
  );
}

export default PropertyOverview;