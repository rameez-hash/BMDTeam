/** Shared gross / deduction / net calculation for payroll records */

/** Gross minus income tax — base for attendance & fixed deductions after tax */
export function getAfterTaxBase(grossEarnings: number, tds: number): number {
  return Math.max(0, grossEarnings - tds);
}

/** Per-day rate from after-tax amount (late / absent deductions) */
export function calculateAfterTaxDailyRate(
  grossEarnings: number,
  tds: number,
  workingDays: number
): number {
  if (workingDays <= 0) return 0;
  return getAfterTaxBase(grossEarnings, tds) / workingDays;
}

/** Scale profile deductions proportionally when income is after tax */
export function scaleDeductionsToAfterTaxBase(
  grossEarnings: number,
  tds: number,
  deductions: {
    pf: number;
    esi: number;
    professionalTax: number;
    otherDeductions: number;
  }
) {
  if (grossEarnings <= 0) return deductions;
  const ratio = getAfterTaxBase(grossEarnings, tds) / grossEarnings;
  const scale = (n: number) => Math.round(n * ratio * 100) / 100;
  return {
    pf: scale(deductions.pf),
    esi: scale(deductions.esi),
    professionalTax: scale(deductions.professionalTax),
    otherDeductions: scale(deductions.otherDeductions),
  };
}

export type PayrollAmountFields = {
  basicSalary: number;
  hra: number;
  da: number;
  ta: number;
  medicalAllowance: number;
  otherAllowances: number;
  overtime: number;
  bonus: number;
  pf: number;
  esi: number;
  professionalTax: number;
  tds: number;
  lateDeduction: number;
  absentDeduction: number;
  otherDeductions: number;
  manualDeduction: number;
};

export function calculatePayrollTotals(fields: PayrollAmountFields) {
  const grossEarnings =
    fields.basicSalary +
    fields.hra +
    fields.da +
    fields.ta +
    fields.medicalAllowance +
    fields.otherAllowances +
    fields.overtime +
    fields.bonus;

  const totalDeductions =
    fields.pf +
    fields.esi +
    fields.professionalTax +
    fields.tds +
    fields.lateDeduction +
    fields.absentDeduction +
    fields.otherDeductions +
    fields.manualDeduction;

  const netSalary = Math.max(0, grossEarnings - totalDeductions);

  return {
    grossEarnings: Math.round(grossEarnings * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netSalary: Math.round(netSalary * 100) / 100,
  };
}

export function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}
