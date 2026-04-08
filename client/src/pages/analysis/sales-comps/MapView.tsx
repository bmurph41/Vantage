import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, Marker, MarkerClusterer, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from '@/lib/google-maps-provider';
import { useLocation } from 'wouter';
import SalesCompsHeader from '@/components/salescomps/sales-comps/SalesCompsHeader';
import {
  Search, MapPin, Loader2, BarChart3, X, DollarSign,
  TrendingUp, TrendingDown, Minus, Ship, ExternalLink,
  Maximize2, List, Filter, Building2, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 29.7604, lng: -82.6368 };

const PRICE_COLORS = [
  { min: 0, max: 1_000_000, color: '#22c55e', label: 'Under $1M' },
  { min: 1_000_000, max: 5_000_000, color: '#3b82f6', label: '$1M - $5M' },
  { min: 5_000_000, max: 15_000_000, color: '#f59e0b', label: '$5M - $15M' },
  { min: 15_000_000, max: 50_000_000, color: '#ef4444', label: '$15M - $50M' },
  { min: 50_000_000, max: Infinity, color: '#7c3aed', label: '$50M+' },
];

function getPriceColor(price: number | null | undefined): string {
  if (!price) return '#9ca3af';
  const bracket = PRICE_COLORS.find(b => price >= b.min && price < b.max);
  return bracket?.color || '#9ca3af';
}

function getMarkerScale(price: number | null | undefined): number {
  if (!price) return 7;
  if (price < 1_000_000) return 7;
  if (price < 5_000_000) return 9;
  if (price < 15_000_000) return 11;
  if (price < 50_000_000) return 13;
  return 15;
}

function formatCurrency(value: number | null | undefined): string {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

interface SalesComp {
  id: string;
  marina: string;
  salePrice: number | null;
  capRate: number | null;
  noi: number | null;
  saleMonth: number | null;
  saleYear: number | null;
  city: string | null;
  state: string | null;
  wetSlips: number | null;
  dryRacks: number | null;
  lat: string | null;
  lng: string | null;
  address: string | null;
  bodyOfWater: string | null;
  waterfront: string | null;
  seller: string | null;
  broker: string | null;
  listPrice: number | null;
  acres: number | null;
  occupancy: number | null;
  storageTypes: string[] | null;
  _source?: string;
}

export default function SalesCompsMapView() {
  const [, navigate] = useLocation();
  const { isLoaded, loadError } = useGoogleMaps();
  const mapRef = useRef<google.maps.Map | null>(null);

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200_000_000]);
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  const [selectedComp, setSelectedComp] = useState<SalesComp | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'map'>('split');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [listExpanded, setListExpanded] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('pageSize', '500');
    params.set('includeGlobal', 'true');
    if (stateFilter && stateFilter !== 'all') params.set('state', stateFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    return params.toString();
  }, [stateFilter, debouncedSearch]);

  const { data, isLoading } = useQuery<{ comps: SalesComp[]; total: number }>({
    queryKey: ['/api/sales-comps', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/sales-comps?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch sales comps');
      return res.json();
    },
  });

  const allComps = data?.comps || [];

  const filteredComps = useMemo(() => {
    return allComps.filter(c => {
      if (priceRange[0] > 0 || priceRange[1] < 200_000_000) {
        const price = c.salePrice || 0;
        if (price < priceRange[0] || price > priceRange[1]) return false;
      }
      return true;
    });
  }, [allComps, priceRange]);

  const mappableComps = useMemo(() =>
    filteredComps.filter(c => c.lat != null && c.lng != null && parseFloat(c.lat) !== 0 && parseFloat(c.lng) !== 0),
    [filteredComps]
  );

  const stats = useMemo(() => {
    const withPrice = filteredComps.filter(c => c.salePrice && c.salePrice > 0);
    const prices = withPrice.map(c => c.salePrice!);
    const totalSlips = filteredComps.reduce((sum, c) => sum + (c.wetSlips || 0), 0);
    const pricePerSlip = withPrice
      .filter(c => c.wetSlips && c.wetSlips > 0)
      .map(c => c.salePrice! / c.wetSlips!);
    const avgPricePerSlip = pricePerSlip.length > 0
      ? pricePerSlip.reduce((a, b) => a + b, 0) / pricePerSlip.length
      : 0;

    const byState: Record<string, number> = {};
    filteredComps.forEach(c => {
      if (c.state) byState[c.state] = (byState[c.state] || 0) + 1;
    });

    return {
      total: filteredComps.length,
      withCoordinates: mappableComps.length,
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      medianPrice: prices.length > 0
        ? [...prices].sort((a, b) => a - b)[Math.floor(prices.length / 2)]
        : 0,
      totalSlips,
      avgPricePerSlip,
      byState,
    };
  }, [filteredComps, mappableComps]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (mapRef.current && mappableComps.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      mappableComps.forEach(c => {
        if (c.lat && c.lng) {
          bounds.extend({ lat: parseFloat(c.lat), lng: parseFloat(c.lng) });
        }
      });
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [mappableComps]);

  const createMarkerIcon = useCallback((comp: SalesComp, isSelected: boolean): google.maps.Symbol => {
    const color = getPriceColor(comp.salePrice);
    const scale = isSelected ? getMarkerScale(comp.salePrice) + 4 : getMarkerScale(comp.salePrice);
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: isSelected ? 1 : 0.85,
      strokeColor: isSelected ? '#fff' : color,
      strokeWeight: isSelected ? 3 : 1.5,
      scale,
    };
  }, []);

  const focusOnComp = useCallback((comp: SalesComp) => {
    setSelectedComp(comp);
    if (mapRef.current && comp.lat && comp.lng) {
      mapRef.current.panTo({ lat: parseFloat(comp.lat), lng: parseFloat(comp.lng) });
      mapRef.current.setZoom(14);
    }
  }, []);

  const formatSaleDate = (month: number | null, year: number | null): string => {
    if (!year) return 'N/A';
    if (!month) return `${year}`;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month - 1]} ${year}`;
  };

  if (loadError) {
    return (
      <div>
        <SalesCompsHeader />
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 200px)' }}>
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center space-y-3">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">Map Unavailable</h3>
              <p className="text-sm text-muted-foreground">
                Unable to load Google Maps. Please check the API key configuration.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SalesCompsHeader />
      <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Toolbar */}
        <div className="px-3 py-2 border-b bg-white dark:bg-slate-900 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[120px] sm:min-w-[180px] max-w-md">
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

          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[100px] h-8 text-sm">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {US_STATES.map(st => (
                <SelectItem key={st} value={st}>
                  {st}{stats.byState[st] ? ` (${stats.byState[st]})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showPriceFilter ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-sm gap-1.5"
            onClick={() => setShowPriceFilter(!showPriceFilter)}
          >
            <Filter className="h-3.5 w-3.5" />
            Price Filter
          </Button>

          <Select
            value={mapType}
            onValueChange={(v) => {
              setMapType(v as 'roadmap' | 'satellite');
              if (mapRef.current) {
                mapRef.current.setMapTypeId(v);
              }
            }}
          >
            <SelectTrigger className="w-[110px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="roadmap">Street View</SelectItem>
              <SelectItem value="satellite">Satellite</SelectItem>
            </SelectContent>
          </Select>

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
                <TooltipContent>Map + Panel</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Price range filter */}
        {showPriceFilter && (
          <div className="px-4 py-3 border-b bg-slate-50 dark:bg-slate-800/50 flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium">Price Range:</span>
            </div>
            <div className="flex-1 max-w-lg">
              <Slider
                min={0}
                max={200_000_000}
                step={500_000}
                value={priceRange}
                onValueChange={(v) => setPriceRange(v as [number, number])}
                className="w-full"
              />
            </div>
            <span className="text-sm font-medium min-w-[180px] text-right">
              {formatCompactCurrency(priceRange[0])} - {priceRange[1] >= 200_000_000 ? 'Any' : formatCompactCurrency(priceRange[1])}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setPriceRange([0, 200_000_000])}
            >
              Reset
            </Button>
          </div>
        )}

        {/* Color legend */}
        <div className="px-3 py-1.5 border-b bg-white dark:bg-slate-900 flex items-center gap-3 text-xs flex-wrap">
          <span className="text-muted-foreground font-medium">Price Tiers:</span>
          {PRICE_COLORS.map(bracket => (
            <span key={bracket.label} className="inline-flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: bracket.color }}
              />
              {bracket.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-gray-400" />
            Undisclosed
          </span>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Map */}
          <div className={cn("flex-1 relative", viewMode === 'split' ? 'min-w-0 min-h-[40vh] md:min-h-0' : '')}>
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
                onClick={() => setSelectedComp(null)}
                options={{
                  mapTypeId: mapType,
                  mapTypeControl: true,
                  mapTypeControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
                  streetViewControl: false,
                  fullscreenControl: false,
                  zoomControl: true,
                  styles: mapType === 'roadmap' ? [
                    { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c8e0f0' }] },
                    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a90b8' }] },
                  ] : undefined,
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
                      {mappableComps.map((comp) => (
                        <Marker
                          key={comp.id}
                          position={{ lat: parseFloat(comp.lat!), lng: parseFloat(comp.lng!) }}
                          icon={createMarkerIcon(comp, selectedComp?.id === comp.id)}
                          clusterer={clusterer}
                          onClick={() => setSelectedComp(comp)}
                          title={comp.marina}
                        />
                      ))}
                    </>
                  )}
                </MarkerClusterer>

                {selectedComp && selectedComp.lat && selectedComp.lng && (
                  <InfoWindow
                    position={{ lat: parseFloat(selectedComp.lat), lng: parseFloat(selectedComp.lng) }}
                    onCloseClick={() => setSelectedComp(null)}
                  >
                    <div className="p-1 min-w-[200px] sm:min-w-[260px] max-w-[calc(100vw-2rem)] sm:max-w-[340px]">
                      <div className="flex items-start gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                          style={{ backgroundColor: getPriceColor(selectedComp.salePrice) }}
                        />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm leading-tight">{selectedComp.marina}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[selectedComp.city, selectedComp.state].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-xs border-t pt-2 mt-1">
                        <div>
                          <span className="text-gray-500">Sale Price: </span>
                          <span className="font-semibold text-green-700">{formatCurrency(selectedComp.salePrice)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Sale Date: </span>
                          <span className="font-medium">{formatSaleDate(selectedComp.saleMonth, selectedComp.saleYear)}</span>
                        </div>
                        {selectedComp.wetSlips != null && (
                          <div>
                            <span className="text-gray-500">Wet Slips: </span>
                            <span className="font-medium">{selectedComp.wetSlips.toLocaleString()}</span>
                          </div>
                        )}
                        {selectedComp.dryRacks != null && (
                          <div>
                            <span className="text-gray-500">Dry Racks: </span>
                            <span className="font-medium">{selectedComp.dryRacks.toLocaleString()}</span>
                          </div>
                        )}
                        {selectedComp.salePrice && selectedComp.wetSlips && selectedComp.wetSlips > 0 && (
                          <div>
                            <span className="text-gray-500">$/Slip: </span>
                            <span className="font-medium">
                              {formatCurrency(Math.round(selectedComp.salePrice / selectedComp.wetSlips))}
                            </span>
                          </div>
                        )}
                        {selectedComp.capRate != null && selectedComp.capRate > 0 && (
                          <div>
                            <span className="text-gray-500">Cap Rate: </span>
                            <span className="font-medium">{(selectedComp.capRate / 100).toFixed(1)}%</span>
                          </div>
                        )}
                        {selectedComp.bodyOfWater && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Water Body: </span>
                            <span className="font-medium">{selectedComp.bodyOfWater}</span>
                          </div>
                        )}
                        {selectedComp.seller && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Seller: </span>
                            <span className="font-medium">{selectedComp.seller}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t">
                        <button
                          onClick={() => navigate(`/analysis/sales-comps/${selectedComp.id}`)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Full Details
                        </button>
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            )}

            {isLoading && (
              <div className="absolute top-3 left-3 bg-white dark:bg-slate-800 rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 z-10">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-xs font-medium">Loading sales comps...</span>
              </div>
            )}
          </div>

          {/* Side panel */}
          {viewMode === 'split' && (
            <div className="w-full md:w-[380px] border-l bg-white dark:bg-slate-900 flex flex-col overflow-hidden flex-shrink-0">
              {/* Stats section */}
              <div className="px-3 py-3 border-b bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold">Map Statistics</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Comps</p>
                    <p className="text-lg font-bold">{stats.total}</p>
                    <p className="text-[10px] text-muted-foreground">{stats.withCoordinates} on map</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Price</p>
                    <p className="text-lg font-bold text-green-600">
                      {stats.avgPrice > 0 ? formatCompactCurrency(stats.avgPrice) : 'N/A'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {stats.avgPricePerSlip > 0 ? `${formatCompactCurrency(stats.avgPricePerSlip)}/slip` : ''}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" /> Min
                    </p>
                    <p className="text-sm font-semibold">
                      {stats.minPrice > 0 ? formatCompactCurrency(stats.minPrice) : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Max
                    </p>
                    <p className="text-sm font-semibold">
                      {stats.maxPrice > 0 ? formatCompactCurrency(stats.maxPrice) : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* List header */}
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {filteredComps.length} Sales Comp{filteredComps.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setListExpanded(!listExpanded)}
                >
                  {listExpanded ? <X className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {/* List */}
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
                  ) : filteredComps.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-medium">No sales comps found</p>
                      <p className="text-xs mt-1">Try adjusting your filters</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredComps.map((comp) => {
                        const isActive = selectedComp?.id === comp.id;
                        const priceColor = getPriceColor(comp.salePrice);
                        return (
                          <button
                            key={comp.id}
                            className={cn(
                              "w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                              isActive && "bg-amber-50 dark:bg-amber-950/20 border-l-2 border-l-amber-500"
                            )}
                            onClick={() => focusOnComp(comp)}
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                                style={{ backgroundColor: priceColor }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium truncate">{comp.marina}</p>
                                  {!comp.lat && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 flex-shrink-0 text-amber-600 border-amber-300">
                                      No coords
                                    </Badge>
                                  )}
                                  {comp._source === 'global' && (
                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 flex-shrink-0">
                                      Global
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">
                                  {[comp.city, comp.state].filter(Boolean).join(', ') || comp.address || 'No location'}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                                  {comp.salePrice && (
                                    <span className="font-semibold" style={{ color: priceColor }}>
                                      {formatCurrency(comp.salePrice)}
                                    </span>
                                  )}
                                  {comp.saleYear && (
                                    <span className="text-muted-foreground flex items-center gap-0.5">
                                      <Calendar className="h-3 w-3" />
                                      {formatSaleDate(comp.saleMonth, comp.saleYear)}
                                    </span>
                                  )}
                                  {comp.wetSlips != null && comp.wetSlips > 0 && (
                                    <span className="text-muted-foreground">
                                      <Ship className="inline h-3 w-3 mr-0.5" />{comp.wetSlips} slips
                                    </span>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
