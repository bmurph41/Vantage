#!/usr/bin/env node
// Patches PLReviewGrid.tsx:
// 1. Adds sortable column headers to the grouped table (Line Item, Amount, Status)
// 2. Moves bulk action bar from fixed-top to inline sticky below the toolbar
// Run: node /tmp/patch-plreviewgrid.mjs

import fs from 'fs';

const FILE = '/home/runner/workspace/client/src/components/doc-intel/PLReviewGrid.tsx';
let src = fs.readFileSync(FILE, 'utf8');
const original = src;

// ─── 1. Add grouped sort state after existing sorting state ──────────────────
src = src.replace(
  `  const [sorting, setSorting] = useState<SortingState>([]);`,
  `  const [sorting, setSorting] = useState<SortingState>([]);
  const [groupedSortField, setGroupedSortField] = useState<'lineItemName' | 'totalAmount' | 'status' | null>(null);
  const [groupedSortDir, setGroupedSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleGroupedSort = (field: 'lineItemName' | 'totalAmount' | 'status') => {
    if (groupedSortField === field) {
      setGroupedSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setGroupedSortField(field);
      setGroupedSortDir('asc');
    }
  };`
);

// ─── 2. Sort filteredLineItems by the selected field ─────────────────────────
src = src.replace(
  `  // Filter lineItems based on statusFilter prop - must be before any early returns
  const filteredLineItems = useMemo(() => {
    if (!groupedData?.lineItems) return [];
    if (statusFilter === 'all') return groupedData.lineItems;
    
    return groupedData.lineItems.filter((lineItem) => {
      // For pending filter, also include needs_review
      if (statusFilter === 'pending') {
        return lineItem.status === 'pending' || lineItem.status === 'needs_review';
      }
      return lineItem.status === statusFilter;
    });
  }, [groupedData?.lineItems, statusFilter]);`,
  `  // Filter + sort lineItems — must be before any early returns
  const filteredLineItems = useMemo(() => {
    if (!groupedData?.lineItems) return [];
    let list = statusFilter === 'all'
      ? groupedData.lineItems
      : groupedData.lineItems.filter((lineItem) => {
          if (statusFilter === 'pending') return lineItem.status === 'pending' || lineItem.status === 'needs_review';
          return lineItem.status === statusFilter;
        });

    if (groupedSortField) {
      const dir = groupedSortDir === 'asc' ? 1 : -1;
      list = [...list].sort((a, b) => {
        if (groupedSortField === 'lineItemName') {
          return dir * a.lineItemName.localeCompare(b.lineItemName);
        }
        if (groupedSortField === 'totalAmount') {
          return dir * ((a.totalAmount ?? 0) - (b.totalAmount ?? 0));
        }
        if (groupedSortField === 'status') {
          return dir * a.status.localeCompare(b.status);
        }
        return 0;
      });
    }
    return list;
  }, [groupedData?.lineItems, statusFilter, groupedSortField, groupedSortDir]);`
);

// ─── 3. Add SortableHead helper component just before the export function ─────
const SORTABLE_HEAD = `
// ─── Sortable column header helper ───────────────────────────────────────────
function SortableHead({
  label,
  field,
  activeField,
  dir,
  onToggle,
  className = '',
}: {
  label: string;
  field: string;
  activeField: string | null;
  dir: 'asc' | 'desc';
  onToggle: (f: any) => void;
  className?: string;
}) {
  const isActive = activeField === field;
  return (
    <button
      type="button"
      className={\`flex items-center gap-1 text-xs font-medium text-left w-full hover:text-foreground transition-colors \${isActive ? 'text-foreground' : 'text-muted-foreground'} \${className}\`}
      onClick={() => onToggle(field)}
    >
      {label}
      <span className="flex flex-col leading-none ml-0.5">
        <span className={\`text-[8px] leading-none \${isActive && dir === 'asc' ? 'text-primary' : 'text-muted-foreground/40'}\`}>▲</span>
        <span className={\`text-[8px] leading-none \${isActive && dir === 'desc' ? 'text-primary' : 'text-muted-foreground/40'}\`}>▼</span>
      </span>
    </button>
  );
}

`;

src = src.replace(
  `export function PLReviewGrid(`,
  SORTABLE_HEAD + `export function PLReviewGrid(`
);

// ─── 4. Replace static TableHead cells in the grouped table with sortable ones ─
// Target: the three sortable headers — Line Item, Total, Status
src = src.replace(
  `                    <TableHead className="bg-muted/50 sticky left-8 z-20 w-[160px]">Line Item</TableHead>`,
  `                    <TableHead className="bg-muted/50 sticky left-8 z-20 w-[160px]">
                      <SortableHead label="Line Item" field="lineItemName" activeField={groupedSortField} dir={groupedSortDir} onToggle={toggleGroupedSort} />
                    </TableHead>`
);

src = src.replace(
  `                    {groupedData.isMultiColumn && (
                      <TableHead className="bg-muted/50 text-right w-[75px] sticky right-[140px] z-20 px-1">Total</TableHead>
                    )}`,
  `                    {groupedData.isMultiColumn && (
                      <TableHead className="bg-muted/50 text-right w-[75px] sticky right-[140px] z-20 px-1">
                        <SortableHead label="Total" field="totalAmount" activeField={groupedSortField} dir={groupedSortDir} onToggle={toggleGroupedSort} className="justify-end" />
                      </TableHead>
                    )}`
);

src = src.replace(
  `                    <TableHead className="bg-muted/50 text-center w-[70px] sticky right-[70px] z-20 px-1">Status</TableHead>`,
  `                    <TableHead className="bg-muted/50 text-center w-[70px] sticky right-[70px] z-20 px-1">
                      <SortableHead label="Status" field="status" activeField={groupedSortField} dir={groupedSortDir} onToggle={toggleGroupedSort} className="justify-center" />
                    </TableHead>`
);

// Also add Amount sort header for single-column view
src = src.replace(
  `                    ) : (
                      <TableHead className="bg-muted/50 text-right w-[80px]">Amount</TableHead>
                    )}`,
  `                    ) : (
                      <TableHead className="bg-muted/50 text-right w-[80px]">
                        <SortableHead label="Amount" field="totalAmount" activeField={groupedSortField} dir={groupedSortDir} onToggle={toggleGroupedSort} className="justify-end" />
                      </TableHead>
                    )}`
);

// ─── 5. Move bulk action bar from fixed-top to sticky inline bar ──────────────
// Replace the fixed-top bulk action bar with an inline sticky version
src = src.replace(
  `            {/* Bulk Action Bar - fixed at top of viewport when rows are selected */}
            {selectedRowKeys.size > 0 && (
              <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-3 flex items-center justify-between gap-4 shadow-lg">`,
  `            {/* Bulk Action Bar - sticky inline below toolbar */}
            {selectedRowKeys.size > 0 && (
              <div className="sticky top-0 z-30 bg-primary text-primary-foreground px-3 py-2 flex items-center justify-between gap-4 shadow-md rounded-t-lg">`
);

// ─── Verify ───────────────────────────────────────────────────────────────────
if (src === original) {
  console.error('❌ No changes made — patterns may have shifted. Check the file manually.');
  process.exit(1);
}

fs.writeFileSync(FILE, src, 'utf8');
console.log('✅ PLReviewGrid.tsx patched:');
console.log('   • Added groupedSortField / groupedSortDir state');
console.log('   • Added toggleGroupedSort() handler');
console.log('   • filteredLineItems now sorts by clicked column');
console.log('   • SortableHead component added (▲▼ indicators)');
console.log('   • Line Item, Amount/Total, Status columns now sortable');
console.log('   • Bulk action bar moved from fixed-top to sticky inline');
