import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowUpCircle,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Layers,
  List,
  Trash2,
  Undo2,
} from 'lucide-react';
import { ADDBACK_REASONS, type Addback } from '@/hooks/useModelingAddbacks';

type ViewMode = 'itemized' | 'category' | 'department';

interface AddbacksTrackerPanelProps {
  addbacks: Addback[];
  onToggle: (addbackId: string, isActive: boolean) => Promise<void>;
  onDelete: (addbackId: string) => Promise<void>;
  isPending: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const reasonLabels: Record<string, string> = {};
ADDBACK_REASONS.forEach(r => { reasonLabels[r.value] = r.label; });

const scopeLabels: Record<string, string> = {
  line_item: 'Line',
  category: 'Dept',
  month_cell: 'Month',
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getReasonBadgeColor = (reason: string | null) => {
  switch (reason) {
    case 'one_time': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'owner_related': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'non_operating': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    case 'management_fee': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'capex': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'litigation': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

const getAddbackAmount = (addback: Addback): number => {
  return addback.values.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
};

export function AddbacksTrackerPanel({
  addbacks,
  onToggle,
  onDelete,
  isPending,
}: AddbacksTrackerPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('itemized');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const activeAddbacks = useMemo(() => addbacks.filter(a => a.isActive), [addbacks]);
  const inactiveAddbacks = useMemo(() => addbacks.filter(a => !a.isActive), [addbacks]);

  const totalAmount = useMemo(() =>
    activeAddbacks.reduce((sum, a) => sum + getAddbackAmount(a), 0),
    [activeAddbacks]
  );

  const categoryGroups = useMemo(() => {
    const groups: Record<string, { addbacks: Addback[]; total: number }> = {};
    activeAddbacks.forEach(a => {
      const cat = a.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = { addbacks: [], total: 0 };
      groups[cat].addbacks.push(a);
      groups[cat].total += getAddbackAmount(a);
    });
    return Object.entries(groups).sort((a, b) => b[1].total - a[1].total);
  }, [activeAddbacks]);

  const departmentGroups = useMemo(() => {
    const groups: Record<string, { addbacks: Addback[]; total: number }> = {};
    activeAddbacks.forEach(a => {
      const dept = a.department || 'General';
      if (!groups[dept]) groups[dept] = { addbacks: [], total: 0 };
      groups[dept].addbacks.push(a);
      groups[dept].total += getAddbackAmount(a);
    });
    return Object.entries(groups).sort((a, b) => b[1].total - a[1].total);
  }, [activeAddbacks]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (addbacks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ArrowUpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No addbacks yet</p>
        <p className="text-xs mt-1">Click the arrow icons next to line items or departments to start adding back expenses</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Total EBITDA Addbacks</span>
            <div className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-0.5">{formatCurrency(totalAmount)}</div>
          </div>
          <div className="text-right">
            <Badge variant="secondary" className="text-[10px]">{activeAddbacks.length} Active</Badge>
            {inactiveAddbacks.length > 0 && (
              <Badge variant="outline" className="text-[10px] ml-1">{inactiveAddbacks.length} Reverted</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
        <Button
          variant={viewMode === 'itemized' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-xs flex-1 gap-1"
          onClick={() => setViewMode('itemized')}
        >
          <List className="h-3 w-3" />
          Itemized
        </Button>
        <Button
          variant={viewMode === 'category' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-xs flex-1 gap-1"
          onClick={() => setViewMode('category')}
        >
          <Layers className="h-3 w-3" />
          By Category
        </Button>
        <Button
          variant={viewMode === 'department' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-xs flex-1 gap-1"
          onClick={() => setViewMode('department')}
        >
          <FolderOpen className="h-3 w-3" />
          By Department
        </Button>
      </div>

      {viewMode === 'itemized' && (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {activeAddbacks.map((addback) => (
            <AddbackLineItem
              key={addback.id}
              addback={addback}
              onToggle={onToggle}
              onDelete={onDelete}
              isPending={isPending}
              showCategory
              showDept
            />
          ))}

          {inactiveAddbacks.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-2 py-1">Reverted</div>
              {inactiveAddbacks.map((addback) => (
                <div key={addback.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group opacity-40 border border-transparent hover:border-border">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs truncate block">{addback.lineItemLabel}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => onToggle(addback.id, true)} disabled={isPending}>
                      Re-apply
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(addback.id)} disabled={isPending}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {(viewMode === 'category' || viewMode === 'department') && (
        <GroupedView
          groups={viewMode === 'category' ? categoryGroups : departmentGroups}
          expandedGroups={expandedGroups}
          toggleGroup={toggleGroup}
          onToggle={onToggle}
          onDelete={onDelete}
          isPending={isPending}
          totalAmount={totalAmount}
          inactiveAddbacks={inactiveAddbacks}
          sublabelKey={viewMode === 'category' ? 'department' : 'category'}
        />
      )}
    </div>
  );
}

function GroupedView({
  groups,
  expandedGroups,
  toggleGroup,
  onToggle,
  onDelete,
  isPending,
  totalAmount,
  inactiveAddbacks,
  sublabelKey,
}: {
  groups: [string, { addbacks: Addback[]; total: number }][];
  expandedGroups: Set<string>;
  toggleGroup: (key: string) => void;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isPending: boolean;
  totalAmount: number;
  inactiveAddbacks: Addback[];
  sublabelKey: 'category' | 'department';
}) {
  return (
    <div className="space-y-1 max-h-[500px] overflow-y-auto">
      {groups.map(([groupName, group]) => {
        const isExpanded = expandedGroups.has(groupName);
        return (
          <div key={groupName}>
            <button
              className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 text-left"
              onClick={() => toggleGroup(groupName)}
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{groupName}</span>
                  <Badge variant="outline" className="text-[9px] h-4">{group.addbacks.length}</Badge>
                </div>
              </div>
              <span className="text-xs font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 shrink-0">
                {formatCurrency(group.total)}
              </span>
            </button>
            {isExpanded && (
              <div className="ml-5 border-l pl-2 space-y-0.5 mb-1">
                {group.addbacks.map((addback) => (
                  <AddbackLineItem
                    key={addback.id}
                    addback={addback}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    isPending={isPending}
                    showCategory={sublabelKey === 'category'}
                    showDept={sublabelKey === 'department'}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {groups.length > 0 && (
        <>
          <Separator className="my-2" />
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-bold">Grand Total</span>
            <span className="text-sm font-bold font-mono tabular-nums">{formatCurrency(totalAmount)}</span>
          </div>
        </>
      )}

      {inactiveAddbacks.length > 0 && (
        <>
          <Separator className="my-2" />
          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider px-2 py-1">Reverted</div>
          {inactiveAddbacks.map((addback) => (
            <div key={addback.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group opacity-40 border border-transparent hover:border-border">
              <div className="flex-1 min-w-0">
                <span className="text-xs truncate block">{addback.lineItemLabel}</span>
                <span className="text-[10px] text-muted-foreground">{addback.category || 'Uncategorized'}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => onToggle(addback.id, true)} disabled={isPending}>
                  Re-apply
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(addback.id)} disabled={isPending}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function AddbackLineItem({
  addback,
  onToggle,
  onDelete,
  isPending,
  showCategory = false,
  showDept = false,
}: {
  addback: Addback;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isPending: boolean;
  showCategory?: boolean;
  showDept?: boolean;
}) {
  const amount = getAddbackAmount(addback);
  const reasonLabel = reasonLabels[addback.reason || ''] || addback.reason || 'Other';

  const sublabels: string[] = [];
  if (showCategory && addback.category) sublabels.push(addback.category);
  if (showDept && addback.department) sublabels.push(addback.department);
  if (addback.scope === 'month_cell' && addback.addbackMonth != null && addback.addbackYear != null) {
    sublabels.push(`${monthNames[addback.addbackMonth - 1]} ${addback.addbackYear}`);
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group border border-transparent hover:border-border">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={`text-[9px] h-4 shrink-0 ${getReasonBadgeColor(addback.reason)}`}>
            {reasonLabel}
          </Badge>
          <Badge variant="outline" className="text-[9px] h-4 shrink-0">
            {scopeLabels[addback.scope] || addback.scope}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs font-medium truncate">{addback.lineItemLabel}</span>
        </div>
        {sublabels.length > 0 && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground">{sublabels.join(' · ')}</span>
          </div>
        )}
        {addback.notes && (
          <div className="mt-0.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-muted-foreground italic truncate max-w-[120px] cursor-help">{addback.notes}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[250px] text-xs">{addback.notes}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400">
          {amount > 0 ? formatCurrency(amount) : '-'}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={() => onToggle(addback.id, false)}
            disabled={isPending}
            title="Revert to original value"
          >
            <Undo2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete(addback.id)}
            disabled={isPending}
            title="Delete addback"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
