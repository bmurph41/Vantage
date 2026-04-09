/**
 * RecurringActivityControls
 *
 * Inline control for setting recurrence on a CRM activity.
 * Supports daily, weekly, biweekly, monthly, quarterly with optional end date.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Plus, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────

interface RecurringActivityControlsProps {
  activityId: string;
  isRecurring: boolean;
  recurrenceRule: string;
}

const RECURRENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
] as const;

// ─── Component ────────────────────────────────────────────────────

export function RecurringActivityControls({
  activityId,
  isRecurring: initialRecurring,
  recurrenceRule: initialRule,
}: RecurringActivityControlsProps) {
  const [enabled, setEnabled] = useState(initialRecurring);
  const [rule, setRule] = useState(initialRule || "weekly");
  const [endDate, setEndDate] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateActivity = () => {
    queryClient.invalidateQueries({ queryKey: ["crm", "activities"] });
    queryClient.invalidateQueries({ queryKey: ["crm", "timeline"] });
  };

  const setRecurrenceMutation = useMutation({
    mutationFn: async (params: { recurrenceRule: string; recurrenceEndDate?: string }) => {
      await apiRequest("POST", `/api/crm/activities/${activityId}/set-recurrence`, params);
    },
    onSuccess: () => {
      invalidateActivity();
      toast({ title: "Recurrence updated" });
    },
    onError: () => toast({ title: "Failed to set recurrence", variant: "destructive" }),
  });

  const createNextMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/crm/activities/${activityId}/create-next-occurrence`);
    },
    onSuccess: () => {
      invalidateActivity();
      toast({ title: "Next occurrence created" });
    },
    onError: () => toast({ title: "Failed to create next occurrence", variant: "destructive" }),
  });

  function handleToggle(on: boolean) {
    setEnabled(on);
    if (on) {
      setRecurrenceMutation.mutate({
        recurrenceRule: rule,
        recurrenceEndDate: endDate || undefined,
      });
    } else {
      setRecurrenceMutation.mutate({ recurrenceRule: "" });
    }
  }

  function handleRuleChange(newRule: string) {
    setRule(newRule);
    if (enabled) {
      setRecurrenceMutation.mutate({
        recurrenceRule: newRule,
        recurrenceEndDate: endDate || undefined,
      });
    }
  }

  function handleEndDateChange(date: string) {
    setEndDate(date);
    if (enabled) {
      setRecurrenceMutation.mutate({
        recurrenceRule: rule,
        recurrenceEndDate: date || undefined,
      });
    }
  }

  const isBusy = setRecurrenceMutation.isPending || createNextMutation.isPending;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className={cn("h-4 w-4", enabled ? "text-primary" : "text-muted-foreground")} />
          <Label className="text-sm font-medium">Recurring</Label>
          {enabled && (
            <Badge variant="secondary" className="text-xs capitalize">{rule}</Badge>
          )}
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} disabled={isBusy} />
      </div>

      {enabled && (
        <div className="space-y-3 pl-6">
          <div className="flex items-center gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground">Frequency</Label>
              <Select value={rule} onValueChange={handleRuleChange} disabled={isBusy}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground">End Date (optional)</Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                disabled={isBusy}
              />
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={isBusy}
            onClick={() => createNextMutation.mutate()}
          >
            {createNextMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1" />
            )}
            Generate Next Occurrence
          </Button>
        </div>
      )}
    </div>
  );
}
