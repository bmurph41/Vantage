import type { OmBlock } from '../types';

interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  position: number;
}

interface AlignmentGuidesProps {
  guides: AlignmentGuide[];
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
}

export function AlignmentGuides({
  guides,
  canvasWidth,
  canvasHeight,
  zoom,
}: AlignmentGuidesProps) {
  if (guides.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-50"
      style={{
        width: canvasWidth * zoom,
        height: canvasHeight * zoom,
      }}
    >
      {guides.map((guide, i) => (
        guide.type === 'horizontal' ? (
          <line
            key={`h-${i}`}
            x1={0}
            y1={guide.position * zoom}
            x2={canvasWidth * zoom}
            y2={guide.position * zoom}
            stroke="#f97316"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ) : (
          <line
            key={`v-${i}`}
            x1={guide.position * zoom}
            y1={0}
            x2={guide.position * zoom}
            y2={canvasHeight * zoom}
            stroke="#f97316"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )
      ))}
    </svg>
  );
}

export function calculateAlignmentGuides(
  movingBlock: OmBlock,
  allBlocks: OmBlock[],
  threshold: number = 4
): { guides: AlignmentGuide[]; snapX: number | null; snapY: number | null } {
  const guides: AlignmentGuide[] = [];
  let snapX: number | null = null;
  let snapY: number | null = null;

  const pos = movingBlock.position || { x: 0, y: 0, width: 200, height: 100 };
  const movingLeft = pos.x;
  const movingRight = pos.x + pos.width;
  const movingTop = pos.y;
  const movingBottom = pos.y + pos.height;
  const movingCenterX = pos.x + pos.width / 2;
  const movingCenterY = pos.y + pos.height / 2;

  const otherBlocks = allBlocks.filter(b => b.id !== movingBlock.id && !b.meta?.hidden);

  for (const block of otherBlocks) {
    const bPos = block.position || { x: 0, y: 0, width: 200, height: 100 };
    const blockLeft = bPos.x;
    const blockRight = bPos.x + bPos.width;
    const blockTop = bPos.y;
    const blockBottom = bPos.y + bPos.height;
    const blockCenterX = bPos.x + bPos.width / 2;
    const blockCenterY = bPos.y + bPos.height / 2;

    if (Math.abs(movingLeft - blockLeft) < threshold) {
      guides.push({ type: 'vertical', position: blockLeft });
      snapX = blockLeft;
    }
    if (Math.abs(movingRight - blockRight) < threshold) {
      guides.push({ type: 'vertical', position: blockRight });
      snapX = blockRight - pos.width;
    }
    if (Math.abs(movingLeft - blockRight) < threshold) {
      guides.push({ type: 'vertical', position: blockRight });
      snapX = blockRight;
    }
    if (Math.abs(movingRight - blockLeft) < threshold) {
      guides.push({ type: 'vertical', position: blockLeft });
      snapX = blockLeft - pos.width;
    }
    if (Math.abs(movingCenterX - blockCenterX) < threshold) {
      guides.push({ type: 'vertical', position: blockCenterX });
      snapX = blockCenterX - pos.width / 2;
    }

    if (Math.abs(movingTop - blockTop) < threshold) {
      guides.push({ type: 'horizontal', position: blockTop });
      snapY = blockTop;
    }
    if (Math.abs(movingBottom - blockBottom) < threshold) {
      guides.push({ type: 'horizontal', position: blockBottom });
      snapY = blockBottom - pos.height;
    }
    if (Math.abs(movingTop - blockBottom) < threshold) {
      guides.push({ type: 'horizontal', position: blockBottom });
      snapY = blockBottom;
    }
    if (Math.abs(movingBottom - blockTop) < threshold) {
      guides.push({ type: 'horizontal', position: blockTop });
      snapY = blockTop - pos.height;
    }
    if (Math.abs(movingCenterY - blockCenterY) < threshold) {
      guides.push({ type: 'horizontal', position: blockCenterY });
      snapY = blockCenterY - pos.height / 2;
    }
  }

  const uniqueGuides = guides.filter((guide, index, self) =>
    index === self.findIndex(g => g.type === guide.type && g.position === guide.position)
  );

  return { guides: uniqueGuides, snapX, snapY };
}
