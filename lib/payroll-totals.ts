/** Shared gross / deduction / net calculation for payroll records */
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
