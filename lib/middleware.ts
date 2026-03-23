import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader, AuthUser } from './auth';
import prisma from './prisma';
import { Role } from '@prisma/client';
import { checkPermission, PermissionCheckResult } from './permissions';

export type AuthenticatedRequest = NextRequest & {
  user: AuthUser;
};

// In-memory auth cache (30s TTL) to avoid DB hit on every API call
const authCache = new Map<string, { user: AuthUser; expiresAt: number }>();
const AUTH_CACHE_TTL = 30_000; // 30 seconds

export async function authenticate(
  request: NextRequest
): Promise<{ user: AuthUser | null; error: NextResponse | null }> {
  const authHeader = request.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  const payload = verifyToken(token);
  if (!payload) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      ),
    };
  }

  // Check cache first
  const cached = authCache.get(payload.userId);
  if (cached && cached.expiresAt > Date.now()) {
    return { user: cached.user, error: null };
  }

  // Get employee ID and department from database
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { employee: { select: { id: true, departmentId: true } } },
  });

  if (!user || !user.isActive) {
    authCache.delete(payload.userId);
    return {
      user: null,
      error: NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 401 }
      ),
    };
  }

  const authUser: AuthUser = {
    ...payload,
    employeeDbId: user.employee?.id,
    departmentId: user.employee?.departmentId || undefined,
  };

  // Cache the result
  authCache.set(payload.userId, { user: authUser, expiresAt: Date.now() + AUTH_CACHE_TTL });

  return { user: authUser, error: null };
}

// Legacy role-based checks (kept for backward compat, ADMIN always passes)
export function requireRoles(...allowedRoles: Role[]) {
  return async (
    request: NextRequest
  ): Promise<{ user: AuthUser | null; error: NextResponse | null }> => {
    const { user, error } = await authenticate(request);
    
    if (error) {
      return { user: null, error };
    }

    if (!user || !allowedRoles.includes(user.role)) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        ),
      };
    }

    return { user, error: null };
  };
}

// NEW: Permission-based middleware
export function requirePermission(module: string, action: string) {
  return async (
    request: NextRequest
  ): Promise<{ user: AuthUser | null; error: NextResponse | null; permResult: PermissionCheckResult | null }> => {
    const { user, error } = await authenticate(request);
    
    if (error) {
      return { user: null, error, permResult: null };
    }

    if (!user) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        ),
        permResult: null,
      };
    }

    const result = await checkPermission(user.userId, user.role, module, action);
    
    if (!result.allowed) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'You do not have permission to perform this action' },
          { status: 403 }
        ),
        permResult: null,
      };
    }

    return { user, error: null, permResult: result };
  };
}

export const requireAdmin = requireRoles('ADMIN');
export const requireAdminOrHR = requireRoles('ADMIN', 'HR');
export const requireManager = requireRoles('ADMIN', 'HR', 'MANAGER');
export const requireAnyAuth = requireRoles('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE');
