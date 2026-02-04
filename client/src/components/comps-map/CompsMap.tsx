import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GoogleMap, Marker, MarkerClusterer, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from '@/lib/google-maps-provider';
import { Loader2, Share2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MapFilterBar } from './MapFilterBar';
import { MapResultsPanel } from './MapResultsPanel';
import { LayerToggles } from './LayerToggles';
import type { MapItem, MapFilters, MapConfig, LayerType } from './types';
import { formatMetricValue, formatMetricLabel } from './types';

interface CompsMapProps {
  config: MapConfig;
  items: MapItem[];
  subjectProperty?: MapItem | null;
  isLoading?: boolean;
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  onExport?: () => void;
  showSubjectSelector?: boolean;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 39.8283,
  lng: -98.5795,
};

const clusterOptions = {
  imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m',
  maxZoom: 15,
  minimumClusterSize: 3,
};

export function CompsMap({
  config,
  items,
  subjectProperty,
  isLoading = false,
  filters,
  onFiltersChange,
  onExport,
}: CompsMapProps) {
  const { toast } = useToast();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<LayerType[]>(config.defaultVisibleLayers);
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | undefined>();
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(4);

  const { isLoaded, loadError } = useGoogleMaps();

  const visibleItems = useMemo(() => {
    return items.filter(item => visibleLayers.includes(item.layerType));
  }, [items, visibleLayers]);

  const allItems = useMemo(() => {
    const result = [...visibleItems];
    if (subjectProperty && visibleLayers.includes('subject')) {
      result.unshift({ ...subjectProperty, isSubject: true });
    }
    return result;
  }, [visibleItems, subjectProperty, visibleLayers]);

  const markersWithCoords = useMemo(() => {
    return allItems.filter(item => item.lat && item.lng);
  }, [allItems]);

  const layerCounts = useMemo(() => {
    const counts: Record<LayerType, number> = {} as Record<LayerType, number>;
    items.forEach(item => {
      counts[item.layerType] = (counts[item.layerType] || 0) + 1;
    });
    if (subjectProperty) {
      counts.subject = 1;
    }
    return counts;
  }, [items, subjectProperty]);

  useEffect(() => {
    if (mapRef.current && markersWithCoords.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      markersWithCoords.forEach(item => {
        bounds.extend({ lat: item.lat, lng: item.lng });
      });
      mapRef.current.fitBounds(bounds, 50);
    }
  }, [markersWithCoords]);

  useEffect(() => {
    if (subjectProperty?.lat && subjectProperty?.lng && mapRef.current) {
      setMapCenter({ lat: subjectProperty.lat, lng: subjectProperty.lng });
      mapRef.current.setCenter({ lat: subjectProperty.lat, lng: subjectProperty.lng });
      mapRef.current.setZoom(10);
    }
  }, [subjectProperty]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleItemSelect = useCallback((item: MapItem) => {
    setSelectedItem(item);
    if (item.lat && item.lng && mapRef.current) {
      mapRef.current.panTo({ lat: item.lat, lng: item.lng });
      mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 10, 12));
    }
  }, []);

  const handleItemHover = useCallback((item: MapItem | null) => {
    setHoveredItemId(item?.id);
  }, []);

  const handleToggleLayer = useCallback((layer: LayerType) => {
    setVisibleLayers(prev =>
      prev.includes(layer)
        ? prev.filter(l => l !== layer)
        : [...prev, layer]
    );
  }, []);

  const handleShowAllLayers = useCallback(() => {
    setVisibleLayers(config.defaultVisibleLayers);
  }, [config.defaultVisibleLayers]);

  const handleHideAllLayers = useCallback(() => {
    setVisibleLayers([]);
  }, []);

  const handleResetFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const handleSearch = useCallback((address: string) => {
    if (!mapRef.current) return;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const location = results[0].geometry.location;
        mapRef.current?.setCenter(location);
        mapRef.current?.setZoom(12);
        toast({
          title: 'Location found',
          description: results[0].formatted_address,
        });
      } else {
        toast({
          title: 'Location not found',
          description: 'Could not geocode the address',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);

  const handleShareLink = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.states?.length) params.set('states', filters.states.join(','));
    if (filters.radius) params.set('radius', String(filters.radius));
    if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
    if (filters.minYear) params.set('minYear', String(filters.minYear));
    if (filters.maxYear) params.set('maxYear', String(filters.maxYear));

    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link copied',
      description: 'Share link copied to clipboard',
    });
  }, [filters, toast]);

  const handleExportCSV = useCallback(() => {
    if (onExport) {
      onExport();
    } else {
      const headers = ['Name', 'City', 'State', 'Lat', 'Lng', ...config.metricsConfig.card];
      const rows = visibleItems.map(item => [
        item.title,
        item.city || '',
        item.state || '',
        item.lat,
        item.lng,
        ...config.metricsConfig.card.map(field => item.metrics[field] ?? ''),
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.module}_comps_export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [onExport, visibleItems, config]);

  const getMarkerIcon = useCallback((item: MapItem, isHovered: boolean, isSelected: boolean) => {
    const color = item.isSubject
      ? config.colors.subject || '#EA4335'
      : config.colors[item.layerType] || '#4285F4';
    
    const scale = isHovered || isSelected ? 12 : 8;
    const strokeWeight = isHovered || isSelected ? 3 : 2;

    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale,
      fillColor: color,
      fillOpacity: isHovered || isSelected ? 1 : 0.8,
      strokeColor: '#fff',
      strokeWeight,
    };
  }, [config.colors]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <div className="text-center">
          <p className="text-red-500 font-medium">Error loading Google Maps</p>
          <p className="text-sm text-muted-foreground mt-1">
            Please check your API key configuration
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading map...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="comps-map-container">
      <MapFilterBar
        config={config}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onSearch={handleSearch}
        onReset={handleResetFilters}
        totalResults={visibleItems.length}
      />

      <div className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={mapZoom}
            onLoad={handleMapLoad}
            options={{
              streetViewControl: false,
              mapTypeControl: true,
              fullscreenControl: true,
              zoomControl: true,
              mapTypeControlOptions: {
                position: google.maps.ControlPosition.TOP_LEFT,
              },
            }}
          >
            <MarkerClusterer options={clusterOptions}>
              {(clusterer) => (
                <>
                  {markersWithCoords.map(item => (
                    <Marker
                      key={item.id}
                      position={{ lat: item.lat, lng: item.lng }}
                      icon={getMarkerIcon(
                        item,
                        hoveredItemId === item.id,
                        selectedItem?.id === item.id
                      )}
                      onClick={() => handleItemSelect(item)}
                      onMouseOver={() => handleItemHover(item)}
                      onMouseOut={() => handleItemHover(null)}
                      clusterer={item.isSubject ? undefined : clusterer}
                      zIndex={item.isSubject ? 1000 : hoveredItemId === item.id ? 999 : 1}
                    />
                  ))}
                </>
              )}
            </MarkerClusterer>

            {selectedItem && selectedItem.lat && selectedItem.lng && (
              <InfoWindow
                position={{ lat: selectedItem.lat, lng: selectedItem.lng }}
                onCloseClick={() => setSelectedItem(null)}
              >
                <div className="p-2 max-w-xs">
                  <h4 className="font-semibold text-sm mb-1">{selectedItem.title}</h4>
                  {(selectedItem.city || selectedItem.state) && (
                    <p className="text-xs text-gray-600 mb-2">
                      {[selectedItem.city, selectedItem.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {config.metricsConfig.popup.map(field => {
                      const value = selectedItem.metrics[field];
                      if (value === undefined || value === null) return null;
                      return (
                        <div key={field} className="text-xs">
                          <span className="text-gray-500">{formatMetricLabel(field)}:</span>{' '}
                          <span className="font-medium">{formatMetricValue(field, value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>

          <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
            <LayerToggles
              config={config}
              visibleLayers={visibleLayers}
              onToggleLayer={handleToggleLayer}
              onShowAll={handleShowAllLayers}
              onHideAll={handleHideAllLayers}
              layerCounts={layerCounts}
            />

            <Button
              variant="outline"
              size="sm"
              className="bg-background shadow-md"
              onClick={handleShareLink}
              data-testid="button-share-link"
            >
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="bg-background shadow-md"
              onClick={handleExportCSV}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        <MapResultsPanel
          config={config}
          items={allItems}
          selectedItemId={selectedItem?.id}
          hoveredItemId={hoveredItemId}
          onItemSelect={handleItemSelect}
          onItemHover={handleItemHover}
          onExport={handleExportCSV}
          isCollapsed={isPanelCollapsed}
          onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
        />
      </div>
    </div>
  );
}
