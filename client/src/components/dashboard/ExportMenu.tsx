import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, File, Loader2, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TimeRange } from "./TimeRangeSelector";

interface ExportMenuProps {
  timeRange: TimeRange;
  selectedModules: string[];
}

export function ExportMenu({ timeRange, selectedModules }: ExportMenuProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const { data: dashboardData } = useQuery({
    queryKey: ['/api/dashboards/data', timeRange, JSON.stringify(selectedModules)],
    queryFn: async () => {
      const modulesParam = selectedModules.length > 0 ? selectedModules.join(',') : 'all';
      const response = await fetch(`/api/dashboards/data?timeRange=${timeRange}&modules=${modulesParam}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
  });

  const handleJSONExport = async () => {
    if (!dashboardData) {
      toast({
        title: "Data Not Ready",
        description: "Please wait for dashboard data to load",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch('/api/dashboards/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeRange,
          modules: selectedModules.length > 0 ? selectedModules : ['all'],
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      const jsonData = await response.json();
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Your dashboard has been exported as JSON",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export dashboard",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExcelExport = async () => {
    if (!dashboardData) {
      toast({
        title: "Data Not Ready",
        description: "Please wait for dashboard data to load",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch('/api/dashboards/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeRange,
          modules: selectedModules.length > 0 ? selectedModules : ['all'],
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Your dashboard has been exported to Excel",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export dashboard to Excel",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleEmailReport = async () => {
    toast({
      title: "Coming Soon",
      description: "Email scheduling will be available soon",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          disabled={isExporting}
          data-testid="export-menu-trigger"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Dashboard</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleJSONExport}
          disabled={isExporting || !dashboardData}
          data-testid="export-json"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleExcelExport}
          disabled={isExporting || !dashboardData}
          data-testid="export-excel"
        >
          <File className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleEmailReport}
          disabled={isExporting}
          data-testid="export-email"
        >
          <Mail className="h-4 w-4 mr-2" />
          Schedule Email Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
