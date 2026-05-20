export type PayrollDeductionSource = {
  tds?: number;
  pf?: number;
  esi?: number;
  professionalTax?: number;
  lateDeduction?: number;
  absentDeduction?: number;
  otherDeductions?: number;
  manualDeduction?: number;
  manualDeductions?: { amount: number }[];
  totalDeductions?: number;
};

export type DeductionLine = {
  key: string;
  label: string;
  amount: number;
  /** Short hint e.g. "3 days" */
  detail?: string;
};

/** Important deduction lines for payroll monitoring (non-zero only) */
export function getPayrollDeductionBreakdown(
  r: PayrollDeductionSource & { lateDays?: number; absentDays?: number; halfDays?: number }
): DeductionLine[] {
  const manualExtra =
    (r.manualDeductions?.reduce((s, d) => s + d.amount, 0) ?? 0) + (r.manualDeduction || 0);
  const otherCombined = (r.otherDeductions || 0) + manualExtra;

  const lines: DeductionLine[] = [];

  if ((r.tds || 0) > 0) {
    lines.push({ key: 'tds', label: 'Income Tax (FBR)', amount: r.tds! });
  }
  if ((r.pf || 0) > 0) {
    lines.push({ key: 'pf', label: 'Provident Fund', amount: r.pf! });
  }
  if ((r.esi || 0) > 0) {
    lines.push({ key: 'esi', label: 'EOBI', amount: r.esi! });
  }
  if ((r.professionalTax || 0) > 0) {
    lines.push({ key: 'ptax', label: 'Professional Tax', amount: r.professionalTax! });
  }
  if ((r.lateDeduction || 0) > 0) {
    lines.push({
      key: 'late',
      label: 'Late Deduction',
      amount: r.lateDeduction!,
      detail: r.lateDays ? `${r.lateDays} day(s)` : undefined,
    });
  }
  if ((r.absentDeduction || 0) > 0) {
    const half = r.halfDays ? `, ${r.halfDays} half` : '';
    lines.push({
      key: 'absent',
      label: 'Absent Deduction',
      amount: r.absentDeduction!,
      detail: r.absentDays ? `${r.absentDays} absent${half}` : undefined,
    });
  }
  if (otherCombined > 0) {
    lines.push({ key: 'other', label: 'Other Deductions', amount: otherCombined });
  }

  return lines;
}
