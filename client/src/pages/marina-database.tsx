import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search, Plus, Building2, MapPin, Filter, ChevronDown, ChevronUp,
  Anchor, History, DollarSign, CalendarDays, ChevronLeft, ChevronRight,
  MoreHorizontal, Edit, Trash2, TrendingUp, Ship, Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { MarinaRateDatabase, MarinaRate, MarinaWithRates } from "@shared/schema";
import { US_REGIONS, US_STATES } from "@shared/salescomps-constants";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import debounce from "lodash.debounce";
import MarinaRateHistoryPanel from "@/components/marina-database/MarinaRateHistoryPanel";
import AddEditMarinaDialog from "@/components/marina-database/AddEditMarinaDialog";
import AddMarinaRatesDialog from "@/components/marina-database/AddMarinaRatesDialog";

const WATER_TYPES = ["Saltwater", "Freshwater", "Brackish"];

interface MarinaFilters {
  q: string;
  states: string[];
  regions: string[];
  waterTypes: string[];
  isActive?: boolean;
}

export default function MarinaDatabase() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<MarinaFilters>({ q: "", states: [], regions: [], waterTypes: [] });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortBy, setSortBy] = useState("marinaName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMarina, setSelectedMarina] = useState<MarinaRateDatabase | null>(null);
  const [showAddMarinaDialog, setShowAddMarinaDialog] = useState(false);
  const [editMarina, setEditMarina] = useState<MarinaRateDatabase | null>(null);
  const [showAddRatesDialog, setShowAddRatesDialog] = useState(false);
  const [ratesMarinaId, setRatesMarinaId] = useState<string | null>(null);

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      setFilters(prev => ({ ...prev, q: value }));
      setPage(1);
    }, 300),
    []
  );

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSearch(value);
  };

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.states.length) params.set("states", filters.states.join(","));
    if (filters.regions.length) params.set("regions", filters.regions.join(","));
    if (filters.waterTypes.length) params.set("waterTypes", filters.waterTypes.join(","));
    if (filters.isActive !== undefined) params.set("isActive", String(filters.isActive));
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return params.toString();
  }, [filters, sortBy, sortDir, page, pageSize]);

  // Fetch marinas
  const { data, isLoading, error } = useQuery<{ marinas: MarinaRateDatabase[]; total: number }>({
    queryKey: ["/api/marina-database", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/marina-database?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch marinas");
      return res.json();
    }
  });

  // Fetch selected marina with rates
  const { data: marinaWithRates, isLoading: isLoadingRates } = useQuery<MarinaWithRates>({
    queryKey: ["/api/marina-database", selectedMarina?.id, "with-rates"],
    queryFn: async () => {
      const res = await fetch(`/api/marina-database/${selectedMarina!.id}/with-rates`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch marina details");
      return res.json();
    },
    enabled: !!selectedMarina?.id,
  });

  // Delete marina mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/marina-database/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marina-database"] });
      toast({ title: "Marina deleted successfully" });
      if (selectedMarina) setSelectedMarina(null);
    },
    onError: () => {
      toast({ title: "Failed to delete marina", variant: "destructive" });
    },
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;
  const activeFilterCount = filters.states.length + filters.regions.length + filters.waterTypes.length + (filters.isActive !== undefined ? 1 : 0);

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "-";
    return new Intl.NumberFormat("en-US").format(num);
  };

  const openAddRates = (marina: MarinaRateDatabase) => {
    setRatesMarinaId(marina.id);
    setShowAddRatesDialog(true);
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] gap-4 p-2 md:p-4 bg-background">
      {/* Left Panel - Marina List */}
      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Anchor className="h-5 w-5" />
                  Marina Rate Database
                </CardTitle>
                <CardDescription>
                  {data ? `${formatNumber(data.total)} marinas` : "Loading..."}
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowAddMarinaDialog(true)}
                data-testid="button-add-marina"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Marina
              </Button>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-2 mt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search marinas by name, city, or state..."
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-marinas"
                />
              </div>
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Expandable Filters */}
            {showFilters && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">States</label>
                  <MultiSelectDropdown
                    options={US_STATES.map(s => ({ value: s, label: s }))}
                    value={filters.states}
                    onChange={(values) => { setFilters(prev => ({ ...prev, states: values })); setPage(1); }}
                    placeholder="All states"
                    searchPlaceholder="Search states..."
                    maxDisplayItems={2}
                    data-testid="select-states"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Regions</label>
                  <MultiSelectDropdown
                    options={US_REGIONS.map(r => ({ value: r, label: r }))}
                    value={filters.regions}
                    onChange={(values) => { setFilters(prev => ({ ...prev, regions: values })); setPage(1); }}
                    placeholder="All regions"
                    searchPlaceholder="Search regions..."
                    maxDisplayItems={2}
                    data-testid="select-regions"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Water Type</label>
                  <MultiSelectDropdown
                    options={WATER_TYPES.map(w => ({ value: w, label: w }))}
                    value={filters.waterTypes}
                    onChange={(values) => { setFilters(prev => ({ ...prev, waterTypes: values })); setPage(1); }}
                    placeholder="All types"
                    searchPlaceholder="Search..."
                    maxDisplayItems={2}
                    data-testid="select-water-types"
                  />
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("marinaName")}
                    >
                      <div className="flex items-center gap-1">
                        Marina Name
                        {sortBy === "marinaName" && (sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("city")}
                    >
                      <div className="flex items-center gap-1">
                        Location
                        {sortBy === "city" && (sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort("wetSlips")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Wet Slips
                        {sortBy === "wetSlips" && (sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Dry Racks</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("lastRateUpdate")}
                    >
                      <div className="flex items-center gap-1">
                        Last Rate Update
                        {sortBy === "lastRateUpdate" && (sortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))
                  ) : data?.marinas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No marinas found. Add your first marina to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.marinas.map((marina) => (
                      <TableRow
                        key={marina.id}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedMarina?.id === marina.id ? "bg-muted" : ""}`}
                        onClick={() => setSelectedMarina(marina)}
                        data-testid={`row-marina-${marina.id}`}
                      >
                        <TableCell>
                          <div className="font-medium">{marina.marinaName}</div>
                          {marina.waterType && (
                            <Badge variant="outline" className="text-xs mt-1">{marina.waterType}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {marina.city}, {marina.state}
                          </div>
                          {marina.region && (
                            <div className="text-xs text-muted-foreground mt-0.5">{marina.region}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(marina.wetSlips)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatNumber(marina.dryRacks)}
                        </TableCell>
                        <TableCell>
                          {marina.lastRateUpdate ? (
                            <div className="flex items-center gap-1 text-sm">
                              <CalendarDays className="h-3 w-3 text-muted-foreground" />
                              {format(new Date(marina.lastRateUpdate), "MM/dd/yyyy")}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No rates</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" data-testid={`button-marina-actions-${marina.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openAddRates(marina); }}>
                                <DollarSign className="h-4 w-4 mr-2" />
                                Add Rates
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditMarina(marina); }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Marina
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this marina?")) {
                                    deleteMutation.mutate(marina.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </ScrollArea>
          </CardContent>

          {/* Pagination */}
          {data && data.total > pageSize && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, data.total)} of {formatNumber(data.total)}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Right Panel - Marina Details & Rate History */}
      <div className="hidden md:block w-full max-w-[450px] flex-shrink-0">
        {selectedMarina ? (
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{selectedMarina.marinaName}</CardTitle>
                <Button
                  size="sm"
                  onClick={() => openAddRates(selectedMarina)}
                  data-testid="button-add-rates"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rates
                </Button>
              </div>
              <CardDescription className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {selectedMarina.address ? `${selectedMarina.address}, ` : ""}
                {selectedMarina.city}, {selectedMarina.state} {selectedMarina.zip}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden">
              <Tabs defaultValue="rates" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
                  <TabsTrigger value="rates" className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Current Rates
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex items-center gap-1">
                    <History className="h-4 w-4" />
                    History
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="rates" className="flex-1 overflow-hidden mt-4">
                  {isLoadingRates ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <MarinaRateHistoryPanel
                      marinaId={selectedMarina.id}
                      rates={marinaWithRates?.rates || []}
                      showCurrentOnly
                    />
                  )}
                </TabsContent>

                <TabsContent value="history" className="flex-1 overflow-hidden mt-4">
                  {isLoadingRates ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <MarinaRateHistoryPanel
                      marinaId={selectedMarina.id}
                      rates={marinaWithRates?.rates || []}
                      showCurrentOnly={false}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>

            {/* Marina Details Footer */}
            <div className="p-4 border-t bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Wet Slips</div>
                  <div className="font-medium">{formatNumber(selectedMarina.wetSlips) || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Dry Racks</div>
                  <div className="font-medium">{formatNumber(selectedMarina.dryRacks) || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Water Type</div>
                  <div className="font-medium">{selectedMarina.waterType || "-"}</div>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground p-8">
              <Ship className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Select a marina</p>
              <p className="text-sm mt-1">Click on a marina to view its rates and history</p>
            </div>
          </Card>
        )}
      </div>

      {/* Add/Edit Marina Dialog */}
      <AddEditMarinaDialog
        open={showAddMarinaDialog || !!editMarina}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddMarinaDialog(false);
            setEditMarina(null);
          }
        }}
        marina={editMarina}
        onSuccess={(marina) => {
          setShowAddMarinaDialog(false);
          setEditMarina(null);
          if (!editMarina) setSelectedMarina(marina);
        }}
      />

      {/* Add Rates Dialog */}
      <AddMarinaRatesDialog
        open={showAddRatesDialog}
        onOpenChange={setShowAddRatesDialog}
        marinaId={ratesMarinaId}
        onSuccess={() => {
          setShowAddRatesDialog(false);
          setRatesMarinaId(null);
        }}
      />
    </div>
  );
}
