'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface DashboardStats {
  totalEmployees?: number;
  activeToday?: number;
  onLeave?: number;
  pendingApprovals?: number;
  recentActivities?: { id: string; action: string; createdAt: string; user?: { email: string } }[];
  upcomingHolidays?: { id: string; name: string; date: string }[];
  todaysBirthdays?: { id: string; firstName: string; lastName: string }[];
}

interface Shift {
  name: string;
  startTime: string;
  endTime: string;
  standardWorkHours?: number;
}

interface AttendanceStatus {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  isOnBreak: boolean;
  breakStartTime?: string;
  totalBreakMinutes: number;
  currentWorkMinutes: number;
  attendanceRecordStatus?: string;
  workHours?: number;
  isLate?: boolean;
  lateMinutes?: number;
  shift?: Shift;
  canCheckInAgain?: boolean;
  remainingGapMinutes?: number;
  minCheckInGap?: number;
  attendanceDate?: string;
}

interface MonthlyStats {
  present: number;
  halfDay: number;
  late: number;
  absent: number;
  onLeave: number;
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats>({});
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({
    isCheckedIn: false, isCheckedOut: false, isOnBreak: false, totalBreakMinutes: 0, currentWorkMinutes: 0,
  });
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({ present: 0, halfDay: 0, late: 0, absent: 0, onLeave: 0 });
  const [recentRecords, setRecentRecords] = useState<Array<{ date: string; status: string; checkIn?: string; checkOut?: string; workHours?: number; isLate?: boolean; lateMinutes?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkInLocation, setCheckInLocation] = useState<'OFFICE' | 'REMOTE' | 'HYBRID'>('OFFICE');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workTimer, setWorkTimer] = useState('00:00:00');
  const [breakTimer, setBreakTimer] = useState('00:00');
  const workTimerRef = useRef<NodeJS.Timeout | null>(null);
  const breakTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string;
    variant: 'danger' | 'warning' | 'info' | 'success';
    confirmText: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });

  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'HR' || user?.role === 'MANAGER';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const endpoint = user?.role === 'EMPLOYEE' ? '/api/dashboard/employee' : '/api/dashboard/admin';
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        if (data.stats) {
          setStats({
            totalEmployees: data.stats.totalEmployees,
            activeToday: data.stats.presentToday,
            onLeave: data.stats.onLeaveToday,
            pendingApprovals: data.pendingApprovals?.leaveRequests || 0,
            recentActivities: data.recentActivities,
            upcomingHolidays: data.upcomingHolidays,
            todaysBirthdays: data.upcomingBirthdays,
          });
        } else {
          setStats({ ...data });
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    }
  }, [user?.role, token]);

  const fetchAttendanceStatus = useCallback(async () => {
    if (!user?.employee) return;
    try {
      const res = await fetch('/api/attendance/status', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const result = await res.json();
        const data = result.data || result;
        const isCheckedIn = data.status === 'CHECKED_IN';
        const isCheckedOut = data.status === 'CHECKED_OUT';
        const activeBreak = data.breaks?.find((b: { endTime?: string }) => !b.endTime);
        setAttendanceStatus({
          isCheckedIn, isCheckedOut,
          checkInTime: data.checkIn, checkOutTime: data.checkOut,
          isOnBreak: data.isOnBreak || !!activeBreak,
          breakStartTime: activeBreak?.startTime,
          totalBreakMinutes: data.totalBreakMinutes || 0,
          currentWorkMinutes: data.currentWorkMinutes || 0,
          workHours: data.workHours,
          isLate: data.isLate, lateMinutes: data.lateMinutes,
          shift: data.shift,
          canCheckInAgain: data.canCheckInAgain,
          remainingGapMinutes: data.remainingGapMinutes,
          minCheckInGap: data.minCheckInGap,
          attendanceDate: data.attendanceDate,
          attendanceRecordStatus: data.attendanceRecordStatus,
        });
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    }
  }, [token, user?.employee]);

  const fetchMonthlyStats = useCallback(async () => {
    if (!user?.employee || !token) return;
    try {
      const now = new Date();
      const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const empId = user.employee.id;
      const res = await fetch(`/api/attendance?startDate=${startDate}&endDate=${endDate}&employeeId=${empId}&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        const records = result.data || result.records || result.attendance || [];
        const arr = Array.isArray(records) ? records : [];
        setMonthlyStats({
          present: arr.filter((r: { status: string }) => r.status === 'PRESENT').length,
          halfDay: arr.filter((r: { status: string }) => r.status === 'HALF_DAY').length,
          late: arr.filter((r: { isLate?: boolean }) => r.isLate).length,
          absent: arr.filter((r: { status: string }) => r.status === 'ABSENT').length,
          onLeave: arr.filter((r: { status: string }) => r.status === 'ON_LEAVE').length,
        });
        // Store last 5 days (most recent first)
        const today = new Date().toISOString().split('T')[0];
        const last5 = arr
          .filter((r: { date: string }) => (r.date.length > 10 ? r.date.substring(0, 10) : r.date) <= today)
          .sort((a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date))
          .slice(0, 5);
        setRecentRecords(last5);
      }
    } catch { /* */ }
  }, [token, user?.employee]);

  useEffect(() => {
    if (token) {
      Promise.all([fetchDashboardData(), fetchAttendanceStatus(), fetchMonthlyStats()])
        .finally(() => setLoading(false));

      // Auto-check probation/notice period expiry for admin/HR
      if (user?.role === 'ADMIN' || user?.role === 'HR') {
        fetch('/api/employees/check-periods', {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    }
  }, [token, fetchDashboardData, fetchAttendanceStatus, fetchMonthlyStats]);

  // Refresh attendance status every 60s when checked out (to update countdown)
  useEffect(() => {
    if (attendanceStatus.isCheckedOut && !attendanceStatus.canCheckInAgain) {
      const interval = setInterval(() => fetchAttendanceStatus(), 60000);
      return () => clearInterval(interval);
    }
  }, [attendanceStatus.isCheckedOut, attendanceStatus.canCheckInAgain, fetchAttendanceStatus]);

  // Work timer
  useEffect(() => {
    if (workTimerRef.current) clearInterval(workTimerRef.current);
    if (attendanceStatus.isCheckedIn && attendanceStatus.checkInTime && !attendanceStatus.isCheckedOut) {
      const updateWorkTimer = () => {
        const checkIn = new Date(attendanceStatus.checkInTime!);
        const now = new Date();
        let diff = Math.floor((now.getTime() - checkIn.getTime()) / 1000);
        diff -= (attendanceStatus.totalBreakMinutes || 0) * 60;
        if (attendanceStatus.isOnBreak && attendanceStatus.breakStartTime) {
          const bs = new Date(attendanceStatus.breakStartTime);
          diff -= Math.floor((now.getTime() - bs.getTime()) / 1000);
        }
        if (diff < 0) diff = 0;
        setWorkTimer(
          `${Math.floor(diff / 3600).toString().padStart(2, '0')}:${Math.floor((diff % 3600) / 60).toString().padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`
        );
      };
      updateWorkTimer();
      workTimerRef.current = setInterval(updateWorkTimer, 1000);
    } else if (attendanceStatus.isCheckedOut && attendanceStatus.workHours) {
      const ts = Math.round(attendanceStatus.workHours * 3600);
      setWorkTimer(`${Math.floor(ts / 3600).toString().padStart(2, '0')}:${Math.floor((ts % 3600) / 60).toString().padStart(2, '0')}:${(ts % 60).toString().padStart(2, '0')}`);
    } else {
      setWorkTimer('00:00:00');
    }
    return () => { if (workTimerRef.current) clearInterval(workTimerRef.current); };
  }, [attendanceStatus]);

  // Break timer
  useEffect(() => {
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    if (attendanceStatus.isOnBreak && attendanceStatus.breakStartTime) {
      const update = () => {
        const bs = new Date(attendanceStatus.breakStartTime!);
        const diff = Math.floor((new Date().getTime() - bs.getTime()) / 1000);
        setBreakTimer(`${Math.floor(diff / 60).toString().padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`);
      };
      update();
      breakTimerRef.current = setInterval(update, 1000);
    } else {
      setBreakTimer('00:00');
    }
    return () => { if (breakTimerRef.current) clearInterval(breakTimerRef.current); };
  }, [attendanceStatus.isOnBreak, attendanceStatus.breakStartTime]);

  /* ─── Actions ─── */
  const handleCheckInClick = () => {
    openConfirm({ title: 'Confirm Check In', message: 'Are you sure you want to check in now?', variant: 'success', confirmText: 'Check In', onConfirm: handleCheckIn });
  };
  const handleCheckOutClick = () => {
    openConfirm({ title: 'Confirm Check Out', message: 'Are you sure you want to check out? Make sure you have completed your work.', variant: 'danger', confirmText: 'Check Out', onConfirm: handleCheckOut });
  };

  const handleCheckIn = async () => {
    closeConfirm();
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/check-in', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ workLocation: checkInLocation }) });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Checked in!'); fetchAttendanceStatus(); fetchMonthlyStats(); }
      else toast.error(data.error || 'Check-in failed');
    } catch { toast.error('Failed to check in.'); } finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    closeConfirm();
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/check-out', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Checked out!'); fetchAttendanceStatus(); fetchMonthlyStats(); }
      else toast.error(data.error || 'Check-out failed');
    } catch { toast.error('Failed to check out.'); } finally { setActionLoading(false); }
  };

  const handleStartBreak = async () => {
    closeConfirm();
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/break/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { toast.success('Break started'); fetchAttendanceStatus(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Failed'); } finally { setActionLoading(false); }
  };

  const handleEndBreak = async () => {
    closeConfirm();
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/break/end', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Break ended'); fetchAttendanceStatus(); }
      else toast.error(data.error || 'Failed');
    } catch { toast.error('Failed'); } finally { setActionLoading(false); }
  };

  if (loading) {
    return (
      <div className="p-6" suppressHydrationWarning>
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64 bg-slate-100 rounded-2xl animate-pulse" />
            <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════ EMPLOYEE DASHBOARD ═══════════════ */

  // Clock hand angles
  const hours = currentTime.getHours();
  const mins = currentTime.getMinutes();
  const secs = currentTime.getSeconds();
  const secAngle = secs * 6;
  const minAngle = mins * 6 + secs * 0.1;
  const hourAngle = (hours % 12) * 30 + mins * 0.5;

  const greeting = 'Hi';

  if (!isAdmin) {
    return (
      <div className="space-y-6" suppressHydrationWarning>

        {/* ── Welcome Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {greeting}, {user?.employee?.firstName || 'User'} <span className="inline-block animate-[wave_2s_ease-in-out_infinite]">👋</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          {attendanceStatus.shift && (
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-bold text-emerald-700">{attendanceStatus.shift.name}</p>
                <p className="text-[10px] text-emerald-600">{attendanceStatus.shift.startTime} – {attendanceStatus.shift.endTime}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Tracker Card ── */}
        <div className="max-w-3xl mx-auto">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl">
              {/* Background decorations */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
              </div>

              <div className="relative z-10 p-6 sm:p-8">
                {/* Clock + Status Row */}
                <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 mb-6">

                  {/* Analog Clock */}
                  <div className="flex-shrink-0" suppressHydrationWarning>
                    <div className="relative w-40 h-40 sm:w-48 sm:h-48">
                      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
                        {/* Outer ring */}
                        <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                        {/* Clock face */}
                        <circle cx="100" cy="100" r="90" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                        {/* Inner glow ring */}
                        <circle cx="100" cy="100" r="88" fill="none" stroke="url(#clockGlow)" strokeWidth="2" />
                        <defs>
                          <linearGradient id="clockGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
                            <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#34d399" stopOpacity="0.6" />
                          </linearGradient>
                        </defs>
                        {/* Hour markers */}
                        {[...Array(12)].map((_, i) => {
                          const angle = (i * 30 - 90) * (Math.PI / 180);
                          const isMain = i % 3 === 0;
                          const outerR = 82;
                          const innerR = isMain ? 72 : 76;
                          return (
                            <line key={`h-${i}`}
                              x1={100 + outerR * Math.cos(angle)} y1={100 + outerR * Math.sin(angle)}
                              x2={100 + innerR * Math.cos(angle)} y2={100 + innerR * Math.sin(angle)}
                              stroke={isMain ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)'}
                              strokeWidth={isMain ? 2.5 : 1.2} strokeLinecap="round"
                            />
                          );
                        })}
                        {/* Minute dots */}
                        {[...Array(60)].map((_, i) => {
                          if (i % 5 === 0) return null;
                          const angle = (i * 6 - 90) * (Math.PI / 180);
                          return (
                            <circle key={`m-${i}`}
                              cx={100 + 82 * Math.cos(angle)} cy={100 + 82 * Math.sin(angle)}
                              r="0.7" fill="rgba(255,255,255,0.15)"
                            />
                          );
                        })}
                        {/* Hour numbers */}
                        {[12, 3, 6, 9].map((num) => {
                          const angle = ((num === 12 ? 0 : num * 30) - 90) * (Math.PI / 180);
                          return (
                            <text key={`n-${num}`}
                              x={100 + 62 * Math.cos(angle)} y={100 + 62 * Math.sin(angle)}
                              textAnchor="middle" dominantBaseline="central"
                              fill="rgba(255,255,255,0.5)" fontSize="11" fontWeight="600" fontFamily="system-ui"
                            >
                              {num}
                            </text>
                          );
                        })}
                        {/* Hour hand */}
                        <line
                          x1="100" y1="100"
                          x2={100 + 42 * Math.cos((hourAngle - 90) * (Math.PI / 180))}
                          y2={100 + 42 * Math.sin((hourAngle - 90) * (Math.PI / 180))}
                          stroke="white" strokeWidth="3.5" strokeLinecap="round"
                          style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.3))' }}
                        />
                        {/* Minute hand */}
                        <line
                          x1="100" y1="100"
                          x2={100 + 58 * Math.cos((minAngle - 90) * (Math.PI / 180))}
                          y2={100 + 58 * Math.sin((minAngle - 90) * (Math.PI / 180))}
                          stroke="white" strokeWidth="2.5" strokeLinecap="round"
                          style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.3))' }}
                        />
                        {/* Second hand */}
                        <line
                          x1={100 - 12 * Math.cos((secAngle - 90) * (Math.PI / 180))}
                          y1={100 - 12 * Math.sin((secAngle - 90) * (Math.PI / 180))}
                          x2={100 + 65 * Math.cos((secAngle - 90) * (Math.PI / 180))}
                          y2={100 + 65 * Math.sin((secAngle - 90) * (Math.PI / 180))}
                          stroke="#34d399" strokeWidth="1.2" strokeLinecap="round"
                          style={{ filter: 'drop-shadow(0 0 4px rgba(52,211,153,0.5))' }}
                        />
                        {/* Center dot */}
                        <circle cx="100" cy="100" r="4" fill="#34d399" style={{ filter: 'drop-shadow(0 0 6px rgba(52,211,153,0.6))' }} />
                        <circle cx="100" cy="100" r="2" fill="white" />
                      </svg>
                    </div>
                  </div>

                  {/* Digital Time + Status */}
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <p className="text-4xl sm:text-5xl font-bold font-mono tracking-wide" suppressHydrationWarning>
                      {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                    <p className="text-slate-400 text-sm mt-1">
                      {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                    {/* Status Badge */}
                    <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${
                        attendanceStatus.isOnBreak
                          ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                          : attendanceStatus.isCheckedIn && !attendanceStatus.isCheckedOut
                            ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                            : attendanceStatus.isCheckedOut
                              ? 'bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30'
                              : 'bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/20'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          attendanceStatus.isOnBreak ? 'bg-amber-400 animate-pulse' :
                          attendanceStatus.isCheckedIn && !attendanceStatus.isCheckedOut ? 'bg-emerald-400 animate-pulse' :
                          'bg-slate-500'
                        }`} />
                        {attendanceStatus.isOnBreak ? 'On Break' :
                         attendanceStatus.isCheckedIn && !attendanceStatus.isCheckedOut ? 'Working' :
                         attendanceStatus.isCheckedOut ? `Checked Out${attendanceStatus.checkOutTime ? ' at ' + new Date(attendanceStatus.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}` : 'Not Checked In'}
                      </span>
                      {attendanceStatus.isLate && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-300 ring-1 ring-red-500/30">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                          Late {attendanceStatus.lateMinutes && attendanceStatus.lateMinutes >= 60 ? `${Math.floor(attendanceStatus.lateMinutes / 60)}h ${attendanceStatus.lateMinutes % 60}m` : `${attendanceStatus.lateMinutes}m`}
                        </span>
                      )}
                      {attendanceStatus.attendanceRecordStatus === 'HALF_DAY' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/30">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Half Day
                        </span>
                      )}
                    </div>

                    {/* Check-in / Check-out Times */}
                    {(attendanceStatus.checkInTime || attendanceStatus.checkOutTime) && (
                      <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-slate-400">
                        {attendanceStatus.checkInTime && (
                          <span className="inline-flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" /></svg>
                            In: <span className="text-slate-300 font-medium">{new Date(attendanceStatus.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </span>
                        )}
                        {attendanceStatus.checkOutTime && (
                          <span className="inline-flex items-center gap-1.5">
                            <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>
                            Out: <span className="text-slate-300 font-medium">{new Date(attendanceStatus.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </span>
                        )}
                      </div>
                    )}
                    {/* Attendance Date */}
                    {attendanceStatus.attendanceDate && (
                      <div className="mt-2 flex items-center justify-center sm:justify-start gap-1.5 text-[11px] text-slate-500">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {new Date(attendanceStatus.attendanceDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Work Timer + Break Info */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/[0.06] backdrop-blur-md rounded-xl border border-white/10 p-4 text-center">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-medium mb-1">Work Time</p>
                    <p className="text-xl sm:text-2xl font-semibold text-white tracking-wide" suppressHydrationWarning>{workTimer}</p>
                  </div>
                  <div className="bg-white/[0.06] backdrop-blur-md rounded-xl border border-white/10 p-4 text-center">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-medium mb-1">
                      {attendanceStatus.isOnBreak ? 'Break' : 'Total Break'}
                    </p>
                    <p className={`text-xl sm:text-2xl font-semibold tracking-wide ${attendanceStatus.isOnBreak ? 'text-amber-300' : 'text-slate-300'}`} suppressHydrationWarning>
                      {attendanceStatus.isOnBreak ? breakTimer : (
                        attendanceStatus.totalBreakMinutes > 0
                          ? `${Math.floor(attendanceStatus.totalBreakMinutes / 60) > 0 ? Math.floor(attendanceStatus.totalBreakMinutes / 60) + 'h ' : ''}${attendanceStatus.totalBreakMinutes % 60}m`
                          : '0m'
                      )}
                    </p>
                  </div>
                </div>

                {/* Location Selector — shown before check-in */}
                {(!attendanceStatus.isCheckedIn && !attendanceStatus.isCheckedOut) || (attendanceStatus.isCheckedOut && attendanceStatus.canCheckInAgain) ? (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-slate-300 font-medium uppercase tracking-wider mr-1">Location:</span>
                    {([
                      { value: 'OFFICE' as const, label: '🏢 Office', color: 'emerald' },
                      { value: 'REMOTE' as const, label: '🏠 Remote', color: 'sky' },
                      { value: 'HYBRID' as const, label: '🔄 Hybrid', color: 'purple' },
                    ]).map(loc => (
                      <button
                        key={loc.value}
                        type="button"
                        onClick={() => setCheckInLocation(loc.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          checkInLocation === loc.value
                            ? 'bg-white text-slate-800 shadow-md scale-105'
                            : 'bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        {loc.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                  {!attendanceStatus.isCheckedIn && !attendanceStatus.isCheckedOut && (
                    <Button onClick={handleCheckInClick} loading={actionLoading}
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-emerald-500/25 rounded-xl transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Check In
                    </Button>
                  )}
                  {attendanceStatus.isCheckedOut && (
                    attendanceStatus.canCheckInAgain ? (
                      <Button onClick={handleCheckInClick} loading={actionLoading}
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-emerald-500/25 rounded-xl transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        Check In
                      </Button>
                    ) : (
                      <div className="flex items-center gap-3 bg-white/[0.08] backdrop-blur-sm rounded-xl px-5 py-3 border border-white/10">
                        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-xs text-slate-400">Next check-in available in</p>
                          <p className="text-lg font-bold text-amber-300 font-mono">
                            {Math.floor((attendanceStatus.remainingGapMinutes || 0) / 60)}h {(attendanceStatus.remainingGapMinutes || 0) % 60}m
                          </p>
                        </div>
                      </div>
                    )
                  )}
                  {attendanceStatus.isCheckedIn && !attendanceStatus.isCheckedOut && !attendanceStatus.isOnBreak && (
                    <>
                      <Button onClick={handleCheckOutClick} loading={actionLoading}
                        className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 text-white font-bold px-6 py-3.5 text-base shadow-lg shadow-red-500/25 rounded-xl transition-all hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98]">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Check Out
                      </Button>
                      <Button onClick={() => openConfirm({ title: 'Start Break', message: 'Are you sure you want to start your break?', variant: 'warning', confirmText: 'Start Break', onConfirm: handleStartBreak })} loading={actionLoading}
                        className="bg-white/10 hover:bg-white/15 text-white border border-white/20 font-semibold px-6 py-3.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm">
                        <svg className="w-4 h-4 mr-2 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Start Break
                      </Button>
                    </>
                  )}
                  {attendanceStatus.isOnBreak && (
                    <Button onClick={() => openConfirm({ title: 'End Break', message: 'Are you sure you want to end your break and resume work?', variant: 'info', confirmText: 'End Break', onConfirm: handleEndBreak })} loading={actionLoading}
                      className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-amber-500/25 rounded-xl transition-all hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98]">
                      End Break
                    </Button>
                  )}
                </div>
              </div>
            </div>
        </div>

        {/* ── This Month Stats ── */}
        <div className="max-w-3xl mx-auto">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">This Month</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Present', value: monthlyStats.present, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: 'Half Day', value: monthlyStats.halfDay, color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
              { label: 'Late', value: monthlyStats.late, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
              { label: 'Absent', value: monthlyStats.absent, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
              { label: 'On Leave', value: monthlyStats.onLeave, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
            ].map((s, i) => (
              <div key={i} className={`${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className={`text-[11px] font-medium ${s.color} opacity-70 mt-0.5`}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent Attendance ── */}
        {recentRecords.length > 0 && (
          <div className="max-w-3xl mx-auto">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Attendance</h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              {recentRecords.map((r, i) => {
                const d = new Date(r.date);
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = d.getDate();
                const monthName = d.toLocaleDateString('en-US', { month: 'short' });
                const fmtTime = (t?: string) => t ? new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                const statusColor = r.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' : r.status === 'HALF_DAY' ? 'bg-teal-100 text-teal-700' : r.status === 'ABSENT' ? 'bg-red-100 text-red-700' : r.status === 'WEEKEND' ? 'bg-orange-100 text-orange-600' : r.status === 'HOLIDAY' ? 'bg-blue-100 text-blue-700' : r.status === 'ON_LEAVE' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600';
                const statusLabel = r.status === 'PRESENT' ? 'Present' : r.status === 'HALF_DAY' ? 'Half Day' : r.status === 'ABSENT' ? 'Absent' : r.status === 'WEEKEND' ? 'Weekend' : r.status === 'HOLIDAY' ? 'Holiday' : r.status === 'ON_LEAVE' ? 'Leave' : r.status;
                const wh = r.workHours ? `${Math.floor(r.workHours)}h ${Math.round((r.workHours % 1) * 60)}m` : null;
                return (
                  <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center text-center flex-shrink-0 ${statusColor}`}>
                      <span className="text-sm font-bold leading-none">{dayNum}</span>
                      <span className="text-[9px] font-semibold uppercase">{dayName}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{dayNum} {monthName}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                        {r.isLate && <span className="text-[10px] font-medium text-red-500">Late {r.lateMinutes && r.lateMinutes >= 60 ? `${Math.floor(r.lateMinutes / 60)}h ${r.lateMinutes % 60}m` : `${r.lateMinutes}m`}</span>}
                        {r.status === 'HALF_DAY' && <span className="text-[10px] font-medium text-teal-600">Half Day</span>}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {r.checkIn ? `${fmtTime(r.checkIn)} → ${fmtTime(r.checkOut)}` : 'No check-in'}
                        {wh && <span className="ml-2 text-emerald-600 font-medium">{wh}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.open}
          onClose={closeConfirm}
          onConfirm={() => { confirmDialog.onConfirm(); }}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          confirmText={confirmDialog.confirmText}
        />
      </div>
    );
  }

  /* ═══════════════ ADMIN DASHBOARD ═══════════════ */
  return (
    <div className="space-y-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {user?.employee?.firstName || 'Admin'} <span className="inline-block animate-[wave_2s_ease-in-out_infinite]">👋</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-mono font-semibold text-slate-700" suppressHydrationWarning>
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Admin Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: stats.totalEmployees || 0, color: 'text-slate-900', bg: 'from-slate-50 to-slate-100', borderColor: 'border-slate-200', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', iconColor: 'text-slate-500', iconBg: 'bg-slate-200/60' },
          { label: 'Present Today', value: stats.activeToday || 0, color: 'text-emerald-600', bg: 'from-emerald-50 to-emerald-100/50', borderColor: 'border-emerald-200', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', iconColor: 'text-emerald-600', iconBg: 'bg-emerald-200/60' },
          { label: 'On Leave', value: stats.onLeave || 0, color: 'text-amber-600', bg: 'from-amber-50 to-amber-100/50', borderColor: 'border-amber-200', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', iconColor: 'text-amber-600', iconBg: 'bg-amber-200/60' },
          { label: 'Pending Approvals', value: stats.pendingApprovals || 0, color: 'text-rose-600', bg: 'from-rose-50 to-rose-100/50', borderColor: 'border-rose-200', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', iconColor: 'text-rose-600', iconBg: 'bg-rose-200/60' },
        ].map((stat, i) => (
          <div key={i} className={`bg-gradient-to-br ${stat.bg} rounded-2xl border ${stat.borderColor} p-5 transition-all hover:shadow-md hover:-translate-y-0.5`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                <svg className={`w-5 h-5 ${stat.iconColor}`} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                </svg>
              </div>
            </div>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[12px] text-slate-500 font-medium mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Today's Birthdays */}
      {stats.todaysBirthdays && stats.todaysBirthdays.length > 0 && (
        <div className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 rounded-2xl border border-purple-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <span className="text-sm">🎂</span>
            </div>
            <h3 className="text-sm font-semibold text-purple-900">Today&apos;s Birthdays</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.todaysBirthdays.map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/70 backdrop-blur-sm rounded-full text-sm font-medium text-purple-700 border border-purple-200/60">
                🎉 {b.firstName} {b.lastName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming Holidays */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Upcoming Holidays</h2>
          </div>
          <div className="p-4">
            {stats.upcomingHolidays && stats.upcomingHolidays.length > 0 ? (
              <div className="space-y-2">
                {stats.upcomingHolidays.slice(0, 5).map((holiday, index) => (
                  <div key={holiday.id || `holiday-${index}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex flex-col items-center justify-center flex-shrink-0 border border-amber-100">
                      <span className="text-xs font-bold text-amber-700 leading-none">{new Date(holiday.date).getDate()}</span>
                      <span className="text-[9px] font-medium text-amber-500 leading-none mt-0.5">{new Date(holiday.date).toLocaleDateString('en-US', { month: 'short' })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{holiday.name}</p>
                      <p className="text-[11px] text-slate-400">{new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-sm text-slate-500">No upcoming holidays</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <ActionLink href="/dashboard/employees" label="Employees" color="emerald"
                icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              <ActionLink href="/dashboard/employee-attendance" label="Attendance" color="teal"
                icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              <ActionLink href="/dashboard/employee-leave" label="Leave Mgmt" color="amber"
                icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              <ActionLink href="/dashboard/payroll" label="Payroll" color="indigo"
                icon="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18v-.008zm-12 0h.008v.008H6v-.008z" />
              <ActionLink href="/dashboard/reports" label="Reports" color="slate"
                icon="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              <ActionLink href="/dashboard/settings" label="Settings" color="violet"
                icon="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionLink({ href, label, color, icon }: { href: string; label: string; color: string; icon: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-100 hover:border-emerald-200',
    teal: 'bg-teal-50 hover:bg-teal-100 text-teal-600 border-teal-100 hover:border-teal-200',
    amber: 'bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-100 hover:border-amber-200',
    indigo: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-100 hover:border-indigo-200',
    violet: 'bg-violet-50 hover:bg-violet-100 text-violet-600 border-violet-100 hover:border-violet-200',
    slate: 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-100 hover:border-slate-200',
  };
  return (
    <a href={href} className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-sm ${colorMap[color] || colorMap.slate}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <span className="text-xs font-semibold">{label}</span>
    </a>
  );
}
