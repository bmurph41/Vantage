import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { getLeases, deleteLease, bulkDeleteLeases, bulkUpdateLeases, type BulkUpdateLeaseData } from "../../lib/rentRollApi";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Check,
  X,
  Upload,
  Settings2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Calendar,
  Pencil,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";
import BulkLeaseImportDialog from "./BulkLeaseImportDialog";
import ColumnSettingsDialog from "./ColumnSettingsDialog";
import CashFlowDrawer from "./CashFlowDrawer";
import { useRentRollColumns } from "../../hooks/useRentRollColumns";
import { ImportedDataBadge } from "@/components/integrations/ImportedDataBadge";
import type { RentRollColumnConfig, LeaseWithTenant } from "@shared/schema";

// Rolling/MTM contract term types that have no fixed expiration
const ROLLING_CONTRACT_TERMS = ['monthly', 'mtm', 'month-to-month', 'weekly', 'daily', 'daily/nightly'];

/**
 * Helper to check if a lease has a rolling/MTM term (no fixed expiration)
 */
function isRollingLease(lease: LeaseWithTenant): boolean {
  if (!lease.leaseExpiration) return true;
  const term = lease.contractTerm?.toLowerCase() || '';
  return ROLLING_CONTRACT_TERMS.includes(term);
}

/**
 * Calculate days until expiration for a lease.
 * Returns Infinity for rolling/MTM leases (no fixed expiration).
 */
function calculateDaysUntilExpiration(lease: LeaseWithTenant): number {
  if (isRollingLease(lease)) return Infinity;
  
  const expDate = new Date(lease.leaseExpiration!);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = expDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a contract term is Annual
 */
function isAnnualContract(contractTerm: string | null | undefined): boolean {
  if (!contractTerm) return false;
  const term = contractTerm.toLowerCase();
  return term === 'annual' || term === 'yearly' || term === '12 month' || term === '12 months';
}

/**
 * Calculate effective number of months based on contract term
 * Annual = 12 months
 * Seasonal = use stored numMonths if available, or calculate from dates
 */
function calculateEffectiveNumMonths(lease: LeaseWithTenant): number {
  if (isAnnualContract(lease.contractTerm)) {
    return 12;
  }
  
  // Use stored numMonths if valid
  if (lease.numMonths && lease.numMonths > 0) {
    return lease.numMonths;
  }
  
  // Calculate from lease dates if available
  if (lease.leaseCommencement && lease.leaseExpiration) {
    const start = new Date(lease.leaseCommencement);
    const end = new Date(lease.leaseExpiration);
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    let months = yearDiff * 12 + monthDiff;
    if (end.getDate() >= start.getDate()) {
      months += 1;
    }
    return Math.max(1, months);
  }
  
  // Default to 6 months for seasonal if no data available
  const term = lease.contractTerm?.toLowerCase() || '';
  if (term.includes('summer') || term.includes('winter') || term.includes('seasonal')) {
    return 6;
  }
  
  return 0;
}

/**
 * Check if rate type indicates the stored value is a period total (not monthly)
 * $/season, $/yr = stored value is total for the period
 * $/mo., flat fee, etc. = stored value is monthly
 */
function isSeasonalOrAnnualRateType(rateType: string | null | undefined): boolean {
  if (!rateType) return false;
  const rt = rateType.toLowerCase();
  return rt.includes('/season') || rt.includes('/yr') || rt.includes('/year') || 
         rt.includes('per season') || rt.includes('per year') || rt === 'annual' ||
         rt.includes('$/ft/season') || rt.includes('$/ft/yr');
}

/**
 * Calculate monthly rent based on rate type semantics
 * - For seasonal/annual rate types: Monthly = leaseAmount ÷ numMonths
 * - For monthly rate types: Monthly = leaseAmount (as stored)
 */
function calculateMonthlyRent(lease: LeaseWithTenant): number {
  const baseRent = lease.leaseAmount ? parseFloat(lease.leaseAmount) : 0;
  const charge1 = lease.additionalCharge1 ? parseFloat(lease.additionalCharge1) : 0;
  const charge2 = lease.additionalCharge2 ? parseFloat(lease.additionalCharge2) : 0;
  const charge3 = lease.additionalCharge3 ? parseFloat(lease.additionalCharge3) : 0;
  
  const rateType = lease.rateType;
  const numMonths = calculateEffectiveNumMonths(lease);
  
  // For seasonal/annual rate types, the stored value IS the total, so divide to get monthly
  if (isSeasonalOrAnnualRateType(rateType) && numMonths > 0) {
    return (baseRent / numMonths) + charge1 + charge2 + charge3;
  }
  
  // For monthly rate types, the stored value is already monthly
  return baseRent + charge1 + charge2 + charge3;
}

/**
 * Calculate Total Storage Revenue based on rate type semantics
 * This is storage rent ONLY - excludes additional charges (liveaboard, electric, etc.)
 * - For seasonal/annual rate types: Total = leaseAmount (as stored, already represents total)
 * - For monthly rate types: Total = leaseAmount × numMonths
 */
function calculateTotalValue(lease: LeaseWithTenant): number {
  const baseRent = lease.leaseAmount ? parseFloat(lease.leaseAmount) : 0;
  const numMonths = calculateEffectiveNumMonths(lease);
  
  const rateType = lease.rateType;
  
  // For seasonal/annual rate types, the stored value IS the total storage revenue
  if (isSeasonalOrAnnualRateType(rateType)) {
    return baseRent;
  }
  
  // For monthly rate types, multiply by months to get total storage revenue
  return baseRent * numMonths;
}

interface LeasesTableProps {
  onEditLease: (leaseId: string) => void;
  locationId?: string | null;
}

export default function LeasesTable({ onEditLease, locationId }: LeasesTableProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  // Default to "all" when viewing a specific project to show incomplete/default-date leases
  const [statusFilter, setStatusFilter] = useState(locationId ? "all" : "active");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  const [selectedLeases, setSelectedLeases] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<BulkUpdateLeaseData>({});
  const [cashFlowLeaseId, setCashFlowLeaseId] = useState<string | null>(null);
  const [cashFlowLeaseName, setCashFlowLeaseName] = useState<string | undefined>();
  const [cashFlowBoatLength, setCashFlowBoatLength] = useState<number | undefined>();
  
  // Dual scrollbar refs for synchronized horizontal scrolling
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);

  // Column configuration hook
  const { config, visibleColumns, updateConfig, toggleSort } = useRentRollColumns(locationId);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/rent-roll/leases", stateFilter, statusFilter, locationId],
    queryFn: () => getLeases({
      state: stateFilter !== "all" ? stateFilter : undefined,
      isActive: statusFilter === "all" ? undefined : statusFilter === "active" ? true : false,
      pageSize: -1, // Load all leases (no pagination)
      locationId: locationId || undefined,
    }),
  });

  // Fetch storage locations for bulk edit dropdown
  const { data: storageLocations = [] } = useQuery<Array<{ id: string; name: string; isActive: boolean }>>({
    queryKey: ["/api/rent-roll/storage-locations", { projectId: locationId }],
    enabled: !!locationId && showBulkEditDialog,
  });

  // Fetch project config for enabled rate types
  const { data: projectConfig } = useQuery<{
    enabledStorageTypes: string[];
    enabledRateTypes: string[];
    enabledContractTerms: string[];
  }>({
    queryKey: [`/api/rent-roll/locations/${locationId}/details-config`],
    enabled: !!locationId && showBulkEditDialog,
  });

  // Default rate types for bulk edit (same as LeaseFormDrawer)
  const enabledRateTypes = projectConfig?.enabledRateTypes || [
    '$/ft./mo.', 
    '$/ft./season', 
    '$/ft./yr.', 
    '$/mo.', 
    '$/season', 
    '$/yr.', 
    '$/SF', 
    'Flat Fee'
  ];
  
  const enabledContractTerms = projectConfig?.enabledContractTerms || [
    'Annual', 
    'Seasonal/Summer', 
    '6-Months', 
    '3-Months', 
    'Winter', 
    'Monthly', 
    'Weekly', 
    'Daily/Nightly'
  ];

  const deleteMutation = useMutation({
    mutationFn: deleteLease,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/monthly-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/revenue-by-storage-type"] });
      // Invalidate Project Overview queries for real-time updates (matches all date ranges)
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/move-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-by-storage"] });
      // Invalidate Executive Dashboard queries (matches all date ranges)
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/revenue-trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/project-hub-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/included-projects"] });
      toast({
        title: "Lease deleted",
        description: "The lease has been successfully deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete lease",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteLeases,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/monthly-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/revenue-by-storage-type"] });
      // Invalidate Project Overview queries for real-time updates (matches all date ranges)
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/move-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-by-storage"] });
      // Invalidate Executive Dashboard queries (matches all date ranges)
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/revenue-trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/project-hub-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/included-projects"] });
      setSelectedLeases(new Set());
      toast({
        title: "Leases deleted",
        description: `Successfully deleted ${data.deletedCount} lease(s)`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete selected leases",
        variant: "destructive",
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: ({ leaseIds, updates }: { leaseIds: string[]; updates: BulkUpdateLeaseData }) => 
      bulkUpdateLeases(leaseIds, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/monthly-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/revenue-by-storage-type"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-by-storage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/revenue-trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/project-hub-metrics"] });
      setSelectedLeases(new Set());
      setShowBulkEditDialog(false);
      setBulkEditData({});
      toast({
        title: "Leases updated",
        description: `Successfully updated ${data.updatedCount} lease(s)`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update selected leases",
        variant: "destructive",
      });
    },
  });

  const rawLeases = data?.leases || [];

  // Apply client-side search filtering
  const filteredLeases = rawLeases.filter((lease) => {
    if (!searchTerm.trim()) return true;
    
    const term = searchTerm.toLowerCase().trim();
    const searchableFields = [
      lease.tenant?.name,
      lease.unitLocation,
      lease.contractTerm,
      lease.tenant?.boatMake,
      lease.tenant?.boatSize,
      lease.leaseKey,
    ];
    
    return searchableFields.some(field => 
      field && String(field).toLowerCase().includes(term)
    );
  });

  // Apply client-side sorting based on column config
  const leases = [...filteredLeases].sort((a, b) => {
    if (!config.sort.columnId || !config.sort.direction) return 0;
    
    const { columnId, direction } = config.sort;
    const multiplier = direction === 'asc' ? 1 : -1;
    
    let aVal: any;
    let bVal: any;
    
    switch (columnId) {
      case 'tenant':
        aVal = a.tenant?.name?.toLowerCase() || '';
        bVal = b.tenant?.name?.toLowerCase() || '';
        break;
      case 'commencement':
        aVal = a.leaseCommencement || '';
        bVal = b.leaseCommencement || '';
        break;
      case 'expiration':
        aVal = a.leaseExpiration || '';
        bVal = b.leaseExpiration || '';
        break;
      case 'daysUntilExpiration':
        // Use centralized helper function - MTM/rolling leases sort to bottom (Infinity)
        aVal = calculateDaysUntilExpiration(a as LeaseWithTenant);
        bVal = calculateDaysUntilExpiration(b as LeaseWithTenant);
        break;
      case 'monthlyRent':
        // Use helper that properly handles rate type semantics
        aVal = calculateMonthlyRent(a as LeaseWithTenant);
        bVal = calculateMonthlyRent(b as LeaseWithTenant);
        break;
      case 'term':
        aVal = a.contractTerm?.toLowerCase() || '';
        bVal = b.contractTerm?.toLowerCase() || '';
        break;
      case 'location':
        aVal = a.unitLocation?.toLowerCase() || '';
        bVal = b.unitLocation?.toLowerCase() || '';
        break;
      case 'boatDimensions':
        aVal = parseFloat((a as any).boatLength || '0');
        bVal = parseFloat((b as any).boatLength || '0');
        break;
      case 'slipSize':
        aVal = parseFloat(a.slipLength || '0');
        bVal = parseFloat(b.slipLength || '0');
        break;
      case 'boat':
        aVal = `${a.tenant?.boatMake || ''}`.toLowerCase();
        bVal = `${b.tenant?.boatMake || ''}`.toLowerCase();
        break;
      case 'numMonths':
        aVal = calculateEffectiveNumMonths(a as LeaseWithTenant);
        bVal = calculateEffectiveNumMonths(b as LeaseWithTenant);
        break;
      case 'totalStorageRevenue':
        aVal = calculateTotalValue(a as LeaseWithTenant);
        bVal = calculateTotalValue(b as LeaseWithTenant);
        break;
      case 'totalContractValue':
        // Total contract value = storage revenue + all additional charges * numMonths
        const aStorageRev = calculateTotalValue(a as LeaseWithTenant);
        const aCharge1 = parseFloat(a.additionalCharge1 || '0');
        const aCharge2 = parseFloat(a.additionalCharge2 || '0');
        const aCharge3 = parseFloat(a.additionalCharge3 || '0');
        const aNumMonths = calculateEffectiveNumMonths(a as LeaseWithTenant);
        aVal = aStorageRev + (aCharge1 + aCharge2 + aCharge3) * aNumMonths;
        const bStorageRev = calculateTotalValue(b as LeaseWithTenant);
        const bCharge1 = parseFloat(b.additionalCharge1 || '0');
        const bCharge2 = parseFloat(b.additionalCharge2 || '0');
        const bCharge3 = parseFloat(b.additionalCharge3 || '0');
        const bNumMonths = calculateEffectiveNumMonths(b as LeaseWithTenant);
        bVal = bStorageRev + (bCharge1 + bCharge2 + bCharge3) * bNumMonths;
        break;
      case 'boatLength':
        aVal = parseFloat((a as any).boatLength || '0');
        bVal = parseFloat((b as any).boatLength || '0');
        break;
      case 'boatWidth':
        aVal = parseFloat((a as any).boatWidth || '0');
        bVal = parseFloat((b as any).boatWidth || '0');
        break;
      case 'slipLength':
        aVal = parseFloat(a.slipLength || '0');
        bVal = parseFloat(b.slipLength || '0');
        break;
      case 'slipWidth':
        aVal = parseFloat(a.slipWidth || '0');
        bVal = parseFloat(b.slipWidth || '0');
        break;
      case 'slipUtilization':
        const aBoatLenUtil = parseFloat((a as any).boatLength || '0');
        const bBoatLenUtil = parseFloat((b as any).boatLength || '0');
        const aSlipLenUtil = parseFloat(a.slipLength || '0');
        const bSlipLenUtil = parseFloat(b.slipLength || '0');
        aVal = (aBoatLenUtil > 0 && aSlipLenUtil > 0) ? (aBoatLenUtil / aSlipLenUtil) : 0;
        bVal = (bBoatLenUtil > 0 && bSlipLenUtil > 0) ? (bBoatLenUtil / bSlipLenUtil) : 0;
        break;
      case 'ratePerFtMo':
        const aBoatLen1 = parseFloat((a as any).boatLength || '0');
        const bBoatLen1 = parseFloat((b as any).boatLength || '0');
        aVal = aBoatLen1 > 0 ? calculateMonthlyRent(a as LeaseWithTenant) / aBoatLen1 : 0;
        bVal = bBoatLen1 > 0 ? calculateMonthlyRent(b as LeaseWithTenant) / bBoatLen1 : 0;
        break;
      case 'ratePerFtYr':
        const aBoatLen2 = parseFloat((a as any).boatLength || '0');
        const bBoatLen2 = parseFloat((b as any).boatLength || '0');
        const aIsAnnual = isAnnualContract(a.contractTerm);
        const bIsAnnual = isAnnualContract(b.contractTerm);
        aVal = (aBoatLen2 > 0 && aIsAnnual) ? calculateTotalValue(a as LeaseWithTenant) / aBoatLen2 : 0;
        bVal = (bBoatLen2 > 0 && bIsAnnual) ? calculateTotalValue(b as LeaseWithTenant) / bBoatLen2 : 0;
        break;
      case 'ratePerFtSeason':
        const aBoatLen3 = parseFloat((a as any).boatLength || '0');
        const bBoatLen3 = parseFloat((b as any).boatLength || '0');
        const aIsSeasonal = !isAnnualContract(a.contractTerm);
        const bIsSeasonal = !isAnnualContract(b.contractTerm);
        aVal = (aBoatLen3 > 0 && aIsSeasonal) ? calculateTotalValue(a as LeaseWithTenant) / aBoatLen3 : 0;
        bVal = (bBoatLen3 > 0 && bIsSeasonal) ? calculateTotalValue(b as LeaseWithTenant) / bBoatLen3 : 0;
        break;
      case 'customerTotal':
        // For sorting by customer total, calculate total for each tenant using tenantId
        const getCustomerTotalById = (lease: LeaseWithTenant) => {
          const tId = lease.tenantId;
          return rawLeases
            .filter((l: LeaseWithTenant) => l.tenantId === tId)
            .reduce((sum: number, l: LeaseWithTenant) => {
              const base = l.leaseAmount ? parseFloat(l.leaseAmount) : 0;
              const c1 = l.additionalCharge1 ? parseFloat(l.additionalCharge1) : 0;
              const c2 = l.additionalCharge2 ? parseFloat(l.additionalCharge2) : 0;
              const c3 = l.additionalCharge3 ? parseFloat(l.additionalCharge3) : 0;
              return sum + base + c1 + c2 + c3;
            }, 0);
        };
        aVal = getCustomerTotalById(a as LeaseWithTenant);
        bVal = getCustomerTotalById(b as LeaseWithTenant);
        break;
      case 'status':
        aVal = ((a as any).slipStatus || (a.isActive ? 'Occupied' : 'Vacant')).toLowerCase();
        bVal = ((b as any).slipStatus || (b.isActive ? 'Occupied' : 'Vacant')).toLowerCase();
        break;
      case 'liveaboard':
        // Sort by liveaboard fee from line items
        const aLiveaboardItems = ((a as any).lineItems || []).filter(
          (item: any) => item.lineType === 'liveaboard' || item.lineType === 'liveaboard_fee'
        );
        aVal = aLiveaboardItems.reduce((sum: number, item: any) => sum + parseFloat(item.amount || '0'), 0);
        const bLiveaboardItems = ((b as any).lineItems || []).filter(
          (item: any) => item.lineType === 'liveaboard' || item.lineType === 'liveaboard_fee'
        );
        bVal = bLiveaboardItems.reduce((sum: number, item: any) => sum + parseFloat(item.amount || '0'), 0);
        break;
      case 'electric':
        // Sort by electric fee from line items
        const aElectricItems = ((a as any).lineItems || []).filter(
          (item: any) => item.lineType === 'electric'
        );
        aVal = aElectricItems.reduce((sum: number, item: any) => sum + parseFloat(item.amount || '0'), 0);
        const bElectricItems = ((b as any).lineItems || []).filter(
          (item: any) => item.lineType === 'electric'
        );
        bVal = bElectricItems.reduce((sum: number, item: any) => sum + parseFloat(item.amount || '0'), 0);
        break;
      default:
        return 0;
    }
    
    if (aVal < bVal) return -1 * multiplier;
    if (aVal > bVal) return 1 * multiplier;
    return 0;
  });

  // Track table content width for synchronized scrollbars
  const [tableScrollWidth, setTableScrollWidth] = useState(2000);

  // Update table scroll width when content changes
  useEffect(() => {
    const body = bodyScrollRef.current;
    if (!body) return;

    const updateWidth = () => {
      const width = body.scrollWidth;
      if (width > 0) {
        setTableScrollWidth(width);
      }
    };

    updateWidth();
    const timers = [50, 100, 300, 500, 1000].map(delay => 
      setTimeout(updateWidth, delay)
    );

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(body);

    return () => {
      timers.forEach(clearTimeout);
      resizeObserver.disconnect();
    };
  }, [leases, visibleColumns]);

  // Synchronize dual horizontal scrollbars
  useEffect(() => {
    const top = topScrollRef.current;
    const body = bodyScrollRef.current;
    if (!top || !body) return;

    let isSyncing = false;

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      if (isSyncing) return;
      isSyncing = true;
      target.scrollLeft = source.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing = false;
      });
    };

    const handleTopScroll = () => syncScroll(top, body);
    const handleBodyScroll = () => syncScroll(body, top);

    top.addEventListener("scroll", handleTopScroll, { passive: true });
    body.addEventListener("scroll", handleBodyScroll, { passive: true });

    return () => {
      top.removeEventListener("scroll", handleTopScroll);
      body.removeEventListener("scroll", handleBodyScroll);
    };
  }, []);

  // Bulk selection handlers
  const toggleLeaseSelection = (leaseId: string) => {
    const newSelected = new Set(selectedLeases);
    if (newSelected.has(leaseId)) {
      newSelected.delete(leaseId);
    } else {
      newSelected.add(leaseId);
    }
    setSelectedLeases(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedLeases.size === leases.length && leases.length > 0) {
      setSelectedLeases(new Set());
    } else {
      setSelectedLeases(new Set(leases.map(l => l.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedLeases.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedLeases));
    setShowDeleteConfirm(false);
  };

  const handleBulkEdit = () => {
    if (selectedLeases.size === 0) return;
    setBulkEditData({});
    setShowBulkEditDialog(true);
  };

  const confirmBulkEdit = () => {
    const hasUpdates = Object.values(bulkEditData).some(v => v !== undefined && v !== "");
    if (!hasUpdates) {
      toast({
        title: "No changes",
        description: "Please select at least one field to update",
        variant: "destructive",
      });
      return;
    }
    
    const cleanedUpdates: BulkUpdateLeaseData = {};
    // Location
    if (bulkEditData.unitLocation) cleanedUpdates.unitLocation = bulkEditData.unitLocation;
    if (bulkEditData.unitNumber) cleanedUpdates.unitNumber = bulkEditData.unitNumber;
    // Financial
    if (bulkEditData.leaseAmount !== undefined) cleanedUpdates.leaseAmount = bulkEditData.leaseAmount;
    if (bulkEditData.baseRent2 !== undefined) cleanedUpdates.baseRent2 = bulkEditData.baseRent2;
    if (bulkEditData.baseRent3 !== undefined) cleanedUpdates.baseRent3 = bulkEditData.baseRent3;
    if (bulkEditData.additionalCharge1 !== undefined) cleanedUpdates.additionalCharge1 = bulkEditData.additionalCharge1;
    if (bulkEditData.additionalCharge2 !== undefined) cleanedUpdates.additionalCharge2 = bulkEditData.additionalCharge2;
    if (bulkEditData.additionalCharge3 !== undefined) cleanedUpdates.additionalCharge3 = bulkEditData.additionalCharge3;
    // Dates
    if (bulkEditData.commencementDate) cleanedUpdates.commencementDate = bulkEditData.commencementDate;
    if (bulkEditData.expirationDate) cleanedUpdates.expirationDate = bulkEditData.expirationDate;
    // Slip dimensions
    if (bulkEditData.slipLength !== undefined) cleanedUpdates.slipLength = bulkEditData.slipLength;
    if (bulkEditData.slipWidth !== undefined) cleanedUpdates.slipWidth = bulkEditData.slipWidth;
    // Classification
    if (bulkEditData.storageType) cleanedUpdates.storageType = bulkEditData.storageType;
    if (bulkEditData.slipStatus) cleanedUpdates.slipStatus = bulkEditData.slipStatus;
    if (bulkEditData.rateType) cleanedUpdates.rateType = bulkEditData.rateType;
    if (bulkEditData.contractTerm) cleanedUpdates.contractTerm = bulkEditData.contractTerm;
    if (bulkEditData.boatType) cleanedUpdates.boatType = bulkEditData.boatType;
    // Documentation
    if (bulkEditData.leaseOnFile !== undefined) cleanedUpdates.leaseOnFile = bulkEditData.leaseOnFile;
    if (bulkEditData.coiOnFile !== undefined) cleanedUpdates.coiOnFile = bulkEditData.coiOnFile;
    if (bulkEditData.coiExpiration) cleanedUpdates.coiExpiration = bulkEditData.coiExpiration;
    // Discount
    if (bulkEditData.hasDiscount !== undefined) cleanedUpdates.hasDiscount = bulkEditData.hasDiscount;
    if (bulkEditData.discountType) cleanedUpdates.discountType = bulkEditData.discountType;
    if (bulkEditData.discountValue) cleanedUpdates.discountValue = bulkEditData.discountValue;
    
    bulkUpdateMutation.mutate({
      leaseIds: Array.from(selectedLeases),
      updates: cleanedUpdates,
    });
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    try {
      // Parse date string with noon time to avoid timezone shift issues
      // Date strings come as "YYYY-MM-DD", adding T12:00:00 prevents day shift
      const dateWithTime = dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00';
      return format(new Date(dateWithTime), "MM/dd/yyyy");
    } catch {
      return dateStr;
    }
  };

  // Helper function to get cell alignment based on column ID
  const getCellAlignment = (columnId: string): string => {
    const rightAligned = ["monthlyRent", "baseRent2", "baseRent3", "numMonths", "totalStorageRevenue", "totalContractValue", "slipLength", "slipWidth", "boatLength", "boatWidth", "ratePerFtMo", "ratePerFtYr", "ratePerFtSeason", "additionalCharge1", "additionalCharge2", "additionalCharge3", "discount", "actions"];
    const centered = ["term", "boatDimensions", "slipSize", "status", "slipStatus", "leaseOnFile", "coiOnFile"];
    
    if (rightAligned.includes(columnId)) return "text-right";
    if (centered.includes(columnId)) return "text-center";
    return "";
  };

  // Helper function to render cell content based on column ID
  const renderCellContent = (columnId: string, lease: any) => {
    // Safely get tenant data (might be null)
    const tenant = lease?.tenant || {};
    
    switch (columnId) {
      case "tenant":
        const isIncompleteLease = lease.isIncomplete || !lease.leaseCommencement || !lease.leaseAmount;
        const usesDefaultDates = lease.usesDefaultDates === true;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{tenant.name || "N/A"}</span>
            <ImportedDataBadge
              integrationSource={(lease as any).integrationSource || (tenant as any).integrationSource}
              externalId={(lease as any).externalId || (tenant as any).externalId}
              lastSyncedAt={(lease as any).lastSyncedAt || (tenant as any).lastSyncedAt}
            />
            {isIncompleteLease && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle className="w-4 h-4 text-amber-500" data-testid={`incomplete-indicator-${lease.id}`} />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {!lease.leaseCommencement && !lease.leaseAmount 
                      ? "Missing lease date and amount"
                      : !lease.leaseCommencement 
                      ? "Missing lease commencement date"
                      : "Missing lease amount"
                    }
                    {usesDefaultDates && (
                      <span className="block mt-1 text-blue-400">
                        Using default dates - add true lease dates
                      </span>
                    )}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            {!isIncompleteLease && usesDefaultDates && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Calendar className="w-4 h-4 text-blue-500" data-testid={`default-dates-indicator-${lease.id}`} />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Using default dates - add true lease dates</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      
      case "commencement":
        return <span className="text-sm tabular-nums">{formatDate(lease.leaseCommencement)}</span>;
      
      case "expiration":
        return <span className="text-sm tabular-nums">{formatDate(lease.leaseExpiration)}</span>;
      
      case "daysUntilExpiration":
        // Use centralized helper to check for rolling/MTM lease
        if (isRollingLease(lease)) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground cursor-help">—</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Rolling/Month-to-Month lease (no fixed expiration)</p>
              </TooltipContent>
            </Tooltip>
          );
        }
        
        // Use centralized helper for days calculation
        const daysRemaining = calculateDaysUntilExpiration(lease);
        
        // Color coding based on urgency
        let daysColor = "text-muted-foreground";
        let bgClass = "";
        if (daysRemaining < 0) {
          // Already expired
          daysColor = "text-destructive";
          bgClass = "bg-destructive/10";
        } else if (daysRemaining <= 30) {
          // Urgent - expires within 30 days
          daysColor = "text-amber-600 dark:text-amber-400";
          bgClass = "bg-amber-500/10";
        } else if (daysRemaining <= 60) {
          // Warning - expires within 60 days
          daysColor = "text-amber-500 dark:text-amber-300";
        }
        
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center justify-end ${bgClass} rounded px-1`}>
                <span className={`text-sm tabular-nums font-medium ${daysColor}`}>
                  {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d ago` : `${daysRemaining}d`}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {daysRemaining < 0 
                  ? `Expired ${Math.abs(daysRemaining)} days ago on ${formatDate(lease.leaseExpiration)}`
                  : daysRemaining === 0
                  ? `Expires today (${formatDate(lease.leaseExpiration)})`
                  : `Expires in ${daysRemaining} days on ${formatDate(lease.leaseExpiration)}`
                }
              </p>
            </TooltipContent>
          </Tooltip>
        );
      
      case "monthlyRent":
        // Use helper function that properly handles rate type semantics
        const monthlyRentValue = calculateMonthlyRent(lease);
        const mrCharge1 = lease.additionalCharge1 ? parseFloat(lease.additionalCharge1) : 0;
        const mrCharge2 = lease.additionalCharge2 ? parseFloat(lease.additionalCharge2) : 0;
        const mrCharge3 = lease.additionalCharge3 ? parseFloat(lease.additionalCharge3) : 0;
        const hasAdditionalCharges = mrCharge1 > 0 || mrCharge2 > 0 || mrCharge3 > 0;
        
        return (
          <div className="flex items-center justify-end gap-1 font-medium tabular-nums">
            {formatCurrency(monthlyRentValue)}
            {hasAdditionalCharges && (
              <span className="text-xs text-muted-foreground" title={`Includes additional charges`}>
                *
              </span>
            )}
          </div>
        );
      
      case "customerTotal":
        // Calculate total monthly rent for this customer across all their leases
        // Use tenantId to avoid double-counting for different tenants with same name
        const tenantId = lease.tenantId;
        const customerLeases = leases.filter((l: LeaseWithTenant) => 
          l.tenantId === tenantId
        );
        const customerLeaseCount = customerLeases.length;
        const customerTotalRent = customerLeases.reduce((sum: number, l: LeaseWithTenant) => {
          // Use helper that handles rate type semantics correctly
          return sum + calculateMonthlyRent(l);
        }, 0);
        
        // Only show if customer has multiple leases
        if (customerLeaseCount <= 1) {
          return <span className="text-sm text-muted-foreground tabular-nums">—</span>;
        }
        
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-end gap-1 font-medium tabular-nums text-primary cursor-help">
                {formatCurrency(customerTotalRent)}
                <span className="text-xs text-muted-foreground">({customerLeaseCount})</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Total rent across {customerLeaseCount} leases for this customer</p>
            </TooltipContent>
          </Tooltip>
        );
      
      case "seasonSummary":
        // Display seasonal breakdown from line items (winter/summer rates and slips)
        const seasonLineItems = (lease as any).lineItems || [];
        
        // Find winter and summer line items
        const winterItems = seasonLineItems.filter((item: any) => 
          item.lineType === 'winter_slip'
        );
        const summerItems = seasonLineItems.filter((item: any) => 
          item.lineType === 'summer_slip'
        );
        const annualItems = seasonLineItems.filter((item: any) => 
          item.lineType === 'annual_slip'
        );
        
        // Calculate totals for each season
        const winterTotal = winterItems.reduce((sum: number, item: any) => sum + parseFloat(item.amount || "0"), 0);
        const summerTotal = summerItems.reduce((sum: number, item: any) => sum + parseFloat(item.amount || "0"), 0);
        const annualTotal = annualItems.reduce((sum: number, item: any) => sum + parseFloat(item.amount || "0"), 0);
        
        // Get slip assignments (use first one if multiple)
        const winterSlip = winterItems[0]?.slipAssignment || null;
        const summerSlip = summerItems[0]?.slipAssignment || null;
        const annualSlip = annualItems[0]?.slipAssignment || lease.unitLocation || null;
        
        // No seasonal data
        if (winterItems.length === 0 && summerItems.length === 0 && annualItems.length === 0) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        
        // Build season display lines
        const seasonLines: { label: string; amount: number; slip: string | null }[] = [];
        
        if (winterItems.length > 0) {
          seasonLines.push({ label: 'Winter', amount: winterTotal, slip: winterSlip });
        }
        if (summerItems.length > 0) {
          seasonLines.push({ label: 'Summer', amount: summerTotal, slip: summerSlip });
        }
        if (annualItems.length > 0) {
          seasonLines.push({ label: 'Annual', amount: annualTotal, slip: annualSlip });
        }
        
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col gap-0.5 cursor-help text-xs">
                {seasonLines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-muted-foreground">{line.label}:</span>
                    <span className="tabular-nums font-medium">{formatCurrency(line.amount)}</span>
                    {line.slip && (
                      <span className="text-muted-foreground">@ {line.slip}</span>
                    )}
                  </div>
                ))}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 text-xs">
                <p className="font-medium mb-1">Seasonal Breakdown</p>
                {seasonLines.map((line, idx) => (
                  <div key={idx} className="flex justify-between gap-4">
                    <span>{line.label}:</span>
                    <span className="tabular-nums">{formatCurrency(line.amount)} {line.slip ? `@ ${line.slip}` : ''}</span>
                  </div>
                ))}
                {seasonLines.length > 1 && (
                  <>
                    <div className="border-t my-1" />
                    <div className="flex justify-between gap-4 font-medium">
                      <span>Total:</span>
                      <span className="tabular-nums">{formatCurrency(seasonLines.reduce((sum, l) => sum + l.amount, 0))}</span>
                    </div>
                  </>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      
      case "lineItems":
        // Display summary of line items (fee breakdown)
        const leaseLineItems = (lease as any).lineItems || [];
        if (leaseLineItems.length === 0) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        
        // Group line items by type and sum amounts
        const lineItemSummary = leaseLineItems.reduce((acc: Record<string, number>, item: any) => {
          const type = item.lineType.replace(/_/g, " ");
          acc[type] = (acc[type] || 0) + parseFloat(item.amount || "0");
          return acc;
        }, {});
        
        const totalLineItemAmount = Object.values(lineItemSummary).reduce((sum: number, amt) => sum + (amt as number), 0);
        
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-help">
                <Badge variant="outline" className="text-xs">
                  {leaseLineItems.length} fee{leaseLineItems.length !== 1 ? "s" : ""}
                </Badge>
                <span className="text-xs text-muted-foreground tabular-nums">
                  ${totalLineItemAmount.toLocaleString()}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 text-xs">
                {Object.entries(lineItemSummary).map(([type, amount]) => (
                  <div key={type} className="flex justify-between gap-4">
                    <span className="capitalize">{type}:</span>
                    <span className="tabular-nums">${(amount as number).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      
      case "term":
        return (
          <Badge variant="secondary" className="text-xs">
            {lease.contractTerm || "N/A"}
          </Badge>
        );
      
      case "location":
        return <span className="text-sm">{lease.unitLocation || "N/A"}</span>;
      
      case "boatDimensions":
        const boatLength = (lease as any).boatLength;
        const boatWidth = (lease as any).boatWidth;
        const loa = (lease as any).loa;
        
        let dimensionDisplay = "—";
        if (boatLength && boatWidth) {
          dimensionDisplay = `${boatLength}' x ${boatWidth}'`;
        } else if (boatLength) {
          dimensionDisplay = `${boatLength}' (LOA)`;
        } else if (loa) {
          dimensionDisplay = `${loa}' (LOA)`;
        } else if (lease.boatDimensions) {
          dimensionDisplay = lease.boatDimensions;
        }
        return <span className="text-sm tabular-nums">{dimensionDisplay}</span>;
      
      case "slipSize":
        const slipSize = lease.slipLength && lease.slipWidth
          ? `${lease.slipLength} × ${lease.slipWidth}`
          : lease.slipLength
          ? `${lease.slipLength} × —`
          : lease.slipWidth
          ? `— × ${lease.slipWidth}`
          : "—";
        return <span className="text-sm tabular-nums">{slipSize}</span>;
      
      case "boat":
        const boatInfo = tenant.boatMake
          ? `${tenant.boatYear || ""} ${tenant.boatMake}`.trim()
          : "N/A";
        return <span className="text-sm">{boatInfo}</span>;
      
      case "numMonths":
        const effectiveNumMonths = calculateEffectiveNumMonths(lease);
        return <span className="tabular-nums">{effectiveNumMonths}</span>;
      
      case "totalStorageRevenue":
        const totalStorageRev = calculateTotalValue(lease);
        return <span className="font-medium tabular-nums">{formatCurrency(totalStorageRev)}</span>;
      
      case "totalContractValue":
        // Total contract value = storage revenue + all additional charges * numMonths
        const tcvStorageRev = calculateTotalValue(lease);
        const tcvCharge1 = parseFloat(lease.additionalCharge1 || '0');
        const tcvCharge2 = parseFloat(lease.additionalCharge2 || '0');
        const tcvCharge3 = parseFloat(lease.additionalCharge3 || '0');
        const tcvMonths = calculateEffectiveNumMonths(lease);
        const totalContractVal = tcvStorageRev + (tcvCharge1 + tcvCharge2 + tcvCharge3) * tcvMonths;
        return <span className="font-medium tabular-nums">{formatCurrency(totalContractVal)}</span>;
      
      case "boatLength":
        // boatLength is on the tenant, not the lease
        const boatLengthVal = tenant?.boatLength;
        return boatLengthVal ? (
          <span className="tabular-nums">{boatLengthVal}'</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "boatWidth":
        // boatWidth is on the tenant, not the lease
        const boatWidthVal = tenant?.boatWidth;
        return boatWidthVal ? (
          <span className="tabular-nums">{boatWidthVal}'</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "ratePerFtMo":
        const rateBoatLength1 = tenant?.boatLength ? parseFloat(tenant.boatLength) : null;
        const monthlyRentForRate = calculateMonthlyRent(lease);
        if (!rateBoatLength1 || monthlyRentForRate === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        const ratePerFtMo = monthlyRentForRate / rateBoatLength1;
        return <span className="tabular-nums">${ratePerFtMo.toFixed(2)}</span>;
      
      case "ratePerFtYr":
        const rateBoatLength2 = tenant?.boatLength ? parseFloat(tenant.boatLength) : null;
        const totalValueForYr = calculateTotalValue(lease);
        const isAnnual = isAnnualContract(lease.contractTerm);
        if (!rateBoatLength2 || totalValueForYr === 0 || !isAnnual) {
          return <span className="text-muted-foreground">—</span>;
        }
        const ratePerFtYr = totalValueForYr / rateBoatLength2;
        return <span className="tabular-nums">${ratePerFtYr.toFixed(2)}</span>;
      
      case "ratePerFtSeason":
        const rateBoatLength3 = tenant?.boatLength ? parseFloat(tenant.boatLength) : null;
        const totalValueForSeason = calculateTotalValue(lease);
        const isSeasonal = !isAnnualContract(lease.contractTerm);
        if (!rateBoatLength3 || totalValueForSeason === 0 || !isSeasonal) {
          return <span className="text-muted-foreground">—</span>;
        }
        const ratePerFtSeason = totalValueForSeason / rateBoatLength3;
        return <span className="tabular-nums">${ratePerFtSeason.toFixed(2)}</span>;
      
      case "status":
        // Display actual slip status if available, otherwise fallback to Active/Inactive
        const slipStatusValue = (lease as any).slipStatus || (lease.isActive ? "Occupied" : "Vacant");
        
        // Style based on status type
        const isInactive = ["Vacant", "Unusable", "Occupied; Not-Paying"].includes(slipStatusValue);
        
        return (
          <Badge variant={isInactive ? "secondary" : "default"} className="text-xs">
            {slipStatusValue}
          </Badge>
        );
      
      case "baseRent2":
        const rent2 = lease.baseRent2 ? parseFloat(lease.baseRent2) : 0;
        return rent2 > 0 ? (
          <span className="font-medium tabular-nums">{formatCurrency(rent2)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "baseRent3":
        const rent3 = lease.baseRent3 ? parseFloat(lease.baseRent3) : 0;
        return rent3 > 0 ? (
          <span className="font-medium tabular-nums">{formatCurrency(rent3)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "unitNumber":
        return <span className="text-sm">{lease.unitNumber || "—"}</span>;
      
      case "storageType":
        return <span className="text-sm">{lease.storageType || "—"}</span>;
      
      case "slipStatus":
        const ssValue = (lease as any).slipStatus || "—";
        return <span className="text-sm">{ssValue}</span>;
      
      case "rateType":
        return lease.rateType ? (
          <Badge variant="outline" className="text-xs">{lease.rateType}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "contractTerm":
        return <span className="text-sm">{lease.contractTerm || "—"}</span>;
      
      case "boatType":
        return <span className="text-sm">{lease.boatType || "—"}</span>;
      
      case "slipLength":
        return lease.slipLength ? (
          <span className="tabular-nums">{lease.slipLength}'</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "slipWidth":
        return lease.slipWidth ? (
          <span className="tabular-nums">{lease.slipWidth}'</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "slipUtilization":
        const utilizationBoatLength = parseFloat((lease as any).boatLength || '0');
        const utilizationSlipLength = parseFloat(lease.slipLength || '0');
        if (utilizationBoatLength > 0 && utilizationSlipLength > 0) {
          const utilization = (utilizationBoatLength / utilizationSlipLength) * 100;
          return <span className="tabular-nums">{utilization.toFixed(0)}%</span>;
        }
        return <span className="text-muted-foreground">—</span>;
      
      case "leaseOnFile":
        return (
          <span className={lease.leaseOnFile ? "text-green-600" : "text-muted-foreground"}>
            {lease.leaseOnFile ? "Yes" : "No"}
          </span>
        );
      
      case "coiOnFile":
        return (
          <span className={lease.coiOnFile ? "text-green-600" : "text-muted-foreground"}>
            {lease.coiOnFile ? "Yes" : "No"}
          </span>
        );
      
      case "coiExpiration":
        return <span className="text-sm tabular-nums">{formatDate(lease.coiExpiration)}</span>;
      
      case "additionalCharge1":
        const addCharge1 = lease.additionalCharge1 ? parseFloat(lease.additionalCharge1) : 0;
        return addCharge1 > 0 ? (
          <span className="tabular-nums">{formatCurrency(addCharge1)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "additionalCharge2":
        const addCharge2 = lease.additionalCharge2 ? parseFloat(lease.additionalCharge2) : 0;
        return addCharge2 > 0 ? (
          <span className="tabular-nums">{formatCurrency(addCharge2)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "additionalCharge3":
        const addCharge3 = lease.additionalCharge3 ? parseFloat(lease.additionalCharge3) : 0;
        return addCharge3 > 0 ? (
          <span className="tabular-nums">{formatCurrency(addCharge3)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "liveaboard":
        // Get liveaboard fee from line items
        const liveaboardItems = ((lease as any).lineItems || []).filter(
          (item: any) => item.lineType === 'liveaboard' || item.lineType === 'liveaboard_fee'
        );
        const liveaboardTotal = liveaboardItems.reduce(
          (sum: number, item: any) => sum + parseFloat(item.amount || '0'), 0
        );
        return liveaboardTotal > 0 ? (
          <span className="tabular-nums">{formatCurrency(liveaboardTotal)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "electric":
        // Get electric fee from line items
        const electricItems = ((lease as any).lineItems || []).filter(
          (item: any) => item.lineType === 'electric'
        );
        const electricTotal = electricItems.reduce(
          (sum: number, item: any) => sum + parseFloat(item.amount || '0'), 0
        );
        return electricTotal > 0 ? (
          <span className="tabular-nums">{formatCurrency(electricTotal)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      
      case "discount":
        if (!lease.hasDiscount) {
          return <span className="text-muted-foreground">—</span>;
        }
        const discountDisplay = lease.discountType === "PERCENT_OFF" 
          ? `${lease.discountValue}% off`
          : lease.discountType === "AMOUNT_OFF"
          ? `$${lease.discountValue} off`
          : `$${lease.discountValue} flat`;
        return <span className="text-sm">{discountDisplay}</span>;
      
      case "actions":
        return (
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setCashFlowLeaseId(lease.id);
                    setCashFlowLeaseName(lease.tenant?.name);
                    setCashFlowBoatLength(lease.slipLength ? parseFloat(lease.slipLength) : undefined);
                  }}
                  data-testid={`button-cashflow-${lease.id}`}
                >
                  <TrendingUp className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cash Flow</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditLease(lease.id)}
              data-testid={`button-edit-${lease.id}`}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteMutation.mutate(lease.id)}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${lease.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Helper function to render sort icon
  const renderSortIcon = (columnId: string) => {
    if (config.sort.columnId !== columnId) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-50" />;
    }
    
    if (config.sort.direction === 'asc') {
      return <ArrowUp className="w-3 h-3 ml-1" />;
    }
    
    if (config.sort.direction === 'desc') {
      return <ArrowDown className="w-3 h-3 ml-1" />;
    }
    
    return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="leases-table">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg font-medium">All Leases</CardTitle>
          {selectedLeases.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkEdit}
                disabled={bulkUpdateMutation.isPending}
                data-testid="button-bulk-edit"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit Selected ({selectedLeases.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedLeases.size})
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by tenant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-leases"
            />
          </div>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-32" data-testid="select-state-filter">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              <SelectItem value="FL">FL</SelectItem>
              <SelectItem value="GA">GA</SelectItem>
              <SelectItem value="SC">SC</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="default"
            onClick={() => setIsImportDialogOpen(true)}
            data-testid="button-import"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsColumnSettingsOpen(true)}
            data-testid="button-column-settings"
            title="Column Settings"
          >
            <Settings2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {leases.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="empty-state-leases">
            <p className="text-sm">No leases found</p>
            <p className="text-xs mt-1">Click "Add Lease" to create your first lease</p>
          </div>
        ) : (
          <>
            {/* Container with max-height for vertical scrolling - enables sticky behavior */}
            <div className="border rounded-md relative max-h-[70vh] overflow-y-auto" data-testid="leases-scroll-container">
              {/* Sticky horizontal scrollbar at top - stays visible while scrolling vertically through rows */}
              <div
                ref={topScrollRef}
                className="overflow-x-scroll overflow-y-hidden border-b bg-muted/30 sticky top-0 z-30"
                style={{ height: '16px' }}
                data-testid="top-scrollbar"
              >
                <div style={{ height: '1px', width: `${tableScrollWidth}px` }} />
              </div>
              <div ref={bodyScrollRef} className="overflow-x-scroll" style={{ scrollbarWidth: 'auto' }}>
                <Table className="relative" style={{ minWidth: `${tableScrollWidth}px` }}>
                  <TableHeader>
                    <TableRow className="bg-muted border-b">
                      <TableHead className="w-12 sticky left-0 z-20 bg-muted border-r">
                        <Checkbox
                          checked={selectedLeases.size === leases.length && leases.length > 0}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all leases"
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      {visibleColumns.filter(c => c.id !== 'actions').map((column) => {
                        const isSortable = column.sortable;
                        const handleHeaderClick = () => {
                          if (!isSortable) return;
                          toggleSort(column.id);
                        };
                        const isTenantColumn = column.id === 'tenant';
                        
                        return (
                          <TableHead
                            key={column.id}
                            className={`font-semibold whitespace-nowrap ${getCellAlignment(column.id)} ${isSortable ? 'cursor-pointer select-none' : ''} ${isTenantColumn ? 'sticky left-12 z-20 bg-muted min-w-[160px] border-r' : ''}`}
                            onClick={handleHeaderClick}
                            data-testid={`header-${column.id}`}
                          >
                            <div className="flex items-center gap-1">
                              {column.label}
                              {isSortable && renderSortIcon(column.id)}
                            </div>
                          </TableHead>
                        );
                      })}
                      <TableHead className="sticky right-0 z-20 bg-muted text-center font-semibold w-28 border-l" data-testid="header-actions">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leases.map((lease, idx) => {
                      const isEven = idx % 2 === 0;
                      const rowBg = isEven ? "bg-background" : "bg-muted/40";
                      const stickyBg = isEven ? "bg-white dark:bg-background" : "bg-muted";
                      return (
                        <TableRow
                          key={lease.id}
                          className={`${rowBg} hover:bg-muted/60`}
                          data-testid={`lease-row-${lease.id}`}
                        >
                          <TableCell className={`w-12 sticky left-0 z-10 ${stickyBg} border-r`}>
                            <Checkbox
                              checked={selectedLeases.has(lease.id)}
                              onCheckedChange={() => toggleLeaseSelection(lease.id)}
                              aria-label={`Select lease for ${lease.tenant?.name || 'Unknown'}`}
                              data-testid={`checkbox-select-${lease.id}`}
                            />
                          </TableCell>
                          {visibleColumns.filter(c => c.id !== 'actions').map((column) => {
                            const isTenantColumn = column.id === 'tenant';
                            return (
                              <TableCell
                                key={column.id}
                                className={`whitespace-nowrap ${getCellAlignment(column.id)} ${isTenantColumn ? `sticky left-12 z-10 ${stickyBg} min-w-[160px] border-r` : ''}`}
                                data-testid={column.id === 'boatDimensions' ? `text-boat-dimensions-${lease.id}` : undefined}
                              >
                                {renderCellContent(column.id, lease)}
                              </TableCell>
                            );
                          })}
                          <TableCell className={`sticky right-0 z-10 ${stickyBg} w-28 border-l`}>
                            <div className="flex items-center justify-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setCashFlowLeaseId(lease.id);
                                      setCashFlowLeaseName(lease.tenant?.name);
                                      setCashFlowBoatLength(lease.slipLength ? parseFloat(lease.slipLength) : undefined);
                                    }}
                                    data-testid={`button-cashflow-${lease.id}`}
                                  >
                                    <TrendingUp className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Cash Flow</TooltipContent>
                              </Tooltip>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onEditLease(lease.id)}
                                data-testid={`button-edit-${lease.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => deleteMutation.mutate(lease.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-${lease.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Lease count */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground" data-testid="text-lease-count">
                Showing {leases.length} lease{leases.length !== 1 ? "s" : ""}
                {selectedLeases.size > 0 && ` (${selectedLeases.size} selected)`}
              </p>
            </div>
          </>
        )}
      </CardContent>

      <BulkLeaseImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />
      
      <ColumnSettingsDialog
        open={isColumnSettingsOpen}
        onOpenChange={setIsColumnSettingsOpen}
        config={config}
        onSave={updateConfig}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent data-testid="dialog-confirm-bulk-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedLeases.size} lease(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft delete the selected leases (they will be marked as inactive). This action can be reversed by reactivating the leases later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto" data-testid="dialog-bulk-edit">
          <DialogHeader>
            <DialogTitle>Edit {selectedLeases.size} Lease(s)</DialogTitle>
            <DialogDescription>
              Update the selected fields for all {selectedLeases.size} selected leases. Only fields you change will be updated.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Storage Location */}
            {locationId && storageLocations.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="bulk-storage-location">Storage Location</Label>
                <Select 
                  value={bulkEditData.unitLocation || ""} 
                  onValueChange={(v) => setBulkEditData(prev => ({ ...prev, unitLocation: v || undefined }))}
                >
                  <SelectTrigger id="bulk-storage-location" data-testid="select-bulk-storage-location">
                    <SelectValue placeholder="Keep existing" />
                  </SelectTrigger>
                  <SelectContent>
                    {storageLocations.filter(loc => loc.isActive).map(loc => (
                      <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Unit Number */}
            <div className="grid gap-2">
              <Label htmlFor="bulk-unit-number">Unit/Slip Number</Label>
              <Input
                id="bulk-unit-number"
                type="text"
                placeholder="Keep existing"
                value={bulkEditData.unitNumber || ""}
                onChange={(e) => setBulkEditData(prev => ({ 
                  ...prev, 
                  unitNumber: e.target.value || undefined 
                }))}
                data-testid="input-bulk-unit-number"
              />
            </div>
            
            {/* Financial Fields */}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="bulk-lease-amount">Base Rent 1</Label>
                <Input
                  id="bulk-lease-amount"
                  type="number"
                  placeholder="Keep existing"
                  value={bulkEditData.leaseAmount ?? ""}
                  onChange={(e) => setBulkEditData(prev => ({ 
                    ...prev, 
                    leaseAmount: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  data-testid="input-bulk-lease-amount"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-base-rent-2">Base Rent 2</Label>
                <Input
                  id="bulk-base-rent-2"
                  type="number"
                  placeholder="Keep existing"
                  value={bulkEditData.baseRent2 ?? ""}
                  onChange={(e) => setBulkEditData(prev => ({ 
                    ...prev, 
                    baseRent2: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  data-testid="input-bulk-base-rent-2"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-base-rent-3">Base Rent 3</Label>
                <Input
                  id="bulk-base-rent-3"
                  type="number"
                  placeholder="Keep existing"
                  value={bulkEditData.baseRent3 ?? ""}
                  onChange={(e) => setBulkEditData(prev => ({ 
                    ...prev, 
                    baseRent3: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  data-testid="input-bulk-base-rent-3"
                />
              </div>
            </div>
            
            {/* Additional Charges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="bulk-additional-charge-1">Add'l Charge 1</Label>
                <Input
                  id="bulk-additional-charge-1"
                  type="number"
                  placeholder="Keep existing"
                  value={bulkEditData.additionalCharge1 ?? ""}
                  onChange={(e) => setBulkEditData(prev => ({ 
                    ...prev, 
                    additionalCharge1: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  data-testid="input-bulk-additional-charge-1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-additional-charge-2">Add'l Charge 2</Label>
                <Input
                  id="bulk-additional-charge-2"
                  type="number"
                  placeholder="Keep existing"
                  value={bulkEditData.additionalCharge2 ?? ""}
                  onChange={(e) => setBulkEditData(prev => ({ 
                    ...prev, 
                    additionalCharge2: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  data-testid="input-bulk-additional-charge-2"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-additional-charge-3">Add'l Charge 3</Label>
                <Input
                  id="bulk-additional-charge-3"
                  type="number"
                  placeholder="Keep existing"
                  value={bulkEditData.additionalCharge3 ?? ""}
                  onChange={(e) => setBulkEditData(prev => ({ 
                    ...prev, 
                    additionalCharge3: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  data-testid="input-bulk-additional-charge-3"
                />
              </div>
            </div>
            
            {/* Date Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="bulk-commencement-date">Commencement Date</Label>
                <Input
                  id="bulk-commencement-date"
                  type="date"
                  value={bulkEditData.commencementDate || ""}
                  onChange={(e) => setBulkEditData(prev => ({ 
                    ...prev, 
                    commencementDate: e.target.value || undefined 
                  }))}
                  data-testid="input-bulk-commencement-date"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-expiration-date">Expiration Date</Label>
                <Input
                  id="bulk-expiration-date"
                  type="date"
                  value={bulkEditData.expirationDate || ""}
                  onChange={(e) => setBulkEditData(prev => ({ 
                    ...prev, 
                    expirationDate: e.target.value || undefined 
                  }))}
                  data-testid="input-bulk-expiration-date"
                />
              </div>
            </div>
            
            {/* Slip Dimensions */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="bulk-slip-length">Slip Length (ft)</Label>
                <Input
                  id="bulk-slip-length"
                  type="number"
                  placeholder="Keep existing"
                  value={bulkEditData.slipLength ?? ""}
                  onChange={(e) => setBulkEditData(prev => ({ 
                    ...prev, 
                    slipLength: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  data-testid="input-bulk-slip-length"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-slip-width">Slip Width (ft)</Label>
                <Input
                  id="bulk-slip-width"
                  type="number"
                  placeholder="Keep existing"
                  value={bulkEditData.slipWidth ?? ""}
                  onChange={(e) => setBulkEditData(prev => ({ 
                    ...prev, 
                    slipWidth: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  data-testid="input-bulk-slip-width"
                />
              </div>
            </div>
            
            {/* Classification Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="bulk-storage-type">Storage Type</Label>
                <Select 
                  value={bulkEditData.storageType || ""} 
                  onValueChange={(v) => setBulkEditData(prev => ({ ...prev, storageType: v || undefined }))}
                >
                  <SelectTrigger id="bulk-storage-type" data-testid="select-bulk-storage-type">
                    <SelectValue placeholder="Keep existing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Wet Slip">Wet Slip</SelectItem>
                    <SelectItem value="Lift Slip">Lift Slip</SelectItem>
                    <SelectItem value="Mooring">Mooring</SelectItem>
                    <SelectItem value="Jet Ski">Jet Ski</SelectItem>
                    <SelectItem value="Dry Rack - Indoor">Dry Rack - Indoor</SelectItem>
                    <SelectItem value="Dry Rack - Outdoor">Dry Rack - Outdoor</SelectItem>
                    <SelectItem value="Houseboat">Houseboat</SelectItem>
                    <SelectItem value="Land Storage">Land Storage</SelectItem>
                    <SelectItem value="Boat on Trailer">Boat on Trailer</SelectItem>
                    <SelectItem value="Trailer Only">Trailer Only</SelectItem>
                    <SelectItem value="Carport">Carport</SelectItem>
                    <SelectItem value="RV Site">RV Site</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="bulk-slip-status">Slip Status</Label>
                <Select 
                  value={bulkEditData.slipStatus || ""} 
                  onValueChange={(v) => setBulkEditData(prev => ({ ...prev, slipStatus: v || undefined }))}
                >
                  <SelectTrigger id="bulk-slip-status" data-testid="select-bulk-slip-status">
                    <SelectValue placeholder="Keep existing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Occupied">Occupied</SelectItem>
                    <SelectItem value="Vacant">Vacant</SelectItem>
                    <SelectItem value="Unusable">Unusable</SelectItem>
                    <SelectItem value="Occupied; Not-Paying">Occupied; Not-Paying</SelectItem>
                    <SelectItem value="Reserved">Reserved</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="bulk-rate-type">Rate Type</Label>
                <Select 
                  value={bulkEditData.rateType || ""} 
                  onValueChange={(v) => setBulkEditData(prev => ({ ...prev, rateType: v || undefined }))}
                >
                  <SelectTrigger id="bulk-rate-type" data-testid="select-bulk-rate-type">
                    <SelectValue placeholder="Keep existing" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledRateTypes.map((rateType) => (
                      <SelectItem key={rateType} value={rateType}>{rateType}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="bulk-contract-term">Contract Term</Label>
                <Select 
                  value={bulkEditData.contractTerm || ""} 
                  onValueChange={(v) => setBulkEditData(prev => ({ ...prev, contractTerm: v || undefined }))}
                >
                  <SelectTrigger id="bulk-contract-term" data-testid="select-bulk-contract-term">
                    <SelectValue placeholder="Keep existing" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledContractTerms.map((term) => (
                      <SelectItem key={term} value={term}>{term}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="bulk-boat-type">Boat Type</Label>
              <Select 
                value={bulkEditData.boatType || ""} 
                onValueChange={(v) => setBulkEditData(prev => ({ ...prev, boatType: v || undefined }))}
              >
                <SelectTrigger id="bulk-boat-type" data-testid="select-bulk-boat-type">
                  <SelectValue placeholder="Keep existing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Power">Power</SelectItem>
                  <SelectItem value="Sail">Sail</SelectItem>
                  <SelectItem value="Liveaboard">Liveaboard</SelectItem>
                  <SelectItem value="Jet Ski">Jet Ski</SelectItem>
                  <SelectItem value="Catamaran">Catamaran</SelectItem>
                  <SelectItem value="Houseboat">Houseboat</SelectItem>
                  <SelectItem value="Dinghy">Dinghy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Documentation Fields */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bulk-lease-on-file"
                    checked={bulkEditData.leaseOnFile === true}
                    onCheckedChange={(checked) => 
                      setBulkEditData(prev => ({ 
                        ...prev, 
                        leaseOnFile: checked === "indeterminate" ? undefined : checked 
                      }))
                    }
                    data-testid="checkbox-bulk-lease-on-file"
                  />
                  <Label htmlFor="bulk-lease-on-file" className="text-sm">Lease On File</Label>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="bulk-coi-on-file"
                    checked={bulkEditData.coiOnFile === true}
                    onCheckedChange={(checked) => 
                      setBulkEditData(prev => ({ 
                        ...prev, 
                        coiOnFile: checked === "indeterminate" ? undefined : checked 
                      }))
                    }
                    data-testid="checkbox-bulk-coi-on-file"
                  />
                  <Label htmlFor="bulk-coi-on-file" className="text-sm">COI On File</Label>
                </div>
              </div>
              
              <div className="grid gap-2 max-w-[200px]">
                <Label htmlFor="bulk-coi-expiration">COI Expiration</Label>
                <Input
                  id="bulk-coi-expiration"
                  type="date"
                  value={bulkEditData.coiExpiration || ""}
                  onChange={(e) => setBulkEditData(prev => ({ 
                    ...prev, 
                    coiExpiration: e.target.value || undefined 
                  }))}
                  data-testid="input-bulk-coi-expiration"
                />
              </div>
            </div>
            
            {/* Discount Section */}
            <div className="border-t pt-4 mt-2 space-y-3">
              <Label className="font-medium">Discount</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulk-has-discount"
                  checked={bulkEditData.hasDiscount === true}
                  onCheckedChange={(checked) => 
                    setBulkEditData(prev => ({ 
                      ...prev, 
                      hasDiscount: checked === "indeterminate" ? undefined : checked,
                      discountType: checked ? prev.discountType : undefined,
                      discountValue: checked ? prev.discountValue : undefined,
                    }))
                  }
                  data-testid="checkbox-bulk-has-discount"
                />
                <Label htmlFor="bulk-has-discount" className="text-sm">Discount Applied</Label>
              </div>
              
              {bulkEditData.hasDiscount && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <div className="grid gap-2">
                    <Label htmlFor="bulk-discount-type">Discount Type</Label>
                    <Select 
                      value={bulkEditData.discountType || ""} 
                      onValueChange={(v) => setBulkEditData(prev => ({ ...prev, discountType: (v || undefined) as any }))}
                    >
                      <SelectTrigger id="bulk-discount-type" data-testid="select-bulk-discount-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENT_OFF">% Off Posted Rate</SelectItem>
                        <SelectItem value="FLAT_RATE">Flat Rate</SelectItem>
                        <SelectItem value="AMOUNT_OFF">$ Amount Off</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="bulk-discount-value">
                      {bulkEditData.discountType === "PERCENT_OFF" ? "Discount %" : 
                       bulkEditData.discountType === "AMOUNT_OFF" ? "Amount Off ($)" : "Value"}
                    </Label>
                    <Input
                      id="bulk-discount-value"
                      type="number"
                      step="0.01"
                      placeholder={bulkEditData.discountType === "PERCENT_OFF" ? "10" : "50.00"}
                      value={bulkEditData.discountValue || ""}
                      onChange={(e) => setBulkEditData(prev => ({ ...prev, discountValue: e.target.value || undefined }))}
                      data-testid="input-bulk-discount-value"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowBulkEditDialog(false)}
              data-testid="button-cancel-bulk-edit"
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmBulkEdit}
              disabled={bulkUpdateMutation.isPending}
              data-testid="button-confirm-bulk-edit"
            >
              {bulkUpdateMutation.isPending ? "Updating..." : "Update Leases"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CashFlowDrawer
        open={!!cashFlowLeaseId}
        onClose={() => {
          setCashFlowLeaseId(null);
          setCashFlowLeaseName(undefined);
          setCashFlowBoatLength(undefined);
        }}
        leaseId={cashFlowLeaseId}
        tenantName={cashFlowLeaseName}
        boatLength={cashFlowBoatLength}
      />
    </Card>
  );
}
