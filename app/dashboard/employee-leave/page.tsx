'use client';

import { useRequirePermission } from '../../hooks/useRequirePermission';
import AccessDenied from '../../components/AccessDenied';
import LeavePage from '../leave/page';

export default function EmployeeLeavePage() {
  const { allowed, loading: permLoading } = useRequirePermission('leave', 'view');
  if (permLoading) return null;
  if (!allowed) return <AccessDenied module="Leave Management" />;
  return <LeavePage />;
}