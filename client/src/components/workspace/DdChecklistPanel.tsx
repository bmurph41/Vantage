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
  usePostComment, useItemHistory, useUpdateChecklistSettings,
  DdChecklistItem, DdChecklistSection as SectionType,
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
  AlertCircle, Calendar, CheckCircle2, ChevronDown, ChevronRight, ClipboardList,
  Download, FileText, Loader2, MessageSquare, MoreVertical, Paperclip, Plus,
  Settings, Shield, X,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: 'Open', bg: 'bg-gray-100', text: 'text-gray-700' },
  requested: { label: 'Requested', bg: 'bg-blue-50', text: 'text-blue-700' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-700' },
  provided: { label: 'Provided', bg: 'bg-amber-100', text: 'text-amber-700' },
  reviewing: { label: 'Reviewing', bg: 'bg-purple-100', text: 'text-purple-700' },
  approved: { label: 'Approved', bg: 'bg-green-100', text: 'text-green-700' },
  rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-700' },
  waived: { label: 'Waived', bg: 'bg-gray-100', text: 'text-gray-500' },
  blocked: { label: 'Blocked', bg: 'bg-red-50', text: 'text-red-600' },
};

const PRIORITY_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: 'High', className: 'bg-red-100 text-red-700' },
  2: { label: 'Med', className: 'bg-amber-100 text-amber-700' },
  3: { label: 'Low', className: 'bg-gray-100 text-gray-500' },
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

  // UI State
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [mergeStrategy, setMergeStrategy] = useState<string>('replace');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [activeItem, setActiveItem] = useState<DdChecklistItem | null>(null);
  const [activeSection, setActiveSection] = useState<SectionType | null>(null);
  const [addingItemToSection, setAddingItemToSection] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');

  // ─── Derived ─────────────────────────────────────────────────────────────

  const checklist = data?.checklist;
  const sections = data?.sections || [];
  const stats = data?.stats;
  const hasChecklist = !!checklist;
  const approvedPct = stats && stats.total > 0 ? (stats.approved / stats.total) * 100 : 0;

  // ─── Handlers ────────────────────────────────────────────────────────────

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

  // ─── Loading / Empty states ──────────────────────────────────────────────

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error) return <div className="text-red-500 p-4">Failed to load checklist</div>;

  // ─── No checklist yet ────────────────────────────────────────────────────

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

          {/* Template Dialog */}
          <TemplatePickerDialog
            open={showTemplateDialog}
            onClose={() => setShowTemplateDialog(false)}
            templates={templates}
            selectedIds={selectedTemplateIds}
            onToggle={(id) => setSelectedTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
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

  // ─── Main checklist UI ───────────────────────────────────────────────────

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {checklist.name}
                <Badge variant="secondary" className="text-xs">{stats?.total || 0} items</Badge>
              </CardTitle>
              <CardDescription>
                {stats?.approved || 0} approved · {stats?.overdue || 0} overdue · {stats?.blocked || 0} blocked
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowTemplateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />Template
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddSectionDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />Section
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportChecklist.mutate({ workspaceId, format: 'excel' })}>
                <Download className="h-4 w-4 mr-1" />Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportChecklist.mutate({ workspaceId, format: 'pdf' })}>
                <Download className="h-4 w-4 mr-1" />PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSettingsDialog(true)}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{Math.round(approvedPct)}% Approved</span>
              <div className="flex gap-2 text-xs text-muted-foreground">
                {['open', 'in_progress', 'provided', 'approved', 'blocked'].map(s => (
                  <span key={s} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s]?.bg || ''}`} />
                    {stats?.[s as keyof typeof stats] || 0} {STATUS_CONFIG[s]?.label}
                  </span>
                ))}
              </div>
            </div>
            <Progress value={approvedPct} className="h-2" />
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {sections.map((section) => {
              const isCollapsed = collapsedSections.has(section.id);
              const sectionApproved = section.items.filter(i => i.status === 'approved').length;
              const sectionTotal = section.items.length;
              const sectionOverdue = section.items.filter(i => i.dueDate && new Date(i.dueDate) < new Date() && !['approved', 'waived'].includes(i.status)).length;

              return (
                <div key={section.id} className="border rounded-lg">
                  {/* Section header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleSection(section.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-semibold text-sm">{section.title}</span>
                      <Badge variant="secondary" className="text-xs">{sectionApproved}/{sectionTotal}</Badge>
                      {sectionOverdue > 0 && <Badge variant="destructive" className="text-xs">{sectionOverdue} overdue</Badge>}
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
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

                  {/* Items */}
                  {!isCollapsed && (
                    <div className="px-2 pb-2">
                      {section.items.map((item) => {
                        const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
                        const pc = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG[2];
                        const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && !['approved', 'waived'].includes(item.status);

                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-muted/50 group cursor-pointer"
                            onClick={() => { setActiveItem(item); setActiveSection(section); }}
                          >
                            {/* Priority */}
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${pc.className}`}>{pc.label}</Badge>

                            {/* Title */}
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm ${item.status === 'approved' ? 'line-through text-muted-foreground' : ''}`}>
                                {item.title}
                              </span>
                              {item.subCategory && <span className="text-xs text-muted-foreground ml-2">({item.subCategory})</span>}
                            </div>

                            {/* Due date */}
                            {item.dueDate && (
                              <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                {format(new Date(item.dueDate), 'MMM d')}
                              </span>
                            )}

                            {/* Badges */}
                            {item.fileCount > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Paperclip className="h-3 w-3" />{item.fileCount}
                              </span>
                            )}
                            {item.commentCount > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <MessageSquare className="h-3 w-3" />{item.commentCount}
                              </span>
                            )}

                            {/* Status pill */}
                            <Badge variant="outline" className={`text-[10px] ${sc.bg} ${sc.text}`}>{sc.label}</Badge>

                            {/* Quick actions */}
                            <div className="hidden group-hover:flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              {item.status !== 'provided' && (
                                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs"
                                  onClick={() => handleStatusChange(item.id, 'provided')}>
                                  Mark Provided
                                </Button>
                              )}
                              {item.status === 'provided' && (
                                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-green-600"
                                  onClick={() => handleStatusChange(item.id, 'approved')}>
                                  Approve
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Inline add item */}
                      {addingItemToSection === section.id && (
                        <div className="flex items-center gap-2 px-3 py-2" onClick={e => e.stopPropagation()}>
                          <Input
                            autoFocus
                            placeholder="New item title..."
                            value={newItemTitle}
                            onChange={e => setNewItemTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddItem(section.id); if (e.key === 'Escape') setAddingItemToSection(null); }}
                            className="h-8 text-sm"
                          />
                          <Button size="sm" className="h-8" onClick={() => handleAddItem(section.id)} disabled={!newItemTitle.trim()}>Add</Button>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => setAddingItemToSection(null)}>Cancel</Button>
                        </div>
                      )}

                      {section.items.length === 0 && addingItemToSection !== section.id && (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          No items. <button className="underline" onClick={() => { setAddingItemToSection(section.id); setNewItemTitle(''); }}>Add one</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sections.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No sections yet. Add a section or create from a template.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ ITEM DRAWER ═══ */}
      <ItemDrawer
        item={activeItem}
        section={activeSection}
        workspaceId={workspaceId}
        onClose={() => { setActiveItem(null); setActiveSection(null); }}
        onStatusChange={handleStatusChange}
        onUpdate={(itemId, data) => updateItem.mutate({ itemId, workspaceId, ...data })}
        onDelete={(itemId) => { deleteItem.mutate({ itemId, workspaceId }); setActiveItem(null); }}
      />

      {/* ═══ TEMPLATE DIALOG ═══ */}
      <TemplatePickerDialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        templates={templates}
        selectedIds={selectedTemplateIds}
        onToggle={(id) => setSelectedTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
        mergeStrategy={mergeStrategy}
        onMergeChange={setMergeStrategy}
        onConfirm={handleCreateFromTemplate}
        isPending={createFromTemplate.isPending}
        onSeed={handleSeedTemplates}
        isSeedPending={seedTemplates.isPending}
      />

      {/* ═══ ADD SECTION DIALOG ═══ */}
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

      {/* ═══ SETTINGS DIALOG ═══ */}
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
                  <div className="text-xs text-muted-foreground">{tmpl.assetClass.replace(/_/g, ' ')} · v{tmpl.version}</div>
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

function ItemDrawer({ item, section, workspaceId, onClose, onStatusChange, onUpdate, onDelete }: {
  item: DdChecklistItem | null; section: SectionType | null; workspaceId: string;
  onClose: () => void; onStatusChange: (id: string, s: string) => void;
  onUpdate: (id: string, data: any) => void; onDelete: (id: string) => void;
}) {
  const [drawerTab, setDrawerTab] = useState('details');
  const [editSellerNotes, setEditSellerNotes] = useState('');
  const [editInternalNotes, setEditInternalNotes] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentVisibility, setCommentVisibility] = useState('all');

  const { data: comments = [] } = useItemComments(item?.id);
  const { data: history = [] } = useItemHistory(item?.id);
  const postComment = usePostComment();

  if (!item) return null;

  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;

  return (
    <Sheet open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-[500px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">{item.title}</SheetTitle>
          <SheetDescription>{section?.title}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Status + Priority row */}
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
            {item.dueDate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />{format(new Date(item.dueDate), 'MMM d, yyyy')}
              </span>
            )}
          </div>

          <Tabs value={drawerTab} onValueChange={setDrawerTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
              <TabsTrigger value="comments" className="text-xs">Comments ({item.commentCount})</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
            </TabsList>

            {/* ─── Details ─── */}
            <TabsContent value="details" className="mt-3 space-y-4">
              {/* Request Text */}
              {item.requestText && (
                <div>
                  <Label className="text-xs text-muted-foreground">Request</Label>
                  <p className="text-sm mt-1">{item.requestText}</p>
                </div>
              )}

              {/* Seller Notes */}
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

              {/* Internal Notes */}
              {item.internalNotes !== undefined && (
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
              )}

              {/* Deadline controls */}
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

              {/* Files */}
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />Linked Files ({item.fileCount})
                </Label>
                <p className="text-xs text-muted-foreground mt-1">File linking available via VDR integration.</p>
              </div>

              {/* Delete */}
              <Button variant="destructive" size="sm" className="mt-4"
                onClick={() => { if (confirm('Delete this item?')) onDelete(item.id); }}>
                Delete Item
              </Button>
            </TabsContent>

            {/* ─── Comments ─── */}
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

            {/* ─── History ─── */}
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
