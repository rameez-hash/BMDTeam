import { format, parseISO, differenceInMinutes, differenceInHours, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

/**
 * Parse a date-only string (YYYY-MM-DD) as UTC midnight.
 * All date-only fields are stored at UTC midnight for consistency.
 * Full ISO strings (with T) are parsed as-is.
 */
export function parseDateUTC(dateStr: string): Date {
  // Already a full ISO string (contains T) → parse as-is
  if (dateStr.includes('T')) return new Date(dateStr);
  // Date-only → UTC midnight (same as new Date("YYYY-MM-DD"))
  return new Date(dateStr + 'T00:00:00Z');
}

export function formatDate(date: Date | string, formatStr: string = 'yyyy-MM-dd'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd HH:mm:ss');
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm');
}

export function getStartOfDay(date: Date): Date {
  return startOfDay(date);
}

export function getEndOfDay(date: Date): Date {
  return endOfDay(date);
}

export function getMonthRange(month: number, year: number): { start: Date; end: Date } {
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(start);
  return { start, end };
}

export function calculateWorkHours(checkIn: Date, checkOut: Date, breakMinutes: number = 0): number {
  const totalMinutes = differenceInMinutes(checkOut, checkIn);
  const workMinutes = totalMinutes - breakMinutes;
  return Math.round((workMinutes / 60) * 100) / 100; // Round to 2 decimal places
}

export function calculateOvertimeHours(workHours: number, standardHours: number = 8): number {
  return Math.max(0, workHours - standardHours);
}

/**
 * Check if a shift is a night shift (crosses midnight)
 * e.g., 21:00 to 06:00 is a night shift
 */
export function isNightShift(startTime: string, endTime: string): boolean {
  const [startHours] = startTime.split(':').map(Number);
  const [endHours] = endTime.split(':').map(Number);
  return startHours > endHours; // e.g., 21 > 6
}

/**
 * Get the attendance date for a given check-in time based on shift.
 * 
 * Day shift: attendance date = check-in date (simple).
 * 
 * Night shift (e.g., 21:00→06:00, shift date = Feb 9):
 *   Shift runs from 21:00 Feb 9 to 06:00 Feb 10.
 *   - Check-in 20:30–23:59 on Feb 9 → attendance date = Feb 9  (evening start)
 *   - Check-in 00:00–05:59 on Feb 10 → attendance date = Feb 9  (still in shift)
 *   - Check-in 06:00+ on Feb 10  → attendance date = Feb 10 (shift over, new day)
 *
 * Rule: after midnight, only times BEFORE shift-end belong to the previous day.
 */
export function getAttendanceDate(checkInTime: Date, shiftStartTime: string, shiftEndTime: string, earlyCheckInGrace: number = 30): string {
  const isNight = isNightShift(shiftStartTime, shiftEndTime);
  
  if (!isNight) {
    // Day shift - attendance is for check-in date
    return formatDate(checkInTime);
  }
  
  // Night shift logic
  const [endHours, endMins] = shiftEndTime.split(':').map(Number);
  const shiftEndTotalMins = endHours * 60 + endMins;
  
  const checkInTotalMins = checkInTime.getHours() * 60 + checkInTime.getMinutes();
  
  // After midnight but BEFORE shift end → belongs to previous day's shift
  // e.g., 03:00 (180 min) < 06:00 (360 min) → previous day
  if (checkInTotalMins < shiftEndTotalMins) {
    const prevDate = new Date(checkInTime);
    prevDate.setDate(prevDate.getDate() - 1);
    return formatDate(prevDate);
  }
  
  // At or after shift end → current day (new day / next shift cycle)
  // e.g., 06:00 (360 min) → current day, 21:00 (1260 min) → current day
  return formatDate(checkInTime);
}

/**
 * Check if a given day (0=Sun..6=Sat) is an off day based on shift workDays config.
 * If workDays not provided, defaults to Mon-Fri (Sat/Sun off).
 */
export function isOffDay(dayOfWeek: number, workDays?: number[] | unknown): boolean {
  const days = Array.isArray(workDays) ? workDays : [1,2,3,4,5];
  return !days.includes(dayOfWeek);
}

/**
 * Get the workDays array from a shift or attendance snapshot.
 * Falls back to default Mon-Fri [1,2,3,4,5].
 */
export function getWorkDays(workDaysField?: unknown): number[] {
  if (Array.isArray(workDaysField)) return workDaysField as number[];
  if (typeof workDaysField === 'string') {
    try { const parsed = JSON.parse(workDaysField); if (Array.isArray(parsed)) return parsed; } catch { /* ignore */ }
  }
  return [1,2,3,4,5];
}

/**
 * Calculate late arrival for shifts including night shifts.
 * 
 * When `attendanceDate` is provided (admin create/edit, corrections), the shift
 * start is anchored to that date rather than inferred from the check-in time.
 * This prevents wrong results when check-in time doesn't match the shift cycle
 * (e.g., manual record for Feb 10 with check-in at 9:31 PM = 21:31).
 */
export function calculateLateArrival(
  checkInTime: Date, 
  shiftStartTime: string, 
  shiftEndTime: string,
  graceMinutes: number = 15,
  attendanceDate?: string // YYYY-MM-DD — anchor shift start to this date
): { isLate: boolean; lateMinutes: number; isEarly: boolean; earlyMinutes: number } {
  const [startHours, startMinutes] = shiftStartTime.split(':').map(Number);
  const isNight = isNightShift(shiftStartTime, shiftEndTime);
  
  // Create shift start datetime
  let shiftStart: Date;
  
  if (attendanceDate) {
    // Anchor to the provided attendance date (reliable for manual/corrected records)
    shiftStart = new Date(attendanceDate + 'T00:00:00');
    shiftStart.setHours(startHours, startMinutes, 0, 0);
  } else {
    // Infer from check-in time (original behavior for self check-in)
    shiftStart = new Date(checkInTime);
    shiftStart.setHours(startHours, startMinutes, 0, 0);
    
    if (isNight) {
      const [endHours, endMins] = shiftEndTime.split(':').map(Number);
      const checkInTotalMins = checkInTime.getHours() * 60 + checkInTime.getMinutes();
      const shiftEndTotalMins = endHours * 60 + endMins;

      if (checkInTotalMins < shiftEndTotalMins) {
        // Check-in is after midnight but before shift end → previous day's shift
        shiftStart.setDate(shiftStart.getDate() - 1);
      }
    }
  }
  
  const gracePeriodEnd = new Date(shiftStart.getTime() + graceMinutes * 60 * 1000);
  
  // Check if early
  if (checkInTime < shiftStart) {
    const earlyMinutes = differenceInMinutes(shiftStart, checkInTime);
    return { isLate: false, lateMinutes: 0, isEarly: true, earlyMinutes };
  }
  
  // Check if within grace period
  if (checkInTime <= gracePeriodEnd) {
    return { isLate: false, lateMinutes: 0, isEarly: false, earlyMinutes: 0 };
  }
  
  // Late - calculate minutes after grace period
  const lateMinutes = differenceInMinutes(checkInTime, gracePeriodEnd);
  return { isLate: true, lateMinutes, isEarly: false, earlyMinutes: 0 };
}

export function isLateArrival(checkInTime: Date, shiftStartTime: string, graceMinutes: number = 15): { isLate: boolean; lateMinutes: number } {
  const [hours, minutes] = shiftStartTime.split(':').map(Number);
  const shiftStart = new Date(checkInTime);
  shiftStart.setHours(hours, minutes, 0, 0);
  
  const gracePeriodEnd = new Date(shiftStart.getTime() + graceMinutes * 60 * 1000);
  
  if (checkInTime > gracePeriodEnd) {
    const lateMinutes = differenceInMinutes(checkInTime, gracePeriodEnd);
    return { isLate: true, lateMinutes };
  }
  
  return { isLate: false, lateMinutes: 0 };
}

export function calculateTotalBreakMinutes(breaks: Array<{ startTime: Date; endTime: Date | null }>): number {
  return breaks.reduce((total, brk) => {
    if (brk.endTime) {
      return total + differenceInMinutes(brk.endTime, brk.startTime);
    }
    return total;
  }, 0);
}

export function calculateLeaveDays(startDate: Date, endDate: Date, excludeWeekends: boolean = true, workDays?: number[]): number {
  let days = 0;
  const current = new Date(startDate);
  const offDayCheck = workDays || [1,2,3,4,5];
  
  while (current <= endDate) {
    if (!excludeWeekends || offDayCheck.includes(current.getDay())) {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

export function generateEmployeeCode(prefix: string = 'EMP', sequence: number): string {
  return `${prefix}${sequence.toString().padStart(5, '0')}`;
}

export function calculateGrossSalary(salary: {
  basicSalary: number;
  hra: number;
  da: number;
  ta: number;
  medicalAllowance: number;
  otherAllowances: number;
}): number {
  return salary.basicSalary + salary.hra + salary.da + salary.ta + salary.medicalAllowance + salary.otherAllowances;
}

export function calculateTotalDeductions(salary: {
  pf: number;
  esi: number;
  professionalTax: number;
  tds: number;
  otherDeductions: number;
}): number {
  return salary.pf + salary.esi + salary.professionalTax + salary.tds + salary.otherDeductions;
}

export function calculateNetSalary(grossSalary: number, totalDeductions: number): number {
  return grossSalary - totalDeductions;
}

export function calculateTax(monthlyIncome: number, taxSlabs: Array<{ minIncome: number; maxIncome: number | null; fixedTax?: number; taxRate: number }>): number {
  // Convert monthly income to annual for tax calculation
  // Pakistan tax slabs are based on annual income
  const annualIncome = monthlyIncome * 12;
  
  // Pakistan Income Tax Slabs 2025-26:
  // Up to 600,000 → 0%
  // 600,001 - 1,200,000 → 1% of amount exceeding 600,000
  // 1,200,001 - 2,200,000 → Rs 6,000 + 11% of amount exceeding 1,200,000
  // 2,200,001 - 3,200,000 → Rs 116,000 + 23% of amount exceeding 2,200,000
  // 3,200,001 - 4,100,000 → Rs 346,000 + 30% of amount exceeding 3,200,000
  // Above 4,100,000 → Rs 616,000 + 35% of amount exceeding 4,100,000
  
  // Find the applicable slab (sort descending by minIncome, find first where income > minIncome)
  const sortedSlabs = [...taxSlabs].sort((a, b) => b.minIncome - a.minIncome);
  const applicableSlab = sortedSlabs.find(slab => annualIncome > slab.minIncome);
  
  if (!applicableSlab || applicableSlab.taxRate === 0) {
    return 0; // No tax if below minimum threshold or 0% slab
  }
  
  // Pakistan Tax Formula: Fixed Amount + (Rate% × Amount exceeding slab minimum)
  const exceedingAmount = annualIncome - applicableSlab.minIncome;
  const fixedTax = applicableSlab.fixedTax || 0;
  const variableTax = exceedingAmount * (applicableSlab.taxRate / 100);
  let totalAnnualTax = fixedTax + variableTax;
  
  // Apply 9% surcharge if income exceeds Rs. 10 million (1 crore)
  if (annualIncome > 10000000) {
    totalAnnualTax = totalAnnualTax * 1.09;
  }

  // Convert annual tax back to monthly
  const monthlyTax = totalAnnualTax / 12;
  return Math.round(monthlyTax * 100) / 100;
}

/**
 * Calculate late deduction based on late rules.
 * 
 * Standard formula: floor(lateCount / threshold) * dailyRate
 * e.g., threshold=4 → every 4 lates = 1 day salary deduction
 * 
 * @param lateCount - Number of late days in the month
 * @param dailyRate - Per-day salary (grossSalary / workingDays)
 * @param lateRules - Array of late rules sorted by minLateCount ascending
 * @returns Deduction amount
 */
export function calculateLateDeduction(
  lateCount: number,
  dailyRate: number,
  lateRules: Array<{ minLateCount: number; maxLateCount: number | null; deductionType: string; deductionValue: number; deductionDays?: number }>
): number {
  if (lateCount === 0 || lateRules.length === 0) return 0;

  // Find the applicable rule for this late count
  for (const rule of lateRules) {
    const maxCount = rule.maxLateCount || Infinity;
    if (lateCount >= rule.minLateCount && lateCount <= maxCount) {
      switch (rule.deductionType) {
        case 'PERCENTAGE':
          // Percentage of monthly salary (dailyRate * 30 approximation)
          return (dailyRate * 30 * rule.deductionValue) / 100;
        case 'FIXED':
          return rule.deductionValue;
        case 'DAYS':
          // deductionValue = number of days salary to deduct
          return dailyRate * rule.deductionValue;
        case 'PER_LATE_DAYS': {
          // Every N lates = X days deduction
          // deductionValue = N (trigger count), deductionDays = X (days per trigger, default 1)
          // e.g., deductionValue=3, deductionDays=0.5 → every 3 lates = half day
          // 3 lates=0.5 day, 6 lates=1 day, 9 lates=1.5 days
          const triggerCount = Math.floor(lateCount / rule.deductionValue);
          const daysPerTrigger = rule.deductionDays ?? 1;
          return dailyRate * triggerCount * daysPerTrigger;
        }
        default:
          return 0;
      }
    }
  }
  return 0;
}

export function getWorkingDaysInMonth(month: number, year: number, holidays: Date[] = [], workDays?: number[]): number {
  const { start, end } = getMonthRange(month, year);
  let workingDaysCount = 0;
  const current = new Date(start);
  const days = workDays || [1,2,3,4,5];
  
  while (current <= end) {
    if (days.includes(current.getDay())) {
      const isHoliday = holidays.some(h => 
        formatDate(h) === formatDate(current)
      );
      if (!isHoliday) {
        workingDaysCount++;
      }
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDaysCount;
}

export function parseQueryParams(searchParams: URLSearchParams): Record<string, string | number | undefined> {
  const params: Record<string, string | number | undefined> = {};
  
  searchParams.forEach((value, key) => {
    if (key === 'page' || key === 'limit') {
      params[key] = parseInt(value, 10);
    } else {
      params[key] = value;
    }
  });
  
  return params;
}

export function getPaginationParams(searchParams: URLSearchParams): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}
