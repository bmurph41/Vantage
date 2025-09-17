import ReportTable, { type Column } from "./ReportTable";
import { cn } from "@/lib/utils";
import type { RentRollEntry } from "@shared/reportSchema";

interface RentRollTableProps {
  data: RentRollEntry[];
  title?: string;
  showDetails?: boolean;
  className?: string;
}

export function RentRollTable({
  data,
  title = "Rent Roll",
  showDetails = true,
  className,
}: RentRollTableProps) {
  // Define column configuration
  const columns: Column[] = [
    {
      key: "unit",
      header: "Unit",
      width: "80px",
      align: "center",
      type: "text",
    },
    {
      key: "unitType",
      header: "Type",
      width: "60px",
      align: "center", 
      type: "text",
    },
    {
      key: "sqFt",
      header: "Sq Ft",
      width: "80px",
      align: "right",
      type: "number",
    },
    {
      key: "tenant",
      header: "Tenant",
      width: "2fr",
      align: "left",
      type: "text",
    },
    {
      key: "currentRent",
      header: "Current Rent",
      width: "110px",
      align: "right",
      type: "currency",
    },
    {
      key: "marketRent",
      header: "Market Rent",
      width: "110px",
      align: "right",
      type: "currency",
    },
  ];
  
  if (showDetails) {
    columns.push(
      {
        key: "leaseEnd",
        header: "Lease End",
        width: "100px",
        align: "center",
        type: "text",
      },
      {
        key: "status",
        header: "Status",
        width: "80px",
        align: "center",
        type: "text",
      }
    );
  }
  
  // Transform data for display
  const enhancedData = data.map(row => ({
    ...row,
    unitType: row.unitType.toUpperCase(),
    tenant: row.occupied ? row.tenant : "VACANT",
    leaseEnd: row.occupied 
      ? new Date(row.leaseEnd).toLocaleDateString("en-US", { 
          month: "short", 
          year: "numeric" 
        })
      : "—",
    status: row.occupied ? "Occupied" : "Vacant",
    currentRent: row.occupied ? row.currentRent : 0,
  }));
  
  // Calculate summary statistics
  const totalUnits = data.length;
  const occupiedUnits = data.filter(r => r.occupied).length;
  const occupancyRate = (occupiedUnits / totalUnits) * 100;
  const totalCurrentRent = data.reduce((sum, r) => sum + (r.occupied ? r.currentRent : 0), 0);
  const totalMarketRent = data.reduce((sum, r) => sum + r.marketRent, 0);
  const averageRent = totalCurrentRent / occupiedUnits;
  
  return (
    <div className={cn("space-y-6", className)} data-testid="rent-roll-table">
      {title && (
        <h3 
          className="text-lg font-semibold text-neutral-900"
          data-testid="rent-roll-table-title"
        >
          {title}
        </h3>
      )}
      
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-neutral-50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-neutral-900 tabular-nums">
            {occupancyRate.toFixed(1)}%
          </div>
          <div className="text-sm text-neutral-600">Occupancy</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-neutral-900 tabular-nums">
            {occupiedUnits}/{totalUnits}
          </div>
          <div className="text-sm text-neutral-600">Units</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-neutral-900 tabular-nums">
            ${averageRent.toLocaleString()}
          </div>
          <div className="text-sm text-neutral-600">Avg Rent</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-neutral-900 tabular-nums">
            ${totalCurrentRent.toLocaleString()}
          </div>
          <div className="text-sm text-neutral-600">Total Income</div>
        </div>
      </div>
      
      {/* Rent Roll Table */}
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

export default RentRollTable;