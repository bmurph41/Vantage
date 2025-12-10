import React from 'react';
import { OmBlock } from "@/lib/types";

interface TextBlockProps {
  block: OmBlock;
}

export function TextBlock({ block }: TextBlockProps) {
  const { content, style } = block;
  
  return (
    <div className="prose prose-sm max-w-none text-foreground" style={style}>
      {content.markdown ? (
        <div 
          dangerouslySetInnerHTML={{ 
            __html: content.markdown
              .replace(/\n/g, '<br/>')
              .replace(/# (.*)/g, '<h1 class="text-2xl font-bold mb-4 font-serif">$1</h1>')
              .replace(/## (.*)/g, '<h2 class="text-xl font-semibold mb-3 font-serif">$1</h2>')
              .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>') 
          }} 
        />
      ) : (
        <p className="text-muted-foreground italic">Empty text block</p>
      )}
    </div>
  );
}
