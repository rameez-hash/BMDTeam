import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { hashPassword } from '@/lib/auth';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { getPaginationParams } from '@/lib/utils';

// GET /api/employees - List all employees
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPaginationParams(searchParams);
    
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Build where clause
    const where: Record<string, unknown> = {};
    
    // Admin users should never appear in employee list — they have a separate admin page
    where.user = { role: { not: 'ADMIN' } };

    if (departmentId) where.departmentId = departmentId;
    if (status) where.employmentStatus = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { employeeCode: { contains: search } },
      ];
    }

    // Permission-based scoping
    const perm = await checkPermission(user!.userId, user!.role, 'employees', 'view');
    if (!perm.allowed) {
      // Users without employees.view can only see themselves
      where.userId = user!.userId;
    } else if (perm.scope === 'SELF') {
      where.userId = user!.userId;
    } else if (perm.scope === 'DEPARTMENT' && user!.departmentId) {
      where.departmentId = user!.departmentId;
    }
    // scope === 'ALL' → no extra filter

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        include: {
          department: { select: { id: true, name: true } },
          shift: { 
            select: { 
              id: true, 
              name: true,
              startTime: true,
              endTime: true,
              breakDuration: true,
              graceTime: true,
              earlyCheckInGrace: true,
              checkOutGrace: true,
              standardWorkHours: true,
              minCheckInGap: true,
            } 
          },
          user: { select: { role: true, isActive: true, lastLogin: true } },
          salary: { select: { basicSalary: true, grossSalary: true, netSalary: true } },
          appRole: { select: { id: true, name: true, color: true } },
          emergencyContacts: { select: { id: true, name: true, phone: true, relationship: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/employees - Create new employee
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'employees', 'create');
    if (!perm.allowed) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const body = await request.json();
    const {
      employeeCode,
      firstName,
      lastName,
      email,
      password,
      phone,
      dateOfBirth,
      gender,
      maritalStatus,
      bloodGroup,
      nationality,
      address,
      city,
      state,
      country,
      zipCode,
      departmentId,
      designation,
      shiftId,
      reportingManagerId,
      joiningDate,
      employmentType,
      employmentStatus,
      probationPeriod, // in months
      confirmationDate,
      role = 'EMPLOYEE',
      appRoleId,
      bankName,
      bankAccountNumber,
      ifscCode,
      panNumber,
      // Salary fields
      basicSalary,
      hra,
      da,
      ta,
      medicalAllowance,
      otherAllowances,
      pf,
      esi,
      professionalTax,
      tds,
      otherDeductions,
    } = body;

    // Comprehensive Validation
    const errors: string[] = [];

    // Basic Info - Required Fields
    if (!firstName || firstName.trim() === '') {
      errors.push('First name is required');
    }
    if (!lastName || lastName.trim() === '') {
      errors.push('Last name is required');
    }
    if (!email || email.trim() === '') {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Invalid email format');
    }
    if (!password || password.trim() === '') {
      errors.push('Password is required');
    } else if (password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    // Employment Details - Required Fields
    if (!departmentId || departmentId.trim() === '') {
      errors.push('Department is required');
    }
    if (!joiningDate || joiningDate.trim() === '') {
      errors.push('Joining date is required');
    }

    // Phone validation (optional but must be valid if provided)
    if (phone && !/^[+]?[\d\s-]{10,15}$/.test(phone.replace(/\s/g, ''))) {
      errors.push('Invalid phone number format');
    }

    // Return all validation errors
    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors.join(', '), errors },
        { status: 400 }
      );
    }

    // Auto-generate employee code if not provided (format: BMD-1, BMD-2, etc.)
    let finalEmployeeCode = employeeCode;
    if (!finalEmployeeCode) {
      // Get the highest existing employee code number
      const lastEmployee = await prisma.employee.findFirst({
        where: {
          employeeCode: { startsWith: 'BMD-' }
        },
        orderBy: { createdAt: 'desc' },
        select: { employeeCode: true }
      });

      let nextNumber = 1;
      if (lastEmployee?.employeeCode) {
        const match = lastEmployee.employeeCode.match(/BMD-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      // Also check for any gaps by finding the max number
      const allCodes = await prisma.employee.findMany({
        where: { employeeCode: { startsWith: 'BMD-' } },
        select: { employeeCode: true }
      });
      
      const maxNumber = allCodes.reduce((max, emp) => {
        const match = emp.employeeCode.match(/BMD-(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          return num > max ? num : max;
        }
        return max;
      }, 0);

      nextNumber = Math.max(nextNumber, maxNumber + 1);
      finalEmployeeCode = `BMD-${nextNumber}`;
    }

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { employeeId: finalEmployeeCode },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email or employee code already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    // Helper function to safely parse dates (date-only → UTC midnight)
    const parseDate = (dateValue: unknown): Date | null => {
      if (!dateValue || dateValue === '') return null;
      if (typeof dateValue === 'string' && dateValue.trim() !== '') {
        const str = dateValue.trim();
        // Append T00:00:00Z if it's a date-only string to ensure UTC
        const parsed = new Date(str.includes('T') ? str : str + 'T00:00:00Z');
        if (!isNaN(parsed.getTime())) return parsed;
      }
      return null;
    };

    const parsedJoiningDate = parseDate(joiningDate);
    const parsedDateOfBirth = parseDate(dateOfBirth);

    // Calculate confirmation date based on probation period
    let calculatedConfirmationDate = parseDate(confirmationDate);
    const probMonths = parseInt(probationPeriod || body.probationMonths || '0') || 0;
    if (!calculatedConfirmationDate && probMonths && parsedJoiningDate) {
      const joinDate = new Date(parsedJoiningDate);
      calculatedConfirmationDate = new Date(joinDate.setMonth(joinDate.getMonth() + probMonths));
    }

    // Calculate probation end date
    let probationEndDate: Date | null = null;
    if (probMonths && parsedJoiningDate) {
      const jd = new Date(parsedJoiningDate);
      probationEndDate = new Date(jd.setMonth(jd.getMonth() + probMonths));
    }

    // Calculate notice period end date (only if status is ON_NOTICE)
    const noticeMonths = parseInt(body.noticePeriodMonths || '0') || 0;
    let noticePeriodEndDate: Date | null = null;
    if (noticeMonths && employmentStatus === 'ON_NOTICE') {
      const now = new Date();
      noticePeriodEndDate = new Date(now.setMonth(now.getMonth() + noticeMonths));
    }

    // Create user and employee in transaction
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          employeeId: finalEmployeeCode,
          email,
          password: hashedPassword,
          role,
        },
      });

      // Build employee data, only include enum fields if they have valid values
      const employeeData: Record<string, unknown> = {
        userId: newUser.id,
        employeeCode: finalEmployeeCode,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        dateOfBirth: parsedDateOfBirth,
        nationality: nationality?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        country: country?.trim() || null,
        zipCode: zipCode?.trim() || null,
        designation: designation?.trim() || null,
        reportingManagerId: reportingManagerId || null,
        joiningDate: parsedJoiningDate,
        confirmationDate: calculatedConfirmationDate,
        employmentType: employmentType || 'FULL_TIME',
        employmentStatus: employmentStatus || 'ACTIVE',
        probationMonths: probMonths || null,
        probationEndDate: probationEndDate,
        noticePeriodMonths: noticeMonths || null,
        noticePeriodEndDate: noticePeriodEndDate,
        bankName: bankName?.trim() || null,
        bankAccountNumber: bankAccountNumber?.trim() || null,
        ifscCode: ifscCode?.trim() || null,
        panNumber: panNumber?.trim() || null,
        branchAddress: body.branchAddress?.trim() || null,
      };

      // Add department, shift, role as direct ID fields
      if (departmentId) {
        employeeData.departmentId = departmentId;
      }
      if (shiftId) {
        employeeData.shiftId = shiftId;
      }
      if (appRoleId) {
        employeeData.appRoleId = appRoleId;
      }

      // Only add enum fields if they have valid values
      if (gender && ['MALE', 'FEMALE', 'OTHER'].includes(gender)) {
        employeeData.gender = gender;
      }
      if (maritalStatus && ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'].includes(maritalStatus)) {
        employeeData.maritalStatus = maritalStatus;
      }
      if (bloodGroup && ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'].includes(bloodGroup)) {
        employeeData.bloodGroup = bloodGroup;
      }

      const employee = await tx.employee.create({
        data: employeeData as Parameters<typeof tx.employee.create>[0]['data'],
        include: {
          department: { select: { id: true, name: true } },
          shift: { select: { id: true, name: true } },
        },
      });

      // Create emergency contacts if provided
      if (body.emergencyContacts && Array.isArray(body.emergencyContacts)) {
        const validContacts = body.emergencyContacts.filter(
          (c: { name?: string; phone?: string; relationship?: string }) => c.name && c.phone && c.relationship
        );
        if (validContacts.length > 0) {
          await tx.emergencyContact.createMany({
            data: validContacts.map((c: { name: string; phone: string; relationship: string }) => ({
              employeeId: employee.id,
              name: c.name,
              phone: c.phone,
              relationship: c.relationship,
            })),
          });
        }
      }

      // Create salary record if salary fields provided
      if (basicSalary && parseFloat(basicSalary) > 0) {
        const salaryData = {
          employeeId: employee.id,
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
          effectiveFrom: parsedJoiningDate || new Date(),
        };

        // Calculate gross salary
        salaryData.grossSalary = salaryData.basicSalary + salaryData.hra + salaryData.da + 
                                  salaryData.ta + salaryData.medicalAllowance + salaryData.otherAllowances;

        // Auto-calculate TDS based on tax slabs
        const taxSlabs = await tx.taxSlab.findMany({
          where: { isActive: true },
          orderBy: { minIncome: 'asc' }
        });

        if (taxSlabs.length > 0) {
          const { calculateTax } = await import('@/lib/utils');
          salaryData.tds = calculateTax(salaryData.grossSalary, taxSlabs);
        }

        // Calculate net salary
        salaryData.netSalary = salaryData.grossSalary - salaryData.pf - salaryData.esi - 
                                salaryData.professionalTax - salaryData.tds - salaryData.otherDeductions;

        await tx.salary.create({ data: salaryData });
      }

      return { user: newUser, employee };
    });

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.EMPLOYEE_CREATE,
      module: ActivityModules.EMPLOYEE,
      resourceId: result.employee.id,
      description: `Created new employee: ${firstName} ${lastName} (${finalEmployeeCode})`,
      newData: result.employee,
      request,
    });

    return NextResponse.json({
      success: true,
      data: result.employee,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create employee error:', error);
    
    // Handle Prisma errors with user-friendly messages
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: { target?: string[]; field_name?: string } };
      
      switch (prismaError.code) {
        case 'P2002':
          // Unique constraint violation
          const field = prismaError.meta?.target?.[0] || 'field';
          return NextResponse.json(
            { error: `A record with this ${field} already exists. Please use a different value.` },
            { status: 409 }
          );
        case 'P2003':
          // Foreign key constraint
          return NextResponse.json(
            { error: 'Invalid reference. Please check department, designation, or other selected values.' },
            { status: 400 }
          );
        case 'P2025':
          // Record not found
          return NextResponse.json(
            { error: 'Referenced record not found. Please refresh and try again.' },
            { status: 404 }
          );
        case 'P2011':
          // Null constraint violation
          const nullField = prismaError.meta?.field_name || 'required field';
          return NextResponse.json(
            { error: `${nullField} cannot be empty.` },
            { status: 400 }
          );
      }
    }
    
    // Handle validation errors
    if (error instanceof Error && error.message.includes('Invalid')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create employee. Please check your input and try again.' },
      { status: 500 }
    );
  }
}
