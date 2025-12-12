import { useState, useCallback, useEffect } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building, MapPin, Link, Unlink, Search, X, Check } from "lucide-react";
import debounce from "lodash.debounce";

interface PropertySearchResult {
  id: string;
  title: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  type?: string;
  status?: string;
  wetSlips?: number;
  drySlips?: number;
  occupancy?: number;
}

interface PropertyAutocompleteProps {
  value: string;
  selectedPropertyId?: string | null;
  onValueChange: (value: string) => void;
  onPropertySelect: (property: PropertySearchResult | null) => void;
  onPropertyDataPopulate?: (property: PropertySearchResult) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function PropertyAutocomplete({
  value,
  selectedPropertyId,
  onValueChange,
  onPropertySelect,
  onPropertyDataPopulate,
  placeholder = "Enter marina name...",
  disabled = false,
}: PropertyAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<PropertySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertySearchResult | null>(null);

  const searchProperties = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/properties/search/autocomplete?q=${encodeURIComponent(query)}&limit=10`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Failed to search properties:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce((query: string) => searchProperties(query), 300),
    []
  );

  const handleInputChange = (newValue: string) => {
    onValueChange(newValue);
    if (!selectedPropertyId) {
      debouncedSearch(newValue);
      setOpen(true);
    }
  };

  const handleSelectProperty = (property: PropertySearchResult) => {
    setSelectedProperty(property);
    onPropertySelect(property);
    onValueChange(property.title);
    
    if (onPropertyDataPopulate) {
      onPropertyDataPopulate(property);
    }
    
    setOpen(false);
    setSearchResults([]);
  };

  const handleUnlinkProperty = () => {
    setSelectedProperty(null);
    onPropertySelect(null);
  };

  const formatLocation = (property: PropertySearchResult) => {
    const parts = [];
    if (property.city) parts.push(property.city);
    if (property.state) parts.push(property.state);
    if (parts.length === 0 && property.address) {
      return property.address;
    }
    return parts.join(", ");
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            data-testid="input-marina-name"
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={selectedPropertyId ? "pr-8 border-green-500" : ""}
          />
          {selectedPropertyId && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Check className="h-4 w-4 text-green-500" />
            </div>
          )}
        </div>
        
        {selectedPropertyId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUnlinkProperty}
            className="shrink-0"
            data-testid="button-unlink-property"
          >
            <Unlink className="h-4 w-4 mr-1" />
            Unlink
          </Button>
        ) : null}
      </div>

      {selectedPropertyId && selectedProperty && (
        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-sm">
            <Link className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-700 dark:text-green-300">
              Linked to CRM Property
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedProperty.title}
            {formatLocation(selectedProperty) && ` - ${formatLocation(selectedProperty)}`}
          </p>
        </div>
      )}

      {open && searchResults.length > 0 && !selectedPropertyId && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[300px] overflow-auto">
          <div className="p-2 border-b bg-muted/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Search className="h-3 w-3" />
              {searchResults.length} matching {searchResults.length === 1 ? 'property' : 'properties'} found
            </p>
          </div>
          <div className="py-1">
            {searchResults.map((property) => (
              <button
                key={property.id}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-accent cursor-pointer flex items-start gap-3"
                onClick={() => handleSelectProperty(property)}
                data-testid={`property-option-${property.id}`}
              >
                <Building className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{property.title}</p>
                  {formatLocation(property) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {formatLocation(property)}
                    </p>
                  )}
                  <div className="flex gap-2 mt-1">
                    {property.wetSlips && (
                      <Badge variant="secondary" className="text-xs">
                        {property.wetSlips} wet slips
                      </Badge>
                    )}
                    {property.drySlips && (
                      <Badge variant="secondary" className="text-xs">
                        {property.drySlips} dry racks
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="p-2 border-t bg-muted/30">
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1"
              onClick={() => {
                setOpen(false);
                setSearchResults([]);
              }}
              data-testid="button-ignore-suggestions"
            >
              <X className="h-3 w-3" />
              Ignore suggestions - create new
            </button>
          </div>
        </div>
      )}

      {open && isSearching && !selectedPropertyId && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg p-3">
          <p className="text-sm text-muted-foreground text-center">Searching properties...</p>
        </div>
      )}
    </div>
  );
}
