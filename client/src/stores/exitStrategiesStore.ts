import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MasterInputs {
  salePrice: number;
  costBasis: number;
  depreciationTaken: number;
  capitalImprovements: number;
  holdingPeriod: number;
  federalTaxRate: number;
  stateTaxRate: number;
  currentDebtBalance: number;
  acquisitionDate: string;
  closingCosts: number;
  brokerFeePercent: number;
}

export interface ExitStrategiesMode {
  type: 'standalone' | 'project-linked';
  projectId?: string;
  lastSyncedAt?: string;
  isDirty?: boolean;
  hydratedProjectId?: string;
}

interface ExitStrategiesState {
  masterInputs: MasterInputs;
  mode: ExitStrategiesMode;
  
  setMasterInput: <K extends keyof MasterInputs>(key: K, value: MasterInputs[K]) => void;
  bulkUpdateMaster: (updates: Partial<MasterInputs>) => void;
  setMode: (mode: ExitStrategiesMode) => void;
  hydrateFromProject: (projectData: {
    purchasePrice?: number | string;
    basis?: number | string;
    depreciation?: number | string;
    capitalImprovements?: number | string;
    holdingPeriod?: number;
    debtBalance?: number | string;
    acquisitionDate?: string;
  }, projectId?: string) => void;
  reset: () => void;
}

const defaultMasterInputs: MasterInputs = {
  salePrice: 5000000,
  costBasis: 3500000,
  depreciationTaken: 500000,
  capitalImprovements: 200000,
  holdingPeriod: 5,
  federalTaxRate: 20,
  stateTaxRate: 5,
  currentDebtBalance: 2500000,
  acquisitionDate: new Date().toISOString().split('T')[0],
  closingCosts: 150000,
  brokerFeePercent: 5,
};

export const useExitStrategiesStore = create<ExitStrategiesState>()(
  persist(
    (set, get) => ({
      masterInputs: { ...defaultMasterInputs },
      mode: { type: 'standalone' },

      setMasterInput: (key, value) => {
        set((state) => ({
          masterInputs: { ...state.masterInputs, [key]: value },
          mode: state.mode.type === 'project-linked' 
            ? { ...state.mode, isDirty: true }
            : state.mode,
        }));
      },

      bulkUpdateMaster: (updates) => {
        set((state) => ({
          masterInputs: { ...state.masterInputs, ...updates },
          mode: state.mode.type === 'project-linked'
            ? { ...state.mode, isDirty: true }
            : state.mode,
        }));
      },

      setMode: (mode) => {
        set((state) => ({
          mode: {
            ...mode,
            hydratedProjectId: state.mode.hydratedProjectId,
          },
        }));
      },

      hydrateFromProject: (projectData, projectId?: string) => {
        const state = get();
        if (projectId && state.mode.hydratedProjectId === projectId) {
          return;
        }
        
        const updates: Partial<MasterInputs> = {};
        
        if (projectData.purchasePrice !== undefined) {
          const purchasePrice = typeof projectData.purchasePrice === 'string' 
            ? parseFloat(projectData.purchasePrice) 
            : projectData.purchasePrice;
          updates.salePrice = purchasePrice * 1.3;
          updates.costBasis = purchasePrice;
        }
        
        if (projectData.basis !== undefined) {
          updates.costBasis = typeof projectData.basis === 'string'
            ? parseFloat(projectData.basis)
            : projectData.basis;
        }
        
        if (projectData.depreciation !== undefined) {
          updates.depreciationTaken = typeof projectData.depreciation === 'string'
            ? parseFloat(projectData.depreciation)
            : projectData.depreciation;
        }
        
        if (projectData.capitalImprovements !== undefined) {
          updates.capitalImprovements = typeof projectData.capitalImprovements === 'string'
            ? parseFloat(projectData.capitalImprovements)
            : projectData.capitalImprovements;
        }
        
        if (projectData.holdingPeriod !== undefined) {
          updates.holdingPeriod = projectData.holdingPeriod;
        }
        
        if (projectData.debtBalance !== undefined) {
          updates.currentDebtBalance = typeof projectData.debtBalance === 'string'
            ? parseFloat(projectData.debtBalance)
            : projectData.debtBalance;
        }
        
        if (projectData.acquisitionDate) {
          updates.acquisitionDate = projectData.acquisitionDate;
        }
        
        set((state) => ({
          masterInputs: { ...state.masterInputs, ...updates },
          mode: {
            ...state.mode,
            lastSyncedAt: new Date().toISOString(),
            isDirty: false,
            hydratedProjectId: projectId,
          },
        }));
      },

      reset: () => {
        set({
          masterInputs: { ...defaultMasterInputs },
          mode: { type: 'standalone' },
        });
      },
    }),
    {
      name: 'exit-strategies-storage',
      partialize: (state) => ({
        masterInputs: state.masterInputs,
        mode: state.mode.type === 'standalone' ? state.mode : { type: 'standalone' },
      }),
    }
  )
);

export const selectAdjustedBasis = (state: ExitStrategiesState) => 
  state.masterInputs.costBasis + state.masterInputs.capitalImprovements - state.masterInputs.depreciationTaken;

export const selectCapitalGain = (state: ExitStrategiesState) => 
  state.masterInputs.salePrice - selectAdjustedBasis(state);

export const selectEquity = (state: ExitStrategiesState) => 
  state.masterInputs.salePrice - state.masterInputs.currentDebtBalance;
