import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLoadScript, Autocomplete } from "@react-google-maps/api";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  DollarSign, 
  MapPin, 
  BarChart3,
  Briefcase,
  Home,
  Search,
  GraduationCap,
  PieChart,
  CircleDot,
  Globe,
  X,
  Plus,
  Target,
  Activity,
  Clock,
  Car,
  Ruler
} from "lucide-react";

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

const formatLabel = (key: string): string => {
  const labelMap: Record<string, string> = {
    lessThanHighSchool: "Less Than High School",
    highSchool: "High School",
    someCollege: "Some College",
    bachelors: "Bachelor's Degree",
    graduate: "Graduate Degree",
    under25k: "Under $25K",
    "25kto50k": "$25K - $50K",
    "50kto75k": "$50K - $75K",
    "75kto100k": "$75K - $100K",
    "100kto150k": "$100K - $150K",
    over150k: "Over $150K",
    white: "White",
    black: "Black",
    asian: "Asian",
    hispanic: "Hispanic",
    americanIndian: "American Indian",
    pacificIslander: "Pacific Islander",
    twoOrMore: "Two or More Races",
    otherRace: "Other Race",
    agriculture: "Agriculture",
    construction: "Construction",
    manufacturing: "Manufacturing",
    wholesale: "Wholesale",
    retail: "Retail",
    transportation: "Transportation",
    information: "Information",
    finance: "Finance",
    professional: "Professional",
    education: "Education & Healthcare",
    arts: "Arts & Entertainment",
    otherServices: "Other Services",
    publicAdmin: "Public Administration",
  };
  
  if (labelMap[key]) return labelMap[key];
  
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
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
                .slice(0, 5)
                .map(([level, value]) => {
                  const total = Object.values(data.educationLevels!).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  return (
                    <div key={level} className="flex items-center gap-2 text-xs">
                      <span className="w-40 truncate text-muted-foreground">{formatLabel(level)}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-14 text-right">{formatPercent(pct)}</span>
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
                .slice(0, 6)
                .map(([range, value]) => {
                  const total = Object.values(data.incomeDistribution!).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  return (
                    <div key={range} className="flex items-center gap-2 text-xs">
                      <span className="w-28 truncate text-muted-foreground">{formatLabel(range)}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full" 
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-14 text-right">{formatPercent(pct)}</span>
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
                .map(([group, value]) => (
                  <div key={group} className="flex items-center justify-between">
                    <span className="text-muted-foreground truncate">{formatLabel(group)}</span>
                    <span className="font-medium">{formatPercent(value)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TradeAreaDemographicsDisplay({ data }: { data: DemographicSummary }) {
  const keyStats = [
    { label: "Population", value: formatNumber(data.totalPopulation), icon: Users, color: "text-blue-600" },
    { label: "Median Age", value: data.medianAge ? `${data.medianAge.toFixed(1)} yrs` : "N/A", icon: Users, color: "text-indigo-600" },
    { label: "Median Income", value: formatCurrency(data.medianHouseholdIncome), icon: DollarSign, color: "text-green-600" },
    { label: "Per Capita Income", value: formatCurrency(data.perCapitaIncome), icon: DollarSign, color: "text-emerald-600" },
    { label: "Home Value", value: formatCurrency(data.medianHomeValue), icon: Home, color: "text-purple-600" },
    { label: "Household Size", value: data.householdSize?.toFixed(1) || "N/A", icon: Home, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {keyStats.map((stat, idx) => (
          <div key={idx} className="p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 mb-1">
              <stat.icon className={`h-3 w-3 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className="text-sm font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.educationLevels && Object.keys(data.educationLevels).length > 0 && (
          <div>
            <h5 className="text-xs font-medium mb-2 flex items-center gap-1">
              <GraduationCap className="h-3 w-3" />
              Education
            </h5>
            <div className="space-y-1">
              {Object.entries(data.educationLevels)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 4)
                .map(([level, value]) => {
                  const total = Object.values(data.educationLevels!).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  return (
                    <div key={level} className="flex items-center gap-2 text-xs">
                      <span className="w-28 truncate text-muted-foreground">{formatLabel(level)}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 text-right text-muted-foreground">{formatPercent(pct)}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {data.incomeDistribution && Object.keys(data.incomeDistribution).length > 0 && (
          <div>
            <h5 className="text-xs font-medium mb-2 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Income Distribution
            </h5>
            <div className="space-y-1">
              {Object.entries(data.incomeDistribution)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 4)
                .map(([range, value]) => {
                  const total = Object.values(data.incomeDistribution!).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  return (
                    <div key={range} className="flex items-center gap-2 text-xs">
                      <span className="w-24 truncate text-muted-foreground">{formatLabel(range)}</span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 text-right text-muted-foreground">{formatPercent(pct)}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {data.raceEthnicity && Object.keys(data.raceEthnicity).length > 0 && (
        <div>
          <h5 className="text-xs font-medium mb-2 flex items-center gap-1">
            <PieChart className="h-3 w-3" />
            Race & Ethnicity
          </h5>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
            {Object.entries(data.raceEthnicity)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 6)
              .map(([group, value]) => (
                <div key={group} className="flex items-center justify-between">
                  <span className="text-muted-foreground truncate">{formatLabel(group)}</span>
                  <span className="font-medium">{formatPercent(value)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
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

interface TradeAreaData {
  radiusMiles: number;
  label: string;
  type: 'distance' | 'drivetime';
  demographics: DemographicSummary | null;
  isLoading: boolean;
}

const DISTANCE_RINGS = [
  { value: 1, label: "1 Mile" },
  { value: 3, label: "3 Miles" },
  { value: 5, label: "5 Miles" },
  { value: 10, label: "10 Miles" },
];

const DRIVE_TIMES = [
  { value: 5, label: "5 Min", estimatedMiles: 2.5 },
  { value: 10, label: "10 Min", estimatedMiles: 5 },
  { value: 15, label: "15 Min", estimatedMiles: 8 },
  { value: 20, label: "20 Min", estimatedMiles: 12 },
];

function LocationAnalysisSection() {
  const [selectedLocations, setSelectedLocations] = useState<SelectedLocation[]>([]);
  const [locationData, setLocationData] = useState<Map<string, Map<string, TradeAreaData>>>(new Map());
  const [selectedDistanceRings, setSelectedDistanceRings] = useState<number[]>([1]);
  const [selectedDriveTimes, setSelectedDriveTimes] = useState<number[]>([]);
  const [analysisMode, setAnalysisMode] = useState<'distance' | 'drivetime'>('distance');

  const fetchDemographicsMutation = useMutation({
    mutationFn: async ({ location, radiusMiles, tradeAreaKey }: { 
      location: SelectedLocation; 
      radiusMiles: number;
      tradeAreaKey: string;
    }) => {
      const response = await apiRequest('POST', '/api/demographics/location', {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
        radiusMiles: radiusMiles
      });
      const data = await response.json() as LocationDemographicsResponse;
      return { location, data, tradeAreaKey };
    },
    onSuccess: ({ location, data, tradeAreaKey }) => {
      const locationKey = `${location.latitude},${location.longitude}`;
      setLocationData(prev => {
        const next = new Map(prev);
        const locationMap = next.get(locationKey) || new Map();
        const existingData = locationMap.get(tradeAreaKey);
        if (existingData) {
          locationMap.set(tradeAreaKey, {
            ...existingData,
            demographics: data.demographics,
            isLoading: false
          });
        }
        next.set(locationKey, locationMap);
        return next;
      });
    }
  });

  const fetchAllTradeAreas = useCallback((location: SelectedLocation) => {
    const locationKey = `${location.latitude},${location.longitude}`;
    const tradeAreas = new Map<string, TradeAreaData>();
    
    if (analysisMode === 'distance') {
      selectedDistanceRings.forEach(miles => {
        const key = `distance-${miles}`;
        tradeAreas.set(key, {
          radiusMiles: miles,
          label: `${miles} Mile Radius`,
          type: 'distance',
          demographics: null,
          isLoading: true
        });
        fetchDemographicsMutation.mutate({ 
          location, 
          radiusMiles: miles, 
          tradeAreaKey: key 
        });
      });
    } else {
      selectedDriveTimes.forEach(minutes => {
        const driveTime = DRIVE_TIMES.find(d => d.value === minutes);
        if (driveTime) {
          const key = `drivetime-${minutes}`;
          tradeAreas.set(key, {
            radiusMiles: driveTime.estimatedMiles,
            label: `${minutes} Min Drive`,
            type: 'drivetime',
            demographics: null,
            isLoading: true
          });
          fetchDemographicsMutation.mutate({ 
            location, 
            radiusMiles: driveTime.estimatedMiles, 
            tradeAreaKey: key 
          });
        }
      });
    }
    
    setLocationData(prev => new Map(prev).set(locationKey, tradeAreas));
  }, [analysisMode, selectedDistanceRings, selectedDriveTimes, fetchDemographicsMutation]);

  const handleAddLocation = useCallback((location: SelectedLocation) => {
    if (selectedLocations.length >= 5) return;
    
    const hasSelection = analysisMode === 'distance' 
      ? selectedDistanceRings.length > 0 
      : selectedDriveTimes.length > 0;
    
    if (!hasSelection) return;
    
    const exists = selectedLocations.some(
      l => l.latitude === location.latitude && l.longitude === location.longitude
    );
    if (exists) return;
    
    const newLocation = { ...location, label: `Location ${selectedLocations.length + 1}` };
    setSelectedLocations(prev => [...prev, newLocation]);
    fetchAllTradeAreas(newLocation);
  }, [selectedLocations, analysisMode, selectedDistanceRings, selectedDriveTimes, fetchAllTradeAreas]);

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

  const toggleDistanceRing = (miles: number) => {
    setSelectedDistanceRings(prev => {
      if (prev.includes(miles)) {
        return prev.filter(m => m !== miles);
      }
      return [...prev, miles].sort((a, b) => a - b);
    });
  };

  const toggleDriveTime = (minutes: number) => {
    setSelectedDriveTimes(prev => {
      if (prev.includes(minutes)) {
        return prev.filter(m => m !== minutes);
      }
      if (prev.length >= 3) return prev;
      return [...prev, minutes].sort((a, b) => a - b);
    });
  };

  const getLocationTradeAreas = (location: SelectedLocation): TradeAreaData[] => {
    const key = `${location.latitude},${location.longitude}`;
    const areaMap = locationData.get(key);
    if (!areaMap) return [];
    return Array.from(areaMap.values());
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>Location-Based Demographics</CardTitle>
          </div>
          <CardDescription>
            Search for any U.S. address to analyze Census demographics with distance rings or drive times.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={analysisMode} onValueChange={(v) => setAnalysisMode(v as 'distance' | 'drivetime')}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="distance" className="flex items-center gap-2" data-testid="tab-distance">
                <Ruler className="h-4 w-4" />
                Distance Rings
              </TabsTrigger>
              <TabsTrigger value="drivetime" className="flex items-center gap-2" data-testid="tab-drivetime">
                <Car className="h-4 w-4" />
                Drive Time
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="distance" className="mt-4">
              <div className="space-y-3">
                <Label className="text-sm">Select Distance Rings</Label>
                <div className="flex flex-wrap gap-3">
                  {DISTANCE_RINGS.map(ring => (
                    <div key={ring.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`ring-${ring.value}`}
                        checked={selectedDistanceRings.includes(ring.value)}
                        onCheckedChange={() => toggleDistanceRing(ring.value)}
                        data-testid={`checkbox-distance-${ring.value}`}
                      />
                      <label
                        htmlFor={`ring-${ring.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1"
                      >
                        <CircleDot className="h-3 w-3 text-primary" />
                        {ring.label}
                      </label>
                    </div>
                  ))}
                </div>
                {selectedDistanceRings.length === 0 && (
                  <p className="text-xs text-amber-600">Select at least one distance ring</p>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="drivetime" className="mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Select Drive Times (up to 3)</Label>
                  <span className="text-xs text-muted-foreground">{selectedDriveTimes.length}/3 selected</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {DRIVE_TIMES.map(time => (
                    <div key={time.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`time-${time.value}`}
                        checked={selectedDriveTimes.includes(time.value)}
                        onCheckedChange={() => toggleDriveTime(time.value)}
                        disabled={!selectedDriveTimes.includes(time.value) && selectedDriveTimes.length >= 3}
                        data-testid={`checkbox-drivetime-${time.value}`}
                      />
                      <label
                        htmlFor={`time-${time.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-1"
                      >
                        <Clock className="h-3 w-3 text-blue-500" />
                        {time.label}
                        <span className="text-xs text-muted-foreground">(~{time.estimatedMiles} mi)</span>
                      </label>
                    </div>
                  ))}
                </div>
                {selectedDriveTimes.length === 0 && (
                  <p className="text-xs text-amber-600">Select at least one drive time</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Drive times are estimated based on typical suburban driving conditions (~30 mph average).
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="pt-4 border-t">
            <Label className="text-sm mb-2 block">Search Address</Label>
            <AddressSearchInput 
              onSelect={handleAddLocation}
              placeholder="Enter a property address..."
            />
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

      {selectedLocations.length > 0 && selectedLocations.map((loc, locIdx) => {
        const tradeAreas = getLocationTradeAreas(loc);
        const hasLoading = tradeAreas.some(ta => ta.isLoading);
        const loadedAreas = tradeAreas.filter(ta => ta.demographics);
        
        return (
          <Card key={locIdx} className="overflow-hidden">
            <CardHeader className="bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">{loc.address}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleRemoveLocation(locIdx)}
                  data-testid={`button-remove-card-${locIdx}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                {tradeAreas.map((ta, taIdx) => (
                  <Badge 
                    key={taIdx} 
                    variant={ta.isLoading ? "outline" : "secondary"}
                    className="text-xs"
                  >
                    {ta.type === 'distance' ? (
                      <CircleDot className="h-3 w-3 mr-1" />
                    ) : (
                      <Clock className="h-3 w-3 mr-1" />
                    )}
                    {ta.label}
                    {ta.isLoading && <span className="ml-1 animate-pulse">...</span>}
                  </Badge>
                ))}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {hasLoading && loadedAreas.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Loading demographics...</span>
                </div>
              )}
              
              {loadedAreas.length > 0 && (
                <div className="space-y-6">
                  {loadedAreas.map((tradeArea, taIdx) => (
                    <div key={taIdx} className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        {tradeArea.type === 'distance' ? (
                          <CircleDot className="h-4 w-4 text-primary" />
                        ) : (
                          <Clock className="h-4 w-4 text-blue-500" />
                        )}
                        <span className="font-medium text-sm">{tradeArea.label}</span>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {tradeArea.radiusMiles} mile radius
                        </Badge>
                      </div>
                      
                      {tradeArea.demographics && (
                        <TradeAreaDemographicsDisplay data={tradeArea.demographics} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {selectedLocations.length >= 2 && (() => {
        const firstTradeAreaKey = analysisMode === 'distance' 
          ? `distance-${selectedDistanceRings[0]}` 
          : `drivetime-${selectedDriveTimes[0]}`;
        
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Comparison Summary
              </CardTitle>
              <CardDescription>Key metrics comparison across selected locations (first trade area)</CardDescription>
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
                          const locKey = `${loc.latitude},${loc.longitude}`;
                          const areaMap = locationData.get(locKey);
                          const tradeArea = areaMap?.get(firstTradeAreaKey);
                          const value = tradeArea?.demographics?.[metric.key as keyof DemographicSummary];
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
        );
      })()}
    </div>
  );
}

export default function DemographicsIndex() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-demographics-title">
            Location Demographics
          </h1>
          <p className="text-muted-foreground text-sm" data-testid="text-demographics-description">
            Analyze Census demographics for any U.S. property address
          </p>
        </div>
      </div>

      <LocationAnalysisSection />
    </div>
  );
}
