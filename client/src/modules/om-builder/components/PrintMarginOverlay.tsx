interface PrintMarginOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  bleed?: { top: number; right: number; bottom: number; left: number };
  safetyMargin?: { top: number; right: number; bottom: number; left: number };
  showBleed?: boolean;
  showTrim?: boolean;
  showSafety?: boolean;
}

export function PrintMarginOverlay({
  canvasWidth,
  canvasHeight,
  zoom,
  bleed = { top: 9, right: 9, bottom: 9, left: 9 },
  safetyMargin = { top: 36, right: 36, bottom: 36, left: 36 },
  showBleed = false,
  showTrim = true,
  showSafety = true,
}: PrintMarginOverlayProps) {
  const scaledWidth = canvasWidth * zoom;
  const scaledHeight = canvasHeight * zoom;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-40"
      width={scaledWidth}
      height={scaledHeight}
    >
      {showBleed && (
        <>
          <rect
            x={0}
            y={0}
            width={bleed.left * zoom}
            height={scaledHeight}
            fill="rgba(239, 68, 68, 0.1)"
          />
          <rect
            x={scaledWidth - bleed.right * zoom}
            y={0}
            width={bleed.right * zoom}
            height={scaledHeight}
            fill="rgba(239, 68, 68, 0.1)"
          />
          <rect
            x={bleed.left * zoom}
            y={0}
            width={scaledWidth - (bleed.left + bleed.right) * zoom}
            height={bleed.top * zoom}
            fill="rgba(239, 68, 68, 0.1)"
          />
          <rect
            x={bleed.left * zoom}
            y={scaledHeight - bleed.bottom * zoom}
            width={scaledWidth - (bleed.left + bleed.right) * zoom}
            height={bleed.bottom * zoom}
            fill="rgba(239, 68, 68, 0.1)"
          />
          <rect
            x={bleed.left * zoom}
            y={bleed.top * zoom}
            width={scaledWidth - (bleed.left + bleed.right) * zoom}
            height={scaledHeight - (bleed.top + bleed.bottom) * zoom}
            fill="none"
            stroke="#ef4444"
            strokeWidth={1}
            strokeDasharray="8 4"
          />
        </>
      )}

      {showTrim && (
        <rect
          x={0}
          y={0}
          width={scaledWidth}
          height={scaledHeight}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1}
        />
      )}

      {showSafety && (
        <rect
          x={safetyMargin.left * zoom}
          y={safetyMargin.top * zoom}
          width={scaledWidth - (safetyMargin.left + safetyMargin.right) * zoom}
          height={scaledHeight - (safetyMargin.top + safetyMargin.bottom) * zoom}
          fill="none"
          stroke="#22c55e"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}
    </svg>
  );
}
