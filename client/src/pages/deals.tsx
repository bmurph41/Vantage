import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import TopBar from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Handshake, Plus, Edit, Trash2, Calendar, User, Search, 
  Filter, MoreHorizontal, List, Grid3x3, HelpCircle, Sliders,
  DollarSign, TrendingUp, Target, Award, Bookmark, Save, X, Download
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import DealFormModal from "@/components/modals/deal-form-modal";
import { DealDrawer } from "@/components/deal-drawer";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Deal, Contact, Company, PipelineStage } from "@shared/schema";

type DealWithRelations = Deal & { contact?: Contact | null; company?: Company | null };

export default function Deals() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [isSaveViewOpen, setIsSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  
  // Filter state
  const [filters, setFilters] = useState({
    stageId: "",
    minValue: "",
    maxValue: "",
    priority: "",
    dateFrom: "",
    dateTo: "",
  });

  // Saved views state
  type SavedView = {
    id: string;
    name: string;
    filters: typeof filters;
    searchQuery: string;
  };
  
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  // Load saved views from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('dealsSavedViews');
    if (stored) {
      try {
        setSavedViews(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse saved views');
      }
    }
  }, []);

  // Save views to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dealsSavedViews', JSON.stringify(savedViews));
  }, [savedViews]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deals, isLoading } = useQuery<DealWithRelations[]>({
    queryKey: ['/api/deals'],
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ['/api/stages'],
  });

  // Filter and search deals
  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    
    return deals.filter((deal) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = deal.title?.toLowerCase().includes(query);
        const matchesCompany = deal.company?.name?.toLowerCase().includes(query);
        const matchesContact = 
          deal.contact?.firstName?.toLowerCase().includes(query) ||
          deal.contact?.lastName?.toLowerCase().includes(query);
        
        if (!matchesTitle && !matchesCompany && !matchesContact) {
          return false;
        }
      }

      // Stage filter
      if (filters.stageId && deal.stageId !== filters.stageId) {
        return false;
      }

      // Value range filter
      const dealAmount = Number(deal.amount) || 0;
      if (filters.minValue && dealAmount < Number(filters.minValue)) {
        return false;
      }
      if (filters.maxValue && dealAmount > Number(filters.maxValue)) {
        return false;
      }

      // Priority filter
      if (filters.priority && deal.priority !== filters.priority) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom && deal.expectedCloseDate) {
        const dealDate = new Date(deal.expectedCloseDate);
        const fromDate = new Date(filters.dateFrom);
        if (dealDate < fromDate) {
          return false;
        }
      }
      if (filters.dateTo && deal.expectedCloseDate) {
        const dealDate = new Date(deal.expectedCloseDate);
        const toDate = new Date(filters.dateTo);
        if (dealDate > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [deals, searchQuery, filters]);

  // Calculate analytics based on filtered deals
  const analytics = useMemo(() => {
    if (!filteredDeals || filteredDeals.length === 0) {
      return {
        totalValue: 0,
        dealCount: 0,
        averageDealSize: 0,
        winRate: 0,
      };
    }

    const totalValue = filteredDeals.reduce((sum, deal) => sum + (Number(deal.amount) || 0), 0);
    const dealCount = filteredDeals.length;
    const averageDealSize = totalValue / dealCount;

    // Calculate win rate based on closed deals
    const closedWonStage = stages?.find(s => 
      s.name.toLowerCase().includes('closed') && s.name.toLowerCase().includes('won')
    );
    const closedLostStage = stages?.find(s => 
      s.name.toLowerCase().includes('closed') && s.name.toLowerCase().includes('lost')
    );

    const wonDeals = closedWonStage 
      ? filteredDeals.filter(d => d.stageId === closedWonStage.id).length 
      : 0;
    const lostDeals = closedLostStage 
      ? filteredDeals.filter(d => d.stageId === closedLostStage.id).length 
      : 0;
    const totalClosedDeals = wonDeals + lostDeals;
    const winRate = totalClosedDeals > 0 ? (wonDeals / totalClosedDeals) * 100 : 0;

    return { totalValue, dealCount, averageDealSize, winRate };
  }, [filteredDeals, stages]);

  const resetFilters = () => {
    setFilters({
      stageId: "",
      minValue: "",
      maxValue: "",
      priority: "",
      dateFrom: "",
      dateTo: "",
    });
    setSearchQuery("");
  };

  // Bulk selection helpers
  const toggleSelectAll = () => {
    if (selectedDealIds.size === filteredDeals.length) {
      setSelectedDealIds(new Set());
    } else {
      setSelectedDealIds(new Set(filteredDeals.map(d => d.id)));
    }
  };

  const toggleSelectDeal = (dealId: string) => {
    const newSelection = new Set(selectedDealIds);
    if (newSelection.has(dealId)) {
      newSelection.delete(dealId);
    } else {
      newSelection.add(dealId);
    }
    setSelectedDealIds(newSelection);
  };

  const clearSelection = () => {
    setSelectedDealIds(new Set());
  };

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/deals/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({ title: `Successfully deleted ${selectedDealIds.size} deal(s)` });
      clearSelection();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete deals", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleBulkDelete = () => {
    if (selectedDealIds.size === 0) return;
    
    if (confirm(`Are you sure you want to delete ${selectedDealIds.size} deal(s)? This action cannot be undone.`)) {
      bulkDeleteMutation.mutate(Array.from(selectedDealIds));
    }
  };

  // Saved views functions
  const saveCurrentView = () => {
    if (!viewName.trim()) {
      toast({ 
        title: "Please enter a view name", 
        variant: "destructive" 
      });
      return;
    }

    const newView: SavedView = {
      id: Date.now().toString(),
      name: viewName.trim(),
      filters: { ...filters },
      searchQuery,
    };

    setSavedViews([...savedViews, newView]);
    setViewName("");
    setIsSaveViewOpen(false);
    toast({ title: `View "${newView.name}" saved successfully` });
  };

  const loadView = (view: SavedView) => {
    setFilters(view.filters);
    setSearchQuery(view.searchQuery);
    toast({ title: `Loaded view "${view.name}"` });
  };

  const deleteView = (viewId: string) => {
    const view = savedViews.find(v => v.id === viewId);
    if (view && confirm(`Delete view "${view.name}"?`)) {
      setSavedViews(savedViews.filter(v => v.id !== viewId));
      toast({ title: `View "${view.name}" deleted` });
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredDeals.length === 0) {
      toast({ 
        title: "No deals to export", 
        variant: "destructive" 
      });
      return;
    }

    // CSV headers
    const headers = [
      'Title',
      'Company',
      'Contact',
      'Value',
      'Stage',
      'Priority',
      'Expected Close Date',
      'Marina Name',
      'Property Type',
      'Slip Number',
      'Dock Location',
      'Lease Term (months)',
    ];

    // CSV rows
    const rows = filteredDeals.map(deal => {
      const stage = stages?.find(s => s.id === deal.stageId);
      const contactName = deal.contact 
        ? `${deal.contact.firstName || ''} ${deal.contact.lastName || ''}`.trim()
        : '';
      
      return [
        deal.title || '',
        deal.company?.name || '',
        contactName,
        Number(deal.amount) || 0,
        stage?.name.replace(/_/g, ' ') || '',
        deal.priority || '',
        deal.expectedCloseDate 
          ? new Date(deal.expectedCloseDate).toLocaleDateString('en-US')
          : '',
        deal.marinaName || '',
        deal.propertyType?.replace(/_/g, ' ') || '',
        deal.slipNumber || '',
        deal.dockLocation || '',
        deal.leaseTermMonths || '',
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => 
          // Escape quotes and wrap in quotes if contains comma
          typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        ).join(',')
      )
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `deals-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the object URL to prevent memory leaks
    URL.revokeObjectURL(url);

    toast({ title: `Exported ${filteredDeals.length} deal(s) to CSV` });
  };

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/deals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({ title: "Deal deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete deal", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingDeal(null);
    setIsFormOpen(true);
  };

  const handleDelete = (deal: Deal) => {
    if (confirm(`Are you sure you want to delete "${deal.title}"? This action cannot be undone.`)) {
      deleteDealMutation.mutate(deal.id);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getContactInitials = (contact?: Contact | null) => {
    if (!contact) return 'D';
    return `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading deals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Clean Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900" data-testid="deals-title">Deals</h1>
            <div className="flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Search deals, companies, contacts..." 
                className="pl-10 w-64 h-9 text-sm border-gray-300 focus:border-gray-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-deals"
              />
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center border border-gray-300 rounded-md">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-8 px-3 text-xs rounded-r-none border-r border-gray-300 ${viewMode === "list" ? "bg-gray-100" : ""}`}
                onClick={() => setViewMode("list")}
                data-testid="list-view-button"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-8 px-3 text-xs rounded-l-none ${viewMode === "grid" ? "bg-gray-100" : ""}`}
                onClick={() => setViewMode("grid")}
                data-testid="grid-view-button"
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Filter Button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs" 
              onClick={() => setShowFilters(!showFilters)}
              data-testid="filter-button"
            >
              <Sliders className="h-4 w-4 mr-1" />
              Filter
              {(filters.stageId || filters.priority || filters.minValue || filters.maxValue || filters.dateFrom || filters.dateTo) && (
                <Badge className="ml-2 bg-blue-600 text-white text-xs px-1.5 py-0.5" data-testid="active-filters-badge">
                  Active
                </Badge>
              )}
            </Button>

            {/* Saved Views Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs" data-testid="saved-views-button">
                  <Bookmark className="h-4 w-4 mr-1" />
                  Views
                  {savedViews.length > 0 && (
                    <Badge className="ml-2 bg-gray-200 text-gray-700 text-xs px-1.5 py-0.5">
                      {savedViews.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem 
                  onClick={() => setIsSaveViewOpen(true)}
                  className="cursor-pointer"
                  data-testid="save-current-view"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Current View
                </DropdownMenuItem>
                {savedViews.length > 0 && (
                  <>
                    <div className="border-t border-gray-200 my-1"></div>
                    {savedViews.map((view) => (
                      <div key={view.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-100 rounded-sm">
                        <button
                          onClick={() => loadView(view)}
                          className="flex-1 text-left text-sm cursor-pointer"
                          data-testid={`load-view-${view.id}`}
                        >
                          {view.name}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteView(view.id);
                          }}
                          className="p-1 hover:bg-gray-200 rounded"
                          data-testid={`delete-view-${view.id}`}
                        >
                          <X className="h-3 w-3 text-gray-500" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export Button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs" 
              onClick={exportToCSV}
              disabled={!filteredDeals || filteredDeals.length === 0}
              data-testid="export-csv-button"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            
            {/* Add Deal Button */}
            <Button 
              className="bg-blue-600 hover:bg-blue-700 h-8 text-xs" 
              size="sm" 
              onClick={handleAdd}
              data-testid="add-deal-button"
            >
              <Plus className="h-4 w-4 mr-1" />
              Deal
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedDealIds.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3" data-testid="bulk-actions-toolbar">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-900" data-testid="selected-count">
                {selectedDealIds.size} deal{selectedDealIds.size !== 1 ? 's' : ''} selected
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearSelection}
                className="h-8 text-xs bg-white"
                data-testid="button-clear-selection"
              >
                Clear Selection
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="h-8 text-xs"
                data-testid="button-bulk-delete"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete {selectedDealIds.size} Deal{selectedDealIds.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4" data-testid="filter-panel">
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Stage Filter */}
                <div className="space-y-2">
                  <Label htmlFor="stage-filter" className="text-xs font-medium text-gray-700">
                    Stage
                  </Label>
                  <Select
                    value={filters.stageId}
                    onValueChange={(value) => setFilters({ ...filters, stageId: value })}
                  >
                    <SelectTrigger id="stage-filter" className="h-9 text-sm" data-testid="filter-stage">
                      <SelectValue placeholder="All stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All stages</SelectItem>
                      {stages?.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority Filter */}
                <div className="space-y-2">
                  <Label htmlFor="priority-filter" className="text-xs font-medium text-gray-700">
                    Priority
                  </Label>
                  <Select
                    value={filters.priority}
                    onValueChange={(value) => setFilters({ ...filters, priority: value })}
                  >
                    <SelectTrigger id="priority-filter" className="h-9 text-sm" data-testid="filter-priority">
                      <SelectValue placeholder="All priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Min Value */}
                <div className="space-y-2">
                  <Label htmlFor="min-value" className="text-xs font-medium text-gray-700">
                    Min Value
                  </Label>
                  <Input
                    id="min-value"
                    type="number"
                    placeholder="$0"
                    className="h-9 text-sm"
                    value={filters.minValue}
                    onChange={(e) => setFilters({ ...filters, minValue: e.target.value })}
                    data-testid="filter-min-value"
                  />
                </div>

                {/* Max Value */}
                <div className="space-y-2">
                  <Label htmlFor="max-value" className="text-xs font-medium text-gray-700">
                    Max Value
                  </Label>
                  <Input
                    id="max-value"
                    type="number"
                    placeholder="Any amount"
                    className="h-9 text-sm"
                    value={filters.maxValue}
                    onChange={(e) => setFilters({ ...filters, maxValue: e.target.value })}
                    data-testid="filter-max-value"
                  />
                </div>

                {/* Date From */}
                <div className="space-y-2">
                  <Label htmlFor="date-from" className="text-xs font-medium text-gray-700">
                    Close Date From
                  </Label>
                  <Input
                    id="date-from"
                    type="date"
                    className="h-9 text-sm"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    data-testid="filter-date-from"
                  />
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <Label htmlFor="date-to" className="text-xs font-medium text-gray-700">
                    Close Date To
                  </Label>
                  <Input
                    id="date-to"
                    type="date"
                    className="h-9 text-sm"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    data-testid="filter-date-to"
                  />
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 text-xs"
                  data-testid="button-reset-filters"
                >
                  Reset Filters
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowFilters(false)}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                  data-testid="button-apply-filters"
                >
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Summary Cards */}
      {deals && deals.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Pipeline Value */}
            <Card className="border border-gray-200 shadow-sm" data-testid="analytics-card-total-value">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Total Pipeline Value</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="total-pipeline-value">
                      {formatCurrency(analytics.totalValue)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deal Count */}
            <Card className="border border-gray-200 shadow-sm" data-testid="analytics-card-deal-count">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Total Deals</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="total-deal-count">
                      {analytics.dealCount}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Average Deal Size */}
            <Card className="border border-gray-200 shadow-sm" data-testid="analytics-card-avg-deal">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Average Deal Size</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="avg-deal-size">
                      {formatCurrency(analytics.averageDealSize)}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Win Rate */}
            <Card className="border border-gray-200 shadow-sm" data-testid="analytics-card-win-rate">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Win Rate</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="win-rate-percentage">
                      {analytics.winRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Award className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
        
      <main className="flex-1 overflow-y-auto p-6" data-testid="deals-main">
        {!deals || deals.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Handshake className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No deals yet</h3>
            <p className="text-gray-500 mb-6">Get started by adding your first deal</p>
            <Button onClick={handleAdd} data-testid="button-add-first-deal" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Deal
            </Button>
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Filter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No deals match your filters</h3>
            <p className="text-gray-500 mb-6">Try adjusting your search or filter criteria</p>
            <Button onClick={resetFilters} variant="outline" data-testid="button-clear-filters">
              Clear Filters
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDeals.map((deal: DealWithRelations) => (
              <Card 
                key={deal.id} 
                className={`bg-white border shadow-sm hover:shadow-md transition-all cursor-pointer ${
                  selectedDealIds.has(deal.id) ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
                }`}
                data-testid={`card-deal-${deal.id}`}
                onClick={() => setSelectedDeal(deal)}
              >
                <CardContent className="p-4">
                  {/* Deal Title, Checkbox & Menu */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-2 flex-1">
                      <Checkbox
                        checked={selectedDealIds.has(deal.id)}
                        onCheckedChange={() => toggleSelectDeal(deal.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                        data-testid={`checkbox-deal-${deal.id}`}
                      />
                      <h4 className="font-medium text-sm text-gray-900 leading-tight line-clamp-2 pr-2" data-testid={`text-deal-title-${deal.id}`}>
                        {deal.title}
                      </h4>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6 hover:bg-gray-100" 
                          data-testid={`deal-menu-${deal.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(deal);
                          }}
                          className="cursor-pointer text-xs"
                          data-testid={`deal-edit-${deal.id}`}
                        >
                          <Edit className="h-3 w-3 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(deal);
                          }}
                          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 text-xs"
                          data-testid={`deal-delete-${deal.id}`}
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Company/Organization Name */}
                  {deal.company && (
                    <div className="mb-2" data-testid={`text-deal-company-${deal.id}`}>
                      <span className="text-xs text-gray-600">
                        {deal.company.name}
                      </span>
                    </div>
                  )}

                  {/* Deal Value */}
                  <div className="mb-3" data-testid={`text-deal-value-${deal.id}`}>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(Number(deal.amount) || 0)}
                    </span>
                  </div>

                  {/* Contact Person with Avatar */}
                  {deal.contact && (
                    <div className="flex items-center space-x-2" data-testid={`text-deal-contact-${deal.id}`}>
                      <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {getContactInitials(deal.contact)}
                      </div>
                      <span className="text-xs text-gray-600 truncate">    
                        {deal.contact.firstName} {deal.contact.lastName}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="deals-table">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left w-12">
                      <Checkbox
                        checked={selectedDealIds.size === filteredDeals.length && filteredDeals.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Deal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Stage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Close Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDeals.map((deal: DealWithRelations) => {
                    const stage = stages?.find(s => s.id === deal.stageId);
                    return (
                      <tr 
                        key={deal.id} 
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          selectedDealIds.has(deal.id) ? "bg-blue-50" : ""
                        }`}
                        onClick={() => setSelectedDeal(deal)}
                        data-testid={`table-row-deal-${deal.id}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedDealIds.has(deal.id)}
                            onCheckedChange={() => toggleSelectDeal(deal.id)}
                            data-testid={`table-checkbox-deal-${deal.id}`}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="text-sm font-medium text-gray-900" data-testid={`table-deal-title-${deal.id}`}>
                              {deal.title}
                            </div>
                            {deal.contact && (
                              <div className="text-xs text-gray-500">
                                {deal.contact.firstName} {deal.contact.lastName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900" data-testid={`table-deal-company-${deal.id}`}>
                            {deal.company?.name || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900" data-testid={`table-deal-value-${deal.id}`}>
                            {formatCurrency(Number(deal.amount) || 0)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="outline" className="text-xs" data-testid={`table-deal-stage-${deal.id}`}>
                            {stage?.name.replace(/_/g, ' ') || '-'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {deal.priority ? (
                            <Badge 
                              variant={
                                deal.priority === "critical" || deal.priority === "high" 
                                  ? "destructive" 
                                  : deal.priority === "medium" 
                                  ? "default" 
                                  : "secondary"
                              }
                              className="text-xs capitalize"
                              data-testid={`table-deal-priority-${deal.id}`}
                            >
                              {deal.priority}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600" data-testid={`table-deal-close-date-${deal.id}`}>
                            {deal.expectedCloseDate 
                              ? new Date(deal.expectedCloseDate).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })
                              : '-'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`table-deal-menu-${deal.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(deal);
                                }}
                                className="cursor-pointer"
                                data-testid={`table-deal-edit-${deal.id}`}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(deal);
                                }}
                                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                                data-testid={`table-deal-delete-${deal.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DealFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingDeal(null);
          }}
          deal={editingDeal}
        />

        <DealDrawer
          deal={selectedDeal}
          isOpen={!!selectedDeal}
          onClose={() => setSelectedDeal(null)}
        />

        {/* Save View Dialog */}
        <Dialog open={isSaveViewOpen} onOpenChange={setIsSaveViewOpen}>
          <DialogContent data-testid="save-view-dialog">
            <DialogHeader>
              <DialogTitle>Save Current View</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="view-name" className="text-sm font-medium">
                View Name
              </Label>
              <Input
                id="view-name"
                placeholder="e.g., High Priority Deals, Q1 Prospects"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveCurrentView();
                  }
                }}
                className="mt-2"
                data-testid="input-view-name"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsSaveViewOpen(false);
                  setViewName("");
                }}
                data-testid="button-cancel-save-view"
              >
                Cancel
              </Button>
              <Button 
                onClick={saveCurrentView}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-confirm-save-view"
              >
                <Save className="h-4 w-4 mr-2" />
                Save View
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
