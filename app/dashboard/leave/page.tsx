'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  annualAllocation: number;
  isPaid: boolean;
  isActive: boolean;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  department?: { name: string };
}

interface LeaveBalance {
  id: string;
  leaveType: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  annualAllocation: number;
  isPaid: boolean;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  carryForward: number;
  isAutoCalculated: boolean;
}

interface LeaveRequest {
  id: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    department?: { name: string };
  };
  leaveType: { id: string; name: string; code: string };
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  rejectionReason?: string;
  createdAt: string;
  approvedBy?: { firstName: string; lastName: string };
}

type Tab = 'requests' | 'balance';

const TAB_ITEMS: { id: Tab; label: string }[] = [
  { id: 'requests', label: 'Leave Requests' },
  { id: 'balance', label: 'Leave Balance' },
];

const STATUS_COLORS: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
};

export default function LeavePage() {
  const { token, user, hasPermission } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const canManageLeave = hasPermission('leave', 'manage');
  const isAdmin = canManageLeave;

  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [loading, setLoading] = useState(false);

  // Requests
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [reqFilter, setReqFilter] = useState('ALL');

  // Balance
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [balYear, setBalYear] = useState(new Date().getFullYear());
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [balLoading, setBalLoading] = useState(false);

  // Inline adjust state per balance row
  const [adjustValues, setAdjustValues] = useState<Record<string, number>>({});
  const [adjustSaving, setAdjustSaving] = useState<string | null>(null);

  // Edit balance modal
  const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null);
  const [editTotalDays, setEditTotalDays] = useState(0);
  const [editSaving, setEditSaving] = useState(false);

  // Request form (employee)
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqForm, setReqForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [reqSaving, setReqSaving] = useState(false);

  // My balances (employee view)
  const [myBalances, setMyBalances] = useState<LeaveBalance[]>([]);

  // Detail modal
  const [detailReq, setDetailReq] = useState<LeaveRequest | null>(null);

  // Reject reason modal
  const [rejectModal, setRejectModal] = useState<{ reqId: string; reason: string } | null>(null);

  // Bulk calculate
  const [calcLoading, setCalcLoading] = useState(false);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; showInput?: boolean; inputPlaceholder?: string; inputRequired?: boolean; inputLabel?: string; onConfirm: (input?: string) => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  /* ─── Fetchers ─── */
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/leave/requests', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setRequests(d.data || []); }
    } catch { /* */ } finally { setLoading(false); }
  }, [token]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setEmployees(d.data || []); }
    } catch { /* */ }
  }, [token]);

  const fetchLeaveTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/leave/types', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setLeaveTypes(d.data || []); }
    } catch { /* */ }
  }, [token]);

  const fetchBalances = useCallback(async (empId: string, year: number) => {
    if (!empId) return;
    setBalLoading(true);
    try {
      const res = await fetch(`/api/leave/balance?employeeId=${empId}&year=${year}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setBalances(d.data || []);
        setAdjustValues({});
      }
    } catch { /* */ } finally { setBalLoading(false); }
  }, [token]);

  const fetchMyBalances = useCallback(async () => {
    if (!user?.employee?.id) return;
    try {
      const res = await fetch(`/api/leave/balance?employeeId=${user.employee.id}&year=${new Date().getFullYear()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setMyBalances(d.data || []); }
    } catch { /* */ }
  }, [token, user?.employee?.id]);

  useEffect(() => {
    if (!token) return;
    fetchRequests();
    fetchLeaveTypes();
    if (isAdmin) fetchEmployees();
    else fetchMyBalances();
  }, [token, fetchRequests, fetchLeaveTypes, fetchEmployees, fetchMyBalances, isAdmin]);

  // Auto-load balances when employee or year changes
  useEffect(() => {
    if (selectedEmployee && balYear) fetchBalances(selectedEmployee, balYear);
  }, [selectedEmployee, balYear, fetchBalances]);

  /* ─── Actions ─── */
  const handleApproveReject = async (reqId: string, action: 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
    if (action === 'APPROVED') {
      openConfirm({ title: 'Approve Leave', message: 'Are you sure you want to approve this leave request?', variant: 'success', confirmText: 'Approve', showInput: true, inputPlaceholder: 'Approval remarks (optional)...', inputRequired: false, inputLabel: 'Remarks', onConfirm: async (remarks?: string) => {
        closeConfirm();
        try {
          const body: Record<string, string> = { status: action };
          if (remarks) body.rejectionReason = remarks;
          const res = await fetch(`/api/leave/requests/${reqId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            toastRef.current.success(`Leave approved`);
            fetchRequests();
            setDetailReq(null);
            setRejectModal(null);
          } else {
            const d = await res.json();
            toastRef.current.error(d.error || 'Failed');
          }
        } catch { toastRef.current.error('Failed'); }
      }});
      return;
    }
    try {
      const body: Record<string, string> = { status: action };
      if (action === 'REJECTED' && rejectionReason) body.rejectionReason = rejectionReason;
      const res = await fetch(`/api/leave/requests/${reqId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toastRef.current.success(`Leave ${action.toLowerCase()}`);
        fetchRequests();
        setDetailReq(null);
        setRejectModal(null);
      } else {
        const d = await res.json();
        toastRef.current.error(d.error || 'Failed');
      }
    } catch { toastRef.current.error('Failed'); }
  };

  const handleSubmitRequest = async () => {
    if (!reqForm.leaveTypeId || !reqForm.startDate || !reqForm.endDate) {
      toastRef.current.error('Fill all required fields');
      return;
    }
    setReqSaving(true);
    try {
      const res = await fetch('/api/leave/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(reqForm),
      });
      if (res.ok) {
        toastRef.current.success('Leave request submitted');
        setShowRequestForm(false);
        setReqForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
        fetchRequests();
        if (!isAdmin) fetchMyBalances();
      } else {
        const d = await res.json();
        toastRef.current.error(d.error || 'Failed');
      }
    } catch { toastRef.current.error('Failed'); } finally { setReqSaving(false); }
  };

  // Inline adjust: add or subtract days from a specific balance
  const handleInlineAdjust = async (balance: LeaveBalance, days: number) => {
    if (days === 0) return;
    openConfirm({ title: 'Adjust Leave Balance', message: `Adjust ${balance.leaveType} by ${days > 0 ? '+' : ''}${days} day(s)?`, variant: 'warning', confirmText: 'Adjust', onConfirm: async () => {
      closeConfirm();
      setAdjustSaving(balance.id);
      try {
        const res = await fetch('/api/leave/balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            employeeId: selectedEmployee,
            leaveTypeId: balance.leaveTypeId,
            year: balYear,
            adjustDays: days,
          }),
        });
        if (res.ok) {
          const d = await res.json();
          toastRef.current.success(d.message || 'Balance adjusted');
          fetchBalances(selectedEmployee, balYear);
        } else {
          const d = await res.json();
          toastRef.current.error(d.error || 'Failed');
        }
      } catch { toastRef.current.error('Failed'); } finally { setAdjustSaving(null); }
    }});
  };

  // Set exact total for a balance
  const handleSetTotal = async () => {
    if (!editingBalance) return;
    openConfirm({ title: 'Set Leave Balance', message: `Set ${editingBalance.leaveType} total to ${editTotalDays} days?`, variant: 'warning', confirmText: 'Set Total', onConfirm: async () => {
      closeConfirm();
      setEditSaving(true);
      try {
        const res = await fetch('/api/leave/balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            employeeId: selectedEmployee,
            leaveTypeId: editingBalance.leaveTypeId,
            year: balYear,
            totalDays: editTotalDays,
          }),
        });
        if (res.ok) {
          toastRef.current.success('Balance updated');
          setEditingBalance(null);
          fetchBalances(selectedEmployee, balYear);
        } else {
          const d = await res.json();
          toastRef.current.error(d.error || 'Failed');
        }
      } catch { toastRef.current.error('Failed'); } finally { setEditSaving(false); }
    }});
  };

  const handleCalculateBalance = async (empId: string) => {
    setCalcLoading(true);
    try {
      const res = await fetch('/api/leave/calculate-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employeeId: empId, year: balYear }),
      });
      if (res.ok) {
        toastRef.current.success('Balance auto-calculated');
        fetchBalances(empId, balYear);
      } else {
        const d = await res.json();
        toastRef.current.error(d.error || 'Failed');
      }
    } catch { toastRef.current.error('Failed'); } finally { setCalcLoading(false); }
  };

  /* ─── Derived ─── */
  const filteredRequests = reqFilter === 'ALL' ? requests : requests.filter(r => r.status === reqFilter);
  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

  const getEmployeeName = (id: string) => {
    const e = employees.find(x => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : '';
  };

  /* ─── Render ─── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Leave Management</h1>
              <p className="text-teal-100 text-sm mt-0.5">
                {isAdmin ? `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}` : 'Your leaves & balances'}
              </p>
            </div>
          </div>
          {user?.employee && user?.role !== 'ADMIN' && (
            <Button variant="ghost" onClick={() => { const today = new Date().toISOString().split('T')[0]; setReqForm({ leaveTypeId: '', startDate: today, endDate: today, reason: '' }); setShowRequestForm(true); }} className="!bg-white !text-teal-700 hover:!bg-teal-50 border-0 shadow-md font-semibold">
              + New Request
            </Button>
          )}
        </div>
      </div>

      {/* My Balances (Employee view) */}
      {!isAdmin && myBalances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {myBalances.map(b => (
            <div key={b.id} className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-800 text-sm">{b.leaveType}</h3>
                <Badge variant="info" size="sm">{b.leaveTypeCode}</Badge>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-emerald-600">{b.remainingDays}</span>
                <span className="text-sm text-slate-400 mb-1">/ {b.totalDays}</span>
              </div>
              <div className="mt-2 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${b.totalDays > 0 ? ((b.totalDays - b.remainingDays) / b.totalDays) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Used: {b.usedDays}</span>
                <span>Pending: {b.pendingDays}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Tabs */}
      {isAdmin && (
        <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
          {TAB_ITEMS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === t.id
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t.label}
              {t.id === 'requests' && pendingCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ═══ LEAVE REQUESTS ═══ */}
      {(activeTab === 'requests' || !isAdmin) && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map(f => (
              <button key={f} onClick={() => setReqFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  reqFilter === f
                    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}>
                {f === 'ALL' ? `All (${requests.length})` : `${f} (${requests.filter(r => r.status === f).length})`}
              </button>
            ))}
          </div>

          {/* Requests list */}
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="skeleton h-4 w-32 rounded-lg" />
                        <div className="skeleton h-4 w-16 rounded-lg" />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="skeleton h-3 w-20 rounded-lg" />
                        <div className="skeleton h-3 w-36 rounded-lg" />
                        <div className="skeleton h-3 w-14 rounded-lg" />
                      </div>
                    </div>
                    <div className="skeleton h-6 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="space-y-3">
              {filteredRequests.map(req => (
                <div key={req.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setDetailReq(req)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 text-sm">
                          {req.employee.firstName} {req.employee.lastName}
                        </h3>
                        <Badge variant="info" size="sm">{req.employee.employeeCode}</Badge>
                        {req.employee.department && (
                          <span className="text-[10px] text-slate-400">{req.employee.department.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="font-medium text-emerald-600">{req.leaveType.name}</span>
                        <span>{fmtDate(req.startDate)} → {fmtDate(req.endDate)}</span>
                        <span className="font-bold">{req.totalDays} day{req.totalDays !== 1 ? 's' : ''}</span>
                      </div>
                      {req.reason && <p className="text-xs text-slate-400 mt-1 truncate">{req.reason}</p>}
                      {/* Admin remarks / rejection reason */}
                      {req.status === 'APPROVED' && req.approvedBy && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            {req.approvedBy.firstName} {req.approvedBy.lastName}
                          </span>
                          {req.rejectionReason && (
                            <span className="text-[10px] text-emerald-600 italic truncate max-w-[200px]">&ldquo;{req.rejectionReason}&rdquo;</span>
                          )}
                        </div>
                      )}
                      {req.status === 'REJECTED' && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {req.approvedBy && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              {req.approvedBy.firstName} {req.approvedBy.lastName}
                            </span>
                          )}
                          {req.rejectionReason && (
                            <span className="text-[10px] text-red-600 italic truncate max-w-[200px]">&ldquo;{req.rejectionReason}&rdquo;</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={STATUS_COLORS[req.status]} size="md">{req.status}</Badge>
                      {isAdmin && req.status === 'PENDING' && req.employee.id !== user?.employee?.id && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleApproveReject(req.id, 'APPROVED')}
                            className="w-8 h-8 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg flex items-center justify-center text-sm transition-colors">✓</button>
                          <button onClick={() => setRejectModal({ reqId: req.id, reason: '' })}
                            className="w-8 h-8 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg flex items-center justify-center text-sm transition-colors">✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
              <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.251 2.251 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
              <h3 className="font-semibold text-slate-700">No Requests</h3>
              <p className="text-sm text-slate-500">{reqFilter !== 'ALL' ? 'Try a different filter' : 'No leave requests found'}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ LEAVE BALANCES (Admin) ═══ */}
      {isAdmin && activeTab === 'balance' && (
        <div className="space-y-5">
          {/* Employee selector - balances auto-load on selection */}
          <Card className="border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-4">Employee Leave Balance</h3>
            <div className="flex flex-wrap items-end gap-4">
              <Select label="Employee" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}
                options={[{ value: '', label: 'Select employee...' }, ...employees.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName} (${e.employeeCode})` }))]}
                className="w-72" />
              <Input label="Year" type="number" value={balYear} onChange={(e) => setBalYear(parseInt(e.target.value))} className="w-24" />
            </div>
          </Card>

          {/* Balance cards with inline adjust */}
          {selectedEmployee && (
            balLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3].map(i => (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="skeleton h-5 w-24 rounded-lg" />
                      <div className="skeleton h-6 w-16 rounded-full" />
                    </div>
                    <div className="skeleton h-2 w-full rounded-full mb-3" />
                    <div className="flex items-center justify-between">
                      <div className="skeleton h-3 w-16 rounded-lg" />
                      <div className="skeleton h-3 w-16 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : balances.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">
                    {getEmployeeName(selectedEmployee)} — {balYear}
                  </h3>
                  <p className="text-xs text-slate-400">Balances auto-loaded. Use +/- to adjust.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {balances.map(b => {
                    const usedPct = b.totalDays > 0 ? ((b.usedDays + b.pendingDays) / b.totalDays) * 100 : 0;
                    const adj = adjustValues[b.id] || 0;
                    return (
                      <div key={b.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-bold text-slate-900">{b.leaveType}</h4>
                            <p className="text-xs text-slate-400 font-mono">{b.leaveTypeCode}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {b.isAutoCalculated ? (
                              <Badge variant="info" size="sm">Auto</Badge>
                            ) : (
                              <Badge variant="warning" size="sm">Manual</Badge>
                            )}
                            {isAdmin && (
                              <button onClick={() => { setEditingBalance(b); setEditTotalDays(b.totalDays); }}
                                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg flex items-center justify-center transition-colors" title="Edit total">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-3xl font-bold text-emerald-600">{b.remainingDays}</span>
                          <span className="text-sm text-slate-400">remaining</span>
                        </div>
                        <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden mb-3">
                          <div className={`h-full rounded-full transition-all ${usedPct > 80 ? 'bg-red-500' : usedPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(usedPct, 100)}%` }} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                          <div><p className="text-xs text-slate-500">Total</p><p className="font-bold text-sm">{b.totalDays}</p></div>
                          <div><p className="text-xs text-slate-500">Used</p><p className="font-bold text-sm text-red-600">{b.usedDays}</p></div>
                          <div><p className="text-xs text-slate-500">Pending</p><p className="font-bold text-sm text-amber-600">{b.pendingDays}</p></div>
                        </div>
                        {b.carryForward > 0 && (
                          <div className="mb-3 pt-2 border-t border-slate-100 text-xs text-blue-600">Carry Forward: {b.carryForward} days</div>
                        )}
                        {/* Inline adjust controls */}
                        <div className="border-t border-slate-100 pt-3">
                          <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">Quick Adjust</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setAdjustValues(v => ({ ...v, [b.id]: (v[b.id] || 0) - 1 }))}
                              className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center text-lg font-bold transition-colors">−</button>
                            <input type="number" value={adj}
                              onChange={(e) => setAdjustValues(v => ({ ...v, [b.id]: parseFloat(e.target.value) || 0 }))}
                              className="w-16 text-center text-sm font-bold border border-slate-200 rounded-lg py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                            <button onClick={() => setAdjustValues(v => ({ ...v, [b.id]: (v[b.id] || 0) + 1 }))}
                              className="w-8 h-8 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-lg font-bold transition-colors">+</button>
                            <button onClick={() => handleInlineAdjust(b, adj)} disabled={adj === 0 || adjustSaving === b.id}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                adj === 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' :
                                adj > 0 ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-red-500 text-white hover:bg-red-600'
                              }`}>
                              {adjustSaving === b.id ? '...' : adj > 0 ? `+${adj}` : adj === 0 ? 'Adjust' : `${adj}`}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
                <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                <h3 className="font-semibold text-slate-700">No Balance Records</h3>
                <p className="text-sm text-slate-500 mb-4">Balances will be auto-initialized when leave types are configured in Settings</p>
              </div>
            )
          )}

          {!selectedEmployee && (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
              <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              <h3 className="font-semibold text-slate-700">Select an Employee</h3>
              <p className="text-sm text-slate-500">Choose an employee above — balances will auto-load (and auto-initialize if needed)</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ New Request Modal ═══ */}
      <Modal isOpen={showRequestForm} onClose={() => setShowRequestForm(false)} title="New Leave Request" size="md">
        <div className="p-5 space-y-4">
          <Select label="Leave Type *" value={reqForm.leaveTypeId} onChange={(e) => setReqForm({ ...reqForm, leaveTypeId: e.target.value })}
            options={[{ value: '', label: 'Select...' }, ...leaveTypes.map(t => ({ value: t.id, label: `${t.name} (${t.code})` }))]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date *" type="date" value={reqForm.startDate} min="2024-01-01" max="2030-12-31" onChange={(e) => setReqForm({ ...reqForm, startDate: e.target.value })} />
            <Input label="End Date *" type="date" value={reqForm.endDate} min={reqForm.startDate || '2024-01-01'} max="2030-12-31" onChange={(e) => setReqForm({ ...reqForm, endDate: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Reason</label>
            <textarea value={reqForm.reason} onChange={(e) => setReqForm({ ...reqForm, reason: e.target.value })}
              rows={3} placeholder="Reason for leave..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowRequestForm(false)}>Cancel</Button>
            <Button onClick={handleSubmitRequest} loading={reqSaving}>Submit Request</Button>
          </div>
        </div>
      </Modal>

      {/* ═══ Request Detail Modal ═══ */}
      <Modal isOpen={!!detailReq} onClose={() => setDetailReq(null)} title="Leave Request Detail" size="md">
        {detailReq && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Employee</p>
                <p className="font-bold text-slate-900">{detailReq.employee.firstName} {detailReq.employee.lastName}</p>
                <p className="text-xs text-slate-400">{detailReq.employee.employeeCode}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Leave Type</p>
                <p className="font-bold text-slate-900">{detailReq.leaveType.name}</p>
                <Badge variant="info" size="sm">{detailReq.leaveType.code}</Badge>
              </div>
              <div>
                <p className="text-xs text-slate-500">Duration</p>
                <p className="font-bold text-slate-900">{fmtDate(detailReq.startDate)} → {fmtDate(detailReq.endDate)}</p>
                <p className="text-xs text-slate-400">{detailReq.totalDays} day{detailReq.totalDays !== 1 ? 's' : ''}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <Badge variant={STATUS_COLORS[detailReq.status]} size="md">{detailReq.status}</Badge>
              </div>
            </div>
            {detailReq.reason && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Reason</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{detailReq.reason}</p>
              </div>
            )}
            <div className="text-xs text-slate-400">
              Requested: {fmtDate(detailReq.createdAt)}
              {detailReq.approvedBy && ` • Processed by: ${detailReq.approvedBy.firstName} ${detailReq.approvedBy.lastName}`}
            </div>
            {detailReq.status === 'REJECTED' && detailReq.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-medium text-red-800">Rejection Reason:</p>
                <p className="text-sm text-red-700 mt-1">{detailReq.rejectionReason}</p>
              </div>
            )}
            {detailReq.status === 'APPROVED' && detailReq.approvedBy && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-sm text-emerald-800"><strong>Approved by:</strong> {detailReq.approvedBy.firstName} {detailReq.approvedBy.lastName}</p>
                {detailReq.rejectionReason && (
                  <p className="text-sm text-emerald-800 mt-1"><strong>Remarks:</strong> {detailReq.rejectionReason}</p>
                )}
              </div>
            )}
            {isAdmin && detailReq.status === 'PENDING' && detailReq.employee.id !== user?.employee?.id && (
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <Button variant="success" className="flex-1" onClick={() => handleApproveReject(detailReq.id, 'APPROVED')}>Approve</Button>
                <Button variant="danger" className="flex-1" onClick={() => setRejectModal({ reqId: detailReq.id, reason: '' })}>Reject</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ═══ Edit Balance Modal ═══ */}
      <Modal isOpen={!!editingBalance} onClose={() => setEditingBalance(null)} title="Edit Leave Balance" size="sm">
        {editingBalance && (
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900">{editingBalance.leaveType}</h4>
                <Badge variant="info" size="sm">{editingBalance.leaveTypeCode}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div><p className="text-xs text-slate-500">Current Total</p><p className="font-bold">{editingBalance.totalDays}</p></div>
                <div><p className="text-xs text-slate-500">Used</p><p className="font-bold text-red-600">{editingBalance.usedDays}</p></div>
                <div><p className="text-xs text-slate-500">Remaining</p><p className="font-bold text-emerald-600">{editingBalance.remainingDays}</p></div>
              </div>
            </div>
            <Input label="New Total Days" type="number" value={editTotalDays}
              onChange={(e) => setEditTotalDays(parseFloat(e.target.value) || 0)}
              hint={`Change from ${editingBalance.totalDays} → ${editTotalDays} (${editTotalDays >= editingBalance.totalDays ? '+' : ''}${editTotalDays - editingBalance.totalDays} days)`} />
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" onClick={() => setEditingBalance(null)}>Cancel</Button>
              <Button onClick={handleSetTotal} loading={editSaving}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══ Reject Reason Modal ═══ */}
      <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Leave Request" size="sm">
        {rejectModal && (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Rejection Reason *</label>
              <textarea value={rejectModal.reason} onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                rows={3} placeholder="Enter reason for rejection..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setRejectModal(null)}>Cancel</Button>
              <Button variant="danger" disabled={!rejectModal.reason.trim()} onClick={() => handleApproveReject(rejectModal.reqId, 'REJECTED', rejectModal.reason)}>
                Confirm Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={(input) => confirmDialog.onConfirm(input)} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} showInput={confirmDialog.showInput} inputPlaceholder={confirmDialog.inputPlaceholder} inputRequired={confirmDialog.inputRequired} inputLabel={confirmDialog.inputLabel} />
    </div>
  );
}
