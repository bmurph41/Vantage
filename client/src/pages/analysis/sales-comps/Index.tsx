// TODO: Missing SalesComps-specific components - these need to be copied:
// - @/components/sales-comps/FiltersPanel
// - @/components/sales-comps/CompsDataGrid
// - @/components/sales-comps/MetricsTab
// - @/components/sales-comps/CreateEditCompDialog
// - @/components/sales-comps/ColumnEditorDialog
// - @/components/projects/ProjectAssignmentDialog
// - @/lib/api (salesCompsApi)
// - @/lib/queryKeys
// - @/lib/authUtils
// - @/lib/seo
// - @/lib/types (FilterState)

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { Search, Upload as UploadIcon, Plus, Columns, Download, BarChart3, FolderPlus, Table, TrendingUp, Edit, Save, X, HelpCircle, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function SalesCompsIndex() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<any>({
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

  const filterableColumns = ['marina', 'state', 'saleYear', 'market'];
  
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

  // TODO: Implement API integration when salesCompsApi is available
  const compsLoading = false;
  const data = [];
  const total = 0;

  // TODO: Get user from MarinaMatch auth context (req.user is already available)
  const user = { role: 'Admin' }; // Placeholder
  const canCreate = true;
  const canManageColumns = true;
  const canDelete = true;
  const canAddToProject = true;

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
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

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedIds.length} selected sales comps? This action cannot be undone.`);
    if (confirmed) {
      // TODO: Implement bulk delete when salesCompsApi is available
      toast({
        title: "TODO",
        description: "Bulk delete functionality pending API integration",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    if (!data?.length) return;
    
    const headers = ['Marina', 'State', 'Sale Year', 'Sale Price', 'Cap Rate', 'NOI', 'Wet Slips', 'Dry Racks', 'Occupancy', 'Market'];
    const csvData = data.map((comp: any) => [
      comp.marina,
      comp.state || '',
      comp.saleYear || '',
      comp.salePrice || '',
      comp.capRate || '',
      comp.noi || '',
      comp.wetSlips || '',
      comp.dryRacks || '',
      comp.occupancy || '',
      comp.market || '',
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
    setEditData(data.map(comp => ({ ...comp })));
    setIsEditMode(true);
  };

  const handleExitEditMode = () => {
    setIsEditMode(false);
    setEditData([]);
  };

  const handleSaveChanges = async () => {
    // TODO: Implement save changes when API is available
    toast({
      title: "TODO",
      description: "Save changes functionality pending API integration",
      variant: "destructive",
    });
  };

  const handleCellChange = (compId: string, field: string, value: any) => {
    setEditData(prev => 
      prev.map(comp => 
        comp.id === compId ? { ...comp, [field]: value } : comp
      )
    );
  };

  if (showUpload) {
    // TODO: Import Upload component
    return <div>Upload component pending</div>;
  }

  return (
    <div className="flex flex-1 bg-background h-screen">
      {/* Left Sidebar - Filters */}
      <div className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Sales Comps</h2>
          <p className="text-sm text-muted-foreground">Manage marina sales comparables</p>
        </div>

        {/* TODO: Import FiltersPanel component */}
        <div className="p-4 text-sm text-muted-foreground">Filters panel pending</div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          {/* Top Actions Bar */}
          <div className="bg-card border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
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
          <TabsContent value="data" className="flex-1 min-h-0 overflow-hidden m-0" data-testid="tab-content-data">
            {/* TODO: Import CompsDataGrid component */}
            <div className="p-8 text-center text-muted-foreground">
              CompsDataGrid component pending
            </div>
          </TabsContent>

          <TabsContent value="metrics" className="flex-1 overflow-auto m-0" data-testid="tab-content-metrics">
            {/* TODO: Import MetricsTab component */}
            <div className="p-8 text-center text-muted-foreground">
              MetricsTab component pending
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
