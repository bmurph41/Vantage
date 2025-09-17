import ReportTable, { type Column } from "./ReportTable";
import { cn } from "@/lib/utils";
import type { SalesComparable } from "@shared/reportSchema";

interface SalesCompsTableProps {
  data: SalesComparable[];
  title?: string;
  showDetails?: boolean;
  className?: string;
}

export function SalesCompsTable({
  data,
  title = "Sales Comparables",
  showDetails = true,
  className,
}: SalesCompsTableProps) {
  // Define column configuration
  const columns: Column[] = [
    {
      key: "address",
      header: "Property Address",
      width: "2fr",
      align: "left",
      type: "text",
    },
    {
      key: "saleDate",
      header: "Sale Date",
      width: "100px",
      align: "center",
      type: "text",
    },
    {
      key: "salePrice",
      header: "Sale Price",
      width: "120px",
      align: "right",
      type: "currency",
    },
    {
      key: "sqFt",
      header: "Sq Ft",
      width: "90px",
      align: "right",
      type: "number",
    },
    {
      key: "pricePerSqFt",
      header: "$/SF",
      width: "80px",
      align: "right",
      type: "currency",
    },
  ];
  
  if (showDetails) {
    columns.push(
      {
        key: "pricePerUnit",
        header: "$/Unit",
        width: "100px",
        align: "right",
        type: "currency",
      },
      {
        key: "capRate",
        header: "Cap Rate",
        width: "80px",
        align: "right",
        type: "percentage",
      },
      {
        key: "distance",
        header: "Distance",
        width: "80px",
        align: "right",
        type: "text",
      }
    );
  }
  
  // Transform data for display
  const enhancedData = data.map(row => ({
    ...row,
    distance: `${row.distance.toFixed(1)} mi`,
    compTypeDisplay: row.compType.charAt(0).toUpperCase() + row.compType.slice(1),
  }));
  
  // Calculate summary statistics
  const avgPricePerSqFt = data.reduce((sum, r) => sum + r.pricePerSqFt, 0) / data.length;
  const avgPricePerUnit = data.filter(r => r.pricePerUnit).reduce((sum, r) => sum + (r.pricePerUnit || 0), 0) / data.filter(r => r.pricePerUnit).length;
  const avgCapRate = data.filter(r => r.capRate).reduce((sum, r) => sum + (r.capRate || 0), 0) / data.filter(r => r.capRate).length;
  const totalSalesVolume = data.reduce((sum, r) => sum + r.salePrice, 0);
  
  return (
    <div className={cn("space-y-6", className)} data-testid="sales-comps-table">
      {title && (
        <h3 
          className="text-lg font-semibold text-neutral-900"
          data-testid="sales-comps-table-title"
        >
          {title}
        </h3>
      )}
      
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-neutral-50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-neutral-900 tabular-nums">
            ${avgPricePerSqFt.toFixed(0)}
          </div>
          <div className="text-sm text-neutral-600">Avg $/SF</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-neutral-900 tabular-nums">
            ${avgPricePerUnit.toLocaleString()}
          </div>
          <div className="text-sm text-neutral-600">Avg $/Unit</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-neutral-900 tabular-nums">
            {avgCapRate.toFixed(1)}%
          </div>
          <div className="text-sm text-neutral-600">Avg Cap Rate</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-neutral-900 tabular-nums">
            {data.length}
          </div>
          <div className="text-sm text-neutral-600">Comparables</div>
        </div>
      </div>
      
      {/* Sales Comparables Table */}
      <ReportTable
        columns={columns}
        data={enhancedData}
        stickyHeader={true}
        zebraRows={true}
        compact={false}
      />
      
      {/* Methodology Note */}
      <div className="text-sm text-neutral-600 italic">
        * Sales comparables sourced from public records and broker databases. 
        Adjustments made for differences in location, condition, and timing.
      </div>
    </div>
  );
}

export default SalesCompsTable;