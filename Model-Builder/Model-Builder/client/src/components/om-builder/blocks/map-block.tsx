import React from 'react';
import { OmBlock } from "@/lib/types";
import { MapPin } from "lucide-react";

interface MapBlockProps {
  block: OmBlock;
}

export function MapBlock({ block }: MapBlockProps) {
  const { content, style } = block;
  
  if (!content.embedUrl && !content.address) {
    return (
      <div 
        className="w-full h-64 bg-muted/50 rounded-sm flex flex-col items-center justify-center gap-2 border border-dashed border-muted-foreground/30"
        style={style}
        data-testid={`map-block-${block.id}`}
      >
        <MapPin className="w-8 h-8 text-muted-foreground/50" />
        <span className="text-sm text-muted-foreground">No location set</span>
      </div>
    );
  }

  if (content.embedUrl) {
    return (
      <div 
        className="w-full h-64 rounded-sm overflow-hidden" 
        style={style}
        data-testid={`map-block-${block.id}`}
      >
        <iframe
          src={content.embedUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Map"
        />
      </div>
    );
  }

  const encodedAddress = encodeURIComponent(content.address || '');
  const mapSrc = `https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${encodedAddress}`;

  return (
    <div 
      className="w-full h-64 rounded-sm overflow-hidden relative" 
      style={style}
      data-testid={`map-block-${block.id}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-200 flex flex-col items-center justify-center gap-2">
        <MapPin className="w-12 h-12 text-primary" />
        <span className="text-sm font-medium text-foreground">{content.address}</span>
        <span className="text-xs text-muted-foreground">Map preview (API key required)</span>
      </div>
    </div>
  );
}
