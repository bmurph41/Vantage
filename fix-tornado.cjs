#!/usr/bin/env node
/**
 * fix-tornado.cjs
 * 
 * Fixes the corrupted sensitivity-tornado.tsx:
 *   1. Replaces broken query block with clean version
 *   2. Removes generateSimulatedData function
 *   3. Removes duplicate code after component close
 */

const fs = require('fs');
const path = require('path');

const file = path.resolve('client/src/pages/modeling/projects/workspace/sensitivity-tornado.tsx');
let c = fs.readFileSync(file, 'utf8');

// Step 1: Find the component end and remove everything after it
// The component should end with "  );\n}\n" — anything after is duplicate garbage
const componentEndPattern = /(\n  \);\n\})\n[\s\S]*$/;
const endMatch = c.match(componentEndPattern);
if (endMatch && endMatch.index !== undefined) {
  const afterEnd = c.slice(endMatch.index + endMatch[1].length);
  if (afterEnd.trim().length > 0) {
    c = c.slice(0, endMatch.index + endMatch[1].length) + '\n';
    console.log('  ✓ Removed duplicate code after component close');
  }
}

// Step 2: Replace the entire broken useQuery + generateSimulatedData block
// Find from "const { data: tornadoData" to end of generateSimulatedData
const startMarker = '  const { data: tornadoData, isLoading, refetch } = useQuery<TornadoDataPoint[]>({';
const startIdx = c.indexOf(startMarker);

if (startIdx === -1) {
  console.log('ERROR: Could not find tornadoData query start');
  process.exit(1);
}

// Find the end of generateSimulatedData — it ends with "}).sort((a, b) => b.totalRange - a.totalRange);\n  };"
const endMarkerOptions = [
  '.sort((a, b) => b.totalRange - a.totalRange);\n  };',
  '.sort((a, b) => b.totalRange - a.totalRange);\r\n  };',
];

let endIdx = -1;
for (const marker of endMarkerOptions) {
  const idx = c.indexOf(marker, startIdx);
  if (idx !== -1) {
    endIdx = idx + marker.length;
    break;
  }
}

if (endIdx === -1) {
  // Try to find just the end of generateSimulatedData
  const altEnd = c.indexOf('  };\n\n  const chartData', startIdx);
  if (altEnd !== -1) {
    endIdx = altEnd;
    console.log('  Found alternate end marker at chartData');
  } else {
    // Last resort: find next "const chartData" or "const formatValue"
    const lastResort = c.indexOf('\n  const chartData', startIdx);
    if (lastResort !== -1) {
      endIdx = lastResort;
      console.log('  Found last-resort end marker');
    } else {
      console.log('ERROR: Could not find end of generateSimulatedData');
      process.exit(1);
    }
  }
}

// Build the clean replacement
const cleanBlock = `  const { data: tornadoData, isLoading, refetch } = useQuery<TornadoDataPoint[]>({
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
              totalRange: Math.abs(d.high - d.low),
              unit: selectedMetric === 'irr' ? '%' : selectedMetric === 'equity_multiple' ? 'x' : '$',
            }));
          }
        }
      } catch {
        // DCF endpoint not available
      }

      // Fallback to legacy endpoint
      const params = new URLSearchParams({ metric: selectedMetric, variance: String(varianceRange) });
      const response = await fetch(\`/api/modeling/projects/\${projectId}/sensitivity-tornado?\${params}\`);
      if (!response.ok) return [];
      return response.json();
    },
  });
`;

c = c.slice(0, startIdx) + cleanBlock + c.slice(endIdx);

fs.writeFileSync(file, c);
console.log('  ✓ Replaced broken query block + removed generateSimulatedData');

// Verify
const remaining = fs.readFileSync(file, 'utf8');
const hasHardcoded = remaining.includes('15000000') || remaining.includes('975000') || remaining.includes('generateSimulatedData');
if (hasHardcoded) {
  console.log('  WARNING: Some hardcoded values may remain. Checking...');
  const lines = remaining.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('15000000') || l.includes('975000') || l.includes('generateSimulatedData')) {
      console.log('    Line ' + (i+1) + ': ' + l.trim().slice(0, 80));
    }
  });
} else {
  console.log('  ✓ All hardcoded values removed');
}

console.log('\nDone! Run: npx tsc --noEmit 2>&1 | grep -v OnboardingWizard | grep error | head -10');
