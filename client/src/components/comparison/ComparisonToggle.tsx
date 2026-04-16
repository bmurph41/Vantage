/**
 * ComparisonToggle
 *
 * Small per-deal toggle button used on kanban cards + deal list rows.
 * Clicking adds/removes the deal from the global comparison cart. Shows
 * a scale badge when the deal is in the cart so users can see their
 * selection at a glance without opening the bar.
 */

import { motion } from "framer-motion";
import { Scale, Check } from "lucide-react";
import { useComparisonCart, useIsInComparisonCart } from "@/stores/comparison-cart-store";
import { useToast } from "@/hooks/use-toast";

interface Props {
  dealId: string;
  dealTitle: string;
  size?: "sm" | "md";
  /** Stop click propagation so the deal card's onClick doesn't fire too. */
  stopPropagation?: boolean;
}

export function ComparisonToggle({ dealId, dealTitle, size = "sm", stopPropagation = true }: Props) {
  const isIn = useIsInComparisonCart(dealId);
  const toggle = useComparisonCart((s) => s.toggle);
  const { toast } = useToast();

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
      e.preventDefault();
    }
    const result = toggle({ id: dealId, title: dealTitle });
    if (result.atCap) {
      toast({
        title: "Comparison cart is full",
        description: "Max 5 deals. Remove one before adding another.",
        variant: "destructive",
      });
    }
  };

  const dims = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const icon = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.9 }}
      className={`${dims} rounded-md inline-flex items-center justify-center transition-colors border ${
        isIn
          ? "bg-[hsl(177,75%,95%)] border-[hsl(177,75%,60%)] text-[hsl(177,75%,28%)]"
          : "bg-white border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-700"
      }`}
      title={isIn ? "Remove from comparison" : "Add to comparison"}
      data-testid={`comparison-toggle-${dealId}`}
    >
      {isIn ? <Check className={icon} /> : <Scale className={icon} />}
    </motion.button>
  );
}

export default ComparisonToggle;
