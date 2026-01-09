import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  TrendingUp, DollarSign, Building2, MapPin, Calendar, Trash2, Plus, Search,
  Link2, Star, Anchor, PercentIcon, X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { SalesComp, RateComp } from "@shared/schema";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface PropertyIntegrationPanelProps {
  propertyId: string;
  propertyTitle: string;
}

function SalesCompCard({ comp, linkMetadata, onUnlink }: { 
  comp: SalesComp & { linkMetadata?: any }; 
  linkMetadata?: any;
  onUnlink: () => void;
}) {
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow" data-testid={`property-sales-comp-${comp.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-sm">{comp.marinaName || "Unnamed Marina"}</span>
              {linkMetadata?.isPrimary && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  <Star className="w-3 h-3 mr-1" />
                  Primary
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{comp.city}, {comp.state || "N/A"}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{comp.saleYear || "N/A"}</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                <span>{formatCurrency(comp.salePrice)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Anchor className="w-3 h-3" />
                <span>{comp.totalSlips || "N/A"} slips</span>
              </div>
            </div>
            {linkMetadata?.relevanceScore && (
              <div className="mt-2 flex items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  Relevance: {linkMetadata.relevanceScore}%
                </Badge>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onUnlink}
            className="text-gray-400 hover:text-red-600"
            data-testid={`unlink-sales-comp-${comp.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RateCompCard({ comp, linkMetadata, onUnlink }: { 
  comp: RateComp & { linkMetadata?: any };
  linkMetadata?: any;
  onUnlink: () => void;
}) {
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow" data-testid={`property-rate-comp-${comp.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-sm">{comp.marinaName || "Unnamed Marina"}</span>
              {linkMetadata?.isPrimary && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  <Star className="w-3 h-3 mr-1" />
                  Primary
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{comp.city}, {comp.state || "N/A"}</span>
              </div>
              <div className="flex items-center gap-1">
                <PercentIcon className="w-3 h-3" />
                <span>Occupancy: {formatPercent(comp.occupancyRate)}</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                <span>Avg Rate: {formatCurrency(comp.averageRate)}/mo</span>
              </div>
              <div className="flex items-center gap-1">
                <Anchor className="w-3 h-3" />
                <span>{comp.totalSlips || "N/A"} slips</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onUnlink}
            className="text-gray-400 hover:text-red-600"
            data-testid={`unlink-rate-comp-${comp.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LinkCompModal({ isOpen, onClose, propertyId, compType }: {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  compType: "sales" | "rate";
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: salesComps = [], isLoading: salesLoading } = useQuery<SalesComp[]>({
    queryKey: ['/api/sales-comps'],
    enabled: compType === "sales" && isOpen,
  });

  const { data: rateComps = [], isLoading: rateLoading } = useQuery<RateComp[]>({
    queryKey: ['/api/rate-comps'],
    enabled: compType === "rate" && isOpen,
  });

  const comps = compType === "sales" ? salesComps : rateComps;
  const isLoading = compType === "sales" ? salesLoading : rateLoading;

  const filteredComps = comps.filter((comp: any) =>
    (comp.marinaName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (comp.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (comp.state || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompId) throw new Error("No comp selected");
      const endpoint = compType === "sales"
        ? `/api/integration/properties/${propertyId}/sales-comps`
        : `/api/integration/properties/${propertyId}/rate-comps`;
      const body = compType === "sales"
        ? { salesCompId: selectedCompId, isPrimary, notes }
        : { rateCompId: selectedCompId, isPrimary, notes };
      return apiRequest(endpoint, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      const key = compType === "sales" 
        ? `/api/integration/properties/${propertyId}/sales-comps`
        : `/api/integration/properties/${propertyId}/rate-comps`;
      queryClient.invalidateQueries({ queryKey: [key] });
      toast({
        title: "Comp Linked",
        description: `Successfully linked ${compType} comp to this property.`,
      });
      onClose();
      setSelectedCompId(null);
      setIsPrimary(false);
      setNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to link comp",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="property-link-comp-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Link {compType === "sales" ? "Sales" : "Rate"} Comp to Property
          </DialogTitle>
          <DialogDescription>
            Search and select a comparable to link to this property for analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by marina name, city, or state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="search-property-comps-input"
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-md">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredComps.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No {compType} comps found matching your search.
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {filteredComps.map((comp: any) => (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedCompId(comp.id)}
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      selectedCompId === comp.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    data-testid={`select-comp-${comp.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {compType === "sales" ? (
                          <Building2 className="w-4 h-4 text-blue-600" />
                        ) : (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        )}
                        <span className="font-medium text-sm">{comp.marinaName || "Unnamed"}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {comp.city}, {comp.state}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                      {compType === "sales" ? (
                        <>
                          <span>{formatCurrency(comp.salePrice)}</span>
                          <span>{comp.saleYear}</span>
                          <span>{comp.totalSlips} slips</span>
                        </>
                      ) : (
                        <>
                          <span>{formatCurrency(comp.averageRate)}/mo</span>
                          <span>{formatPercent(comp.occupancyRate)} occ</span>
                          <span>{comp.totalSlips} slips</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {selectedCompId && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="primary-property"
                  checked={isPrimary}
                  onCheckedChange={(checked) => setIsPrimary(!!checked)}
                  data-testid="checkbox-primary-property"
                />
                <Label htmlFor="primary-property" className="text-sm">
                  Mark as primary comparison
                </Label>
              </div>
              <div>
                <Label htmlFor="notes-property" className="text-sm">Notes (optional)</Label>
                <Textarea
                  id="notes-property"
                  placeholder="Add notes about why this comp is relevant..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                  rows={2}
                  data-testid="textarea-comp-notes-property"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-link-property">
            Cancel
          </Button>
          <Button
            onClick={() => linkMutation.mutate()}
            disabled={!selectedCompId || linkMutation.isPending}
            data-testid="button-confirm-link-property"
          >
            {linkMutation.isPending ? "Linking..." : "Link Comp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PropertyIntegrationPanel({ propertyId, propertyTitle }: PropertyIntegrationPanelProps) {
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkCompType, setLinkCompType] = useState<"sales" | "rate">("sales");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: salesComps = [], isLoading: salesLoading } = useQuery({
    queryKey: [`/api/integration/properties/${propertyId}/sales-comps`],
    enabled: !!propertyId,
  });

  const { data: rateComps = [], isLoading: rateLoading } = useQuery({
    queryKey: [`/api/integration/properties/${propertyId}/rate-comps`],
    enabled: !!propertyId,
  });

  const unlinkSalesCompMutation = useMutation({
    mutationFn: async (salesCompId: string) => {
      return apiRequest(`/api/integration/properties/${propertyId}/sales-comps/${salesCompId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/integration/properties/${propertyId}/sales-comps`] });
      toast({ title: "Comp Unlinked", description: "Sales comp has been unlinked from this property." });
    },
  });

  const unlinkRateCompMutation = useMutation({
    mutationFn: async (rateCompId: string) => {
      return apiRequest(`/api/integration/properties/${propertyId}/rate-comps/${rateCompId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/integration/properties/${propertyId}/rate-comps`] });
      toast({ title: "Comp Unlinked", description: "Rate comp has been unlinked from this property." });
    },
  });

  const openLinkModal = (type: "sales" | "rate") => {
    setLinkCompType(type);
    setLinkModalOpen(true);
  };

  const totalLinked = salesComps.length + rateComps.length;

  return (
    <>
      <Card className="border-0 shadow-none" data-testid="property-integration-panel">
        <CardHeader className="px-0 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Link2 className="w-5 h-5 text-blue-600" />
                Linked Comparables
              </CardTitle>
              <CardDescription>
                {totalLinked} comparable{totalLinked !== 1 ? "s" : ""} linked to this property
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Tabs defaultValue="sales" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sales" data-testid="tab-property-sales-comps">
                <Building2 className="w-4 h-4 mr-2" />
                Sales Comps ({salesComps.length})
              </TabsTrigger>
              <TabsTrigger value="rate" data-testid="tab-property-rate-comps">
                <TrendingUp className="w-4 h-4 mr-2" />
                Rate Comps ({rateComps.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="mt-4 space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLinkModal("sales")}
                className="w-full"
                data-testid="button-link-sales-comp-property"
              >
                <Plus className="w-4 h-4 mr-2" />
                Link Sales Comp
              </Button>
              {salesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : salesComps.length === 0 ? (
                <div className="text-center py-6 text-gray-500 border rounded-md">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No sales comps linked yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {salesComps.map((comp: any) => (
                    <SalesCompCard
                      key={comp.id}
                      comp={comp}
                      linkMetadata={comp.linkMetadata}
                      onUnlink={() => unlinkSalesCompMutation.mutate(comp.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rate" className="mt-4 space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLinkModal("rate")}
                className="w-full"
                data-testid="button-link-rate-comp-property"
              >
                <Plus className="w-4 h-4 mr-2" />
                Link Rate Comp
              </Button>
              {rateLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : rateComps.length === 0 ? (
                <div className="text-center py-6 text-gray-500 border rounded-md">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No rate comps linked yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rateComps.map((comp: any) => (
                    <RateCompCard
                      key={comp.id}
                      comp={comp}
                      linkMetadata={comp.linkMetadata}
                      onUnlink={() => unlinkRateCompMutation.mutate(comp.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <LinkCompModal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        propertyId={propertyId}
        compType={linkCompType}
      />
    </>
  );
}
