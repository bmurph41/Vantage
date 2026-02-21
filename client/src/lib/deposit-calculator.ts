/**
 * Deposit Calculator Utility
 * Calculates deposit due dates based on anchor events and day offsets.
 * Supports calendar and business day calculations with holiday awareness.
 */

import { addDays, parseISO, format, isAfter } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export interface DepositConfig {
  amount: number;
  anchorEvent: "psa_signed" | "dd_expiration" | "closing" | "custom";
  daysOffset: number;
  dayType: "calendar" | "business";
  refundable: boolean;
  appliedToPrice: boolean;
  customAnchorDate?: string;
}

export interface DealDates {
  psaSignedDate?: string;
  ddExpirationDate?: string;
  closingDate?: string;
}

export interface CalculatedDeposit extends DepositConfig {
  depositNumber: number;
  calculatedDueDate: string | null;
  anchorDate: string | null;
  anchorLabel: string;
  isOverdue: boolean;
  daysUntilDue: number | null;
}

export interface ExtensionConfig {
  id: string;
  days: number;
  executed: boolean;
  basedOnEvent: string;
}

export interface TimelineSegment {
  label: string;
  startDate: Date;
  endDate: Date;
  type: "base_dd" | "extension_executed" | "extension_potential" | "closing_period";
  days: number;
}

// ============================================================================
// US Federal Holiday Calendar
// ============================================================================

function getUSFederalHolidays(year: number): Date[] {
  const holidays: Date[] = [];
  holidays.push(new Date(year, 0, 1));
  holidays.push(getNthWeekday(year, 0, 1, 3));
  holidays.push(getNthWeekday(year, 1, 1, 3));
  holidays.push(getLastWeekday(year, 4, 1));
  holidays.push(new Date(year, 5, 19));
  holidays.push(new Date(year, 6, 4));
  holidays.push(getNthWeekday(year, 8, 1, 1));
  holidays.push(getNthWeekday(year, 9, 1, 2));
  holidays.push(new Date(year, 10, 11));
  holidays.push(getNthWeekday(year, 10, 4, 4));
  holidays.push(new Date(year, 11, 25));
  return holidays;
}

function getNthWeekday(year: number, month: number, dayOfWeek: number, n: number): Date {
  const d = new Date(year, month, 1);
  let count = 0;
  while (count < n) {
    if (d.getDay() === dayOfWeek) count++;
    if (count < n) d.setDate(d.getDate() + 1);
  }
  return d;
}

function getLastWeekday(year: number, month: number, dayOfWeek: number): Date {
  const d = new Date(year, month + 1, 0);
  while (d.getDay() !== dayOfWeek) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

function isWeekendDay(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(date: Date, calendar: "us_federal" | "none" = "us_federal"): boolean {
  if (calendar === "none") return false;
  const holidays = getUSFederalHolidays(date.getFullYear());
  return holidays.some(
    (h) => h.getDate() === date.getDate() && h.getMonth() === date.getMonth()
  );
}

// ============================================================================
// Business Day Calculator
// ============================================================================

export function addBusinessDaysCalc(
  startDate: Date,
  days: number,
  holidayCalendar: "us_federal" | "none" = "us_federal"
): Date {
  let current = new Date(startDate);
  let remaining = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;

  while (remaining > 0) {
    current.setDate(current.getDate() + direction);
    if (!isWeekendDay(current) && !isHoliday(current, holidayCalendar)) {
      remaining--;
    }
  }
  return current;
}

// ============================================================================
// Anchor Event Resolution
// ============================================================================

function resolveAnchorDate(
  anchorEvent: string,
  dealDates: DealDates,
  customDate?: string
): { date: string | null; label: string } {
  switch (anchorEvent) {
    case "psa_signed":
      return { date: dealDates.psaSignedDate || null, label: "PSA Signed" };
    case "loi_signed":
      return { date: dealDates.psaSignedDate || null, label: "LOI Signed" };
    case "dd_expiration":
      return { date: dealDates.ddExpirationDate || null, label: "DD Expiration" };
    case "closing":
      return { date: dealDates.closingDate || null, label: "Closing" };
    case "custom":
      return { date: customDate || null, label: "Custom Date" };
    default:
      return { date: null, label: "Unknown" };
  }
}

// ============================================================================
// Deposit Calculator
// ============================================================================

export function calculateDepositDueDate(
  deposit: DepositConfig,
  dealDates: DealDates,
  holidayCalendar: "us_federal" | "none" = "us_federal"
): { dueDate: string | null; anchorDate: string | null; anchorLabel: string } {
  const { date: anchorDate, label: anchorLabel } = resolveAnchorDate(
    deposit.anchorEvent,
    dealDates,
    deposit.customAnchorDate
  );

  if (!anchorDate) {
    return { dueDate: null, anchorDate: null, anchorLabel };
  }

  try {
    const anchor = parseISO(anchorDate);
    const dueDate = deposit.dayType === "business"
      ? addBusinessDaysCalc(anchor, deposit.daysOffset, holidayCalendar)
      : addDays(anchor, deposit.daysOffset);

    return {
      dueDate: format(dueDate, "yyyy-MM-dd"),
      anchorDate,
      anchorLabel,
    };
  } catch {
    return { dueDate: null, anchorDate, anchorLabel };
  }
}

export function calculateAllDeposits(
  deposits: DepositConfig[],
  dealDates: DealDates,
  holidayCalendar: "us_federal" | "none" = "us_federal"
): CalculatedDeposit[] {
  const today = new Date();

  return deposits.map((deposit, index) => {
    const { dueDate, anchorDate, anchorLabel } = calculateDepositDueDate(
      deposit,
      dealDates,
      holidayCalendar
    );

    let isOverdue = false;
    let daysUntilDue: number | null = null;

    if (dueDate) {
      const due = parseISO(dueDate);
      isOverdue = !isAfter(due, today);
      daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      ...deposit,
      depositNumber: index + 1,
      calculatedDueDate: dueDate,
      anchorDate,
      anchorLabel,
      isOverdue,
      daysUntilDue,
    };
  });
}

// ============================================================================
// DD Period Auto-Calculators
// ============================================================================

export function autoCalculateDDPeriod(
  psaSignedDate: string,
  ddExpirationDate: string
): number | null {
  try {
    const psa = parseISO(psaSignedDate);
    const ddExp = parseISO(ddExpirationDate);
    return Math.ceil((ddExp.getTime() - psa.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export function autoCalculateDaysToClosing(
  ddExpirationDate: string,
  closingDate: string
): number | null {
  try {
    const ddExp = parseISO(ddExpirationDate);
    const close = parseISO(closingDate);
    return Math.ceil((close.getTime() - ddExp.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === "1") {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}
