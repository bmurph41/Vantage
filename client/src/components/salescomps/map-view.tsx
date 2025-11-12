import { useEffect, useRef, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CompLocation {
  id: string;
  marina: string;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  salePrice?: number;
  saleMonth?: number;
  saleYear?: number;
  wetSlips?: number;
  dryRacks?: number;
}

interface MapViewProps {
  comps: CompLocation[];
  subjectProperty?: CompLocation | null;
  onGeocodeComp?: (compId: string) => Promise<void>;
  onExportPDF?: () => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

const defaultCenter = {
  lat: 39.8283, // Center of US
  lng: -98.5795,
};

export function MapView({
  comps,
  subjectProperty,
  onGeocodeComp,
  onExportPDF,
}: MapViewProps) {
  const { toast } = useToast();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [compMarkerColor, setCompMarkerColor] = useState('#4285F4'); // Google blue
  const [subjectMarkerColor, setSubjectMarkerColor] = useState('#EA4335'); // Google red
  const [visibleCompIds, setVisibleCompIds] = useState<Set<string>>(new Set());
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(4);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

  useEffect(() => {
    // Initialize all comps as visible
    const allIds = new Set(comps.map(c => c.id));
    setVisibleCompIds(allIds);

    // Auto-fit map to show all markers
    if (mapRef.current && comps.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      
      comps.forEach(comp => {
        if (comp.lat && comp.lng) {
          bounds.extend({ lat: comp.lat, lng: comp.lng });
        }
      });

      if (subjectProperty?.lat && subjectProperty?.lng) {
        bounds.extend({ lat: subjectProperty.lat, lng: subjectProperty.lng });
      }

      mapRef.current.fitBounds(bounds);
    }
  }, [comps, subjectProperty]);

  const toggleCompVisibility = (compId: string) => {
    setVisibleCompIds(prev => {
      const next = new Set(prev);
      if (next.has(compId)) {
        next.delete(compId);
      } else {
        next.add(compId);
      }
      return next;
    });
  };

  const toggleAllComps = () => {
    if (visibleCompIds.size === comps.length) {
      setVisibleCompIds(new Set());
    } else {
      setVisibleCompIds(new Set(comps.map(c => c.id)));
    }
  };

  const handleMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
  };

  const handleCenterChange = () => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      if (center) {
        setMapCenter({
          lat: center.lat(),
          lng: center.lng(),
        });
      }
    }
  };

  const handleZoomChange = () => {
    if (mapRef.current) {
      const zoom = mapRef.current.getZoom();
      if (zoom) {
        setMapZoom(zoom);
      }
    }
  };

  if (loadError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">Error loading Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading map...</span>
      </div>
    );
  }

  const visibleComps = comps.filter(c => visibleCompIds.has(c.id));
  const compsWithCoords = visibleComps.filter(c => c.lat && c.lng);
  const compsWithoutCoords = comps.filter(c => !c.lat || !c.lng);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Map Section */}
        <div className="lg:col-span-3">
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Map View</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllComps}
                  data-testid="button-toggle-all-markers"
                >
                  {visibleCompIds.size === comps.length ? 'Hide All' : 'Show All'}
                </Button>
                {onExportPDF && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={onExportPDF}
                    data-testid="button-export-pdf"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                )}
              </div>
            </div>

            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={mapCenter}
              zoom={mapZoom}
              onLoad={handleMapLoad}
              onCenterChanged={handleCenterChange}
              onZoomChanged={handleZoomChange}
              options={{
                streetViewControl: false,
                mapTypeControl: true,
                fullscreenControl: true,
              }}
            >
              {/* Subject Property Marker */}
              {subjectProperty?.lat && subjectProperty?.lng && (
                <Marker
                  position={{ lat: subjectProperty.lat, lng: subjectProperty.lng }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: subjectMarkerColor,
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                  }}
                  title={`Subject: ${subjectProperty.marina}`}
                />
              )}

              {/* Comp Markers */}
              {compsWithCoords.map(comp => (
                <Marker
                  key={comp.id}
                  position={{ lat: comp.lat, lng: comp.lng }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: compMarkerColor,
                    fillOpacity: 0.8,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                  }}
                  title={comp.marina}
                />
              ))}
            </GoogleMap>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="comp-marker-color">Comp Marker Color</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="comp-marker-color"
                    type="color"
                    value={compMarkerColor}
                    onChange={(e) => setCompMarkerColor(e.target.value)}
                    className="w-20 h-10"
                    data-testid="input-comp-marker-color"
                  />
                  <span className="text-sm text-gray-600 flex items-center">
                    {compMarkerColor}
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="subject-marker-color">Subject Property Color</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="subject-marker-color"
                    type="color"
                    value={subjectMarkerColor}
                    onChange={(e) => setSubjectMarkerColor(e.target.value)}
                    className="w-20 h-10"
                    data-testid="input-subject-marker-color"
                  />
                  <span className="text-sm text-gray-600 flex items-center">
                    {subjectMarkerColor}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Legend and Controls */}
        <div className="space-y-4">
          <Card className="p-4">
            <h4 className="font-semibold mb-3">Legend</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {subjectProperty && (
                <div className="flex items-center gap-2 pb-2 border-b">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: subjectMarkerColor }}
                  />
                  <span className="text-sm font-medium">
                    {subjectProperty.marina} (Subject)
                  </span>
                </div>
              )}

              {comps.map(comp => (
                <div
                  key={comp.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                  onClick={() => toggleCompVisibility(comp.id)}
                  data-testid={`legend-item-${comp.id}`}
                >
                  <input
                    type="checkbox"
                    checked={visibleCompIds.has(comp.id)}
                    onChange={() => toggleCompVisibility(comp.id)}
                    className="w-4 h-4"
                  />
                  <div
                    className="w-3 h-3 rounded-full border border-white"
                    style={{
                      backgroundColor: comp.lat && comp.lng ? compMarkerColor : '#ccc',
                    }}
                  />
                  <span className="text-sm flex-1">{comp.marina}</span>
                  {(!comp.lat || !comp.lng) && (
                    <MapPin className="w-3 h-3 text-gray-400" />
                  )}
                </div>
              ))}
            </div>
          </Card>

          {compsWithoutCoords.length > 0 && onGeocodeComp && (
            <Card className="p-4">
              <h4 className="font-semibold mb-3 text-orange-600">
                Missing Locations ({compsWithoutCoords.length})
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                These comps don't have geocoded coordinates yet.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {compsWithoutCoords.map(comp => (
                  <div key={comp.id} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{comp.marina}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGeocodeComp(comp.id)}
                      data-testid={`button-geocode-${comp.id}`}
                    >
                      <MapPin className="w-3 h-3 mr-1" />
                      Geocode
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
