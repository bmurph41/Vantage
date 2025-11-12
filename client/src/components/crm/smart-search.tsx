import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { User, Building2, DollarSign, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchResult {
  id: string;
  type: 'contact' | 'company' | 'deal';
  title: string;
  subtitle: string | null;
  description: string | null;
  data: any;
}

interface SmartSearchProps {
  onResultSelect: (result: SearchResult) => void;
}

export function SmartSearch({ onResultSelect }: SmartSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard shortcut to open (Ctrl+K or Cmd+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

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

  const results = searchData?.results || [];

  // Group results by type
  const contactResults = results.filter((r: SearchResult) => r.type === 'contact');
  const companyResults = results.filter((r: SearchResult) => r.type === 'company');
  const dealResults = results.filter((r: SearchResult) => r.type === 'deal');

  const handleSelect = (result: SearchResult) => {
    onResultSelect(result);
    setOpen(false);
    setSearchQuery("");
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'contact':
        return <User className="h-4 w-4 text-blue-600" />;
      case 'company':
        return <Building2 className="h-4 w-4 text-purple-600" />;
      case 'deal':
        return <DollarSign className="h-4 w-4 text-green-600" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors = {
      contact: 'bg-blue-100 text-blue-800',
      company: 'bg-purple-100 text-purple-800',
      deal: 'bg-green-100 text-green-800',
    };
    return (
      <Badge className={`${colors[type as keyof typeof colors]} text-xs`}>
        {type}
      </Badge>
    );
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative w-full justify-start text-sm text-muted-foreground md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
        data-testid="button-open-search"
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search...</span>
        <span className="inline-flex lg:hidden">Search...</span>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search contacts, companies, deals..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          data-testid="input-search"
        />
        <CommandList>
          <CommandEmpty>
            {isLoading ? "Searching..." : "No results found."}
          </CommandEmpty>

          {contactResults.length > 0 && (
            <CommandGroup heading="Contacts">
              {contactResults.map((result: SearchResult) => (
                <CommandItem
                  key={result.id}
                  value={result.id}
                  onSelect={() => handleSelect(result)}
                  className="flex items-center gap-2 cursor-pointer"
                  data-testid={`search-result-contact-${result.id}`}
                >
                  {getTypeIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-sm text-muted-foreground truncate">
                        {result.subtitle}
                      </div>
                    )}
                    {result.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {result.description}
                      </div>
                    )}
                  </div>
                  {getTypeBadge(result.type)}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {companyResults.length > 0 && (
            <CommandGroup heading="Companies">
              {companyResults.map((result: SearchResult) => (
                <CommandItem
                  key={result.id}
                  value={result.id}
                  onSelect={() => handleSelect(result)}
                  className="flex items-center gap-2 cursor-pointer"
                  data-testid={`search-result-company-${result.id}`}
                >
                  {getTypeIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-sm text-muted-foreground truncate">
                        {result.subtitle}
                      </div>
                    )}
                    {result.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {result.description}
                      </div>
                    )}
                  </div>
                  {getTypeBadge(result.type)}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {dealResults.length > 0 && (
            <CommandGroup heading="Deals">
              {dealResults.map((result: SearchResult) => (
                <CommandItem
                  key={result.id}
                  value={result.id}
                  onSelect={() => handleSelect(result)}
                  className="flex items-center gap-2 cursor-pointer"
                  data-testid={`search-result-deal-${result.id}`}
                >
                  {getTypeIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-sm text-muted-foreground truncate">
                        {result.subtitle}
                      </div>
                    )}
                    {result.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {result.description}
                      </div>
                    )}
                  </div>
                  {getTypeBadge(result.type)}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
