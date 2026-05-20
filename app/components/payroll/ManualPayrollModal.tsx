'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { calculatePayrollTotals } from '@/lib/payroll-totals';

export type ManualPayrollRecord = {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  halfDays: number;
  lateDays: number;
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
  notes?: string | null;
  deductionReason?: string | null;
  paymentReference?: string | null;
  status: string;
  employee?: { firstName: string; lastName: string };
};

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode?: string;
  department?: { name: string };
  salary?: {
    basicSalary: number;
    hra: number;
    da: number;
    ta: number;
    medicalAllowance: number;
    otherAllowances: number;
    grossSalary: number;
    netSalary: number;
    pf: number;
    tds: number;
    esi?: number;
    professionalTax?: number;
    otherDeductions?: number;
  };
};

const emptyForm = (month: number, year: number) => ({
  employeeId: '',
  month,
  year,
  workingDays: 0,
  presentDays: 0,
  leaveDays: 0,
  absentDays: 0,
  halfDays: 0,
  lateDays: 0,
  basicSalary: 0,
  hra: 0,
  da: 0,
  ta: 0,
  medicalAllowance: 0,
  otherAllowances: 0,
  overtime: 0,
  bonus: 0,
  pf: 0,
  esi: 0,
  professionalTax: 0,
  tds: 0,
  lateDeduction: 0,
  absentDeduction: 0,
  otherDeductions: 0,
  manualDeduction: 0,
  notes: 'Manual entry — pre-HRMS / paid outside system',
  deductionReason: '',
  paymentReference: '',
  status: 'DRAFT',
});

const formatPKR = (amount: number) => 'Rs ' + Math.round(amount).toLocaleString('en-PK');

type Props = {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  employees: EmployeeOption[];
  months: { value: string; label: string }[];
  getMonthName: (m: number) => string;
  editRecord?: ManualPayrollRecord | null;
  defaultMonth?: number;
  defaultYear?: number;
  onSaved: () => void;
  toast: { success: (m: string) => void; error: (m: string) => void };
};

export default function ManualPayrollModal({
  isOpen,
  onClose,
  token,
  employees,
  months,
  getMonthName,
  editRecord,
  defaultMonth,
  defaultYear,
  onSaved,
  toast,
}: Props) {
  const isEdit = !!editRecord?.id;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm(defaultMonth ?? new Date().getMonth() + 1, defaultYear ?? new Date().getFullYear()));

  useEffect(() => {
    if (!isOpen) return;
    if (editRecord) {
      setForm({
        employeeId: editRecord.employeeId,
        month: editRecord.month,
        year: editRecord.year,
        workingDays: editRecord.workingDays,
        presentDays: editRecord.presentDays,
        leaveDays: editRecord.leaveDays,
        absentDays: editRecord.absentDays,
        halfDays: editRecord.halfDays,
        lateDays: editRecord.lateDays,
        basicSalary: editRecord.basicSalary,
        hra: editRecord.hra,
        da: editRecord.da,
        ta: editRecord.ta,
        medicalAllowance: editRecord.medicalAllowance,
        otherAllowances: editRecord.otherAllowances,
        overtime: editRecord.overtime,
        bonus: editRecord.bonus,
        pf: editRecord.pf,
        esi: editRecord.esi,
        professionalTax: editRecord.professionalTax,
        tds: editRecord.tds,
        lateDeduction: editRecord.lateDeduction,
        absentDeduction: editRecord.absentDeduction,
        otherDeductions: editRecord.otherDeductions,
        manualDeduction: editRecord.manualDeduction,
        notes: editRecord.notes || '',
        deductionReason: editRecord.deductionReason || '',
        paymentReference: editRecord.paymentReference || '',
        status: editRecord.status,
      });
    } else {
      setForm(emptyForm(defaultMonth ?? new Date().getMonth() + 1, defaultYear ?? new Date().getFullYear()));
    }
  }, [isOpen, editRecord, defaultMonth, defaultYear]);

  const totals = useMemo(
    () =>
      calculatePayrollTotals({
        basicSalary: form.basicSalary,
        hra: form.hra,
        da: form.da,
        ta: form.ta,
        medicalAllowance: form.medicalAllowance,
        otherAllowances: form.otherAllowances,
        overtime: form.overtime,
        bonus: form.bonus,
        pf: form.pf,
        esi: form.esi,
        professionalTax: form.professionalTax,
        tds: form.tds,
        lateDeduction: form.lateDeduction,
        absentDeduction: form.absentDeduction,
        otherDeductions: form.otherDeductions,
        manualDeduction: form.manualDeduction,
      }),
    [form]
  );

  const setNum = (key: keyof typeof form, value: string) => {
    const n = value === '' ? 0 : parseFloat(value);
    setForm((f) => ({ ...f, [key]: Number.isFinite(n) ? n : 0 }));
  };

  const fillFromSalary = () => {
    const emp = employees.find((e) => e.id === form.employeeId);
    if (!emp?.salary) {
      toast.error('No salary structure for this employee');
      return;
    }
    const s = emp.salary;
    setForm((f) => ({
      ...f,
      basicSalary: s.basicSalary,
      hra: s.hra,
      da: s.da,
      ta: s.ta,
      medicalAllowance: s.medicalAllowance,
      otherAllowances: s.otherAllowances,
      pf: s.pf,
      esi: s.esi ?? 0,
      professionalTax: s.professionalTax ?? 0,
      tds: s.tds,
      otherDeductions: s.otherDeductions ?? 0,
    }));
    toast.success('Filled from current salary profile');
  };

  const handleSave = async () => {
    if (!isEdit && !form.employeeId) {
      toast.error('Select an employee');
      return;
    }
    setSaving(true);
    try {
      const url = isEdit ? '/api/payroll/manual' : '/api/payroll/manual';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit ? { id: editRecord!.id, ...form } : form;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(isEdit ? 'Manual payslip updated' : 'Manual payslip created');
        onSaved();
        onClose();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const numInput = (label: string, key: keyof typeof form, step = '1') => (
    <Input
      label={label}
      type="number"
      step={step}
      value={form[key] as number}
      onChange={(e) => setNum(key, e.target.value)}
    />
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Manual Payslip' : 'Add Manual Payslip'}
      size="xl"
    >
      <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto space-y-6">
        <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          For months before HRMS or when attendance was not tracked. All fields match auto payslips — enter amounts as paid historically.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!isEdit ? (
            <Select
              label="Employee"
              value={form.employeeId}
              onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
              options={[
                { value: '', label: 'Select employee' },
                ...employees.map((e) => ({
                  value: e.id,
                  label: `${e.firstName} ${e.lastName}${e.employeeCode ? ` (${e.employeeCode})` : ''}`,
                })),
              ]}
            />
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-1">Employee</p>
              <p className="font-semibold">
                {editRecord?.employee?.firstName} {editRecord?.employee?.lastName}
              </p>
            </div>
          )}
          <Select
            label="Month"
            value={String(form.month)}
            onChange={(e) => setForm((f) => ({ ...f, month: parseInt(e.target.value, 10) }))}
            options={months}
            disabled={isEdit}
          />
          <Input
            label="Year"
            type="number"
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value, 10) || f.year }))}
            disabled={isEdit}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            options={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'PROCESSED', label: 'Processed' },
              { value: 'PAID', label: 'Paid (historical)' },
            ]}
          />
        </div>

        {!isEdit && form.employeeId && (
          <Button type="button" variant="secondary" size="sm" onClick={fillFromSalary}>
            Fill earnings & deductions from salary profile
          </Button>
        )}

        <div>
          <h4 className="text-sm font-semibold text-slate-800 mb-3">Attendance (optional)</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {numInput('Working days', 'workingDays')}
            {numInput('Present', 'presentDays', '0.5')}
            {numInput('Leave', 'leaveDays', '0.5')}
            {numInput('Absent', 'absentDays', '0.5')}
            {numInput('Half days', 'halfDays')}
            {numInput('Late days', 'lateDays')}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-emerald-800 mb-3">Earnings</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {numInput('Basic', 'basicSalary')}
            {numInput('HRA', 'hra')}
            {numInput('DA', 'da')}
            {numInput('TA', 'ta')}
            {numInput('Medical', 'medicalAllowance')}
            {numInput('Other allow.', 'otherAllowances')}
            {numInput('Overtime', 'overtime')}
            {numInput('Bonus', 'bonus')}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-red-800 mb-3">Deductions</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {numInput('Income tax (TDS)', 'tds')}
            {numInput('PF', 'pf')}
            {numInput('EOBI', 'esi')}
            {numInput('Prof. tax', 'professionalTax')}
            {numInput('Late ded.', 'lateDeduction')}
            {numInput('Absent ded.', 'absentDeduction')}
            {numInput('Other ded.', 'otherDeductions')}
            {numInput('Manual ded.', 'manualDeduction')}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <Input label="Payment reference" value={form.paymentReference} onChange={(e) => setForm((f) => ({ ...f, paymentReference: e.target.value }))} />
          <Input label="Deduction reason" value={form.deductionReason} onChange={(e) => setForm((f) => ({ ...f, deductionReason: e.target.value }))} className="sm:col-span-2" />
        </div>

        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-4 text-white flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs text-emerald-200">Gross (calculated)</p>
            <p className="text-lg font-bold">{formatPKR(totals.grossEarnings)}</p>
          </div>
          <div>
            <p className="text-xs text-emerald-200">Total deductions</p>
            <p className="text-lg font-bold">{formatPKR(totals.totalDeductions)}</p>
          </div>
          <div>
            <p className="text-xs text-emerald-200">Net payable · {getMonthName(form.month)} {form.year}</p>
            <p className="text-2xl font-bold">{formatPKR(totals.netSalary)}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {isEdit ? 'Save changes' : 'Create manual payslip'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
