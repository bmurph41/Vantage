import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLocalAutosave } from '@/hooks/use-local-autosave';
import { AutosaveIndicator } from '@/components/ui/autosave-indicator';
import {
  Calendar,
  Save,
  Sun,
  Snowflake,
  Building2,
  Anchor,
  Ship,
  Fuel,
  ShoppingCart,
  FileText,
  Warehouse,
  RefreshCw,
  Waves,
  Car,
  Home,
  Utensils,
  Users,
  Store,
  Wrench,
  MapPin,
  Container,
  Sailboat,
  Plus,
  CircleDot,
  Check,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { useToast } from '@/hooks/use-toast';

interface WorkspaceInputsProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

// NEW: Seasonality types - 'annual' = year-round, 'seasonal' = in-season, 'winter' = winter season
type SeasonalityOption = 'annual' | 'seasonal' | 'winter';

type StorageTypeConfig = {
  id: string;
  name: string;
  section: 'storage' | 'designated';
  // NEW: Multi-select seasonality - can have multiple seasons (hybrid = 2+ seasons)
  seasons: SeasonalityOption[];
  isEnabled: boolean;
  icon: React.ReactNode;
};

const defaultStorageTypes: StorageTypeConfig[] = [
  { id: 'wet_slips', name: 'Wet Slips', section: 'storage', seasons: ['seasonal'], isEnabled: true, icon: <Anchor className="h-4 w-4" /> },
  { id: 'lift_slips', name: 'Lift Slips', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Waves className="h-4 w-4" /> },
  { id: 'moorings', name: 'Moorings', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Anchor className="h-4 w-4" /> },
  { id: 'dinghies', name: 'Dinghies', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Sailboat className="h-4 w-4" /> },
  { id: 'jet_skis', name: 'Jet Skis', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Waves className="h-4 w-4" /> },
  { id: 'dry_racks_indoor', name: 'Dry Racks – Indoor', section: 'storage', seasons: ['annual'], isEnabled: true, icon: <Warehouse className="h-4 w-4" /> },
  { id: 'dry_racks_outdoor', name: 'Dry Racks – Outdoor', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Container className="h-4 w-4" /> },
  { id: 'land_storage', name: 'Land Storage', section: 'storage', seasons: ['annual'], isEnabled: false, icon: <MapPin className="h-4 w-4" /> },
  { id: 'boats_on_trailers', name: 'Boats on Trailers', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Ship className="h-4 w-4" /> },
  { id: 'trailers', name: 'Trailers', section: 'storage', seasons: ['annual'], isEnabled: false, icon: <Car className="h-4 w-4" /> },
  { id: 'carports', name: 'Carports', section: 'storage', seasons: ['annual'], isEnabled: false, icon: <Home className="h-4 w-4" /> },
  { id: 'houseboats', name: 'Houseboats', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Home className="h-4 w-4" /> },
  { id: 'rv_sites', name: 'RV Sites', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Car className="h-4 w-4" /> },
];

const defaultDesignatedSpaces: StorageTypeConfig[] = [
  { id: 'boat_sales', name: 'Boat Sales', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Store className="h-4 w-4" /> },
  { id: 'service', name: 'Service', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Wrench className="h-4 w-4" /> },
  { id: 'commercial_tenants', name: 'Commercial Tenants', section: 'designated', seasons: ['annual'], isEnabled: false, icon: <Building2 className="h-4 w-4" /> },
  { id: 'rental_boats', name: 'Rental Boats', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Ship className="h-4 w-4" /> },
  { id: 'boat_club', name: 'Boat Club', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Users className="h-4 w-4" /> },
  { id: 'fuel_dock', name: 'Fuel Dock', section: 'designated', seasons: ['seasonal'], isEnabled: true, icon: <Fuel className="h-4 w-4" /> },
  { id: 'transient', name: 'Transient', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Anchor className="h-4 w-4" /> },
  { id: 'restaurant', name: 'Restaurant', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Utensils className="h-4 w-4" /> },
  { id: 'ship_store', name: 'Ship Store', section: 'designated', seasons: ['seasonal'], isEnabled: true, icon: <ShoppingCart className="h-4 w-4" /> },
];

type ProfitCenterConfig = {
  id: string;
  name: string;
  isEnabled: boolean;
  icon: React.ReactNode;
};

const defaultProfitCenters: ProfitCenterConfig[] = [
  { id: 'pc_fuel_dock', name: 'Fuel Dock', isEnabled: true, icon: <Fuel className="h-4 w-4" /> },
  { id: 'pc_marina_amenities', name: 'Marina & Amenities', isEnabled: true, icon: <Anchor className="h-4 w-4" /> },
  { id: 'pc_ships_store', name: "Ship's Store", isEnabled: true, icon: <ShoppingCart className="h-4 w-4" /> },
  { id: 'pc_service', name: 'Service', isEnabled: false, icon: <Wrench className="h-4 w-4" /> },
  { id: 'pc_parts', name: 'Parts', isEnabled: false, icon: <Container className="h-4 w-4" /> },
  { id: 'pc_boat_club', name: 'Boat Club', isEnabled: false, icon: <Users className="h-4 w-4" /> },
  { id: 'pc_rental_boats', name: 'Rental Boats', isEnabled: false, icon: <Ship className="h-4 w-4" /> },
  { id: 'pc_boat_sales', name: 'Boat Sales', isEnabled: false, icon: <Store className="h-4 w-4" /> },
  { id: 'pc_boat_finance', name: 'Boat Finance', isEnabled: false, icon: <FileText className="h-4 w-4" /> },
  { id: 'pc_boat_brokerage', name: 'Boat Brokerage', isEnabled: false, icon: <Sailboat className="h-4 w-4" /> },
  { id: 'pc_fb', name: 'F&B', isEnabled: false, icon: <Utensils className="h-4 w-4" /> },
  { id: 'pc_rv_park', name: 'RV Park', isEnabled: false, icon: <Car className="h-4 w-4" /> },
  { id: 'pc_hospitality', name: 'Hospitality', isEnabled: false, icon: <Home className="h-4 w-4" /> },
];

const months = [
  { value: 1, label: 'January', short: 'Jan' },
  { value: 2, label: 'February', short: 'Feb' },
  { value: 3, label: 'March', short: 'Mar' },
  { value: 4, label: 'April', short: 'Apr' },
  { value: 5, label: 'May', short: 'May' },
  { value: 6, label: 'June', short: 'Jun' },
  { value: 7, label: 'July', short: 'Jul' },
  { value: 8, label: 'August', short: 'Aug' },
  { value: 9, label: 'September', short: 'Sep' },
  { value: 10, label: 'October', short: 'Oct' },
  { value: 11, label: 'November', short: 'Nov' },
  { value: 12, label: 'December', short: 'Dec' },
];

// Helper to get seasonality label
function getSeasonalityLabel(seasons: SeasonalityOption[]): string {
  if (seasons.length === 0) return 'None';
  if (seasons.includes('annual')) return 'Year-Round';
  if (seasons.length === 1) {
    if (seasons[0] === 'seasonal') return 'Seasonal';
    if (seasons[0] === 'winter') return 'Winter';
  }
  // Hybrid: multiple seasons
  const labels: string[] = [];
  if (seasons.includes('seasonal')) labels.push('Seasonal');
  if (seasons.includes('winter')) labels.push('Winter');
  return labels.join(' + ') || 'Hybrid';
}

export default function WorkspaceInputs({ projectId, onTabChange }: WorkspaceInputsProps) {
  const { toast } = useToast();
  const { data: config, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const [holdPeriod, setHoldPeriod] = useState<number>(5);
  const [startDate, setStartDate] = useState<string>('2026-01-31');
  const [cashFlowGranularity, setCashFlowGranularity] = useState<string>('annual');
  const [seasonMonths, setSeasonMonths] = useState<number[]>([4, 5, 6, 7, 8, 9, 10]);
  // NEW: Winter months state
  const [winterMonths, setWinterMonths] = useState<number[]>([11, 12, 1, 2, 3]);
  const [storageTypes, setStorageTypes] = useState<StorageTypeConfig[]>(defaultStorageTypes);
  const [designatedSpaces, setDesignatedSpaces] = useState<StorageTypeConfig[]>(defaultDesignatedSpaces);
  const [profitCenters, setProfitCenters] = useState<ProfitCenterConfig[]>(defaultProfitCenters);
  const [showAddProfitCenterDialog, setShowAddProfitCenterDialog] = useState(false);
  const [newProfitCenterName, setNewProfitCenterName] = useState('');
  const [newProfitCenterSection, setNewProfitCenterSection] = useState<'storage' | 'designated'>('designated');

  // NEW: Save Now button state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { status, triggerAutosave, forceSave } = useLocalAutosave({
    entityId: projectId,
    endpoint: '/api/modeling/projects/{id}/config',
    method: 'POST',
    enabled: true,
    debounceMs: 2000,
    invalidateQueries: [['/api/modeling/projects', projectId, 'config']],
  });

  const getCurrentData = () => {
    const storageSettings: Record<string, { seasons: SeasonalityOption[]; isEnabled: boolean; section: string }> = {};
    storageTypes.forEach(item => {
      storageSettings[item.id] = { seasons: item.seasons, isEnabled: item.isEnabled, section: 'storage' };
    });
    designatedSpaces.forEach(item => {
      storageSettings[item.id] = { seasons: item.seasons, isEnabled: item.isEnabled, section: 'designated' };
    });

    const profitCenterSettings: Record<string, { isEnabled: boolean }> = {};
    profitCenters.forEach(item => {
      profitCenterSettings[item.id] = { isEnabled: item.isEnabled };
    });

    return {
      holdPeriod,
      startDate,
      cashFlowGranularity,
      seasonMonths,
      winterMonths,
      departments: storageSettings,
      profitCenters: profitCenterSettings,
    };
  };

  useEffect(() => {
    if (config) {
      setHoldPeriod(config.holdPeriod || 5);
      setStartDate(config.startDate || '2026-01-31');
      setCashFlowGranularity(config.cashFlowGranularity || 'annual');
      setSeasonMonths(config.seasonMonths || [4, 5, 6, 7, 8, 9, 10]);
      setWinterMonths(config.winterMonths || [11, 12, 1, 2, 3]);
      if (config.departments) {
        setStorageTypes(prev => prev.map(item => {
          const dept = config.departments[item.id];
          if (!dept) return item;
          // Support legacy isYearRound field migration
          let seasons = dept.seasons;
          if (!seasons && typeof dept.isYearRound === 'boolean') {
            seasons = dept.isYearRound ? ['annual'] : ['seasonal'];
          }
          return {
            ...item,
            seasons: seasons ?? item.seasons,
            isEnabled: dept.isEnabled ?? item.isEnabled
          };
        }));
        setDesignatedSpaces(prev => prev.map(item => {
          const dept = config.departments[item.id];
          if (!dept) return item;
          let seasons = dept.seasons;
          if (!seasons && typeof dept.isYearRound === 'boolean') {
            seasons = dept.isYearRound ? ['annual'] : ['seasonal'];
          }
          return {
            ...item,
            seasons: seasons ?? item.seasons,
            isEnabled: dept.isEnabled ?? item.isEnabled
          };
        }));
      }
      if (config.profitCenters) {
        setProfitCenters(prev => prev.map(item => ({
          ...item,
          isEnabled: config.profitCenters[item.id]?.isEnabled ?? item.isEnabled
        })));
      }
    }
  }, [config]);

  useEffect(() => {
    if (config) {
      triggerAutosave(getCurrentData());
    }
  }, [holdPeriod, startDate, cashFlowGranularity, seasonMonths, winterMonths, storageTypes, designatedSpaces, profitCenters]);

  const toggleSeasonMonth = (month: number) => {
    setSeasonMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month].sort((a, b) => a - b)
    );
  };

  const toggleWinterMonth = (month: number) => {
    setWinterMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month].sort((a, b) => a - b)
    );
  };

  // NEW: Toggle season for storage type (multi-select)
  const toggleItemSeason = (itemId: string, section: 'storage' | 'designated', season: SeasonalityOption) => {
    const updateFn = (prev: StorageTypeConfig[]) => prev.map(item => {
      if (item.id !== itemId) return item;

      let newSeasons = [...item.seasons];

      if (season === 'annual') {
        // Annual is exclusive - can't be annual AND seasonal/winter
        if (newSeasons.includes('annual')) {
          newSeasons = ['seasonal']; // Default to seasonal when deselecting annual
        } else {
          newSeasons = ['annual'];
        }
      } else {
        // For seasonal/winter, toggle and remove annual if present
        newSeasons = newSeasons.filter(s => s !== 'annual');

        if (newSeasons.includes(season)) {
          newSeasons = newSeasons.filter(s => s !== season);
          if (newSeasons.length === 0) {
            newSeasons = ['seasonal']; // Default if nothing left
          }
        } else {
          newSeasons.push(season);
        }
      }

      return { ...item, seasons: newSeasons };
    });

    if (section === 'storage') {
      setStorageTypes(updateFn);
    } else {
      setDesignatedSpaces(updateFn);
    }
  };

  const toggleItemEnabled = (itemId: string, section: 'storage' | 'designated') => {
    if (section === 'storage') {
      setStorageTypes(prev => prev.map(item => 
        item.id === itemId ? { ...item, isEnabled: !item.isEnabled } : item
      ));
    } else {
      setDesignatedSpaces(prev => prev.map(item => 
        item.id === itemId ? { ...item, isEnabled: !item.isEnabled } : item
      ));
    }
  };

  const toggleProfitCenterEnabled = (itemId: string) => {
    setProfitCenters(prev => prev.map(item => 
      item.id === itemId ? { ...item, isEnabled: !item.isEnabled } : item
    ));
  };

  // NEW: Save Now with green check feedback
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await forceSave(getCurrentData());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save configuration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProfitCenter = () => {
    if (!newProfitCenterName.trim()) return;

    const id = newProfitCenterName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const allItems = [...storageTypes, ...designatedSpaces];
    if (allItems.some(item => item.id === id || item.name.toLowerCase() === newProfitCenterName.toLowerCase())) {
      return;
    }

    const newItem: StorageTypeConfig = {
      id,
      name: newProfitCenterName.trim(),
      section: newProfitCenterSection,
      seasons: ['seasonal'],
      isEnabled: true,
      icon: <CircleDot className="h-4 w-4" />,
    };

    if (newProfitCenterSection === 'storage') {
      setStorageTypes(prev => [...prev, newItem]);
    } else {
      setDesignatedSpaces(prev => [...prev, newItem]);
    }

    setNewProfitCenterName('');
    setShowAddProfitCenterDialog(false);
    triggerAutosave(getCurrentData());
  };

  const getSeasonLabel = () => {
    if (seasonMonths.length === 0) return 'No season selected';
    if (seasonMonths.length === 12) return 'Year-round';

    const startMonth = months.find(m => m.value === Math.min(...seasonMonths));
    const endMonth = months.find(m => m.value === Math.max(...seasonMonths));
    return `${startMonth?.short} - ${endMonth?.short} (${seasonMonths.length} months)`;
  };

  const getWinterSeasonLabel = () => {
    if (winterMonths.length === 0) return 'No winter season';
    const startMonth = months.find(m => m.value === winterMonths[0]);
    const endMonth = months.find(m => m.value === winterMonths[winterMonths.length - 1]);
    return `${startMonth?.short} - ${endMonth?.short} (${winterMonths.length} months)`;
  };

  // NEW: Render seasonality selector
  const renderSeasonalitySelector = (item: StorageTypeConfig, section: 'storage' | 'designated') => {
    const isAnnual = item.seasons.includes('annual');
    const isSeasonal = item.seasons.includes('seasonal');
    const isWinter = item.seasons.includes('winter');
    const isHybrid = item.seasons.length > 1 && !isAnnual;

    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleItemSeason(item.id, section, 'annual')}
                className={`p-1.5 rounded transition-colors ${
                  isAnnual 
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Year-Round</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleItemSeason(item.id, section, 'seasonal')}
                className={`p-1.5 rounded transition-colors ${
                  isSeasonal && !isAnnual
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' 
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Seasonal (In-Season)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleItemSeason(item.id, section, 'winter')}
                className={`p-1.5 rounded transition-colors ${
                  isWinter && !isAnnual
                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' 
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <Snowflake className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Winter Season</TooltipContent>
          </Tooltip>

          {isHybrid && (
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              Hybrid
            </Badge>
          )}
        </div>
      </TooltipProvider>
    );
  };

  return (
    <div className="space-y-6">
      {onTabChange && (
        <WorkflowNavigation currentTab="inputs" onNavigate={onTabChange} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Project Inputs</h2>
          <p className="text-sm text-muted-foreground">
            Configure seasonality, hold period, and department settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutosaveIndicator status={status} showText size="sm" />
          {/* UPDATED: Save Now button with green check */}
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            variant={saveSuccess ? 'default' : 'outline'}
            size="sm"
            className={saveSuccess ? 'bg-green-600 hover:bg-green-600 text-white' : ''}
            data-testid="button-save-inputs"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Now
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Hold Period & Start Date
            </CardTitle>
            <CardDescription>
              Set the investment timeline for pro forma projections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="holdPeriod">Hold Period</Label>
              <Select 
                value={holdPeriod.toString()} 
                onValueChange={(v) => setHoldPeriod(parseInt(v))}
              >
                <SelectTrigger id="holdPeriod" data-testid="select-hold-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Years</SelectItem>
                  <SelectItem value="5">5 Years</SelectItem>
                  <SelectItem value="7">7 Years</SelectItem>
                  <SelectItem value="10">10 Years</SelectItem>
                  <SelectItem value="15">15 Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Pro Forma Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <Separator className="my-4" />
            <div className="space-y-2">
              <Label htmlFor="cashFlowGranularity">Cash Flow Timing</Label>
              <Select 
                value={cashFlowGranularity} 
                onValueChange={(v) => setCashFlowGranularity(v)}
              >
                <SelectTrigger id="cashFlowGranularity" data-testid="select-granularity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Monthly uses XIRR for precise return calculations
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              In-Season Months
            </CardTitle>
            <CardDescription>
              Select months when seasonal operations are active
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="gap-1">
                <Sun className="h-3 w-3" />
                {getSeasonLabel()}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSeasonMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
              >
                <Calendar className="h-3 w-3 mr-1" />
                Year-Round
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {months.map((month) => (
                <Button
                  key={month.value}
                  variant={seasonMonths.includes(month.value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleSeasonMonth(month.value)}
                  className="w-full"
                >
                  {seasonMonths.includes(month.value) ? (
                    <Sun className="h-3 w-3 mr-1" />
                  ) : (
                    <Snowflake className="h-3 w-3 mr-1" />
                  )}
                  {month.short}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NEW: Winter Season Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Snowflake className="h-5 w-5" />
            Winter Season Months
          </CardTitle>
          <CardDescription>
            Select months for winter storage contracts (e.g., winter wet slips)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1">
              <Snowflake className="h-3 w-3" />
              {getWinterSeasonLabel()}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWinterMonths([11, 12, 1, 2, 3])}
            >
              <Snowflake className="h-3 w-3 mr-1" />
              Typical (Nov-Mar)
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {months.map((month) => (
              <Button
                key={month.value}
                variant={winterMonths.includes(month.value) ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => toggleWinterMonth(month.value)}
                className={`w-full ${winterMonths.includes(month.value) ? 'bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-900' : ''}`}
              >
                {winterMonths.includes(month.value) ? (
                  <Snowflake className="h-3 w-3 mr-1 text-cyan-700 dark:text-cyan-300" />
                ) : (
                  <Sun className="h-3 w-3 mr-1" />
                )}
                {month.short}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Storage types marked as "Winter" will only show revenue during these months
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                Storage Configuration
              </CardTitle>
              <CardDescription>
                Enable storage types and set seasonality: Year-Round, Seasonal, Winter, or Hybrid
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAddProfitCenterDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Profit Center
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Anchor className="h-4 w-4" />
              Storage Types
            </h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {storageTypes.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col p-3 rounded-lg border ${
                    item.isEnabled 
                      ? 'bg-muted/30 border-border' 
                      : 'bg-muted/10 border-dashed opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 mb-2">
                    <input
                      type="checkbox"
                      checked={item.isEnabled}
                      onChange={() => toggleItemEnabled(item.id, 'storage')}
                      className="h-4 w-4 rounded border-muted-foreground/50 cursor-pointer"
                    />
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      item.isEnabled ? 'bg-background' : 'bg-muted/30'
                    }`}>
                      {item.icon}
                    </div>
                    <span className={`font-medium text-sm truncate ${!item.isEnabled && 'text-muted-foreground'}`}>
                      {item.name}
                    </span>
                  </div>
                  {item.isEnabled && (
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {getSeasonalityLabel(item.seasons)}
                      </span>
                      {renderSeasonalitySelector(item, 'storage')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Designated Spaces
            </h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {designatedSpaces.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col p-3 rounded-lg border ${
                    item.isEnabled 
                      ? 'bg-muted/30 border-border' 
                      : 'bg-muted/10 border-dashed opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 mb-2">
                    <input
                      type="checkbox"
                      checked={item.isEnabled}
                      onChange={() => toggleItemEnabled(item.id, 'designated')}
                      className="h-4 w-4 rounded border-muted-foreground/50 cursor-pointer"
                    />
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      item.isEnabled ? 'bg-background' : 'bg-muted/30'
                    }`}>
                      {item.icon}
                    </div>
                    <span className={`font-medium text-sm truncate ${!item.isEnabled && 'text-muted-foreground'}`}>
                      {item.name}
                    </span>
                  </div>
                  {item.isEnabled && (
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">
                        {getSeasonalityLabel(item.seasons)}
                      </span>
                      {renderSeasonalitySelector(item, 'designated')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Profit Center Configuration
          </CardTitle>
          <CardDescription>
            Enable profit centers for Pro Forma revenue categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {profitCenters.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  item.isEnabled 
                    ? 'bg-muted/30 border-border' 
                    : 'bg-muted/10 border-dashed opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={item.isEnabled}
                    onChange={() => toggleProfitCenterEnabled(item.id)}
                    className="h-4 w-4 rounded border-muted-foreground/50 cursor-pointer"
                  />
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    item.isEnabled ? 'bg-background' : 'bg-muted/30'
                  }`}>
                    {item.icon}
                  </div>
                  <span className={`font-medium text-sm truncate ${!item.isEnabled && 'text-muted-foreground'}`}>
                    {item.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAddProfitCenterDialog} onOpenChange={setShowAddProfitCenterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Profit Center</DialogTitle>
            <DialogDescription>
              Add a custom profit center to track revenue and expenses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="profit-center-name">Name</Label>
              <Input
                id="profit-center-name"
                value={newProfitCenterName}
                onChange={(e) => setNewProfitCenterName(e.target.value)}
                placeholder="e.g., Charter Services, Boat Wash"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profit-center-section">Category</Label>
              <Select 
                value={newProfitCenterSection} 
                onValueChange={(v) => setNewProfitCenterSection(v as 'storage' | 'designated')}
              >
                <SelectTrigger id="profit-center-section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="storage">Storage Type</SelectItem>
                  <SelectItem value="designated">Designated Space</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProfitCenterDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddProfitCenter}
              disabled={!newProfitCenterName.trim()}
            >
              Add Profit Center
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}