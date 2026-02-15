import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, Marker, MarkerClusterer, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from '@/lib/google-maps-provider';
import {
  Search, MapPin, Loader2, Building2, Calculator,
  BarChart3, ShoppingCart, ChevronDown, ChevronRight, X, Layers,
  ExternalLink, Ship, Maximize2, List, Anchor
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface MarinaLocation {
  id: string;
  source: 'property' | 'project' | 'comp' | 'rate_comp' | 'listing' | 'pipeline';
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  lat: number | null;
  lng: number | null;
  price: number | null;
  slips: number | null;
  status: string | null;
  metrics: Record<string, any>;
}

interface MapStats {
  total: number;
  withCoordinates: number;
  bySource: Record<string, number>;
  byState: Record<string, number>;
}

interface MapResponse {
  locations: MarinaLocation[];
  stats: MapStats;
}

export const SOURCE_COLORS: Record<string, string> = {
  property: '#4285F4',
  project: '#EA4335',
  comp: '#FBBC04',
  rate_comp: '#34A853',
  listing: '#9C27B0',
  pipeline: '#FF5722',
};

export const SOURCE_LABELS: Record<string, string> = {
  property: 'CRM Properties',
  project: 'Financial Models',
  comp: 'Sales Comps',
  rate_comp: 'Rate Comps',
  listing: 'Listings',
  pipeline: 'Pipeline Deals',
};

const SOURCE_ICONS: Record<string, typeof Anchor> = {
  property: Building2,
  project: Calculator,
  comp: BarChart3,
  rate_comp: BarChart3,
  listing: ShoppingCart,
  pipeline: Anchor,
};

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 29.7604, lng: -82.6368 };

export const formatCurrency = (value: number | null): string => {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

export function createMarkerIcon(
  source: string,
  isSelected: boolean = false,
  customColor?: string
): google.maps.Symbol | google.maps.Icon | undefined {
  const color = customColor || SOURCE_COLORS[source] || '#666';
  const scale = isSelected ? 12 : 8;
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: isSelected ? 1 : 0.85,
    strokeColor: isSelected ? '#fff' : color,
    strokeWeight: isSelected ? 3 : 1.5,
    scale,
  };
}

export interface MarinaMapEmbedProps {
  source: 'properties' | 'projects' | 'comps' | 'rate_comps' | 'listings' | 'pipeline' | 'all';
  markerColor?: string;
  sourceLabel?: string;
  height?: string;
  showSearch?: boolean;
  showStateFilter?: boolean;
  showSourceFilter?: boolean;
  showLayerToggles?: boolean;
  showListPanel?: boolean;
  emptyMessage?: string;
  onLocationClick?: (location: MarinaLocation) => void;
}

export default function MarinaMapEmbed({
  source,
  markerColor,
  sourceLabel,
  height = 'calc(100vh - 280px)',
  showSearch = true,
  showStateFilter = true,
  showSourceFilter = false,
  showLayerToggles = false,
  showListPanel = true,
  emptyMessage = 'No locations found',
  onLocationClick,
}: MarinaMapEmbedProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const mapRef = useRef<google.maps.Map | null>(null);

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>(source);
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<MarinaLocation | null>(null);
  const [visibleSources, setVisibleSources] = useState<Set<string>>(new Set(['property', 'project', 'comp', 'rate_comp', 'listing', 'pipeline']));
  const [viewMode, setViewMode] = useState<'map' | 'split'>(showListPanel ? 'split' : 'map');
  const [listExpanded, setListExpanded] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    const effectiveSource = showSourceFilter ? sourceFilter : source;
    if (effectiveSource && effectiveSource !== 'all') params.set('source', effectiveSource);
    if (stateFilter && stateFilter !== 'all') params.set('state', stateFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    const qs = params.toString();
    return `/api/marina-map/locations${qs ? `?${qs}` : ''}`;
  }, [sourceFilter, source, showSourceFilter, stateFilter, debouncedSearch]);

  const { data, isLoading, error } = useQuery<MapResponse>({
    queryKey: [queryUrl],
  });

  const locations = data?.locations || [];
  const stats = data?.stats;

  const isSingleSource = source !== 'all';

  const mappableLocations = useMemo(() =>
    locations.filter(l => l.lat != null && l.lng != null && (isSingleSource || visibleSources.has(l.source))),
    [locations, visibleSources, isSingleSource]
  );

  const listLocations = useMemo(() =>
    locations.filter(l => isSingleSource || visibleSources.has(l.source)),
    [locations, visibleSources, isSingleSource]
  );

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (mapRef.current && mappableLocations.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      mappableLocations.forEach(loc => {
        if (loc.lat && loc.lng) bounds.extend({ lat: loc.lat, lng: loc.lng });
      });
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [mappableLocations]);

  const toggleSource = (src: string) => {
    setVisibleSources(prev => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  };

  const handleLocationClick = (loc: MarinaLocation) => {
    if (onLocationClick) {
      onLocationClick(loc);
    }
  };

  const focusOnLocation = (loc: MarinaLocation) => {
    setSelectedLocation(loc);
    if (mapRef.current && loc.lat && loc.lng) {
      mapRef.current.panTo({ lat: loc.lat, lng: loc.lng });
      mapRef.current.setZoom(14);
    }
  };

  const getMarkerColor = (loc: MarinaLocation): string | undefined => {
    if (markerColor) return markerColor;
    if (isSingleSource) return SOURCE_COLORS[loc.source] || '#4285F4';
    return undefined;
  };

  if (loadError || error) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">{loadError ? 'Map Unavailable' : 'Error Loading Data'}</h3>
            <p className="text-sm text-muted-foreground">
              {loadError ? 'Unable to load Google Maps. Please check the API key configuration.' : 'Failed to load marina data. Please try refreshing the page.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasToolbar = showSearch || showStateFilter || showSourceFilter;

  return (
    <div className="flex flex-col" style={{ height }}>
      {hasToolbar && (
        <div className="px-3 py-2 border-b bg-white dark:bg-slate-900 flex items-center gap-2 flex-wrap">
          {showSearch && (
            <div className="relative flex-1 min-w-[180px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search marinas by name..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
              {searchText && (
                <button onClick={() => setSearchText('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          )}
          {showStateFilter && (
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[100px] h-8 text-sm">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {US_STATES.map(st => (
                  <SelectItem key={st} value={st}>{st}{stats?.byState[st] ? ` (${stats.byState[st]})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showSourceFilter && (
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[140px] h-8 text-sm">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="properties">Properties</SelectItem>
                <SelectItem value="projects">Models</SelectItem>
                <SelectItem value="comps">Sales Comps</SelectItem>
                <SelectItem value="listings">Listings</SelectItem>
              </SelectContent>
            </Select>
          )}

          {showListPanel && (
            <div className="flex items-center gap-1 ml-auto">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'map' ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setViewMode('map')}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Full Map</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'split' ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setViewMode('split')}
                    >
                      <List className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Map + List</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      )}

      {showLayerToggles && (
        <div className="px-3 py-2 border-b bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2 flex-wrap">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mr-1">Layers:</span>
          {Object.entries(SOURCE_LABELS).map(([key, label]) => {
            const Icon = SOURCE_ICONS[key];
            const count = stats?.bySource[key] || 0;
            const active = visibleSources.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleSource(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                  active
                    ? "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 shadow-sm"
                    : "bg-transparent border-transparent text-muted-foreground opacity-50 hover:opacity-80"
                )}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: active ? SOURCE_COLORS[key] : '#ccc' }}
                />
                <Icon className="h-3 w-3" />
                <span>{label}</span>
                <span className="text-muted-foreground">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className={cn("flex-1 relative", viewMode === 'split' ? 'min-w-0' : '')}>
          {!isLoaded ? (
            <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Loading map...</p>
              </div>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={defaultCenter}
              zoom={5}
              onLoad={onMapLoad}
              onClick={() => setSelectedLocation(null)}
              options={{
                mapTypeControl: true,
                mapTypeControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
                streetViewControl: false,
                fullscreenControl: false,
                zoomControl: true,
                styles: [
                  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c8e0f0' }] },
                  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a90b8' }] },
                ],
              }}
            >
              <MarkerClusterer
                options={{
                  imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m',
                  maxZoom: 14,
                  minimumClusterSize: 4,
                }}
              >
                {(clusterer) => (
                  <>
                    {mappableLocations.map((loc) => (
                      <Marker
                        key={`${loc.source}-${loc.id}`}
                        position={{ lat: loc.lat!, lng: loc.lng! }}
                        icon={createMarkerIcon(
                          loc.source,
                          selectedLocation?.id === loc.id && selectedLocation?.source === loc.source,
                          getMarkerColor(loc)
                        )}
                        clusterer={clusterer}
                        onClick={() => setSelectedLocation(loc)}
                        title={loc.name}
                      />
                    ))}
                  </>
                )}
              </MarkerClusterer>

              {selectedLocation && selectedLocation.lat && selectedLocation.lng && (
                <InfoWindow
                  position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
                  onCloseClick={() => setSelectedLocation(null)}
                >
                  <div className="p-1 min-w-[220px] max-w-[300px]">
                    <div className="flex items-start gap-2 mb-2">
                      <div
                        className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: markerColor || SOURCE_COLORS[selectedLocation.source] }}
                      />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm leading-tight">{selectedLocation.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[selectedLocation.city, selectedLocation.state].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                    {selectedLocation.address && (
                      <p className="text-xs text-gray-600 mb-2">{selectedLocation.address}</p>
                    )}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs border-t pt-2 mt-1">
                      {selectedLocation.price && (
                        <div>
                          <span className="text-gray-500">Price: </span>
                          <span className="font-medium">{formatCurrency(selectedLocation.price)}</span>
                        </div>
                      )}
                      {selectedLocation.slips && (
                        <div>
                          <span className="text-gray-500">Slips: </span>
                          <span className="font-medium">{selectedLocation.slips.toLocaleString()}</span>
                        </div>
                      )}
                      {selectedLocation.status && (
                        <div>
                          <span className="text-gray-500">Status: </span>
                          <span className="font-medium capitalize">{selectedLocation.status}</span>
                        </div>
                      )}
                      {!isSingleSource && (
                        <div>
                          <span className="text-gray-500">Source: </span>
                          <span className="font-medium">{SOURCE_LABELS[selectedLocation.source]}</span>
                        </div>
                      )}
                      {selectedLocation.metrics?.capRate && (
                        <div>
                          <span className="text-gray-500">Cap Rate: </span>
                          <span className="font-medium">{(Number(selectedLocation.metrics.capRate) / 100).toFixed(1)}%</span>
                        </div>
                      )}
                      {selectedLocation.metrics?.bodyOfWater && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Water: </span>
                          <span className="font-medium">{selectedLocation.metrics.bodyOfWater}</span>
                        </div>
                      )}
                    </div>
                    {onLocationClick && (
                      <div className="mt-2 pt-2 border-t">
                        <button
                          onClick={() => handleLocationClick(selectedLocation)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Details
                        </button>
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}

          {isLoading && (
            <div className="absolute top-3 left-3 bg-white dark:bg-slate-800 rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 z-10">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Loading marina locations...</span>
            </div>
          )}
        </div>

        {viewMode === 'split' && showListPanel && (
          <div className="w-[360px] border-l bg-white dark:bg-slate-900 flex flex-col overflow-hidden flex-shrink-0">
            <div className="px-3 py-2.5 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {listLocations.length} {sourceLabel || 'Marina'}{listLocations.length !== 1 ? 's' : ''}
                </span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setListExpanded(!listExpanded)}>
                {listExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {listExpanded && (
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="p-3 space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    ))}
                  </div>
                ) : listLocations.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    <p className="text-xs mt-1">Try adjusting your filters</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {listLocations.map((loc) => {
                      const isActive = selectedLocation?.id === loc.id && selectedLocation?.source === loc.source;
                      const dotColor = markerColor || SOURCE_COLORS[loc.source];
                      return (
                        <button
                          key={`${loc.source}-${loc.id}`}
                          className={cn(
                            "w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                            isActive && "bg-blue-50 dark:bg-blue-950/20 border-l-2 border-l-blue-500"
                          )}
                          onClick={() => focusOnLocation(loc)}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: dotColor }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate">{loc.name}</p>
                                {!loc.lat && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 flex-shrink-0 text-amber-600 border-amber-300">
                                    No coords
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {[loc.city, loc.state].filter(Boolean).join(', ') || loc.address || 'No location'}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs">
                                {loc.price && (
                                  <span className="font-medium text-green-600">{formatCurrency(loc.price)}</span>
                                )}
                                {loc.slips && (
                                  <span className="text-muted-foreground">
                                    <Ship className="inline h-3 w-3 mr-0.5" />{loc.slips} slips
                                  </span>
                                )}
                                {!isSingleSource && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                    {SOURCE_LABELS[loc.source]?.split(' ')[0]}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {stats && (
              <div className="border-t px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">With Coordinates</span>
                    <p className="font-medium">{stats.withCoordinates} / {stats.total}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Showing</span>
                    <p className="font-medium">{listLocations.length}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
