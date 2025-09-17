import { cn } from "@/lib/utils";

export interface Column {
  key: string;
  header: string;
  width?: string; // CSS grid width (e.g., "120px", "1fr", "minmax(100px, 1fr)")
  align?: "left" | "center" | "right";
  type?: "text" | "number" | "currency" | "percentage";
  format?: Intl.NumberFormat;
}

interface ReportTableProps {
  columns: Column[];
  data: Record<string, any>[];
  className?: string;
  stickyHeader?: boolean;
  zebraRows?: boolean;
  compact?: boolean;
  caption?: string;
}

export function ReportTable({
  columns,
  data,
  className,
  stickyHeader = true,
  zebraRows = true,
  compact = false,
  caption,
}: ReportTableProps) {
  // Generate grid template columns from column widths
  const gridTemplate = columns.map(col => col.width || "1fr").join(" ");
  
  // Format cell value based on column type
  const formatValue = (value: any, column: Column): string => {
    if (value === null || value === undefined) return "—";
    
    switch (column.type) {
      case "currency":
        if (typeof value === "number") {
          return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(value);
        }
        break;
      case "percentage":
        if (typeof value === "number") {
          return `${value.toFixed(1)}%`;
        }
        break;
      case "number":
        if (typeof value === "number") {
          const formatter = column.format || new Intl.NumberFormat("en-US");
          return formatter.format(value);
        }
        break;
      default:
        return String(value);
    }
    return String(value);
  };
  
  // Get alignment classes
  const getAlignmentClass = (align?: string) => {
    switch (align) {
      case "center": return "text-center";
      case "right": return "text-right";
      default: return "text-left";
    }
  };
  
  return (
    <div 
      className={cn(
        "w-full overflow-hidden",
        "border border-neutral-200 rounded-lg",
        "bg-white",
        className
      )}
      data-testid="report-table"
    >
      {caption && (
        <div 
          className="px-4 py-3 bg-neutral-50 border-b border-neutral-200"
          data-testid="report-table-caption"
        >
          <h4 className="font-medium text-neutral-900">{caption}</h4>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <div 
          className="min-w-full grid"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {/* Header Row */}
          <div 
            className={cn(
              "contents",
              stickyHeader && "table-sticky-header"
            )}
            data-testid="report-table-header"
          >
            {columns.map((column, index) => (
              <div
                key={column.key}
                className={cn(
                  "bg-neutral-100 border-b-2 border-neutral-300",
                  "px-3 py-3 font-semibold text-sm text-neutral-700",
                  "uppercase tracking-wide",
                  getAlignmentClass(column.align),
                  compact ? "py-2" : "py-3",
                  index === 0 && "border-l-0",
                  index === columns.length - 1 && "border-r-0"
                )}
                data-testid={`report-table-header-${column.key}`}
              >
                {column.header}
              </div>
            ))}
          </div>
          
          {/* Data Rows */}
          {data.map((row, rowIndex) => (
            <div 
              key={rowIndex}
              className="contents"
              data-testid={`report-table-row-${rowIndex}`}
            >
              {columns.map((column, colIndex) => (
                <div
                  key={`${rowIndex}-${column.key}`}
                  className={cn(
                    "px-3 border-b border-neutral-200",
                    "text-sm text-neutral-900",
                    getAlignmentClass(column.align),
                    compact ? "py-2" : "py-3",
                    // Zebra striping
                    zebraRows && rowIndex % 2 === 1 && "bg-neutral-50",
                    // Tabular numbers for numeric columns
                    (column.type === "number" || column.type === "currency" || column.type === "percentage") && "tabular-nums",
                    // Right-align numeric values if not explicitly set
                    !column.align && (column.type === "number" || column.type === "currency" || column.type === "percentage") && "text-right",
                    colIndex === 0 && "border-l-0",
                    colIndex === columns.length - 1 && "border-r-0"
                  )}
                  data-testid={`report-table-cell-${rowIndex}-${column.key}`}
                >
                  {formatValue(row[column.key], column)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ReportTable;