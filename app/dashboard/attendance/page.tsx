'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import AttendanceCorrectionTab from './CorrectionTab';
import AttendanceCalendar from './AttendanceCalendar';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

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
  workLocation?: string;
  modifiedById?: string;
  modifiedAt?: string;
  modifyReason?: string;
  // Shift snapshot from check-in time
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  shiftGraceTime?: number;
  shiftStandardWorkHours?: number;
  shiftBreakDuration?: number;
  notes?: string;
  breaks?: AttendanceBreak[];
  employee?: {
    firstName: string;
    lastName: string;
    employeeCode?: string;
    department?: { name: string };
    shift?: { name: string; startTime: string; endTime: string };
  };
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
  workHours?: number;
  isLate?: boolean;
  lateMinutes?: number;
  shift?: Shift;
}

interface Shift {
  id: string;
  name: string;
  code?: string;
  startTime: string;
  endTime: string;
  breakDuration?: number;
  graceTime?: number;
  earlyCheckInGrace?: number;
  checkOutGrace?: number;
  standardWorkHours?: number;
  minCheckInGap?: number;
  halfDayThresholdMins?: number;
  autoHalfDay?: boolean;
  workDays?: number[];
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode?: string;
  department?: { name: string };
  shiftId?: string;
  shift?: Shift;
  joiningDate?: string;
}

interface AttendanceCorrection {
  id: string;
  date: string;
  status: string;
  reason: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  createdAt: string;
  rejectionReason?: string | null;
  employeeId?: string;
  employee?: { id?: string; firstName: string; lastName: string; employeeCode?: string };
  approvedBy?: { firstName: string; lastName: string };
  approvedAt?: string;
}

export default function AttendancePage() {
  const { token, user, hasPermission, getPermissionScope } = useAuth();
  const toast = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<'records' | 'corrections'>('records');

  // Records state
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );

  // Attendance tracker state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({
    isCheckedIn: false,
    isCheckedOut: false,
    isOnBreak: false,
    totalBreakMinutes: 0,
    currentWorkMinutes: 0,
  });
  const [workTimer, setWorkTimer] = useState('00:00:00');
  const [breakTimer, setBreakTimer] = useState('00:00');
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const workTimerRef = useRef<NodeJS.Timeout | null>(null);
  const breakTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generic confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string;
    variant: 'danger' | 'warning' | 'info' | 'success';
    confirmText: string; onConfirm: (input?: string) => void;
    showInput?: boolean; inputPlaceholder?: string; inputRequired?: boolean; inputLabel?: string;
  }>({ open: false, title: '', message: '', variant: 'info', confirmText: 'Confirm', onConfirm: () => {} });

  const openConfirm = (opts: Omit<typeof confirmDialog, 'open'>) => setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  // Corrections state
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [correctionsStatus, setCorrectionsStatus] = useState('');

  // Edit attendance modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({
    checkIn: '',
    checkOut: '',
    status: '',
    isLate: false,
    lateMinutes: 0,
    notes: '',
    workLocation: 'OFFICE',
    modifyReason: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Add attendance modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    employeeId: '',
    date: '',
    checkIn: '',
    checkOut: '',
    status: 'PRESENT',
    isLate: false,
    workLocation: 'OFFICE',
    notes: '',
  });
  const [addLoading, setAddLoading] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const isHR = user?.role === 'HR';
  const attendanceScope = getPermissionScope('attendance', 'view');
  const canViewOthers = attendanceScope === 'ALL' || attendanceScope === 'DEPARTMENT';
  const canManage = hasPermission('attendance', 'manage');
  const canCheckInOut = !!user?.employee;

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // ===== FETCH FUNCTIONS =====

  const fetchAttendanceStatus = useCallback(async () => {
    if (!user?.employee || !token) return;
    try {
      const res = await fetch('/api/attendance/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        const data = result.data || result;

        const isCheckedIn = data.status === 'CHECKED_IN';
        const isCheckedOut = data.status === 'CHECKED_OUT';
        const activeBreak = data.breaks?.find((b: { endTime?: string }) => !b.endTime);

        setAttendanceStatus({
          isCheckedIn,
          isCheckedOut,
          checkInTime: data.checkIn,
          checkOutTime: data.checkOut,
          isOnBreak: data.isOnBreak || !!activeBreak,
          breakStartTime: activeBreak?.startTime,
          totalBreakMinutes: data.totalBreakMinutes || 0,
          currentWorkMinutes: data.currentWorkMinutes || 0,
          workHours: data.workHours,
          isLate: data.isLate,
          lateMinutes: data.lateMinutes,
          shift: data.shift,
        });
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  }, [token, user?.employee]);

  // Work timer - separate ref from break timer
  useEffect(() => {
    if (workTimerRef.current) clearInterval(workTimerRef.current);

    if (attendanceStatus.isCheckedIn && attendanceStatus.checkInTime && !attendanceStatus.isCheckedOut) {
      const updateWorkTimer = () => {
        const checkIn = new Date(attendanceStatus.checkInTime!);
        const now = new Date();
        let diff = Math.floor((now.getTime() - checkIn.getTime()) / 1000);
        // Subtract completed break minutes
        diff -= (attendanceStatus.totalBreakMinutes || 0) * 60;
        // If currently on break, subtract current break time too
        if (attendanceStatus.isOnBreak && attendanceStatus.breakStartTime) {
          const breakStart = new Date(attendanceStatus.breakStartTime);
          diff -= Math.floor((now.getTime() - breakStart.getTime()) / 1000);
        }
        if (diff < 0) diff = 0;
        const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        setWorkTimer(`${hours}:${minutes}:${seconds}`);
      };
      updateWorkTimer();
      workTimerRef.current = setInterval(updateWorkTimer, 1000);
    } else if (attendanceStatus.isCheckedOut && attendanceStatus.workHours) {
      const totalSec = Math.round(attendanceStatus.workHours * 3600);
      const hours = Math.floor(totalSec / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
      const seconds = (totalSec % 60).toString().padStart(2, '0');
      setWorkTimer(`${hours}:${minutes}:${seconds}`);
    } else {
      setWorkTimer('00:00:00');
    }

    return () => {
      if (workTimerRef.current) clearInterval(workTimerRef.current);
    };
  }, [attendanceStatus]);

  // Break timer - separate ref
  useEffect(() => {
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);

    if (attendanceStatus.isOnBreak && attendanceStatus.breakStartTime) {
      const updateBreakTimer = () => {
        const breakStart = new Date(attendanceStatus.breakStartTime!);
        const now = new Date();
        const diff = Math.floor((now.getTime() - breakStart.getTime()) / 1000);
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        setBreakTimer(`${minutes}:${seconds}`);
      };
      updateBreakTimer();
      breakTimerRef.current = setInterval(updateBreakTimer, 1000);
    } else {
      setBreakTimer('00:00');
    }

    return () => {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    };
  }, [attendanceStatus.isOnBreak, attendanceStatus.breakStartTime]);

  const fetchEmployees = useCallback(async () => {
    if (!canViewOthers || !token) return;
    try {
      const deptParam = attendanceScope === 'DEPARTMENT' && user?.employee?.department?.id
        ? `&departmentId=${user.employee.department.id}` : '';
      const res = await fetch(`/api/employees?limit=500${deptParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        setEmployees(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  }, [token, canViewOthers, attendanceScope, user?.employee?.department?.id]);

  const fetchShifts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/shifts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const result = await res.json();
        setShifts(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch shifts:', error);
    }
  }, [token]);

  const fetchCorrections = useCallback(async () => {
    if (!canManage || !token) return;
    setCorrectionsLoading(true);
    try {
      const params = new URLSearchParams();
      if (correctionsStatus) params.append('status', correctionsStatus);
      const res = await fetch(`/api/attendance/corrections?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCorrections(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch corrections:', error);
    } finally {
      setCorrectionsLoading(false);
    }
  }, [token, canManage, correctionsStatus]);

  const fetchAttendance = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter) params.append('status', statusFilter);
      if (employeeFilter) params.append('employeeId', employeeFilter);
      params.append('limit', '100');

      const endpoint = (isAdmin || isHR) ? `/api/attendance/monitor?${params}` : `/api/attendance?${params}`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const result = await res.json();
        const recordsData = result.data || result.records || result.attendance || result;
        setRecords(Array.isArray(recordsData) ? recordsData : []);
      } else {
        setRecords([]);
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate, statusFilter, employeeFilter, isAdmin, isHR]);

  // Get selected shift for calendar props
  const getSelectedShift = useCallback((): Shift | null => {
    // If admin/HR selected a specific employee, use their shift
    if (employeeFilter) {
      const employee = employees.find(e => e.id === employeeFilter);
      if (employee?.shiftId) {
        return shifts.find(s => s.id === employee.shiftId) || null;
      }
    }
    // For regular employees viewing own attendance, use their shift from status API
    if (!canViewOthers && attendanceStatus.shift) {
      return attendanceStatus.shift;
    }
    return shifts.length > 0 ? shifts[0] : null;
  }, [employeeFilter, employees, shifts, canViewOthers, attendanceStatus.shift]);

  const selectedShift = getSelectedShift();

  // Month handling
  const handleMonthChange = (monthValue: string) => {
    setSelectedMonth(monthValue);
    if (monthValue) {
      const [year, month] = monthValue.split('-').map(Number);
      const lastDayNum = new Date(year, month, 0).getDate();
      setStartDate(`${year}-${String(month).padStart(2, '0')}-01`);
      setEndDate(`${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`);
    }
  };

  const getMonthOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    for (let month = 1; month <= 12; month++) {
      const monthDate = new Date(currentYear, month - 1, 1);
      options.push({
        value: `${currentYear}-${String(month).padStart(2, '0')}`,
        label: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      });
    }
    for (let month = 1; month <= 12; month++) {
      const monthDate = new Date(currentYear - 1, month - 1, 1);
      options.push({
        value: `${currentYear - 1}-${String(month).padStart(2, '0')}`,
        label: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      });
    }
    return options.reverse();
  };

  // Sync month selector with date range
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const isFirstDay = start.getDate() === 1;
      const isLastDay = end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
      if (isFirstDay && isLastDay && start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        setSelectedMonth(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`);
      }
    }
  }, [startDate, endDate]);

  // Initial load
  useEffect(() => {
    if (token) {
      fetchAttendance();
      fetchAttendanceStatus();
      fetchEmployees();
      fetchCorrections();
      fetchShifts();
    }
  }, [token, fetchAttendance, fetchAttendanceStatus, fetchEmployees, fetchCorrections, fetchShifts]);

  // Set default tab
  useEffect(() => {
    setActiveTab('records');
  }, []);

  // ===== ACTION HANDLERS =====

  const handleCheckInClick = () => {
    openConfirm({ title: 'Confirm Check In', message: 'Ready to start your work day?', variant: 'success', confirmText: '✓ Check In', onConfirm: handleCheckIn });
  };

  const handleCheckOutClick = () => {
    openConfirm({ title: 'Confirm Check Out', message: 'Done for the day? Make sure you have completed your work.', variant: 'danger', confirmText: '✓ Check Out', onConfirm: handleCheckOut });
  };

  const handleCheckIn = async () => {
    closeConfirm();
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workLocation: 'OFFICE' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Checked in successfully!');
        fetchAttendanceStatus();
        fetchAttendance();
      } else {
        toast.error(data.error || 'Check-in failed');
      }
    } catch {
      toast.error('Failed to check in. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    closeConfirm();
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Checked out successfully!');
        fetchAttendanceStatus();
        fetchAttendance();
      } else {
        toast.error(data.error || 'Check-out failed');
      }
    } catch {
      toast.error('Failed to check out. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartBreak = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/break/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Break started');
        fetchAttendanceStatus();
      } else {
        toast.error(data.error || 'Failed to start break');
      }
    } catch {
      toast.error('Failed to start break.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/break/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Break ended');
        fetchAttendanceStatus();
      } else {
        toast.error(data.error || 'Failed to end break');
      }
    } catch {
      toast.error('Failed to end break.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCorrectionDecision = (correction: AttendanceCorrection, status: 'APPROVED' | 'REJECTED') => {
    if (!canManage) return;
    const isReject = status === 'REJECTED';
    openConfirm({
      title: isReject ? 'Reject Correction' : 'Approve Correction',
      message: isReject ? 'Please provide a reason for rejecting this correction request.' : 'Add optional remarks for this approval.',
      variant: isReject ? 'danger' : 'success',
      confirmText: isReject ? 'Reject' : 'Approve',
      showInput: true,
      inputPlaceholder: isReject ? 'Rejection reason...' : 'Approval remarks (optional)...',
      inputRequired: isReject,
      inputLabel: isReject ? 'Rejection Reason' : 'Remarks',
      onConfirm: async (remarks?: string) => {
        closeConfirm();
        try {
          const res = await fetch(`/api/attendance/corrections/${correction.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status, rejectionReason: remarks || undefined }),
          });
          const data = await res.json();
          if (res.ok) {
            toast.success(data.message || `Request ${status.toLowerCase()}`);
            fetchCorrections();
          } else {
            toast.error(data.error || 'Failed to update request');
          }
        } catch {
          toast.error('Failed to update request');
        }
      },
    });
  };

  const handleDeleteAttendance = async (record: AttendanceRecord) => {
    if (!record.id || record.id.startsWith('weekend-')) {
      toast.error('This record cannot be deleted.');
      return;
    }
    openConfirm({
      title: 'Delete Attendance Record',
      message: 'Delete this attendance record? This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete Record',
      onConfirm: () => executeDeleteAttendance(record),
    });
  };

  const executeDeleteAttendance = async (record: AttendanceRecord) => {
    closeConfirm();
    setDeleteLoadingId(record.id);
    try {
      const res = await fetch(`/api/attendance?id=${record.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRecords(prev => prev.filter(r => r.id !== record.id));
        toast.success(data.message || 'Record deleted');
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete record');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleEditAttendance = (record: AttendanceRecord) => {
    if (!record.id || record.id.startsWith('weekend-')) {
      toast.error('This record cannot be edited.');
      return;
    }
    setEditingRecord(record);
    setEditForm({
      checkIn: record.checkIn ? new Date(record.checkIn).toISOString().slice(0, 16) : '',
      checkOut: record.checkOut ? new Date(record.checkOut).toISOString().slice(0, 16) : '',
      status: record.status || 'PRESENT',
      isLate: record.isLate || false,
      lateMinutes: 0,
      notes: '',
      workLocation: record.workLocation || 'OFFICE',
      modifyReason: '',
    });
    setShowEditModal(true);
  };

  const executeSaveEdit = async () => {
    closeConfirm();
    if (!editingRecord) return;
    setEditLoading(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: editingRecord.id,
          checkIn: editForm.checkIn || null,
          checkOut: editForm.checkOut || null,
          status: editForm.status,
          isLate: editForm.isLate,
          lateMinutes: editForm.lateMinutes,
          notes: editForm.notes,
          workLocation: editForm.workLocation,
          modifyReason: editForm.modifyReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecords(prev => prev.map(r => (r.id === editingRecord.id ? data.data : r)));
        toast.success('Record updated');
        setShowEditModal(false);
        setEditingRecord(null);
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update record');
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editingRecord) return;
    if (!editForm.modifyReason?.trim()) {
      toast.error('Please provide a reason for modification');
      return;
    }
    openConfirm({
      title: 'Confirm Edit',
      message: `Save changes to this attendance record? Status: ${editForm.status.replace('_', ' ')}`,
      variant: 'warning',
      confirmText: 'Save Changes',
      onConfirm: executeSaveEdit,
    });
  };

  const handleAddAttendance = (date: string, employeeId?: string) => {
    const dateObj = new Date(date);
    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    
    // Default check-in/check-out from selected shift (for night shift: check-out is next day)
    const shiftStart = selectedShift?.startTime || '09:00';
    const shiftEnd = selectedShift?.endTime || '18:00';
    const [sH] = shiftStart.split(':').map(Number);
    const [eH] = shiftEnd.split(':').map(Number);
    const isNight = sH > eH;
    
    let checkOutDateStr = dateStr;
    if (isNight) {
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      checkOutDateStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    }
    
    setAddForm({
      employeeId: employeeId || employeeFilter || '',
      date: dateStr,
      checkIn: `${dateStr}T${shiftStart}`,
      checkOut: `${checkOutDateStr}T${shiftEnd}`,
      status: 'PRESENT',
      isLate: false,
      workLocation: 'OFFICE',
      notes: '',
    });
    setShowAddModal(true);
  };

  const executeSaveAdd = async () => {
    closeConfirm();
    if (!addForm.employeeId || !addForm.date) {
      toast.error('Employee and date are required');
      return;
    }
    setAddLoading(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          employeeId: addForm.employeeId,
          date: addForm.date,
          checkIn: addForm.checkIn || null,
          checkOut: addForm.checkOut || null,
          status: addForm.status,
          isLate: addForm.isLate,
          workLocation: addForm.workLocation,
          notes: addForm.notes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Record created');
        setShowAddModal(false);
        fetchAttendance();
      } else {
        toast.error(data.error || 'Failed to create record');
      }
    } catch {
      toast.error('Failed to create record');
    } finally {
      setAddLoading(false);
    }
  };

  const handleSaveAdd = () => {
    if (!addForm.employeeId || !addForm.date) {
      toast.error('Employee and date are required');
      return;
    }
    const emp = employees.find(e => e.id === addForm.employeeId);
    const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'this employee';
    openConfirm({
      title: 'Confirm Add Record',
      message: `Create ${addForm.status.replace('_', ' ')} attendance record for ${empName} on ${addForm.date}?`,
      variant: 'info',
      confirmText: 'Add Record',
      onConfirm: executeSaveAdd,
    });
  };

  const handleDownload = async (format: 'csv' | 'pdf' = 'csv') => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (employeeFilter) params.append('employeeId', employeeFilter);
      if (statusFilter) params.append('status', statusFilter);
      params.append('format', format);

      const res = await fetch(`/api/attendance/download?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        if (format === 'pdf') {
          const html = await res.text();
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.onload = () => setTimeout(() => printWindow.print(), 500);
          }
        } else {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `attendance-${startDate}-to-${endDate}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error('Failed to download:', error);
    }
  };

  // ===== HELPERS =====

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
      PRESENT: 'success', LATE: 'warning', HALF_DAY: 'info',
      ABSENT: 'danger', ON_LEAVE: 'default', WEEKEND: 'default', HOLIDAY: 'default', NOT_JOINED: 'default',
    };
    const labels: Record<string, string> = { WEEKEND: 'Weekend Off', HOLIDAY: 'Holiday', NOT_JOINED: 'Not Joined' };
    return <Badge variant={variants[status] || 'default'}>{labels[status] || status.replace('_', ' ')}</Badge>;
  };

  const formatTimeStr = (dateString?: string) => {
    if (!dateString) return '--:--:--';
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const recordsArray = Array.isArray(records) ? records : [];
  // Late count — ONLY use DB isLate field, never recalculate from shift times
  // This ensures changing shift settings does NOT affect previous records
  const computedLateCount = recordsArray.filter(r => r.isLate === true).length;
  const stats = {
    present: recordsArray.filter(r => r.status === 'PRESENT').length,
    halfDay: recordsArray.filter(r => r.status === 'HALF_DAY').length,
    late: computedLateCount,
    absent: recordsArray.filter(r => r.status === 'ABSENT').length,
    onLeave: recordsArray.filter(r => r.status === 'ON_LEAVE').length,
    weekend: recordsArray.filter(r => r.status === 'WEEKEND').length,
    holiday: recordsArray.filter(r => r.status === 'HOLIDAY').length,
    totalHours: recordsArray.reduce((sum, r) => sum + (r.workHours || 0), 0),
  };

  // ===== RENDER =====

  return (
    <>
      <div className="space-y-6" suppressHydrationWarning>
        {/* Page Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">{canViewOthers ? 'Attendance Management' : 'My Attendance'}</h1>
              <p className="text-teal-100 text-sm mt-0.5">{canViewOthers ? 'Monitor and manage employee attendance' : 'Track your attendance and work hours'}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('records')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'records' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Records
          </button>
          <button
            onClick={() => setActiveTab('corrections')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'corrections' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Corrections
          </button>
        </div>

        {/* ===== RECORDS TAB ===== */}
        {activeTab === 'records' && (
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <Card className="bg-emerald-50 border-emerald-200">
                <div className="text-center py-1">
                  <p className="text-emerald-600 text-xs font-medium uppercase tracking-wide">Present</p>
                  <p className="text-2xl font-bold text-emerald-700">{stats.present}</p>
                </div>
              </Card>
              <Card className="bg-teal-50 border-teal-200">
                <div className="text-center py-1">
                  <p className="text-teal-600 text-xs font-medium uppercase tracking-wide">Half Day</p>
                  <p className="text-2xl font-bold text-teal-700">{stats.halfDay}</p>
                </div>
              </Card>
              <Card className="bg-amber-50 border-amber-200">
                <div className="text-center py-1">
                  <p className="text-amber-600 text-xs font-medium uppercase tracking-wide">Late</p>
                  <p className="text-2xl font-bold text-amber-700">{stats.late}</p>
                </div>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <div className="text-center py-1">
                  <p className="text-red-600 text-xs font-medium uppercase tracking-wide">Absent</p>
                  <p className="text-2xl font-bold text-red-700">{stats.absent}</p>
                </div>
              </Card>
              <Card className="bg-purple-50 border-purple-200">
                <div className="text-center py-1">
                  <p className="text-purple-600 text-xs font-medium uppercase tracking-wide">On Leave</p>
                  <p className="text-2xl font-bold text-purple-700">{stats.onLeave}</p>
                </div>
              </Card>
              <Card className="bg-yellow-50 border-yellow-200">
                <div className="text-center py-1">
                  <p className="text-yellow-600 text-xs font-medium uppercase tracking-wide">Weekend</p>
                  <p className="text-2xl font-bold text-yellow-700">{stats.weekend}</p>
                </div>
              </Card>
              <Card className="bg-emerald-50 border-emerald-200">
                <div className="text-center py-1">
                  <p className="text-emerald-600 text-xs font-medium uppercase tracking-wide">Total Hrs</p>
                  <p className="text-2xl font-bold text-emerald-700">{stats.totalHours.toFixed(1)}</p>
                </div>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {canViewOthers && (
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Employee</label>
                      <Select
                        value={employeeFilter}
                        onChange={(e) => setEmployeeFilter(e.target.value)}
                        options={[
                          { value: '', label: 'All Employees' },
                          ...employees.map(emp => ({
                            value: emp.id,
                            label: `${emp.employeeCode || ''} - ${emp.firstName} ${emp.lastName}`,
                          })),
                        ]}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Month</label>
                    <Select
                      value={selectedMonth}
                      onChange={(e) => handleMonthChange(e.target.value)}
                      options={[{ value: '', label: 'Custom Range' }, ...getMonthOptions()]}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">From</label>
                    <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setSelectedMonth(''); }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">To</label>
                    <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setSelectedMonth(''); }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Status</label>
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      options={[
                        { value: '', label: 'All Status' },
                        { value: 'PRESENT', label: 'Present' },
                        { value: 'LATE', label: 'Late' },
                        { value: 'HALF_DAY', label: 'Half Day' },
                        { value: 'ABSENT', label: 'Absent' },
                        { value: 'ON_LEAVE', label: 'On Leave' },
                        { value: 'WEEKEND', label: 'Weekend' },
                        { value: 'HOLIDAY', label: 'Holiday' },
                      ]}
                    />
                  </div>
                </div>
                <div>
                  <Button onClick={fetchAttendance} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm">
                    Apply Filters
                  </Button>
                </div>
              </div>
            </Card>

            {/* Export Bar — shows context about what will be downloaded */}
            {canViewOthers && recordsArray.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 border border-emerald-200 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      {employeeFilter
                        ? `${employees.find(e => e.id === employeeFilter)?.firstName || ''} ${employees.find(e => e.id === employeeFilter)?.lastName || ''}`.trim()
                        : 'All Employees'}
                      {statusFilter && <span className="ml-1.5 text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">{statusFilter.replace('_', ' ')}</span>}
                    </p>
                    <p className="text-xs text-emerald-600">
                      {new Date(startDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(endDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}{recordsArray.length} record{recordsArray.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDownload('csv')} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50 transition-all shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export CSV
                  </button>
                  <button onClick={() => handleDownload('pdf')} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    Download PDF
                  </button>
                </div>
              </div>
            )}

            {/* Records View */}
            <Card padding={false}>
              <CardHeader>
                <div className="flex items-center justify-between w-full">
                  <CardTitle className="text-base">
                    {canViewOthers
                      ? employeeFilter
                        ? `${employees.find(e => e.id === employeeFilter)?.firstName || ''} ${employees.find(e => e.id === employeeFilter)?.lastName || ''}`
                        : 'All Employees'
                      : 'My Attendance'}
                  </CardTitle>

                </div>
              </CardHeader>
              <CardContent>
                  <AttendanceCalendar
                    records={recordsArray}
                    startDate={startDate}
                    endDate={endDate}
                    onEdit={handleEditAttendance}
                    onDelete={handleDeleteAttendance}
                    onAddAttendance={handleAddAttendance}
                    canEdit={canManage}
                    deleteLoadingId={deleteLoadingId}
                    selectedEmployeeId={employeeFilter}
                    shiftName={selectedShift?.name || 'General'}
                    shiftStartTime={selectedShift?.startTime || '09:00'}
                    shiftEndTime={selectedShift?.endTime || '18:00'}
                    standardWorkHours={selectedShift?.standardWorkHours || 9}
                    graceTime={selectedShift?.graceTime || 15}
                    earlyCheckInGrace={selectedShift?.earlyCheckInGrace || 30}
                    checkOutGrace={selectedShift?.checkOutGrace || 15}
                    breakDuration={selectedShift?.breakDuration || 60}
                    workDays={selectedShift?.workDays}
                    employeeJoiningDate={employeeFilter ? employees.find(e => e.id === employeeFilter)?.joiningDate : null}
                  />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== CORRECTIONS TAB ===== */}
        {activeTab === 'corrections' && (
          canManage ? (
            <div className="space-y-4">
              {/* Status filters - pill style like leave page */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: '', label: 'All' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                ].map(f => (
                  <button key={f.value} onClick={() => setCorrectionsStatus(f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      correctionsStatus === f.value
                        ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                        : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                    }`}>
                    {f.label} ({f.value === '' ? corrections.length : corrections.filter(c => c.status === f.value).length})
                  </button>
                ))}
              </div>

              {/* Correction cards */}
              {correctionsLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2"><div className="skeleton h-4 w-32 rounded-lg" /><div className="skeleton h-4 w-16 rounded-lg" /></div>
                          <div className="flex items-center gap-3"><div className="skeleton h-3 w-20 rounded-lg" /><div className="skeleton h-3 w-36 rounded-lg" /></div>
                        </div>
                        <div className="skeleton h-6 w-20 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : corrections.length > 0 ? (
                <div className="space-y-3">
                  {corrections.map(c => {
                    const fmtTime = (iso?: string | null) => {
                      if (!iso) return null;
                      try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
                    };
                    return (
                      <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Employee name + code + date */}
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-slate-900 text-sm">
                                {c.employee ? `${c.employee.firstName} ${c.employee.lastName}` : '—'}
                              </h3>
                              {c.employee?.employeeCode && <Badge variant="info" size="sm">{c.employee.employeeCode}</Badge>}
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-500 font-medium">
                                {new Date(c.date).toLocaleDateString('en-PK', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>

                            {/* Reason */}
                            <p className="text-xs text-slate-500 mt-1">{c.reason}</p>

                            {/* Requested times */}
                            {(c.requestedCheckIn || c.requestedCheckOut) && (
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                {c.requestedCheckIn && (
                                  <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" /></svg>
                                    In: {fmtTime(c.requestedCheckIn)}
                                  </span>
                                )}
                                {c.requestedCheckOut && (
                                  <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16l4-4m0 0l-4-4m4 4H3" /></svg>
                                    Out: {fmtTime(c.requestedCheckOut)}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Approved info with approver name */}
                            {c.status === 'APPROVED' && c.approvedBy && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  {c.approvedBy.firstName} {c.approvedBy.lastName}
                                </span>
                                {c.approvedAt && <span className="text-[10px] text-slate-400">on {new Date(c.approvedAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</span>}
                                {c.rejectionReason && <span className="text-[10px] text-emerald-600 italic">&ldquo;{c.rejectionReason}&rdquo;</span>}
                              </div>
                            )}
                            {/* Rejected info with rejecter name */}
                            {c.status === 'REJECTED' && (
                              <div className="flex items-center gap-1.5 mt-2">
                                {c.approvedBy && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    {c.approvedBy.firstName} {c.approvedBy.lastName}
                                  </span>
                                )}
                                {c.rejectionReason && <span className="text-[10px] text-red-600 italic">&ldquo;{c.rejectionReason}&rdquo;</span>}
                              </div>
                            )}
                          </div>

                          {/* Right side: status + actions */}
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Badge variant={c.status === 'PENDING' ? 'warning' : c.status === 'APPROVED' ? 'success' : 'danger'}>{c.status}</Badge>
                            {c.status === 'PENDING' && c.employee?.id !== user?.employee?.id ? (
                              <div className="flex gap-1">
                                <button onClick={() => handleCorrectionDecision(c, 'APPROVED')}
                                  className="w-8 h-8 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg flex items-center justify-center text-sm transition-colors">✓</button>
                                <button onClick={() => handleCorrectionDecision(c, 'REJECTED')}
                                  className="w-8 h-8 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg flex items-center justify-center text-sm transition-colors">✕</button>
                              </div>
                            ) : c.status === 'PENDING' ? (
                              <span className="text-[10px] text-slate-400 italic">Own request</span>
                            ) : null}
                            <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
                  <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.251 2.251 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>
                  <h3 className="font-semibold text-slate-700">No Correction Requests</h3>
                  <p className="text-sm text-slate-500">{correctionsStatus ? 'Try a different filter' : 'No correction requests found'}</p>
                </div>
              )}
            </div>
          ) : (
            <AttendanceCorrectionTab employeeId={user?.employee?.id || ''} />
          )
        )}
      </div>

      {/* ===== MODALS ===== */}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={closeConfirm}
        onConfirm={(input) => { confirmDialog.onConfirm(input); }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        showInput={confirmDialog.showInput}
        inputPlaceholder={confirmDialog.inputPlaceholder}
        inputRequired={confirmDialog.inputRequired}
        inputLabel={confirmDialog.inputLabel}
      />

      {/* Edit Modal */}
      {showEditModal && editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Attendance Record</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
                <input type="text" value={`${editingRecord.employee?.firstName || ''} ${editingRecord.employee?.lastName || ''}`.trim() || 'Unknown'} disabled className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input type="text" value={editingRecord.date ? new Date(editingRecord.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''} disabled className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={editForm.status} onChange={(e) => {
                  const newStatus = e.target.value;
                  const noTimeNeeded = ['ON_LEAVE', 'ABSENT', 'HOLIDAY', 'WEEKEND'].includes(newStatus);
                  setEditForm({ ...editForm, status: newStatus, ...(noTimeNeeded ? { checkIn: '', checkOut: '', isLate: false } : {}) });
                }} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 hover:border-slate-300 transition-all duration-200 appearance-none cursor-pointer" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', backgroundRepeat: 'no-repeat', paddingRight: '2.5rem' }}>
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="HOLIDAY">Holiday</option>
                </select>
              </div>
              {editForm.status === 'HALF_DAY' && (() => {
                const emp = employees.find(e => `${e.firstName} ${e.lastName}` === `${editingRecord.employee?.firstName || ''} ${editingRecord.employee?.lastName || ''}`);
                const threshold = emp?.shift?.halfDayThresholdMins ?? 240;
                const thresholdH = Math.floor(threshold / 60);
                const thresholdM = threshold % 60;
                let workedMins = 0;
                if (editForm.checkIn && editForm.checkOut) {
                  workedMins = Math.round((new Date(editForm.checkOut).getTime() - new Date(editForm.checkIn).getTime()) / 60000);
                } else if (editingRecord.workHours) {
                  workedMins = Math.round(editingRecord.workHours * 60);
                }
                const workedH = Math.floor(workedMins / 60);
                const workedM = workedMins % 60;
                const isOverThreshold = workedMins >= threshold;
                return (
                  <div className={`rounded-lg p-3 text-sm ${isOverThreshold ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-teal-50 border border-teal-200 text-teal-700'}`}>
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg>
                      <div>
                        <p className="font-semibold">Half Day Threshold: {thresholdH}h {thresholdM > 0 ? `${thresholdM}m` : ''}</p>
                        {workedMins > 0 && (
                          <p className="mt-0.5">
                            Employee worked <span className="font-bold">{workedH}h {workedM}m</span>
                            {isOverThreshold
                              ? ' — exceeds threshold, consider marking as Present instead'
                              : ' — below threshold, Half Day is appropriate'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {['ON_LEAVE', 'ABSENT', 'HOLIDAY', 'WEEKEND'].includes(editForm.status) ? (
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-500 text-center">
                  {editForm.status === 'ON_LEAVE' ? '📋 Leave day — no check-in/check-out required' : editForm.status === 'ABSENT' ? '❌ Absent — no check-in/check-out required' : editForm.status === 'HOLIDAY' ? '🎉 Holiday — no check-in/check-out required' : '🏖️ Weekend — no check-in/check-out required'}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Check In</label>
                      <input type="datetime-local" value={editForm.checkIn} onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Check Out</label>
                      <input type="datetime-local" value={editForm.checkOut} onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                      <select value={editForm.workLocation} onChange={(e) => setEditForm({ ...editForm, workLocation: e.target.value })} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 hover:border-slate-300 transition-all duration-200 appearance-none cursor-pointer" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', backgroundRepeat: 'no-repeat', paddingRight: '2.5rem' }}>
                        <option value="OFFICE">Office</option>
                        <option value="REMOTE">Remote</option>
                        <option value="HYBRID">Hybrid</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="editIsLate" checked={editForm.isLate} onChange={(e) => setEditForm({ ...editForm, isLate: e.target.checked })} className="w-4 h-4" />
                    <label htmlFor="editIsLate" className="text-sm text-slate-700">Mark as Late</label>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason <span className="text-rose-500">*</span></label>
                <textarea value={editForm.modifyReason} onChange={(e) => setEditForm({ ...editForm, modifyReason: e.target.value })} placeholder="Why are you modifying this record?" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="secondary" className="flex-1" onClick={() => { setShowEditModal(false); setEditingRecord(null); }}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveEdit} loading={editLoading}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Add Attendance Record</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Employee <span className="text-rose-500">*</span></label>
                <select value={addForm.employeeId} onChange={(e) => setAddForm({ ...addForm, employeeId: e.target.value })} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 hover:border-slate-300 transition-all duration-200 appearance-none cursor-pointer" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', backgroundRepeat: 'no-repeat', paddingRight: '2.5rem' }} required>
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.employeeCode} - {emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date <span className="text-rose-500">*</span></label>
                <input type="date" value={addForm.date} onChange={(e) => {
                  const d = e.target.value;
                  setAddForm({ ...addForm, date: d, checkIn: `${d}T09:00`, checkOut: `${d}T18:00` });
                }} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={addForm.status} onChange={(e) => {
                  const newStatus = e.target.value;
                  const noTimeNeeded = ['ON_LEAVE', 'ABSENT'].includes(newStatus);
                  setAddForm({ ...addForm, status: newStatus, ...(noTimeNeeded ? { checkIn: '', checkOut: '' } : {}) });
                }} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 hover:border-slate-300 transition-all duration-200 appearance-none cursor-pointer" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', backgroundRepeat: 'no-repeat', paddingRight: '2.5rem' }}>
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="HALF_DAY">Half Day</option>
                </select>
              </div>
              {addForm.status === 'HALF_DAY' && (() => {
                const emp = employees.find(e => e.id === addForm.employeeId);
                const threshold = emp?.shift?.halfDayThresholdMins ?? 240;
                const thresholdH = Math.floor(threshold / 60);
                const thresholdM = threshold % 60;
                let workedMins = 0;
                if (addForm.checkIn && addForm.checkOut) {
                  workedMins = Math.round((new Date(addForm.checkOut).getTime() - new Date(addForm.checkIn).getTime()) / 60000);
                }
                const workedH = Math.floor(workedMins / 60);
                const workedM = workedMins % 60;
                const isOverThreshold = workedMins > 0 && workedMins >= threshold;
                return (
                  <div className={`rounded-lg p-3 text-sm ${isOverThreshold ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-teal-50 border border-teal-200 text-teal-700'}`}>
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg>
                      <div>
                        <p className="font-semibold">Half Day Threshold: {thresholdH}h {thresholdM > 0 ? `${thresholdM}m` : ''}</p>
                        {workedMins > 0 && (
                          <p className="mt-0.5">
                            Work time: <span className="font-bold">{workedH}h {workedM}m</span>
                            {isOverThreshold
                              ? ' — exceeds threshold, consider marking as Present instead'
                              : ' — below threshold, Half Day is appropriate'}
                          </p>
                        )}
                        {!addForm.employeeId && <p className="mt-0.5 text-slate-400">Select employee to see their shift threshold</p>}
                      </div>
                    </div>
                  </div>
                );
              })()}
              {['ON_LEAVE', 'ABSENT'].includes(addForm.status) ? (
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-500 text-center">
                  {addForm.status === 'ON_LEAVE' ? '📋 Leave day — no check-in/check-out required' : '❌ Absent — no check-in/check-out required'}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Check In</label>
                      <input type="datetime-local" value={addForm.checkIn} onChange={(e) => setAddForm({ ...addForm, checkIn: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Check Out</label>
                      <input type="datetime-local" value={addForm.checkOut} onChange={(e) => setAddForm({ ...addForm, checkOut: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                    <select value={addForm.workLocation} onChange={(e) => setAddForm({ ...addForm, workLocation: e.target.value })} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 hover:border-slate-300 transition-all duration-200 appearance-none cursor-pointer" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em', backgroundRepeat: 'no-repeat', paddingRight: '2.5rem' }}>
                      <option value="OFFICE">Office</option>
                      <option value="REMOTE">Remote</option>
                      <option value="HYBRID">Hybrid</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="secondary" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveAdd} loading={addLoading}>Add Record</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
