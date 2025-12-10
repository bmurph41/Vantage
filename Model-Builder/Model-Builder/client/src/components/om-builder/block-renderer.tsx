import React from 'react';
import { OmBlock } from "@/lib/types";
import { TextBlock } from "./blocks/text-block";
import { HeadingBlock } from "./blocks/heading-block";
import { CalloutBlock } from "./blocks/callout-block";
import { KPIBlock } from "./blocks/kpi-block";
import { ChartBlock } from "./blocks/chart-block";
import { ImageBlock } from "./blocks/image-block";
import { TableBlock } from "./blocks/table-block";
import { MapBlock } from "./blocks/map-block";

interface BlockRendererProps {
  block: OmBlock;
  projectId?: string;
}

export function BlockRenderer({ block, projectId = "proj_1" }: BlockRendererProps) {
  switch (block.type) {
    case 'text':
      return <TextBlock block={block} />;

    case 'heading':
      return <HeadingBlock block={block} />;

    case 'callout':
      return <CalloutBlock block={block} />;

    case 'kpi':
      return <KPIBlock block={block} projectId={projectId} />;

    case 'chart':
    case 'line-chart':
    case 'area-chart':
    case 'pie-chart':
      return <ChartBlock block={block} projectId={projectId} />;

    case 'image':
      return <ImageBlock block={block} />;

    case 'table':
      return <TableBlock block={block} projectId={projectId} />;

    case 'map':
      return <MapBlock block={block} />;

    default:
      return (
        <div 
          className="p-4 border border-dashed rounded text-center text-muted-foreground"
          data-testid={`unknown-block-${block.id}`}
        >
          Unknown Block Type: {block.type}
        </div>
      );
  }
}
