import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type BlockType = 'text' | 'image' | 'kpi' | 'chart' | 'table' | 'shape' | 'header' | 'footer' | 'divider';

export interface BlockPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
}

export interface BlockStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  opacity?: number;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
}

export interface TextBlockData {
  type: 'text';
  content: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  color?: string;
}

export interface ImageBlockData {
  type: 'image';
  src: string;
  alt?: string;
  fit: 'cover' | 'contain' | 'fill';
}

export interface KpiBlockData {
  type: 'kpi';
  label: string;
  value: string | number;
  format?: 'currency' | 'percent' | 'number';
  prefix?: string;
  suffix?: string;
  binding?: { source: string; field: string };
}

export interface ChartBlockData {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'donut';
  data?: any[];
  binding?: { source: string; field: string };
}

export interface TableBlockData {
  type: 'table';
  columns: { key: string; label: string }[];
  rows: Record<string, any>[];
  binding?: { source: string; field: string };
}

export interface ShapeBlockData {
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'line';
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export type BlockData = 
  | TextBlockData 
  | ImageBlockData 
  | KpiBlockData 
  | ChartBlockData 
  | TableBlockData 
  | ShapeBlockData;

export interface OmBlock {
  id: string;
  pageId: string;
  position: BlockPosition;
  style: BlockStyle;
  data: BlockData;
  locked?: boolean;
  name?: string;
}

export interface OmPage {
  id: string;
  name: string;
  order: number;
  pageSize: 'letter' | 'a4' | 'custom';
  orientation: 'portrait' | 'landscape';
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundImage?: string;
}

export interface OmDocument {
  id: string;
  name: string;
  docType: string;
  status: 'draft' | 'published';
  brandKitId?: string;
  modelingProjectId?: string;
  dealId?: string;
}

interface HistoryEntry {
  pages: OmPage[];
  blocks: OmBlock[];
  timestamp: number;
}

interface EditorState {
  document: OmDocument | null;
  pages: OmPage[];
  blocks: OmBlock[];
  
  currentPageId: string | null;
  selectedBlockIds: string[];
  hoveredBlockId: string | null;
  
  zoom: number;
  panX: number;
  panY: number;
  
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  showGuides: boolean;
  showBleed: boolean;
  
  history: HistoryEntry[];
  historyIndex: number;
  isDirty: boolean;
  lastSavedAt: string | null;
  
  clipboard: OmBlock[];
  
  activeTool: 'select' | 'text' | 'image' | 'shape' | 'pan';
  inspectorTab: 'style' | 'data' | 'bindings';
  
  sidebarOpen: {
    left: boolean;
    right: boolean;
  };
}

interface EditorActions {
  setDocument: (doc: OmDocument | null) => void;
  setPages: (pages: OmPage[]) => void;
  setBlocks: (blocks: OmBlock[]) => void;
  
  setCurrentPage: (pageId: string) => void;
  addPage: (page: OmPage) => void;
  updatePage: (pageId: string, updates: Partial<OmPage>) => void;
  deletePage: (pageId: string) => void;
  reorderPages: (pageIds: string[]) => void;
  
  addBlock: (block: OmBlock) => void;
  updateBlock: (blockId: string, updates: Partial<OmBlock>) => void;
  updateBlockPosition: (blockId: string, position: Partial<BlockPosition>) => void;
  updateBlockStyle: (blockId: string, style: Partial<BlockStyle>) => void;
  updateBlockData: (blockId: string, data: Partial<BlockData>) => void;
  deleteBlocks: (blockIds: string[]) => void;
  duplicateBlocks: (blockIds: string[]) => void;
  
  selectBlock: (blockId: string, addToSelection?: boolean) => void;
  selectBlocks: (blockIds: string[]) => void;
  deselectAll: () => void;
  selectAll: () => void;
  setHoveredBlock: (blockId: string | null) => void;
  
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  setPan: (x: number, y: number) => void;
  
  setShowGrid: (show: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridSize: (size: number) => void;
  setShowGuides: (show: boolean) => void;
  setShowBleed: (show: boolean) => void;
  
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  copy: () => void;
  paste: () => void;
  cut: () => void;
  
  setActiveTool: (tool: EditorState['activeTool']) => void;
  setInspectorTab: (tab: EditorState['inspectorTab']) => void;
  toggleSidebar: (side: 'left' | 'right') => void;
  
  markDirty: () => void;
  markSaved: () => void;
  
  loadFromSnapshot: (snapshot: any) => void;
  getSnapshot: () => any;
  reset: () => void;
}

const INITIAL_STATE: EditorState = {
  document: null,
  pages: [],
  blocks: [],
  
  currentPageId: null,
  selectedBlockIds: [],
  hoveredBlockId: null,
  
  zoom: 1,
  panX: 0,
  panY: 0,
  
  showGrid: false,
  snapToGrid: true,
  gridSize: 8,
  showGuides: true,
  showBleed: true,
  
  history: [],
  historyIndex: -1,
  isDirty: false,
  lastSavedAt: null,
  
  clipboard: [],
  
  activeTool: 'select',
  inspectorTab: 'style',
  
  sidebarOpen: {
    left: true,
    right: true,
  },
};

export const useOmEditorStore = create<EditorState & EditorActions>()(
  immer((set, get) => ({
    ...INITIAL_STATE,
    
    setDocument: (doc) => set((state) => { state.document = doc; }),
    setPages: (pages) => set((state) => { 
      state.pages = pages;
      if (pages.length > 0 && !state.currentPageId) {
        state.currentPageId = pages[0].id;
      }
    }),
    setBlocks: (blocks) => set((state) => { state.blocks = blocks; }),
    
    setCurrentPage: (pageId) => set((state) => { 
      state.currentPageId = pageId;
      state.selectedBlockIds = [];
    }),
    
    addPage: (page) => set((state) => {
      state.pages.push(page);
      state.isDirty = true;
    }),
    
    updatePage: (pageId, updates) => set((state) => {
      const idx = state.pages.findIndex(p => p.id === pageId);
      if (idx !== -1) {
        Object.assign(state.pages[idx], updates);
        state.isDirty = true;
      }
    }),
    
    deletePage: (pageId) => set((state) => {
      state.pages = state.pages.filter(p => p.id !== pageId);
      state.blocks = state.blocks.filter(b => b.pageId !== pageId);
      if (state.currentPageId === pageId) {
        state.currentPageId = state.pages[0]?.id || null;
      }
      state.isDirty = true;
    }),
    
    reorderPages: (pageIds) => set((state) => {
      const pageMap = new Map(state.pages.map(p => [p.id, p]));
      state.pages = pageIds.map((id, idx) => {
        const page = pageMap.get(id)!;
        page.order = idx;
        return page;
      });
      state.isDirty = true;
    }),
    
    addBlock: (block) => set((state) => {
      state.blocks.push(block);
      state.selectedBlockIds = [block.id];
      state.isDirty = true;
    }),
    
    updateBlock: (blockId, updates) => set((state) => {
      const idx = state.blocks.findIndex(b => b.id === blockId);
      if (idx !== -1) {
        Object.assign(state.blocks[idx], updates);
        state.isDirty = true;
      }
    }),
    
    updateBlockPosition: (blockId, position) => set((state) => {
      const block = state.blocks.find(b => b.id === blockId);
      if (block) {
        Object.assign(block.position, position);
        state.isDirty = true;
      }
    }),
    
    updateBlockStyle: (blockId, style) => set((state) => {
      const block = state.blocks.find(b => b.id === blockId);
      if (block) {
        Object.assign(block.style, style);
        state.isDirty = true;
      }
    }),
    
    updateBlockData: (blockId, data) => set((state) => {
      const block = state.blocks.find(b => b.id === blockId);
      if (block) {
        Object.assign(block.data, data);
        state.isDirty = true;
      }
    }),
    
    deleteBlocks: (blockIds) => set((state) => {
      state.blocks = state.blocks.filter(b => !blockIds.includes(b.id));
      state.selectedBlockIds = state.selectedBlockIds.filter(id => !blockIds.includes(id));
      state.isDirty = true;
    }),
    
    duplicateBlocks: (blockIds) => set((state) => {
      const toDuplicate = state.blocks.filter(b => blockIds.includes(b.id));
      const newBlocks = toDuplicate.map(b => ({
        ...JSON.parse(JSON.stringify(b)),
        id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        position: {
          ...b.position,
          x: b.position.x + 20,
          y: b.position.y + 20,
        },
      }));
      state.blocks.push(...newBlocks);
      state.selectedBlockIds = newBlocks.map(b => b.id);
      state.isDirty = true;
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
    
    selectBlocks: (blockIds) => set((state) => {
      state.selectedBlockIds = blockIds;
    }),
    
    deselectAll: () => set((state) => {
      state.selectedBlockIds = [];
    }),
    
    selectAll: () => set((state) => {
      const currentPageBlocks = state.blocks.filter(b => b.pageId === state.currentPageId);
      state.selectedBlockIds = currentPageBlocks.map(b => b.id);
    }),
    
    setHoveredBlock: (blockId) => set((state) => {
      state.hoveredBlockId = blockId;
    }),
    
    setZoom: (zoom) => set((state) => {
      state.zoom = Math.max(0.1, Math.min(4, zoom));
    }),
    
    zoomIn: () => set((state) => {
      state.zoom = Math.min(4, state.zoom * 1.25);
    }),
    
    zoomOut: () => set((state) => {
      state.zoom = Math.max(0.1, state.zoom / 1.25);
    }),
    
    zoomToFit: () => set((state) => {
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
    }),
    
    setPan: (x, y) => set((state) => {
      state.panX = x;
      state.panY = y;
    }),
    
    setShowGrid: (show) => set((state) => { state.showGrid = show; }),
    setSnapToGrid: (snap) => set((state) => { state.snapToGrid = snap; }),
    setGridSize: (size) => set((state) => { state.gridSize = size; }),
    setShowGuides: (show) => set((state) => { state.showGuides = show; }),
    setShowBleed: (show) => set((state) => { state.showBleed = show; }),
    
    pushHistory: () => set((state) => {
      const entry: HistoryEntry = {
        pages: JSON.parse(JSON.stringify(state.pages)),
        blocks: JSON.parse(JSON.stringify(state.blocks)),
        timestamp: Date.now(),
      };
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(entry);
      state.historyIndex = state.history.length - 1;
      if (state.history.length > 50) {
        state.history = state.history.slice(-50);
        state.historyIndex = state.history.length - 1;
      }
    }),
    
    undo: () => set((state) => {
      if (state.historyIndex > 0) {
        state.historyIndex -= 1;
        const entry = state.history[state.historyIndex];
        state.pages = JSON.parse(JSON.stringify(entry.pages));
        state.blocks = JSON.parse(JSON.stringify(entry.blocks));
        state.isDirty = true;
      }
    }),
    
    redo: () => set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex += 1;
        const entry = state.history[state.historyIndex];
        state.pages = JSON.parse(JSON.stringify(entry.pages));
        state.blocks = JSON.parse(JSON.stringify(entry.blocks));
        state.isDirty = true;
      }
    }),
    
    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,
    
    copy: () => set((state) => {
      const selected = state.blocks.filter(b => state.selectedBlockIds.includes(b.id));
      state.clipboard = JSON.parse(JSON.stringify(selected));
    }),
    
    paste: () => set((state) => {
      if (state.clipboard.length === 0 || !state.currentPageId) return;
      
      const newBlocks = state.clipboard.map(b => ({
        ...JSON.parse(JSON.stringify(b)),
        id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        pageId: state.currentPageId!,
        position: {
          ...b.position,
          x: b.position.x + 20,
          y: b.position.y + 20,
        },
      }));
      state.blocks.push(...newBlocks);
      state.selectedBlockIds = newBlocks.map(b => b.id);
      state.isDirty = true;
    }),
    
    cut: () => {
      const { copy, deleteBlocks, selectedBlockIds } = get();
      copy();
      deleteBlocks(selectedBlockIds);
    },
    
    setActiveTool: (tool) => set((state) => { state.activeTool = tool; }),
    setInspectorTab: (tab) => set((state) => { state.inspectorTab = tab; }),
    
    toggleSidebar: (side) => set((state) => {
      state.sidebarOpen[side] = !state.sidebarOpen[side];
    }),
    
    markDirty: () => set((state) => { state.isDirty = true; }),
    markSaved: () => set((state) => { 
      state.isDirty = false;
      state.lastSavedAt = new Date().toISOString();
    }),
    
    loadFromSnapshot: (snapshot) => set((state) => {
      if (snapshot.document) state.document = snapshot.document;
      if (snapshot.pages) state.pages = snapshot.pages;
      if (snapshot.blocks) state.blocks = snapshot.blocks;
      if (snapshot.pages?.length > 0) {
        state.currentPageId = snapshot.pages[0].id;
      }
      state.isDirty = false;
    }),
    
    getSnapshot: () => {
      const { document, pages, blocks } = get();
      return {
        schemaVersion: 1,
        document,
        pages,
        blocks,
        savedAt: new Date().toISOString(),
      };
    },
    
    reset: () => set(() => INITIAL_STATE),
  }))
);
