import { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface AddressComponents {
  street?: string;
  streetAddress?: string; // Alias for street
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  fullAddress?: string;
  lat?: number;
  lng?: number;
}

const US_STATES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC'
};

const STATE_ABBREVS = new Set(Object.values(US_STATES));

function normalizeState(input: string): string | undefined {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();
  if (STATE_ABBREVS.has(upper)) return upper;
  const lower = trimmed.toLowerCase();
  return US_STATES[lower];
}

function parseCityStateZip(segment: string): { city?: string; state?: string; zipCode?: string } {
  const trimmed = segment.trim();
  
  const zipMatch = trimmed.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  let zipCode: string | undefined;
  let remainder = trimmed;
  
  if (zipMatch) {
    zipCode = zipMatch[1];
    remainder = trimmed.substring(0, zipMatch.index).trim();
  }
  
  const words = remainder.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return { zipCode };
  }
  
  for (let i = words.length - 1; i >= 0; i--) {
    const potentialState = words[i];
    const stateAbbrev = normalizeState(potentialState);
    if (stateAbbrev) {
      const city = i > 0 ? words.slice(0, i).join(' ') : undefined;
      return { city, state: stateAbbrev, zipCode };
    }
  }
  
  return { city: remainder, zipCode };
}

export function parseAddressString(fullAddress: string): AddressComponents {
  const result: AddressComponents = { fullAddress };
  if (!fullAddress || !fullAddress.trim()) return result;
  
  const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return result;
  
  if (parts.length === 1) {
    const parsed = parseCityStateZip(parts[0]);
    if (parsed.state || parsed.zipCode) {
      result.city = parsed.city;
      result.state = parsed.state;
      result.zipCode = parsed.zipCode;
    }
    return result;
  }
  
  result.street = parts[0];
  result.streetAddress = parts[0];
  
  if (parts.length === 2) {
    const parsed = parseCityStateZip(parts[1]);
    result.city = parsed.city;
    result.state = parsed.state;
    result.zipCode = parsed.zipCode;
  } else if (parts.length === 3) {
    const lastPart = parts[2];
    const parsed = parseCityStateZip(lastPart);
    
    if (parsed.state || parsed.zipCode) {
      if (parsed.city) {
        result.city = parsed.city;
      } else {
        result.city = parts[1];
      }
      result.state = parsed.state;
      result.zipCode = parsed.zipCode;
    } else {
      result.city = parts[1];
      const stateAbbrev = normalizeState(lastPart);
      if (stateAbbrev) {
        result.state = stateAbbrev;
      }
    }
  } else if (parts.length >= 4) {
    const lastPart = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    
    const lastParsed = parseCityStateZip(lastPart);
    
    if (lastParsed.state && lastParsed.zipCode) {
      result.city = lastParsed.city || secondLast;
      result.state = lastParsed.state;
      result.zipCode = lastParsed.zipCode;
    } else if (lastParsed.zipCode && !lastParsed.state) {
      const stateAbbrev = normalizeState(secondLast);
      if (stateAbbrev) {
        result.state = stateAbbrev;
        result.city = parts.length >= 5 ? parts[parts.length - 3] : parts[1];
      } else {
        result.city = secondLast;
      }
      result.zipCode = lastParsed.zipCode;
    } else if (lastParsed.state && !lastParsed.zipCode) {
      result.state = lastParsed.state;
      result.city = lastParsed.city || secondLast;
    } else {
      result.city = parts[parts.length - 2];
      const stateAbbrev = normalizeState(lastPart);
      if (stateAbbrev) {
        result.state = stateAbbrev;
      }
    }
  }
  
  return result;
}

interface AddressInputProps {
  value?: string;
  onChange?: (address: string, components?: AddressComponents) => void;
  onAddressSelect?: (components: AddressComponents) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  testId?: string;
  countries?: string[];
}

export function AddressInput({
  value = '',
  onChange,
  onAddressSelect,
  label = 'Address',
  placeholder = 'Start typing an address...',
  disabled = false,
  required = false,
  className = '',
  testId = 'input-address',
  countries = ['us'],
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const { toast } = useToast();

  // Store latest callbacks in refs to avoid reinstantiating autocomplete
  const onChangeRef = useRef(onChange);
  const onAddressSelectRef = useRef(onAddressSelect);

  useEffect(() => {
    onChangeRef.current = onChange;
    onAddressSelectRef.current = onAddressSelect;
  }, [onChange, onAddressSelect]);

  useEffect(() => {
    // Load Google Maps API
    const loadGoogleMaps = async () => {
      if (typeof google !== 'undefined' && google.maps) {
        setApiReady(true);
        return;
      }

      setIsLoading(true);
      try {
        let apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
          try {
            const response = await fetch('/api/config/google-maps-key');
            const data = await response.json();
            apiKey = data.apiKey;
          } catch (err) {
          }
        }
        
        if (!apiKey) {
          setIsLoading(false);
          return;
        }

        const { Loader } = await import('@googlemaps/js-api-loader');
        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places'],
        });

        await loader.load();
        setApiReady(true);
      } catch (error) {
        // Improved error logging
        console.error('Failed to load Google Maps API:', error);
        
        // Check if this is likely a referrer restriction issue
        const errorMessage = error instanceof Error ? error.message : '';
        const isReferrerIssue = errorMessage.includes('RefererNotAllowedMapError') || 
                                errorMessage.includes('ApiNotActivatedMapError') ||
                                error instanceof Event; // Script loading failures often appear as Events
        
        if (isReferrerIssue) {
          console.error(
            'Google Maps API key restriction detected. ' +
            'Please add this domain to your API key\'s HTTP referrer restrictions in Google Cloud Console.'
          );
        }
        
        toast({
          title: 'Address Autocomplete Unavailable',
          description: isReferrerIssue 
            ? 'API key restriction detected. Check console for details.'
            : 'Using manual address entry instead.',
          variant: 'default',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadGoogleMaps();
  }, [toast]);

  // Stable handler using refs - won't change between renders
  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    
    if (!place || !place.address_components) {
      return;
    }

    // Extract address components
    const components: AddressComponents = {
      fullAddress: place.formatted_address || '',
      lat: place.geometry?.location?.lat(),
      lng: place.geometry?.location?.lng(),
    };

    // Parse address components
    place.address_components?.forEach((component) => {
      const types = component.types;
      
      if (types.includes('street_number')) {
        components.street = component.long_name;
      }
      if (types.includes('route')) {
        components.street = components.street 
          ? `${components.street} ${component.long_name}`
          : component.long_name;
      }
      if (types.includes('locality')) {
        components.city = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        components.state = component.short_name; // Use short name for state abbreviation
      }
      if (types.includes('postal_code')) {
        components.zipCode = component.long_name;
      }
      if (types.includes('country')) {
        components.country = component.long_name;
      }
    });

    // Set streetAddress as alias for street
    components.streetAddress = components.street;

    // Update the input value with the full address
    if (inputRef.current && components.fullAddress) {
      inputRef.current.value = components.fullAddress;
    }

    // Call onChange with full address string using latest ref
    if (onChangeRef.current) {
      onChangeRef.current(components.fullAddress || '', components);
    }

    // Call onAddressSelect with parsed components using latest ref
    if (onAddressSelectRef.current) {
      onAddressSelectRef.current(components);
    }
  }, []); // Empty deps - never changes

  useEffect(() => {
    if (!apiReady || !inputRef.current || disabled) {
      return;
    }

    // Initialize autocomplete
    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: countries },
        fields: ['address_components', 'formatted_address', 'geometry'],
      });

      // Listen for place selection
      autocompleteRef.current.addListener('place_changed', handlePlaceChanged);
    } catch (error) {
      console.error('Failed to initialize autocomplete:', error);
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [apiReady, disabled, handlePlaceChanged, countries]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  const handleBlur = useCallback(() => {
    const currentValue = inputRef.current?.value || value;
    if (!currentValue || currentValue.trim().length < 5) return;
    
    const hasComma = currentValue.includes(',');
    const hasZip = /\d{5}/.test(currentValue);
    
    if (hasComma || hasZip) {
      const parsed = parseAddressString(currentValue);
      
      if (parsed.city || parsed.state || parsed.zipCode) {
        if (parsed.street) {
          if (onChangeRef.current) {
            onChangeRef.current(parsed.street, parsed);
          }
        }
        if (onAddressSelectRef.current) {
          onAddressSelectRef.current(parsed);
        }
      }
    }
  }, [value]);

  return (
    <div className={className}>
      {label && (
        <Label htmlFor={testId} className="mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
        </div>
        <Input
          ref={inputRef}
          type="text"
          id={testId}
          value={value}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="pl-10"
          data-testid={testId}
          autoComplete="off"
        />
      </div>
      {!apiReady && !isLoading && (
        <p className="text-xs text-muted-foreground mt-1">
          Enter full address with city, state and zip. Fields will auto-fill on blur.
        </p>
      )}
    </div>
  );
}
