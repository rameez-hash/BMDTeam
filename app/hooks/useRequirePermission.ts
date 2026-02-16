'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

interface UseRequirePermissionResult {
  allowed: boolean;
  loading: boolean;
  scope: 'ALL' | 'DEPARTMENT' | 'SELF' | null;
}

/**
 * Hook to enforce page-level permission checks.
 * Returns { allowed, loading, scope } for the given module.action permission.
 * If the user doesn't have the permission, they are not redirected — the page
 * should render an access denied state based on `allowed`.
 * 
 * @param module - Permission module (e.g., 'employees', 'payroll')
 * @param action - Permission action (e.g., 'view', 'manage')
 */
export function useRequirePermission(module: string, action: string): UseRequirePermissionResult {
  const { user, loading: authLoading, hasPermission, getPermissionScope } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      setChecked(true);
    }
  }, [authLoading, user]);

  if (authLoading || !checked) {
    return { allowed: false, loading: true, scope: null };
  }

  if (!user) {
    return { allowed: false, loading: false, scope: null };
  }

  const allowed = hasPermission(module, action);
  const scope = getPermissionScope(module, action);

  return { allowed, loading: false, scope };
}
