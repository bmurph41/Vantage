/**
 * LPExportDialog
 * 
 * One-click pipeline summary generator for LP reporting:
 *   - Section selector: Cover, Pipeline Summary, Deal Cards, 
 *     Stage Distribution, Velocity, Forecast
 *   - Date range picker
 *   - Asset class filter
 *   - Generates structured HTML report → print/PDF
 *   - Falls back to client-side generation if server endpoint unavailable
 * 
 * Usage:
 *   <LPExportDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *   />
 */

import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Download, Loader2, Printer, BarChart3,
  TrendingUp, Layers, Target, DollarSign, Calendar,
  Building2, Eye, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Deal } from "@shared/schema";
import { useAssetClasses } from "@/hooks/use-asset-classes";

// ─── Types ────────────────────────────────────────────────────────

interface LPExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExportSection {
  id: string;
  label: string;
  description: string;
  icon: typeof FileText;
  enabled: boolean;
}

// ─── Component ────────────────────────────────────────────────────

export function LPExportDialog({ open, onOpenChange }: LPExportDialogProps) {
  const { toast } = useToast();
  const { options: assetClassOptions } = useAssetClasses();
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState("Quarterly Pipeline Report");
  const [reportPeriod, setReportPeriod] = useState(() => {
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    return `Q${q} ${now.getFullYear()}`;
  });
  const [assetClassFilter, setAssetClassFilter] = useState("all");

  const [sections, setSections] = useState<ExportSection[]>([
    { id: "cover", label: "Cover Page", description: "Title, date, firm branding", icon: FileText, enabled: true },
    { id: "summary", label: "Pipeline Summary", description: "KPIs: total value, count, win rate, avg size", icon: BarChart3, enabled: true },
    { id: "deals", label: "Deal Cards", description: "Individual deal snapshots with key metrics", icon: Layers, enabled: true },
    { id: "stages", label: "Stage Distribution", description: "Deal count and value per pipeline stage", icon: Target, enabled: true },
    { id: "velocity", label: "Velocity Metrics", description: "Avg days per stage, bottleneck analysis", icon: TrendingUp, enabled: true },
    { id: "forecast", label: "Forecast", description: "Weighted pipeline value and projected closings", icon: DollarSign, enabled: true },
    { id: "assetBreakdown", label: "Asset Class Breakdown", description: "Deal distribution across asset types", icon: Building2, enabled: true },
  ]);

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Fetch deals
  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
    enabled: open,
  });

  // Fetch analytics
  const { data: health } = useQuery({
    queryKey: ["/api/crm/analytics/health"],
    enabled: open,
  });

  const { data: velocity } = useQuery({
    queryKey: ["/api/crm/analytics/velocity"],
    enabled: open,
  });

  // Filter deals
  const filteredDeals = useMemo(() => {
    if (assetClassFilter === "all") return deals;
    return deals.filter((d: any) => (d.assetClass || d.asset_class || "marina") === assetClassFilter);
  }, [deals, assetClassFilter]);

  const openDeals = useMemo(() => filteredDeals.filter((d: any) => !d.isClosed && d.status !== "won" && d.status !== "lost"), [filteredDeals]);

  // ─── Generate Report ────────────────────────────────────────────

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      // Try server-side generation first
      const response = await fetch("/api/crm/exports/lp-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reportTitle,
          period: reportPeriod,
          assetClass: assetClassFilter,
          sections: sections.filter((s) => s.enabled).map((s) => s.id),
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportTitle.replace(/\s+/g, "-").toLowerCase()}-${reportPeriod.replace(/\s+/g, "-")}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Report Downloaded" });
      } else {
        // Fallback: generate HTML and open print dialog
        generateHTMLReport();
      }
    } catch {
      generateHTMLReport();
    }

    setIsGenerating(false);
    onOpenChange(false);
  };

  const generateHTMLReport = () => {
    const enabledSections = new Set(sections.filter((s) => s.enabled).map((s) => s.id));
    const analytics = computeAnalytics(openDeals);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${reportTitle} — ${reportPeriod}</title>
  <style>
    @page { margin: 0.75in; size: landscape; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; line-height: 1.5; }
    .page { page-break-after: always; padding: 40px; }
    .page:last-child { page-break-after: avoid; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    h2 { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: #6b7280; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }
    .kpi-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .kpi-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 24px; font-weight: 700; margin-top: 4px; }
    .deal-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .deal-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #fff; }
    .deal-name { font-weight: 600; font-size: 13px; }
    .deal-meta { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .deal-amount { font-size: 16px; font-weight: 700; color: #059669; margin-top: 4px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; }
    .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .badge-green { background: #dcfce7; color: #16a34a; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    th { background: #f9fafb; font-weight: 600; color: #374151; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
    .bar { height: 20px; border-radius: 4px; background: #3b82f6; min-width: 4px; }
    .footer { text-align: center; font-size: 10px; color: #9ca3af; margin-top: 40px; }
    .text-right { text-align: right; }
    .font-mono { font-family: 'SF Mono', monospace; }
  </style>
</head>
<body>

${enabledSections.has("cover") ? `
<div class="page" style="display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:90vh;text-align:center;">
  <h1 style="font-size:36px;">${reportTitle}</h1>
  <p class="subtitle" style="font-size:18px;margin-top:8px;">${reportPeriod}</p>
  <p class="subtitle" style="margin-top:24px;">Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
  <p class="subtitle">${openDeals.length} Active Deals · ${formatCurrencyHTML(analytics.totalValue)} Pipeline Value</p>
</div>
` : ""}

${enabledSections.has("summary") ? `
<div class="page">
  <h2>Pipeline Summary</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Pipeline Value</div>
      <div class="kpi-value">${formatCurrencyHTML(analytics.totalValue)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Active Deals</div>
      <div class="kpi-value">${analytics.dealCount}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Weighted Value</div>
      <div class="kpi-value">${formatCurrencyHTML(analytics.weightedValue)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Avg Deal Size</div>
      <div class="kpi-value">${formatCurrencyHTML(analytics.avgDealSize)}</div>
    </div>
  </div>
</div>
` : ""}

${enabledSections.has("deals") ? `
<div class="page">
  <h2>Active Deals</h2>
  <div class="deal-grid">
    ${openDeals.slice(0, 12).map((d: any) => {
      const ac = d.assetClass || d.asset_class || "marina";
      return `
      <div class="deal-card">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div>
            <div class="deal-name">${d.name || "Untitled"}</div>
            <div class="deal-meta">${ac.charAt(0).toUpperCase() + ac.slice(1)} · ${d.pipelineStage || d.stage || "Lead"}</div>
          </div>
          <div class="deal-amount">${d.amount ? formatCurrencyHTML(d.amount) : "—"}</div>
        </div>
      </div>`;
    }).join("")}
  </div>
  ${openDeals.length > 12 ? `<p class="subtitle" style="margin-top:12px;">+${openDeals.length - 12} additional deals</p>` : ""}
</div>
` : ""}

${enabledSections.has("stages") ? `
<div class="page">
  <h2>Stage Distribution</h2>
  <table>
    <thead><tr><th>Stage</th><th class="text-right">Deals</th><th class="text-right">Value</th><th style="width:40%">Distribution</th></tr></thead>
    <tbody>
      ${Object.entries(analytics.stageBreakdown).map(([stage, data]: [string, any]) => `
        <tr>
          <td>${stage}</td>
          <td class="text-right font-mono">${data.count}</td>
          <td class="text-right font-mono">${formatCurrencyHTML(data.value)}</td>
          <td><div class="bar" style="width:${analytics.totalValue > 0 ? Math.max((data.value / analytics.totalValue) * 100, 2) : 2}%"></div></td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</div>
` : ""}

${enabledSections.has("assetBreakdown") ? `
<div class="page">
  <h2>Asset Class Breakdown</h2>
  <table>
    <thead><tr><th>Asset Class</th><th class="text-right">Deals</th><th class="text-right">Value</th><th class="text-right">Avg Size</th></tr></thead>
    <tbody>
      ${Object.entries(analytics.assetBreakdown).map(([ac, data]: [string, any]) => `
        <tr>
          <td>${ac.charAt(0).toUpperCase() + ac.slice(1).replace(/_/g, " ")}</td>
          <td class="text-right font-mono">${data.count}</td>
          <td class="text-right font-mono">${formatCurrencyHTML(data.value)}</td>
          <td class="text-right font-mono">${data.count > 0 ? formatCurrencyHTML(data.value / data.count) : "—"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</div>
` : ""}

${enabledSections.has("forecast") ? `
<div class="page">
  <h2>Pipeline Forecast</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Pipeline</div>
      <div class="kpi-value">${formatCurrencyHTML(analytics.totalValue)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Probability-Weighted</div>
      <div class="kpi-value">${formatCurrencyHTML(analytics.weightedValue)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Closing Next 30d</div>
      <div class="kpi-value">${analytics.closingNext30}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Closing Next 90d</div>
      <div class="kpi-value">${analytics.closingNext90}</div>
    </div>
  </div>
  <p class="footer">This report is confidential and intended for limited partner review only.</p>
</div>
` : ""}

</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
      toast({ title: "Report Generated", description: "Use the print dialog to save as PDF." });
    }
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Generate LP Report
          </DialogTitle>
          <DialogDescription>
            Create a pipeline summary report for quarterly LP meetings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Report Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Report Title</Label>
              <Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period</Label>
              <Input value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)} placeholder="Q1 2026" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Asset Class Filter</Label>
            <Select value={assetClassFilter} onValueChange={setAssetClassFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Asset Classes</SelectItem>
                {assetClassOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Section Toggles */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Report Sections</Label>
            <div className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <div
                    key={section.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                      section.enabled ? "bg-muted/40" : "opacity-50"
                    )}
                    onClick={() => toggleSection(section.id)}
                  >
                    <Checkbox checked={section.enabled} />
                    <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{section.label}</p>
                      <p className="text-[10px] text-muted-foreground">{section.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview Stats */}
          <div className="border rounded-md p-3 bg-muted/30">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Preview</p>
            <div className="flex items-center gap-4 text-xs">
              <span>{openDeals.length} active deals</span>
              <span>{sections.filter((s) => s.enabled).length} sections</span>
              <span>~{Math.max(sections.filter((s) => s.enabled).length, 2)} pages</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Generate Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Analytics Helper ─────────────────────────────────────────────

function computeAnalytics(deals: Deal[]) {
  const totalValue = deals.reduce((sum, d) => sum + (Number((d as any).amount) || 0), 0);
  const dealCount = deals.length;
  const avgDealSize = dealCount > 0 ? totalValue / dealCount : 0;
  const weightedValue = deals.reduce((sum, d: any) => {
    const amt = Number(d.amount) || 0;
    const prob = (d.probability ?? 50) / 100;
    return sum + amt * prob;
  }, 0);

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const in90 = new Date(now.getTime() + 90 * 86400000);

  const closingNext30 = deals.filter((d: any) => {
    const cd = d.closeDate || d.expectedCloseDate;
    return cd && new Date(cd) <= in30;
  }).length;

  const closingNext90 = deals.filter((d: any) => {
    const cd = d.closeDate || d.expectedCloseDate;
    return cd && new Date(cd) <= in90;
  }).length;

  // Stage breakdown
  const stageBreakdown: Record<string, { count: number; value: number }> = {};
  deals.forEach((d: any) => {
    const stage = d.pipelineStage || d.stage || "Unknown";
    if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, value: 0 };
    stageBreakdown[stage].count++;
    stageBreakdown[stage].value += Number(d.amount) || 0;
  });

  // Asset class breakdown
  const assetBreakdown: Record<string, { count: number; value: number }> = {};
  deals.forEach((d: any) => {
    const ac = d.assetClass || d.asset_class || "marina";
    if (!assetBreakdown[ac]) assetBreakdown[ac] = { count: 0, value: 0 };
    assetBreakdown[ac].count++;
    assetBreakdown[ac].value += Number(d.amount) || 0;
  });

  return { totalValue, dealCount, avgDealSize, weightedValue, closingNext30, closingNext90, stageBreakdown, assetBreakdown };
}

function formatCurrencyHTML(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export default LPExportDialog;
