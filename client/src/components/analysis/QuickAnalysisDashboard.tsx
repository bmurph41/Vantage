import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  Plus,
  TrendingUp,
  BarChart3,
  Download,
  DollarSign,
  Target,
  Activity,
  Clock,
  ArrowRight,
  Layers,
  MapPin,
  Maximize2,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { useDisplayMode } from '@/stores/display-mode-store';
import ModelSetupWizard from './ModelSetupWizard';

interface ProjectItem {
  id: string;
  marinaName: string;
  city: string | null;
  state: string | null;
  assetClass: string | null;
  purchasePrice: number | string | null;
  year1CapRate: number | null;
  ebitda: number | null;
  t12Ebitda: number | null;
  year1Ebitda: number | null;
  dealOutcome: string;
  uwStage: string | null;
  irr: number | null;
  updatedAt: string | Date;
  createdAt: string | Date;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectCard({ project, onClick }: { project: ProjectItem; onClick: () => void }) {
  const capRate = project.year1CapRate;
  const noi = project.year1Ebitda ?? project.t12Ebitda ?? project.ebitda;

  const outcomeColors: Record<string, string> = {
    active: 'bg-blue-100 text-blue-700',
    under_review: 'bg-amber-100 text-amber-700',
    won: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
    passed: 'bg-gray-100 text-gray-700',
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{project.marinaName}</h3>
            {(project.city || project.state) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />
                {[project.city, project.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            {project.assetClass && (
              <Badge variant="outline" className="text-[9px] capitalize px-1.5 py-0">
                {project.assetClass.replace(/_/g, ' ')}
              </Badge>
            )}
            <Badge className={`text-[9px] px-1.5 py-0 ${outcomeColors[project.dealOutcome] ?? outcomeColors.active}`}>
              {project.dealOutcome?.replace(/_/g, ' ') ?? 'Active'}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {noi != null && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">NOI</p>
              <p className="text-sm font-semibold text-green-600">
                {formatCurrency(noi, { dash: true })}
              </p>
            </div>
          )}
          {capRate != null && capRate > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cap Rate</p>
              <p className="text-sm font-semibold">{formatPercent(capRate, { dash: true })}</p>
            </div>
          )}
          {project.irr != null && project.irr !== 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">IRR</p>
              <p className={`text-sm font-semibold ${project.irr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(project.irr, { dash: true })}
              </p>
            </div>
          )}
          {project.purchasePrice != null && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Price</p>
              <p className="text-sm font-semibold">
                {formatCurrency(project.purchasePrice, { dash: true })}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    </div>
  );
}

export default function QuickAnalysisDashboard() {
  const [, navigate] = useLocation();
  const { toggleSimplifiedMode } = useDisplayMode();
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery<ProjectItem[]>({
    queryKey: ['/api/modeling/projects'],
  });

  if (isLoading) return <LoadingSkeleton />;

  // Quick stats
  const activeProjects = projects.filter((p) => p.dealOutcome === 'active' || p.dealOutcome === 'under_review');
  const totalValue = activeProjects.reduce((sum, p) => {
    const price = typeof p.purchasePrice === 'string' ? parseFloat(p.purchasePrice) : p.purchasePrice;
    return sum + (price || 0);
  }, 0);
  const capRates = projects.map((p) => p.year1CapRate).filter((c): c is number => c != null && c > 0);
  const avgCapRate = capRates.length > 0 ? capRates.reduce((a, b) => a + b, 0) / capRates.length : 0;
  const totalNoi = projects.reduce((sum, p) => sum + (p.year1Ebitda ?? p.t12Ebitda ?? p.ebitda ?? 0), 0);
  const irrs = projects.map((p) => p.irr).filter((i): i is number => i != null && i !== 0);
  const avgIrr = irrs.length > 0 ? irrs.reduce((a, b) => a + b, 0) / irrs.length : 0;

  // Recent activity: last 5 by updatedAt
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const handleProjectCreated = (projectId: string) => {
    navigate(`/modeling/projects/${projectId}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Properties</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quick overview of your portfolio and analysis models
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toggleSimplifiedMode()}>
            <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
            Advanced View
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Portfolio Value"
          value={totalValue > 0 ? formatCurrency(totalValue) : '-'}
          icon={DollarSign}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Average Cap Rate"
          value={avgCapRate > 0 ? formatPercent(avgCapRate) : '-'}
          icon={Target}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="Total NOI"
          value={totalNoi > 0 ? formatCurrency(totalNoi) : '-'}
          icon={TrendingUp}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Average IRR"
          value={avgIrr !== 0 ? formatPercent(avgIrr) : '-'}
          icon={Activity}
          color="bg-indigo-50 text-indigo-600"
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Analyze New Property
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/modeling/portfolio')}>
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              Compare Models
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/modeling/settings')}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export Portfolio Summary
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* My Properties Grid */}
      {projects.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Properties Yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Get started by analyzing your first property. Our guided wizard makes it simple to build
            a financial model in minutes.
          </p>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Analyze Your First Property
          </Button>
        </Card>
      ) : (
        <div>
          <h2 className="text-lg font-semibold mb-3">My Properties ({projects.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => navigate(`/modeling/projects/${project.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentProjects.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/modeling/projects/${project.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{project.marinaName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[project.city, project.state].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(project.updatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ModelSetupWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}
