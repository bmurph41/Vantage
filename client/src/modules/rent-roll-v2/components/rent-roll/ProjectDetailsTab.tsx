import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Trash2, RefreshCw } from "lucide-react";
import LocationsTable from "../locations/LocationsTable";
import LocationFormDrawer from "../locations/LocationFormDrawer";
import CustomTypesManagement from "./CustomTypesManagement";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { resetProject, type ResetProjectResult } from "../../lib/rentRollApi";

interface ProjectDetailsTabProps {
  locationId: string;
}

interface ProjectDetailsConfig {
  projectId: string;
  enabledStorageTypes: string[];
  dualSeasonStorageTypes: string[];
  enabledRateTypes: string[];
  enabledContractTerms: string[];
  enabledSlipStatuses: string[];
}

interface MarinaLocation {
  id: string;
  name: string;
  projectType: 'OWNED' | 'DEAL';
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  winterStartDate: string | null;
  winterEndDate: string | null;
  baseRent1Label: string | null;
  baseRent2Label: string | null;
  baseRent3Label: string | null;
  charge1Label: string | null;
  charge2Label: string | null;
  charge3Label: string | null;
  budgetedRevenue: string | null;
  budgetedOccupancy: string | null;
  budgetedExpenses: string | null;
  budgetYear: number | null;
}

const BUILT_IN_STORAGE_TYPES = [
  'Wet Slip',
  'Lift Slip',
  'Mooring',
  'Jet Ski',
  'Dry Rack - Indoor',
  'Dry Rack - Outdoor',
  'Houseboat',
  'Land Storage',
  'Boat on Trailer',
  'Trailer Only',
  'Carport',
  'RV Site',
];

const RATE_TYPES = [
  '$/ft./mo.',
  '$/ft./season',
  '$/ft./yr.',
  '$/mo.',
  '$/season',
  '$/yr.',
  '$/SF',
  'Flat Fee',
];

const CONTRACT_TERMS = [
  'Annual',
  'Seasonal/Summer',
  '6-Months',
  '3-Months',
  'Winter',
  'Monthly',
  'Weekly',
  'Daily/Nightly',
];

const SLIP_STATUS = [
  'Occupied',
  'Vacant',
  'Unusable',
  'Liveaboard',
  'Service',
  'Sales',
  'Occupied; Not-Paying',
  'Small Boat/Dinghy',
  'Commercial',
  'Rental Boat',
  'Boat Club',
  'Transient',
];

export function ProjectDetailsTab({ locationId }: ProjectDetailsTabProps) {
  const { toast } = useToast();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to normalize dates to MM/DD format
  const normalizeDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    // If already in MM/DD format, return as is
    if (/^\d{2}\/\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    // If in MM-DD format (legacy), convert to MM/DD
    if (/^\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr.replace('-', '/');
    }
    // If in YYYY-MM-DD or full date format, extract MM/DD
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}/${day}`;
    } catch {
      return '';
    }
  };

  // Fetch project details configuration
  const { data: config, isLoading } = useQuery<ProjectDetailsConfig>({
    queryKey: [`/api/rent-roll/locations/${locationId}/details-config`],
    enabled: !!locationId,
  });

  // Fetch location data for season dates
  const { data: location, isLoading: locationLoading } = useQuery<MarinaLocation>({
    queryKey: [`/api/rent-roll/locations/${locationId}`],
    enabled: !!locationId,
  });

  // Fetch custom storage types
  const { data: customTypes = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/rent-roll/custom-storage-types'],
  });

  // Fetch custom contract terms
  const { data: customContractTerms = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/rent-roll/custom-contract-terms'],
  });

  // Fetch storage locations for this project (with capacity and storage type for summary)
  const { data: storageLocations = [] } = useQuery<Array<{ 
    id: string; 
    name: string; 
    storageType: string | null;
    capacity: number | null;
    isActive: boolean 
  }>>({
    queryKey: ['/api/rent-roll/storage-locations', { projectId: locationId }],
    enabled: !!locationId,
  });

  // Calculate capacity summary
  const capacitySummary = storageLocations.reduce((acc, loc) => {
    if (loc.isActive) {
      acc.total += loc.capacity || 0;
      const storageType = loc.storageType || 'Unassigned';
      if (!acc.byType[storageType]) {
        acc.byType[storageType] = 0;
      }
      acc.byType[storageType] += loc.capacity || 0;
    }
    return acc;
  }, { total: 0, byType: {} as Record<string, number> });

  // Combine built-in and custom storage types
  const allStorageTypes = [
    ...BUILT_IN_STORAGE_TYPES,
    ...customTypes.map(t => t.name).sort(),
  ];

  // Combine built-in and custom contract terms
  const allContractTerms = [
    ...CONTRACT_TERMS,
    ...customContractTerms.map(t => t.name).sort(),
  ];

  // Local state for checkboxes
  const [enabledStorageTypes, setEnabledStorageTypes] = useState<string[]>([]);
  const [dualSeasonStorageTypes, setDualSeasonStorageTypes] = useState<string[]>([]);
  const [enabledRateTypes, setEnabledRateTypes] = useState<string[]>([]);
  const [enabledContractTerms, setEnabledContractTerms] = useState<string[]>([]);
  const [enabledSlipStatuses, setEnabledSlipStatuses] = useState<string[]>([]);

  // Local state for boating season
  const [seasonType, setSeasonType] = useState<'annual' | 'seasonal'>('annual');
  const [summerStartDate, setSummerStartDate] = useState('');
  const [summerEndDate, setSummerEndDate] = useState('');
  const [winterStartDate, setWinterStartDate] = useState('');
  const [winterEndDate, setWinterEndDate] = useState('');

  // Local state for base rent labels
  const [baseRent1Label, setBaseRent1Label] = useState('');
  const [baseRent2Label, setBaseRent2Label] = useState('');
  const [baseRent3Label, setBaseRent3Label] = useState('');
  
  // Local state for charge labels
  const [charge1Label, setCharge1Label] = useState('');
  const [charge2Label, setCharge2Label] = useState('');
  const [charge3Label, setCharge3Label] = useState('');

  // Local state for budget tracking
  const [budgetedRevenue, setBudgetedRevenue] = useState('');
  const [budgetedOccupancy, setBudgetedOccupancy] = useState('');
  const [budgetedExpenses, setBudgetedExpenses] = useState('');
  const [budgetYear, setBudgetYear] = useState<string>('');

  // Local state for location drawer
  const [isLocationDrawerOpen, setIsLocationDrawerOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // Local state for reset dialog
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');

  // Update local state when config loads
  useEffect(() => {
    if (config) {
      setEnabledStorageTypes(config.enabledStorageTypes || []);
      setDualSeasonStorageTypes(config.dualSeasonStorageTypes || []);
      setEnabledRateTypes(config.enabledRateTypes || []);
      setEnabledContractTerms(config.enabledContractTerms || []);
      setEnabledSlipStatuses(config.enabledSlipStatuses || []);
    }
  }, [config]);

  // Update season state and charge labels when location data loads
  useEffect(() => {
    if (location) {
      // Use database field for seasonType, defaulting to 'annual'
      setSeasonType((location as any).seasonType === 'SEASONAL' ? 'seasonal' : 'annual');
      setSummerStartDate(normalizeDate(location.seasonStartDate));
      setSummerEndDate(normalizeDate(location.seasonEndDate));
      setWinterStartDate(normalizeDate(location.winterStartDate));
      setWinterEndDate(normalizeDate(location.winterEndDate));
      
      // Initialize base rent labels
      setBaseRent1Label(location.baseRent1Label || '');
      setBaseRent2Label(location.baseRent2Label || '');
      setBaseRent3Label(location.baseRent3Label || '');
      
      // Initialize charge labels
      setCharge1Label(location.charge1Label || '');
      setCharge2Label(location.charge2Label || '');
      setCharge3Label(location.charge3Label || '');
      
      // Initialize budget fields
      setBudgetedRevenue(location.budgetedRevenue || '');
      setBudgetedOccupancy(location.budgetedOccupancy || '');
      setBudgetedExpenses(location.budgetedExpenses || '');
      setBudgetYear(location.budgetYear?.toString() || new Date().getFullYear().toString());
    }
  }, [location]);

  // Auto-calculate winter dates whenever summer dates change
  useEffect(() => {
    if (seasonType === 'seasonal') {
      let winterStartChanged = false;
      let winterEndChanged = false;
      let newWinterStart = winterStartDate;
      let newWinterEnd = winterEndDate;

      // Calculate winter start from summer end
      if (summerEndDate && /^\d{2}\/\d{2}$/.test(summerEndDate)) {
        const calculated = addDays(summerEndDate, 1);
        if (calculated && calculated !== winterStartDate) {
          newWinterStart = calculated;
          winterStartChanged = true;
        }
      }

      // Calculate winter end from summer start
      if (summerStartDate && /^\d{2}\/\d{2}$/.test(summerStartDate)) {
        const calculated = addDays(summerStartDate, -1);
        if (calculated && calculated !== winterEndDate) {
          newWinterEnd = calculated;
          winterEndChanged = true;
        }
      }

      // Update state if winter dates changed
      if (winterStartChanged) {
        setWinterStartDate(newWinterStart);
      }
      if (winterEndChanged) {
        setWinterEndDate(newWinterEnd);
      }

      // Save to database if winter dates changed
      if (winterStartChanged || winterEndChanged) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          updateLocationMutation.mutate({
            winterStartDate: newWinterStart || null,
            winterEndDate: newWinterEnd || null,
          });
        }, 1000);
      }
    }
  }, [summerStartDate, summerEndDate, seasonType]);

  // Cleanup pending debounced saves on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Mutation to update configuration
  const updateConfigMutation = useMutation({
    mutationFn: async (data: {
      enabledStorageTypes: string[];
      dualSeasonStorageTypes: string[];
      enabledRateTypes: string[];
      enabledContractTerms: string[];
      enabledSlipStatuses: string[];
    }) => {
      return apiRequest('PUT', `/api/rent-roll/locations/${locationId}/details-config`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rent-roll/locations/${locationId}/details-config`] });
      toast({
        title: "Configuration updated",
        description: "Project details configuration has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating configuration",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to sync capacity from storage locations
  const syncCapacityMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/rent-roll/locations/${locationId}/sync-capacity`, {});
      return response.json() as Promise<{ capacity: number; storageLocationsCount: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/rent-roll/locations/${locationId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/project-hub-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/executive-dashboard'] });
      toast({
        title: "Capacity synced",
        description: `Project capacity updated to ${data.capacity} from ${data.storageLocationsCount} storage locations.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error syncing capacity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle checkbox changes with auto-save
  const handleStorageTypeToggle = (type: string) => {
    const newTypes = enabledStorageTypes.includes(type)
      ? enabledStorageTypes.filter(t => t !== type)
      : [...enabledStorageTypes, type];
    
    setEnabledStorageTypes(newTypes);
    updateConfigMutation.mutate({
      enabledStorageTypes: newTypes,
      dualSeasonStorageTypes,
      enabledRateTypes,
      enabledContractTerms,
      enabledSlipStatuses,
    });
  };

  const handleDualSeasonToggle = (type: string) => {
    const newTypes = dualSeasonStorageTypes.includes(type)
      ? dualSeasonStorageTypes.filter(t => t !== type)
      : [...dualSeasonStorageTypes, type];
    
    setDualSeasonStorageTypes(newTypes);
    updateConfigMutation.mutate({
      enabledStorageTypes,
      dualSeasonStorageTypes: newTypes,
      enabledRateTypes,
      enabledContractTerms,
      enabledSlipStatuses,
    });
  };

  const handleRateTypeToggle = (type: string) => {
    const newTypes = enabledRateTypes.includes(type)
      ? enabledRateTypes.filter(t => t !== type)
      : [...enabledRateTypes, type];
    
    setEnabledRateTypes(newTypes);
    updateConfigMutation.mutate({
      enabledStorageTypes,
      dualSeasonStorageTypes,
      enabledRateTypes: newTypes,
      enabledContractTerms,
      enabledSlipStatuses,
    });
  };

  const handleContractTermToggle = (term: string) => {
    const newTerms = enabledContractTerms.includes(term)
      ? enabledContractTerms.filter(t => t !== term)
      : [...enabledContractTerms, term];
    
    setEnabledContractTerms(newTerms);
    updateConfigMutation.mutate({
      enabledStorageTypes,
      dualSeasonStorageTypes,
      enabledRateTypes,
      enabledContractTerms: newTerms,
      enabledSlipStatuses,
    });
  };

  const handleSlipStatusToggle = (status: string) => {
    const newStatuses = enabledSlipStatuses.includes(status)
      ? enabledSlipStatuses.filter(s => s !== status)
      : [...enabledSlipStatuses, status];
    
    setEnabledSlipStatuses(newStatuses);
    updateConfigMutation.mutate({
      enabledStorageTypes,
      dualSeasonStorageTypes,
      enabledRateTypes,
      enabledContractTerms,
      enabledSlipStatuses: newStatuses,
    });
  };

  // Handle project type change
  const handleProjectTypeChange = (type: 'OWNED' | 'DEAL') => {
    updateLocationMutation.mutate({ projectType: type });
    toast({
      title: "Project type updated",
      description: `Project set as ${type === 'OWNED' ? 'Owned Marina' : 'Deal Evaluation'}`,
    });
  };

  // Consolidated mutation to update location data (preserves all fields)
  const updateLocationMutation = useMutation({
    mutationFn: async (data: Partial<MarinaLocation>) => {
      return apiRequest('PUT', `/api/rent-roll/locations/${locationId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/rent-roll/locations/${locationId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle season type change
  const handleSeasonTypeChange = (type: 'annual' | 'seasonal') => {
    // Cancel any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    setSeasonType(type);
    if (type === 'annual') {
      // Clear all season dates when switching to annual
      setSummerStartDate('');
      setSummerEndDate('');
      setWinterStartDate('');
      setWinterEndDate('');
      
      // Send seasonType and clear season date fields
      updateLocationMutation.mutate({
        seasonType: 'ANNUAL' as any,
        seasonStartDate: null,
        seasonEndDate: null,
        winterStartDate: null,
        winterEndDate: null,
      });
      toast({
        title: "Boating season updated",
        description: "Set to Annual - occupancy will use raw capacity.",
      });
    } else {
      // Save seasonType as SEASONAL
      updateLocationMutation.mutate({
        seasonType: 'SEASONAL' as any,
      });
      toast({
        title: "Boating season updated",
        description: "Set to Seasonal - occupancy will use summer/winter slot-seasons.",
      });
    }
  };

  // Handle label save (both base rent and charge labels)
  const handleSaveLabels = () => {
    // Send all label fields (partial update preserves other fields)
    updateLocationMutation.mutate({
      baseRent1Label: baseRent1Label || 'Base Rent 1',
      baseRent2Label: baseRent2Label || 'Base Rent 2',
      baseRent3Label: baseRent3Label || 'Base Rent 3',
      charge1Label: charge1Label || 'Charge 1',
      charge2Label: charge2Label || 'Charge 2',
      charge3Label: charge3Label || 'Charge 3',
    });
    toast({
      title: "Column labels updated",
      description: "Base rent and additional charge labels have been saved.",
    });
  };

  // Handle budget save
  const handleSaveBudget = () => {
    updateLocationMutation.mutate({
      budgetedRevenue: budgetedRevenue ? parseFloat(budgetedRevenue.replace(/,/g, '')).toString() : null,
      budgetedOccupancy: budgetedOccupancy ? parseFloat(budgetedOccupancy).toString() : null,
      budgetedExpenses: budgetedExpenses ? parseFloat(budgetedExpenses.replace(/,/g, '')).toString() : null,
      budgetYear: budgetYear ? parseInt(budgetYear) : null,
    } as any);
    toast({
      title: "Budget updated",
      description: `Budget targets for ${budgetYear || 'current year'} have been saved.`,
    });
  };

  // Helper functions for MM/DD date calculations
  const addDays = (mmddStr: string, days: number): string => {
    if (!mmddStr || !/^\d{2}\/\d{2}$/.test(mmddStr)) return '';
    
    // Use a leap year (2024) to handle Feb 29th correctly
    const [month, day] = mmddStr.split('/').map(Number);
    const date = new Date(2024, month - 1, day);
    date.setDate(date.getDate() + days);
    
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    const newDay = String(date.getDate()).padStart(2, '0');
    return `${newMonth}/${newDay}`;
  };

  // Handle season date updates with debouncing
  const handleSeasonDateChange = (field: 'summer-start' | 'summer-end' | 'winter-start' | 'winter-end', value: string) => {
    let newSummerStart = summerStartDate;
    let newSummerEnd = summerEndDate;
    let newWinterStart = winterStartDate;
    let newWinterEnd = winterEndDate;

    // Update local state immediately for responsive UI
    switch (field) {
      case 'summer-start':
        newSummerStart = value;
        setSummerStartDate(value);
        // Auto-calculate winter end: day before summer start
        if (value) {
          newWinterEnd = addDays(value, -1);
          setWinterEndDate(newWinterEnd);
        }
        break;
      case 'summer-end':
        newSummerEnd = value;
        setSummerEndDate(value);
        // Auto-calculate winter start: day after summer end
        if (value) {
          newWinterStart = addDays(value, 1);
          setWinterStartDate(newWinterStart);
        }
        break;
      case 'winter-start':
        newWinterStart = value;
        setWinterStartDate(value);
        break;
      case 'winter-end':
        newWinterEnd = value;
        setWinterEndDate(value);
        break;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the API call
    saveTimeoutRef.current = setTimeout(() => {
      // Send only season date fields (partial update preserves other fields)
      const payload = {
        seasonStartDate: newSummerStart || null,
        seasonEndDate: newSummerEnd || null,
        winterStartDate: newWinterStart || null,
        winterEndDate: newWinterEnd || null,
      };
      updateLocationMutation.mutate(payload);
      toast({
        title: "Boating season updated",
        description: "Season dates have been saved.",
      });
    }, 1000); // 1 second debounce
  };

  // Handle location management
  const handleEditLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    setIsLocationDrawerOpen(true);
  };

  const handleNewLocation = () => {
    setSelectedLocationId(null);
    setIsLocationDrawerOpen(true);
  };

  const handleCloseLocationDrawer = () => {
    setIsLocationDrawerOpen(false);
    setSelectedLocationId(null);
    queryClient.removeQueries({ queryKey: ["/api/rent-roll/locations", selectedLocationId] });
  };

  // Reset project data mutation
  const resetProjectMutation = useMutation({
    mutationFn: async () => {
      if (!location?.name) throw new Error("Project name not found");
      return await resetProject(locationId, confirmationInput);
    },
    onSuccess: (result: ResetProjectResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll"] });
      setIsResetDialogOpen(false);
      setConfirmationInput('');
      toast({
        title: "Project reset successful",
        description: `Deleted ${result.deletedLeases} leases and ${result.deletedStorageLocations} storage locations.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error resetting project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading || locationLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeStorageLocations = storageLocations.filter(loc => loc.isActive);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Configuration</CardTitle>
          <CardDescription>
            Select which options are available when creating new leases for this project. 
            Changes are saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Project Type Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Project Type</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select whether this is an owned marina or a deal under evaluation
              </p>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="project-type-active"
                  checked={location?.projectType === 'OWNED'}
                  onCheckedChange={() => handleProjectTypeChange('OWNED')}
                  data-testid="checkbox-project-type-owned"
                />
                <Label
                  htmlFor="project-type-active"
                  className="text-sm font-normal cursor-pointer"
                >
                  Owned Marina
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="project-type-deal"
                  checked={location?.projectType === 'DEAL'}
                  onCheckedChange={() => handleProjectTypeChange('DEAL')}
                  data-testid="checkbox-project-type-deal"
                />
                <Label
                  htmlFor="project-type-deal"
                  className="text-sm font-normal cursor-pointer"
                >
                  Deal Evaluation
                </Label>
              </div>
            </div>
          </div>

          {/* Boating Season Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Boating Season</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure the boating season type for this marina
              </p>
            </div>
            
            {/* Season Type Checkboxes */}
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="season-annual"
                  checked={seasonType === 'annual'}
                  onCheckedChange={() => handleSeasonTypeChange('annual')}
                  data-testid="checkbox-season-annual"
                />
                <Label
                  htmlFor="season-annual"
                  className={`text-sm font-normal cursor-pointer ${seasonType === 'seasonal' ? 'text-muted-foreground' : ''}`}
                >
                  Annual
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="season-seasonal"
                  checked={seasonType === 'seasonal'}
                  onCheckedChange={() => handleSeasonTypeChange('seasonal')}
                  data-testid="checkbox-season-seasonal"
                />
                <Label
                  htmlFor="season-seasonal"
                  className={`text-sm font-normal cursor-pointer ${seasonType === 'annual' ? 'text-muted-foreground' : ''}`}
                >
                  Seasonal
                </Label>
              </div>
            </div>

            {/* Seasonal Date Inputs - only show when Seasonal is selected */}
            {seasonType === 'seasonal' && (
              <div className="space-y-4 mt-4">
                {/* Summer Season Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="summer-start" className="text-sm font-medium">
                      Summer Season - Starting Date
                    </Label>
                    <Input
                      id="summer-start"
                      type="text"
                      value={summerStartDate}
                      onChange={(e) => handleSeasonDateChange('summer-start', e.target.value)}
                      placeholder="MM/DD (e.g., 05/01)"
                      pattern="\d{2}/\d{2}"
                      maxLength={5}
                      data-testid="input-summer-start-date"
                      className="max-w-[180px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="summer-end" className="text-sm font-medium">
                      Summer Season - Ending Date
                    </Label>
                    <Input
                      id="summer-end"
                      type="text"
                      value={summerEndDate}
                      onChange={(e) => handleSeasonDateChange('summer-end', e.target.value)}
                      placeholder="MM/DD (e.g., 10/31)"
                      pattern="\d{2}/\d{2}"
                      maxLength={5}
                      data-testid="input-summer-end-date"
                      className="max-w-[180px]"
                    />
                  </div>
                </div>
                
                {/* Winter Season Display (auto-calculated) */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">
                      Winter Season - Starting Date
                    </Label>
                    <p className="text-sm" data-testid="text-winter-start-date">
                      {winterStartDate || '—'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">
                      Winter Season - Ending Date
                    </Label>
                    <p className="text-sm" data-testid="text-winter-end-date">
                      {winterEndDate || '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Budget Tracking Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Budget Tracking</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Set annual budget targets for variance analysis on the Overview dashboard
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget-year" className="text-sm font-medium">
                  Budget Year
                </Label>
                <Input
                  id="budget-year"
                  type="number"
                  value={budgetYear}
                  onChange={(e) => setBudgetYear(e.target.value)}
                  placeholder={new Date().getFullYear().toString()}
                  min="2020"
                  max="2030"
                  data-testid="input-budget-year"
                  className="max-w-[120px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budgeted-revenue" className="text-sm font-medium">
                  Budgeted Revenue
                </Label>
                <Input
                  id="budgeted-revenue"
                  type="text"
                  value={budgetedRevenue}
                  onChange={(e) => setBudgetedRevenue(e.target.value)}
                  placeholder="$0"
                  data-testid="input-budgeted-revenue"
                  className="max-w-[160px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budgeted-occupancy" className="text-sm font-medium">
                  Target Occupancy %
                </Label>
                <Input
                  id="budgeted-occupancy"
                  type="number"
                  value={budgetedOccupancy}
                  onChange={(e) => setBudgetedOccupancy(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.1"
                  data-testid="input-budgeted-occupancy"
                  className="max-w-[120px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budgeted-expenses" className="text-sm font-medium">
                  Budgeted Expenses
                </Label>
                <Input
                  id="budgeted-expenses"
                  type="text"
                  value={budgetedExpenses}
                  onChange={(e) => setBudgetedExpenses(e.target.value)}
                  placeholder="$0"
                  data-testid="input-budgeted-expenses"
                  className="max-w-[160px]"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveBudget}
              disabled={updateLocationMutation.isPending}
              data-testid="button-save-budget"
            >
              {updateLocationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Budget
            </Button>
          </div>

          {/* Storage Types Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Storage Types</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select which storage types are available for this marina project
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {allStorageTypes.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`storage-${type}`}
                    checked={enabledStorageTypes.includes(type)}
                    onCheckedChange={() => handleStorageTypeToggle(type)}
                    data-testid={`checkbox-storage-${type.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                  <Label
                    htmlFor={`storage-${type}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {type}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Dual-Season Storage Types Section - Only shown for seasonal projects */}
          {seasonType === 'seasonal' && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
              <div>
                <h3 className="text-sm font-semibold mb-2">Dual-Season Storage Types</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select storage types that are used in BOTH summer and winter seasons. These will count as 2x annual capacity since the same slip can be rented twice per year.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {enabledStorageTypes.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dual-season-${type}`}
                      checked={dualSeasonStorageTypes.includes(type)}
                      onCheckedChange={() => handleDualSeasonToggle(type)}
                      data-testid={`checkbox-dual-season-${type.toLowerCase().replace(/\s+/g, '-')}`}
                    />
                    <Label
                      htmlFor={`dual-season-${type}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
              {enabledStorageTypes.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  Enable storage types above first to configure dual-season settings.
                </p>
              )}
            </div>
          )}

          {/* Rate Types Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Rate Types</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select which rate types are available for lease pricing
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {RATE_TYPES.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`rate-${type}`}
                    checked={enabledRateTypes.includes(type)}
                    onCheckedChange={() => handleRateTypeToggle(type)}
                    data-testid={`checkbox-rate-${type.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                  <Label
                    htmlFor={`rate-${type}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {type}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Contract Terms Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Contract Terms</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select which contract term options are available
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {allContractTerms.map((term) => (
                <div key={term} className="flex items-center space-x-2">
                  <Checkbox
                    id={`term-${term}`}
                    checked={enabledContractTerms.includes(term)}
                    onCheckedChange={() => handleContractTermToggle(term)}
                    data-testid={`checkbox-term-${term.toLowerCase().replace(/[\s\/]+/g, '-')}`}
                  />
                  <Label
                    htmlFor={`term-${term}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {term}
                  </Label>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t">
              <AddCustomContractTerm />
            </div>
          </div>

          {/* Slip Status Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Slip Status</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select which slip status options are available for storage locations
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {SLIP_STATUS.map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status}`}
                    checked={enabledSlipStatuses.includes(status)}
                    onCheckedChange={() => handleSlipStatusToggle(status)}
                    data-testid={`checkbox-status-${status.toLowerCase().replace(/[\s;\/]+/g, '-')}`}
                  />
                  <Label
                    htmlFor={`status-${status}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {status}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Base Rent Labels Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Base Rent Labels</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Customize the labels for base rent columns. These labels will appear in the rent roll table and exports for this project.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="base-rent-1-label" className="text-sm font-medium">
                  Base Rent 1
                </Label>
                <Input
                  id="base-rent-1-label"
                  value={baseRent1Label}
                  onChange={(e) => setBaseRent1Label(e.target.value)}
                  placeholder="e.g., Monthly Rent, Slip Fee, etc."
                  data-testid="input-base-rent-1-label"
                  className="mt-2 max-w-[300px]"
                />
              </div>

              <div>
                <Label htmlFor="base-rent-2-label" className="text-sm font-medium">
                  Base Rent 2
                </Label>
                <Input
                  id="base-rent-2-label"
                  value={baseRent2Label}
                  onChange={(e) => setBaseRent2Label(e.target.value)}
                  placeholder="e.g., Winter Rate, Off-Season, etc."
                  data-testid="input-base-rent-2-label"
                  className="mt-2 max-w-[300px]"
                />
              </div>

              <div>
                <Label htmlFor="base-rent-3-label" className="text-sm font-medium">
                  Base Rent 3
                </Label>
                <Input
                  id="base-rent-3-label"
                  value={baseRent3Label}
                  onChange={(e) => setBaseRent3Label(e.target.value)}
                  placeholder="e.g., Annual Rate, Special Rate, etc."
                  data-testid="input-base-rent-3-label"
                  className="mt-2 max-w-[300px]"
                />
              </div>
            </div>
          </div>

          {/* Additional Charge Labels Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">Additional Charge Labels</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Customize the labels for additional charges (utilities, parking, etc.). These labels will appear in the lease form for this project.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="charge-1-label" className="text-sm font-medium">
                  Additional Fee 1
                </Label>
                <Input
                  id="charge-1-label"
                  value={charge1Label}
                  onChange={(e) => setCharge1Label(e.target.value)}
                  placeholder="e.g., Electricity, Parking, etc."
                  data-testid="input-charge-1-label"
                  className="mt-2 max-w-[300px]"
                />
              </div>

              <div>
                <Label htmlFor="charge-2-label" className="text-sm font-medium">
                  Additional Fee 2
                </Label>
                <Input
                  id="charge-2-label"
                  value={charge2Label}
                  onChange={(e) => setCharge2Label(e.target.value)}
                  placeholder="e.g., Water, Storage, etc."
                  data-testid="input-charge-2-label"
                  className="mt-2 max-w-[300px]"
                />
              </div>

              <div>
                <Label htmlFor="charge-3-label" className="text-sm font-medium">
                  Additional Fee 3
                </Label>
                <Input
                  id="charge-3-label"
                  value={charge3Label}
                  onChange={(e) => setCharge3Label(e.target.value)}
                  placeholder="e.g., Maintenance, WiFi, etc."
                  data-testid="input-charge-3-label"
                  className="mt-2 max-w-[300px]"
                />
              </div>
            </div>
          </div>

          {/* Storage Locations Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold mb-2">Storage Locations</h3>
                <p className="text-sm text-muted-foreground">
                  Manage storage locations (docks, slips, berths, etc.) and track occupancy
                </p>
              </div>
              <Button onClick={handleNewLocation} data-testid="button-add-location">
                <Plus className="w-4 h-4" />
                Add Location
              </Button>
            </div>
            <div className="rounded-lg border bg-muted/30">
              <LocationsTable projectId={locationId} onEditLocation={handleEditLocation} />
            </div>
            
            {/* Capacity Summary */}
            {storageLocations.length > 0 && (
              <div className="mt-4 p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-semibold">Total Capacity</h4>
                    <span className="text-lg font-bold tabular-nums" data-testid="text-total-capacity">{capacitySummary.total}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => syncCapacityMutation.mutate()}
                    disabled={syncCapacityMutation.isPending}
                    data-testid="button-sync-capacity"
                  >
                    {syncCapacityMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">Sync to Project</span>
                  </Button>
                </div>
                {Object.keys(capacitySummary.byType).length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-medium text-muted-foreground">By Storage Type</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {Object.entries(capacitySummary.byType)
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, capacity]) => (
                          <div 
                            key={type} 
                            className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50"
                            data-testid={`capacity-${type.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <span className="text-xs truncate mr-2">{type}</span>
                            <span className="text-xs font-semibold tabular-nums">{capacity}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Save Changes Button */}
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSaveLabels}
              disabled={updateLocationMutation.isPending}
              data-testid="button-save-labels"
            >
              {updateLocationMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Types Management */}
      <CustomTypesManagement />

      {/* Danger Zone - Reset Project */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Destructive actions that cannot be undone
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Reset Project Data</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete all leases, tenants, cash flows, and storage locations for this project.
                This action cannot be undone.
              </p>
            </div>
            <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  data-testid="button-reset-project"
                  onClick={() => setConfirmationInput('')}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset Project
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-4">
                    <p>
                      This action will permanently delete all data for <span className="font-semibold">{location?.name}</span>, including:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>All leases and tenant information</li>
                      <li>All cash flow records</li>
                      <li>All storage locations</li>
                      <li>All PNL revenue entries</li>
                      <li>All move events</li>
                    </ul>
                    <p className="font-semibold">This action cannot be undone.</p>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-input">
                        Type <span className="font-mono font-semibold">{location?.name}</span> to confirm:
                      </Label>
                      <Input
                        id="confirm-input"
                        value={confirmationInput}
                        onChange={(e) => setConfirmationInput(e.target.value)}
                        placeholder="Enter project name"
                        data-testid="input-reset-confirmation"
                        className={confirmationInput.length > 0 && confirmationInput !== location?.name ? 'border-destructive' : ''}
                      />
                      {confirmationInput.length > 0 && confirmationInput !== location?.name && (
                        <p className="text-xs text-destructive" data-testid="text-validation-error">
                          Project name does not match
                        </p>
                      )}
                      {confirmationInput.length > 0 && confirmationInput === location?.name && (
                        <p className="text-xs text-green-600" data-testid="text-validation-success">
                          ✓ Project name confirmed
                        </p>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-reset-cancel">Cancel</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={() => resetProjectMutation.mutate()}
                    disabled={confirmationInput !== location?.name || resetProjectMutation.isPending}
                    data-testid="button-reset-confirm"
                  >
                    {resetProjectMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset Project"
                    )}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Location Form Drawer */}
      <LocationFormDrawer
        open={isLocationDrawerOpen}
        onClose={handleCloseLocationDrawer}
        locationId={selectedLocationId}
        projectId={locationId}
      />
    </div>
  );
}

// Component for adding custom contract terms
function AddCustomContractTerm() {
  const { toast } = useToast();
  const [newTerm, setNewTerm] = useState('');
  const queryClient = useQueryClient();

  const createCustomTermMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/rent-roll/custom-contract-terms", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/custom-contract-terms"] });
      setNewTerm('');
      toast({
        title: "Custom contract term added",
        description: "The new term has been added to the list",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add custom contract term",
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    const trimmed = newTerm.trim();
    if (!trimmed) {
      toast({
        title: "Name required",
        description: "Please enter a name for the custom contract term",
        variant: "destructive",
      });
      return;
    }
    createCustomTermMutation.mutate(trimmed);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="new-contract-term" className="text-sm font-medium">
        Add Custom Contract Term
      </Label>
      <div className="flex gap-2">
        <Input
          id="new-contract-term"
          value={newTerm}
          onChange={(e) => setNewTerm(e.target.value)}
          placeholder="e.g., Bi-Weekly, 2-Year, etc."
          data-testid="input-new-contract-term"
          className="max-w-[300px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newTerm.trim()) {
              handleAdd();
            }
          }}
        />
        <Button
          onClick={handleAdd}
          disabled={createCustomTermMutation.isPending || !newTerm.trim()}
          data-testid="button-add-contract-term"
        >
          {createCustomTermMutation.isPending ? "Adding..." : "Add"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Custom terms will be available across all projects
      </p>
    </div>
  );
}
