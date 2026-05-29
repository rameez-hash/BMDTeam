'use client';

import { useAuth } from '../../context/AuthContext';
import AccessDenied from '../../components/AccessDenied';
import LeavePage from '../leave/page';

export default function EmployeeLeavePage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  // Allow access if user has an employee record OR has leave.view permission
  const hasEmployee = !!user?.employee;
  const hasPermission = user?.role === 'ADMIN' || user?.permissions?.some(
    (p: { module: string; action: string }) => p.module === 'leave' && p.action === 'view'
  );
  if (!hasEmployee && !hasPermission) return <AccessDenied module="Leave Management" />;
  return <LeavePage />;
}