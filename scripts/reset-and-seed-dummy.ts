import 'dotenv/config';
import { PrismaClient, AttendanceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Helpers ───
function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6; // Sunday or Saturday
}

function localDate(y: number, m: number, d: number): Date {
  // Create date at noon UTC to avoid timezone shifts
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function getWorkingDaysInMonth(year: number, month: number, holidays: Date[]): Date[] {
  const days: Date[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = localDate(year, month, d);
    if (isWeekend(date)) continue;
    const isHoliday = holidays.some(h => 
      h.getUTCFullYear() === date.getUTCFullYear() && 
      h.getUTCMonth() === date.getUTCMonth() && 
      h.getUTCDate() === date.getUTCDate()
    );
    if (isHoliday) continue;
    days.push(date);
  }
  return days;
}

async function main() {
  console.log('🗑️  Clearing existing data...\n');

  // Delete in order of foreign key dependencies
  await prisma.manualDeduction.deleteMany();
  await prisma.payrollRecord.deleteMany();
  await prisma.payrollSettings.deleteMany();
  await prisma.salaryHistory.deleteMany();
  await prisma.salary.deleteMany();
  await prisma.attendanceBreak.deleteMany();
  await prisma.attendanceCorrection.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.taxCertificate.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.assignedDocument.deleteMany();
  await prisma.education.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ All user/employee/attendance/leave/payroll data cleared\n');

  // ─── Fetch existing lookup data ───
  const departments = await prisma.department.findMany({ orderBy: { code: 'asc' } });
  const shifts = await prisma.shift.findMany();
  const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });
  const holidays = await prisma.holiday.findMany({ where: { year: 2026 } });
  const holidayDates = holidays.map(h => h.date);

  if (departments.length === 0 || shifts.length === 0) {
    console.error('❌ No departments or shifts found. Run `npx prisma db seed` first to create base data.');
    return;
  }

  const generalShift = shifts.find(s => s.code === 'GENERAL') || shifts[0];
  const morningShift = shifts.find(s => s.code === 'MORNING') || generalShift;
  const deptMap: Record<string, string> = {};
  departments.forEach(d => { deptMap[d.code] = d.id; });

  console.log(`📋 Found ${departments.length} departments, ${shifts.length} shifts, ${leaveTypes.length} leave types, ${holidays.length} holidays\n`);

  // ─── Create Users & Employees ───
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const employeeData = [
    { code: 'ADMIN001', email: 'admin@hrms.com', role: 'ADMIN' as const, firstName: 'Ahmed', lastName: 'Khan', phone: '+92 300 1234567', dept: 'MGMT', designation: 'Chief Executive Officer', dob: '1982-03-15', gender: 'MALE' as const, city: 'Islamabad', state: 'ICT', shift: generalShift.id, joining: '2020-01-01', basic: 350000, hra: 80000, da: 0, ta: 15000, medical: 20000, other: 10000, pf: 12000, tds: 0 },
    { code: 'HR001', email: 'hr@hrms.com', role: 'HR' as const, firstName: 'Fatima', lastName: 'Ali', phone: '+92 321 9876543', dept: 'HR', designation: 'HR Manager', dob: '1990-07-22', gender: 'FEMALE' as const, city: 'Lahore', state: 'Punjab', shift: generalShift.id, joining: '2021-03-15', basic: 120000, hra: 30000, da: 0, ta: 8000, medical: 10000, other: 5000, pf: 6000, tds: 0 },
    { code: 'EMP001', email: 'usman@hrms.com', role: 'EMPLOYEE' as const, firstName: 'Usman', lastName: 'Malik', phone: '+92 333 5551234', dept: 'IT', designation: 'Senior Developer', dob: '1995-08-10', gender: 'MALE' as const, city: 'Karachi', state: 'Sindh', shift: generalShift.id, joining: '2022-06-01', basic: 150000, hra: 35000, da: 0, ta: 10000, medical: 10000, other: 5000, pf: 7500, tds: 0 },
    { code: 'EMP002', email: 'ayesha@hrms.com', role: 'EMPLOYEE' as const, firstName: 'Ayesha', lastName: 'Siddiqui', phone: '+92 345 6789012', dept: 'FIN', designation: 'Accountant', dob: '1993-11-05', gender: 'FEMALE' as const, city: 'Islamabad', state: 'ICT', shift: generalShift.id, joining: '2023-01-10', basic: 90000, hra: 22000, da: 0, ta: 6000, medical: 8000, other: 4000, pf: 4500, tds: 0 },
    { code: 'EMP003', email: 'bilal@hrms.com', role: 'EMPLOYEE' as const, firstName: 'Bilal', lastName: 'Ahmed', phone: '+92 300 7654321', dept: 'IT', designation: 'Junior Developer', dob: '1998-02-28', gender: 'MALE' as const, city: 'Lahore', state: 'Punjab', shift: generalShift.id, joining: '2024-04-01', basic: 75000, hra: 18000, da: 0, ta: 5000, medical: 5000, other: 2000, pf: 3750, tds: 0 },
    { code: 'EMP004', email: 'zainab@hrms.com', role: 'EMPLOYEE' as const, firstName: 'Zainab', lastName: 'Hussain', phone: '+92 311 1122334', dept: 'HR', designation: 'HR Executive', dob: '1996-09-18', gender: 'FEMALE' as const, city: 'Rawalpindi', state: 'Punjab', shift: generalShift.id, joining: '2023-08-15', basic: 80000, hra: 20000, da: 0, ta: 5000, medical: 5000, other: 3000, pf: 4000, tds: 0 },
    { code: 'EMP005', email: 'hamza@hrms.com', role: 'EMPLOYEE' as const, firstName: 'Hamza', lastName: 'Raza', phone: '+92 322 9988776', dept: 'SALES', designation: 'Sales Executive', dob: '1994-05-12', gender: 'MALE' as const, city: 'Faisalabad', state: 'Punjab', shift: morningShift.id, joining: '2022-11-01', basic: 85000, hra: 20000, da: 0, ta: 8000, medical: 5000, other: 5000, pf: 4250, tds: 0 },
    { code: 'EMP006', email: 'sana@hrms.com', role: 'EMPLOYEE' as const, firstName: 'Sana', lastName: 'Sheikh', phone: '+92 336 4455667', dept: 'FIN', designation: 'Finance Manager', dob: '1988-12-03', gender: 'FEMALE' as const, city: 'Karachi', state: 'Sindh', shift: generalShift.id, joining: '2021-07-01', basic: 160000, hra: 40000, da: 0, ta: 12000, medical: 12000, other: 6000, pf: 8000, tds: 0 },
    { code: 'EMP007', email: 'ali@hrms.com', role: 'EMPLOYEE' as const, firstName: 'Ali', lastName: 'Hassan', phone: '+92 303 2233445', dept: 'IT', designation: 'Team Lead', dob: '1991-01-25', gender: 'MALE' as const, city: 'Islamabad', state: 'ICT', shift: generalShift.id, joining: '2021-02-15', basic: 180000, hra: 45000, da: 0, ta: 12000, medical: 12000, other: 8000, pf: 9000, tds: 0 },
    { code: 'EMP008', email: 'maria@hrms.com', role: 'EMPLOYEE' as const, firstName: 'Maria', lastName: 'Nawaz', phone: '+92 315 5566778', dept: 'SALES', designation: 'Sales Manager', dob: '1989-06-30', gender: 'FEMALE' as const, city: 'Multan', state: 'Punjab', shift: generalShift.id, joining: '2020-09-01', basic: 140000, hra: 35000, da: 0, ta: 10000, medical: 10000, other: 5000, pf: 7000, tds: 0 },
  ];

  const createdEmployees: { id: string; code: string; shiftId: string; basic: number; hra: number; da: number; ta: number; medical: number; other: number; pf: number; tds: number; gross: number; net: number }[] = [];

  for (const emp of employeeData) {
    const user = await prisma.user.create({
      data: {
        employeeId: emp.code,
        email: emp.email,
        password: hashedPassword,
        role: emp.role,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        employeeCode: emp.code,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        departmentId: deptMap[emp.dept],
        designation: emp.designation,
        shiftId: emp.shift,
        joiningDate: new Date(emp.joining),
        employmentType: 'PERMANENT',
        dateOfBirth: new Date(emp.dob),
        gender: emp.gender,
        city: emp.city,
        state: emp.state,
        country: 'Pakistan',
      },
    });

    const gross = emp.basic + emp.hra + emp.da + emp.ta + emp.medical + emp.other;
    const net = gross - emp.pf - emp.tds;

    // Create salary record
    await prisma.salary.create({
      data: {
        employeeId: employee.id,
        basicSalary: emp.basic,
        hra: emp.hra,
        da: emp.da,
        ta: emp.ta,
        medicalAllowance: emp.medical,
        otherAllowances: emp.other,
        pf: emp.pf,
        tds: emp.tds,
        grossSalary: gross,
        netSalary: net,
        effectiveFrom: new Date(emp.joining),
      },
    });

    createdEmployees.push({
      id: employee.id, code: emp.code, shiftId: emp.shift,
      basic: emp.basic, hra: emp.hra, da: emp.da, ta: emp.ta,
      medical: emp.medical, other: emp.other, pf: emp.pf, tds: emp.tds,
      gross, net,
    });

    console.log(`  👤 ${emp.firstName} ${emp.lastName} (${emp.code}) — ${emp.designation} — Rs ${gross.toLocaleString()}`);
  }

  console.log(`\n✅ Created ${createdEmployees.length} employees with salaries\n`);

  // ─── Create Leave Balances ───
  for (const emp of createdEmployees) {
    for (const lt of leaveTypes) {
      await prisma.leaveBalance.create({
        data: {
          employeeId: emp.id,
          leaveTypeId: lt.id,
          year: 2026,
          totalDays: lt.annualAllocation,
          usedDays: 0,
          pendingDays: 0,
          carryForward: 0,
        },
      });
    }
  }
  console.log('✅ Leave balances created for all employees\n');

  // ─── 3 Months: Dec 2025, Jan 2026, Feb 2026 ───
  const months = [
    { year: 2025, month: 12 },
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
  ];

  // Also load 2025 holidays
  const holidays2025 = await prisma.holiday.findMany({ where: { year: 2025 } });
  const allHolidayDates = [...holidayDates, ...holidays2025.map(h => h.date)];

  let totalAttendance = 0;
  let totalLeaves = 0;

  for (const { year, month } of months) {
    const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });
    console.log(`📅 Processing ${monthName} ${year}...`);

    const workingDays = getWorkingDaysInMonth(year, month, allHolidayDates);
    
    // For Feb 2026, only up to today (Feb 6)
    const today = new Date();
    const cutoffDate = localDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const attendanceDays = (year === 2026 && month === 2)
      ? workingDays.filter(d => d <= cutoffDate)
      : workingDays;

    console.log(`   Working days: ${workingDays.length}, Attendance days: ${attendanceDays.length}`);

    // ─── Create Attendance Records ───
    for (const emp of createdEmployees) {
      // Each employee gets a random pattern
      let lateCount = 0;
      let absentCount = 0;
      let presentCount = 0;
      let leaveCount = 0;

      for (const day of attendanceDays) {
        const rand = Math.random();

        // 5% chance absent, 5% chance on leave, 90% present
        if (rand < 0.05) {
          // Absent
          await prisma.attendance.create({
            data: {
              employeeId: emp.id,
              date: day,
              status: 'ABSENT' as AttendanceStatus,
              workHours: 0,
              isLate: false,
              lateMinutes: 0,
            },
          });
          absentCount++;
        } else if (rand < 0.10) {
          // On Leave
          await prisma.attendance.create({
            data: {
              employeeId: emp.id,
              date: day,
              status: 'ON_LEAVE' as AttendanceStatus,
              workHours: 0,
              isLate: false,
              lateMinutes: 0,
              notes: 'Leave',
            },
          });
          leaveCount++;
        } else {
          // Present — random check-in 8:30-9:40, checkout 17:00-18:30
          const ciHour = 8;
          const ciMin = randomBetween(30, 100); // 8:30 to 9:40
          const checkIn = new Date(day);
          checkIn.setUTCHours(ciMin >= 60 ? ciHour + 1 : ciHour, ciMin >= 60 ? ciMin - 60 : ciMin, randomBetween(0, 59));

          const coHour = randomBetween(17, 18);
          const coMin = randomBetween(0, coHour === 18 ? 30 : 59);
          const checkOut = new Date(day);
          checkOut.setUTCHours(coHour, coMin, randomBetween(0, 59));

          const workHours = parseFloat(((checkOut.getTime() - checkIn.getTime()) / 3600000).toFixed(2));

          // Late if check-in after 9:15
          const actualHour = checkIn.getUTCHours();
          const actualMin = checkIn.getUTCMinutes();
          const isLate = actualHour > 9 || (actualHour === 9 && actualMin > 15);
          const lateMinutes = isLate ? (actualHour - 9) * 60 + actualMin - 15 : 0;
          if (isLate) lateCount++;

          await prisma.attendance.create({
            data: {
              employeeId: emp.id,
              date: day,
              status: 'PRESENT' as AttendanceStatus,
              checkIn,
              checkOut,
              workHours,
              isLate,
              lateMinutes: Math.max(0, lateMinutes),
            },
          });
          presentCount++;
        }
        totalAttendance++;
      }

      // ─── Create Leave Requests for ON_LEAVE days ───
      if (leaveCount > 0) {
        // Find ON_LEAVE days for this employee in this month
        const onLeaveDays = await prisma.attendance.findMany({
          where: {
            employeeId: emp.id,
            status: 'ON_LEAVE',
            date: {
              gte: localDate(year, month, 1),
              lt: localDate(year, month === 12 ? 1 : month + 1, 1),
            },
          },
          orderBy: { date: 'asc' },
        });

        if (onLeaveDays.length > 0) {
          const casualLeave = leaveTypes.find(lt => lt.code === 'CL');
          const sickLeave = leaveTypes.find(lt => lt.code === 'SL');
          
          for (const lDay of onLeaveDays) {
            const leaveType = Math.random() > 0.5 ? casualLeave : sickLeave;
            if (!leaveType) continue;

            // Get admin employee for approval
            const adminEmp = createdEmployees.find(e => e.code === 'ADMIN001');

            await prisma.leaveRequest.create({
              data: {
                employeeId: emp.id,
                leaveTypeId: leaveType.id,
                startDate: lDay.date,
                endDate: lDay.date,
                totalDays: 1,
                reason: leaveType.code === 'CL' ? 'Personal work' : 'Not feeling well',
                status: 'APPROVED',
                approvedById: adminEmp?.id || emp.id,
                approvedAt: lDay.date,
              },
            });
            totalLeaves++;

            // Update leave balance
            await prisma.leaveBalance.updateMany({
              where: { employeeId: emp.id, leaveTypeId: leaveType.id, year: 2026 },
              data: { usedDays: { increment: 1 } },
            });
          }
        }
      }
    }

    // ─── Create Payroll Records (only for completed months: Dec & Jan) ───
    if (!(year === 2026 && month === 2)) {
      console.log(`   💰 Generating payroll...`);

      for (const emp of createdEmployees) {
        // Count attendance stats for this employee/month
        const monthStart = localDate(year, month, 1);
        const monthEnd = localDate(year === 2025 && month === 12 ? 2026 : year, month === 12 ? 1 : month + 1, 1);

        const attendanceRecords = await prisma.attendance.findMany({
          where: {
            employeeId: emp.id,
            date: { gte: monthStart, lt: monthEnd },
          },
        });

        const present = attendanceRecords.filter(a => a.status === 'PRESENT').length;
        const onLeave = attendanceRecords.filter(a => a.status === 'ON_LEAVE').length;
        const absent = attendanceRecords.filter(a => a.status === 'ABSENT').length;
        const late = attendanceRecords.filter(a => a.isLate).length;

        // Calculate deductions
        const perDaySalary = emp.gross / workingDays.length;
        const absentDeduction = absent * perDaySalary;
        
        // Late deduction: 0 for ≤2, small for 3-4, bigger for 5+
        let lateDeduction = 0;
        if (late >= 5) {
          lateDeduction = perDaySalary; // 1 day salary
        } else if (late >= 3) {
          lateDeduction = perDaySalary * 0.5;
        }

        const grossEarnings = emp.gross;
        const totalDeductions = emp.pf + emp.tds + absentDeduction + lateDeduction;
        const netSalary = grossEarnings - totalDeductions;

        // Dec = PAID, Jan = PAID
        const isPaid = true;

        await prisma.payrollRecord.create({
          data: {
            employeeId: emp.id,
            month,
            year,
            workingDays: workingDays.length,
            presentDays: present + onLeave, // paid leaves count as present
            leaveDays: onLeave,
            absentDays: absent,
            lateDays: late,
            basicSalary: emp.basic,
            hra: emp.hra,
            da: emp.da,
            ta: emp.ta,
            medicalAllowance: emp.medical,
            otherAllowances: emp.other,
            pf: emp.pf,
            tds: emp.tds,
            lateDeduction: Math.round(lateDeduction),
            otherDeductions: Math.round(absentDeduction),
            grossEarnings: Math.round(grossEarnings),
            totalDeductions: Math.round(totalDeductions),
            netSalary: Math.round(netSalary),
            status: isPaid ? 'PAID' : 'DRAFT',
            paidAt: isPaid ? new Date(year, month, 5) : null, // Paid on 5th of next month
          },
        });
      }
    }

    console.log(`   ✅ Done\n`);
  }

  // ─── Create an announcement ───
  const adminEmp = await prisma.employee.findFirst({ where: { employeeCode: 'ADMIN001' } });
  if (adminEmp) {
    const adminUser = await prisma.user.findFirst({ where: { id: adminEmp.userId } });
    if (adminUser) {
      await prisma.announcement.create({
        data: {
          title: 'Welcome to HRMS Portal',
          content: 'Assalam-o-Alaikum! Welcome to our new HR Management System. Please update your profiles and check your attendance regularly. For any issues, contact HR department.\n\nRegards,\nManagement',
          type: 'GENERAL',
          priority: 'HIGH',
          publishDate: new Date(),
          isActive: true,
          createdById: adminUser.id,
        },
      });

      await prisma.announcement.create({
        data: {
          title: 'Salary Disbursement Notice - January 2026',
          content: 'Dear Employees,\n\nJanuary 2026 salaries have been processed and disbursed to your bank accounts. Please check your payslips on the portal.\n\nFor any discrepancies, contact HR within 3 working days.\n\nRegards,\nFinance Department',
          type: 'GENERAL',
          priority: 'NORMAL',
          publishDate: new Date('2026-02-05'),
          isActive: true,
          createdById: adminUser.id,
        },
      });
    }
  }
  console.log('✅ Announcements created\n');

  console.log('═══════════════════════════════════════════');
  console.log('🎉 Dummy data seeding complete!');
  console.log('═══════════════════════════════════════════');
  console.log(`👤 Employees: ${createdEmployees.length}`);
  console.log(`📅 Attendance records: ${totalAttendance}`);
  console.log(`🏖️  Leave requests: ${totalLeaves}`);
  console.log(`💰 Payroll records: ${createdEmployees.length * 2} (Dec 2025 + Jan 2026 — PAID)`);
  console.log(`📢 Announcements: 2`);
  console.log('');
  console.log('📝 Login credentials (all password: admin123):');
  console.log('   Admin:    admin@hrms.com');
  console.log('   HR:       hr@hrms.com');
  console.log('   Employee: usman@hrms.com');
  console.log('   Employee: ayesha@hrms.com');
  console.log('   Employee: bilal@hrms.com');
  console.log('   Employee: zainab@hrms.com');
  console.log('   Employee: hamza@hrms.com');
  console.log('   Employee: sana@hrms.com');
  console.log('   Employee: ali@hrms.com');
  console.log('   Employee: maria@hrms.com');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
