import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Eye,
  Loader2,
  Building2,
  MapPin,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';

interface ICMemoExportProps {
  projectId: string;
}

interface ICMemoData {
  project: {
    id: string;
    name: string;
    marinaName: string;
    city?: string;
    state?: string;
    region?: string;
    purchasePrice?: number;
    estimatedValue?: number;
    totalUnits?: number;
    acreage?: number;
    dealOutcome?: string;
    createdAt: string;
  };
  scenarios: Array<{
    id: string;
    name: string;
    scenarioType: string;
    version: number;
    status: string;
    revenueGrowthRate?: number;
    expenseGrowthRate?: number;
    exitCapRate?: number;
    approvedBy?: string;
    approvedAt?: string;
  }>;
  financials: {
    totalRevenue: number;
    totalExpenses: number;
    noi: number;
    capRate: number;
    revenueByCategory: Record<string, number>;
    expensesByCategory: Record<string, number>;
  };
  projections: {
    years: number[];
    scenarios: Record<string, {
      revenue: number[];
      expenses: number[];
      noi: number[];
      value: number[];
    }>;
  };
  approvalHistory: Array<{
    eventType: string;
    scenarioName?: string;
    userId: string;
    createdAt: string;
    notes?: string;
  }>;
  generatedAt: string;
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  approved: { icon: CheckCircle, color: 'text-green-500', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-red-500', label: 'Rejected' },
  pending_approval: { icon: Clock, color: 'text-amber-500', label: 'Pending' },
  draft: { icon: Clock, color: 'text-muted-foreground', label: 'Draft' },
};

export default function ICMemoExport({ projectId }: ICMemoExportProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: memoData, isLoading, refetch } = useQuery<ICMemoData>({
    queryKey: ['/api/modeling/projects', projectId, 'ic-memo'],
    enabled: isOpen,
  });

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(2)}%`;
  };

  const handleDownloadText = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/modeling/projects/${projectId}/ic-memo?format=text`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const filename = response.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') 
        || `IC_Memo_${new Date().toISOString().split('T')[0]}.txt`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: 'Downloaded', description: 'IC Memo has been downloaded.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to download memo.', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadJSON = async () => {
    if (!memoData) return;
    
    const blob = new Blob([JSON.stringify(memoData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IC_Memo_${memoData.project.marinaName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Project'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast({ title: 'Downloaded', description: 'IC Memo JSON has been downloaded.' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-ic-memo">
          <FileText className="h-4 w-4 mr-2" />
          IC Memo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Investment Committee Memorandum
          </DialogTitle>
          <DialogDescription>
            Generate and download a comprehensive IC memo for this project
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : memoData ? (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 py-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Property Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Property</p>
                      <p className="font-medium">{memoData.project.marinaName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-medium">
                        {[memoData.project.city, memoData.project.state].filter(Boolean).join(', ') || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Purchase Price</p>
                      <p className="font-medium">{formatCurrency(memoData.project.purchasePrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Units</p>
                      <p className="font-medium">{memoData.project.totalUnits?.toLocaleString() || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Financial Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                      <p className="text-xs text-muted-foreground">Total Revenue</p>
                      <p className="font-semibold text-green-600">{formatCurrency(memoData.financials.totalRevenue)}</p>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                      <p className="text-xs text-muted-foreground">Total Expenses</p>
                      <p className="font-semibold text-red-600">{formatCurrency(memoData.financials.totalExpenses)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <p className="text-xs text-muted-foreground">NOI</p>
                      <p className="font-semibold text-blue-600">{formatCurrency(memoData.financials.noi)}</p>
                    </div>
                    <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                      <p className="text-xs text-muted-foreground">Cap Rate</p>
                      <p className="font-semibold text-purple-600">{formatPercent(memoData.financials.capRate)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Scenario Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scenario</TableHead>
                        <TableHead className="text-center">Version</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Rev Growth</TableHead>
                        <TableHead className="text-right">Exp Growth</TableHead>
                        <TableHead className="text-right">Exit Cap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memoData.scenarios.map(scenario => {
                        const status = statusConfig[scenario.status] || statusConfig.draft;
                        const StatusIcon = status.icon;
                        return (
                          <TableRow key={scenario.id}>
                            <TableCell className="font-medium">{scenario.name}</TableCell>
                            <TableCell className="text-center">v{scenario.version}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={status.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatPercent(scenario.revenueGrowthRate)}</TableCell>
                            <TableCell className="text-right">{formatPercent(scenario.expenseGrowthRate)}</TableCell>
                            <TableCell className="text-right">{formatPercent(scenario.exitCapRate)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    5-Year Projections
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-background">Metric</TableHead>
                          {memoData.projections.years.map(year => (
                            <TableHead key={year} className="text-right">{year}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(memoData.projections.scenarios).map(([scenarioType, data]) => (
                          <>
                            <TableRow key={`${scenarioType}-header`} className="bg-muted/50">
                              <TableCell colSpan={memoData.projections.years.length + 1} className="font-medium capitalize">
                                {scenarioType} Case
                              </TableCell>
                            </TableRow>
                            <TableRow key={`${scenarioType}-noi`}>
                              <TableCell className="pl-6">NOI</TableCell>
                              {data.noi.map((value, idx) => (
                                <TableCell key={idx} className="text-right">{formatCurrency(value)}</TableCell>
                              ))}
                            </TableRow>
                            <TableRow key={`${scenarioType}-value`}>
                              <TableCell className="pl-6">Exit Value</TableCell>
                              {data.value.map((value, idx) => (
                                <TableCell key={idx} className="text-right">{formatCurrency(value)}</TableCell>
                              ))}
                            </TableRow>
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {memoData.approvalHistory.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Approval History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {memoData.approvalHistory.slice(0, 5).map((event, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div>
                            <span className="font-medium capitalize">{event.eventType.replace(/_/g, ' ')}</span>
                            {event.scenarioName && (
                              <span className="text-muted-foreground ml-2">- {event.scenarioName}</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(event.createdAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        ) : null}

        <Separator />
        
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">
            Generated: {memoData ? format(new Date(memoData.generatedAt), 'MMM d, yyyy h:mm a') : '-'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownloadJSON} disabled={!memoData} data-testid="button-download-json">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              JSON
            </Button>
            <Button onClick={handleDownloadText} disabled={isDownloading} data-testid="button-download-text">
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download Memo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
