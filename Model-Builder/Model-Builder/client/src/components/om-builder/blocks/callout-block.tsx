import React from 'react';
import { OmBlock } from "@/lib/types";
import { Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalloutBlockProps {
  block: OmBlock;
}

const calloutStyles = {
  info: {
    bg: "bg-blue-50 border-blue-200",
    icon: Info,
    iconColor: "text-blue-600"
  },
  warning: {
    bg: "bg-amber-50 border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-600"
  },
  success: {
    bg: "bg-green-50 border-green-200",
    icon: CheckCircle,
    iconColor: "text-green-600"
  },
  error: {
    bg: "bg-red-50 border-red-200",
    icon: XCircle,
    iconColor: "text-red-600"
  }
};

export function CalloutBlock({ block }: CalloutBlockProps) {
  const { content, style } = block;
  const variant = content.variant || 'info';
  const calloutStyle = calloutStyles[variant as keyof typeof calloutStyles] || calloutStyles.info;
  const Icon = calloutStyle.icon;

  return (
    <div 
      className={cn(
        "p-4 rounded-lg border flex gap-3",
        calloutStyle.bg
      )}
      style={style}
      data-testid={`callout-block-${block.id}`}
    >
      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", calloutStyle.iconColor)} />
      <div className="flex-1">
        {content.title && (
          <h4 className="font-semibold text-foreground mb-1">{content.title}</h4>
        )}
        <p className="text-sm text-muted-foreground">{content.text || 'Callout text'}</p>
      </div>
    </div>
  );
}
