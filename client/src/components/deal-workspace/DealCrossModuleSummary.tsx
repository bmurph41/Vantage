import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Building2, TrendingUp, DollarSign, FolderOpen, FileText, 
  CheckCircle2, AlertCircle, Clock, Link2, ArrowRight
} from "lucide-react";
import type { Deal } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

interface DealCrossModuleSummaryProps {
  deal: Deal;
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color, 
  isLoading 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number | string; 
  color: string;
  isLoading?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        {isLoading ? (
          <Skeleton className="h-5 w-12 mt-0.5" />
        ) : (
          <p className="font-semibold text-gray-900">{value}</p>
        )}
      </div>
    </div>
  );
}

function IntegrationStatus({ 
  label, 
  isLinked, 
  count, 
  icon: Icon 
}: { 
  label: string; 
  isLinked: boolean; 
  count: number; 
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {isLinked ? (
          <>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {count} linked
            </Badge>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </>
        ) : (
          <>
            <Badge variant="outline" className="text-gray-500">
              Not linked
            </Badge>
            <AlertCircle className="w-4 h-4 text-gray-400" />
          </>
        )}
      </div>
    </div>
  );
}

export default function DealCrossModuleSummary({ deal }: DealCrossModuleSummaryProps) {
  const { data: salesComps = [], isLoading: salesLoading } = useQuery({
    queryKey: [`/api/integration/deals/${deal.id}/sales-comps`],
    enabled: !!deal.id,
  });

  const { data: rateComps = [], isLoading: rateLoading } = useQuery({
    queryKey: [`/api/integration/deals/${deal.id}/rate-comps`],
    enabled: !!deal.id,
  });

  const { data: vdrFolders = [], isLoading: vdrLoading } = useQuery({
    queryKey: [`/api/integration/deals/${deal.id}/vdr-folders`],
    enabled: !!deal.id,
  });

  const { data: conversions = [], isLoading: convLoading } = useQuery({
    queryKey: [`/api/integration/deals/${deal.id}/conversions`],
    enabled: !!deal.id,
  });

  const isLoading = salesLoading || rateLoading || vdrLoading || convLoading;

  const totalLinkedItems = salesComps.length + rateComps.length + vdrFolders.length;
  const integrationScore = Math.min(100, (totalLinkedItems * 25));
  const hasActiveProject = conversions.length > 0;

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-600";
    if (score >= 50) return "text-amber-600";
    return "text-gray-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 75) return "Well Documented";
    if (score >= 50) return "Partially Documented";
    return "Needs Linking";
  };

  return (
    <Card className="border shadow-sm" data-testid="deal-cross-module-summary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blue-600" />
            Cross-Module Summary
          </CardTitle>
          <Badge 
            variant="outline" 
            className={`${getScoreColor(integrationScore)} border-current`}
          >
            {getScoreLabel(integrationScore)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={TrendingUp}
            label="Sales Comps"
            value={salesComps.length}
            color="bg-blue-500"
            isLoading={salesLoading}
          />
          <StatCard
            icon={DollarSign}
            label="Rate Comps"
            value={rateComps.length}
            color="bg-green-500"
            isLoading={rateLoading}
          />
          <StatCard
            icon={FolderOpen}
            label="VDR Folders"
            value={vdrFolders.length}
            color="bg-purple-500"
            isLoading={vdrLoading}
          />
          <StatCard
            icon={FileText}
            label="Due Diligence"
            value={conversions.length}
            color="bg-orange-500"
            isLoading={convLoading}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Integration Score</span>
            <span className={`font-semibold ${getScoreColor(integrationScore)}`}>
              {integrationScore}%
            </span>
          </div>
          <Progress value={integrationScore} className="h-2" />
          <p className="text-xs text-gray-500 mt-1">
            Link more data sources to improve deal analysis quality
          </p>
        </div>

        <div className="border rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Connection Status</h4>
          <div className="space-y-0">
            <IntegrationStatus
              label="Sales Comparables"
              isLinked={salesComps.length > 0}
              count={salesComps.length}
              icon={TrendingUp}
            />
            <IntegrationStatus
              label="Rate Comparables"
              isLinked={rateComps.length > 0}
              count={rateComps.length}
              icon={DollarSign}
            />
            <IntegrationStatus
              label="Data Room"
              isLinked={vdrFolders.length > 0}
              count={vdrFolders.length}
              icon={FolderOpen}
            />
            <IntegrationStatus
              label="Due Diligence"
              isLinked={hasActiveProject}
              count={conversions.length}
              icon={CheckCircle2}
            />
          </div>
        </div>

        {hasActiveProject && conversions[0] && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
              <ArrowRight className="w-4 h-4" />
              Active DD Project
            </div>
            <p className="text-xs text-green-600 mt-1">
              Converted on {new Date(conversions[0].convertedAt).toLocaleDateString()}
              {conversions[0].vdrFolderCreated && " • VDR folder created"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
