import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Building2, 
  FileCheck, 
  Calculator, 
  Anchor,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Percent,
  Clock,
  Target,
  Download,
  Calendar,
  Mail,
  Plus,
  Trash2,
  ChevronRight,
  X,
  ArrowLeft,
  Eye,
  Ship,
  Play
} from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface UnifiedAnalytics {
  crm: {
    totalContacts: number;
    totalCompanies: number;
    totalProperties: number;
    totalDeals: number;
    dealsByStage: Record<string, number>;
    recentDeals: number;
    pipelineValue: number;
    conversionRate: number;
    wonDeals: number;
    lostDeals: number;
  };
  dueDiligence: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    projectsByStatus: Record<string, number>;
    completionRate: number;
    overdueTasks: number;
    totalTasks: number;
  };
  modeling: {
    totalProjects: number;
    recentProjects: number;
    avgPurchasePrice: number;
    avgCapRate: number;
    totalPurchaseValue: number;
  };
  operations: {
    totalRentRolls: number;
    totalUnits: number;
    occupiedUnits: number;
    occupancyRate: number;
    totalMonthlyRevenue: number;
  };
  intelligence: {
    totalArticles: number;
    recentArticles: number;
  };
  crossModule: {
    dealsWithDDProjects: number;
    dealsWithModelingProjects: number;
    propertiesWithDeals: number;
    contactsWithDeals: number;
  };
  period: string;
  lastUpdated: string;
}

interface ReportSchedule {
  id: string;
  reportType: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay: string;
  timezone: string;
  recipients: string[];
  filters: Record<string, any>;
  includeCharts: boolean;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

interface DrilldownItem {
  id: string;
  name: string;
  stage?: string;
  status?: string;
  value?: number;
  probability?: number;
  expectedCloseDate?: string;
  ddExpirationDate?: string;
  psaDate?: string;
  createdAt: string;
}

interface DrilldownState {
  type: 'deals' | 'dd-projects' | 'operations' | null;
  filter: string | null;
  label: string;
}

interface ReportPreview {
  html: string;
  data: {
    totalContacts: number;
    pipelineValue: number;
    dealsByStage: Record<string, number>;
    projectsByStatus: Record<string, number>;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function KpiCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = 'default'
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: any;
  trend?: { value: number; label: string };
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variantStyles = {
    default: 'border-l-primary',
    success: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    danger: 'border-l-red-500',
  };

  return (
    <Card className={`border-l-4 ${variantStyles[variant]}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className={`h-3 w-3 ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-xs ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

export default function UnifiedAnalytics() {
  const [period, setPeriod] = useState<string>('30d');
  const [drilldown, setDrilldown] = useState<DrilldownState>({ type: null, filter: null, label: '' });
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewScheduleId, setPreviewScheduleId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<UnifiedAnalytics>({
    queryKey: ['/api/analytics/unified', period],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/unified?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
  });

  const { data: drilldownData, isLoading: drilldownLoading } = useQuery<{ items: DrilldownItem[]; total: number }>({
    queryKey: ['/api/analytics/unified/drilldown', drilldown.type, drilldown.filter],
    queryFn: async () => {
      if (!drilldown.type) return { items: [], total: 0 };
      let endpoint = '';
      if (drilldown.type === 'deals') {
        endpoint = `/api/analytics/unified/drilldown/deals?stage=${drilldown.filter || ''}`;
      } else if (drilldown.type === 'dd-projects') {
        endpoint = `/api/analytics/unified/drilldown/dd-projects?status=${drilldown.filter || ''}`;
      } else if (drilldown.type === 'operations') {
        endpoint = `/api/analytics/unified/drilldown/operations?status=${drilldown.filter || ''}`;
      }
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch drilldown data');
      return response.json();
    },
    enabled: drilldown.type !== null,
  });

  const { data: previewData, isLoading: previewLoading } = useQuery<{ schedule: ReportSchedule; preview: ReportPreview }>({
    queryKey: ['/api/analytics/report-schedules', previewScheduleId, 'preview'],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/report-schedules/${previewScheduleId}/preview`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to fetch preview');
      return response.json();
    },
    enabled: previewScheduleId !== null && showPreviewDialog,
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<ReportSchedule[]>({
    queryKey: ['/api/analytics/report-schedules'],
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: Partial<ReportSchedule>) => {
      return apiRequest('/api/analytics/report-schedules', { method: 'POST', body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/report-schedules'] });
      setShowScheduleDialog(false);
      toast({ title: 'Schedule created', description: 'Your report schedule has been created.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create schedule', variant: 'destructive' });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/analytics/report-schedules/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/report-schedules'] });
      toast({ title: 'Schedule deleted', description: 'The report schedule has been deleted.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete schedule', variant: 'destructive' });
    },
  });

  const executeScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/analytics/report-schedules/${id}/execute`, { method: 'POST' });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/report-schedules'] });
      toast({ 
        title: 'Report triggered', 
        description: `Report "${data.schedule?.name}" execution triggered. Next run: ${data.schedule?.nextRunAt ? new Date(data.schedule.nextRunAt).toLocaleString() : 'N/A'}` 
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to execute schedule', variant: 'destructive' });
    },
  });

  const dealStageData = data?.crm.dealsByStage 
    ? Object.entries(data.crm.dealsByStage).map(([name, value]) => ({ name, value }))
    : [];

  const ddStatusData = data?.dueDiligence.projectsByStatus
    ? Object.entries(data.dueDiligence.projectsByStatus).map(([name, value]) => ({ name, value }))
    : [];

  const chartConfig = {
    deals: { label: "Deals", color: "#0088FE" },
    projects: { label: "Projects", color: "#00C49F" },
    value: { label: "Value", color: "#8884d8" },
  };

  const handleBarClick = (data: any) => {
    if (data?.activePayload?.[0]) {
      const { name } = data.activePayload[0].payload;
      setDrilldown({ type: 'deals', filter: name, label: `Deals in "${name}" Stage` });
    }
  };

  const handlePieClick = (data: any) => {
    if (data?.name) {
      setDrilldown({ type: 'dd-projects', filter: data.name, label: `DD Projects with "${data.name}" Status` });
    }
  };

  const closeDrilldown = () => {
    setDrilldown({ type: null, filter: null, label: '' });
  };

  const exportToPdf = async () => {
    setIsExporting(true);
    try {
      const pdfDoc = await PDFDocument.create();
      const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      
      const page = pdfDoc.addPage([612, 792]);
      const { height } = page.getSize();
      let yOffset = height - 50;
      
      page.drawText('Cross-Module Analytics Report', {
        x: 50,
        y: yOffset,
        size: 24,
        font: timesBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      yOffset -= 30;
      
      page.drawText(`Generated: ${new Date().toLocaleString()}`, {
        x: 50,
        y: yOffset,
        size: 10,
        font: timesRoman,
        color: rgb(0.4, 0.4, 0.4),
      });
      yOffset -= 15;
      
      page.drawText(`Period: ${period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : period === '90d' ? 'Last 90 days' : 'Year to Date'}`, {
        x: 50,
        y: yOffset,
        size: 10,
        font: timesRoman,
        color: rgb(0.4, 0.4, 0.4),
      });
      yOffset -= 40;
      
      page.drawText('Key Performance Indicators', {
        x: 50,
        y: yOffset,
        size: 16,
        font: timesBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      yOffset -= 25;
      
      const kpis = [
        { label: 'Total Pipeline Value', value: formatCurrency(data?.crm.pipelineValue || 0) },
        { label: 'Win Rate', value: formatPercent(data?.crm.conversionRate || 0) },
        { label: 'DD Completion Rate', value: formatPercent(data?.dueDiligence.completionRate || 0) },
        { label: 'Overdue Tasks', value: String(data?.dueDiligence.overdueTasks || 0) },
        { label: 'Total Contacts', value: String(data?.crm.totalContacts || 0) },
        { label: 'Total Companies', value: String(data?.crm.totalCompanies || 0) },
        { label: 'DD Projects', value: String(data?.dueDiligence.totalProjects || 0) },
        { label: 'Modeling Projects', value: String(data?.modeling.totalProjects || 0) },
        { label: 'Occupancy Rate', value: formatPercent(data?.operations.occupancyRate || 0) },
        { label: 'Monthly Revenue', value: formatCurrency(data?.operations.totalMonthlyRevenue || 0) },
      ];
      
      kpis.forEach((kpi, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = 50 + col * 270;
        const y = yOffset - row * 25;
        
        page.drawText(`${kpi.label}: `, {
          x,
          y,
          size: 11,
          font: timesRoman,
          color: rgb(0.3, 0.3, 0.3),
        });
        page.drawText(kpi.value, {
          x: x + 150,
          y,
          size: 11,
          font: timesBold,
          color: rgb(0.1, 0.1, 0.1),
        });
      });
      yOffset -= Math.ceil(kpis.length / 2) * 25 + 30;
      
      page.drawText('Deals by Stage', {
        x: 50,
        y: yOffset,
        size: 14,
        font: timesBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      yOffset -= 20;
      
      dealStageData.forEach((item, index) => {
        page.drawText(`${item.name}: ${item.value} deals`, {
          x: 60,
          y: yOffset - index * 18,
          size: 10,
          font: timesRoman,
          color: rgb(0.3, 0.3, 0.3),
        });
      });
      yOffset -= dealStageData.length * 18 + 25;
      
      page.drawText('DD Projects by Status', {
        x: 50,
        y: yOffset,
        size: 14,
        font: timesBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      yOffset -= 20;
      
      ddStatusData.forEach((item, index) => {
        page.drawText(`${item.name}: ${item.value} projects`, {
          x: 60,
          y: yOffset - index * 18,
          size: 10,
          font: timesRoman,
          color: rgb(0.3, 0.3, 0.3),
        });
      });
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: 'PDF exported', description: 'Your analytics report has been downloaded.' });
    } catch (err) {
      console.error('PDF export error:', err);
      toast({ title: 'Export failed', description: 'Failed to generate PDF report', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateSchedule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const recipients = (formData.get('recipients') as string).split(',').map(s => s.trim()).filter(Boolean);
    
    createScheduleMutation.mutate({
      name: formData.get('name') as string,
      reportType: 'unified',
      frequency: formData.get('frequency') as 'daily' | 'weekly' | 'monthly',
      dayOfWeek: formData.get('dayOfWeek') ? Number(formData.get('dayOfWeek')) : undefined,
      dayOfMonth: formData.get('dayOfMonth') ? Number(formData.get('dayOfMonth')) : undefined,
      timeOfDay: formData.get('timeOfDay') as string || '09:00:00',
      timezone: 'America/New_York',
      recipients,
      filters: { period },
      includeCharts: formData.get('includeCharts') === 'on',
      isActive: true,
    });
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load analytics data</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (drilldown.type) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={closeDrilldown} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Analytics Dashboard
          </button>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">{drilldown.label}</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{drilldown.label}</h1>
            <p className="text-muted-foreground">
              {drilldownData?.total || 0} {drilldown.type === 'deals' ? 'deals' : 'projects'} found
            </p>
          </div>
          <Button variant="outline" onClick={closeDrilldown}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {drilldownLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    {drilldown.type === 'deals' && (
                      <>
                        <TableHead>Stage</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Probability</TableHead>
                        <TableHead>Expected Close</TableHead>
                      </>
                    )}
                    {drilldown.type === 'dd-projects' && (
                      <>
                        <TableHead>Status</TableHead>
                        <TableHead>DD Expiration</TableHead>
                        <TableHead>PSA Date</TableHead>
                      </>
                    )}
                    {drilldown.type === 'operations' && (
                      <>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Monthly Rate</TableHead>
                        <TableHead>Lease End</TableHead>
                      </>
                    )}
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldownData?.items.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      {drilldown.type === 'deals' && (
                        <>
                          <TableCell>
                            <Badge variant="outline">{item.stage}</Badge>
                          </TableCell>
                          <TableCell>{item.value ? formatCurrency(item.value) : '-'}</TableCell>
                          <TableCell>{item.probability ? `${item.probability}%` : '-'}</TableCell>
                          <TableCell>{item.expectedCloseDate ? new Date(item.expectedCloseDate).toLocaleDateString() : '-'}</TableCell>
                        </>
                      )}
                      {drilldown.type === 'dd-projects' && (
                        <>
                          <TableCell>
                            <Badge variant="outline">{item.status}</Badge>
                          </TableCell>
                          <TableCell>{item.ddExpirationDate ? new Date(item.ddExpirationDate).toLocaleDateString() : '-'}</TableCell>
                          <TableCell>{item.psaDate ? new Date(item.psaDate).toLocaleDateString() : '-'}</TableCell>
                        </>
                      )}
                      {drilldown.type === 'operations' && (
                        <>
                          <TableCell>
                            <Badge variant="outline">{item.status || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell>{item.entryType || '-'}</TableCell>
                          <TableCell>{item.value ? formatCurrency(item.value) : '-'}</TableCell>
                          <TableCell>{item.leaseEndDate ? new Date(item.leaseEndDate).toLocaleDateString() : '-'}</TableCell>
                        </>
                      )}
                      <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {(!drilldownData?.items || drilldownData.items.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={drilldown.type === 'deals' ? 6 : drilldown.type === 'operations' ? 6 : 5} className="text-center text-muted-foreground py-8">
                        No {drilldown.type === 'deals' ? 'deals' : drilldown.type === 'operations' ? 'entries' : 'projects'} found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" ref={dashboardRef}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cross-Module Analytics</h1>
          <p className="text-muted-foreground">
            Unified view of CRM, Due Diligence, Modeling, and Operations metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={exportToPdf} disabled={isExporting || isLoading}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
          
          <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Report
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule Report</DialogTitle>
                <DialogDescription>
                  Set up automated email delivery of this analytics report
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSchedule} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Report Name</Label>
                  <Input id="name" name="name" placeholder="Weekly Analytics Summary" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select name="frequency" defaultValue="weekly">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dayOfWeek">Day of Week (for weekly)</Label>
                  <Select name="dayOfWeek" defaultValue="1">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day, i) => (
                        <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeOfDay">Time</Label>
                  <Input id="timeOfDay" name="timeOfDay" type="time" defaultValue="09:00" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipients">Recipients (comma-separated emails)</Label>
                  <Input id="recipients" name="recipients" placeholder="email@example.com, team@example.com" required />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="includeCharts" name="includeCharts" defaultChecked />
                  <Label htmlFor="includeCharts">Include charts in report</Label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowScheduleDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createScheduleMutation.isPending}>
                    {createScheduleMutation.isPending ? 'Creating...' : 'Create Schedule'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          {data?.lastUpdated && (
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Updated {new Date(data.lastUpdated).toLocaleTimeString()}
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Total Pipeline Value"
              value={formatCurrency(data?.crm.pipelineValue || 0)}
              subtitle={`${data?.crm.totalDeals || 0} active deals`}
              icon={DollarSign}
              variant="default"
            />
            <KpiCard
              title="Win Rate"
              value={formatPercent(data?.crm.conversionRate || 0)}
              subtitle={`${data?.crm.wonDeals || 0} won / ${data?.crm.lostDeals || 0} lost`}
              icon={Target}
              variant={data?.crm.conversionRate && data.crm.conversionRate > 50 ? 'success' : 'warning'}
            />
            <KpiCard
              title="DD Completion Rate"
              value={formatPercent(data?.dueDiligence.completionRate || 0)}
              subtitle={`${data?.dueDiligence.completedProjects || 0} completed projects`}
              icon={CheckCircle2}
              variant={data?.dueDiligence.completionRate && data.dueDiligence.completionRate > 70 ? 'success' : 'warning'}
            />
            <KpiCard
              title="Overdue Tasks"
              value={data?.dueDiligence.overdueTasks || 0}
              subtitle={`of ${data?.dueDiligence.totalTasks || 0} total tasks`}
              icon={AlertTriangle}
              variant={data?.dueDiligence.overdueTasks && data.dueDiligence.overdueTasks > 0 ? 'danger' : 'success'}
            />
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">
                <BarChart3 className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="crm">
                <Users className="h-4 w-4 mr-2" />
                CRM
              </TabsTrigger>
              <TabsTrigger value="dd">
                <FileCheck className="h-4 w-4 mr-2" />
                Due Diligence
              </TabsTrigger>
              <TabsTrigger value="modeling">
                <Calculator className="h-4 w-4 mr-2" />
                Modeling
              </TabsTrigger>
              <TabsTrigger value="operations">
                <Anchor className="h-4 w-4 mr-2" />
                Operations
              </TabsTrigger>
              <TabsTrigger value="schedules">
                <Mail className="h-4 w-4 mr-2" />
                Scheduled Reports
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  title="Total Contacts"
                  value={data?.crm.totalContacts || 0}
                  icon={Users}
                />
                <KpiCard
                  title="Companies"
                  value={data?.crm.totalCompanies || 0}
                  icon={Building2}
                />
                <KpiCard
                  title="DD Projects"
                  value={data?.dueDiligence.totalProjects || 0}
                  subtitle={`${data?.dueDiligence.activeProjects || 0} active`}
                  icon={FileCheck}
                />
                <KpiCard
                  title="Modeling Projects"
                  value={data?.modeling.totalProjects || 0}
                  subtitle={`${data?.modeling.recentProjects || 0} recent`}
                  icon={Calculator}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Deals by Stage</CardTitle>
                    <CardDescription>Click a bar to drill down into deals</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dealStageData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[300px]">
                        <BarChart data={dealStageData} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="value" fill="#0088FE" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No deal data available
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>DD Projects by Status</CardTitle>
                    <CardDescription>Click a segment to drill down into projects</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {ddStatusData.length > 0 ? (
                      <ChartContainer config={chartConfig} className="h-[300px]">
                        <PieChart>
                          <Pie
                            data={ddStatusData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                            onClick={handlePieClick}
                            style={{ cursor: 'pointer' }}
                          >
                            {ddStatusData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ChartContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No project data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Cross-Module Integration</CardTitle>
                  <CardDescription>How modules are connected across the platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{data?.crossModule.dealsWithDDProjects || 0}</div>
                      <div className="text-sm text-muted-foreground">Deals with DD Projects</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{data?.crossModule.dealsWithModelingProjects || 0}</div>
                      <div className="text-sm text-muted-foreground">Deals with Modeling</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{data?.crossModule.contactsWithDeals || 0}</div>
                      <div className="text-sm text-muted-foreground">Contacts with Deals</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{data?.crossModule.propertiesWithDeals || 0}</div>
                      <div className="text-sm text-muted-foreground">Properties with Deals</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="crm" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard title="Total Deals" value={data?.crm.totalDeals || 0} icon={DollarSign} />
                <KpiCard 
                  title="Pipeline Value" 
                  value={formatCurrency(data?.crm.pipelineValue || 0)} 
                  icon={TrendingUp} 
                />
                <KpiCard 
                  title="Conversion Rate" 
                  value={formatPercent(data?.crm.conversionRate || 0)} 
                  icon={Target}
                  variant={data?.crm.conversionRate && data.crm.conversionRate > 50 ? 'success' : 'warning'}
                />
                <KpiCard 
                  title="Recent Deals" 
                  value={data?.crm.recentDeals || 0} 
                  subtitle={`in last ${period}`}
                  icon={Clock} 
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <KpiCard title="Contacts" value={data?.crm.totalContacts || 0} icon={Users} />
                <KpiCard title="Companies" value={data?.crm.totalCompanies || 0} icon={Building2} />
                <KpiCard title="Properties" value={data?.crm.totalProperties || 0} icon={Building2} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Deal Pipeline</CardTitle>
                  <CardDescription>Click a bar to see deals in that stage</CardDescription>
                </CardHeader>
                <CardContent>
                  {dealStageData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[350px]">
                      <BarChart data={dealStageData} layout="vertical" onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="#0088FE" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                      No pipeline data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dd" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard 
                  title="Total Projects" 
                  value={data?.dueDiligence.totalProjects || 0} 
                  icon={FileCheck} 
                />
                <KpiCard 
                  title="Active Projects" 
                  value={data?.dueDiligence.activeProjects || 0} 
                  icon={Clock}
                  variant="default"
                />
                <KpiCard 
                  title="Completed" 
                  value={data?.dueDiligence.completedProjects || 0} 
                  icon={CheckCircle2}
                  variant="success"
                />
                <KpiCard 
                  title="Completion Rate" 
                  value={formatPercent(data?.dueDiligence.completionRate || 0)} 
                  icon={Percent}
                  variant={data?.dueDiligence.completionRate && data.dueDiligence.completionRate > 70 ? 'success' : 'warning'}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Task Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Total Tasks</span>
                        <span className="font-bold">{data?.dueDiligence.totalTasks || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-red-500 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4" />
                          Overdue Tasks
                        </span>
                        <span className="font-bold text-red-500">{data?.dueDiligence.overdueTasks || 0}</span>
                      </div>
                      {data?.dueDiligence.totalTasks && data.dueDiligence.totalTasks > 0 && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>On Track</span>
                            <span>
                              {Math.round(((data.dueDiligence.totalTasks - data.dueDiligence.overdueTasks) / data.dueDiligence.totalTasks) * 100)}%
                            </span>
                          </div>
                          <Progress 
                            value={((data.dueDiligence.totalTasks - data.dueDiligence.overdueTasks) / data.dueDiligence.totalTasks) * 100} 
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Projects by Status</CardTitle>
                    <CardDescription>Click to drill down</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {ddStatusData.length > 0 ? (
                      <div className="space-y-3">
                        {ddStatusData.map((item, index) => (
                          <button 
                            key={item.name} 
                            className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                            onClick={() => setDrilldown({ type: 'dd-projects', filter: item.name, label: `DD Projects with "${item.name}" Status` })}
                          >
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                              />
                              <span className="text-sm capitalize">{item.name.replace('_', ' ')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{item.value}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No project status data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="modeling" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard 
                  title="Total Projects" 
                  value={data?.modeling.totalProjects || 0} 
                  icon={Calculator} 
                />
                <KpiCard 
                  title="Recent Projects" 
                  value={data?.modeling.recentProjects || 0} 
                  subtitle={`in last ${period}`}
                  icon={Clock} 
                />
                <KpiCard 
                  title="Avg Purchase Price" 
                  value={formatCurrency(data?.modeling.avgPurchasePrice || 0)} 
                  icon={DollarSign} 
                />
                <KpiCard 
                  title="Avg Cap Rate" 
                  value={formatPercent(data?.modeling.avgCapRate || 0)} 
                  icon={Percent} 
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Summary</CardTitle>
                  <CardDescription>Aggregated modeling metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-6 bg-muted rounded-lg text-center">
                      <div className="text-3xl font-bold text-primary">
                        {formatCurrency(data?.modeling.totalPurchaseValue || 0)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">Total Purchase Value</div>
                    </div>
                    <div className="p-6 bg-muted rounded-lg text-center">
                      <div className="text-3xl font-bold text-primary">
                        {data?.modeling.totalProjects || 0}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">Total Projects in Pipeline</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="operations" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard 
                  title="Rent Rolls" 
                  value={data?.operations.totalRentRolls || 0} 
                  icon={Building2} 
                />
                <KpiCard 
                  title="Total Units" 
                  value={data?.operations.totalUnits || 0} 
                  subtitle={`${data?.operations.occupiedUnits || 0} occupied`}
                  icon={Anchor} 
                />
                <KpiCard 
                  title="Occupancy Rate" 
                  value={formatPercent(data?.operations.occupancyRate || 0)} 
                  icon={Percent}
                  variant={data?.operations.occupancyRate && data.operations.occupancyRate > 85 ? 'success' : 'warning'}
                />
                <KpiCard 
                  title="Monthly Revenue" 
                  value={formatCurrency(data?.operations.totalMonthlyRevenue || 0)} 
                  icon={DollarSign} 
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Units by Status</CardTitle>
                    <CardDescription>Click to drill down into unit details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <button 
                        className="w-full flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors"
                        onClick={() => setDrilldown({ type: 'operations', filter: 'active', label: 'Active (Occupied) Units' })}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className="text-sm">Active (Occupied)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{data?.operations.occupiedUnits || 0}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                      <button 
                        className="w-full flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors"
                        onClick={() => setDrilldown({ type: 'operations', filter: 'expired', label: 'Expired Leases' })}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <span className="text-sm">Expired</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{Math.max(0, (data?.operations.totalUnits || 0) - (data?.operations.occupiedUnits || 0))}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                      <button 
                        className="w-full flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors"
                        onClick={() => setDrilldown({ type: 'operations', filter: '', label: 'All Units' })}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="text-sm">View All Units</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{data?.operations.totalUnits || 0}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Occupancy Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Total Units</span>
                        <span className="font-bold">{data?.operations.totalUnits || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-600 flex items-center gap-1">
                          <Ship className="h-4 w-4" />
                          Occupied
                        </span>
                        <span className="font-bold text-green-600">{data?.operations.occupiedUnits || 0}</span>
                      </div>
                      {data?.operations.totalUnits && data.operations.totalUnits > 0 && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Occupancy Rate</span>
                            <span>{data.operations.occupancyRate.toFixed(1)}%</span>
                          </div>
                          <Progress value={data.operations.occupancyRate} />
                        </div>
                      )}
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Total Monthly Revenue</span>
                          <span className="font-bold text-primary">{formatCurrency(data?.operations.totalMonthlyRevenue || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="schedules" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Scheduled Reports</h2>
                  <p className="text-muted-foreground">Manage automated report delivery</p>
                </div>
                <Button onClick={() => setShowScheduleDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Schedule
                </Button>
              </div>

              <Card>
                <CardContent className="pt-6">
                  {schedulesLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                  ) : schedules.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Frequency</TableHead>
                          <TableHead>Next Run</TableHead>
                          <TableHead>Recipients</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schedules.map((schedule) => (
                          <TableRow key={schedule.id}>
                            <TableCell className="font-medium">{schedule.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {schedule.frequency}
                                {schedule.frequency === 'weekly' && schedule.dayOfWeek !== undefined && 
                                  ` (${DAYS_OF_WEEK[schedule.dayOfWeek]})`}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {schedule.nextRunAt 
                                ? new Date(schedule.nextRunAt).toLocaleString()
                                : '-'
                              }
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{schedule.recipients.join(', ')}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                                {schedule.isActive ? 'Active' : 'Paused'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => executeScheduleMutation.mutate(schedule.id)}
                                  disabled={executeScheduleMutation.isPending || !schedule.isActive}
                                  title="Execute Now"
                                >
                                  <Play className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setPreviewScheduleId(schedule.id);
                                    setShowPreviewDialog(true);
                                  }}
                                  title="Preview Report"
                                >
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                                  disabled={deleteScheduleMutation.isPending}
                                  title="Delete Schedule"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No scheduled reports</h3>
                      <p className="text-muted-foreground mb-4">
                        Set up automated email delivery of your analytics reports
                      </p>
                      <Button onClick={() => setShowScheduleDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Schedule
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Dialog open={showPreviewDialog} onOpenChange={(open) => {
            setShowPreviewDialog(open);
            if (!open) setPreviewScheduleId(null);
          }}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Report Preview</DialogTitle>
                <DialogDescription>
                  Preview of the scheduled report email
                </DialogDescription>
              </DialogHeader>
              {previewLoading ? (
                <div className="space-y-4 p-4">
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </div>
                  <Skeleton className="h-32 mt-4" />
                </div>
              ) : previewData ? (
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h3 className="font-semibold text-lg">{previewData.schedule.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {previewData.schedule.frequency} report • Recipients: {previewData.schedule.recipients.join(', ')}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{previewData.preview.data.totalContacts}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(previewData.preview.data.pipelineValue)}</div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Deals by Stage</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(previewData.preview.data.dealsByStage).map(([stage, count]) => (
                            <div key={stage} className="flex justify-between text-sm">
                              <span>{stage}</span>
                              <span className="font-medium">{count as number}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">DD Projects by Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(previewData.preview.data.projectsByStatus).map(([status, count]) => (
                            <div key={status} className="flex justify-between text-sm">
                              <span>{status}</span>
                              <span className="font-medium">{count as number}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="text-xs text-muted-foreground text-center pt-4 border-t">
                    Next scheduled delivery: {previewData.schedule.nextRunAt 
                      ? new Date(previewData.schedule.nextRunAt).toLocaleString() 
                      : 'Not scheduled'}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No preview data available
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
