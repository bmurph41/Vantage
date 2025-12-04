import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  RefreshCw, Search, MapPin, DollarSign, Anchor, 
  ExternalLink, Star, Clock, Filter, Fuel, Store,
  Wrench, ArrowUpDown, Building, Info, Globe
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface MarinaListing {
  id: string;
  title: string;
  propertyName?: string;
  propertyAddress?: string;
  city?: string;
  state?: string;
  askingPrice?: string;
  totalSlips?: number;
  grossRevenue?: string;
  capRate?: string;
  occupancyRate?: string;
  sourcePlatform: string;
  sourceUrl: string;
  bestMatchScore?: number;
  hasFuel?: boolean;
  hasShipStore?: boolean;
  hasRepairShop?: boolean;
  hasDryStorage?: boolean;
  status: string;
  listingDate?: string;
  createdAt: string;
  originalDescription?: string;
  attributionText?: string;
  brokerName?: string;
  brokerCompany?: string;
  brokerPhone?: string;
  brokerEmail?: string;
}

interface IntelAnalytics {
  totalListings: number;
  activeListings: number;
  highMatchListings: number;
  avgMatchScore: number;
  totalGoals: number;
  activeProfiles: number;
  activeSources: number;
  listingsBySource: Record<string, number>;
  listingsByState: Record<string, number>;
}

export function MarketIntelTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [minScoreFilter, setMinScoreFilter] = useState<string>("0");
  const [selectedListing, setSelectedListing] = useState<MarinaListing | null>(null);

  const { data: analytics, isLoading: analyticsLoading } = useQuery<IntelAnalytics>({
    queryKey: ["/api/marinamatch/intel/analytics/overview"],
  });

  const { data: listings, isLoading: listingsLoading, refetch: refetchListings } = useQuery<MarinaListing[]>({
    queryKey: ["/api/marinamatch/intel/listings", { minScore: minScoreFilter }],
  });

  const { data: scrapeStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/marinamatch/intel/scrape/stats"],
  });

  const triggerScrapeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/marinamatch/intel/scrape/trigger", {
        method: "POST",
        body: JSON.stringify({ platforms: ["crexi", "bizbuysell"] }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Scrape Complete",
        description: `Found ${data.totalFound} listings. ${data.newListings} new, ${data.updatedListings} updated.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/analytics/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/scrape/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Scrape Failed",
        description: error.message || "Failed to trigger scrape job",
        variant: "destructive",
      });
    },
  });

  const seedDemoMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/marinamatch/intel/seed-demo-data", {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sample Listings Loaded",
        description: data.message || `Loaded ${data.listingsCount} sample marina listings.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/analytics/overview"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Load Sample Data",
        description: error.message || "Could not load sample listings",
        variant: "destructive",
      });
    },
  });

  const filteredListings = listings?.filter(listing => {
    if (searchTerm && !listing.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (stateFilter !== "all" && listing.state !== stateFilter) {
      return false;
    }
    if (sourceFilter !== "all" && listing.sourcePlatform !== sourceFilter) {
      return false;
    }
    return true;
  }) || [];

  const uniqueStates = [...new Set(listings?.map(l => l.state).filter(Boolean))].sort();
  const uniqueSources = [...new Set(listings?.map(l => l.sourcePlatform))].sort();

  const formatPrice = (price: string | undefined) => {
    if (!price) return "—";
    const num = parseFloat(price);
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num.toFixed(0)}`;
  };

  const getScoreColor = (score: number | undefined) => {
    if (!score) return "bg-muted";
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  const getSourceBadgeStyle = (source: string) => {
    switch (source.toLowerCase()) {
      case 'loopnet':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200';
      case 'crexi':
        return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-200';
      case 'bizbuysell':
        return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-200';
      case 'costar':
        return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getLastSyncTime = () => {
    if (!listings || listings.length === 0) return null;
    const mostRecent = listings.reduce((latest, listing) => {
      const listingDate = new Date(listing.createdAt);
      return listingDate > new Date(latest.createdAt) ? listing : latest;
    }, listings[0]);
    return mostRecent.createdAt;
  };

  const lastSync = getLastSyncTime();

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800" data-testid="aggregator-disclaimer">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Aggregated Listings:</span> These marina listings are sourced from third-party commercial real estate platforms including LoopNet, Crexi, BizBuySell, and broker websites. MarinaMatch does not own, endorse, or guarantee the accuracy of these listings. For accurate, up-to-date information, please contact the listing broker directly or visit the original source.
          {lastSync && (
            <span className="block mt-1 text-xs">
              <Clock className="h-3 w-3 inline mr-1" />
              Last synchronized: {formatDistanceToNow(new Date(lastSync), { addSuffix: true })}
            </span>
          )}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Listings</CardDescription>
            <CardTitle className="text-3xl" data-testid="stat-total-listings">
              {analyticsLoading ? <Skeleton className="h-9 w-16" /> : analytics?.totalListings || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{analytics?.activeListings || 0} active</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High Match Listings</CardDescription>
            <CardTitle className="text-3xl text-green-600" data-testid="stat-high-match">
              {analyticsLoading ? <Skeleton className="h-9 w-16" /> : analytics?.highMatchListings || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4" />
              <span>Score 70+</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Match Score</CardDescription>
            <CardTitle className="text-3xl" data-testid="stat-avg-score">
              {analyticsLoading ? <Skeleton className="h-9 w-16" /> : `${analytics?.avgMatchScore || 0}%`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={analytics?.avgMatchScore || 0} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Criteria Profiles</CardDescription>
            <CardTitle className="text-3xl" data-testid="stat-profiles">
              {analyticsLoading ? <Skeleton className="h-9 w-16" /> : analytics?.activeProfiles || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => triggerScrapeMutation.mutate()}
              disabled={triggerScrapeMutation.isPending}
              data-testid="button-refresh-listings"
            >
              {triggerScrapeMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh Listings
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Marina Listings</CardTitle>
              <CardDescription>
                AI-matched marina listings from commercial real estate platforms
              </CardDescription>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search listings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-listings"
              />
            </div>
            
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-state-filter">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {uniqueStates.map(state => (
                  <SelectItem key={state} value={state!}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-source-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map(source => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={minScoreFilter} onValueChange={setMinScoreFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-score-filter">
                <Star className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Min Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any Score</SelectItem>
                <SelectItem value="50">50+ Score</SelectItem>
                <SelectItem value="60">60+ Score</SelectItem>
                <SelectItem value="70">70+ Score</SelectItem>
                <SelectItem value="80">80+ Score</SelectItem>
                <SelectItem value="90">90+ Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        
        <CardContent>
          {listingsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-12">
              <Anchor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No listings found</p>
              <p className="text-muted-foreground">
                Try adjusting your filters or load sample data to explore the platform
              </p>
              <div className="flex gap-3 justify-center mt-4">
                <Button 
                  variant="outline"
                  onClick={() => seedDemoMutation.mutate()}
                  disabled={seedDemoMutation.isPending}
                  data-testid="button-seed-demo-data"
                >
                  {seedDemoMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Building className="h-4 w-4 mr-2" />
                  )}
                  Load Sample Listings
                </Button>
                <Button 
                  onClick={() => triggerScrapeMutation.mutate()}
                  disabled={triggerScrapeMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Fetch Live Listings
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedListing(listing)}
                    data-testid={`listing-card-${listing.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{listing.title}</h3>
                          {listing.bestMatchScore && (
                            <div className={`px-2 py-0.5 rounded text-xs text-white ${getScoreColor(listing.bestMatchScore)}`}>
                              {listing.bestMatchScore}% match
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          {listing.city && listing.state && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {listing.city}, {listing.state}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(listing.createdAt), { addSuffix: true })}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-3 text-sm">
                          {listing.askingPrice && (
                            <span className="flex items-center gap-1 font-medium">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              {formatPrice(listing.askingPrice)}
                            </span>
                          )}
                          {listing.totalSlips && (
                            <span className="flex items-center gap-1">
                              <Anchor className="h-4 w-4" />
                              {listing.totalSlips} slips
                            </span>
                          )}
                          {listing.capRate && (
                            <span className="text-muted-foreground">
                              {parseFloat(listing.capRate).toFixed(1)}% cap
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 mt-2">
                          {listing.hasFuel && (
                            <Badge variant="secondary" className="text-xs">
                              <Fuel className="h-3 w-3 mr-1" />
                              Fuel
                            </Badge>
                          )}
                          {listing.hasShipStore && (
                            <Badge variant="secondary" className="text-xs">
                              <Store className="h-3 w-3 mr-1" />
                              Store
                            </Badge>
                          )}
                          {listing.hasRepairShop && (
                            <Badge variant="secondary" className="text-xs">
                              <Wrench className="h-3 w-3 mr-1" />
                              Repair
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs font-medium border ${getSourceBadgeStyle(listing.sourcePlatform)}`}
                          data-testid={`badge-source-${listing.sourcePlatform}`}
                        >
                          <Globe className="h-3 w-3 mr-1" />
                          via {listing.sourcePlatform}
                        </Badge>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs h-7"
                          asChild
                          data-testid={`button-view-original-${listing.id}`}
                        >
                          <a 
                            href={listing.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Original
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedListing} onOpenChange={() => setSelectedListing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedListing && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <DialogTitle className="text-xl">{selectedListing.title}</DialogTitle>
                  <Badge 
                    variant="outline" 
                    className={`text-xs font-medium border ml-2 ${getSourceBadgeStyle(selectedListing.sourcePlatform)}`}
                  >
                    <Globe className="h-3 w-3 mr-1" />
                    via {selectedListing.sourcePlatform}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Aggregated listing from {selectedListing.sourcePlatform}
                </p>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  {selectedListing.bestMatchScore && (
                    <div className={`px-3 py-1 rounded text-white ${getScoreColor(selectedListing.bestMatchScore)}`}>
                      {selectedListing.bestMatchScore}% Match Score
                    </div>
                  )}
                  <Badge variant={selectedListing.status === "active" ? "default" : "secondary"}>
                    {selectedListing.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    Added {formatDistanceToNow(new Date(selectedListing.createdAt), { addSuffix: true })}
                  </span>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Location</h4>
                    <p className="text-muted-foreground">
                      {selectedListing.propertyAddress || "—"}
                    </p>
                    <p>
                      {selectedListing.city}, {selectedListing.state}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Pricing</h4>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPrice(selectedListing.askingPrice)}
                    </p>
                    {selectedListing.capRate && (
                      <p className="text-muted-foreground">
                        {parseFloat(selectedListing.capRate).toFixed(2)}% Cap Rate
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-medium mb-1">Total Slips</h4>
                    <p className="text-lg">{selectedListing.totalSlips || "—"}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Gross Revenue</h4>
                    <p className="text-lg">{formatPrice(selectedListing.grossRevenue)}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Occupancy</h4>
                    <p className="text-lg">
                      {selectedListing.occupancyRate ? `${parseFloat(selectedListing.occupancyRate).toFixed(0)}%` : "—"}
                    </p>
                  </div>
                </div>

                {selectedListing.originalDescription && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedListing.originalDescription}
                      </p>
                    </div>
                  </>
                )}

                {(selectedListing.brokerName || selectedListing.brokerCompany) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Broker Contact</h4>
                      <p>{selectedListing.brokerName}</p>
                      <p className="text-muted-foreground">{selectedListing.brokerCompany}</p>
                      {selectedListing.brokerPhone && <p>{selectedListing.brokerPhone}</p>}
                      {selectedListing.brokerEmail && <p>{selectedListing.brokerEmail}</p>}
                    </div>
                  </>
                )}

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        {selectedListing.attributionText || `Source: ${selectedListing.sourcePlatform}`}
                      </p>
                    </div>
                    <Button 
                      className="shrink-0" 
                      asChild
                      data-testid="button-view-original-modal"
                    >
                      <a href={selectedListing.sourceUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Original Listing
                      </a>
                    </Button>
                  </div>
                  
                  <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Disclaimer:</span> This listing information is aggregated from {selectedListing.sourcePlatform} for informational purposes only. MarinaMatch does not own this listing and makes no representations about its accuracy, completeness, or availability. Contact the listing broker for verified information before making any investment decisions.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
