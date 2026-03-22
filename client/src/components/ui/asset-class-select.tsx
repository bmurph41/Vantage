/**
 * AssetClassSelect — Drop-in replacement for hardcoded asset class dropdowns.
 *
 * Renders grouped options (Portfolio / Pipeline / Models / Other) using
 * the useAssetClassOptions hook so only relevant asset classes appear.
 */

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssetClassOptions } from "@/hooks/use-asset-classes";
import { Skeleton } from "@/components/ui/skeleton";

interface AssetClassSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Show the full platform list as an "Other" group (default: true) */
  includeAll?: boolean;
  /** Allow an "All" / unset option (for filters) */
  allowAll?: boolean;
  allLabel?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** data-testid for the trigger */
  testId?: string;
}

export function AssetClassSelect({
  value,
  onValueChange,
  includeAll = true,
  allowAll = false,
  allLabel = "All Asset Classes",
  placeholder = "Select asset class",
  className,
  disabled,
  testId,
}: AssetClassSelectProps) {
  const { grouped, flat, isLoading } = useAssetClassOptions({ includeAll });

  if (isLoading) {
    return <Skeleton className={`h-10 w-full ${className ?? ""}`} />;
  }

  // Use grouped rendering when there are multiple groups
  const useGrouped = grouped.length > 1;

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && (
          <SelectItem value="all">{allLabel}</SelectItem>
        )}

        {useGrouped
          ? grouped.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                  {group.label}
                </SelectLabel>
                {group.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))
          : flat.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
      </SelectContent>
    </Select>
  );
}
