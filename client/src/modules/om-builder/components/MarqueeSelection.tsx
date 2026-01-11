import { useState, useCallback, useRef, useEffect } from 'react';
import type { OmBlock } from '../types';

interface MarqueeSelectionProps {
  blocks: OmBlock[];
  zoom: number;
  onSelectionComplete: (blockIds: string[]) => void;
  children: React.ReactNode;
}

interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function MarqueeSelection({
  blocks,
  zoom,
  onSelectionComplete,
  children,
}: MarqueeSelectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-block-id]')) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = (e.clientX - rect.left) / zoom;
    const startY = (e.clientY - rect.top) / zoom;

    setIsSelecting(true);
    setSelectionRect({ startX, startY, endX: startX, endY: startY });
  }, [zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !selectionRect) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const endX = (e.clientX - rect.left) / zoom;
    const endY = (e.clientY - rect.top) / zoom;

    setSelectionRect({ ...selectionRect, endX, endY });
  }, [isSelecting, selectionRect, zoom]);

  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !selectionRect) {
      setIsSelecting(false);
      setSelectionRect(null);
      return;
    }

    const left = Math.min(selectionRect.startX, selectionRect.endX);
    const right = Math.max(selectionRect.startX, selectionRect.endX);
    const top = Math.min(selectionRect.startY, selectionRect.endY);
    const bottom = Math.max(selectionRect.startY, selectionRect.endY);

    const selectedIds = blocks
      .filter(block => {
        if (block.meta?.hidden) return false;
        const pos = block.position || { x: 0, y: 0, width: 200, height: 100 };
        const blockLeft = pos.x;
        const blockRight = pos.x + pos.width;
        const blockTop = pos.y;
        const blockBottom = pos.y + pos.height;

        return !(blockRight < left || blockLeft > right || blockBottom < top || blockTop > bottom);
      })
      .map(b => b.id);

    if (selectedIds.length > 0) {
      onSelectionComplete(selectedIds);
    }

    setIsSelecting(false);
    setSelectionRect(null);
  }, [isSelecting, selectionRect, blocks, onSelectionComplete]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) {
        handleMouseUp();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isSelecting, handleMouseUp]);

  const getSelectionStyle = () => {
    if (!selectionRect) return {};
    
    const left = Math.min(selectionRect.startX, selectionRect.endX) * zoom;
    const top = Math.min(selectionRect.startY, selectionRect.endY) * zoom;
    const width = Math.abs(selectionRect.endX - selectionRect.startX) * zoom;
    const height = Math.abs(selectionRect.endY - selectionRect.startY) * zoom;

    return {
      left,
      top,
      width,
      height,
    };
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {children}
      {isSelecting && selectionRect && (
        <div
          className="absolute border-2 border-primary bg-primary/10 pointer-events-none z-50"
          style={getSelectionStyle()}
        />
      )}
    </div>
  );
}
