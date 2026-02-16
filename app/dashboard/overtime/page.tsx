'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { useToast } from '../../components/ui/Toast';
import { Card, Button, Badge, Modal, Input, Select } from '@/app/components/ui';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

interface OvertimeRecord {
  id: string;
  employeeId: string;
  date: string;
  overtimeHours: number;
  overtimeType: string;
  rateMultiplier: number;
  status: string;
  notes: string | null;
  createdAt: string;
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    profileImage: string | null;
    department: { name: string } | null;
    salary: { basicSalary: number }[];
  } | null;
}

interface OvertimeRule {
  id: string;
  name: string;
  regularRate: number;
  weekendRate: number;
  holidayRate: number;
  maxDailyHours: number;
  maxMonthlyHours: number;
  minOvertimeMinutes: number;
  isActive: boolean;
}

export default function OvertimePage() {
  const { allowed, loading: permLoading } = useRequirePermission('overtime', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Overtime" />;
  return <OvertimePageContent />;
}

function OvertimePageContent() {
  const { user, token } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'HR';

  const [activeTab, setActiveTab] = useState<'records' | 'rules'>('records');
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [rules, setRules] = useState<OvertimeRule[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [activeRule, setActiveRule] = useState<OvertimeRule | null>(null);
  const [stats, setStats] = useState({ totalHours: 0, totalRecords: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [employeeFilter, setEmployeeFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);

  // Add form
  const [addForm, setAddForm] = useState({
    employeeId: '',
    date: '',
    overtimeHours: '',
    overtimeType: 'REGULAR',
    notes: '',
  });

  // Rule form
  const [ruleForm, setRuleForm] = useState({
    name: '',
    regularRate: '1.5',
    weekendRate: '2.0',
    holidayRate: '2.5',
    maxDailyHours: '4',
    maxMonthlyHours: '60',
    minOvertimeMinutes: '30',
  });

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info' | 'success'; confirmText: string; onConfirm: () => void }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });
  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (employeeFilter) params.append('employeeId', employeeFilter);
      const res = await fetch(`/api/overtime?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setEmployees(data.employees || []);
        setActiveRule(data.activeRule || null);
        setStats(data.stats || { totalHours: 0, totalRecords: 0, pendingCount: 0 });
      }
    } catch {
      toast.error('Failed to fetch overtime data');
    } finally {
      setLoading(false);
    }
  }, [token, month, statusFilter, employeeFilter]);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/overtime?view=rules', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch {
      toast.error('Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'records') fetchRecords();
    else fetchRules();
  }, [activeTab, fetchRecords, fetchRules]);

  const handleAddRecord = async () => {
    if (!addForm.employeeId || !addForm.date || !addForm.overtimeHours) {
      toast.error('Employee, date, and hours are required');
      return;
    }
    try {
      const res = await fetch('/api/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create_record',
          ...addForm,
          overtimeHours: parseFloat(addForm.overtimeHours),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record overtime');
      }
      toast.success('Overtime recorded successfully');
      setShowAddModal(false);
      setAddForm({ employeeId: '', date: '', overtimeHours: '', overtimeType: 'REGULAR', notes: '' });
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record overtime');
    }
  };

  const handleCreateRule = async () => {
    if (!ruleForm.name) { toast.error('Name required'); return; }
    try {
      const res = await fetch('/api/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'create_rule',
          name: ruleForm.name,
          regularRate: parseFloat(ruleForm.regularRate),
          weekendRate: parseFloat(ruleForm.weekendRate),
          holidayRate: parseFloat(ruleForm.holidayRate),
          maxDailyHours: parseFloat(ruleForm.maxDailyHours),
          maxMonthlyHours: parseFloat(ruleForm.maxMonthlyHours),
          minOvertimeMinutes: parseInt(ruleForm.minOvertimeMinutes),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create rule');
      }
      toast.success('Rule created successfully');
      setShowRuleModal(false);
      fetchRules();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create rule');
    }
  };

  const handleApprove = async (recordId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/overtime', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, recordId }),
      });
      if (res.ok) {
        toast.success(`Overtime ${action}d`);
        fetchRecords();
      } else {
        toast.error('Failed to update status');
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    openConfirm({ title: 'Delete Overtime Record', message: 'Delete this overtime record?', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/overtime?id=${id}&type=record`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          toast.success('Deleted');
          fetchRecords();
        } else {
          toast.error('Failed to delete');
        }
      } catch {
        toast.error('Failed to delete');
      }
    }});
  };

  const handleDeleteRule = async (id: string) => {
    openConfirm({ title: 'Delete Overtime Rule', message: 'Delete this overtime rule?', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      closeConfirm();
      try {
        const res = await fetch(`/api/overtime?id=${id}&type=rule`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          toast.success('Deleted');
          fetchRules();
        } else {
          toast.error('Failed to delete');
        }
      } catch {
        toast.error('Failed to delete');
      }
    }});
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/overtime', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'update_rule', ruleId, isActive: !isActive }),
      });
      if (res.ok) {
        toast.success(isActive ? 'Rule deactivated' : 'Rule activated');
        fetchRules();
      } else {
        toast.error('Failed to update rule');
      }
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string; icon: string }> = {
      AUTO_APPROVED: { variant: 'success', label: 'Auto Approved', icon: '✓' },
      MANUALLY_APPROVED: { variant: 'success', label: 'Approved', icon: '✓' },
      PENDING: { variant: 'warning', label: 'Pending', icon: '○' },
      REJECTED: { variant: 'danger', label: 'Rejected', icon: '✕' },
    };
    const c = config[status] || { variant: 'default' as const, label: status, icon: '' };
    return <Badge variant={c.variant}>{c.icon} {c.label}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const config: Record<string, { color: string; label: string }> = {
      REGULAR: { color: 'bg-blue-100 text-blue-700', label: 'Regular' },
      WEEKEND: { color: 'bg-purple-100 text-purple-700', label: 'Weekend' },
      HOLIDAY: { color: 'bg-amber-100 text-amber-700', label: 'Holiday' },
    };
    const c = config[type] || { color: 'bg-gray-100 text-gray-700', label: type };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${c.color}`}>{c.label}</span>;
  };

  const calculateOTPay = (record: OvertimeRecord) => {
    if (!record.employee?.salary?.[0]?.basicSalary) return null;
    const hourlyRate = record.employee.salary[0].basicSalary / (22 * 8);
    return Math.round(hourlyRate * record.rateMultiplier * record.overtimeHours);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Overtime Management</h1>
              <p className="text-teal-100 text-sm mt-0.5">Track and manage employee overtime hours</p>
            </div>
          </div>
        {(isAdmin || user?.role === 'MANAGER') && (
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button variant="ghost" onClick={() => setShowRuleModal(true)} size="sm" className="!bg-white/90 !text-teal-700 hover:!bg-white border-0 shadow-sm font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 mr-1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                OT Rules
              </Button>
            )}
            <Button variant="ghost" onClick={() => setShowAddModal(true)} size="sm" className="!bg-white !text-teal-700 hover:!bg-teal-50 border-0 shadow-md font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 mr-1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Record Overtime
            </Button>
          </div>
        )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total OT Hours</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalHours}<span className="text-sm font-normal text-gray-400 ml-1">hrs</span></p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6 text-blue-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Records</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalRecords}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6 text-emerald-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pending Approval</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingCount}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6 text-amber-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs for Admin */}
      {isAdmin && (
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('records')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'records' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Records
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'rules' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Rules & Rates
          </button>
        </div>
      )}

      {activeTab === 'records' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-44">
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div className="w-44">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { label: 'All Status', value: 'ALL' },
                  { label: 'Pending', value: 'PENDING' },
                  { label: 'Auto Approved', value: 'AUTO_APPROVED' },
                  { label: 'Approved', value: 'MANUALLY_APPROVED' },
                  { label: 'Rejected', value: 'REJECTED' },
                ]}
              />
            </div>
            {isAdmin && (
              <div className="w-52">
                <Select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  options={[{ label: 'All Employees', value: '' }, ...employees.map(e => ({ label: `${e.firstName} ${e.lastName}`, value: e.id }))]}
                />
              </div>
            )}
            {activeRule && (
              <div className="ml-auto flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                </svg>
                Rates: Regular {activeRule.regularRate}x | Weekend {activeRule.weekendRate}x | Holiday {activeRule.holidayRate}x
              </div>
            )}
          </div>

          {/* Records Table */}
          {loading ? (
            <Card>
              <div className="space-y-4 p-6">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="skeleton w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-4 w-1/4 rounded-lg" />
                      <div className="skeleton h-3 w-1/6 rounded-lg" />
                    </div>
                    <div className="skeleton h-4 w-16 rounded-lg" />
                    <div className="skeleton h-4 w-20 rounded-lg" />
                  </div>
                ))}
              </div>
            </Card>
          ) : records.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-16 h-16 mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="text-lg font-medium text-gray-500">No overtime records</p>
                <p className="text-sm text-gray-400 mt-1">Overtime records will appear here</p>
              </div>
            </Card>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="text-left py-3.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="text-left py-3.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Hours</th>
                      <th className="text-left py-3.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="text-left py-3.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
                      <th className="text-left py-3.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Est. Pay</th>
                      <th className="text-left py-3.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-right py-3.5 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.map(record => {
                      const pay = calculateOTPay(record);
                      return (
                        <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-semibold">
                                {record.employee ? `${record.employee.firstName[0]}${record.employee.lastName[0]}` : '??'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : 'Unknown'}
                                </p>
                                <p className="text-xs text-gray-400">{record.employee?.department?.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-sm text-gray-600">
                            {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="py-3.5 px-5">
                            <span className="text-sm font-semibold text-gray-900">{record.overtimeHours}<span className="text-xs text-gray-400 ml-0.5">h</span></span>
                          </td>
                          <td className="py-3.5 px-5">{getTypeBadge(record.overtimeType)}</td>
                          <td className="py-3.5 px-5 text-sm text-gray-600">{record.rateMultiplier}x</td>
                          <td className="py-3.5 px-5">
                            {pay !== null ? (
                              <span className="text-sm font-medium text-emerald-600">₹{pay.toLocaleString()}</span>
                            ) : (
                              <span className="text-xs text-gray-300">N/A</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5">{getStatusBadge(record.status)}</td>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center justify-end gap-2">
                              {record.status === 'PENDING' && (isAdmin || user?.role === 'MANAGER') && (
                                <>
                                  <button
                                    onClick={() => handleApprove(record.id, 'approve')}
                                    className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                                    title="Approve"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleApprove(record.id, 'reject')}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                    title="Reject"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteRecord(record.id)}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                                  title="Delete"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && isAdmin && (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setShowRuleModal(true)} size="sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 mr-1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Rule
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="skeleton h-5 w-1/2 rounded-lg mb-4" />
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(j => <div key={j} className="skeleton h-12 rounded-lg" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : rules.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-16 h-16 mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                <p className="text-lg font-medium text-gray-500">No overtime rules</p>
                <p className="text-sm text-gray-400 mt-1">Create a rule to define OT rates and limits</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {rules.map(rule => (
                <div key={rule.id} className={`bg-white rounded-xl border-2 p-5 transition-all ${rule.isActive ? 'border-emerald-300 shadow-sm' : 'border-gray-200 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                      <Badge variant={rule.isActive ? 'success' : 'default'}>{rule.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleRule(rule.id, rule.isActive)}
                        className={`p-1.5 rounded-lg transition-colors ${rule.isActive ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                        title={rule.isActive ? 'Deactivate' : 'Activate'}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteRule(rule.id)} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-blue-500 font-medium">Regular</p>
                      <p className="text-lg font-bold text-blue-700">{rule.regularRate}x</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-purple-500 font-medium">Weekend</p>
                      <p className="text-lg font-bold text-purple-700">{rule.weekendRate}x</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-amber-500 font-medium">Holiday</p>
                      <p className="text-lg font-bold text-amber-700">{rule.holidayRate}x</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    <span>Max {rule.maxDailyHours}h/day • {rule.maxMonthlyHours}h/month</span>
                    <span>Min {rule.minOvertimeMinutes} min</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Record Modal */}
      {showAddModal && (
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Record Overtime">
          <div className="space-y-4">
            <Select
              label="Employee"
              value={addForm.employeeId}
              onChange={(e) => setAddForm(prev => ({ ...prev, employeeId: e.target.value }))}
              options={[{ label: 'Select Employee', value: '' }, ...employees.map(e => ({ label: `${e.firstName} ${e.lastName} (${e.employeeCode})`, value: e.id }))]}
            />
            <Input
              label="Date"
              type="date"
              value={addForm.date}
              onChange={(e) => setAddForm(prev => ({ ...prev, date: e.target.value }))}
            />
            <Input
              label="Overtime Hours"
              type="number"
              step="0.5"
              min="0.5"
              value={addForm.overtimeHours}
              onChange={(e) => setAddForm(prev => ({ ...prev, overtimeHours: e.target.value }))}
              placeholder="e.g., 2.5"
            />
            <Select
              label="Overtime Type"
              value={addForm.overtimeType}
              onChange={(e) => setAddForm(prev => ({ ...prev, overtimeType: e.target.value }))}
              options={[
                { label: 'Regular', value: 'REGULAR' },
                { label: 'Weekend', value: 'WEEKEND' },
                { label: 'Holiday', value: 'HOLIDAY' },
              ]}
            />
            <Input
              label="Notes (Optional)"
              value={addForm.notes}
              onChange={(e) => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Reason for overtime..."
            />
            {activeRule && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                <p className="font-medium text-gray-600 mb-1">Rate Preview</p>
                <p>
                  {addForm.overtimeType === 'WEEKEND' ? `Weekend: ${activeRule.weekendRate}x` :
                    addForm.overtimeType === 'HOLIDAY' ? `Holiday: ${activeRule.holidayRate}x` :
                      `Regular: ${activeRule.regularRate}x`}
                  {' '}multiplier will be applied
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button onClick={handleAddRecord}>Record Overtime</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Rule Modal */}
      {showRuleModal && (
        <Modal isOpen={showRuleModal} onClose={() => setShowRuleModal(false)} title="Create Overtime Rule">
          <div className="space-y-4">
            <Input
              label="Rule Name"
              value={ruleForm.name}
              onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Standard OT Policy"
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Regular Rate"
                type="number"
                step="0.1"
                value={ruleForm.regularRate}
                onChange={(e) => setRuleForm(prev => ({ ...prev, regularRate: e.target.value }))}
              />
              <Input
                label="Weekend Rate"
                type="number"
                step="0.1"
                value={ruleForm.weekendRate}
                onChange={(e) => setRuleForm(prev => ({ ...prev, weekendRate: e.target.value }))}
              />
              <Input
                label="Holiday Rate"
                type="number"
                step="0.1"
                value={ruleForm.holidayRate}
                onChange={(e) => setRuleForm(prev => ({ ...prev, holidayRate: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Max Daily Hours"
                type="number"
                value={ruleForm.maxDailyHours}
                onChange={(e) => setRuleForm(prev => ({ ...prev, maxDailyHours: e.target.value }))}
              />
              <Input
                label="Max Monthly Hours"
                type="number"
                value={ruleForm.maxMonthlyHours}
                onChange={(e) => setRuleForm(prev => ({ ...prev, maxMonthlyHours: e.target.value }))}
              />
              <Input
                label="Min OT Minutes"
                type="number"
                value={ruleForm.minOvertimeMinutes}
                onChange={(e) => setRuleForm(prev => ({ ...prev, minOvertimeMinutes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowRuleModal(false)}>Cancel</Button>
              <Button onClick={handleCreateRule}>Create Rule</Button>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmDialog isOpen={confirmDialog.open} onClose={closeConfirm} onConfirm={() => confirmDialog.onConfirm()} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} />
    </div>
  );
}
