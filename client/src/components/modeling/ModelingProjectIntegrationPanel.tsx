import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
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
  Link2, Star, Anchor, PercentIcon, Weight, CheckCircle, ExternalLink
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { SalesComp, RateComp, ModelingProjectComp } from "@shared/schema";

interface ModelingProjectIntegrationPanelProps {
  projectId: string;
  projectName: string;
}

function LinkedCompCard({ compLink, onUnlink }: { 
  compLink: ModelingProjectComp & { salesComp?: SalesComp; rateComp?: RateComp }; 
  onUnlink: () => void;
}) {
  const isSalesComp = compLink.compType === "sales";
  const comp = isSalesComp ? compLink.salesComp : compLink.rateComp;
  
  if (!comp) {
    return null;
  }

  const compDetailUrl = isSalesComp 
    ? `/analysis/sales-comps/${comp.id}` 
    : `/analysis/rate-comps/${comp.id}`;

  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow" data-testid={`modeling-comp-${compLink.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isSalesComp ? (
                <Building2 className="w-4 h-4 text-blue-600" />
              ) : (
                <TrendingUp className="w-4 h-4 text-green-600" />
              )}
              <Link href={compDetailUrl} className="font-semibold text-sm hover:text-primary hover:underline">
                {(comp as any).marinaName || "Unnamed Marina"}
              </Link>
              <Badge variant="outline" className="text-xs">
                {isSalesComp ? "Sales" : "Rate"}
              </Badge>
              {compLink.isPrimary && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  <Star className="w-3 h-3 mr-1" />
                  Primary
                </Badge>
              )}
              {compLink.usedInValuation && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  In Valuation
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{(comp as any).city}, {(comp as any).state || "N/A"}</span>
              </div>
              {isSalesComp ? (
                <>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    <span>{formatCurrency((comp as SalesComp).salePrice)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{(comp as SalesComp).saleYear || "N/A"}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    <span>{formatCurrency((comp as RateComp).averageRate)}/mo</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <PercentIcon className="w-3 h-3" />
                    <span>{formatPercent((comp as RateComp).occupancyRate)} occ</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              {compLink.relevanceScore && (
                <Badge variant="outline" className="text-xs">
                  Relevance: {compLink.relevanceScore}%
                </Badge>
              )}
              {compLink.weight && (
                <Badge variant="outline" className="text-xs">
                  <Weight className="w-3 h-3 mr-1" />
                  Weight: {compLink.weight}%
                </Badge>
              )}
            </div>
            {compLink.notes && (
              <p className="mt-2 text-xs text-gray-500 italic">{compLink.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Link href={compDetailUrl}>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-primary"
                data-testid={`view-modeling-comp-${compLink.id}`}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={onUnlink}
              className="text-gray-400 hover:text-red-600"
              data-testid={`unlink-modeling-comp-${compLink.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LinkCompModal({ isOpen, onClose, projectId, compType }: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  compType: "sales" | "rate";
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [usedInValuation, setUsedInValuation] = useState(false);
  const [weight, setWeight] = useState<number>(0);
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
      const body = {
        compType,
        ...(compType === "sales" ? { salesCompId: selectedCompId } : { rateCompId: selectedCompId }),
        isPrimary,
        usedInValuation,
        weight: weight > 0 ? weight : undefined,
        notes: notes || undefined,
      };
      return apiRequest(`/api/integration/modeling-projects/${projectId}/comps`, { 
        method: "POST", 
        body: JSON.stringify(body) 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/integration/modeling-projects/${projectId}/comps`] });
      toast({
        title: "Comp Linked",
        description: `Successfully linked ${compType} comp to this project.`,
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to link comp",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setSelectedCompId(null);
    setIsPrimary(false);
    setUsedInValuation(false);
    setWeight(0);
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh]" data-testid="modeling-link-comp-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Link {compType === "sales" ? "Sales" : "Rate"} Comp to Project
          </DialogTitle>
          <DialogDescription>
            Select a comparable to use in your valuation model. You can assign weights and mark comps for inclusion in calculations.
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
              data-testid="search-modeling-comps-input"
            />
          </div>

          <ScrollArea className="h-[250px] border rounded-md">
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
                    data-testid={`select-modeling-comp-${comp.id}`}
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
            <div className="space-y-4 pt-2 border-t">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="primary-modeling"
                    checked={isPrimary}
                    onCheckedChange={(checked) => setIsPrimary(!!checked)}
                    data-testid="checkbox-primary-modeling"
                  />
                  <Label htmlFor="primary-modeling" className="text-sm">
                    Mark as primary comp
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="valuation-modeling"
                    checked={usedInValuation}
                    onCheckedChange={(checked) => setUsedInValuation(!!checked)}
                    data-testid="checkbox-valuation-modeling"
                  />
                  <Label htmlFor="valuation-modeling" className="text-sm">
                    Include in valuation
                  </Label>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Weight in valuation: {weight}%</Label>
                </div>
                <Slider
                  value={[weight]}
                  onValueChange={(vals) => setWeight(vals[0])}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-weight-modeling"
                />
              </div>

              <div>
                <Label htmlFor="notes-modeling" className="text-sm">Notes (optional)</Label>
                <Textarea
                  id="notes-modeling"
                  placeholder="Add notes about why this comp is relevant to the valuation..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                  rows={2}
                  data-testid="textarea-comp-notes-modeling"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-link-modeling">
            Cancel
          </Button>
          <Button
            onClick={() => linkMutation.mutate()}
            disabled={!selectedCompId || linkMutation.isPending}
            data-testid="button-confirm-link-modeling"
          >
            {linkMutation.isPending ? "Linking..." : "Link Comp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ModelingProjectIntegrationPanel({ projectId, projectName }: ModelingProjectIntegrationPanelProps) {
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkCompType, setLinkCompType] = useState<"sales" | "rate">("sales");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: compsData, isLoading } = useQuery<ModelingProjectComp[]>({
    queryKey: [`/api/integration/modeling-projects/${projectId}/comps`],
    enabled: !!projectId,
  });
  const comps = Array.isArray(compsData) ? compsData : [];

  const unlinkMutation = useMutation({
    mutationFn: async (compLinkId: string) => {
      return apiRequest(`/api/integration/modeling-projects/${projectId}/comps/${compLinkId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/integration/modeling-projects/${projectId}/comps`] });
      toast({ title: "Comp Unlinked", description: "Comparable has been removed from this project." });
    },
  });

  const salesComps = comps.filter(c => c.compType === "sales");
  const rateComps = comps.filter(c => c.compType === "rate");
  const valuationComps = comps.filter(c => c.usedInValuation);
  const totalWeight = valuationComps.reduce((sum, c) => sum + (c.weight || 0), 0);

  const openLinkModal = (type: "sales" | "rate") => {
    setLinkCompType(type);
    setLinkModalOpen(true);
  };

  return (
    <>
      <div className="space-y-6" data-testid="modeling-integration-panel">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-blue-600" />
                  Linked Comparables
                </CardTitle>
                <CardDescription>
                  {comps.length} comparable{comps.length !== 1 ? "s" : ""} linked for valuation analysis
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openLinkModal("sales")}
                  data-testid="button-link-sales-comp-modeling"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Sales Comp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openLinkModal("rate")}
                  data-testid="button-link-rate-comp-modeling"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Rate Comp
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {valuationComps.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">
                      {valuationComps.length} comp{valuationComps.length !== 1 ? "s" : ""} included in valuation
                    </span>
                  </div>
                  <Badge variant={totalWeight === 100 ? "default" : "secondary"} className={totalWeight === 100 ? "bg-green-600" : ""}>
                    Total Weight: {totalWeight}%
                  </Badge>
                </div>
                {totalWeight !== 100 && totalWeight > 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    Weights should sum to 100% for accurate valuation calculations
                  </p>
                )}
              </div>
            )}

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all" data-testid="tab-all-comps">
                  All ({comps.length})
                </TabsTrigger>
                <TabsTrigger value="sales" data-testid="tab-sales-comps-modeling">
                  <Building2 className="w-4 h-4 mr-1" />
                  Sales ({salesComps.length})
                </TabsTrigger>
                <TabsTrigger value="rate" data-testid="tab-rate-comps-modeling">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Rate ({rateComps.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4 space-y-3">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                  </div>
                ) : comps.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border rounded-md">
                    <Link2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No comparables linked yet</p>
                    <p className="text-xs text-gray-400 mt-1">Add sales or rate comps to support your valuation</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {comps.map((compLink: any) => (
                      <LinkedCompCard
                        key={compLink.id}
                        compLink={compLink}
                        onUnlink={() => unlinkMutation.mutate(compLink.id)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sales" className="mt-4 space-y-3">
                {salesComps.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border rounded-md">
                    <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No sales comps linked yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {salesComps.map((compLink: any) => (
                      <LinkedCompCard
                        key={compLink.id}
                        compLink={compLink}
                        onUnlink={() => unlinkMutation.mutate(compLink.id)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rate" className="mt-4 space-y-3">
                {rateComps.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border rounded-md">
                    <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No rate comps linked yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rateComps.map((compLink: any) => (
                      <LinkedCompCard
                        key={compLink.id}
                        compLink={compLink}
                        onUnlink={() => unlinkMutation.mutate(compLink.id)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <LinkCompModal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        projectId={projectId}
        compType={linkCompType}
      />
    </>
  );
}
