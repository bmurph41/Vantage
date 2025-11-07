import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { Search, Upload as UploadIcon, Plus, Columns, Download, BarChart3, FolderPlus, Table, TrendingUp, Edit, Save, X, HelpCircle, Trash2, PanelLeftClose, PanelLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import debounce from "lodash.debounce";
import { salesCompsApi } from "@/lib/salescomps/api";
import { queryKeys } from "@/lib/salescomps/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/salescomps/authUtils";
import FiltersPanel from "@/components/salescomps/sales-comps/FiltersPanel";
import CompsDataGrid from "@/components/salescomps/sales-comps/CompsDataGrid";
import AnalyticsWorkbench from "@/components/salescomps/analytics/AnalyticsWorkbench";
import CreateEditCompDialog from "@/components/salescomps/sales-comps/CreateEditCompDialog";
import ColumnEditorDialog from "@/components/salescomps/sales-comps/ColumnEditorDialog";
import BulkEdit from "./BulkEdit";
import Upload from "./Upload";
import ProjectAssignmentDialog from "@/components/salescomps/projects/ProjectAssignmentDialog";
import type { FilterState } from "@/lib/salescomps/types";
import type { SalesComp } from "@shared/schema";

export default function SalesCompsIndex() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // TODO: Replace with actual MarinaMatch auth when available
  const user = { role: 'Admin' };
  const isAuthenticated = true;
  const isLoading = false;
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    q: "",
    state: "",
    region: "",
    saleYearMin: "",
    saleYearMax: "",
    priceMin: "",
    priceMax: "",
    capRateMin: "",
    capRateMax: "",
    occupancyMin: "",
    occupancyMax: "",
    wetSlipsMin: "",
    wetSlipsMax: "",
    dryRacksMin: "",
    dryRacksMax: "",
    ioBoth: "",
    hasArticle: false,
    disclosedOnly: false,
    disclosedCapRateOnly: false,
    columnFilters: {},
  });
  const [sortBy, setSortBy] = useState("saleYear");
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>("desc");
  const [columnUniqueValues, setColumnUniqueValues] = useState<Record<string, string[]>>({});
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string | null>(null);
  const [activeSavedSearchName, setActiveSavedSearchName] = useState<string | null>(null);

  // Fetch unique values for filterable columns
  const filterableColumns = ['marina', 'state', 'saleYear', 'market'];
  
  // React Query for column unique values
  const columnQueries = useQueries({
    queries: filterableColumns.map(column => ({
      queryKey: ['column-values', column],
      queryFn: () => salesCompsApi.getColumnUniqueValues(column),
      staleTime: 10 * 60 * 1000, // 10 minutes - these values don't change often
      gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
    }))
  });

  // Update column unique values when queries complete
  useEffect(() => {
    const newValues: Record<string, string[]> = {};
    filterableColumns.forEach((column, index) => {
      const query = columnQueries[index];
      if (query.data?.values) {
        newValues[column] = query.data.values;
      }
    });
    setColumnUniqueValues(newValues);
  }, [columnQueries]);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("data");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isPortfolioMode, setIsPortfolioMode] = useState(false);
  const [showColumnsDialog, setShowColumnsDialog] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showProjectAssignment, setShowProjectAssignment] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState<any[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Debounce search query updates
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => {
      setDebouncedSearchQuery(value);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSetSearch(searchQuery);
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [searchQuery, debouncedSetSearch]);

  const queryParams = useMemo(() => ({
    q: debouncedSearchQuery,
    ...Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => 
        value !== "" && value !== false && value !== null && value !== undefined
      )
    ),
    sortBy,
    sortDir,
    page,
    pageSize,
  }), [debouncedSearchQuery, filters, sortBy, sortDir, page, pageSize]);

  // Load paginated data
  const { data: compsData, isLoading: compsLoading, error } = useQuery({
    queryKey: queryKeys.comps.list(queryParams),
    queryFn: () => salesCompsApi.getComps(queryParams),
    retry: false,
    keepPreviousData: true, // Keep showing old data while new data loads
  });

  const data = compsData?.comps || [];
  const total = compsData?.total || 0;

  // Handle API errors
  if (error && isUnauthorizedError(error as Error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Please log in again.",
      variant: "destructive",
    });
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const canCreate = user && ['Owner', 'Broker', 'Analyst', 'Admin'].includes((user as any).role);
  const canManageColumns = user && ['Owner', 'Admin'].includes((user as any).role);
  const canDelete = user && ['Owner', 'Admin', 'Analyst'].includes((user as any).role);
  const canAddToProject = user && ['Owner', 'Broker', 'Analyst', 'Admin'].includes((user as any).role);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1); // Reset to first page on search
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page on filter change
    // Clear active saved search when filters are manually changed
    if (activeSavedSearchId) {
      setActiveSavedSearchId(null);
      setActiveSavedSearchName(null);
    }
  };

  const handleActiveSavedSearchChange = (id: string | null, name: string | null) => {
    setActiveSavedSearchId(id);
    setActiveSavedSearchName(name);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => salesCompsApi.bulkDelete(ids),
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: `Deleted ${result.deleted} comps successfully`,
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: queryKeys.comps.all });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Please log in again.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    },
  });

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedIds.length} selected sales comps? This action cannot be undone.`);
    if (confirmed) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const handleExport = () => {
    if (!data?.length) return;
    
    // Convert data to CSV format
    const headers = ['Marina', 'State', 'Sale Year', 'Sale Price', 'Cap Rate', 'NOI', 'Wet Slips', 'Dry Racks', 'Occupancy', 'Market'];
    const csvData = data.map(comp => [
      comp.marina,
      comp.state || '',
      comp.saleYear || '',
      comp.salePrice || '',
      comp.capRate || '',
      comp.noi || '',
      comp.wetSlips || '',
      comp.dryRacks || '',
      comp.occupancy || '',
      (comp as any).market || '',
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_comps_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEnterEditMode = () => {
    // Create a deep copy of the current data for editing
    setEditData(data.map(comp => ({ ...comp })));
    setIsEditMode(true);
  };

  const handleExitEditMode = () => {
    setIsEditMode(false);
    setEditData([]);
  };

  const handleSaveChanges = async () => {
    try {
      // Find changed items by comparing with original data
      const changedItems = editData.filter(editedComp => {
        const originalComp = data.find(comp => comp.id === editedComp.id);
        if (!originalComp) return false;
        
        // Check if any field has changed
        return Object.keys(editedComp).some(key => {
          const originalValue = originalComp[key as keyof typeof originalComp];
          const editedValue = editedComp[key as keyof typeof editedComp];
          return originalValue !== editedValue;
        });
      });

      if (changedItems.length === 0) {
        toast({
          title: "No changes",
          description: "No changes were made to save",
        });
        setIsEditMode(false);
        setEditData([]);
        return;
      }

      // Save each changed item
      const savePromises = changedItems.map(async (changedComp) => {
        const originalComp = data.find(comp => comp.id === changedComp.id);
        if (!originalComp) return;

        // Build update object with only changed fields
        const updateData: Record<string, any> = {};
        Object.keys(changedComp).forEach(key => {
          const originalValue = originalComp[key as keyof typeof originalComp];
          const editedValue = changedComp[key as keyof typeof changedComp];
          if (originalValue !== editedValue) {
            updateData[key] = editedValue;
          }
        });

        // Make API call to update the comp
        return salesCompsApi.updateComp(changedComp.id, updateData);
      });

      await Promise.all(savePromises);

      // Invalidate and refetch data
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.comps.all,
      });
      
      toast({
        title: "Success",
        description: `${changedItems.length} item(s) saved successfully`,
      });
      
      setIsEditMode(false);
      setEditData([]);
      
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    }
  };

  const handleCellChange = (compId: string, field: string, value: any) => {
    setEditData(prev => 
      prev.map(comp => 
        comp.id === compId ? { ...comp, [field]: value } : comp
      )
    );
  };

  const handleCompUpdate = (updatedComp: SalesComp) => {
    // Update the editData state with the updated comp data
    setEditData(prev => 
      prev.map(comp => 
        comp.id === updatedComp.id ? { ...updatedComp } : comp
      )
    );
  };

  if (showUpload) {
    return <Upload 
      onClose={() => setShowUpload(false)} 
      onImportComplete={() => {
        // The query cache has already been invalidated by Upload component
        // This will trigger a fresh data fetch
      }}
    />;
  }

  return (
    <div className="flex flex-1 bg-background h-screen">
      {/* Left Sidebar - Filters */}
      {!isSidebarCollapsed && (
        <div className="w-64 bg-card border-r border-border flex flex-col flex-shrink-0">
          <div className="px-4 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Sales Comps</h2>
          </div>

          <FiltersPanel 
            filters={filters}
            onFiltersChange={handleFilterChange}
            activeSavedSearchId={activeSavedSearchId}
            onActiveSavedSearchChange={handleActiveSavedSearchChange}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          {/* Top Actions Bar */}
          <div className="bg-card border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="mr-2"
                  data-testid="button-toggle-sidebar"
                >
                  {isSidebarCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search marina, location, seller..."
                      className="pl-10 w-72"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      disabled={isEditMode}
                      data-testid="input-search"
                    />
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        <strong>Search Tips:</strong><br/>
                        • Type marina name, location, or seller<br/>
                        • Use the sidebar filters for precise filtering<br/>
                        • Click column headers to filter specific values
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span data-testid="text-count">{total}</span> comps found
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {canManageColumns && !isEditMode && (
                  <Button
                    variant="secondary"
                    onClick={() => setShowColumnsDialog(true)}
                    data-testid="button-columns"
                  >
                    <Columns className="h-4 w-4 mr-2" />
                    Columns
                  </Button>
                )}

                {/* Edit/Save buttons */}
                {!isEditMode ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={handleEnterEditMode}
                      disabled={!data?.length}
                      data-testid="button-edit-comps"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Comps
                    </Button>
                    
                    <Button
                      variant="secondary"
                      onClick={handleExport}
                      disabled={!data?.length}
                      data-testid="button-export"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={handleExitEditMode}
                      data-testid="button-cancel-edit"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    
                    <Button
                      onClick={handleSaveChanges}
                      data-testid="button-save-changes"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </>
                )}

                {canCreate && !isEditMode && (
                  <>
                    <Button
                      onClick={() => {
                        setIsPortfolioMode(false);
                        setShowCreateDialog(true);
                      }}
                      data-testid="button-add-comp"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Comp
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsPortfolioMode(true);
                        setShowCreateDialog(true);
                      }}
                      data-testid="button-create-portfolio"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Portfolio
                    </Button>
                    
                    <Button
                      variant="default"
                      onClick={() => setShowUpload(true)}
                      data-testid="button-upload"
                    >
                      <UploadIcon className="h-4 w-4 mr-2" />
                      Upload Comps
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds?.length > 0 && !isEditMode && (
            <div className="bg-card border-b border-border px-6 py-3">
              <div className="p-3 bg-muted rounded-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-foreground font-medium">
                    <span data-testid="text-selected-count">{selectedIds?.length || 0}</span> items selected
                  </span>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={async () => {
                      try {
                        const response = await salesCompsApi.getAllIds();
                        setSelectedIds(response.ids || []);
                        toast({
                          title: "Success",
                          description: `Selected all ${response.ids.length} comps`,
                        });
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to select all comps",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-select-all"
                  >
                    Select all ({total})
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setSelectedIds([])}
                    data-testid="button-clear-selection"
                  >
                    Clear selection
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {canAddToProject && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowProjectAssignment(true)}
                      data-testid="button-add-to-project"
                    >
                      <FolderPlus className="h-4 w-4 mr-1" />
                      Add to Project
                    </Button>
                  )}
                  {selectedIds.length >= 2 && (
                    <Link href={`/analysis/sales-comps/compare?ids=${selectedIds.join(',')}`}>
                      <Button
                        variant="default"
                        size="sm"
                        data-testid="button-compare"
                      >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Compare
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowBulkEdit(true)}
                    data-testid="button-bulk-edit"
                  >
                    Edit
                  </Button>
                  {canDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="px-6 border-b border-border">
            <TabsList className="grid w-full max-w-md grid-cols-2" data-testid="tabs-navigation">
              <TabsTrigger value="data" className="flex items-center gap-2" data-testid="tab-data">
                <Table className="h-4 w-4" />
                All Comps
              </TabsTrigger>
              <TabsTrigger value="metrics" className="flex items-center gap-2" data-testid="tab-metrics">
                <TrendingUp className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <TabsContent value="data" className="flex-1 min-h-0 overflow-hidden m-0 flex flex-col" data-testid="tab-content-data">
            {/* Data Grid */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <CompsDataGrid
                data={isEditMode ? editData : data}
                loading={compsLoading}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                total={total}
                canDelete={canDelete}
                canAddToProject={canAddToProject}
                columnFilters={filters.columnFilters}
                onColumnFilterChange={(column, excludedValues) => {
                  setFilters(prev => ({
                    ...prev,
                    columnFilters: {
                      ...prev.columnFilters,
                      [column]: excludedValues
                    }
                  }));
                }}
                columnUniqueValues={columnUniqueValues}
                isEditMode={isEditMode}
                onCellChange={handleCellChange}
                onCompUpdate={handleCompUpdate}
              />
            </div>
            
            {/* Pagination Controls */}
            {!isEditMode && total > 0 && (
              <div className="border-t border-border bg-background px-6 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} comps
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || compsLoading}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {Math.ceil(total / pageSize)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= Math.ceil(total / pageSize) || compsLoading}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="flex-1 overflow-auto m-0 p-6" data-testid="tab-content-metrics">
            <AnalyticsWorkbench />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CreateEditCompDialog
        open={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false);
          setIsPortfolioMode(false);
        }}
        isPortfolioMode={isPortfolioMode}
      />

      {canManageColumns && (
        <ColumnEditorDialog
          open={showColumnsDialog}
          onClose={() => setShowColumnsDialog(false)}
        />
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <BulkEdit
          selectedIds={selectedIds}
          onClose={() => setShowBulkEdit(false)}
        />
      )}

      {/* Project Assignment Dialog */}
      {showProjectAssignment && (
        <ProjectAssignmentDialog
          open={showProjectAssignment}
          onClose={() => setShowProjectAssignment(false)}
          selectedIds={selectedIds}
          selectedCompsPreview={data.filter(comp => selectedIds.includes(comp.id))}
          onSuccess={() => {
            setSelectedIds([]);
            setShowProjectAssignment(false);
          }}
        />
      )}
    </div>
  );
}
