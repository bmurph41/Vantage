import { useState } from "react";
import { Link } from "wouter";
import { ChevronRight, Mail, Phone, Building, Calendar, Search, SlidersHorizontal, X, ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { Contact, Company, Deal, PipelineStage } from "@shared/schema";

type ContactWithCompany = Contact & { company?: Company | null; deal?: Deal | null };
type DealWithRelations = Deal & { contact?: Contact | null; company?: Company | null };

// ── Shared EntityCard ────────────────────────────────────────────────

type EntityCardProps = {
  href?: string;
  onClick?: () => void;
  avatarContent: React.ReactNode;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
};

export function EntityCard({ href, onClick, avatarContent, title, subtitle, meta, rightContent, className }: EntityCardProps) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-accent/40 active:bg-accent/60 border-b border-border last:border-b-0 touch-manipulation cursor-pointer",
        className
      )}
      style={{ minHeight: 64 }}
      onClick={!href ? onClick : undefined}
    >
      <div className="flex-shrink-0">{avatarContent}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>}
          </div>
          {rightContent && <div className="flex-shrink-0">{rightContent}</div>}
        </div>
        {meta && <div className="mt-1">{meta}</div>}
      </div>
      {href && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return inner;
}

// ── Mobile sticky search + filter bar ───────────────────────────────

type MobileSearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onFilterOpen?: () => void;
  hasActiveFilters?: boolean;
};

export function MobileSearchBar({ value, onChange, placeholder = "Search…", onFilterOpen, hasActiveFilters }: MobileSearchBarProps) {
  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border px-3 py-2 flex items-center gap-2 md:hidden">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-8 h-9 text-sm"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {onFilterOpen && (
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 px-3 gap-1.5 flex-shrink-0", hasActiveFilters && "border-primary text-primary")}
          onClick={onFilterOpen}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </Button>
      )}
    </div>
  );
}

// ── Skeleton rows ────────────────────────────────────────────────────

function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse" style={{ minHeight: 64 }}>
          <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyCards({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ── Mobile Contact Cards ─────────────────────────────────────────────

export function MobileContactCards({
  contacts,
  isLoading,
  onCardClick,
}: {
  contacts: ContactWithCompany[];
  isLoading: boolean;
  onCardClick?: (contact: ContactWithCompany) => void;
}) {
  if (isLoading) return <SkeletonCards />;
  if (contacts.length === 0) return <EmptyCards message="No contacts found" />;

  return (
    <div className="divide-y divide-border bg-background">
      {contacts.map((contact) => {
        const initials = `${contact.firstName?.[0] || ""}${contact.lastName?.[0] || ""}`.toUpperCase() || "?";
        const displayName = `${contact.firstName} ${contact.lastName}`.trim();
        const subLine = contact.position || contact.company?.name || contact.role || undefined;
        return (
          <EntityCard
            key={contact.id}
            href={`/crm/contacts/${contact.id}`}
            onClick={() => onCardClick?.(contact)}
            avatarContent={
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                {initials}
              </div>
            }
            title={displayName}
            subtitle={subLine}
            rightContent={
              contact.contactTag ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {contact.contactTag}
                </Badge>
              ) : undefined
            }
            meta={
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {contact.email && (
                  <span className="flex items-center gap-1 truncate max-w-[160px]">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{contact.email}</span>
                  </span>
                )}
                {contact.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 flex-shrink-0" />
                    {contact.phone}
                  </span>
                )}
              </div>
            }
          />
        );
      })}
    </div>
  );
}

// ── Mobile Company Cards ─────────────────────────────────────────────

export function MobileCompanyCards({
  companies,
  isLoading,
  onCardClick,
}: {
  companies: Company[];
  isLoading: boolean;
  onCardClick?: (company: Company) => void;
}) {
  if (isLoading) return <SkeletonCards />;
  if (companies.length === 0) return <EmptyCards message="No companies found" />;

  return (
    <div className="divide-y divide-border bg-background">
      {companies.map((company) => {
        const initials = company.name?.slice(0, 2).toUpperCase() || "CO";
        const location = [company.city, company.state].filter(Boolean).join(", ");
        const sub = company.industry
          ? company.industry.replace(/_/g, " ")
          : location || undefined;
        return (
          <EntityCard
            key={company.id}
            href={`/crm/companies/${company.id}`}
            onClick={() => onCardClick?.(company)}
            avatarContent={
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-semibold">
                {initials}
              </div>
            }
            title={company.name}
            subtitle={sub}
            rightContent={
              company.companyType ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                  {company.companyType.replace(/_/g, " ")}
                </Badge>
              ) : undefined
            }
            meta={
              location && company.industry ? (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Building className="w-3 h-3 flex-shrink-0" />
                  {location}
                </span>
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}

// ── Mobile Deal Cards (for deals.tsx) ───────────────────────────────

export function MobileDealCards({
  deals,
  isLoading,
  stages,
  onCardClick,
}: {
  deals: DealWithRelations[];
  isLoading: boolean;
  stages: PipelineStage[];
  onCardClick?: (deal: DealWithRelations) => void;
}) {
  if (isLoading) return <SkeletonCards />;
  if (deals.length === 0) return <EmptyCards message="No deals found" />;

  return (
    <div className="divide-y divide-border bg-background">
      {deals.map((deal) => {
        const stageInfo = stages.find((s) => s.id === deal.stageId || s.name === deal.stage);
        const initials = deal.title.slice(0, 2).toUpperCase();
        const sub = deal.company?.name || (deal.contact ? `${deal.contact.firstName || ""} ${deal.contact.lastName || ""}`.trim() : undefined);
        return (
          <EntityCard
            key={deal.id}
            onClick={() => onCardClick?.(deal)}
            avatarContent={
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                {initials}
              </div>
            }
            title={deal.title}
            subtitle={sub}
            rightContent={
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(Number(deal.amount || 0))}
                </span>
                {stageInfo && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                    style={stageInfo.color ? { backgroundColor: stageInfo.color + "22", color: stageInfo.color, borderColor: stageInfo.color + "44" } : undefined}
                  >
                    {stageInfo.name}
                  </Badge>
                )}
              </div>
            }
            meta={
              deal.expectedCloseDate ? (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  Close{" "}
                  {new Date(deal.expectedCloseDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}

// ── Mobile Pipeline Accordion ────────────────────────────────────────

type MobilePipelineProps = {
  stages: PipelineStage[];
  dealsByStage: Record<string, DealWithRelations[]>;
  onDealClick: (deal: DealWithRelations) => void;
  onMoveStage: (args: { dealId: string; stageId: string; stage: string; fromStageId?: string }) => void;
  isMovePending?: boolean;
};

export function MobilePipelineAccordion({ stages, dealsByStage, onDealClick, onMoveStage, isMovePending }: MobilePipelineProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => {
    const first = stages[0]?.id;
    return first ? new Set([first]) : new Set();
  });
  const [moveSheetDeal, setMoveSheetDeal] = useState<DealWithRelations | null>(null);

  const toggle = (stageId: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) { next.delete(stageId); } else { next.add(stageId); }
      return next;
    });
  };

  return (
    <>
      <div className="divide-y divide-border">
        {stages.map((stage) => {
          const stageDeals = dealsByStage[stage.id] || [];
          const isOpen = expandedStages.has(stage.id);
          const totalValue = stageDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);

          return (
            <div key={stage.id}>
              <button
                onClick={() => toggle(stage.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 active:bg-muted/70 touch-manipulation"
                style={{ minHeight: 52 }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color || "#3B82F6" }}
                  />
                  <span className="text-sm font-semibold text-foreground">{stage.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {stageDeals.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {totalValue > 0 && <span className="font-medium text-foreground">{formatCurrency(totalValue)}</span>}
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isOpen && (
                <div className="bg-background divide-y divide-border/60">
                  {stageDeals.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-muted-foreground text-center">No deals in this stage</p>
                  ) : (
                    stageDeals.map((deal) => {
                      const sub = deal.company?.name ||
                        (deal.contact ? `${deal.contact.firstName || ""} ${deal.contact.lastName || ""}`.trim() : undefined);
                      return (
                        <div
                          key={deal.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30 active:bg-accent/50 touch-manipulation"
                          style={{ minHeight: 64 }}
                          onClick={() => onDealClick(deal)}
                        >
                          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                            {deal.title.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{deal.title}</p>
                            {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {Number(deal.amount || 0) > 0 && (
                              <span className="text-sm font-semibold text-foreground">
                                {formatCurrency(Number(deal.amount))}
                              </span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setMoveSheetDeal(deal); }}
                              className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted active:bg-muted/80 touch-manipulation"
                              aria-label="Move to stage"
                            >
                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stage-move bottom sheet */}
      <Sheet open={!!moveSheetDeal} onOpenChange={(v) => !v && setMoveSheetDeal(null)}>
        <SheetContent side="bottom" className="max-h-[70dvh] flex flex-col p-0" aria-describedby={undefined}>
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
            <SheetTitle className="text-base">Move deal</SheetTitle>
            {moveSheetDeal && (
              <p className="text-sm text-muted-foreground truncate">{moveSheetDeal.title}</p>
            )}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-2">
            {stages.map((stage) => {
              const isCurrent = moveSheetDeal?.stageId === stage.id || moveSheetDeal?.stage === stage.name;
              return (
                <button
                  key={stage.id}
                  disabled={isCurrent || isMovePending}
                  onClick={() => {
                    if (!moveSheetDeal || isCurrent) return;
                    onMoveStage({
                      dealId: moveSheetDeal.id,
                      stageId: stage.id,
                      stage: stage.name,
                      fromStageId: moveSheetDeal.stageId || undefined,
                    });
                    setMoveSheetDeal(null);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/50 active:bg-accent touch-manipulation transition-colors",
                    isCurrent && "opacity-50 cursor-not-allowed",
                    "border-b border-border/60 last:border-b-0"
                  )}
                  style={{ minHeight: 52 }}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.color || "#3B82F6" }}
                  />
                  <span className="text-sm font-medium text-foreground flex-1 text-left">{stage.name}</span>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-[10px]">Current</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
