import React from 'react';
import { OmBlock, OmDataResponse } from "@/lib/types";
import { fetchOmData } from "@/lib/om-data-api";
import { Loader2 } from "lucide-react";

interface KPIBlockProps {
  block: OmBlock;
  projectId?: string;
}

export function KPIBlock({ block, projectId = "proj_1" }: KPIBlockProps) {
  const { content, style, dataBinding } = block;
  const [realData, setRealData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (dataBinding?.sourceType && dataBinding.sourceType !== 'manual' && dataBinding.bindingRole) {
      setLoading(true);
      fetchOmData(projectId, dataBinding.sourceType)
        .then((response: OmDataResponse) => {
          const [cat, key] = dataBinding.bindingRole!.split('.');
          if (cat === 'metrics') {
            setRealData(response.metrics[key]);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setRealData(null);
    }
  }, [dataBinding, projectId]);

  const displayItems = realData 
    ? [{ ...content.items?.[0], value: typeof realData === 'number' ? realData.toLocaleString() : realData }] 
    : content.items || [];

  return (
    <div 
      className="grid grid-cols-3 gap-4 py-4" 
      style={style}
      data-testid={`kpi-block-${block.id}`}
    >
      {displayItems.map((item: any, idx: number) => (
        <div key={idx} className="flex flex-col border-l-2 border-primary/20 pl-4 relative">
          {loading && idx === 0 && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          )}
          <span className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
            {item.label}
          </span>
          <span className="text-2xl font-bold text-primary font-mono mt-1">
            {item.value}
          </span>
          {item.subtext && (
            <span className="text-xs text-muted-foreground mt-1">{item.subtext}</span>
          )}
        </div>
      ))}
    </div>
  );
}
