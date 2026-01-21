import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  CircleDot
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

interface WorkspaceInputsProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

type StorageTypeConfig = {
  id: string;
  name: string;
  section: 'storage' | 'designated';
  isYearRound: boolean;
  isEnabled: boolean;
  icon: React.ReactNode;
};

const defaultStorageTypes: StorageTypeConfig[] = [
  { id: 'wet_slips', name: 'Wet Slips', section: 'storage', isYearRound: false, isEnabled: true, icon: <Anchor className="h-4 w-4" /> },
  { id: 'lift_slips', name: 'Lift Slips', section: 'storage', isYearRound: false, isEnabled: false, icon: <Waves className="h-4 w-4" /> },
  { id: 'moorings', name: 'Moorings', section: 'storage', isYearRound: false, isEnabled: false, icon: <Anchor className="h-4 w-4" /> },
  { id: 'dinghies', name: 'Dinghies', section: 'storage', isYearRound: false, isEnabled: false, icon: <Sailboat className="h-4 w-4" /> },
  { id: 'jet_skis', name: 'Jet Skis', section: 'storage', isYearRound: false, isEnabled: false, icon: <Waves className="h-4 w-4" /> },
  { id: 'dry_racks_indoor', name: 'Dry Racks – Indoor', section: 'storage', isYearRound: true, isEnabled: true, icon: <Warehouse className="h-4 w-4" /> },
  { id: 'dry_racks_outdoor', name: 'Dry Racks – Outdoor', section: 'storage', isYearRound: false, isEnabled: false, icon: <Container className="h-4 w-4" /> },
  { id: 'land_storage', name: 'Land Storage', section: 'storage', isYearRound: true, isEnabled: false, icon: <MapPin className="h-4 w-4" /> },
  { id: 'boats_on_trailers', name: 'Boats on Trailers', section: 'storage', isYearRound: false, isEnabled: false, icon: <Ship className="h-4 w-4" /> },
  { id: 'trailers', name: 'Trailers', section: 'storage', isYearRound: true, isEnabled: false, icon: <Car className="h-4 w-4" /> },
  { id: 'carports', name: 'Carports', section: 'storage', isYearRound: true, isEnabled: false, icon: <Home className="h-4 w-4" /> },
  { id: 'houseboats', name: 'Houseboats', section: 'storage', isYearRound: false, isEnabled: false, icon: <Home className="h-4 w-4" /> },
  { id: 'rv_sites', name: 'RV Sites', section: 'storage', isYearRound: false, isEnabled: false, icon: <Car className="h-4 w-4" /> },
];

const defaultDesignatedSpaces: StorageTypeConfig[] = [
  { id: 'boat_sales', name: 'Boat Sales', section: 'designated', isYearRound: false, isEnabled: false, icon: <Store className="h-4 w-4" /> },
  { id: 'service', name: 'Service', section: 'designated', isYearRound: false, isEnabled: false, icon: <Wrench className="h-4 w-4" /> },
  { id: 'commercial_tenants', name: 'Commercial Tenants', section: 'designated', isYearRound: true, isEnabled: false, icon: <Building2 className="h-4 w-4" /> },
  { id: 'rental_boats', name: 'Rental Boats', section: 'designated', isYearRound: false, isEnabled: false, icon: <Ship className="h-4 w-4" /> },
  { id: 'boat_club', name: 'Boat Club', section: 'designated', isYearRound: false, isEnabled: false, icon: <Users className="h-4 w-4" /> },
  { id: 'fuel_dock', name: 'Fuel Dock', section: 'designated', isYearRound: false, isEnabled: true, icon: <Fuel className="h-4 w-4" /> },
  { id: 'transient', name: 'Transient', section: 'designated', isYearRound: false, isEnabled: false, icon: <Anchor className="h-4 w-4" /> },
  { id: 'restaurant', name: 'Restaurant', section: 'designated', isYearRound: false, isEnabled: false, icon: <Utensils className="h-4 w-4" /> },
  { id: 'ship_store', name: 'Ship Store', section: 'designated', isYearRound: false, isEnabled: true, icon: <ShoppingCart className="h-4 w-4" /> },
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

export default function WorkspaceInputs({ projectId, onTabChange }: WorkspaceInputsProps) {
  const { data: config, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const [holdPeriod, setHoldPeriod] = useState<number>(5);
  const [startDate, setStartDate] = useState<string>('2026-01-31');
  const [cashFlowGranularity, setCashFlowGranularity] = useState<string>('annual');
  const [seasonMonths, setSeasonMonths] = useState<number[]>([4, 5, 6, 7, 8, 9, 10]);
  const [storageTypes, setStorageTypes] = useState<StorageTypeConfig[]>(defaultStorageTypes);
  const [designatedSpaces, setDesignatedSpaces] = useState<StorageTypeConfig[]>(defaultDesignatedSpaces);
  const [profitCenters, setProfitCenters] = useState<ProfitCenterConfig[]>(defaultProfitCenters);
  const [showAddProfitCenterDialog, setShowAddProfitCenterDialog] = useState(false);
  const [newProfitCenterName, setNewProfitCenterName] = useState('');
  const [newProfitCenterSection, setNewProfitCenterSection] = useState<'storage' | 'designated'>('designated');

  const { status, triggerAutosave, forceSave } = useLocalAutosave({
    entityId: projectId,
    endpoint: '/api/modeling/projects/{id}/config',
    method: 'POST',
    enabled: true,
    debounceMs: 2000,
    invalidateQueries: [['/api/modeling/projects', projectId, 'config']],
  });

  const getCurrentData = () => {
    const storageSettings: Record<string, { isYearRound: boolean; isEnabled: boolean; section: string }> = {};
    storageTypes.forEach(item => {
      storageSettings[item.id] = { isYearRound: item.isYearRound, isEnabled: item.isEnabled, section: 'storage' };
    });
    designatedSpaces.forEach(item => {
      storageSettings[item.id] = { isYearRound: item.isYearRound, isEnabled: item.isEnabled, section: 'designated' };
    });
    return {
      holdPeriod,
      startDate,
      cashFlowGranularity,
      seasonMonths,
      departments: storageSettings,
    };
  };

  useEffect(() => {
    if (config) {
      setHoldPeriod(config.holdPeriod || 5);
      setStartDate(config.startDate || '2026-01-31');
      setCashFlowGranularity(config.cashFlowGranularity || 'annual');
      setSeasonMonths(config.seasonMonths || [4, 5, 6, 7, 8, 9, 10]);
      if (config.departments) {
        setStorageTypes(prev => prev.map(item => ({
          ...item,
          isYearRound: config.departments[item.id]?.isYearRound ?? item.isYearRound,
          isEnabled: config.departments[item.id]?.isEnabled ?? item.isEnabled
        })));
        setDesignatedSpaces(prev => prev.map(item => ({
          ...item,
          isYearRound: config.departments[item.id]?.isYearRound ?? item.isYearRound,
          isEnabled: config.departments[item.id]?.isEnabled ?? item.isEnabled
        })));
      }
    }
  }, [config]);

  useEffect(() => {
    if (config) {
      triggerAutosave(getCurrentData());
    }
  }, [holdPeriod, startDate, cashFlowGranularity, seasonMonths, storageTypes, designatedSpaces]);

  const toggleSeasonMonth = (month: number) => {
    setSeasonMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month].sort((a, b) => a - b)
    );
  };

  const toggleItemYearRound = (itemId: string, section: 'storage' | 'designated') => {
    if (section === 'storage') {
      setStorageTypes(prev => prev.map(item => 
        item.id === itemId ? { ...item, isYearRound: !item.isYearRound } : item
      ));
    } else {
      setDesignatedSpaces(prev => prev.map(item => 
        item.id === itemId ? { ...item, isYearRound: !item.isYearRound } : item
      ));
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

  const handleSave = () => {
    forceSave(getCurrentData());
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
      isYearRound: false,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Project Inputs</h2>
          <p className="text-sm text-muted-foreground">
            Configure seasonality, hold period, and department settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutosaveIndicator status={status} showText size="sm" />
          <Button 
            onClick={handleSave} 
            disabled={status === 'saving'}
            variant="outline"
            size="sm"
            data-testid="button-save-inputs"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Now
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
                  <SelectItem value="5">5 Years</SelectItem>
                  <SelectItem value="7">7 Years</SelectItem>
                  <SelectItem value="10">10 Years</SelectItem>
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
                Monthly uses XIRR for precise return calculations based on actual dates
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
              Select the months when seasonal operations are active
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
                data-testid="button-year-round"
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
                  data-testid={`button-month-${month.value}`}
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
            <p className="text-xs text-muted-foreground">
              Off-season months will show $0 for seasonal departments in Pro Forma
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                Storage Configuration
              </CardTitle>
              <CardDescription>
                Enable storage types that apply to this property. Only enabled items will appear in Growth Rates and Pro Forma.
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAddProfitCenterDialog(true)}
              data-testid="button-add-profit-center"
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
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    item.isEnabled 
                      ? 'bg-muted/30 border-border' 
                      : 'bg-muted/10 border-dashed opacity-60'
                  }`}
                  data-testid={`storage-${item.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={item.isEnabled}
                      onChange={() => toggleItemEnabled(item.id, 'storage')}
                      className="h-4 w-4 rounded border-muted-foreground/50 text-primary focus:ring-primary cursor-pointer"
                      data-testid={`checkbox-${item.id}-enabled`}
                    />
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.isEnabled ? 'bg-background' : 'bg-muted/30'
                    }`}>
                      {item.icon}
                    </div>
                    <span className={`font-medium text-sm truncate ${!item.isEnabled && 'text-muted-foreground'}`}>
                      {item.name}
                    </span>
                  </div>
                  {item.isEnabled && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {item.isYearRound ? 'Year-Round' : 'Seasonal'}
                      </span>
                      <Switch
                        checked={item.isYearRound}
                        onCheckedChange={() => toggleItemYearRound(item.id, 'storage')}
                        className="scale-75"
                        data-testid={`switch-${item.id}-year-round`}
                      />
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
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    item.isEnabled 
                      ? 'bg-muted/30 border-border' 
                      : 'bg-muted/10 border-dashed opacity-60'
                  }`}
                  data-testid={`designated-${item.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={item.isEnabled}
                      onChange={() => toggleItemEnabled(item.id, 'designated')}
                      className="h-4 w-4 rounded border-muted-foreground/50 text-primary focus:ring-primary cursor-pointer"
                      data-testid={`checkbox-${item.id}-enabled`}
                    />
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.isEnabled ? 'bg-background' : 'bg-muted/30'
                    }`}>
                      {item.icon}
                    </div>
                    <span className={`font-medium text-sm truncate ${!item.isEnabled && 'text-muted-foreground'}`}>
                      {item.name}
                    </span>
                  </div>
                  {item.isEnabled && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {item.isYearRound ? 'Year-Round' : 'Seasonal'}
                      </span>
                      <Switch
                        checked={item.isYearRound}
                        onCheckedChange={() => toggleItemYearRound(item.id, 'designated')}
                        className="scale-75"
                        data-testid={`switch-${item.id}-year-round`}
                      />
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Profit Center Configuration
              </CardTitle>
              <CardDescription>
                Enable profit centers that apply to this property. Only enabled items will appear in Pro Forma revenue categories.
              </CardDescription>
            </div>
          </div>
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
                data-testid={`profit-center-${item.id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={item.isEnabled}
                    onChange={() => toggleProfitCenterEnabled(item.id)}
                    className="h-4 w-4 rounded border-muted-foreground/50 text-primary focus:ring-primary cursor-pointer"
                    data-testid={`checkbox-${item.id}-enabled`}
                  />
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
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

      {onTabChange && (
        <WorkflowNavigation currentTab="inputs" onNavigate={onTabChange} />
      )}

      <Dialog open={showAddProfitCenterDialog} onOpenChange={setShowAddProfitCenterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Profit Center</DialogTitle>
            <DialogDescription>
              Add a custom profit center to track revenue and expenses for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="profit-center-name">Name</Label>
              <Input
                id="profit-center-name"
                value={newProfitCenterName}
                onChange={(e) => setNewProfitCenterName(e.target.value)}
                placeholder="e.g., Charter Services, Boat Wash, Fishing Licenses"
                data-testid="input-profit-center-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profit-center-section">Category</Label>
              <Select 
                value={newProfitCenterSection} 
                onValueChange={(v) => setNewProfitCenterSection(v as 'storage' | 'designated')}
              >
                <SelectTrigger id="profit-center-section" data-testid="select-profit-center-section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="storage">Storage Type</SelectItem>
                  <SelectItem value="designated">Designated Space</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Storage Types are for boat storage options. Designated Spaces are for ancillary services and amenities.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProfitCenterDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddProfitCenter}
              disabled={!newProfitCenterName.trim()}
              data-testid="button-confirm-add-profit-center"
            >
              Add Profit Center
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
