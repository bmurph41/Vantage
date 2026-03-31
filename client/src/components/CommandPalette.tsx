import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Users,
  Building,
  Handshake,
  Home,
  Calculator,
  ClipboardList,
  Search,
  Star,
  Pin,
  Clock,
  FileText,
} from "lucide-react";
import debounce from "lodash.debounce";
import { Badge } from "@/components/ui/badge";
import { getNavigationItems } from "@/config/sidebarConfig";

type SearchResultType = 'contact' | 'company' | 'deal' | 'property' | 'modelingProject' | 'ddProject';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  description: string | null;
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
}

const typeIcons: Record<SearchResultType, any> = {
  contact: Users,
  company: Building,
  deal: Handshake,
  property: Home,
  modelingProject: Calculator,
  ddProject: ClipboardList,
};

const typeLabels: Record<SearchResultType, string> = {
  contact: 'Contact',
  company: 'Company',
  deal: 'Deal',
  property: 'Property',
  modelingProject: 'Model',
  ddProject: 'DD Project',
};

const typeColors: Record<SearchResultType, string> = {
  contact: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  company: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  deal: 'bg-green-500/20 text-green-600 dark:text-green-400',
  property: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  modelingProject: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
  ddProject: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
};

// Derived once at module load — automatically reflects any changes to sidebarConfig
const navigationItems = getNavigationItems();

interface QuickAccessItem {
  id: string;
  itemType: string;
  itemId: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, any>;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [, navigate] = useLocation();

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setDebouncedQuery(value);
    }, 200),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  const { data: searchResults, isLoading: isSearching } = useQuery<SearchResponse>({
    queryKey: ['/api/search', debouncedQuery],
    enabled: debouncedQuery.length >= 2,
  });

  const { data: pinnedItems } = useQuery<QuickAccessItem[]>({
    queryKey: ['/api/quick-access/pinned'],
    staleTime: 60000,
  });

  const { data: favoriteItems } = useQuery<QuickAccessItem[]>({
    queryKey: ['/api/quick-access/favorites'],
    staleTime: 60000,
  });

  const { data: recentItems } = useQuery<QuickAccessItem[]>({
    queryKey: ['/api/quick-access/recent'],
    staleTime: 30000,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable;
      
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      
      if (e.key === "/" && !isInputField) {
        e.preventDefault();
        setOpen(true);
      }
      
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (type: string, id: string) => {
    let path = '';
    switch (type) {
      case 'contact':
        path = `/crm/contacts/${id}`;
        break;
      case 'company':
        path = `/crm/companies/${id}`;
        break;
      case 'deal':
        path = `/crm/deals/${id}`;
        break;
      case 'property':
        path = `/crm/properties/${id}`;
        break;
      case 'modelingProject':
        path = `/modeling/${id}`;
        break;
      case 'ddProject':
        path = `/projects/${id}`;
        break;
      default:
        return;
    }
    setOpen(false);
    setSearchQuery("");
    navigate(path);
  };

  const handleNavigate = (href: string) => {
    setOpen(false);
    setSearchQuery("");
    navigate(href);
  };

  const handleQuickAccessSelect = (item: QuickAccessItem) => {
    handleSelect(item.itemType, item.itemId);
  };

  // Filter navigation items by search query
  const filteredNavigation = useMemo(() => {
    if (searchQuery.length === 0) return navigationItems;
    const q = searchQuery.toLowerCase();
    return navigationItems.filter(
      item =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Group filtered navigation by category for cleaner display when searching
  const groupedNavigation = useMemo(() => {
    if (searchQuery.length === 0) return null;
    const groups: Record<string, typeof navigationItems> = {};
    for (const item of filteredNavigation) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filteredNavigation, searchQuery]);

  const groupedResults = searchResults?.results?.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = [];
    }
    acc[result.type].push(result);
    return acc;
  }, {} as Record<SearchResultType, SearchResult[]>) || {};

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search across deals, contacts, properties, or type a command..."
        value={searchQuery}
        onValueChange={setSearchQuery}
        data-testid="command-palette-input"
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? (
            <div className="flex items-center justify-center py-4">
              <Search className="h-4 w-4 animate-spin mr-2" />
              Searching...
            </div>
          ) : searchQuery.length >= 2 ? (
            "No results found."
          ) : (
            "Start typing to search..."
          )}
        </CommandEmpty>

        {searchQuery.length < 2 && pinnedItems && pinnedItems.length > 0 && (
          <CommandGroup heading="Pinned">
            {pinnedItems.slice(0, 5).map((item) => {
              const Icon = typeIcons[item.itemType as SearchResultType] || FileText;
              return (
                <CommandItem
                  key={`pinned-${item.id}`}
                  onSelect={() => handleQuickAccessSelect(item)}
                  className="flex items-center gap-2"
                  data-testid={`command-palette-pinned-${item.id}`}
                >
                  <Pin className="h-3 w-3 text-amber-500" />
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{item.title}</span>
                  {item.subtitle && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {item.subtitle}
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {searchQuery.length < 2 && favoriteItems && favoriteItems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Favorites">
              {favoriteItems.slice(0, 5).map((item) => {
                const Icon = typeIcons[item.itemType as SearchResultType] || FileText;
                return (
                  <CommandItem
                    key={`fav-${item.id}`}
                    onSelect={() => handleQuickAccessSelect(item)}
                    className="flex items-center gap-2"
                    data-testid={`command-palette-favorite-${item.id}`}
                  >
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.title}</span>
                    {item.subtitle && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {item.subtitle}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {searchQuery.length < 2 && recentItems && recentItems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent">
              {recentItems.slice(0, 5).map((item) => {
                const Icon = typeIcons[item.itemType as SearchResultType] || FileText;
                return (
                  <CommandItem
                    key={`recent-${item.id}`}
                    onSelect={() => handleQuickAccessSelect(item)}
                    className="flex items-center gap-2"
                    data-testid={`command-palette-recent-${item.id}`}
                  >
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.title}</span>
                    {item.subtitle && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {item.subtitle}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {searchQuery.length >= 2 && Object.keys(groupedResults).length > 0 && (
          <>
            {Object.entries(groupedResults).map(([type, results]) => {
              const Icon = typeIcons[type as SearchResultType];
              return (
                <CommandGroup key={type} heading={typeLabels[type as SearchResultType] + 's'}>
                  {results.map((result) => (
                    <CommandItem
                      key={`${type}-${result.id}`}
                      onSelect={() => handleSelect(result.type, result.id)}
                      className="flex items-center gap-2"
                      data-testid={`command-palette-result-${type}-${result.id}`}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="truncate">{result.title}</span>
                        {(result.subtitle || result.description) && (
                          <span className="text-xs text-muted-foreground truncate">
                            {result.subtitle || result.description}
                          </span>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 shrink-0 ${typeColors[result.type]}`}
                      >
                        {typeLabels[result.type]}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            <CommandSeparator />
          </>
        )}

        {/* When searching: group by category for clarity */}
        {searchQuery.length >= 2 && filteredNavigation.length > 0 && groupedNavigation && (
          <>
            {Object.entries(groupedNavigation).map(([category, items]) => (
              <CommandGroup key={category} heading={category}>
                {items.map((item) => {
                  const Icon = item.icon ?? FileText;
                  return (
                    <CommandItem
                      key={item.href}
                      onSelect={() => handleNavigate(item.href)}
                      className="flex items-center gap-2"
                      data-testid={`command-palette-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{item.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </>
        )}

        {/* When not searching: show a flat quick-navigation list (top 6) */}
        {searchQuery.length < 2 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Navigation">
              {navigationItems.slice(0, 6).map((item) => {
                const Icon = item.icon ?? FileText;
                return (
                  <CommandItem
                    key={item.href}
                    onSelect={() => handleNavigate(item.href)}
                    className="flex items-center gap-2"
                    data-testid={`command-palette-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {item.category}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => {
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          metaKey: true,
          bubbles: true,
        });
        document.dispatchEvent(event);
      }}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-md border border-border/50 transition-colors"
      data-testid="command-palette-trigger"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden md:inline">Search...</span>
      <kbd className="hidden md:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}

export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpen();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpen]);
}
