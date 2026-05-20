/** Admin-only boilerplate — never show on employee-facing payslip PDF/HTML */
const INTERNAL_NOTE_PATTERNS = [
  /manual\s*entry/i,
  /pre-?hrms/i,
  /paid\s*outside\s*(the\s*)?system/i,
];

export function payslipNotesForDisplay(notes?: string | null): string | null {
  const trimmed = notes?.trim();
  if (!trimmed) return null;
  if (INTERNAL_NOTE_PATTERNS.some((p) => p.test(trimmed))) return null;
  return trimmed;
}
