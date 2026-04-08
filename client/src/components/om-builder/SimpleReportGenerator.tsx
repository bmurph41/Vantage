import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText, Printer, Mail, Building2, DollarSign, TrendingUp,
  PieChart, ArrowRight, ImageIcon, BarChart3, Loader2,
  Waves, Globe, Compass,
} from "lucide-react";
import { Link } from "wouter";

type Property = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  propertyType?: string;
  purchasePrice?: string | number | null;
  currentValue?: string | number | null;
  noi?: string | number | null;
  capRate?: string | number | null;
  cashOnCash?: string | number | null;
  occupancyRate?: string | number | null;
  totalRevenue?: string | number | null;
  totalExpenses?: string | number | null;
  grossIncome?: string | number | null;
  operatingExpenses?: string | number | null;
  debtService?: string | number | null;
  netCashFlow?: string | number | null;
  loanAmount?: string | number | null;
  equity?: string | number | null;
};

const REPORT_TYPES = [
  { value: "property_summary", label: "Property Summary", description: "Overview of property details and key metrics" },
  { value: "financial_overview", label: "Financial Overview", description: "P&L breakdown and capital stack" },
  { value: "investor_update", label: "Investor Update", description: "Performance update for stakeholders" },
  { value: "investment_memo", label: "Investment Memo", description: "Full investment materials with comps, demographics & financials" },
  { value: "comp_analysis", label: "Comp Analysis", description: "Sales & rate comps comparison with market data" },
] as const;

type ReportType = typeof REPORT_TYPES[number]["value"];

function formatCurrency(value: string | number | null | undefined): string {
  if (!value) return "$0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}

function formatPercent(value: string | number | null | undefined): string {
  if (!value) return "0%";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0%";
  return `${num.toFixed(1)}%`;
}

function ReportPreview({ property, reportType, omData }: { property: Property; reportType: ReportType; omData?: any }) {
  const purchasePrice = Number(property.purchasePrice || 0);
  const noi = Number(property.noi || 0);
  const capRate = Number(property.capRate || 0);
  const cashOnCash = Number(property.cashOnCash || 0);
  const totalRevenue = Number(property.totalRevenue || property.grossIncome || 0);
  const totalExpenses = Number(property.totalExpenses || property.operatingExpenses || 0);
  const debtService = Number(property.debtService || 0);
  const netCashFlow = Number(property.netCashFlow || 0);
  const loanAmount = Number(property.loanAmount || 0);
  const equity = Number(property.equity || purchasePrice - loanAmount);

  return (
    <div className="bg-white border rounded-lg shadow-sm print:shadow-none print:border-none" id="report-preview">
      {/* Report Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 rounded-t-lg print:rounded-none">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium uppercase tracking-wider mb-1">
              {REPORT_TYPES.find(r => r.value === reportType)?.label}
            </p>
            <h2 className="text-2xl font-bold">{property.name}</h2>
            <p className="text-blue-100 mt-1">
              {[property.address, property.city, property.state].filter(Boolean).join(", ") || "Address not provided"}
            </p>
            {property.propertyType && (
              <Badge className="mt-2 bg-blue-500/30 text-white border-blue-400/50">
                {property.propertyType}
              </Badge>
            )}
          </div>
          <div className="bg-white/10 rounded-lg p-6 flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-white/50" />
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50 border-b">
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Purchase Price</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(purchasePrice)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">NOI</p>
          <p className="text-lg font-bold text-green-700 mt-1">{formatCurrency(noi)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Cap Rate</p>
          <p className="text-lg font-bold text-blue-700 mt-1">{formatPercent(capRate)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Cash-on-Cash</p>
          <p className="text-lg font-bold text-purple-700 mt-1">{formatPercent(cashOnCash)}</p>
        </div>
      </div>

      {/* Content varies by report type */}
      <div className="p-6 space-y-6">
        {(reportType === "property_summary" || reportType === "investor_update") && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-blue-600" />
              Property Overview
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex justify-between py-2 px-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Property Type</span>
                <span className="text-sm font-medium">{property.propertyType || "N/A"}</span>
              </div>
              <div className="flex justify-between py-2 px-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Occupancy</span>
                <span className="text-sm font-medium">{formatPercent(property.occupancyRate)}</span>
              </div>
              <div className="flex justify-between py-2 px-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Current Value</span>
                <span className="text-sm font-medium">{formatCurrency(property.currentValue || purchasePrice)}</span>
              </div>
              <div className="flex justify-between py-2 px-3 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">Location</span>
                <span className="text-sm font-medium">{property.city || "N/A"}, {property.state || ""}</span>
              </div>
            </div>
          </div>
        )}

        {/* Simple P&L */}
        {(reportType === "financial_overview" || reportType === "investor_update") && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-green-600" />
              Simplified P&L
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <div className="flex justify-between py-2.5 px-4 bg-green-50 border-b">
                <span className="text-sm font-medium text-green-800">Total Revenue</span>
                <span className="text-sm font-bold text-green-800">{formatCurrency(totalRevenue)}</span>
              </div>
              <div className="flex justify-between py-2.5 px-4 border-b">
                <span className="text-sm text-gray-600">Operating Expenses</span>
                <span className="text-sm font-medium text-red-600">({formatCurrency(totalExpenses)})</span>
              </div>
              <div className="flex justify-between py-2.5 px-4 bg-blue-50 border-b">
                <span className="text-sm font-semibold text-blue-800">Net Operating Income (NOI)</span>
                <span className="text-sm font-bold text-blue-800">{formatCurrency(noi || totalRevenue - totalExpenses)}</span>
              </div>
              <div className="flex justify-between py-2.5 px-4 border-b">
                <span className="text-sm text-gray-600">Debt Service</span>
                <span className="text-sm font-medium text-red-600">({formatCurrency(debtService)})</span>
              </div>
              <div className="flex justify-between py-2.5 px-4 bg-purple-50">
                <span className="text-sm font-semibold text-purple-800">Net Cash Flow</span>
                <span className="text-sm font-bold text-purple-800">
                  {formatCurrency(netCashFlow || (noi || totalRevenue - totalExpenses) - debtService)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Capital Stack */}
        {(reportType === "financial_overview" || reportType === "property_summary") && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
              <PieChart className="h-4 w-4 text-purple-600" />
              Capital Stack
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase">Senior Debt</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(loanAmount)}</p>
                {purchasePrice > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {((loanAmount / purchasePrice) * 100).toFixed(0)}% LTV
                  </p>
                )}
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase">Equity</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(equity)}</p>
                {purchasePrice > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {((equity / purchasePrice) * 100).toFixed(0)}% of total
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Investor Update specific: performance note */}
        {reportType === "investor_update" && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              Performance Summary
            </h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                This property is generating {formatCurrency(noi || totalRevenue - totalExpenses)} in NOI
                {capRate > 0 ? ` at a ${formatPercent(capRate)} cap rate` : ""}.
                {cashOnCash > 0 ? ` Cash-on-cash return is ${formatPercent(cashOnCash)}.` : ""}
              </p>
            </div>
          </div>
        )}

        {/* Sales Comps Analysis */}
        {(reportType === "investment_memo" || reportType === "comp_analysis") && omData?.compAnalytics?.salesComps?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Compass className="h-4 w-4 text-cyan-600" />
              Comparable Sales ({omData.compAnalytics.salesCompStats.count})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-cyan-50 rounded-lg p-3 text-center">
                <p className="text-xs text-cyan-600 uppercase">Avg Sale Price</p>
                <p className="text-sm font-bold text-cyan-900">{formatCurrency(omData.compAnalytics.salesCompStats.avgPrice)}</p>
              </div>
              <div className="bg-cyan-50 rounded-lg p-3 text-center">
                <p className="text-xs text-cyan-600 uppercase">Avg Cap Rate</p>
                <p className="text-sm font-bold text-cyan-900">{formatPercent(omData.compAnalytics.salesCompStats.avgCapRate ? omData.compAnalytics.salesCompStats.avgCapRate * 100 : 0)}</p>
              </div>
              <div className="bg-cyan-50 rounded-lg p-3 text-center">
                <p className="text-xs text-cyan-600 uppercase">Avg $/Slip</p>
                <p className="text-sm font-bold text-cyan-900">{formatCurrency(omData.compAnalytics.salesCompStats.avgPricePerSlip)}</p>
              </div>
              <div className="bg-cyan-50 rounded-lg p-3 text-center">
                <p className="text-xs text-cyan-600 uppercase">Price Range</p>
                <p className="text-sm font-bold text-cyan-900">
                  {omData.compAnalytics.salesCompStats.priceRange
                    ? `${formatCurrency(omData.compAnalytics.salesCompStats.priceRange.min)} - ${formatCurrency(omData.compAnalytics.salesCompStats.priceRange.max)}`
                    : "N/A"}
                </p>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Marina</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Sale Price</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Cap Rate</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">$/Slip</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Location</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Year</th>
                  </tr>
                </thead>
                <tbody>
                  {omData.compAnalytics.salesComps.slice(0, 10).map((comp: any, idx: number) => (
                    <tr key={comp.compId} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 font-medium">{comp.marina}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(comp.salePrice)}</td>
                      <td className="px-3 py-2 text-right">{comp.capRate ? formatPercent(comp.capRate * 100) : "N/A"}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(comp.pricePerSlip)}</td>
                      <td className="px-3 py-2 text-center">{[comp.city, comp.state].filter(Boolean).join(", ") || "N/A"}</td>
                      <td className="px-3 py-2 text-center">{comp.saleYear || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rate Comps Analysis */}
        {(reportType === "investment_memo" || reportType === "comp_analysis") && omData?.compAnalytics?.rateComps?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Waves className="h-4 w-4 text-teal-600" />
              Comparable Rates ({omData.compAnalytics.rateCompStats.count})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <div className="bg-teal-50 rounded-lg p-3 text-center">
                <p className="text-xs text-teal-600 uppercase">Avg Rate</p>
                <p className="text-sm font-bold text-teal-900">{formatCurrency(omData.compAnalytics.rateCompStats.avgRate)}</p>
              </div>
              <div className="bg-teal-50 rounded-lg p-3 text-center">
                <p className="text-xs text-teal-600 uppercase">Min Rate</p>
                <p className="text-sm font-bold text-teal-900">{omData.compAnalytics.rateCompStats.rateRange ? formatCurrency(omData.compAnalytics.rateCompStats.rateRange.min) : "N/A"}</p>
              </div>
              <div className="bg-teal-50 rounded-lg p-3 text-center">
                <p className="text-xs text-teal-600 uppercase">Max Rate</p>
                <p className="text-sm font-bold text-teal-900">{omData.compAnalytics.rateCompStats.rateRange ? formatCurrency(omData.compAnalytics.rateCompStats.rateRange.max) : "N/A"}</p>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Marina</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Rate</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Type</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Slips</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Seasonality</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {omData.compAnalytics.rateComps.slice(0, 10).map((comp: any, idx: number) => (
                    <tr key={comp.compId} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 font-medium">{comp.marina}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(comp.rateAmount)}</td>
                      <td className="px-3 py-2 text-center">{comp.rateType || "N/A"}</td>
                      <td className="px-3 py-2 text-center">{comp.wetSlips || 0}</td>
                      <td className="px-3 py-2 text-center">{comp.seasonality || "N/A"}</td>
                      <td className="px-3 py-2 text-center">{[comp.city, comp.state].filter(Boolean).join(", ") || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Market Demographics */}
        {(reportType === "investment_memo" || reportType === "comp_analysis") && omData?.demographics && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-indigo-600" />
              Market Demographics — {omData.demographics.state}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase">Population</p>
                <p className="text-sm font-bold text-gray-900">{omData.demographics.population ? new Intl.NumberFormat('en-US').format(omData.demographics.population) : "N/A"}</p>
                {omData.demographics.populationGrowth != null && (
                  <p className="text-xs text-green-600 mt-1">+{omData.demographics.populationGrowth.toFixed(1)}% growth</p>
                )}
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase">Median Income</p>
                <p className="text-sm font-bold text-gray-900">{formatCurrency(omData.demographics.medianIncome)}</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase">Unemployment</p>
                <p className="text-sm font-bold text-gray-900">{omData.demographics.unemploymentRate ? `${omData.demographics.unemploymentRate.toFixed(1)}%` : "N/A"}</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase">Market Transactions</p>
                <p className="text-sm font-bold text-gray-900">{omData.demographics.transactionCount || "N/A"}</p>
              </div>
              {omData.demographics.avgSalePrice && (
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Avg Market Price</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(omData.demographics.avgSalePrice)}</p>
                </div>
              )}
              {omData.demographics.avgCapRate && (
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Market Cap Rate</p>
                  <p className="text-sm font-bold text-gray-900">{formatPercent(omData.demographics.avgCapRate)}</p>
                </div>
              )}
              {omData.demographics.avgPricePerSlip && (
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Market $/Slip</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(omData.demographics.avgPricePerSlip)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-6 py-3 bg-gray-50 rounded-b-lg text-center print:rounded-none">
        <p className="text-xs text-gray-400">
          Generated on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
    </div>
  );
}

export default function SimpleReportGenerator() {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [reportType, setReportType] = useState<ReportType>("property_summary");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const { toast } = useToast();

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ["/api/crm/properties"],
    staleTime: 5 * 60 * 1000,
  });

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  // Fetch enriched OM data (comps, demographics) when a property is selected
  const { data: omData } = useQuery<any>({
    queryKey: ["/api/om-builder", selectedPropertyId, "data"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/om-builder/${selectedPropertyId}/data`);
      return res;
    },
    enabled: !!selectedPropertyId,
    staleTime: 5 * 60 * 1000,
  });

  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPropertyId) throw new Error("No property selected");
      const reportLabel = REPORT_TYPES.find(r => r.value === reportType)?.label || "Report";
      const doc: any = await apiRequest("POST", `/api/om-builder/${selectedPropertyId}/generate`, {
        title: `${selectedProperty?.name} - ${reportLabel}`,
      });
      const pdfRes: any = await apiRequest("POST", `/api/om-builder/documents/${doc.id}/export-pdf`, {
        templateType: "premium",
      });
      window.open(pdfRes.pdfUrl, '_blank');
      return pdfRes;
    },
    onSuccess: () => {
      toast({ title: "PDF Generated", description: "Your report PDF has been generated." });
    },
    onError: (error: Error) => {
      toast({ title: "PDF generation failed", description: error.message, variant: "destructive" });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (payload: { to: string[]; subject: string; message?: string; htmlContent: string }) => {
      const res = await apiRequest("POST", "/api/reports/send-email", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Email sent", description: data.message || "Report emailed successfully." });
      setEmailDialogOpen(false);
      setEmailTo("");
      setEmailSubject("");
      setEmailMessage("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send email", description: error.message, variant: "destructive" });
    },
  });

  const handlePrint = () => {
    if (reportType === 'investment_memo' || reportType === 'comp_analysis') {
      generatePdfMutation.mutate();
    } else {
      window.print();
    }
  };

  const handleEmail = () => {
    if (!selectedProperty) return;
    const reportLabel = REPORT_TYPES.find((r) => r.value === reportType)?.label || "Report";
    setEmailSubject(`${reportLabel} - ${selectedProperty.name}`);
    setEmailDialogOpen(true);
  };

  const handleSendEmail = () => {
    const recipients = emailTo
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      toast({ title: "No recipients", description: "Please enter at least one email address.", variant: "destructive" });
      return;
    }

    const reportEl = document.getElementById("report-preview");
    const htmlContent = reportEl?.outerHTML || "<p>Report content unavailable.</p>";

    sendEmailMutation.mutate({
      to: recipients,
      subject: emailSubject || "Property Report",
      message: emailMessage || undefined,
      htmlContent,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Quick Report Generator
              </CardTitle>
              <CardDescription className="mt-1">
                Generate a simple, professional report for any property in your portfolio.
              </CardDescription>
            </div>
            <Link href="/om">
              <Button variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-gray-700">
                Switch to Advanced OM Builder <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Property Selector */}
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                Property
              </label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a property..." />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Report Type Selector */}
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                Report Type
              </label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      {rt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 items-end">
              <Button
                onClick={handlePrint}
                disabled={!selectedProperty || generatePdfMutation.isPending}
                className="gap-2"
              >
                {generatePdfMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {generatePdfMutation.isPending ? "Generating..." : "Generate PDF"}
              </Button>
              <Button
                variant="outline"
                onClick={handleEmail}
                disabled={!selectedProperty}
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                Email Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {selectedProperty ? (
        <ReportPreview property={selectedProperty} reportType={reportType} omData={omData} />
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Property</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Choose a property and report type above to preview your report.
              You can then generate a PDF or email it directly.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty state for no properties */}
      {properties.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No Properties Found</h3>
            <p className="text-sm text-gray-400 mb-4">
              Add properties to your portfolio to start generating reports.
            </p>
            <Link href="/crm/properties">
              <Button variant="outline">
                <Building2 className="h-4 w-4 mr-2" />
                Go to Properties
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              Email Report
            </DialogTitle>
            <DialogDescription>
              Send this report directly to one or more recipients.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="email-to">Recipient(s) <span className="text-red-500">*</span></Label>
              <Input
                id="email-to"
                type="text"
                placeholder="email@example.com, another@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
              <p className="text-xs text-gray-500">Separate multiple addresses with commas</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-message">Message (optional)</Label>
              <Textarea
                id="email-message"
                placeholder="Add a personal note to include above the report..."
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sendEmailMutation.isPending || !emailTo.trim()}
              className="gap-2"
            >
              {sendEmailMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
