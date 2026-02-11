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
  getDefaultStorageRate: () => number;
  triggerAutosave: () => void;
}

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
  getDefaultStorageRate,
  triggerAutosave,
}: GrowthRatesTabProps) {
  const defaultRevenueRate = getDefaultGrowthRate();
  const defaultExpenseRate = getDefaultExpenseRate();
  const defaultStorageRate = getDefaultStorageRate();

  const modifiedCount = useMemo(() => {
    let count = 0;
    if (Math.abs(storageGrowth.universalRate - defaultStorageRate) > 0.001) count++;
    Object.entries(storageGrowth.typeRates).forEach(([_, rate]) => {
      if (Math.abs(rate - defaultStorageRate) > 0.001) count++;
    });
    Object.entries(growthRates).forEach(([_, rate]) => {
      if (Math.abs(rate - defaultRevenueRate) > 0.001) count++;
    });
    Object.entries(expenseGrowth).forEach(([_, rate]) => {
      if (Math.abs(rate - defaultExpenseRate) > 0.001) count++;
    });
    return count;
  }, [storageGrowth, growthRates, expenseGrowth, defaultRevenueRate, defaultExpenseRate, defaultStorageRate]);

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
    updateStorageUniversalRate(String(defaultStorageRate));
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
  }, [nonStorageRevenueCategories, expenseCategories, segmentExpenseCategories, updateStorageUniversalRate, updateGrowthRate, updateExpenseGrowth, defaultRevenueRate, defaultExpenseRate, defaultStorageRate, triggerAutosave]);

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

  const storageMode = (storageGrowth.mode === 'per_type' || storageGrowth.mode === 'granular') ? 'perProfitCenter' : 'universal';

  const handleStorageModeChange = useCallback((mode: 'universal' | 'perProfitCenter') => {
    updateStorageGrowthMode(mode === 'universal' ? 'universal' : 'per_type');
    triggerAutosave();
  }, [updateStorageGrowthMode, triggerAutosave]);

  return (
    <div className="space-y-4">
      <QuickActionsBar
        modifiedCount={modifiedCount}
        totalCount={totalCount}
        onReset={handleReset}
        onPreset={handlePreset}
      />

      <SectionCard
        title="Storage Revenue Growth"
        description="Annual percentage increase for marina storage revenue"
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
          <div className="max-w-sm">
            <RateInput
              label="All Storage Types"
              icon={Globe}
              value={storageGrowth.universalRate}
              defaultValue={defaultStorageRate}
              onChange={(val) => {
                updateStorageUniversalRate(String(val));
                triggerAutosave();
              }}
              size="large"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5">
            {storageRevenueCategories.map((category) => {
              const storageCategory = STORAGE_CATEGORIES.find(s => s.id === category.id);
              const IconComponent = storageCategory?.icon || Anchor;
              return (
                <RateInput
                  key={category.id}
                  label={category.name}
                  icon={IconComponent}
                  value={storageGrowth.typeRates[category.id] ?? storageGrowth.universalRate}
                  defaultValue={defaultStorageRate}
                  onChange={(val) => {
                    updateStorageTypeRate(category.id, String(val));
                    triggerAutosave();
                  }}
                />
              );
            })}
            {storageRevenueCategories.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2 col-span-3">
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
        <CategoryGroup title="Core Marina Revenue" columns={2}>
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

        <CategoryGroup title="Retail & Service" columns={2}>
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

        <CategoryGroup title="Boats" columns={3}>
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

        <CategoryGroup title="Leases & Hospitality" columns={3}>
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
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
            No non-storage revenue categories enabled.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Operating Expense Growth"
        description="Annual percentage increase for operating expenses"
        accent="slate"
        icon={Receipt}
        collapsible
        headerAction={<SetAllDropdown onSetAll={handleSetAllOpex} />}
      >
        <CategoryGroup title="Labor & Administration" columns={2}>
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

        <CategoryGroup title="Marketing" columns={2}>
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

        <CategoryGroup title="Operations" columns={2}>
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

        <CategoryGroup title="Financial" columns={2}>
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
        title="Departmental Expense Growth"
        description="Annual percentage increase for segment-specific expenses"
        accent="purple"
        icon={PieChart}
        collapsible
        headerAction={<SetAllDropdown onSetAll={handleSetAllDepartmental} />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5">
          {DEPARTMENTAL_EXPENSE_CATEGORIES.map((cat) => {
            const isEnabled = segmentExpenseCategories.some(c => c.id === cat.id);
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
        </div>
        {segmentExpenseCategories.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
            No departmental expense categories enabled.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

export default GrowthRatesTab;
