'use client';

import { useAuth } from '../../context/AuthContext';
import AccessDenied from '../../components/AccessDenied';
import AttendancePage from '../attendance/page';

export default function EmployeeAttendancePage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  // Allow access if user has an employee record OR has attendance.view permission
  const hasEmployee = !!user?.employee;
  const hasPermission = user?.role === 'ADMIN' || user?.permissions?.some(
    (p: { module: string; action: string }) => p.module === 'attendance' && p.action === 'view'
  );
  if (!hasEmployee && !hasPermission) return <AccessDenied module="Attendance" />;
  return <AttendancePage />;
}