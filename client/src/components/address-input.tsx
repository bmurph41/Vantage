import { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface AddressComponents {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  fullAddress?: string;
  lat?: number;
  lng?: number;
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
            console.log('Failed to fetch Google Maps API key from backend:', err);
          }
        }
        
        if (!apiKey) {
          console.log('Google Maps API key not configured. Address autocomplete disabled.');
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
        console.error('Failed to load Google Maps API:', error);
        toast({
          title: 'Address Autocomplete Unavailable',
          description: 'Using manual address entry instead.',
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
    // Allow manual typing even when autocomplete is active
    if (onChange) {
      onChange(e.target.value);
    }
  };

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
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="pl-10"
          data-testid={testId}
          autoComplete="off" // Disable browser autocomplete to avoid conflicts
        />
      </div>
      {!apiReady && !isLoading && (
        <p className="text-xs text-gray-500 mt-1">
          Address autocomplete disabled. Enter address manually.
        </p>
      )}
    </div>
  );
}
