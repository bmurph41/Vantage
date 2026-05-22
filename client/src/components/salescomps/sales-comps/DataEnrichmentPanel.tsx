import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, MapPin, Droplets, Building, RefreshCw, AlertCircle } from "lucide-react";
import type { SalesComp } from "@shared/schema";

interface DataEnrichmentPanelProps {
  comp: SalesComp;
}

const FLOOD_ZONE_LABELS: Record<string, { label: string; risk: string; color: string }> = {
  A: { label: "Zone A", risk: "High Risk", color: "text-red-600 bg-red-50 border-red-200" },
  AE: { label: "Zone AE", risk: "High Risk", color: "text-red-600 bg-red-50 border-red-200" },
  AH: { label: "Zone AH", risk: "High Risk", color: "text-red-600 bg-red-50 border-red-200" },
  AO: { label: "Zone AO", risk: "High Risk", color: "text-red-600 bg-red-50 border-red-200" },
  V: { label: "Zone V", risk: "High Risk (Coastal)", color: "text-red-700 bg-red-100 border-red-300" },
  VE: { label: "Zone VE", risk: "High Risk (Coastal)", color: "text-red-700 bg-red-100 border-red-300" },
  X: { label: "Zone X", risk: "Minimal Risk", color: "text-green-700 bg-green-50 border-green-200" },
  D: { label: "Zone D", risk: "Undetermined Risk", color: "text-amber-600 bg-amber-50 border-amber-200" },
};

function FloodZoneBadge({ zone }: { zone: string }) {
  const info = FLOOD_ZONE_LABELS[zone] || { label: `Zone ${zone}`, risk: "Unknown", color: "text-gray-600 bg-gray-50 border-gray-200" };
  return (
    <Badge variant="outline" className={`${info.color} border font-medium`}>
      {info.label} — {info.risk}
    </Badge>
  );
}

export default function DataEnrichmentPanel({ comp }: DataEnrichmentPanelProps) {
  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["/api/sales-comps", comp.id, "enrichment"],
    queryFn: () => fetch(`/api/sales-comps/${comp.id}/enrichment`).then(r => r.json()),
    enabled: !!comp.id,
    staleTime: 10 * 60 * 1000,
  });

  const handleRefresh = () => {
    refetch();
  };

  const hasCoordinates = comp.lat && comp.lng;
  const streetViewUrl = hasCoordinates
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${comp.lat},${comp.lng}`
    : comp.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([comp.address, comp.city, comp.state].filter(Boolean).join(", "))}`
    : null;

  const streetViewImageUrl = hasCoordinates
    ? `https://maps.googleapis.com/maps/api/streetview?size=600x200&location=${comp.lat},${comp.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""}`
    : null;

  const googleMapsUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${comp.lat},${comp.lng}`
    : comp.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([comp.address, comp.city, comp.state].filter(Boolean).join(", "))}`
    : null;

  const assessorLink = data?.assessor?.assessorUrl || null;
  const parcelData = data?.assessor || null;
  const floodZone = data?.floodZone || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Auto-fetched public record data for this property.
        </p>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Street View */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Street View
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {streetViewImageUrl && import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
            <div className="relative rounded-md overflow-hidden border bg-muted">
              <img
                src={streetViewImageUrl}
                alt={`Street view of ${comp.marina}`}
                className="w-full h-40 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          ) : (
            <div className="h-32 rounded-md border bg-muted flex flex-col items-center justify-center text-muted-foreground gap-2">
              <MapPin className="h-8 w-8 opacity-30" />
              <p className="text-xs">Street view preview unavailable</p>
            </div>
          )}
          <div className="flex gap-2 text-xs text-muted-foreground">
            {hasCoordinates && (
              <span className="font-mono">{Number(comp.lat).toFixed(6)}, {Number(comp.lng).toFixed(6)}</span>
            )}
          </div>
          {googleMapsUrl && (
            <Button variant="outline" size="sm" className="w-full text-xs" asChild>
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Open in Google Maps
              </a>
            </Button>
          )}
          {streetViewUrl && (
            <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
              <a href={streetViewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1.5" />
                View Street View
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* FEMA Flood Zone */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-500" />
            FEMA Flood Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : error || !hasCoordinates ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              {hasCoordinates ? "Flood zone data unavailable" : "Coordinates required for flood zone lookup"}
            </div>
          ) : floodZone ? (
            <div className="space-y-2">
              <FloodZoneBadge zone={floodZone.zone} />
              {floodZone.communityName && (
                <p className="text-xs text-muted-foreground">Community: {floodZone.communityName}</p>
              )}
              {floodZone.firmPanel && (
                <p className="text-xs text-muted-foreground">FIRM Panel: {floodZone.firmPanel}</p>
              )}
              <a
                href={`https://msc.fema.gov/portal/search#searchresultsanchor?address=${encodeURIComponent([comp.address, comp.city, comp.state].filter(Boolean).join(", "))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View FEMA Flood Map
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">No flood zone data returned for these coordinates.</p>
              <a
                href={`https://msc.fema.gov/portal/search#searchresultsanchor?address=${encodeURIComponent([comp.address, comp.city, comp.state].filter(Boolean).join(", "))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Search FEMA Flood Map
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* County Assessor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building className="h-4 w-4 text-amber-600" />
            County Assessor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {comp.county && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">County</span>
                  <span className="font-medium">{comp.county}</span>
                </div>
              )}
              {comp.state && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">State</span>
                  <span className="font-medium">{comp.state}</span>
                </div>
              )}
              {parcelData?.parcelId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parcel ID</span>
                  <span className="font-mono">{parcelData.parcelId}</span>
                </div>
              )}
              {parcelData?.assessedValue && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assessed Value</span>
                  <span className="font-medium">${Number(parcelData.assessedValue).toLocaleString()}</span>
                </div>
              )}
              {parcelData?.landValue && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Land Value</span>
                  <span className="font-medium">${Number(parcelData.landValue).toLocaleString()}</span>
                </div>
              )}
              {!comp.county && !parcelData && (
                <p className="text-muted-foreground">County assessor data not available for this record.</p>
              )}
              {assessorLink && (
                <a
                  href={assessorLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 pt-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View County Assessor Record
                </a>
              )}
              {comp.county && comp.state && !assessorLink && (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${comp.county} County ${comp.state} property assessor records`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 pt-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Search County Assessor
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
