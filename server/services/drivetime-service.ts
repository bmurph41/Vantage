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

export interface IsochronePolygon {
  center: { lat: number; lng: number };
  targetMinutes: number;
  boundaryPoints: Array<{ lat: number; lng: number }>;
  approximateAreaSqMiles: number;
  generatedAt: string;
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
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
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
  /**
   * Batch Distance Matrix query — up to 25 destinations per request.
   * Results are cached individually using the same single-query cache.
   */
  async getDriveTimeBatch(
    originLat: number,
    originLng: number,
    destinations: Array<{ lat: number; lng: number }>
  ): Promise<DriveTimeResult[]> {
    if (!this.apiKey || destinations.length === 0) {
      return destinations.map(() => ({
        durationMinutes: 0,
        distanceMiles: 0,
        status: 'error' as const,
        errorMessage: !this.apiKey ? 'Google Maps API key not configured' : 'No destinations',
      }));
    }

    const results: DriveTimeResult[] = new Array(destinations.length);
    const uncachedIndices: number[] = [];

    // Check cache first
    for (let i = 0; i < destinations.length; i++) {
      const d = destinations[i];
      const cacheKey = `${originLat.toFixed(4)},${originLng.toFixed(4)}-${d.lat.toFixed(4)},${d.lng.toFixed(4)}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        results[i] = cached.result;
      } else {
        uncachedIndices.push(i);
      }
    }

    // Batch uncached in groups of 25
    for (let batchStart = 0; batchStart < uncachedIndices.length; batchStart += 25) {
      const batchIndices = uncachedIndices.slice(batchStart, batchStart + 25);
      const batchDests = batchIndices.map(i => destinations[i]);
      const destStr = batchDests.map(d => `${d.lat},${d.lng}`).join('|');

      try {
        const params = new URLSearchParams({
          origins: `${originLat},${originLng}`,
          destinations: destStr,
          mode: 'driving',
          units: 'imperial',
          key: this.apiKey,
        });

        const response = await fetch(`${this.baseUrl}?${params}`);
        if (!response.ok) throw new Error(`API request failed: ${response.status}`);
        const data = await response.json();

        if (data.status !== 'OK') {
          for (const idx of batchIndices) {
            results[idx] = { durationMinutes: 0, distanceMiles: 0, status: 'error', errorMessage: data.error_message };
          }
          continue;
        }

        const elements = data.rows?.[0]?.elements || [];
        for (let j = 0; j < batchIndices.length; j++) {
          const idx = batchIndices[j];
          const el = elements[j];
          if (el && el.status === 'OK') {
            const result: DriveTimeResult = {
              durationMinutes: Math.round(el.duration.value / 60),
              distanceMiles: Math.round(el.distance.value / 1609.34 * 10) / 10,
              status: 'ok',
            };
            results[idx] = result;
            const d = destinations[idx];
            const cacheKey = `${originLat.toFixed(4)},${originLng.toFixed(4)}-${d.lat.toFixed(4)},${d.lng.toFixed(4)}`;
            this.cache.set(cacheKey, { result, timestamp: Date.now() });
          } else {
            results[idx] = { durationMinutes: 0, distanceMiles: 0, status: 'no_route', errorMessage: el?.status };
          }
        }
      } catch (error: any) {
        for (const idx of batchIndices) {
          results[idx] = { durationMinutes: 0, distanceMiles: 0, status: 'error', errorMessage: error.message };
        }
      }
    }

    return results;
  }

  /**
   * Generate an isochrone polygon by binary-searching 36 bearings for the
   * boundary where drive time equals targetMinutes.
   */
  async generateIsochrone(
    centerLat: number,
    centerLng: number,
    targetMinutes: number
  ): Promise<IsochronePolygon> {
    const isoCacheKey = `iso-${centerLat.toFixed(4)},${centerLng.toFixed(4)}-${targetMinutes}min`;
    const cachedIso = this.cache.get(isoCacheKey);
    if (cachedIso) {
      return JSON.parse(cachedIso.result.errorMessage || '{}');
    }

    const fallbackMiles = DRIVE_TIME_ESTIMATES[targetMinutes] || Math.round(targetMinutes * 0.7);

    // Without API key, return a circle approximation
    if (!this.apiKey) {
      const points = this.generateCirclePoints(centerLat, centerLng, fallbackMiles, 36);
      return {
        center: { lat: centerLat, lng: centerLng },
        targetMinutes,
        boundaryPoints: points,
        approximateAreaSqMiles: Math.PI * fallbackMiles * fallbackMiles,
        generatedAt: new Date().toISOString(),
        source: 'estimate',
      };
    }

    const NUM_BEARINGS = 36;
    const bearings = Array.from({ length: NUM_BEARINGS }, (_, i) => (360 / NUM_BEARINGS) * i);
    const tolerance = 1; // ±1 minute
    const maxIterations = 7;

    // Binary search state per bearing: [lowMiles, highMiles, bestPoint]
    const searchState = bearings.map(() => ({
      low: 0.5,
      high: fallbackMiles * 2.5,
      bestLat: centerLat,
      bestLng: centerLng,
      bestDiff: Infinity,
    }));

    for (let iter = 0; iter < maxIterations; iter++) {
      // Compute midpoints for all bearings
      const midpoints = bearings.map((bearing, i) => {
        const mid = (searchState[i].low + searchState[i].high) / 2;
        const radians = bearing * (Math.PI / 180);
        return {
          lat: centerLat + (mid / 69) * Math.cos(radians),
          lng: centerLng + (mid / (69 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(radians),
        };
      });

      // Batch query all bearings at once
      const batchResults = await this.getDriveTimeBatch(centerLat, centerLng, midpoints);

      for (let i = 0; i < bearings.length; i++) {
        const result = batchResults[i];
        const mid = (searchState[i].low + searchState[i].high) / 2;

        if (result.status !== 'ok') continue;

        const diff = Math.abs(result.durationMinutes - targetMinutes);
        if (diff < searchState[i].bestDiff) {
          searchState[i].bestDiff = diff;
          searchState[i].bestLat = midpoints[i].lat;
          searchState[i].bestLng = midpoints[i].lng;
        }

        if (diff <= tolerance) {
          // Close enough — narrow both bounds to converge
          searchState[i].low = mid * 0.95;
          searchState[i].high = mid * 1.05;
        } else if (result.durationMinutes > targetMinutes) {
          searchState[i].high = mid;
        } else {
          searchState[i].low = mid;
        }
      }
    }

    const boundaryPoints = searchState.map(s => ({ lat: s.bestLat, lng: s.bestLng }));
    const area = computePolygonAreaSqMiles(boundaryPoints, centerLat);

    const iso: IsochronePolygon = {
      center: { lat: centerLat, lng: centerLng },
      targetMinutes,
      boundaryPoints,
      approximateAreaSqMiles: Math.round(area * 100) / 100,
      generatedAt: new Date().toISOString(),
      source: 'google_api',
    };

    // Cache the isochrone polygon (reuse the existing cache map, store JSON in errorMessage field)
    this.cache.set(isoCacheKey, {
      result: { durationMinutes: targetMinutes, distanceMiles: 0, status: 'ok', errorMessage: JSON.stringify(iso) },
      timestamp: Date.now(),
    });

    return iso;
  }

  private generateCirclePoints(
    centerLat: number, centerLng: number, radiusMiles: number, numPoints: number
  ): Array<{ lat: number; lng: number }> {
    return Array.from({ length: numPoints }, (_, i) => {
      const bearing = (360 / numPoints) * i;
      const radians = bearing * (Math.PI / 180);
      return {
        lat: centerLat + (radiusMiles / 69) * Math.cos(radians),
        lng: centerLng + (radiusMiles / (69 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(radians),
      };
    });
  }
}

/**
 * Compute approximate area of a polygon in square miles using the Shoelace formula
 * on coordinates projected to planar miles.
 */
export function computePolygonAreaSqMiles(
  points: Array<{ lat: number; lng: number }>,
  refLat: number
): number {
  const milesPerDegreeLat = 69.0;
  const milesPerDegreeLng = 69.0 * Math.cos(refLat * Math.PI / 180);

  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = (points[i].lng) * milesPerDegreeLng;
    const yi = (points[i].lat) * milesPerDegreeLat;
    const xj = (points[j].lng) * milesPerDegreeLng;
    const yj = (points[j].lat) * milesPerDegreeLat;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area) / 2;
}

/**
 * Test if a point is inside a polygon using ray-casting algorithm.
 */
export function pointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export const driveTimeService = new DriveTimeService();
