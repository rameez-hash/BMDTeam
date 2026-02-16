'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useToast } from '@/app/hooks/useToast';
import AccessDenied from '@/app/components/AccessDenied';
import { Button, Badge, Input, Select } from '@/app/components/ui';

interface ActivityLog {
  id: string;
  action: string;
  module: string;
  resourceId?: string;
  description: string;
  user: string;
  ipAddress?: string;
  createdAt: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'AUTH', label: 'Authentication' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'ATTENDANCE', label: 'Attendance' },
  { value: 'LEAVE', label: 'Leave' },
  { value: 'PAYROLL', label: 'Payroll' },
  { value: 'SALARY', label: 'Salary' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'SHIFT', label: 'Shift' },
  { value: 'TAX_SLAB', label: 'Tax Slab' },
  { value: 'LATE_RULE', label: 'Late Rule' },
  { value: 'ANNOUNCEMENT', label: 'Announcement' },
];

const MODULE_COLORS: Record<string, string> = {
  AUTH: 'bg-purple-100 text-purple-700',
  EMPLOYEE: 'bg-blue-100 text-blue-700',
  ATTENDANCE: 'bg-teal-100 text-teal-700',
  LEAVE: 'bg-amber-100 text-amber-700',
  PAYROLL: 'bg-emerald-100 text-emerald-700',
  SALARY: 'bg-green-100 text-green-700',
  DEPARTMENT: 'bg-indigo-100 text-indigo-700',
  SHIFT: 'bg-cyan-100 text-cyan-700',
  TAX_SLAB: 'bg-rose-100 text-rose-700',
  LATE_RULE: 'bg-orange-100 text-orange-700',
  ANNOUNCEMENT: 'bg-pink-100 text-pink-700',
};

const ACTION_ICONS: Record<string, string> = {
  LOGIN: '🔑',
  LOGOUT: '🚪',
  PASSWORD_CHANGE: '🔒',
  EMPLOYEE_CREATE: '👤+',
  EMPLOYEE_UPDATE: '👤✏',
  EMPLOYEE_DELETE: '👤✕',
  CHECK_IN: '📥',
  CHECK_OUT: '📤',
  BREAK_START: '☕',
  BREAK_END: '💼',
  LEAVE_REQUEST: '📋',
  LEAVE_APPROVE: '✅',
  LEAVE_REJECT: '❌',
  LEAVE_CANCEL: '🚫',
  SALARY_ASSIGN: '💰',
  SALARY_UPDATE: '💰✏',
  PAYROLL_GENERATE: '📊',
  PAYROLL_PROCESS: '⚙️',
  PAYROLL_UPDATE: '📊✏',
  PAYROLL_DELETE: '📊✕',
  DEPARTMENT_CREATE: '🏢+',
  DEPARTMENT_UPDATE: '🏢✏',
  DEPARTMENT_DELETE: '🏢✕',
  SHIFT_CREATE: '🕐+',
  SHIFT_UPDATE: '🕐✏',
  SHIFT_DELETE: '🕐✕',
  ANNOUNCEMENT_CREATE: '📢+',
  ANNOUNCEMENT_UPDATE: '📢✏',
  ANNOUNCEMENT_DELETE: '📢✕',
  ATTENDANCE_CORRECTION_REQUEST: '📝',
  ATTENDANCE_CORRECTION_APPROVE: '✅',
  ATTENDANCE_CORRECTION_REJECT: '❌',
};

export default function ActivityPage() {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <AccessDenied module="Activity Logs" />;
  return <ActivityPageContent />;
}

function ActivityPageContent() {
  const { token } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [moduleFilter, setModuleFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '30' });
      if (moduleFilter) params.set('module', moduleFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/activity-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch {
      toastRef.current.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [token, page, moduleFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatFullDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  const formatActionLabel = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const clearFilters = () => {
    setModuleFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasFilters = moduleFilter || startDate || endDate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Activity Logs</h1>
              <p className="text-teal-100 text-sm mt-0.5">
                {total.toLocaleString()} total activit{total !== 1 ? 'ies' : 'y'} recorded
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={fetchLogs}
            className="!bg-white/20 !text-white hover:!bg-white/30 border-0"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Select
              label="Module"
              value={moduleFilter}
              onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
              options={MODULE_OPTIONS}
            />
          </div>
          <div className="w-44">
            <Input
              label="From Date"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            />
          </div>
          <div className="w-44">
            <Input
              label="To Date"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            />
          </div>
          {hasFilters && (
            <Button variant="secondary" size="sm" onClick={clearFilters} className="mb-0.5">
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg font-medium">No activity logs found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div
                key={log.id}
                className="hover:bg-slate-50/50 transition-colors"
              >
                <div
                  className="flex items-start gap-3 px-5 py-3.5 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                    {ACTION_ICONS[log.action] || '📋'}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-slate-800">{log.user}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${MODULE_COLORS[log.module] || 'bg-slate-100 text-slate-600'}`}>
                        {log.module.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5 line-clamp-1">{log.description}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {formatActionLabel(log.action)}
                      </span>
                      {log.ipAddress && log.ipAddress !== 'unknown' && (
                        <span className="text-[11px] text-slate-400">
                          IP: {log.ipAddress.split(',')[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="flex-shrink-0 text-right">
                    <span className="text-xs text-slate-500 font-medium">{formatDateTime(log.createdAt)}</span>
                    <div className="flex items-center justify-end mt-1">
                      <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedLog === log.id && (
                  <div className="px-5 pb-4 ml-12 space-y-3">
                    <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5">
                      <div className="flex gap-2">
                        <span className="text-slate-400 w-20">Time:</span>
                        <span className="text-slate-700 font-medium">{formatFullDateTime(log.createdAt)}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-400 w-20">Action:</span>
                        <span className="text-slate-700">{formatActionLabel(log.action)}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-400 w-20">Module:</span>
                        <span className="text-slate-700">{log.module.replace(/_/g, ' ')}</span>
                      </div>
                      {log.resourceId && (
                        <div className="flex gap-2">
                          <span className="text-slate-400 w-20">Resource:</span>
                          <span className="text-slate-700 font-mono text-[11px]">{log.resourceId}</span>
                        </div>
                      )}
                      {log.ipAddress && log.ipAddress !== 'unknown' && (
                        <div className="flex gap-2">
                          <span className="text-slate-400 w-20">IP Address:</span>
                          <span className="text-slate-700">{log.ipAddress}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="text-slate-400 w-20">By:</span>
                        <span className="text-slate-700">{log.user}</span>
                      </div>
                    </div>

                    {/* Old/New Data Diff */}
                    {(log.oldData || log.newData) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {log.oldData && (
                          <div>
                            <p className="text-[11px] font-medium text-red-500 mb-1">Previous Data</p>
                            <pre className="bg-red-50 rounded-lg p-2.5 text-[11px] text-red-800 overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                              {JSON.stringify(log.oldData, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.newData && (
                          <div>
                            <p className="text-[11px] font-medium text-emerald-500 mb-1">New Data</p>
                            <pre className="bg-emerald-50 rounded-lg p-2.5 text-[11px] text-emerald-800 overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                              {JSON.stringify(log.newData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} ({total.toLocaleString()} total)
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                First
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
