'use client';

import { getPayrollDeductionBreakdown, type PayrollDeductionSource } from '@/lib/payroll-deductions';

const formatPKR = (amount: number) => {
  if (!amount && amount !== 0) return 'Rs 0';
  return 'Rs ' + Math.round(amount).toLocaleString('en-PK');
};

type Props = PayrollDeductionSource & {
  lateDays?: number;
  absentDays?: number;
  halfDays?: number;
  totalDeductions: number;
};

export default function DeductionBreakdownCell(props: Props) {
  const { totalDeductions, ...rest } = props;
  const lines = getPayrollDeductionBreakdown(rest);

  if (lines.length === 0 && totalDeductions <= 0) {
    return <span className="text-slate-400 text-xs">—</span>;
  }

  return (
    <div className="text-xs min-w-[140px]">
      {lines.map((line) => (
        <div key={line.key} className="flex justify-between gap-2 py-0.5">
          <span className="text-slate-600 shrink-0">
            {line.label}
            {line.detail && <span className="text-[10px] text-slate-400 ml-1">({line.detail})</span>}
          </span>
          <span className="text-red-600 font-medium tabular-nums whitespace-nowrap">-{formatPKR(line.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-2 pt-1 mt-0.5 border-t border-slate-200 font-semibold">
        <span className="text-slate-700">Total</span>
        <span className="text-red-700 tabular-nums">-{formatPKR(totalDeductions)}</span>
      </div>
    </div>
  );
}
