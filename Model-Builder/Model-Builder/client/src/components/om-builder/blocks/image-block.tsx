import React from 'react';
import { OmBlock } from "@/lib/types";
import { ImageIcon } from "lucide-react";

interface ImageBlockProps {
  block: OmBlock;
}

export function ImageBlock({ block }: ImageBlockProps) {
  const { content, style } = block;
  
  if (!content.url) {
    return (
      <div 
        className="w-full h-48 bg-muted/50 rounded-sm flex flex-col items-center justify-center gap-2 border border-dashed border-muted-foreground/30"
        style={style}
        data-testid={`image-block-${block.id}`}
      >
        <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
        <span className="text-sm text-muted-foreground">No image selected</span>
      </div>
    );
  }

  return (
    <div 
      className="w-full overflow-hidden rounded-sm" 
      style={style}
      data-testid={`image-block-${block.id}`}
    >
      <img 
        src={content.url} 
        alt={content.alt || 'Image'} 
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {content.caption && (
        <p className="text-xs text-muted-foreground text-center mt-2 italic">
          {content.caption}
        </p>
      )}
    </div>
  );
}
