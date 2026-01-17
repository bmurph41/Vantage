import { Loader } from "@googlemaps/js-api-loader";

let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (!loaderPromise) {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    if (!apiKey) {
      throw new Error("Missing VITE_GOOGLE_MAPS_API_KEY");
    }

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    });

    loaderPromise = loader.load();
  }

  return loaderPromise;
}
