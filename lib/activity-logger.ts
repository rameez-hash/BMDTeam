import prisma from './prisma';
import { NextRequest } from 'next/server';

interface LogActivityParams {
  userId: string;
  action: string;
  module: string;
  resourceId?: string;
  description: string;
  oldData?: object;
  newData?: object;
  request?: NextRequest;
}

export async function logActivity({
  userId,
  action,
  module,
  resourceId,
  description,
  oldData,
  newData,
  request,
}: LogActivityParams): Promise<void> {
  try {
    const ipAddress = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      request?.headers.get('x-real-ip') || 
                      (request as any)?.ip ||
                      '127.0.0.1';
    const userAgent = request?.headers.get('user-agent') || 'unknown';

    await prisma.activityLog.create({
      data: {
        userId,
        action,
        module,
        resourceId,
        description,
        ipAddress,
        userAgent,
        oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : undefined,
        newData: newData ? JSON.parse(JSON.stringify(newData)) : undefined,
      },
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
}

// Predefined action types
export const ActivityActions = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  
  // Employee
  EMPLOYEE_CREATE: 'EMPLOYEE_CREATE',
  EMPLOYEE_UPDATE: 'EMPLOYEE_UPDATE',
  EMPLOYEE_DELETE: 'EMPLOYEE_DELETE',
  
  // Attendance
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
  BREAK_START: 'BREAK_START',
  BREAK_END: 'BREAK_END',
  ATTENDANCE_CORRECTION_REQUEST: 'ATTENDANCE_CORRECTION_REQUEST',
  ATTENDANCE_CORRECTION_APPROVE: 'ATTENDANCE_CORRECTION_APPROVE',
  ATTENDANCE_CORRECTION_REJECT: 'ATTENDANCE_CORRECTION_REJECT',
  ATTENDANCE_CORRECTION_DELETE: 'ATTENDANCE_CORRECTION_DELETE',
  
  // Leave
  LEAVE_REQUEST: 'LEAVE_REQUEST',
  LEAVE_APPROVE: 'LEAVE_APPROVE',
  LEAVE_REJECT: 'LEAVE_REJECT',
  LEAVE_CANCEL: 'LEAVE_CANCEL',
  
  // Payroll
  SALARY_ASSIGN: 'SALARY_ASSIGN',
  SALARY_UPDATE: 'SALARY_UPDATE',
  PAYROLL_GENERATE: 'PAYROLL_GENERATE',
  PAYROLL_PROCESS: 'PAYROLL_PROCESS',
  PAYROLL_UPDATE: 'PAYROLL_UPDATE',
  PAYROLL_DELETE: 'PAYROLL_DELETE',
  
  // Settings
  DEPARTMENT_CREATE: 'DEPARTMENT_CREATE',
  DEPARTMENT_UPDATE: 'DEPARTMENT_UPDATE',
  DEPARTMENT_DELETE: 'DEPARTMENT_DELETE',
  DESIGNATION_CREATE: 'DESIGNATION_CREATE',
  DESIGNATION_UPDATE: 'DESIGNATION_UPDATE',
  SHIFT_CREATE: 'SHIFT_CREATE',
  SHIFT_UPDATE: 'SHIFT_UPDATE',
  SHIFT_DELETE: 'SHIFT_DELETE',
  TAX_SLAB_CREATE: 'TAX_SLAB_CREATE',
  TAX_SLAB_UPDATE: 'TAX_SLAB_UPDATE',
  TAX_SLAB_DELETE: 'TAX_SLAB_DELETE',
  LATE_RULE_CREATE: 'LATE_RULE_CREATE',
  LATE_RULE_UPDATE: 'LATE_RULE_UPDATE',
  LATE_RULE_DELETE: 'LATE_RULE_DELETE',
  
  // Announcements
  ANNOUNCEMENT_CREATE: 'ANNOUNCEMENT_CREATE',
  ANNOUNCEMENT_UPDATE: 'ANNOUNCEMENT_UPDATE',
  ANNOUNCEMENT_DELETE: 'ANNOUNCEMENT_DELETE',
  
  // Promotions & Increments
  PROMOTION_CREATE: 'PROMOTION_CREATE',
  INCREMENT_CREATE: 'INCREMENT_CREATE',
  TRANSFER_CREATE: 'TRANSFER_CREATE',
};

export const ActivityModules = {
  AUTH: 'AUTH',
  EMPLOYEE: 'EMPLOYEE',
  ATTENDANCE: 'ATTENDANCE',
  LEAVE: 'LEAVE',
  PAYROLL: 'PAYROLL',
  SALARY: 'SALARY',
  DEPARTMENT: 'DEPARTMENT',
  DESIGNATION: 'DESIGNATION',
  SHIFT: 'SHIFT',
  TAX_SLAB: 'TAX_SLAB',
  LATE_RULE: 'LATE_RULE',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  PROMOTION: 'PROMOTION',
};
