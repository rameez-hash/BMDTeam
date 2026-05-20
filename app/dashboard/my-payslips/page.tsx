'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { payslipNotesForDisplay } from '@/lib/payslip-display';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

interface ManualDeductionItem {
  id: string;
  label: string;
  amount: number;
  reason?: string;
}

interface PayslipRecord {
  id: string;
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
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  isManual?: boolean;
  paidAt?: string;
  notes?: string;
  employee: {
    firstName: string;
    lastName: string;
    employeeCode?: string;
    department?: { name: string };
  };
  manualDeductions?: ManualDeductionItem[];
}

const formatPKR = (amount: number) => {
  if (!amount && amount !== 0) return 'Rs 0';
  return 'Rs ' + Math.round(amount).toLocaleString('en-PK');
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MyPayslipsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | ''>('');
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipRecord | null>(null);

  const fetchPayslips = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '24');
      if (year !== '') params.append('year', String(year));
      const res = await fetch(`/api/payroll?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayslips(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch payslips:', err);
    } finally {
      setLoading(false);
    }
  }, [token, year]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  const downloadPayslip = async (id: string) => {
    try {
      const res = await fetch(`/api/payroll/payslip?id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const html = await res.text();
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.onload = () => setTimeout(() => w.print(), 500); }
      }
    } catch {
      toastRef.current.error('Failed to generate payslip');
    }
  };

  const totalEarnings = payslips.reduce((s, p) => s + p.grossEarnings, 0);
  const totalDeductions = payslips.reduce((s, p) => s + p.totalDeductions, 0);
  const totalNet = payslips.reduce((s, p) => s + p.netSalary, 0);

  const yearOptions: { value: string; label: string }[] = [{ value: '', label: 'All years' }];
  const currYear = new Date().getFullYear();
  for (let y = currYear; y >= currYear - 5; y--) {
    yearOptions.push({ value: y.toString(), label: y.toString() });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Payslips</h1>
              <p className="text-teal-100 text-sm mt-0.5">View and download your salary slips</p>
            </div>
          </div>
          <select
            value={year === '' ? '' : year.toString()}
            onChange={(e) => setYear(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            className="px-4 py-2.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/30 hover:bg-white/30 transition-all duration-200 appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='white' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.5rem center',
              backgroundSize: '1.5em 1.5em',
              backgroundRepeat: 'no-repeat',
              paddingRight: '2.5rem',
              minWidth: '7rem'
            }}
          >
            {yearOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="text-slate-900 bg-white">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Year Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg></div>
            <div>
              <p className="text-xs text-slate-500">Payslips</p>
              <p className="text-xl font-bold">{payslips.length}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-200 rounded-xl flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-blue-600"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /></svg></div>
            <div>
              <p className="text-xs text-blue-600">Total Earnings</p>
              <p className="text-lg font-bold text-blue-800">{formatPKR(totalEarnings)}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-red-50 border border-red-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-200 rounded-xl flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-red-600"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" /></svg></div>
            <div>
              <p className="text-xs text-red-600">Total Deductions</p>
              <p className="text-lg font-bold text-red-800">{formatPKR(totalDeductions)}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-200 rounded-xl flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-emerald-600"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></div>
            <div>
              <p className="text-xs text-emerald-600">Net Received</p>
              <p className="text-lg font-bold text-emerald-800">{formatPKR(totalNet)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="skeleton w-10 h-10 rounded-lg" />
                  <div className="space-y-1.5">
                    <div className="skeleton h-4 w-20 rounded-lg" />
                    <div className="skeleton h-3 w-14 rounded-lg" />
                  </div>
                </div>
                <div className="skeleton h-6 w-16 rounded-full" />
              </div>
              <div className="space-y-2 mb-3">
                <div className="flex justify-between">
                  <div className="skeleton h-3 w-20 rounded-lg" />
                  <div className="skeleton h-3 w-24 rounded-lg" />
                </div>
                <div className="flex justify-between">
                  <div className="skeleton h-3 w-24 rounded-lg" />
                  <div className="skeleton h-3 w-20 rounded-lg" />
                </div>
              </div>
              <div className="skeleton h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Payslip Cards */}
      {!loading && payslips.length > 0 && !selectedPayslip && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {payslips.map(p => (
            <div key={p.id} onClick={() => setSelectedPayslip(p)}
              className="cursor-pointer bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 lg:p-6 hover:shadow-md hover:border-emerald-300 transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <span className="text-emerald-700 font-bold text-sm">{MONTHS[p.month - 1]}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{MONTHS[p.month - 1]} {p.year}</p>
                    <p className="text-xs text-slate-500">{p.workingDays} working days</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={p.status === 'PAID' ? 'success' : p.status === 'DRAFT' ? 'warning' : 'info'}>{p.status}</Badge>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross</span>
                  <span className="font-medium">{formatPKR(p.grossEarnings)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Deductions</span>
                  <span className="text-red-600">-{formatPKR(p.totalDeductions)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Net Salary</span>
                  <span className="font-bold text-emerald-700">{formatPKR(p.netSalary)}</span>
                </div>
              </div>

              {p.paidAt && (
                <p className="text-[10px] text-slate-400 mt-2">
                  Paid: {new Date(p.paidAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Payslip Detail View */}
      {selectedPayslip && (
        <div className="space-y-4">
          <button onClick={() => setSelectedPayslip(null)} className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-800 font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to all payslips
          </button>

          <Card className="border border-slate-200">
            <div className="text-center border-b pb-4 mb-6">
              <h2 className="text-xl font-bold text-slate-900">SALARY SLIP</h2>
              <p className="text-slate-500">{MONTHS[selectedPayslip.month - 1]} {selectedPayslip.year}</p>
            </div>

            {/* Employee Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div><p className="text-xs text-slate-500">Employee Name</p><p className="font-semibold text-slate-900">{selectedPayslip.employee.firstName} {selectedPayslip.employee.lastName}</p></div>
              {selectedPayslip.employee.employeeCode && <div><p className="text-xs text-slate-500">Employee Code</p><p className="font-medium text-slate-900">{selectedPayslip.employee.employeeCode}</p></div>}
              {selectedPayslip.employee.department && <div><p className="text-xs text-slate-500">Department</p><p className="font-medium text-slate-900">{selectedPayslip.employee.department.name}</p></div>}
            </div>

            {payslipNotesForDisplay(selectedPayslip.notes) && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 mb-4">
                <p className="text-xs text-slate-700"><span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] mr-2">Remarks</span>{payslipNotesForDisplay(selectedPayslip.notes)}</p>
              </div>
            )}

            {/* Attendance */}
            <div className="grid grid-cols-6 gap-3 mb-6">
              <div className="text-center p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">Working</p><p className="text-lg font-bold">{selectedPayslip.workingDays}</p></div>
              <div className="text-center p-3 bg-emerald-50 rounded-lg"><p className="text-xs text-emerald-600">Present</p><p className="text-lg font-bold text-emerald-700">{selectedPayslip.presentDays}</p></div>
              <div className="text-center p-3 bg-red-50 rounded-lg"><p className="text-xs text-red-600">Absent</p><p className="text-lg font-bold text-red-700">{selectedPayslip.absentDays}</p></div>
              <div className="text-center p-3 bg-amber-50 rounded-lg"><p className="text-xs text-amber-600">Leave</p><p className="text-lg font-bold text-amber-700">{selectedPayslip.leaveDays}</p></div>
              <div className="text-center p-3 bg-violet-50 rounded-lg"><p className="text-xs text-violet-600">Half Day</p><p className="text-lg font-bold text-violet-700">{selectedPayslip.halfDays}</p></div>
              <div className="text-center p-3 bg-orange-50 rounded-lg"><p className="text-xs text-orange-600">Late</p><p className="text-lg font-bold text-orange-700">{selectedPayslip.lateDays}</p></div>
            </div>

            {/* Earnings & Deductions */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                <h4 className="font-semibold text-emerald-800 mb-3 text-sm">Earnings</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-600">Basic Salary</span><span>{formatPKR(selectedPayslip.basicSalary)}</span></div>
                  {selectedPayslip.hra > 0 && <div className="flex justify-between"><span className="text-slate-600">House Rent</span><span>{formatPKR(selectedPayslip.hra)}</span></div>}
                  {selectedPayslip.da > 0 && <div className="flex justify-between"><span className="text-slate-600">DA</span><span>{formatPKR(selectedPayslip.da)}</span></div>}
                  {selectedPayslip.ta > 0 && <div className="flex justify-between"><span className="text-slate-600">Transport</span><span>{formatPKR(selectedPayslip.ta)}</span></div>}
                  {selectedPayslip.medicalAllowance > 0 && <div className="flex justify-between"><span className="text-slate-600">Medical</span><span>{formatPKR(selectedPayslip.medicalAllowance)}</span></div>}
                  {selectedPayslip.otherAllowances > 0 && <div className="flex justify-between"><span className="text-slate-600">Other</span><span>{formatPKR(selectedPayslip.otherAllowances)}</span></div>}
                  {selectedPayslip.overtime > 0 && <div className="flex justify-between"><span className="text-slate-600">Overtime</span><span>{formatPKR(selectedPayslip.overtime)}</span></div>}
                  {selectedPayslip.bonus > 0 && <div className="flex justify-between"><span className="text-slate-600">Bonus</span><span>{formatPKR(selectedPayslip.bonus)}</span></div>}
                  <div className="flex justify-between pt-2 border-t border-emerald-300 font-semibold text-emerald-800">
                    <span>Gross</span><span>{formatPKR(selectedPayslip.grossEarnings)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <h4 className="font-semibold text-red-800 mb-3 text-sm">Deductions</h4>
                <div className="space-y-2 text-sm">
                  {selectedPayslip.tds > 0 && <div className="flex justify-between"><span className="text-slate-600">Income Tax (FBR)</span><span className="text-red-600">{formatPKR(selectedPayslip.tds)}</span></div>}
                  {selectedPayslip.pf > 0 && <div className="flex justify-between"><span className="text-slate-600">Provident Fund</span><span className="text-red-600">{formatPKR(selectedPayslip.pf)}</span></div>}
                  {selectedPayslip.esi > 0 && <div className="flex justify-between"><span className="text-slate-600">EOBI</span><span className="text-red-600">{formatPKR(selectedPayslip.esi)}</span></div>}
                  {selectedPayslip.professionalTax > 0 && <div className="flex justify-between"><span className="text-slate-600">Prof. Tax</span><span className="text-red-600">{formatPKR(selectedPayslip.professionalTax)}</span></div>}
                  {selectedPayslip.lateDeduction > 0 && <div className="flex justify-between"><span className="text-slate-600">Late Deduction</span><span className="text-red-600">{formatPKR(selectedPayslip.lateDeduction)}</span></div>}
                  {selectedPayslip.absentDeduction > 0 && <div className="flex justify-between"><span className="text-slate-600">Absent Deduction <span className="text-[10px] text-slate-400">({selectedPayslip.absentDays}d{selectedPayslip.halfDays > 0 ? ` incl. ${selectedPayslip.halfDays} half` : ''})</span></span><span className="text-red-600">{formatPKR(selectedPayslip.absentDeduction)}</span></div>}
                  {selectedPayslip.otherDeductions > 0 && <div className="flex justify-between"><span className="text-slate-600">Other Deductions</span><span className="text-red-600">{formatPKR(selectedPayslip.otherDeductions)}</span></div>}
                  {selectedPayslip.manualDeductions && selectedPayslip.manualDeductions.length > 0 ? (
                    <>
                      <div className="pt-2 mt-1 border-t border-red-200">
                        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Manual Deductions</p>
                      </div>
                      {selectedPayslip.manualDeductions.map((d) => (
                        <div key={d.id} className="flex justify-between">
                          <div className="flex flex-col">
                            <span className="text-slate-600">{d.label}</span>
                            {d.reason && <span className="text-[10px] text-slate-400">{d.reason}</span>}
                          </div>
                          <span className="text-red-600">{formatPKR(d.amount)}</span>
                        </div>
                      ))}
                    </>
                  ) : selectedPayslip.manualDeduction > 0 && (
                    <div className="flex justify-between"><span className="text-slate-600">Manual Deduction</span><span className="text-red-600">{formatPKR(selectedPayslip.manualDeduction)}</span></div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-red-300 font-semibold text-red-800">
                    <span>Total</span><span>{formatPKR(selectedPayslip.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Salary */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-emerald-200 text-sm">Net Salary</p>
                  <p className="text-3xl font-bold">{formatPKR(selectedPayslip.netSalary)}</p>
                </div>
                {selectedPayslip.paidAt && (
                  <div className="text-right">
                    <p className="text-emerald-200 text-sm">Paid On</p>
                    <p className="font-semibold">{new Date(selectedPayslip.paidAt).toLocaleDateString('en-PK')}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => downloadPayslip(selectedPayslip.id)}><svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download Payslip</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!loading && payslips.length === 0 && (
        <Card className="border border-slate-200">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-8 h-8 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg></div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Payslips</h3>
            <p className="text-slate-500">{year === '' ? 'No payslips found yet' : `No payslips found for ${year}`}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
