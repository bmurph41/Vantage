import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, DollarSign, TrendingUp, Building2, Users, ExternalLink, Filter, X, BarChart3, Activity, Globe, Download, Share2 } from "lucide-react";
import { format, parse } from "date-fns";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { exportDealsToCSV, type DealExportData } from "../lib/csv-export";
import { useToast } from "@/hooks/use-toast";

interface Deal {
  id: number;
  articleId: number;
  transactionType: string | null;
  dealStatus: string | null;
  buyer: string | null;
  seller: string | null;
  assetDescription: string | null;
  dealSize: string | null;
  valuation: string | null;
  equityStake: string | null;
  dealDate: string | null;
  closingDate: string | null;
  buyerEntityId: number | null;
  sellerEntityId: number | null;
  confidence: number;
  extractedAt: string;
  article: {
    id: number;
    title: string;
    url: string;
    source: string;
    publishedAt: string | null;
    categories: string[];
    geography: string | null;
    region: string | null;
  } | null;
  buyerEntity: {
    id: number;
    name: string;
    type: string;
  } | null;
  sellerEntity: {
    id: number;
    name: string;
    type: string;
  } | null;
}

interface DealsResponse {
  deals: Deal[];
  total: number;
}

interface DealAnalytics {
  totalDeals: number;
  dealsByType: Array<{ type: string; count: number }>;
  dealsByStatus: Array<{ status: string; count: number }>;
  dealsByRegion: Array<{ region: string; count: number }>;
  monthlyDeals: Array<{ month: string; count: number }>;
  recentDealsCount: number;
}

const TRANSACTION_TYPES = [
  "M&A",
  "Financing",
  "Partnership",
  "Asset Sale",
  "Lease",
  "Other"
];

const DEAL_STATUSES = [
  "Announced",
  "Pending",
  "Closed",
  "Terminated"
];

const REGIONS = [
  "US/Domestic",
  "International"
];

export default function DealsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("");
  const [limit] = useState(50);
  const [offset] = useState(0);

  // Read URL parameters on mount to restore filter state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTransactionType = params.get("transactionType");
    const urlStatus = params.get("dealStatus");
    const urlRegion = params.get("region");
    
    if (urlTransactionType) setTransactionTypeFilter(urlTransactionType);
    if (urlStatus) setStatusFilter(urlStatus);
    if (urlRegion) setRegionFilter(urlRegion);
  }, []);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (transactionTypeFilter) params.set("transactionType", transactionTypeFilter);
    if (statusFilter) params.set("dealStatus", statusFilter);
    if (regionFilter) params.set("region", regionFilter);
    
    const newSearch = params.toString();
    const newUrl = `/deals${newSearch ? `?${newSearch}` : ''}`;
    
    // Only update if URL actually changed to avoid infinite loops
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [transactionTypeFilter, statusFilter, regionFilter]);

  // Build query params
  const queryParams = new URLSearchParams();
  if (transactionTypeFilter) queryParams.append("transactionType", transactionTypeFilter);
  if (statusFilter) queryParams.append("dealStatus", statusFilter);
  if (regionFilter) queryParams.append("region", regionFilter);
  queryParams.append("limit", limit.toString());
  queryParams.append("offset", offset.toString());

  const queryString = queryParams.toString();
  const apiUrl = `/api/deals${queryString ? `?${queryString}` : ''}`;

  const { data, isLoading } = useQuery<DealsResponse>({
    queryKey: [apiUrl],
    enabled: !!user,
  });

  // Build analytics query params (same filters as deals)
  const analyticsParams = new URLSearchParams();
  if (transactionTypeFilter) analyticsParams.append("transactionType", transactionTypeFilter);
  if (statusFilter) analyticsParams.append("dealStatus", statusFilter);
  if (regionFilter) analyticsParams.append("region", regionFilter);
  
  const analyticsQueryString = analyticsParams.toString();
  const analyticsUrl = `/api/deals/analytics${analyticsQueryString ? `?${analyticsQueryString}` : ''}`;

  const { data: analytics, isLoading: analyticsLoading } = useQuery<DealAnalytics>({
    queryKey: [analyticsUrl],
    enabled: !!user,
  });

  const deals = data?.deals || [];

  // Export deals to CSV
  const handleExportCSV = () => {
    if (deals.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no deals matching your current filters.",
        variant: "destructive",
      });
      return;
    }

    const exportData: DealExportData[] = deals.map(deal => ({
      id: deal.id,
      transactionType: deal.transactionType,
      dealStatus: deal.dealStatus,
      buyer: deal.buyerEntity?.name || deal.buyer,
      seller: deal.sellerEntity?.name || deal.seller,
      dealSize: deal.dealSize,
      valuation: deal.valuation,
      equityStake: deal.equityStake,
      announcedDate: deal.dealDate,
      closingDate: deal.closingDate,
      confidence: deal.confidence,
      articleTitle: deal.article?.title || null,
      articleSource: deal.article?.source || null,
      articleUrl: deal.article?.url || null,
      articlePublishedAt: deal.article?.publishedAt || null,
      region: deal.article?.region || null,
    }));

    const timestamp = format(new Date(), 'yyyy-MM-dd');
    const filename = `docktalk-deals-${timestamp}.csv`;
    exportDealsToCSV(exportData, filename);

    toast({
      title: "Export successful",
      description: `Downloaded ${deals.length} deals to ${filename}`,
    });
  };

  // Copy shareable URL to clipboard
  const handleShareURL = async () => {
    const url = window.location.href;
    
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: "Shareable URL copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the URL manually from your browser",
        variant: "destructive",
      });
    }
  };

  const handleClearFilters = () => {
    setTransactionTypeFilter("");
    setStatusFilter("");
    setRegionFilter("");
  };

  const activeFiltersCount = [transactionTypeFilter, statusFilter, regionFilter].filter(f => f).length;

  return (
    <div className="h-full bg-background overflow-auto p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2" data-testid="text-page-title">
              M&A Spotlight
            </h1>
            <p className="text-muted-foreground">
              Track consolidation, acquisitions, dispositions, and strategic transactions in the marina industry
            </p>
          </div>

          {/* Analytics Dashboard */}
          {!analyticsLoading && analytics && (
            <div className="mb-8 space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-deals">{analytics.totalDeals}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      All time transactions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-recent-deals">{analytics.recentDealsCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last 30 days
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Deal Velocity</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analytics.recentDealsCount}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Deals per month (30-day avg)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Transaction Type Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Deals by Transaction Type</CardTitle>
                    <CardDescription>Distribution of deal types</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.dealsByType.map(item => ({
                            name: item.type.toUpperCase().replace('_', ' '),
                            value: item.count
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {analytics.dealsByType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Deal Status Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Deals by Status</CardTitle>
                    <CardDescription>Current deal pipeline</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.dealsByStatus.map(item => ({
                        status: item.status.charAt(0).toUpperCase() + item.status.slice(1),
                        count: item.count
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="status" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Monthly Trends Chart */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Deal Flow Trends</CardTitle>
                    <CardDescription>Monthly deal activity (last 12 months)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analytics.monthlyDeals.map(item => ({
                        month: format(parse(item.month, 'yyyy-MM', new Date()), 'MMM yyyy'),
                        count: item.count
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} name="Deals" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mb-6">
            <Button variant="outline" onClick={handleShareURL} data-testid="button-share-url">
              <Share2 className="h-4 w-4 mr-2" />
              Share Filters
            </Button>
            <Button onClick={handleExportCSV} data-testid="button-export-csv" disabled={deals.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV ({deals.length})
            </Button>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Filters</CardTitle>
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary">{activeFiltersCount} active</Badge>
                  )}
                </div>
                {activeFiltersCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Transaction Type</label>
                  <Select value={transactionTypeFilter || undefined} onValueChange={(value) => setTransactionTypeFilter(value === "all" ? "" : value)}>
                    <SelectTrigger data-testid="select-transaction-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {TRANSACTION_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Deal Status</label>
                  <Select value={statusFilter || undefined} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
                    <SelectTrigger data-testid="select-deal-status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {DEAL_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Region</label>
                  <Select value={regionFilter || undefined} onValueChange={(value) => setRegionFilter(value === "all" ? "" : value)}>
                    <SelectTrigger data-testid="select-region">
                      <SelectValue placeholder="All regions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All regions</SelectItem>
                      {REGIONS.map(region => (
                        <SelectItem key={region} value={region}>{region}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Summary */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {deals.length} {deals.length === 1 ? 'deal' : 'deals'}
            </p>
          </div>

          {/* Deals List */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : deals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No deals found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try adjusting your filters or check back later for new deals
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {deals.map((deal) => (
                <Card key={deal.id} className="hover:shadow-md transition-shadow" data-testid={`card-deal-${deal.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {deal.transactionType && (
                            <Badge variant="default" data-testid={`badge-transaction-${deal.id}`}>
                              {deal.transactionType}
                            </Badge>
                          )}
                          {deal.dealStatus && (
                            <Badge variant="outline" data-testid={`badge-status-${deal.id}`}>
                              {deal.dealStatus}
                            </Badge>
                          )}
                          {deal.article?.region && (
                            <Badge variant="secondary">
                              {deal.article.region}
                            </Badge>
                          )}
                          <Badge variant="outline" className="ml-auto">
                            {Math.round(deal.confidence * 100)}% confidence
                          </Badge>
                        </div>
                        
                        <CardTitle className="text-xl mb-2">
                          {deal.article?.title || "Deal Transaction"}
                        </CardTitle>
                        
                        {deal.assetDescription && (
                          <CardDescription className="text-base mb-3">
                            {deal.assetDescription}
                          </CardDescription>
                        )}
                      </div>
                    </div>

                    {/* Deal Parties */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                      {(deal.buyer || deal.buyerEntity) && (
                        <div className="flex items-start gap-3">
                          <Building2 className="h-5 w-5 text-green-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Buyer</p>
                            {deal.buyerEntity ? (
                              <Link href={`/entities/${deal.buyerEntity.id}`}>
                                <span className="font-medium text-primary hover:underline cursor-pointer" data-testid={`link-buyer-${deal.id}`}>
                                  {deal.buyerEntity.name}
                                </span>
                              </Link>
                            ) : (
                              <p className="font-medium" data-testid={`text-buyer-${deal.id}`}>
                                {deal.buyer}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {(deal.seller || deal.sellerEntity) && (
                        <div className="flex items-start gap-3">
                          <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Seller</p>
                            {deal.sellerEntity ? (
                              <Link href={`/entities/${deal.sellerEntity.id}`}>
                                <span className="font-medium text-primary hover:underline cursor-pointer" data-testid={`link-seller-${deal.id}`}>
                                  {deal.sellerEntity.name}
                                </span>
                              </Link>
                            ) : (
                              <p className="font-medium" data-testid={`text-seller-${deal.id}`}>
                                {deal.seller}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Deal Financials */}
                    {(deal.dealSize || deal.valuation || deal.equityStake) && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                        {deal.dealSize && (
                          <div className="flex items-start gap-3">
                            <DollarSign className="h-5 w-5 text-emerald-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Deal Size</p>
                              <p className="font-medium">{deal.dealSize}</p>
                            </div>
                          </div>
                        )}
                        
                        {deal.valuation && (
                          <div className="flex items-start gap-3">
                            <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Valuation</p>
                              <p className="font-medium">{deal.valuation}</p>
                            </div>
                          </div>
                        )}
                        
                        {deal.equityStake && (
                          <div className="flex items-start gap-3">
                            <TrendingUp className="h-5 w-5 text-orange-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Equity Stake</p>
                              <p className="font-medium">{deal.equityStake}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Deal Dates */}
                    {(deal.dealDate || deal.closingDate) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                        {deal.dealDate && (
                          <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Deal Date</p>
                              <p className="font-medium">{format(new Date(deal.dealDate), 'MMM d, yyyy')}</p>
                            </div>
                          </div>
                        )}
                        
                        {deal.closingDate && (
                          <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Closing Date</p>
                              <p className="font-medium">{format(new Date(deal.closingDate), 'MMM d, yyyy')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Source Article */}
                    {deal.article && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Source Article</p>
                            <p className="text-sm">
                              {deal.article.source}
                              {deal.article.publishedAt && (
                                <span className="text-muted-foreground ml-2">
                                  • {format(new Date(deal.article.publishedAt), 'MMM d, yyyy')}
                                </span>
                              )}
                            </p>
                          </div>
                          <Link href={`/?article=${deal.article.id}`}>
                            <Button variant="outline" size="sm" data-testid={`button-view-article-${deal.id}`}>
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View Article
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
