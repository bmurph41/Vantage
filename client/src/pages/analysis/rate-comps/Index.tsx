import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient, useQueries, keepPreviousData } from "@tanstack/react-query";
import { BarChart3, FolderPlus, Trash2, ChevronLeft, ChevronRight, Filter, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SkeletonTableRows } from "@/components/ui/skeleton-variants";
import { Link } from "wouter";
import debounce from "lodash.debounce";
import { rateCompsApi } from "@/lib/ratecomps/api";
import { queryKeys } from "@/lib/ratecomps/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/ratecomps/authUtils";
import RateCompsHeader from "@/components/ratecomps/rate-comps/RateCompsHeader";
import FiltersPanel from "@/components/ratecomps/rate-comps/FiltersPanel";
import CompsDataGrid from "@/components/ratecomps/rate-comps/CompsDataGrid";
import CreateEditCompDialog from "@/components/ratecomps/rate-comps/CreateEditCompDialog";
import ViewCompModal from "@/components/ratecomps/rate-comps/ViewCompModal";
import ColumnEditorDialog from "@/components/ratecomps/rate-comps/ColumnEditorDialog";
import BulkEdit from "./BulkEdit";
import Upload from "./Upload";
import ProjectAssignmentDialog from "@/components/ratecomps/projects/ProjectAssignmentDialog";
import type { FilterState } from "@/lib/ratecomps/types";
import type { RateComp } from "@shared/schema";

export default function RateCompsIndex() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const user = { role: 'Admin' };
  const isAuthenticated = true;
  const isLoading = false;
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    q: "",
    states: [],
    regions: [],
    storageTypes: [],
    rateTypes: [],
    seasonalities: [],
    boatLengthMin: "",
    boatLengthMax: "",
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
    disclosedOnly: false,
    disclosedCapRateOnly: false,
    portfoliosOnly: false,
    columnFilters: {},
  });
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>("desc");
  const [sourceScope, setSourceScope] = useState<"all" | "org" | "global">("all");
  const [columnUniqueValues, setColumnUniqueValues] = useState<Record<string, string[]>>({});
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string | null>(null);
  const [activeSavedSearchName, setActiveSavedSearchName] = useState<string | null>(null);

  const filterableColumns = ['marina', 'state', 'storageType'];
  
  const columnQueries = useQueries({
    queries: filterableColumns.map(column => ({
      queryKey: ['column-values', column],
      queryFn: () => rateCompsApi.getColumnUniqueValues(column),
      staleTime: 10 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
    }))
  });

  const columnQueryResults = columnQueries.map(q => q.data);
  
  useEffect(() => {
    const newValues: Record<string, string[]> = {};
    filterableColumns.forEach((column, index) => {
      const data = columnQueryResults[index];
      if (data?.values) {
        newValues[column] = data.values;
      }
    });
    if (Object.keys(newValues).length > 0) {
      setColumnUniqueValues(prev => {
        const changed = filterableColumns.some((col, i) => {
          const newVal = columnQueryResults[i]?.values;
          const oldVal = prev[col];
          return JSON.stringify(newVal) !== JSON.stringify(oldVal);
        });
        return changed ? newValues : prev;
      });
    }
  }, [JSON.stringify(columnQueryResults)]);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showColumnsDialog, setShowColumnsDialog] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showProjectAssignment, setShowProjectAssignment] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [viewingComp, setViewingComp] = useState<RateComp | null>(null);
  const [editingComp, setEditingComp] = useState<RateComp | null>(null);

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
    scope: sourceScope === "all" ? undefined : sourceScope,
    includeGlobal: sourceScope === "all" ? "true" : undefined,
  }), [debouncedSearchQuery, filters, sortBy, sortDir, page, pageSize]);

  const { data: compsData, isLoading: compsLoading, error } = useQuery({
    queryKey: queryKeys.comps.list(queryParams),
    queryFn: () => rateCompsApi.getComps(queryParams),
    retry: false,
    placeholderData: keepPreviousData,
  });

  const data = compsData?.comps || [];
  const total = compsData?.total || 0;

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
      <div className="min-h-screen p-6 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        <SkeletonTableRows rows={10} columns={5} />
      </div>
    );
  }

  const canCreate = user && ['Owner', 'Broker', 'Analyst', 'Admin'].includes((user as any).role);
  const canManageColumns = user && ['Owner', 'Admin'].includes((user as any).role);
  const canDelete = user && ['Owner', 'Admin', 'Analyst'].includes((user as any).role);
  const canAddToProject = user && ['Owner', 'Broker', 'Analyst', 'Admin'].includes((user as any).role);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);
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
    mutationFn: (ids: string[]) => rateCompsApi.bulkDelete(ids),
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
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedIds.length} selected rate comps? This action cannot be undone.`);
    if (confirmed) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const handleExport = () => {
    if (!data?.length) return;
    
    const headers = ['Marina', 'State', 'City', 'Storage Type', 'Rate', 'Period', 'Seasonality', 'Electric Included', 'Notes'];
    const csvData = data.map(comp => [
      comp.marina,
      comp.state || '',
      comp.city || '',
      comp.storageType || '',
      comp.rateAmount || '',
      comp.ratePeriod || '',
      comp.seasonality || '',
      comp.electricIncluded ? 'Yes' : 'No',
      comp.notes || '',
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate_comps_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCompClick = (comp: RateComp) => {
    setViewingComp(comp);
  };

  const handleEditFromView = (comp: RateComp) => {
    setViewingComp(null);
    setEditingComp(comp);
    setShowCreateDialog(true);
  };

  const handleCompUpdate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.comps.all });
    setEditingComp(null);
    setShowCreateDialog(false);
  };


  if (showUpload) {
    return <Upload 
      onClose={() => setShowUpload(false)} 
      onImportComplete={() => {
      }}
    />;
  }

  return (
    <div className="flex flex-1 bg-background min-h-screen">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col">
          <RateCompsHeader 
            searchQuery={searchQuery}
            onSearchChange={handleSearch}
            total={total}
            canManageColumns={canManageColumns}
            canCreate={canCreate}
            onColumnsClick={() => setShowColumnsDialog(true)}
            onExportClick={handleExport}
            onAddCompClick={() => setShowCreateDialog(true)}
            onUploadClick={() => setShowUpload(true)}
            hasData={!!data?.length}
          />

          {selectedIds?.length > 0 && (
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
                        const response = await rateCompsApi.getAllIds();
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
                    <Link href={`/analysis/rate-comps/compare?ids=${selectedIds.join(',')}`}>
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

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center justify-start mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="h-8 gap-2"
                  data-testid="button-toggle-filters"
                >
                  {isSidebarCollapsed ? (
                    <>
                      <Filter className="h-4 w-4" />
                      Show Filters
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Hide Filters
                    </>
                  )}
                </Button>
              </div>
              
              {!isSidebarCollapsed && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 border-b mb-3">
                    <span className="text-xs text-muted-foreground">Source:</span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={sourceScope === "all" ? "default" : "ghost"}
                        className="h-7 px-2 text-xs"
                        onClick={() => setSourceScope("all")}
                      >
                        All
                      </Button>
                      <Button
                        size="sm"
                        variant={sourceScope === "org" ? "default" : "ghost"}
                        className="h-7 px-2 text-xs"
                        onClick={() => setSourceScope("org")}
                      >
                        My Data
                      </Button>
                      <Button
                        size="sm"
                        variant={sourceScope === "global" ? "default" : "ghost"}
                        className="h-7 px-2 text-xs"
                        onClick={() => setSourceScope("global")}
                      >
                        <Badge variant="secondary" className="h-4 px-1 mr-1 text-[10px]">MM</Badge>
                        Curated
                      </Button>
                    </div>
                  </div>
                  <FiltersPanel 
                    filters={filters}
                    onFiltersChange={handleFilterChange}
                    activeSavedSearchId={activeSavedSearchId}
                    onActiveSavedSearchChange={handleActiveSavedSearchChange}
                  />
                </>
              )}
            </div>
            
            <div className="flex-1 min-h-0 overflow-hidden">
              <CompsDataGrid
                data={data}
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
                onCompClick={handleCompClick}
              />
            </div>
            
            {total > 0 && (
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
          </div>
        </div>
      </div>

      <ViewCompModal
        open={!!viewingComp}
        onClose={() => setViewingComp(null)}
        comp={viewingComp}
        onEdit={handleEditFromView}
      />

      <CreateEditCompDialog
        open={showCreateDialog || !!editingComp}
        onClose={handleCompUpdate}
        comp={editingComp || undefined}
        onUpdate={handleCompUpdate}
      />

      {canManageColumns && (
        <ColumnEditorDialog
          open={showColumnsDialog}
          onClose={() => setShowColumnsDialog(false)}
        />
      )}

      {showBulkEdit && (
        <BulkEdit
          selectedIds={selectedIds}
          onClose={() => setShowBulkEdit(false)}
        />
      )}

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
