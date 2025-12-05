import { Client, GeocodeResult } from "@googlemaps/google-maps-services-js";

const client = new Client({});

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
  county: string | null;
  country: string;
  geocodeAccuracy: 'rooftop' | 'range_interpolated' | 'geometric_center' | 'approximate';
  timezone?: string;
}

export interface AddressComponents {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

const LOCATION_TYPE_MAP: Record<string, GeocodingResult['geocodeAccuracy']> = {
  'ROOFTOP': 'rooftop',
  'RANGE_INTERPOLATED': 'range_interpolated',
  'GEOMETRIC_CENTER': 'geometric_center',
  'APPROXIMATE': 'approximate',
};

export class GeocodingService {
  private apiKey: string;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly RATE_LIMIT_MS = 100; // 10 requests per second max

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Geocoding] No GOOGLE_MAPS_API_KEY found - geocoding will be disabled');
    }
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, this.RATE_LIMIT_MS - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  async geocodeAddress(components: AddressComponents): Promise<GeocodingResult | null> {
    if (!this.apiKey) {
      console.warn('[Geocoding] API key not configured');
      return null;
    }

    const addressParts = [
      components.address,
      components.city,
      components.state,
      components.zip,
      components.country || 'USA',
    ].filter(Boolean);

    if (addressParts.length < 2) {
      console.warn('[Geocoding] Insufficient address components');
      return null;
    }

    const address = addressParts.join(', ');

    try {
      await this.rateLimit();

      const response = await client.geocode({
        params: {
          address,
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        console.warn(`[Geocoding] No results for: ${address}`);
        return null;
      }

      const result = response.data.results[0];
      return this.parseGeocodeResult(result);
    } catch (error) {
      console.error('[Geocoding] Error:', error);
      return null;
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
    if (!this.apiKey) {
      console.warn('[Geocoding] API key not configured');
      return null;
    }

    try {
      await this.rateLimit();

      const response = await client.reverseGeocode({
        params: {
          latlng: { lat, lng },
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        console.warn(`[Geocoding] No results for coordinates: ${lat}, ${lng}`);
        return null;
      }

      const result = response.data.results[0];
      return this.parseGeocodeResult(result);
    } catch (error) {
      console.error('[Geocoding] Reverse geocode error:', error);
      return null;
    }
  }

  async getTimezone(lat: number, lng: number): Promise<string | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      await this.rateLimit();

      const response = await client.timezone({
        params: {
          location: { lat, lng },
          timestamp: Math.floor(Date.now() / 1000),
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK') {
        return null;
      }

      return response.data.timeZoneId;
    } catch (error) {
      console.error('[Geocoding] Timezone error:', error);
      return null;
    }
  }

  private parseGeocodeResult(result: GeocodeResult): GeocodingResult {
    const location = result.geometry.location;
    const locationType = result.geometry.location_type as string;

    let county: string | null = null;
    let country = 'US';

    for (const component of result.address_components) {
      if (component.types.includes('administrative_area_level_2')) {
        county = component.long_name.replace(' County', '');
      }
      if (component.types.includes('country')) {
        country = component.short_name;
      }
    }

    return {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      county,
      country,
      geocodeAccuracy: LOCATION_TYPE_MAP[locationType] || 'approximate',
    };
  }

  async batchGeocode(
    addresses: AddressComponents[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<(GeocodingResult | null)[]> {
    const results: (GeocodingResult | null)[] = [];
    
    for (let i = 0; i < addresses.length; i++) {
      const result = await this.geocodeAddress(addresses[i]);
      results.push(result);
      
      if (onProgress) {
        onProgress(i + 1, addresses.length);
      }
    }
    
    return results;
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const geocodingService = new GeocodingService();
