import { useMemo } from 'react';

interface CanvasRulersProps {
  width: number;
  height: number;
  zoom: number;
  offsetX?: number;
  offsetY?: number;
  unit?: 'px' | 'in' | 'cm';
}

const RULER_SIZE = 20;

export function CanvasRulers({
  width,
  height,
  zoom,
  offsetX = 0,
  offsetY = 0,
  unit = 'px',
}: CanvasRulersProps) {
  const pixelsPerUnit = unit === 'in' ? 96 : unit === 'cm' ? 37.8 : 1;
  const majorTickInterval = unit === 'px' ? 100 : 1;
  const minorTickCount = unit === 'px' ? 5 : 4;

  const horizontalTicks = useMemo(() => {
    const ticks: { position: number; label: string; major: boolean }[] = [];
    const scaledWidth = width * zoom;
    const intervalPx = majorTickInterval * pixelsPerUnit * zoom;
    const minorIntervalPx = intervalPx / minorTickCount;

    for (let i = 0; i <= scaledWidth; i += minorIntervalPx) {
      const isMajor = Math.abs(i % intervalPx) < 0.1;
      const value = Math.round((i / zoom) / pixelsPerUnit);
      ticks.push({
        position: i + offsetX,
        label: isMajor ? String(value) : '',
        major: isMajor,
      });
    }
    return ticks;
  }, [width, zoom, offsetX, pixelsPerUnit, majorTickInterval, minorTickCount]);

  const verticalTicks = useMemo(() => {
    const ticks: { position: number; label: string; major: boolean }[] = [];
    const scaledHeight = height * zoom;
    const intervalPx = majorTickInterval * pixelsPerUnit * zoom;
    const minorIntervalPx = intervalPx / minorTickCount;

    for (let i = 0; i <= scaledHeight; i += minorIntervalPx) {
      const isMajor = Math.abs(i % intervalPx) < 0.1;
      const value = Math.round((i / zoom) / pixelsPerUnit);
      ticks.push({
        position: i + offsetY,
        label: isMajor ? String(value) : '',
        major: isMajor,
      });
    }
    return ticks;
  }, [height, zoom, offsetY, pixelsPerUnit, majorTickInterval, minorTickCount]);

  return (
    <>
      <div
        className="absolute top-0 left-0 bg-muted/90 border-b border-r border-border z-20"
        style={{ width: RULER_SIZE, height: RULER_SIZE }}
      >
        <span className="text-[8px] text-muted-foreground p-0.5">{unit}</span>
      </div>

      <div
        className="absolute left-0 bg-muted/90 border-b border-border overflow-hidden z-10"
        style={{ 
          top: 0, 
          height: RULER_SIZE, 
          left: RULER_SIZE,
          width: `calc(100% - ${RULER_SIZE}px)`,
        }}
      >
        <svg width="100%" height={RULER_SIZE} className="select-none">
          {horizontalTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={tick.position}
                y1={tick.major ? RULER_SIZE * 0.4 : RULER_SIZE * 0.7}
                x2={tick.position}
                y2={RULER_SIZE}
                stroke="currentColor"
                strokeWidth={0.5}
                className="text-muted-foreground"
              />
              {tick.label && (
                <text
                  x={tick.position + 2}
                  y={RULER_SIZE * 0.35}
                  className="text-[8px] fill-muted-foreground"
                >
                  {tick.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div
        className="absolute top-0 bg-muted/90 border-r border-border overflow-hidden z-10"
        style={{ 
          left: 0, 
          width: RULER_SIZE, 
          top: RULER_SIZE,
          height: `calc(100% - ${RULER_SIZE}px)`,
        }}
      >
        <svg width={RULER_SIZE} height="100%" className="select-none">
          {verticalTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={tick.major ? RULER_SIZE * 0.4 : RULER_SIZE * 0.7}
                y1={tick.position}
                x2={RULER_SIZE}
                y2={tick.position}
                stroke="currentColor"
                strokeWidth={0.5}
                className="text-muted-foreground"
              />
              {tick.label && (
                <text
                  x={RULER_SIZE * 0.35}
                  y={tick.position + 8}
                  className="text-[8px] fill-muted-foreground"
                  transform={`rotate(-90, ${RULER_SIZE * 0.35}, ${tick.position + 8})`}
                >
                  {tick.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </>
  );
}
