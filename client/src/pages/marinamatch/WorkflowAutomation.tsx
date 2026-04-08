/**
 * WorkflowAutomation.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full workflow automation UI for MarinaMatch CRM/Pipeline.
 * Renders as a tab inside the existing CRM/Pipeline section.
 *
 * API contracts (all mounted under /api/marinamatch/workflow/):
 *   GET    /rules
 *   POST   /rules
 *   PATCH  /rules/:id
 *   DELETE /rules/:id
 *   POST   /rules/:id/trigger
 *   GET    /executions
 *   GET    /tasks
 *   PATCH  /tasks/:id
 *   GET    /stats
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Zap,
  Plus,
  Trash2,
  Edit,
  Play,
  MoreVertical,
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle,
  Activity,
  Bell,
  CheckSquare,
  Clock,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  GitBranch,
  LayoutList,
  RefreshCw,
  Info,
  Copy,
  Tag,
  User,
  MessageSquare,
  Mail,
  Globe,
  MoveRight,
  Star,
  AlertCircle,
  TrendingUp,
  Filter,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TriggerType =
  | "deal_added"
  | "deal_stage_changed"
  | "deal_score_threshold"
  | "deal_stale"
  | "deal_converted"
  | "deal_disqualified"
  | "manual";

type ConditionOperator =
  | "eq" | "ne" | "gt" | "lt" | "gte" | "lte"
  | "contains" | "not_contains" | "in" | "not_in"
  | "is_empty" | "is_not_empty";

type ActionType =
  | "change_status"
  | "assign_to"
  | "add_note"
  | "create_task"
  | "send_notification"
  | "send_email"
  | "webhook";

interface Condition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

interface Action {
  type: ActionType;
  config: Record<string, any>;
}

interface WorkflowRule {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  run_order: number;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  conditions: Condition[];
  actions: Action[];
  times_triggered: number;
  last_triggered_at?: string;
  created_at: string;
  updated_at: string;
}

interface Execution {
  id: string;
  rule_id: string;
  rule_name: string;
  trigger_type: TriggerType;
  deal_id?: string;
  deal_name?: string;
  status: "running" | "success" | "partial" | "skipped" | "failed";
  skipped_reason?: string;
  actions_run: Array<{ type: string; status: string; result?: any; error?: string }>;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}

interface WorkflowTask {
  id: string;
  title: string;
  description?: string;
  deal_id?: string;
  assignee_name?: string;
  due_date?: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "done" | "cancelled";
  created_at: string;
}

interface WorkflowStats {
  rules: { active: number; total: number };
  executions7d: { success: number; failed: number; skipped: number; partial: number; total: number };
  openTasks: number;
  unreadNotifications: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_CONFIG: Record<TriggerType, { label: string; icon: any; color: string; description: string }> = {
  deal_added:          { label: "Deal Added",         icon: Plus,        color: "bg-emerald-500", description: "Fires when a new deal enters the sourced-deals queue" },
  deal_stage_changed:  { label: "Stage Changed",      icon: MoveRight,   color: "bg-blue-500",    description: "Fires when a deal moves from one stage to another" },
  deal_score_threshold:{ label: "Score Threshold",    icon: TrendingUp,  color: "bg-violet-500",  description: "Fires when a deal's mandate score meets a minimum" },
  deal_stale:          { label: "Deal Stale",         icon: Clock,       color: "bg-amber-500",   description: "Fires (via cron) when a deal hasn't moved in N days" },
  deal_converted:      { label: "Deal Converted",     icon: CheckCircle2,color: "bg-teal-500",    description: "Fires when a sourced deal is promoted to a CRM deal" },
  deal_disqualified:   { label: "Disqualified",       icon: XCircle,     color: "bg-rose-500",    description: "Fires when a deal is marked disqualified" },
  manual:              { label: "Manual Trigger",     icon: Play,        color: "bg-slate-500",   description: "Trigger manually from the rule list or via API" },
};

const ACTION_CONFIG: Record<ActionType, { label: string; icon: any; color: string }> = {
  change_status:      { label: "Change Status",        icon: Tag,          color: "bg-blue-500" },
  assign_to:          { label: "Assign Deal",          icon: User,         color: "bg-violet-500" },
  add_note:           { label: "Add Note",             icon: MessageSquare,color: "bg-slate-500" },
  create_task:        { label: "Create Task",          icon: CheckSquare,  color: "bg-emerald-500" },
  send_notification:  { label: "Send Notification",    icon: Bell,         color: "bg-amber-500" },
  send_email:         { label: "Send Email",           icon: Mail,         color: "bg-sky-500" },
  webhook:            { label: "Webhook",              icon: Globe,        color: "bg-rose-500" },
};

const DEAL_STAGES = ["new", "reviewing", "qualified", "disqualified", "converted", "duplicate"];

const CONDITION_FIELDS = [
  { value: "deal.status",          label: "Deal Stage",      type: "select", options: DEAL_STAGES },
  { value: "deal.state",           label: "State",           type: "text" },
  { value: "deal.city",            label: "City",            type: "text" },
  { value: "deal.asking_price",    label: "Asking Price ($)",type: "number" },
  { value: "deal.best_mandate_score", label: "Mandate Score", type: "number" },
  { value: "deal.cap_rate",        label: "Cap Rate (%)",    type: "number" },
  { value: "deal.total_slips",     label: "Total Slips",     type: "number" },
  { value: "deal.noi",             label: "NOI ($)",         type: "number" },
  { value: "deal.source_type",     label: "Source Type",     type: "text" },
  { value: "deal.assigned_to",     label: "Assignee",        type: "text" },
  { value: "deal.is_duplicate",    label: "Is Duplicate",    type: "boolean" },
];

const NUMERIC_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "eq", label: "=" }, { value: "ne", label: "≠" },
  { value: "gt", label: ">" }, { value: "lt", label: "<" },
  { value: "gte", label: "≥" }, { value: "lte", label: "≤" },
];
const TEXT_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "eq", label: "equals" }, { value: "ne", label: "not equals" },
  { value: "contains", label: "contains" }, { value: "not_contains", label: "does not contain" },
  { value: "is_empty", label: "is empty" }, { value: "is_not_empty", label: "is not empty" },
];
const SELECT_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "eq", label: "is" }, { value: "ne", label: "is not" },
  { value: "in", label: "is one of" },
];

const STATUS_BADGE: Record<string, { color: string; label: string; icon: any }> = {
  success: { color: "text-emerald-700 bg-emerald-50 border-emerald-200", label: "Success",  icon: CheckCircle2 },
  failed:  { color: "text-rose-700 bg-rose-50 border-rose-200",          label: "Failed",   icon: XCircle },
  partial: { color: "text-amber-700 bg-amber-50 border-amber-200",       label: "Partial",  icon: AlertTriangle },
  skipped: { color: "text-slate-600 bg-slate-100 border-slate-200",      label: "Skipped",  icon: SkipForward },
  running: { color: "text-blue-700 bg-blue-50 border-blue-200",          label: "Running",  icon: RefreshCw },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function WorkflowAutomation() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("rules");
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);

  const { data: stats } = useQuery<WorkflowStats>({
    queryKey: ["/api/marinamatch/workflow/stats"],
    refetchInterval: 30_000,
  });

  const { data: rules = [], isLoading: rulesLoading, refetch: refetchRules } = useQuery<WorkflowRule[]>({
    queryKey: ["/api/marinamatch/workflow/rules"],
  });

  const { data: executions = [], isLoading: execLoading } = useQuery<Execution[]>({
    queryKey: ["/api/marinamatch/workflow/executions"],
    enabled: activeTab === "log",
    refetchInterval: activeTab === "log" ? 10_000 : false,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<WorkflowTask[]>({
    queryKey: ["/api/marinamatch/workflow/tasks"],
    enabled: activeTab === "tasks",
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiRequest("PATCH", `/api/marinamatch/workflow/rules/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/marinamatch/workflow/rules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/marinamatch/workflow/rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/marinamatch/workflow/rules"] });
      toast({ title: "Rule deleted" });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: ({ id, dealId }: { id: string; dealId?: string }) =>
      apiRequest("POST", `/api/marinamatch/workflow/rules/${id}/trigger`, { dealId }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/marinamatch/workflow/executions"] });
      qc.invalidateQueries({ queryKey: ["/api/marinamatch/workflow/stats"] });
      const status = data?.execution?.status ?? "run";
      toast({ title: "Rule triggered", description: `Execution status: ${status}` });
    },
    onError: () => toast({ title: "Trigger failed", variant: "destructive" }),
  });

  const taskMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/marinamatch/workflow/tasks/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/marinamatch/workflow/tasks"] }),
  });

  const openCreate = () => { setEditingRule(null); setRuleDialogOpen(true); };
  const openEdit   = (r: WorkflowRule) => { setEditingRule(r); setRuleDialogOpen(true); };

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* ── Stats bar ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Active Rules"
            value={stats?.rules.active ?? 0}
            sub={`of ${stats?.rules.total ?? 0} total`}
            icon={Zap}
            accent="text-blue-600"
          />
          <StatCard
            label="Runs (7d)"
            value={stats?.executions7d.total ?? 0}
            sub={`${stats?.executions7d.success ?? 0} succeeded`}
            icon={Activity}
            accent="text-emerald-600"
          />
          <StatCard
            label="Open Tasks"
            value={stats?.openTasks ?? 0}
            sub="generated by automation"
            icon={CheckSquare}
            accent="text-amber-600"
          />
          <StatCard
            label="Notifications"
            value={stats?.unreadNotifications ?? 0}
            sub="unread"
            icon={Bell}
            accent="text-violet-600"
          />
        </div>

        {/* ── Tab nav ────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList className="bg-slate-100 dark:bg-slate-800">
              <TabsTrigger value="rules" className="text-xs gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />Rules
              </TabsTrigger>
              <TabsTrigger value="log" className="text-xs gap-1.5">
                <Activity className="h-3.5 w-3.5" />Execution Log
              </TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" />Tasks
                {(stats?.openTasks ?? 0) > 0 && (
                  <span className="bg-amber-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {stats!.openTasks > 9 ? "9+" : stats!.openTasks}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {activeTab === "rules" && (
              <Button size="sm" onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-3.5 w-3.5 mr-1.5" />New Rule
              </Button>
            )}
            {activeTab === "log" && (
              <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["/api/marinamatch/workflow/executions"] })}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
              </Button>
            )}
          </div>

          {/* ── Rules tab ─────────────────────────────────────────────── */}
          <TabsContent value="rules" className="mt-4">
            {rulesLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
            ) : rules.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="No automation rules yet"
                description="Create rules to automatically change deal stages, assign owners, create tasks, and send notifications when deals match certain conditions."
                action={<Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white"><Plus className="h-4 w-4 mr-1.5" />Create First Rule</Button>}
              />
            ) : (
              <div className="space-y-3">
                {rules.map((rule, idx) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onToggle={() => toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active })}
                    onEdit={() => openEdit(rule)}
                    onDelete={() => deleteMutation.mutate(rule.id)}
                    onTrigger={() => triggerMutation.mutate({ id: rule.id })}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Execution log tab ──────────────────────────────────────── */}
          <TabsContent value="log" className="mt-4">
            {execLoading ? (
              <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
            ) : executions.length === 0 ? (
              <EmptyState icon={Activity} title="No executions yet" description="Run a rule manually or wait for a trigger event." />
            ) : (
              <div className="space-y-2">
                {executions.map(exec => <ExecutionRow key={exec.id} execution={exec} />)}
              </div>
            )}
          </TabsContent>

          {/* ── Tasks tab ─────────────────────────────────────────────── */}
          <TabsContent value="tasks" className="mt-4">
            {tasksLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
            ) : tasks.length === 0 ? (
              <EmptyState icon={CheckSquare} title="No open tasks" description="Tasks created by automation rules will appear here." />
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={() => taskMutation.mutate({ id: task.id, status: "done" })}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Rule builder dialog ────────────────────────────────────── */}
        <RuleBuilderDialog
          open={ruleDialogOpen}
          rule={editingRule}
          onClose={() => setRuleDialogOpen(false)}
          onSaved={() => {
            setRuleDialogOpen(false);
            qc.invalidateQueries({ queryKey: ["/api/marinamatch/workflow/rules"] });
            qc.invalidateQueries({ queryKey: ["/api/marinamatch/workflow/stats"] });
          }}
        />
      </div>
    </TooltipProvider>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: number; sub: string; icon: any; accent: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500">{label}</span>
        <Icon className={cn("h-4 w-4", accent)} />
      </div>
      <p className={cn("text-2xl font-bold font-mono", accent)}>{value.toLocaleString()}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({ rule, onToggle, onEdit, onDelete, onTrigger }: {
  rule: WorkflowRule;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTrigger: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const trigger = TRIGGER_CONFIG[rule.trigger_type];
  const TriggerIcon = trigger.icon;

  return (
    <div className={cn(
      "bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all",
      rule.is_active
        ? "border-slate-200 dark:border-slate-800"
        : "border-slate-100 dark:border-slate-900 opacity-60"
    )}>
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Trigger icon */}
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", trigger.color)}>
          <TriggerIcon className="h-4 w-4 text-white" />
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{rule.name}</p>
            {!rule.is_active && <Badge variant="outline" className="text-[10px]">Paused</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-500">{trigger.label}</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500">
              {rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}
            </span>
            {rule.conditions.length > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-500">{rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""}</span>
              </>
            )}
            {rule.times_triggered > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-400">
                  {rule.times_triggered}× fired
                  {rule.last_triggered_at && ` · last ${formatDistanceToNow(new Date(rule.last_triggered_at))} ago`}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch
            checked={rule.is_active}
            onCheckedChange={onToggle}
            className="data-[state=checked]:bg-blue-600"
          />
          <button
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Edit className="h-3.5 w-3.5 mr-2" />Edit Rule</DropdownMenuItem>
              <DropdownMenuItem onClick={onTrigger}><Play className="h-3.5 w-3.5 mr-2" />Trigger Now</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-rose-600 focus:text-rose-600">
                <Trash2 className="h-3.5 w-3.5 mr-2" />Delete Rule
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-3 bg-slate-50 dark:bg-slate-800/40">
          {rule.description && (
            <p className="text-xs text-slate-600 dark:text-slate-400">{rule.description}</p>
          )}

          {/* Trigger config */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Trigger</p>
            <TriggerSummary type={rule.trigger_type} config={rule.trigger_config} />
          </div>

          {/* Conditions */}
          {rule.conditions.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                Conditions (ALL must match)
              </p>
              <div className="space-y-1">
                {rule.conditions.map((c, i) => (
                  <ConditionPill key={i} condition={c} />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Actions</p>
            <div className="flex flex-wrap gap-2">
              {rule.actions.map((a, i) => (
                <ActionBadge key={i} action={a} index={i} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TriggerSummary({ type, config }: { type: TriggerType; config: Record<string, any> }) {
  const trigger = TRIGGER_CONFIG[type];
  let detail = "";
  if (type === "deal_stage_changed") {
    if (config.fromStage && config.toStage) detail = `${config.fromStage} → ${config.toStage}`;
    else if (config.toStage) detail = `→ ${config.toStage}`;
    else if (config.fromStage) detail = `from ${config.fromStage}`;
  } else if (type === "deal_score_threshold") {
    detail = `Score ≥ ${config.minScore ?? "?"}`;
  } else if (type === "deal_stale") {
    detail = `After ${config.staleAfterDays ?? 14} days inactive`;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-1">
      <span className={cn("h-2 w-2 rounded-full", trigger.color)} />
      <span className="font-medium">{trigger.label}</span>
      {detail && <span className="text-slate-400">{detail}</span>}
    </span>
  );
}

function ConditionPill({ condition }: { condition: Condition }) {
  const field = CONDITION_FIELDS.find(f => f.value === condition.field);
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5">
      <Filter className="h-2.5 w-2.5 text-slate-400" />
      <span className="font-medium text-slate-700 dark:text-slate-300">{field?.label ?? condition.field}</span>
      <span className="text-slate-400">{condition.operator}</span>
      {condition.value != null && (
        <span className="font-mono text-slate-600 dark:text-slate-400">{String(condition.value)}</span>
      )}
    </span>
  );
}

function ActionBadge({ action, index }: { action: Action; index: number }) {
  const cfg = ACTION_CONFIG[action.type];
  const Icon = cfg.icon;
  let detail = "";
  switch (action.type) {
    case "change_status":    detail = action.config.newStatus ?? ""; break;
    case "assign_to":        detail = action.config.assigneeName ?? ""; break;
    case "create_task":      detail = action.config.title?.slice(0, 30) ?? ""; break;
    case "send_notification":detail = `to ${Array.isArray(action.config.userIds) ? action.config.userIds.length : 1} user(s)`; break;
    case "add_note":         detail = action.config.noteText?.slice(0, 30) ?? ""; break;
    case "webhook":          detail = new URL(action.config.url ?? "https://x").hostname; break;
    case "send_email":       detail = action.config.to ?? ""; break;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
      <span className={cn("h-4 w-4 rounded flex items-center justify-center", cfg.color)}>
        <Icon className="h-2.5 w-2.5 text-white" />
      </span>
      <span className="font-medium text-slate-700 dark:text-slate-300">{cfg.label}</span>
      {detail && <span className="text-slate-400 truncate max-w-24">{detail}</span>}
    </span>
  );
}

// ─── Execution Row ────────────────────────────────────────────────────────────

function ExecutionRow({ execution: e }: { execution: Execution }) {
  const [expanded, setExpanded] = useState(false);
  const badge = STATUS_BADGE[e.status] ?? STATUS_BADGE.running;
  const BadgeIcon = badge.icon;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
        onClick={() => setExpanded(e => !e)}
      >
        <BadgeIcon className={cn("h-4 w-4 flex-shrink-0",
          e.status === "success" ? "text-emerald-500" :
          e.status === "failed"  ? "text-rose-500" :
          e.status === "skipped" ? "text-slate-400" :
          e.status === "partial" ? "text-amber-500" : "text-blue-500 animate-spin"
        )} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{e.rule_name}</span>
            {e.deal_name && (
              <span className="text-xs text-slate-400 truncate hidden sm:block">· {e.deal_name}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
            <span>{TRIGGER_CONFIG[e.trigger_type]?.label ?? e.trigger_type}</span>
            <span>·</span>
            <span>{format(new Date(e.started_at), "MMM d, HH:mm")}</span>
            {e.duration_ms && <><span>·</span><span>{e.duration_ms}ms</span></>}
          </div>
        </div>
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", badge.color)}>
          {badge.label}
        </span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-800/40">
          {e.skipped_reason && (
            <p className="text-xs text-slate-500 mb-2 italic">Skipped: {e.skipped_reason}</p>
          )}
          {e.actions_run.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Actions</p>
              {e.actions_run.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {a.status === "success"
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    : <XCircle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                  }
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{a.type.replace(/_/g, " ")}</span>
                    {a.error && <span className="text-rose-600 ml-1">— {a.error}</span>}
                    {a.result && (
                      <span className="text-slate-400 ml-1 font-mono text-[11px]">
                        {JSON.stringify(a.result).slice(0, 80)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "bg-rose-500", high: "bg-amber-500", normal: "bg-blue-500", low: "bg-slate-400",
};

function TaskRow({ task, onComplete }: { task: WorkflowTask; onComplete: () => void }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status === "open";
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 flex items-center gap-3">
      <button
        onClick={onComplete}
        className="h-5 w-5 rounded border-2 border-slate-300 hover:border-blue-500 flex-shrink-0 flex items-center justify-center transition-colors group"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-transparent group-hover:text-blue-500 transition-colors" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.assignee_name && (
            <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
              <User className="h-2.5 w-2.5" />{task.assignee_name}
            </span>
          )}
          {task.due_date && (
            <span className={cn("text-[11px] flex items-center gap-0.5", isOverdue ? "text-rose-600 font-semibold" : "text-slate-400")}>
              <Clock className="h-2.5 w-2.5" />
              {isOverdue ? "Overdue · " : ""}{format(new Date(task.due_date), "MMM d")}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn("h-2 w-2 rounded-full", PRIORITY_COLOR[task.priority] ?? "bg-slate-400")} />
        <span className="text-[10px] text-slate-400 capitalize">{task.priority}</span>
      </div>
    </div>
  );
}

// ─── Rule Builder Dialog ──────────────────────────────────────────────────────

const BLANK_RULE = {
  name: "",
  description: "",
  is_active: true,
  run_order: 0,
  trigger_type: "deal_stage_changed" as TriggerType,
  trigger_config: {} as Record<string, any>,
  conditions: [] as Condition[],
  actions: [] as Action[],
};

function RuleBuilderDialog({
  open,
  rule,
  onClose,
  onSaved,
}: {
  open: boolean;
  rule: WorkflowRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(() => rule ? {
    name: rule.name,
    description: rule.description ?? "",
    is_active: rule.is_active,
    run_order: rule.run_order,
    trigger_type: rule.trigger_type,
    trigger_config: rule.trigger_config,
    conditions: rule.conditions,
    actions: rule.actions,
  } : { ...BLANK_RULE });

  // Sync when editing rule changes
  useState(() => {
    if (rule) {
      setForm({
        name: rule.name,
        description: rule.description ?? "",
        is_active: rule.is_active,
        run_order: rule.run_order,
        trigger_type: rule.trigger_type,
        trigger_config: rule.trigger_config,
        conditions: rule.conditions,
        actions: rule.actions,
      });
    } else {
      setForm({ ...BLANK_RULE });
    }
  });

  const isEditing = !!rule;

  const mutation = useMutation({
    mutationFn: (data: typeof form) =>
      isEditing
        ? apiRequest("PATCH", `/api/marinamatch/workflow/rules/${rule!.id}`, data)
        : apiRequest("POST", "/api/marinamatch/workflow/rules", data),
    onSuccess: () => {
      toast({ title: isEditing ? "Rule updated" : "Rule created" });
      onSaved();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const setTrigger = (type: TriggerType) => setForm(f => ({ ...f, trigger_type: type, trigger_config: {} }));
  const setTriggerConfig = (cfg: Record<string, any>) => setForm(f => ({ ...f, trigger_config: cfg }));

  const addCondition = () => setForm(f => ({
    ...f,
    conditions: [...f.conditions, { field: "deal.status", operator: "eq" as ConditionOperator, value: "" }],
  }));
  const updateCondition = (i: number, patch: Partial<Condition>) =>
    setForm(f => ({ ...f, conditions: f.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c) }));
  const removeCondition = (i: number) =>
    setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));

  const addAction = (type: ActionType) => setForm(f => ({
    ...f,
    actions: [...f.actions, { type, config: defaultActionConfig(type) }],
  }));
  const updateAction = (i: number, config: Record<string, any>) =>
    setForm(f => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, config } : a) }));
  const removeAction = (i: number) =>
    setForm(f => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i) }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            {isEditing ? "Edit Rule" : "New Automation Rule"}
          </DialogTitle>
          <DialogDescription>
            Define when this rule fires, what conditions must be met, and what actions to take.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-1">
          {/* Basics */}
          <Section title="Rule Details">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Rule Name *</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. High-score deal assigned to analyst"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Description (optional)</Label>
                <Textarea
                  className="mt-1 text-sm"
                  rows={2}
                  placeholder="Describe what this rule does and when it should apply…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
                  className="data-[state=checked]:bg-blue-600"
                />
                <Label className="text-sm font-normal">Active (rule will fire automatically)</Label>
              </div>
            </div>
          </Section>

          {/* Trigger */}
          <Section title="Trigger — When does this run?">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(TRIGGER_CONFIG) as TriggerType[]).map(t => {
                const cfg = TRIGGER_CONFIG[t];
                const Icon = cfg.icon;
                return (
                  <button
                    key={t}
                    onClick={() => setTrigger(t)}
                    className={cn(
                      "flex items-start gap-2 p-3 rounded-lg border text-left text-xs transition-all",
                      form.trigger_type === t
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-slate-200 dark:border-slate-700 hover:border-blue-300"
                    )}
                  >
                    <span className={cn("h-5 w-5 rounded flex items-center justify-center flex-shrink-0", cfg.color)}>
                      <Icon className="h-3 w-3 text-white" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{cfg.label}</p>
                      <p className="text-slate-500 mt-0.5 hidden sm:block" style={{ fontSize: 10 }}>{cfg.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Trigger config fields */}
            <TriggerConfigFields
              type={form.trigger_type}
              config={form.trigger_config}
              onChange={setTriggerConfig}
            />
          </Section>

          {/* Conditions */}
          <Section
            title="Conditions (optional)"
            action={
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCondition}>
                <Plus className="h-3 w-3 mr-1" />Add Condition
              </Button>
            }
          >
            {form.conditions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No conditions — rule fires for all matching trigger events.</p>
            ) : (
              <div className="space-y-2">
                {form.conditions.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">ALL of:</span>
                  </div>
                )}
                {form.conditions.map((c, i) => (
                  <ConditionEditor
                    key={i}
                    condition={c}
                    onChange={patch => updateCondition(i, patch)}
                    onRemove={() => removeCondition(i)}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Actions */}
          <Section
            title="Actions — What should happen?"
            action={
              <ActionTypeDropdown onSelect={addAction} />
            }
          >
            {form.actions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Add at least one action.</p>
            ) : (
              <div className="space-y-2">
                {form.actions.map((a, i) => (
                  <ActionEditor
                    key={i}
                    index={i}
                    action={a}
                    onChange={config => updateAction(i, config)}
                    onRemove={() => removeAction(i)}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!form.name.trim() || form.actions.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            {mutation.isPending
              ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              : isEditing ? "Save Changes" : "Create Rule"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Trigger Config Fields ────────────────────────────────────────────────────

function TriggerConfigFields({
  type, config, onChange,
}: {
  type: TriggerType;
  config: Record<string, any>;
  onChange: (c: Record<string, any>) => void;
}) {
  if (type === "deal_stage_changed") {
    return (
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">From Stage (optional)</Label>
          <Select value={config.fromStage ?? ""} onValueChange={v => onChange({ ...config, fromStage: v || undefined })}>
            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Any stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any stage</SelectItem>
              {DEAL_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">To Stage (optional)</Label>
          <Select value={config.toStage ?? ""} onValueChange={v => onChange({ ...config, toStage: v || undefined })}>
            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Any stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any stage</SelectItem>
              {DEAL_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }
  if (type === "deal_score_threshold") {
    return (
      <div className="mt-3">
        <Label className="text-xs">Minimum Mandate Score (0–100)</Label>
        <Input
          type="number"
          min={0} max={100}
          className="mt-1 h-8 text-sm w-32"
          placeholder="e.g. 75"
          value={config.minScore ?? ""}
          onChange={e => onChange({ ...config, minScore: e.target.value ? parseInt(e.target.value) : undefined })}
        />
      </div>
    );
  }
  if (type === "deal_stale") {
    return (
      <div className="mt-3">
        <Label className="text-xs">Stale after (days without activity)</Label>
        <Input
          type="number"
          min={1}
          className="mt-1 h-8 text-sm w-32"
          placeholder="e.g. 14"
          value={config.staleAfterDays ?? ""}
          onChange={e => onChange({ ...config, staleAfterDays: e.target.value ? parseInt(e.target.value) : undefined })}
        />
      </div>
    );
  }
  return null;
}

// ─── Condition Editor ─────────────────────────────────────────────────────────

function ConditionEditor({
  condition,
  onChange,
  onRemove,
}: {
  condition: Condition;
  onChange: (p: Partial<Condition>) => void;
  onRemove: () => void;
}) {
  const fieldDef = CONDITION_FIELDS.find(f => f.value === condition.field);
  const operators =
    fieldDef?.type === "number" ? NUMERIC_OPERATORS :
    fieldDef?.type === "select" ? SELECT_OPERATORS : TEXT_OPERATORS;

  const noValueOps = ["is_empty", "is_not_empty"];

  return (
    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 flex-wrap">
      {/* Field */}
      <Select value={condition.field} onValueChange={v => onChange({ field: v, operator: "eq", value: "" })}>
        <SelectTrigger className="h-7 text-xs flex-1 min-w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONDITION_FIELDS.map(f => (
            <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator */}
      <Select value={condition.operator} onValueChange={v => onChange({ operator: v as ConditionOperator })}>
        <SelectTrigger className="h-7 text-xs w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map(o => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value */}
      {!noValueOps.includes(condition.operator) && (
        fieldDef?.type === "select" ? (
          <Select
            value={condition.value ?? ""}
            onValueChange={v => onChange({ value: v })}
          >
            <SelectTrigger className="h-7 text-xs flex-1 min-w-28">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {(fieldDef.options ?? []).map(o => (
                <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            className="h-7 text-xs flex-1 min-w-24"
            type={fieldDef?.type === "number" ? "number" : "text"}
            placeholder="value"
            value={condition.value ?? ""}
            onChange={e => onChange({ value: e.target.value })}
          />
        )
      )}

      <button onClick={onRemove} className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Action Type Dropdown ─────────────────────────────────────────────────────

function ActionTypeDropdown({ onSelect }: { onSelect: (t: ActionType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" />Add Action
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(ACTION_CONFIG) as ActionType[]).map(t => {
          const cfg = ACTION_CONFIG[t];
          const Icon = cfg.icon;
          return (
            <DropdownMenuItem key={t} onClick={() => onSelect(t)} className="text-xs gap-2">
              <span className={cn("h-4 w-4 rounded flex items-center justify-center", cfg.color)}>
                <Icon className="h-2.5 w-2.5 text-white" />
              </span>
              {cfg.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Action Editor ────────────────────────────────────────────────────────────

function ActionEditor({
  index, action, onChange, onRemove,
}: {
  index: number;
  action: Action;
  onChange: (config: Record<string, any>) => void;
  onRemove: () => void;
}) {
  const cfg = ACTION_CONFIG[action.type];
  const Icon = cfg.icon;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800">
        <span className={cn("h-5 w-5 rounded flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0", cfg.color)}>
          {index + 1}
        </span>
        <span className={cn("h-4 w-4 rounded flex items-center justify-center", cfg.color)}>
          <Icon className="h-2.5 w-2.5 text-white" />
        </span>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex-1">{cfg.label}</span>
        <button onClick={onRemove} className="text-slate-400 hover:text-rose-500">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-3 py-3">
        <ActionConfigFields action={action} onChange={onChange} />
      </div>
    </div>
  );
}

function ActionConfigFields({ action, onChange }: { action: Action; onChange: (c: Record<string, any>) => void }) {
  const c = action.config;
  const set = (patch: Record<string, any>) => onChange({ ...c, ...patch });

  switch (action.type) {
    case "change_status":
      return (
        <div>
          <Label className="text-xs">New Stage</Label>
          <Select value={c.newStatus ?? ""} onValueChange={v => set({ newStatus: v })}>
            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Select stage…" /></SelectTrigger>
            <SelectContent>
              {DEAL_STAGES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    case "assign_to":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Assignee Name</Label>
            <Input className="mt-1 h-8 text-xs" placeholder="Jane Smith" value={c.assigneeName ?? ""} onChange={e => set({ assigneeName: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Assignee User ID</Label>
            <Input className="mt-1 h-8 text-xs" placeholder="user_abc" value={c.assigneeId ?? ""} onChange={e => set({ assigneeId: e.target.value })} />
          </div>
        </div>
      );
    case "add_note":
      return (
        <div>
          <Label className="text-xs">Note Text (use {"{{deal.propertyName}}"} for values)</Label>
          <Textarea className="mt-1 text-xs" rows={2} value={c.noteText ?? ""} onChange={e => set({ noteText: e.target.value })} placeholder="Auto-note: deal moved to qualified stage. Mandate score: {{deal.best_mandate_score}}" />
        </div>
      );
    case "create_task":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Task Title *</Label>
            <Input className="mt-1 h-8 text-xs" placeholder="Review {{deal.propertyName}}" value={c.title ?? ""} onChange={e => set({ title: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Assignee Name</Label>
              <Input className="mt-1 h-8 text-xs" value={c.assigneeName ?? ""} onChange={e => set({ assigneeName: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Due (days from now)</Label>
              <Input type="number" min={1} className="mt-1 h-8 text-xs" placeholder="7" value={c.dueDaysFromNow ?? ""} onChange={e => set({ dueDaysFromNow: e.target.value ? parseInt(e.target.value) : undefined })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Priority</Label>
            <Select value={c.priority ?? "normal"} onValueChange={v => set({ priority: v })}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["low","normal","high","urgent"].map(p => <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    case "send_notification":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Title *</Label>
            <Input className="mt-1 h-8 text-xs" placeholder="New deal qualified: {{deal.propertyName}}" value={c.title ?? ""} onChange={e => set({ title: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Body</Label>
            <Textarea className="mt-1 text-xs" rows={2} value={c.body ?? ""} onChange={e => set({ body: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">User IDs (comma-separated)</Label>
            <Input className="mt-1 h-8 text-xs" placeholder="user_a,user_b" value={Array.isArray(c.userIds) ? c.userIds.join(",") : (c.userIds ?? "")} onChange={e => set({ userIds: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
          </div>
        </div>
      );
    case "send_email":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">To</Label>
            <Input className="mt-1 h-8 text-xs" type="email" placeholder="analyst@firm.com" value={c.to ?? ""} onChange={e => set({ to: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Subject</Label>
            <Input className="mt-1 h-8 text-xs" placeholder="New qualified deal: {{deal.propertyName}}" value={c.subject ?? ""} onChange={e => set({ subject: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Body</Label>
            <Textarea className="mt-1 text-xs" rows={3} value={c.body ?? ""} onChange={e => set({ body: e.target.value })} />
          </div>
        </div>
      );
    case "webhook":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">URL *</Label>
            <Input className="mt-1 h-8 text-xs" type="url" placeholder="https://hooks.example.com/deal-alert" value={c.url ?? ""} onChange={e => set({ url: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Method</Label>
            <Select value={c.method ?? "POST"} onValueChange={v => set({ method: v })}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["POST","PUT","PATCH"].map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    default:
      return null;
  }
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description, action }: { icon: any; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">{description}</p>
      {action}
    </div>
  );
}

// ─── Default action configs ───────────────────────────────────────────────────

function defaultActionConfig(type: ActionType): Record<string, any> {
  switch (type) {
    case "change_status":     return { newStatus: "reviewing" };
    case "assign_to":         return { assigneeId: "", assigneeName: "" };
    case "add_note":          return { noteText: "" };
    case "create_task":       return { title: "", priority: "normal", dueDaysFromNow: 7 };
    case "send_notification": return { title: "", body: "", userIds: [] };
    case "send_email":        return { to: "", subject: "", body: "" };
    case "webhook":           return { url: "", method: "POST" };
  }
}

export default WorkflowAutomation;
