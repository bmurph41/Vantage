import React from 'react';
import { OmBlock, OmDataResponse } from "@/lib/types";
import { fetchOmData } from "@/lib/om-data-api";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TableBlockProps {
  block: OmBlock;
  projectId?: string;
}

export function TableBlock({ block, projectId = "proj_1" }: TableBlockProps) {
  const { content, style, dataBinding } = block;
  const [realData, setRealData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (dataBinding?.sourceType && dataBinding.sourceType !== 'manual' && dataBinding.bindingRole) {
      setLoading(true);
      fetchOmData(projectId, dataBinding.sourceType)
        .then((response: OmDataResponse) => {
          const [cat, key] = dataBinding.bindingRole!.split('.');
          if (cat === 'tables') {
            setRealData(response.tables.find(t => t.id === key));
          }
        })
        .finally(() => setLoading(false));
    } else {
      setRealData(null);
    }
  }, [dataBinding, projectId]);

  const tableData = realData || content || { 
    columns: [
      { id: 'metric', label: 'Metric' }, 
      { id: 'y1', label: 'Year 1', align: 'right' }
    ],
    rows: [
      { metric: 'Gross Revenue', y1: '$1,200,000' }, 
      { metric: 'NOI', y1: '$750,000' }
    ]
  };

  return (
    <div 
      className="w-full border rounded-md overflow-hidden relative" 
      style={style}
      data-testid={`table-block-${block.id}`}
    >
      {loading && (
        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      <table className="w-full text-sm text-left">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            {tableData.columns?.map((col: any) => (
              <th 
                key={col.id} 
                className={cn(
                  "px-4 py-2 font-medium",
                  col.align === 'right' && "text-right"
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {tableData.rows?.map((row: any, idx: number) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/30'}>
              {tableData.columns?.map((col: any) => (
                <td 
                  key={col.id} 
                  className={cn(
                    "px-4 py-2",
                    col.align === 'right' && "text-right font-mono"
                  )}
                >
                  {row[col.id]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
