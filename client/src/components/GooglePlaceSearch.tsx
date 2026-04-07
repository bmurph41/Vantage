import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PlacePrediction {
  place_id: string;
  description: string;
  structured: {
    main_text: string;
    secondary_text: string;
  };
}

export interface PlaceDetails {
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number;
  price_level: string | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string;
  google_url: string | null;
  types: string[];
  hours: string | null;
  photo_urls: string[];
}

interface GooglePlaceSearchProps {
  onSelect: (place: PlaceDetails) => void;
  searchType?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  value?: string;
}

export function GooglePlaceSearch({
  onSelect,
  searchType = 'establishment',
  placeholder = 'Search Google for a place...',
  className,
  disabled = false,
  value: externalValue,
}: GooglePlaceSearchProps) {
  const [query, setQuery] = useState(externalValue || '');
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => {
    if (externalValue !== undefined) setQuery(externalValue);
  }, [externalValue]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = useCallback((input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (input.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/google-places/autocomplete?input=${encodeURIComponent(input)}&types=${encodeURIComponent(searchType)}`,
          { credentials: 'include' }
        );
        const data = await res.json();
        setResults(data.predictions || []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [searchType]);

  const selectPlace = useCallback(async (prediction: PlacePrediction) => {
    setShowResults(false);
    setQuery(prediction.description);
    setDetailsLoading(true);
    try {
      const res = await fetch(`/api/google-places/details/${prediction.place_id}`, {
        credentials: 'include',
      });
      const data = await res.json();
      onSelect(data);
    } catch (err) {
      console.error('Failed to fetch place details:', err);
    } finally {
      setDetailsLoading(false);
    }
  }, [onSelect]);

  const clear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          placeholder={placeholder}
          disabled={disabled || detailsLoading}
          onChange={(e) => {
            setQuery(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => results.length > 0 && setShowResults(true)}
          className="pl-9 pr-8"
        />
        {(loading || detailsLoading) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!loading && !detailsLoading && query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => selectPlace(r)}
              className="flex items-start gap-3 w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b last:border-b-0"
            >
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {r.structured?.main_text || r.description}
                </div>
                {r.structured?.secondary_text && (
                  <div className="text-xs text-muted-foreground truncate">
                    {r.structured.secondary_text}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
