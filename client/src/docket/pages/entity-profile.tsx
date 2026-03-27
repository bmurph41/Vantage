import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Calendar, DollarSign, TrendingUp, Building2, Users, ExternalLink, BarChart3, Activity, Globe, MapPin, Download } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import ArticleCard from "../components/article-card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { exportDealsToCSV, type DealExportData } from "../lib/csv-export";
import { useToast } from "@/hooks/use-toast";

interface Entity {
  id: number;
  name: string;
  type: string;
  normalizedName: string;
  aliases: string[] | null;
  description: string | null;
  industry: string | null;
  location: string | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

interface EntityAnalytics {
  totalDeals: number;
  dealsByRole: {
    asBuyer: number;
    asSeller: number;
  };
  recentActivity: number;
  dealsByType: Array<{ type: string; count: number }>;
  geographicFocus: Array<{ region: string; count: number }>;
  avgDealSize: string | null;
}

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

interface Article {
  id: number;
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  category: string | null;
  categories: string[] | null;
  tags: string[] | null;
  summary: string | null;
  content: string | null;
  imageUrl: string | null;
  relevanceScore: number | null;
  sentiment: string | null;
  dealMetadata: any;
  geography: string[] | null;
  region: string | null;
  searchText: string;
  isBookmarked: boolean | null;
  manuallyReviewed: boolean | null;
  originalCategory: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const ENTITY_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  company: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400" },
  person: { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400" },
  location: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400" },
  asset: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400" },
};

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  ma: "M&A",
  financing: "Financing",
  partnership: "Partnership",
  asset_sale: "Asset Sale",
  other: "Other",
};

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function EntityProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dealTab, setDealTab] = useState<"all" | "buyer" | "seller">("all");

  const entityId = parseInt(id || "0", 10);

  // Read URL parameters on mount to restore tab state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "buyer" || tabParam === "seller" || tabParam === "all") {
      setDealTab(tabParam);
    }
  }, []);

  // Update URL when tab changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (dealTab && dealTab !== "all") {
      params.set("tab", dealTab);
    }
    
    const newSearch = params.toString();
    const newUrl = `/entities/${entityId}${newSearch ? `?${newSearch}` : ''}`;
    
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState({}, '', newUrl);
    }
  }, [dealTab, entityId]);

  // Fetch entity data
  const { data: entity, isLoading: entityLoading } = useQuery<Entity>({
    queryKey: ['/api/entities', entityId],
    enabled: !!user && !!entityId,
  });

  // Fetch entity analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery<EntityAnalytics>({
    queryKey: ['/api/entities', entityId, 'analytics'],
    enabled: !!user && !!entityId,
  });

  // Fetch deals based on selected tab
  const dealsRole = dealTab === "all" ? undefined : dealTab;
  const dealsQueryParams = dealsRole ? `?role=${dealsRole}` : '';
  
  const { data: deals = [], isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ['/api/entities', entityId, 'deals', dealsRole],
    queryFn: async () => {
      const res = await fetch(`/api/entities/${entityId}/deals${dealsQueryParams}`);
      if (!res.ok) throw new Error('Failed to fetch deals');
      return res.json();
    },
    enabled: !!user && !!entityId,
  });

  // Fetch related articles
  const { data: articles = [], isLoading: articlesLoading } = useQuery<Article[]>({
    queryKey: ['/api/entities', entityId, 'articles'],
    enabled: !!user && !!entityId,
  });

  const entityTypeStyle = entity ? ENTITY_TYPE_COLORS[entity.type] || ENTITY_TYPE_COLORS.company : ENTITY_TYPE_COLORS.company;

  // Export deals to CSV
  const handleExportDeals = () => {
    if (dealsLoading) {
      toast({
        variant: "destructive",
        title: "Data still loading",
        description: "Please wait for deals to finish loading before exporting.",
      });
      return;
    }

    if (!deals || deals.length === 0) {
      toast({
        variant: "destructive",
        title: "No deals to export",
        description: "There are no deals available for this entity.",
      });
      return;
    }

    // Map entity deals to export format
    const exportData: DealExportData[] = deals.map(deal => ({
      id: deal.id,
      transactionType: deal.transactionType,
      dealStatus: deal.dealStatus,
      buyer: deal.buyerEntity?.name || deal.buyer || '',
      seller: deal.sellerEntity?.name || deal.seller || '',
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

    const entityName = entity?.name || 'entity';
    const roleLabel = dealTab === "buyer" ? "buyer" : dealTab === "seller" ? "seller" : "all";
    const timestamp = format(new Date(), 'yyyy-MM-dd');
    const filename = `${entityName.replace(/\s+/g, '-').toLowerCase()}-${roleLabel}-deals-${timestamp}.csv`;

    exportDealsToCSV(exportData, filename);

    toast({
      title: "Export successful",
      description: `Exported ${deals.length} deal${deals.length !== 1 ? 's' : ''} to ${filename}`,
    });
  };

  if (entityLoading) {
    return (
      <div className="h-full bg-background overflow-auto p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
            <Skeleton className="h-8 w-64 mb-8" />
            <Skeleton className="h-12 w-96 mb-4" />
            <Skeleton className="h-24 w-full mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
        </div>
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="h-full bg-background overflow-auto p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Entity not found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  The entity you're looking for doesn't exist or has been removed
                </p>
                <Button asChild className="mt-4">
                  <Link href="/docket/m&a-spotlight">Back to M&A Spotlight</Link>
                </Button>
              </CardContent>
            </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background overflow-auto p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
          {/* Breadcrumb Navigation */}
          <Breadcrumb className="mb-6" data-testid="breadcrumb-navigation">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/docket" data-testid="link-home">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/docket/m&a-spotlight" data-testid="link-entities">Entities</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage data-testid="breadcrumb-entity-name">{entity.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Entity Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-4xl font-bold text-foreground" data-testid="text-entity-name">
                    {entity.name}
                  </h1>
                  <Badge 
                    className={`${entityTypeStyle.bg} ${entityTypeStyle.text} uppercase text-sm`}
                    data-testid="badge-entity-type"
                  >
                    {entity.type}
                  </Badge>
                </div>
                
                {entity.description && (
                  <p className="text-lg text-muted-foreground mb-2" data-testid="text-entity-description">
                    {entity.description}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {entity.industry && (
                    <div className="flex items-center gap-1" data-testid="text-entity-industry">
                      <Building2 className="h-4 w-4" />
                      <span>{entity.industry}</span>
                    </div>
                  )}
                  {entity.location && (
                    <div className="flex items-center gap-1" data-testid="text-entity-location">
                      <MapPin className="h-4 w-4" />
                      <span>{entity.location}</span>
                    </div>
                  )}
                </div>
                
                {entity.aliases && entity.aliases.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-muted-foreground">
                      Also known as: <span className="font-medium" data-testid="text-entity-aliases">{entity.aliases.join(', ')}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Analytics Cards */}
          {!analyticsLoading && analytics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
                  <CardTitle className="text-sm font-medium">As Buyer</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-buyer-deals">{analytics.dealsByRole.asBuyer}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Acquisition deals
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">As Seller</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-seller-deals">{analytics.dealsByRole.asSeller}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Divestiture deals
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-recent-activity">{analytics.recentActivity}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last 90 days
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts */}
          {!analyticsLoading && analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Transaction Type Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Transaction Type Breakdown</CardTitle>
                  <CardDescription>Distribution of deals by type</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.dealsByType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={analytics.dealsByType.map(item => ({
                            name: TRANSACTION_TYPE_LABELS[item.type] || item.type.toUpperCase(),
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
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No transaction data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Geographic Focus Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Geographic Focus</CardTitle>
                  <CardDescription>Deal distribution by region</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.geographicFocus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.geographicFocus.map(item => ({
                        region: item.region || 'Unknown',
                        count: item.count
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="region" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#0088FE" name="Deals" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No regional data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Deal History with Tabs */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Deal History</CardTitle>
                  <CardDescription>View all transactions involving this entity</CardDescription>
                </div>
                <Button 
                  onClick={handleExportDeals} 
                  disabled={dealsLoading || deals.length === 0}
                  data-testid="button-export-entity-deals"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {dealsLoading ? 'Loading...' : `Export (${deals.length})`}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={dealTab} onValueChange={(value) => setDealTab(value as "all" | "buyer" | "seller")}>
                <TabsList className="mb-6" data-testid="tabs-deals">
                  <TabsTrigger value="all" data-testid="tab-all-deals">
                    All Deals
                    {analytics && <span className="ml-2 text-xs">({analytics.totalDeals})</span>}
                  </TabsTrigger>
                  <TabsTrigger value="buyer" data-testid="tab-buyer-deals">
                    As Buyer
                    {analytics && <span className="ml-2 text-xs">({analytics.dealsByRole.asBuyer})</span>}
                  </TabsTrigger>
                  <TabsTrigger value="seller" data-testid="tab-seller-deals">
                    As Seller
                    {analytics && <span className="ml-2 text-xs">({analytics.dealsByRole.asSeller})</span>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={dealTab}>
                  {dealsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <Card key={i} className="animate-pulse">
                          <CardHeader>
                            <Skeleton className="h-6 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-1/2" />
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  ) : deals.length === 0 ? (
                    <div className="py-12 text-center">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium text-muted-foreground">No deals found</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        No transactions recorded for this entity in this category
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {deals.map((deal) => (
                        <Card 
                          key={deal.id} 
                          className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => deal.article?.url && window.open(deal.article.url, '_blank')}
                          data-testid={`card-deal-${deal.id}`}
                        >
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {deal.transactionType && (
                                    <Badge variant="default" data-testid={`badge-transaction-${deal.id}`}>
                                      {TRANSACTION_TYPE_LABELS[deal.transactionType] || deal.transactionType}
                                    </Badge>
                                  )}
                                  {deal.dealStatus && (
                                    <Badge variant="outline" data-testid={`badge-status-${deal.id}`}>
                                      {deal.dealStatus.charAt(0).toUpperCase() + deal.dealStatus.slice(1)}
                                    </Badge>
                                  )}
                                  {deal.article?.region && (
                                    <Badge variant="secondary">
                                      <Globe className="h-3 w-3 mr-1" />
                                      {deal.article.region}
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="ml-auto">
                                    {Math.round(deal.confidence * 100)}% confidence
                                  </Badge>
                                </div>
                                
                                <CardTitle className="text-xl mb-2" data-testid={`title-deal-${deal.id}`}>
                                  {deal.article?.title || "Deal Transaction"}
                                </CardTitle>
                                
                                {deal.assetDescription && (
                                  <CardDescription className="text-base mb-3" data-testid={`description-deal-${deal.id}`}>
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
                                    <p className="font-medium" data-testid={`text-buyer-${deal.id}`}>
                                      {deal.buyerEntity?.name || deal.buyer}
                                    </p>
                                    {deal.buyerEntity && deal.buyerEntity.id !== entityId && (
                                      <Link href={`/entities/${deal.buyerEntity.id}`} className="text-xs text-blue-600 hover:underline">
                                        View Profile
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {(deal.seller || deal.sellerEntity) && (
                                <div className="flex items-start gap-3">
                                  <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Seller</p>
                                    <p className="font-medium" data-testid={`text-seller-${deal.id}`}>
                                      {deal.sellerEntity?.name || deal.seller}
                                    </p>
                                    {deal.sellerEntity && deal.sellerEntity.id !== entityId && (
                                      <Link href={`/entities/${deal.sellerEntity.id}`} className="text-xs text-blue-600 hover:underline">
                                        View Profile
                                      </Link>
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
                                      <p className="font-medium" data-testid={`size-deal-${deal.id}`}>{deal.dealSize}</p>
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
                                      <p className="font-medium" data-testid={`date-deal-${deal.id}`}>{format(new Date(deal.dealDate), 'MM/dd/yyyy')}</p>
                                    </div>
                                  </div>
                                )}
                                
                                {deal.closingDate && (
                                  <div className="flex items-start gap-3">
                                    <Calendar className="h-5 w-5 text-green-600 mt-0.5" />
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Closing Date</p>
                                      <p className="font-medium">{format(new Date(deal.closingDate), 'MM/dd/yyyy')}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Source Article Link */}
                            {deal.article && (
                              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-muted-foreground mb-1">Source Article</p>
                                  <p className="text-sm text-foreground">{deal.article.source}</p>
                                  {deal.article.publishedAt && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {formatDistanceToNow(new Date(deal.article.publishedAt), { addSuffix: true })}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(deal.article!.url, '_blank');
                                  }}
                                  data-testid={`button-view-article-${deal.id}`}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  View Article
                                </Button>
                              </div>
                            )}
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Related Articles Feed */}
          <Card>
            <CardHeader>
              <CardTitle>Related Articles</CardTitle>
              <CardDescription>Articles mentioning this entity</CardDescription>
            </CardHeader>
            <CardContent>
              {articlesLoading ? (
                <div className="grid grid-cols-1 gap-6">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader>
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-20 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : articles.length === 0 ? (
                <div className="py-12 text-center">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No articles found</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    No articles mention this entity yet
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {articles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
