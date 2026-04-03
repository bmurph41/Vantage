/**
 * Related Entities Panel - Phase 3B
 * 
 * A reusable component that displays cross-module related entities
 * for any CRM entity (contact, company, property, deal).
 * 
 * Shows:
 * - Linked contacts/companies
 * - Related deals
 * - DD projects
 * - Modeling projects
 * - Docket articles (related news)
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Building2,
  Home,
  Briefcase,
  FolderKanban,
  Calculator,
  Newspaper,
  ChevronRight,
  Link2,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { queryKeys } from "@/lib/queryKeys";

interface RelatedEntitiesPanelProps {
  entityType: "contact" | "company" | "property" | "deal";
  entityId: string;
  onNavigate?: (type: string, id: string) => void;
  compact?: boolean;
}

interface RelatedEntity {
  id: string;
  name?: string;
  title?: string;
  email?: string;
  address?: string;
  stage?: string;
  status?: string;
}

interface RelatedData {
  entityType: string;
  entityId: string;
  related: {
    contacts?: RelatedEntity[];
    companies?: RelatedEntity[];
    deals?: RelatedEntity[];
    ddProjects?: Array<{ id: string; name: string; status: string }>;
    ddProject?: Array<{ id: string; name: string; status: string }>;
    modelingProject?: Array<{ id: string; name: string }>;
    articles?: Array<{
      id: number;
      title: string;
      source: string;
      publishedAt: string;
      url: string;
    }>;
  };
}

export function RelatedEntitiesPanel({
  entityType,
  entityId,
  onNavigate,
  compact = false,
}: RelatedEntitiesPanelProps) {
  const { data, isLoading, error } = useQuery<RelatedData>({
    queryKey: ["/api/entity-links", entityType, entityId, "related"],
    queryFn: async () => {
      const response = await fetch(`/api/entity-links/${entityType}/${entityId}/related`);
      if (!response.ok) {
        throw new Error("Failed to fetch related entities");
      }
      return response.json();
    },
    enabled: !!entityId,
  });

  if (isLoading) {
    return <RelatedEntitiesSkeleton compact={compact} />;
  }

  if (error || !data) {
    return null; // Silently fail if no related data
  }

  const { related } = data;
  const hasRelated =
    (related.contacts?.length ?? 0) > 0 ||
    (related.companies?.length ?? 0) > 0 ||
    (related.deals?.length ?? 0) > 0 ||
    (related.ddProjects?.length ?? 0) > 0 ||
    (related.ddProject?.length ?? 0) > 0 ||
    (related.modelingProject?.length ?? 0) > 0 ||
    (related.articles?.length ?? 0) > 0;

  if (!hasRelated) {
    return compact ? null : (
      <Card className="bg-muted/30" data-testid="related-entities-empty">
        <CardContent className="p-4 text-center text-muted-foreground text-sm">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No related entities found</p>
        </CardContent>
      </Card>
    );
  }

  const handleNavigate = (type: string, id: string) => {
    if (onNavigate) {
      onNavigate(type, id);
    }
  };

  return (
    <Card className="bg-background" data-testid="related-entities-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Related Entities
        </CardTitle>
        {!compact && (
          <CardDescription className="text-xs">
            Connected data across modules
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Contacts Section */}
        {related.contacts && related.contacts.length > 0 && (
          <RelatedSection
            title="Contacts"
            icon={<User className="h-3.5 w-3.5" />}
            items={related.contacts}
            compact={compact}
            onItemClick={(id) => handleNavigate("contact", id)}
            renderItem={(item) => (
              <>
                <span className="font-medium">{item.name || "Unknown"}</span>
                {item.email && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({item.email})
                  </span>
                )}
              </>
            )}
          />
        )}

        {/* Companies Section */}
        {related.companies && related.companies.length > 0 && (
          <RelatedSection
            title="Companies"
            icon={<Building2 className="h-3.5 w-3.5" />}
            items={related.companies}
            compact={compact}
            onItemClick={(id) => handleNavigate("company", id)}
            renderItem={(item) => (
              <span className="font-medium">{item.name || "Unknown"}</span>
            )}
          />
        )}

        {/* Deals Section */}
        {related.deals && related.deals.length > 0 && (
          <RelatedSection
            title="Deals"
            icon={<Briefcase className="h-3.5 w-3.5" />}
            items={related.deals}
            compact={compact}
            onItemClick={(id) => handleNavigate("deal", id)}
            renderItem={(item) => (
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.title || item.name || "Untitled Deal"}</span>
                {item.stage && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {item.stage}
                  </Badge>
                )}
              </div>
            )}
          />
        )}

        {/* DD Projects Section */}
        {((related.ddProjects && related.ddProjects.length > 0) ||
          (related.ddProject && related.ddProject.length > 0)) && (
          <RelatedSection
            title="Due Diligence"
            icon={<FolderKanban className="h-3.5 w-3.5" />}
            items={related.ddProjects || related.ddProject || []}
            compact={compact}
            onItemClick={(id) => handleNavigate("project", id)}
            renderItem={(item) => (
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.name}</span>
                {item.status && (
                  <Badge
                    variant={item.status === "completed" ? "default" : "secondary"}
                    className="text-[10px] px-1 py-0"
                  >
                    {item.status}
                  </Badge>
                )}
              </div>
            )}
          />
        )}

        {/* Modeling Projects Section */}
        {related.modelingProject && related.modelingProject.length > 0 && (
          <RelatedSection
            title="Modeling"
            icon={<Calculator className="h-3.5 w-3.5" />}
            items={related.modelingProject}
            compact={compact}
            onItemClick={(id) => handleNavigate("modeling-project", id)}
            renderItem={(item) => (
              <span className="font-medium">{item.name}</span>
            )}
          />
        )}

        {/* Docket Articles Section */}
        {related.articles && related.articles.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Newspaper className="h-3.5 w-3.5" />
              <span>Related News ({related.articles.length})</span>
            </div>
            <ScrollArea className={compact ? "max-h-24" : "max-h-40"}>
              <div className="space-y-1">
                {related.articles.slice(0, compact ? 3 : 5).map((article) => (
                  <a
                    key={article.id}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-1.5 rounded hover:bg-muted/50 transition-colors group"
                    data-testid={`article-link-${article.id}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-medium line-clamp-2 group-hover:text-primary">
                        {article.title}
                      </span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>{article.source}</span>
                      <span>•</span>
                      <span>
                        {article.publishedAt
                          ? formatDistanceToNow(new Date(article.publishedAt), {
                              addSuffix: true,
                            })
                          : "Unknown date"}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </ScrollArea>
            {related.articles.length > (compact ? 3 : 5) && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs h-6"
                onClick={() => handleNavigate("articles", entityId)}
              >
                View all {related.articles.length} articles
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RelatedSectionProps<T extends { id: string }> {
  title: string;
  icon: React.ReactNode;
  items: T[];
  compact: boolean;
  onItemClick: (id: string) => void;
  renderItem: (item: T) => React.ReactNode;
}

function RelatedSection<T extends { id: string }>({
  title,
  icon,
  items,
  compact,
  onItemClick,
  renderItem,
}: RelatedSectionProps<T>) {
  const displayItems = compact ? items.slice(0, 2) : items.slice(0, 5);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>
          {title} ({items.length})
        </span>
      </div>
      <div className="space-y-0.5">
        {displayItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className="w-full text-left p-1.5 rounded hover:bg-muted/50 transition-colors text-xs flex items-center justify-between group"
            data-testid={`related-${title.toLowerCase()}-${item.id}`}
          >
            {renderItem(item)}
            <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
        {items.length > displayItems.length && (
          <span className="text-[10px] text-muted-foreground pl-1.5">
            +{items.length - displayItems.length} more
          </span>
        )}
      </div>
    </div>
  );
}

function RelatedEntitiesSkeleton({ compact }: { compact: boolean }) {
  return (
    <Card className="bg-background">
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-full" />
          {!compact && <Skeleton className="h-6 w-full" />}
        </div>
        <Separator />
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default RelatedEntitiesPanel;
