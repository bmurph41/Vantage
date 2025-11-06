import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: {
    fullAddress: string;
    city: string;
    state: string;
    zip: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Enter full address...",
  disabled = false,
  "data-testid": dataTestId,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadGoogleMapsScript = () => {
      if (typeof google !== "undefined" && google.maps) {
        initializeAutocomplete();
        return;
      }

      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        // Script is loading, wait for it
        const checkGoogle = setInterval(() => {
          if (typeof google !== "undefined" && google.maps) {
            clearInterval(checkGoogle);
            initializeAutocomplete();
          }
        }, 100);
        return;
      }

      // Load the script - fetch API key from backend
      fetch('/api/config/google-maps-key')
        .then(res => res.json())
        .then(data => {
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${data.apiKey}&libraries=places`;
          script.async = true;
          script.defer = true;
          script.onload = () => {
            initializeAutocomplete();
          };
          document.head.appendChild(script);
        })
        .catch(err => {
          console.error('Failed to load Google Maps API key:', err);
        });
    };

    const initializeAutocomplete = () => {
      if (!inputRef.current || !google?.maps?.places) return;

      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: ["us", "ca"] },
        fields: ["address_components", "formatted_address"],
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        if (!place?.address_components) return;

        setIsLoading(true);

        let city = "";
        let state = "";
        let zip = "";
        const fullAddress = place.formatted_address || "";

        for (const component of place.address_components) {
          const types = component.types;

          if (types.includes("locality")) {
            city = component.long_name;
          }
          if (types.includes("administrative_area_level_1")) {
            state = component.short_name;
          }
          if (types.includes("postal_code")) {
            zip = component.long_name;
          }
        }

        onChange(fullAddress);

        if (onAddressSelect) {
          onAddressSelect({
            fullAddress,
            city,
            state,
            zip,
          });
        }

        setIsLoading(false);
      });
    };

    loadGoogleMapsScript();

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={dataTestId}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
