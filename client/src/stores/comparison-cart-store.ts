/**
 * Comparison Cart Store
 *
 * Global multi-select cart for Deal Comparison. Persists across navigation
 * via localStorage. Deals are stored as minimal { id, title } pairs so the
 * floating ComparisonCartBar can render a chip per deal without hitting the
 * API. Hard cap of 5 matches the backend `/compare` endpoint limit.
 *
 * Used by:
 *   - ComparisonToggle (per-card toggle)
 *   - ComparisonCartBar (floating bottom bar)
 *   - DealComparisonPage (reads cart as default set when ?ids= not provided)
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CartDealRef {
  id: string;
  title: string;
}

export const MAX_COMPARISON_DEALS = 5;

interface ComparisonCartState {
  deals: CartDealRef[];
  toggle: (deal: CartDealRef) => { added: boolean; atCap: boolean };
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
}

export const useComparisonCart = create<ComparisonCartState>()(
  persist(
    (set, get) => ({
      deals: [],
      toggle: (deal) => {
        const current = get().deals;
        const existing = current.find((d) => d.id === deal.id);
        if (existing) {
          set({ deals: current.filter((d) => d.id !== deal.id) });
          return { added: false, atCap: false };
        }
        if (current.length >= MAX_COMPARISON_DEALS) {
          return { added: false, atCap: true };
        }
        set({ deals: [...current, deal] });
        return { added: true, atCap: false };
      },
      remove: (id) => {
        set({ deals: get().deals.filter((d) => d.id !== id) });
      },
      clear: () => set({ deals: [] }),
      has: (id) => get().deals.some((d) => d.id === id),
    }),
    {
      name: "mm:comparison-cart",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

/** Selector hook that only re-renders when the has(id) value changes. */
export function useIsInComparisonCart(id: string): boolean {
  return useComparisonCart((s) => s.deals.some((d) => d.id === id));
}
