/**
 * CrmRecordPage — Upgraded institutional-grade CRM record layout
 * 
 * Three-column layout inspired by Salesforce/HubSpot/Pipedrive:
 *   Left  (~280px): "About" properties sidebar with field groups
 *   Center (flex):   Activity timeline spine + tabbed content area
 *   Right  (~300px): Associations cards, attachments, quick links
 *
 * Features:
 *   - Highlights header with name, status chips, KPI metrics, next activity
 *   - Preview drawer for cross-record navigation
 *   - Activity timeline as the operational spine
 *   - Inline editing support for About fields
 *   - Responsive: collapses to single column on mobile
 */
import { useState, useCallback, createContext, useContext, type ComponentType, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeft, ExternalLink, MoreHorizontal, Phone, Mail, Plus,
  Building2, User, MapPin, DollarSign, Calendar, Edit2, Check, X,
  Activity, ChevronRight, Clock, ArrowUpRight, Pencil,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { FocusHistoryTimeline } from './FocusHistoryTimeline';
import { CrmActionComposerModal } from './CrmActionComposerModal';
import UnifiedTimeline from './unified-timeline';
import { PreviewDrawer } from './PreviewDrawer';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────

type EntityType = 'company' | 'contact' | 'property' | 'deal';

interface KpiChip {
  label: string;
  value: string | number;
  icon?: ComponentType<any>;
  color?: string;
  tooltip?: string;
}

interface NextActivity {
  id: string;
  type: string;
  subject: string;
  scheduledAt: string;
}

interface CrmRecordPageProps {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  entitySubtitle?: string;
  entityAvatar?: ReactNode;
  status?: string;
  statusColor?: string;
  owner?: { id: string; name: string } | null;
  isLoading?: boolean;

  kpiChips?: KpiChip[];
  nextActivity?: NextActivity | null;

  onBack?: () => void;
  backUrl?: string;
  headerActions?: ReactNode;

  aboutSidebar?: ReactNode;
  centerTabs?: Array<{ value: string; label: string; content: ReactNode; count?: number }>;
  rightSidebar?: ReactNode;

  // Legacy slots (still supported for backward compat)
  overviewLeft?: ReactNode;
  overviewRight?: ReactNode;
  associationsContent?: ReactNode;
  notesContent?: ReactNode;
  filesContent?: ReactNode;
  analyticsContent?: ReactNode;
  customTabs?: { value: string; label: string; content: ReactNode }[];
}

// ── Context for Preview Drawer ─────────────────────────────

interface PreviewState {
  type: EntityType;
  id: string;
}

interface RecordPageContext {
  openPreview: (type: EntityType, id: string) => void;
  navigateTo: (url: string) => void;
}

const RecordPageCtx = createContext<RecordPageContext>({
  openPreview: () => {},
  navigateTo: () => {},
});

export const useRecordPage = () => useContext(RecordPageCtx);

// ── Entity Config ──────────────────────────────────────────

const entityTypeConfig = {
  company: { icon: Building2, label: 'Company', backLabel: 'Companies', backUrl: '/crm/companies', color: 'bg-emerald-500' },
  contact: { icon: User, label: 'Contact', backLabel: 'Contacts', backUrl: '/crm/contacts', color: 'bg-blue-500' },
  property: { icon: MapPin, label: 'Property', backLabel: 'Properties', backUrl: '/crm/properties', color: 'bg-amber-500' },
  deal: { icon: DollarSign, label: 'Deal', backLabel: 'Deals', backUrl: '/crm/deals', color: 'bg-purple-500' },
};

// ── Main Component ─────────────────────────────────────────

export function CrmRecordPage({
  entityType,
  entityId,
  entityName,
  entitySubtitle,
  entityAvatar,
  status,
  statusColor = 'bg-gray-100 text-gray-700',
  owner,
  isLoading,
  kpiChips,
  nextActivity,
  onBack,
  backUrl,
  headerActions,
  aboutSidebar,
  centerTabs,
  rightSidebar,
  // Legacy slots
  overviewLeft,
  overviewRight,
  associationsContent,
  notesContent,
  filesContent,
  analyticsContent,
  customTabs,
}: CrmRecordPageProps) {
  const [, setLocation] = useLocation();
  const [showComposer, setShowComposer] = useState(false);
  const [composerDefaultTab, setComposerDefaultTab] = useState<'note' | 'activity'>('activity');
  const [activeTab, setActiveTab] = useState('timeline');
  const [previewEntity, setPreviewEntity] = useState<PreviewState | null>(null);

  const config = entityTypeConfig[entityType];
  const EntityIcon = config.icon;

  // Determine if we're using the new 3-column layout or legacy
  const isNewLayout = !!aboutSidebar;

  const handleBack = () => {
    if (onBack) onBack();
    else if (backUrl) setLocation(backUrl);
    else setLocation(config.backUrl);
  };

  const openComposer = (tab: 'note' | 'activity') => {
    setComposerDefaultTab(tab);
    setShowComposer(true);
  };

  const openPreview = useCallback((type: EntityType, id: string) => {
    setPreviewEntity({ type, id });
  }, []);

  const navigateTo = useCallback((url: string) => {
    setLocation(url);
  }, [setLocation]);

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="border-b bg-white dark:bg-gray-900">
          <div className="max-w-[1600px] mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <div className="max-w-[1600px] mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <RecordPageCtx.Provider value={{ openPreview, navigateTo }}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* ── Highlights Header ── */}
        <div className="sticky top-0 z-20 border-b bg-white dark:bg-gray-900 shadow-sm">
          <div className="max-w-[1600px] mx-auto px-4">
            {/* Top row: back + name + actions */}
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="gap-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">{config.backLabel}</span>
                </Button>

                <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

                <div className="flex items-center gap-3 min-w-0">
                  {entityAvatar || (
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0", config.color, "bg-opacity-10 dark:bg-opacity-20")}>
                      <EntityIcon className="h-4.5 w-4.5 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate max-w-[300px]">
                        {entityName}
                      </h1>
                      {status && (
                        <Badge variant="secondary" className={cn("text-[10px] flex-shrink-0", statusColor)}>
                          {status}
                        </Badge>
                      )}
                    </div>
                    {entitySubtitle && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[400px]">
                        {entitySubtitle}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {owner && (
                  <div className="hidden md:flex items-center gap-1.5 mr-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Owner</span>
                    <Badge variant="outline" className="font-normal text-xs">{owner.name}</Badge>
                  </div>
                )}

                <Button size="sm" variant="outline" onClick={() => openComposer('note')} className="gap-1 h-7 text-xs">
                  <Plus className="h-3 w-3" /> Note
                </Button>
                <Button size="sm" onClick={() => openComposer('activity')} className="gap-1 h-7 text-xs">
                  <Plus className="h-3 w-3" /> Activity
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem><Phone className="h-4 w-4 mr-2" />Log Call</DropdownMenuItem>
                    <DropdownMenuItem><Mail className="h-4 w-4 mr-2" />Send Email</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem><ExternalLink className="h-4 w-4 mr-2" />Open in New Tab</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {headerActions}
              </div>
            </div>

            {/* Bottom row: KPI chips + next activity */}
            {(kpiChips?.length || nextActivity) && (
              <div className="flex items-center gap-3 pb-2.5 overflow-x-auto scrollbar-hide">
                {kpiChips?.map((chip, i) => {
                  const ChipIcon = chip.icon;
                  return (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap",
                          chip.color || "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                        )}>
                          {ChipIcon && <ChipIcon className="h-3 w-3" />}
                          <span className="text-gray-500 dark:text-gray-400">{chip.label}</span>
                          <span>{chip.value}</span>
                        </div>
                      </TooltipTrigger>
                      {chip.tooltip && <TooltipContent>{chip.tooltip}</TooltipContent>}
                    </Tooltip>
                  );
                })}

                {nextActivity && (
                  <>
                    <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                      <Clock className="h-3 w-3" />
                      <span>Next:</span>
                      <span className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">
                        {nextActivity.subject}
                      </span>
                      <span className="text-gray-400">·</span>
                      <span>{formatRelativeDate(nextActivity.scheduledAt)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Body: Three-Column Layout ── */}
        {isNewLayout ? (
          <div className="max-w-[1600px] mx-auto px-4 py-5">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-5">
              {/* Left: About Sidebar */}
              <aside className="space-y-4 order-2 lg:order-1">
                {aboutSidebar}
              </aside>

              {/* Center: Timeline + Tabs */}
              <main className="space-y-4 order-1 lg:order-2 min-w-0">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-white dark:bg-gray-900 border w-full justify-start overflow-x-auto">
                    <TabsTrigger value="timeline" className="gap-1.5">
                      <Activity className="h-3 w-3" />
                      Timeline
                    </TabsTrigger>
                    {centerTabs?.map(tab => (
                      <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                        {tab.label}
                        {tab.count != null && tab.count > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">{tab.count}</Badge>
                        )}
                      </TabsTrigger>
                    ))}
                    {/* Legacy compat tabs */}
                    {notesContent && <TabsTrigger value="notes">Notes</TabsTrigger>}
                    {filesContent && <TabsTrigger value="files">Files</TabsTrigger>}
                    {analyticsContent && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
                    {customTabs?.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
                  </TabsList>

                  <TabsContent value="timeline" className="mt-4">
                    <Card className="shadow-sm">
                      <CardContent className="p-4">
                        <UnifiedTimeline
                          entityType={entityType}
                          entityId={entityId}
                          maxHeight="600px"
                          showHeader={false}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {centerTabs?.map(tab => (
                    <TabsContent key={tab.value} value={tab.value} className="mt-4">
                      {tab.content}
                    </TabsContent>
                  ))}

                  {/* Legacy compat */}
                  {notesContent && <TabsContent value="notes" className="mt-4">{notesContent}</TabsContent>}
                  {filesContent && <TabsContent value="files" className="mt-4">{filesContent}</TabsContent>}
                  {analyticsContent && <TabsContent value="analytics" className="mt-4">{analyticsContent}</TabsContent>}
                  {customTabs?.map(t => <TabsContent key={t.value} value={t.value} className="mt-4">{t.content}</TabsContent>)}
                </Tabs>
              </main>

              {/* Right: Associations Sidebar */}
              <aside className="space-y-4 order-3">
                {rightSidebar}
              </aside>
            </div>
          </div>
        ) : (
          /* ── Legacy 2-column layout (backward compat) ── */
          <div className="max-w-7xl mx-auto px-4 py-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-white dark:bg-gray-800 border">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                {notesContent && <TabsTrigger value="notes">Notes</TabsTrigger>}
                {filesContent && <TabsTrigger value="files">Files</TabsTrigger>}
                {associationsContent && <TabsTrigger value="associations">Associations</TabsTrigger>}
                {analyticsContent && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
                {customTabs?.map(tab => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}
              </TabsList>

              <TabsContent value="overview" className="space-y-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">{overviewLeft}</div>
                  <div className="space-y-6">
                    {overviewRight || (
                      <FocusHistoryTimeline entityType={entityType} entityId={entityId} entityName={entityName} />
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="timeline">
                <Card><CardContent className="p-6">
                  <UnifiedTimeline entityType={entityType} entityId={entityId} maxHeight="600px" showHeader={false} />
                </CardContent></Card>
              </TabsContent>

              {notesContent && <TabsContent value="notes">{notesContent}</TabsContent>}
              {filesContent && <TabsContent value="files">{filesContent}</TabsContent>}
              {associationsContent && <TabsContent value="associations">{associationsContent}</TabsContent>}
              {analyticsContent && <TabsContent value="analytics">{analyticsContent}</TabsContent>}
              {customTabs?.map(tab => <TabsContent key={tab.value} value={tab.value}>{tab.content}</TabsContent>)}
            </Tabs>
          </div>
        )}

        {/* ── Composer Modal ── */}
        <CrmActionComposerModal
          open={showComposer}
          onOpenChange={setShowComposer}
          context={{ entityType, entityId, entityName }}
          defaultTab={composerDefaultTab}
        />

        {/* ── Preview Drawer ── */}
        {previewEntity && (
          <PreviewDrawer
            open={!!previewEntity}
            onOpenChange={(open) => !open && setPreviewEntity(null)}
            entityType={previewEntity.type}
            entityId={previewEntity.id}
          />
        )}
      </div>
    </RecordPageCtx.Provider>
  );
}

// ── Reusable Sub-components ────────────────────────────────

/** About sidebar field group card */
export function RecordFieldGroup({
  title,
  icon: Icon,
  onEdit,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  icon?: ComponentType<any>;
  onEdit?: () => void;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-4 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-3.5 w-3.5 text-gray-400" />}
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
                <Pencil className="h-3 w-3 text-gray-400" />
              </Button>
            )}
            {collapsible && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsOpen(!isOpen)}
              >
                <ChevronRight className={cn("h-3 w-3 text-gray-400 transition-transform", isOpen && "rotate-90")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="px-4 pb-3 space-y-2">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

/** Individual field row in About sidebar */
export function RecordField({
  label,
  value,
  icon: Icon,
  href,
  emptyText = '—',
  editable,
  onEdit,
}: {
  label: string;
  value: ReactNode;
  icon?: ComponentType<any>;
  href?: string;
  emptyText?: string;
  editable?: boolean;
  onEdit?: (currentValue: any) => void;
}) {
  const content = value || emptyText;
  const isEmpty = !value;

  return (
    <div className="flex items-start gap-2.5 group min-h-[28px]">
      {Icon && <Icon className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider leading-tight">{label}</p>
        {href && value ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block leading-snug">
            {content}
          </a>
        ) : (
          <p className={cn("text-sm leading-snug truncate", isEmpty ? "text-gray-400 italic" : "text-gray-900 dark:text-white")}>
            {content}
          </p>
        )}
      </div>
      {editable && onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={() => onEdit(value)}
        >
          <Edit2 className="h-3 w-3 text-gray-400" />
        </Button>
      )}
    </div>
  );
}

/** Association card for the right sidebar */
export function AssociationCard({
  type,
  icon: Icon,
  items,
  onViewAll,
  onAdd,
  renderItem,
  emptyMessage,
}: {
  type: string;
  icon?: ComponentType<any>;
  items: any[];
  onViewAll?: () => void;
  onAdd?: () => void;
  renderItem: (item: any, index: number) => ReactNode;
  emptyMessage?: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 px-4 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-3.5 w-3.5 text-gray-400" />}
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">{type}</CardTitle>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{items.length}</Badge>
          </div>
          <div className="flex items-center gap-1">
            {items.length > 3 && onViewAll && (
              <Button variant="ghost" size="sm" onClick={onViewAll} className="h-6 text-[10px] px-2">
                View all
              </Button>
            )}
            {onAdd && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAdd}>
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-1">
        {items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3 italic">
            {emptyMessage || `No ${type.toLowerCase()} linked`}
          </p>
        ) : (
          items.slice(0, 5).map((item, i) => renderItem(item, i))
        )}
      </CardContent>
    </Card>
  );
}

/** Clickable association row that opens preview drawer */
export function AssociationRow({
  entityType,
  entityId,
  name,
  subtitle,
  badge,
  badgeColor,
  avatarInitials,
  onClick,
}: {
  entityType: EntityType;
  entityId: string;
  name: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  avatarInitials?: string;
  onClick?: () => void;
}) {
  const { openPreview, navigateTo } = useRecordPage();
  const targetUrl = entityType === 'contact' ? `/crm/contacts/${entityId}`
    : entityType === 'company' ? `/crm/companies/${entityId}`
    : entityType === 'property' ? `/crm/properties/${entityId}`
    : `/crm/deals/${entityId}`;

  return (
    <div className="flex items-center gap-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50 px-1 -mx-1 group cursor-pointer transition-colors">
      <button
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
        onClick={() => openPreview(entityType, entityId)}
      >
        {avatarInitials && (
          <div className="h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">{avatarInitials}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 dark:text-white truncate leading-tight">{name}</p>
          {subtitle && <p className="text-[10px] text-gray-500 truncate leading-tight">{subtitle}</p>}
        </div>
        {badge && (
          <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 flex-shrink-0", badgeColor)}>
            {badge}
          </Badge>
        )}
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          navigateTo(targetUrl);
        }}
      >
        <ArrowUpRight className="h-3 w-3 text-gray-400" />
      </Button>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) {
      const ago = Math.abs(diffMins);
      if (ago < 60) return `${ago}m ago`;
      if (ago < 1440) return `${Math.floor(ago / 60)}h ago`;
      return `${Math.floor(ago / 1440)}d ago`;
    }

    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffMins < 1440) return `in ${Math.floor(diffMins / 60)}h`;
    if (diffMins < 10080) return `in ${Math.floor(diffMins / 1440)}d`;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  } catch {
    return dateStr;
  }
}

export default CrmRecordPage;
