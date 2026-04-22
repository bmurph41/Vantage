import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  usePromoteDates,
  type ContractExtractedDate,
} from '@/hooks/use-contract-parser';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: string;
  approvedDates: ContractExtractedDate[];
}

export function PromoteDatesDialog({
  open,
  onOpenChange,
  documentId,
  approvedDates,
}: Props) {
  const [overwrite, setOverwrite] = useState(false);
  const promote = usePromoteDates(documentId);
  const { toast } = useToast();

  const promotable = approvedDates.filter((d) => d.extractedDate != null);
  const offsetOnly = approvedDates.filter((d) => d.extractedDate == null);

  const handleConfirm = async () => {
    try {
      const result = await promote.mutateAsync({
        dateIds: promotable.map((d) => d.id),
        overwriteExisting: overwrite,
      });
      toast({
        title: 'Dates promoted',
        description: `Created ${result.milestonesCreated} milestone${result.milestonesCreated === 1 ? '' : 's'}${
          result.skipped.length > 0 ? ` (${result.skipped.length} skipped)` : ''
        }.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Promotion failed',
        description: err?.message ?? 'Unknown error',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Promote dates to DD timeline</DialogTitle>
          <DialogDescription>
            Review the milestones that will be created on this deal's workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {promotable.length === 0 && (
            <Alert>
              <AlertDescription>
                None of the approved dates have an absolute date — contracts that
                express dates only as offsets (e.g. "30 days after effective
                date") require the anchor to be known before promotion.
              </AlertDescription>
            </Alert>
          )}

          {promotable.length > 0 && (
            <div className="rounded border bg-gray-50">
              <div className="border-b px-3 py-2 text-sm font-medium">
                Will create {promotable.length} milestone
                {promotable.length === 1 ? '' : 's'}
              </div>
              <ul className="divide-y">
                {promotable.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span>{d.fieldLabel}</span>
                    <span className="font-mono text-gray-700">
                      {d.extractedDate}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {offsetOnly.length > 0 && (
            <Alert>
              <AlertDescription className="text-xs">
                Skipping {offsetOnly.length} approved date(s) with no absolute
                value — they'll stay pending until the anchor date is set.
              </AlertDescription>
            </Alert>
          )}

          <label className="flex items-start gap-2 rounded border p-3 text-sm">
            <Checkbox
              checked={overwrite}
              onCheckedChange={(v) => setOverwrite(!!v)}
            />
            <div>
              <div className="font-medium">Overwrite existing milestones</div>
              <div className="text-xs text-gray-500">
                Off by default — milestones of the same type that already exist
                on this workspace will be left untouched.
              </div>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={promote.isPending || promotable.length === 0}
          >
            {promote.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Promoting…
              </>
            ) : (
              'Create milestones'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
