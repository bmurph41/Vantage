import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  X, 
  Search, 
  Plus, 
  Filter,
  RotateCcw,
  Loader2
} from "lucide-react";
import { salesCompsApi } from '@/lib/salescomps/api';
import { queryKeys } from '@/lib/salescomps/queryKeys';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/salescomps/format';
import { useBulkAddCompsToProject } from '@/hooks/salescomps/useProjects';
import type { SalesComp } from "@shared/schema";
import type { FilterParams } from '@/lib/salescomps/api';

interface AddCompsToProjectDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  existingCompIds: string[];
}

interface FilterState {
  q: string;
  state: string;
  regions: string[];
  saleYearMin: string;
  saleYearMax: string;
  priceMin: string;
  priceMax: string;
  capRateMin: string;
  capRateMax: string;
  wetSlipsMin: string;
  wetSlipsMax: string;
  dryRacksMin: string;
  dryRacksMax: string;
  ioBoth: string;
  hasArticle: boolean;
  disclosedOnly: boolean;
}

export default function AddCompsToProjectDialog({
  open,
  onClose,
  projectId,
  projectName,
  existingCompIds,
}: AddCompsToProjectDialogProps) {
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [data, setData] = useState<SalesComp[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    q: "",
    state: "",
    regions: [],
    saleYearMin: "",
    saleYearMax: "",
    priceMin: "",
    priceMax: "",
    capRateMin: "",
    capRateMax: "",
    wetSlipsMin: "",
    wetSlipsMax: "",
    dryRacksMin: "",
    dryRacksMax: "",
    ioBoth: "",
    hasArticle: false,
    disclosedOnly: false,
  });

  const bulkAddMutation = useBulkAddCompsToProject();

  const queryParams: FilterParams = {
    q: searchQuery,
    ...Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => 
        value !== "" && value !== false && value !== null && value !== undefined
      )
    ),
    sortBy: "saleYear",
    sortDir: "desc" as const,
    pageSize: 50,
  };

  // Initial data load
  const { data: initialData, isLoading: compsLoading } = useQuery({
    queryKey: queryKeys.comps.list(queryParams),
    queryFn: () => salesCompsApi.getComps({ ...queryParams, page: 1 }),
    retry: false,
    enabled: open,
  });

  // Update data when initial data changes
  useEffect(() => {
    if (initialData) {
      // Filter out comps already in the project
      const availableComps = initialData.comps?.filter(comp => 
        !existingCompIds.includes(comp.id)
      ) || [];
      setData(availableComps);
      setHasMore((initialData.comps?.length || 0) >= (queryParams.pageSize || 50));
    }
  }, [initialData, existingCompIds, queryParams.pageSize]);

  // Load more data function
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const nextPage = Math.floor(data.length / (queryParams.pageSize || 50)) + 1;
      const moreData = await salesCompsApi.getComps({ 
        ...queryParams, 
        page: nextPage 
      });
      
      if (moreData.comps && moreData.comps.length > 0) {
        // Filter out comps already in the project
        const availableComps = moreData.comps.filter(comp => 
          !existingCompIds.includes(comp.id)
        );
        setData(prev => [...prev, ...availableComps]);
        setHasMore(moreData.comps.length >= (queryParams.pageSize || 50));
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more data:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      q: "",
      state: "",
      regions: [],
      saleYearMin: "",
      saleYearMax: "",
      priceMin: "",
      priceMax: "",
      capRateMin: "",
      capRateMax: "",
      wetSlipsMin: "",
      wetSlipsMax: "",
      dryRacksMin: "",
      dryRacksMax: "",
      ioBoth: "",
      hasArticle: false,
      disclosedOnly: false,
    });
    setSearchQuery("");
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCompIds(data.map(comp => comp.id));
    } else {
      setSelectedCompIds([]);
    }
  };

  const handleSelectComp = (compId: string, checked: boolean) => {
    if (checked) {
      setSelectedCompIds([...selectedCompIds, compId]);
    } else {
      setSelectedCompIds(selectedCompIds.filter(id => id !== compId));
    }
  };

  const handleAddToProject = () => {
    if (selectedCompIds.length === 0) return;
    
    bulkAddMutation.mutate(
      { projectId, compIds: selectedCompIds },
      {
        onSuccess: () => {
          setSelectedCompIds([]);
          onClose();
        },
      }
    );
  };

  const handleClose = () => {
    if (!bulkAddMutation.isPending) {
      setSelectedCompIds([]);
      onClose();
    }
  };

  const formatCellValue = (comp: SalesComp, field: string) => {
    const value = comp[field as keyof SalesComp];
    
    switch (field) {
      case 'salePrice':
        if (!comp.isPriceDisclosed) {
          return <span className="text-muted-foreground">Undisclosed</span>;
        }
        return value ? formatCurrency(Number(value)) : '—';
      case 'capRate':
        if (!comp.isNoiDisclosed || !comp.isPriceDisclosed || !comp.noi || !comp.salePrice) {
          return '—';
        }
        const calculatedCapRate = (Number(comp.noi) / Number(comp.salePrice)) * 100;
        return formatPercent(calculatedCapRate);
      case 'occupancy':
        return value ? formatPercent(Number(value)) : '—';
      case 'saleYear':
        return value ? Number(value).toString() : '—';
      case 'wetSlips':
      case 'dryRacks':
        return value ? formatNumber(Number(value)) : '—';
      default:
        return (value != null && typeof value !== 'object') ? String(value) : '—';
    }
  };

  const availableCount = data.length;
  const filteredOutCount = (initialData?.total || 0) - availableCount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-add-comps-to-project">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Add Sales Comps to Project</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Add sales comps to <span className="font-medium">{projectName}</span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={bulkAddMutation.isPending}
              data-testid="button-close-dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search marinas, markets, states..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-comps"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                data-testid="button-reset-filters"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>

            {/* Expandable Filters */}
            {showFilters && (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        placeholder="e.g., FL"
                        value={filters.state}
                        onChange={(e) => setFilters(prev => ({ ...prev, state: e.target.value }))}
                        data-testid="filter-state"
                      />
                    </div>
                    {/* Region filter removed - use main filters panel for region filtering */}
                    <div className="space-y-2">
                      <Label htmlFor="saleYearMin">Sale Year (Min)</Label>
                      <Input
                        id="saleYearMin"
                        type="number"
                        placeholder="2020"
                        value={filters.saleYearMin}
                        onChange={(e) => setFilters(prev => ({ ...prev, saleYearMin: e.target.value }))}
                        data-testid="filter-sale-year-min"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="saleYearMax">Sale Year (Max)</Label>
                      <Input
                        id="saleYearMax"
                        type="number"
                        placeholder="2024"
                        value={filters.saleYearMax}
                        onChange={(e) => setFilters(prev => ({ ...prev, saleYearMax: e.target.value }))}
                        data-testid="filter-sale-year-max"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceMin">Price (Min)</Label>
                      <Input
                        id="priceMin"
                        type="number"
                        placeholder="1000000"
                        value={filters.priceMin}
                        onChange={(e) => setFilters(prev => ({ ...prev, priceMin: e.target.value }))}
                        data-testid="filter-price-min"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceMax">Price (Max)</Label>
                      <Input
                        id="priceMax"
                        type="number"
                        placeholder="10000000"
                        value={filters.priceMax}
                        onChange={(e) => setFilters(prev => ({ ...prev, priceMax: e.target.value }))}
                        data-testid="filter-price-max"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ioBoth">Inside/Outside</Label>
                      <Select value={filters.ioBoth} onValueChange={(value) => setFilters(prev => ({ ...prev, ioBoth: value }))}>
                        <SelectTrigger data-testid="filter-io-both">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="Inside">Inside</SelectItem>
                          <SelectItem value="Outside">Outside</SelectItem>
                          <SelectItem value="Both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="disclosedOnly"
                          checked={filters.disclosedOnly}
                          onCheckedChange={(checked) => setFilters(prev => ({ ...prev, disclosedOnly: checked as boolean }))}
                          data-testid="filter-disclosed-only"
                        />
                        <Label htmlFor="disclosedOnly">Disclosed only</Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status Summary */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span data-testid="available-count">
                  {availableCount} available comps
                </span>
                {filteredOutCount > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400" data-testid="filtered-out-count">
                    ({filteredOutCount} already in project)
                  </span>
                )}
              </div>
              {selectedCompIds.length > 0 && (
                <Badge variant="secondary" data-testid="selected-count">
                  {selectedCompIds.length} selected
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Data Table */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {compsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading available comps...</p>
                  </div>
                </div>
              ) : data.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <p className="text-lg mb-2">No available comps found</p>
                    <p className="text-sm text-muted-foreground">
                      All matching comps may already be in this project, or try adjusting your filters.
                    </p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background border-b">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedCompIds.length === data.length && data.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead className="min-w-80">Marina</TableHead>
                      <TableHead className="w-20">State</TableHead>
                      <TableHead className="w-24">Sale Year</TableHead>
                      <TableHead className="w-28">Sale Price</TableHead>
                      <TableHead className="w-24">Cap Rate</TableHead>
                      <TableHead className="w-20">Wet Slips</TableHead>
                      <TableHead className="w-20">Dry Racks</TableHead>
                      <TableHead className="w-32">Market</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((comp) => (
                      <TableRow 
                        key={comp.id}
                        className={`hover:bg-muted/50 ${
                          selectedCompIds.includes(comp.id) ? 'bg-primary/5' : ''
                        }`}
                        data-testid={`row-comp-${comp.id}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedCompIds.includes(comp.id)}
                            onCheckedChange={(checked) => handleSelectComp(comp.id, checked as boolean)}
                            data-testid={`checkbox-comp-${comp.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="max-w-80 truncate" title={comp.marina}>
                            {comp.marina}
                          </div>
                        </TableCell>
                        <TableCell>{formatCellValue(comp, 'state')}</TableCell>
                        <TableCell>{formatCellValue(comp, 'saleYear')}</TableCell>
                        <TableCell>{formatCellValue(comp, 'salePrice')}</TableCell>
                        <TableCell>{formatCellValue(comp, 'capRate')}</TableCell>
                        <TableCell>{formatCellValue(comp, 'wetSlips')}</TableCell>
                        <TableCell>{formatCellValue(comp, 'dryRacks')}</TableCell>
                        <TableCell>
                          <div className="max-w-32 truncate" title={comp.market || ''}>
                            {formatCellValue(comp, 'market')}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Load More */}
              {hasMore && !compsLoading && data.length > 0 && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                    data-testid="button-load-more"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Actions */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedCompIds.length > 0 ? (
                  `${selectedCompIds.length} comp${selectedCompIds.length !== 1 ? 's' : ''} selected`
                ) : (
                  'Select comps to add to project'
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleClose} disabled={bulkAddMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddToProject}
                  disabled={selectedCompIds.length === 0 || bulkAddMutation.isPending}
                  data-testid="button-add-to-project"
                >
                  {bulkAddMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add {selectedCompIds.length} Comp{selectedCompIds.length !== 1 ? 's' : ''} to Project
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}