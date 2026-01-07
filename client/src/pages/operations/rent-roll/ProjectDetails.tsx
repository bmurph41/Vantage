import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft,
  Building2, 
  Users, 
  DollarSign,
  Calendar,
  FileText,
  BarChart3,
  Settings,
  RefreshCcw,
  Download,
  Plus,
  Filter,
  TrendingUp,
  TrendingDown,
  Anchor,
  Ship,
  AlertTriangle,
  ChevronRight,
  Eye,
  Edit
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CashFlowDrawer } from "@/components/rent-roll/CashFlowDrawer";
import {
  OccupancyModal,
  RevenueModal,
  ActiveLeasesModal,
  ExpiringLeasesModal
} from "@/components/rent-roll/ExecutiveModals";

type ProjectDetails = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  status: string;
  projectType: string;
  seasonType: string;
  capacity?: number;
  targetNOI?: string;
  budgetedRevenue?: string;
  budgetedOccupancy?: string;
  budgetedExpenses?: string;
  budgetYear?: number;
  seasonStartDate?: string;
  seasonEndDate?: string;
  winterStartDate?: string;
  winterEndDate?: string;
  totalUnits: number;
  occupiedUnits: number;
  totalGrossRent: number;
  tenantCount: number;
  leaseCount: number;
};

type LeaseItem = {
  id: string;
  tenantName: string;
  slipNumber?: string;
  vesselName?: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string;
  status: string;
  storageType?: string;
};

function SummaryCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  onClick,
  loading 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: { direction: 'up' | 'down' | 'flat'; value: string };
  onClick?: () => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {Icon && (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.direction === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
            {trend.direction === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
            <span className={cn(
              "text-sm",
              trend.direction === 'up' && "text-green-600",
              trend.direction === 'down' && "text-red-600"
            )}>
              {trend.value}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ project, loading }: { project?: ProjectDetails; loading: boolean }) {
  const [occupancyModalOpen, setOccupancyModalOpen] = useState(false);
  const [revenueModalOpen, setRevenueModalOpen] = useState(false);
  const [activeLeasesModalOpen, setActiveLeasesModalOpen] = useState(false);
  const [expiringLeasesModalOpen, setExpiringLeasesModalOpen] = useState(false);
  const [cashFlowDrawerOpen, setCashFlowDrawerOpen] = useState(false);

  const occupancyRate = project && project.totalUnits > 0 
    ? ((project.occupiedUnits / project.totalUnits) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Slips"
          value={project?.totalUnits || 0}
          icon={Anchor}
          onClick={() => setOccupancyModalOpen(true)}
          loading={loading}
        />
        <SummaryCard
          title="Occupied"
          value={project?.occupiedUnits || 0}
          subtitle={`${occupancyRate.toFixed(1)}% occupancy`}
          icon={Ship}
          onClick={() => setOccupancyModalOpen(true)}
          loading={loading}
        />
        <SummaryCard
          title="Active Tenants"
          value={project?.tenantCount || 0}
          icon={Users}
          onClick={() => setActiveLeasesModalOpen(true)}
          loading={loading}
        />
        <SummaryCard
          title="Monthly Revenue"
          value={formatCurrency(project?.totalGrossRent || 0)}
          icon={DollarSign}
          onClick={() => setRevenueModalOpen(true)}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Occupancy</span>
                  <span className="text-sm text-muted-foreground">{occupancyRate.toFixed(1)}%</span>
                </div>
                <Progress value={occupancyRate} className="h-2" />
                <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                  <span>{project?.occupiedUnits || 0} occupied</span>
                  <span>{(project?.totalUnits || 0) - (project?.occupiedUnits || 0)} vacant</span>
                </div>
              </div>

              {project?.budgetedRevenue && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Revenue vs Budget</span>
                    <span className="text-sm text-muted-foreground">
                      {((project.totalGrossRent * 12 / parseFloat(project.budgetedRevenue)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((project.totalGrossRent * 12 / parseFloat(project.budgetedRevenue)) * 100, 100)} 
                    className="h-2" 
                  />
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>Actual: {formatCurrency(project.totalGrossRent * 12)}</span>
                    <span>Budget: {formatCurrency(parseFloat(project.budgetedRevenue))}</span>
                  </div>
                </div>
              )}

              {project?.targetNOI && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Target NOI</p>
                      <p className="text-lg font-bold">{formatCurrency(parseFloat(project.targetNOI))}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCashFlowDrawerOpen(true)}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Cash Flow
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => setActiveLeasesModalOpen(true)}>
              <FileText className="h-4 w-4 mr-2" />
              View Active Leases
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => setExpiringLeasesModalOpen(true)}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Expiring Leases
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => setCashFlowDrawerOpen(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              Cash Flow Analysis
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Download className="h-4 w-4 mr-2" />
              Export Report
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <OccupancyModal open={occupancyModalOpen} onOpenChange={setOccupancyModalOpen} />
      <RevenueModal open={revenueModalOpen} onOpenChange={setRevenueModalOpen} />
      <ActiveLeasesModal open={activeLeasesModalOpen} onOpenChange={setActiveLeasesModalOpen} />
      <ExpiringLeasesModal open={expiringLeasesModalOpen} onOpenChange={setExpiringLeasesModalOpen} />
      <CashFlowDrawer 
        open={cashFlowDrawerOpen} 
        onOpenChange={setCashFlowDrawerOpen}
        locationId={project?.id}
        locationName={project?.name}
      />
    </div>
  );
}

function LeasesTab({ projectId, loading }: { projectId: string; loading: boolean }) {
  const { data: leases, isLoading } = useQuery<LeaseItem[]>({
    queryKey: ['/api/rent-roll/leases', { projectId }],
    enabled: !!projectId,
  });

  if (loading || isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Leases</CardTitle>
            <CardDescription>{leases?.length || 0} total leases</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Link href="/operations/rent-roll/leases">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Lease
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Slip</TableHead>
              <TableHead>Vessel</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Monthly Rent</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!leases || leases.length === 0) ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No leases found for this project
                </TableCell>
              </TableRow>
            ) : (
              leases.map((lease) => (
                <TableRow key={lease.id}>
                  <TableCell className="font-medium">{lease.tenantName}</TableCell>
                  <TableCell>{lease.slipNumber || '-'}</TableCell>
                  <TableCell>{lease.vesselName || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{lease.storageType || 'Standard'}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(lease.monthlyRent)}
                  </TableCell>
                  <TableCell>{new Date(lease.startDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={lease.status === 'active' ? 'default' : 'secondary'}>
                      {lease.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SettingsTab({ project, loading }: { project?: ProjectDetails; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Information</CardTitle>
          <CardDescription>Basic details about this marina project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Project Code</p>
              <p className="font-medium">{project?.code || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Project Type</p>
              <p className="font-medium">{project?.projectType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Season Type</p>
              <p className="font-medium">{project?.seasonType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={project?.status === 'active' ? 'default' : 'secondary'}>
                {project?.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Capacity</p>
              <p className="font-medium">{project?.capacity || project?.totalUnits || 0} slips</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budget Year</p>
              <p className="font-medium">{project?.budgetYear || new Date().getFullYear()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {project?.seasonType === 'SEASONAL' && (
        <Card>
          <CardHeader>
            <CardTitle>Season Dates</CardTitle>
            <CardDescription>Configured operating seasons</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h4 className="font-medium mb-2">Summer Season</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Start</p>
                    <p>{project.seasonStartDate ? new Date(project.seasonStartDate).toLocaleDateString() : '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">End</p>
                    <p>{project.seasonEndDate ? new Date(project.seasonEndDate).toLocaleDateString() : '-'}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg">
                <h4 className="font-medium mb-2">Winter Season</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Start</p>
                    <p>{project.winterStartDate ? new Date(project.winterStartDate).toLocaleDateString() : '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">End</p>
                    <p>{project.winterEndDate ? new Date(project.winterEndDate).toLocaleDateString() : '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Budget Targets</CardTitle>
          <CardDescription>Financial targets for the current budget year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Budgeted Revenue</p>
              <p className="text-xl font-bold">
                {project?.budgetedRevenue ? formatCurrency(parseFloat(project.budgetedRevenue)) : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budgeted Expenses</p>
              <p className="text-xl font-bold">
                {project?.budgetedExpenses ? formatCurrency(parseFloat(project.budgetedExpenses)) : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Target NOI</p>
              <p className="text-xl font-bold">
                {project?.targetNOI ? formatCurrency(parseFloat(project.targetNOI)) : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RentRollProjectDetails() {
  const [, params] = useRoute('/operations/rent-roll/projects/:id');
  const projectId = params?.id;
  const [activeTab, setActiveTab] = useState('overview');

  const { data: project, isLoading } = useQuery<ProjectDetails>({
    queryKey: ['/api/rent-roll/projects', projectId],
    enabled: !!projectId,
  });

  const getProjectTypeLabel = (type: string) => {
    switch (type) {
      case 'OWNED': return 'Owned';
      case 'ACQUISITION': return 'Acquisition';
      case 'MANAGED': return 'Managed';
      case 'DEVELOPMENT': return 'Development';
      default: return type;
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="rent-roll-project-details">
      <div className="flex items-center gap-4">
        <Link href="/operations/rent-roll/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {isLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <>
                <h1 className="text-2xl font-bold">{project?.name}</h1>
                {project?.code && (
                  <Badge variant="outline" className="font-mono">{project.code}</Badge>
                )}
                <Badge variant="secondary">{getProjectTypeLabel(project?.projectType || '')}</Badge>
                <Badge className={cn(
                  project?.status === 'active' ? 'bg-green-500' : ''
                )}>
                  {project?.status}
                </Badge>
              </>
            )}
          </div>
          {project?.description && (
            <p className="text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="leases">
            <FileText className="h-4 w-4 mr-2" />
            Leases
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab project={project} loading={isLoading} />
        </TabsContent>

        <TabsContent value="leases" className="mt-6">
          <LeasesTab projectId={projectId || ''} loading={isLoading} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <SettingsTab project={project} loading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
