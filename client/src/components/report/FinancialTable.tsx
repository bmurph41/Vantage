import ReportTable, { type Column } from "./ReportTable";
import { cn } from "@/lib/utils";

interface FinancialRow {
  item: string;
  current?: number;
  proForma?: number;
  variance?: number;
  notes?: string;
}

interface FinancialTableProps {
  data: FinancialRow[];
  title?: string;
  showVariance?: boolean;
  showNotes?: boolean;
  className?: string;
}

export function FinancialTable({
  data,
  title = "Financial Summary",
  showVariance = true,
  showNotes = false,
  className,
}: FinancialTableProps) {
  // Define column configuration
  const columns: Column[] = [
    {
      key: "item",
      header: "Line Item",
      width: "2fr",
      align: "left",
      type: "text",
    },
    {
      key: "current",
      header: "Current",
      width: "120px",
      align: "right",
      type: "currency",
    },
    {
      key: "proForma",
      header: "Pro Forma",
      width: "120px", 
      align: "right",
      type: "currency",
    },
  ];
  
  if (showVariance) {
    columns.push({
      key: "variance",
      header: "Variance",
      width: "100px",
      align: "right",
      type: "percentage",
    });
  }
  
  if (showNotes) {
    columns.push({
      key: "notes",
      header: "Notes",
      width: "1fr",
      align: "left",
      type: "text",
    });
  }
  
  // Calculate variance for each row
  const enhancedData = data.map(row => ({
    ...row,
    variance: row.current && row.proForma 
      ? ((row.proForma - row.current) / row.current) * 100
      : undefined,
  }));
  
  return (
    <div className={cn("space-y-4", className)} data-testid="financial-table">
      {title && (
        <h3 
          className="text-lg font-semibold text-neutral-900"
          data-testid="financial-table-title"
        >
          {title}
        </h3>
      )}
      
      <ReportTable
        columns={columns}
        data={enhancedData}
        stickyHeader={true}
        zebraRows={true}
        compact={false}
      />
    </div>
  );
}

export default FinancialTable;