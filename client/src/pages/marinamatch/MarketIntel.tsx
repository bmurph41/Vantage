import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";
import { 
  RefreshCw, Search, MapPin, DollarSign, Anchor, 
  ExternalLink, Star, Clock, Filter, Fuel, Store,
  Wrench, ArrowUpDown, Building, Info, Globe, Loader2,
  Settings, ChevronDown, ChevronUp, Plus, Trash2, Check, X, Radar, Pencil, Mail, AlertTriangle
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
  pricePerSlip?: string;
  totalSlips?: number;
  wetSlips?: number;
  dryStorageSpaces?: number;
  grossRevenue?: string;
  noi?: string;
  capRate?: string;
  occupancyRate?: string;
  sourcePlatform: string;
  sourceUrl: string;
  bestMatchScore?: number;
  extractionConfidence?: number;
  hasFuel?: boolean;
  hasShipStore?: boolean;
  hasRestaurant?: boolean;
  hasRepairShop?: boolean;
  hasDryStorage?: boolean;
  hasBoatRamp?: boolean;
  services?: string[];
  tenantSummary?: string;
  heroImageUrl?: string;
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

interface ScrapeSource {
  id: string;
  orgId: string;
  platform: string;
  name: string;
  baseUrl?: string;
  searchUrl?: string;
  config?: Record<string, unknown>;
  rateLimitRpm: number;
  respectRobotsTxt: boolean;
  userAgent?: string;
  isActive: boolean;
  ingestionMethod?: string;
  propertyType?: string;
  keywordsInclude?: string[];
  keywordsExclude?: string[];
  geographyStates?: string[];
  geographyRegion?: string;
  minPrice?: string;
  maxPrice?: string;
  minSlips?: number;
  maxSlips?: number;
  pollingIntervalMinutes?: number;
  crawlMode?: string;
  seedUrls?: string[];
  maxPagesPerRun?: number;
  tokenBudgetPerRun?: string;
  paginationSelector?: string;
  listingLinkSelector?: string;
  capabilities?: string[];
  capabilityNotes?: string;
  lastScrapeAt?: string;
  lastScrapeStatus?: string;
  lastScrapeCount?: number;
  totalListingsFound: number;
  createdAt: string;
  updatedAt?: string;
}

interface NewSourceForm {
  platform: string;
  name: string;
  searchUrl: string;
  ingestionMethod: string;
  propertyType: string;
  keywordsInclude: string;
  keywordsExclude: string;
  geographyStates: string[];
  minPrice: string;
  maxPrice: string;
  minSlips: string;
  maxSlips: string;
  pollingIntervalMinutes: string;
  crawlMode: string;
  seedUrls: string;
  maxPagesPerRun: string;
  tokenBudgetPerRun: string;
  paginationSelector: string;
  listingLinkSelector: string;
}

interface BrokerSubmitForm {
  title: string;
  propertyName: string;
  propertyAddress: string;
  city: string;
  state: string;
  zipCode: string;
  marinaType: string;
  dealType: string;
  askingPrice: string;
  totalSlips: string;
  wetSlips: string;
  dryStorageSpaces: string;
  acreage: string;
  waterFrontage: string;
  hasFuel: boolean;
  hasShipStore: boolean;
  hasRestaurant: boolean;
  hasRepairShop: boolean;
  hasDryStorage: boolean;
  hasBoatRamp: boolean;
  grossRevenue: string;
  noi: string;
  capRate: string;
  occupancyRate: string;
  brokerName: string;
  brokerCompany: string;
  brokerPhone: string;
  brokerEmail: string;
  originalDescription: string;
  contactUrl: string;
}

const INITIAL_BROKER_FORM: BrokerSubmitForm = {
  title: "",
  propertyName: "",
  propertyAddress: "",
  city: "",
  state: "",
  zipCode: "",
  marinaType: "marina",
  dealType: "acquisition",
  askingPrice: "",
  totalSlips: "",
  wetSlips: "",
  dryStorageSpaces: "",
  acreage: "",
  waterFrontage: "",
  hasFuel: false,
  hasShipStore: false,
  hasRestaurant: false,
  hasRepairShop: false,
  hasDryStorage: false,
  hasBoatRamp: false,
  grossRevenue: "",
  noi: "",
  capRate: "",
  occupancyRate: "",
  brokerName: "",
  brokerCompany: "",
  brokerPhone: "",
  brokerEmail: "",
  originalDescription: "",
  contactUrl: "",
};

const DEFAULT_MARINA_KEYWORDS = ["marina", "boatyard", "yacht club", "boat slip", "dock", "waterfront marina"];
const DEFAULT_EXCLUDE_KEYWORDS = ["rv storage", "self-storage", "warehouse", "mini storage"];
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", 
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", 
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", 
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", 
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

interface MarketIntelTabProps {
  onNavigateToBrokers?: () => void;
}

export function MarketIntelTab({ onNavigateToBrokers }: MarketIntelTabProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [minScoreFilter, setMinScoreFilter] = useState<string>("0");
  const [selectedListing, setSelectedListing] = useState<MarinaListing | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addSourceExpanded, setAddSourceExpanded] = useState(false);
  const [editingSource, setEditingSource] = useState<ScrapeSource | null>(null);
  const [editSourceForm, setEditSourceForm] = useState<NewSourceForm>({
    platform: "",
    name: "",
    searchUrl: "",
    ingestionMethod: "scraping",
    propertyType: "marina",
    keywordsInclude: DEFAULT_MARINA_KEYWORDS.join(", "),
    keywordsExclude: DEFAULT_EXCLUDE_KEYWORDS.join(", "),
    geographyStates: [],
    minPrice: "",
    maxPrice: "",
    minSlips: "",
    maxSlips: "",
    pollingIntervalMinutes: "60",
    crawlMode: "single",
    seedUrls: "",
    maxPagesPerRun: "10",
    tokenBudgetPerRun: "0.50",
    paginationSelector: "",
    listingLinkSelector: "",
  });
  const [newSourceForm, setNewSourceForm] = useState<NewSourceForm>({
    platform: "",
    name: "",
    searchUrl: "",
    ingestionMethod: "scraping",
    propertyType: "marina",
    keywordsInclude: DEFAULT_MARINA_KEYWORDS.join(", "),
    keywordsExclude: DEFAULT_EXCLUDE_KEYWORDS.join(", "),
    geographyStates: [],
    minPrice: "",
    maxPrice: "",
    minSlips: "",
    maxSlips: "",
    pollingIntervalMinutes: "60",
    crawlMode: "single",
    seedUrls: "",
    maxPagesPerRun: "10",
    tokenBudgetPerRun: "0.50",
    paginationSelector: "",
    listingLinkSelector: "",
  });
  const [brokerSubmitOpen, setBrokerSubmitOpen] = useState(false);
  const [brokerForm, setBrokerForm] = useState<BrokerSubmitForm>(INITIAL_BROKER_FORM);

  const { data: analytics, isLoading: analyticsLoading } = useQuery<IntelAnalytics>({
    queryKey: ["/api/marinamatch/intel/analytics/overview"],
  });

  const buildListingsUrl = () => {
    const params = new URLSearchParams();
    if (stateFilter && stateFilter !== "all") params.set("state", stateFilter);
    if (cityFilter && cityFilter !== "all") params.set("city", cityFilter);
    if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (minScoreFilter && minScoreFilter !== "0") params.set("minScore", minScoreFilter);
    const queryString = params.toString();
    return queryString ? `/api/marinamatch/intel/listings?${queryString}` : "/api/marinamatch/intel/listings";
  };
  
  const listingsUrl = buildListingsUrl();
    
  const { data: listings, isLoading: listingsLoading, refetch: refetchListings } = useQuery<MarinaListing[]>({
    queryKey: ["/api/marinamatch/intel/listings", stateFilter, cityFilter, sourceFilter, statusFilter, minScoreFilter],
    queryFn: async () => {
      const response = await fetch(listingsUrl);
      if (!response.ok) throw new Error("Failed to fetch listings");
      return response.json();
    },
    refetchInterval: (data) => {
      if (!data?.state?.data?.length) return 3000;
      return false;
    },
  });

  const { data: scrapeStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/marinamatch/intel/scrape/stats"],
  });

  const { data: syncStatus } = useQuery<{
    enabled: boolean;
    lastScrape: string | null;
    isScraping: boolean;
    nextScrape: string | null;
    listingsCount: number;
    lastRun?: {
      status: string;
      completedAt: string;
      listingsFound?: number;
      listingsNew?: number;
    };
  }>({
    queryKey: ["/api/marinamatch/intel/sync-status"],
    refetchInterval: (data) => {
      if (data?.state?.data?.isScraping) return 3000;
      if (!data?.state?.data?.listingsCount) return 5000;
      return 60000;
    },
  });

  const { data: scrapeSources, isLoading: sourcesLoading } = useQuery<ScrapeSource[]>({
    queryKey: ["/api/marinamatch/intel/scrape-sources"],
  });

  const toggleSourceMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/marinamatch/intel/scrape-sources/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/scrape-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/analytics/overview"] });
      toast({ title: "Source updated", description: "Listing source status changed successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update source. Please try again.", variant: "destructive" });
    },
  });

  const addSourceMutation = useMutation({
    mutationFn: async (data: NewSourceForm) => {
      const payload = {
        platform: data.platform,
        name: data.name,
        searchUrl: data.searchUrl,
        ingestionMethod: data.ingestionMethod,
        propertyType: data.propertyType,
        keywordsInclude: data.keywordsInclude.split(",").map(k => k.trim()).filter(Boolean),
        keywordsExclude: data.keywordsExclude.split(",").map(k => k.trim()).filter(Boolean),
        geographyStates: data.geographyStates.length > 0 ? data.geographyStates : null,
        minPrice: data.minPrice ? data.minPrice : null,
        maxPrice: data.maxPrice ? data.maxPrice : null,
        minSlips: data.minSlips ? parseInt(data.minSlips) : null,
        maxSlips: data.maxSlips ? parseInt(data.maxSlips) : null,
        pollingIntervalMinutes: data.pollingIntervalMinutes ? parseInt(data.pollingIntervalMinutes) : 60,
      };
      return apiRequest("POST", "/api/marinamatch/intel/scrape-sources", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/scrape-sources"] });
      setNewSourceForm({
        platform: "",
        name: "",
        searchUrl: "",
        ingestionMethod: "scraping",
        propertyType: "marina",
        keywordsInclude: DEFAULT_MARINA_KEYWORDS.join(", "),
        keywordsExclude: DEFAULT_EXCLUDE_KEYWORDS.join(", "),
        geographyStates: [],
        minPrice: "",
        maxPrice: "",
        minSlips: "",
        maxSlips: "",
        pollingIntervalMinutes: "60",
      });
      setAddSourceExpanded(false);
      toast({ title: "Source added", description: "New listing source added successfully." });
    },
    onError: (error: any) => {
      console.error("Add source error:", error);
      const errorMessage = error?.message || "Failed to add source. Please try again.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/marinamatch/intel/scrape-sources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/scrape-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/analytics/overview"] });
      toast({ title: "Source deleted", description: "Listing source removed successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete source. Please try again.", variant: "destructive" });
    },
  });

  const editSourceMutation = useMutation({
    mutationFn: async ({ id, data, originalSource }: { id: string; data: NewSourceForm; originalSource: ScrapeSource }) => {
      const payload = {
        platform: data.platform,
        name: data.name,
        searchUrl: data.searchUrl,
        ingestionMethod: data.ingestionMethod,
        propertyType: data.propertyType,
        keywordsInclude: data.keywordsInclude.split(",").map(k => k.trim()).filter(Boolean),
        keywordsExclude: data.keywordsExclude.split(",").map(k => k.trim()).filter(Boolean),
        geographyStates: data.geographyStates.length > 0 ? data.geographyStates : null,
        minPrice: data.minPrice ? data.minPrice : null,
        maxPrice: data.maxPrice ? data.maxPrice : null,
        minSlips: data.minSlips ? parseInt(data.minSlips) : null,
        maxSlips: data.maxSlips ? parseInt(data.maxSlips) : null,
        pollingIntervalMinutes: data.pollingIntervalMinutes ? parseInt(data.pollingIntervalMinutes) : 60,
        rateLimitRpm: originalSource.rateLimitRpm,
        respectRobotsTxt: originalSource.respectRobotsTxt,
        userAgent: originalSource.userAgent,
        config: originalSource.config,
        capabilities: originalSource.capabilities,
        capabilityNotes: originalSource.capabilityNotes,
      };
      return apiRequest("PATCH", `/api/marinamatch/intel/scrape-sources/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/scrape-sources"] });
      setEditingSource(null);
      toast({ title: "Source updated", description: "Listing source configuration saved successfully." });
    },
    onError: (error: any) => {
      console.error("Edit source error:", error);
      const errorMessage = error?.message || "Failed to update source. Please try again.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    },
  });

  const openEditDialog = (source: ScrapeSource) => {
    setEditSourceForm({
      platform: source.platform,
      name: source.name,
      searchUrl: source.searchUrl || "",
      ingestionMethod: source.ingestionMethod || "scraping",
      propertyType: source.propertyType || "marina",
      keywordsInclude: source.keywordsInclude?.join(", ") || DEFAULT_MARINA_KEYWORDS.join(", "),
      keywordsExclude: source.keywordsExclude?.join(", ") || DEFAULT_EXCLUDE_KEYWORDS.join(", "),
      geographyStates: source.geographyStates || [],
      minPrice: source.minPrice || "",
      maxPrice: source.maxPrice || "",
      minSlips: source.minSlips?.toString() || "",
      maxSlips: source.maxSlips?.toString() || "",
      pollingIntervalMinutes: source.pollingIntervalMinutes?.toString() || "60",
      crawlMode: source.crawlMode || "single",
      seedUrls: source.seedUrls?.join("\n") || "",
      maxPagesPerRun: source.maxPagesPerRun?.toString() || "10",
      tokenBudgetPerRun: source.tokenBudgetPerRun?.toString() || "0.50",
      paginationSelector: source.paginationSelector || "",
      listingLinkSelector: source.listingLinkSelector || "",
    });
    setEditingSource(source);
  };

  const triggerScrapeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/marinamatch/intel/scrape/trigger");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/sync-status"] });
      toast({ title: "Sync started", description: "Fetching new listings from configured sources..." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to trigger sync. Please try again.", variant: "destructive" });
    },
  });

  const brokerSubmitMutation = useMutation({
    mutationFn: async (data: BrokerSubmitForm) => {
      const payload = {
        ...data,
        askingPrice: data.askingPrice ? parseFloat(data.askingPrice.replace(/[^0-9.]/g, "")) : null,
        totalSlips: data.totalSlips ? parseInt(data.totalSlips) : null,
        wetSlips: data.wetSlips ? parseInt(data.wetSlips) : null,
        dryStorageSpaces: data.dryStorageSpaces ? parseInt(data.dryStorageSpaces) : null,
        acreage: data.acreage ? parseFloat(data.acreage) : null,
        waterFrontage: data.waterFrontage ? parseFloat(data.waterFrontage) : null,
        grossRevenue: data.grossRevenue ? parseFloat(data.grossRevenue.replace(/[^0-9.]/g, "")) : null,
        noi: data.noi ? parseFloat(data.noi.replace(/[^0-9.]/g, "")) : null,
        capRate: data.capRate ? parseFloat(data.capRate) : null,
        occupancyRate: data.occupancyRate ? parseFloat(data.occupancyRate) : null,
      };
      return apiRequest("POST", "/api/marinamatch/intel/broker-submit", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/analytics/overview"] });
      setBrokerSubmitOpen(false);
      setBrokerForm(INITIAL_BROKER_FORM);
      toast({ title: "Listing posted", description: "Your marina listing has been submitted successfully." });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to submit listing. Please try again.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    },
  });

  const deleteListingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/marinamatch/intel/listings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/analytics/overview"] });
      setSelectedListing(null);
      toast({ title: "Listing deleted", description: "The listing has been removed successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete listing. Please try again.", variant: "destructive" });
    },
  });

  const filteredListings = listings?.filter(listing => {
    if (searchTerm && !listing.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  }) || [];

  const { data: allListings } = useQuery<MarinaListing[]>({
    queryKey: ["/api/marinamatch/intel/listings"],
    staleTime: 60000,
  });

  const uniqueStates = [...new Set(allListings?.map(l => l.state).filter(Boolean))].sort();
  const uniqueCities = [...new Set(
    allListings?.filter(l => stateFilter === "all" || l.state === stateFilter)
      .map(l => l.city).filter(Boolean)
  )].sort();
  const uniqueSources = [...new Set(allListings?.map(l => l.sourcePlatform))].sort();
  const uniqueStatuses = [...new Set(allListings?.map(l => l.status))].sort();

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
    if (syncStatus?.lastRun?.completedAt) {
      return syncStatus.lastRun.completedAt;
    }
    if (!listings || listings.length === 0) return null;
    const mostRecent = listings.reduce((latest, listing) => {
      const listingDate = new Date(listing.createdAt);
      return listingDate > new Date(latest.createdAt) ? listing : latest;
    }, listings[0]);
    return mostRecent.createdAt;
  };

  const lastSync = getLastSyncTime();
  const isSyncing = syncStatus?.isScraping || false;

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800" data-testid="aggregator-disclaimer">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Aggregated Listings:</span> These marina listings are sourced from third-party commercial real estate platforms including LoopNet, Crexi, CoStar, BizBuySell, and broker websites. MarinaMatch does not own, endorse, or guarantee the accuracy of these listings. For accurate, up-to-date information, please contact the listing broker directly or visit the original source.
          <span className="block mt-1 text-xs">
            {isSyncing ? (
              <>
                <RefreshCw className="h-3 w-3 inline mr-1 animate-spin" />
                Syncing new listings...
              </>
            ) : lastSync ? (
              <>
                <Clock className="h-3 w-3 inline mr-1" />
                Last synchronized: {formatDistanceToNow(new Date(lastSync), { addSuffix: true })}
              </>
            ) : (
              <>
                <Clock className="h-3 w-3 inline mr-1" />
                Auto-sync enabled
              </>
            )}
          </span>
        </AlertDescription>
      </Alert>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Card className="border-dashed">
          <CardHeader className="py-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Listing Sources</CardTitle>
                  <Badge variant="outline" className="ml-2">
                    {scrapeSources?.filter(s => s.isActive).length || 0} active
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" data-testid="button-toggle-sources-settings">
                  <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800" data-testid="data-source-info">
                  <Radar className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm">
                    <span className="font-medium text-foreground">Automated Listing Aggregation</span>
                    <ul className="mt-2 space-y-1 text-muted-foreground text-xs list-disc list-inside">
                      <li><strong>Default Sources:</strong> LoopNet, Crexi, BizBuySell, and CoStar are automatically configured for every account</li>
                      <li><strong>Live Monitoring:</strong> Sources are polled regularly to detect new marina listings</li>
                      <li><strong>AI Matching:</strong> Listings are scored against your investment criteria profiles</li>
                      <li><strong>Deduplication:</strong> Identical listings across platforms are merged automatically</li>
                    </ul>
                    <span className="block mt-2 text-xs text-muted-foreground">
                      Toggle sources on/off to control which platforms are monitored. Add custom broker sources below.
                    </span>
                  </AlertDescription>
                </Alert>
                
                <p className="text-sm text-muted-foreground">
                  Configure which commercial real estate platforms to monitor for marina listings. 
                  Active sources are automatically checked on a regular schedule.
                </p>
                
                {sourcesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {scrapeSources?.map(source => (
                      <div 
                        key={source.id} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        data-testid={`source-row-${source.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={source.isActive}
                            onCheckedChange={(checked) => 
                              toggleSourceMutation.mutate({ id: source.id, isActive: checked })
                            }
                            disabled={toggleSourceMutation.isPending}
                            data-testid={`switch-source-${source.id}`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{source.name}</span>
                              <Badge 
                                variant="outline" 
                                className={getSourceBadgeStyle(source.platform)}
                              >
                                {source.platform}
                              </Badge>
                            </div>
                            {source.searchUrl && (
                              <p className="text-xs text-muted-foreground truncate max-w-md">
                                {source.searchUrl}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {source.lastScrapeAt && (
                            <span className="text-xs text-muted-foreground">
                              Last sync: {formatDistanceToNow(new Date(source.lastScrapeAt), { addSuffix: true })}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-medium">
                            {analytics?.listingsBySource?.[source.platform] || 0} listings
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(source)}
                            data-testid={`button-edit-source-${source.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteSourceMutation.mutate(source.id)}
                            disabled={deleteSourceMutation.isPending}
                            data-testid={`button-delete-source-${source.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                <Collapsible open={addSourceExpanded} onOpenChange={setAddSourceExpanded}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Add Custom Source</h4>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid="button-toggle-add-source">
                        {addSourceExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  
                  <CollapsibleContent className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Platform</Label>
                        <Input
                          placeholder="e.g., LoopNet, Custom Broker"
                          value={newSourceForm.platform}
                          onChange={(e) => setNewSourceForm(prev => ({ ...prev, platform: e.target.value }))}
                          data-testid="input-new-source-platform"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Display Name</Label>
                        <Input
                          placeholder="My Marina Source"
                          value={newSourceForm.name}
                          onChange={(e) => setNewSourceForm(prev => ({ ...prev, name: e.target.value }))}
                          data-testid="input-new-source-name"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Search URL</Label>
                        <Input
                          placeholder="https://example.com/search"
                          value={newSourceForm.searchUrl}
                          onChange={(e) => setNewSourceForm(prev => ({ ...prev, searchUrl: e.target.value }))}
                          data-testid="input-new-source-url"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Ingestion Method</Label>
                        <Select
                          value={newSourceForm.ingestionMethod}
                          onValueChange={(value) => setNewSourceForm(prev => ({ ...prev, ingestionMethod: value }))}
                        >
                          <SelectTrigger data-testid="select-ingestion-method">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scraping">Web Scraping</SelectItem>
                            <SelectItem value="api">API Access</SelectItem>
                            <SelectItem value="rss">RSS Feed</SelectItem>
                            <SelectItem value="manual">Manual Import</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Property Type</Label>
                        <Select
                          value={newSourceForm.propertyType}
                          onValueChange={(value) => setNewSourceForm(prev => ({ ...prev, propertyType: value }))}
                        >
                          <SelectTrigger data-testid="select-property-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="marina">Marina</SelectItem>
                            <SelectItem value="boatyard">Boatyard</SelectItem>
                            <SelectItem value="yacht_club">Yacht Club</SelectItem>
                            <SelectItem value="waterfront">Waterfront Property</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Keywords to Include (comma-separated)</Label>
                      <Input
                        placeholder="marina, boatyard, yacht club..."
                        value={newSourceForm.keywordsInclude}
                        onChange={(e) => setNewSourceForm(prev => ({ ...prev, keywordsInclude: e.target.value }))}
                        data-testid="input-keywords-include"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Keywords to Exclude (comma-separated)</Label>
                      <Input
                        placeholder="rv storage, warehouse..."
                        value={newSourceForm.keywordsExclude}
                        onChange={(e) => setNewSourceForm(prev => ({ ...prev, keywordsExclude: e.target.value }))}
                        data-testid="input-keywords-exclude"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">States to Monitor</Label>
                        <Button
                          type="button"
                          variant={newSourceForm.geographyStates.length === US_STATES.length ? "default" : "outline"}
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => {
                            setNewSourceForm(prev => ({
                              ...prev,
                              geographyStates: prev.geographyStates.length === US_STATES.length ? [] : [...US_STATES]
                            }));
                          }}
                          data-testid="button-toggle-all-states"
                        >
                          {newSourceForm.geographyStates.length === US_STATES.length ? "Deselect All" : "Select All"}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[40px] max-h-[120px] overflow-y-auto">
                        {US_STATES.map(state => (
                          <Badge
                            key={state}
                            variant={newSourceForm.geographyStates.includes(state) ? "default" : "outline"}
                            className="cursor-pointer text-xs"
                            onClick={() => {
                              setNewSourceForm(prev => ({
                                ...prev,
                                geographyStates: prev.geographyStates.includes(state)
                                  ? prev.geographyStates.filter(s => s !== state)
                                  : [...prev.geographyStates, state]
                              }));
                            }}
                            data-testid={`badge-state-${state}`}
                          >
                            {state}
                          </Badge>
                        ))}
                      </div>
                      {newSourceForm.geographyStates.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {newSourceForm.geographyStates.length === US_STATES.length 
                            ? "All states selected" 
                            : `Selected (${newSourceForm.geographyStates.length}): ${newSourceForm.geographyStates.slice(0, 10).join(", ")}${newSourceForm.geographyStates.length > 10 ? "..." : ""}`}
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="h-auto p-0 ml-2 text-xs"
                            onClick={() => setNewSourceForm(prev => ({ ...prev, geographyStates: [] }))}
                          >
                            Clear
                          </Button>
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Min Price ($)</Label>
                        <Input
                          type="number"
                          placeholder="No limit"
                          value={newSourceForm.minPrice}
                          onChange={(e) => setNewSourceForm(prev => ({ ...prev, minPrice: e.target.value }))}
                          data-testid="input-min-price"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Max Price ($)</Label>
                        <Input
                          type="number"
                          placeholder="No limit"
                          value={newSourceForm.maxPrice}
                          onChange={(e) => setNewSourceForm(prev => ({ ...prev, maxPrice: e.target.value }))}
                          data-testid="input-max-price"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Min Slips</Label>
                        <Input
                          type="number"
                          placeholder="No limit"
                          value={newSourceForm.minSlips}
                          onChange={(e) => setNewSourceForm(prev => ({ ...prev, minSlips: e.target.value }))}
                          data-testid="input-min-slips"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Max Slips</Label>
                        <Input
                          type="number"
                          placeholder="No limit"
                          value={newSourceForm.maxSlips}
                          onChange={(e) => setNewSourceForm(prev => ({ ...prev, maxSlips: e.target.value }))}
                          data-testid="input-max-slips"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Polling Interval (minutes)</Label>
                      <Select
                        value={newSourceForm.pollingIntervalMinutes}
                        onValueChange={(value) => setNewSourceForm(prev => ({ ...prev, pollingIntervalMinutes: value }))}
                      >
                        <SelectTrigger className="w-48" data-testid="select-polling-interval">
                          <SelectValue placeholder="Select interval" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">Every 15 minutes</SelectItem>
                          <SelectItem value="30">Every 30 minutes</SelectItem>
                          <SelectItem value="60">Hourly</SelectItem>
                          <SelectItem value="360">Every 6 hours</SelectItem>
                          <SelectItem value="1440">Daily</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="default"
                      onClick={() => addSourceMutation.mutate(newSourceForm)}
                      disabled={
                        addSourceMutation.isPending || 
                        !newSourceForm.platform || 
                        !newSourceForm.name || 
                        !newSourceForm.searchUrl
                      }
                      data-testid="button-add-source"
                    >
                      {addSourceMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Source
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Edit Source Dialog */}
      <Dialog open={!!editingSource} onOpenChange={(open) => !open && setEditingSource(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Source Configuration</DialogTitle>
            <DialogDescription>
              Modify the settings for this listing source. Changes will apply on the next sync.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Input
                  value={editSourceForm.platform}
                  onChange={(e) => setEditSourceForm(prev => ({ ...prev, platform: e.target.value }))}
                  data-testid="input-edit-source-platform"
                />
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={editSourceForm.name}
                  onChange={(e) => setEditSourceForm(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-edit-source-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Search URL</Label>
              <Input
                value={editSourceForm.searchUrl}
                onChange={(e) => setEditSourceForm(prev => ({ ...prev, searchUrl: e.target.value }))}
                placeholder="https://example.com/search"
                data-testid="input-edit-source-url"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ingestion Method</Label>
                <Select
                  value={editSourceForm.ingestionMethod}
                  onValueChange={(value) => setEditSourceForm(prev => ({ ...prev, ingestionMethod: value }))}
                >
                  <SelectTrigger data-testid="select-edit-ingestion-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scraping">Web Scraping</SelectItem>
                    <SelectItem value="api">API Access</SelectItem>
                    <SelectItem value="rss">RSS Feed</SelectItem>
                    <SelectItem value="manual">Manual Import</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Property Type</Label>
                <Select
                  value={editSourceForm.propertyType}
                  onValueChange={(value) => setEditSourceForm(prev => ({ ...prev, propertyType: value }))}
                >
                  <SelectTrigger data-testid="select-edit-property-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marina">Marina</SelectItem>
                    <SelectItem value="boatyard">Boatyard</SelectItem>
                    <SelectItem value="yacht_club">Yacht Club</SelectItem>
                    <SelectItem value="waterfront">Waterfront Property</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Keywords to Include (comma-separated)</Label>
              <Input
                value={editSourceForm.keywordsInclude}
                onChange={(e) => setEditSourceForm(prev => ({ ...prev, keywordsInclude: e.target.value }))}
                placeholder="marina, boatyard, yacht club..."
                data-testid="input-edit-keywords-include"
              />
            </div>

            <div className="space-y-2">
              <Label>Keywords to Exclude (comma-separated)</Label>
              <Input
                value={editSourceForm.keywordsExclude}
                onChange={(e) => setEditSourceForm(prev => ({ ...prev, keywordsExclude: e.target.value }))}
                placeholder="rv storage, warehouse..."
                data-testid="input-edit-keywords-exclude"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>States to Monitor</Label>
                <Button
                  type="button"
                  variant={editSourceForm.geographyStates.length === US_STATES.length ? "default" : "outline"}
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => {
                    setEditSourceForm(prev => ({
                      ...prev,
                      geographyStates: prev.geographyStates.length === US_STATES.length ? [] : [...US_STATES]
                    }));
                  }}
                  data-testid="button-edit-toggle-all-states"
                >
                  {editSourceForm.geographyStates.length === US_STATES.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[40px] max-h-[120px] overflow-y-auto">
                {US_STATES.map(state => (
                  <Badge
                    key={state}
                    variant={editSourceForm.geographyStates.includes(state) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      setEditSourceForm(prev => ({
                        ...prev,
                        geographyStates: prev.geographyStates.includes(state)
                          ? prev.geographyStates.filter(s => s !== state)
                          : [...prev.geographyStates, state]
                      }));
                    }}
                    data-testid={`badge-edit-state-${state}`}
                  >
                    {state}
                  </Badge>
                ))}
              </div>
              {editSourceForm.geographyStates.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {editSourceForm.geographyStates.length === US_STATES.length 
                    ? "All states selected" 
                    : `Selected (${editSourceForm.geographyStates.length}): ${editSourceForm.geographyStates.slice(0, 10).join(", ")}${editSourceForm.geographyStates.length > 10 ? "..." : ""}`}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Min Price ($)</Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={editSourceForm.minPrice}
                  onChange={(e) => setEditSourceForm(prev => ({ ...prev, minPrice: e.target.value }))}
                  data-testid="input-edit-min-price"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Price ($)</Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={editSourceForm.maxPrice}
                  onChange={(e) => setEditSourceForm(prev => ({ ...prev, maxPrice: e.target.value }))}
                  data-testid="input-edit-max-price"
                />
              </div>
              <div className="space-y-2">
                <Label>Min Slips</Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={editSourceForm.minSlips}
                  onChange={(e) => setEditSourceForm(prev => ({ ...prev, minSlips: e.target.value }))}
                  data-testid="input-edit-min-slips"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Slips</Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={editSourceForm.maxSlips}
                  onChange={(e) => setEditSourceForm(prev => ({ ...prev, maxSlips: e.target.value }))}
                  data-testid="input-edit-max-slips"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Polling Interval</Label>
              <Select
                value={editSourceForm.pollingIntervalMinutes}
                onValueChange={(value) => setEditSourceForm(prev => ({ ...prev, pollingIntervalMinutes: value }))}
              >
                <SelectTrigger className="w-48" data-testid="select-edit-polling-interval">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Hourly</SelectItem>
                  <SelectItem value="360">Every 6 hours</SelectItem>
                  <SelectItem value="1440">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="my-4" />
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">Multi-Page Crawling</h4>
                <Badge variant="outline" className="text-xs">Advanced</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure how to discover and extract listings across multiple pages on this site.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Crawl Mode</Label>
                  <Select
                    value={editSourceForm.crawlMode}
                    onValueChange={(value) => setEditSourceForm(prev => ({ ...prev, crawlMode: value }))}
                  >
                    <SelectTrigger data-testid="select-edit-crawl-mode">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single Page</SelectItem>
                      <SelectItem value="multi_seed">Multiple URLs</SelectItem>
                      <SelectItem value="pagination">Follow Pagination</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {editSourceForm.crawlMode === "single" && "Extract listings from the main URL only"}
                    {editSourceForm.crawlMode === "multi_seed" && "Extract from multiple specific URLs"}
                    {editSourceForm.crawlMode === "pagination" && "Follow Next/page links to discover more listings"}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Cost Budget (per scan)</Label>
                  <Select
                    value={editSourceForm.tokenBudgetPerRun}
                    onValueChange={(value) => setEditSourceForm(prev => ({ ...prev, tokenBudgetPerRun: value }))}
                  >
                    <SelectTrigger data-testid="select-edit-token-budget">
                      <SelectValue placeholder="Select budget" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">$0.25 (~5 pages)</SelectItem>
                      <SelectItem value="0.50">$0.50 (~10 pages)</SelectItem>
                      <SelectItem value="1.00">$1.00 (~20 pages)</SelectItem>
                      <SelectItem value="2.50">$2.50 (~50 pages)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(editSourceForm.crawlMode === "multi_seed" || editSourceForm.crawlMode === "pagination") && (
                <div className="space-y-2">
                  <Label>Additional URLs (one per line)</Label>
                  <textarea
                    className="w-full h-24 px-3 py-2 text-sm border rounded-md resize-none bg-background"
                    placeholder="https://broker-site.com/listings/florida&#10;https://broker-site.com/listings/texas&#10;https://broker-site.com/listings/california"
                    value={editSourceForm.seedUrls}
                    onChange={(e) => setEditSourceForm(prev => ({ ...prev, seedUrls: e.target.value }))}
                    data-testid="textarea-edit-seed-urls"
                  />
                  <p className="text-xs text-muted-foreground">
                    Add specific listing pages to scrape. Each URL will be processed by the AI extractor.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Pages per Scan</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={editSourceForm.maxPagesPerRun}
                    onChange={(e) => setEditSourceForm(prev => ({ ...prev, maxPagesPerRun: e.target.value }))}
                    data-testid="input-edit-max-pages"
                  />
                </div>
                
                {editSourceForm.crawlMode === "pagination" && (
                  <div className="space-y-2">
                    <Label>Pagination Selector (CSS)</Label>
                    <Input
                      placeholder="a.next-page, .pagination a[rel='next']"
                      value={editSourceForm.paginationSelector}
                      onChange={(e) => setEditSourceForm(prev => ({ ...prev, paginationSelector: e.target.value }))}
                      data-testid="input-edit-pagination-selector"
                    />
                    <p className="text-xs text-muted-foreground">
                      CSS selector for the "Next" button/link
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setEditingSource(null)}
                data-testid="button-cancel-edit-source"
              >
                Cancel
              </Button>
              <Button
                onClick={() => editingSource && editSourceMutation.mutate({ id: editingSource.id, data: editSourceForm, originalSource: editingSource })}
                disabled={editSourceMutation.isPending || !editSourceForm.platform || !editSourceForm.name}
                data-testid="button-save-source"
              >
                {editSourceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                AI-matched marina listings from broker submissions and verified sources
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
            
            <Select value={stateFilter} onValueChange={(value) => {
              setStateFilter(value);
              setCityFilter("all");
            }}>
              <SelectTrigger className="w-[120px]" data-testid="select-state-filter">
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

            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-city-filter">
                <Building className="h-4 w-4 mr-2" />
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {uniqueCities.map(city => (
                  <SelectItem key={city} value={city!}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[130px]" data-testid="select-source-filter">
                <Globe className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map(source => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]" data-testid="select-status-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={minScoreFilter} onValueChange={setMinScoreFilter}>
              <SelectTrigger className="w-[130px]" data-testid="select-score-filter">
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

            <Button 
              variant="default"
              onClick={() => setBrokerSubmitOpen(true)}
              data-testid="button-submit-listing"
            >
              <Plus className="h-4 w-4 mr-2" />
              Submit Listing
            </Button>
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
              {syncStatus?.isScraping ? (
                <>
                  <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
                  <p className="text-lg font-medium">Syncing Listings...</p>
                  <p className="text-muted-foreground">
                    Aggregating marina listings from LoopNet, Crexi, CoStar, and broker networks
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>This may take a moment...</span>
                  </div>
                </>
              ) : listings?.length === 0 && !searchTerm && stateFilter === "all" && sourceFilter === "all" ? (
                <>
                  <Anchor className="h-16 w-16 mx-auto text-primary/30 mb-6" />
                  <p className="text-xl font-semibold mb-2">Build Your Marina Deal Pipeline</p>
                  <p className="text-muted-foreground max-w-lg mx-auto mb-2">
                    Your broker network is your best source for off-market marina deals. Start by connecting 
                    with marina brokers who can submit deals directly to your pipeline.
                  </p>
                  
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    <div className="p-6 bg-primary/5 rounded-lg border-2 border-dashed border-primary/30">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Plus className="h-5 w-5 text-primary" />
                        </div>
                        <h4 className="font-semibold">Quick Submit</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Got a deal from a broker? Submit it directly to add it to your pipeline.
                      </p>
                      <Button 
                        variant="default"
                        onClick={() => setBrokerSubmitOpen(true)}
                        className="w-full"
                        data-testid="button-submit-listing-cta"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Submit Listing
                      </Button>
                    </div>

                    <div className="p-6 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                          <Radar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h4 className="font-semibold">Broker Network</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        Build your broker relationships and let them submit deals via shareable portal links.
                      </p>
                      <Button 
                        variant="outline"
                        onClick={onNavigateToBrokers}
                        className="w-full"
                        data-testid="button-go-to-brokers"
                      >
                        <Radar className="h-4 w-4 mr-2" />
                        Manage Brokers
                      </Button>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-muted/50 rounded-lg max-w-xl mx-auto">
                    <p className="text-xs text-muted-foreground">
                      <strong>Note:</strong> Major CRE platforms (LoopNet, Crexi, CoStar) require API partnerships. 
                      Your broker network provides the fastest path to quality off-market deal flow.
                    </p>
                  </div>
                  
                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={() => triggerScrapeMutation.mutate()}
                      disabled={triggerScrapeMutation.isPending || syncStatus?.isScraping}
                      data-testid="button-trigger-sync"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${triggerScrapeMutation.isPending || syncStatus?.isScraping ? 'animate-spin' : ''}`} />
                      {syncStatus?.isScraping ? 'Checking...' : 'Check Platform Sources'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Anchor className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No listings match your filters</p>
                  <p className="text-muted-foreground">
                    Try adjusting your search or filter criteria
                  </p>
                  <Button 
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setSearchTerm("");
                      setStateFilter("all");
                      setCityFilter("all");
                      setSourceFilter("all");
                      setStatusFilter("all");
                      setMinScoreFilter("0");
                    }}
                    data-testid="button-clear-filters"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Clear All Filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="border rounded-lg overflow-hidden hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedListing(listing)}
                    data-testid={`listing-card-${listing.id}`}
                  >
                    <div className="flex">
                      {/* Hero Image Section */}
                      <div className="w-40 h-32 flex-shrink-0 bg-muted relative">
                        {listing.heroImageUrl ? (
                          <img 
                            src={listing.heroImageUrl} 
                            alt={listing.propertyName || listing.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                              const placeholder = document.createElement('div');
                              placeholder.innerHTML = '<svg class="h-12 w-12 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                              e.currentTarget.parentElement?.appendChild(placeholder.firstChild!);
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Anchor className="h-12 w-12 text-muted-foreground/30" />
                          </div>
                        )}
                        {/* Match Score Overlay */}
                        {listing.bestMatchScore !== undefined && listing.bestMatchScore > 0 && (
                          <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold text-white shadow-lg ${getScoreColor(listing.bestMatchScore)}`}>
                            {listing.bestMatchScore}%
                          </div>
                        )}
                      </div>
                      
                      {/* Content Section */}
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-base">{listing.propertyName || listing.title}</h3>
                              <Badge variant="outline" className={`text-xs ${getSourceBadgeStyle(listing.sourcePlatform)}`}>
                                {listing.sourcePlatform}
                              </Badge>
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

                            <div className="flex flex-wrap gap-3 text-sm mb-2">
                              {listing.askingPrice && (
                                <span className="flex items-center gap-1 font-semibold text-green-600">
                                  <DollarSign className="h-4 w-4" />
                                  {formatPrice(listing.askingPrice)}
                                </span>
                              )}
                              {listing.totalSlips && (
                                <span className="flex items-center gap-1">
                                  <Anchor className="h-4 w-4 text-blue-500" />
                                  {listing.totalSlips} slips
                                  {listing.wetSlips && listing.dryStorageSpaces && (
                                    <span className="text-xs text-muted-foreground">
                                      ({listing.wetSlips} wet, {listing.dryStorageSpaces} dry)
                                    </span>
                                  )}
                                </span>
                              )}
                              {listing.pricePerSlip && (
                                <span className="text-muted-foreground">
                                  ${parseFloat(listing.pricePerSlip).toLocaleString()}/slip
                                </span>
                              )}
                              {listing.capRate && (
                                <span className="text-muted-foreground font-medium">
                                  {parseFloat(listing.capRate).toFixed(1)}% cap
                                </span>
                              )}
                              {listing.occupancyRate && (
                                <span className="text-muted-foreground">
                                  {parseFloat(listing.occupancyRate).toFixed(0)}% occupied
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {listing.hasFuel && (
                                <Badge variant="secondary" className="text-xs py-0">
                                  <Fuel className="h-3 w-3 mr-1" />
                                  Fuel
                                </Badge>
                              )}
                              {listing.hasShipStore && (
                                <Badge variant="secondary" className="text-xs py-0">
                                  <Store className="h-3 w-3 mr-1" />
                                  Store
                                </Badge>
                              )}
                              {listing.hasRestaurant && (
                                <Badge variant="secondary" className="text-xs py-0">
                                  Restaurant
                                </Badge>
                              )}
                              {listing.hasRepairShop && (
                                <Badge variant="secondary" className="text-xs py-0">
                                  <Wrench className="h-3 w-3 mr-1" />
                                  Repair
                                </Badge>
                              )}
                              {listing.hasDryStorage && (
                                <Badge variant="secondary" className="text-xs py-0">
                                  Dry Storage
                                </Badge>
                              )}
                              {listing.hasBoatRamp && (
                                <Badge variant="secondary" className="text-xs py-0">
                                  Boat Ramp
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Right side - View button and Delete */}
                          <div className="text-right flex flex-col items-end gap-2">
                            <div className="flex items-center gap-1">
                              {listing.sourceUrl?.startsWith("mailto:") ? (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-xs h-7"
                                  asChild
                                  data-testid={`button-contact-broker-${listing.id}`}
                                >
                                  <a 
                                    href={listing.sourceUrl} 
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Mail className="h-3 w-3 mr-1" />
                                    Contact Broker
                                  </a>
                                </Button>
                              ) : listing.sourceUrl?.startsWith("#") || !listing.sourceUrl ? (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-xs h-7"
                                  disabled
                                  data-testid={`button-direct-listing-${listing.id}`}
                                >
                                  <Anchor className="h-3 w-3 mr-1" />
                                  Direct Listing
                                </Button>
                              ) : (
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
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Are you sure you want to delete this listing?")) {
                                    deleteListingMutation.mutate(listing.id);
                                  }
                                }}
                                disabled={deleteListingMutation.isPending}
                                data-testid={`button-delete-listing-${listing.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
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
                    {selectedListing.sourceUrl?.startsWith("mailto:") ? (
                      <Button 
                        className="shrink-0" 
                        asChild
                        data-testid="button-contact-broker-modal"
                      >
                        <a href={selectedListing.sourceUrl}>
                          <Mail className="h-4 w-4 mr-2" />
                          Contact Broker
                        </a>
                      </Button>
                    ) : selectedListing.sourceUrl?.startsWith("#") || !selectedListing.sourceUrl ? (
                      <Button 
                        className="shrink-0" 
                        disabled
                        data-testid="button-direct-listing-modal"
                      >
                        <Anchor className="h-4 w-4 mr-2" />
                        Direct Listing
                      </Button>
                    ) : (
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
                    )}
                  </div>
                  
                  <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Disclaimer:</span> This listing information is aggregated from {selectedListing.sourcePlatform} for informational purposes only. MarinaMatch does not own this listing and makes no representations about its accuracy, completeness, or availability. Contact the listing broker for verified information before making any investment decisions.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex justify-between items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this listing? This cannot be undone.")) {
                          deleteListingMutation.mutate(selectedListing.id);
                        }
                      }}
                      disabled={deleteListingMutation.isPending}
                      data-testid="button-delete-listing-dialog"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {deleteListingMutation.isPending ? "Deleting..." : "Delete Listing"}
                    </Button>
                    
                    {selectedListing.sourceUrl && !selectedListing.sourceUrl.startsWith("#") && !selectedListing.sourceUrl.startsWith("mailto:") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-amber-600"
                        onClick={() => {
                          const subject = encodeURIComponent(`Broken Link Report: ${selectedListing.title}`);
                          const body = encodeURIComponent(
                            `Listing Title: ${selectedListing.title}\n` +
                            `Listing ID: ${selectedListing.id}\n` +
                            `Source: ${selectedListing.sourcePlatform}\n` +
                            `URL: ${selectedListing.sourceUrl}\n\n` +
                            `Issue: [Please describe the issue with this link]\n`
                          );
                          window.location.href = `mailto:support@marinamatch.com?subject=${subject}&body=${body}`;
                          toast({
                            title: "Report sent",
                            description: "Thank you for reporting this issue. We'll review the listing.",
                          });
                        }}
                        data-testid="button-report-broken-link"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Report Broken Link
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Broker Direct Submit Dialog */}
      <Dialog open={brokerSubmitOpen} onOpenChange={setBrokerSubmitOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Marina Listing</DialogTitle>
            <DialogDescription>
              Brokers can directly submit marina listings to MarinaMatch. Your listing will be matched against buyer criteria and displayed with proper attribution.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Listing Title *</Label>
                <Input
                  value={brokerForm.title}
                  onChange={(e) => setBrokerForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Premier Gulf Coast Marina - 150 Slips"
                  data-testid="input-broker-title"
                />
              </div>

              <div className="space-y-2">
                <Label>Marina Name</Label>
                <Input
                  value={brokerForm.propertyName}
                  onChange={(e) => setBrokerForm(prev => ({ ...prev, propertyName: e.target.value }))}
                  placeholder="Official marina name"
                  data-testid="input-broker-property-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Property Address</Label>
                <Input
                  value={brokerForm.propertyAddress}
                  onChange={(e) => setBrokerForm(prev => ({ ...prev, propertyAddress: e.target.value }))}
                  placeholder="Street address"
                  data-testid="input-broker-address"
                />
              </div>

              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={brokerForm.city}
                  onChange={(e) => setBrokerForm(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="City"
                  data-testid="input-broker-city"
                />
              </div>

              <div className="space-y-2">
                <Label>State</Label>
                <Select
                  value={brokerForm.state}
                  onValueChange={(value) => setBrokerForm(prev => ({ ...prev, state: value }))}
                >
                  <SelectTrigger data-testid="select-broker-state">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>ZIP Code</Label>
                <Input
                  value={brokerForm.zipCode}
                  onChange={(e) => setBrokerForm(prev => ({ ...prev, zipCode: e.target.value }))}
                  placeholder="ZIP Code"
                  data-testid="input-broker-zip"
                />
              </div>

              <div className="space-y-2">
                <Label>Asking Price</Label>
                <Input
                  value={brokerForm.askingPrice}
                  onChange={(e) => setBrokerForm(prev => ({ ...prev, askingPrice: e.target.value }))}
                  placeholder="$0"
                  data-testid="input-broker-price"
                />
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3">Property Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Total Slips</Label>
                  <Input
                    type="number"
                    value={brokerForm.totalSlips}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, totalSlips: e.target.value }))}
                    placeholder="0"
                    data-testid="input-broker-total-slips"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Wet Slips</Label>
                  <Input
                    type="number"
                    value={brokerForm.wetSlips}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, wetSlips: e.target.value }))}
                    placeholder="0"
                    data-testid="input-broker-wet-slips"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Dry Storage</Label>
                  <Input
                    type="number"
                    value={brokerForm.dryStorageSpaces}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, dryStorageSpaces: e.target.value }))}
                    placeholder="0"
                    data-testid="input-broker-dry-storage"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Acreage</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={brokerForm.acreage}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, acreage: e.target.value }))}
                    placeholder="0"
                    data-testid="input-broker-acreage"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Water Frontage (ft)</Label>
                  <Input
                    type="number"
                    value={brokerForm.waterFrontage}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, waterFrontage: e.target.value }))}
                    placeholder="0"
                    data-testid="input-broker-frontage"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Marina Type</Label>
                  <Select
                    value={brokerForm.marinaType}
                    onValueChange={(value) => setBrokerForm(prev => ({ ...prev, marinaType: value }))}
                  >
                    <SelectTrigger data-testid="select-broker-marina-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="marina">Marina</SelectItem>
                      <SelectItem value="boatyard">Boatyard</SelectItem>
                      <SelectItem value="yacht_club">Yacht Club</SelectItem>
                      <SelectItem value="dry_stack">Dry Stack</SelectItem>
                      <SelectItem value="full_service">Full Service</SelectItem>
                      <SelectItem value="mixed">Mixed Use</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Deal Type</Label>
                  <Select
                    value={brokerForm.dealType}
                    onValueChange={(value) => setBrokerForm(prev => ({ ...prev, dealType: value }))}
                  >
                    <SelectTrigger data-testid="select-broker-deal-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acquisition">Acquisition</SelectItem>
                      <SelectItem value="ground_lease">Ground Lease</SelectItem>
                      <SelectItem value="sale_leaseback">Sale Leaseback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Amenities</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={brokerForm.hasFuel}
                    onCheckedChange={(checked) => setBrokerForm(prev => ({ ...prev, hasFuel: checked }))}
                    data-testid="switch-broker-fuel"
                  />
                  <Label className="flex items-center gap-1">
                    <Fuel className="h-4 w-4" /> Fuel Dock
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={brokerForm.hasShipStore}
                    onCheckedChange={(checked) => setBrokerForm(prev => ({ ...prev, hasShipStore: checked }))}
                    data-testid="switch-broker-ship-store"
                  />
                  <Label className="flex items-center gap-1">
                    <Store className="h-4 w-4" /> Ship Store
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={brokerForm.hasRepairShop}
                    onCheckedChange={(checked) => setBrokerForm(prev => ({ ...prev, hasRepairShop: checked }))}
                    data-testid="switch-broker-repair"
                  />
                  <Label className="flex items-center gap-1">
                    <Wrench className="h-4 w-4" /> Repair Shop
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={brokerForm.hasRestaurant}
                    onCheckedChange={(checked) => setBrokerForm(prev => ({ ...prev, hasRestaurant: checked }))}
                    data-testid="switch-broker-restaurant"
                  />
                  <Label>Restaurant</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={brokerForm.hasDryStorage}
                    onCheckedChange={(checked) => setBrokerForm(prev => ({ ...prev, hasDryStorage: checked }))}
                    data-testid="switch-broker-dry-storage"
                  />
                  <Label>Dry Storage</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={brokerForm.hasBoatRamp}
                    onCheckedChange={(checked) => setBrokerForm(prev => ({ ...prev, hasBoatRamp: checked }))}
                    data-testid="switch-broker-ramp"
                  />
                  <Label>Boat Ramp</Label>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3">Financial Information</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Gross Revenue</Label>
                  <Input
                    value={brokerForm.grossRevenue}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, grossRevenue: e.target.value }))}
                    placeholder="$0"
                    data-testid="input-broker-revenue"
                  />
                </div>
                <div className="space-y-2">
                  <Label>NOI</Label>
                  <Input
                    value={brokerForm.noi}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, noi: e.target.value }))}
                    placeholder="$0"
                    data-testid="input-broker-noi"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cap Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={brokerForm.capRate}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, capRate: e.target.value }))}
                    placeholder="0.0"
                    data-testid="input-broker-cap-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Occupancy (%)</Label>
                  <Input
                    type="number"
                    value={brokerForm.occupancyRate}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, occupancyRate: e.target.value }))}
                    placeholder="0"
                    data-testid="input-broker-occupancy"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-3">Broker Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Broker Name</Label>
                  <Input
                    value={brokerForm.brokerName}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, brokerName: e.target.value }))}
                    placeholder="Your name"
                    data-testid="input-broker-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Brokerage Company</Label>
                  <Input
                    value={brokerForm.brokerCompany}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, brokerCompany: e.target.value }))}
                    placeholder="Company name"
                    data-testid="input-broker-company"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={brokerForm.brokerPhone}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, brokerPhone: e.target.value }))}
                    placeholder="(555) 555-5555"
                    data-testid="input-broker-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={brokerForm.brokerEmail}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, brokerEmail: e.target.value }))}
                    placeholder="broker@company.com"
                    data-testid="input-broker-email"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Contact URL (optional)</Label>
                  <Input
                    value={brokerForm.contactUrl}
                    onChange={(e) => setBrokerForm(prev => ({ ...prev, contactUrl: e.target.value }))}
                    placeholder="https://your-listing-page.com"
                    data-testid="input-broker-contact-url"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Property Description</Label>
              <textarea
                className="w-full min-h-[100px] p-3 rounded-md border bg-background text-sm"
                value={brokerForm.originalDescription}
                onChange={(e) => setBrokerForm(prev => ({ ...prev, originalDescription: e.target.value }))}
                placeholder="Describe the marina property, its features, and investment highlights..."
                data-testid="textarea-broker-description"
              />
            </div>

            <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs">
                Your listing will be displayed with proper attribution to your brokerage. Buyers will contact you directly through the provided contact information.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setBrokerSubmitOpen(false);
                  setBrokerForm(INITIAL_BROKER_FORM);
                }}
                data-testid="button-cancel-broker-submit"
              >
                Cancel
              </Button>
              <Button
                onClick={() => brokerSubmitMutation.mutate(brokerForm)}
                disabled={brokerSubmitMutation.isPending || !brokerForm.title}
                data-testid="button-submit-broker-listing"
              >
                {brokerSubmitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Submit Listing
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
