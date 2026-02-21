/**
 * DepositScheduleBlock
 * Deposit automation engine with anchor events, auto-calculation, and N deposits.
 */

import { useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DateInput } from "@/components/ui/date-input";
import { Plus, Trash2, DollarSign, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInCalendarDays, addDays } from "date-fns";

export interface DepositEntry {
  id: string;
  amount: string;
  anchorEvent: "psa_signed" | "dd_expiration" | "closing" | "custom";
  daysOffset: string;
  dayType: "calendar" | "business";
  customAnchorDate: string;
  refundable: boolean;
  appliedToPrice: boolean;
}

interface DepositScheduleBlockProps {
  deposits: DepositEntry[];
  onChange: (deposits: DepositEntry[]) => void;
  dealDates: {
    psaSignedDate?: string;
    ddExpirationDate?: string;
    closingDate?: string;
  };
  useBusinessDays?: boolean;
  holidayCalendar?: "us_federal" | "none";
  className?: string;
}

const ANCHOR_EVENTS = [
  { value: "psa_signed", label: "PSA Signed", dateKey: "psaSignedDate" },
  { value: "dd_expiration", label: "DD Expiration", dateKey: "ddExpirationDate" },
  { value: "closing", label: "Closing", dateKey: "closingDate" },
  { value: "custom", label: "Custom", dateKey: null },
] as const;

function isWeekendDay(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addBizDays(startDate: Date, days: number): Date {
  let current = new Date(startDate);
  let remaining = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;
  while (remaining > 0) {
    current.setDate(current.getDate() + direction);
    if (!isWeekendDay(current)) remaining--;
  }
  return current;
}

function calculateDueDate(
  deposit: DepositEntry,
  dealDates: DepositScheduleBlockProps["dealDates"]
): { dueDate: string | null; anchorDate: string | null; anchorLabel: string } {
  const anchorConfig = ANCHOR_EVENTS.find((a) => a.value === deposit.anchorEvent);
  if (!anchorConfig) return { dueDate: null, anchorDate: null, anchorLabel: "Unknown" };

  let anchorDate: string | null = null;
  if (deposit.anchorEvent === "custom") {
    anchorDate = deposit.customAnchorDate || null;
  } else {
    anchorDate = (dealDates as any)[anchorConfig.dateKey!] || null;
  }
  if (!anchorDate) return { dueDate: null, anchorDate: null, anchorLabel: anchorConfig.label };

  try {
    const anchor = parseISO(anchorDate);
    const offset = parseInt(deposit.daysOffset) || 0;
    const dueDate = deposit.dayType === "business"
      ? addBizDays(anchor, offset)
      : addDays(anchor, offset);
    return { dueDate: format(dueDate, "yyyy-MM-dd"), anchorDate, anchorLabel: anchorConfig.label };
  } catch {
    return { dueDate: null, anchorDate, anchorLabel: anchorConfig.label };
  }
}

function DepositRow({
  deposit, index, onUpdate, onRemove, dealDates,
}: {
  deposit: DepositEntry;
  index: number;
  onUpdate: (field: keyof DepositEntry, value: any) => void;
  onRemove: () => void;
  dealDates: DepositScheduleBlockProps["dealDates"];
}) {
  const { dueDate, anchorLabel } = calculateDueDate(deposit, dealDates);
  const today = new Date();
  const isOverdue = dueDate ? parseISO(dueDate) < today : false;
  const daysUntil = dueDate ? differenceInCalendarDays(parseISO(dueDate), today) : null;

  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-3 transition-all",
      isOverdue ? "border-red-300 bg-red-50/50" : "border-gray-200 bg-white"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          <span className="text-xs font-semibold">Deposit #{index + 1}</span>
          {deposit.refundable && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 text-green-600 border-green-300">Refundable</Badge>
          )}
          {isOverdue && (
            <Badge variant="destructive" className="text-[9px] h-4 px-1">
              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />Overdue
            </Badge>
          )}
        </div>
        <Button type="button" variant="ghost" size="icon"
          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100"
          onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</Label>
          <CurrencyInput
            value={deposit.amount ? parseFloat(deposit.amount) : undefined}
            onValueChange={(val) => onUpdate("amount", val?.toString() || "")}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Anchor Event</Label>
          <Select value={deposit.anchorEvent} onValueChange={(val) => onUpdate("anchorEvent", val)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANCHOR_EVENTS.map((evt) => (
                <SelectItem key={evt.value} value={evt.value} className="text-xs">{evt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Days Offset</Label>
          <Input type="number" value={deposit.daysOffset}
            onChange={(e) => onUpdate("daysOffset", e.target.value)}
            placeholder="e.g., 3" className="h-8 text-xs" />
        </div>
      </div>

      {deposit.anchorEvent === "custom" && (
        <div className="w-1/3">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Custom Date</Label>
          <DateInput value={deposit.customAnchorDate}
            onChange={(val) => onUpdate("customAnchorDate", val)} placeholder="MM/DD/YYYY" />
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Day Type</Label>
          <Select value={deposit.dayType} onValueChange={(val) => onUpdate("dayType", val)}>
            <SelectTrigger className="h-7 text-[10px] w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="calendar" className="text-xs">Calendar</SelectItem>
              <SelectItem value="business" className="text-xs">Business</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch checked={deposit.refundable} onCheckedChange={(val) => onUpdate("refundable", val)} className="h-4 w-7" />
          <Label className="text-[10px]">Refundable</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch checked={deposit.appliedToPrice} onCheckedChange={(val) => onUpdate("appliedToPrice", val)} className="h-4 w-7" />
          <Label className="text-[10px]">Applied to Price</Label>
        </div>
      </div>

      {dueDate && (
        <div className={cn(
          "flex items-center justify-between rounded-md px-3 py-1.5 text-xs",
          isOverdue ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700"
        )}>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-medium">Due: {format(parseISO(dueDate), "MMM d, yyyy")}</span>
            <span className="text-muted-foreground">
              ({deposit.daysOffset} {deposit.dayType} days from {anchorLabel})
            </span>
          </div>
          {daysUntil !== null && (
            <span className={cn("font-semibold", isOverdue ? "text-red-600" : "text-blue-600")}>
              {isOverdue ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d away`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DepositScheduleTable({
  deposits, dealDates,
}: {
  deposits: DepositEntry[];
  dealDates: DepositScheduleBlockProps["dealDates"];
}) {
  if (deposits.length === 0) return null;
  const totalAmount = deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

  return (
    <div className="mt-3 rounded-lg border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="text-left px-3 py-2 font-semibold">#</th>
            <th className="text-right px-3 py-2 font-semibold">Amount</th>
            <th className="text-left px-3 py-2 font-semibold">Anchor</th>
            <th className="text-center px-3 py-2 font-semibold">Days</th>
            <th className="text-left px-3 py-2 font-semibold">Due Date</th>
            <th className="text-center px-3 py-2 font-semibold">Refund.</th>
          </tr>
        </thead>
        <tbody>
          {deposits.map((dep, i) => {
            const { dueDate, anchorLabel } = calculateDueDate(dep, dealDates);
            return (
              <tr key={dep.id} className="border-b last:border-0 hover:bg-gray-50/50">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="text-right px-3 py-2 font-medium">${(parseFloat(dep.amount) || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-muted-foreground">{anchorLabel}</td>
                <td className="text-center px-3 py-2">{dep.daysOffset} {dep.dayType === "business" ? "BD" : "CD"}</td>
                <td className="px-3 py-2">{dueDate ? format(parseISO(dueDate), "MMM d, yyyy") : "—"}</td>
                <td className="text-center px-3 py-2">
                  {dep.refundable ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 inline" /> : <span className="text-red-500">✕</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="text-right px-3 py-2">${totalAmount.toLocaleString()}</td>
            <td colSpan={4}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function DepositScheduleBlock({
  deposits, onChange, dealDates, useBusinessDays = false, className,
}: DepositScheduleBlockProps) {
  const addDeposit = useCallback(() => {
    const newDeposit: DepositEntry = {
      id: `dep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: "", anchorEvent: "psa_signed", daysOffset: "3",
      dayType: useBusinessDays ? "business" : "calendar",
      customAnchorDate: "", refundable: true, appliedToPrice: true,
    };
    onChange([...deposits, newDeposit]);
  }, [deposits, onChange, useBusinessDays]);

  const updateDeposit = useCallback(
    (index: number, field: keyof DepositEntry, value: any) => {
      const updated = [...deposits];
      updated[index] = { ...updated[index], [field]: value };
      onChange(updated);
    },
    [deposits, onChange]
  );

  const removeDeposit = useCallback(
    (index: number) => { onChange(deposits.filter((_, i) => i !== index)); },
    [deposits, onChange]
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Deposit Schedule</Label>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addDeposit}>
          <Plus className="w-3 h-3" /> Add Deposit
        </Button>
      </div>

      {deposits.length > 0 ? (
        <>
          <div className="space-y-2">
            {deposits.map((deposit, index) => (
              <DepositRow key={deposit.id} deposit={deposit} index={index}
                onUpdate={(field, value) => updateDeposit(index, field, value)}
                onRemove={() => removeDeposit(index)} dealDates={dealDates} />
            ))}
          </div>
          <DepositScheduleTable deposits={deposits} dealDates={dealDates} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          No deposits configured. Click "Add Deposit" to get started.
        </p>
      )}
    </div>
  );
}

export default DepositScheduleBlock;
