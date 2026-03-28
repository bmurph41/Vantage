#!/bin/bash
# PATCH 03: Deal card — activity badge, key dates chip, quick-log strip
# Run from workspace root: bash patch_03_deal_card.sh

echo "▶ Patch 03: Kanban card enhancements"

cat > /tmp/patch03.mjs << 'SCRIPT'
import { readFileSync, writeFileSync } from 'fs';
const file = 'client/src/pages/pipeline.tsx';
let src = readFileSync(file, 'utf8');
let changed = 0;

// ── 1. Add 'group' to Card className for hover detection ──
const OLD_CARD_CLASS = `${isDragging ? "shadow-2xl border-blue-400" : "hover:shadow-md hover:border-blue-200"}`;
const NEW_CARD_CLASS = `group ${isDragging ? "shadow-2xl border-blue-400" : "hover:shadow-md hover:border-blue-200"}`;
if (src.includes(OLD_CARD_CLASS)) {
  src = src.replace(OLD_CARD_CLASS, NEW_CARD_CLASS);
  console.log('  ✅ Added group class to Card for hover detection');
  changed++;
}

// ── 2. Add Activity import if not present ──
const LUCIDE_IMPORT_LINE = `Clock, ArrowRight, Phone, Mail, StickyNote,`;
if (src.includes(LUCIDE_IMPORT_LINE)) {
  src = src.replace(LUCIDE_IMPORT_LINE, `Clock, ArrowRight, Phone, Mail, StickyNote, Activity, Pencil,`);
  console.log('  ✅ Added Activity, Pencil to lucide imports');
  changed++;
}

// ── 3. Add formatDistanceToNow to date-fns imports ──
const DATE_IMPORT = `import { format, differenceInDays, isAfter, addDays } from "date-fns";`;
const NEW_DATE_IMPORT = `import { format, differenceInDays, isAfter, addDays, formatDistanceToNow } from "date-fns";`;
if (src.includes(DATE_IMPORT)) {
  src = src.replace(DATE_IMPORT, NEW_DATE_IMPORT);
  console.log('  ✅ Added formatDistanceToNow to date-fns imports');
  changed++;
}

// ── 4. Inject key-dates helper before DealCard function ──
const BEFORE_DEAL_CARD = `function DealCard({ deal, onClick, rotThreshold = 30 }: DealCardProps) {`;
const KEY_DATES_HELPER = `// Helper: pick the next most urgent upcoming date for a deal
function getNextKeyDate(deal: DealWithRelations): { label: string; date: Date; warnDays: number; colorClass: string } | null {
  const candidates = [
    { label: 'DD Exp', field: 'ddExpirationDate', warnDays: 7, colorClass: 'text-red-600' },
    { label: '1st Dep', field: 'firstDepositDueDate', warnDays: 14, colorClass: 'text-orange-600' },
    { label: 'Closing', field: 'closingDate', warnDays: 30, colorClass: 'text-yellow-700' },
  ] as const;
  const upcoming = candidates
    .map(c => {
      const raw = (deal as any)[c.field];
      return raw ? { ...c, date: new Date(raw) } : null;
    })
    .filter((d): d is NonNullable<typeof d> => !!d && d.date > new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  return upcoming[0] || null;
}

`;
if (!src.includes('getNextKeyDate') && src.includes(BEFORE_DEAL_CARD)) {
  src = src.replace(BEFORE_DEAL_CARD, KEY_DATES_HELPER + BEFORE_DEAL_CARD);
  console.log('  ✅ Added getNextKeyDate helper');
  changed++;
}

// ── 5. Add absolute positioning to the Card wrapper div for quick-log overlay ──
// The outer div needs relative positioning
const OLD_DIV_WRAP = `    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={\`mb-2.5 \${isDragging ? "opacity-50 scale-105 rotate-2" : ""}\`}`;
const NEW_DIV_WRAP = `    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={\`mb-2.5 relative \${isDragging ? "opacity-50 scale-105 rotate-2" : ""}\`}`;
if (src.includes(OLD_DIV_WRAP)) {
  src = src.replace(OLD_DIV_WRAP, NEW_DIV_WRAP);
  console.log('  ✅ Added relative positioning to card wrapper');
  changed++;
}

// ── 6. Add activity badge + key dates + quick-log strip before </CardContent> ──
// Find the closing of CardContent in DealCard (before the Card close)
// Use a distinctive pattern that only appears in DealCard's CardContent close
const OLD_CARD_CONTENT_END = `          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stage Column`;

const NEW_CARD_CONTENT_END = `          </div>

          {/* ── Activity badge + key dates row ── */}
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-50">
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Activity className="h-2.5 w-2.5" />
              <span>{(deal as any).activityCount || 0} acts</span>
              {(deal as any).lastActivityDate && (
                <span className={
                  differenceInDays(new Date(), new Date((deal as any).lastActivityDate)) > 7
                    ? "text-amber-500 font-medium ml-1"
                    : "text-gray-300 ml-1"
                }>
                  · {formatDistanceToNow(new Date((deal as any).lastActivityDate), { addSuffix: true })}
                </span>
              )}
            </div>
            {(() => {
              const kd = getNextKeyDate(deal);
              if (!kd) return null;
              const daysUntil = differenceInDays(kd.date, new Date());
              return (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`text-[10px] font-medium cursor-default ${daysUntil <= kd.warnDays ? kd.colorClass : 'text-gray-400'}`}>
                        {kd.label}: {format(kd.date, 'MMM d')}
                        {daysUntil <= kd.warnDays && (
                          <span className="ml-0.5 font-bold">({daysUntil}d)</span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {kd.label} — {format(kd.date, 'MMMM d, yyyy')} · {daysUntil} days away
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })()}
          </div>

          {/* ── Quick-log strip (visible on card hover) ── */}
          <div
            className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-150 z-20"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {([
              { type: 'call', icon: Phone, label: 'Log Call', color: 'hover:bg-green-50 hover:border-green-300 hover:text-green-700' },
              { type: 'email', icon: Mail, label: 'Log Email', color: 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700' },
              { type: 'note', icon: StickyNote, label: 'Add Note', color: 'hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700' },
            ] as const).map(({ type, icon: Icon, label, color }) => (
              <TooltipProvider key={type}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className={\`w-6 h-6 rounded bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 transition-all \${color}\`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent('pipeline:quick-log', {
                          detail: { dealId: deal.id, dealTitle: deal.title, type }
                        }));
                      }}
                    >
                      <Icon className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stage Column`;

if (src.includes(OLD_CARD_CONTENT_END)) {
  src = src.replace(OLD_CARD_CONTENT_END, NEW_CARD_CONTENT_END);
  console.log('  ✅ Added activity badge, key-dates chip, and quick-log strip to DealCard');
  changed++;
} else {
  console.log('  ⚠️  Could not find CardContent end pattern — may need manual placement');
  console.log('     Look for the last </div></CardContent></Card></div> in DealCard and insert before it');
}

// ── 7. Add forecast category badge in deal card (near probability badge) ──
const OLD_PROB_BADGE = `{(deal as any).probability != null && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium">
                  {(deal as any).probability}% prob
                </Badge>
              )}`;
const NEW_PROB_BADGE = `{(deal as any).probability != null && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium">
                  {(deal as any).probability}% prob
                </Badge>
              )}
              {deal.forecastCategory && deal.forecastCategory !== 'pipeline' && (
                <Badge className={\`text-[9px] h-4 px-1 font-medium \${
                  deal.forecastCategory === 'commit' ? 'bg-green-100 text-green-700 border-green-200' :
                  deal.forecastCategory === 'best_case' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                  'bg-red-100 text-red-600 border-red-200'
                }\`}>
                  {deal.forecastCategory === 'commit' ? '✓ Commit' :
                   deal.forecastCategory === 'best_case' ? 'Best' : 'Omit'}
                </Badge>
              )}`;
if (src.includes(OLD_PROB_BADGE)) {
  src = src.replace(OLD_PROB_BADGE, NEW_PROB_BADGE);
  console.log('  ✅ Added forecast category badge to deal card');
  changed++;
}

writeFileSync(file, src);
console.log(`\nPatch 03 complete: ${changed}/7 changes applied to ${file}`);
SCRIPT

node /tmp/patch03.mjs
echo "✅ Patch 03 done"
