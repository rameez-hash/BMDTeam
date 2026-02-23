'use client';

import { useState, useMemo } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
  workHours?: number;
  isLate?: boolean;
  lateMinutes?: number;
  workLocation?: string;
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  shiftStandardWorkHours?: number;
  checkoutMissing?: boolean;
  breaks?: { id: string; startTime: string; endTime?: string; duration?: number; reason?: string }[];
  employee?: {
    id?: string;
    firstName: string;
    lastName: string;
    employeeCode?: string;
    department?: { name: string };
    shift?: { name: string; startTime: string; endTime: string };
  };
}

interface AllEmployeesTableProps {
  records: AttendanceRecord[];
  onEdit?: (record: AttendanceRecord) => void;
  onDelete?: (record: AttendanceRecord) => void;
  canEdit?: boolean;
  deleteLoadingId?: string | null;
  formatTimeStr: (dateString?: string) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

export default function AllEmployeesTable({
  records,
  onEdit,
  onDelete,
  canEdit = false,
  deleteLoadingId,
  formatTimeStr,
  getStatusBadge,
}: AllEmployeesTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'date' | 'employee'>('date');

  const formatWorkHours = (hours?: number) => {
    if (!hours || hours === 0) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const fmtShiftTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const formatMinutes = (minutes: number) => {
    if (minutes === 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  // Filter only actual records (not synthetic weekends/absents/upcoming/notjoined)
  const actualRecords = useMemo(() => {
    return records.filter(r => 
      !r.id.startsWith('weekend-') && 
      !r.id.startsWith('absent-') && 
      !r.id.startsWith('future-') && 
      !r.id.startsWith('holiday-') && 
      !r.id.startsWith('notjoined-') &&
      r.status !== 'UPCOMING'
    );
  }, [records]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, AttendanceRecord[]>();
    actualRecords.forEach(record => {
      const d = new Date(record.date);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(record);
    });
    // Sort dates descending
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [actualRecords]);

  // Group by employee
  const groupedByEmployee = useMemo(() => {
    const groups = new Map<string, { name: string; dept: string; records: AttendanceRecord[] }>();
    actualRecords.forEach(record => {
      const empId = record.employee?.id || 'unknown';
      const empName = record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : 'Unknown';
      const dept = record.employee?.department?.name || '';
      if (!groups.has(empId)) groups.set(empId, { name: empName, dept, records: [] });
      groups.get(empId)!.records.push(record);
    });
    // Sort each employee's records by date desc
    groups.forEach(g => g.records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    return Array.from(groups.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [actualRecords]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'HALF_DAY': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'ABSENT': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'ON_LEAVE': return 'bg-violet-100 text-violet-700 border-violet-200';
      case 'WEEKEND': return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'HOLIDAY': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getOvertimeInfo = (record: AttendanceRecord) => {
    if (!record.workHours || !record.shiftStandardWorkHours) return null;
    const diff = record.workHours - record.shiftStandardWorkHours;
    if (diff > 0.016) {
      const m = Math.round(diff * 60);
      const h = Math.floor(m / 60);
      const mins = m % 60;
      return { label: `+${h > 0 ? h + 'h ' : ''}${mins}m OT`, isOT: true };
    }
    if (diff < -0.016) {
      const m = Math.round(Math.abs(diff) * 60);
      const h = Math.floor(m / 60);
      const mins = m % 60;
      return { label: `-${h > 0 ? h + 'h ' : ''}${mins}m`, isOT: false };
    }
    return { label: 'Full', isOT: false };
  };

  const renderRecordRow = (record: AttendanceRecord, showEmployee: boolean, showDate: boolean) => {
    const isExpanded = expandedRow === record.id;
    const isPlaceholder = record.id.startsWith('weekend-') || record.id.startsWith('absent-') || record.id.startsWith('holiday-') || record.id.startsWith('notjoined-');
    const canModify = canEdit && !isPlaceholder;
    const otInfo = getOvertimeInfo(record);
    const date = new Date(record.date);

    return (
      <div key={record.id} className="border-b border-slate-100 last:border-b-0">
        <div
          className={`grid ${showEmployee && showDate ? 'grid-cols-[1fr_1fr_100px_100px_80px_70px_70px_90px_36px]' : showEmployee ? 'grid-cols-[1fr_100px_100px_80px_70px_70px_90px_36px]' : 'grid-cols-[80px_100px_100px_80px_70px_70px_90px_36px]'} gap-2 items-center px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors text-sm ${isExpanded ? 'bg-slate-50' : ''}`}
          onClick={() => setExpandedRow(isExpanded ? null : record.id)}
        >
          {/* Date (when grouped by employee) */}
          {showDate && !showEmployee && (
            <div className="text-center">
              <span className="text-sm font-medium text-slate-700">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
            </div>
          )}

          {/* Employee */}
          {showEmployee && (
            <div className="min-w-0">
              <div className="font-semibold text-slate-800 truncate text-sm">
                {record.employee?.firstName} {record.employee?.lastName}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {record.employee?.department?.name || ''}
                {record.employee?.employeeCode ? ` · ${record.employee.employeeCode}` : ''}
              </div>
            </div>
          )}

          {/* Date (when grouped by date, small column) */}
          {showDate && showEmployee && (
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-700">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              <div className="text-[10px] text-slate-400">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            </div>
          )}

          {/* Check In */}
          <div className="text-center">
            <div className="text-sm text-slate-700">{formatTimeStr(record.checkIn)}</div>
            {record.isLate && (
              <div className="text-[10px] text-rose-500 font-medium">{record.lateMinutes ? `${formatMinutes(record.lateMinutes)} late` : 'Late'}</div>
            )}
          </div>

          {/* Check Out */}
          <div className="text-center text-sm text-slate-700">{formatTimeStr(record.checkOut)}</div>

          {/* Hours */}
          <div className="text-center">
            <span className={`text-sm font-semibold ${record.workHours && record.shiftStandardWorkHours && record.workHours >= record.shiftStandardWorkHours ? 'text-emerald-600' : 'text-slate-700'}`}>
              {formatWorkHours(record.workHours)}
            </span>
          </div>

          {/* Extra/OT */}
          <div className="text-center">
            {otInfo ? (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${otInfo.isOT ? 'bg-cyan-50 text-cyan-700' : otInfo.label === 'Full' ? 'text-slate-400' : 'bg-rose-50 text-rose-600'}`}>
                {otInfo.label}
              </span>
            ) : <span className="text-slate-300">-</span>}
          </div>

          {/* Location */}
          <div className="text-center">
            {record.workLocation ? (
              <span className="text-[10px] font-medium text-slate-500">
                {record.workLocation === 'REMOTE' ? '🏠' : record.workLocation === 'HYBRID' ? '🔄' : '🏢'}
              </span>
            ) : <span className="text-slate-300">-</span>}
          </div>

          {/* Status */}
          <div className="text-center">
            {record.checkoutMissing ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-100 text-red-700 border-red-300">
                ⚠ CO Missing
              </span>
            ) : (
              <>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusColor(record.status)}`}>
                  {record.status === 'PRESENT' ? 'Present' : record.status === 'HALF_DAY' ? 'Half Day' : record.status === 'ABSENT' ? 'Absent' : record.status === 'ON_LEAVE' ? 'Leave' : record.status.replace('_', ' ')}
                </span>
                {record.isLate && (record.status === 'PRESENT' || record.status === 'HALF_DAY') && (
                  <span className="ml-1 text-[9px] text-rose-500 font-bold">⚠</span>
                )}
              </>
            )}
          </div>

          {/* Expand */}
          <div className="text-center">
            <svg className={`w-3.5 h-3.5 mx-auto text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              {record.employee && (
                <div>
                  <div className="text-[10px] uppercase text-slate-400 font-semibold">Employee</div>
                  <div className="font-semibold text-slate-800">{record.employee.firstName} {record.employee.lastName}</div>
                  {record.employee.department && <div className="text-xs text-slate-500">{record.employee.department.name}</div>}
                </div>
              )}
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Shift</div>
                <div className="font-medium text-slate-700">
                  {record.shiftName || record.employee?.shift?.name || 'General'}
                </div>
                <div className="text-xs text-slate-500">
                  {fmtShiftTime(record.shiftStartTime || record.employee?.shift?.startTime || '09:00')} — {fmtShiftTime(record.shiftEndTime || record.employee?.shift?.endTime || '18:00')}
                  {record.shiftStandardWorkHours && ` · ${formatWorkHours(record.shiftStandardWorkHours)}/day`}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Work Hours</div>
                <div className="font-semibold text-slate-800">{formatWorkHours(record.workHours)}</div>
                {otInfo?.isOT && <div className="text-xs text-cyan-600">{otInfo.label}</div>}
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Location</div>
                <div className="text-slate-700">
                  {record.workLocation === 'REMOTE' ? '🏠 Remote' : record.workLocation === 'HYBRID' ? '🔄 Hybrid' : '🏢 Office'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Breaks</div>
                <div className="text-slate-700">
                  {record.breaks && record.breaks.length > 0
                    ? `${record.breaks.length} break${record.breaks.length > 1 ? 's' : ''}`
                    : 'No breaks'}
                </div>
              </div>
            </div>
            {canModify && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
                <Button variant="secondary" className="text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-xs px-3 py-1" onClick={(e) => { e.stopPropagation(); onEdit?.(record); }}>
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Edit
                </Button>
                <Button variant="secondary" className="text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs px-3 py-1" loading={deleteLoadingId === record.id} onClick={(e) => { e.stopPropagation(); onDelete?.(record); }}>
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" /></svg>
                  Delete
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (actualRecords.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="font-medium">No attendance records found</p>
        <p className="text-sm text-slate-400 mt-1">Try changing the date range or filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{actualRecords.length}</span> attendance records
        </div>
        <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
          <button
            onClick={() => setViewMode('date')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === 'date' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
          >
            By Date
          </button>
          <button
            onClick={() => setViewMode('employee')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${viewMode === 'employee' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
          >
            By Employee
          </button>
        </div>
      </div>

      {viewMode === 'date' ? (
        /* === GROUP BY DATE === */
        <div className="space-y-2">
          {groupedByDate.map(([dateKey, dateRecords]) => {
            const date = new Date(dateKey + 'T00:00:00');
            const presentCount = dateRecords.filter(r => r.status === 'PRESENT' || r.status === 'HALF_DAY').length;
            const lateCount = dateRecords.filter(r => r.isLate).length;
            const absentCount = dateRecords.filter(r => r.status === 'ABSENT').length;
            const onLeaveCount = dateRecords.filter(r => r.status === 'ON_LEAVE').length;

            return (
              <div key={dateKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Date header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex flex-col items-center justify-center">
                      <span className="text-sm font-bold text-emerald-700 leading-none">{date.getDate()}</span>
                      <span className="text-[8px] font-semibold text-emerald-600 uppercase">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] mt-0.5">
                        {presentCount > 0 && <span className="text-emerald-600 font-medium">● {presentCount} Present</span>}
                        {lateCount > 0 && <span className="text-amber-600 font-medium">● {lateCount} Late</span>}
                        {absentCount > 0 && <span className="text-rose-600 font-medium">● {absentCount} Absent</span>}
                        {onLeaveCount > 0 && <span className="text-violet-600 font-medium">● {onLeaveCount} Leave</span>}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-400">{dateRecords.length} employee{dateRecords.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[1fr_100px_100px_80px_70px_70px_90px_36px] gap-2 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-semibold uppercase tracking-wider">
                  <div>Employee</div>
                  <div className="text-center">In</div>
                  <div className="text-center">Out</div>
                  <div className="text-center">Hours</div>
                  <div className="text-center">Extra</div>
                  <div className="text-center">Loc</div>
                  <div className="text-center">Status</div>
                  <div></div>
                </div>

                {/* Rows */}
                {dateRecords
                  .sort((a, b) => (a.employee?.firstName || '').localeCompare(b.employee?.firstName || ''))
                  .map(record => renderRecordRow(record, true, false))}
              </div>
            );
          })}
        </div>
      ) : (
        /* === GROUP BY EMPLOYEE === */
        <div className="space-y-2">
          {groupedByEmployee.map(([empId, group]) => {
            const presentCount = group.records.filter(r => r.status === 'PRESENT' || r.status === 'HALF_DAY').length;
            const lateCount = group.records.filter(r => r.isLate).length;
            const totalHours = group.records.reduce((sum, r) => sum + (r.workHours || 0), 0);

            return (
              <div key={empId} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Employee header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-teal-700">{group.name.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{group.name}</div>
                      <div className="flex items-center gap-2 text-[10px] mt-0.5">
                        {group.dept && <span className="text-slate-500">{group.dept}</span>}
                        <span className="text-emerald-600 font-medium">{presentCount} days</span>
                        {lateCount > 0 && <span className="text-amber-600 font-medium">· {lateCount} late</span>}
                        <span className="text-slate-500">· {formatWorkHours(totalHours)} total</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-400">{group.records.length} record{group.records.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Table header */}
                <div className="grid grid-cols-[80px_100px_100px_80px_70px_70px_90px_36px] gap-2 px-3 py-1.5 bg-slate-800 text-white text-[10px] font-semibold uppercase tracking-wider">
                  <div>Date</div>
                  <div className="text-center">In</div>
                  <div className="text-center">Out</div>
                  <div className="text-center">Hours</div>
                  <div className="text-center">Extra</div>
                  <div className="text-center">Loc</div>
                  <div className="text-center">Status</div>
                  <div></div>
                </div>

                {/* Rows */}
                {group.records.map(record => renderRecordRow(record, false, true))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
