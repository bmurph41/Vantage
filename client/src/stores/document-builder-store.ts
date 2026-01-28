/**
 * Document Builder Store
 * Zustand store for managing document builder state
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  DocumentType,
  DocumentStatus,
  AudiencePersona,
  AssetClass,
  DocumentSection,
  SectionDefinition,
  DataBindingRequirement,
  BuilderStep,
  CompletionStatus,
  ResolvedBinding,
} from '@shared/document-builder/types';

// =============================================================================
// Types
// =============================================================================

interface DocumentData {
  id: number;
  dealId: number;
  documentType: DocumentType;
  title: string;
  audience: AudiencePersona | null;
  assetClass: AssetClass | null;
  themeId: number | null;
  templateId: number | null;
  status: DocumentStatus;
  completionStatus: CompletionStatus | null;
  sections: DocumentSection[];
  createdAt: string;
  updatedAt: string;
}

interface BuilderState {
  // Current document
  document: DocumentData | null;
  isLoading: boolean;
  error: string | null;

  // Builder mode state
  currentStep: BuilderStep;
  isBuilderMode: boolean;

  // Section library
  sectionLibrary: Record<string, SectionDefinition>;
  documentTypeConfigs: Record<string, any>;

  // Data bindings
  bindingsCatalog: Record<string, any>;
  resolvedBindings: Record<string, ResolvedBinding>;
  bindingsLoading: boolean;

  // Selection state
  selectedSectionId: number | null;
  expandedSectionIds: Set<number>;

  // UI state
  sidebarTab: 'sections' | 'data' | 'media' | 'ai';
  showPreview: boolean;
  previewScale: number;

  // Undo/Redo
  history: DocumentData[];
  historyIndex: number;

  // Actions
  setDocument: (document: DocumentData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Builder mode actions
  setBuilderMode: (isBuilderMode: boolean) => void;
  setCurrentStep: (step: BuilderStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Section actions
  selectSection: (sectionId: number | null) => void;
  toggleSectionExpanded: (sectionId: number) => void;
  updateSectionContent: (sectionId: number, content: Record<string, any>) => void;
  updateSectionOrder: (sectionId: number, newOrder: number) => void;
  toggleSectionEnabled: (sectionId: number) => void;
  addSection: (sectionKey: string) => void;
  removeSection: (sectionId: number) => void;

  // Data binding actions
  setBindingsCatalog: (catalog: Record<string, any>) => void;
  setResolvedBinding: (key: string, value: ResolvedBinding) => void;
  setBindingsLoading: (loading: boolean) => void;
  bindDataToSection: (sectionId: number, bindingKey: string, binding: ResolvedBinding) => void;

  // Library actions
  setSectionLibrary: (library: Record<string, SectionDefinition>) => void;
  setDocumentTypeConfigs: (configs: Record<string, any>) => void;

  // UI actions
  setSidebarTab: (tab: 'sections' | 'data' | 'media' | 'ai') => void;
  setShowPreview: (show: boolean) => void;
  setPreviewScale: (scale: number) => void;

  // Undo/Redo
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Utility
  reset: () => void;
  getSelectedSection: () => DocumentSection | null;
  getSectionDefinition: (sectionKey: string) => SectionDefinition | null;
}

// =============================================================================
// Initial State
// =============================================================================

const BUILDER_STEPS: BuilderStep[] = [
  'select_type',
  'configure',
  'choose_sections',
  'bind_data',
  'add_media',
  'generate_content',
  'review',
];

const initialState = {
  document: null,
  isLoading: false,
  error: null,

  currentStep: 'select_type' as BuilderStep,
  isBuilderMode: true,

  sectionLibrary: {},
  documentTypeConfigs: {},

  bindingsCatalog: {},
  resolvedBindings: {},
  bindingsLoading: false,

  selectedSectionId: null,
  expandedSectionIds: new Set<number>(),

  sidebarTab: 'sections' as const,
  showPreview: true,
  previewScale: 0.5,

  history: [],
  historyIndex: -1,
};

// =============================================================================
// Store
// =============================================================================

export const useDocumentBuilderStore = create<BuilderState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Core document actions
        setDocument: (document) => {
          set({ document, error: null });
          if (document) {
            get().pushHistory();
          }
        },

        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),

        // Builder mode actions
        setBuilderMode: (isBuilderMode) => set({ isBuilderMode }),

        setCurrentStep: (currentStep) => set({ currentStep }),

        nextStep: () => {
          const { currentStep } = get();
          const currentIndex = BUILDER_STEPS.indexOf(currentStep);
          if (currentIndex < BUILDER_STEPS.length - 1) {
            set({ currentStep: BUILDER_STEPS[currentIndex + 1] });
          }
        },

        prevStep: () => {
          const { currentStep } = get();
          const currentIndex = BUILDER_STEPS.indexOf(currentStep);
          if (currentIndex > 0) {
            set({ currentStep: BUILDER_STEPS[currentIndex - 1] });
          }
        },

        // Section actions
        selectSection: (sectionId) => {
          set({ selectedSectionId: sectionId });
          if (sectionId) {
            const expanded = new Set(get().expandedSectionIds);
            expanded.add(sectionId);
            set({ expandedSectionIds: expanded });
          }
        },

        toggleSectionExpanded: (sectionId) => {
          const expanded = new Set(get().expandedSectionIds);
          if (expanded.has(sectionId)) {
            expanded.delete(sectionId);
          } else {
            expanded.add(sectionId);
          }
          set({ expandedSectionIds: expanded });
        },

        updateSectionContent: (sectionId, content) => {
          const { document } = get();
          if (!document) return;

          const updatedSections = document.sections.map((section) =>
            section.id === sectionId
              ? { ...section, content: { ...section.content, ...content } }
              : section
          );

          set({
            document: { ...document, sections: updatedSections },
          });
          get().pushHistory();
        },

        updateSectionOrder: (sectionId, newOrder) => {
          const { document } = get();
          if (!document) return;

          const updatedSections = document.sections.map((section) =>
            section.id === sectionId ? { ...section, order: newOrder } : section
          );

          // Re-sort by order
          updatedSections.sort((a, b) => a.order - b.order);

          set({
            document: { ...document, sections: updatedSections },
          });
          get().pushHistory();
        },

        toggleSectionEnabled: (sectionId) => {
          const { document } = get();
          if (!document) return;

          const updatedSections = document.sections.map((section) =>
            section.id === sectionId ? { ...section, enabled: !section.enabled } : section
          );

          set({
            document: { ...document, sections: updatedSections },
          });
          get().pushHistory();
        },

        addSection: (sectionKey) => {
          const { document, sectionLibrary } = get();
          if (!document) return;

          const definition = sectionLibrary[sectionKey];
          if (!definition) return;

          // Calculate next order
          const maxOrder = Math.max(0, ...document.sections.map((s) => s.order));

          // Create new section (ID will be assigned by server, use temp negative ID)
          const newSection: DocumentSection = {
            id: -Date.now(), // Temporary ID
            documentId: document.id,
            sectionKey,
            order: maxOrder + 1,
            enabled: true,
            customTitle: null,
            dataBindings: {},
            media: {},
            content: {},
            aiGenerated: false,
            completionStatus: {
              complete: false,
              percentage: 0,
              missingRequiredBindings: definition.requiredDataBindings?.map((b) => b.key) || [],
              missingRequiredMedia: definition.requiredMedia?.map((m) => m.key) || [],
              missingRequiredFields: [],
              warnings: [],
            },
            pageIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          set({
            document: {
              ...document,
              sections: [...document.sections, newSection],
            },
            selectedSectionId: newSection.id,
          });
        },

        removeSection: (sectionId) => {
          const { document, selectedSectionId } = get();
          if (!document) return;

          const updatedSections = document.sections.filter((s) => s.id !== sectionId);

          set({
            document: { ...document, sections: updatedSections },
            selectedSectionId: selectedSectionId === sectionId ? null : selectedSectionId,
          });
          get().pushHistory();
        },

        // Data binding actions
        setBindingsCatalog: (bindingsCatalog) => set({ bindingsCatalog }),

        setResolvedBinding: (key, value) => {
          set({
            resolvedBindings: { ...get().resolvedBindings, [key]: value },
          });
        },

        setBindingsLoading: (bindingsLoading) => set({ bindingsLoading }),

        bindDataToSection: (sectionId, bindingKey, binding) => {
          const { document } = get();
          if (!document) return;

          const updatedSections = document.sections.map((section) =>
            section.id === sectionId
              ? {
                  ...section,
                  dataBindings: {
                    ...section.dataBindings,
                    [bindingKey]: binding,
                  },
                }
              : section
          );

          set({
            document: { ...document, sections: updatedSections },
          });
          get().pushHistory();
        },

        // Library actions
        setSectionLibrary: (sectionLibrary) => set({ sectionLibrary }),
        setDocumentTypeConfigs: (documentTypeConfigs) => set({ documentTypeConfigs }),

        // UI actions
        setSidebarTab: (sidebarTab) => set({ sidebarTab }),
        setShowPreview: (showPreview) => set({ showPreview }),
        setPreviewScale: (previewScale) => set({ previewScale }),

        // Undo/Redo
        pushHistory: () => {
          const { document, history, historyIndex } = get();
          if (!document) return;

          // Trim history after current index
          const newHistory = history.slice(0, historyIndex + 1);
          newHistory.push(JSON.parse(JSON.stringify(document)));

          // Limit history size
          const MAX_HISTORY = 50;
          if (newHistory.length > MAX_HISTORY) {
            newHistory.shift();
          }

          set({
            history: newHistory,
            historyIndex: newHistory.length - 1,
          });
        },

        undo: () => {
          const { history, historyIndex } = get();
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            set({
              document: JSON.parse(JSON.stringify(history[newIndex])),
              historyIndex: newIndex,
            });
          }
        },

        redo: () => {
          const { history, historyIndex } = get();
          if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            set({
              document: JSON.parse(JSON.stringify(history[newIndex])),
              historyIndex: newIndex,
            });
          }
        },

        canUndo: () => get().historyIndex > 0,
        canRedo: () => get().historyIndex < get().history.length - 1,

        // Utility
        reset: () => set(initialState),

        getSelectedSection: () => {
          const { document, selectedSectionId } = get();
          if (!document || !selectedSectionId) return null;
          return document.sections.find((s) => s.id === selectedSectionId) || null;
        },

        getSectionDefinition: (sectionKey) => {
          return get().sectionLibrary[sectionKey] || null;
        },
      }),
      {
        name: 'document-builder-store',
        partialize: (state) => ({
          // Only persist UI preferences
          sidebarTab: state.sidebarTab,
          showPreview: state.showPreview,
          previewScale: state.previewScale,
          isBuilderMode: state.isBuilderMode,
        }),
      }
    ),
    { name: 'DocumentBuilder' }
  )
);

// =============================================================================
// Selector Hooks
// =============================================================================

export const useDocument = () => useDocumentBuilderStore((state) => state.document);
export const useIsLoading = () => useDocumentBuilderStore((state) => state.isLoading);
export const useError = () => useDocumentBuilderStore((state) => state.error);
export const useCurrentStep = () => useDocumentBuilderStore((state) => state.currentStep);
export const useIsBuilderMode = () => useDocumentBuilderStore((state) => state.isBuilderMode);
export const useSelectedSectionId = () => useDocumentBuilderStore((state) => state.selectedSectionId);
export const useSidebarTab = () => useDocumentBuilderStore((state) => state.sidebarTab);
export const useShowPreview = () => useDocumentBuilderStore((state) => state.showPreview);

export const useSections = () =>
  useDocumentBuilderStore((state) => state.document?.sections || []);

export const useEnabledSections = () =>
  useDocumentBuilderStore(
    (state) => state.document?.sections.filter((s) => s.enabled) || []
  );

export const useCompletionStatus = () =>
  useDocumentBuilderStore((state) => state.document?.completionStatus);

export const useSectionLibrary = () =>
  useDocumentBuilderStore((state) => state.sectionLibrary);

export const useBindingsCatalog = () =>
  useDocumentBuilderStore((state) => state.bindingsCatalog);
