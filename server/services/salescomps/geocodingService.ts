import { Client, GeocodeResult, PlaceAutocompleteType } from "@googlemaps/google-maps-services-js";
import { db } from "../../db";
import { geocodeCache } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

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
  fromCache?: boolean;
}

export interface AddressComponents {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface AutocompleteSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

export interface GeocodingStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  apiCalls: number;
  errors: number;
  hitRate: number;
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
  private cacheHits = 0;
  private cacheMisses = 0;
  private apiCalls = 0;
  private errorCount = 0;
  private lastRequestTime = 0;
  private readonly RATE_LIMIT_MS = 100;
  private readonly CACHE_EXPIRY_DAYS = 90;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
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
  }

  private normalizeAddress(components: AddressComponents): string {
    return [
      components.address?.trim().toLowerCase(),
      components.city?.trim().toLowerCase(),
      components.state?.trim().toLowerCase(),
      components.zip?.trim(),
      (components.country || 'usa').trim().toLowerCase(),
    ].filter(Boolean).join('|');
  }

  private hashAddress(normalizedAddress: string): string {
    return crypto.createHash('sha256').update(normalizedAddress).digest('hex');
  }

  private async checkCache(addressHash: string): Promise<GeocodingResult | null> {
    try {
      const [cached] = await db
        .select()
        .from(geocodeCache)
        .where(eq(geocodeCache.addressHash, addressHash))
        .limit(1);

      if (cached && cached.status === 'success' && cached.lat && cached.lng) {
        const now = new Date();
        const isExpired = cached.expiresAt && new Date(cached.expiresAt) < now;
        
        if (isExpired) {
          this.cacheMisses++;
          return null;
        }

        await db
          .update(geocodeCache)
          .set({
            hitCount: sql`${geocodeCache.hitCount} + 1`,
            lastHitAt: new Date(),
          })
          .where(eq(geocodeCache.id, cached.id));

        this.cacheHits++;
        return {
          lat: parseFloat(cached.lat),
          lng: parseFloat(cached.lng),
          formattedAddress: cached.formattedAddress || '',
          placeId: cached.placeId || '',
          county: cached.county,
          country: cached.country || 'US',
          geocodeAccuracy: (cached.geocodeAccuracy as GeocodingResult['geocodeAccuracy']) || 'approximate',
          timezone: cached.timezone || undefined,
          fromCache: true,
        };
      }
      
      this.cacheMisses++;
      return null;
    } catch (error) {
      console.error('[Geocoding] Cache check error:', error);
      return null;
    }
  }

  private async saveToCache(
    addressHash: string,
    originalAddress: string,
    result: GeocodingResult | null,
    errorMessage?: string
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.CACHE_EXPIRY_DAYS);

      await db
        .insert(geocodeCache)
        .values({
          addressHash,
          originalAddress,
          formattedAddress: result?.formattedAddress || null,
          lat: result?.lat?.toString() || null,
          lng: result?.lng?.toString() || null,
          placeId: result?.placeId || null,
          county: result?.county || null,
          country: result?.country || null,
          geocodeAccuracy: result?.geocodeAccuracy || null,
          timezone: result?.timezone || null,
          status: result ? 'success' : (errorMessage ? 'error' : 'not_found'),
          errorMessage: errorMessage || null,
          expiresAt,
          hitCount: 0,
        })
        .onConflictDoUpdate({
          target: geocodeCache.addressHash,
          set: {
            formattedAddress: result?.formattedAddress || null,
            lat: result?.lat?.toString() || null,
            lng: result?.lng?.toString() || null,
            placeId: result?.placeId || null,
            county: result?.county || null,
            country: result?.country || null,
            geocodeAccuracy: result?.geocodeAccuracy || null,
            timezone: result?.timezone || null,
            status: result ? 'success' : (errorMessage ? 'error' : 'not_found'),
            errorMessage: errorMessage || null,
            expiresAt,
          },
        });
    } catch (error) {
      console.error('[Geocoding] Cache save error:', error);
    }
  }

  async geocodeAddress(components: AddressComponents, skipCache = false): Promise<GeocodingResult | null> {
    this.requestCount++;

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

    const normalizedAddress = this.normalizeAddress(components);
    const addressHash = this.hashAddress(normalizedAddress);
    const fullAddress = addressParts.join(', ');

    if (!skipCache) {
      const cached = await this.checkCache(addressHash);
      if (cached) {
        return cached;
      }
    }

    try {
      await this.rateLimit();
      this.apiCalls++;

      const response = await client.geocode({
        params: {
          address: fullAddress,
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        console.warn(`[Geocoding] No results for: ${fullAddress}`);
        await this.saveToCache(addressHash, fullAddress, null);
        return null;
      }

      const result = response.data.results[0];
      const geocodeResult = this.parseGeocodeResult(result);
      
      await this.saveToCache(addressHash, fullAddress, geocodeResult);
      
      return geocodeResult;
    } catch (error: any) {
      this.errorCount++;
      const errorMessage = error?.message || 'Unknown error';
      console.error('[Geocoding] Error:', errorMessage);
      await this.saveToCache(addressHash, fullAddress, null, errorMessage);
      return null;
    }
  }

  async geocodeByPlaceId(placeId: string): Promise<GeocodingResult | null> {
    if (!this.apiKey || !placeId) {
      return null;
    }

    try {
      const [cached] = await db
        .select()
        .from(geocodeCache)
        .where(eq(geocodeCache.placeId, placeId))
        .limit(1);

      if (cached && cached.status === 'success' && cached.lat && cached.lng) {
        this.cacheHits++;
        return {
          lat: parseFloat(cached.lat),
          lng: parseFloat(cached.lng),
          formattedAddress: cached.formattedAddress || '',
          placeId: cached.placeId || '',
          county: cached.county,
          country: cached.country || 'US',
          geocodeAccuracy: (cached.geocodeAccuracy as GeocodingResult['geocodeAccuracy']) || 'approximate',
          fromCache: true,
        };
      }

      await this.rateLimit();
      this.apiCalls++;

      const response = await client.geocode({
        params: {
          place_id: placeId,
          key: this.apiKey,
        },
      });

      if (response.data.status !== 'OK' || !response.data.results.length) {
        return null;
      }

      const result = response.data.results[0];
      const geocodeResult = this.parseGeocodeResult(result);

      const addressHash = this.hashAddress(placeId);
      await this.saveToCache(addressHash, `place_id:${placeId}`, geocodeResult);

      return geocodeResult;
    } catch (error) {
      this.errorCount++;
      console.error('[Geocoding] Place ID geocode error:', error);
      return null;
    }
  }

  async getAddressAutocomplete(
    input: string,
    sessionToken?: string
  ): Promise<AutocompleteSuggestion[]> {
    if (!this.apiKey || !input || input.length < 3) {
      return [];
    }

    try {
      await this.rateLimit();
      this.apiCalls++;

      const response = await client.placeAutocomplete({
        params: {
          input,
          key: this.apiKey,
          types: PlaceAutocompleteType.address,
          components: ['country:us'],
          sessiontoken: sessionToken,
        },
      });

      if (response.data.status !== 'OK' || !response.data.predictions.length) {
        return [];
      }

      return response.data.predictions.map(prediction => ({
        placeId: prediction.place_id,
        description: prediction.description,
        mainText: prediction.structured_formatting?.main_text || prediction.description,
        secondaryText: prediction.structured_formatting?.secondary_text || '',
        types: prediction.types || [],
      }));
    } catch (error) {
      this.errorCount++;
      console.error('[Geocoding] Autocomplete error:', error);
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
    if (!this.apiKey) {
      console.warn('[Geocoding] API key not configured');
      return null;
    }

    const coordHash = this.hashAddress(`${lat.toFixed(6)},${lng.toFixed(6)}`);
    const cached = await this.checkCache(coordHash);
    if (cached) {
      return cached;
    }

    try {
      await this.rateLimit();
      this.apiCalls++;

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
      const geocodeResult = this.parseGeocodeResult(result);
      
      await this.saveToCache(coordHash, `${lat},${lng}`, geocodeResult);
      
      return geocodeResult;
    } catch (error) {
      this.errorCount++;
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
      this.apiCalls++;

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
      this.errorCount++;
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

  getStats(): GeocodingStats {
    const totalRequests = this.requestCount;
    return {
      totalRequests,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      apiCalls: this.apiCalls,
      errors: this.errorCount,
      hitRate: totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0,
    };
  }

  resetStats(): void {
    this.requestCount = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.apiCalls = 0;
    this.errorCount = 0;
  }

  getRequestCount(): number {
    return this.requestCount;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const geocodingService = new GeocodingService();
