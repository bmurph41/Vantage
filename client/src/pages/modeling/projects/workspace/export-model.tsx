import { useState } from 'react';
import { getExportConfig, serializeProjectForExport } from '@shared/export-model-config';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Loader2,
  FileText,
  BarChart3,
  Calculator,
  DollarSign,
  Building2,
  TrendingUp,
  Layers,
  ClipboardList
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ExportModelProps {
  projectId: string;
  projectName?: string;
  onTabChange?: (tab: string) => void;
}

interface ExportSheet {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'summary' | 'operations' | 'analysis';
}

const EXPORT_SHEETS: ExportSheet[] = [
  {
    id: 'operating-pro-forma',
    name: 'Operating Pro Forma',
    description: '5-year operating projections with revenue and expense line items',
    icon: <DollarSign className="h-4 w-4" />,
    category: 'operations',
  },
  {
    id: 'cash-flow-analysis',
    name: 'Cash Flow Analysis',
    description: 'Annual cash flows, debt service, and levered returns',
    icon: <TrendingUp className="h-4 w-4" />,
    category: 'analysis',
  },
  {
    id: 'exit-strategy-suite',
    name: 'Exit Strategy Suite',
    description: 'Exit valuation, sale proceeds, and return metrics',
    icon: <BarChart3 className="h-4 w-4" />,
    category: 'analysis',
  },
  {
    id: 'capital-stack',
    name: 'Capital Stack',
    description: 'Debt and equity structure, financing terms, sources & uses',
    icon: <Layers className="h-4 w-4" />,
    category: 'summary',
  },
  {
    id: 'rent-roll-summary',
    name: 'Rent Roll Summary',
    description: 'Occupancy, revenue by type, lease expirations',
    icon: <Building2 className="h-4 w-4" />,
    category: 'operations',
  },
  {
    id: 'sensitivity-analysis',
    name: 'Sensitivity Analysis',
    description: 'IRR and equity multiple sensitivity to key assumptions',
    icon: <Calculator className="h-4 w-4" />,
    category: 'analysis',
  },
  {
    id: 'debt-metrics',
    name: 'Debt Metrics',
    description: 'DSCR coverage, debt yield, amortization schedule',
    icon: <Calculator className="h-4 w-4" />,
    category: 'analysis',
  },
];

export default function ExportModel({ projectId, projectName, onTabChange }: ExportModelProps) {
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(
    new Set(EXPORT_SHEETS.map(s => s.id))
  );
  const [exportProgress, setExportProgress] = useState(0);

  const exportMutation = useMutation({
    mutationFn: async () => {
      setExportProgress(10);
      
      const sheetsParam = Array.from(selectedSheets).join(',');
      const response = await fetch(`/api/analytics/modeling/projects/${projectId}/export/excel?sheets=${encodeURIComponent(sheetsParam)}`);
      
      setExportProgress(60);
      
      if (!response.ok) {
        throw new Error('Failed to generate export');
      }
      
      const blob = await response.blob();
      setExportProgress(90);
      
      const filename = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') 
        || `${projectName || 'Marina'}_Model_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setExportProgress(100);
      
      return { filename };
    },
    onSuccess: ({ filename }) => {
      toast({
        title: "Export Complete",
        description: `Downloaded ${filename}`,
      });
      setTimeout(() => setExportProgress(0), 2000);
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Unable to generate Excel file. Please try again.",
        variant: "destructive",
      });
      setExportProgress(0);
    },
  });

  const toggleSheet = (sheetId: string) => {
    const newSelected = new Set(selectedSheets);
    if (newSelected.has(sheetId)) {
      newSelected.delete(sheetId);
    } else {
      newSelected.add(sheetId);
    }
    setSelectedSheets(newSelected);
  };

  const selectAll = () => {
    setSelectedSheets(new Set(EXPORT_SHEETS.map(s => s.id)));
  };

  const selectNone = () => {
    setSelectedSheets(new Set());
  };

  const groupedSheets = {
    summary: EXPORT_SHEETS.filter(s => s.category === 'summary'),
    operations: EXPORT_SHEETS.filter(s => s.category === 'operations'),
    analysis: EXPORT_SHEETS.filter(s => s.category === 'analysis'),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-green-600" />
            Export Financial Model
          </h2>
          <p className="text-muted-foreground mt-1">
            Generate a professional Excel workbook with all financial projections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All
          </Button>
          <Button variant="outline" size="sm" onClick={selectNone}>
            Select None
          </Button>
        </div>
      </div>

      {exportProgress > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              {exportProgress < 100 ? (
                <Loader2 className="h-5 w-5 animate-spin text-green-600" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">
                    {exportProgress < 100 ? 'Generating Excel file...' : 'Export complete!'}
                  </span>
                  <span className="text-sm text-muted-foreground">{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Summary Sheets
            </CardTitle>
            <CardDescription>Executive overview and assumptions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {groupedSheets.summary.map((sheet) => (
              <div
                key={sheet.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => toggleSheet(sheet.id)}
              >
                <Checkbox
                  checked={selectedSheets.has(sheet.id)}
                  onCheckedChange={() => toggleSheet(sheet.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {sheet.icon}
                    <span className="font-medium text-sm">{sheet.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{sheet.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Operations Sheets
            </CardTitle>
            <CardDescription>Financial projections and rent roll</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {groupedSheets.operations.map((sheet) => (
              <div
                key={sheet.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => toggleSheet(sheet.id)}
              >
                <Checkbox
                  checked={selectedSheets.has(sheet.id)}
                  onCheckedChange={() => toggleSheet(sheet.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {sheet.icon}
                    <span className="font-medium text-sm">{sheet.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{sheet.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analysis Sheets
            </CardTitle>
            <CardDescription>Scenarios, sensitivity, returns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {groupedSheets.analysis.map((sheet) => (
              <div
                key={sheet.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => toggleSheet(sheet.id)}
              >
                <Checkbox
                  checked={selectedSheets.has(sheet.id)}
                  onCheckedChange={() => toggleSheet(sheet.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {sheet.icon}
                    <span className="font-medium text-sm">{sheet.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{sheet.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold">Ready to Export</h3>
              <p className="text-sm text-muted-foreground">
                {selectedSheets.size} of {EXPORT_SHEETS.length} sheets selected
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    .xlsx
                  </Badge>
                  <span className="text-sm text-muted-foreground">Excel Format</span>
                </div>
              </div>
              <Button
                size="lg"
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending || selectedSheets.size === 0}
                className="min-w-[160px]"
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export Model
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">Export Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Multi-Sheet Workbook</p>
                <p className="text-xs text-muted-foreground">Organized financial data</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Formatted Numbers</p>
                <p className="text-xs text-muted-foreground">Currency & percentages</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Scenario Comparison</p>
                <p className="text-xs text-muted-foreground">Side-by-side analysis</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Print-Ready</p>
                <p className="text-xs text-muted-foreground">Professional formatting</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
