import { Loader } from "@googlemaps/js-api-loader";

let loaderPromise: Promise<typeof google> | null = null;
let loadError: Error | null = null;
let isConfigError = false;

export function loadGoogleMaps(): Promise<typeof google> {
  if (loadError && isConfigError) {
    return Promise.reject(loadError);
  }

  if (!loaderPromise) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    if (!apiKey) {
      loadError = new Error("Google Maps API key not configured. Please set VITE_GOOGLE_MAPS_API_KEY.");
      isConfigError = true;
      return Promise.reject(loadError);
    }

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });

    loaderPromise = loader.load().catch((error) => {
      loadError = error instanceof Error 
        ? error 
        : new Error(`Failed to load Google Maps: ${String(error)}`);
      loaderPromise = null;
      throw loadError;
    });
  }

  return loaderPromise;
}

export function isGoogleMapsAvailable(): boolean {
  return typeof google !== 'undefined' && typeof google.maps !== 'undefined';
}

export function resetGoogleMapsLoader(): void {
  loaderPromise = null;
  loadError = null;
}
