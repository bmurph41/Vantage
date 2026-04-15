import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface UpgradePromptProps {
  reason: string;
  tier?: string;
  upgradeUrl?: string;
  currentLimit?: number;
  nextLimit?: number | string;
  className?: string;
}

export function UpgradePrompt({
  reason,
  tier,
  upgradeUrl,
  currentLimit,
  nextLimit,
  className,
}: UpgradePromptProps) {
  const href = upgradeUrl || "/settings/billing";
  return (
    <Card className={className}>
      <CardContent className="p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">{reason}</div>
          {tier && (
            <div className="text-xs text-slate-500 mt-1">
              Current tier: <span className="font-medium">{tier}</span>
              {currentLimit !== undefined && (
                <>
                  {" "}
                  Limit: {currentLimit === -1 ? "Unlimited" : currentLimit}
                </>
              )}
              {nextLimit !== undefined && <> {"  "}Upgrade gives: {nextLimit}</>}
            </div>
          )}
        </div>
        <Button asChild>
          <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
            Upgrade to Marketplace+
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export default UpgradePrompt;
