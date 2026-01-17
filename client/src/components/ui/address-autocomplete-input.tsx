import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type NormalizedAddress = {
  formattedAddress?: string;
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
  placeholder = "Start typing an address...",
  className,
  countryCode = "us",
  disabled,
  inputId,
  biasCenter,
  biasRadiusMeters = 50000,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [internalValue, setInternalValue] = useState(value ?? "");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof value === "string" && value !== internalValue) {
      setInternalValue(value);
    }
  }, [value]);

  const componentRestrictions = useMemo(
    () => (countryCode ? { country: countryCode } : undefined),
    [countryCode]
  );

  useEffect(() => {
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let listener: google.maps.MapsEventListener | null = null;

    (async () => {
      try {
        const g = await loadGoogleMaps();
        setIsLoaded(true);
        if (!inputRef.current) return;

        autocomplete = new g.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          componentRestrictions,
        });

        autocomplete.setFields?.([
          "address_components",
          "formatted_address",
          "geometry",
          "place_id",
        ]);

        if (biasCenter) {
          const circle = new g.maps.Circle({
            center: biasCenter,
            radius: biasRadiusMeters,
          });
          autocomplete.setBounds(circle.getBounds() as google.maps.LatLngBounds);
        }

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete!.getPlace();
          const normalized = normalizePlace(place);

          const nextText = normalized.formattedAddress ?? inputRef.current!.value;
          setInternalValue(nextText);
          onChangeText?.(nextText);

          onSelectAddress(normalized);
        });
      } catch (error) {
        console.error("Failed to load Google Maps:", error);
      }
    })();

    return () => {
      if (listener) listener.remove();
      autocomplete = null;
    };
  }, [componentRestrictions, biasCenter, biasRadiusMeters, onChangeText, onSelectAddress]);

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
