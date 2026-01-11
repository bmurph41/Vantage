import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { OmBlock, OmPage } from '../types';

const MAX_HISTORY_LENGTH = 50;

interface EditorSnapshot {
  blocks: OmBlock[];
  pages: OmPage[];
  timestamp: number;
}

interface AutosaveState {
  lastSavedAt: number | null;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  error: string | null;
}

interface EditorState {
  blocks: OmBlock[];
  pages: OmPage[];
  selectedBlockIds: string[];
  activePageId: string | null;
  
  zoom: number;
  showGrid: boolean;
  showRulers: boolean;
  showGuides: boolean;
  showBleedMargins: boolean;
  snapToGrid: boolean;
  gridSize: number;
  
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  
  autosave: AutosaveState;
  
  setBlocks: (blocks: OmBlock[]) => void;
  setPages: (pages: OmPage[]) => void;
  setActivePageId: (id: string | null) => void;
  
  updateBlock: (blockId: string, updates: Partial<OmBlock>) => void;
  updateBlockPosition: (blockId: string, x: number, y: number) => void;
  updateBlockSize: (blockId: string, width: number, height: number) => void;
  addBlock: (block: OmBlock) => void;
  deleteBlock: (blockId: string) => void;
  deleteBlocks: (blockIds: string[]) => void;
  duplicateBlock: (blockId: string) => OmBlock | null;
  
  setSelectedBlockIds: (ids: string[]) => void;
  selectBlock: (blockId: string, addToSelection?: boolean) => void;
  clearSelection: () => void;
  selectAllOnPage: () => void;
  
  bringForward: (blockId: string) => void;
  sendBackward: (blockId: string) => void;
  bringToFront: (blockId: string) => void;
  sendToBack: (blockId: string) => void;
  
  groupBlocks: (blockIds: string[]) => void;
  ungroupBlock: (groupId: string) => void;
  
  lockBlock: (blockId: string) => void;
  unlockBlock: (blockId: string) => void;
  toggleBlockVisibility: (blockId: string) => void;
  
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushToHistory: () => void;
  
  setZoom: (zoom: number) => void;
  setShowGrid: (show: boolean) => void;
  setShowRulers: (show: boolean) => void;
  setShowGuides: (show: boolean) => void;
  setShowBleedMargins: (show: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  
  setAutosaveState: (state: Partial<AutosaveState>) => void;
  markSaved: () => void;
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    blocks: [],
    pages: [],
    selectedBlockIds: [],
    activePageId: null,
    
    zoom: 0.75,
    showGrid: true,
    showRulers: true,
    showGuides: true,
    showBleedMargins: false,
    snapToGrid: true,
    gridSize: 8,
    
    past: [],
    future: [],
    
    autosave: {
      lastSavedAt: null,
      isSaving: false,
      hasUnsavedChanges: false,
      error: null,
    },
    
    setBlocks: (blocks) => set((state) => {
      state.blocks = blocks;
    }),
    
    setPages: (pages) => set((state) => {
      state.pages = pages;
    }),
    
    setActivePageId: (id) => set((state) => {
      state.activePageId = id;
      state.selectedBlockIds = [];
    }),
    
    updateBlock: (blockId, updates) => {
      get().pushToHistory();
      set((state) => {
        const index = state.blocks.findIndex(b => b.id === blockId);
        if (index !== -1) {
          state.blocks[index] = { ...state.blocks[index], ...updates };
          state.autosave.hasUnsavedChanges = true;
        }
      });
    },
    
    updateBlockPosition: (blockId, x, y) => {
      set((state) => {
        const index = state.blocks.findIndex(b => b.id === blockId);
        if (index !== -1) {
          const block = state.blocks[index];
          state.blocks[index] = {
            ...block,
            position: {
              ...(block.position || { width: 200, height: 100, rotation: 0 }),
              x,
              y,
            },
          };
          state.autosave.hasUnsavedChanges = true;
        }
      });
    },
    
    updateBlockSize: (blockId, width, height) => {
      set((state) => {
        const index = state.blocks.findIndex(b => b.id === blockId);
        if (index !== -1) {
          const block = state.blocks[index];
          state.blocks[index] = {
            ...block,
            position: {
              ...(block.position || { x: 50, y: 50, rotation: 0 }),
              width,
              height,
            },
          };
          state.autosave.hasUnsavedChanges = true;
        }
      });
    },
    
    addBlock: (block) => {
      get().pushToHistory();
      set((state) => {
        state.blocks.push(block);
        state.selectedBlockIds = [block.id];
        state.autosave.hasUnsavedChanges = true;
      });
    },
    
    deleteBlock: (blockId) => {
      get().pushToHistory();
      set((state) => {
        state.blocks = state.blocks.filter(b => b.id !== blockId);
        state.selectedBlockIds = state.selectedBlockIds.filter(id => id !== blockId);
        state.autosave.hasUnsavedChanges = true;
      });
    },
    
    deleteBlocks: (blockIds) => {
      get().pushToHistory();
      set((state) => {
        state.blocks = state.blocks.filter(b => !blockIds.includes(b.id));
        state.selectedBlockIds = state.selectedBlockIds.filter(id => !blockIds.includes(id));
        state.autosave.hasUnsavedChanges = true;
      });
    },
    
    duplicateBlock: (blockId) => {
      const state = get();
      const block = state.blocks.find(b => b.id === blockId);
      if (!block) return null;
      
      const newBlock: OmBlock = {
        ...JSON.parse(JSON.stringify(block)),
        id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        position: {
          x: (block.position?.x || 50) + 20,
          y: (block.position?.y || 50) + 20,
          width: block.position?.width || 200,
          height: block.position?.height || 100,
          rotation: block.position?.rotation || 0,
        },
        meta: {
          ...block.meta,
          name: `${block.meta?.name || block.type} copy`,
          zIndex: Math.max(...state.blocks.map(b => b.meta?.zIndex || 0), 0) + 1,
        },
      };
      
      get().pushToHistory();
      set((s) => {
        s.blocks.push(newBlock);
        s.selectedBlockIds = [newBlock.id];
        s.autosave.hasUnsavedChanges = true;
      });
      
      return newBlock;
    },
    
    setSelectedBlockIds: (ids) => set((state) => {
      state.selectedBlockIds = ids;
    }),
    
    selectBlock: (blockId, addToSelection = false) => set((state) => {
      if (addToSelection) {
        if (state.selectedBlockIds.includes(blockId)) {
          state.selectedBlockIds = state.selectedBlockIds.filter(id => id !== blockId);
        } else {
          state.selectedBlockIds.push(blockId);
        }
      } else {
        state.selectedBlockIds = [blockId];
      }
    }),
    
    clearSelection: () => set((state) => {
      state.selectedBlockIds = [];
    }),
    
    selectAllOnPage: () => {
      const state = get();
      const pageBlocks = state.blocks.filter(b => {
        return true;
      });
      set((s) => {
        s.selectedBlockIds = pageBlocks.map(b => b.id);
      });
    },
    
    bringForward: (blockId) => {
      get().pushToHistory();
      set((state) => {
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return;
        const currentZ = block.meta?.zIndex || 0;
        const maxZ = Math.max(...state.blocks.map(b => b.meta?.zIndex || 0));
        if (currentZ < maxZ) {
          block.meta = { ...block.meta, zIndex: maxZ + 1 };
          state.autosave.hasUnsavedChanges = true;
        }
      });
    },
    
    sendBackward: (blockId) => {
      get().pushToHistory();
      set((state) => {
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return;
        const currentZ = block.meta?.zIndex || 0;
        const minZ = Math.min(...state.blocks.map(b => b.meta?.zIndex || 0));
        if (currentZ > minZ) {
          block.meta = { ...block.meta, zIndex: minZ - 1 };
          state.autosave.hasUnsavedChanges = true;
        }
      });
    },
    
    bringToFront: (blockId) => {
      get().pushToHistory();
      set((state) => {
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return;
        const maxZ = Math.max(...state.blocks.map(b => b.meta?.zIndex || 0));
        block.meta = { ...block.meta, zIndex: maxZ + 1 };
        state.autosave.hasUnsavedChanges = true;
      });
    },
    
    sendToBack: (blockId) => {
      get().pushToHistory();
      set((state) => {
        const block = state.blocks.find(b => b.id === blockId);
        if (!block) return;
        const minZ = Math.min(...state.blocks.map(b => b.meta?.zIndex || 0));
        block.meta = { ...block.meta, zIndex: minZ - 1 };
        state.autosave.hasUnsavedChanges = true;
      });
    },
    
    groupBlocks: (blockIds) => {
      if (blockIds.length < 2) return;
      get().pushToHistory();
      
      set((state) => {
        const blocksToGroup = state.blocks.filter(b => blockIds.includes(b.id));
        if (blocksToGroup.length < 2) return;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        blocksToGroup.forEach(b => {
          const x = b.position?.x || 0;
          const y = b.position?.y || 0;
          const w = b.position?.width || 200;
          const h = b.position?.height || 100;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y + h);
        });
        
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const maxZ = Math.max(...state.blocks.map(b => b.meta?.zIndex || 0));
        
        const groupBlock: OmBlock = {
          id: groupId,
          type: 'group',
          content: { childIds: blockIds },
          position: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          },
          meta: {
            name: 'Group',
            zIndex: maxZ + 1,
          },
        };
        
        blocksToGroup.forEach(b => {
          if (b.position) {
            b.position = {
              ...b.position,
              x: b.position.x - minX,
              y: b.position.y - minY,
            };
          }
          b.meta = { ...b.meta, parentId: groupId, hidden: true };
        });
        
        state.blocks.push(groupBlock);
        state.selectedBlockIds = [groupId];
        state.autosave.hasUnsavedChanges = true;
      });
    },
    
    ungroupBlock: (groupId) => {
      get().pushToHistory();
      set((state) => {
        const group = state.blocks.find(b => b.id === groupId && b.type === 'group');
        if (!group) return;
        
        const childIds = (group.content?.childIds || []) as string[];
        const groupPos = group.position || { x: 0, y: 0 };
        
        state.blocks.forEach(b => {
          if (childIds.includes(b.id)) {
            if (b.position) {
              b.position = {
                ...b.position,
                x: b.position.x + groupPos.x,
                y: b.position.y + groupPos.y,
              };
            }
            if (b.meta) {
              delete b.meta.parentId;
              b.meta.hidden = false;
            }
          }
        });
        
        state.blocks = state.blocks.filter(b => b.id !== groupId);
        state.selectedBlockIds = childIds;
        state.autosave.hasUnsavedChanges = true;
      });
    },
    
    lockBlock: (blockId) => set((state) => {
      const block = state.blocks.find(b => b.id === blockId);
      if (block) {
        block.meta = { ...block.meta, locked: true };
        state.autosave.hasUnsavedChanges = true;
      }
    }),
    
    unlockBlock: (blockId) => set((state) => {
      const block = state.blocks.find(b => b.id === blockId);
      if (block) {
        block.meta = { ...block.meta, locked: false };
        state.autosave.hasUnsavedChanges = true;
      }
    }),
    
    toggleBlockVisibility: (blockId) => set((state) => {
      const block = state.blocks.find(b => b.id === blockId);
      if (block) {
        block.meta = { ...block.meta, hidden: !block.meta?.hidden };
        state.autosave.hasUnsavedChanges = true;
      }
    }),
    
    undo: () => {
      const state = get();
      if (state.past.length === 0) return;
      
      const previous = state.past[state.past.length - 1];
      const current: EditorSnapshot = {
        blocks: JSON.parse(JSON.stringify(state.blocks)),
        pages: JSON.parse(JSON.stringify(state.pages)),
        timestamp: Date.now(),
      };
      
      set((s) => {
        s.past.pop();
        s.future.push(current);
        s.blocks = previous.blocks;
        s.pages = previous.pages;
        s.autosave.hasUnsavedChanges = true;
      });
    },
    
    redo: () => {
      const state = get();
      if (state.future.length === 0) return;
      
      const next = state.future[state.future.length - 1];
      const current: EditorSnapshot = {
        blocks: JSON.parse(JSON.stringify(state.blocks)),
        pages: JSON.parse(JSON.stringify(state.pages)),
        timestamp: Date.now(),
      };
      
      set((s) => {
        s.future.pop();
        s.past.push(current);
        s.blocks = next.blocks;
        s.pages = next.pages;
        s.autosave.hasUnsavedChanges = true;
      });
    },
    
    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
    
    pushToHistory: () => {
      const state = get();
      const snapshot: EditorSnapshot = {
        blocks: JSON.parse(JSON.stringify(state.blocks)),
        pages: JSON.parse(JSON.stringify(state.pages)),
        timestamp: Date.now(),
      };
      
      set((s) => {
        s.past.push(snapshot);
        if (s.past.length > MAX_HISTORY_LENGTH) {
          s.past.shift();
        }
        s.future = [];
      });
    },
    
    setZoom: (zoom) => set((state) => {
      state.zoom = Math.max(0.1, Math.min(3, zoom));
    }),
    
    setShowGrid: (show) => set((state) => {
      state.showGrid = show;
    }),
    
    setShowRulers: (show) => set((state) => {
      state.showRulers = show;
    }),
    
    setShowGuides: (show) => set((state) => {
      state.showGuides = show;
    }),
    
    setShowBleedMargins: (show) => set((state) => {
      state.showBleedMargins = show;
    }),
    
    setSnapToGrid: (snap) => set((state) => {
      state.snapToGrid = snap;
    }),
    
    setGridSize: (size) => set((state) => {
      state.gridSize = size;
    }),
    
    setAutosaveState: (autosaveState) => set((state) => {
      state.autosave = { ...state.autosave, ...autosaveState };
    }),
    
    markSaved: () => set((state) => {
      state.autosave.lastSavedAt = Date.now();
      state.autosave.hasUnsavedChanges = false;
      state.autosave.isSaving = false;
      state.autosave.error = null;
    }),
  }))
);
