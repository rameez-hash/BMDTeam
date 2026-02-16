'use client';

import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import AttendancePage from '../attendance/page';

export default function EmployeeAttendancePage() {
  const { allowed, loading: permLoading } = useRequirePermission('attendance', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Attendance" />;
  return <AttendancePage />;
}