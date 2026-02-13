import { useMemo, useCallback } from 'react';
import {
  YearlyRateRow,
  YearHeaders,
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
  LucideIcon,
} from 'lucide-react';

type StorageGrowthMode = 'universal' | 'per_type' | 'granular';

interface YearlyRates {
  [categoryId: string]: number[];
}

interface StorageGrowthData {
  mode: StorageGrowthMode;
  universalRates: number[];
  typeRates: Record<string, number[]>;
  typeRatesByYear?: Record<string, number[]>;
  locationRates: Record<string, number>;
}

interface GrowthRatesTabProps {
  years: number[];
  growthRates: YearlyRates;
  expenseGrowth: YearlyRates;
  storageGrowth: StorageGrowthData;
  updateGrowthRate: (categoryId: string, yearIndex: number, value: number) => void;
  updateGrowthRateAllYears: (categoryId: string, value: number) => void;
  updateExpenseGrowth: (categoryId: string, yearIndex: number, value: number) => void;
  updateExpenseGrowthAllYears: (categoryId: string, value: number) => void;
  updateStorageGrowthMode: (mode: StorageGrowthMode) => void;
  updateStorageUniversalRate: (yearIndex: number, value: number) => void;
  updateStorageUniversalRateAllYears: (value: number) => void;
  updateStorageTypeRate: (typeId: string, yearIndex: number, value: number) => void;
  updateStorageTypeRateAllYears: (typeId: string, value: number) => void;
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
  years,
  growthRates,
  expenseGrowth,
  storageGrowth,
  updateGrowthRate,
  updateGrowthRateAllYears,
  updateExpenseGrowth,
  updateExpenseGrowthAllYears,
  updateStorageGrowthMode,
  updateStorageUniversalRate,
  updateStorageUniversalRateAllYears,
  updateStorageTypeRate,
  updateStorageTypeRateAllYears,
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
  const holdPeriod = years.length;

  const labelWidth = holdPeriod <= 5 ? '130px' : holdPeriod <= 7 ? '110px' : '90px';
  const useWideLayout = holdPeriod <= 7;

  const modifiedCount = useMemo(() => {
    let count = 0;
    (storageGrowth.universalRates || []).forEach(r => {
      if (Math.abs(r - defaultStorageRate) > 0.001) count++;
    });
    Object.values(storageGrowth.typeRatesByYear || {}).forEach(rates => {
      (rates || []).forEach(r => {
        if (Math.abs(r - defaultStorageRate) > 0.001) count++;
      });
    });
    Object.values(growthRates).forEach(rates => {
      (rates || []).forEach(r => {
        if (Math.abs(r - defaultRevenueRate) > 0.001) count++;
      });
    });
    Object.values(expenseGrowth).forEach(rates => {
      (rates || []).forEach(r => {
        if (Math.abs(r - defaultExpenseRate) > 0.001) count++;
      });
    });
    return count;
  }, [storageGrowth, growthRates, expenseGrowth, defaultRevenueRate, defaultExpenseRate, defaultStorageRate]);

  const totalCount = useMemo(() => {
    return (
      holdPeriod +
      Object.keys(storageGrowth.typeRates || {}).length * holdPeriod +
      Object.keys(growthRates).length * holdPeriod +
      Object.keys(expenseGrowth).length * holdPeriod
    );
  }, [storageGrowth.typeRates, growthRates, expenseGrowth, holdPeriod]);

  const handlePreset = useCallback((value: number) => {
    updateStorageUniversalRateAllYears(value);
    storageRevenueCategories.forEach(cat => {
      updateStorageTypeRateAllYears(cat.id, value);
    });
    nonStorageRevenueCategories.forEach(cat => {
      updateGrowthRateAllYears(cat.id, value);
    });
    expenseCategories.forEach(cat => {
      updateExpenseGrowthAllYears(cat.id, value);
    });
    segmentExpenseCategories.forEach(cat => {
      updateExpenseGrowthAllYears(cat.id, value);
    });
    triggerAutosave();
  }, [nonStorageRevenueCategories, expenseCategories, segmentExpenseCategories, storageRevenueCategories, updateStorageUniversalRateAllYears, updateStorageTypeRateAllYears, updateGrowthRateAllYears, updateExpenseGrowthAllYears, triggerAutosave]);

  const handleReset = useCallback(() => {
    updateStorageUniversalRateAllYears(defaultStorageRate);
    storageRevenueCategories.forEach(cat => {
      updateStorageTypeRateAllYears(cat.id, defaultStorageRate);
    });
    nonStorageRevenueCategories.forEach(cat => {
      updateGrowthRateAllYears(cat.id, defaultRevenueRate);
    });
    expenseCategories.forEach(cat => {
      updateExpenseGrowthAllYears(cat.id, defaultExpenseRate);
    });
    segmentExpenseCategories.forEach(cat => {
      updateExpenseGrowthAllYears(cat.id, defaultExpenseRate);
    });
    triggerAutosave();
  }, [nonStorageRevenueCategories, expenseCategories, segmentExpenseCategories, storageRevenueCategories, updateStorageUniversalRateAllYears, updateStorageTypeRateAllYears, updateGrowthRateAllYears, updateExpenseGrowthAllYears, defaultRevenueRate, defaultExpenseRate, defaultStorageRate, triggerAutosave]);

  const handleSetAllRevenue = useCallback((value: number) => {
    nonStorageRevenueCategories.forEach(cat => {
      updateGrowthRateAllYears(cat.id, value);
    });
    triggerAutosave();
  }, [nonStorageRevenueCategories, updateGrowthRateAllYears, triggerAutosave]);

  const handleSetAllOpex = useCallback((value: number) => {
    expenseCategories.forEach(cat => {
      updateExpenseGrowthAllYears(cat.id, value);
    });
    triggerAutosave();
  }, [expenseCategories, updateExpenseGrowthAllYears, triggerAutosave]);

  const handleSetAllDepartmental = useCallback((value: number) => {
    segmentExpenseCategories.forEach(cat => {
      updateExpenseGrowthAllYears(cat.id, value);
    });
    triggerAutosave();
  }, [segmentExpenseCategories, updateExpenseGrowthAllYears, triggerAutosave]);

  const storageMode = (storageGrowth.mode === 'per_type' || storageGrowth.mode === 'granular') ? 'perProfitCenter' : 'universal';

  const handleStorageModeChange = useCallback((mode: 'universal' | 'perProfitCenter') => {
    updateStorageGrowthMode(mode === 'universal' ? 'universal' : 'per_type');
    triggerAutosave();
  }, [updateStorageGrowthMode, triggerAutosave]);

  const getRatesArray = (rates: number[] | undefined, defaultRate: number): number[] => {
    if (!rates || rates.length === 0) return Array(holdPeriod).fill(defaultRate);
    if (rates.length < holdPeriod) return [...rates, ...Array(holdPeriod - rates.length).fill(rates[rates.length - 1] ?? defaultRate)];
    return rates.slice(0, holdPeriod);
  };

  const cssVars = { '--label-width': labelWidth } as React.CSSProperties;

  const storageItemCount = storageMode === 'universal' ? 1 : Math.max(storageRevenueCategories.length, 1);
  const revenueItemCount = nonStorageRevenueCategories.length || 1;
  const opexItemCount = expenseCategories.length || 1;
  const deptItemCount = segmentExpenseCategories.length || 1;

  const sections = useMemo(() => {
    const all = [
      { id: 'storage', items: storageItemCount + 2 },
      { id: 'revenue', items: revenueItemCount + 4 },
      { id: 'opex', items: opexItemCount + 5 },
      { id: 'dept', items: deptItemCount + 2 },
    ];

    if (!useWideLayout) return { order: all.map(s => s.id), layout: 'stack' as const };

    const sorted = [...all].sort((a, b) => b.items - a.items);
    const col1: typeof all = [];
    const col2: typeof all = [];
    let col1Height = 0;
    let col2Height = 0;

    for (const section of sorted) {
      if (col1Height <= col2Height) {
        col1.push(section);
        col1Height += section.items;
      } else {
        col2.push(section);
        col2Height += section.items;
      }
    }

    return {
      col1: col1.map(s => s.id),
      col2: col2.map(s => s.id),
      layout: 'columns' as const,
    };
  }, [storageItemCount, revenueItemCount, opexItemCount, deptItemCount, useWideLayout]);

  const renderSection = (id: string) => {
    switch (id) {
      case 'storage':
        return (
          <SectionCard
            key="storage"
            title="Storage Revenue Growth"
            description="Year-specific growth rates for marina storage revenue"
            accent="blue"
            icon={Warehouse}
            headerAction={
              <ModeToggle
                value={storageMode}
                onChange={handleStorageModeChange}
              />
            }
          >
            <YearHeaders years={years} />
            {storageMode === 'universal' ? (
              <div>
                <YearlyRateRow
                  label="All Storage Types"
                  icon={Globe}
                  years={years}
                  rates={getRatesArray(storageGrowth.universalRates, defaultStorageRate)}
                  defaultRate={defaultStorageRate}
                  onChangeYear={(idx, val) => {
                    updateStorageUniversalRate(idx, val);
                    triggerAutosave();
                  }}
                  onApplyToAll={(val) => {
                    updateStorageUniversalRateAllYears(val);
                    triggerAutosave();
                  }}
                />
              </div>
            ) : (
              <div className="space-y-0.5">
                {storageRevenueCategories.map((category) => {
                  const storageCategory = STORAGE_CATEGORIES.find(s => s.id === category.id);
                  const IconComponent = storageCategory?.icon || Anchor;
                  return (
                    <YearlyRateRow
                      key={category.id}
                      label={category.name}
                      icon={IconComponent}
                      years={years}
                      rates={getRatesArray(storageGrowth.typeRatesByYear?.[category.id], defaultStorageRate)}
                      defaultRate={defaultStorageRate}
                      onChangeYear={(idx, val) => {
                        updateStorageTypeRate(category.id, idx, val);
                        triggerAutosave();
                      }}
                      onApplyToAll={(val) => {
                        updateStorageTypeRateAllYears(category.id, val);
                        triggerAutosave();
                      }}
                    />
                  );
                })}
                {storageRevenueCategories.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                    No storage types enabled. Enable them in Department Configuration.
                  </p>
                )}
              </div>
            )}
          </SectionCard>
        );

      case 'revenue':
        return (
          <SectionCard
            key="revenue"
            title="Revenue Growth Rates"
            description="Year-specific growth rates for non-storage revenue"
            accent="emerald"
            icon={TrendingUp}
            headerAction={<SetAllDropdown onSetAll={handleSetAllRevenue} />}
          >
            <YearHeaders years={years} />

            <CategoryGroup title="Core Marina Revenue" columns={1}>
              {REVENUE_CATEGORIES.coreMarineRevenue.map((cat) => {
                const isEnabled = nonStorageRevenueCategories.some(c => c.id === cat.id);
                if (!isEnabled) return null;
                return (
                  <YearlyRateRow
                    key={cat.id}
                    label={cat.label}
                    icon={cat.icon}
                    years={years}
                    rates={getRatesArray(growthRates[cat.id], defaultRevenueRate)}
                    defaultRate={defaultRevenueRate}
                    onChangeYear={(idx, val) => {
                      updateGrowthRate(cat.id, idx, val);
                      triggerAutosave();
                    }}
                    onApplyToAll={(val) => {
                      updateGrowthRateAllYears(cat.id, val);
                      triggerAutosave();
                    }}
                  />
                );
              })}
            </CategoryGroup>

            <CategoryGroup title="Retail & Service" columns={1}>
              {REVENUE_CATEGORIES.retailAndService.map((cat) => {
                const isEnabled = nonStorageRevenueCategories.some(c => c.id === cat.id);
                if (!isEnabled) return null;
                return (
                  <YearlyRateRow
                    key={cat.id}
                    label={cat.label}
                    icon={cat.icon}
                    years={years}
                    rates={getRatesArray(growthRates[cat.id], defaultRevenueRate)}
                    defaultRate={defaultRevenueRate}
                    onChangeYear={(idx, val) => {
                      updateGrowthRate(cat.id, idx, val);
                      triggerAutosave();
                    }}
                    onApplyToAll={(val) => {
                      updateGrowthRateAllYears(cat.id, val);
                      triggerAutosave();
                    }}
                  />
                );
              })}
            </CategoryGroup>

            <CategoryGroup title="Boats" columns={1}>
              {REVENUE_CATEGORIES.boats.map((cat) => {
                const isEnabled = nonStorageRevenueCategories.some(c => c.id === cat.id);
                if (!isEnabled) return null;
                return (
                  <YearlyRateRow
                    key={cat.id}
                    label={cat.label}
                    icon={cat.icon}
                    years={years}
                    rates={getRatesArray(growthRates[cat.id], defaultRevenueRate)}
                    defaultRate={defaultRevenueRate}
                    onChangeYear={(idx, val) => {
                      updateGrowthRate(cat.id, idx, val);
                      triggerAutosave();
                    }}
                    onApplyToAll={(val) => {
                      updateGrowthRateAllYears(cat.id, val);
                      triggerAutosave();
                    }}
                  />
                );
              })}
            </CategoryGroup>

            <CategoryGroup title="Leases & Hospitality" columns={1}>
              {REVENUE_CATEGORIES.leasesAndHospitality.map((cat) => {
                const isEnabled = nonStorageRevenueCategories.some(c => c.id === cat.id);
                if (!isEnabled) return null;
                return (
                  <YearlyRateRow
                    key={cat.id}
                    label={cat.label}
                    icon={cat.icon}
                    years={years}
                    rates={getRatesArray(growthRates[cat.id], defaultRevenueRate)}
                    defaultRate={defaultRevenueRate}
                    onChangeYear={(idx, val) => {
                      updateGrowthRate(cat.id, idx, val);
                      triggerAutosave();
                    }}
                    onApplyToAll={(val) => {
                      updateGrowthRateAllYears(cat.id, val);
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
        );

      case 'opex':
        return (
          <SectionCard
            key="opex"
            title="Operating Expense Growth"
            description="Year-specific growth rates for operating expenses"
            accent="slate"
            icon={Receipt}
            collapsible
            headerAction={<SetAllDropdown onSetAll={handleSetAllOpex} />}
          >
            <YearHeaders years={years} />

            <CategoryGroup title="Labor & Administration" columns={1}>
              {OPEX_CATEGORIES.laborAndAdmin.map((cat) => {
                const isEnabled = expenseCategories.some(c => c.id === cat.id);
                if (!isEnabled) return null;
                return (
                  <YearlyRateRow
                    key={cat.id}
                    label={cat.label}
                    icon={cat.icon}
                    years={years}
                    rates={getRatesArray(expenseGrowth[cat.id], cat.defaultValue || defaultExpenseRate)}
                    defaultRate={cat.defaultValue || defaultExpenseRate}
                    onChangeYear={(idx, val) => {
                      updateExpenseGrowth(cat.id, idx, val);
                      triggerAutosave();
                    }}
                    onApplyToAll={(val) => {
                      updateExpenseGrowthAllYears(cat.id, val);
                      triggerAutosave();
                    }}
                  />
                );
              })}
            </CategoryGroup>

            <CategoryGroup title="Marketing" columns={1}>
              {OPEX_CATEGORIES.marketing.map((cat) => {
                const isEnabled = expenseCategories.some(c => c.id === cat.id);
                if (!isEnabled) return null;
                return (
                  <YearlyRateRow
                    key={cat.id}
                    label={cat.label}
                    icon={cat.icon}
                    years={years}
                    rates={getRatesArray(expenseGrowth[cat.id], defaultExpenseRate)}
                    defaultRate={defaultExpenseRate}
                    onChangeYear={(idx, val) => {
                      updateExpenseGrowth(cat.id, idx, val);
                      triggerAutosave();
                    }}
                    onApplyToAll={(val) => {
                      updateExpenseGrowthAllYears(cat.id, val);
                      triggerAutosave();
                    }}
                  />
                );
              })}
            </CategoryGroup>

            <CategoryGroup title="Operations" columns={1}>
              {OPEX_CATEGORIES.operations.map((cat) => {
                const isEnabled = expenseCategories.some(c => c.id === cat.id);
                if (!isEnabled) return null;
                return (
                  <YearlyRateRow
                    key={cat.id}
                    label={cat.label}
                    icon={cat.icon}
                    years={years}
                    rates={getRatesArray(expenseGrowth[cat.id], defaultExpenseRate)}
                    defaultRate={defaultExpenseRate}
                    onChangeYear={(idx, val) => {
                      updateExpenseGrowth(cat.id, idx, val);
                      triggerAutosave();
                    }}
                    onApplyToAll={(val) => {
                      updateExpenseGrowthAllYears(cat.id, val);
                      triggerAutosave();
                    }}
                  />
                );
              })}
            </CategoryGroup>

            <CategoryGroup title="Financial" columns={1}>
              {OPEX_CATEGORIES.financial.map((cat) => {
                const isEnabled = expenseCategories.some(c => c.id === cat.id);
                if (!isEnabled) return null;
                return (
                  <YearlyRateRow
                    key={cat.id}
                    label={cat.label}
                    icon={cat.icon}
                    years={years}
                    rates={getRatesArray(expenseGrowth[cat.id], defaultExpenseRate)}
                    defaultRate={defaultExpenseRate}
                    onChangeYear={(idx, val) => {
                      updateExpenseGrowth(cat.id, idx, val);
                      triggerAutosave();
                    }}
                    onApplyToAll={(val) => {
                      updateExpenseGrowthAllYears(cat.id, val);
                      triggerAutosave();
                    }}
                  />
                );
              })}
            </CategoryGroup>
          </SectionCard>
        );

      case 'dept':
        return (
          <SectionCard
            key="dept"
            title="Departmental Expense Growth"
            description="Year-specific growth rates for segment-specific expenses"
            accent="purple"
            icon={PieChart}
            collapsible
            headerAction={<SetAllDropdown onSetAll={handleSetAllDepartmental} />}
          >
            <YearHeaders years={years} />
            <div className="space-y-0.5">
              {DEPARTMENTAL_EXPENSE_CATEGORIES.map((cat) => {
                const isEnabled = segmentExpenseCategories.some(c => c.id === cat.id);
                if (!isEnabled) return null;
                return (
                  <YearlyRateRow
                    key={cat.id}
                    label={cat.label}
                    icon={cat.icon}
                    years={years}
                    rates={getRatesArray(expenseGrowth[cat.id], defaultExpenseRate)}
                    defaultRate={defaultExpenseRate}
                    onChangeYear={(idx, val) => {
                      updateExpenseGrowth(cat.id, idx, val);
                      triggerAutosave();
                    }}
                    onApplyToAll={(val) => {
                      updateExpenseGrowthAllYears(cat.id, val);
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
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3" style={cssVars}>
      <QuickActionsBar
        modifiedCount={modifiedCount}
        totalCount={totalCount}
        onReset={handleReset}
        onPreset={handlePreset}
      />

      {sections.layout === 'stack' ? (
        <div className="space-y-3">
          {(sections as { order: string[]; layout: 'stack' }).order.map(renderSection)}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
          <div className="space-y-3">
            {(sections as { col1: string[]; col2: string[]; layout: 'columns' }).col1.map(renderSection)}
          </div>
          <div className="space-y-3">
            {(sections as { col1: string[]; col2: string[]; layout: 'columns' }).col2.map(renderSection)}
          </div>
        </div>
      )}
    </div>
  );
}

export default GrowthRatesTab;
