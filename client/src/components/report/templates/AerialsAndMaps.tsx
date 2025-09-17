import { cn } from "@/lib/utils";
import { MapPin, Navigation, Satellite, Map } from "lucide-react";
import ReportSection from "../ReportSection";
import ReportTwoCol from "../ReportTwoCol";
import Figure from "../Figure";
import type { OfferingMemorandum } from "@shared/reportSchema";

interface AerialsAndMapsProps {
  data: OfferingMemorandum;
  className?: string;
}

export function AerialsAndMaps({ data, className }: AerialsAndMapsProps) {
  const { property, locationMarket, images } = data;
  
  // Get aerial and neighborhood images
  const aerialImages = images.filter(img => img.category === "aerial");
  const neighborhoodImages = images.filter(img => img.category === "neighborhood");
  
  // Format address for display
  const fullAddress = `${property.address.street}, ${property.address.city}, ${property.address.state} ${property.address.zipCode}`;
  
  // Generate map placeholder URLs (in production, these would be real map API calls)
  const mapAPIKey = "demo"; // This would be from environment variables
  const mapUrls = {
    satellite: `https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=800&h=600&fit=crop`,
    street: `https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&h=600&fit=crop`,
    hybrid: `https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=600&fit=crop`,
  };
  
  return (
    <ReportSection
      title="Aerials & Maps"
      index={7}
      className={cn("space-y-8", className)}
      data-testid="aerials-maps-section"
    >
      {/* Location Overview */}
      <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
        <div className="flex items-start gap-4">
          <MapPin className="w-6 h-6 text-emerald-600 mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-semibold text-emerald-900 mb-2">
              Property Location Analysis
            </h4>
            <p className="text-emerald-800 text-sm leading-relaxed mb-4">
              The following aerial imagery and maps provide comprehensive visual context 
              for the property's location, surrounding development patterns, and accessibility 
              to key amenities and transportation networks.
            </p>
            <div className="text-sm">
              <strong className="text-emerald-900">Property Address:</strong>{" "}
              <span className="text-emerald-800">{fullAddress}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Aerial Photography */}
      {aerialImages.length > 0 && (
        <div className="space-y-6">
          <div className="border-b border-neutral-200 pb-4">
            <h4 className="font-semibold text-neutral-900 text-lg flex items-center gap-2">
              <Satellite className="w-5 h-5 text-emerald-600" />
              Aerial Photography
            </h4>
            <p className="text-sm text-neutral-600 mt-1">
              High-resolution aerial photographs showing property context and surrounding area
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {aerialImages.map((image, index) => (
              <Figure
                key={`aerial-${index}`}
                src={image.url}
                alt={image.caption}
                caption={image.caption}
                aspectRatio="video"
                size="full"
                data-testid={`aerial-photo-${index}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Maps Section */}
      <div className="space-y-6">
        <div className="border-b border-neutral-200 pb-4">
          <h4 className="font-semibold text-neutral-900 text-lg flex items-center gap-2">
            <Map className="w-5 h-5 text-emerald-600" />
            Location Maps
          </h4>
          <p className="text-sm text-neutral-600 mt-1">
            Detailed mapping showing property location and surrounding context
          </p>
        </div>

        {/* Map Views Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Figure
            src={mapUrls.satellite}
            alt="Satellite view of property location"
            caption="Satellite View - Property location and surrounding development patterns"
            aspectRatio="square"
            size="full"
            data-testid="satellite-map"
          />
          
          <Figure
            src={mapUrls.street}
            alt="Street view map of property area"
            caption="Street Map - Road networks and local transportation access"
            aspectRatio="square"
            size="full"
            data-testid="street-map"
          />
        </div>
      </div>

      {/* Location Context */}
      <ReportTwoCol leftWidth="1/2" gap="lg" alignTop>
        {/* Transportation & Access */}
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h5 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-600" />
              Transportation Access
            </h5>
            
            {locationMarket.publicTransportation && locationMarket.publicTransportation.length > 0 && (
              <div className="mb-4">
                <dt className="text-sm text-blue-700 font-medium mb-2">Public Transportation:</dt>
                <dd className="space-y-1">
                  {locationMarket.publicTransportation.map((transport, index) => (
                    <div key={index} className="text-sm text-blue-800 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                      {transport}
                    </div>
                  ))}
                </dd>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              {locationMarket.walkScore && (
                <div className="text-center p-3 bg-blue-100 rounded">
                  <div className="text-2xl font-bold text-blue-600 tabular-nums">
                    {locationMarket.walkScore}
                  </div>
                  <div className="text-blue-700 font-medium">Walk Score</div>
                </div>
              )}
              {locationMarket.transitScore && (
                <div className="text-center p-3 bg-blue-100 rounded">
                  <div className="text-2xl font-bold text-blue-600 tabular-nums">
                    {locationMarket.transitScore}
                  </div>
                  <div className="text-blue-700 font-medium">Transit Score</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nearby Amenities */}
        <div className="space-y-6">
          {locationMarket.nearbyAmenities && locationMarket.nearbyAmenities.length > 0 && (
            <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
              <h5 className="font-semibold text-neutral-900 mb-4">Nearby Amenities</h5>
              <div className="space-y-2">
                {locationMarket.nearbyAmenities.map((amenity, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0" />
                    <span className="text-neutral-700">{amenity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Neighborhood Context */}
          <div className="bg-emerald-50 rounded-lg p-6 border border-emerald-200">
            <h5 className="font-semibold text-emerald-900 mb-4">Neighborhood Context</h5>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-emerald-700">Neighborhood:</dt>
                <dd className="font-medium text-emerald-900">
                  {locationMarket.neighborhood}
                </dd>
              </div>
              {locationMarket.schoolRating && (
                <div className="flex justify-between">
                  <dt className="text-emerald-700">School Rating:</dt>
                  <dd className="font-medium text-emerald-900 tabular-nums">
                    {locationMarket.schoolRating}/10
                  </dd>
                </div>
              )}
              {locationMarket.medianHouseholdIncome && (
                <div className="flex justify-between">
                  <dt className="text-emerald-700">Median Income:</dt>
                  <dd className="font-medium text-emerald-900 tabular-nums">
                    ${locationMarket.medianHouseholdIncome.toLocaleString()}
                  </dd>
                </div>
              )}
              {locationMarket.populationGrowth && (
                <div className="flex justify-between">
                  <dt className="text-emerald-700">Population Growth:</dt>
                  <dd className="font-medium text-emerald-900 tabular-nums">
                    {locationMarket.populationGrowth > 0 ? '+' : ''}{locationMarket.populationGrowth.toFixed(1)}%
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </ReportTwoCol>

      {/* Neighborhood Photography */}
      {neighborhoodImages.length > 0 && (
        <div className="space-y-6">
          <div className="border-b border-neutral-200 pb-4">
            <h4 className="font-semibold text-neutral-900 text-lg">
              Neighborhood Photography
            </h4>
            <p className="text-sm text-neutral-600 mt-1">
              Street-level photography showcasing the local area character and amenities
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {neighborhoodImages.map((image, index) => (
              <Figure
                key={`neighborhood-${index}`}
                src={image.url}
                alt={image.caption}
                caption={image.caption}
                aspectRatio="photo"
                size="full"
                data-testid={`neighborhood-photo-${index}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
        <h5 className="font-semibold text-neutral-900 mb-4">Map Information</h5>
        <p className="text-sm text-neutral-600 leading-relaxed">
          All aerial photography and mapping data is current as of the report date. 
          Satellite imagery may be subject to seasonal variations and weather conditions. 
          Transportation routes and amenity locations are approximate and should be 
          verified independently for investment decision purposes.
        </p>
      </div>
    </ReportSection>
  );
}

export default AerialsAndMaps;