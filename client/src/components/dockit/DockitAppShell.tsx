/**
 * DockitAppShell - Content wrapper for Dockit module pages
 * 
 * This component provides a consistent header and content area for Dockit pages.
 * The main sidebar is rendered by the parent App component, so we only render
 * the content area here (no duplicate sidebar).
 */

import { ReactNode, useState, useEffect } from "react";
import { Link } from "wouter";
import { ChevronRight, Anchor, Filter, Building2, Calendar, Users, X, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";

export interface LaunchFilters {
  marinas: string[];
  timeFrame: 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 'all';
  customerId?: string;
}

interface Marina {
  id: number;
  name: string;
  propertyId?: number;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface DockitAppShellProps {
  children: ReactNode;
  title?: string;
  description?: string;
  showFilters?: boolean;
  filters?: LaunchFilters;
  onFiltersChange?: (filters: LaunchFilters) => void;
}

const defaultFilters: LaunchFilters = {
  marinas: [], // Empty means "all marinas"
  timeFrame: 'today',
  customerId: undefined,
};

export default function DockitAppShell({ 
  children, 
  title, 
  description, 
  showFilters = true,
  filters = defaultFilters,
  onFiltersChange 
}: DockitAppShellProps) {
  const [localFilters, setLocalFilters] = useState<LaunchFilters>(filters);
  const [marinaPopoverOpen, setMarinaPopoverOpen] = useState(false);

  // Fetch marinas/properties for the filter
  const { data: marinas = [] } = useQuery<Marina[]>({
    queryKey: ["/api/crm/properties"],
    retry: false,
  });

  // Fetch customers for the filter
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/dockit/api/customers"],
    retry: false,
  });

  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange(localFilters);
    }
  }, [localFilters, onFiltersChange]);

  const handleMarinaToggle = (marinaId: string) => {
    setLocalFilters(prev => {
      const newMarinas = prev.marinas.includes(marinaId)
        ? prev.marinas.filter(id => id !== marinaId)
        : [...prev.marinas, marinaId];
      return { ...prev, marinas: newMarinas };
    });
  };

  const handleSelectAllMarinas = () => {
    setLocalFilters(prev => ({ ...prev, marinas: [] }));
  };

  const handleTimeFrameChange = (value: string) => {
    setLocalFilters(prev => ({ ...prev, timeFrame: value as LaunchFilters['timeFrame'] }));
  };

  const handleCustomerChange = (value: string) => {
    setLocalFilters(prev => ({ 
      ...prev, 
      customerId: value === 'all' ? undefined : value 
    }));
  };

  const getTimeFrameLabel = (tf: string) => {
    const labels: Record<string, string> = {
      today: 'Today',
      this_week: 'This Week',
      this_month: 'This Month',
      this_quarter: 'This Quarter',
      this_year: 'This Year',
      all: 'All Time'
    };
    return labels[tf] || tf;
  };

  const activeFilterCount = 
    (localFilters.marinas.length > 0 ? 1 : 0) + 
    (localFilters.timeFrame !== 'today' ? 1 : 0) + 
    (localFilters.customerId ? 1 : 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header with breadcrumb - fixed at top */}
      <div className="border-b bg-white px-6 py-4 flex-shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/operations/dockit" className="hover:text-foreground flex items-center gap-1">
            <Anchor className="h-3.5 w-3.5" />
            Launch Operations
          </Link>
          {title && title !== "Launch Control" && (
            <>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium">{title}</span>
            </>
          )}
        </div>
        
        {/* Title and Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Title */}
          {title && (
            <div>
              <h1 className="text-xl font-semibold">{title}</h1>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          )}

          {/* Filters */}
          {showFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Marina/Property Filter */}
              <Popover open={marinaPopoverOpen} onOpenChange={setMarinaPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1.5"
                    data-testid="filter-marina"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {localFilters.marinas.length === 0 
                      ? "All Marinas" 
                      : `${localFilters.marinas.length} Marina${localFilters.marinas.length > 1 ? 's' : ''}`}
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="end">
                  <div className="p-3 border-b">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Filter by Marina</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={handleSelectAllMarinas}
                      >
                        Select All
                      </Button>
                    </div>
                  </div>
                  <div className="p-2 max-h-64 overflow-auto">
                    {marinas.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-2 text-center">
                        No marinas found
                      </div>
                    ) : (
                      marinas.map((marina) => (
                        <div 
                          key={marina.id}
                          className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                          onClick={() => handleMarinaToggle(String(marina.id))}
                        >
                          <Checkbox 
                            checked={localFilters.marinas.length === 0 || localFilters.marinas.includes(String(marina.id))}
                            onCheckedChange={() => handleMarinaToggle(String(marina.id))}
                          />
                          <span className="text-sm">{marina.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Time Frame Filter */}
              <Select 
                value={localFilters.timeFrame} 
                onValueChange={handleTimeFrameChange}
              >
                <SelectTrigger className="w-[130px] h-8" data-testid="filter-timeframe">
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>

              {/* Customer Filter */}
              <Select 
                value={localFilters.customerId || 'all'} 
                onValueChange={handleCustomerChange}
              >
                <SelectTrigger className="w-[160px] h-8" data-testid="filter-customer">
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.firstName} {customer.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => setLocalFilters(defaultFilters)}
                  data-testid="clear-filters"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content - scrollable */}
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  );
}

// Export filters type and default for use in child components
export { defaultFilters };

/**
 * Utility hook for Dockit API calls
 * Ensures all Dockit API calls use the correct prefix
 */
export function useDockitApi() {
  const API_PREFIX = "/dockit/api";
  
  const fetchDockitApi = async (endpoint: string, options?: RequestInit) => {
    const url = `${API_PREFIX}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }
    
    return response.json();
  };
  
  return { fetchDockitApi, apiPrefix: API_PREFIX };
}
