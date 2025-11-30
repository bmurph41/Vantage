interface DriveTimeResult {
  durationMinutes: number;
  distanceMiles: number;
  status: 'ok' | 'error' | 'no_route';
  errorMessage?: string;
}

interface DriveTimeEstimate {
  estimatedMiles: number;
  calculatedMiles: number | null;
  isEstimate: boolean;
  source: 'google_api' | 'estimate';
}

const DRIVE_TIME_ESTIMATES: Record<number, number> = {
  5: 3,
  10: 5,
  15: 8,
  20: 12,
  30: 18,
  45: 28,
  60: 40
};

export class DriveTimeService {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json';
  private cache: Map<string, { result: DriveTimeResult; timestamp: number }> = new Map();
  private cacheTTL = 24 * 60 * 60 * 1000;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || '';
  }

  async getDriveTimeDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ): Promise<DriveTimeResult> {
    if (!this.apiKey) {
      return {
        durationMinutes: 0,
        distanceMiles: 0,
        status: 'error',
        errorMessage: 'Google Maps API key not configured'
      };
    }

    const cacheKey = `${originLat.toFixed(4)},${originLng.toFixed(4)}-${destLat.toFixed(4)},${destLng.toFixed(4)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result;
    }

    try {
      const params = new URLSearchParams({
        origins: `${originLat},${originLng}`,
        destinations: `${destLat},${destLng}`,
        mode: 'driving',
        units: 'imperial',
        key: this.apiKey
      });

      const response = await fetch(`${this.baseUrl}?${params}`);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        return {
          durationMinutes: 0,
          distanceMiles: 0,
          status: 'error',
          errorMessage: data.error_message || `API status: ${data.status}`
        };
      }

      const element = data.rows?.[0]?.elements?.[0];
      if (!element || element.status !== 'OK') {
        return {
          durationMinutes: 0,
          distanceMiles: 0,
          status: 'no_route',
          errorMessage: element?.status || 'No route found'
        };
      }

      const result: DriveTimeResult = {
        durationMinutes: Math.round(element.duration.value / 60),
        distanceMiles: Math.round(element.distance.value / 1609.34 * 10) / 10,
        status: 'ok'
      };

      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error: any) {
      console.error('Drive time API error:', error);
      return {
        durationMinutes: 0,
        distanceMiles: 0,
        status: 'error',
        errorMessage: error.message || 'Network error'
      };
    }
  }

  async getEstimatedRadiusForDriveTime(
    centerLat: number,
    centerLng: number,
    targetMinutes: number
  ): Promise<DriveTimeEstimate> {
    const fallbackMiles = DRIVE_TIME_ESTIMATES[targetMinutes] || Math.round(targetMinutes * 0.7);

    if (!this.apiKey) {
      return {
        estimatedMiles: fallbackMiles,
        calculatedMiles: null,
        isEstimate: true,
        source: 'estimate'
      };
    }

    try {
      const sampleDirections = [0, 90, 180, 270];
      const results: number[] = [];

      for (const direction of sampleDirections) {
        const testDistance = fallbackMiles * 1.5;
        const radians = direction * (Math.PI / 180);
        const destLat = centerLat + (testDistance / 69) * Math.cos(radians);
        const destLng = centerLng + (testDistance / (69 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(radians);

        const result = await this.getDriveTimeDistance(centerLat, centerLng, destLat, destLng);
        
        if (result.status === 'ok' && result.durationMinutes > 0) {
          const milesPerMinute = result.distanceMiles / result.durationMinutes;
          const estimatedMiles = milesPerMinute * targetMinutes;
          results.push(estimatedMiles);
        }
      }

      if (results.length > 0) {
        const avgMiles = results.reduce((a, b) => a + b, 0) / results.length;
        return {
          estimatedMiles: fallbackMiles,
          calculatedMiles: Math.round(avgMiles * 10) / 10,
          isEstimate: false,
          source: 'google_api'
        };
      }

      return {
        estimatedMiles: fallbackMiles,
        calculatedMiles: null,
        isEstimate: true,
        source: 'estimate'
      };
    } catch (error) {
      console.error('Drive time estimation error:', error);
      return {
        estimatedMiles: fallbackMiles,
        calculatedMiles: null,
        isEstimate: true,
        source: 'estimate'
      };
    }
  }

  async validateDriveTimeRadius(
    centerLat: number,
    centerLng: number,
    proposedMiles: number,
    targetMinutes: number
  ): Promise<{
    isAccurate: boolean;
    actualMinutes: number | null;
    suggestedMiles: number;
    source: 'google_api' | 'estimate';
  }> {
    if (!this.apiKey) {
      return {
        isAccurate: false,
        actualMinutes: null,
        suggestedMiles: proposedMiles,
        source: 'estimate'
      };
    }

    try {
      const directions = [0, 45, 90, 135, 180, 225, 270, 315];
      const samples: { actualMinutes: number; actualMiles: number }[] = [];

      for (const direction of directions) {
        const radians = direction * (Math.PI / 180);
        const destLat = centerLat + (proposedMiles / 69) * Math.cos(radians);
        const destLng = centerLng + (proposedMiles / (69 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(radians);

        const result = await this.getDriveTimeDistance(centerLat, centerLng, destLat, destLng);
        
        if (result.status === 'ok') {
          samples.push({
            actualMinutes: result.durationMinutes,
            actualMiles: result.distanceMiles
          });
        }
      }

      if (samples.length === 0) {
        return {
          isAccurate: false,
          actualMinutes: null,
          suggestedMiles: proposedMiles,
          source: 'estimate'
        };
      }

      const avgMinutes = samples.reduce((sum, s) => sum + s.actualMinutes, 0) / samples.length;
      const avgMiles = samples.reduce((sum, s) => sum + s.actualMiles, 0) / samples.length;

      const isAccurate = Math.abs(avgMinutes - targetMinutes) <= targetMinutes * 0.2;
      
      let suggestedMiles = proposedMiles;
      if (!isAccurate && avgMinutes > 0) {
        suggestedMiles = Math.round((proposedMiles * targetMinutes / avgMinutes) * 10) / 10;
      }

      return {
        isAccurate,
        actualMinutes: Math.round(avgMinutes),
        suggestedMiles,
        source: 'google_api'
      };
    } catch (error) {
      console.error('Drive time validation error:', error);
      return {
        isAccurate: false,
        actualMinutes: null,
        suggestedMiles: proposedMiles,
        source: 'estimate'
      };
    }
  }
}

export const driveTimeService = new DriveTimeService();
