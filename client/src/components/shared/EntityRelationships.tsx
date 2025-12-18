import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Folder,
  Handshake,
  MapPin,
  User,
  Users,
} from 'lucide-react';

export type EntityType = 'contact' | 'company' | 'property' | 'deal' | 'dd_project';

interface RelatedEntity {
  id: string;
  type: EntityType;
  name: string;
  subtitle?: string;
  status?: string;
}

interface EntityRelationshipsProps {
  currentEntity: {
    id: string;
    type: EntityType;
    name: string;
  };
  relatedEntities: RelatedEntity[];
  onNavigate?: (entity: RelatedEntity) => void;
  compact?: boolean;
}

const ENTITY_CONFIG: Record<EntityType, { 
  icon: typeof User; 
  label: string; 
  pluralLabel: string;
  route: (id: string) => string;
  color: string;
}> = {
  contact: {
    icon: User,
    label: 'Contact',
    pluralLabel: 'Contacts',
    route: (id) => `/crm/contacts/${id}`,
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900',
  },
  company: {
    icon: Building2,
    label: 'Company',
    pluralLabel: 'Companies',
    route: (id) => `/crm/companies/${id}`,
    color: 'text-purple-600 bg-purple-100 dark:bg-purple-900',
  },
  property: {
    icon: MapPin,
    label: 'Property',
    pluralLabel: 'Properties',
    route: (id) => `/crm/properties/${id}`,
    color: 'text-green-600 bg-green-100 dark:bg-green-900',
  },
  deal: {
    icon: Handshake,
    label: 'Deal',
    pluralLabel: 'Deals',
    route: (id) => `/crm/deals/${id}`,
    color: 'text-amber-600 bg-amber-100 dark:bg-amber-900',
  },
  dd_project: {
    icon: ClipboardList,
    label: 'DD Project',
    pluralLabel: 'DD Projects',
    route: (id) => `/dd/projects/${id}`,
    color: 'text-red-600 bg-red-100 dark:bg-red-900',
  },
};

export function EntityRelationships({
  currentEntity,
  relatedEntities,
  onNavigate,
  compact = false,
}: EntityRelationshipsProps) {
  const groupedEntities = relatedEntities.reduce((acc, entity) => {
    if (!acc[entity.type]) {
      acc[entity.type] = [];
    }
    acc[entity.type].push(entity);
    return acc;
  }, {} as Record<EntityType, RelatedEntity[]>);

  const entityTypes = Object.keys(groupedEntities) as EntityType[];

  if (relatedEntities.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Folder className="h-4 w-4" />
          <span>Related</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {relatedEntities.slice(0, 5).map((entity) => {
            const config = ENTITY_CONFIG[entity.type];
            const EntityIcon = config.icon;
            return (
              <Link key={`${entity.type}-${entity.id}`} href={config.route(entity.id)}>
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-muted flex items-center gap-1"
                  data-testid={`badge-related-${entity.type}-${entity.id}`}
                >
                  <EntityIcon className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{entity.name}</span>
                </Badge>
              </Link>
            );
          })}
          {relatedEntities.length > 5 && (
            <Badge variant="secondary">+{relatedEntities.length - 5} more</Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Folder className="h-4 w-4" />
          Related Entities
        </CardTitle>
        <CardDescription>
          Navigate to connected records
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {entityTypes.map((type) => {
              const config = ENTITY_CONFIG[type];
              const EntityIcon = config.icon;
              const entities = groupedEntities[type];
              
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <EntityIcon className={`h-4 w-4 ${config.color.split(' ')[0]}`} />
                    <span className="text-sm font-medium">
                      {entities.length === 1 ? config.label : config.pluralLabel}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {entities.length}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 pl-6">
                    {entities.map((entity) => (
                      <Link 
                        key={entity.id} 
                        href={config.route(entity.id)}
                        onClick={() => onNavigate?.(entity)}
                      >
                        <div 
                          className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer group"
                          data-testid={`link-related-${entity.type}-${entity.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{entity.name}</div>
                            {entity.subtitle && (
                              <div className="text-xs text-muted-foreground truncate">
                                {entity.subtitle}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {entity.status && (
                              <Badge variant="outline" className="text-xs">
                                {entity.status}
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface EntityBreadcrumbProps {
  path: Array<{
    type: EntityType;
    id: string;
    name: string;
  }>;
}

export function EntityBreadcrumb({ path }: EntityBreadcrumbProps) {
  if (path.length === 0) return null;
  
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      {path.map((item, index) => {
        const config = ENTITY_CONFIG[item.type];
        const EntityIcon = config.icon;
        const isLast = index === path.length - 1;
        
        return (
          <div key={`${item.type}-${item.id}`} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-4 w-4" />}
            {isLast ? (
              <span className="flex items-center gap-1 text-foreground font-medium">
                <EntityIcon className="h-4 w-4" />
                {item.name}
              </span>
            ) : (
              <Link href={config.route(item.id)}>
                <span 
                  className="flex items-center gap-1 hover:text-foreground cursor-pointer"
                  data-testid={`breadcrumb-${item.type}-${item.id}`}
                >
                  <EntityIcon className="h-4 w-4" />
                  {item.name}
                </span>
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

interface QuickLinkProps {
  entity: RelatedEntity;
  showType?: boolean;
}

export function EntityQuickLink({ entity, showType = true }: QuickLinkProps) {
  const config = ENTITY_CONFIG[entity.type];
  const EntityIcon = config.icon;
  
  return (
    <Link href={config.route(entity.id)}>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-auto p-2 justify-start"
        data-testid={`quick-link-${entity.type}-${entity.id}`}
      >
        <EntityIcon className={`h-4 w-4 mr-2 ${config.color.split(' ')[0]}`} />
        <div className="flex flex-col items-start">
          <span className="font-medium">{entity.name}</span>
          {showType && (
            <span className="text-xs text-muted-foreground">{config.label}</span>
          )}
        </div>
        <ExternalLink className="h-3 w-3 ml-2 opacity-50" />
      </Button>
    </Link>
  );
}
