import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { 
  Database, 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  Plus, 
  Pencil, 
  Trash2,
  Globe,
  Building,
  RefreshCw,
  Anchor,
  Radar,
  ExternalLink,
  Play,
  MapPin,
  ArrowUpDown
} from "lucide-react";

interface CuratedStats {
  salesComps: number;
  rateComps: number;
  industryStandards: number;
  globalListings: number;
  globalSources: number;
}

interface GlobalListing {
  id: string;
  title: string;
  propertyName?: string;
  city?: string;
  state?: string;
  askingPrice?: string;
  totalSlips?: number;
  sourcePlatform: string;
  sourceUrl: string;
  status: string;
  scope: string;
  requiredPack?: string;
  isCurated: boolean;
  curatedAt?: string;
  createdAt: string;
}

interface GlobalSource {
  id: string;
  platform: string;
  name: string;
  baseUrl?: string;
  searchUrl?: string;
  isActive: boolean;
  isGlobalSource: boolean;
  lastScrapeAt?: string;
  lastScrapeStatus?: string;
  lastScrapeCount?: number;
  totalListingsFound: number;
  createdAt: string;
}

interface IndustryStandard {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  region?: string;
  state?: string;
  metricValue?: string;
  metricUnit?: string;
  lowRange?: string;
  highRange?: string;
  effectiveYear?: number;
  dataSource?: string;
  requiredPack?: string;
}

const CATEGORIES = [
  { value: "occupancy", label: "Occupancy Rates" },
  { value: "revenue", label: "Revenue Metrics" },
  { value: "expenses", label: "Expense Ratios" },
  { value: "cap_rates", label: "Cap Rates" },
  { value: "valuations", label: "Valuations" },
  { value: "rates", label: "Slip/Storage Rates" },
];

const REGIONS = [
  { value: "Northeast", label: "Northeast" },
  { value: "Southeast", label: "Southeast" },
  { value: "Gulf Coast", label: "Gulf Coast" },
  { value: "Great Lakes", label: "Great Lakes" },
  { value: "Pacific", label: "Pacific" },
  { value: "National", label: "National Average" },
];

const PACKS = [
  { value: "analysis", label: "Analysis Pack" },
  { value: "analytics_pro", label: "Analytics Pro" },
  { value: "fund_management", label: "Fund Management" },
  { value: "intel", label: "MarinaMatch Intel" },
];

export default function CuratedDataDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { user } = useAuth();
  
  // Admin role check
  if (user?.role !== "owner" && !user?.isAdmin) {
    return (
      <MainLayout title="Access Denied">
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </MainLayout>
    );
  }
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStandard, setNewStandard] = useState<Partial<IndustryStandard>>({
    category: "occupancy",
    requiredPack: "analytics_pro",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<CuratedStats>({
    queryKey: ["/api/admin/curated/stats"],
  });

  const { data: standards = [], isLoading: standardsLoading, refetch: refetchStandards } = useQuery<IndustryStandard[]>({
    queryKey: ["/api/admin/curated/industry-standards"],
  });

  const { data: listingsData, isLoading: listingsLoading, refetch: refetchListings } = useQuery<{ listings: GlobalListing[]; total: number }>({
    queryKey: ["/api/admin/curated/listings"],
  });

  const { data: sources = [], isLoading: sourcesLoading, refetch: refetchSources } = useQuery<GlobalSource[]>({
    queryKey: ["/api/admin/curated/scrape-sources"],
  });

  const [showAddSourceDialog, setShowAddSourceDialog] = useState(false);
  const [newSource, setNewSource] = useState({ platform: "", name: "", searchUrl: "" });

  const createSourceMutation = useMutation({
    mutationFn: async (data: { platform: string; name: string; searchUrl: string }) => {
      return apiRequest("/api/admin/curated/scrape-sources", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/scrape-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/stats"] });
      setShowAddSourceDialog(false);
      setNewSource({ platform: "", name: "", searchUrl: "" });
      toast({ title: "Source created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating source", description: error.message, variant: "destructive" });
    },
  });

  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/curated/scrape-sources/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/scrape-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/stats"] });
      toast({ title: "Source deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting source", description: error.message, variant: "destructive" });
    },
  });

  const triggerScrapeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/curated/scrape-sources/${id}/scrape`, { method: "POST" });
    },
    onSuccess: () => {
      toast({ title: "Scrape initiated", description: "The source will be scraped in the background" });
      refetchSources();
    },
    onError: (error: Error) => {
      toast({ title: "Error triggering scrape", description: error.message, variant: "destructive" });
    },
  });

  const seedBrokerSourcesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/curated/scrape-sources/seed", { method: "POST" });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: "Broker sources seeded", 
        description: `Created ${data.created} new sources, updated ${data.updated} existing` 
      });
      refetchSources();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error seeding broker sources", description: error.message, variant: "destructive" });
    },
  });

  const demoteListingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/curated/listings/${id}/demote`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/stats"] });
      toast({ title: "Listing demoted to org-scoped" });
    },
    onError: (error: Error) => {
      toast({ title: "Error demoting listing", description: error.message, variant: "destructive" });
    },
  });

  const deleteListingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/curated/listings/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/stats"] });
      toast({ title: "Listing deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting listing", description: error.message, variant: "destructive" });
    },
  });

  const createStandardMutation = useMutation({
    mutationFn: async (data: Partial<IndustryStandard>) => {
      return apiRequest("/api/admin/curated/industry-standards", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/industry-standards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/stats"] });
      setShowAddDialog(false);
      setNewStandard({ category: "occupancy", requiredPack: "analytics_pro" });
      toast({ title: "Standard created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating standard", description: error.message, variant: "destructive" });
    },
  });

  const deleteStandardMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/admin/curated/industry-standards/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/industry-standards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/curated/stats"] });
      toast({ title: "Standard deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting standard", description: error.message, variant: "destructive" });
    },
  });

  const handleAddStandard = () => {
    if (!newStandard.name || !newStandard.category) {
      toast({ title: "Name and category are required", variant: "destructive" });
      return;
    }
    createStandardMutation.mutate(newStandard);
  };

  return (
    <MainLayout title="Curated Data Management" subtitle="Manage global benchmarks and industry standards">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="listings" className="flex items-center gap-2">
              <Anchor className="h-4 w-4" />
              Listings
            </TabsTrigger>
            <TabsTrigger value="sources" className="flex items-center gap-2">
              <Radar className="h-4 w-4" />
              Sources
            </TabsTrigger>
            <TabsTrigger value="sales-comps" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Sales Comps
            </TabsTrigger>
            <TabsTrigger value="rate-comps" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Rate Comps
            </TabsTrigger>
            <TabsTrigger value="standards" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Standards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Global Listings</CardTitle>
                  <Anchor className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.globalListings || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Curated marina listings
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Global Sources</CardTitle>
                  <Radar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.globalSources || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Active scrape sources
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Sales Comps</CardTitle>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.salesComps || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Sale transactions
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Rate Comps</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.rateComps || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Rate benchmarks
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Standards</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.industryStandards || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Industry metrics
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Data Governance Overview</CardTitle>
                <CardDescription>
                  Global curated data is maintained by MarinaMatch and made available to subscribers based on their pack subscriptions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="bg-blue-500">Global</Badge>
                    <span className="text-sm">MarinaMatch curated data - available to pack subscribers</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">Organization</Badge>
                    <span className="text-sm">Organization-specific data - visible to org members only</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">User</Badge>
                    <span className="text-sm">User-created data - private to the user</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="listings" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Global Marina Listings</CardTitle>
                  <CardDescription>
                    Curated marina listings available to all platform subscribers
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchListings()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {listingsLoading ? (
                  <div className="text-center py-8">Loading listings...</div>
                ) : !listingsData?.listings?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Anchor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No global listings yet</p>
                    <p className="text-sm">Promote listings from organization data or run scrape jobs.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Slips</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Pack</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listingsData.listings.map((listing) => (
                        <TableRow key={listing.id}>
                          <TableCell>
                            <div className="font-medium">{listing.title || listing.propertyName}</div>
                            <Badge variant={listing.status === 'active' ? 'default' : 'secondary'} className="text-xs mt-1">
                              {listing.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {listing.city}, {listing.state}
                            </div>
                          </TableCell>
                          <TableCell>
                            {listing.askingPrice ? formatCurrency(parseFloat(listing.askingPrice)) : '-'}
                          </TableCell>
                          <TableCell>{listing.totalSlips || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{listing.sourcePlatform}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{listing.requiredPack || 'analysis'}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(listing.sourceUrl, '_blank')}
                                title="View source"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => demoteListingMutation.mutate(listing.id)}
                                title="Demote to org-scoped"
                              >
                                <ArrowUpDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteListingMutation.mutate(listing.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sources" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Global Scrape Sources</CardTitle>
                  <CardDescription>
                    Broker sites and listing platforms scraped for marina listings
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => seedBrokerSourcesMutation.mutate()}
                    disabled={seedBrokerSourcesMutation.isPending}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    {seedBrokerSourcesMutation.isPending ? "Seeding..." : "Seed Marina Brokers"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => refetchSources()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Dialog open={showAddSourceDialog} onOpenChange={setShowAddSourceDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Source
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Global Scrape Source</DialogTitle>
                        <DialogDescription>
                          Add a new broker site or listing platform to scrape
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Platform Name *</Label>
                          <Input
                            placeholder="e.g., MerleMarine"
                            value={newSource.platform}
                            onChange={(e) => setNewSource({ ...newSource, platform: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Display Name *</Label>
                          <Input
                            placeholder="e.g., Merle Marine Brokerage"
                            value={newSource.name}
                            onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Search URL</Label>
                          <Input
                            placeholder="https://..."
                            value={newSource.searchUrl}
                            onChange={(e) => setNewSource({ ...newSource, searchUrl: e.target.value })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddSourceDialog(false)}>Cancel</Button>
                        <Button
                          onClick={() => createSourceMutation.mutate(newSource)}
                          disabled={!newSource.platform || !newSource.name || createSourceMutation.isPending}
                        >
                          {createSourceMutation.isPending ? "Creating..." : "Create Source"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {sourcesLoading ? (
                  <div className="text-center py-8">Loading sources...</div>
                ) : sources.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Radar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No global scrape sources yet</p>
                    <p className="text-sm">Add broker sites or listing platforms to start collecting data.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Scrape</TableHead>
                        <TableHead>Listings Found</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sources.map((source) => (
                        <TableRow key={source.id}>
                          <TableCell>
                            <div className="font-medium">{source.name}</div>
                            {source.searchUrl && (
                              <a
                                href={source.searchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:underline"
                              >
                                {new URL(source.searchUrl).hostname}
                              </a>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{source.platform}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={source.isActive ? 'default' : 'secondary'}>
                              {source.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {source.lastScrapeAt ? (
                              <div>
                                <div className="text-sm">{new Date(source.lastScrapeAt).toLocaleDateString()}</div>
                                <Badge variant={source.lastScrapeStatus === 'success' ? 'default' : 'destructive'} className="text-xs">
                                  {source.lastScrapeStatus}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>{source.totalListingsFound}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => triggerScrapeMutation.mutate(source.id)}
                                disabled={triggerScrapeMutation.isPending}
                                title="Run scrape"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteSourceMutation.mutate(source.id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales-comps" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Global Sales Comparables</CardTitle>
                  <CardDescription>
                    Curated marina sale transactions available to Analysis pack subscribers
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Sales Comp
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No global sales comps yet</p>
                  <p className="text-sm">Use the "Promote to Global" feature from existing comps or add new ones here.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rate-comps" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Global Rate Comparables</CardTitle>
                  <CardDescription>
                    Curated marina rate benchmarks available to Analysis pack subscribers
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rate Comp
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No global rate comps yet</p>
                  <p className="text-sm">Use the "Promote to Global" feature from existing comps or add new ones here.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="standards" className="space-y-6 mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Industry Standards & Benchmarks</CardTitle>
                  <CardDescription>
                    Define market benchmarks for occupancy, cap rates, revenue metrics, and more
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => refetchStandards()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Standard
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Add Industry Standard</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label>Name *</Label>
                          <Input 
                            placeholder="e.g., Average Wet Slip Occupancy"
                            value={newStandard.name || ""}
                            onChange={(e) => setNewStandard({ ...newStandard, name: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Category *</Label>
                            <Select 
                              value={newStandard.category} 
                              onValueChange={(v) => setNewStandard({ ...newStandard, category: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Region</Label>
                            <Select 
                              value={newStandard.region || ""} 
                              onValueChange={(v) => setNewStandard({ ...newStandard, region: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select region" />
                              </SelectTrigger>
                              <SelectContent>
                                {REGIONS.map((r) => (
                                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="grid gap-2">
                            <Label>Value</Label>
                            <Input 
                              type="number" 
                              placeholder="e.g., 85"
                              value={newStandard.metricValue || ""}
                              onChange={(e) => setNewStandard({ ...newStandard, metricValue: e.target.value })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Low Range</Label>
                            <Input 
                              type="number" 
                              placeholder="e.g., 75"
                              value={newStandard.lowRange || ""}
                              onChange={(e) => setNewStandard({ ...newStandard, lowRange: e.target.value })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>High Range</Label>
                            <Input 
                              type="number" 
                              placeholder="e.g., 95"
                              value={newStandard.highRange || ""}
                              onChange={(e) => setNewStandard({ ...newStandard, highRange: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Unit</Label>
                            <Select 
                              value={newStandard.metricUnit || ""} 
                              onValueChange={(v) => setNewStandard({ ...newStandard, metricUnit: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select unit" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">Percentage (%)</SelectItem>
                                <SelectItem value="dollars">Dollars ($)</SelectItem>
                                <SelectItem value="dollars_per_foot">$/Linear Foot</SelectItem>
                                <SelectItem value="dollars_per_slip">$/Slip</SelectItem>
                                <SelectItem value="multiplier">Multiplier (x)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Effective Year</Label>
                            <Input 
                              type="number" 
                              placeholder="e.g., 2025"
                              value={newStandard.effectiveYear || ""}
                              onChange={(e) => setNewStandard({ ...newStandard, effectiveYear: parseInt(e.target.value) })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="grid gap-2">
                            <Label>Data Source</Label>
                            <Input 
                              placeholder="e.g., MarinaMatch Research"
                              value={newStandard.dataSource || ""}
                              onChange={(e) => setNewStandard({ ...newStandard, dataSource: e.target.value })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Required Pack</Label>
                            <Select 
                              value={newStandard.requiredPack || ""} 
                              onValueChange={(v) => setNewStandard({ ...newStandard, requiredPack: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select pack" />
                              </SelectTrigger>
                              <SelectContent>
                                {PACKS.map((p) => (
                                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                        <Button onClick={handleAddStandard} disabled={createStandardMutation.isPending}>
                          {createStandardMutation.isPending ? "Creating..." : "Create Standard"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {standardsLoading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : standards.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No industry standards defined yet</p>
                    <p className="text-sm">Add benchmarks to help users compare their marina performance.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Region</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Range</TableHead>
                        <TableHead>Pack</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standards.map((std) => (
                        <TableRow key={std.id}>
                          <TableCell className="font-medium">{std.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{std.category}</Badge>
                          </TableCell>
                          <TableCell>{std.region || "-"}</TableCell>
                          <TableCell>
                            {std.metricValue ? `${std.metricValue}${std.metricUnit === 'percentage' ? '%' : ''}` : "-"}
                          </TableCell>
                          <TableCell>
                            {std.lowRange && std.highRange ? `${std.lowRange} - ${std.highRange}` : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{std.requiredPack || "analytics_pro"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => deleteStandardMutation.mutate(std.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
