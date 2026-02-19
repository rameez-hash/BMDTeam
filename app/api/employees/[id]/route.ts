export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { notify } from '@/lib/notifications';
import { parseDateUTC } from '@/lib/utils';

// GET /api/employees/[id] - Get employee details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { id } = await params;

    // Support lookup by UUID or employeeCode
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const employee = await prisma.employee.findFirst({
      where: isUUID ? { id } : { employeeCode: id },
      include: {
        user: { select: { role: true, isActive: true, lastLogin: true, createdAt: true } },
        department: true,
        shift: true,
        reportingManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            email: true,
          },
        },
        subordinates: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          },
        },
        education: true,
        experience: true,
        emergencyContacts: true,
        salary: true,
        appRole: { select: { id: true, name: true, color: true } },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Check permissions using dynamic permission system
    const isOwnProfile = employee.userId === user!.userId;
    if (!isOwnProfile) {
      const perm = await checkPermission(user!.userId, user!.role, 'employees', 'view');
      if (!perm.allowed) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      // DEPARTMENT scope: can only view employees in same department
      if (perm.scope === 'DEPARTMENT' && user!.departmentId && employee.departmentId !== user!.departmentId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error('Get employee error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/employees/[id] - Update employee
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { id } = await params;
    
    // Validate ID
    if (!id || id.trim() === '') {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request data. Please check your input.' },
        { status: 400 }
      );
    }

    // Get existing employee
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const existingEmployee = await prisma.employee.findFirst({
      where: isUUID ? { id } : { employeeCode: id },
      include: { user: true },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found. The record may have been deleted.' },
        { status: 404 }
      );
    }

    // Check permissions
    const isOwnProfile = existingEmployee.userId === user!.userId;
    const editPerm = await checkPermission(user!.userId, user!.role, 'employees', 'edit');
    const canEditOthers = editPerm.allowed;

    if (!isOwnProfile && !canEditOthers) {
      return NextResponse.json(
        { error: 'You do not have permission to update this employee record.' },
        { status: 403 }
      );
    }

    // Validation for admin/HR updates
    const validationErrors: string[] = [];
    
    if (canEditOthers) {
      // Check required fields if they are being updated
      if (body.firstName !== undefined && (!body.firstName || body.firstName.trim() === '')) {
        validationErrors.push('First name cannot be empty');
      }
      if (body.lastName !== undefined && (!body.lastName || body.lastName.trim() === '')) {
        validationErrors.push('Last name cannot be empty');
      }
      if (body.email !== undefined) {
        if (!body.email || body.email.trim() === '') {
          validationErrors.push('Email cannot be empty');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
          validationErrors.push('Invalid email format');
        }
      }
      if (body.password !== undefined && body.password.trim() !== '' && body.password.length < 6) {
        validationErrors.push('Password must be at least 6 characters');
      }
    }

    // Phone validation
    if (body.phone && !/^[+]?[\d\s-]{10,15}$/.test(body.phone.replace(/\s/g, ''))) {
      validationErrors.push('Invalid phone number format');
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors.join('. '), errors: validationErrors },
        { status: 400 }
      );
    }

    // Extract salary and role data
    const { 
      basicSalary, hra, da, ta, medicalAllowance, otherAllowances,
      pf, esi, professionalTax, tds, otherDeductions,
      role, appRoleId, probationPeriod, password,
      noticePeriodMonths: noticePeriodMonthsRaw,
      probationMonths: probationMonthsRaw,
      ...employeeData 
    } = body;

    // Calculate probation end date
    const probMonths = parseInt(probationPeriod || probationMonthsRaw || '0') || 0;
    if (probMonths) {
      employeeData.probationMonths = probMonths;
      if (employeeData.joiningDate) {
        const jd = parseDateUTC(employeeData.joiningDate);
        employeeData.probationEndDate = new Date(new Date(jd).setMonth(jd.getMonth() + probMonths));
      }
    } else {
      employeeData.probationMonths = null;
      employeeData.probationEndDate = null;
    }

    // Calculate notice period end date
    const noticeMonths = parseInt(noticePeriodMonthsRaw || '0') || 0;
    if (noticeMonths) {
      employeeData.noticePeriodMonths = noticeMonths;
      if (employeeData.employmentStatus === 'ON_NOTICE') {
        const now = new Date();
        employeeData.noticePeriodEndDate = new Date(now.setMonth(now.getMonth() + noticeMonths));
      }
    } else {
      employeeData.noticePeriodMonths = null;
      employeeData.noticePeriodEndDate = null;
    }

    // Whitelist of valid Employee model fields to prevent Prisma errors
    const allowedEmployeeFields = new Set([
      'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender',
      'maritalStatus', 'bloodGroup', 'nationality', 'address', 'city',
      'state', 'country', 'zipCode', 'profileImage', 'departmentId',
      'designation', 'shiftId', 'reportingManagerId', 'joiningDate',
      'attendanceStartDate', 'confirmationDate', 'resignationDate', 'relievingDate',
      'employmentStatus', 'employmentType', 'probationMonths', 'probationEndDate',
      'noticePeriodMonths', 'noticePeriodEndDate', 'bankName', 'bankAccountNumber',
      'ifscCode', 'panNumber', 'branchAddress',
    ]);

    // Strip any fields not in the Prisma Employee model
    Object.keys(employeeData).forEach(key => {
      if (!allowedEmployeeFields.has(key)) {
        delete employeeData[key];
      }
    });

    // Employees can only update certain fields
    let updateData = employeeData;
    if (!canEditOthers) {
      // Limit what employees can update
      updateData = {
        phone: body.phone,
        address: body.address,
        city: body.city,
        state: body.state,
        country: body.country,
        zipCode: body.zipCode,
        profileImage: body.profileImage,
        bankName: body.bankName,
        bankAccountNumber: body.bankAccountNumber,
        ifscCode: body.ifscCode,
        panNumber: body.panNumber,
        branchAddress: body.branchAddress,
      };
    }

    // Process date fields - handle empty strings and invalid dates
    const processDate = (dateValue: unknown): Date | null | undefined => {
      if (dateValue === undefined) return undefined; // Don't update if not provided
      if (dateValue === null || dateValue === '') return null; // Clear the field
      if (typeof dateValue === 'string' && dateValue.trim() !== '') {
        const parsed = parseDateUTC(dateValue);
        if (!isNaN(parsed.getTime())) return parsed;
      }
      return undefined; // Invalid date, don't update
    };

    const dateOfBirth = processDate(updateData.dateOfBirth);
    const joiningDate = processDate(updateData.joiningDate);
    const attendanceStartDate = processDate(updateData.attendanceStartDate);
    const confirmationDate = processDate(updateData.confirmationDate);
    const resignationDate = processDate(updateData.resignationDate);
    const relievingDate = processDate(updateData.relievingDate);

    // Remove original date fields and add processed ones
    delete updateData.dateOfBirth;
    delete updateData.joiningDate;
    delete updateData.attendanceStartDate;
    delete updateData.confirmationDate;
    delete updateData.resignationDate;
    delete updateData.relievingDate;

    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (joiningDate !== undefined) updateData.joiningDate = joiningDate;
    if (attendanceStartDate !== undefined) updateData.attendanceStartDate = attendanceStartDate;
    if (confirmationDate !== undefined) updateData.confirmationDate = confirmationDate;
    if (resignationDate !== undefined) updateData.resignationDate = resignationDate;
    if (relievingDate !== undefined) updateData.relievingDate = relievingDate;

    // Calculate confirmation date from probation period
    if (probationPeriod && joiningDate && !confirmationDate) {
      const joinDate = new Date(joiningDate);
      updateData.confirmationDate = new Date(joinDate.setMonth(joinDate.getMonth() + parseInt(probationPeriod)));
    }

    // Handle empty strings for optional foreign keys - use connect/disconnect for relations
    // Extract relation IDs before updating
    const departmentId = updateData.departmentId;
    const shiftId = updateData.shiftId;
    delete updateData.departmentId;
    delete updateData.shiftId;

    // Build relation updates using connect/disconnect syntax
    if (departmentId !== undefined) {
      if (departmentId === '' || departmentId === null) {
        updateData.department = { disconnect: true };
      } else {
        updateData.department = { connect: { id: departmentId } };
      }
    }
    
    if (shiftId !== undefined) {
      if (shiftId === '' || shiftId === null) {
        updateData.shift = { disconnect: true };
      } else {
        updateData.shift = { connect: { id: shiftId } };
      }
    }

    // Handle appRole assignment
    if (canEditOthers && appRoleId !== undefined) {
      if (appRoleId === '' || appRoleId === null) {
        updateData.appRole = { disconnect: true };
      } else {
        updateData.appRole = { connect: { id: appRoleId } };
      }
    }

    // Handle enum fields - only include if valid, otherwise remove
    if (updateData.gender !== undefined) {
      if (!updateData.gender || !['MALE', 'FEMALE', 'OTHER'].includes(updateData.gender)) {
        delete updateData.gender;
      }
    }
    if (updateData.maritalStatus !== undefined) {
      if (!updateData.maritalStatus || !['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'].includes(updateData.maritalStatus)) {
        delete updateData.maritalStatus;
      }
    }
    if (updateData.bloodGroup !== undefined) {
      if (!updateData.bloodGroup || !['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'].includes(updateData.bloodGroup)) {
        delete updateData.bloodGroup;
      }
    }

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    // Detect employment status/type changes for history tracking
    const statusChanged = body.employmentStatus && body.employmentStatus !== existingEmployee.employmentStatus;
    const typeChanged = body.employmentType && body.employmentType !== existingEmployee.employmentType;

    const updatedEmployee = await prisma.$transaction(async (tx) => {
      // Update employee
      const employee = await tx.employee.update({
        where: { id: existingEmployee.id },
        data: updateData,
        include: {
          department: { select: { id: true, name: true } },
          shift: { select: { id: true, name: true } },
          salary: true,
        },
      });

      // Handle emergency contacts update
      if (body.emergencyContacts && Array.isArray(body.emergencyContacts)) {
        // Delete existing emergency contacts
        await tx.emergencyContact.deleteMany({
          where: { employeeId: existingEmployee.id },
        });
        // Create new emergency contacts
        const validContacts = body.emergencyContacts.filter(
          (c: { name?: string; phone?: string; relationship?: string }) => c.name && c.phone && c.relationship
        );
        if (validContacts.length > 0) {
          await tx.emergencyContact.createMany({
            data: validContacts.map((c: { name: string; phone: string; relationship: string }) => ({
              employeeId: existingEmployee.id,
              name: c.name,
              phone: c.phone,
              relationship: c.relationship,
            })),
          });
        }
      }

      // Auto-toggle user.isActive based on employmentStatus
      const statusField = body.employmentStatus;
      if (statusField && existingEmployee.userId) {
        const inactiveStatuses = ['INACTIVE', 'TERMINATED', 'RESIGNED', 'SUSPENDED', 'ABSCONDED'];
        const shouldBeActive = !inactiveStatuses.includes(statusField);
        await tx.user.update({
          where: { id: existingEmployee.userId },
          data: { isActive: shouldBeActive },
        });
      }

      // Update user record (role, password, email sync)
      if (canEditOthers) {
        const userUpdateData: Record<string, unknown> = {};
        
        if (role) {
          userUpdateData.role = role;
        }
        
        // Update password if provided
        if (password) {
          const { hashPassword } = await import('@/lib/auth');
          userUpdateData.password = await hashPassword(password);
        }

        // Sync email to User model so login works with updated email
        if (body.email && body.email !== existingEmployee.email) {
          userUpdateData.email = body.email;
        }

        if (Object.keys(userUpdateData).length > 0) {
          await tx.user.update({
            where: { id: existingEmployee.userId },
            data: userUpdateData,
          });
        }
      }

      // Update or create salary if admin/HR
      if (canEditOthers && basicSalary && parseFloat(basicSalary) > 0) {
        const salaryData = {
          basicSalary: parseFloat(basicSalary) || 0,
          hra: parseFloat(hra) || 0,
          da: parseFloat(da) || 0,
          ta: parseFloat(ta) || 0,
          medicalAllowance: parseFloat(medicalAllowance) || 0,
          otherAllowances: parseFloat(otherAllowances) || 0,
          pf: parseFloat(pf) || 0,
          esi: parseFloat(esi) || 0,
          professionalTax: parseFloat(professionalTax) || 0,
          tds: parseFloat(tds) || 0,
          otherDeductions: parseFloat(otherDeductions) || 0,
          grossSalary: 0,
          netSalary: 0,
          effectiveFrom: new Date(),
        };

        // Calculate gross and net salary
        salaryData.grossSalary = salaryData.basicSalary + salaryData.hra + salaryData.da + 
                                  salaryData.ta + salaryData.medicalAllowance + salaryData.otherAllowances;
        salaryData.netSalary = salaryData.grossSalary - salaryData.pf - salaryData.esi - 
                                salaryData.professionalTax - salaryData.tds - salaryData.otherDeductions;

        // Upsert salary
        await tx.salary.upsert({
          where: { employeeId: existingEmployee.id },
          update: salaryData,
          create: { ...salaryData, employeeId: existingEmployee.id },
        });
      }

      // Create history records for employment status/type changes
      if (statusChanged) {
        await tx.employeeHistory.create({
          data: {
            employeeId: existingEmployee.id,
            type: 'STATUS_CHANGE',
            effectiveDate: new Date(),
            oldEmploymentStatus: existingEmployee.employmentStatus,
            newEmploymentStatus: body.employmentStatus,
            reason: 'Updated via employee edit',
            approvedById: user!.userId,
          },
        });
      }
      if (typeChanged) {
        await tx.employeeHistory.create({
          data: {
            employeeId: existingEmployee.id,
            type: 'TYPE_CHANGE',
            effectiveDate: new Date(),
            oldEmploymentType: existingEmployee.employmentType,
            newEmploymentType: body.employmentType,
            reason: 'Updated via employee edit',
            approvedById: user!.userId,
          },
        });
      }

      return employee;
    });

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.EMPLOYEE_UPDATE,
      module: ActivityModules.EMPLOYEE,
      resourceId: existingEmployee.id,
      description: `Updated employee: ${existingEmployee.firstName} ${existingEmployee.lastName}`,
      oldData: existingEmployee,
      newData: updatedEmployee,
      request,
    });

    // Notify employee about status/type changes
    if ((statusChanged || typeChanged) && existingEmployee.userId) {
      const statusLabels: Record<string, string> = {
        ACTIVE: 'Active', INACTIVE: 'Inactive', ON_LEAVE: 'On Leave', PROBATION: 'Probation',
        SUSPENDED: 'Suspended', RESIGNED: 'Resigned', TERMINATED: 'Terminated', ON_NOTICE: 'On Notice',
        RETIRED: 'Retired', ABSCONDED: 'Absconded',
      };
      const typeLabels: Record<string, string> = {
        PERMANENT: 'Permanent', CONTRACT: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Intern',
        PART_TIME: 'Part-Time', REMOTE: 'Remote', FREELANCER: 'Freelancer', CONSULTANT: 'Consultant',
      };
      const parts: string[] = [];
      if (statusChanged) parts.push(`Status: ${statusLabels[existingEmployee.employmentStatus] || existingEmployee.employmentStatus} → ${statusLabels[body.employmentStatus] || body.employmentStatus}`);
      if (typeChanged) parts.push(`Type: ${typeLabels[existingEmployee.employmentType] || existingEmployee.employmentType} → ${typeLabels[body.employmentType] || body.employmentType}`);

      await notify({
        userId: existingEmployee.userId,
        title: 'Employment Update',
        message: parts.join(' | '),
        type: 'PROMOTION',
        module: 'promotions',
        link: '/dashboard/notifications',
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedEmployee,
    });
  } catch (error: unknown) {
    console.error('Update employee error:', error);
    
    // Handle Prisma errors with user-friendly messages
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: { target?: string[]; field_name?: string } };
      
      switch (prismaError.code) {
        case 'P2002':
          const field = prismaError.meta?.target?.[0] || 'field';
          return NextResponse.json(
            { error: `A record with this ${field} already exists. Please use a different value.` },
            { status: 409 }
          );
        case 'P2003':
          return NextResponse.json(
            { error: 'Invalid reference. Please check department, designation, or other selected values.' },
            { status: 400 }
          );
        case 'P2025':
          return NextResponse.json(
            { error: 'Record not found. It may have been deleted. Please refresh the page.' },
            { status: 404 }
          );
        case 'P2011':
          const nullField = prismaError.meta?.field_name || 'Required field';
          return NextResponse.json(
            { error: `${nullField} cannot be empty.` },
            { status: 400 }
          );
      }
    }
    
    if (error instanceof Error && error.message.includes('Invalid')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update employee. Please check your input and try again.' },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/[id] - Delete employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'employees', 'delete');
    if (!perm.allowed) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const { id } = await params;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const existingEmployee = await prisma.employee.findFirst({
      where: isUUID ? { id } : { employeeCode: id },
      include: { user: true },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Delete user (cascade will delete employee)
    await prisma.user.delete({
      where: { id: existingEmployee.userId },
    });

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.EMPLOYEE_DELETE,
      module: ActivityModules.EMPLOYEE,
      resourceId: existingEmployee.id,
      description: `Deleted employee: ${existingEmployee.firstName} ${existingEmployee.lastName}`,
      oldData: existingEmployee,
      request,
    });

    return NextResponse.json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
