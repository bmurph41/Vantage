import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  DollarSign, 
  Plus, 
  X, 
  Search,
  MapPin,
  Anchor,
  Star,
  Check
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface SalesComp {
  id: string;
  marinaName: string;
  location?: string;
  city?: string;
  state?: string;
  salePrice?: number | string;
  saleDate?: string;
  slipCount?: number;
  pricePerSlip?: number | string;
  capRate?: number | string;
}

interface RateComp {
  id: string;
  marinaName: string;
  location?: string;
  city?: string;
  state?: string;
  averageRate?: number | string;
  slipCount?: number;
  occupancyRate?: number;
  rateType?: string;
}

interface LinkedComp {
  id: string;
  salesCompId?: string;
  rateCompId?: string;
  isPrimary?: boolean;
  relevanceScore?: number;
  notes?: string;
  salesComp?: SalesComp;
  rateComp?: RateComp;
}

interface CompSetSelectorProps {
  dealId: string;
  className?: string;
}

export default function CompSetSelector({ dealId, className }: CompSetSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState<"sales" | "rate">("sales");
  const [selectedComps, setSelectedComps] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: linkedSalesComps, isLoading: loadingSalesLinks } = useQuery<LinkedComp[]>({
    queryKey: ['/api/integrations/deals', dealId, 'sales-comps'],
  });

  const { data: linkedRateComps, isLoading: loadingRateLinks } = useQuery<LinkedComp[]>({
    queryKey: ['/api/integrations/deals', dealId, 'rate-comps'],
  });

  const { data: allSalesComps, isLoading: loadingAllSales } = useQuery<SalesComp[]>({
    queryKey: ['/api/sales-comps'],
    enabled: isDialogOpen && selectedTab === "sales",
  });

  const { data: allRateComps, isLoading: loadingAllRates } = useQuery<RateComp[]>({
    queryKey: ['/api/rate-comps'],
    enabled: isDialogOpen && selectedTab === "rate",
  });

  const linkSalesCompMutation = useMutation({
    mutationFn: async (salesCompId: string) => {
      const res = await fetch(`/api/integrations/deals/${dealId}/sales-comps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesCompId }),
      });
      if (!res.ok) throw new Error("Failed to link sales comp");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/deals', dealId, 'sales-comps'] });
      toast({ title: "Sales comp linked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to link sales comp", variant: "destructive" });
    },
  });

  const unlinkSalesCompMutation = useMutation({
    mutationFn: async (salesCompId: string) => {
      const res = await fetch(`/api/integrations/deals/${dealId}/sales-comps/${salesCompId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to unlink sales comp");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/deals', dealId, 'sales-comps'] });
      toast({ title: "Sales comp unlinked" });
    },
  });

  const linkRateCompMutation = useMutation({
    mutationFn: async (rateCompId: string) => {
      const res = await fetch(`/api/integrations/deals/${dealId}/rate-comps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateCompId }),
      });
      if (!res.ok) throw new Error("Failed to link rate comp");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/deals', dealId, 'rate-comps'] });
      toast({ title: "Rate comp linked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to link rate comp", variant: "destructive" });
    },
  });

  const unlinkRateCompMutation = useMutation({
    mutationFn: async (rateCompId: string) => {
      const res = await fetch(`/api/integrations/deals/${dealId}/rate-comps/${rateCompId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to unlink rate comp");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/deals', dealId, 'rate-comps'] });
      toast({ title: "Rate comp unlinked" });
    },
  });

  const bulkLinkMutation = useMutation({
    mutationFn: async ({ compIds, type }: { compIds: string[], type: "sales" | "rate" }) => {
      const endpoint = type === "sales" 
        ? `/api/integrations/deals/${dealId}/sales-comps/bulk`
        : `/api/integrations/deals/${dealId}/rate-comps/bulk`;
      const bodyKey = type === "sales" ? "salesCompIds" : "rateCompIds";
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [bodyKey]: compIds }),
      });
      if (!res.ok) throw new Error(`Failed to bulk link ${type} comps`);
      return res.json();
    },
    onSuccess: (_, { type }) => {
      const queryKey = type === "sales" 
        ? ['/api/integrations/deals', dealId, 'sales-comps']
        : ['/api/integrations/deals', dealId, 'rate-comps'];
      queryClient.invalidateQueries({ queryKey });
      setSelectedComps(new Set());
      setIsDialogOpen(false);
      toast({ title: `${type === "sales" ? "Sales" : "Rate"} comps linked successfully` });
    },
  });

  const linkedSalesIds = new Set(linkedSalesComps?.map(l => l.salesCompId) || []);
  const linkedRateIds = new Set(linkedRateComps?.map(l => l.rateCompId) || []);

  const filteredSalesComps = allSalesComps?.filter(comp => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      comp.marinaName?.toLowerCase().includes(searchLower) ||
      comp.city?.toLowerCase().includes(searchLower) ||
      comp.state?.toLowerCase().includes(searchLower) ||
      comp.location?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const filteredRateComps = allRateComps?.filter(comp => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      comp.marinaName?.toLowerCase().includes(searchLower) ||
      comp.city?.toLowerCase().includes(searchLower) ||
      comp.state?.toLowerCase().includes(searchLower) ||
      comp.location?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const handleBulkLink = () => {
    if (selectedComps.size === 0) return;
    bulkLinkMutation.mutate({ 
      compIds: Array.from(selectedComps), 
      type: selectedTab 
    });
  };

  const toggleCompSelection = (compId: string) => {
    const newSelection = new Set(selectedComps);
    if (newSelection.has(compId)) {
      newSelection.delete(compId);
    } else {
      newSelection.add(compId);
    }
    setSelectedComps(newSelection);
  };

  const isLoading = loadingSalesLinks || loadingRateLinks;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Comparable Sales & Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const salesCompsCount = linkedSalesComps?.length || 0;
  const rateCompsCount = linkedRateComps?.length || 0;

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Comparable Sales & Rates
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-1" />
              Add Comps
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Select Comparable Properties</DialogTitle>
            </DialogHeader>
            <Tabs value={selectedTab} onValueChange={(v) => {
              setSelectedTab(v as "sales" | "rate");
              setSelectedComps(new Set());
              setSearchTerm("");
            }}>
              <TabsList className="mb-4">
                <TabsTrigger value="sales" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Sales Comps
                </TabsTrigger>
                <TabsTrigger value="rate" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Rate Comps
                </TabsTrigger>
              </TabsList>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by marina name, city, or state..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <TabsContent value="sales" className="mt-0">
                <ScrollArea className="h-[400px] pr-4">
                  {loadingAllSales ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                    </div>
                  ) : filteredSalesComps.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No sales comps found
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredSalesComps.map(comp => {
                        const isLinked = linkedSalesIds.has(comp.id);
                        const isSelected = selectedComps.has(comp.id);
                        return (
                          <div 
                            key={comp.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              isLinked 
                                ? 'bg-green-50 border-green-200' 
                                : isSelected 
                                  ? 'bg-blue-50 border-blue-300' 
                                  : 'hover:bg-gray-50'
                            }`}
                            onClick={() => !isLinked && toggleCompSelection(comp.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                {!isLinked && (
                                  <Checkbox 
                                    checked={isSelected} 
                                    className="mt-1"
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleCompSelection(comp.id)}
                                  />
                                )}
                                {isLinked && (
                                  <Check className="w-5 h-5 text-green-600 mt-0.5" />
                                )}
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    <Anchor className="w-4 h-4 text-blue-500" />
                                    {comp.marinaName}
                                  </div>
                                  <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                    <MapPin className="w-3 h-3" />
                                    {comp.city}, {comp.state}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-green-600">
                                  {comp.salePrice ? formatCurrency(Number(comp.salePrice)) : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {comp.slipCount} slips • {comp.saleDate ? new Date(comp.saleDate).toLocaleDateString() : 'N/A'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="rate" className="mt-0">
                <ScrollArea className="h-[400px] pr-4">
                  {loadingAllRates ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                    </div>
                  ) : filteredRateComps.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No rate comps found
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredRateComps.map(comp => {
                        const isLinked = linkedRateIds.has(comp.id);
                        const isSelected = selectedComps.has(comp.id);
                        return (
                          <div 
                            key={comp.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              isLinked 
                                ? 'bg-green-50 border-green-200' 
                                : isSelected 
                                  ? 'bg-blue-50 border-blue-300' 
                                  : 'hover:bg-gray-50'
                            }`}
                            onClick={() => !isLinked && toggleCompSelection(comp.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                {!isLinked && (
                                  <Checkbox 
                                    checked={isSelected} 
                                    className="mt-1"
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleCompSelection(comp.id)}
                                  />
                                )}
                                {isLinked && (
                                  <Check className="w-5 h-5 text-green-600 mt-0.5" />
                                )}
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    <Anchor className="w-4 h-4 text-blue-500" />
                                    {comp.marinaName}
                                  </div>
                                  <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                    <MapPin className="w-3 h-3" />
                                    {comp.city}, {comp.state}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-blue-600">
                                  {comp.averageRate ? `$${Number(comp.averageRate).toFixed(2)}/ft` : 'N/A'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {comp.slipCount} slips • {comp.occupancyRate ? `${comp.occupancyRate}% occ.` : 'N/A'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {selectedComps.size > 0 && (
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-sm text-gray-600">
                  {selectedComps.size} comp{selectedComps.size !== 1 ? 's' : ''} selected
                </span>
                <Button onClick={handleBulkLink} disabled={bulkLinkMutation.isPending}>
                  {bulkLinkMutation.isPending ? "Linking..." : `Link ${selectedComps.size} Comp${selectedComps.size !== 1 ? 's' : ''}`}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <DollarSign className="w-5 h-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold text-green-600">{salesCompsCount}</p>
            <p className="text-xs text-gray-600">Sales Comps</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <TrendingUp className="w-5 h-5 mx-auto text-blue-600 mb-1" />
            <p className="text-2xl font-bold text-blue-600">{rateCompsCount}</p>
            <p className="text-xs text-gray-600">Rate Comps</p>
          </div>
        </div>

        {salesCompsCount > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Linked Sales Comps</h4>
            <div className="space-y-2">
              {linkedSalesComps?.slice(0, 3).map(link => (
                <div 
                  key={link.id} 
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    {link.isPrimary && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                    <span className="font-medium">{link.salesComp?.marinaName || 'Unknown'}</span>
                    <span className="text-gray-500">
                      {link.salesComp?.city}, {link.salesComp?.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-medium">
                      {link.salesComp?.salePrice ? formatCurrency(Number(link.salesComp.salePrice)) : 'N/A'}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => link.salesCompId && unlinkSalesCompMutation.mutate(link.salesCompId)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {salesCompsCount > 3 && (
                <p className="text-xs text-gray-500 text-center">
                  +{salesCompsCount - 3} more
                </p>
              )}
            </div>
          </div>
        )}

        {rateCompsCount > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Linked Rate Comps</h4>
            <div className="space-y-2">
              {linkedRateComps?.slice(0, 3).map(link => (
                <div 
                  key={link.id} 
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    {link.isPrimary && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                    <span className="font-medium">{link.rateComp?.marinaName || 'Unknown'}</span>
                    <span className="text-gray-500">
                      {link.rateComp?.city}, {link.rateComp?.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-medium">
                      {link.rateComp?.averageRate ? `$${Number(link.rateComp.averageRate).toFixed(2)}/ft` : 'N/A'}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => link.rateCompId && unlinkRateCompMutation.mutate(link.rateCompId)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {rateCompsCount > 3 && (
                <p className="text-xs text-gray-500 text-center">
                  +{rateCompsCount - 3} more
                </p>
              )}
            </div>
          </div>
        )}

        {salesCompsCount === 0 && rateCompsCount === 0 && (
          <div className="text-center py-4 text-gray-500">
            <p className="text-sm">No comps linked yet</p>
            <p className="text-xs mt-1">Add sales or rate comps to benchmark this deal</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
