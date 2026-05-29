'use client';

import { useState, useMemo } from 'react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

interface AttendanceBreak {
  id: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  reason?: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
  workHours?: number;
  isLate?: boolean;
  lateMinutes?: number;
  overtime?: number;
  workLocation?: string;
  modifiedById?: string;
  modifiedAt?: string;
  modifyReason?: string;
  // Shift snapshot from check-in time (for historical accuracy)
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  shiftGraceTime?: number;
  shiftStandardWorkHours?: number;
  shiftBreakDuration?: number;
  shiftWorkDays?: number[];
  checkoutMissing?: boolean;
  breaks?: AttendanceBreak[];
  employee?: {
    id?: string;
    firstName: string;
    lastName: string;
    employeeCode?: string;
    department?: { name: string };
    shift?: { name: string; startTime: string; endTime: string };
  };
}

interface AttendanceCalendarProps {
  records: AttendanceRecord[];
  startDate: string;
  endDate: string;
  onEdit?: (record: AttendanceRecord) => void;
  onDelete?: (record: AttendanceRecord) => void;
  onAddAttendance?: (date: string, employeeId?: string) => void;
  canEdit?: boolean;
  deleteLoadingId?: string | null;
  selectedEmployeeId?: string;
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  standardWorkHours?: number;
  graceTime?: number;
  earlyCheckInGrace?: number;
  checkOutGrace?: number;
  breakDuration?: number;
  workDays?: number[];
  employeeJoiningDate?: string | null;
}

export default function AttendanceCalendar({
  records,
  startDate,
  endDate,
  onEdit,
  onDelete,
  onAddAttendance,
  canEdit = false,
  deleteLoadingId,
  selectedEmployeeId,
  shiftName = 'General',
  shiftStartTime = '09:00',
  shiftEndTime = '18:00',
  standardWorkHours = 9,
  graceTime = 15,
  earlyCheckInGrace = 30,
  checkOutGrace = 15,
  breakDuration = 60,
  workDays = [1, 2, 3, 4, 5],
  employeeJoiningDate,
}: AttendanceCalendarProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Format shift time to 12h AM/PM
  const fmtShiftTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // Generate all dates in the range (full month including future)
  const allDates = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

  // Create a map of existing records by date
  const recordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records.forEach(record => {
      const d = new Date(record.date);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map.set(dateKey, record);
    });
    return map;
  }, [records]);

  // Generate full calendar with all dates
  const calendarRecords = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return allDates.map(date => {
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const existingRecord = recordsByDate.get(dateKey);
      const dayOfWeek = date.getDay();
      const isWeekendDay = !workDays.includes(dayOfWeek);
      const isFuture = dateKey > todayKey;

      if (existingRecord) return existingRecord;

      if (isWeekendDay) {
        return { id: `weekend-${dateKey}`, date: date.toISOString(), status: 'WEEKEND', workHours: 0, isLate: false, breaks: [] } as AttendanceRecord;
      }
      if (isFuture) {
        return { id: `future-${dateKey}`, date: date.toISOString(), status: 'UPCOMING', workHours: 0, isLate: false, breaks: [] } as AttendanceRecord;
      }
      // Before joining date → NOT_JOINED instead of ABSENT
      if (employeeJoiningDate) {
        const joinDate = new Date(employeeJoiningDate);
        const joinKey = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}-${String(joinDate.getDate()).padStart(2, '0')}`;
        if (dateKey < joinKey) {
          return { id: `notjoined-${dateKey}`, date: date.toISOString(), status: 'NOT_JOINED', workHours: 0, isLate: false, breaks: [] } as AttendanceRecord;
        }
      }
      return { id: `absent-${dateKey}`, date: date.toISOString(), status: 'ABSENT', workHours: 0, isLate: false, breaks: [] } as AttendanceRecord;
    });
  }, [allDates, recordsByDate, employeeJoiningDate]);

  const formatTimeStr = (dateString?: string) => {
    if (!dateString) return '--:--:--';
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Karachi' });
  };

  const formatWorkHours = (hours?: number) => {
    if (!hours || hours === 0) return '0h 0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const getTotalBreakMinutes = (breaks?: AttendanceBreak[]) => {
    if (!breaks || breaks.length === 0) return 0;
    return breaks.reduce((total, b) => {
      if (b.duration) return total + b.duration;
      if (b.endTime) {
        const start = new Date(b.startTime);
        const end = new Date(b.endTime);
        return total + Math.round((end.getTime() - start.getTime()) / 60000);
      }
      return total;
    }, 0);
  };

  const formatMinutes = (minutes: number) => {
    if (minutes === 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const fmtExtraHrMin = (decimalHours: number) => {
    const sign = decimalHours >= 0 ? '+' : '-';
    const abs = Math.abs(decimalHours);
    const h = Math.floor(abs);
    const m = Math.round((abs - h) * 60);
    if (h > 0 && m > 0) return `${sign}${h}h ${m}m`;
    if (h > 0) return `${sign}${h}h`;
    return `${sign}${m}m`;
  };

  const getExtraHours = (workHours?: number, empStdHours?: number) => {
    const std = empStdHours || standardWorkHours;
    if (!workHours) return { value: 0, label: '', isExtra: false };
    const diff = workHours - std;
    if (diff > 0.016) return { value: diff, label: `${fmtExtraHrMin(diff)} OT`, isExtra: true };
    if (diff < -0.016 && workHours > 0) return { value: diff, label: fmtExtraHrMin(diff), isExtra: false };
    return { value: 0, label: 'Full', isExtra: false };
  };

  const getCheckInStatus = (record: AttendanceRecord) => {
    if (!record.checkIn) return null;
    
    // ALWAYS trust backend DB isLate field — calculated correctly at check-in time
    if (record.isLate) {
      const mins = record.lateMinutes || 0;
      return { type: 'late', label: mins > 0 ? `${formatMinutes(mins)} late` : 'Late', color: 'text-rose-500', icon: '🔴' };
    }
    
    // Check for early check-in using shift snapshot
    const recShiftStart = record.shiftStartTime || shiftStartTime;
    const recShiftEnd = record.shiftEndTime || shiftEndTime;
    const recGrace = record.shiftGraceTime ?? graceTime;
    if (recShiftStart && record.checkIn) {
      const [sh, sm] = recShiftStart.split(':').map(Number);
      const [eh, em] = recShiftEnd.split(':').map(Number);
      const checkInDate = new Date(record.checkIn);
      const nightShift = sh > eh || (sh === eh && (sm || 0) > (em || 0));

      // Build shift start datetime anchored to the attendance record date
      const recordDate = new Date(record.date);
      const shiftStart = new Date(recordDate);
      shiftStart.setHours(sh, sm || 0, 0, 0);

      // For night shifts: if check-in is after midnight (before shift end hour),
      // that means they're near the END of their shift, not the start.
      // The shift actually started the previous calendar day.
      if (nightShift) {
        const checkInHour = checkInDate.getHours();
        // If check-in hour is in the "morning" range (before shift end),
        // they checked in near shift END — this is NOT early for start
        if (checkInHour < eh + 2 && checkInHour < sh) {
          // This check-in is near the end of the shift — trust backend isLate=false → On Time
          return { type: 'ontime', label: 'On Time', color: 'text-slate-500', icon: '⚪' };
        }
      }

      const diffMs = shiftStart.getTime() - checkInDate.getTime();
      const earlyMins = Math.round(diffMs / 60000);

      // Grace period: within grace after shift start = On Time
      if (earlyMins < 0 && Math.abs(earlyMins) <= recGrace) {
        return { type: 'ontime', label: 'On Time', color: 'text-slate-500', icon: '⚪' };
      }

      if (earlyMins > 0 && earlyMins <= 720) {
        return { type: 'early', label: `${formatMinutes(earlyMins)} early`, color: 'text-blue-500', icon: '🔵' };
      }
    }
    
    return { type: 'ontime', label: 'On Time', color: 'text-slate-500', icon: '⚪' };
  };

  const getCheckOutStatus = (record: AttendanceRecord) => {
    if (!record.checkOut || !record.checkIn) return null;
    const std = record.shiftStandardWorkHours ?? standardWorkHours;
    const recCheckOutGrace = record.shiftGraceTime ?? checkOutGrace;
    const actualHours = record.workHours || 0;
    const diffHours = actualHours - std;
    const diffMinutes = Math.round(diffHours * 60);
    if (diffMinutes < -recCheckOutGrace) {
      return { type: 'early', label: `${formatMinutes(Math.abs(diffMinutes))} early`, color: 'text-amber-500' };
    } else if (diffMinutes > recCheckOutGrace) {
      return { type: 'overtime', label: `+${formatMinutes(diffMinutes)} OT`, color: 'text-cyan-600' };
    }
    return { type: 'complete', label: 'Full Day', color: 'text-slate-500' };
  };

  type StatusInfoType = { label: string; color: string; bg: string; border: string; dot: string; ring: string };
  const getStatusInfo = (status: string, workLocation?: string): StatusInfoType => {
    const map: Record<string, StatusInfoType> = {
      PRESENT: { label: 'Present', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-100' },
      ABSENT: { label: 'Absent', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500', ring: 'ring-rose-100' },
      HALF_DAY: { label: 'Half Day', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', ring: 'ring-amber-100' },
      ON_LEAVE: { label: 'Leave', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', dot: 'bg-violet-500', ring: 'ring-violet-100' },
      WEEKEND: { label: 'Weekend', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-400', ring: 'ring-orange-100' },
      HOLIDAY: { label: 'Holiday', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500', ring: 'ring-blue-100' },
      UPCOMING: { label: 'Upcoming', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', dot: 'bg-slate-400', ring: 'ring-slate-100' },
      NOT_JOINED: { label: 'Not Joined', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400', ring: 'ring-gray-100' },
    };
    return map[status] || map.PRESENT;
  };

  const calculateProgress = (record: AttendanceRecord) => {
    if (record.status === 'WEEKEND' || record.status === 'HOLIDAY' || record.status === 'ON_LEAVE' || record.status === 'UPCOMING' || record.status === 'NOT_JOINED') return 100;
    if (record.status === 'ABSENT' || !record.workHours) return 0;
    const std = record.shiftStandardWorkHours ?? standardWorkHours;
    return Math.min(Math.round((record.workHours / std) * 100), 120);
  };

  // Stats summary — trust DB isLate field only, never recalculate
  const stats = useMemo(() => {
    const present = calendarRecords.filter(r => r.status === 'PRESENT').length;
    const halfDay = calendarRecords.filter(r => r.status === 'HALF_DAY').length;
    const absent = calendarRecords.filter(r => r.status === 'ABSENT').length;
    const late = calendarRecords.filter(r => r.isLate).length;
    // Count early check-ins (checked in before shift start by more than 1 minute)
    const early = calendarRecords.filter(r => {
      if (!r.checkIn || r.isLate) return false;
      const recShiftStart = r.shiftStartTime || shiftStartTime;
      const [sh, sm] = recShiftStart.split(':').map(Number);
      const cDate = new Date(r.checkIn);
      const cMins = cDate.getHours() * 60 + cDate.getMinutes();
      const sMins = sh * 60 + (sm || 0);
      let diff = sMins - cMins;
      if (diff < 0) diff += 24 * 60;
      if (diff > 720) diff = 0;
      return diff > 1;
    }).length;
    const totalHours = calendarRecords.reduce((s, r) => s + (r.workHours || 0), 0);
    const extraHrs = calendarRecords.reduce((s, r) => {
      const recStd = r.shiftStandardWorkHours ?? standardWorkHours;
      if (r.workHours && r.workHours > recStd) return s + (r.workHours - recStd);
      return s;
    }, 0);
    return { present, halfDay, absent, late, early, totalHours, extraHrs };
  }, [calendarRecords, standardWorkHours]);

  // Sort by date descending (newest first)
  const sortedRecords = [...calendarRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4">
      {/* Shift Timing Banner */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-xl border border-emerald-200 px-4 py-3">
        <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-xl border border-emerald-200">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-emerald-800">{shiftName}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/70 rounded-full border border-emerald-200 text-xs font-semibold text-emerald-700">
              ● {fmtShiftTime(shiftStartTime)} — {fmtShiftTime(shiftEndTime)}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-[11px] text-emerald-600/80 font-medium">{formatWorkHours(standardWorkHours)}/day</span>
            <span className="text-[11px] text-emerald-600/80 font-medium">{breakDuration}m break</span>
            <span className="text-[11px] text-emerald-600/80 font-medium">{graceTime}m grace</span>
            <span className="text-[11px] text-emerald-600/80 font-medium">{earlyCheckInGrace}m early-in</span>
            <span className="text-[11px] text-emerald-600/80 font-medium">{checkOutGrace}m out-grace</span>
          </div>
        </div>
      </div>

      {/* Mini Stats Bar */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3 flex-wrap">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700">{stats.present} Present</span>
        </div>
        {stats.halfDay > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-xs font-semibold text-teal-700">{stats.halfDay} Half Day</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="text-xs font-semibold text-rose-700">{stats.absent} Absent</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs font-semibold text-amber-700">{stats.late} Late</span>
        </div>
        {stats.early > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold text-blue-700">{stats.early} Early</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <div className="text-xs text-slate-500">Total: <span className="font-bold text-slate-700">{formatWorkHours(stats.totalHours)}</span></div>
          {stats.extraHrs > 0 && (
            <div className="text-xs px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded-full font-semibold">{fmtExtraHrMin(stats.extraHrs)} Extra</div>
          )}
        </div>
      </div>

      {/* Table Header */}
      <div className="bg-slate-800 text-white rounded-t-xl px-4 py-2.5 grid grid-cols-[60px_1fr_3fr_1fr_1fr_1fr_80px_100px_40px] gap-2 text-xs font-semibold uppercase tracking-wider">
        <div className="text-center">Date</div>
        <div className="text-center">In</div>
        <div className="text-center">Progress</div>
        <div className="text-center">Out</div>
        <div className="text-center">Hours</div>
        <div className="text-center">Extra</div>
        <div className="text-center">Location</div>
        <div className="text-center">Status</div>
        <div className="text-center"></div>
      </div>

      {/* Records */}
      <div className="-mt-4 overflow-hidden rounded-b-xl border border-slate-200 divide-y divide-slate-100">
        {sortedRecords.map((record, idx) => {
          const date = new Date(record.date);
          const dayNum = date.getDate();
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
          const statusInfo = getStatusInfo(record.status, record.workLocation);
          const progress = calculateProgress(record);
          const isExpanded = expandedRow === record.id;
          const isSpecial = record.status === 'WEEKEND' || record.status === 'HOLIDAY' || record.status === 'UPCOMING' || record.status === 'NOT_JOINED';
          const isAbsent = record.status === 'ABSENT';
          const isPlaceholder = record.id?.startsWith('weekend-') || record.id?.startsWith('absent-') || record.id?.startsWith('future-') || record.id?.startsWith('holiday-') || record.id?.startsWith('notjoined-');
          const canModify = canEdit && !isPlaceholder;
          const canAddRecord = canEdit && isPlaceholder && !isSpecial;
          // Use shift snapshot from record (historical), then per-employee shift, then global fallback
          const recStdHours = record.shiftStandardWorkHours ?? standardWorkHours;
          const recShiftStart = record.shiftStartTime || record.employee?.shift?.startTime || shiftStartTime;
          const recShiftEnd = record.shiftEndTime || record.employee?.shift?.endTime || shiftEndTime;
          const recShiftName = record.shiftName || shiftName;
          const checkInStatus = getCheckInStatus(record);
          const checkOutStatus = getCheckOutStatus(record);
          const totalBreakMinutes = getTotalBreakMinutes(record.breaks);
          const extraInfo = getExtraHours(record.workHours, recStdHours);

          // Striped row background
          const rowBg = record.status === 'WEEKEND' ? 'bg-orange-50/60' :
                        record.status === 'HOLIDAY' ? 'bg-blue-50/60' :
                        record.status === 'ON_LEAVE' ? 'bg-violet-50/40' :
                        record.status === 'NOT_JOINED' ? 'bg-gray-50/40' :
                        record.status === 'ABSENT' ? 'bg-rose-50/40' :
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';

          return (
            <div key={record.id} className={`${rowBg} transition-all duration-200`}>
              {/* Main Row */}
              <div
                className={`grid grid-cols-[60px_1fr_3fr_1fr_1fr_1fr_80px_100px_40px] gap-2 items-center px-4 py-2.5 cursor-pointer hover:bg-slate-100/50 transition-colors ${isExpanded ? 'bg-slate-100/50' : ''}`}
                onClick={() => setExpandedRow(isExpanded ? null : record.id)}
              >
                {/* Date */}
                <div className="text-center">
                  <div className={`inline-flex flex-col items-center justify-center w-11 h-12 rounded-xl ${
                    record.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' :
                    record.status === 'ABSENT' ? 'bg-rose-100 text-rose-700' :
                    record.status === 'WEEKEND' ? 'bg-orange-100 text-orange-700' :
                    record.status === 'HOLIDAY' ? 'bg-blue-100 text-blue-700' :
                    record.status === 'ON_LEAVE' ? 'bg-violet-100 text-violet-700' :
                    record.status === 'HALF_DAY' ? 'bg-amber-100 text-amber-700' :
                    record.status === 'NOT_JOINED' ? 'bg-gray-100 text-gray-500' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    <span className="text-lg font-bold leading-none">{String(dayNum).padStart(2, '0')}</span>
                    <span className="text-[9px] font-semibold uppercase leading-none mt-0.5">{dayName}</span>
                  </div>
                </div>

                {/* Check In */}
                <div className="text-center">
                  {!isSpecial && !isAbsent ? (
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{formatTimeStr(record.checkIn)}</div>
                      {checkInStatus && (
                        <div className={`text-[10px] font-medium ${checkInStatus.color}`}>{checkInStatus.label}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-sm">--:--</span>
                  )}
                </div>

                {/* Progress Bar — Circular Gauge Style */}
                <div className="flex items-center gap-3 px-2">
                  {/* Circular Progress */}
                  <div className="relative flex-shrink-0">
                    <svg width="42" height="42" viewBox="0 0 42 42" className="transform -rotate-90">
                      <circle cx="21" cy="21" r="17" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                      <circle
                        cx="21" cy="21" r="17" fill="none"
                        strokeWidth="4"
                        strokeLinecap="round"
                        stroke={
                          isSpecial ? '#94a3b8' :
                          isAbsent ? '#f43f5e' :
                          progress >= 100 ? '#10b981' :
                          progress >= 75 ? '#f59e0b' :
                          '#ef4444'
                        }
                        strokeDasharray={`${Math.min(progress, 100) * 1.068} 106.8`}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-[10px] font-bold ${
                        isSpecial ? 'text-slate-400' :
                        isAbsent ? 'text-rose-500' :
                        progress >= 100 ? 'text-emerald-600' :
                        'text-amber-600'
                      }`}>
                        {isSpecial ? '—' : `${Math.min(progress, 100)}%`}
                      </span>
                    </div>
                  </div>

                  {/* Linear Progress + Labels */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-slate-500">
                        {isSpecial ? statusInfo.label : isAbsent ? 'No Activity' : `${formatWorkHours(record.workHours)} / ${recStdHours}h`}
                      </span>
                      {totalBreakMinutes > 0 && (
                        <span className="text-[10px] text-amber-600 font-medium">☕ {formatMinutes(totalBreakMinutes)}</span>
                      )}
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          isSpecial ? 'bg-gradient-to-r from-slate-300 to-slate-400' :
                          isAbsent ? 'bg-gradient-to-r from-rose-400 to-rose-500' :
                          progress > 100 ? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500' :
                          progress >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                          progress >= 75 ? 'bg-gradient-to-r from-amber-400 to-yellow-500' :
                          progress >= 50 ? 'bg-gradient-to-r from-orange-400 to-amber-500' :
                          'bg-gradient-to-r from-rose-400 to-red-500'
                        }`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                      {/* Overtime indicator - shimmer stripe */}
                      {progress > 100 && (
                        <div
                          className="absolute top-0 h-full bg-gradient-to-r from-cyan-300/50 to-blue-400/50 rounded-full animate-pulse"
                          style={{ left: `${(100 / progress) * 100}%`, right: 0 }}
                        />
                      )}
                    </div>
                    {/* Hour markers */}
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[8px] text-slate-400">0h</span>
                      <span className="text-[8px] text-slate-400">{Math.floor(recStdHours / 2)}h</span>
                      <span className="text-[8px] text-slate-400">{recStdHours}h</span>
                    </div>
                  </div>
                </div>

                {/* Check Out */}
                <div className="text-center">
                  {!isSpecial && !isAbsent ? (
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{formatTimeStr(record.checkOut)}</div>
                      {checkOutStatus && (
                        <div className={`text-[10px] font-medium ${checkOutStatus.color}`}>{checkOutStatus.label}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-sm">--:--</span>
                  )}
                </div>

                {/* Work Hours */}
                <div className="text-center">
                  <div className={`text-sm font-bold ${
                    isSpecial ? 'text-slate-400' :
                    isAbsent ? 'text-rose-400' :
                    (record.workHours || 0) >= recStdHours ? 'text-emerald-600' :
                    'text-amber-600'
                  }`}>
                    {isSpecial || isAbsent ? '-' : formatWorkHours(record.workHours)}
                  </div>
                </div>

                {/* Extra Hours */}
                <div className="text-center">
                  {!isSpecial && !isAbsent && record.workHours ? (
                    <div className={`text-xs font-bold px-1.5 py-0.5 rounded-md inline-block ${
                      extraInfo.isExtra ? 'bg-cyan-100 text-cyan-700' :
                      extraInfo.value < 0 ? 'bg-rose-100 text-rose-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {extraInfo.label}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs">-</span>
                  )}
                </div>

                {/* Location */}
                <div className="text-center">
                  {!isSpecial && !isAbsent && record.workLocation ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                      record.workLocation === 'REMOTE' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                      record.workLocation === 'HYBRID' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                      'bg-slate-50 text-slate-600 border border-slate-200'
                    }`}>
                      {record.workLocation === 'REMOTE' ? '🏠' : record.workLocation === 'HYBRID' ? '🔄' : '🏢'}
                      {record.workLocation === 'REMOTE' ? 'Remote' : record.workLocation === 'HYBRID' ? 'Hybrid' : 'Office'}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-xs">-</span>
                  )}
                </div>

                {/* Status */}
                <div className="text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    {record.checkoutMissing ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border bg-red-100 border-red-300 text-red-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        CO Missing
                      </span>
                    ) : (
                      <>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${statusInfo.bg} ${statusInfo.border} ${statusInfo.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                          {statusInfo.label}
                        </span>
                        {(record.isLate || checkInStatus?.type === 'late') && (record.status === 'PRESENT' || record.status === 'HALF_DAY') && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-600 border border-rose-200">
                            ⚠ Late
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="text-center">
                  {canAddRecord ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onAddAttendance?.(record.date, selectedEmployeeId); }}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                      title="Add Attendance"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ) : (
                    <svg
                      className={`w-4 h-4 mx-auto text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && !isPlaceholder && (
                <div className="bg-gradient-to-br from-slate-50 to-white border-t border-slate-200 px-6 py-5">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-5 mb-4">
                    {record.employee && (
                      <div className="bg-white rounded-lg border border-slate-200 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Employee</div>
                        <div className="font-semibold text-slate-800">{record.employee.firstName} {record.employee.lastName}</div>
                        {record.employee.department && <div className="text-xs text-slate-500">{record.employee.department.name}</div>}
                      </div>
                    )}
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Check In</div>
                      <div className="font-semibold text-slate-800">
                        {record.checkIn ? (
                          <>{formatTimeStr(record.checkIn)} {checkInStatus && <span className={`ml-1 text-xs ${checkInStatus.color}`}>({checkInStatus.label})</span>}</>
                        ) : <span className="text-slate-400">Not checked in</span>}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Check Out</div>
                      <div className="font-semibold text-slate-800">
                        {record.checkOut ? (
                          <>{formatTimeStr(record.checkOut)} {checkOutStatus && <span className={`ml-1 text-xs ${checkOutStatus.color}`}>({checkOutStatus.label})</span>}</>
                        ) : <span className="text-slate-400">Not checked out</span>}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Work Hours</div>
                      <div className="font-semibold text-slate-800">
                        {record.workHours ? formatWorkHours(record.workHours) : '-'}
                        {extraInfo.isExtra && <span className="ml-2 text-xs text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded">{extraInfo.label}</span>}
                        {record.overtime != null && record.overtime > 0 && <span className="ml-2 text-xs text-blue-600">+{record.overtime.toFixed(1)}h OT</span>}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Location</div>
                      <div className="font-semibold text-slate-800">
                        {record.workLocation ? (
                          <span className="flex items-center gap-1">
                            {record.workLocation === 'REMOTE' ? '🏠 Remote' : record.workLocation === 'HYBRID' ? '🔄 Hybrid' : '🏢 Office'}
                          </span>
                        ) : <span className="text-slate-400">-</span>}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Breaks</div>
                      <div className="font-semibold text-slate-800">
                        {totalBreakMinutes > 0 ? (
                          <>{record.breaks?.length} break{(record.breaks?.length || 0) > 1 ? 's' : ''} <span className="text-amber-600">({formatMinutes(totalBreakMinutes)})</span></>
                        ) : <span className="text-slate-400">No breaks</span>}
                      </div>
                    </div>
                  </div>

                  {record.breaks && record.breaks.length > 0 && (
                    <div className="border-t border-slate-200 pt-3 mt-1">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Break Details</div>
                      <div className="flex flex-wrap gap-2">
                        {record.breaks.map((breakItem, bidx) => (
                          <div key={breakItem.id || bidx} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-sm">
                            <span className="text-amber-500">☕</span>
                            <span className="text-slate-700 font-medium">
                              {new Date(breakItem.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              {' → '}
                              {breakItem.endTime ? new Date(breakItem.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Ongoing'}
                            </span>
                            {breakItem.duration && <Badge variant="default" className="text-xs">{breakItem.duration}m</Badge>}
                            {breakItem.reason && <span className="text-slate-400 text-xs">({breakItem.reason})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shift Record */}
                  {(recShiftName || recShiftStart) && (
                    <div className="border-t border-slate-200 pt-3 mt-1">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Shift Record (at check-in)</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-semibold text-indigo-700">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {recShiftName}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
                          ● {fmtShiftTime(recShiftStart)} — {fmtShiftTime(recShiftEnd)}
                        </span>
                        <span className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
                          {formatWorkHours(recStdHours)}/day
                        </span>
                        {record.shiftGraceTime != null && (
                          <span className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
                            {record.shiftGraceTime}m grace
                          </span>
                        )}
                        {record.shiftBreakDuration != null && (
                          <span className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600">
                            {record.shiftBreakDuration}m break
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {record.modifiedAt && (
                    <div className="border-t border-slate-200 pt-3 mt-3 text-xs text-slate-500">
                      <span className="font-medium">Modified:</span> {new Date(record.modifiedAt).toLocaleString()}
                      {record.modifyReason && <span className="ml-2 italic">- {record.modifyReason}</span>}
                    </div>
                  )}

                  {canModify && (
                    <div className="border-t border-slate-200 pt-3 mt-3 flex gap-2">
                      <Button variant="secondary" className="text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200" onClick={(e) => { e.stopPropagation(); onEdit?.(record); }}>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </Button>
                      <Button variant="secondary" className="text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200" loading={deleteLoadingId === record.id} onClick={(e) => { e.stopPropagation(); onDelete?.(record); }}>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                        </svg>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Expanded for placeholder - absent day */}
              {isExpanded && isPlaceholder && !isSpecial && canEdit && (
                <div className="border-t border-rose-200 bg-gradient-to-r from-rose-50 to-red-50 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-rose-700">No attendance record found</div>
                      <div className="text-sm text-rose-600 mt-0.5">Employee did not check in on {date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                    </div>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={(e) => { e.stopPropagation(); onAddAttendance?.(record.date, selectedEmployeeId); }}>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Attendance
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sortedRecords.length === 0 && (
        <div className="text-center py-16 text-slate-500 bg-white rounded-xl border border-slate-200">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-medium">No dates in selected range</p>
        </div>
      )}
    </div>
  );
}
