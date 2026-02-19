import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDisplayPreferences } from '@/hooks/use-display-preferences';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useHoldPeriod } from '@/hooks/use-hold-period';
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
  Loader2,
  LandPlot,
  KeyRound,
  ChevronDown,
  ChevronRight,
  Trash2
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
import type { ProjectConfig } from '@/types/modeling';

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
  seasons: SeasonalityOption[];
  isEnabled: boolean;
  icon: React.ReactNode;
  capacity: string;
  occupiedCount: string;
  occupancyPercent: string;
  occupancyInputMode: 'percentage' | 'count';
};

const storageDefaults = { capacity: '', occupiedCount: '', occupancyPercent: '', occupancyInputMode: 'percentage' as const };

const defaultStorageTypes: StorageTypeConfig[] = [
  { id: 'wet_slips', name: 'Wet Slips', section: 'storage', seasons: ['seasonal'], isEnabled: true, icon: <Anchor className="h-4 w-4" />, ...storageDefaults },
  { id: 'lift_slips', name: 'Lift Slips', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Waves className="h-4 w-4" />, ...storageDefaults },
  { id: 'moorings', name: 'Moorings', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Anchor className="h-4 w-4" />, ...storageDefaults },
  { id: 'dinghies', name: 'Dinghies', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Sailboat className="h-4 w-4" />, ...storageDefaults },
  { id: 'jet_skis', name: 'Jet Skis', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Waves className="h-4 w-4" />, ...storageDefaults },
  { id: 'dry_racks_indoor', name: 'Dry Racks – Indoor', section: 'storage', seasons: ['annual'], isEnabled: true, icon: <Warehouse className="h-4 w-4" />, ...storageDefaults },
  { id: 'dry_racks_outdoor', name: 'Dry Racks – Outdoor', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Container className="h-4 w-4" />, ...storageDefaults },
  { id: 'land_storage', name: 'Land Storage', section: 'storage', seasons: ['annual'], isEnabled: false, icon: <MapPin className="h-4 w-4" />, ...storageDefaults },
  { id: 'boats_on_trailers', name: 'Boats on Trailers', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Ship className="h-4 w-4" />, ...storageDefaults },
  { id: 'trailers', name: 'Trailers', section: 'storage', seasons: ['annual'], isEnabled: false, icon: <Car className="h-4 w-4" />, ...storageDefaults },
  { id: 'carports', name: 'Carports', section: 'storage', seasons: ['annual'], isEnabled: false, icon: <Home className="h-4 w-4" />, ...storageDefaults },
  { id: 'houseboats', name: 'Houseboats', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Home className="h-4 w-4" />, ...storageDefaults },
  { id: 'liveaboards', name: 'Liveaboards', section: 'storage', seasons: ['annual'], isEnabled: false, icon: <Anchor className="h-4 w-4" />, ...storageDefaults },
  { id: 'rv_sites', name: 'RV Sites', section: 'storage', seasons: ['seasonal'], isEnabled: false, icon: <Car className="h-4 w-4" />, ...storageDefaults },
];

const defaultDesignatedSpaces: StorageTypeConfig[] = [
  { id: 'boat_sales', name: 'Boat Sales', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Store className="h-4 w-4" />, ...storageDefaults },
  { id: 'service', name: 'Service', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Wrench className="h-4 w-4" />, ...storageDefaults },
  { id: 'commercial_tenants', name: 'Commercial Tenants', section: 'designated', seasons: ['annual'], isEnabled: false, icon: <Building2 className="h-4 w-4" />, ...storageDefaults },
  { id: 'rental_boats', name: 'Rental Boats', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Ship className="h-4 w-4" />, ...storageDefaults },
  { id: 'boat_club', name: 'Boat Club', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Users className="h-4 w-4" />, ...storageDefaults },
  { id: 'fuel_dock', name: 'Fuel Dock', section: 'designated', seasons: ['seasonal'], isEnabled: true, icon: <Fuel className="h-4 w-4" />, ...storageDefaults },
  { id: 'liveaboard_designated', name: 'Liveaboard', section: 'designated', seasons: ['annual'], isEnabled: false, icon: <Anchor className="h-4 w-4" />, ...storageDefaults },
  { id: 'transient', name: 'Transient', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Anchor className="h-4 w-4" />, ...storageDefaults },
  { id: 'restaurant', name: 'Restaurant', section: 'designated', seasons: ['seasonal'], isEnabled: false, icon: <Utensils className="h-4 w-4" />, ...storageDefaults },
  { id: 'ship_store', name: 'Ship Store', section: 'designated', seasons: ['seasonal'], isEnabled: true, icon: <ShoppingCart className="h-4 w-4" />, ...storageDefaults },
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
  { id: 'pc_commercial_leases', name: 'Commercial Leases', isEnabled: false, icon: <Building2 className="h-4 w-4" /> },
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

type OwnershipType = 'fee_simple' | 'submerged_land_lease' | 'ground_lease' | 'combined';

type LeaseDetail = {
  id: string;
  type: 'submerged_land_lease' | 'ground_lease';
  counterparty: string;
  monthlyRent: string;
  annualRent: string;
  termRemaining: string;
  termUnit: 'years' | 'months';
  expirationDate: string;
  renewalOptions: string;
  renewalCount: string;
  renewalLength: string;
  renewalUnit: 'years' | 'months';
  notes: string;
};

type AcreageData = {
  totalAcres: string;
  uplandAcres: string;
  submergedAcres: string;
};

type OwnershipData = {
  type: OwnershipType;
  leases: LeaseDetail[];
};

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
  const { data: config, isLoading } = useQuery<ProjectConfig>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const { holdPeriod, setHoldPeriod } = useHoldPeriod(projectId);
  const [startDate, setStartDate] = useState<string>('2026-01-31');
  const [cashFlowGranularity, setCashFlowGranularity] = useState<string>('annual');
  const { bottomLineMetric } = useDisplayPreferences();
  const [seasonMonths, setSeasonMonths] = useState<number[]>([4, 5, 6, 7, 8, 9, 10]);
  // NEW: Winter months state
  const [winterMonths, setWinterMonths] = useState<number[]>([11, 12, 1, 2, 3]);
  const [storageTypes, setStorageTypes] = useState<StorageTypeConfig[]>(defaultStorageTypes);
  const [designatedSpaces, setDesignatedSpaces] = useState<StorageTypeConfig[]>(defaultDesignatedSpaces);
  const [profitCenters, setProfitCenters] = useState<ProfitCenterConfig[]>(defaultProfitCenters);
  const [showAddProfitCenterDialog, setShowAddProfitCenterDialog] = useState(false);
  const [newProfitCenterName, setNewProfitCenterName] = useState('');
  const [newProfitCenterSection, setNewProfitCenterSection] = useState<'storage' | 'designated'>('designated');
  const [acreage, setAcreage] = useState<AcreageData>({ totalAcres: '', uplandAcres: '', submergedAcres: '' });
  const [ownership, setOwnership] = useState<OwnershipData>({ type: 'fee_simple', leases: [] });
  const [expandedLeases, setExpandedLeases] = useState<Set<string>>(new Set());

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
    const storageSettings: Record<string, any> = {};
    storageTypes.forEach(item => {
      storageSettings[item.id] = { seasons: item.seasons, isEnabled: item.isEnabled, section: 'storage', capacity: item.capacity, occupiedCount: item.occupiedCount, occupancyPercent: item.occupancyPercent, occupancyInputMode: item.occupancyInputMode };
    });
    designatedSpaces.forEach(item => {
      storageSettings[item.id] = { seasons: item.seasons, isEnabled: item.isEnabled, section: 'designated', capacity: item.capacity, occupiedCount: item.occupiedCount, occupancyPercent: item.occupancyPercent, occupancyInputMode: item.occupancyInputMode };
    });

    const profitCenterSettings: Record<string, { isEnabled: boolean }> = {};
    profitCenters.forEach(item => {
      profitCenterSettings[item.id] = { isEnabled: item.isEnabled };
    });

    return {
      holdPeriod,
      startDate,
      cashFlowGranularity,
      bottomLineMetric,
      seasonMonths,
      winterMonths,
      departments: storageSettings,
      profitCenters: profitCenterSettings,
      acreage,
      ownership,
    };
  };

  useEffect(() => {
    if (config) {
      setStartDate(config.startDate || '2026-01-31');
      setCashFlowGranularity(config.cashFlowGranularity || 'annual');
      setSeasonMonths(config.seasonMonths || [4, 5, 6, 7, 8, 9, 10]);
      setWinterMonths(config.winterMonths || [11, 12, 1, 2, 3]);
      if (config.departments) {
        setStorageTypes(prev => prev.map(item => {
          const dept = config.departments[item.id];
          if (!dept) return item;
          let seasons = dept.seasons;
          if (!seasons && typeof dept.isYearRound === 'boolean') {
            seasons = dept.isYearRound ? ['annual'] : ['seasonal'];
          }
          return {
            ...item,
            seasons: seasons ?? item.seasons,
            isEnabled: dept.isEnabled ?? item.isEnabled,
            capacity: dept.capacity ?? item.capacity,
            occupiedCount: dept.occupiedCount ?? item.occupiedCount,
            occupancyPercent: dept.occupancyPercent ?? item.occupancyPercent,
            occupancyInputMode: dept.occupancyInputMode ?? item.occupancyInputMode,
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
            isEnabled: dept.isEnabled ?? item.isEnabled,
            capacity: dept.capacity ?? item.capacity,
            occupiedCount: dept.occupiedCount ?? item.occupiedCount,
            occupancyPercent: dept.occupancyPercent ?? item.occupancyPercent,
            occupancyInputMode: dept.occupancyInputMode ?? item.occupancyInputMode,
          };
        }));
      }
      if (config.profitCenters) {
        setProfitCenters(prev => prev.map(item => ({
          ...item,
          isEnabled: config.profitCenters[item.id]?.isEnabled ?? item.isEnabled
        })));
      }
      if ((config as any).acreage) {
        setAcreage((config as any).acreage);
      }
      if ((config as any).ownership) {
        const savedOwnership = (config as any).ownership as OwnershipData;
        let leases = (savedOwnership.leases || []).map((l: any) => {
          let renewalCount = l.renewalCount ?? '';
          let renewalLength = l.renewalLength ?? '';
          let renewalUnit = l.renewalUnit ?? 'years';
          if (!renewalCount && !renewalLength && l.renewalOptions) {
            const match = l.renewalOptions.match(/(\d+)\s*[x×]\s*(\d+)[- ]?(year|month)/i);
            if (match) {
              renewalCount = match[1];
              renewalLength = match[2];
              renewalUnit = match[3].toLowerCase().startsWith('month') ? 'months' : 'years';
            } else {
              const numMatch = l.renewalOptions.match(/(\w+|(\d+))\s+(\d+)[- ]?(year|month)/i);
              if (numMatch) {
                const wordToNum: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5' };
                renewalCount = numMatch[2] || wordToNum[numMatch[1].toLowerCase()] || '1';
                renewalLength = numMatch[3];
                renewalUnit = numMatch[4].toLowerCase().startsWith('month') ? 'months' : 'years';
              }
            }
          }
          return { ...l, renewalCount, renewalLength, renewalUnit };
        }) as LeaseDetail[];
        const type = savedOwnership.type;
        const mkLease = (t: 'submerged_land_lease' | 'ground_lease', suffix = ''): LeaseDetail => ({
          id: `lease_${Date.now()}${suffix}`, type: t, counterparty: '', monthlyRent: '', annualRent: '',
          termRemaining: '', termUnit: 'years', expirationDate: '', renewalOptions: '',
          renewalCount: '', renewalLength: '', renewalUnit: 'years', notes: '',
        });
        if (type === 'submerged_land_lease' && !leases.some(l => l.type === 'submerged_land_lease')) {
          leases = [...leases, mkLease('submerged_land_lease')];
        } else if (type === 'ground_lease' && !leases.some(l => l.type === 'ground_lease')) {
          leases = [...leases, mkLease('ground_lease')];
        } else if (type === 'combined') {
          if (!leases.some(l => l.type === 'submerged_land_lease')) {
            leases = [...leases, mkLease('submerged_land_lease', '_s')];
          }
          if (!leases.some(l => l.type === 'ground_lease')) {
            leases = [...leases, mkLease('ground_lease', '_g')];
          }
        }
        setOwnership({ type, leases });
        setExpandedLeases(new Set(leases.map(l => l.id)));
      }
    }
  }, [config]);

  useEffect(() => {
    if (config) {
      triggerAutosave(getCurrentData());
    }
  }, [holdPeriod, startDate, cashFlowGranularity, bottomLineMetric, seasonMonths, winterMonths, storageTypes, designatedSpaces, profitCenters, acreage, ownership]);

  const toggleSeasonMonth = (month: number) => {
    setSeasonMonths(prev => 
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

  const updateStorageField = (itemId: string, section: 'storage' | 'designated', updates: Partial<StorageTypeConfig>) => {
    const setter = section === 'storage' ? setStorageTypes : setDesignatedSpaces;
    setter(prev => prev.map(item => item.id === itemId ? { ...item, ...updates } : item));
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
      ...storageDefaults,
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

  const addLease = (type: 'submerged_land_lease' | 'ground_lease') => {
    const newLease: LeaseDetail = {
      id: `lease_${Date.now()}`,
      type,
      counterparty: '',
      monthlyRent: '',
      annualRent: '',
      termRemaining: '',
      termUnit: 'years',
      expirationDate: '',
      renewalOptions: '',
      renewalCount: '',
      renewalLength: '',
      renewalUnit: 'years',
      notes: '',
    };
    setOwnership(prev => ({ ...prev, leases: [...prev.leases, newLease] }));
    setExpandedLeases(prev => new Set([...prev, newLease.id]));
  };

  const updateLease = (id: string, field: keyof LeaseDetail, value: string) => {
    setOwnership(prev => ({
      ...prev,
      leases: prev.leases.map(l => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        if (field === 'renewalCount' || field === 'renewalLength' || field === 'renewalUnit') {
          const count = field === 'renewalCount' ? value : updated.renewalCount;
          const length = field === 'renewalLength' ? value : updated.renewalLength;
          const unit = field === 'renewalUnit' ? value : updated.renewalUnit;
          if (count && length) {
            updated.renewalOptions = `${count} x ${length}-${unit} renewal option${parseInt(count) !== 1 ? 's' : ''}`;
          } else {
            updated.renewalOptions = '';
          }
        }
        if (field === 'monthlyRent') {
          if (value) {
            const monthly = parseFloat(value);
            if (!isNaN(monthly)) updated.annualRent = (monthly * 12).toFixed(2);
          } else {
            updated.annualRent = '';
          }
        } else if (field === 'annualRent') {
          if (value) {
            const annual = parseFloat(value);
            if (!isNaN(annual)) updated.monthlyRent = (annual / 12).toFixed(2);
          } else {
            updated.monthlyRent = '';
          }
        }
        return updated;
      }),
    }));
  };

  const removeLease = (id: string) => {
    setOwnership(prev => ({
      ...prev,
      leases: prev.leases.filter(l => l.id !== id),
    }));
    setExpandedLeases(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleLeaseExpanded = (id: string) => {
    setExpandedLeases(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createDefaultLease = (type: 'submerged_land_lease' | 'ground_lease'): LeaseDetail => ({
    id: `lease_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    counterparty: '',
    monthlyRent: '',
    annualRent: '',
    termRemaining: '',
    termUnit: 'years',
    expirationDate: '',
    renewalOptions: '',
    renewalCount: '',
    renewalLength: '',
    renewalUnit: 'years',
    notes: '',
  });

  const handleOwnershipTypeChange = (type: OwnershipType) => {
    const newLeaseIds: string[] = [];
    setOwnership(prev => {
      let leases = [...prev.leases];
      if (type === 'fee_simple') {
        setExpandedLeases(new Set());
        return { type, leases: [] };
      }
      if (type === 'submerged_land_lease') {
        if (!leases.some(l => l.type === 'submerged_land_lease')) {
          const newLease = createDefaultLease('submerged_land_lease');
          leases = [...leases, newLease];
          newLeaseIds.push(newLease.id);
        }
      } else if (type === 'ground_lease') {
        if (!leases.some(l => l.type === 'ground_lease')) {
          const newLease = createDefaultLease('ground_lease');
          leases = [...leases, newLease];
          newLeaseIds.push(newLease.id);
        }
      } else if (type === 'combined') {
        if (!leases.some(l => l.type === 'submerged_land_lease')) {
          const newLease = createDefaultLease('submerged_land_lease');
          leases = [...leases, newLease];
          newLeaseIds.push(newLease.id);
        }
        if (!leases.some(l => l.type === 'ground_lease')) {
          const newLease = createDefaultLease('ground_lease');
          leases = [...leases, newLease];
          newLeaseIds.push(newLease.id);
        }
      }
      return { type, leases };
    });
    if (newLeaseIds.length > 0) {
      setExpandedLeases(prev => new Set([...prev, ...newLeaseIds]));
    }
  };

  const getSeasonLabel = () => {
    if (seasonMonths.length === 0) return 'No season selected';
    if (seasonMonths.length === 12) return 'Year-round';

    const startMonth = months.find(m => m.value === Math.min(...seasonMonths));
    const endMonth = months.find(m => m.value === Math.max(...seasonMonths));
    return `${startMonth?.short} - ${endMonth?.short} (${seasonMonths.length} months)`;
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-72 mt-1.5" />
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onTabChange && (
        <WorkflowNavigation currentTab="inputs" onNavigate={onTabChange} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Project Inputs</h2>
          <p className="text-xs text-muted-foreground">
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              Hold Period & Start Date
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0 px-4 pb-4">
            <div className="space-y-1">
              <Label htmlFor="holdPeriod" className="text-xs text-muted-foreground">Hold Period</Label>
              <Select 
                value={holdPeriod.toString()} 
                onValueChange={(v) => setHoldPeriod(parseInt(v))}
              >
                <SelectTrigger id="holdPeriod" data-testid="select-hold-period" className="h-8">
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
            <div className="space-y-1">
              <Label htmlFor="startDate" className="text-xs text-muted-foreground">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cashFlowGranularity" className="text-xs text-muted-foreground">Cash Flow Timing</Label>
              <Select 
                value={cashFlowGranularity} 
                onValueChange={(v) => setCashFlowGranularity(v)}
              >
                <SelectTrigger id="cashFlowGranularity" data-testid="select-granularity" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sun className="h-4 w-4" />
                In-Season Months
              </CardTitle>
              <Button
                variant={seasonMonths.length === 12 ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setSeasonMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}
              >
                Year-Round
              </Button>
            </div>
            <CardDescription className="text-[11px]">
              {getSeasonLabel()}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="grid grid-cols-4 gap-1.5">
              {months.map((month) => (
                <Button
                  key={month.value}
                  variant={seasonMonths.includes(month.value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleSeasonMonth(month.value)}
                  className="w-full h-7 text-xs px-1"
                >
                  {seasonMonths.includes(month.value) ? (
                    <Sun className="h-3 w-3 mr-0.5" />
                  ) : (
                    <Snowflake className="h-3 w-3 mr-0.5" />
                  )}
                  {month.short}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <LandPlot className="h-4 w-4" />
              Acreage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="totalAcres" className="text-xs text-muted-foreground">Total</Label>
                <Input
                  id="totalAcres"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={acreage.totalAcres}
                  onChange={(e) => setAcreage(prev => ({ ...prev, totalAcres: e.target.value }))}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="uplandAcres" className="text-xs text-muted-foreground">Upland</Label>
                <Input
                  id="uplandAcres"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={acreage.uplandAcres}
                  onChange={(e) => setAcreage(prev => ({ ...prev, uplandAcres: e.target.value }))}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="submergedAcres" className="text-xs text-muted-foreground">Submerged</Label>
                <Input
                  id="submergedAcres"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={acreage.submergedAcres}
                  onChange={(e) => setAcreage(prev => ({ ...prev, submergedAcres: e.target.value }))}
                  className="h-8"
                />
              </div>
            </div>
            {acreage.uplandAcres && acreage.submergedAcres && (
              <div className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 border text-xs">
                <span className="text-muted-foreground">Sum</span>
                <span className="font-medium">
                  {(parseFloat(acreage.uplandAcres || '0') + parseFloat(acreage.submergedAcres || '0')).toFixed(2)} ac
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4" />
              Ownership Structure
            </CardTitle>
            <CardDescription className="text-[11px]">
              Property ownership type and lease details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0 px-4 pb-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ownership Type</Label>
              <Select
                value={ownership.type}
                onValueChange={(v) => handleOwnershipTypeChange(v as OwnershipType)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fee_simple">Fee Simple</SelectItem>
                  <SelectItem value="submerged_land_lease">Submerged Land Lease</SelectItem>
                  <SelectItem value="ground_lease">Ground Lease</SelectItem>
                  <SelectItem value="combined">Combined (Multiple)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {ownership.type === 'fee_simple' && 'Full ownership of upland and submerged land'}
                {ownership.type === 'submerged_land_lease' && 'Fee simple upland, leased submerged'}
                {ownership.type === 'ground_lease' && 'Operating on leased ground'}
                {ownership.type === 'combined' && 'Mix of owned and leased parcels'}
              </p>
            </div>

            {ownership.type !== 'fee_simple' && (
              <div className="space-y-2">
                <Separator />
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">Lease Details</h4>
                  <div className="flex gap-1">
                    {(ownership.type === 'submerged_land_lease' || ownership.type === 'combined') && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => addLease('submerged_land_lease')}>
                        <Plus className="h-3 w-3 mr-0.5" />
                        Submerged
                      </Button>
                    )}
                    {(ownership.type === 'ground_lease' || ownership.type === 'combined') && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => addLease('ground_lease')}>
                        <Plus className="h-3 w-3 mr-0.5" />
                        Ground
                      </Button>
                    )}
                  </div>
                </div>

                {ownership.leases.length === 0 && (
                  <div className="text-center py-3 text-muted-foreground text-xs border border-dashed rounded-lg">
                    No leases added yet.
                  </div>
                )}

                {ownership.leases.map((lease) => (
                  <div key={lease.id} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center justify-between p-2 bg-muted/30 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleLeaseExpanded(lease.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        {expandedLeases.has(lease.id) ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {lease.type === 'submerged_land_lease' ? 'Submerged' : 'Ground'}
                        </Badge>
                        <span className="text-xs font-medium truncate">
                          {lease.counterparty || 'Unnamed'}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeLease(lease.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {expandedLeases.has(lease.id) && (
                      <div className="p-2.5 space-y-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Counterparty</Label>
                          <Input
                            placeholder="e.g., State of Florida"
                            value={lease.counterparty}
                            onChange={(e) => updateLease(lease.id, 'counterparty', e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Monthly ($)</Label>
                            <Input type="number" step="0.01" min="0" placeholder="0" value={lease.monthlyRent}
                              onChange={(e) => updateLease(lease.id, 'monthlyRent', e.target.value)} className="h-7 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Annual ($)</Label>
                            <Input type="number" step="0.01" min="0" placeholder="0" value={lease.annualRent}
                              onChange={(e) => updateLease(lease.id, 'annualRent', e.target.value)} className="h-7 text-xs" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Term Remaining</Label>
                            <div className="flex gap-1">
                              <Input type="number" min="0" placeholder="0" value={lease.termRemaining}
                                onChange={(e) => updateLease(lease.id, 'termRemaining', e.target.value)} className="h-7 text-xs flex-1" />
                              <Select value={lease.termUnit} onValueChange={(v) => updateLease(lease.id, 'termUnit', v)}>
                                <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="years">Yr</SelectItem>
                                  <SelectItem value="months">Mo</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Expiration</Label>
                            <Input type="date" value={lease.expirationDate}
                              onChange={(e) => updateLease(lease.id, 'expirationDate', e.target.value)} className="h-7 text-xs" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Renewal Options</Label>
                            <Input type="number" min="0" placeholder="0" value={lease.renewalCount}
                              onChange={(e) => updateLease(lease.id, 'renewalCount', e.target.value)} className="h-7 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Option Length</Label>
                            <div className="flex gap-1">
                              <Input type="number" min="0" placeholder="0" value={lease.renewalLength}
                                onChange={(e) => updateLease(lease.id, 'renewalLength', e.target.value)} className="h-7 text-xs flex-1" />
                              <Select value={lease.renewalUnit} onValueChange={(v) => updateLease(lease.id, 'renewalUnit', v)}>
                                <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="years">Yr</SelectItem>
                                  <SelectItem value="months">Mo</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Notes</Label>
                          <Input placeholder="Additional terms, escalation, etc."
                            value={lease.notes} onChange={(e) => updateLease(lease.id, 'notes', e.target.value)} className="h-7 text-xs" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Warehouse className="h-4 w-4" />
                Storage Types
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => { setNewProfitCenterSection('storage'); setShowAddProfitCenterDialog(true); }}
              >
                <Plus className="h-3 w-3 mr-0.5" />
                Add
              </Button>
            </div>
            <CardDescription className="text-[11px]">
              {storageTypes.filter(s => s.isEnabled).length} of {storageTypes.length} enabled
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="space-y-1">
              {storageTypes.map((item) => (
                <div key={item.id}>
                  <div
                    className={`flex items-center justify-between py-1.5 px-2 rounded ${
                      item.isEnabled 
                        ? 'bg-muted/30' 
                        : 'opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.isEnabled}
                        onChange={() => toggleItemEnabled(item.id, 'storage')}
                        className="h-3.5 w-3.5 rounded border-muted-foreground/50 cursor-pointer"
                      />
                      <span className="text-xs">{item.icon}</span>
                      <span className={`text-xs truncate ${!item.isEnabled && 'text-muted-foreground'}`}>
                        {item.name}
                      </span>
                    </div>
                    {item.isEnabled && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {renderSeasonalitySelector(item, 'storage')}
                      </div>
                    )}
                  </div>
                  {item.isEnabled && (
                    <div className="flex items-center gap-2 px-2 py-1 ml-6">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground w-12">Capacity</span>
                        <Input
                          type="number"
                          value={item.capacity}
                          placeholder="0"
                          onChange={(e) => {
                            const cap = e.target.value;
                            const updates: Partial<StorageTypeConfig> = { capacity: cap };
                            const capNum = parseInt(cap);
                            if (capNum > 0) {
                              if (item.occupancyInputMode === 'count' && item.occupiedCount) {
                                updates.occupancyPercent = Math.round((parseInt(item.occupiedCount) / capNum) * 100).toString();
                              } else if (item.occupancyInputMode === 'percentage' && item.occupancyPercent) {
                                updates.occupiedCount = Math.round((parseFloat(item.occupancyPercent) / 100) * capNum).toString();
                              }
                            }
                            updateStorageField(item.id, 'storage', updates);
                          }}
                          className="h-6 w-16 text-[10px] px-1.5"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground w-12">Occupied</span>
                        <div className="flex rounded-md border border-border overflow-hidden mr-1">
                          <button
                            type="button"
                            className={`px-1 py-0 text-[9px] font-medium transition-colors ${
                              item.occupancyInputMode === 'count'
                                ? "bg-primary text-primary-foreground"
                                : "bg-background text-muted-foreground hover:bg-muted"
                            }`}
                            onClick={() => {
                              const updates: Partial<StorageTypeConfig> = { occupancyInputMode: 'count' };
                              if (item.occupancyPercent && item.capacity) {
                                updates.occupiedCount = Math.round((parseFloat(item.occupancyPercent) / 100) * parseInt(item.capacity)).toString();
                              }
                              updateStorageField(item.id, 'storage', updates);
                            }}
                          >
                            #
                          </button>
                          <button
                            type="button"
                            className={`px-1 py-0 text-[9px] font-medium transition-colors ${
                              item.occupancyInputMode === 'percentage'
                                ? "bg-primary text-primary-foreground"
                                : "bg-background text-muted-foreground hover:bg-muted"
                            }`}
                            onClick={() => {
                              const updates: Partial<StorageTypeConfig> = { occupancyInputMode: 'percentage' };
                              if (item.occupiedCount && item.capacity) {
                                updates.occupancyPercent = Math.round((parseInt(item.occupiedCount) / parseInt(item.capacity)) * 100).toString();
                              }
                              updateStorageField(item.id, 'storage', updates);
                            }}
                          >
                            %
                          </button>
                        </div>
                        {item.occupancyInputMode === 'count' ? (
                          <Input
                            type="number"
                            value={item.occupiedCount}
                            placeholder="0"
                            onChange={(e) => {
                              const occ = e.target.value;
                              const updates: Partial<StorageTypeConfig> = { occupiedCount: occ };
                              if (occ && item.capacity && parseInt(item.capacity) > 0) {
                                updates.occupancyPercent = Math.round((parseInt(occ) / parseInt(item.capacity)) * 100).toString();
                              }
                              updateStorageField(item.id, 'storage', updates);
                            }}
                            className="h-6 w-14 text-[10px] px-1.5"
                          />
                        ) : (
                          <Input
                            type="number"
                            value={item.occupancyPercent}
                            placeholder="0"
                            onChange={(e) => {
                              const pct = e.target.value;
                              const updates: Partial<StorageTypeConfig> = { occupancyPercent: pct };
                              if (pct && item.capacity && parseInt(item.capacity) > 0) {
                                updates.occupiedCount = Math.round((parseFloat(pct) / 100) * parseInt(item.capacity)).toString();
                              }
                              updateStorageField(item.id, 'storage', updates);
                            }}
                            className="h-6 w-14 text-[10px] px-1.5"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Separator className="my-2" />

            <h4 className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              Designated Spaces
            </h4>
            <div className="space-y-1">
              {designatedSpaces.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between py-1.5 px-2 rounded ${
                    item.isEnabled 
                      ? 'bg-muted/30' 
                      : 'opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={item.isEnabled}
                      onChange={() => toggleItemEnabled(item.id, 'designated')}
                      className="h-3.5 w-3.5 rounded border-muted-foreground/50 cursor-pointer"
                    />
                    <span className="text-xs">{item.icon}</span>
                    <span className={`text-xs truncate ${!item.isEnabled && 'text-muted-foreground'}`}>
                      {item.name}
                    </span>
                  </div>
                  {item.isEnabled && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {renderSeasonalitySelector(item, 'designated')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Store className="h-4 w-4" />
                Profit Centers
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => { setNewProfitCenterSection('designated'); setShowAddProfitCenterDialog(true); }}
              >
                <Plus className="h-3 w-3 mr-0.5" />
                Add
              </Button>
            </div>
            <CardDescription className="text-[11px]">
              {profitCenters.filter(p => p.isEnabled).length} of {profitCenters.length} enabled
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="space-y-1">
              {profitCenters.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 py-1.5 px-2 rounded ${
                    item.isEnabled 
                      ? 'bg-muted/30' 
                      : 'opacity-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.isEnabled}
                    onChange={() => toggleProfitCenterEnabled(item.id)}
                    className="h-3.5 w-3.5 rounded border-muted-foreground/50 cursor-pointer"
                  />
                  <span className="text-xs">{item.icon}</span>
                  <span className={`text-xs truncate ${!item.isEnabled && 'text-muted-foreground'}`}>
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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