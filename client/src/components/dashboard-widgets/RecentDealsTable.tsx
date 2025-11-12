import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { format } from "date-fns";
import { FileText } from "lucide-react";

type Deal = {
  id: string;
  propertyName: string;
  amount: number;
  stage: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const STAGE_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'prospecting': 'secondary',
  'qualification': 'outline',
  'proposal': 'default',
  'negotiation': 'default',
  'closing': 'default',
  'won': 'default',
  'lost': 'destructive',
};

export default function RecentDealsTable() {
  const { data: deals, isLoading } = useQuery<Deal[]>({
    queryKey: ['/api/crm/deals'],
  });

  const recentDeals = deals
    ?.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  if (isLoading) {
    return (
      <Card data-testid="widget-recent-deals">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Recent Deals
          </CardTitle>
          <CardDescription className="text-xs">Last 10 updated deals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recentDeals || recentDeals.length === 0) {
    return (
      <Card data-testid="widget-recent-deals">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Recent Deals
          </CardTitle>
          <CardDescription className="text-xs">Last 10 updated deals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500 text-sm">
            No deals found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-recent-deals">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Recent Deals
        </CardTitle>
        <CardDescription className="text-xs">Last 10 updated deals</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {recentDeals.map((deal) => (
            <Link
              key={deal.id}
              href={`/crm/deals/${deal.id}`}
              className="block p-2 hover:bg-gray-50 rounded-lg transition-colors"
              data-testid={`deal-item-${deal.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {deal.propertyName || 'Untitled Deal'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">
                      ${(deal.amount / 1000000).toFixed(1)}M
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {format(new Date(deal.updatedAt), 'MMM d')}
                    </span>
                  </div>
                </div>
                <Badge variant={STAGE_COLORS[deal.stage] || 'outline'} className="ml-2 text-xs">
                  {deal.stage}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
