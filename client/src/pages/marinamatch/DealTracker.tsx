import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  FileText, Search, Filter, MapPin, DollarSign, Anchor, 
  ExternalLink, CheckCircle, XCircle, ArrowRight, Eye, RefreshCw,
  TrendingUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { formatCurrency, formatPercent } from "@/lib/utils";

type SourcedDeal = {
  id: string;
  orgId: string;
  dealSourceId?: string;
  brokerId?: string;
  externalId?: string;
  sourceUrl?: string;
  status: "new" | "under_review" | "qualified" | "disqualified" | "converted" | "archived";
  propertyName: string;
  propertyAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  marinaType?: string;
  totalSlips?: number;
  wetSlips?: number;
  dryStorage?: number;
  askingPrice?: string;
  grossRevenue?: string;
  noi?: string;
  capRate?: string;
  pricePerSlip?: string;
  amenities?: string[];
  description?: string;
  mandateScores?: Record<string, number>;
  bestMandateScore?: string;
  bestMandateId?: string;
  isDuplicate?: boolean;
  duplicateOfId?: string;
  convertedToDealId?: number;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  disqualificationReason?: string;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
};

type DealSource = {
  id: string;
  name: string;
  sourceType: string;
};

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-500" },
  under_review: { label: "Under Review", color: "bg-yellow-500" },
  qualified: { label: "Qualified", color: "bg-green-500" },
  disqualified: { label: "Disqualified", color: "bg-red-500" },
  converted: { label: "Converted", color: "bg-purple-500" },
  archived: { label: "Archived", color: "bg-gray-500" },
};

export function DealTrackerTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<SourcedDeal | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: deals, isLoading } = useQuery<SourcedDeal[]>({
    queryKey: ["/api/marinamatch/sourced-deals", { status: statusFilter !== "all" ? statusFilter : undefined }],
  });

  const { data: sources } = useQuery<DealSource[]>({
    queryKey: ["/api/marinamatch/deal-sources"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes, reason }: { id: string; status: string; notes?: string; reason?: string }) => {
      return apiRequest("POST", `/api/marinamatch/sourced-deals/${id}/review`, { 
        status, 
        notes, 
        disqualificationReason: reason 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/sourced-deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/analytics/overview"] });
      setReviewDialogOpen(false);
      setSelectedDeal(null);
      toast({ title: "Success", description: "Deal reviewed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/marinamatch/sourced-deals/${id}/convert`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/sourced-deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/analytics/overview"] });
      toast({ title: "Success", description: "Deal marked for CRM conversion" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredDeals = deals?.filter(deal => {
    if (sourceFilter !== "all" && deal.dealSourceId !== sourceFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        deal.propertyName.toLowerCase().includes(query) ||
        deal.city?.toLowerCase().includes(query) ||
        deal.state?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatCurrencyValue = (value: string | undefined) => {
    if (!value) return "—";
    return formatCurrency(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Deal Queue</h2>
          <p className="text-sm text-muted-foreground">
            Review and process incoming deals from all sources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-48"
              data-testid="input-search-deals"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="disqualified">Disqualified</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-36" data-testid="select-source-filter">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources?.map(source => (
                <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredDeals?.length ? (
        <div className="space-y-3">
          {filteredDeals.map((deal) => {
            const status = statusConfig[deal.status] || statusConfig.new;
            const mandateScore = deal.bestMandateScore ? parseFloat(deal.bestMandateScore) : 0;

            return (
              <Card 
                key={deal.id} 
                className={`hover:shadow-md transition-shadow cursor-pointer ${deal.isDuplicate ? "border-orange-300" : ""}`}
                onClick={() => setSelectedDeal(deal)}
                data-testid={`deal-card-${deal.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                          mandateScore >= 70 ? "bg-green-100" :
                          mandateScore >= 50 ? "bg-yellow-100" :
                          "bg-gray-100"
                        }`}>
                          <TrendingUp className={`h-6 w-6 ${
                            mandateScore >= 70 ? "text-green-600" :
                            mandateScore >= 50 ? "text-yellow-600" :
                            "text-gray-400"
                          }`} />
                        </div>
                        {deal.isDuplicate && (
                          <div className="absolute -top-1 -right-1 h-4 w-4 bg-orange-500 rounded-full flex items-center justify-center">
                            <span className="text-[10px] text-white font-bold">D</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold truncate" data-testid={`deal-name-${deal.id}`}>
                            {deal.propertyName}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {(deal.city || deal.state) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {[deal.city, deal.state].filter(Boolean).join(", ")}
                              </span>
                            )}
                            {deal.totalSlips && (
                              <span className="flex items-center gap-1">
                                <Anchor className="h-3 w-3" />
                                {deal.totalSlips} slips
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge className={`${status.color} text-white flex-shrink-0`}>
                          {status.label}
                        </Badge>
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatCurrencyValue(deal.askingPrice)}</span>
                        </div>
                        {deal.capRate && (
                          <span className="text-muted-foreground">
                            Cap: {formatPercent(parseFloat(deal.capRate))}
                          </span>
                        )}
                        {mandateScore > 0 && (
                          <Badge variant={mandateScore >= 70 ? "default" : "secondary"} className="text-xs">
                            Match: {formatPercent(mandateScore)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {deal.sourceUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(deal.sourceUrl, "_blank");
                          }}
                          data-testid={`btn-source-link-${deal.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDeal(deal);
                        }}
                        data-testid={`btn-view-deal-${deal.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Deals Found</h3>
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== "all" || sourceFilter !== "all"
                ? "Try adjusting your filters"
                : "Deals will appear here when imported from configured sources"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Deal Detail Dialog */}
      <Dialog open={!!selectedDeal && !reviewDialogOpen} onOpenChange={(open) => !open && setSelectedDeal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedDeal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedDeal.propertyName}
                  {selectedDeal.isDuplicate && (
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      Potential Duplicate
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {[selectedDeal.city, selectedDeal.state].filter(Boolean).join(", ")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Asking Price</Label>
                    <p className="font-semibold text-lg">{formatCurrencyValue(selectedDeal.askingPrice)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Mandate Match</Label>
                    <p className="font-semibold text-lg">
                      {selectedDeal.bestMandateScore 
                        ? formatPercent(parseFloat(selectedDeal.bestMandateScore))
                        : "Not scored"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Total Slips</Label>
                    <p className="font-medium">{selectedDeal.totalSlips || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cap Rate</Label>
                    <p className="font-medium">
                      {selectedDeal.capRate ? formatPercent(parseFloat(selectedDeal.capRate)) : "—"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Price/Slip</Label>
                    <p className="font-medium">{formatCurrencyValue(selectedDeal.pricePerSlip)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Gross Revenue</Label>
                    <p className="font-medium">{formatCurrencyValue(selectedDeal.grossRevenue)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">NOI</Label>
                    <p className="font-medium">{formatCurrencyValue(selectedDeal.noi)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Marina Type</Label>
                    <p className="font-medium">{selectedDeal.marinaType || "—"}</p>
                  </div>
                </div>

                {selectedDeal.description && (
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="text-sm mt-1">{selectedDeal.description}</p>
                  </div>
                )}

                {selectedDeal.amenities && selectedDeal.amenities.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Amenities</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedDeal.amenities.map((amenity, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Imported: {format(new Date(selectedDeal.importedAt), "MMM d, yyyy HH:mm")}
                </div>
              </div>

              <DialogFooter className="gap-2">
                {selectedDeal.status === "new" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        reviewMutation.mutate({ id: selectedDeal.id, status: "under_review" });
                      }}
                      data-testid="btn-mark-review"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Mark for Review
                    </Button>
                  </>
                )}
                {(selectedDeal.status === "new" || selectedDeal.status === "under_review") && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setReviewDialogOpen(true)}
                      data-testid="btn-open-review"
                    >
                      Review Deal
                    </Button>
                    <Button
                      onClick={() => {
                        reviewMutation.mutate({ id: selectedDeal.id, status: "qualified" });
                      }}
                      data-testid="btn-qualify"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Qualify
                    </Button>
                  </>
                )}
                {selectedDeal.status === "qualified" && !selectedDeal.convertedToDealId && (
                  <Button
                    onClick={() => convertMutation.mutate(selectedDeal.id)}
                    disabled={convertMutation.isPending}
                    data-testid="btn-convert"
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Convert to CRM Deal
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Deal</DialogTitle>
            <DialogDescription>
              Provide review notes and decide on this deal
            </DialogDescription>
          </DialogHeader>
          <ReviewForm
            onQualify={(notes) => {
              if (selectedDeal) {
                reviewMutation.mutate({ id: selectedDeal.id, status: "qualified", notes });
              }
            }}
            onDisqualify={(notes, reason) => {
              if (selectedDeal) {
                reviewMutation.mutate({ id: selectedDeal.id, status: "disqualified", notes, reason });
              }
            }}
            isLoading={reviewMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewForm({
  onQualify,
  onDisqualify,
  isLoading,
}: {
  onQualify: (notes: string) => void;
  onDisqualify: (notes: string, reason: string) => void;
  isLoading: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="notes">Review Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this deal..."
          rows={3}
          data-testid="textarea-review-notes"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Disqualification Reason (if applicable)</Label>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger data-testid="select-disqualification-reason">
            <SelectValue placeholder="Select reason..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price_too_high">Price Too High</SelectItem>
            <SelectItem value="wrong_location">Wrong Location</SelectItem>
            <SelectItem value="too_small">Too Small</SelectItem>
            <SelectItem value="too_large">Too Large</SelectItem>
            <SelectItem value="environmental_concerns">Environmental Concerns</SelectItem>
            <SelectItem value="competitive_market">Too Competitive</SelectItem>
            <SelectItem value="poor_financials">Poor Financials</SelectItem>
            <SelectItem value="duplicate">Duplicate Entry</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter className="gap-2">
        <Button
          variant="outline"
          onClick={() => onDisqualify(notes, reason)}
          disabled={isLoading || !reason}
          data-testid="btn-disqualify"
        >
          {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
          Disqualify
        </Button>
        <Button
          onClick={() => onQualify(notes)}
          disabled={isLoading}
          data-testid="btn-qualify-confirm"
        >
          {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Qualify Deal
        </Button>
      </DialogFooter>
    </div>
  );
}
