'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  designation?: string;
  employmentType?: string;
  employmentStatus?: string;
  department?: { id: string; name: string };
  salary?: { basicSalary: number; grossSalary: number; netSalary: number };
}

interface Department {
  id: string;
  name: string;
}

interface HistoryRecord {
  id: string;
  employeeId: string;
  type: string;
  effectiveDate: string;
  oldDesignation?: string;
  newDesignation?: string;
  oldDepartmentId?: string;
  newDepartmentId?: string;
  oldBasicSalary?: number;
  newBasicSalary?: number;
  oldGrossSalary?: number;
  newGrossSalary?: number;
  reason?: string;
  remarks?: string;
  letterPath?: string;
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    designation?: string;
    profileImage?: string;
    department?: { id: string; name: string };
    salary?: { basicSalary: number; grossSalary: number; netSalary: number };
  };
  oldDepartment?: { id: string; name: string };
  newDepartment?: { id: string; name: string };
}

const historyTypes = [
  { value: 'PROMOTION', label: 'Promotion', icon: '🎉', color: 'success' },
  { value: 'INCREMENT', label: 'Salary Increment', icon: '💰', color: 'info' },
  { value: 'TRANSFER', label: 'Department Transfer', icon: '🔄', color: 'warning' },
  { value: 'PROMOTION_WITH_INCREMENT', label: 'Promotion + Increment', icon: '🚀', color: 'primary' },
  { value: 'DEMOTION', label: 'Demotion', icon: '⬇️', color: 'danger' },
  { value: 'ROLE_CHANGE', label: 'Role Change', icon: '🔀', color: 'default' },
];

export default function PromotionsPage() {
  const { token, user, hasPermission } = useAuth();
  const toast = useToast();
  
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // View state
  const [view, setView] = useState<'list' | 'form'>('list');
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [form, setForm] = useState({
    employeeId: '',
    type: 'PROMOTION',
    effectiveDate: new Date().toISOString().slice(0, 10),
    newDesignation: '',
    newDepartmentId: '',
    newBasicSalary: '',
    reason: '',
    remarks: '',
  });
  
  // Selected employee details
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const canManage = user?.role === 'ADMIN' || user?.role === 'HR';

  const fetchRecords = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterType) params.set('type', filterType);
      const res = await fetch(`/api/promotions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.data || []);
      }
    } catch {
      toast.error('Failed to fetch records');
    } finally {
      setLoading(false);
    }
  }, [token, filterType]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees?limit=500', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.data || []);
      }
    } catch { /* silent */ }
  }, [token]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.data || []);
      }
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchEmployees(); fetchDepartments(); }, [fetchEmployees, fetchDepartments]);

  // When employee selection changes, set selectedEmployee details
  useEffect(() => {
    if (form.employeeId) {
      const emp = employees.find(e => e.id === form.employeeId);
      setSelectedEmployee(emp || null);
      // Pre-fill current designation
      if (emp?.designation) {
        setForm(prev => ({ ...prev, newDesignation: prev.newDesignation || '' }));
      }
    } else {
      setSelectedEmployee(null);
    }
  }, [form.employeeId, employees]);

  const handleSubmit = async () => {
    if (!form.employeeId) { toast.error('Please select an employee'); return; }
    
    const needsDesignation = ['PROMOTION', 'DEMOTION', 'ROLE_CHANGE', 'PROMOTION_WITH_INCREMENT'].includes(form.type);
    const needsSalary = ['INCREMENT', 'PROMOTION_WITH_INCREMENT'].includes(form.type);
    const needsDepartment = form.type === 'TRANSFER';
    if (needsDesignation && !form.newDesignation) { toast.error('New designation is required'); return; }
    if (needsSalary && !form.newBasicSalary) { toast.error('New basic salary is required'); return; }
    if (needsDepartment && !form.newDepartmentId) { toast.error('New department is required'); return; }

    setSubmitting(true);
    try {
      const payload: any = {
        employeeId: form.employeeId,
        type: form.type,
        effectiveDate: form.effectiveDate,
        reason: form.reason || undefined,
        remarks: form.remarks || undefined,
      };
      if (needsDesignation || form.newDesignation) payload.newDesignation = form.newDesignation;
      if (form.newDepartmentId) payload.newDepartmentId = form.newDepartmentId;
      if (needsSalary && form.newBasicSalary) payload.newBasicSalary = parseFloat(form.newBasicSalary);

      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Record created successfully');
        setView('list');
        setForm({ employeeId: '', type: 'PROMOTION', effectiveDate: new Date().toISOString().slice(0, 10), newDesignation: '', newDepartmentId: '', newBasicSalary: '', reason: '', remarks: '' });
        fetchRecords();
        fetchEmployees(); // refresh employee data
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create record');
      }
    } catch { toast.error('Failed'); } finally { setSubmitting(false); }
  };

  const handleDelete = (id: string) => {
    openConfirm({
      title: 'Delete Record',
      message: 'Are you sure you want to delete this history record? This cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/promotions?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            toast.success('Record deleted');
            fetchRecords();
          } else {
            toast.error('Failed to delete');
          }
        } catch { toast.error('Failed'); }
      },
    });
  };

  const getTypeBadge = (type: string) => {
    const ht = historyTypes.find(h => h.value === type);
    if (!ht) return <Badge variant="default">{type}</Badge>;
    return <Badge variant={ht.color as any}>{ht.icon} {ht.label}</Badge>;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatCurrency = (n?: number) =>
    n ? `Rs ${n.toLocaleString('en-PK')}` : '—';

  const showDesignationField = ['PROMOTION', 'DEMOTION', 'ROLE_CHANGE', 'PROMOTION_WITH_INCREMENT'].includes(form.type);
  const showSalaryField = ['INCREMENT', 'PROMOTION_WITH_INCREMENT'].includes(form.type);
  const showDepartmentField = ['TRANSFER', 'PROMOTION', 'PROMOTION_WITH_INCREMENT'].includes(form.type);


  // Filtered records
  const filteredRecords = records.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.employee.firstName.toLowerCase().includes(q) ||
      r.employee.lastName.toLowerCase().includes(q) ||
      r.employee.employeeCode.toLowerCase().includes(q) ||
      (r.newDesignation || '').toLowerCase().includes(q) ||
      (r.oldDesignation || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" suppressHydrationWarning>
      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promotions & Increments</h1>
          <p className="text-sm text-slate-500 mt-1">Manage employee promotions, salary increments, and department transfers</p>
        </div>
        {canManage && view === 'list' && (
          <Button onClick={() => setView('form')} className="bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 text-white shadow-lg">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Record
          </Button>
        )}
        {view === 'form' && (
          <Button variant="ghost" onClick={() => setView('list')}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to List
          </Button>
        )}
      </div>

      {/* ─── CREATE FORM ─── */}
      {view === 'form' && canManage && (
        <Card className="border-2 border-emerald-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">📝</span>
              Create Promotion / Increment / Transfer
            </CardTitle>
          </CardHeader>
          <div className="p-6 space-y-6">
            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">Type of Action</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {historyTypes.map((ht) => (
                  <button
                    key={ht.value}
                    onClick={() => setForm(prev => ({ ...prev, type: ht.value }))}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      form.type === ht.value
                        ? 'border-emerald-500 bg-emerald-50 shadow-md scale-[1.02]'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{ht.icon}</span>
                    <span className="text-xs font-medium text-slate-700">{ht.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Employee Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee *</label>
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm(prev => ({ ...prev, employeeId: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                >
                  <option value="">Select employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employeeCode} — {emp.firstName} {emp.lastName} ({emp.designation || 'No designation'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Effective Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Effective Date *</label>
                <Input
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) => setForm(prev => ({ ...prev, effectiveDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Current Employee Info */}
            {selectedEmployee && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Current Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Designation:</span>
                    <p className="font-medium text-slate-900">{selectedEmployee.designation || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Department:</span>
                    <p className="font-medium text-slate-900">{selectedEmployee.department?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Basic Salary:</span>
                    <p className="font-medium text-slate-900">{formatCurrency(selectedEmployee.salary?.basicSalary)}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* New Designation */}
              {showDesignationField && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">New Designation *</label>
                  <Input
                    value={form.newDesignation}
                    onChange={(e) => setForm(prev => ({ ...prev, newDesignation: e.target.value }))}
                    placeholder="e.g. Senior Developer, Team Lead..."
                  />
                </div>
              )}

              {/* New Department */}
              {showDepartmentField && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">New Department {form.type === 'TRANSFER' ? '*' : '(optional)'}</label>
                  <select
                    value={form.newDepartmentId}
                    onChange={(e) => setForm(prev => ({ ...prev, newDepartmentId: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  >
                    <option value="">Select department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* New Salary */}
              {showSalaryField && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">New Basic Salary (Rs) *</label>
                  <Input
                    type="number"
                    value={form.newBasicSalary}
                    onChange={(e) => setForm(prev => ({ ...prev, newBasicSalary: e.target.value }))}
                    placeholder="Enter new basic salary..."
                  />
                  {selectedEmployee?.salary?.basicSalary && form.newBasicSalary && (
                    <div className="mt-2 text-xs">
                      {(() => {
                        const oldVal = selectedEmployee.salary!.basicSalary;
                        const newVal = parseFloat(form.newBasicSalary);
                        const diff = newVal - oldVal;
                        const pct = oldVal > 0 ? ((diff / oldVal) * 100).toFixed(1) : '0';
                        return (
                          <span className={diff >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {diff >= 0 ? '↑' : '↓'} {diff >= 0 ? '+' : ''}{formatCurrency(diff)} ({pct}%)
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reason & Remarks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none"
                  placeholder="Reason for this action..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Remarks / Notes</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none"
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button variant="ghost" onClick={() => setView('list')}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 text-white px-8"
              >
                {submitting ? 'Saving...' : 'Save Record'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ─── LIST VIEW ─── */}
      {view === 'list' && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, code, designation..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            >
              <option value="">All Types</option>
              {historyTypes.map((ht) => (
                <option key={ht.value} value={ht.value}>{ht.icon} {ht.label}</option>
              ))}
            </select>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {historyTypes.map((ht) => {
              const count = records.filter(r => r.type === ht.value).length;
              return (
                <button
                  key={ht.value}
                  onClick={() => setFilterType(filterType === ht.value ? '' : ht.value)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    filterType === ht.value
                      ? 'border-emerald-500 bg-emerald-50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl">{ht.icon}</span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{count}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{ht.label}</p>
                </button>
              );
            })}
          </div>

          {/* Records Timeline */}
          {filteredRecords.length === 0 ? (
            <Card className="text-center py-16">
              <span className="text-5xl block mb-4">📋</span>
              <h3 className="text-lg font-semibold text-slate-700">No records found</h3>
              <p className="text-sm text-slate-500 mt-1">
                {canManage ? 'Click "New Record" to create a promotion, increment, or transfer.' : 'No promotion or increment records available.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredRecords.map((record) => (
                <Card key={record.id} className="hover:shadow-md transition-all duration-200 border-l-4 border-l-emerald-500">
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      {/* Employee Avatar */}
                      <div className="flex-shrink-0">
                        {record.employee.profileImage ? (
                          <img src={record.employee.profileImage} alt="" className="w-12 h-12 rounded-xl object-cover" />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                            {record.employee.firstName[0]}{record.employee.lastName[0]}
                          </div>
                        )}
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {record.employee.firstName} {record.employee.lastName}
                          </h3>
                          <span className="text-xs text-slate-400 font-mono">{record.employee.employeeCode}</span>
                          {getTypeBadge(record.type)}
                        </div>

                        {/* Changes */}
                        <div className="space-y-1.5 text-sm">
                          {record.oldDesignation && record.newDesignation && (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-24 flex-shrink-0">Designation:</span>
                              <span className="text-slate-600">{record.oldDesignation}</span>
                              <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              <span className="font-semibold text-emerald-700">{record.newDesignation}</span>
                            </div>
                          )}
                          {record.oldDepartment && record.newDepartment && (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-24 flex-shrink-0">Department:</span>
                              <span className="text-slate-600">{record.oldDepartment.name}</span>
                              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              <span className="font-semibold text-blue-700">{record.newDepartment.name}</span>
                            </div>
                          )}
                          {record.oldBasicSalary != null && record.newBasicSalary != null && (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-24 flex-shrink-0">Salary:</span>
                              <span className="text-slate-600">{formatCurrency(record.oldBasicSalary)}</span>
                              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              <span className="font-semibold text-amber-700">{formatCurrency(record.newBasicSalary)}</span>
                              {record.oldBasicSalary > 0 && (
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                                  record.newBasicSalary >= record.oldBasicSalary ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {(((record.newBasicSalary - record.oldBasicSalary) / record.oldBasicSalary) * 100).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          )}
                          {record.reason && (
                            <div className="flex items-start gap-2 mt-2">
                              <span className="text-slate-500 w-24 flex-shrink-0">Reason:</span>
                              <span className="text-slate-600 italic">{record.reason}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right side: date & actions */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Effective Date</p>
                          <p className="text-sm font-semibold text-slate-700">{formatDate(record.effectiveDate)}</p>
                        </div>
                        <p className="text-[10px] text-slate-400">{formatDate(record.createdAt)}</p>
                        {user?.role === 'ADMIN' && (
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="text-red-400 hover:text-red-600 transition-colors mt-1"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
