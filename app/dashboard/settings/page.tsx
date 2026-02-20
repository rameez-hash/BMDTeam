'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface Shift {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  graceTime: number;
  earlyCheckInGrace: number;
  checkOutGrace: number;
  standardWorkHours: number;
  minCheckInGap: number;
  minWorkMinutes: number;
  workDays?: number[];
  isActive: boolean;
  _count?: { employees: number };
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  annualAllocation: number;
  isPaid: boolean;
  isProratedOnJoin: boolean;
  isCarryForward: boolean;
  maxCarryForward: number;
  isActive: boolean;
}

interface LateRule {
  id: string;
  name: string;
  minLateCount: number;
  maxLateCount: number | null;
  deductionType: string;
  deductionValue: number;
  deductionDays: number;
  description?: string;
  isActive: boolean;
}

interface TaxSlab {
  id: string;
  name: string;
  minIncome: number;
  maxIncome: number | null;
  fixedTax: number;
  taxRate: number;
  year: number;
  isActive: boolean;
}

interface PayrollSettingsData {
  month: number;
  year: number;
  attendanceLockDay: number;
  isAttendanceLocked: boolean;
  isPayrollLocked: boolean;
  payrollLockDay: number;
  payrollClosingDay: number;
  notes?: string;
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

type Tab = 'shifts' | 'payroll' | 'leave' | 'late' | 'tax' | 'docfields' | 'general';

const TABS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'shifts', label: 'Shifts', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, desc: 'Work schedules' },
  { id: 'payroll', label: 'Payroll', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18v-.008zm-12 0h.008v.008H6v-.008z" /></svg>, desc: 'Monthly payroll' },
  { id: 'leave', label: 'Leave Types', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>, desc: 'Leave policies' },
  { id: 'late', label: 'Late Rules', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>, desc: 'Deduction rules' },
  { id: 'tax', label: 'Tax Slabs', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>, desc: 'FBR tax rates' },
  { id: 'docfields', label: 'Document Fields', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>, desc: 'Document types' },
  { id: 'general', label: 'General', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, desc: 'Organization' },
];

export default function SettingsPage() {
  const { allowed, loading: permLoading } = useRequirePermission('settings', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Settings" />;
  return <SettingsPageContent />;
}

function SettingsPageContent() {
  const { token, user } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [activeTab, setActiveTab] = useState<Tab>('shifts');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Shifts
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState({ name: '', code: '', startTime: '09:00', endTime: '18:00', breakDuration: 60, graceTime: 15, earlyCheckInGrace: 30, checkOutGrace: 15, standardWorkHours: 9, minCheckInGap: 180, minWorkMinutes: 240, halfDayThresholdMins: 240, autoHalfDay: false, workDays: [1, 2, 3, 4, 5] as number[] });

  // Leave Types
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveType | null>(null);
  const [leaveForm, setLeaveForm] = useState({ name: '', code: '', annualAllocation: 12, isPaid: true, isProratedOnJoin: true, isCarryForward: false, maxCarryForward: 0 });
  const [bulkCalcLoading, setBulkCalcLoading] = useState(false);
  const [policyYear, setPolicyYear] = useState(new Date().getFullYear());

  // Late Rules
  const [lateRules, setLateRules] = useState<LateRule[]>([]);
  const [showLateForm, setShowLateForm] = useState(false);
  const [editingLate, setEditingLate] = useState<LateRule | null>(null);
  const [lateForm, setLateForm] = useState({ name: '', minLateCount: 1, maxLateCount: 3, deductionType: 'PER_LATE_DAYS', deductionValue: 3, deductionDays: 0.5, description: '' });

  // Tax Slabs
  const [taxSlabs, setTaxSlabs] = useState<TaxSlab[]>([]);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxSlab | null>(null);
  const [taxForm, setTaxForm] = useState({ name: '', minIncome: 0, maxIncome: 0, fixedTax: 0, taxRate: 0, year: new Date().getFullYear() });

  // Payroll Settings
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettingsData>({
    month: new Date().getMonth() + 1, year: new Date().getFullYear(),
    attendanceLockDay: 0, isAttendanceLocked: false, isPayrollLocked: false, payrollLockDay: 0, payrollClosingDay: 5,
  });
  const [allPayrollSettings, setAllPayrollSettings] = useState<PayrollSettingsData[]>([]);

  // General
  const [generalSettings, setGeneralSettings] = useState({
    companyName: '', currency: 'PKR', timezone: 'Asia/Karachi',
    financialYearStart: '7', weeklyOff: 'SUNDAY',
  });

  // Document Fields
  const [docFields, setDocFields] = useState<{ id: string; name: string; description?: string; isRequired: boolean; employeeCanEdit: boolean; isActive: boolean; sortOrder: number; _count?: { documents: number } }[]>([]);
  const [showDocFieldForm, setShowDocFieldForm] = useState(false);
  const [editingDocField, setEditingDocField] = useState<typeof docFields[0] | null>(null);
  const [docFieldForm, setDocFieldForm] = useState({ name: '', description: '', isRequired: false, employeeCanEdit: false });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const isAdmin = user?.role === 'ADMIN';

  /* ─── Fetch helpers ─── */
  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shifts', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setShifts(d.data || []); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [token]);

  const fetchLeaveTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leave/types', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setLeaveTypes(d.data || []); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [token]);

  const fetchLateRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/late-rules', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setLateRules(d.data || []); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [token]);

  const fetchTaxSlabs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tax-slabs?year=${taxYear}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setTaxSlabs(d.data || []); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [token, taxYear]);

  const fetchPayrollSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll/settings?month=${payrollMonth}&year=${payrollYear}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setPayrollSettings(d.data || { month: payrollMonth, year: payrollYear, attendanceLockDay: 0, isAttendanceLocked: false, payrollClosingDay: 5 });
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, payrollMonth, payrollYear]);

  const fetchAllPayrollSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/payroll/settings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setAllPayrollSettings(d.data || []); }
    } catch { /* silent */ }
  }, [token]);

  const fetchDocFields = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/document-fields', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setDocFields(d.data || []); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === 'shifts') fetchShifts();
    else if (activeTab === 'leave') fetchLeaveTypes();
    else if (activeTab === 'late') fetchLateRules();
    else if (activeTab === 'tax') fetchTaxSlabs();
    else if (activeTab === 'payroll') { fetchPayrollSettings(); fetchAllPayrollSettings(); }
    else if (activeTab === 'docfields') fetchDocFields();
  }, [token, activeTab, fetchShifts, fetchLeaveTypes, fetchLateRules, fetchTaxSlabs, fetchPayrollSettings, fetchAllPayrollSettings, fetchDocFields]);

  /* ─── Shift handlers ─── */
  const handleSaveShift = async () => {
    if (!shiftForm.name || !shiftForm.code || !shiftForm.startTime || !shiftForm.endTime) { toastRef.current.error('Fill all required fields'); return; }
    setSaving(true);
    try {
      const url = editingShift ? `/api/shifts?id=${editingShift.id}` : '/api/shifts';
      const res = await fetch(url, { method: editingShift ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(shiftForm) });
      if (res.ok) {
        toastRef.current.success(editingShift ? 'Shift updated' : 'Shift created');
        setShowShiftForm(false); setEditingShift(null);
        setShiftForm({ name: '', code: '', startTime: '09:00', endTime: '18:00', breakDuration: 60, graceTime: 15, earlyCheckInGrace: 30, checkOutGrace: 15, standardWorkHours: 9, minCheckInGap: 180, minWorkMinutes: 240, halfDayThresholdMins: 240, autoHalfDay: false, workDays: [1, 2, 3, 4, 5] });
        fetchShifts();
      } else { const d = await res.json(); toastRef.current.error(d.error || 'Failed'); }
    } catch { toastRef.current.error('Failed'); } finally { setSaving(false); }
  };

  const handleDeleteShift = async (id: string) => {
    openConfirm({ title: 'Delete Shift', message: 'Delete this shift?', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/shifts?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { toastRef.current.success('Shift deleted'); fetchShifts(); }
        else { const d = await res.json(); toastRef.current.error(d.error || 'Failed'); }
      } catch { toastRef.current.error('Failed'); }
    }});
  };

  /* ─── Leave type handlers ─── */
  const handleSaveLeave = async () => {
    if (!leaveForm.name || !leaveForm.code) { toastRef.current.error('Fill name and code'); return; }
    setSaving(true);
    try {
      const url = editingLeave ? `/api/leave/types?id=${editingLeave.id}` : '/api/leave/types';
      const res = await fetch(url, { method: editingLeave ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(leaveForm) });
      if (res.ok) {
        toastRef.current.success(editingLeave ? 'Leave type updated' : 'Leave type created');
        setShowLeaveForm(false); setEditingLeave(null);
        setLeaveForm({ name: '', code: '', annualAllocation: 12, isPaid: true, isProratedOnJoin: true, isCarryForward: false, maxCarryForward: 0 });
        fetchLeaveTypes();
      } else { const d = await res.json(); toastRef.current.error(d.error || 'Failed'); }
    } catch { toastRef.current.error('Failed'); } finally { setSaving(false); }
  };

  const handleDeleteLeave = async (id: string) => {
    openConfirm({ title: 'Deactivate Leave Type', message: 'Deactivate this leave type? Existing records will be preserved.', variant: 'warning', confirmText: 'Deactivate', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/leave/types?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { toastRef.current.success('Leave type deactivated'); fetchLeaveTypes(); }
        else { const d = await res.json(); toastRef.current.error(d.error || 'Failed'); }
      } catch { toastRef.current.error('Failed'); }
    }});
  };

  /* ─── Late Rule handlers ─── */
  const handleSaveLateRule = async () => {
    if (!lateForm.name) { toastRef.current.error('Enter rule name'); return; }
    setSaving(true);
    try {
      const url = editingLate ? `/api/late-rules?id=${editingLate.id}` : '/api/late-rules';
      const res = await fetch(url, { method: editingLate ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(lateForm) });
      if (res.ok) {
        toastRef.current.success(editingLate ? 'Rule updated' : 'Rule created');
        setShowLateForm(false); setEditingLate(null);
        setLateForm({ name: '', minLateCount: 1, maxLateCount: 0, deductionType: 'PER_LATE_DAYS', deductionValue: 3, deductionDays: 0.5, description: '' });
        fetchLateRules();
      } else { const d = await res.json(); toastRef.current.error(d.error || 'Failed'); }
    } catch { toastRef.current.error('Failed'); } finally { setSaving(false); }
  };

  const handleDeleteLateRule = async (id: string) => {
    openConfirm({ title: 'Delete Late Rule', message: 'Delete this late rule?', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/late-rules?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { toastRef.current.success('Deleted'); fetchLateRules(); }
        else { const d = await res.json(); toastRef.current.error(d.error || 'Failed'); }
      } catch { toastRef.current.error('Failed'); }
    }});
  };

  /* ─── Tax Slab handlers ─── */
  const handleSaveTaxSlab = async () => {
    if (!taxForm.name) { toastRef.current.error('Enter slab name'); return; }
    setSaving(true);
    try {
      const url = editingTax ? `/api/tax-slabs?id=${editingTax.id}` : '/api/tax-slabs';
      const body = { ...taxForm, maxIncome: taxForm.maxIncome || null };
      const res = await fetch(url, { method: editingTax ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (res.ok) {
        toastRef.current.success(editingTax ? 'Slab updated' : 'Slab created');
        setShowTaxForm(false); setEditingTax(null);
        setTaxForm({ name: '', minIncome: 0, maxIncome: 0, fixedTax: 0, taxRate: 0, year: taxYear });
        fetchTaxSlabs();
      } else { const d = await res.json(); toastRef.current.error(d.error || 'Failed'); }
    } catch { toastRef.current.error('Failed'); } finally { setSaving(false); }
  };

  const handleDeleteTaxSlab = async (id: string) => {
    openConfirm({ title: 'Delete Tax Slab', message: 'Delete this tax slab?', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/tax-slabs?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { toastRef.current.success('Deleted'); fetchTaxSlabs(); }
        else { const d = await res.json(); toastRef.current.error(d.error || 'Failed'); }
      } catch { toastRef.current.error('Failed'); }
    }});
  };

  /* ─── Payroll Settings handlers ─── */
  const handleSavePayrollSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/payroll/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          month: payrollMonth,
          year: payrollYear,
          attendanceLockDay: payrollSettings.attendanceLockDay,
          payrollClosingDay: payrollSettings.payrollClosingDay,
          payrollLockDay: payrollSettings.payrollLockDay,
          notes: payrollSettings.notes,
        }),
      });
      if (res.ok) {
        toastRef.current.success(`Settings saved for ${getMonthName(payrollMonth)} ${payrollYear}`);
        fetchPayrollSettings(); fetchAllPayrollSettings();
      } else { const d = await res.json(); toastRef.current.error(d.error || 'Failed'); }
    } catch { toastRef.current.error('Failed'); } finally { setSaving(false); }
  };

  const handleLockAttendance = async (lock: boolean) => {
    setSaving(true);
    try {
      const res = await fetch('/api/payroll/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: payrollMonth, year: payrollYear, lockAttendance: lock }),
      });
      if (res.ok) {
        toastRef.current.success(lock ? `Attendance locked for ${getMonthName(payrollMonth)}` : 'Attendance unlocked');
        fetchPayrollSettings(); fetchAllPayrollSettings();
      }
    } catch { toastRef.current.error('Failed'); } finally { setSaving(false); }
  };

  const handleLockPayroll = async (lock: boolean) => {
    setSaving(true);
    try {
      const res = await fetch('/api/payroll/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: payrollMonth, year: payrollYear, lockPayroll: lock }),
      });
      if (res.ok) {
        toastRef.current.success(lock ? `Payroll generation locked for ${getMonthName(payrollMonth)}` : 'Payroll generation unlocked');
        fetchPayrollSettings(); fetchAllPayrollSettings();
      }
    } catch { toastRef.current.error('Failed'); } finally { setSaving(false); }
  };

  const fmtTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  /* ─── Document Fields handlers ─── */
  const handleSaveDocField = async () => {
    if (!docFieldForm.name.trim()) { toastRef.current.error('Field name is required'); return; }
    setSaving(true);
    try {
      const method = editingDocField ? 'PUT' : 'POST';
      const body = editingDocField ? { id: editingDocField.id, ...docFieldForm } : docFieldForm;
      const res = await fetch('/api/document-fields', { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (res.ok) {
        toastRef.current.success(editingDocField ? 'Document field updated' : 'Document field created');
        setShowDocFieldForm(false); setEditingDocField(null);
        setDocFieldForm({ name: '', description: '', isRequired: false, employeeCanEdit: false });
        fetchDocFields();
      } else { const d = await res.json(); toastRef.current.error(d.error || 'Failed'); }
    } catch { toastRef.current.error('Failed'); } finally { setSaving(false); }
  };

  const handleDeleteDocField = async (id: string) => {
    openConfirm({ title: 'Delete Document Field', message: 'Delete this document field? If documents exist, it will be deactivated.', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/document-fields?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { toastRef.current.success('Document field removed'); fetchDocFields(); }
        else { const d = await res.json(); toastRef.current.error(d.error || 'Failed'); }
      } catch { toastRef.current.error('Failed'); }
    }});
  };

  const handleToggleDocField = async (field: typeof docFields[0]) => {
    try {
      const res = await fetch('/api/document-fields', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: field.id, isActive: !field.isActive }) });
      if (res.ok) { toastRef.current.success(field.isActive ? 'Field deactivated' : 'Field activated'); fetchDocFields(); }
    } catch { toastRef.current.error('Failed'); }
  };

  /* ─── Render ─── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-teal-100 text-sm mt-0.5">Configure your HRMS system</p>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 shrink-0">
          <nav className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-b border-slate-100 last:border-0 ${
                  activeTab === t.id
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-l-[3px] border-l-emerald-500 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50 border-l-[3px] border-l-transparent'
                }`}>
                <span className={`flex-shrink-0 ${activeTab === t.id ? 'text-emerald-600' : 'text-slate-400'}`}>{t.icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${activeTab === t.id ? 'text-emerald-700' : 'text-slate-700'}`}>{t.label}</p>
                  <p className="text-[11px] text-slate-400">{t.desc}</p>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* ════════════ SHIFTS ════════════ */}
          {activeTab === 'shifts' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div><h2 className="text-xl font-bold text-slate-900">Work Shifts</h2><p className="text-sm text-slate-500">{shifts.length} shift{shifts.length !== 1 ? 's' : ''} configured</p></div>
                {isAdmin && (
                  <Button onClick={() => { setEditingShift(null); setShiftForm({ name: '', code: '', startTime: '09:00', endTime: '18:00', breakDuration: 60, graceTime: 15, earlyCheckInGrace: 30, checkOutGrace: 15, standardWorkHours: 9, minCheckInGap: 180, minWorkMinutes: 240, halfDayThresholdMins: 240, autoHalfDay: false, workDays: [1, 2, 3, 4, 5] }); setShowShiftForm(true); }}>
                    + Add Shift
                  </Button>
                )}
              </div>

              {showShiftForm && (
                <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
                  <h3 className="font-bold text-slate-900 mb-4">{editingShift ? 'Edit Shift' : 'New Shift'}</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Input label="Shift Name *" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} placeholder="Morning Shift" />
                    <Input label="Code *" value={shiftForm.code} onChange={(e) => setShiftForm({ ...shiftForm, code: e.target.value.toUpperCase() })} placeholder="MORNING" />
                    <Input label="Start Time *" type="time" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} />
                    <Input label="End Time *" type="time" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} />
                    <Input label="Break (min)" type="number" value={shiftForm.breakDuration} onChange={(e) => setShiftForm({ ...shiftForm, breakDuration: parseInt(e.target.value) || 0 })} />
                    <Input label="Late Grace (min)" type="number" value={shiftForm.graceTime} onChange={(e) => setShiftForm({ ...shiftForm, graceTime: parseInt(e.target.value) || 0 })} />
                    <Input label="Early Check-in Grace (min)" type="number" value={shiftForm.earlyCheckInGrace} onChange={(e) => setShiftForm({ ...shiftForm, earlyCheckInGrace: parseInt(e.target.value) || 0 })} hint="How early before shift start can check in" />
                    <Input label="Checkout Grace (min)" type="number" value={shiftForm.checkOutGrace} onChange={(e) => setShiftForm({ ...shiftForm, checkOutGrace: parseInt(e.target.value) || 0 })} hint="Grace after shift end for checkout" />
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Standard Work Hours</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <input type="number" min="0" max="23" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Hours" value={Math.floor(shiftForm.standardWorkHours)} onChange={(e) => { const h = parseInt(e.target.value) || 0; const currentM = Math.round((shiftForm.standardWorkHours - Math.floor(shiftForm.standardWorkHours)) * 60); setShiftForm({ ...shiftForm, standardWorkHours: h + currentM / 60 }); }} />
                          <span className="text-[10px] text-slate-400 mt-0.5 block text-center">Hours</span>
                        </div>
                        <span className="text-lg font-bold text-slate-400 mt-[-14px]">:</span>
                        <div className="flex-1">
                          <input type="number" min="0" max="59" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Minutes" value={Math.round((shiftForm.standardWorkHours - Math.floor(shiftForm.standardWorkHours)) * 60)} onChange={(e) => { const m = Math.min(59, parseInt(e.target.value) || 0); const currentH = Math.floor(shiftForm.standardWorkHours); setShiftForm({ ...shiftForm, standardWorkHours: currentH + m / 60 }); }} />
                          <span className="text-[10px] text-slate-400 mt-0.5 block text-center">Minutes</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Full working hours for overtime calc (e.g. 8h 30m)</p>
                    </div>
                    <Input label="Min Check-in Gap (min)" type="number" value={shiftForm.minCheckInGap} onChange={(e) => setShiftForm({ ...shiftForm, minCheckInGap: parseInt(e.target.value) || 0 })} hint="Minimum gap after checkout (default 180 = 3hrs)" />
                    <Input label="Min Work Before Checkout (min)" type="number" value={shiftForm.minWorkMinutes} onChange={(e) => setShiftForm({ ...shiftForm, minWorkMinutes: parseInt(e.target.value) || 0 })} hint="Minimum minutes before checkout allowed (default 240 = 4hrs)" />
                    <Input label="Half Day Threshold (min)" type="number" value={shiftForm.halfDayThresholdMins} onChange={(e) => setShiftForm({ ...shiftForm, halfDayThresholdMins: parseInt(e.target.value) || 0 })} hint="Less than this = Half Day (default 240 = 4hrs)" />
                  </div>
                  <div className="mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={shiftForm.autoHalfDay} onChange={(e) => setShiftForm({ ...shiftForm, autoHalfDay: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      <div>
                        <span className="text-sm font-semibold text-slate-700">Auto Half Day</span>
                        <p className="text-[10px] text-slate-400">Automatically mark as Half Day on checkout if work hours are below threshold</p>
                      </div>
                    </label>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Working Days</label>
                    <div className="flex gap-2 flex-wrap">
                      {[{d:0,l:'Sun'},{d:1,l:'Mon'},{d:2,l:'Tue'},{d:3,l:'Wed'},{d:4,l:'Thu'},{d:5,l:'Fri'},{d:6,l:'Sat'}].map(({d,l})=>(
                        <button key={d} type="button" onClick={()=>{
                          const wd = shiftForm.workDays.includes(d) ? shiftForm.workDays.filter(x=>x!==d) : [...shiftForm.workDays,d].sort();
                          setShiftForm({...shiftForm, workDays: wd});
                        }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            shiftForm.workDays.includes(d)
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300'
                          }`}
                        >{l}</button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{shiftForm.workDays.length} working days per week — click to toggle</p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={() => { setShowShiftForm(false); setEditingShift(null); }}>Cancel</Button>
                    <Button onClick={handleSaveShift} loading={saving}>{editingShift ? 'Update' : 'Create'}</Button>
                  </div>
                </Card>
              )}

              {shifts.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {shifts.map(s => (
                    <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow group">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-slate-900">{s.name}</h3>
                          <p className="text-xs text-slate-400 font-mono">{s.code}</p>
                        </div>
                        <Badge variant="info">{s._count?.employees ?? 0} emp</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-emerald-50 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-emerald-600 font-semibold uppercase">Start</p>
                          <p className="text-lg font-bold text-emerald-700">{fmtTime(s.startTime)}</p>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-rose-600 font-semibold uppercase">End</p>
                          <p className="text-lg font-bold text-rose-700">{fmtTime(s.endTime)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                        <span>Break: {s.breakDuration}m</span>
                        <span>Grace: {s.graceTime}m</span>
                        <span>Std Hrs: {Math.floor(s.standardWorkHours ?? 9)}h {Math.round(((s.standardWorkHours ?? 9) - Math.floor(s.standardWorkHours ?? 9)) * 60)}m</span>
                        <span>Re-checkin Gap: {Math.floor((s.minCheckInGap ?? 180) / 60)}h {(s.minCheckInGap ?? 180) % 60}m</span>
                        <span>Min Work: {Math.floor((s.minWorkMinutes ?? 240) / 60)}h {(s.minWorkMinutes ?? 240) % 60}m</span>
                        {(s as any).autoHalfDay && <span className="text-amber-600 font-medium">Half Day &lt; {Math.floor(((s as any).halfDayThresholdMins ?? 240) / 60)}h {((s as any).halfDayThresholdMins ?? 240) % 60}m</span>}
                        <span>Days: {((s.workDays as number[] | undefined) ?? [1,2,3,4,5]).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" onClick={() => {
                            setEditingShift(s);
                            setShiftForm({ name: s.name, code: s.code, startTime: s.startTime, endTime: s.endTime, breakDuration: s.breakDuration, graceTime: s.graceTime, earlyCheckInGrace: s.earlyCheckInGrace ?? 30, checkOutGrace: s.checkOutGrace ?? 15, standardWorkHours: s.standardWorkHours ?? 9, minCheckInGap: s.minCheckInGap ?? 180, minWorkMinutes: s.minWorkMinutes ?? 240, halfDayThresholdMins: (s as any).halfDayThresholdMins ?? 240, autoHalfDay: (s as any).autoHalfDay ?? false, workDays: (s.workDays as number[] | undefined) ?? [1,2,3,4,5] });
                            setShowShiftForm(true);
                          }}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteShift(s.id)}>Delete</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : !loading && (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
                  <span className="text-4xl block mb-2"><svg className="w-10 h-10 text-slate-400 mx-auto" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span>
                  <h3 className="text-lg font-semibold text-slate-700">No Shifts</h3>
                  <p className="text-sm text-slate-500">Create your first work shift</p>
                </div>
              )}
            </div>
          )}

          {/* ════════════ PAYROLL SETTINGS ════════════ */}
          {activeTab === 'payroll' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Payroll Configuration</h2>
                <p className="text-sm text-slate-500">Set lock dates for attendance & payroll per month</p>
              </div>

              {/* Period Selector */}
              <Card className="border border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex flex-wrap items-end gap-4">
                  <Select label="Month" value={payrollMonth.toString()} onChange={(e) => setPayrollMonth(parseInt(e.target.value))} options={MONTHS} className="w-40" />
                  <Input label="Year" type="number" value={payrollYear} onChange={(e) => setPayrollYear(parseInt(e.target.value))} className="w-28" />
                  <Button variant="secondary" onClick={() => { fetchPayrollSettings(); fetchAllPayrollSettings(); }}>Load</Button>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* ── Attendance Lock ── */}
                <Card className={`border-2 ${payrollSettings.isAttendanceLocked ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${payrollSettings.isAttendanceLocked ? 'bg-red-100' : 'bg-emerald-100'}`}>
                        {payrollSettings.isAttendanceLocked
                          ? <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                          : <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 019.9-1" /></svg>}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Attendance Lock</h3>
                        <p className="text-xs text-slate-500">{getMonthName(payrollMonth)} {payrollYear}</p>
                      </div>
                    </div>
                    <Badge variant={payrollSettings.isAttendanceLocked ? 'danger' : 'success'} size="md">
                      {payrollSettings.isAttendanceLocked ? 'Locked' : 'Open'}
                    </Badge>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <p className="text-sm text-slate-700 mb-1 font-medium">What does this do?</p>
                    <p className="text-xs text-slate-500">When locked, no one can edit or add attendance records for {getMonthName(payrollMonth)}. Lock attendance before generating payroll so records don&apos;t change.</p>
                  </div>

                  <div className="space-y-3 mb-4">
                    <Input label="Auto-Lock Day" type="number" value={payrollSettings.attendanceLockDay}
                      onChange={(e) => setPayrollSettings({ ...payrollSettings, attendanceLockDay: parseInt(e.target.value) || 0 })}
                      hint={payrollSettings.attendanceLockDay > 0 
                        ? `Attendance will auto-lock on ${payrollSettings.attendanceLockDay} ${getMonthName(payrollMonth)}` 
                        : 'Set a day (e.g. 28) to auto-lock, or 0 for manual only'}
                      min={0} max={31} />
                  </div>

                  <Button
                    variant={payrollSettings.isAttendanceLocked ? 'success' : 'danger'}
                    onClick={() => handleLockAttendance(!payrollSettings.isAttendanceLocked)}
                    loading={saving}
                    className="w-full"
                  >
                    {payrollSettings.isAttendanceLocked ? 'Unlock Attendance' : 'Lock Attendance Now'}
                  </Button>
                </Card>

                {/* ── Payroll Lock ── */}
                <Card className={`border-2 ${payrollSettings.isPayrollLocked ? 'border-orange-200 bg-orange-50/30' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${payrollSettings.isPayrollLocked ? 'bg-orange-100' : 'bg-teal-100'}`}>
                        {payrollSettings.isPayrollLocked
                          ? <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                          : <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 019.9-1" /></svg>}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Payroll Lock</h3>
                        <p className="text-xs text-slate-500">{getMonthName(payrollMonth)} {payrollYear}</p>
                      </div>
                    </div>
                    <Badge variant={payrollSettings.isPayrollLocked ? 'warning' : 'success'} size="md">
                      {payrollSettings.isPayrollLocked ? 'Locked' : 'Open'}
                    </Badge>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 mb-4">
                    <p className="text-sm text-slate-700 mb-1 font-medium">What does this do?</p>
                    <p className="text-xs text-slate-500">Set a deadline date. After that date, payroll for {getMonthName(payrollMonth)} cannot be generated. This prevents late payroll runs.</p>
                  </div>

                  <div className="space-y-3 mb-4">
                    <Input label="Lock Payroll After Day" type="number" value={payrollSettings.payrollLockDay}
                      onChange={(e) => setPayrollSettings({ ...payrollSettings, payrollLockDay: parseInt(e.target.value) || 0 })}
                      hint={payrollSettings.payrollLockDay > 0 
                        ? `Payroll generation blocked after ${payrollSettings.payrollLockDay} ${getMonthName(payrollMonth)}` 
                        : 'Set a day (e.g. 25) as deadline, or 0 for no deadline'}
                      min={0} max={31} />
                  </div>

                  {payrollSettings.isPayrollLocked ? (
                    <Button variant="success" onClick={() => handleLockPayroll(false)} loading={saving} className="w-full">
                      Unlock Payroll
                    </Button>
                  ) : payrollSettings.payrollLockDay > 0 ? (
                    <div className="text-center py-2 px-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs text-amber-700">Payroll will auto-lock on <strong>{payrollSettings.payrollLockDay} {getMonthName(payrollMonth)}</strong></p>
                    </div>
                  ) : (
                    <div className="text-center py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-500">No deadline set — payroll can be generated anytime</p>
                    </div>
                  )}
                </Card>
              </div>

              {/* Save + Notes */}
              <Card className="border border-slate-200">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <textarea
                      value={payrollSettings.notes || ''}
                      onChange={(e) => setPayrollSettings({ ...payrollSettings, notes: e.target.value })}
                      placeholder={`Notes for ${getMonthName(payrollMonth)} (optional)...`}
                      rows={2}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                    />
                  </div>
                  <Button onClick={handleSavePayrollSettings} loading={saving}>
                    Save Settings for {getMonthName(payrollMonth)}
                  </Button>
                </div>
              </Card>

              {/* History */}
              {allPayrollSettings.length > 0 && (
                <Card className="border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Period</th>
                          <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Attendance</th>
                          <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Payroll</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allPayrollSettings.map((s, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                            onClick={() => { setPayrollMonth(s.month); setPayrollYear(s.year); fetchPayrollSettings(); fetchAllPayrollSettings(); }}>
                            <td className="px-4 py-2.5 font-medium">{getMonthName(s.month)} {s.year}</td>
                            <td className="px-4 py-2.5 text-center">
                              <Badge variant={s.isAttendanceLocked ? 'danger' : 'success'} size="sm">
                                {s.isAttendanceLocked ? 'Locked' : 'Open'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <Badge variant={s.isPayrollLocked ? 'warning' : 'success'} size="sm">
                                {s.isPayrollLocked ? 'Locked' : 'Open'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs truncate max-w-[200px]">{s.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ════════════ LEAVE TYPES ════════════ */}
          {activeTab === 'leave' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Leave Types</h2>
                  <p className="text-sm text-slate-500">{leaveTypes.length} type{leaveTypes.length !== 1 ? 's' : ''} active</p>
                </div>
                {isAdmin && (
                  <Button onClick={() => {
                    setEditingLeave(null);
                    setLeaveForm({ name: '', code: '', annualAllocation: 12, isPaid: true, isProratedOnJoin: true, isCarryForward: false, maxCarryForward: 0 });
                    setShowLeaveForm(true);
                  }}>+ Add Leave Type</Button>
                )}
              </div>

              {showLeaveForm && (
                <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
                  <h3 className="font-bold mb-4">{editingLeave ? 'Edit Leave Type' : 'New Leave Type'}</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Input label="Name *" value={leaveForm.name} onChange={(e) => setLeaveForm({ ...leaveForm, name: e.target.value })} placeholder="Casual Leave" />
                    <Input label="Code *" value={leaveForm.code} onChange={(e) => setLeaveForm({ ...leaveForm, code: e.target.value.toUpperCase() })} placeholder="CL" />
                    <Input label="Annual Days" type="number" value={leaveForm.annualAllocation} onChange={(e) => setLeaveForm({ ...leaveForm, annualAllocation: parseInt(e.target.value) || 0 })} />
                    <div className="space-y-2 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200">
                        <input type="checkbox" checked={leaveForm.isPaid} onChange={(e) => setLeaveForm({ ...leaveForm, isPaid: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded" />
                        <span className="text-sm font-medium text-slate-700">Paid Leave</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200">
                        <input type="checkbox" checked={leaveForm.isProratedOnJoin} onChange={(e) => setLeaveForm({ ...leaveForm, isProratedOnJoin: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded" />
                        <span className="text-sm font-medium text-slate-700">Prorate on Join</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200">
                        <input type="checkbox" checked={leaveForm.isCarryForward} onChange={(e) => setLeaveForm({ ...leaveForm, isCarryForward: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded" />
                        <span className="text-sm font-medium text-slate-700">Carry Forward</span>
                      </label>
                    </div>
                    {leaveForm.isCarryForward && (
                      <Input label="Max Carry Days" type="number" value={leaveForm.maxCarryForward} onChange={(e) => setLeaveForm({ ...leaveForm, maxCarryForward: parseInt(e.target.value) || 0 })} />
                    )}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={() => { setShowLeaveForm(false); setEditingLeave(null); }}>Cancel</Button>
                    <Button onClick={handleSaveLeave} loading={saving}>{editingLeave ? 'Update' : 'Create'}</Button>
                  </div>
                </Card>
              )}

              {leaveTypes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {leaveTypes.map(l => (
                    <div key={l.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow group">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-slate-900">{l.name}</h3>
                          <p className="text-xs text-slate-400 font-mono">{l.code}</p>
                        </div>
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                          <span className="text-xl font-bold text-emerald-600">{l.annualAllocation}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">days per year</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <Badge variant={l.isPaid ? 'success' : 'warning'} size="sm">{l.isPaid ? 'Paid' : 'Unpaid'}</Badge>
                        {l.isProratedOnJoin && <Badge variant="default" size="sm">Prorated</Badge>}
                        {l.isCarryForward && <Badge variant="info" size="sm">Carry {l.maxCarryForward}d</Badge>}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" onClick={() => {
                            setEditingLeave(l);
                            setLeaveForm({ name: l.name, code: l.code, annualAllocation: l.annualAllocation, isPaid: l.isPaid, isProratedOnJoin: l.isProratedOnJoin ?? true, isCarryForward: l.isCarryForward, maxCarryForward: l.maxCarryForward });
                            setShowLeaveForm(true);
                          }}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteLeave(l.id)}>Delete</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : !loading && (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
                  <span className="text-4xl block mb-2"><svg className="w-10 h-10 text-slate-400 mx-auto" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg></span>
                  <h3 className="font-semibold text-slate-700">No Leave Types</h3>
                  <p className="text-sm text-slate-500">Add Casual, Sick, Annual leave types</p>
                </div>
              )}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm text-emerald-800"><strong>Tip - Common types:</strong> Casual (CL), Sick (SL), Annual (AL), Maternity (ML), Paternity (PL), Comp Off (CO).</p>
              </div>

              {/* ── Apply Leave Policy to All Permanent Employees ── */}
              {isAdmin && leaveTypes.length > 0 && (
                <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/60 to-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">Apply Leave Policy</h3>
                      <p className="text-sm text-slate-500">Load these leave types as balance for all permanent employees</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Year</label>
                      <input type="number" value={policyYear} onChange={(e) => setPolicyYear(parseInt(e.target.value))}
                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                  </div>

                  {/* Policy summary table */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Leave Type</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600">Code</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600">Days/Year</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600">Paid</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600">Prorated</th>
                          <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-600">Carry Forward</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveTypes.map(lt => (
                          <tr key={lt.id} className="border-t border-slate-100">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{lt.name}</td>
                            <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-500">{lt.code}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{lt.annualAllocation}</td>
                            <td className="px-4 py-2.5 text-center">{lt.isPaid ? '✓' : '—'}</td>
                            <td className="px-4 py-2.5 text-center">{lt.isProratedOnJoin ? '✓' : '—'}</td>
                            <td className="px-4 py-2.5 text-center">{lt.isCarryForward ? `${lt.maxCarryForward}d` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button variant="success" loading={bulkCalcLoading} onClick={() => {
                      openConfirm({ title: 'Apply Leave Policy', message: `Apply ${policyYear} leave policy to ALL permanent employees?\n\nThis will calculate and assign leave balances based on the above leave types (prorated where applicable).`, variant: 'warning', confirmText: 'Apply Policy', onConfirm: async () => {
                        closeConfirm();
                        setBulkCalcLoading(true);
                        try {
                          const res = await fetch('/api/leave/calculate-balance', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ year: policyYear }),
                          });
                          if (res.ok) {
                            const d = await res.json();
                            toastRef.current.success(d.message || `Leave policy applied for ${policyYear}`);
                          } else {
                            const d = await res.json();
                            toastRef.current.error(d.error || 'Failed');
                          }
                        } catch { toastRef.current.error('Failed'); } finally { setBulkCalcLoading(false); }
                      }});
                    }}>
                      Load {policyYear} Policy for All Employees
                    </Button>
                    <p className="text-xs text-slate-400">Applies to all active permanent employees</p>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ════════════ LATE RULES ════════════ */}
          {activeTab === 'late' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Late Arrival Rules</h2>
                  <p className="text-sm text-slate-500">Deduction rules based on monthly late arrivals</p>
                </div>
                {isAdmin && (
                  <Button onClick={() => {
                    setEditingLate(null);
                    setLateForm({ name: '', minLateCount: 1, maxLateCount: 0, deductionType: 'PER_LATE_DAYS', deductionValue: 3, deductionDays: 0.5, description: '' });
                    setShowLateForm(true);
                  }}>+ Add Rule</Button>
                )}
              </div>

              {showLateForm && (
                <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
                  <h3 className="font-bold mb-4">{editingLate ? 'Edit Rule' : 'New Late Rule'}</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Input label="Rule Name *" value={lateForm.name} onChange={(e) => setLateForm({ ...lateForm, name: e.target.value })} placeholder="3x Warning" />
                    <Select label="Deduction Type" value={lateForm.deductionType} onChange={(e) => setLateForm({ ...lateForm, deductionType: e.target.value })}
                      options={[{ value: 'PER_LATE_DAYS', label: 'Every N Lates = X Days' }, { value: 'FIXED', label: 'Fixed Amount (Rs)' }, { value: 'PERCENTAGE', label: 'Percentage (%)' }, { value: 'DAYS', label: 'Days Salary' }]} />
                    <Input label="Min Late Count" type="number" value={lateForm.minLateCount} onChange={(e) => setLateForm({ ...lateForm, minLateCount: parseInt(e.target.value) || 0 })} min={0} />
                    <Input label="Max Late Count" type="number" value={lateForm.maxLateCount} onChange={(e) => setLateForm({ ...lateForm, maxLateCount: parseInt(e.target.value) || 0 })} min={0} hint="0 = unlimited" />
                    <Input label={lateForm.deductionType === 'PER_LATE_DAYS' ? 'Every N Lates' : 'Deduction Value'} type="number" value={lateForm.deductionValue} onChange={(e) => setLateForm({ ...lateForm, deductionValue: parseFloat(e.target.value) || 0 })} min={0} 
                      hint={lateForm.deductionType === 'PER_LATE_DAYS' ? `Every ${lateForm.deductionValue || 'N'} lates triggers deduction` : undefined} />
                    {lateForm.deductionType === 'PER_LATE_DAYS' && (
                      <Input label="Days to Deduct" type="number" value={lateForm.deductionDays} onChange={(e) => setLateForm({ ...lateForm, deductionDays: parseFloat(e.target.value) || 0 })} min={0} step={0.5}
                        hint={`${lateForm.deductionDays === 0.5 ? 'Half day' : lateForm.deductionDays === 1 ? 'Full day' : lateForm.deductionDays + ' days'} salary deducted per trigger`} />
                    )}
                    <Input label="Description" value={lateForm.description} onChange={(e) => setLateForm({ ...lateForm, description: e.target.value })} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={() => { setShowLateForm(false); setEditingLate(null); }}>Cancel</Button>
                    <Button onClick={handleSaveLateRule} loading={saving}>{editingLate ? 'Update' : 'Create'}</Button>
                  </div>
                </Card>
              )}

              <Card padding={false} className="border border-slate-200 rounded-2xl overflow-hidden">
                <Table
                  columns={[
                    {
                      key: 'name', header: 'Rule',
                      render: (r: LateRule) => (
                        <div>
                          <p className="font-semibold">{r.name}</p>
                          {r.description && <p className="text-xs text-slate-500">{r.description}</p>}
                        </div>
                      ),
                    },
                    {
                      key: 'range', header: 'Late Range',
                      render: (r: LateRule) => (
                        <div className="flex items-center gap-1">
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold">{r.minLateCount}</span>
                          <span className="text-slate-400">→</span>
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">{r.maxLateCount ?? '∞'}</span>
                        </div>
                      ),
                    },
                    {
                      key: 'ded', header: 'Deduction',
                      render: (r: LateRule) => {
                        if (r.deductionType === 'FIXED') return <span className="text-red-600 font-bold">{formatPKR(r.deductionValue)}</span>;
                        if (r.deductionType === 'PERCENTAGE') return <span className="text-red-600 font-bold">{r.deductionValue}%</span>;
                        if (r.deductionType === 'PER_LATE_DAYS') return <span className="text-red-600 font-bold">Every {r.deductionValue} lates = {r.deductionDays ?? 1} day</span>;
                        return <span className="text-red-600 font-bold">{r.deductionValue} day(s)</span>;
                      },
                    },
                    ...(isAdmin ? [{
                      key: 'actions', header: '',
                      render: (r: LateRule) => (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => {
                            setEditingLate(r);
                            setLateForm({ name: r.name, minLateCount: r.minLateCount, maxLateCount: r.maxLateCount ?? 0, deductionType: r.deductionType, deductionValue: r.deductionValue, deductionDays: r.deductionDays ?? 1, description: r.description || '' });
                            setShowLateForm(true);
                          }}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteLateRule(r.id)}>Delete</Button>
                        </div>
                      ),
                    }] : []),
                  ]}
                  data={lateRules}
                  loading={loading}
                  emptyMessage="No late rules configured"
                />
              </Card>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800"><strong>Tip:</strong> Deductions are auto-applied during payroll generation based on monthly late count.</p>
              </div>
            </div>
          )}

          {/* ════════════ TAX SLABS ════════════ */}
          {activeTab === 'tax' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Income Tax Slabs</h2>
                  <p className="text-xs text-slate-500">Pakistan FBR • {taxYear}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Input type="number" value={taxYear} onChange={(e) => setTaxYear(parseInt(e.target.value))} className="w-24" />
                  {isAdmin && (
                    <Button onClick={() => { setEditingTax(null); setTaxForm({ name: '', minIncome: 0, maxIncome: 0, fixedTax: 0, taxRate: 0, year: taxYear }); setShowTaxForm(true); }}>
                      + Add Slab
                    </Button>
                  )}
                </div>
              </div>

              {showTaxForm && (
                <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
                  <h3 className="font-bold mb-4">{editingTax ? 'Edit Slab' : 'New Tax Slab'}</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Input label="Name *" value={taxForm.name} onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })} placeholder="11% Slab" />
                    <Input label="Year" type="number" value={taxForm.year} onChange={(e) => setTaxForm({ ...taxForm, year: parseInt(e.target.value) || taxYear })} />
                    <Input label="Min Income (Rs)" type="number" value={taxForm.minIncome} onChange={(e) => setTaxForm({ ...taxForm, minIncome: parseFloat(e.target.value) || 0 })} />
                    <Input label="Max Income (Rs)" type="number" value={taxForm.maxIncome} onChange={(e) => setTaxForm({ ...taxForm, maxIncome: parseFloat(e.target.value) || 0 })} hint="0 = no limit" />
                    <Input label="Fixed Tax (Rs)" type="number" value={taxForm.fixedTax} onChange={(e) => setTaxForm({ ...taxForm, fixedTax: parseFloat(e.target.value) || 0 })} />
                    <Input label="Tax Rate (%)" type="number" value={taxForm.taxRate} onChange={(e) => setTaxForm({ ...taxForm, taxRate: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={() => { setShowTaxForm(false); setEditingTax(null); }}>Cancel</Button>
                    <Button onClick={handleSaveTaxSlab} loading={saving}>{editingTax ? 'Update' : 'Create'}</Button>
                  </div>
                </Card>
              )}

              <Card padding={false} className="border border-slate-200 rounded-2xl overflow-hidden">
                <Table
                  columns={[
                    { key: 'name', header: 'Slab', render: (t: TaxSlab) => <p className="font-semibold">{t.name}</p> },
                    { key: 'range', header: 'Income Range', render: (t: TaxSlab) => <span className="text-sm">{formatPKR(t.minIncome)} — {t.maxIncome ? formatPKR(t.maxIncome) : '& above'}</span> },
                    { key: 'fixed', header: 'Fixed Tax', render: (t: TaxSlab) => <span className="font-medium">{formatPKR(t.fixedTax)}</span> },
                    { key: 'rate', header: 'Rate', render: (t: TaxSlab) => <Badge variant={t.taxRate > 0 ? 'danger' : 'success'}>{t.taxRate}%</Badge> },
                    ...(isAdmin ? [{
                      key: 'actions', header: '',
                      render: (t: TaxSlab) => (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => {
                            setEditingTax(t);
                            setTaxForm({ name: t.name, minIncome: t.minIncome, maxIncome: t.maxIncome || 0, fixedTax: t.fixedTax, taxRate: t.taxRate, year: t.year });
                            setShowTaxForm(true);
                          }}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteTaxSlab(t.id)}>Delete</Button>
                        </div>
                      ),
                    }] : []),
                  ]}
                  data={taxSlabs}
                  loading={loading}
                  emptyMessage="No tax slabs"
                />
              </Card>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800">Tax = Fixed + (Income − Min) × Rate%. Applied monthly during payroll generation.</p>
              </div>
            </div>
          )}

          {/* ════════════ DOCUMENT FIELDS ════════════ */}
          {activeTab === 'docfields' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div><h2 className="text-xl font-bold text-slate-900">Document Fields</h2><p className="text-sm text-slate-500">Define document types that employees can upload. Control who can edit each field.</p></div>
                {isAdmin && (
                  <Button onClick={() => { setEditingDocField(null); setDocFieldForm({ name: '', description: '', isRequired: false, employeeCanEdit: false }); setShowDocFieldForm(true); }}>
                    + Add Field
                  </Button>
                )}
              </div>

              {showDocFieldForm && (
                <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
                  <h3 className="font-bold text-slate-900 mb-4">{editingDocField ? 'Edit Document Field' : 'New Document Field'}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <Input label="Field Name *" value={docFieldForm.name} onChange={(e) => setDocFieldForm({ ...docFieldForm, name: e.target.value })} placeholder="e.g. CNIC, Passport, Degree" />
                    <Input label="Description" value={docFieldForm.description} onChange={(e) => setDocFieldForm({ ...docFieldForm, description: e.target.value })} placeholder="Optional description" />
                  </div>
                  <div className="flex flex-wrap gap-6 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={docFieldForm.isRequired} onChange={(e) => setDocFieldForm({ ...docFieldForm, isRequired: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-sm text-slate-700 font-medium">Required document</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={docFieldForm.employeeCanEdit} onChange={(e) => setDocFieldForm({ ...docFieldForm, employeeCanEdit: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                      <span className="text-sm text-slate-700 font-medium">Employee can upload/edit</span>
                    </label>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={() => { setShowDocFieldForm(false); setEditingDocField(null); }}>Cancel</Button>
                    <Button onClick={handleSaveDocField} loading={saving}>{editingDocField ? 'Update' : 'Create'}</Button>
                  </div>
                </Card>
              )}

              {docFields.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {docFields.map(f => (
                    <div key={f.id} className={`bg-white border rounded-2xl p-5 hover:shadow-md transition-shadow group ${!f.isActive ? 'opacity-50 border-slate-200' : 'border-slate-200'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">{f.name}</h3>
                            {f.description && <p className="text-xs text-slate-400">{f.description}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {f.isRequired && <Badge variant="danger" size="sm">Required</Badge>}
                          {!f.isActive && <Badge variant="default" size="sm">Inactive</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                        <span className="flex items-center gap-1">
                          {f.employeeCanEdit ? (
                            <><svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Employee can edit</>
                          ) : (
                            <><svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg> Admin only</>
                          )}
                        </span>
                        <span>{f._count?.documents ?? 0} document{(f._count?.documents ?? 0) !== 1 ? 's' : ''}</span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" onClick={() => {
                            setEditingDocField(f);
                            setDocFieldForm({ name: f.name, description: f.description || '', isRequired: f.isRequired, employeeCanEdit: f.employeeCanEdit });
                            setShowDocFieldForm(true);
                          }}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleToggleDocField(f)}>
                            {f.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDeleteDocField(f.id)}>Delete</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : !loading && (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
                  <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  <h3 className="text-lg font-semibold text-slate-700">No Document Fields</h3>
                  <p className="text-sm text-slate-500">Create document types like CNIC, Passport, etc.</p>
                </div>
              )}
            </div>
          )}

          {/* ════════════ GENERAL ════════════ */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-slate-900">General Settings</h2>
              <Card className="border border-slate-200">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-slate-900 mb-3">Organization</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Company Name" value={generalSettings.companyName} onChange={(e) => setGeneralSettings({ ...generalSettings, companyName: e.target.value })} placeholder="Your Company" />
                      <Select label="Currency" value={generalSettings.currency} onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                        options={[{ value: 'PKR', label: 'PKR - Pakistani Rupee' }, { value: 'USD', label: 'USD - US Dollar' }, { value: 'AED', label: 'AED - Dirham' }]} />
                    </div>
                  </div>
                  <div className="border-t pt-6">
                    <h3 className="font-bold text-slate-900 mb-3">Regional</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <Select label="Timezone" value={generalSettings.timezone} onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                        options={[{ value: 'Asia/Karachi', label: 'Asia/Karachi (PKT)' }, { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' }, { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' }, { value: 'Europe/London', label: 'Europe/London (GMT)' }]} />
                      <Select label="Weekly Off" value={generalSettings.weeklyOff} onChange={(e) => setGeneralSettings({ ...generalSettings, weeklyOff: e.target.value })}
                        options={[{ value: 'SUNDAY', label: 'Sunday' }, { value: 'FRIDAY', label: 'Friday' }, { value: 'SATURDAY', label: 'Saturday' }, { value: 'FRIDAY_SATURDAY', label: 'Fri & Sat' }, { value: 'SATURDAY_SUNDAY', label: 'Sat & Sun' }]} />
                    </div>
                  </div>
                  <div className="border-t pt-6">
                    <h3 className="font-bold text-slate-900 mb-3">Financial Year</h3>
                    <Select label="Starts In" value={generalSettings.financialYearStart} onChange={(e) => setGeneralSettings({ ...generalSettings, financialYearStart: e.target.value })}
                      options={[{ value: '1', label: 'January' }, { value: '4', label: 'April' }, { value: '7', label: 'July (Pakistan)' }, { value: '10', label: 'October' }]} className="max-w-xs" />
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-sm text-emerald-800"><strong>Pakistan Defaults:</strong> PKR currency, Asia/Karachi timezone, Financial year July–June, Sunday off.</p>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => toastRef.current.success('Settings saved')}>Save Settings</Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />
    </div>
  );
}
