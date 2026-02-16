import 'dotenv/config';
import { PrismaClient, AttendanceStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAttendance() {
  console.log('🌱 Seeding attendance records...');

  try {
    // Get all active employees
    const employees = await prisma.employee.findMany({
      where: { employmentStatus: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, shiftId: true },
    });

    if (employees.length === 0) {
      console.log('❌ No employees found. Please seed employees first.');
      return;
    }

    console.log(`Found ${employees.length} employees`);

    // Create attendance records for the past 7 days
    const today = new Date();
    const records = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      for (const employee of employees) {
        // Randomly decide if employee was present (90% chance)
        const isPresent = Math.random() > 0.1;
        
        if (!isPresent) {
          // Create absent record
          records.push({
            employeeId: employee.id,
            date,
            status: 'ABSENT' as AttendanceStatus,
            checkIn: null,
            checkOut: null,
            workHours: 0,
            isLate: false,
            lateMinutes: 0,
          });
          continue;
        }

        // Random check-in time (8:30 AM - 9:30 AM)
        const checkInHour = 8;
        const checkInMinute = Math.floor(Math.random() * 60) + 30; // 30-90 minutes
        const checkIn = new Date(date);
        checkIn.setHours(checkInHour, checkInMinute > 60 ? checkInMinute - 60 : checkInMinute, 0, 0);
        if (checkInMinute > 60) checkIn.setHours(checkInHour + 1);

        // Random check-out time (5:00 PM - 6:30 PM)
        const checkOutHour = 17;
        const checkOutMinute = Math.floor(Math.random() * 90);
        const checkOut = new Date(date);
        checkOut.setHours(checkOutHour, checkOutMinute, 0, 0);

        // Calculate work hours
        const workHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

        // Determine if late (after 9:15 AM)
        const isLate = checkIn.getHours() > 9 || (checkIn.getHours() === 9 && checkIn.getMinutes() > 15);
        const lateMinutes = isLate ? Math.floor(Math.random() * 30) + 5 : 0;

        records.push({
          employeeId: employee.id,
          date,
          status: 'PRESENT' as AttendanceStatus,
          checkIn,
          checkOut,
          workHours: parseFloat(workHours.toFixed(2)),
          isLate,
          lateMinutes,
        });
      }
    }

    // Bulk insert attendance records
    console.log(`Creating ${records.length} attendance records...`);
    
    for (const record of records) {
      await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: record.employeeId,
            date: record.date,
          },
        },
        update: record,
        create: record,
      });
    }

    console.log(`✅ Successfully created ${records.length} attendance records!`);
    console.log(`📅 Date range: ${new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()} - ${today.toLocaleDateString()}`);
  } catch (error) {
    console.error('❌ Error seeding attendance:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedAttendance();
