import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const DebtScenariosIndex = lazy(() => import("@/pages/modeling/debt-scenarios/Index"));

const LoadingFallback = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-[400px] w-full" />
  </div>
);

export default function ScenariosPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Debt Scenarios</h1>
        <p className="text-muted-foreground mt-1">
          Model debt structures and financing options for your marina acquisitions
        </p>
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <DebtScenariosIndex />
      </Suspense>
    </div>
  );
}
