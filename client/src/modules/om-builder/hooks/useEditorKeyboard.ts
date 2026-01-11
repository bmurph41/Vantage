import { useEffect, useCallback } from 'react';
import { useEditorStore } from '../store/editor-store';
import { toast } from '@/hooks/use-toast';

export function useEditorKeyboard() {
  const {
    selectedBlockIds,
    blocks,
    undo,
    redo,
    canUndo,
    canRedo,
    deleteBlocks,
    duplicateBlock,
    groupBlocks,
    ungroupBlock,
    updateBlockPosition,
    selectAllOnPage,
    bringToFront,
    sendToBack,
  } = useEditorStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo()) {
        undo();
        toast({ title: 'Undo', description: 'Action undone' });
      }
      return;
    }

    if (modKey && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      if (canRedo()) {
        redo();
        toast({ title: 'Redo', description: 'Action redone' });
      }
      return;
    }

    if (modKey && e.key === 'y' && !isMac) {
      e.preventDefault();
      if (canRedo()) {
        redo();
        toast({ title: 'Redo', description: 'Action redone' });
      }
      return;
    }

    if (modKey && e.key === 'a') {
      e.preventDefault();
      selectAllOnPage();
      return;
    }

    if (modKey && e.key === 'g' && !e.shiftKey) {
      e.preventDefault();
      if (selectedBlockIds.length >= 2) {
        groupBlocks(selectedBlockIds);
        toast({ title: 'Grouped', description: `${selectedBlockIds.length} elements grouped` });
      }
      return;
    }

    if (modKey && e.key === 'g' && e.shiftKey) {
      e.preventDefault();
      if (selectedBlockIds.length === 1) {
        const block = blocks.find(b => b.id === selectedBlockIds[0]);
        if (block?.type === 'group') {
          ungroupBlock(selectedBlockIds[0]);
          toast({ title: 'Ungrouped', description: 'Group ungrouped' });
        }
      }
      return;
    }

    if (modKey && e.key === 'd') {
      e.preventDefault();
      if (selectedBlockIds.length === 1) {
        duplicateBlock(selectedBlockIds[0]);
        toast({ title: 'Duplicated', description: 'Element duplicated' });
      }
      return;
    }

    if (modKey && e.key === ']') {
      e.preventDefault();
      selectedBlockIds.forEach(id => bringToFront(id));
      return;
    }

    if (modKey && e.key === '[') {
      e.preventDefault();
      selectedBlockIds.forEach(id => sendToBack(id));
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockIds.length > 0) {
      e.preventDefault();
      deleteBlocks(selectedBlockIds);
      toast({ title: 'Deleted', description: `${selectedBlockIds.length} element(s) deleted` });
      return;
    }

    const nudgeAmount = e.shiftKey ? 10 : 1;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      selectedBlockIds.forEach(blockId => {
        const block = blocks.find(b => b.id === blockId);
        if (!block || block.meta?.locked) return;
        
        const pos = block.position || { x: 50, y: 50, width: 200, height: 100 };
        let newX = pos.x;
        let newY = pos.y;
        
        switch (e.key) {
          case 'ArrowUp': newY -= nudgeAmount; break;
          case 'ArrowDown': newY += nudgeAmount; break;
          case 'ArrowLeft': newX -= nudgeAmount; break;
          case 'ArrowRight': newX += nudgeAmount; break;
        }
        
        updateBlockPosition(blockId, newX, newY);
      });
      return;
    }
  }, [
    selectedBlockIds,
    blocks,
    undo,
    redo,
    canUndo,
    canRedo,
    deleteBlocks,
    duplicateBlock,
    groupBlocks,
    ungroupBlock,
    updateBlockPosition,
    selectAllOnPage,
    bringToFront,
    sendToBack,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
