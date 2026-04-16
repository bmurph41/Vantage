import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { User, Building2, DollarSign, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchResult {
  id: string;
  type: 'contact' | 'company' | 'deal' | 'property';
  title: string;
  subtitle: string | null;
  description: string | null;
  data: any;
}

interface SmartSearchProps {
  onResultSelect: (result: SearchResult) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SmartSearch({ onResultSelect, open: controlledOpen, onOpenChange }: SmartSearchProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (v: boolean) => onOpenChange?.(v)
    : setInternalOpen;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch search results
  const { data: searchData, isLoading } = useQuery({
    queryKey: ['/api/search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.trim().length < 2) {
        return { results: [], query: "" };
      }
      const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: debouncedQuery.trim().length >= 2,
  });

  const results: SearchResult[] = searchData?.results || [];

  const contactResults = results.filter((r) => r.type === 'contact');
  const companyResults = results.filter((r) => r.type === 'company');
  const dealResults = results.filter((r) => r.type === 'deal');
  const propertyResults = results.filter((r) => r.type === 'property');

  const handleSelect = (result: SearchResult) => {
    onResultSelect(result);
    setOpen(false);
    setSearchQuery("");
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'contact': return <User className="h-4 w-4 text-blue-600" />;
      case 'company': return <Building2 className="h-4 w-4 text-purple-600" />;
      case 'deal': return <DollarSign className="h-4 w-4 text-green-600" />;
      case 'property': return <MapPin className="h-4 w-4 text-orange-600" />;
      default: return null;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      contact: 'bg-blue-100 text-blue-800',
      company: 'bg-purple-100 text-purple-800',
      deal: 'bg-green-100 text-green-800',
      property: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={`${colors[type] ?? 'bg-gray-100 text-gray-800'} text-xs`}>
        {type}
      </Badge>
    );
  };

  const renderGroup = (label: string, items: SearchResult[]) => {
    if (!items.length) return null;
    return (
      <CommandGroup heading={label}>
        {items.map((result) => (
          <CommandItem
            key={result.id}
            value={`${result.type}-${result.id}`}
            onSelect={() => handleSelect(result)}
            className="flex items-center gap-2 cursor-pointer"
            data-testid={`search-result-${result.type}-${result.id}`}
          >
            {getTypeIcon(result.type)}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{result.title}</div>
              {result.subtitle && (
                <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>
              )}
              {result.description && (
                <div className="text-xs text-muted-foreground truncate">{result.description}</div>
              )}
            </div>
            {getTypeBadge(result.type)}
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    <>
      {!isControlled && (
        <Button
          variant="outline"
          className="relative w-full justify-between text-sm text-muted-foreground"
          onClick={() => setOpen(true)}
          data-testid="button-open-search"
        >
          <div className="flex items-center">
            <Search className="mr-2 h-4 w-4" />
            <span>Search CRM...</span>
          </div>
          <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search contacts, companies, deals, properties..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          data-testid="input-search"
        />
        <CommandList>
          <CommandEmpty>
            {isLoading ? "Searching..." : "No results found."}
          </CommandEmpty>
          {renderGroup("Contacts", contactResults)}
          {renderGroup("Companies", companyResults)}
          {renderGroup("Deals", dealResults)}
          {renderGroup("Properties", propertyResults)}
        </CommandList>
      </CommandDialog>
    </>
  );
}
