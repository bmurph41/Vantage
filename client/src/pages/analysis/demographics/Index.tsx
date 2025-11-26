import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLoadScript, Autocomplete } from "@react-google-maps/api";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Anchor, 
  Building2, 
  MapPin, 
  BarChart3,
  Activity,
  Briefcase,
  Home,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Search,
  Target,
  GraduationCap,
  PieChart,
  CircleDot,
  Globe,
  X,
  Plus
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";

interface EconomicIndicator {
  seriesId: string;
  name: string;
  category: 'population' | 'income' | 'employment' | 'housing';
  value: number | null;
  date: string | null;
  yoyChange: number | null;
  fiveYearCagr: number | null;
  dataPoints: Array<{ date: string; value: number }>;
}

interface MarketStats {
  stateCode: string;
  stateName: string;
  region: string | null;
  totalMarinas: number;
  totalWetSlips: number;
  totalDryRacks: number;
  transactionCount: number;
  avgSalePrice: number | null;
  medianSalePrice: number | null;
  avgPricePerSlip: number | null;
  medianPricePerSlip: number | null;
  avgCapRate: number | null;
  medianCapRate: number | null;
  priceGrowth1Yr: number | null;
  priceGrowth3Yr: number | null;
  priceGrowth5Yr: number | null;
  yearlyStats: Array<{
    year: number;
    txCount: number;
    avgPrice: number | null;
    avgPricePerSlip: number | null;
  }>;
}

interface DemographicsOverview {
  economicIndicators: EconomicIndicator[];
  marketStats: MarketStats;
  lastUpdated: string;
}

interface StateOption {
  code: string;
  name: string;
  hasData: boolean;
  transactionCount: number;
}

interface NationalOverview {
  totalTransactions: number;
  totalMarinas: number;
  avgPricePerSlip: number | null;
  topStates: Array<{ stateCode: string; stateName: string; transactionCount: number }>;
}

interface DemographicSummary {
  totalPopulation: number;
  totalMales?: number;
  totalFemales?: number;
  medianAge: number;
  medianAgeMale?: number;
  medianAgeFemale?: number;
  ageDistribution?: Record<string, number>;
  generationalCohorts?: Record<string, number>;
  medianHouseholdIncome: number;
  meanHouseholdIncome?: number;
  perCapitaIncome?: number;
  medianFamilyIncome?: number;
  incomeDistribution?: Record<string, number>;
  educationLevels?: Record<string, number>;
  employmentStats?: Record<string, number>;
  industryDistribution?: Record<string, number>;
  housingStats?: Record<string, number>;
  householdSize?: number;
  medianHomeValue?: number;
  raceEthnicity?: Record<string, number>;
  populationDensity?: number;
  geographicLevel?: string;
  fipsState?: string;
  fipsCounty?: string;
  fipsTract?: string;
}

interface LocationDemographicsResponse {
  location: { latitude: number; longitude: number; address?: string };
  radiusMiles: number | null;
  demographics: DemographicSummary;
  fetchedAt: string;
}

interface SelectedLocation {
  address: string;
  latitude: number;
  longitude: number;
  label?: string;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  return `$${Math.round(value).toLocaleString('en-US')}`;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat('en-US').format(Math.round(value));
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(2)}%`;
};

const TrendIndicator = ({ value }: { value: number | null }) => {
  if (value === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (value > 0) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
  if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'population': return <Users className="h-5 w-5" />;
    case 'income': return <DollarSign className="h-5 w-5" />;
    case 'employment': return <Briefcase className="h-5 w-5" />;
    case 'housing': return <Home className="h-5 w-5" />;
    default: return <Activity className="h-5 w-5" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'population': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'income': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'employment': return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
    case 'housing': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
};

function LocationDemographicsCard({ data, onRemove, label }: { 
  data: DemographicSummary; 
  onRemove?: () => void;
  label?: string;
}) {
  const stats = [
    { 
      label: "Population", 
      value: formatNumber(data.totalPopulation), 
      icon: Users, 
      color: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300" 
    },
    { 
      label: "Median Age", 
      value: data.medianAge ? `${data.medianAge.toFixed(1)} yrs` : "N/A", 
      icon: Users, 
      color: "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300" 
    },
    { 
      label: "Median Income", 
      value: formatCurrency(data.medianHouseholdIncome), 
      icon: DollarSign, 
      color: "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300" 
    },
    { 
      label: "Per Capita Income", 
      value: formatCurrency(data.perCapitaIncome), 
      icon: DollarSign, 
      color: "bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300" 
    },
    { 
      label: "Median Home Value", 
      value: formatCurrency(data.medianHomeValue), 
      icon: Home, 
      color: "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300" 
    },
    { 
      label: "Household Size", 
      value: data.householdSize ? `${data.householdSize.toFixed(1)}` : "N/A", 
      icon: Home, 
      color: "bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300" 
    },
  ];

  return (
    <Card className="relative">
      {onRemove && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-2 right-2 h-6 w-6 z-10"
          onClick={onRemove}
          data-testid="button-remove-location"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">{label || "Location Demographics"}</CardTitle>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {data.geographicLevel === 'tract' ? 'Census Tract' : 
             data.geographicLevel === 'county' ? 'County' : 'State'} Level
          </Badge>
          {data.fipsState && (
            <span>FIPS: {data.fipsState}{data.fipsCounty ? `-${data.fipsCounty}` : ''}{data.fipsTract ? `-${data.fipsTract}` : ''}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.map((stat, idx) => (
            <div key={idx} className={`p-3 rounded-lg ${stat.color} bg-opacity-10`}>
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="h-4 w-4" />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <div className="text-lg font-semibold">{stat.value}</div>
            </div>
          ))}
        </div>

        {data.educationLevels && Object.keys(data.educationLevels).length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Education Attainment
            </h4>
            <div className="space-y-2">
              {Object.entries(data.educationLevels)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 4)
                .map(([level, value]) => {
                  const total = Object.values(data.educationLevels!).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  return (
                    <div key={level} className="flex items-center gap-2 text-xs">
                      <span className="w-32 truncate text-muted-foreground">{level}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right">{formatPercent(pct)}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {data.incomeDistribution && Object.keys(data.incomeDistribution).length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Income Distribution
            </h4>
            <div className="space-y-2">
              {Object.entries(data.incomeDistribution)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([range, value]) => {
                  const total = Object.values(data.incomeDistribution!).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  return (
                    <div key={range} className="flex items-center gap-2 text-xs">
                      <span className="w-28 truncate text-muted-foreground">{range}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right">{formatPercent(pct)}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {data.raceEthnicity && Object.keys(data.raceEthnicity).length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Race & Ethnicity
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(data.raceEthnicity)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 6)
                .map(([group, value]) => {
                  const total = data.totalPopulation || 1;
                  const pct = (value / total) * 100;
                  return (
                    <div key={group} className="flex items-center justify-between">
                      <span className="text-muted-foreground truncate">{group}</span>
                      <span className="font-medium">{formatPercent(pct)}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const libraries: ("places")[] = ["places"];

function AddressSearchInput({ 
  onSelect, 
  placeholder = "Enter an address...",
  className = ""
}: { 
  onSelect: (location: SelectedLocation) => void;
  placeholder?: string;
  className?: string;
}) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState("");
  
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || "",
    libraries,
  });

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place?.geometry?.location) {
        onSelect({
          address: place.formatted_address || place.name || "",
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng()
        });
        setInputValue(place.formatted_address || place.name || "");
      }
    }
  }, [onSelect]);

  if (!apiKey) {
    return (
      <div className={`relative ${className}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Google Maps API key required..."
          disabled
          className="pl-9"
          data-testid="input-address-search"
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`relative ${className}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Error loading Google Maps..."
          disabled
          className="pl-9"
          data-testid="input-address-search"
        />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`relative ${className}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-pulse" />
        <Input
          type="text"
          placeholder="Loading..."
          disabled
          className="pl-9"
          data-testid="input-address-search"
        />
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
      <Autocomplete
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          types: ["address"],
          componentRestrictions: { country: "us" },
          fields: ["formatted_address", "geometry", "name"]
        }}
      >
        <Input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="pl-9"
          data-testid="input-address-search"
        />
      </Autocomplete>
    </div>
  );
}

function LocationAnalysisSection() {
  const [selectedLocations, setSelectedLocations] = useState<SelectedLocation[]>([]);
  const [locationData, setLocationData] = useState<Map<string, LocationDemographicsResponse>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [activeRadius, setActiveRadius] = useState<number | null>(null);

  const fetchDemographicsMutation = useMutation({
    mutationFn: async (location: SelectedLocation) => {
      const response = await apiRequest<LocationDemographicsResponse>('/api/demographics/location', {
        method: 'POST',
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          radiusMiles: activeRadius
        })
      });
      return { location, data: response };
    },
    onSuccess: ({ location, data }) => {
      const key = `${location.latitude},${location.longitude}`;
      setLocationData(prev => new Map(prev).set(key, data));
    }
  });

  const handleAddLocation = useCallback((location: SelectedLocation) => {
    if (selectedLocations.length >= 5) return;
    
    const exists = selectedLocations.some(
      l => l.latitude === location.latitude && l.longitude === location.longitude
    );
    if (exists) return;
    
    const newLocation = { ...location, label: `Location ${selectedLocations.length + 1}` };
    setSelectedLocations(prev => [...prev, newLocation]);
    fetchDemographicsMutation.mutate(newLocation);
  }, [selectedLocations, fetchDemographicsMutation]);

  const handleRemoveLocation = useCallback((index: number) => {
    const location = selectedLocations[index];
    const key = `${location.latitude},${location.longitude}`;
    setSelectedLocations(prev => prev.filter((_, i) => i !== index));
    setLocationData(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, [selectedLocations]);

  const radiusOptions = [
    { value: null, label: "Point Location" },
    { value: 1, label: "1 Mile Radius" },
    { value: 3, label: "3 Mile Radius" },
    { value: 5, label: "5 Mile Radius" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>Location-Based Demographics</CardTitle>
          </div>
          <CardDescription>
            Search for any U.S. address to analyze Census demographics. Add up to 5 locations to compare.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label className="text-sm mb-2 block">Search Address</Label>
              <AddressSearchInput 
                onSelect={handleAddLocation}
                placeholder="Enter a property address..."
              />
            </div>
            <div className="w-full md:w-48">
              <Label className="text-sm mb-2 block">Trade Area</Label>
              <Select 
                value={activeRadius?.toString() || "null"} 
                onValueChange={(v) => setActiveRadius(v === "null" ? null : parseInt(v))}
              >
                <SelectTrigger data-testid="select-radius-trigger">
                  <SelectValue placeholder="Select radius" />
                </SelectTrigger>
                <SelectContent>
                  {radiusOptions.map(opt => (
                    <SelectItem key={opt.label} value={opt.value?.toString() || "null"}>
                      <div className="flex items-center gap-2">
                        <CircleDot className="h-3 w-3" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedLocations.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {selectedLocations.map((loc, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="flex items-center gap-1 pr-1"
                >
                  <MapPin className="h-3 w-3" />
                  <span className="max-w-40 truncate">{loc.address || `Location ${idx + 1}`}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleRemoveLocation(idx)}
                    data-testid={`button-remove-location-${idx}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
              {selectedLocations.length < 5 && (
                <Badge variant="outline" className="text-muted-foreground">
                  <Plus className="h-3 w-3 mr-1" />
                  {5 - selectedLocations.length} more available
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {fetchDemographicsMutation.isPending && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Loading demographics...</span>
        </div>
      )}

      {selectedLocations.length === 0 && !fetchDemographicsMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No Locations Selected</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Search for an address above to view detailed Census demographics including population, income, education, and housing data.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedLocations.length > 0 && (
        <div className={`grid gap-4 ${
          selectedLocations.length === 1 ? 'grid-cols-1' :
          selectedLocations.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {selectedLocations.map((loc, idx) => {
            const key = `${loc.latitude},${loc.longitude}`;
            const data = locationData.get(key);
            
            if (!data) {
              return (
                <Card key={idx}>
                  <CardContent className="py-12 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </CardContent>
                </Card>
              );
            }
            
            return (
              <LocationDemographicsCard
                key={idx}
                data={data.demographics}
                label={loc.address}
                onRemove={() => handleRemoveLocation(idx)}
              />
            );
          })}
        </div>
      )}

      {selectedLocations.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Comparison Summary
            </CardTitle>
            <CardDescription>Key metrics comparison across selected locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Metric</th>
                    {selectedLocations.map((loc, idx) => (
                      <th key={idx} className="text-right py-2 px-3 font-medium max-w-32 truncate">
                        {loc.label || `Loc ${idx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Population", key: "totalPopulation", format: formatNumber },
                    { label: "Median Age", key: "medianAge", format: (v: number) => v ? `${v.toFixed(1)} yrs` : "N/A" },
                    { label: "Median Income", key: "medianHouseholdIncome", format: formatCurrency },
                    { label: "Per Capita Income", key: "perCapitaIncome", format: formatCurrency },
                    { label: "Median Home Value", key: "medianHomeValue", format: formatCurrency },
                    { label: "Household Size", key: "householdSize", format: (v: number) => v ? v.toFixed(1) : "N/A" },
                  ].map((metric, mIdx) => (
                    <tr key={mIdx} className="border-b border-muted hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium">{metric.label}</td>
                      {selectedLocations.map((loc, lIdx) => {
                        const key = `${loc.latitude},${loc.longitude}`;
                        const data = locationData.get(key);
                        const value = data?.demographics[metric.key as keyof DemographicSummary];
                        return (
                          <td key={lIdx} className="text-right py-2 px-3">
                            {metric.format(value as number)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DemographicsIndex() {
  const [selectedState, setSelectedState] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");
  const [viewMode, setViewMode] = useState<"state" | "location">("state");

  const { data: states, isLoading: statesLoading } = useQuery<StateOption[]>({
    queryKey: ['/api/demographics/states'],
  });

  const { data: nationalData, isLoading: nationalLoading } = useQuery<NationalOverview>({
    queryKey: ['/api/demographics/national'],
  });

  const { data: stateData, isLoading: stateLoading, error: stateError } = useQuery<DemographicsOverview>({
    queryKey: ['/api/demographics/overview', selectedState],
    enabled: !!selectedState,
  });

  const statesWithData = states?.filter(s => s.hasData) || [];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-demographics-title">
            Market Demographics
          </h1>
          <p className="text-muted-foreground text-sm" data-testid="text-demographics-description">
            Analyze regional economic indicators and marina market trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border p-1 bg-muted/30">
            <Button
              variant={viewMode === "state" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("state")}
              className="px-3"
              data-testid="button-view-state"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              State Analysis
            </Button>
            <Button
              variant={viewMode === "location" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("location")}
              className="px-3"
              data-testid="button-view-location"
            >
              <Target className="h-4 w-4 mr-2" />
              Location Analysis
            </Button>
          </div>
          {viewMode === "state" && (
            <div className="w-full md:w-64">
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger data-testid="select-state-trigger">
                  <SelectValue placeholder="Select a state..." />
                </SelectTrigger>
                <SelectContent>
                  {statesLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Loading states...</div>
                  ) : statesWithData.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No sales data available</div>
                  ) : (
                    statesWithData.map(state => (
                      <SelectItem key={state.code} value={state.code} data-testid={`select-state-${state.code}`}>
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{state.name}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {state.transactionCount} comps
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {viewMode === "location" ? (
        <LocationAnalysisSection />
      ) : !selectedState ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                National Overview
              </CardTitle>
              <CardDescription>
                Marina market summary across all states with sales data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {nationalLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : nationalData ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Building2 className="h-4 w-4" />
                      Total Transactions
                    </div>
                    <div className="text-2xl font-bold" data-testid="text-total-transactions">
                      {formatNumber(nationalData.totalTransactions)}
                    </div>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Anchor className="h-4 w-4" />
                      Marinas Tracked
                    </div>
                    <div className="text-2xl font-bold" data-testid="text-total-marinas">
                      {formatNumber(nationalData.totalMarinas)}
                    </div>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <DollarSign className="h-4 w-4" />
                      Avg Price Per Slip
                    </div>
                    <div className="text-2xl font-bold" data-testid="text-avg-pps">
                      {formatCurrency(nationalData.avgPricePerSlip)}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {nationalData && nationalData.topStates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Top States by Transaction Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nationalData.topStates.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="stateCode" width={40} />
                      <Tooltip 
                        formatter={(value: number) => [value, 'Transactions']}
                        labelFormatter={(label) => {
                          const state = nationalData.topStates.find(s => s.stateCode === label);
                          return state?.stateName || label;
                        }}
                      />
                      <Bar dataKey="transactionCount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a State to Explore</h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Choose a state from the dropdown above to view detailed economic indicators, 
                marina market statistics, and historical trends.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : stateLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : stateError ? (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load demographics data. Please try again.</p>
          </CardContent>
        </Card>
      ) : stateData ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="economic" data-testid="tab-economic">
              <TrendingUp className="h-4 w-4 mr-2" />
              Economic Indicators
            </TabsTrigger>
            <TabsTrigger value="market" data-testid="tab-market">
              <Anchor className="h-4 w-4 mr-2" />
              Marina Market
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="text-sm">
                {stateData.marketStats.stateName}
              </Badge>
              {stateData.marketStats.region && (
                <Badge variant="secondary" className="text-sm">
                  {stateData.marketStats.region} Region
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                Last updated: {new Date(stateData.lastUpdated).toLocaleDateString()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Marinas</p>
                      <p className="text-2xl font-bold" data-testid="text-state-marinas">
                        {formatNumber(stateData.marketStats.totalMarinas)}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Anchor className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Price/Slip</p>
                      <p className="text-2xl font-bold" data-testid="text-state-pps">
                        {formatCurrency(stateData.marketStats.avgPricePerSlip)}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendIndicator value={stateData.marketStats.priceGrowth1Yr} />
                        <span className={`text-xs ${(stateData.marketStats.priceGrowth1Yr || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stateData.marketStats.priceGrowth1Yr !== null ? `${stateData.marketStats.priceGrowth1Yr.toFixed(1)}% YoY` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-600 dark:text-green-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Median Cap Rate</p>
                      <p className="text-2xl font-bold" data-testid="text-state-caprate">
                        {formatPercent(stateData.marketStats.medianCapRate)}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                      <Activity className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Capacity</p>
                      <p className="text-2xl font-bold" data-testid="text-state-capacity">
                        {formatNumber(stateData.marketStats.totalWetSlips + stateData.marketStats.totalDryRacks)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(stateData.marketStats.totalWetSlips)} wet / {formatNumber(stateData.marketStats.totalDryRacks)} dry
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {stateData.marketStats.yearlyStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transaction History</CardTitle>
                  <CardDescription>Marina sales activity and pricing trends by year</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...stateData.marketStats.yearlyStats].reverse()}>
                        <defs>
                          <linearGradient id="colorTxCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatCurrency(v)} />
                        <Tooltip 
                          formatter={(value: number, name: string) => {
                            if (name === 'txCount') return [value, 'Transactions'];
                            if (name === 'avgPricePerSlip') return [formatCurrency(value), 'Avg $/Slip'];
                            return [value, name];
                          }}
                        />
                        <Legend />
                        <Area yAxisId="left" type="monotone" dataKey="txCount" name="Transactions" stroke="hsl(var(--primary))" fill="url(#colorTxCount)" />
                        <Line yAxisId="right" type="monotone" dataKey="avgPricePerSlip" name="Avg $/Slip" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="economic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Economic Indicators for {stateData.marketStats.stateName}
                </CardTitle>
                <CardDescription>
                  Regional economic data from the Federal Reserve (FRED)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stateData.economicIndicators.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Economic data not available for this state.</p>
                    <p className="text-sm mt-2">FRED API data may be loading or unavailable.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {stateData.economicIndicators.map((indicator) => (
                      <Card key={indicator.seriesId} className="border-0 shadow-sm bg-muted/30">
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getCategoryColor(indicator.category)}`}>
                              {getCategoryIcon(indicator.category)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{indicator.name}</p>
                              <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-xl font-bold" data-testid={`text-indicator-${indicator.category}`}>
                                  {indicator.category === 'income' 
                                    ? formatCurrency(indicator.value)
                                    : indicator.category === 'employment'
                                    ? formatPercent(indicator.value)
                                    : formatNumber(indicator.value)}
                                </span>
                                {indicator.yoyChange !== null && (
                                  <div className="flex items-center gap-1">
                                    <TrendIndicator value={indicator.yoyChange} />
                                    <span className={`text-xs ${indicator.yoyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {indicator.yoyChange.toFixed(1)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                              {indicator.date && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  As of {new Date(indicator.date).toLocaleDateString()}
                                </p>
                              )}
                              {indicator.fiveYearCagr !== null && (
                                <p className="text-xs text-muted-foreground">
                                  5-Year CAGR: {indicator.fiveYearCagr.toFixed(2)}%
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {stateData.economicIndicators.some(i => i.dataPoints.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Historical Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          type="category"
                          allowDuplicatedCategory={false}
                          tickFormatter={(v) => new Date(v).getFullYear().toString()}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(v) => new Date(v as string).toLocaleDateString()}
                        />
                        <Legend />
                        {stateData.economicIndicators
                          .filter(i => i.dataPoints.length > 0 && i.category !== 'population')
                          .slice(0, 3)
                          .map((indicator, idx) => (
                            <Line
                              key={indicator.seriesId}
                              data={[...indicator.dataPoints].reverse()}
                              type="monotone"
                              dataKey="value"
                              name={indicator.name.replace(stateData.marketStats.stateName + ' ', '')}
                              stroke={`hsl(var(--chart-${idx + 1}))`}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="market" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Supply Overview</CardTitle>
                  <CardDescription>Marina capacity in {stateData.marketStats.stateName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Anchor className="h-5 w-5 text-blue-600" />
                        <span className="font-medium">Total Marinas</span>
                      </div>
                      <span className="text-xl font-bold">{formatNumber(stateData.marketStats.totalMarinas)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded bg-blue-500" />
                        <span className="font-medium">Wet Slips</span>
                      </div>
                      <span className="text-xl font-bold">{formatNumber(stateData.marketStats.totalWetSlips)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded bg-amber-500" />
                        <span className="font-medium">Dry Racks</span>
                      </div>
                      <span className="text-xl font-bold">{formatNumber(stateData.marketStats.totalDryRacks)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pricing Metrics</CardTitle>
                  <CardDescription>Average and median transaction values</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Avg Sale Price</p>
                        <p className="text-lg font-bold">{formatCurrency(stateData.marketStats.avgSalePrice)}</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Median Sale Price</p>
                        <p className="text-lg font-bold">{formatCurrency(stateData.marketStats.medianSalePrice)}</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Avg $/Slip</p>
                        <p className="text-lg font-bold">{formatCurrency(stateData.marketStats.avgPricePerSlip)}</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Median $/Slip</p>
                        <p className="text-lg font-bold">{formatCurrency(stateData.marketStats.medianPricePerSlip)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Price Growth Trends</CardTitle>
                <CardDescription>Historical price per slip appreciation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">1-Year Growth</p>
                    <div className="flex items-center justify-center gap-2">
                      <TrendIndicator value={stateData.marketStats.priceGrowth1Yr} />
                      <span className={`text-2xl font-bold ${(stateData.marketStats.priceGrowth1Yr || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stateData.marketStats.priceGrowth1Yr !== null ? `${stateData.marketStats.priceGrowth1Yr.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">3-Year Growth</p>
                    <div className="flex items-center justify-center gap-2">
                      <TrendIndicator value={stateData.marketStats.priceGrowth3Yr} />
                      <span className={`text-2xl font-bold ${(stateData.marketStats.priceGrowth3Yr || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stateData.marketStats.priceGrowth3Yr !== null ? `${stateData.marketStats.priceGrowth3Yr.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">5-Year Growth</p>
                    <div className="flex items-center justify-center gap-2">
                      <TrendIndicator value={stateData.marketStats.priceGrowth5Yr} />
                      <span className={`text-2xl font-bold ${(stateData.marketStats.priceGrowth5Yr || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stateData.marketStats.priceGrowth5Yr !== null ? `${stateData.marketStats.priceGrowth5Yr.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {stateData.marketStats.yearlyStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Yearly Transaction Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Year</th>
                          <th className="text-right py-2 px-3 font-medium">Transactions</th>
                          <th className="text-right py-2 px-3 font-medium">Avg Price</th>
                          <th className="text-right py-2 px-3 font-medium">Avg $/Slip</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stateData.marketStats.yearlyStats.slice(0, 10).map((stat) => (
                          <tr key={stat.year} className="border-b border-muted">
                            <td className="py-2 px-3 font-medium">{stat.year}</td>
                            <td className="text-right py-2 px-3">{stat.txCount}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(stat.avgPrice)}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(stat.avgPricePerSlip)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
