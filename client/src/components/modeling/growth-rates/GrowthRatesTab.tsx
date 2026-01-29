import { useMemo, useCallback } from 'react';
import {
  RateInput,
  SectionCard,
  CategoryGroup,
  SetAllDropdown,
  ModeToggle,
  QuickActionsBar,
  REVENUE_CATEGORIES,
  OPEX_CATEGORIES,
  DEPARTMENTAL_EXPENSE_CATEGORIES,
  STORAGE_CATEGORIES,
} from './index';
import {
  Warehouse,
  TrendingUp,
  Receipt,
  PieChart,
  Globe,
  Anchor,
} from 'lucide-react';

type StorageGrowthMode = 'universal' | 'per_type' | 'granular';

interface StorageGrowthData {
  mode: StorageGrowthMode;
  universalRate: number;
  typeRates: Record<string, number>;
  locationRates: Record<string, number>;
}

interface GrowthRatesTabProps {
  growthRates: Record<string, number>;
  expenseGrowth: Record<string, number>;
  storageGrowth: StorageGrowthData;
  updateGrowthRate: (categoryId: string, value: string) => void;
  updateExpenseGrowth: (categoryId: string, value: string) => void;
  updateStorageGrowthMode: (mode: StorageGrowthMode) => void;
  updateStorageUniversalRate: (value: string) => void;
  updateStorageTypeRate: (typeId: string, value: string) => void;
  storageRevenueCategories: Array<{ id: string; name: string; icon: React.ReactNode }>;
  nonStorageRevenueCategories: Array<{ id: string; name: string; icon: React.ReactNode }>;
  expenseCategories: Array<{ id: string; name: string }>;
  segmentExpenseCategories: Array<{ id: string; name: string; segment: boolean }>;
  getDefaultGrowthRate: () => number;
  getDefaultExpenseRate: () => number;
  triggerAutosave: () => void;
}

const DEFAULT_RATES = {
  storage: 3.0,
  revenue: 3.0,
  payroll: 4.0,
  expense: 2.0,
  departmental: 2.0,
};

export function GrowthRatesTab({
  growthRates,
  expenseGrowth,
  storageGrowth,
  updateGrowthRate,
  updateExpenseGrowth,
  updateStorageGrowthMode,
  updateStorageUniversalRate,
  updateStorageTypeRate,
  storageRevenueCategories,
  nonStorageRevenueCategories,
  expenseCategories,
  segmentExpenseCategories,
  getDefaultGrowthRate,
  getDefaultExpenseRate,
  triggerAutosave,
}: GrowthRatesTabProps) {
  const defaultRevenueRate = getDefaultGrowthRate();
  const defaultExpenseRate = getDefaultExpenseRate();

  const modifiedCount = useMemo(() => {
    let count = 0;
    if (Math.abs(storageGrowth.universalRate - DEFAULT_RATES.storage) > 0.001) count++;
    Object.entries(storageGrowth.typeRates).forEach(([_, rate]) => {
      if (Math.abs(rate - DEFAULT_RATES.storage) > 0.001) count++;
    });
    Object.entries(growthRates).forEach(([_, rate]) => {
      if (Math.abs(rate - defaultRevenueRate) > 0.001) count++;
    });
    Object.entries(expenseGrowth).forEach(([_, rate]) => {
      if (Math.abs(rate - defaultExpenseRate) > 0.001) count++;
    });
    return count;
  }, [storageGrowth, growthRates, expenseGrowth, defaultRevenueRate, defaultExpenseRate]);

  const totalCount = useMemo(() => {
    return (
      1 + 
      Object.keys(storageGrowth.typeRates).length +
      Object.keys(growthRates).length +
      Object.keys(expenseGrowth).length
    );
  }, [storageGrowth.typeRates, growthRates, expenseGrowth]);

  const handlePreset = useCallback((value: number) => {
    updateStorageUniversalRate(String(value));
    nonStorageRevenueCategories.forEach(cat => {
      updateGrowthRate(cat.id, String(value));
    });
    expenseCategories.forEach(cat => {
      updateExpenseGrowth(cat.id, String(value));
    });
    segmentExpenseCategories.forEach(cat => {
      updateExpenseGrowth(cat.id, String(value));
    });
    triggerAutosave();
  }, [nonStorageRevenueCategories, expenseCategories, segmentExpenseCategories, updateStorageUniversalRate, updateGrowthRate, updateExpenseGrowth, triggerAutosave]);

  const handleReset = useCallback(() => {
    updateStorageUniversalRate(String(DEFAULT_RATES.storage));
    nonStorageRevenueCategories.forEach(cat => {
      updateGrowthRate(cat.id, String(defaultRevenueRate));
    });
    expenseCategories.forEach(cat => {
      updateExpenseGrowth(cat.id, String(defaultExpenseRate));
    });
    segmentExpenseCategories.forEach(cat => {
      updateExpenseGrowth(cat.id, String(defaultExpenseRate));
    });
    triggerAutosave();
  }, [nonStorageRevenueCategories, expenseCategories, segmentExpenseCategories, updateStorageUniversalRate, updateGrowthRate, updateExpenseGrowth, defaultRevenueRate, defaultExpenseRate, triggerAutosave]);

  const handleSetAllRevenue = useCallback((value: number) => {
    nonStorageRevenueCategories.forEach(cat => {
      updateGrowthRate(cat.id, String(value));
    });
    triggerAutosave();
  }, [nonStorageRevenueCategories, updateGrowthRate, triggerAutosave]);

  const handleSetAllOpex = useCallback((value: number) => {
    expenseCategories.forEach(cat => {
      updateExpenseGrowth(cat.id, String(value));
    });
    triggerAutosave();
  }, [expenseCategories, updateExpenseGrowth, triggerAutosave]);

  const handleSetAllDepartmental = useCallback((value: number) => {
    segmentExpenseCategories.forEach(cat => {
      updateExpenseGrowth(cat.id, String(value));
    });
    triggerAutosave();
  }, [segmentExpenseCategories, updateExpenseGrowth, triggerAutosave]);

  const storageMode = storageGrowth.mode === 'per_type' ? 'perProfitCenter' : 'universal';

  const handleStorageModeChange = useCallback((mode: 'universal' | 'perProfitCenter') => {
    updateStorageGrowthMode(mode === 'universal' ? 'universal' : 'per_type');
    triggerAutosave();
  }, [updateStorageGrowthMode, triggerAutosave]);

  return (
    <div className="space-y-6">
      <QuickActionsBar
        modifiedCount={modifiedCount}
        totalCount={totalCount}
        onReset={handleReset}
        onPreset={handlePreset}
      />

      <SectionCard
        title="Storage Revenue Growth"
        description="Annual percentage increase for marina storage revenue by type or location"
        accent="blue"
        icon={Warehouse}
        headerAction={
          <ModeToggle
            value={storageMode}
            onChange={handleStorageModeChange}
          />
        }
      >
        {storageMode === 'universal' ? (
          <div className="max-w-md">
            <RateInput
              label="Universal Growth Rate"
              icon={Globe}
              value={storageGrowth.universalRate}
              defaultValue={DEFAULT_RATES.storage}
              onChange={(val) => {
                updateStorageUniversalRate(String(val));
                triggerAutosave();
              }}
              size="large"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 ml-8">
              This rate applies to all storage types
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
            {storageRevenueCategories.map((category) => {
              const storageCategory = STORAGE_CATEGORIES.find(s => s.id === category.id);
              const IconComponent = storageCategory?.icon || Anchor;
              return (
                <RateInput
                  key={category.id}
                  label={category.name}
                  icon={IconComponent}
                  value={storageGrowth.typeRates[category.id] ?? storageGrowth.universalRate}
                  defaultValue={DEFAULT_RATES.storage}
                  onChange={(val) => {
                    updateStorageTypeRate(category.id, String(val));
                    triggerAutosave();
                  }}
                />
              );
            })}
            {storageRevenueCategories.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2 col-span-2">
                No storage types enabled. Enable them in Department Configuration.
              </p>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Revenue Growth Rates"
        description="Annual percentage increase for non-storage revenue"
        accent="emerald"
        icon={TrendingUp}
        headerAction={<SetAllDropdown onSetAll={handleSetAllRevenue} />}
      >
        <CategoryGroup title="Core Marina Revenue">
          {REVENUE_CATEGORIES.coreMarineRevenue.map((cat) => {
            const isEnabled = nonStorageRevenueCategories.some(c => c.id === cat.id);
            if (!isEnabled) return null;
            return (
              <RateInput
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                value={growthRates[cat.id] ?? defaultRevenueRate}
                defaultValue={defaultRevenueRate}
                onChange={(val) => {
                  updateGrowthRate(cat.id, String(val));
                  triggerAutosave();
                }}
              />
            );
          })}
        </CategoryGroup>

        <CategoryGroup title="Retail & Service">
          {REVENUE_CATEGORIES.retailAndService.map((cat) => {
            const isEnabled = nonStorageRevenueCategories.some(c => c.id === cat.id);
            if (!isEnabled) return null;
            return (
              <RateInput
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                value={growthRates[cat.id] ?? defaultRevenueRate}
                defaultValue={defaultRevenueRate}
                onChange={(val) => {
                  updateGrowthRate(cat.id, String(val));
                  triggerAutosave();
                }}
              />
            );
          })}
        </CategoryGroup>

        <CategoryGroup title="Boats">
          {REVENUE_CATEGORIES.boats.map((cat) => {
            const isEnabled = nonStorageRevenueCategories.some(c => c.id === cat.id);
            if (!isEnabled) return null;
            return (
              <RateInput
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                value={growthRates[cat.id] ?? defaultRevenueRate}
                defaultValue={defaultRevenueRate}
                onChange={(val) => {
                  updateGrowthRate(cat.id, String(val));
                  triggerAutosave();
                }}
              />
            );
          })}
        </CategoryGroup>

        <CategoryGroup title="Leases & Hospitality">
          {REVENUE_CATEGORIES.leasesAndHospitality.map((cat) => {
            const isEnabled = nonStorageRevenueCategories.some(c => c.id === cat.id);
            if (!isEnabled) return null;
            return (
              <RateInput
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                value={growthRates[cat.id] ?? defaultRevenueRate}
                defaultValue={defaultRevenueRate}
                onChange={(val) => {
                  updateGrowthRate(cat.id, String(val));
                  triggerAutosave();
                }}
              />
            );
          })}
        </CategoryGroup>

        {nonStorageRevenueCategories.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
            No non-storage revenue categories enabled.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Operating Expense Growth Rates"
        description="Annual percentage increase for operating expenses"
        accent="slate"
        icon={Receipt}
        collapsible
        headerAction={<SetAllDropdown onSetAll={handleSetAllOpex} />}
      >
        <CategoryGroup title="Labor & Administration">
          {OPEX_CATEGORIES.laborAndAdmin.map((cat) => {
            const isEnabled = expenseCategories.some(c => c.id === cat.id);
            if (!isEnabled) return null;
            return (
              <RateInput
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                value={expenseGrowth[cat.id] ?? (cat.defaultValue || defaultExpenseRate)}
                defaultValue={cat.defaultValue || defaultExpenseRate}
                onChange={(val) => {
                  updateExpenseGrowth(cat.id, String(val));
                  triggerAutosave();
                }}
              />
            );
          })}
        </CategoryGroup>

        <CategoryGroup title="Marketing">
          {OPEX_CATEGORIES.marketing.map((cat) => {
            const isEnabled = expenseCategories.some(c => c.id === cat.id);
            if (!isEnabled) return null;
            return (
              <RateInput
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                value={expenseGrowth[cat.id] ?? defaultExpenseRate}
                defaultValue={defaultExpenseRate}
                onChange={(val) => {
                  updateExpenseGrowth(cat.id, String(val));
                  triggerAutosave();
                }}
              />
            );
          })}
        </CategoryGroup>

        <CategoryGroup title="Operations">
          {OPEX_CATEGORIES.operations.map((cat) => {
            const isEnabled = expenseCategories.some(c => c.id === cat.id);
            if (!isEnabled) return null;
            return (
              <RateInput
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                value={expenseGrowth[cat.id] ?? defaultExpenseRate}
                defaultValue={defaultExpenseRate}
                onChange={(val) => {
                  updateExpenseGrowth(cat.id, String(val));
                  triggerAutosave();
                }}
              />
            );
          })}
        </CategoryGroup>

        <CategoryGroup title="Financial">
          {OPEX_CATEGORIES.financial.map((cat) => {
            const isEnabled = expenseCategories.some(c => c.id === cat.id);
            if (!isEnabled) return null;
            return (
              <RateInput
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                value={expenseGrowth[cat.id] ?? defaultExpenseRate}
                defaultValue={defaultExpenseRate}
                onChange={(val) => {
                  updateExpenseGrowth(cat.id, String(val));
                  triggerAutosave();
                }}
              />
            );
          })}
        </CategoryGroup>
      </SectionCard>

      <SectionCard
        title="Departmental Expense Growth Rates"
        description="Annual percentage increase for segment-specific expenses"
        accent="purple"
        icon={PieChart}
        collapsible
        headerAction={<SetAllDropdown onSetAll={handleSetAllDepartmental} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
          {DEPARTMENTAL_EXPENSE_CATEGORIES.map((cat) => {
            const isEnabled = segmentExpenseCategories.some(c => c.id === cat.id);
            if (!isEnabled) return null;
            return (
              <RateInput
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                value={expenseGrowth[cat.id] ?? DEFAULT_RATES.departmental}
                defaultValue={DEFAULT_RATES.departmental}
                onChange={(val) => {
                  updateExpenseGrowth(cat.id, String(val));
                  triggerAutosave();
                }}
              />
            );
          })}
        </div>
        {segmentExpenseCategories.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
            No departmental expense categories enabled.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

export default GrowthRatesTab;
