'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import ManualPayrollModal, { type ManualPayrollRecord } from '../../components/payroll/ManualPayrollModal';
import { payslipNotesForDisplay } from '@/lib/payslip-display';

interface PayrollRecord {
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
  deductionReason?: string;
  grossEarnings: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  isManual?: boolean;
  paidAt?: string;
  notes?: string;
  paymentReference?: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode?: string;
    department?: { id?: string; name: string };
  };
  manualDeductions?: { id: string; label: string; amount: number; reason?: string }[];
}

interface EmployeeSalary {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode?: string;
  department?: { id?: string; name: string };
  designation?: string;
  salary?: {
    basicSalary: number;
    hra: number;
    da: number;
    ta: number;
    medicalAllowance: number;
    otherAllowances: number;
    pf: number;
    tds: number;
    grossSalary: number;
    netSalary: number;
  };
}

const formatPKR = (amount: number) => {
  if (!amount && amount !== 0) return 'Rs 0';
  return 'Rs ' + Math.round(amount).toLocaleString('en-PK');
};

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const getMonthName = (m: number) => MONTHS[m - 1]?.label ?? '';

/** Must match /api/payroll list cap so admin sees every employee for the month */
const PAYROLL_LIST_LIMIT = '2000';

export default function PayrollPage() {
  const { allowed, loading: permLoading } = useRequirePermission('payroll', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Payroll" />;
  return <PayrollPageContent />;
}

function PayrollPageContent() {
  const { token, user } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeSalary[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() + 1);
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [generateDepartmentId, setGenerateDepartmentId] = useState('');

  const [activeTab, setActiveTab] = useState<'records' | 'generate' | 'salaries'>('records');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());

  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'paid' | 'revert' | 'delete' | 'deleteAll'; ids: string[]; label?: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [deductionPayrollId, setDeductionPayrollId] = useState('');
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null);
  const [newDeduction, setNewDeduction] = useState({ label: '', amount: 0, reason: '' });
  const [currentDeductions, setCurrentDeductions] = useState<{ id: string; label: string; amount: number; reason?: string }[]>([]);

  const [generateLoading, setGenerateLoading] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualEditRecord, setManualEditRecord] = useState<ManualPayrollRecord | null>(null);
  const [isPayrollLocked, setIsPayrollLocked] = useState(false);
  const [payrollLockDay, setPayrollLockDay] = useState(0);

  const isAdminOrHR = user?.role === 'ADMIN' || user?.role === 'HR';

  const eligibleGenerateCount = useMemo(
    () =>
      employees.filter(
        (e) => e.salary && (!generateDepartmentId || e.department?.id === generateDepartmentId)
      ).length,
    [employees, generateDepartmentId]
  );

  const fetchPayroll = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('month', month.toString());
      params.append('year', year.toString());
      params.append('limit', PAYROLL_LIST_LIMIT);
      if (statusFilter) params.append('status', statusFilter);
      if (departmentFilter) params.append('departmentId', departmentFilter);
      const res = await fetch(`/api/payroll?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch payroll:', err);
    } finally {
      setLoading(false);
    }
  }, [token, month, year, statusFilter, departmentFilter]);

  const fetchEmployees = useCallback(async () => {
    if (!isAdminOrHR) return;
    try {
      const res = await fetch('/api/employees?limit=500', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  }, [token, isAdminOrHR]);

  const fetchDepartments = useCallback(async () => {
    if (!isAdminOrHR) return;
    try {
      const res = await fetch('/api/departments', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  }, [token, isAdminOrHR]);

  const fetchPayrollLockStatus = useCallback(async () => {
    if (!isAdminOrHR) return;
    try {
      const res = await fetch(`/api/payroll/settings?month=${generateMonth}&year=${generateYear}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setIsPayrollLocked(data.data?.isPayrollLocked || false);
        setPayrollLockDay(data.data?.payrollLockDay || 0);
      }
    } catch { setIsPayrollLocked(false); }
  }, [token, generateMonth, generateYear, isAdminOrHR]);

  useEffect(() => {
    if (!token) return;
    if (isAdminOrHR) {
      fetchEmployees();
      fetchDepartments();
    }
    if (activeTab === 'records' || !isAdminOrHR) {
      setLoading(true);
      fetchPayroll();
    } else {
      setLoading(false);
    }
  }, [token, fetchPayroll, fetchEmployees, fetchDepartments, activeTab, isAdminOrHR]);

  useEffect(() => {
    if (token && isAdminOrHR && activeTab === 'generate') {
      fetchPayrollLockStatus();
    }
  }, [token, activeTab, fetchPayrollLockStatus, isAdminOrHR]);

  const handleGeneratePayroll = async () => {
    setGenerateLoading(true);
    try {
      const payload: { month: number; year: number; departmentId?: string } = { month: generateMonth, year: generateYear };
      if (generateDepartmentId) payload.departmentId = generateDepartmentId;

      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toastRef.current.success(data.message || 'Payroll generated successfully');
        setMonth(generateMonth);
        setYear(generateYear);
        setActiveTab('records');
        setLoading(true);
        fetchPayroll();
      } else {
        toastRef.current.error(data.error || 'Failed to generate payroll');
      }
    } catch {
      toastRef.current.error('Failed to generate payroll');
    } finally {
      setGenerateLoading(false);
      setShowGenerateConfirm(false);
    }
  };

  const fetchDeductions = async (id: string) => {
    try {
      const res = await fetch(`/api/payroll/deductions?payrollRecordId=${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setCurrentDeductions(data.data || []); }
    } catch { /* ignore */ }
  };

  const handleOpenDeductions = async (record: PayrollRecord) => {
    setDeductionPayrollId(record.id);
    setEditingRecord(record);
    setNewDeduction({ label: '', amount: 0, reason: '' });
    await fetchDeductions(record.id);
    setShowDeductionModal(true);
  };

  const handleAddDeduction = async () => {
    if (!newDeduction.label || newDeduction.amount <= 0) {
      toastRef.current.error('Enter valid label and amount');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/payroll/deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payrollRecordId: deductionPayrollId, ...newDeduction }),
      });
      if (res.ok) {
        toastRef.current.success('Deduction added');
        setNewDeduction({ label: '', amount: 0, reason: '' });
        await fetchDeductions(deductionPayrollId);
        const updatedRes = await fetch(`/api/payroll?month=${month}&year=${year}&limit=${PAYROLL_LIST_LIMIT}`, { headers: { Authorization: `Bearer ${token}` } });
        if (updatedRes.ok) {
          const updatedData = await updatedRes.json();
          const updatedRecords: PayrollRecord[] = updatedData.data || [];
          setRecords(updatedRecords);
          const updated = updatedRecords.find((rec: PayrollRecord) => rec.id === deductionPayrollId);
          if (updated) setEditingRecord(updated);
        }
      } else {
        const d = await res.json();
        toastRef.current.error(d.error || 'Failed');
      }
    } catch {
      toastRef.current.error('Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveDeduction = async (did: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/payroll/deductions?id=${did}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        toastRef.current.success('Removed');
        await fetchDeductions(deductionPayrollId);
        const updatedRes = await fetch(`/api/payroll?month=${month}&year=${year}&limit=${PAYROLL_LIST_LIMIT}`, { headers: { Authorization: `Bearer ${token}` } });
        if (updatedRes.ok) {
          const updatedData = await updatedRes.json();
          const updatedRecords: PayrollRecord[] = updatedData.data || [];
          setRecords(updatedRecords);
          const updated = updatedRecords.find((rec: PayrollRecord) => rec.id === deductionPayrollId);
          if (updated) setEditingRecord(updated);
        }
      }
    } catch {
      toastRef.current.error('Failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    const s = new Set(selectedRecords);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedRecords(s);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const { type, ids } = confirmAction;

      if (type === 'deleteAll') {
        // Bulk delete all draft records for current month/year
        const res = await fetch(`/api/payroll?all=true&month=${month}&year=${year}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          toastRef.current.success(data.message || 'All draft records deleted');
        } else {
          const err = await res.json();
          toastRef.current.error(err.error || 'Failed to delete');
        }
      } else {
        let ok = 0;
        for (const id of ids) {
          let res;
          if (type === 'delete') {
            res = await fetch(`/api/payroll?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          } else {
            res = await fetch('/api/payroll', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ id, status: type === 'paid' ? 'PAID' : 'DRAFT' }),
            });
          }
          if (res.ok) ok++;
        }
        if (ok > 0) toastRef.current.success(`${ok} record(s) updated`);
      }

      setSelectedRecords(new Set());
      fetchPayroll();
    } catch {
      toastRef.current.error('Failed');
    } finally {
      setActionLoading(false);
      setShowConfirmModal(false);
      setConfirmAction(null);
    }
  };

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

  const downloadBulkPayslips = async (ids: string[]) => {
    try {
      const res = await fetch(`/api/payroll/payslip?ids=${ids.join(',')}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const html = await res.text();
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.onload = () => setTimeout(() => w.print(), 500); }
      }
    } catch {
      toastRef.current.error('Failed');
    }
  };

  // CSV Export
  const downloadCSV = () => {
    const headers = ['Employee', 'Code', 'Department', 'Working Days', 'Present', 'Absent', 'Leave', 'Half Day', 'Late', 'Basic', 'HRA', 'DA', 'TA', 'Medical', 'Other Allow.', 'OT', 'Bonus', 'Gross', 'PF', 'ESI', 'Prof. Tax', 'Income Tax (FBR)', 'Late Ded.', 'Absent Ded.', 'Other Ded.', 'Manual Ded.', 'Total Ded.', 'Net Salary', 'Status'];
    const rows = records.map(r => [
      `${r.employee.firstName} ${r.employee.lastName}`, r.employee.employeeCode || '', r.employee.department?.name || '',
      r.workingDays, r.presentDays, r.absentDays, r.leaveDays, r.halfDays, r.lateDays,
      r.basicSalary, r.hra, r.da, r.ta, r.medicalAllowance, r.otherAllowances, r.overtime, r.bonus, r.grossEarnings,
      r.pf, r.esi, r.professionalTax, r.tds, r.lateDeduction, r.absentDeduction, r.otherDeductions, r.manualDeduction, r.totalDeductions,
      r.netSalary, r.status
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${getMonthName(month)}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Computed
  const totals = records.reduce(
    (a, r) => ({ gross: a.gross + r.grossEarnings, ded: a.ded + r.totalDeductions, net: a.net + r.netSalary }),
    { gross: 0, ded: 0, net: 0 }
  );
  const draftRecords = records.filter(r => r.status === 'DRAFT' || r.status === 'PROCESSED');
  const paidRecords = records.filter(r => r.status === 'PAID');

  // Group records by department
  const groupByDept = (recs: PayrollRecord[]) => {
    const groups: Record<string, { name: string; records: PayrollRecord[]; totalNet: number; totalGross: number }> = {};
    recs.forEach(r => {
      const deptName = r.employee.department?.name || 'Unassigned';
      if (!groups[deptName]) groups[deptName] = { name: deptName, records: [], totalNet: 0, totalGross: 0 };
      groups[deptName].records.push(r);
      groups[deptName].totalNet += r.netSalary;
      groups[deptName].totalGross += r.grossEarnings;
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  };

  const draftByDept = groupByDept(draftRecords);
  const paidByDept = groupByDept(paidRecords);

  const toggleDeptCollapse = (key: string) => {
    const s = new Set(collapsedDepts);
    s.has(key) ? s.delete(key) : s.add(key);
    setCollapsedDepts(s);
  };

  const getStatusBadge = (status: string) => {
    const v: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
      PAID: 'success', PROCESSED: 'info', DRAFT: 'warning', CANCELLED: 'danger',
    };
    return <Badge variant={v[status] || 'default'}>{status}</Badge>;
  };

  const payrollColumns = [
    ...(isAdminOrHR ? [{
      key: 'select', header: '',
      render: (r: PayrollRecord) => (
        <input type="checkbox" checked={selectedRecords.has(r.id)} onChange={() => handleToggleSelect(r.id)}
          className="w-4 h-4 text-emerald-600 border-slate-300 rounded" />
      ),
    }] : []),
    {
      key: 'emp', header: 'Employee',
      render: (r: PayrollRecord) => (
        <div>
          <p className="font-semibold text-slate-900">{r.employee.firstName} {r.employee.lastName}</p>
          <p className="text-xs text-slate-500">{r.employee.employeeCode} • {r.employee.department?.name || '-'}</p>
          {payslipNotesForDisplay(r.notes) && <p className="text-[10px] text-blue-600 mt-0.5 flex items-center gap-1"><svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{payslipNotesForDisplay(r.notes)}</p>}
        </div>
      ),
    },
    {
      key: 'attendance', header: 'Attendance',
      render: (r: PayrollRecord) => (
        <div className="text-xs space-y-0.5">
          <p>Working: <span className="font-medium">{r.workingDays}d</span></p>
          <p>Present: <span className="font-medium text-emerald-600">{r.presentDays}d</span></p>
          {r.leaveDays > 0 && <p>Leave: <span className="text-amber-600">{r.leaveDays}d</span></p>}
          {r.halfDays > 0 && <p>Half: <span className="text-violet-600">{r.halfDays}d</span></p>}
          {r.lateDays > 0 && <p>Late: <span className="text-orange-600">{r.lateDays}d</span></p>}
          {r.absentDays > 0 && <p>Absent: <span className="text-red-600">{r.absentDays}d</span></p>}
        </div>
      ),
    },
    { key: 'gross', header: 'Gross', render: (r: PayrollRecord) => <span className="font-medium">{formatPKR(r.grossEarnings)}</span> },
    { key: 'ded', header: 'Deductions', render: (r: PayrollRecord) => <span className="text-red-600 font-medium">-{formatPKR(r.totalDeductions)}</span> },
    { key: 'net', header: 'Net Salary', render: (r: PayrollRecord) => <span className="font-bold text-emerald-700">{formatPKR(r.netSalary)}</span> },
    {
      key: 'status', header: 'Status',
      render: (r: PayrollRecord) => (
        <div>
          {getStatusBadge(r.status)}
          {r.isManual && <Badge variant="info" className="mt-1">Manual</Badge>}
          {r.paidAt && <p className="text-[10px] text-slate-400 mt-1">{new Date(r.paidAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</p>}
        </div>
      ),
    },
    {
      key: 'actions', header: 'Actions',
      render: (r: PayrollRecord) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => { setSelectedRecord(r); setShowPayslipModal(true); }} title="View">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => downloadPayslip(r.id)} title="Download">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </Button>
          {isAdminOrHR && r.isManual && (r.status === 'DRAFT' || r.status === 'PROCESSED' || r.status === 'PAID') && (
            <Button
              size="sm"
              variant="ghost"
              title="Edit manual payslip"
              onClick={() => {
                setManualEditRecord({
                  ...r,
                  employeeId: r.employee.id,
                } as ManualPayrollRecord);
                setShowManualModal(true);
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </Button>
          )}
          {isAdminOrHR && (r.status === 'DRAFT' || r.status === 'PROCESSED') && (
            <>
              <Button size="sm" variant="ghost" onClick={() => handleOpenDeductions(r)} title="Deductions">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </Button>
              <Button size="sm" variant="success" onClick={() => { setConfirmAction({ type: 'paid', ids: [r.id] }); setShowConfirmModal(true); }}>Pay</Button>
            </>
          )}
          {r.status === 'PAID' && isAdminOrHR && (
            <Button size="sm" variant="secondary" onClick={() => { setConfirmAction({ type: 'revert', ids: [r.id] }); setShowConfirmModal(true); }}>Revert</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Payroll Management</h1>
              <p className="text-teal-100 text-sm mt-0.5">
                {activeTab === 'generate'
                  ? `Generate · ${getMonthName(generateMonth)} ${generateYear}`
                  : activeTab === 'salaries'
                    ? 'Employee salary structures'
                    : `${getMonthName(month)} ${year} · ${records.length} record${records.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Tabs */}
      {isAdminOrHR && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {([
            { id: 'records' as const, label: 'View Records' },
            { id: 'generate' as const, label: 'Generate' },
            { id: 'salaries' as const, label: 'Salaries' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.id ? 'bg-white text-green-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (activeTab === 'records' || !isAdminOrHR) && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="skeleton w-10 h-10 rounded-xl" />
                  <div className="space-y-2">
                    <div className="skeleton h-3 w-16 rounded-lg" />
                    <div className="skeleton h-5 w-24 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="skeleton h-10 w-full" />
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-t border-slate-100">
                <div className="skeleton h-4 w-4 rounded" />
                <div className="skeleton h-4 w-32 rounded-lg" />
                <div className="skeleton h-4 w-20 rounded-lg" />
                <div className="skeleton h-4 w-24 rounded-lg" />
                <div className="skeleton h-4 w-24 rounded-lg" />
                <div className="skeleton h-4 w-20 rounded-lg" />
                <div className="skeleton h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── PAYROLL RECORDS TAB ─── */}
      {activeTab === 'records' && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 border border-green-200 rounded-xl flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-green-600"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg></div>
                <div>
                  <p className="text-xs text-green-600 font-medium">Records</p>
                  <p className="text-xl font-bold text-green-900">{records.length}</p>
                </div>
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 border border-green-200 rounded-xl flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-green-600"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /></svg></div>
                <div>
                  <p className="text-xs text-green-600 font-medium">Gross</p>
                  <p className="text-lg font-bold text-green-900">{formatPKR(totals.gross)}</p>
                </div>
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 border border-red-200 rounded-xl flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-red-600"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" /></svg></div>
                <div>
                  <p className="text-xs text-red-600 font-medium">Deductions</p>
                  <p className="text-lg font-bold text-red-900">{formatPKR(totals.ded)}</p>
                </div>
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 border border-green-200 rounded-xl flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-green-600"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></div>
                <div>
                  <p className="text-xs text-green-600 font-medium">Net Payable</p>
                  <p className="text-lg font-bold text-green-900">{formatPKR(totals.net)}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* View filters — list only; does not affect Generate tab */}
          <Card className="border border-slate-200">
            <p className="text-xs text-slate-500 mb-3 px-1">Filter which payroll records to view (read-only).</p>
            <div className="flex flex-wrap items-end gap-4">
              <Select label="Month" value={month.toString()} onChange={(e) => setMonth(parseInt(e.target.value))} options={MONTHS} className="w-36" />
              <Input label="Year" type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="w-28" />
              <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[
                { value: '', label: 'All' }, { value: 'DRAFT', label: 'Draft' },
                { value: 'PROCESSED', label: 'Processed' }, { value: 'PAID', label: 'Paid' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]} className="w-32" />
              {isAdminOrHR && (
                <Select label="View department" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}
                  options={[{ value: '', label: 'All departments' }, ...departments.map(d => ({ value: d.id, label: d.name }))]} className="w-44" />
              )}
              <Button onClick={() => { setLoading(true); fetchPayroll(); }}><svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>Apply filter</Button>
            </div>
          </Card>

          {/* Export Bar — appears when records exist */}
          {records.length > 0 && (
            <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">{getMonthName(month)} {year} · {records.length} record{records.length !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-green-600">{departmentFilter ? departments.find(d => d.id === departmentFilter)?.name || 'Department' : 'All Departments'} · {statusFilter || 'All Statuses'} · Net: {formatPKR(totals.net)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={downloadCSV} className="text-green-700 border-green-300 hover:bg-green-100">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadBulkPayslips(records.map(r => r.id))} className="text-green-700 border-green-300 hover:bg-green-100">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  PDF Payslips
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Actions Bar */}
          {isAdminOrHR && draftRecords.length > 0 && (
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">{draftRecords.length} Pending Payment{draftRecords.length !== 1 ? 's' : ''} across {draftByDept.length} department{draftByDept.length !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-amber-600">Total: {formatPKR(draftRecords.reduce((s, r) => s + r.netSalary, 0))}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="success" onClick={() => { setConfirmAction({ type: 'paid', ids: draftRecords.map(r => r.id), label: `all ${draftRecords.length} pending records` }); setShowConfirmModal(true); }}>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Mark All Paid
                </Button>
                <Button size="sm" variant="secondary" onClick={() => downloadBulkPayslips(draftRecords.map(r => r.id))}>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download All
                </Button>
                <Button size="sm" variant="danger" onClick={() => { setConfirmAction({ type: 'deleteAll', ids: [], label: `all ${draftRecords.length} draft records for ${getMonthName(month)} ${year}` }); setShowConfirmModal(true); }}>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete All
                </Button>
              </div>
            </div>
          )}

          {/* Selected Actions */}
          {isAdminOrHR && selectedRecords.size > 0 && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <span className="text-sm font-medium text-emerald-700">{selectedRecords.size} selected</span>
              <div className="flex gap-2">
                <Button size="sm" variant="success" onClick={() => { setConfirmAction({ type: 'paid', ids: Array.from(selectedRecords), label: `${selectedRecords.size} selected records` }); setShowConfirmModal(true); }}>Mark Paid</Button>
                <Button size="sm" variant="secondary" onClick={() => downloadBulkPayslips(Array.from(selectedRecords))}><svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download</Button>
                <Button size="sm" variant="danger" onClick={() => { setConfirmAction({ type: 'delete', ids: Array.from(selectedRecords), label: `${selectedRecords.size} selected records` }); setShowConfirmModal(true); }}>Delete</Button>
              </div>
            </div>
          )}

          {/* ── Pending Records by Department ── */}
          {draftByDept.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <h2 className="text-lg font-bold text-slate-900">Pending</h2>
                <Badge variant="warning">{draftRecords.length}</Badge>
              </div>

              {draftByDept.map(dept => {
                const deptKey = `draft-${dept.name}`;
                const isCollapsed = collapsedDepts.has(deptKey);
                return (
                  <Card key={deptKey} padding={false} className="border border-amber-200 overflow-hidden">
                    <div
                      className="flex items-center justify-between px-5 py-3 bg-amber-50 border-b border-amber-200 cursor-pointer hover:bg-amber-100/70 transition-colors"
                      onClick={() => toggleDeptCollapse(deptKey)}
                    >
                      <div className="flex items-center gap-3">
                        <svg className={`w-4 h-4 text-amber-600 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center">
                          <span className="text-amber-700 font-bold text-xs">{dept.name[0]}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-amber-800">{dept.name}</p>
                          <p className="text-xs text-amber-600">{dept.records.length} employee{dept.records.length !== 1 ? 's' : ''} • Net: {formatPKR(dept.totalNet)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdminOrHR && (
                          <Button size="sm" variant="success" onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: 'paid', ids: dept.records.map(r => r.id), label: `${dept.name} department (${dept.records.length} employees)` }); setShowConfirmModal(true); }}>
                            Pay Department
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); downloadBulkPayslips(dept.records.map(r => r.id)); }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </Button>
                      </div>
                    </div>
                    {!isCollapsed && (
                      <Table columns={payrollColumns} data={dept.records} loading={false} emptyMessage="No records" />
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Paid Records by Department ── */}
          {paidByDept.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h2 className="text-lg font-bold text-slate-900">Paid</h2>
                <Badge variant="success">{paidRecords.length}</Badge>
              </div>

              {paidByDept.map(dept => {
                const deptKey = `paid-${dept.name}`;
                const isCollapsed = collapsedDepts.has(deptKey);
                return (
                  <Card key={deptKey} padding={false} className="border border-emerald-200 overflow-hidden">
                    <div
                      className="flex items-center justify-between px-5 py-3 bg-emerald-50 border-b border-emerald-200 cursor-pointer hover:bg-emerald-100/70 transition-colors"
                      onClick={() => toggleDeptCollapse(deptKey)}
                    >
                      <div className="flex items-center gap-3">
                        <svg className={`w-4 h-4 text-emerald-600 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <div className="w-8 h-8 rounded-lg bg-emerald-200 flex items-center justify-center">
                          <span className="text-emerald-700 font-bold text-xs">{dept.name[0]}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-800">{dept.name}</p>
                          <p className="text-xs text-emerald-600">{dept.records.length} employee{dept.records.length !== 1 ? 's' : ''} • Net: {formatPKR(dept.totalNet)}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); downloadBulkPayslips(dept.records.map(r => r.id)); }}>
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download All
                      </Button>
                    </div>
                    {!isCollapsed && (
                      <Table columns={payrollColumns} data={dept.records} loading={false} emptyMessage="No records" />
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {records.length === 0 && !loading && (
            <Card className="border border-slate-200">
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg></div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Payroll Records</h3>
                <p className="text-slate-500 mb-4">No records found for {getMonthName(month)} {year}</p>
                {isAdminOrHR && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button onClick={() => setActiveTab('generate')}>Generate (auto)</Button>
                    <Button variant="secondary" onClick={() => { setManualEditRecord(null); setShowManualModal(true); }}>Add Manual Payslip</Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ─── GENERATE TAB ─── */}
      {activeTab === 'generate' && isAdminOrHR && (
        <>
          <Card className="border border-emerald-200 bg-emerald-50/40">
            <p className="text-sm text-emerald-900 font-medium mb-1">Create new payroll records</p>
            <p className="text-xs text-emerald-800">
              Choose month, year, and scope here. This does not use filters on the View Records tab.
              Already generated employees for that month are skipped automatically.
            </p>
          </Card>

          <Card className="border border-slate-200">
            <div className="flex flex-wrap items-end gap-4">
              <Select label="Payroll month" value={generateMonth.toString()} onChange={(e) => setGenerateMonth(parseInt(e.target.value))} options={MONTHS} className="w-36" />
              <Input label="Payroll year" type="number" value={generateYear} onChange={(e) => setGenerateYear(parseInt(e.target.value))} className="w-28" />
              <Select
                label="Generate for"
                value={generateDepartmentId}
                onChange={(e) => setGenerateDepartmentId(e.target.value)}
                options={[{ value: '', label: 'All departments' }, ...departments.map(d => ({ value: d.id, label: d.name }))]}
                className="w-48"
              />
            </div>
            <p className="text-xs text-slate-500 mt-3">
              ~{eligibleGenerateCount} active employee{eligibleGenerateCount !== 1 ? 's' : ''} with salary
              {generateDepartmentId ? ` in ${departments.find(d => d.id === generateDepartmentId)?.name ?? 'selected department'}` : ' (all departments)'}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                onClick={() => setShowGenerateConfirm(true)}
                disabled={generateLoading || isPayrollLocked || eligibleGenerateCount === 0}
                variant="success"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 mr-1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                Generate Payroll (auto)
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setManualEditRecord(null);
                  setShowManualModal(true);
                }}
              >
                Add Manual Payslip
              </Button>
            </div>
          </Card>

          <Card className="border border-violet-200 bg-violet-50/40">
            <p className="text-sm font-medium text-violet-900 mb-1">Historical salary records</p>
            <p className="text-xs text-violet-800 mb-3">
              Add payslips for past months with the same fields as monthly payroll. Duplicate month per employee is blocked.
            </p>
            <Button
              variant="primary"
              onClick={() => {
                setManualEditRecord(null);
                setShowManualModal(true);
              }}
            >
              + Add Manual Payslip
            </Button>
          </Card>

          {isPayrollLocked && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-5 py-3">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-orange-800">Payroll Generation Locked</p>
                <p className="text-xs text-orange-600">
                  Locked for {getMonthName(generateMonth)} {generateYear}
                  {payrollLockDay > 0 ? ` (auto-lock day: ${payrollLockDay})` : ''}. Unlock in Settings → Payroll.
                </p>
              </div>
            </div>
          )}
          {!isPayrollLocked && payrollLockDay > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
              </div>
              <p className="text-sm text-amber-700">Auto-lock on <strong>{payrollLockDay} {getMonthName(generateMonth)} {generateYear}</strong>.</p>
            </div>
          )}

          <Card className="border border-blue-200 bg-blue-50/50">
            <p className="text-xs font-medium text-blue-800 mb-1.5">Calculation includes:</p>
            <ul className="text-[11px] text-blue-700 space-y-0.5">
              <li>• Salary components (Basic + Allowances)</li>
              <li>• Attendance-based absent deduction</li>
              <li>• Late arrival deductions</li>
              <li>• Pakistan FBR income tax slabs</li>
              <li>• PF & EOBI deductions</li>
            </ul>
          </Card>
        </>
      )}

      {/* ─── SALARIES TAB ─── */}
      {activeTab === 'salaries' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
              <div className="text-center">
                <p className="text-xs text-green-600">Total Employees</p>
                <p className="text-2xl font-bold text-green-900">{employees.length}</p>
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
              <div className="text-center">
                <p className="text-xs text-green-600">Salary Assigned</p>
                <p className="text-2xl font-bold text-green-900">{employees.filter(e => e.salary).length}</p>
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
              <div className="text-center">
                <p className="text-xs text-green-600">Monthly Cost</p>
                <p className="text-lg font-bold text-green-900">{formatPKR(employees.reduce((s, e) => s + (e.salary?.grossSalary || 0), 0))}</p>
              </div>
            </Card>
          </div>

          <Card padding={false} className="border border-slate-200">
            <CardHeader><CardTitle>Employee Salary Structure</CardTitle></CardHeader>
            <Table
              columns={[
                {
                  key: 'emp', header: 'Employee',
                  render: (e: EmployeeSalary) => (
                    <div>
                      <p className="font-semibold">{e.firstName} {e.lastName}</p>
                      <p className="text-xs text-slate-500">{e.employeeCode} • {e.department?.name || '-'}</p>
                    </div>
                  ),
                },
                { key: 'des', header: 'Designation', render: (e: EmployeeSalary) => <span className="text-sm">{e.designation || '-'}</span> },
                { key: 'basic', header: 'Basic', render: (e: EmployeeSalary) => <span className="font-medium">{e.salary ? formatPKR(e.salary.basicSalary) : '-'}</span> },
                { key: 'gross', header: 'Gross', render: (e: EmployeeSalary) => <span className="font-semibold text-blue-700">{e.salary ? formatPKR(e.salary.grossSalary) : '-'}</span> },
                {
                  key: 'net', header: 'Net',
                  render: (e: EmployeeSalary) => e.salary
                    ? <span className="font-bold text-emerald-700">{formatPKR(e.salary.netSalary)}</span>
                    : <Badge variant="warning">Not Set</Badge>,
                },
              ]}
              data={employees}
              loading={loading}
              emptyMessage="No employees"
            />
          </Card>
        </>
      )}

      <ManualPayrollModal
        isOpen={showManualModal}
        onClose={() => {
          setShowManualModal(false);
          setManualEditRecord(null);
        }}
        token={token || ''}
        employees={employees}
        months={MONTHS}
        getMonthName={getMonthName}
        editRecord={manualEditRecord}
        defaultMonth={generateMonth}
        defaultYear={generateYear}
        onSaved={() => {
          setMonth(manualEditRecord?.month ?? generateMonth);
          setYear(manualEditRecord?.year ?? generateYear);
          setActiveTab('records');
          setLoading(true);
          fetchPayroll();
        }}
        toast={toast}
      />

      {/* ─── GENERATE CONFIRMATION DIALOG ─── */}
      {showGenerateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Generate Payroll</h3>
              <p className="text-slate-600 text-sm mb-2">
                {generateDepartmentId ? (
                  <>
                    This will generate payroll for <strong>active employees in one department</strong> with salary assigned:
                  </>
                ) : (
                  <>
                    This will generate payroll for <strong>all active employees (all departments)</strong> with salary assigned:
                  </>
                )}
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                <p className="text-emerald-800 font-semibold">{getMonthName(generateMonth)} {generateYear}</p>
                <p className="text-sm text-emerald-700 mt-1">
                  {generateDepartmentId
                    ? departments.find((d) => d.id === generateDepartmentId)?.name ?? 'Selected department'
                    : 'All departments'}
                </p>
                <p className="text-xs text-emerald-600 mt-1">~{eligibleGenerateCount} eligible employee{eligibleGenerateCount !== 1 ? 's' : ''}</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4 text-left">
                <p className="text-xs font-medium text-blue-800 mb-1.5">Calculation includes:</p>
                <ul className="text-[11px] text-blue-700 space-y-0.5">
                  <li>• Salary components (Basic + Allowances)</li>
                  <li>• Attendance-based absent deduction</li>
                  <li>• Late arrival deductions</li>
                  <li>• Pakistan FBR income tax slabs</li>
                  <li>• PF & EOBI deductions</li>
                </ul>
              </div>
              <p className="text-xs text-slate-400 mb-4">Already generated records will be skipped.</p>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setShowGenerateConfirm(false)} disabled={generateLoading}>Cancel</Button>
                <Button variant="primary" className="flex-1" onClick={() => { setShowGenerateConfirm(false); handleGeneratePayroll(); }} loading={generateLoading}>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── PAYSLIP MODAL ─── */}
      <Modal isOpen={showPayslipModal} onClose={() => setShowPayslipModal(false)} title="Payslip" size="lg">
        {selectedRecord && (
          <div className="p-4 sm:p-6">
            <div className="text-center border-b pb-4 mb-6">
              <h2 className="text-xl font-bold text-slate-900">SALARY SLIP</h2>
              <p className="text-slate-500">{getMonthName(selectedRecord.month)} {selectedRecord.year}</p>
            </div>

            {/* Employee Info */}
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 rounded-xl">
              <div><p className="text-xs text-slate-500">Employee</p><p className="font-semibold">{selectedRecord.employee.firstName} {selectedRecord.employee.lastName}</p></div>
              <div><p className="text-xs text-slate-500">Department</p><p className="font-medium">{selectedRecord.employee.department?.name || '-'}</p></div>
              <div><p className="text-xs text-slate-500">Emp Code</p><p className="font-medium">{selectedRecord.employee.employeeCode || '-'}</p></div>
              <div><p className="text-xs text-slate-500">Status</p>{getStatusBadge(selectedRecord.status)}</div>
            </div>

            {/* Attendance Summary */}
            <div className="grid grid-cols-6 gap-2 mb-6">
              <div className="text-center p-3 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">Working</p><p className="text-lg font-bold">{selectedRecord.workingDays}</p></div>
              <div className="text-center p-3 bg-emerald-50 rounded-lg"><p className="text-xs text-emerald-600">Present</p><p className="text-lg font-bold text-emerald-700">{selectedRecord.presentDays}</p></div>
              <div className="text-center p-3 bg-amber-50 rounded-lg"><p className="text-xs text-amber-600">Leave</p><p className="text-lg font-bold text-amber-700">{selectedRecord.leaveDays}</p></div>
              <div className="text-center p-3 bg-violet-50 rounded-lg"><p className="text-xs text-violet-600">Half Day</p><p className="text-lg font-bold text-violet-700">{selectedRecord.halfDays}</p></div>
              <div className="text-center p-3 bg-orange-50 rounded-lg"><p className="text-xs text-orange-600">Late</p><p className="text-lg font-bold text-orange-700">{selectedRecord.lateDays}</p></div>
              <div className="text-center p-3 bg-red-50 rounded-lg"><p className="text-xs text-red-600">Absent</p><p className="text-lg font-bold text-red-700">{selectedRecord.absentDays}</p></div>
            </div>

            {/* Earnings & Deductions */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                <h4 className="font-semibold text-emerald-800 mb-3 text-sm">Earnings</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-600">Basic Salary</span><span>{formatPKR(selectedRecord.basicSalary)}</span></div>
                  {selectedRecord.hra > 0 && <div className="flex justify-between"><span className="text-slate-600">House Rent</span><span>{formatPKR(selectedRecord.hra)}</span></div>}
                  {selectedRecord.da > 0 && <div className="flex justify-between"><span className="text-slate-600">DA</span><span>{formatPKR(selectedRecord.da)}</span></div>}
                  {selectedRecord.ta > 0 && <div className="flex justify-between"><span className="text-slate-600">Transport</span><span>{formatPKR(selectedRecord.ta)}</span></div>}
                  {selectedRecord.medicalAllowance > 0 && <div className="flex justify-between"><span className="text-slate-600">Medical</span><span>{formatPKR(selectedRecord.medicalAllowance)}</span></div>}
                  {selectedRecord.otherAllowances > 0 && <div className="flex justify-between"><span className="text-slate-600">Other</span><span>{formatPKR(selectedRecord.otherAllowances)}</span></div>}
                  {selectedRecord.overtime > 0 && <div className="flex justify-between"><span className="text-slate-600">Overtime</span><span>{formatPKR(selectedRecord.overtime)}</span></div>}
                  {selectedRecord.bonus > 0 && <div className="flex justify-between"><span className="text-slate-600">Bonus</span><span>{formatPKR(selectedRecord.bonus)}</span></div>}
                  <div className="flex justify-between pt-2 border-t border-emerald-300 font-semibold text-emerald-800">
                    <span>Gross Earnings</span><span>{formatPKR(selectedRecord.grossEarnings)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                <h4 className="font-semibold text-red-800 mb-3 text-sm">Deductions</h4>
                <div className="space-y-2 text-sm">
                  {selectedRecord.tds > 0 && <div className="flex justify-between"><span className="text-slate-600">Income Tax (FBR)</span><span className="text-red-600">{formatPKR(selectedRecord.tds)}</span></div>}
                  {selectedRecord.pf > 0 && <div className="flex justify-between"><span className="text-slate-600">Provident Fund</span><span className="text-red-600">{formatPKR(selectedRecord.pf)}</span></div>}
                  {selectedRecord.esi > 0 && <div className="flex justify-between"><span className="text-slate-600">EOBI</span><span className="text-red-600">{formatPKR(selectedRecord.esi)}</span></div>}
                  {selectedRecord.professionalTax > 0 && <div className="flex justify-between"><span className="text-slate-600">Prof. Tax</span><span className="text-red-600">{formatPKR(selectedRecord.professionalTax)}</span></div>}
                  {selectedRecord.lateDeduction > 0 && <div className="flex justify-between"><span className="text-slate-600">Late Deduction <span className="text-[10px] text-slate-400">({selectedRecord.lateDays}d)</span></span><span className="text-red-600">{formatPKR(selectedRecord.lateDeduction)}</span></div>}
                  {selectedRecord.absentDeduction > 0 && <div className="flex justify-between"><span className="text-slate-600">Absent Deduction <span className="text-[10px] text-slate-400">({selectedRecord.absentDays}d{selectedRecord.halfDays > 0 ? ` incl. ${selectedRecord.halfDays} half` : ''})</span></span><span className="text-red-600">{formatPKR(selectedRecord.absentDeduction)}</span></div>}
                  {selectedRecord.otherDeductions > 0 && <div className="flex justify-between"><span className="text-slate-600">Other Deductions</span><span className="text-red-600">{formatPKR(selectedRecord.otherDeductions)}</span></div>}
                  {selectedRecord.manualDeductions && selectedRecord.manualDeductions.length > 0 ? (
                    <>
                      <div className="pt-2 mt-1 border-t border-red-200">
                        <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Manual Deductions</p>
                      </div>
                      {selectedRecord.manualDeductions.map((d) => (
                        <div key={d.id} className="flex justify-between">
                          <div className="flex flex-col">
                            <span className="text-slate-600">{d.label}</span>
                            {d.reason && <span className="text-[10px] text-slate-400">{d.reason}</span>}
                          </div>
                          <span className="text-red-600">{formatPKR(d.amount)}</span>
                        </div>
                      ))}
                    </>
                  ) : selectedRecord.manualDeduction > 0 && (
                    <div className="flex justify-between"><span className="text-slate-600">Manual Deductions</span><span className="text-red-600">{formatPKR(selectedRecord.manualDeduction)}</span></div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-red-300 font-semibold text-red-800">
                    <span>Total Deductions</span><span>{formatPKR(selectedRecord.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Salary Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-5 text-white mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-emerald-200 text-sm">Net Salary Payable</p>
                  <p className="text-3xl font-bold">{formatPKR(selectedRecord.netSalary)}</p>
                </div>
                {selectedRecord.paidAt && (
                  <div className="text-right">
                    <p className="text-emerald-200 text-sm">Paid On</p>
                    <p className="font-semibold">{new Date(selectedRecord.paidAt).toLocaleDateString('en-PK')}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowPayslipModal(false)}>Close</Button>
              <Button onClick={() => downloadPayslip(selectedRecord.id)}><svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download Payslip</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── DEDUCTION MODAL ─── */}
      {showDeductionModal && editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Manage Deductions</h3>
                <p className="text-sm text-slate-500">{editingRecord.employee.firstName} {editingRecord.employee.lastName} • {getMonthName(editingRecord.month)} {editingRecord.year}</p>
              </div>
              <button onClick={() => { setShowDeductionModal(false); setEditingRecord(null); }} className="p-2 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Add Deduction Form */}
            <div className="bg-slate-50 rounded-xl p-4 border mb-4">
              <h4 className="text-sm font-semibold mb-3">Add New Deduction</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Label" value={newDeduction.label} onChange={(e) => setNewDeduction({ ...newDeduction, label: e.target.value })} placeholder="e.g., Loan EMI" />
                <Input label="Amount (Rs)" type="number" value={newDeduction.amount} onChange={(e) => setNewDeduction({ ...newDeduction, amount: parseFloat(e.target.value) || 0 })} min={0} />
              </div>
              <textarea value={newDeduction.reason} onChange={(e) => setNewDeduction({ ...newDeduction, reason: e.target.value })}
                placeholder="Reason (optional)" rows={2}
                className="w-full mt-3 px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              <div className="flex justify-end mt-3">
                <Button size="sm" onClick={handleAddDeduction} disabled={actionLoading || !newDeduction.label || newDeduction.amount <= 0}>+ Add</Button>
              </div>
            </div>

            {/* Current Deductions List */}
            <div className="border rounded-xl overflow-hidden mb-4">
              <div className="bg-slate-100 px-4 py-2.5"><h4 className="text-sm font-semibold">Current Deductions</h4></div>
              {currentDeductions.length === 0 ? (
                <p className="px-4 py-6 text-center text-slate-400 text-sm">No manual deductions</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {currentDeductions.map(d => (
                    <div key={d.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <p className="font-medium text-sm">{d.label}</p>
                        {d.reason && <p className="text-xs text-slate-500">{d.reason}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-red-600 text-sm">-{formatPKR(d.amount)}</span>
                        <button onClick={() => handleRemoveDeduction(d.id)} disabled={actionLoading}
                          className="p-1.5 text-red-400 hover:text-red-600 rounded disabled:opacity-50">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span>Gross Earnings</span><span className="font-medium">{formatPKR(editingRecord.grossEarnings)}</span></div>
                <div className="flex justify-between"><span>Income Tax (FBR)</span><span className="text-red-600">-{formatPKR(editingRecord.tds || 0)}</span></div>
                <div className="flex justify-between"><span>Manual ({currentDeductions.length})</span><span className="text-red-600">-{formatPKR(currentDeductions.reduce((s, d) => s + d.amount, 0))}</span></div>
                <div className="flex justify-between pt-2 border-t border-emerald-300 font-bold">
                  <span>Net Salary</span><span className="text-emerald-700">{formatPKR(editingRecord.netSalary)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONFIRM MODAL ─── */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                confirmAction.type === 'paid' ? 'bg-emerald-100' : (confirmAction.type === 'delete' || confirmAction.type === 'deleteAll') ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                {confirmAction.type === 'paid' ? <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> : (confirmAction.type === 'delete' || confirmAction.type === 'deleteAll') ? <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> : <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>}
              </div>
              <h3 className="text-lg font-bold mb-2">
                {confirmAction.type === 'paid' ? 'Confirm Payment' : (confirmAction.type === 'delete' || confirmAction.type === 'deleteAll') ? 'Delete Records' : 'Revert to Draft'}
              </h3>
              <p className="text-slate-600 text-sm mb-4">
                {confirmAction.type === 'deleteAll' ? (
                  <>Are you sure you want to permanently delete <strong>{confirmAction.label}</strong>? This action cannot be undone.</>
                ) : confirmAction.label ? (
                  <>{confirmAction.type === 'paid' ? 'Mark' : confirmAction.type === 'delete' ? 'Delete' : 'Revert'} <strong>{confirmAction.label}</strong> as {confirmAction.type === 'paid' ? 'paid' : confirmAction.type === 'delete' ? 'deleted' : 'draft'}?</>
                ) : (
                  <>{confirmAction.ids.length} record(s) will be {confirmAction.type === 'paid' ? 'marked as paid' : confirmAction.type === 'delete' ? 'permanently deleted' : 'reverted to draft'}</>
                )}
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => { setShowConfirmModal(false); setConfirmAction(null); }} disabled={actionLoading}>Cancel</Button>
                <Button variant={(confirmAction.type === 'delete' || confirmAction.type === 'deleteAll') ? 'danger' : 'success'} className="flex-1" onClick={handleConfirmAction} loading={actionLoading}>Confirm</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
