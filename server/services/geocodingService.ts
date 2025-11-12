import axios from 'axios';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export interface GeocodeError {
  error: string;
  status: string;
}

interface CachedResult {
  result: GeocodeResult;
  cachedAt: number;
}

class GeocodingService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
  private cache: Map<string, CachedResult> = new Map();
  private cacheTTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ GOOGLE_MAPS_API_KEY not configured. Geocoding will fail.');
    }
  }

  private normalizeAddress(address: string): string {
    return address.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private getCachedResult(address: string): GeocodeResult | null {
    const key = this.normalizeAddress(address);
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.cachedAt;
    if (age > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  private setCachedResult(address: string, result: GeocodeResult): void {
    const key = this.normalizeAddress(address);
    this.cache.set(key, {
      result,
      cachedAt: Date.now(),
    });
  }

  async geocodeAddress(address: string): Promise<GeocodeResult | GeocodeError> {
    if (!this.apiKey) {
      return {
        error: 'Google Maps API key not configured',
        status: 'API_KEY_MISSING'
      };
    }

    if (!address || address.trim() === '') {
      return {
        error: 'Address is required',
        status: 'INVALID_REQUEST'
      };
    }

    const cachedResult = this.getCachedResult(address);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          address: address.trim(),
          key: this.apiKey,
        },
        timeout: 10000,
      });

      const data = response.data;

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const location = result.geometry.location;

        const geocodeResult: GeocodeResult = {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address,
        };

        this.setCachedResult(address, geocodeResult);
        return geocodeResult;
      }

      return {
        error: data.error_message || 'Geocoding failed',
        status: data.status,
      };
    } catch (error: any) {
      console.error('Geocoding API error:', error.message);
      
      if (error.response) {
        return {
          error: error.response.data?.error_message || 'API request failed',
          status: error.response.data?.status || 'REQUEST_FAILED',
        };
      }

      return {
        error: error.message || 'Network error',
        status: 'NETWORK_ERROR',
      };
    }
  }

  buildAddressString(components: {
    marina?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  }): string {
    const parts: string[] = [];

    if (components.address) {
      parts.push(components.address);
    }

    if (components.city) {
      parts.push(components.city);
    }

    if (components.state) {
      parts.push(components.state);
    }

    if (components.zip) {
      parts.push(components.zip);
    }

    if (parts.length === 0 && components.marina) {
      return components.marina;
    }

    return parts.join(', ');
  }
}

export const geocodingService = new GeocodingService();
