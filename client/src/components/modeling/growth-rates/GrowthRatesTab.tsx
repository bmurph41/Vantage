import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  DEPARTMENT_CARDS,
  REVENUE_ONLY_IDS,
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
import { cn } from '@/lib/utils';

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
  margins: Record<string, { historical: number; projected: number }>;
  updateMargin: (categoryId: string, field: 'historical' | 'projected', value: number) => void;
  enabledDepartments: string[];
}

function CogsMarginRow({
  historical,
  projected,
  onChangeHistorical,
  onChangeProjected,
}: {
  historical: number;
  projected: number;
  onChangeHistorical: (val: number) => void;
  onChangeProjected: (val: number) => void;
}) {
  const [localHist, setLocalHist] = useState(String(historical));
  const [localProj, setLocalProj] = useState(String(projected));
  const histFocused = useRef(false);
  const projFocused = useRef(false);

  useEffect(() => {
    if (!histFocused.current) setLocalHist(String(historical));
  }, [historical]);
  useEffect(() => {
    if (!projFocused.current) setLocalProj(String(projected));
  }, [projected]);

  const commitHist = () => {
    histFocused.current = false;
    const v = parseFloat(localHist);
    if (!isNaN(v)) {
      const clamped = Math.min(100, Math.max(0, v));
      onChangeHistorical(clamped);
      setLocalHist(String(clamped));
    } else {
      setLocalHist(String(historical));
    }
  };

  const commitProj = () => {
    projFocused.current = false;
    const v = parseFloat(localProj);
    if (!isNaN(v)) {
      const clamped = Math.min(100, Math.max(0, v));
      onChangeProjected(clamped);
      setLocalProj(String(clamped));
    } else {
      setLocalProj(String(projected));
    }
  };

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded-md bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50">
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex-shrink-0">COGS Margin</span>
      <div className="flex items-center gap-2 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Historical</span>
          <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 overflow-hidden">
            <input
              type="text"
              inputMode="decimal"
              value={localHist}
              onFocus={(e) => { histFocused.current = true; e.target.select(); }}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                  setLocalHist(raw);
                  const v = parseFloat(raw);
                  if (!isNaN(v)) onChangeHistorical(Math.min(100, Math.max(0, v)));
                }
              }}
              onBlur={commitHist}
              onKeyDown={(e) => { if (e.key === 'Enter') { commitHist(); (e.target as HTMLInputElement).blur(); } }}
              className="w-12 text-center text-[11px] font-mono py-1 bg-transparent outline-none text-slate-700 dark:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[9px] text-slate-400 dark:text-slate-500 pr-1.5 font-medium select-none">%</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Projected</span>
          <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 overflow-hidden">
            <input
              type="text"
              inputMode="decimal"
              value={localProj}
              onFocus={(e) => { projFocused.current = true; e.target.select(); }}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                  setLocalProj(raw);
                  const v = parseFloat(raw);
                  if (!isNaN(v)) onChangeProjected(Math.min(100, Math.max(0, v)));
                }
              }}
              onBlur={commitProj}
              onKeyDown={(e) => { if (e.key === 'Enter') { commitProj(); (e.target as HTMLInputElement).blur(); } }}
              className="w-12 text-center text-[11px] font-mono py-1 bg-transparent outline-none text-slate-700 dark:text-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[9px] text-slate-400 dark:text-slate-500 pr-1.5 font-medium select-none">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const DEPT_CARD_IDS = new Set(DEPARTMENT_CARDS.map(d => d.revenueId));

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
  margins,
  updateMargin,
  enabledDepartments,
}: GrowthRatesTabProps) {
  const defaultRevenueRate = getDefaultGrowthRate();
  const defaultExpenseRate = getDefaultExpenseRate();
  const defaultStorageRate = getDefaultStorageRate();
  const holdPeriod = years.length;

  const labelWidth = holdPeriod <= 5 ? '130px' : holdPeriod <= 7 ? '110px' : '90px';
  const useWideLayout = holdPeriod <= 7;

  const enabledDeptSet = useMemo(() => new Set(enabledDepartments), [enabledDepartments]);

  const enabledDeptCards = useMemo(() => {
    return DEPARTMENT_CARDS.filter(d => enabledDeptSet.has(d.id));
  }, [enabledDeptSet]);

  const revenueOnlyCategories = useMemo(() => {
    const allRevCats = [
      ...REVENUE_CATEGORIES.coreMarineRevenue,
      ...REVENUE_CATEGORIES.retailAndService,
      ...REVENUE_CATEGORIES.boats,
      ...REVENUE_CATEGORIES.leasesAndHospitality,
    ];
    return allRevCats.filter(cat => REVENUE_ONLY_IDS.has(cat.id) && nonStorageRevenueCategories.some(c => c.id === cat.id));
  }, [nonStorageRevenueCategories]);

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

  const handleSetAllRevenueOther = useCallback((value: number) => {
    revenueOnlyCategories.forEach(cat => {
      updateGrowthRateAllYears(cat.id, value);
    });
    triggerAutosave();
  }, [revenueOnlyCategories, updateGrowthRateAllYears, triggerAutosave]);

  const handleSetAllOpex = useCallback((value: number) => {
    expenseCategories.forEach(cat => {
      updateExpenseGrowthAllYears(cat.id, value);
    });
    triggerAutosave();
  }, [expenseCategories, updateExpenseGrowthAllYears, triggerAutosave]);

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
  const revenueOtherItemCount = revenueOnlyCategories.length || 1;
  const opexItemCount = expenseCategories.length || 1;

  const getDeptCardItemCount = (dept: typeof DEPARTMENT_CARDS[0]) => {
    if (dept.hasCogs && dept.deptExpenseId) return 6;
    if (dept.hasCogs) return 4;
    if (dept.deptExpenseId) return 5;
    return 3;
  };

  const sections = useMemo(() => {
    const all: Array<{ id: string; items: number }> = [
      { id: 'storage', items: storageItemCount + 2 },
    ];

    enabledDeptCards.forEach(dept => {
      all.push({ id: `dept_${dept.id}`, items: getDeptCardItemCount(dept) });
    });

    all.push({ id: 'revenue_other', items: revenueOtherItemCount + 2 });
    all.push({ id: 'opex', items: opexItemCount + 5 });

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
  }, [storageItemCount, revenueOtherItemCount, opexItemCount, enabledDeptCards, useWideLayout]);

  const renderDeptCard = (dept: typeof DEPARTMENT_CARDS[0]) => {
    const DeptIcon = dept.icon;
    const margin = margins[dept.revenueId] || { historical: 0, projected: 0 };

    return (
      <SectionCard
        key={`dept_${dept.id}`}
        title={dept.label}
        description={`Revenue growth${dept.hasCogs ? ', COGS margin' : ''}${dept.deptExpenseId ? ', expense growth' : ''}`}
        accent="emerald"
        icon={DeptIcon}
      >
        <div className="space-y-2">
          <div>
            <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 px-1">Revenue Growth</div>
            <YearHeaders years={years} />
            <YearlyRateRow
              label={dept.label}
              icon={DeptIcon}
              years={years}
              rates={getRatesArray(growthRates[dept.revenueId], defaultRevenueRate)}
              defaultRate={defaultRevenueRate}
              onChangeYear={(idx, val) => {
                updateGrowthRate(dept.revenueId, idx, val);
                triggerAutosave();
              }}
              onApplyToAll={(val) => {
                updateGrowthRateAllYears(dept.revenueId, val);
                triggerAutosave();
              }}
            />
          </div>

          {dept.hasCogs && (
            <CogsMarginRow
              historical={margin.historical}
              projected={margin.projected}
              onChangeHistorical={(val) => {
                updateMargin(dept.revenueId, 'historical', val);
                triggerAutosave();
              }}
              onChangeProjected={(val) => {
                updateMargin(dept.revenueId, 'projected', val);
                triggerAutosave();
              }}
            />
          )}

          {dept.deptExpenseId && (
            <div>
              <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 px-1">Direct Expense Growth</div>
              <YearHeaders years={years} />
              <YearlyRateRow
                label={`${dept.label} Expenses`}
                icon={Receipt}
                years={years}
                rates={getRatesArray(expenseGrowth[dept.deptExpenseId], defaultExpenseRate)}
                defaultRate={defaultExpenseRate}
                onChangeYear={(idx, val) => {
                  updateExpenseGrowth(dept.deptExpenseId!, idx, val);
                  triggerAutosave();
                }}
                onApplyToAll={(val) => {
                  updateExpenseGrowthAllYears(dept.deptExpenseId!, val);
                  triggerAutosave();
                }}
              />
            </div>
          )}
        </div>
      </SectionCard>
    );
  };

  const renderSection = (id: string) => {
    if (id.startsWith('dept_')) {
      const deptId = id.replace('dept_', '');
      const dept = enabledDeptCards.find(d => d.id === deptId);
      if (!dept) return null;
      return renderDeptCard(dept);
    }

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

      case 'revenue_other':
        return (
          <SectionCard
            key="revenue_other"
            title="Other Revenue Growth"
            description="Year-specific growth rates for non-department revenue"
            accent="emerald"
            icon={TrendingUp}
            headerAction={<SetAllDropdown onSetAll={handleSetAllRevenueOther} />}
          >
            <YearHeaders years={years} />
            <div className="space-y-0.5">
              {revenueOnlyCategories.map((cat) => (
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
              ))}
              {revenueOnlyCategories.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  No additional revenue categories enabled.
                </p>
              )}
            </div>
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
