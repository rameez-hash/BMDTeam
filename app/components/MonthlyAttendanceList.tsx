'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

interface AttRecord {
  id: string;
  date: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
  isLate?: boolean;
  lateMinutes?: number;
  workHours?: number | null;
  notes?: string | null;
  shiftStandardWorkHours?: number | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
}

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string; rowBg: string }> = {
  PRESENT:  { label: 'Present', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', rowBg: 'bg-white' },
  LATE:     { label: 'Late',    bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500',   rowBg: 'bg-white' },
  ABSENT:   { label: 'Absent',  bg: 'bg-red-50 border-red-200',       text: 'text-red-600',     dot: 'bg-red-500',     rowBg: 'bg-red-50/30' },
  WEEKEND:  { label: 'Weekend', bg: 'bg-slate-50 border-slate-200',   text: 'text-slate-500',   dot: 'bg-slate-400',   rowBg: 'bg-slate-50/50' },
  HOLIDAY:  { label: 'Holiday', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-600',  dot: 'bg-purple-500',  rowBg: 'bg-purple-50/30' },
  ON_LEAVE: { label: 'Leave',   bg: 'bg-blue-50 border-blue-200',     text: 'text-blue-600',    dot: 'bg-blue-500',    rowBg: 'bg-blue-50/30' },
  HALF_DAY: { label: 'Half Day', bg: 'bg-teal-50 border-teal-200',    text: 'text-teal-600',    dot: 'bg-teal-500',    rowBg: 'bg-white' },
  NOT_JOINED: { label: 'Not Joined', bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', dot: 'bg-gray-400', rowBg: 'bg-gray-50/30' },
};
const DEFAULT_CFG = { label: 'Unknown', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-500', dot: 'bg-slate-400', rowBg: 'bg-white' };

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_COLORS: Record<string, string> = { SUN: 'text-red-500', SAT: 'text-red-500' };

function fmtTime(iso?: string | null): string {
  if (!iso) return '-- : -- : --';
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return '-- : -- : --'; }
}

function fmtDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

export default function MonthlyAttendanceList() {
  const { token } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [records, setRecords] = useState<AttRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    try {
      const res = await fetch(
        `/api/attendance?startDate=${startDate}&endDate=${endDate}&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setRecords(data.data || data.records || []);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [token, year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const goToday = () => setCurrentMonth(new Date());

  // Build all days of the month
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map records by date
  const recMap = new Map<string, AttRecord>();
  records.forEach((r) => {
    const d = typeof r.date === 'string' ? r.date.substring(0, 10) : new Date(r.date).toISOString().substring(0, 10);
    recMap.set(d, r);
  });

  // Build rows for every day — newest first
  const rows: { dateStr: string; day: number; dayName: string; isToday: boolean; isFuture: boolean; isWeekend: boolean; record?: AttRecord }[] = [];
  for (let d = daysInMonth; d >= 1; d--) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dt = new Date(year, month, d);
    const dayOfWeek = dt.getDay();
    const rec = recMap.get(dateStr);
    rows.push({
      dateStr,
      day: d,
      dayName: DAY_NAMES[dayOfWeek],
      isToday: dateStr === todayStr,
      isFuture: dt > today && dateStr !== todayStr,
      isWeekend: rec?.status === 'WEEKEND' || (!rec && (dayOfWeek === 0 || dayOfWeek === 6)),
      record: rec,
    });
  }

  // Summary counts
  const summary = { present: 0, halfDay: 0, late: 0, absent: 0, leave: 0, holiday: 0, weekend: 0 };
  rows.forEach((r) => {
    if (r.isFuture) return;
    const status = r.record?.status;
    if (status === 'PRESENT' || (status && !['ABSENT', 'WEEKEND', 'HOLIDAY', 'ON_LEAVE', 'HALF_DAY', 'NOT_JOINED'].includes(status) && r.record?.checkIn)) {
      if (r.record?.isLate) summary.late++;
      else summary.present++;
    }
    else if (status === 'ABSENT') summary.absent++;
    else if (status === 'WEEKEND') summary.weekend++;
    else if (status === 'HOLIDAY') summary.holiday++;
    else if (status === 'ON_LEAVE') summary.leave++;
    else if (status === 'HALF_DAY') summary.halfDay++;
    else if (status === 'NOT_JOINED') { /* skip - don't count as absent */ }
    else if (!r.isFuture && !r.isWeekend && !status) summary.absent++;
    else if (r.isWeekend && !status) summary.weekend++;
  });

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <svg className="w-4.5 h-4.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Monthly Attendance</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Complete day-by-day attendance log</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={goToday}
            className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors min-w-[140px] text-center">
            {monthLabel}
          </button>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-4 flex-wrap">
        {[
          { label: 'Present', value: summary.present, color: 'text-emerald-600', dot: 'bg-emerald-500' },
          { label: 'Late', value: summary.late, color: 'text-amber-600', dot: 'bg-amber-500' },
          { label: 'Absent', value: summary.absent, color: 'text-red-500', dot: 'bg-red-500' },
          { label: 'Half Day', value: summary.halfDay, color: 'text-teal-600', dot: 'bg-teal-500' },
          { label: 'Leave', value: summary.leave, color: 'text-blue-600', dot: 'bg-blue-500' },
          { label: 'Holiday', value: summary.holiday, color: 'text-purple-600', dot: 'bg-purple-500' },
          { label: 'Weekend', value: summary.weekend, color: 'text-slate-500', dot: 'bg-slate-400' },
        ].map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            <span className="text-slate-500">{s.label}:</span>
            <span className={`font-bold ${s.color}`}>{s.value}</span>
          </span>
        ))}
      </div>

      {/* Table Header */}
      <div className="hidden sm:grid grid-cols-[60px_1fr_1fr_1fr_1fr_110px] gap-2 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        <span>Date</span>
        <span>Check In</span>
        <span>Activity</span>
        <span>Check Out</span>
        <span>Work Hours</span>
        <span className="text-right">Status</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">
            <svg className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading attendance...
          </div>
        ) : (
          rows.map((row) => {
            const rec = row.record;
            let effectiveStatus = rec?.status || (row.isWeekend ? 'WEEKEND' : row.isFuture ? '' : 'ABSENT');
            if (rec?.isLate && effectiveStatus === 'PRESENT') effectiveStatus = 'LATE';
            const cfg = STATUS_CFG[effectiveStatus] || DEFAULT_CFG;

            // Progress bar
            const stdHours = rec?.shiftStandardWorkHours || 9;
            const worked = rec?.workHours || 0;
            const pct = effectiveStatus === 'WEEKEND' || effectiveStatus === 'HOLIDAY' || effectiveStatus === 'NOT_JOINED' || row.isFuture
              ? 0
              : Math.min(100, Math.round((worked / stdHours) * 100));

            const barColor =
              effectiveStatus === 'LATE' ? 'bg-amber-400' :
              pct >= 100 ? 'bg-emerald-500' :
              pct > 50 ? 'bg-emerald-400' :
              pct > 0 ? 'bg-amber-400' : 'bg-slate-200';

            const isSpecial = ['WEEKEND', 'HOLIDAY', 'ON_LEAVE', 'NOT_JOINED'].includes(effectiveStatus);

            return (
              <div key={row.dateStr}
                className={`grid grid-cols-[60px_1fr] sm:grid-cols-[60px_1fr_1fr_1fr_1fr_110px] gap-2 px-5 py-3 items-center transition-colors ${
                  row.isToday ? 'bg-indigo-50/60 border-l-[3px] border-l-indigo-500' : cfg.rowBg
                } ${row.isFuture ? 'opacity-40' : ''}`}
              >
                {/* Date */}
                <div className="flex flex-col items-center">
                  <span className={`text-lg font-bold leading-none ${
                    row.isToday ? 'text-indigo-600' : DAY_COLORS[row.dayName] || 'text-slate-700'
                  }`}>
                    {String(row.day).padStart(2, '0')}
                  </span>
                  <span className={`text-[9px] font-bold tracking-wider mt-0.5 ${
                    row.isToday ? 'text-indigo-500' : DAY_COLORS[row.dayName] || 'text-slate-400'
                  }`}>
                    {row.dayName}
                  </span>
                </div>

                {/* Mobile: condensed row */}
                <div className="sm:hidden flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    {isSpecial || row.isFuture ? (
                      <span className="text-xs text-slate-400">{cfg.label}</span>
                    ) : (
                      <>
                        <span className="text-xs text-slate-600">{fmtTime(rec?.checkIn)} → {fmtTime(rec?.checkOut)}</span>
                        {worked > 0 && <span className="text-[10px] text-slate-400">{fmtDuration(worked)}</span>}
                      </>
                    )}
                  </div>
                  {!row.isFuture && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} /> {cfg.label}
                      {rec?.isLate && effectiveStatus !== 'LATE' && <span className="ml-0.5">⚠</span>}
                    </span>
                  )}
                </div>

                {/* Desktop columns */}
                {/* Check In */}
                <div className="hidden sm:flex flex-col">
                  {isSpecial || row.isFuture ? (
                    <span className="text-xs text-slate-300">-- : --</span>
                  ) : (
                    <>
                      <span className={`text-sm font-semibold ${rec?.checkIn ? 'text-slate-800' : 'text-slate-300'}`}>
                        {fmtTime(rec?.checkIn)}
                      </span>
                      {rec?.isLate && rec?.lateMinutes && (
                        <span className="text-[10px] text-red-500 font-medium">
                          {rec.lateMinutes >= 60
                            ? `${Math.floor(rec.lateMinutes / 60)}h ${rec.lateMinutes % 60}m late`
                            : `${rec.lateMinutes}m late`}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Activity Bar */}
                <div className="hidden sm:flex flex-col gap-1">
                  {isSpecial ? (
                    <span className="text-xs text-slate-400 font-medium">{rec?.notes || cfg.label}</span>
                  ) : row.isFuture ? (
                    <span className="text-xs text-slate-300">—</span>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {/* Circular progress */}
                        <div className="relative w-8 h-8 flex-shrink-0">
                          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                            <circle cx="18" cy="18" r="14" fill="none"
                              stroke={pct >= 100 ? '#10b981' : pct > 0 ? '#f59e0b' : '#e2e8f0'}
                              strokeWidth="3" strokeLinecap="round"
                              strokeDasharray={`${pct * 0.88} 88`} />
                          </svg>
                          <span className={`absolute inset-0 flex items-center justify-center text-[7px] font-bold ${
                            pct >= 100 ? 'text-emerald-600' : pct > 0 ? 'text-amber-600' : 'text-slate-400'
                          }`}>{pct}%</span>
                        </div>
                        {/* Bar */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-slate-500 font-medium">
                              {worked > 0 ? `${fmtDuration(worked)} / ${stdHours}h` : 'No Activity'}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Check Out */}
                <div className="hidden sm:flex flex-col">
                  {isSpecial || row.isFuture ? (
                    <span className="text-xs text-slate-300">-- : --</span>
                  ) : (
                    <span className={`text-sm font-semibold ${rec?.checkOut ? 'text-slate-800' : 'text-slate-300'}`}>
                      {fmtTime(rec?.checkOut)}
                    </span>
                  )}
                </div>

                {/* Work Hours */}
                <div className="hidden sm:flex flex-col">
                  {isSpecial || row.isFuture ? (
                    <span className="text-xs text-slate-300">—</span>
                  ) : worked > 0 ? (
                    <span className="text-sm font-bold text-slate-800">{fmtDuration(worked)}</span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>

                {/* Status Badge */}
                <div className="hidden sm:flex justify-end">
                  {!row.isFuture && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                      {rec?.isLate && (effectiveStatus === 'PRESENT' || effectiveStatus === 'HALF_DAY') && (
                        <span className="text-red-500 ml-0.5">⚠ Late</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
