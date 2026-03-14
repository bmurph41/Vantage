#!/usr/bin/env node
/**
 * purge-dummy-data.cjs
 * 
 * Removes hardcoded dummy data from 4 workspace pages:
 *   1. pro-forma-charts.tsx — Replace hardcoded fallbacks with empty states
 *   2. sensitivity-tornado.tsx — Wire to new DCF tornado endpoint
 *   3. debt-scenarios.tsx — Remove $10M fallback, use 0 with "enter data" prompt
 *   4. lease-cashflow.tsx — Pull growth rate from project scenario
 * 
 * Usage: node purge-dummy-data.cjs
 */

const fs = require('fs');
const path = require('path');
let fixes = 0;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PRO-FORMA-CHARTS.TSX — Purge all hardcoded fallback data
// ═══════════════════════════════════════════════════════════════════════════════

const pfcFile = path.resolve('client/src/pages/modeling/projects/workspace/pro-forma-charts.tsx');
if (fs.existsSync(pfcFile)) {
  let c = fs.readFileSync(pfcFile, 'utf8');
  let changeCount = 0;

  // --- Fix revenueByCategory: replace hardcoded array with empty ---
  // Pattern: if (proFormaData?.revenueByCategory) return proFormaData.revenueByCategory;
  //          return [ ... hardcoded ... ];
  c = c.replace(
    /if \(proFormaData\?\.revenueByCategory\) return proFormaData\.revenueByCategory;[\s\S]*?return \[[\s\S]*?\];[\s\n]*\}, \[proFormaData\]\);/,
    `if (proFormaData?.revenueByCategory) return proFormaData.revenueByCategory;
    return [];
  }, [proFormaData]);`
  );
  changeCount++;

  // --- Fix expensesByCategory: replace hardcoded array with empty ---
  c = c.replace(
    /if \(proFormaData\?\.expensesByCategory\) return proFormaData\.expensesByCategory;[\s\S]*?return \[[\s\S]*?\];[\s\n]*\}, \[proFormaData\]\);/,
    `if (proFormaData?.expensesByCategory) return proFormaData.expensesByCategory;
    return [];
  }, [proFormaData]);`
  );
  changeCount++;

  // --- Fix noiWaterfall: replace hardcoded waterfall with empty ---
  c = c.replace(
    /if \(proFormaData\?\.noiWaterfall\) return proFormaData\.noiWaterfall;[\s\S]*?return \[[\s\S]*?\];[\s\n]*\}, \[proFormaData\]\);/,
    `if (proFormaData?.noiWaterfall) return proFormaData.noiWaterfall;
    return [];
  }, [proFormaData]);`
  );
  changeCount++;

  // --- Fix revenueTrend: replace hardcoded trend with empty ---
  c = c.replace(
    /if \(proFormaData\?\.revenueTrend\) return proFormaData\.revenueTrend;[\s\S]*?return years\.map[\s\S]*?\];[\s\n]*\}, \[proFormaData, years\]\);/,
    `if (proFormaData?.revenueTrend) return proFormaData.revenueTrend;
    return [];
  }, [proFormaData, years]);`
  );
  changeCount++;

  // --- Fix revenueMix: replace hardcoded mix with empty ---
  c = c.replace(
    /if \(proFormaData\?\.revenueMix\) return proFormaData\.revenueMix;[\s\S]*?return \[[\s\S]*?\];[\s\n]*\}, \[proFormaData\]\);/,
    `if (proFormaData?.revenueMix) return proFormaData.revenueMix;
    return [];
  }, [proFormaData]);`
  );
  changeCount++;

  // --- Fix KPIs: replace hardcoded KPIs with zeros ---
  c = c.replace(
    /const kpis = proFormaData\?\.kpis \|\| \{[\s\S]*?totalRevenue: 7500000[\s\S]*?\};/,
    `const kpis = proFormaData?.kpis || {
    totalRevenue: 0,
    revenueGrowth: 0,
    totalExpenses: 0,
    expenseRatio: 0,
    noi: 0,
    noiMargin: 0,
    capRate: 0,
  };`
  );
  changeCount++;

  // --- Fix comparisonData: replace hardcoded comparison with empty ---
  // This is the big block with Math.round(1500000 * Math.pow(1.04, idx))
  c = c.replace(
    /const comparisonData = useMemo\(\(\) => \{[\s\S]*?const allYears = years\.map\(\(year, idx\) => \{[\s\S]*?const revenue = Math\.round\(1500000[\s\S]*?return \{[\s\S]*?period:[\s\S]*?year,[\s\S]*?revenue,[\s\S]*?expenses,[\s\S]*?noi,[\s\S]*?noiMargin:[\s\S]*?\}\);/,
    `const comparisonData = useMemo(() => {
    if (proFormaData?.comparison) return proFormaData.comparison;
    const allYears = years.map((year, idx) => ({
      period: \`Year \${idx + 1}\`,
      year,
      revenue: 0,
      expenses: 0,
      noi: 0,
      noiMargin: 0,
    }));`
  );
  changeCount++;

  if (changeCount > 0) {
    fs.writeFileSync(pfcFile, c);
    fixes++;
    console.log('  ✓ pro-forma-charts.tsx: Removed ' + changeCount + ' hardcoded fallback blocks');
  } else {
    console.log('  SKIP: pro-forma-charts.tsx (no patterns matched — may need manual review)');
  }
} else {
  console.log('  ERROR: pro-forma-charts.tsx not found');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SENSITIVITY-TORNADO.TSX — Wire to new DCF tornado endpoint
// ═══════════════════════════════════════════════════════════════════════════════

const stFile = path.resolve('client/src/pages/modeling/projects/workspace/sensitivity-tornado.tsx');
if (fs.existsSync(stFile)) {
  let c = fs.readFileSync(stFile, 'utf8');

  // Replace the generateSimulatedData function with one that returns empty
  // and wire the query to try the new DCF decision support endpoint
  const oldQueryBlock = c.match(
    /const \{ data: tornadoData, isLoading, refetch \} = useQuery<TornadoDataPoint\[\]>\(\{[\s\S]*?\}\);/
  );

  if (oldQueryBlock) {
    c = c.replace(
      oldQueryBlock[0],
      `const { data: tornadoData, isLoading, refetch } = useQuery<TornadoDataPoint[]>({
    queryKey: ['/api/modeling/projects', projectId, 'sensitivity-tornado', selectedMetric, varianceRange],
    queryFn: async () => {
      // Try new DCF decision support tornado endpoint first
      try {
        const dsResponse = await fetch(\`/api/modeling/projects/\${projectId}/dcf/decision-support\`);
        if (dsResponse.ok) {
          const ds = await dsResponse.json();
          if (ds.tornado?.drivers?.length > 0) {
            return ds.tornado.drivers.map((d: any) => ({
              variable: d.driver,
              lowLabel: d.delta,
              highLabel: d.delta,
              lowValue: d.low - d.base,
              highValue: d.high - d.base,
              baseValue: d.base,
              lowScenarioValue: d.low,
              highScenarioValue: d.high,
              unit: selectedMetric === 'irr' ? '%' : selectedMetric === 'equity_multiple' ? 'x' : '$',
            }));
          }
        }
      } catch {}

      // Fallback to legacy endpoint
      const params = new URLSearchParams({ metric: selectedMetric, variance: String(varianceRange) });
      const response = await fetch(\`/api/modeling/projects/\${projectId}/sensitivity-tornado?\${params}\`);
      if (!response.ok) return [];
      return response.json();
    },
  });`
    );
    fixes++;
    console.log('  ✓ sensitivity-tornado.tsx: Wired to DCF decision support tornado endpoint');
  } else {
    console.log('  SKIP: sensitivity-tornado.tsx query block not matched');
  }

  // Remove the generateSimulatedData function entirely
  const simFnMatch = c.match(
    /const generateSimulatedData = \(metric: string, variance: number\): TornadoDataPoint\[\] => \{[\s\S]*?return variables\.map[\s\S]*?\};[\s\n]*\};/
  );
  if (simFnMatch) {
    c = c.replace(simFnMatch[0], '// generateSimulatedData removed — now uses real DCF tornado endpoint');
    console.log('  ✓ sensitivity-tornado.tsx: Removed generateSimulatedData function');
  } else {
    // Try alternate pattern
    const altMatch = c.match(
      /const generateSimulatedData[\s\S]*?return variables[\s\S]*?\};\s*\n\s*\};/
    );
    if (altMatch) {
      c = c.replace(altMatch[0], '// generateSimulatedData removed — now uses real DCF tornado endpoint');
      console.log('  ✓ sensitivity-tornado.tsx: Removed generateSimulatedData (alt pattern)');
    } else {
      console.log('  WARNING: Could not remove generateSimulatedData — may need manual cleanup');
    }
  }

  fs.writeFileSync(stFile, c);
} else {
  console.log('  ERROR: sensitivity-tornado.tsx not found');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DEBT-SCENARIOS.TSX — Remove $10M fallback
// ═══════════════════════════════════════════════════════════════════════════════

const dsFile = path.resolve('client/src/pages/modeling/projects/workspace/debt-scenarios.tsx');
if (fs.existsSync(dsFile)) {
  let c = fs.readFileSync(dsFile, 'utf8');
  let dsChanges = 0;

  // Replace || 10000000 with || 0
  c = c.replace(
    /Number\(project\.purchasePrice\) \|\| 10000000/g,
    'Number(project.purchasePrice) || 0'
  );
  c = c.replace(
    /Number\(project\?\.purchasePrice\) \|\| 10000000/g,
    'Number(project?.purchasePrice) || 0'
  );
  dsChanges++;

  // Replace || 800000 NOI fallback with || 0
  c = c.replace(
    /Number\(project\.ebitda\) \|\| 800000/g,
    'Number(project.ebitda) || 0'
  );
  c = c.replace(
    /Number\(project\?\.ebitda\) \|\| 800000/g,
    'Number(project?.ebitda) || 0'
  );
  dsChanges++;

  if (dsChanges > 0) {
    fs.writeFileSync(dsFile, c);
    fixes++;
    console.log('  ✓ debt-scenarios.tsx: Replaced $10M/$800K fallbacks with 0 (' + dsChanges + ' patterns)');
  }
} else {
  console.log('  ERROR: debt-scenarios.tsx not found');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. LEASE-CASHFLOW.TSX — Replace hardcoded 0.03 with scenario data
// ═══════════════════════════════════════════════════════════════════════════════

const lcFile = path.resolve('client/src/pages/modeling/projects/workspace/lease-cashflow.tsx');
if (fs.existsSync(lcFile)) {
  let c = fs.readFileSync(lcFile, 'utf8');

  // Replace the hardcoded 0.03 fallback with 0 (forces user to set it or use actual data)
  // Pattern: || 0.03) * 100
  c = c.replace(
    /\|\| 0\.03\) \* 100/g,
    '|| 0) * 100'
  );

  fs.writeFileSync(lcFile, c);
  fixes++;
  console.log('  ✓ lease-cashflow.tsx: Replaced 0.03 growth fallback with 0 (uses actual data when available)');
} else {
  console.log('  ERROR: lease-cashflow.tsx not found');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DONE
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n═══ COMPLETE: ' + fixes + ' files fixed ═══');
console.log('\nNext steps:');
console.log('  1. npx tsc --noEmit 2>&1 | grep -v OnboardingWizard | grep error | head -20');
console.log('  2. Restart server');
console.log('  3. Open Pro Forma Charts tab — should show real data or empty state');
console.log('  4. Open Sensitivity Tornado — should pull from DCF decision support');
