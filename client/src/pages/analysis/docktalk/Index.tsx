import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Calendar, DollarSign, MapPin, TrendingUp, Anchor } from "lucide-react";
import type { DocktalkDeal } from "@shared/schema";
import { format } from "date-fns";

export default function DockTalkPage() {
  const [selectedOrigin, setSelectedOrigin] = useState<'all' | 'marinaMatch' | 'aiExtraction'>('marinaMatch');

  const { data, isLoading } = useQuery<{ deals: DocktalkDeal[]; total: number }>({
    queryKey: selectedOrigin === 'all' 
      ? ['/api/docktalk/deals'] 
      : ['/api/docktalk/deals', { origin: selectedOrigin }],
  });

  const deals = data?.deals || [];
  const total = data?.total || 0;

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'Undisclosed';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'MMM yyyy');
    } catch {
      return 'N/A';
    }
  };

  const getOriginBadge = (origin: string) => {
    if (origin === 'marinaMatch') {
      return (
        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700" data-testid="badge-origin-marinamatch">
          <Anchor className="w-3 h-3 mr-1" />
          MarinaMatch Sales Comp
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" data-testid="badge-origin-ai">
          <TrendingUp className="w-3 h-3 mr-1" />
          AI Discovery
        </Badge>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-docktalk">
                DockTalk M&A Spotlight
              </h1>
              <p className="text-muted-foreground mt-2">
                Marina industry transaction intelligence from verified sales and AI discoveries
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg px-4 py-2" data-testid="badge-total-deals">
                {total} {total === 1 ? 'Deal' : 'Deals'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <Tabs value={selectedOrigin} onValueChange={(v) => setSelectedOrigin(v as any)}>
          <TabsList className="mb-6" data-testid="tabs-origin-filter">
            <TabsTrigger value="marinaMatch" data-testid="tab-verified-sales">
              <Anchor className="w-4 h-4 mr-2" />
              Verified Sales
            </TabsTrigger>
            <TabsTrigger value="aiExtraction" data-testid="tab-ai-discoveries">
              <TrendingUp className="w-4 h-4 mr-2" />
              AI Discoveries
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all-deals">
              All Deals
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedOrigin} className="mt-0">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="h-3 bg-muted rounded"></div>
                      <div className="h-3 bg-muted rounded"></div>
                      <div className="h-3 bg-muted rounded w-5/6"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : deals.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Building2 className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Deals Found</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    {selectedOrigin === 'marinaMatch' 
                      ? 'Sales data from MarinaMatch Sales Comps will appear here automatically.'
                      : selectedOrigin === 'aiExtraction'
                      ? 'AI-discovered deals from news articles and market intelligence will appear here.'
                      : 'No deals have been tracked yet.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="grid-deals">
                {deals.map((deal) => (
                  <Card 
                    key={deal.id} 
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    data-testid={`card-deal-${deal.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <CardTitle className="text-lg line-clamp-1" data-testid={`text-marina-${deal.id}`}>
                          {deal.marinaName || 'Unnamed Property'}
                        </CardTitle>
                        {getOriginBadge(deal.origin)}
                      </div>
                      <CardDescription className="flex items-center gap-1" data-testid={`text-location-${deal.id}`}>
                        <MapPin className="w-3 h-3" />
                        {[deal.city, deal.state].filter(Boolean).join(', ') || deal.region || 'Location N/A'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Transaction Size */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <DollarSign className="w-4 h-4" />
                          <span>Transaction Size</span>
                        </div>
                        <span className="font-semibold" data-testid={`text-price-${deal.id}`}>
                          {formatCurrency(deal.transactionSize)}
                        </span>
                      </div>

                      {/* Deal Date */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>Deal Date</span>
                        </div>
                        <span className="font-medium" data-testid={`text-date-${deal.id}`}>
                          {formatDate(deal.dealDate)}
                        </span>
                      </div>

                      {/* Buyer / Seller */}
                      {(deal.buyer || deal.seller) && (
                        <div className="pt-2 border-t space-y-1">
                          {deal.buyer && (
                            <div className="flex items-start gap-2 text-sm">
                              <span className="text-muted-foreground min-w-[60px]">Buyer:</span>
                              <span className="font-medium line-clamp-1" data-testid={`text-buyer-${deal.id}`}>
                                {deal.buyer}
                              </span>
                            </div>
                          )}
                          {deal.seller && (
                            <div className="flex items-start gap-2 text-sm">
                              <span className="text-muted-foreground min-w-[60px]">Seller:</span>
                              <span className="font-medium line-clamp-1" data-testid={`text-seller-${deal.id}`}>
                                {deal.seller}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Capacity */}
                      {(deal.wetSlips || deal.dryRacks) && (
                        <div className="flex items-center gap-3 text-sm pt-2 border-t">
                          {deal.wetSlips && (
                            <div className="flex items-center gap-1">
                              <Anchor className="w-3 h-3 text-muted-foreground" />
                              <span data-testid={`text-wet-slips-${deal.id}`}>{deal.wetSlips} Wet</span>
                            </div>
                          )}
                          {deal.dryRacks && (
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-muted-foreground" />
                              <span data-testid={`text-dry-racks-${deal.id}`}>{deal.dryRacks} Dry</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* AI Confidence Score */}
                      {deal.origin === 'aiExtraction' && deal.confidence && (
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm text-muted-foreground">Confidence</span>
                          <Badge variant="outline" data-testid={`badge-confidence-${deal.id}`}>
                            {deal.confidence}%
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
