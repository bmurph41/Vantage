import React from 'react';
import { OmBlock } from "@/lib/types";

interface HeadingBlockProps {
  block: OmBlock;
}

export function HeadingBlock({ block }: HeadingBlockProps) {
  const { content, style } = block;
  const level = content.level || 1;
  
  const headingClasses: Record<number, string> = {
    1: "text-3xl font-bold font-serif text-foreground",
    2: "text-2xl font-semibold font-serif text-foreground",
    3: "text-xl font-semibold text-foreground",
    4: "text-lg font-medium text-foreground",
  };

  const className = headingClasses[level] || headingClasses[1];
  const text = content.text || 'Heading';

  switch (level) {
    case 1:
      return <h1 className={className} style={style} data-testid={`heading-block-${block.id}`}>{text}</h1>;
    case 2:
      return <h2 className={className} style={style} data-testid={`heading-block-${block.id}`}>{text}</h2>;
    case 3:
      return <h3 className={className} style={style} data-testid={`heading-block-${block.id}`}>{text}</h3>;
    case 4:
      return <h4 className={className} style={style} data-testid={`heading-block-${block.id}`}>{text}</h4>;
    default:
      return <h1 className={className} style={style} data-testid={`heading-block-${block.id}`}>{text}</h1>;
  }
}
