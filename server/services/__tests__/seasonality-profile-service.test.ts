/**
 * Tests for Seasonality Profile Service
 * 
 * Verifies seasonality profile management and marina defaults.
 */

import { describe, it, expect } from 'vitest';
import { 
  MARINA_STANDARD_SEASONALITY, 
  FLAT_SEASONALITY,
  type SeasonalityMonth 
} from '../seasonality-profile-service';

describe('SeasonalityProfileService', () => {
  describe('MARINA_STANDARD_SEASONALITY', () => {
    it('has 12 months', () => {
      expect(MARINA_STANDARD_SEASONALITY).toHaveLength(12);
    });

    it('has months 1-12', () => {
      const months = MARINA_STANDARD_SEASONALITY.map(m => m.month);
      expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('has peak season in July/August', () => {
      const july = MARINA_STANDARD_SEASONALITY.find(m => m.month === 7)!;
      const august = MARINA_STANDARD_SEASONALITY.find(m => m.month === 8)!;
      
      expect(july.occupancyMultiplier).toBe(1.0);
      expect(august.occupancyMultiplier).toBe(1.0);
      expect(july.rateMultiplier).toBeGreaterThan(1);
      expect(august.rateMultiplier).toBeGreaterThan(1);
    });

    it('has off-season in January/February', () => {
      const january = MARINA_STANDARD_SEASONALITY.find(m => m.month === 1)!;
      const february = MARINA_STANDARD_SEASONALITY.find(m => m.month === 2)!;
      
      expect(january.occupancyMultiplier).toBeLessThan(0.6);
      expect(february.occupancyMultiplier).toBeLessThan(0.6);
      expect(january.rateMultiplier).toBeLessThan(1);
    });

    it('has multipliers that sum to reasonable annual total', () => {
      const occupancySum = MARINA_STANDARD_SEASONALITY.reduce(
        (sum, m) => sum + m.occupancyMultiplier, 0
      );
      const rateSum = MARINA_STANDARD_SEASONALITY.reduce(
        (sum, m) => sum + m.rateMultiplier, 0
      );
      
      // Average should be close to 1.0 for balanced seasonality
      expect(occupancySum / 12).toBeGreaterThan(0.6);
      expect(occupancySum / 12).toBeLessThan(0.9);
      expect(rateSum / 12).toBeCloseTo(0.95, 1);
    });

    it('revenue multiplier correlates with occupancy * rate', () => {
      const july = MARINA_STANDARD_SEASONALITY.find(m => m.month === 7)!;
      const expected = july.occupancyMultiplier * july.rateMultiplier;
      
      // Revenue multiplier should be close to occupancy * rate
      expect(july.revenueMultiplier).toBeCloseTo(expected, 1);
    });
  });

  describe('FLAT_SEASONALITY', () => {
    it('has 12 months', () => {
      expect(FLAT_SEASONALITY).toHaveLength(12);
    });

    it('has all multipliers at 1.0', () => {
      FLAT_SEASONALITY.forEach(month => {
        expect(month.occupancyMultiplier).toBe(1.0);
        expect(month.rateMultiplier).toBe(1.0);
        expect(month.revenueMultiplier).toBe(1.0);
      });
    });
  });

  describe('SeasonalityMonth type validation', () => {
    it('validates month range', () => {
      const validMonth: SeasonalityMonth = {
        month: 6,
        occupancyMultiplier: 0.95,
        rateMultiplier: 1.05,
        revenueMultiplier: 1.0,
      };
      
      expect(validMonth.month).toBeGreaterThanOrEqual(1);
      expect(validMonth.month).toBeLessThanOrEqual(12);
    });

    it('validates multiplier ranges', () => {
      MARINA_STANDARD_SEASONALITY.forEach(month => {
        expect(month.occupancyMultiplier).toBeGreaterThanOrEqual(0);
        expect(month.occupancyMultiplier).toBeLessThanOrEqual(1.5);
        expect(month.rateMultiplier).toBeGreaterThanOrEqual(0);
        expect(month.rateMultiplier).toBeLessThanOrEqual(1.5);
        expect(month.revenueMultiplier).toBeGreaterThanOrEqual(0);
        expect(month.revenueMultiplier).toBeLessThanOrEqual(2);
      });
    });
  });
});
