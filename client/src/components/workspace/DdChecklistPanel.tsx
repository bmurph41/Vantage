/**
 * DdChecklistPanel
 *
 * Drop-in replacement for the Diligence tab content inside [workspaceId].tsx.
 * Usage: <DdChecklistPanel workspaceId={workspaceId} />
 */
import { useState } from 'react';
import {
  useDdChecklist, useCreateDdChecklist, useCreateFromTemplate, useSetItemStatus,
  useUpdateItem, useCreateSection, useCreateItem, useDeleteItem, useDeleteSection,
  useExportChecklist, useDdChecklistTemplates, useSeedTemplates, useItemComments,
  usePostComment, useItemHistory, useUpdateChecklistSettings, useTogglePeriodReceived,
  useAddPeriods, useDeletePeriod, useQuickAddDealTeamMember, useDealTeamContacts,
  useDealTeamStats,
  DdChecklistItem, DdChecklistSection as SectionType, DdChecklistItemPeriod, DealTeamContact,
  DealTeamMemberStats,
} from '@/hooks/useDdChecklist';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle, Calendar, Check, CheckCircle2, ChevronDown, ChevronRight, Circle,
  BarChart3, ClipboardList, Download, FileText, Loader2, MessageSquare, MoreVertical,
  Paperclip, Plus, Settings, Shield, Trash2, UserPlus, Users, X,
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: 'Open', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
  requested: { label: 'Requested', bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  provided: { label: 'Provided', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  reviewing: { label: 'Reviewing', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  approved: { label: 'Approved', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  rejected: { label: 'Rejected', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  waived: { label: 'Waived', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' },
  blocked: { label: 'Blocked', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
};

const PRIORITY_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  2: { label: 'Med', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  3: { label: 'Low', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

const ALL_STATUSES = ['open', 'requested', 'in_progress', 'provided', 'reviewing', 'approved', 'rejected', 'waived', 'blocked'];

interface Props {
  workspaceId: string;
}

export default function DdChecklistPanel({ workspaceId }: Props) {
  const { toast } = useToast();
  const { data, isLoading, error } = useDdChecklist(workspaceId);
  const { data: templates = [] } = useDdChecklistTemplates();
  const createChecklist = useCreateDdChecklist();
  const createFromTemplate = useCreateFromTemplate();
  const setItemStatus = useSetItemStatus();
  const updateItem = useUpdateItem();
  const createSection = useCreateSection();
  const createItem = useCreateItem();
  const deleteItem = useDeleteItem();
  const deleteSection = useDeleteSection();
  const exportChecklist = useExportChecklist();
  const seedTemplates = useSeedTemplates();
  const updateSettings = useUpdateChecklistSettings();
  const togglePeriod = useTogglePeriodReceived();

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [mergeStrategy, setMergeStrategy] = useState<string>('replace');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [addingItemToSection, setAddingItemToSection] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');

  const checklist = data?.checklist;
  const sections = data?.sections || [];
  const stats = data?.stats;
  const hasChecklist = !!checklist;
  const approvedPct = stats && stats.total > 0 ? (stats.approved / stats.total) * 100 : 0;

  const activeItem = activeItemId
    ? sections.flatMap(s => s.items).find(i => i.id === activeItemId) ?? null
    : null;
  const activeSection = activeSectionId
    ? sections.find(s => s.id === activeSectionId) ?? null
    : null;

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreateFromTemplate = () => {
    if (selectedTemplateIds.length === 0) return;
    createFromTemplate.mutate(
      { workspaceId, templateIds: selectedTemplateIds, mergeStrategy },
      {
        onSuccess: (result) => {
          toast({ title: 'Checklist Created', description: `${result.itemsCreated} items in ${result.sectionsCreated} sections.` });
          setShowTemplateDialog(false);
          setSelectedTemplateIds([]);
        },
        onError: () => toast({ title: 'Error', description: 'Failed to create from template', variant: 'destructive' }),
      }
    );
  };

  const handleSeedTemplates = () => {
    seedTemplates.mutate(undefined, {
      onSuccess: (r) => toast({ title: 'Templates Seeded', description: `${r.seeded} new templates added.` }),
    });
  };

  const handleAddSection = () => {
    if (!checklist || !newSectionTitle.trim()) return;
    createSection.mutate(
      { checklistId: checklist.id, workspaceId, title: newSectionTitle.trim() },
      {
        onSuccess: () => { setShowAddSectionDialog(false); setNewSectionTitle(''); },
      }
    );
  };

  const handleAddItem = (sectionId: string) => {
    if (!newItemTitle.trim()) return;
    createItem.mutate(
      { sectionId, workspaceId, title: newItemTitle.trim() },
      {
        onSuccess: () => { setAddingItemToSection(null); setNewItemTitle(''); },
      }
    );
  };

  const handleStatusChange = (itemId: string, status: string) => {
    setItemStatus.mutate({ itemId, workspaceId, status });
  };

  const handleCreateEmpty = () => {
    createChecklist.mutate(
      { workspaceId },
      { onSuccess: () => toast({ title: 'Checklist Created' }) }
    );
  };

  const handleTogglePeriod = (period: DdChecklistItemPeriod) => {
    togglePeriod.mutate({
      periodId: period.id,
      workspaceId,
      isReceived: !period.isReceived,
    });
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error) return <div className="text-red-500 p-4">Failed to load checklist</div>;

  if (!hasChecklist) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Due Diligence Checklist</CardTitle>
          <CardDescription>Create a professional DD request list to track all due diligence items.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No DD Checklist Yet</h3>
            <p className="text-muted-foreground mb-6">Create from a template or start with a blank checklist.</p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={handleCreateEmpty}>
                <Plus className="h-4 w-4 mr-2" />Blank Checklist
              </Button>
              <Button onClick={() => {
                if (templates.length === 0) handleSeedTemplates();
                setShowTemplateDialog(true);
              }}>
                <ClipboardList className="h-4 w-4 mr-2" />Create from Template
              </Button>
            </div>
          </div>

          <TemplatePickerDialog
            open={showTemplateDialog}
            onClose={() => setShowTemplateDialog(false)}
            templates={templates}
            selectedIds={selectedTemplateIds}
            onToggle={(id: string) => setSelectedTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
            mergeStrategy={mergeStrategy}
            onMergeChange={setMergeStrategy}
            onConfirm={handleCreateFromTemplate}
            isPending={createFromTemplate.isPending}
            onSeed={handleSeedTemplates}
            isSeedPending={seedTemplates.isPending}
          />
        </CardContent>
      </Card>
    );
  }

  const totalItems = stats?.total || 0;
  const completedItems = (stats?.approved || 0) + (stats?.waived || 0);

  return (
    <>
      <div className="space-y-6">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{checklist.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {completedItems} of {totalItems} items complete · {stats?.overdue || 0} overdue
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddSectionDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />Section
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportChecklist.mutate({ workspaceId, format: 'excel' })}>
              <Download className="h-4 w-4 mr-1" />Export
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowSettingsDialog(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Overall progress */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{Math.round(approvedPct)}% Complete</span>
            <div className="flex gap-3 text-xs text-muted-foreground">
              {[
                { key: 'open', statsKey: 'open', color: 'bg-gray-400' },
                { key: 'in_progress', statsKey: 'inProgress', color: 'bg-blue-500' },
                { key: 'provided', statsKey: 'provided', color: 'bg-amber-500' },
                { key: 'approved', statsKey: 'approved', color: 'bg-green-500' },
                { key: 'blocked', statsKey: 'blocked', color: 'bg-red-500' },
              ].map(({ key, statsKey, color }) => (
                <span key={key} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${color}`} />
                  {stats?.[statsKey as keyof typeof stats] || 0} {STATUS_CONFIG[key]?.label}
                </span>
              ))}
            </div>
          </div>
          <Progress value={approvedPct} className="h-2" />
        </div>

        {/* Sections with card grids */}
        {sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.id);
          const sectionApproved = section.items.filter(i => ['approved', 'waived'].includes(i.status)).length;
          const sectionTotal = section.items.length;
          const sectionPct = sectionTotal > 0 ? Math.round((sectionApproved / sectionTotal) * 100) : 0;
          const sectionComplete = sectionPct === 100 && sectionTotal > 0;

          return (
            <div key={section.id} className="space-y-3">
              {/* Section header */}
              <div
                className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                  sectionComplete
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-muted/50 border border-border hover:bg-muted'
                }`}
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center gap-3">
                  {isCollapsed
                    ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                  <div>
                    <span className="font-semibold text-sm">{section.title}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {sectionApproved}/{sectionTotal}
                    </span>
                  </div>
                  {sectionComplete && (
                    <Badge className="bg-green-600 text-white text-[10px] px-1.5">
                      <CheckCircle2 className="h-3 w-3 mr-0.5" />Done
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <div className="w-24">
                    <Progress value={sectionPct} className="h-1.5" />
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setAddingItemToSection(section.id); setNewItemTitle(''); }}>
                    <Plus className="h-3 w-3 mr-1" />Item
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500" onClick={() => {
                    if (confirm(`Delete section "${section.title}" and all its items?`)) {
                      deleteSection.mutate({ sectionId: section.id, workspaceId });
                    }
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Card grid */}
              {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pl-2">
                  {section.items.map((item) => {
                    const isComplete = ['approved', 'waived'].includes(item.status);
                    const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && !isComplete;
                    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
                    const pc = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG[2];
                    const periods = item.periods || [];
                    const totalPeriods = periods.length;
                    const receivedPeriods = periods.filter(p => p.isReceived).length;
                    const hasPeriods = totalPeriods > 0;

                    return (
                      <div
                        key={item.id}
                        className={`group relative rounded-xl border p-4 transition-all cursor-pointer hover:shadow-md ${
                          isComplete
                            ? 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-800 shadow-sm'
                            : isOverdue
                              ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                              : 'bg-card border-border hover:border-primary/30'
                        }`}
                        onClick={() => { setActiveItemId(item.id); setActiveSectionId(section.id); }}
                      >
                        {/* Top row: priority + status */}
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${pc.className}`}>
                            {pc.label}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${sc.bg} ${sc.text}`}>
                            {isComplete && <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                            {sc.label}
                          </Badge>
                        </div>

                        {/* Title */}
                        <h4 className={`text-sm font-medium leading-snug mb-1 line-clamp-2 ${
                          isComplete ? 'text-green-800 dark:text-green-300' : ''
                        }`}>
                          {item.title}
                        </h4>
                        {item.subCategory && (
                          <p className="text-[11px] text-muted-foreground mb-2">{item.subCategory}</p>
                        )}

                        {/* Period / Year pills */}
                        {hasPeriods && (
                          <div className="mt-2 mb-1">
                            <div className="flex items-center gap-1 mb-1.5">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                Years
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ({receivedPeriods}/{totalPeriods})
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                              <TooltipProvider delayDuration={200}>
                                {periods.map((period) => (
                                  <Tooltip key={period.id}>
                                    <TooltipTrigger asChild>
                                      <button
                                        className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-md transition-colors ${
                                          period.isReceived
                                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                        onClick={() => handleTogglePeriod(period)}
                                      >
                                        {period.isReceived
                                          ? <Check className="h-2.5 w-2.5" />
                                          : <Circle className="h-2.5 w-2.5" />
                                        }
                                        {period.periodLabel}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                      {period.isReceived
                                        ? `Received${period.receivedAt ? ` on ${format(new Date(period.receivedAt), 'MMM d, yyyy')}` : ''}`
                                        : 'Not received — click to mark received'
                                      }
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                              </TooltipProvider>
                            </div>
                          </div>
                        )}

                        {/* Bottom row: metadata */}
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                          {item.dueDate && (
                            <span className={`text-[11px] flex items-center gap-0.5 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                              <Calendar className="h-3 w-3" />
                              {format(new Date(item.dueDate), 'MMM d')}
                            </span>
                          )}
                          {item.fileCount > 0 && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <Paperclip className="h-3 w-3" />{item.fileCount}
                            </span>
                          )}
                          {item.commentCount > 0 && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <MessageSquare className="h-3 w-3" />{item.commentCount}
                            </span>
                          )}
                          <div className="flex-1" />
                          {/* Quick action on hover */}
                          <div className="hidden group-hover:flex items-center" onClick={e => e.stopPropagation()}>
                            {!isComplete && item.status !== 'provided' && (
                              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]"
                                onClick={() => handleStatusChange(item.id, 'provided')}>
                                Mark Provided
                              </Button>
                            )}
                            {item.status === 'provided' && (
                              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-green-600"
                                onClick={() => handleStatusChange(item.id, 'approved')}>
                                Approve
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Green check overlay for completed */}
                        {isComplete && (
                          <div className="absolute top-2 right-2 opacity-10">
                            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Inline add item card */}
                  {addingItemToSection === section.id && (
                    <div className="rounded-xl border border-dashed border-primary/40 p-4 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                      <Input
                        autoFocus
                        placeholder="New item title..."
                        value={newItemTitle}
                        onChange={e => setNewItemTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddItem(section.id); if (e.key === 'Escape') setAddingItemToSection(null); }}
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleAddItem(section.id)} disabled={!newItemTitle.trim()}>Add</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAddingItemToSection(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {/* Add item placeholder card */}
                  {section.items.length === 0 && addingItemToSection !== section.id && (
                    <button
                      className="rounded-xl border border-dashed border-muted-foreground/30 p-4 flex items-center justify-center text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                      onClick={() => { setAddingItemToSection(section.id); setNewItemTitle(''); }}
                    >
                      <Plus className="h-4 w-4 mr-1" />Add item
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sections.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No sections yet. Add a section or create from a template.</p>
          </div>
        )}
      </div>

      {/* Item Drawer */}
      <ItemDrawer
        item={activeItem}
        section={activeSection}
        workspaceId={workspaceId}
        onClose={() => { setActiveItemId(null); setActiveSectionId(null); }}
        onStatusChange={handleStatusChange}
        onUpdate={(itemId, data) => updateItem.mutate({ itemId, workspaceId, ...data })}
        onDelete={(itemId) => { deleteItem.mutate({ itemId, workspaceId }); setActiveItemId(null); }}
        onTogglePeriod={handleTogglePeriod}
      />

      <TemplatePickerDialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        templates={templates}
        selectedIds={selectedTemplateIds}
        onToggle={(id: string) => setSelectedTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
        mergeStrategy={mergeStrategy}
        onMergeChange={setMergeStrategy}
        onConfirm={handleCreateFromTemplate}
        isPending={createFromTemplate.isPending}
        onSeed={handleSeedTemplates}
        isSeedPending={seedTemplates.isPending}
      />

      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Section</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Section title" value={newSectionTitle} onChange={e => setNewSectionTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddSection(); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSectionDialog(false)}>Cancel</Button>
            <Button onClick={handleAddSection} disabled={!newSectionTitle.trim() || createSection.isPending}>Add Section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {checklist && (
        <SettingsDialog
          open={showSettingsDialog}
          onClose={() => setShowSettingsDialog(false)}
          checklist={checklist}
          workspaceId={workspaceId}
          onUpdate={updateSettings}
        />
      )}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TemplatePickerDialog({ open, onClose, templates, selectedIds, onToggle, mergeStrategy, onMergeChange, onConfirm, isPending, onSeed, isSeedPending }: any) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create from Template</DialogTitle>
          <DialogDescription>Select one or more templates to populate your DD checklist.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto">
          {templates.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-sm mb-2">No templates available.</p>
              <Button variant="outline" size="sm" onClick={onSeed} disabled={isSeedPending}>
                {isSeedPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Load Built-in Templates
              </Button>
            </div>
          ) : (
            templates.map((tmpl: any) => (
              <div key={tmpl.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer" onClick={() => onToggle(tmpl.id)}>
                <Checkbox checked={selectedIds.includes(tmpl.id)} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{tmpl.name}</div>
                  <div className="text-xs text-muted-foreground">{tmpl.description} · {tmpl.data?.sections?.reduce((n: number, s: any) => n + (s.items?.length || 0), 0) || '?'} items</div>
                </div>
                {tmpl.isBuiltin && <Badge variant="secondary" className="text-xs">Built-in</Badge>}
              </div>
            ))
          )}
        </div>
        {templates.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">Merge Strategy</Label>
            <Select value={mergeStrategy} onValueChange={onMergeChange}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="replace">Replace existing</SelectItem>
                <SelectItem value="append">Append to existing</SelectItem>
                <SelectItem value="dedupe_by_key">Append (skip duplicates)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm} disabled={selectedIds.length === 0 || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create ({selectedIds.length} selected)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamMemberField({ label, placeholder, value, members, onSelect, onAddNew, isPending }: {
  label: string;
  placeholder: string;
  value: string | null;
  members: DealTeamContact[];
  onSelect: (memberId: string | null) => void;
  onAddNew: (name: string) => void;
  isPending: boolean;
}) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedMember = value ? members.find(m => m.id === value) : null;
  const displayValue = selectedMember
    ? (selectedMember.displayName || selectedMember.email || 'Unknown')
    : '';

  const filtered = inputValue.trim()
    ? members.filter(m =>
        (m.displayName || m.email || '').toLowerCase().includes(inputValue.toLowerCase())
      )
    : members;

  const exactMatch = inputValue.trim() && members.some(m =>
    (m.displayName || m.email || '').toLowerCase() === inputValue.toLowerCase()
  );

  const handleSelect = (memberId: string | null) => {
    onSelect(memberId);
    setInputValue('');
    setIsOpen(false);
  };

  const handleAddNew = () => {
    const name = inputValue.trim();
    if (!name) return;
    onAddNew(name);
    setInputValue('');
    setIsOpen(false);
  };

  const roleLabels: Record<string, string> = {
    seller: 'Seller', buyer: 'Buyer', attorney: 'Attorney', lender: 'Lender',
    broker: 'Broker', inspector: 'Inspector', appraiser: 'Appraiser',
    environmental: 'Env. Consultant', surveyor: 'Surveyor', other: 'Other',
  };

  return (
    <div className="relative">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="relative mt-0.5">
        <Input
          className="h-8 text-xs pr-8"
          placeholder={selectedMember ? displayValue : placeholder}
          value={isOpen ? inputValue : (selectedMember ? displayValue : '')}
          onChange={(e) => { setInputValue(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        />
        {selectedMember && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => { e.preventDefault(); handleSelect(null); }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {selectedMember?.status === 'pending' && (
          <Badge variant="outline" className="absolute right-7 top-1/2 -translate-y-1/2 text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
            Pending
          </Badge>
        )}
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-auto">
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            onMouseDown={(e) => { e.preventDefault(); handleSelect(null); }}
          >
            — Unassigned —
          </button>
          {filtered.map((m) => (
            <button
              key={m.id}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center justify-between ${value === m.id ? 'bg-muted font-medium' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(m.id); }}
            >
              <span className="truncate">{m.displayName || m.email || 'Unknown'}</span>
              <span className="flex items-center gap-1 shrink-0 ml-1">
                {m.status === 'pending' && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>
                )}
                <span className="text-[10px] text-muted-foreground">{roleLabels[m.role] || m.role}</span>
              </span>
            </button>
          ))}
          {inputValue.trim() && !exactMatch && (
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-primary hover:bg-muted flex items-center gap-1.5 border-t border-border"
              onMouseDown={(e) => { e.preventDefault(); handleAddNew(); }}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
              Add "{inputValue.trim()}" to Deal Team
            </button>
          )}
          {filtered.length === 0 && !inputValue.trim() && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No deal team contacts yet</div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemDrawer({ item, section, workspaceId, onClose, onStatusChange, onUpdate, onDelete, onTogglePeriod }: {
  item: DdChecklistItem | null; section: SectionType | null; workspaceId: string;
  onClose: () => void; onStatusChange: (id: string, s: string) => void;
  onUpdate: (id: string, data: any) => void; onDelete: (id: string) => void;
  onTogglePeriod: (period: DdChecklistItemPeriod) => void;
}) {
  const [drawerTab, setDrawerTab] = useState('details');
  const [commentText, setCommentText] = useState('');
  const [commentVisibility, setCommentVisibility] = useState('all');

  const { data: comments = [] } = useItemComments(item?.id);
  const { data: history = [] } = useItemHistory(item?.id);
  const { data: dealTeamContacts = [] } = useDealTeamContacts(workspaceId);
  const { data: dealTeamStats = [] } = useDealTeamStats(workspaceId);
  const postComment = usePostComment();
  const addPeriods = useAddPeriods();
  const deletePeriod = useDeletePeriod();
  const quickAddMember = useQuickAddDealTeamMember();

  if (!item) return null;

  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
  const isComplete = ['approved', 'waived'].includes(item.status);
  const periods = item.periods || [];
  const receivedCount = periods.filter(p => p.isReceived).length;
  const allPeriodsReceived = periods.length > 0 && receivedCount === periods.length;

  const currentYear = new Date().getFullYear();
  const yearOptions = ['T12', ...Array.from({ length: 5 }, (_, i) => String(currentYear - i))];
  const existingLabels = new Set(periods.map(p => p.periodLabel));

  const handleToggleYearCheckbox = (label: string) => {
    if (existingLabels.has(label)) {
      const period = periods.find(p => p.periodLabel === label);
      if (period) deletePeriod.mutate({ periodId: period.id, workspaceId });
    } else {
      addPeriods.mutate({ itemId: item.id, workspaceId, type: label === 'T12' ? 'trailing' : 'year', values: [label] });
    }
  };

  const handleMarkComplete = () => {
    onStatusChange(item.id, 'approved');
  };

  return (
    <Sheet open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-[500px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">{item.title}</SheetTitle>
          <SheetDescription>{section?.title}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Status row + Mark Complete */}
          <div className="flex items-center gap-2">
            <Select value={item.status} onValueChange={(s) => onStatusChange(item.id, s)}>
              <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className={`${PRIORITY_CONFIG[item.priority]?.className}`}>
              P{item.priority}
            </Badge>
            <div className="flex-1" />
            {!isComplete ? (
              <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white" onClick={handleMarkComplete}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Mark Complete
              </Button>
            ) : (
              <Badge className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700">
                <CheckCircle2 className="h-3 w-3 mr-1" />Completed
              </Badge>
            )}
          </div>

          {/* Year/Period tracking section */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Year / Period Tracking
              </span>
              {periods.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {receivedCount}/{periods.length} received
                  {allPeriodsReceived && <Check className="inline h-3 w-3 ml-0.5 text-green-600" />}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2">
              {yearOptions.map((label) => {
                const isSelected = existingLabels.has(label);
                const period = isSelected ? periods.find(p => p.periodLabel === label) : null;
                const isReceived = period?.isReceived ?? false;
                return (
                  <div key={label} className="relative group">
                    <button
                      className={`w-full flex items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-md transition-colors ${
                        isReceived
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                          : isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-500 border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:text-gray-700'
                      }`}
                      disabled={addPeriods.isPending || deletePeriod.isPending}
                      onClick={() => {
                        if (isSelected && period) {
                          onTogglePeriod(period);
                        } else {
                          handleToggleYearCheckbox(label);
                        }
                      }}
                    >
                      {isReceived
                        ? <Check className="h-3 w-3" />
                        : isSelected
                          ? <Circle className="h-3 w-3" />
                          : <Plus className="h-3 w-3 opacity-40" />}
                      {label}
                    </button>
                    {isSelected && (
                      <button
                        className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"
                        onClick={() => handleToggleYearCheckbox(label)}
                        title="Remove period"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {periods.length > 0 && (
              <div className="mt-1 pt-2 border-t border-border/50">
                <Progress value={(receivedCount / periods.length) * 100} className="h-1.5" />
              </div>
            )}
          </div>

          <Tabs value={drawerTab} onValueChange={setDrawerTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
              <TabsTrigger value="comments" className="text-xs">Comments ({item.commentCount})</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-3 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Request</Label>
                <Textarea
                  className="mt-1 text-sm"
                  rows={3}
                  defaultValue={item.requestText || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (item.requestText || '')) {
                      onUpdate(item.id, { requestText: e.target.value });
                    }
                  }}
                  placeholder="Describe what is being requested..."
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  This description is visible to deal team members and sellers when shared.
                </p>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Seller Notes</Label>
                <Textarea
                  className="mt-1 text-sm"
                  rows={3}
                  defaultValue={item.sellerNotes || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (item.sellerNotes || '')) {
                      onUpdate(item.id, { sellerNotes: e.target.value });
                    }
                  }}
                  placeholder="Notes from seller..."
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Internal Notes (not visible to external)</Label>
                <Textarea
                  className="mt-1 text-sm"
                  rows={3}
                  defaultValue={item.internalNotes || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (item.internalNotes || '')) {
                      onUpdate(item.id, { internalNotes: e.target.value });
                    }
                  }}
                  placeholder="Internal team notes..."
                />
              </div>

              {/* Deal Team Members Section */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Deal Team</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <TeamMemberField
                    label="Assigned To"
                    placeholder="Select or type a name..."
                    value={item.assignedToMemberId}
                    members={dealTeamContacts}
                    onSelect={(contactId) => onUpdate(item.id, { assignedToMemberId: contactId })}
                    onAddNew={(name) => quickAddMember.mutate({ workspaceId, fullName: name }, {
                      onSuccess: (data) => {
                        const newId = `pending_${data.pendingContact.id}_other`;
                        onUpdate(item.id, { assignedToMemberId: newId });
                      },
                    })}
                    isPending={quickAddMember.isPending}
                  />
                  <TeamMemberField
                    label="Reviewer"
                    placeholder="Select or type a name..."
                    value={item.reviewerMemberId}
                    members={dealTeamContacts}
                    onSelect={(contactId) => onUpdate(item.id, { reviewerMemberId: contactId })}
                    onAddNew={(name) => quickAddMember.mutate({ workspaceId, fullName: name }, {
                      onSuccess: (data) => {
                        const newId = `pending_${data.pendingContact.id}_other`;
                        onUpdate(item.id, { reviewerMemberId: newId });
                      },
                    })}
                    isPending={quickAddMember.isPending}
                  />
                  <TeamMemberField
                    label="Requested From"
                    placeholder="Select or type a name..."
                    value={item.requestedFromMemberId}
                    members={dealTeamContacts}
                    onSelect={(contactId) => onUpdate(item.id, { requestedFromMemberId: contactId })}
                    onAddNew={(name) => quickAddMember.mutate({ workspaceId, fullName: name }, {
                      onSuccess: (data) => {
                        const newId = `pending_${data.pendingContact.id}_other`;
                        onUpdate(item.id, { requestedFromMemberId: newId });
                      },
                    })}
                    isPending={quickAddMember.isPending}
                  />
                </div>

                {dealTeamContacts.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Type a name to add someone to the Deal Team, or add contacts from the project's Deal Team section.
                  </p>
                )}

                {(() => {
                  const involvedIds = new Set([
                    item.assignedToMemberId,
                    item.reviewerMemberId,
                    item.requestedFromMemberId,
                  ].filter(Boolean) as string[]);
                  if (involvedIds.size === 0) return null;

                  const relevantStats = dealTeamStats.filter(s => involvedIds.has(s.id));
                  if (relevantStats.length === 0) return null;

                  const findName = (id: string) =>
                    dealTeamContacts.find(c => c.id === id)?.displayName || 'Unknown';

                  return (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <BarChart3 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Involvement Stats</span>
                      </div>
                      {relevantStats.map(s => {
                        const totalTasks = s.assignedCount + s.reviewerCount + s.requestedFromCount;
                        const totalCompleted = s.assignedCompleted + s.reviewerCompleted + s.requestedFromCompleted;
                        const completionPct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
                        const roles: string[] = [];
                        if (s.id === item.assignedToMemberId) roles.push('Assignee');
                        if (s.id === item.reviewerMemberId) roles.push('Reviewer');
                        if (s.id === item.requestedFromMemberId) roles.push('Req. From');

                        return (
                          <div key={s.id} className="bg-background border border-border rounded-md p-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-[9px] font-bold text-primary">
                                    {findName(s.id).charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-[11px] font-medium truncate max-w-[120px]">{findName(s.id)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {roles.map(r => (
                                  <Badge key={r} variant="secondary" className="text-[8px] px-1 py-0 h-3.5">{r}</Badge>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${completionPct >= 80 ? 'bg-green-500' : completionPct >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                  style={{ width: `${completionPct}%` }}
                                />
                              </div>
                              <span className="text-[9px] font-mono text-muted-foreground w-7 text-right">{completionPct}%</span>
                            </div>

                            <div className="grid grid-cols-4 gap-1">
                              <div className="text-center">
                                <div className="text-[10px] font-semibold">{s.assignedCount}</div>
                                <div className="text-[8px] text-muted-foreground">Assigned</div>
                              </div>
                              <div className="text-center">
                                <div className="text-[10px] font-semibold">{s.reviewerCount}</div>
                                <div className="text-[8px] text-muted-foreground">Reviews</div>
                              </div>
                              <div className="text-center">
                                <div className="text-[10px] font-semibold">{s.requestedFromCount}</div>
                                <div className="text-[8px] text-muted-foreground">Requests</div>
                              </div>
                              <div className="text-center">
                                <div className={`text-[10px] font-semibold ${s.overdueCount > 0 ? 'text-red-600' : ''}`}>{s.overdueCount}</div>
                                <div className="text-[8px] text-muted-foreground">Overdue</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Due Date</Label>
                  <Input
                    type="date"
                    className="h-8 text-sm mt-1"
                    defaultValue={item.dueDate || ''}
                    onBlur={(e) => onUpdate(item.id, { dueDate: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Anchor + Offset</Label>
                  <div className="flex gap-1 mt-1">
                    <Select
                      value={item.milestoneAnchor || 'none'}
                      onValueChange={(v) => onUpdate(item.id, { milestoneAnchor: v === 'none' ? null : v })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="dd_start">DD Start</SelectItem>
                        <SelectItem value="dd_expiration">DD Exp</SelectItem>
                        <SelectItem value="closing">Closing</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="h-8 w-16 text-xs"
                      defaultValue={item.dueOffsetDays ?? ''}
                      placeholder="days"
                      onBlur={(e) => onUpdate(item.id, { dueOffsetDays: e.target.value ? parseInt(e.target.value) : null })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />Linked Files ({item.fileCount})
                </Label>
                <p className="text-xs text-muted-foreground mt-1">File linking available via VDR integration.</p>
              </div>

              <Button variant="destructive" size="sm" className="mt-4"
                onClick={() => { if (confirm('Delete this item?')) onDelete(item.id); }}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />Delete Item
              </Button>
            </TabsContent>

            <TabsContent value="comments" className="mt-3 space-y-3">
              {comments.map((c: any) => (
                <div key={c.id} className="border rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={c.visibility === 'internal' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {c.visibility}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(c.createdAt), 'MMM d, h:mm a')}</span>
                  </div>
                  <p className="text-sm">{c.body}</p>
                </div>
              ))}
              {comments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>}

              <div className="flex gap-2">
                <Input
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && commentText.trim()) {
                      postComment.mutate({ itemId: item.id, body: commentText, visibility: commentVisibility });
                      setCommentText('');
                    }
                  }}
                  className="h-8 text-sm"
                />
                <Select value={commentVisibility} onValueChange={setCommentVisibility}>
                  <SelectTrigger className="h-8 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-3 space-y-2">
              {history.map((h: any) => (
                <div key={h.id} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground whitespace-nowrap">{format(new Date(h.createdAt), 'MMM d, h:mm a')}</span>
                  <span className="font-medium capitalize">{h.action?.replace(/_/g, ' ')}</span>
                  {h.meta?.oldStatus && <span className="text-muted-foreground">→ {h.meta.newStatus}</span>}
                </div>
              ))}
              {history.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No history yet.</p>}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SettingsDialog({ open, onClose, checklist, workspaceId, onUpdate }: any) {
  const [settings, setSettings] = useState({
    sellerCanMarkProvided: checklist.sellerCanMarkProvided,
    sellerCanChangeStatus: checklist.sellerCanChangeStatus,
    requireReviewerApproval: checklist.requireReviewerApproval,
    autoProvidedOnUpload: checklist.autoProvidedOnUpload,
    autoReminders: checklist.autoReminders,
    lockAfterClosing: checklist.lockAfterClosing,
    caRequiredForChecklist: checklist.caRequiredForChecklist,
  });

  const handleSave = () => {
    onUpdate.mutate({ checklistId: checklist.id, workspaceId, ...settings });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Checklist Settings</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {[
            { key: 'sellerCanMarkProvided', label: 'Seller can mark items Provided' },
            { key: 'sellerCanChangeStatus', label: 'Seller can change status (limited)' },
            { key: 'requireReviewerApproval', label: 'Require reviewer approval before Approved' },
            { key: 'autoProvidedOnUpload', label: 'Auto-set Provided when file uploaded' },
            { key: 'autoReminders', label: 'Enable auto-reminders' },
            { key: 'lockAfterClosing', label: 'Lock checklist after closing' },
            { key: 'caRequiredForChecklist', label: 'Require CA before viewing checklist' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <Checkbox
                checked={(settings as any)[key]}
                onCheckedChange={(v) => setSettings(prev => ({ ...prev, [key]: !!v }))}
              />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
