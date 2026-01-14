import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  sanitizePositiveNumber, 
  sanitizePercentage, 
  sanitizeHoldingPeriod,
  validateExitStrategyCalculations,
  type CalculationWarning 
} from '@/lib/financial-validators';

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
  validationWarnings: CalculationWarning[];
  
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
  getValidationWarnings: () => CalculationWarning[];
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

const sanitizeInputValue = <K extends keyof MasterInputs>(key: K, value: MasterInputs[K]): MasterInputs[K] => {
  switch (key) {
    case 'salePrice':
    case 'costBasis':
    case 'depreciationTaken':
    case 'capitalImprovements':
    case 'currentDebtBalance':
    case 'closingCosts':
      return sanitizePositiveNumber(value, defaultMasterInputs[key]) as MasterInputs[K];
    case 'federalTaxRate':
    case 'stateTaxRate':
    case 'brokerFeePercent':
      return sanitizePercentage(value, defaultMasterInputs[key] as number) as MasterInputs[K];
    case 'holdingPeriod':
      return sanitizeHoldingPeriod(value, defaultMasterInputs[key] as number) as MasterInputs[K];
    case 'acquisitionDate':
      return (typeof value === 'string' && value.length > 0 ? value : defaultMasterInputs[key]) as MasterInputs[K];
    default:
      return value;
  }
};

const updateValidationWarnings = (inputs: MasterInputs): CalculationWarning[] => {
  return validateExitStrategyCalculations(inputs);
};

export const useExitStrategiesStore = create<ExitStrategiesState>()(
  persist(
    (set, get) => ({
      masterInputs: { ...defaultMasterInputs },
      mode: { type: 'standalone' },
      validationWarnings: [],

      setMasterInput: (key, value) => {
        const sanitizedValue = sanitizeInputValue(key, value);
        set((state) => {
          const newInputs = { ...state.masterInputs, [key]: sanitizedValue };
          return {
            masterInputs: newInputs,
            validationWarnings: updateValidationWarnings(newInputs),
            mode: state.mode.type === 'project-linked' 
              ? { ...state.mode, isDirty: true }
              : state.mode,
          };
        });
      },

      bulkUpdateMaster: (updates) => {
        const sanitizedUpdates: Partial<MasterInputs> = {};
        for (const [key, value] of Object.entries(updates)) {
          sanitizedUpdates[key as keyof MasterInputs] = sanitizeInputValue(
            key as keyof MasterInputs, 
            value
          );
        }
        set((state) => {
          const newInputs = { ...state.masterInputs, ...sanitizedUpdates };
          return {
            masterInputs: newInputs,
            validationWarnings: updateValidationWarnings(newInputs),
            mode: state.mode.type === 'project-linked'
              ? { ...state.mode, isDirty: true }
              : state.mode,
          };
        });
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
          const purchasePrice = sanitizePositiveNumber(projectData.purchasePrice, defaultMasterInputs.costBasis);
          updates.salePrice = sanitizePositiveNumber(purchasePrice * 1.3, defaultMasterInputs.salePrice);
          updates.costBasis = purchasePrice;
        }
        
        if (projectData.basis !== undefined) {
          updates.costBasis = sanitizePositiveNumber(projectData.basis, defaultMasterInputs.costBasis);
        }
        
        if (projectData.depreciation !== undefined) {
          updates.depreciationTaken = sanitizePositiveNumber(projectData.depreciation, 0);
        }
        
        if (projectData.capitalImprovements !== undefined) {
          updates.capitalImprovements = sanitizePositiveNumber(projectData.capitalImprovements, 0);
        }
        
        if (projectData.holdingPeriod !== undefined) {
          updates.holdingPeriod = sanitizeHoldingPeriod(projectData.holdingPeriod, defaultMasterInputs.holdingPeriod);
        }
        
        if (projectData.debtBalance !== undefined) {
          updates.currentDebtBalance = sanitizePositiveNumber(projectData.debtBalance, 0);
        }
        
        if (projectData.acquisitionDate) {
          updates.acquisitionDate = projectData.acquisitionDate;
        }
        
        set((state) => {
          const newInputs = { ...state.masterInputs, ...updates };
          return {
            masterInputs: newInputs,
            validationWarnings: updateValidationWarnings(newInputs),
            mode: {
              ...state.mode,
              lastSyncedAt: new Date().toISOString(),
              isDirty: false,
              hydratedProjectId: projectId,
            },
          };
        });
      },

      reset: () => {
        set({
          masterInputs: { ...defaultMasterInputs },
          mode: { type: 'standalone' },
          validationWarnings: [],
        });
      },

      getValidationWarnings: () => {
        return get().validationWarnings;
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
