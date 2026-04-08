import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ChevronDown, ChevronRight, Download, ArrowLeft, DollarSign, Loader2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type LineItem = {
  accountCode: string;
  accountName: string;
  period: string | null;
  amount: string | number | null;
  confidence: string | number;
  method: string;
  status: string;
};

function parseAmount(val: string | number | null | undefined): number {
  const n = parseFloat(String(val ?? '0'));
  return isNaN(n) ? 0 : n;
}

function parseConfidence(val: string | number | null): number {
  const n = parseFloat(String(val ?? '0'));
  if (isNaN(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

type ProfitCenterData = {
  profitCenter: { id: string; code: string; name: string };
  revenue: LineItem[];
  cogs: LineItem[];
  opex: LineItem[];
  other: LineItem[];
};

type DepartmentalPLResponse = {
  uploadId: string;
  profitCenters: ProfitCenterData[];
  totalMapped: number;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function getConfidenceColor(confidence: number) {
  if (confidence >= 90) return "text-green-600 dark:text-green-400";
  if (confidence >= 75) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getConfidenceBg(confidence: number) {
  if (confidence >= 90) return "bg-green-100 dark:bg-green-900/30";
  if (confidence >= 75) return "bg-yellow-100 dark:bg-yellow-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function getStatusBadge(status: string) {
  const variants: Record<string, string> = {
    AUTO_MAPPED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    NEEDS_REVIEW: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    OVERRIDDEN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  };
  return (
    <Badge variant="outline" className={`border-0 ${variants[status] || ""}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

const SECTION_CONFIG = {
  revenue: { label: "Revenue", color: "bg-green-600 dark:bg-green-700", textColor: "text-white" },
  cogs: { label: "COGS", color: "bg-orange-600 dark:bg-orange-700", textColor: "text-white" },
  opex: { label: "OPEX", color: "bg-red-600 dark:bg-red-700", textColor: "text-white" },
  other: { label: "Other", color: "bg-gray-600 dark:bg-gray-700", textColor: "text-white" },
} as const;

function SectionTable({ items, label, config }: { items: LineItem[]; label: string; config: { color: string; textColor: string } }) {
  if (items.length === 0) return null;
  const subtotal = items.reduce((sum, item) => sum + parseAmount(item.amount), 0);

  return (
    <div className="mb-4">
      <div className={`px-4 py-2 rounded-t-md ${config.color} ${config.textColor} font-semibold text-sm`}>
        {label} ({items.length} items)
      </div>
      <div className="overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account Code</TableHead>
            <TableHead>Account Name</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => {
            const amt = parseAmount(item.amount);
            const conf = parseConfidence(item.confidence);
            return (
            <TableRow key={`${item.accountCode}-${item.period}-${idx}`}>
              <TableCell className="font-mono text-xs">{item.accountCode}</TableCell>
              <TableCell>{item.accountName}</TableCell>
              <TableCell>{item.period || "—"}</TableCell>
              <TableCell className="text-right font-medium">{currencyFormatter.format(amt)}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getConfidenceBg(conf)} ${getConfidenceColor(conf)}`}>
                  {Math.round(conf)}%
                </span>
              </TableCell>
              <TableCell>{getStatusBadge(item.status)}</TableCell>
            </TableRow>
            );
          })}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell colSpan={3} className="text-right">Subtotal</TableCell>
            <TableCell className="text-right">{currencyFormatter.format(subtotal)}</TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

function ProfitCenterCard({ data }: { data: ProfitCenterData }) {
  const [expanded, setExpanded] = useState(true);
  const totalItems = data.revenue.length + data.cogs.length + data.opex.length + data.other.length;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            <CardTitle className="text-lg">
              {data.profitCenter.name}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({data.profitCenter.code})
              </span>
            </CardTitle>
          </div>
          <Badge variant="secondary">{totalItems} items</Badge>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <SectionTable items={data.revenue} label={SECTION_CONFIG.revenue.label} config={SECTION_CONFIG.revenue} />
          <SectionTable items={data.cogs} label={SECTION_CONFIG.cogs.label} config={SECTION_CONFIG.cogs} />
          <SectionTable items={data.opex} label={SECTION_CONFIG.opex.label} config={SECTION_CONFIG.opex} />
          <SectionTable items={data.other} label={SECTION_CONFIG.other.label} config={SECTION_CONFIG.other} />
        </CardContent>
      )}
    </Card>
  );
}

function generateCSV(data: DepartmentalPLResponse) {
  const headers = ["Profit Center", "Statement Type", "Account Code", "Account Name", "Period", "Amount", "Confidence", "Method", "Status"];
  const rows: string[][] = [];

  for (const pc of data.profitCenters) {
    const sections = [
      { type: "Revenue", items: pc.revenue },
      { type: "COGS", items: pc.cogs },
      { type: "OPEX", items: pc.opex },
      { type: "Other", items: pc.other },
    ];
    for (const section of sections) {
      for (const item of section.items) {
        rows.push([
          pc.profitCenter.name,
          section.type,
          item.accountCode,
          item.accountName,
          item.period || "",
          String(parseAmount(item.amount)),
          String(parseConfidence(item.confidence)),
          item.method,
          item.status,
        ]);
      }
    }
  }

  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `departmental-pl-${data.uploadId}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DepartmentalPL() {
  const { uploadId } = useParams<{ uploadId: string }>();

  const { data, isLoading, error } = useQuery<DepartmentalPLResponse>({
    queryKey: ['/api/coa-taxonomy/departmental-pl', uploadId],
    enabled: !!uploadId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/modeling/doc-intel">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Departmental P&L</h1>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">Failed to load departmental P&L data</p>
          <p className="text-sm mt-1">{error instanceof Error ? error.message : "An error occurred."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/modeling/doc-intel">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Departmental P&L</h1>
            <p className="text-muted-foreground">
              Financial data organized by profit center and statement type
            </p>
          </div>
        </div>
        <Button onClick={() => generateCSV(data)} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Mapped Items</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{data.totalMapped}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Across {data.profitCenters.length} profit center{data.profitCenters.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {data.profitCenters.map((pc) => (
          <ProfitCenterCard key={pc.profitCenter.id} data={pc} />
        ))}
      </div>

      {data.profitCenters.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No profit centers found</p>
          <p className="text-sm mt-1">No departmental P&L data is available for this upload.</p>
        </div>
      )}
    </div>
  );
}
