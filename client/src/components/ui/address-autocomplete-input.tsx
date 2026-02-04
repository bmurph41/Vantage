import { useEffect, useMemo, useRef, useState } from "react";
import { useGoogleMaps } from "@/lib/google-maps-provider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type NormalizedAddress = {
  formattedAddress?: string;
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
};

export type PlaceSearchType = "address" | "establishment" | "geocode" | "(regions)" | "(cities)" | "all";

type Props = {
  value?: string;
  onChangeText?: (text: string) => void;
  onSelectAddress: (addr: NormalizedAddress) => void;
  placeholder?: string;
  className?: string;
  countryCode?: string;
  disabled?: boolean;
  inputId?: string;
  biasCenter?: { lat: number; lng: number };
  biasRadiusMeters?: number;
  searchType?: PlaceSearchType;
};

function getComponent(components: google.maps.GeocoderAddressComponent[], type: string) {
  return components.find(c => c.types.includes(type))?.long_name;
}

function getComponentShort(components: google.maps.GeocoderAddressComponent[], type: string) {
  return components.find(c => c.types.includes(type))?.short_name;
}

function normalizePlace(place: google.maps.places.PlaceResult): NormalizedAddress {
  const comps = place.address_components ?? [];

  const streetNumber = getComponent(comps, "street_number");
  const route = getComponent(comps, "route");
  const subpremise = getComponent(comps, "subpremise");

  const city =
    getComponent(comps, "locality") ||
    getComponent(comps, "postal_town") ||
    getComponent(comps, "sublocality") ||
    getComponent(comps, "administrative_area_level_2");

  const state = getComponentShort(comps, "administrative_area_level_1");
  const postalCode = getComponent(comps, "postal_code");
  const country = getComponent(comps, "country");

  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim() || undefined;
  const line2 = subpremise ? `Unit ${subpremise}` : undefined;

  const loc = place.geometry?.location;
  const lat = loc ? loc.lat() : undefined;
  const lng = loc ? loc.lng() : undefined;

  return {
    formattedAddress: place.formatted_address,
    name: place.name || undefined,
    line1,
    line2,
    city: city || undefined,
    state: state || undefined,
    postalCode: postalCode || undefined,
    country: country || undefined,
    placeId: place.place_id,
    lat,
    lng,
  };
}

export function AddressAutocompleteInput({
  value,
  onChangeText,
  onSelectAddress,
  placeholder = "Start typing an address or place name...",
  className,
  countryCode = "us",
  disabled,
  inputId,
  biasCenter,
  biasRadiusMeters = 50000,
  searchType = "all",
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [internalValue, setInternalValue] = useState(value ?? "");
  const { isLoaded } = useGoogleMaps();

  useEffect(() => {
    if (typeof value === "string" && value !== internalValue) {
      setInternalValue(value);
    }
  }, [value]);

  const componentRestrictions = useMemo(
    () => (countryCode ? { country: countryCode } : undefined),
    [countryCode]
  );

  const autocompleteTypes = useMemo(() => {
    if (searchType === "all") {
      return undefined;
    }
    return [searchType];
  }, [searchType]);

  const onSelectAddressRef = useRef(onSelectAddress);
  const onChangeTextRef = useRef(onChangeText);
  
  useEffect(() => {
    onSelectAddressRef.current = onSelectAddress;
    onChangeTextRef.current = onChangeText;
  }, [onSelectAddress, onChangeText]);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    try {
      const options: google.maps.places.AutocompleteOptions = {
        componentRestrictions,
      };
      
      if (autocompleteTypes) {
        options.types = autocompleteTypes;
      }

      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, options);

      autocompleteRef.current.setFields?.([
        "address_components",
        "formatted_address",
        "geometry",
        "place_id",
        "name",
      ]);

      if (biasCenter) {
        const circle = new google.maps.Circle({
          center: biasCenter,
          radius: biasRadiusMeters,
        });
        autocompleteRef.current.setBounds(circle.getBounds() as google.maps.LatLngBounds);
      }

      const listener = autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current!.getPlace();
        const normalized = normalizePlace(place);

        const nextText = normalized.name || normalized.formattedAddress || inputRef.current!.value;
        setInternalValue(nextText);
        onChangeTextRef.current?.(nextText);

        onSelectAddressRef.current(normalized);
      });

      return () => {
        if (listener) listener.remove();
        if (autocompleteRef.current) {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
      };
    } catch (error) {
      console.error("Failed to initialize Google Maps autocomplete:", error);
    }
  }, [isLoaded, componentRestrictions, autocompleteTypes, biasCenter, biasRadiusMeters]);

  return (
    <Input
      id={inputId}
      ref={inputRef}
      disabled={disabled}
      value={internalValue}
      placeholder={placeholder}
      className={cn(className)}
      onChange={(e) => {
        setInternalValue(e.target.value);
        onChangeText?.(e.target.value);
      }}
      autoComplete="off"
    />
  );
}
