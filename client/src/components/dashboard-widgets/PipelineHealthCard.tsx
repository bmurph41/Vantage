import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

type Deal = {
  id: string;
  propertyName: string;
  amount: number;
  stage: string;
  status: string;
};

const STAGE_COLORS: Record<string, string> = {
  'prospecting': 'bg-gray-100 text-gray-800',
  'qualification': 'bg-blue-100 text-blue-800',
  'proposal': 'bg-yellow-100 text-yellow-800',
  'negotiation': 'bg-orange-100 text-orange-800',
  'closing': 'bg-green-100 text-green-800',
  'won': 'bg-emerald-100 text-emerald-800',
  'lost': 'bg-red-100 text-red-800',
};

export default function PipelineHealthCard() {
  const { data: deals, isLoading } = useQuery<Deal[]>({
    queryKey: ['/api/crm/deals'],
  });

  const activeDeals = deals?.filter(d => d.status !== 'won' && d.status !== 'lost') || [];
  
  const dealsByStage = activeDeals.reduce((acc, deal) => {
    const stage = deal.stage || 'unknown';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalValue = activeDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0);

  if (isLoading) {
    return (
      <Card data-testid="widget-pipeline-health">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Pipeline Health
          </CardTitle>
          <CardDescription className="text-xs">Active deals by stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-8 bg-gray-100 rounded animate-pulse" />
            <div className="h-16 bg-gray-100 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeDeals.length === 0) {
    return (
      <Card data-testid="widget-pipeline-health">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Pipeline Health
          </CardTitle>
          <CardDescription className="text-xs">Active deals by stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500 text-sm">
            No active deals in pipeline
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-pipeline-health">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Pipeline Health
        </CardTitle>
        <CardDescription className="text-xs">Active deals by stage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-2xl font-bold" data-testid="total-active-deals">
            {activeDeals.length}
          </div>
          <div className="text-xs text-gray-500">
            Total Value: ${(totalValue / 1000000).toFixed(1)}M
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(dealsByStage)
            .sort((a, b) => b[1] - a[1])
            .map(([stage, count]) => (
              <Badge
                key={stage}
                className={STAGE_COLORS[stage] || 'bg-gray-100 text-gray-800'}
                data-testid={`stage-badge-${stage}`}
              >
                <span className="capitalize">{stage}</span>: {count}
              </Badge>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
