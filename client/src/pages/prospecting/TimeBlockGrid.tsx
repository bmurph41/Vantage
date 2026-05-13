import { format, isSameDay, differenceInMinutes, parseISO } from "date-fns";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  SensorDescriptor,
  SensorOptions,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Calendar, Phone, Users, Mail, MapPin } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

export const HOUR_HEIGHT = 56;
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 22;
export const VISIBLE_HOURS = DAY_END_HOUR - DAY_START_HOUR;

// ── Types ─────────────────────────────────────────────────────────────────────

export type TimeBlock = {
  id: string;
  title: string;
  block_type: string;
  start_at: string;
  end_at: string;
  notes?: string;
  color: string;
  synced_to_calendar: boolean;
  google_calendar_event_id?: string;
  invited_user_ids: string[];
  creator_name?: string;
  parent_block_id?: string | null;
  recurrence_rule?: RecurrenceRule | null;
};

export type RecurrenceRule = {
  freq: "daily" | "weekly" | "custom";
  days?: number[];
  endType: "date" | "count";
  endDate?: string;
  count?: number;
};

export type CrmActivityItem = {
  id: string;
  type: string;
  subject: string;
  scheduledAt: string;
  duration?: number | null;
  entityType?: string | null;
  entityId?: string | null;
  status?: string | null;
};

export const BLOCK_TYPES = [
  { value: "prospecting_call", label: "Prospecting Call", color: "#3b82f6" },
  { value: "site_tour",        label: "Site Tour",        color: "#10b981" },
  { value: "loi_review",       label: "LOI Review",       color: "#f59e0b" },
  { value: "team_meeting",     label: "Team Meeting",     color: "#8b5cf6" },
  { value: "admin",            label: "Admin",            color: "#6b7280" },
  { value: "other",            label: "Other",            color: "#ec4899" },
] as const;

export const DEFAULT_COLORS: Record<string, string> = Object.fromEntries(
  BLOCK_TYPES.map(({ value, color }) => [value, color])
);

// ── Helpers ───────────────────────────────────────────────────────────────────

export function blockTop(startAt: string): number {
  const start = parseISO(startAt);
  const minsFromGridStart = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes();
  return Math.max(0, (minsFromGridStart / 60) * HOUR_HEIGHT);
}

export function blockHeight(startAt: string, endAt: string): number {
  const mins = differenceInMinutes(parseISO(endAt), parseISO(startAt));
  return Math.max(22, (mins / 60) * HOUR_HEIGHT);
}

export function typeLabel(blockType: string) {
  return BLOCK_TYPES.find((t) => t.value === blockType)?.label ?? blockType;
}

export function typeColor(blockType: string, overrideColor?: string) {
  return overrideColor || DEFAULT_COLORS[blockType] || "#3b82f6";
}

// ── CRM Activity helpers ───────────────────────────────────────────────────────

const CRM_ACTIVITY_COLORS: Record<string, string> = {
  call:    "#0ea5e9",
  meeting: "#7c3aed",
  email:   "#f97316",
  tour:    "#10b981",
  site_tour: "#10b981",
  task:    "#64748b",
};

export function crmActivityColor(type: string) {
  return CRM_ACTIVITY_COLORS[type] ?? "#64748b";
}

function crmActivityIcon(type: string) {
  switch (type) {
    case "call": return <Phone className="w-3 h-3" />;
    case "meeting": return <Users className="w-3 h-3" />;
    case "email": return <Mail className="w-3 h-3" />;
    case "tour":
    case "site_tour": return <MapPin className="w-3 h-3" />;
    default: return null;
  }
}

function crmActivityEndAt(activity: CrmActivityItem): string {
  const start = parseISO(activity.scheduledAt);
  const durationMs = (activity.duration ?? 60) * 60_000;
  return new Date(start.getTime() + durationMs).toISOString();
}

// ── CRM Activity chip (read-only, striped left border) ──────────────────────

export function CrmActivityChip({
  activity,
  onClick,
}: {
  activity: CrmActivityItem;
  onClick: (a: CrmActivityItem) => void;
}) {
  const color = crmActivityColor(activity.type);
  const top = blockTop(activity.scheduledAt);
  const endAt = crmActivityEndAt(activity);
  const height = Math.max(blockHeight(activity.scheduledAt, endAt), 22);

  return (
    <div
      className="absolute left-1 right-1 rounded px-1.5 py-1 overflow-hidden shadow-sm cursor-pointer hover:brightness-95"
      style={{
        top,
        height,
        backgroundColor: color + "18",
        borderLeft: `4px dashed ${color}`,
        zIndex: 5,
      }}
      onClick={() => onClick(activity)}
      title={`CRM: ${activity.subject}`}
    >
      <div className="flex items-center gap-1" style={{ color }}>
        {crmActivityIcon(activity.type)}
        <p className="text-xs font-medium leading-tight truncate">{activity.subject}</p>
      </div>
      {height > 32 && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate capitalize">{activity.type}</p>
      )}
    </div>
  );
}

// ── Draggable block chip ──────────────────────────────────────────────────────

export function DraggableBlockChip({
  block,
  onClick,
  onCalendarPush,
  onResizeStart,
  isDragging,
  heightOverride,
}: {
  block: TimeBlock;
  onClick: (b: TimeBlock) => void;
  onCalendarPush: (id: string) => void;
  onResizeStart: (blockId: string, startY: number, origEndAtMs: number) => void;
  isDragging?: boolean;
  heightOverride?: number;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: block.id,
    data: { block },
  });

  const top = blockTop(block.start_at);
  const height = heightOverride ?? blockHeight(block.start_at, block.end_at);
  const color = typeColor(block.block_type, block.color);

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : {};

  return (
    <div
      ref={setNodeRef}
      style={{
        top,
        height: Math.max(height, 22),
        backgroundColor: color + "22",
        borderLeftColor: color,
        opacity: isDragging ? 0.4 : 1,
        ...style,
      }}
      className="absolute left-1 right-1 rounded px-1.5 py-1 overflow-hidden shadow-sm border-l-4 select-none group"
    >
      <div
        {...listeners}
        {...attributes}
        className="absolute inset-x-0 top-0 cursor-grab active:cursor-grabbing"
        style={{ zIndex: 1, bottom: 10 }}
      />
      <div className="relative z-10 pointer-events-none">
        <p className="text-xs font-medium leading-tight truncate" style={{ color }}>
          {block.title}
        </p>
        {height > 32 && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {typeLabel(block.block_type)}
          </p>
        )}
      </div>
      <div
        className="absolute inset-0 z-20 cursor-pointer"
        style={{ left: "40%" }}
        onClick={(e) => { e.stopPropagation(); onClick(block); }}
      />
      {!block.synced_to_calendar && (
        <button
          className="absolute top-0.5 right-0.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/50"
          title="Push to Google Calendar"
          onClick={(e) => { e.stopPropagation(); onCalendarPush(block.id); }}
        >
          <CalendarDays className="w-3 h-3" style={{ color }} />
        </button>
      )}
      {block.synced_to_calendar && (
        <Calendar
          className="absolute top-0.5 right-0.5 z-30 w-3 h-3 pointer-events-none"
          style={{ color }}
        />
      )}
      <div
        className="absolute inset-x-0 bottom-0 h-2.5 z-30 cursor-ns-resize opacity-0 group-hover:opacity-100 flex items-center justify-center"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onResizeStart(block.id, e.clientY, new Date(block.end_at).getTime());
        }}
      >
        <div className="w-6 h-0.5 rounded-full bg-current opacity-40" style={{ color }} />
      </div>
    </div>
  );
}

// ── Droppable hour cell ───────────────────────────────────────────────────────

export function DroppableHourCell({ id, onClick }: { id: string; onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`border-b cursor-pointer transition-colors ${isOver ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/30"}`}
      style={{ height: HOUR_HEIGHT }}
      onClick={onClick}
    />
  );
}

// ── TimeBlockGrid ─────────────────────────────────────────────────────────────

export type TimeBlockGridProps = {
  blocks: TimeBlock[];
  crmActivities?: CrmActivityItem[];
  days: Date[];
  hours: number[];
  viewMode: "week" | "day";
  isLoading: boolean;
  activeDragId: string | null;
  resizeHeights: Record<string, number>;
  sensors: SensorDescriptor<SensorOptions>[];
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  openCreate: (day: Date, hour: number) => void;
  openEdit: (block: TimeBlock) => void;
  onCalendarPush: (id: string) => void;
  onResizeStart: (blockId: string, startY: number, origEndAtMs: number) => void;
  onCrmActivityClick: (activity: CrmActivityItem) => void;
  setSelectedDay: (d: Date) => void;
  setViewMode: (v: "week" | "day") => void;
};

export function TimeBlockGrid({
  blocks,
  crmActivities = [],
  days,
  hours,
  viewMode,
  isLoading,
  activeDragId,
  resizeHeights,
  sensors,
  onDragStart,
  onDragEnd,
  openCreate,
  openEdit,
  onCalendarPush,
  onResizeStart,
  onCrmActivityClick,
  setSelectedDay,
  setViewMode,
}: TimeBlockGridProps) {
  const blocksForDay = (day: Date) =>
    blocks.filter((b) => isSameDay(parseISO(b.start_at), day));

  const crmActivitiesForDay = (day: Date) =>
    crmActivities.filter(
      (a) => a.scheduledAt && isSameDay(parseISO(a.scheduledAt), day)
    );

  const activeDragBlock = activeDragId ? blocks.find((b) => b.id === activeDragId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex-1 overflow-auto border rounded-lg bg-background">
        {/* Day header row */}
        <div
          className="grid sticky top-0 z-10 bg-background border-b"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
        >
          <div className="border-r" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`px-2 py-2 text-center border-r last:border-r-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                isSameDay(day, new Date()) ? "bg-blue-50 dark:bg-blue-950/20" : ""
              }`}
              onClick={() => {
                setSelectedDay(day);
                if (viewMode === "week") setViewMode("day");
              }}
            >
              <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
              <p className={`text-sm font-semibold ${isSameDay(day, new Date()) ? "text-blue-600" : ""}`}>
                {format(day, "d")}
              </p>
              {blocksForDay(day).length > 0 && (
                <Badge variant="secondary" className="text-xs mt-0.5 px-1 py-0">
                  {blocksForDay(day).length}
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Hour rows */}
        <div
          className="grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
        >
          {/* Time gutter */}
          <div className="border-r">
            {hours.map((h) => (
              <div
                key={h}
                className="border-b text-right pr-2 text-xs text-muted-foreground"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="relative -top-2">{format(new Date(2000, 0, 1, h), "h a")}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayBlocks = blocksForDay(day);
            const dayCrmActivities = crmActivitiesForDay(day);
            const dayIso = format(day, "yyyy-MM-dd");

            return (
              <div
                key={day.toISOString()}
                className="relative border-r last:border-r-0"
                style={{ height: VISIBLE_HOURS * HOUR_HEIGHT }}
              >
                {hours.map((h) => (
                  <DroppableHourCell
                    key={h}
                    id={`${dayIso}-${h}`}
                    onClick={() => openCreate(day, h)}
                  />
                ))}

                {isLoading
                  ? [0, 1].map((i) => (
                      <div
                        key={i}
                        className="absolute left-1 right-1 rounded"
                        style={{ top: i * 90 + 10, height: 60 }}
                      >
                        <Skeleton className="w-full h-full" />
                      </div>
                    ))
                  : dayBlocks.map((b) => (
                      <DraggableBlockChip
                        key={b.id}
                        block={b}
                        onClick={openEdit}
                        onCalendarPush={onCalendarPush}
                        onResizeStart={onResizeStart}
                        isDragging={activeDragId === b.id}
                        heightOverride={resizeHeights[b.id]}
                      />
                    ))}

                {!isLoading && dayCrmActivities.map((a) => (
                  <CrmActivityChip
                    key={`crm-${a.id}`}
                    activity={a}
                    onClick={onCrmActivityClick}
                  />
                ))}

                {isSameDay(day, new Date()) && (() => {
                  const now = new Date();
                  const mins = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes();
                  const top = (mins / 60) * HOUR_HEIGHT;
                  if (top < 0 || top > VISIBLE_HOURS * HOUR_HEIGHT) return null;
                  return (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none"
                      style={{ top }}
                    >
                      <div className="w-2 h-2 bg-red-500 rounded-full absolute -left-1 -top-1" />
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragBlock && (
          <div
            className="rounded px-1.5 py-1 shadow-lg border-l-4 opacity-90"
            style={{
              backgroundColor: typeColor(activeDragBlock.block_type, activeDragBlock.color) + "33",
              borderLeftColor: typeColor(activeDragBlock.block_type, activeDragBlock.color),
              width: 150,
              height: Math.max(blockHeight(activeDragBlock.start_at, activeDragBlock.end_at), 40),
            }}
          >
            <p
              className="text-xs font-medium truncate"
              style={{ color: typeColor(activeDragBlock.block_type, activeDragBlock.color) }}
            >
              {activeDragBlock.title}
            </p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
