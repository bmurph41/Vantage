import { useEffect, useRef, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { useGoogleMaps } from '@/lib/google-maps-provider';

export interface AddressComponents {
  street?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  fullAddress?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  source?: 'google' | 'manual';
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

const COUNTRY_TOKENS = new Set([
  'united states', 'usa', 'us', 'u.s.', 'u.s.a.', 'america',
  'canada', 'ca', 'can'
]);

function isCountryToken(str: string): boolean {
  return COUNTRY_TOKENS.has(str.toLowerCase().trim());
}

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
  
  let parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return result;
  
  while (parts.length > 1 && isCountryToken(parts[parts.length - 1])) {
    parts = parts.slice(0, -1);
  }
  
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
    const parsed = parseCityStateZip(lastPart);
    
    if (parsed.state && parsed.zipCode) {
      result.state = parsed.state;
      result.zipCode = parsed.zipCode;
      if (parsed.city) {
        result.city = parsed.city;
      } else if (parts.length > 2) {
        result.city = parts[parts.length - 2];
      }
    } else if (parsed.zipCode) {
      result.zipCode = parsed.zipCode;
      const stateCandidate = parts[parts.length - 2];
      const stateAbbrev = normalizeState(stateCandidate);
      if (stateAbbrev) {
        result.state = stateAbbrev;
        if (parts.length > 3) {
          result.city = parts[parts.length - 3];
        }
      }
    } else {
      const stateAbbrev = normalizeState(lastPart);
      if (stateAbbrev) {
        result.state = stateAbbrev;
        if (parts.length > 2) {
          result.city = parts[parts.length - 2];
        }
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
  biasCenter?: { lat: number; lng: number };
  biasRadiusMeters?: number;
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
  biasCenter,
  biasRadiusMeters = 50000,
}: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const { isLoaded, loadError } = useGoogleMaps();

  const onChangeRef = useRef(onChange);
  const onAddressSelectRef = useRef(onAddressSelect);

  useEffect(() => {
    onChangeRef.current = onChange;
    onAddressSelectRef.current = onAddressSelect;
  }, [onChange, onAddressSelect]);

  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();

    if (!place || !place.address_components) {
      const domValue = inputRef.current?.value;
      if (domValue && domValue.includes(',')) {
        const parsed = parseAddressString(domValue);
        parsed.source = 'google';
        if (parsed.city || parsed.state || parsed.zipCode) {
          if (onChangeRef.current) {
            onChangeRef.current(parsed.street || domValue, parsed);
          }
          if (onAddressSelectRef.current) {
            onAddressSelectRef.current(parsed);
          }
        }
      }
      return;
    }

    const rawComponents = place.address_components.map(c => ({
      long_name: c.long_name,
      short_name: c.short_name,
      types: c.types,
    }));

    const components: AddressComponents = {
      fullAddress: place.formatted_address || '',
      placeId: place.place_id,
      lat: place.geometry?.location?.lat(),
      lng: place.geometry?.location?.lng(),
      source: 'google',
    };

    (components as any)._rawDebug = JSON.stringify(rawComponents);

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
      if (types.includes('locality') || types.includes('sublocality_level_1')) {
        if (!components.city) {
          components.city = component.long_name;
        }
      }
      if (types.includes('administrative_area_level_1')) {
        components.state = component.short_name;
      }
      if (types.includes('postal_code')) {
        components.zipCode = component.long_name;
      }
      if (types.includes('country')) {
        components.country = component.long_name;
      }
    });

    (components as any)._afterLoop = `state=${String(components.state)} zip=${String(components.zipCode)}`;

    if (components.fullAddress && (!components.state || !components.zipCode || !components.city)) {
      const parsed = parseAddressString(components.fullAddress);
      (components as any)._fallbackParsed = `state=${parsed.state} zip=${parsed.zipCode}`;
      if (!components.city && parsed.city) components.city = parsed.city;
      if (!components.state && parsed.state) components.state = parsed.state;
      if (!components.zipCode && parsed.zipCode) components.zipCode = parsed.zipCode;
      if (!components.street && parsed.street) components.street = parsed.street;
    }

    (components as any)._afterFallback = `state=${String(components.state)} zip=${String(components.zipCode)}`;

    components.streetAddress = components.street;

    if (inputRef.current && components.street) {
      inputRef.current.value = components.street;
    }

    if (onChangeRef.current) {
      onChangeRef.current(components.street || components.fullAddress || '', components);
    }

    if (onAddressSelectRef.current) {
      onAddressSelectRef.current(components);
    }

    requestAnimationFrame(() => {
      if (onAddressSelectRef.current) {
        onAddressSelectRef.current(components);
      }
    });
  }, []);

  const countriesKey = useMemo(() => JSON.stringify(countries), [countries]);
  const biasCenterKey = useMemo(() => biasCenter ? `${biasCenter.lat},${biasCenter.lng}` : '', [biasCenter]);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || disabled) {
      return;
    }

    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: countries },
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
      });

      if (biasCenter) {
        const circle = new google.maps.Circle({
          center: biasCenter,
          radius: biasRadiusMeters,
        });
        autocompleteRef.current.setBounds(circle.getBounds() as google.maps.LatLngBounds);
      }

      autocompleteRef.current.addListener('place_changed', handlePlaceChanged);
    } catch (error) {
      console.error('Failed to initialize autocomplete:', error);
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, disabled, handlePlaceChanged, countriesKey, biasCenterKey, biasRadiusMeters]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  const handleBlur = useCallback(() => {
    const domValue = inputRef.current?.value;
    const currentValue = domValue || value;
    if (!currentValue || currentValue.trim().length < 5) return;
    
    const hasComma = currentValue.includes(',');
    const hasZip = /\d{5}/.test(currentValue);
    
    if (hasComma || hasZip) {
      const parsed = parseAddressString(currentValue);
      parsed.source = 'manual';
      
      if (parsed.city || parsed.state || parsed.zipCode) {
        if (parsed.street && onChangeRef.current) {
          onChangeRef.current(parsed.street, parsed);
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
          {!isLoaded && !loadError ? (
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
          className="pl-10 bg-white dark:bg-slate-900"
          data-testid={testId}
          autoComplete="off"
        />
      </div>
      {!isLoaded && loadError && (
        <p className="text-xs text-muted-foreground mt-1">
          Enter full address with city, state and zip. Fields will auto-fill on blur.
        </p>
      )}
    </div>
  );
}
