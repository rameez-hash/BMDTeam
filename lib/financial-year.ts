/** Pakistan financial year: July (startYear) → June (endYear), e.g. 2025-2026 */

export function getCurrentFinancialYear(date = new Date()): string {
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  if (m >= 7) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}

export function parseFinancialYear(fy: string): { startYear: number; endYear: number } | null {
  const match = fy.match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;
  const startYear = parseInt(match[1], 10);
  const endYear = parseInt(match[2], 10);
  if (endYear !== startYear + 1) return null;
  return { startYear, endYear };
}

/** Prisma where clause for payroll records in a financial year */
export function payrollFinancialYearFilter(fy: string) {
  const parsed = parseFinancialYear(fy);
  if (!parsed) return null;
  const { startYear, endYear } = parsed;
  return {
    OR: [
      { year: startYear, month: { gte: 7 } },
      { year: endYear, month: { lte: 6 } },
    ],
  };
}

export function financialYearOptions(count = 6): { value: string; label: string }[] {
  const current = getCurrentFinancialYear();
  const start = parseInt(current.split('-')[0], 10);
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const y = start - i;
    const fy = `${y}-${y + 1}`;
    options.push({ value: fy, label: `FY ${fy} (Jul ${y} – Jun ${y + 1})` });
  }
  return options;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
