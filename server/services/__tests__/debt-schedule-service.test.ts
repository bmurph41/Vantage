/**
 * Tests for Debt Schedule Service
 * 
 * Verifies monthly amortization calculations and DSCR metrics.
 */

import { describe, it, expect, vi } from 'vitest';
import { DebtScheduleService, type DebtSchedule } from '../debt-schedule-service';

// Create a standalone service instance for testing
const service = new DebtScheduleService();

describe('DebtScheduleService', () => {
  describe('generateEmptySchedule', () => {
    it('generates correct number of periods', () => {
      const schedule = (service as any).generateEmptySchedule(60, 2025);
      expect(schedule).toHaveLength(60);
    });

    it('generates correct period keys', () => {
      const schedule = (service as any).generateEmptySchedule(12, 2025);
      expect(schedule[0].periodKey).toBe('2025-01');
      expect(schedule[11].periodKey).toBe('2025-12');
    });

    it('all payments are zero for empty schedule', () => {
      const schedule = (service as any).generateEmptySchedule(12, 2025);
      schedule.forEach((period: any) => {
        expect(period.totalPayment).toBe(0);
        expect(period.totalPrincipal).toBe(0);
        expect(period.totalInterest).toBe(0);
        expect(period.totalBalance).toBe(0);
      });
    });
  });

  describe('calculateDSCR', () => {
    it('calculates monthly DSCR correctly', () => {
      const monthlyNoi: Record<string, number> = {
        '2025-01': 50000,
        '2025-02': 52000,
        '2025-03': 48000,
      };
      
      const mockSchedule: DebtSchedule = {
        capitalStackId: 'test',
        tranches: [],
        schedule: [
          { periodKey: '2025-01', periodIndex: 0, year: 2025, month: 1, tranchePayments: [], totalPayment: 25000, totalPrincipal: 5000, totalInterest: 20000, totalBalance: 1000000 },
          { periodKey: '2025-02', periodIndex: 1, year: 2025, month: 2, tranchePayments: [], totalPayment: 25000, totalPrincipal: 5100, totalInterest: 19900, totalBalance: 994900 },
          { periodKey: '2025-03', periodIndex: 2, year: 2025, month: 3, tranchePayments: [], totalPayment: 25000, totalPrincipal: 5200, totalInterest: 19800, totalBalance: 989700 },
        ],
        totalDebtAtClose: 1000000,
        blendedRate: 6.0,
        weightedAvgTermMonths: 120,
        annualDebtService: { 2025: 75000 },
        annualInterest: { 2025: 59700 },
        annualPrincipal: { 2025: 15300 },
      };
      
      const result = service.calculateDSCR(monthlyNoi, mockSchedule);
      
      expect(result.monthlyDscr['2025-01']).toBe(2); // 50000 / 25000
      expect(result.monthlyDscr['2025-02']).toBe(2.08); // 52000 / 25000
      expect(result.monthlyDscr['2025-03']).toBe(1.92); // 48000 / 25000
    });

    it('identifies DSCR breach months', () => {
      const monthlyNoi: Record<string, number> = {
        '2025-01': 20000, // Below debt service
        '2025-02': 30000, // Above debt service
      };
      
      const mockSchedule: DebtSchedule = {
        capitalStackId: 'test',
        tranches: [],
        schedule: [
          { periodKey: '2025-01', periodIndex: 0, year: 2025, month: 1, tranchePayments: [], totalPayment: 25000, totalPrincipal: 5000, totalInterest: 20000, totalBalance: 1000000 },
          { periodKey: '2025-02', periodIndex: 1, year: 2025, month: 2, tranchePayments: [], totalPayment: 25000, totalPrincipal: 5000, totalInterest: 20000, totalBalance: 995000 },
        ],
        totalDebtAtClose: 1000000,
        blendedRate: 6.0,
        weightedAvgTermMonths: 120,
        annualDebtService: { 2025: 50000 },
        annualInterest: { 2025: 40000 },
        annualPrincipal: { 2025: 10000 },
      };
      
      const result = service.calculateDSCR(monthlyNoi, mockSchedule);
      
      expect(result.breachMonths).toContain('2025-01');
      expect(result.breachMonths).not.toContain('2025-02');
    });

    it('calculates min and avg DSCR correctly', () => {
      const monthlyNoi: Record<string, number> = {
        '2025-01': 50000,
        '2025-02': 40000,
        '2025-03': 60000,
      };
      
      const mockSchedule: DebtSchedule = {
        capitalStackId: 'test',
        tranches: [],
        schedule: [
          { periodKey: '2025-01', periodIndex: 0, year: 2025, month: 1, tranchePayments: [], totalPayment: 25000, totalPrincipal: 5000, totalInterest: 20000, totalBalance: 1000000 },
          { periodKey: '2025-02', periodIndex: 1, year: 2025, month: 2, tranchePayments: [], totalPayment: 25000, totalPrincipal: 5000, totalInterest: 20000, totalBalance: 995000 },
          { periodKey: '2025-03', periodIndex: 2, year: 2025, month: 3, tranchePayments: [], totalPayment: 25000, totalPrincipal: 5000, totalInterest: 20000, totalBalance: 990000 },
        ],
        totalDebtAtClose: 1000000,
        blendedRate: 6.0,
        weightedAvgTermMonths: 120,
        annualDebtService: { 2025: 75000 },
        annualInterest: { 2025: 60000 },
        annualPrincipal: { 2025: 15000 },
      };
      
      const result = service.calculateDSCR(monthlyNoi, mockSchedule);
      
      expect(result.minDscr).toBe(1.6); // 40000 / 25000
      expect(result.avgDscr).toBe(2); // avg of 2, 1.6, 2.4 = 6/3 = 2
    });

    it('handles zero debt service gracefully', () => {
      const monthlyNoi: Record<string, number> = {
        '2025-01': 50000,
      };
      
      const mockSchedule: DebtSchedule = {
        capitalStackId: 'test',
        tranches: [],
        schedule: [
          { periodKey: '2025-01', periodIndex: 0, year: 2025, month: 1, tranchePayments: [], totalPayment: 0, totalPrincipal: 0, totalInterest: 0, totalBalance: 0 },
        ],
        totalDebtAtClose: 0,
        blendedRate: 0,
        weightedAvgTermMonths: 0,
        annualDebtService: {},
        annualInterest: {},
        annualPrincipal: {},
      };
      
      const result = service.calculateDSCR(monthlyNoi, mockSchedule);
      
      // DSCR should be Infinity (no debt), but we filter that out
      expect(result.breachMonths).toHaveLength(0);
    });
  });

  describe('getDebtServiceForPeriod', () => {
    it('returns correct values for existing period', () => {
      const mockSchedule: DebtSchedule = {
        capitalStackId: 'test',
        tranches: [],
        schedule: [
          { periodKey: '2025-01', periodIndex: 0, year: 2025, month: 1, tranchePayments: [], totalPayment: 25000, totalPrincipal: 5000, totalInterest: 20000, totalBalance: 995000 },
        ],
        totalDebtAtClose: 1000000,
        blendedRate: 6.0,
        weightedAvgTermMonths: 120,
        annualDebtService: {},
        annualInterest: {},
        annualPrincipal: {},
      };
      
      const result = service.getDebtServiceForPeriod(mockSchedule, '2025-01');
      
      expect(result.payment).toBe(25000);
      expect(result.principal).toBe(5000);
      expect(result.interest).toBe(20000);
    });

    it('returns zeros for non-existent period', () => {
      const mockSchedule: DebtSchedule = {
        capitalStackId: 'test',
        tranches: [],
        schedule: [],
        totalDebtAtClose: 0,
        blendedRate: 0,
        weightedAvgTermMonths: 0,
        annualDebtService: {},
        annualInterest: {},
        annualPrincipal: {},
      };
      
      const result = service.getDebtServiceForPeriod(mockSchedule, '2025-01');
      
      expect(result.payment).toBe(0);
      expect(result.principal).toBe(0);
      expect(result.interest).toBe(0);
    });
  });

  describe('calculateDebtYield', () => {
    it('calculates debt yield correctly', () => {
      const debtYield = service.calculateDebtYield(500000, 5000000);
      expect(debtYield).toBe(10); // 500000 / 5000000 * 100 = 10%
    });

    it('handles zero debt', () => {
      const debtYield = service.calculateDebtYield(500000, 0);
      expect(debtYield).toBe(0);
    });

    it('handles decimal precision', () => {
      const debtYield = service.calculateDebtYield(425000, 5000000);
      expect(debtYield).toBe(8.5); // 425000 / 5000000 * 100 = 8.5%
    });
  });
});
