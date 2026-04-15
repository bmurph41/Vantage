/**
 * DealComparisonModels
 * Standalone route: /crm/deals/compare-models?ids=id1,id2,...
 * Launched from pipeline/kanban "Compare" actions.
 */

import { useEffect, useState } from 'react';
import { useSearch, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Scale } from 'lucide-react';
import WorkspaceDealComparison from './modeling/projects/workspace/deal-comparison';

export default function DealComparisonModels() {
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const [initialIds, setInitialIds] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const ids = params.get('ids');
    if (ids) setInitialIds(ids.split(',').filter(Boolean));
  }, [searchString]);

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/crm/deals')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Deals
        </Button>
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Deal Model Comparison</h1>
            <p className="text-sm text-muted-foreground">
              Compare financial model outputs side-by-side across multiple deals
            </p>
          </div>
        </div>
      </div>

      <WorkspaceDealComparison initialDealIds={initialIds} />
    </div>
  );
}
