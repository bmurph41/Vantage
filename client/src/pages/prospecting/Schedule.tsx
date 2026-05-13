import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  format, startOfWeek, startOfDay, addDays, addWeeks, subWeeks, parseISO,
} from "date-fns";
import { PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Calendar,
  Trash2,
  ExternalLink,
  Clock,
} from "lucide-react";
import { ProspectingNav } from "./ProspectingNav";
import {
  TimeBlockGrid,
  TimeBlock,
  CrmActivityItem,
  BLOCK_TYPES,
  DEFAULT_COLORS,
  typeColor,
  blockHeight,
  HOUR_HEIGHT,
  DAY_START_HOUR,
  VISIBLE_HOURS,
} from "./TimeBlockGrid";

// ── Local helpers (drawer-only) ───────────────────────────────────────────────

type OrgUser = { id: string; name: string; email: string };

function toLocalDateStr(d: Date) { return format(d, "yyyy-MM-dd"); }
function toLocalTimeStr(d: Date) { return format(d, "HH:mm"); }

function buildIso(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

// ── Drawer (create / edit) ────────────────────────────────────────────────────

type DrawerMode = "create" | "edit";

type DrawerState = {
  open: boolean;
  mode: DrawerMode;
  block?: TimeBlock;
  defaultStart?: Date;
};

type BlockForm = {
  title: string;
  block_type: string;
  start_date: string;
  start_time: string;
  end_time: string;
  notes: string;
  push_to_calendar: boolean;
  invited_user_ids: string[];
};

function BlockDrawer({
  drawerState,
  orgUsers,
  onClose,
  onSaved,
  onDelete,
}: {
  drawerState: DrawerState;
  orgUsers: OrgUser[];
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: string) => void;
}) {
  const { toast } = useToast();
  const isEdit = drawerState.mode === "edit" && drawerState.block;

  const initialStart = drawerState.block
    ? parseISO(drawerState.block.start_at)
    : drawerState.defaultStart ?? new Date();
  const initialEnd = drawerState.block
    ? parseISO(drawerState.block.end_at)
    : new Date(initialStart.getTime() + 60 * 60 * 1000);

  const [form, setForm] = useState<BlockForm>({
    title:           drawerState.block?.title ?? "",
    block_type:      drawerState.block?.block_type ?? "prospecting_call",
    start_date:      toLocalDateStr(initialStart),
    start_time:      toLocalTimeStr(initialStart),
    end_time:        toLocalTimeStr(initialEnd),
    notes:           drawerState.block?.notes ?? "",
    push_to_calendar: false,
    invited_user_ids: drawerState.block?.invited_user_ids ?? [],
  });

  const setField = <K extends keyof BlockForm>(k: K, v: BlockForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title:          form.title,
        blockType:      form.block_type,
        startAt:        buildIso(form.start_date, form.start_time),
        endAt:          buildIso(form.start_date, form.end_time),
        notes:          form.notes || undefined,
        color:          DEFAULT_COLORS[form.block_type] ?? "#3b82f6",
        invitedUserIds: form.invited_user_ids,
        pushToCalendar: form.push_to_calendar,
      };
      if (isEdit) {
        const res = await apiRequest("PATCH", `/api/prospecting/time-blocks/${drawerState.block!.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/prospecting/time-blocks", payload);
      return res.json();
    },
    onSuccess: (data: { calendarError?: string }) => {
      toast({ title: isEdit ? "Block updated" : "Block created" });
      if (data?.calendarError) {
        toast({
          title: "Calendar sync failed",
          description: data.calendarError,
          variant: "destructive",
        });
      }
      onSaved();
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const toggleInvite = (uid: string) =>
    setField(
      "invited_user_ids",
      form.invited_user_ids.includes(uid)
        ? form.invited_user_ids.filter((x) => x !== uid)
        : [...form.invited_user_ids, uid]
    );

  return (
    <Sheet open={drawerState.open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Time Block" : "New Time Block"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Call with seller"
            />
          </div>

          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={form.block_type} onValueChange={(v) => setField("block_type", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: t.color }} />
                      {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setField("start_date", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start</Label>
              <Input type="time" value={form.start_time} onChange={(e) => setField("start_time", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End</Label>
              <Input type="time" value={form.end_time} onChange={(e) => setField("end_time", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Optional context or agenda…"
              rows={3}
            />
          </div>

          {orgUsers.length > 0 && (
            <div className="space-y-1">
              <Label>Invite Team Members</Label>
              <div className="border rounded-md p-2 max-h-36 overflow-y-auto space-y-1">
                {orgUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={form.invited_user_ids.includes(u.id)}
                      onChange={() => toggleInvite(u.id)}
                      className="rounded"
                    />
                    <span className="text-sm">
                      {u.name}
                      <span className="text-muted-foreground ml-1 text-xs">{u.email}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {(!isEdit || (isEdit && !drawerState.block?.synced_to_calendar)) && (
            <div className="flex items-center gap-3">
              <Switch
                checked={form.push_to_calendar}
                onCheckedChange={(v) => setField("push_to_calendar", v)}
              />
              <Label className="cursor-pointer">Push to Google Calendar on save</Label>
            </div>
          )}

          {isEdit && drawerState.block?.synced_to_calendar && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Calendar className="w-4 h-4" />
              Synced to Google Calendar
              {drawerState.block.google_calendar_event_id && (
                <a
                  href={`https://calendar.google.com/calendar/r/eventedit/${drawerState.block.google_calendar_event_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.title}
            >
              {saveMutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Block"}
            </Button>
            {isEdit && onDelete && drawerState.block && (
              <Button
                variant="outline"
                size="icon"
                className="text-red-500 hover:text-red-700"
                onClick={() => onDelete(drawerState.block!.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Schedule Page ────────────────────────────────────────────────────────

export default function Schedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, mode: "create" });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [resizeHeights, setResizeHeights] = useState<Record<string, number>>({});
  const resizeRef = useRef<{ blockId: string; startY: number; origEndAtMs: number; origHeight: number } | null>(null);

  const weekEnd = addDays(weekStart, 7);

  const rangeStart = viewMode === "week" ? weekStart : startOfDay(selectedDay);
  const rangeEnd   = viewMode === "week" ? weekEnd   : addDays(startOfDay(selectedDay), 1);

  const { data: blocks = [], isLoading } = useQuery<TimeBlock[]>({
    queryKey: ["/api/prospecting/time-blocks", rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/prospecting/time-blocks?start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load blocks");
      return res.json();
    },
  });

  const { data: crmActivitiesPage } = useQuery<{ data: CrmActivityItem[] }>({
    queryKey: ["/api/crm/activities", rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/crm/activities?start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}&pageSize=100`,
        { credentials: "include" }
      );
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });
  const crmActivities: CrmActivityItem[] = (crmActivitiesPage?.data ?? []).filter(
    (a) => !!a.scheduledAt
  );

  const handleCrmActivityClick = useCallback((activity: CrmActivityItem) => {
    if (!activity.entityId) return;
    switch (activity.entityType) {
      case "contact": navigate(`/crm/contacts/${activity.entityId}`); break;
      case "deal":    navigate(`/crm/deals/${activity.entityId}`); break;
      case "company": navigate(`/crm/companies/${activity.entityId}`); break;
      case "property": navigate(`/crm/properties/${activity.entityId}`); break;
      case "lead":    navigate(`/crm/leads`); break;
      default:        navigate(`/crm/activities`); break;
    }
  }, [navigate]);

  const { data: orgUsers = [] } = useQuery<OrgUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, startAt, endAt }: { id: string; startAt: string; endAt: string }) => {
      return apiRequest("PATCH", `/api/prospecting/time-blocks/${id}`, { startAt, endAt });
    },
    onMutate: async ({ id, startAt, endAt }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/prospecting/time-blocks"] });
      const qk = ["/api/prospecting/time-blocks", rangeStart.toISOString(), rangeEnd.toISOString()];
      const previous = queryClient.getQueryData<TimeBlock[]>(qk);
      queryClient.setQueryData<TimeBlock[]>(qk, (old) =>
        old?.map((b) => b.id === id ? { ...b, start_at: startAt, end_at: endAt } : b)
      );
      return { previous, qk };
    },
    onError: (_, __, context) => {
      if (context?.previous) queryClient.setQueryData(context.qk, context.previous);
      toast({ title: "Reschedule failed", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/time-blocks"] });
    },
  });

  const calPushMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/prospecting/time-blocks/${id}/push-calendar`, {});
    },
    onSuccess: () => {
      toast({ title: "Synced to Google Calendar" });
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/time-blocks"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Calendar push failed";
      toast({ title: "Calendar Error", description: msg, variant: "destructive" });
    },
  });

  const bulkCalPushMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiRequest("POST", "/api/prospecting/time-blocks/bulk-push-calendar", { ids });
      return res.json() as Promise<{ pushed?: number; failed?: number }>;
    },
    onSuccess: (data) => {
      toast({
        title: `Pushed ${data?.pushed ?? 0} block(s) to Google Calendar`,
        description: data?.failed ? `${data.failed} failed` : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/time-blocks"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Bulk push failed";
      toast({ title: "Calendar Error", description: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/prospecting/time-blocks/${id}`, undefined),
    onSuccess: () => {
      toast({ title: "Block deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/time-blocks"] });
      setDrawer({ open: false, mode: "create" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const resizeMutation = useMutation({
    mutationFn: async ({ id, endAt }: { id: string; endAt: string }) => {
      return apiRequest("PATCH", `/api/prospecting/time-blocks/${id}`, { endAt });
    },
    onMutate: async ({ id, endAt }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/prospecting/time-blocks"] });
      const qk = ["/api/prospecting/time-blocks", rangeStart.toISOString(), rangeEnd.toISOString()];
      const previous = queryClient.getQueryData<TimeBlock[]>(qk);
      queryClient.setQueryData<TimeBlock[]>(qk, (old) =>
        old?.map((b) => b.id === id ? { ...b, end_at: endAt } : b)
      );
      return { previous, qk };
    },
    onError: (_, __, context) => {
      if (context?.previous) queryClient.setQueryData(context.qk, context.previous);
      toast({ title: "Resize failed", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prospecting/time-blocks"] });
    },
  });

  const handleResizeStart = useCallback((blockId: string, startY: number, origEndAtMs: number) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;
    resizeRef.current = {
      blockId,
      startY,
      origEndAtMs,
      origHeight: blockHeight(block.start_at, block.end_at),
    };
  }, [blocks]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { blockId, startY, origHeight } = resizeRef.current;
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(22, origHeight + deltaY);
      setResizeHeights((prev) => ({ ...prev, [blockId]: newHeight }));
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { blockId, startY, origEndAtMs } = resizeRef.current;
      resizeRef.current = null;

      const deltaY = e.clientY - startY;
      const deltaMs = Math.round((deltaY / HOUR_HEIGHT) * 60) * 60_000;
      const newEndAtMs = origEndAtMs + deltaMs;
      const block = blocks.find((b) => b.id === blockId);
      if (!block) { setResizeHeights((prev) => { const n = { ...prev }; delete n[blockId]; return n; }); return; }
      const startMs = new Date(block.start_at).getTime();
      if (newEndAtMs <= startMs + 60_000 * 15) {
        setResizeHeights((prev) => { const n = { ...prev }; delete n[blockId]; return n; });
        return;
      }
      setResizeHeights((prev) => { const n = { ...prev }; delete n[blockId]; return n; });
      resizeMutation.mutate({ id: blockId, endAt: new Date(newEndAtMs).toISOString() });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [blocks, resizeMutation]);

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/prospecting/time-blocks"] });
  }, [queryClient]);

  const openCreate = (day: Date, hour: number) => {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    setDrawer({ open: true, mode: "create", defaultStart: start });
  };

  const openEdit = (block: TimeBlock) => setDrawer({ open: true, mode: "edit", block });

  // ── DnD sensors & handlers ────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || !active.data.current?.block) return;

      const block: TimeBlock = active.data.current.block;
      const dropId = String(over.id); // format: "YYYY-MM-DD-H"
      const parts = dropId.split("-");
      if (parts.length < 4) return;

      const hour = parseInt(parts[parts.length - 1], 10);
      const dayStr = parts.slice(0, 3).join("-");
      if (isNaN(hour)) return;

      const origStart = parseISO(block.start_at);
      const origEnd = parseISO(block.end_at);
      const durationMs = origEnd.getTime() - origStart.getTime();

      const newStart = new Date(`${dayStr}T${String(hour).padStart(2, "0")}:00:00`);
      const newEnd = new Date(newStart.getTime() + durationMs);

      if (
        newStart.toISOString() === block.start_at &&
        newEnd.toISOString() === block.end_at
      ) return;

      rescheduleMutation.mutate({
        id: block.id,
        startAt: newStart.toISOString(),
        endAt: newEnd.toISOString(),
      });
    },
    [rescheduleMutation]
  );

  // ── Layout helpers ────────────────────────────────────────────────────────

  const days =
    viewMode === "week"
      ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      : [selectedDay];

  const hours = Array.from({ length: VISIBLE_HOURS }, (_, i) => DAY_START_HOUR + i);

  const prevPeriod = () => {
    if (viewMode === "week") setWeekStart((d) => subWeeks(d, 1));
    else setSelectedDay((d) => addDays(d, -1));
  };
  const nextPeriod = () => {
    if (viewMode === "week") setWeekStart((d) => addWeeks(d, 1));
    else setSelectedDay((d) => addDays(d, 1));
  };
  const goToday = () => {
    const today = new Date();
    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
    setSelectedDay(today);
  };

  const periodLabel =
    viewMode === "week"
      ? `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`
      : format(selectedDay, "EEEE, MMMM d, yyyy");

  const unsyncedIds = blocks.filter((b) => !b.synced_to_calendar).map((b) => b.id);

  return (
    <div className="flex flex-col h-full min-h-0">
      <ProspectingNav />

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevPeriod}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <Button variant="outline" size="icon" onClick={nextPeriod}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium ml-1">{periodLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {unsyncedIds.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkCalPushMutation.mutate(unsyncedIds)}
              disabled={bulkCalPushMutation.isPending}
            >
              <CalendarDays className="w-4 h-4 mr-1" />
              {bulkCalPushMutation.isPending
                ? "Pushing…"
                : `Push All to Calendar (${unsyncedIds.length})`}
            </Button>
          )}
          <div className="flex rounded-md border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "week" ? "bg-blue-600 text-white" : "hover:bg-muted"}`}
              onClick={() => setViewMode("week")}
            >
              Week
            </button>
            <button
              className={`px-3 py-1.5 text-sm ${viewMode === "day" ? "bg-blue-600 text-white" : "hover:bg-muted"}`}
              onClick={() => setViewMode("day")}
            >
              Day
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => setDrawer({ open: true, mode: "create", defaultStart: new Date() })}
          >
            <Plus className="w-4 h-4 mr-1" />
            New Block
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {BLOCK_TYPES.map((t) => (
          <span key={t.value} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground border-l pl-3">
          <span className="w-2.5 h-2.5 rounded border-2 border-dashed border-sky-500" />
          CRM Activity
        </span>
      </div>

      {/* Mobile list fallback (screens < md) */}
      <div className="md:hidden flex-1 overflow-auto space-y-2">
        {isLoading
          ? [0, 1, 2].map((i) => <div key={i} className="h-14 rounded border"><div className="h-full w-full animate-pulse bg-muted" /></div>)
          : blocks.length === 0
            ? <p className="text-sm text-muted-foreground text-center pt-8">No time blocks for this period.</p>
            : [...blocks]
                .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
                .map((b) => {
                  const color = typeColor(b.block_type, b.color);
                  return (
                    <div
                      key={b.id}
                      className="flex items-center gap-3 p-3 rounded border border-l-4 cursor-pointer hover:bg-muted/30"
                      style={{ borderLeftColor: color }}
                      onClick={() => openEdit(b)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(b.start_at), "EEE MMM d · h:mm a")} – {format(parseISO(b.end_at), "h:mm a")}
                        </p>
                      </div>
                      {b.synced_to_calendar && <Calendar className="w-4 h-4 shrink-0" style={{ color }} />}
                    </div>
                  );
                })
        }
      </div>

      {/* Desktop calendar grid */}
      <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0">
        <TimeBlockGrid
          blocks={blocks}
          crmActivities={crmActivities}
          days={days}
          hours={hours}
          viewMode={viewMode}
          isLoading={isLoading}
          activeDragId={activeDragId}
          resizeHeights={resizeHeights}
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          openCreate={openCreate}
          openEdit={openEdit}
          onCalendarPush={(id) => calPushMutation.mutate(id)}
          onResizeStart={handleResizeStart}
          onCrmActivityClick={handleCrmActivityClick}
          setSelectedDay={setSelectedDay}
          setViewMode={setViewMode}
        />
      </div>

      {/* Summary bar */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {blocks.length} block{blocks.length !== 1 ? "s" : ""}
        </span>
        <span>{blocks.filter((b) => b.synced_to_calendar).length} synced to Google Calendar</span>
        {crmActivities.length > 0 && (
          <span>{crmActivities.length} CRM activit{crmActivities.length !== 1 ? "ies" : "y"}</span>
        )}
      </div>

      {/* Drawer */}
      {drawer.open && (
        <BlockDrawer
          key={drawer.block?.id ?? "new"}
          drawerState={drawer}
          orgUsers={orgUsers}
          onClose={() => setDrawer((d) => ({ ...d, open: false }))}
          onSaved={handleSaved}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      )}
    </div>
  );
}
