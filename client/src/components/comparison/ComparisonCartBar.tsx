/**
 * ComparisonCartBar
 *
 * Floating bottom bar that appears whenever the comparison cart has ≥1 deal.
 * Shows per-deal chips with remove buttons, a clear-all button, and a
 * primary "Compare" action that navigates to the comparison page with the
 * cart ids as query params.
 *
 * Mounted once at the deal-workspace root so it's visible on every workspace
 * view (pipeline, list, leads, activity, tasks).
 */

import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useComparisonCart, MAX_COMPARISON_DEALS } from "@/stores/comparison-cart-store";

export function ComparisonCartBar() {
  const [, setLocation] = useLocation();
  const deals = useComparisonCart((s) => s.deals);
  const remove = useComparisonCart((s) => s.remove);
  const clear = useComparisonCart((s) => s.clear);

  const canCompare = deals.length >= 2;

  return (
    <AnimatePresence>
      {deals.length > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
          data-testid="comparison-cart-bar"
        >
          <div className="bg-white/95 backdrop-blur border border-slate-200 shadow-xl rounded-full pl-3 pr-1.5 py-1.5 flex items-center gap-2 max-w-[min(100vw-2rem,900px)]">
            <div className="flex items-center gap-1.5 flex-shrink-0 text-[hsl(177,75%,28%)]">
              <Scale className="h-4 w-4" />
              <span className="text-xs font-semibold">
                Compare {deals.length}/{MAX_COMPARISON_DEALS}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200 flex-shrink-0" />
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              <AnimatePresence initial={false}>
                {deals.map((d) => (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="inline-flex items-center gap-1 bg-slate-100 rounded-full pl-2.5 pr-1 py-0.5 flex-shrink-0"
                  >
                    <span className="text-[11px] font-medium text-slate-700 max-w-[140px] truncate">
                      {d.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(d.id)}
                      className="h-4 w-4 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                      title="Remove"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="h-6 w-px bg-slate-200 flex-shrink-0" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-slate-500 hover:text-slate-700 px-2"
              onClick={clear}
            >
              Clear
            </Button>
            <Button
              size="sm"
              disabled={!canCompare}
              className="h-7 text-[11px] rounded-full px-3 bg-[hsl(177,75%,28%)] hover:bg-[hsl(177,75%,22%)] text-white disabled:opacity-40"
              onClick={() => {
                const ids = deals.map((d) => d.id).join(",");
                setLocation(`/crm/deals/compare?ids=${ids}`);
              }}
              title={canCompare ? "Open comparison" : "Add at least 2 deals"}
            >
              Compare →
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ComparisonCartBar;
