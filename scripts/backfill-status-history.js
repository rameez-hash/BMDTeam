const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Find rameez who is ON_LEAVE but has no history record
  const rameez = await p.employee.findFirst({
    where: { firstName: 'rameez' },
    select: { id: true, firstName: true, lastName: true, employmentStatus: true },
  });

  if (!rameez) {
    console.log('Employee rameez not found');
    await p.$disconnect();
    return;
  }

  console.log('Found:', rameez);

  // Check if a STATUS_CHANGE record already exists
  const existing = await p.employeeHistory.findFirst({
    where: { employeeId: rameez.id, type: 'STATUS_CHANGE' },
  });

  if (existing) {
    console.log('History record already exists:', existing);
    await p.$disconnect();
    return;
  }

  // Find admin user for approvedBy
  const admin = await p.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  
  // Create backfill history record
  const record = await p.employeeHistory.create({
    data: {
      employeeId: rameez.id,
      type: 'STATUS_CHANGE',
      effectiveDate: new Date(),
      oldEmploymentStatus: 'ACTIVE',
      newEmploymentStatus: 'ON_LEAVE',
      reason: 'Status updated to On Leave',
      approvedById: admin?.id || null,
    },
  });

  console.log('Created history record:', record);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
