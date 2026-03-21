import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, Marker, MarkerClusterer, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from '@/lib/google-maps-provider';
import { useLocation } from 'wouter';
import RateCompsHeader from '@/components/ratecomps/rate-comps/RateCompsHeader';
import {
  Search, MapPin, Loader2, BarChart3, X, DollarSign,
  TrendingUp, TrendingDown, Ship, ExternalLink,
  Maximize2, List, Filter, Calendar, Anchor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

const RATE_COLORS = [
  { min: 0, max: 500, color: '#22c55e', label: 'Under $500' },
  { min: 500, max: 1_000, color: '#3b82f6', label: '$500 - $1K' },
  { min: 1_000, max: 2_500, color: '#f59e0b', label: '$1K - $2.5K' },
  { min: 2_500, max: 5_000, color: '#ef4444', label: '$2.5K - $5K' },
  { min: 5_000, max: Infinity, color: '#7c3aed', label: '$5K+' },
];

function getRateColor(rate: number | null | undefined): string {
  if (!rate) return '#9ca3af';
  const bracket = RATE_COLORS.find(b => rate >= b.min && rate < b.max);
  return bracket?.color || '#9ca3af';
}

function getMarkerScale(rate: number | null | undefined): number {
  if (!rate) return 7;
  if (rate < 500) return 7;
  if (rate < 1_000) return 9;
  if (rate < 2_500) return 11;
  if (rate < 5_000) return 13;
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
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value}`;
}

interface RateComp {
  id: string;
  marina: string;
  rateAmount: number | null;
  rateType: string | null;
  seasonality: string | null;
  boatLengthMin: number | null;
  boatLengthMax: number | null;
  city: string | null;
  state: string | null;
  wetSlips: number | null;
  dryRacks: number | null;
  lat: string | null;
  lng: string | null;
  address: string | null;
  bodyOfWater: string | null;
  waterfront: string | null;
  occupancy: number | null;
  rateCollectionDate: string | null;
  rateSource: string | null;
  rateTrend: string | null;
  storageTypes: string[] | null;
  _source?: string;
}

export default function RateCompsMapView() {
  const [, navigate] = useLocation();
  const { isLoaded, loadError } = useGoogleMaps();
  const mapRef = useRef<google.maps.Map | null>(null);

  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [rateRange, setRateRange] = useState<[number, number]>([0, 10_000]);
  const [showRateFilter, setShowRateFilter] = useState(false);
  const [selectedComp, setSelectedComp] = useState<RateComp | null>(null);
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

  const { data, isLoading } = useQuery<{ comps: RateComp[]; total: number }>({
    queryKey: ['/api/rate-comps', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/rate-comps?${queryParams}`);
      if (!res.ok) throw new Error('Failed to fetch rate comps');
      return res.json();
    },
  });

  const allComps = data?.comps || [];

  const filteredComps = useMemo(() => {
    return allComps.filter(c => {
      if (rateRange[0] > 0 || rateRange[1] < 10_000) {
        const rate = c.rateAmount || 0;
        if (rate < rateRange[0] || rate > rateRange[1]) return false;
      }
      return true;
    });
  }, [allComps, rateRange]);

  const mappableComps = useMemo(() =>
    filteredComps.filter(c => c.lat != null && c.lng != null && parseFloat(c.lat) !== 0 && parseFloat(c.lng) !== 0),
    [filteredComps]
  );

  const stats = useMemo(() => {
    const withRate = filteredComps.filter(c => c.rateAmount && c.rateAmount > 0);
    const rates = withRate.map(c => c.rateAmount!);
    const totalSlips = filteredComps.reduce((sum, c) => sum + (c.wetSlips || 0), 0);
    const totalDryRacks = filteredComps.reduce((sum, c) => sum + (c.dryRacks || 0), 0);

    const byState: Record<string, number> = {};
    filteredComps.forEach(c => {
      if (c.state) byState[c.state] = (byState[c.state] || 0) + 1;
    });

    const byRateType: Record<string, number> = {};
    filteredComps.forEach(c => {
      if (c.rateType) byRateType[c.rateType] = (byRateType[c.rateType] || 0) + 1;
    });

    return {
      total: filteredComps.length,
      withCoordinates: mappableComps.length,
      avgRate: rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
      minRate: rates.length > 0 ? Math.min(...rates) : 0,
      maxRate: rates.length > 0 ? Math.max(...rates) : 0,
      medianRate: rates.length > 0
        ? [...rates].sort((a, b) => a - b)[Math.floor(rates.length / 2)]
        : 0,
      totalSlips,
      totalDryRacks,
      byState,
      byRateType,
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

  const createMarkerIcon = useCallback((comp: RateComp, isSelected: boolean): google.maps.Symbol => {
    const color = getRateColor(comp.rateAmount);
    const scale = isSelected ? getMarkerScale(comp.rateAmount) + 4 : getMarkerScale(comp.rateAmount);
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: isSelected ? 1 : 0.85,
      strokeColor: isSelected ? '#fff' : color,
      strokeWeight: isSelected ? 3 : 1.5,
      scale,
    };
  }, []);

  const focusOnComp = useCallback((comp: RateComp) => {
    setSelectedComp(comp);
    if (mapRef.current && comp.lat && comp.lng) {
      mapRef.current.panTo({ lat: parseFloat(comp.lat), lng: parseFloat(comp.lng) });
      mapRef.current.setZoom(14);
    }
  }, []);

  if (loadError) {
    return (
      <div>
        <RateCompsHeader />
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
      <RateCompsHeader />
      <div className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Toolbar */}
        <div className="px-3 py-2 border-b bg-white dark:bg-slate-900 flex items-center gap-2 flex-wrap">
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
            variant={showRateFilter ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-sm gap-1.5"
            onClick={() => setShowRateFilter(!showRateFilter)}
          >
            <Filter className="h-3.5 w-3.5" />
            Rate Filter
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

        {/* Rate range filter */}
        {showRateFilter && (
          <div className="px-4 py-3 border-b bg-slate-50 dark:bg-slate-800/50 flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium">Rate Range:</span>
            </div>
            <div className="flex-1 max-w-lg">
              <Slider
                min={0}
                max={10_000}
                step={50}
                value={rateRange}
                onValueChange={(v) => setRateRange(v as [number, number])}
                className="w-full"
              />
            </div>
            <span className="text-sm font-medium min-w-[160px] text-right">
              {formatCurrency(rateRange[0])} - {rateRange[1] >= 10_000 ? 'Any' : formatCurrency(rateRange[1])}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setRateRange([0, 10_000])}
            >
              Reset
            </Button>
          </div>
        )}

        {/* Color legend */}
        <div className="px-3 py-1.5 border-b bg-white dark:bg-slate-900 flex items-center gap-3 text-xs flex-wrap">
          <span className="text-muted-foreground font-medium">Rate Tiers:</span>
          {RATE_COLORS.map(bracket => (
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
            No Rate
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
                    <div className="p-1 min-w-[260px] max-w-[340px]">
                      <div className="flex items-start gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                          style={{ backgroundColor: getRateColor(selectedComp.rateAmount) }}
                        />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm leading-tight">{selectedComp.marina}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[selectedComp.city, selectedComp.state].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs border-t pt-2 mt-1">
                        <div>
                          <span className="text-gray-500">Rate: </span>
                          <span className="font-semibold text-green-700">{formatCurrency(selectedComp.rateAmount)}</span>
                        </div>
                        {selectedComp.rateType && (
                          <div>
                            <span className="text-gray-500">Type: </span>
                            <span className="font-medium">{selectedComp.rateType}</span>
                          </div>
                        )}
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
                        {selectedComp.seasonality && (
                          <div>
                            <span className="text-gray-500">Season: </span>
                            <span className="font-medium">{selectedComp.seasonality}</span>
                          </div>
                        )}
                        {selectedComp.occupancy != null && selectedComp.occupancy > 0 && (
                          <div>
                            <span className="text-gray-500">Occupancy: </span>
                            <span className="font-medium">{selectedComp.occupancy}%</span>
                          </div>
                        )}
                        {(selectedComp.boatLengthMin || selectedComp.boatLengthMax) && (
                          <div>
                            <span className="text-gray-500">Boat Length: </span>
                            <span className="font-medium">
                              {selectedComp.boatLengthMin || '?'}-{selectedComp.boatLengthMax || '?'} ft
                            </span>
                          </div>
                        )}
                        {selectedComp.rateTrend && (
                          <div>
                            <span className="text-gray-500">Trend: </span>
                            <span className="font-medium">{selectedComp.rateTrend}</span>
                          </div>
                        )}
                        {selectedComp.bodyOfWater && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Water Body: </span>
                            <span className="font-medium">{selectedComp.bodyOfWater}</span>
                          </div>
                        )}
                        {selectedComp.rateSource && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Source: </span>
                            <span className="font-medium">{selectedComp.rateSource}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t">
                        <button
                          onClick={() => navigate(`/analysis/rate-comps/${selectedComp.id}`)}
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
                <span className="text-xs font-medium">Loading rate comps...</span>
              </div>
            )}
          </div>

          {/* Side panel */}
          {viewMode === 'split' && (
            <div className="w-full md:w-[380px] border-l bg-white dark:bg-slate-900 flex flex-col overflow-hidden flex-shrink-0">
              {/* Stats section */}
              <div className="px-3 py-3 border-b bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold">Map Statistics</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Comps</p>
                    <p className="text-lg font-bold">{stats.total}</p>
                    <p className="text-[10px] text-muted-foreground">{stats.withCoordinates} on map</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Rate</p>
                    <p className="text-lg font-bold text-green-600">
                      {stats.avgRate > 0 ? formatCurrency(Math.round(stats.avgRate)) : 'N/A'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {stats.totalSlips > 0 ? `${stats.totalSlips.toLocaleString()} total slips` : ''}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" /> Min Rate
                    </p>
                    <p className="text-sm font-semibold">
                      {stats.minRate > 0 ? formatCurrency(stats.minRate) : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Max Rate
                    </p>
                    <p className="text-sm font-semibold">
                      {stats.maxRate > 0 ? formatCurrency(stats.maxRate) : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Rate type breakdown */}
                {Object.keys(stats.byRateType).length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">By Rate Type</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(stats.byRateType).map(([type, count]) => (
                        <Badge key={type} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {type}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* List header */}
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {filteredComps.length} Rate Comp{filteredComps.length !== 1 ? 's' : ''}
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
                      <p className="text-sm font-medium">No rate comps found</p>
                      <p className="text-xs mt-1">Try adjusting your filters</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredComps.map((comp) => {
                        const isActive = selectedComp?.id === comp.id;
                        const rateColor = getRateColor(comp.rateAmount);
                        return (
                          <button
                            key={comp.id}
                            className={cn(
                              "w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                              isActive && "bg-emerald-50 dark:bg-emerald-950/20 border-l-2 border-l-emerald-500"
                            )}
                            onClick={() => focusOnComp(comp)}
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                                style={{ backgroundColor: rateColor }}
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
                                  {comp.rateAmount && (
                                    <span className="font-semibold" style={{ color: rateColor }}>
                                      {formatCurrency(comp.rateAmount)}
                                    </span>
                                  )}
                                  {comp.rateType && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                      {comp.rateType}
                                    </Badge>
                                  )}
                                  {comp.wetSlips != null && comp.wetSlips > 0 && (
                                    <span className="text-muted-foreground">
                                      <Ship className="inline h-3 w-3 mr-0.5" />{comp.wetSlips} slips
                                    </span>
                                  )}
                                  {comp.dryRacks != null && comp.dryRacks > 0 && (
                                    <span className="text-muted-foreground">
                                      <Anchor className="inline h-3 w-3 mr-0.5" />{comp.dryRacks} racks
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
