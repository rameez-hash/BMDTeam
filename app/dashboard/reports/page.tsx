'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';

type ReportType = 'attendance' | 'leave' | 'payroll' | 'employees';
type ViewMode = 'summary' | 'details';

interface Department { id: string; name: string; count: number }

const formatPKR = (amount: number) => {
  if (!amount && amount !== 0) return 'Rs 0';
  return 'Rs ' + Math.round(amount).toLocaleString('en-PK');
};

const REPORT_TYPES: { id: ReportType; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  {
    id: 'attendance', label: 'Attendance', color: 'from-emerald-500 to-teal-600', desc: 'Check-in, late, absent, hours',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75" /></svg>,
  },
  {
    id: 'leave', label: 'Leave', color: 'from-blue-500 to-indigo-600', desc: 'Requests, approvals, days used',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  },
  {
    id: 'payroll', label: 'Payroll', color: 'from-amber-500 to-orange-600', desc: 'Salary, tax, deductions',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    id: 'employees', label: 'Employees', color: 'from-purple-500 to-pink-600', desc: 'Workforce overview & directory',
    icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  },
];

export default function ReportsPage() {
  const { allowed, loading: permLoading } = useRequirePermission('reports', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Reports" />;
  return <ReportsPageContent />;
}

function ReportsPageContent() {
  const { token, user } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [reportType, setReportType] = useState<ReportType>('attendance');
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceTab, setAttendanceTab] = useState<'summary' | 'daily'>('summary');
  const [leaveTab, setLeaveTab] = useState<'requests' | 'balances'>('requests');

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'HR';

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    setStartDate(fmt(start));
    setEndDate(fmt(end));
  }, []);

  const fetchReport = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (departmentId) params.set('departmentId', departmentId);
      const res = await fetch(`/api/reports?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setData(d.data);
        if (d.departments) setDepartments(d.departments);
      } else {
        toastRef.current.error('Failed to load report');
      }
    } catch {
      toastRef.current.error('Network error');
    } finally {
      setLoading(false);
    }
  }, [token, reportType, startDate, endDate, departmentId]);

  useEffect(() => {
    if (startDate && endDate && token) fetchReport();
  }, [fetchReport, startDate, endDate, token]);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ type: reportType, format: 'pdf' });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (departmentId) params.set('departmentId', departmentId);
      const res = await fetch(`/api/reports?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const html = await res.text();
        const w = window.open('', '_blank', 'width=1100,height=700');
        if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
        toastRef.current.success('PDF report generated');
      }
    } catch {
      toastRef.current.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const params = new URLSearchParams({ type: reportType, format: 'csv' });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (departmentId) params.set('departmentId', departmentId);
      const res = await fetch(`/api/reports?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}-report.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toastRef.current.success('CSV downloaded');
      }
    } catch {
      toastRef.current.error('CSV download failed');
    }
  };

  const fmtDate = (d: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="text-center p-8 max-w-md">
          <svg className="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Restricted</h2>
          <p className="text-slate-500">Reports are only accessible to Admin and HR users.</p>
        </Card>
      </div>
    );
  }

  const summary = (data as Record<string, unknown>)?.summary as Record<string, unknown> | undefined;
  const employeeDetails = ((data as Record<string, unknown>)?.employeeDetails || []) as Array<Record<string, unknown>>;
  const filteredDetails = employeeDetails.filter(e => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return String(e.name || '').toLowerCase().includes(term) ||
           String(e.code || '').toLowerCase().includes(term) ||
           String(e.department || '').toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Reports & Analytics</h1>
              <p className="text-teal-100 text-sm mt-0.5">{fmtDate(startDate)} — {fmtDate(endDate)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleDownloadCSV} className="!bg-white/20 !text-white hover:!bg-white/30 border-0 font-semibold text-sm">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </Button>
            <Button variant="ghost" onClick={handleDownloadPDF} loading={downloading} className="!bg-white !text-teal-700 hover:!bg-teal-50 border-0 shadow-md font-semibold text-sm">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Report Type Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORT_TYPES.map(rt => (
          <button
            key={rt.id}
            onClick={() => { setReportType(rt.id); setViewMode('summary'); setSearchTerm(''); }}
            className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-200 ${
              reportType === rt.id
                ? 'ring-2 ring-emerald-500 shadow-lg scale-[1.02]'
                : 'ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-md'
            }`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${rt.color} ${reportType === rt.id ? 'opacity-100' : 'opacity-5'} transition-opacity`} />
            <div className="relative">
              <span className={`${reportType === rt.id ? 'text-white' : 'text-slate-600'}`}>{rt.icon}</span>
              <h3 className={`mt-2 font-bold text-sm ${reportType === rt.id ? 'text-white' : 'text-slate-800'}`}>{rt.label}</h3>
              <p className={`text-xs mt-0.5 ${reportType === rt.id ? 'text-white/80' : 'text-slate-500'}`}>{rt.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="border border-slate-200">
        <div className="flex flex-wrap items-end gap-4">
          <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          <Select label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} options={[
            { value: '', label: 'All Departments' },
            ...departments.map(d => ({ value: d.id, label: `${d.name} (${d.count})` })),
          ]} className="w-48" />
          <Select label="Quick Range" value="" onChange={(e) => {
            const now = new Date();
            const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            if (e.target.value === 'thisMonth') {
              setStartDate(fmt(new Date(now.getFullYear(), now.getMonth(), 1)));
              setEndDate(fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
            } else if (e.target.value === 'lastMonth') {
              setStartDate(fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
              setEndDate(fmt(new Date(now.getFullYear(), now.getMonth(), 0)));
            } else if (e.target.value === 'last3') {
              setStartDate(fmt(new Date(now.getFullYear(), now.getMonth() - 2, 1)));
              setEndDate(fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
            } else if (e.target.value === 'thisYear') {
              setStartDate(fmt(new Date(now.getFullYear(), 0, 1)));
              setEndDate(fmt(new Date(now.getFullYear(), 11, 31)));
            } else if (e.target.value === 'lastYear') {
              setStartDate(fmt(new Date(now.getFullYear() - 1, 0, 1)));
              setEndDate(fmt(new Date(now.getFullYear() - 1, 11, 31)));
            }
          }} options={[
            { value: '', label: 'Select...' },
            { value: 'thisMonth', label: 'This Month' },
            { value: 'lastMonth', label: 'Last Month' },
            { value: 'last3', label: 'Last 3 Months' },
            { value: 'thisYear', label: 'This Year' },
            { value: 'lastYear', label: 'Last Year' },
          ]} className="w-40" />
          <Button onClick={fetchReport} loading={loading}>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Refresh
          </Button>
        </div>
      </Card>

      {/* View Mode Toggle */}
      {!loading && data && (
        <div className="flex items-center justify-between">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('summary')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'summary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              Summary
            </button>
            <button
              onClick={() => setViewMode('details')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'details' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Detailed View
            </button>
          </div>
          {viewMode === 'details' && (
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Search by name, code, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-slate-500">Generating report...</p>
          </div>
        </div>
      )}

      {/* ═══════════ ATTENDANCE REPORT ═══════════ */}
      {!loading && data && reportType === 'attendance' && (
        <div className="space-y-5">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Records', value: String(summary?.totalRecords ?? 0), bg: 'bg-slate-50 border-slate-200', text: 'text-slate-900' },
              { label: 'Present', value: String(summary?.presentDays ?? 0), bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
              { label: 'Absent', value: String(summary?.absentDays ?? 0), bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
              { label: 'Late', value: String(summary?.lateDays ?? 0), bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
              { label: 'Half Day', value: String(summary?.halfDays ?? 0), bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
              { label: 'Avg Hours', value: String(summary?.avgWorkHours ?? '0') + 'h', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} border rounded-2xl p-4 text-center`}>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.text}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {viewMode === 'summary' && (
            <>
              {/* Breakdown Bars */}
              {(summary?.totalRecords as number) > 0 && (
                <Card className="border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Attendance Breakdown</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Present', val: summary?.presentDays as number, color: 'bg-emerald-500' },
                      { label: 'Absent', val: summary?.absentDays as number, color: 'bg-red-500' },
                      { label: 'Late', val: summary?.lateDays as number, color: 'bg-amber-500' },
                      { label: 'Half Day', val: summary?.halfDays as number, color: 'bg-orange-400' },
                      { label: 'On Leave', val: summary?.onLeave as number, color: 'bg-blue-500' },
                    ].map((bar, i) => {
                      const total = (summary?.totalRecords as number) || 1;
                      const pct = (bar.val / total * 100);
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-sm text-slate-600 w-20">{bar.label}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div className={`${bar.color} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.max(pct, 0.5)}%` }} />
                          </div>
                          <span className="text-sm font-bold text-slate-700 w-24 text-right">{bar.val} ({pct.toFixed(1)}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Department Table */}
              {((data as Record<string, unknown>)?.byDepartment as Array<Record<string, unknown>>)?.length > 0 && (
                <Card className="border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">By Department</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Department</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Total</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Present</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Absent</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Late</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Rate</th>
                      </tr></thead>
                      <tbody>
                        {((data as Record<string, unknown>).byDepartment as Array<Record<string, unknown>>).map((dept, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium">{String(dept.name)}</td>
                            <td className="px-4 py-2.5 text-center">{Number(dept.total)}</td>
                            <td className="px-4 py-2.5 text-center text-emerald-600 font-medium">{Number(dept.present)}</td>
                            <td className="px-4 py-2.5 text-center text-red-600 font-medium">{Number(dept.absent)}</td>
                            <td className="px-4 py-2.5 text-center text-amber-600 font-medium">{Number(dept.late)}</td>
                            <td className="px-4 py-2.5 text-center">
                              <Badge variant={Number(dept.total) > 0 && (Number(dept.present) / Number(dept.total) * 100) >= 80 ? 'success' : 'warning'}>
                                {Number(dept.total) > 0 ? (Number(dept.present) / Number(dept.total) * 100).toFixed(1) : 0}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Detailed Employee Table */}
          {viewMode === 'details' && (
            <div className="space-y-4">
              {/* Sub-tabs: Employee Summary / Daily Records */}
              <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setAttendanceTab('summary')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${attendanceTab === 'summary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Employee Summary
                </button>
                <button
                  onClick={() => setAttendanceTab('daily')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${attendanceTab === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Daily Records
                </button>
              </div>

              {/* Employee Summary Table */}
              {attendanceTab === 'summary' && (
            <Card className="border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Employee-wise Attendance ({filteredDetails.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Code</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Employee</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Department</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-emerald-600">Present</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-red-600">Absent</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-amber-600">Late</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-orange-600">Half Day</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-blue-600">On Leave</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Avg Hours</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Rate</th>
                  </tr></thead>
                  <tbody>
                    {filteredDetails.length === 0 ? (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">No data found</td></tr>
                    ) : filteredDetails.map((e, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{String(e.code)}</td>
                        <td className="px-4 py-2.5 font-medium">{String(e.name)}</td>
                        <td className="px-4 py-2.5 text-slate-600">{String(e.department)}</td>
                        <td className="px-4 py-2.5 text-center text-emerald-600 font-bold">{Number(e.present)}</td>
                        <td className="px-4 py-2.5 text-center text-red-600 font-bold">{Number(e.absent)}</td>
                        <td className="px-4 py-2.5 text-center text-amber-600 font-bold">{Number(e.late)}</td>
                        <td className="px-4 py-2.5 text-center text-orange-600 font-bold">{Number(e.halfDay)}</td>
                        <td className="px-4 py-2.5 text-center text-blue-600 font-bold">{Number(e.onLeave)}</td>
                        <td className="px-4 py-2.5 text-center">{String(e.avgHours)}h</td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant={Number(e.attendanceRate) >= 80 ? 'success' : Number(e.attendanceRate) >= 60 ? 'warning' : 'danger'}>
                            {String(e.attendanceRate)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
              )}

              {/* Daily Attendance Records */}
              {attendanceTab === 'daily' && (
                <Card className="border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900">Day-by-Day Attendance History</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Date</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Employee</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Department</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Check In</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Check Out</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Status</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-amber-600">Late</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Hours</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Shift</th>
                      </tr></thead>
                      <tbody>
                        {(() => {
                          const records = ((data as Record<string, unknown>)?.attendanceRecords || []) as Array<Record<string, unknown>>;
                          const filtered = records.filter(r => {
                            if (!searchTerm) return true;
                            const term = searchTerm.toLowerCase();
                            return String(r.employee || '').toLowerCase().includes(term) ||
                                   String(r.code || '').toLowerCase().includes(term) ||
                                   String(r.department || '').toLowerCase().includes(term);
                          });
                          if (filtered.length === 0) return <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No attendance records found</td></tr>;
                          return filtered.map((r, i) => {
                            const statusColor: Record<string, string> = {
                              PRESENT: 'success', ABSENT: 'danger', HALF_DAY: 'warning', ON_LEAVE: 'info', HOLIDAY: 'primary', WEEKEND: 'default',
                            };
                            const formatTime = (iso: unknown) => {
                              if (!iso) return '—';
                              const d = new Date(String(iso));
                              return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                            };
                            return (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 font-medium">{fmtDate(String(r.date))}</td>
                                <td className="px-3 py-2">
                                  <div className="font-medium">{String(r.employee)}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{String(r.code)}</div>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{String(r.department)}</td>
                                <td className="px-3 py-2 text-center font-mono text-emerald-600">{formatTime(r.checkIn)}</td>
                                <td className="px-3 py-2 text-center font-mono text-red-600">{formatTime(r.checkOut)}</td>
                                <td className="px-3 py-2 text-center">
                                  <Badge variant={(statusColor[String(r.status)] || 'default') as 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'default'}>
                                    {String(r.status).replace('_', ' ')}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {r.isLate ? (
                                    <span className="text-amber-600 font-bold">{Number(r.lateMinutes)} min</span>
                                  ) : (
                                    <span className="text-slate-400">{'—'}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center font-medium">{Number(r.workHours) > 0 ? `${r.workHours}h` : '—'}</td>
                                <td className="px-3 py-2 text-slate-500">{String(r.shiftName)}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ LEAVE REPORT ═══════════ */}
      {!loading && data && reportType === 'leave' && (
        <div className="space-y-5">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Requests', value: String(summary?.totalRequests ?? 0), bg: 'bg-slate-50 border-slate-200', text: 'text-slate-900' },
              { label: 'Approved', value: String(summary?.approved ?? 0), bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
              { label: 'Pending', value: String(summary?.pending ?? 0), bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
              { label: 'Rejected', value: String(summary?.rejected ?? 0), bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
              { label: 'Days Used', value: String(summary?.totalDaysUsed ?? 0), bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} border rounded-2xl p-4 text-center`}>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.text}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {viewMode === 'summary' && (
            <>
              {/* Sub tabs: Requests Summary / Leave Balances */}
              <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setLeaveTab('requests')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${leaveTab === 'requests' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Requests Summary
                </button>
                <button
                  onClick={() => setLeaveTab('balances')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${leaveTab === 'balances' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Leave Balances
                </button>
              </div>

              {leaveTab === 'requests' && (
                <>
              {/* By Leave Type */}
              {((data as Record<string, unknown>)?.byType as Array<Record<string, unknown>>)?.length > 0 && (
                <Card className="border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">By Leave Type</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Leave Type</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Total</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-emerald-600">Approved</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-amber-600">Pending</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-red-600">Rejected</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-blue-600">Days Used</th>
                      </tr></thead>
                      <tbody>
                        {((data as Record<string, unknown>).byType as Array<Record<string, unknown>>).map((t, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium">{String(t.name)}</td>
                            <td className="px-4 py-2.5 text-center font-bold">{Number(t.count)}</td>
                            <td className="px-4 py-2.5 text-center text-emerald-600">{Number(t.approved)}</td>
                            <td className="px-4 py-2.5 text-center text-amber-600">{Number(t.pending)}</td>
                            <td className="px-4 py-2.5 text-center text-red-600">{Number(t.rejected)}</td>
                            <td className="px-4 py-2.5 text-center text-blue-600 font-medium">{Number(t.totalDays)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Employee Leave Summary */}
              {filteredDetails.length > 0 && (
                <Card className="border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Employee Leave Summary</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Code</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Employee</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Department</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Requests</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-emerald-600">Approved</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-amber-600">Pending</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-red-600">Rejected</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-blue-600">Days Used</th>
                      </tr></thead>
                      <tbody>
                        {filteredDetails.map((e, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{String(e.code)}</td>
                            <td className="px-4 py-2.5 font-medium">{String(e.name)}</td>
                            <td className="px-4 py-2.5 text-slate-600">{String(e.department)}</td>
                            <td className="px-4 py-2.5 text-center font-bold">{Number(e.total || 0)}</td>
                            <td className="px-4 py-2.5 text-center text-emerald-600 font-bold">{Number(e.approved || 0)}</td>
                            <td className="px-4 py-2.5 text-center text-amber-600 font-bold">{Number(e.pending || 0)}</td>
                            <td className="px-4 py-2.5 text-center text-red-600 font-bold">{Number(e.rejected || 0)}</td>
                            <td className="px-4 py-2.5 text-center text-blue-600 font-bold">{Number(e.totalDays || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
                </>
              )}

              {/* Leave Balances Tab */}
              {leaveTab === 'balances' && (
                <Card className="border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Employee Leave Balances ({new Date().getFullYear()})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Code</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Employee</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Department</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Leave Type</th>
                          <th className="text-center px-3 py-2.5 font-semibold text-blue-600">Allocated</th>
                          <th className="text-center px-3 py-2.5 font-semibold text-emerald-600">Used</th>
                          <th className="text-center px-3 py-2.5 font-semibold text-amber-600">Pending</th>
                          <th className="text-center px-3 py-2.5 font-semibold text-purple-600">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const balances = ((data as Record<string, unknown>)?.leaveBalances || []) as Array<Record<string, unknown>>;
                          if (balances.length === 0) return <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No leave balance data found</td></tr>;

                          const filtered = balances.filter(emp => {
                            if (!searchTerm) return true;
                            const term = searchTerm.toLowerCase();
                            return String(emp.name || '').toLowerCase().includes(term) ||
                                   String(emp.code || '').toLowerCase().includes(term) ||
                                   String(emp.department || '').toLowerCase().includes(term);
                          });

                          if (filtered.length === 0) return <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No matching employees</td></tr>;

                          return filtered.map((emp, ei) => {
                            const empBalances = (emp.balances as Array<Record<string, unknown>>) || [];
                            if (empBalances.length === 0) return null;
                            return empBalances.map((bal, bi) => (
                              <tr key={`${ei}-${bi}`} className={`border-b border-slate-100 hover:bg-slate-50 ${bi === 0 ? 'border-t-2 border-t-slate-200' : ''}`}>
                                {bi === 0 && (
                                  <>
                                    <td className="px-3 py-2 text-slate-500 font-mono align-top" rowSpan={empBalances.length}>{String(emp.code)}</td>
                                    <td className="px-3 py-2 font-medium align-top" rowSpan={empBalances.length}>
                                      <div>{String(emp.name)}</div>
                                      <div className="text-[10px] text-slate-400 mt-0.5">
                                        Total: {Number(emp.totalAllocated || 0)} allocated, {Number(emp.totalRemaining || 0)} remaining
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-slate-600 align-top" rowSpan={empBalances.length}>{String(emp.department)}</td>
                                  </>
                                )}
                                <td className="px-3 py-2">
                                  <Badge variant="info">{String(bal.leaveType)}</Badge>
                                </td>
                                <td className="px-3 py-2 text-center text-blue-600 font-bold">{Number(bal.total || 0)}</td>
                                <td className="px-3 py-2 text-center text-emerald-600 font-bold">{Number(bal.used || 0)}</td>
                                <td className="px-3 py-2 text-center text-amber-600 font-bold">{Number(bal.pending || 0)}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`font-bold ${Number(bal.remaining || 0) <= 2 ? 'text-red-600' : 'text-purple-700'}`}>
                                    {Number(bal.remaining || 0)}
                                  </span>
                                </td>
                              </tr>
                            ));
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Detailed Requests */}
          {viewMode === 'details' && (
            <Card className="border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4">Leave Requests Detail</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Employee</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Department</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Type</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">From</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">To</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Days</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Status</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Reason</th>
                  </tr></thead>
                  <tbody>
                    {(() => {
                      const requests = ((data as Record<string, unknown>)?.recentRequests || []) as Array<Record<string, unknown>>;
                      const filtered = requests.filter(r => {
                        if (!searchTerm) return true;
                        const term = searchTerm.toLowerCase();
                        return String(r.employee || '').toLowerCase().includes(term) ||
                               String(r.code || '').toLowerCase().includes(term) ||
                               String(r.department || '').toLowerCase().includes(term) ||
                               String(r.leaveType || '').toLowerCase().includes(term);
                      });
                      if (filtered.length === 0) return <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No leave requests found</td></tr>;
                      return filtered.map((r, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-medium">{String(r.employee)}</td>
                          <td className="px-3 py-2.5 text-slate-600">{String(r.department)}</td>
                          <td className="px-3 py-2.5"><Badge variant="info">{String(r.leaveType)}</Badge></td>
                          <td className="px-3 py-2.5 text-slate-600">{fmtDate(String(r.startDate))}</td>
                          <td className="px-3 py-2.5 text-slate-600">{fmtDate(String(r.endDate))}</td>
                          <td className="px-3 py-2.5 text-center font-bold">{Number(r.totalDays)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Badge variant={r.status === 'APPROVED' ? 'success' : r.status === 'PENDING' ? 'warning' : 'danger'}>
                              {String(r.status)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 text-xs max-w-[200px] truncate">{String(r.reason)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════ PAYROLL REPORT ═══════════ */}
      {!loading && data && reportType === 'payroll' && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Records', value: String(summary?.totalRecords ?? 0), bg: 'bg-slate-50 border-slate-200', text: 'text-slate-900' },
              { label: 'Gross Salary', value: formatPKR(Number(summary?.totalGross ?? 0)), bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
              { label: 'Total Deductions', value: formatPKR(Number(summary?.totalDeductions ?? 0)), bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
              { label: 'Net Paid', value: formatPKR(Number(summary?.totalNet ?? 0)), bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
              { label: 'Income Tax', value: formatPKR(Number(summary?.totalTax ?? 0)), bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} border rounded-2xl p-4 text-center`}>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
                <p className={`text-lg font-bold mt-1 ${s.text}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {viewMode === 'summary' && (
            <>
              {/* Employee Payroll Summary */}
              {employeeDetails.length > 0 && (
                <Card className="border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Employee Payroll Summary</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Code</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Employee</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Department</th>
                        <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Records</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Gross</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-red-600">Deductions</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-emerald-600">Net</th>
                      </tr></thead>
                      <tbody>
                        {filteredDetails.map((e, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{String(e.code)}</td>
                            <td className="px-4 py-2.5 font-medium">{String(e.name)}</td>
                            <td className="px-4 py-2.5 text-slate-600">{String(e.department)}</td>
                            <td className="px-4 py-2.5 text-center">{Number(e.records)}</td>
                            <td className="px-4 py-2.5 text-right">{formatPKR(Number(e.totalGross))}</td>
                            <td className="px-4 py-2.5 text-right text-red-600">{formatPKR(Number(e.totalDeductions))}</td>
                            <td className="px-4 py-2.5 text-right text-emerald-700 font-bold">{formatPKR(Number(e.totalNet))}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                          <td colSpan={4} className="px-4 py-2.5">Grand Total</td>
                          <td className="px-4 py-2.5 text-right">{formatPKR(Number(summary?.totalGross ?? 0))}</td>
                          <td className="px-4 py-2.5 text-right text-red-600">{formatPKR(Number(summary?.totalDeductions ?? 0))}</td>
                          <td className="px-4 py-2.5 text-right text-emerald-700">{formatPKR(Number(summary?.totalNet ?? 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Department Distribution */}
              {((data as Record<string, unknown>)?.byDepartment as Array<Record<string, unknown>>)?.length > 0 && (
                <Card className="border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Payroll by Department</h3>
                  <div className="space-y-3">
                    {((data as Record<string, unknown>).byDepartment as Array<Record<string, unknown>>).sort((a, b) => Number(b.totalPaid) + Number(b.totalPending) - Number(a.totalPaid) - Number(a.totalPending)).map((d, i) => {
                      const total = Number(d.totalPaid) + Number(d.totalPending);
                      const maxTotal = Math.max(...((data as Record<string, unknown>).byDepartment as Array<Record<string, unknown>>).map(x => Number(x.totalPaid) + Number(x.totalPending)));
                      const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-sm text-slate-600 w-32 truncate">{String(d.name)}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-bold text-slate-700 w-32 text-right">{formatPKR(total)}</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Detailed Payroll Records */}
          {viewMode === 'details' && (
            <Card className="border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4">Payroll Records Detail</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Employee</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Dept</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Month</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Days</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600">Gross</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-amber-600">Tax</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-indigo-600">PF</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-orange-600">Late</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-red-600">Absent</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-red-600">Total Ded.</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-emerald-600">Net</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600">Status</th>
                  </tr></thead>
                  <tbody>
                    {(() => {
                      const records = ((data as Record<string, unknown>)?.payrollDetails || []) as Array<Record<string, unknown>>;
                      const filtered = records.filter(r => {
                        if (!searchTerm) return true;
                        const term = searchTerm.toLowerCase();
                        return String(r.employee || '').toLowerCase().includes(term) ||
                               String(r.code || '').toLowerCase().includes(term) ||
                               String(r.department || '').toLowerCase().includes(term);
                      });
                      if (filtered.length === 0) return <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500">No payroll records found</td></tr>;
                      return filtered.map((p, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium">{String(p.employee)}</td>
                          <td className="px-3 py-2 text-slate-600">{String(p.department)}</td>
                          <td className="px-3 py-2 text-center">{new Date(0, Number(p.month) - 1).toLocaleString('en', { month: 'short' })} {String(p.year)}</td>
                          <td className="px-3 py-2 text-center">{Number(p.presentDays)}/{Number(p.workingDays)}</td>
                          <td className="px-3 py-2 text-right">{formatPKR(Number(p.grossSalary))}</td>
                          <td className="px-3 py-2 text-right text-amber-600">{formatPKR(Number(p.tds))}</td>
                          <td className="px-3 py-2 text-right text-indigo-600">{formatPKR(Number(p.pf))}</td>
                          <td className="px-3 py-2 text-right text-orange-600">{formatPKR(Number(p.lateDeduction))}</td>
                          <td className="px-3 py-2 text-right text-red-600">{formatPKR(Number(p.absentDeduction))}</td>
                          <td className="px-3 py-2 text-right text-red-700 font-bold">{formatPKR(Number(p.totalDeductions))}</td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-bold">{formatPKR(Number(p.netSalary))}</td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={p.status === 'PAID' ? 'success' : 'warning'}>{String(p.status)}</Badge>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════ EMPLOYEES REPORT ═══════════ */}
      {!loading && data && reportType === 'employees' && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total Employees', value: String(summary?.total ?? 0), bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
              { label: 'Monthly Salary Bill', value: formatPKR(Number(summary?.totalSalaryBill ?? 0)), bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
              { label: 'Avg Salary', value: formatPKR(Number(summary?.avgSalary ?? 0)), bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
              { label: 'New Joinees (30d)', value: String(summary?.recentJoinees ?? 0), bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
              { label: 'Departments', value: String(((data as Record<string, unknown>)?.byDepartment as Array<unknown>)?.length ?? 0), bg: 'bg-slate-50 border-slate-200', text: 'text-slate-900' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} border rounded-2xl p-4 text-center`}>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
                <p className={`text-lg font-bold mt-1 ${s.text}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {viewMode === 'summary' && (
            <>
              {/* Employment Types */}
              {summary?.byEmploymentType && (
                <Card className="border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">By Employment Type</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Object.entries(summary.byEmploymentType as Record<string, number>).filter(([, v]) => v > 0).map(([type, count], i) => (
                      <div key={i} className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-purple-700">{count}</p>
                        <p className="text-xs text-purple-600 font-medium mt-1">{type.replace(/_/g, ' ')}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Department Distribution */}
              {((data as Record<string, unknown>)?.byDepartment as Array<Record<string, unknown>>)?.length > 0 && (
                <Card className="border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Department Distribution</h3>
                  <div className="space-y-3">
                    {((data as Record<string, unknown>).byDepartment as Array<Record<string, unknown>>).sort((a, b) => Number(b.count) - Number(a.count)).map((d, i) => {
                      const maxCount = Math.max(...((data as Record<string, unknown>).byDepartment as Array<Record<string, unknown>>).map(x => Number(x.count)));
                      const pct = maxCount > 0 ? (Number(d.count) / maxCount) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-sm text-slate-600 w-32 truncate">{String(d.name)}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                            <div className="bg-gradient-to-r from-purple-400 to-pink-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-sm font-bold text-slate-700 w-16 text-right">{Number(d.count)} emp</span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Recent Joinees */}
              {((data as Record<string, unknown>)?.recentJoinees as Array<Record<string, unknown>>)?.length > 0 && (
                <Card className="border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Recent Joinees (Last 30 Days)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Code</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Name</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Department</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Designation</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Joined</th>
                      </tr></thead>
                      <tbody>
                        {((data as Record<string, unknown>).recentJoinees as Array<Record<string, unknown>>).map((e, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{String(e.code)}</td>
                            <td className="px-4 py-2.5 font-medium">{String(e.name)}</td>
                            <td className="px-4 py-2.5 text-slate-600">{String(e.department)}</td>
                            <td className="px-4 py-2.5">{String(e.designation)}</td>
                            <td className="px-4 py-2.5 text-slate-500">{fmtDate(String(e.joiningDate))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Detailed Employee Directory */}
          {viewMode === 'details' && (
            <Card className="border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900">Employee Directory ({filteredDetails.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Code</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Name</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Email</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Phone</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Department</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Designation</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Type</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Joined</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600">Gross Salary</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600">Net Salary</th>
                  </tr></thead>
                  <tbody>
                    {filteredDetails.length === 0 ? (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">No employees found</td></tr>
                    ) : filteredDetails.map((e, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500 font-mono">{String(e.code)}</td>
                        <td className="px-3 py-2 font-medium">{String(e.name)}</td>
                        <td className="px-3 py-2 text-slate-600">{String(e.email)}</td>
                        <td className="px-3 py-2 text-slate-600">{String(e.phone)}</td>
                        <td className="px-3 py-2">{String(e.department)}</td>
                        <td className="px-3 py-2">{String(e.designation)}</td>
                        <td className="px-3 py-2"><Badge>{String(e.employmentType).replace(/_/g, ' ')}</Badge></td>
                        <td className="px-3 py-2 text-slate-500">{fmtDate(String(e.joiningDate))}</td>
                        <td className="px-3 py-2 text-right">{formatPKR(Number(e.grossSalary))}</td>
                        <td className="px-3 py-2 text-right text-emerald-700 font-bold">{formatPKR(Number(e.netSalary))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && !data && (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center">
          <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
          <h3 className="text-lg font-bold text-slate-700">No Report Data</h3>
          <p className="text-sm text-slate-500 mt-1">Select a date range and report type to generate analytics.</p>
        </div>
      )}
    </div>
  );
}
